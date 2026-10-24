import { createRng } from '../../core/rng';
import { generateNumberlink } from './numberlink';
import type { PriklopParams } from '../../core/types';

export interface Cell {
  x: number;
  y: number;
}

export const BAUDS = [9600, 19200, 38400, 115200] as const;
export const ADDRESS_MAX = 16;

export interface Meter {
  id: number;
  device: string;
  x: number;
  y: number;
  port: number;
  address: number;
  baud: number;
}

export interface Port {
  id: number;
  x: number;
  y: number;
  baud: number;
}

export interface Puzzle {
  cols: number;
  rows: number;
  meters: Meter[];
  /** Each meter's own gateway terminal: the other end of its cable. */
  ports: Port[];
  /** The unique route per meter, from meter to its port, filling the board together. */
  solution: Cell[][];
}

export type MeterStatus = 'idle' | 'routing' | 'online' | 'error';

export type PriklopEvent =
  | { type: 'step'; meter: number }
  | { type: 'blocked'; meter: number; cell: Cell }
  | { type: 'cut'; meter: number; cell: Cell }
  | { type: 'online'; meter: number }
  | { type: 'spark'; meter: number; reason: 'address' | 'baud' }
  | { type: 'dropout'; meter: number; cell: Cell }
  | { type: 'unfilled'; empty: number }
  | { type: 'won' }
  | { type: 'timeout' };

const DEVICES = [
  'Analizator omrežja',
  'Števec električne energije',
  'Merilnik pretoka zraka',
  'Tlačni pretvornik',
  'Števec plina',
  'Temperaturna sonda',
  'Merilnik moči kompresorja',
  'Števec toplote',
  'Merilnik jalove energije',
  'Števec vode',
];

export const key = (cols: number, x: number, y: number) => y * cols + x;

/**
 * Builds a "flow" board: every meter has its own terminal, the cables must fill
 * every cell, and there is exactly one way to do it.
 */
export function generatePuzzle(p: PriklopParams): Puzzle {
  const { cols, rows } = p;
  const rng = createRng(p.seed);
  const segs = generateNumberlink(cols, rows, p.meters, rng, p.meters + 1);
  if (!segs) throw new Error(`Priklop: no unique board for seed ${p.seed}`);
  const at = (k: number): Cell => ({ x: k % cols, y: Math.floor(k / cols) });
  const meters: Meter[] = [];
  const ports: Port[] = [];
  const solution: Cell[][] = [];
  const portBaud = rng.pick(BAUDS);
  // Longest cables first, so M1 is the backbone of the board.
  segs.sort((a, b) => b.length - a.length);
  segs.forEach((seg, i) => {
    // The terminal is the end nearer the top: the gateway cabinet hangs above the plant.
    const route = at(seg[0]).y > at(seg[seg.length - 1]).y ? seg.map(at) : [...seg].reverse().map(at);
    const m = route[0];
    const port = route[route.length - 1];
    ports.push({ id: i, x: port.x, y: port.y, baud: i % 3 === 2 ? rng.pick(BAUDS) : portBaud });
    meters.push({ id: i, device: DEVICES[(i + p.seed) % DEVICES.length], x: m.x, y: m.y, port: i, address: 0, baud: 0 });
    solution.push(route);
  });
  const count = meters.length;
  const addresses = rng.shuffle([...Array(ADDRESS_MAX).keys()].map((n) => n + 1)).slice(0, count);
  meters.forEach((m, i) => {
    m.address = addresses[i];
    m.baud = ports[m.port].baud;
  });
  const victims = rng.shuffle([...meters.keys()]);
  for (let i = 0; i < Math.min(p.conflicts, count - 1); i++) {
    const m = meters[victims[i]];
    m.address = meters[victims[(i + 1) % count]].address;
  }
  for (let i = 0; i < Math.min(p.baudMismatch, count); i++) {
    const m = meters[victims[count - 1 - i]];
    m.baud = rng.pick(BAUDS.filter((b) => b !== ports[m.port].baud));
  }
  return { cols, rows, meters, ports, solution };
}

/** Game state on top of a puzzle. Pure logic, rendering subscribes to events. */
export class PriklopGame {
  readonly puzzle: Puzzle;
  readonly timeTotal: number;
  timeLeft: number;
  mistakes = 0;
  paths = new Map<number, Cell[]>();
  status = new Map<number, MeterStatus>();
  active: number | null = null;
  finished: 'won' | 'timeout' | null = null;
  private dropouts: number[];
  private listeners: ((e: PriklopEvent) => void)[] = [];

  constructor(params: PriklopParams, bonusTime = 0) {
    this.puzzle = generatePuzzle(params);
    this.timeTotal = params.timeSec + bonusTime;
    this.timeLeft = this.timeTotal;
    this.dropouts = [...params.dropouts].sort((a, b) => a - b);
    for (const m of this.puzzle.meters) this.status.set(m.id, 'idle');
  }

  on(fn: (e: PriklopEvent) => void) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  private emit(e: PriklopEvent) {
    for (const l of this.listeners) l(e);
  }

  get cols() {
    return this.puzzle.cols;
  }

  meterAt(x: number, y: number) {
    return this.puzzle.meters.find((m) => m.x === x && m.y === y);
  }

  portAt(x: number, y: number) {
    return this.puzzle.ports.find((p) => p.x === x && p.y === y);
  }

  /** The pair (meter id) whose meter or terminal sits on a cell. */
  endpointAt(x: number, y: number): number | null {
    return this.meterAt(x, y)?.id ?? this.portAt(x, y)?.id ?? null;
  }

  /** Which meter's cable runs through a cell, if any. */
  ownerOf(x: number, y: number): number | null {
    for (const [id, path] of this.paths) if (path.some((c) => c.x === x && c.y === y)) return id;
    return null;
  }

  inside(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.puzzle.cols && y < this.puzzle.rows;
  }

  /** Cells covered by a cable or an endpoint. */
  get filled() {
    const seen = new Set<number>();
    for (const m of this.puzzle.meters) seen.add(key(this.cols, m.x, m.y));
    for (const p of this.puzzle.ports) seen.add(key(this.cols, p.x, p.y));
    for (const path of this.paths.values()) for (const c of path) seen.add(key(this.cols, c.x, c.y));
    return seen.size;
  }

  get totalCells() {
    return this.puzzle.cols * this.puzzle.rows;
  }

  /** Problems the meter's settings would cause right now. */
  configProblem(meterId: number): 'address' | 'baud' | null {
    const m = this.puzzle.meters[meterId];
    if (this.puzzle.meters.some((o) => o.id !== m.id && o.address === m.address)) return 'address';
    if (m.baud !== this.puzzle.ports[m.port].baud) return 'baud';
    return null;
  }

  /** Start a cable from either end of a pair, or pick up an unfinished one mid-way. */
  startDrag(x: number, y: number): boolean {
    if (this.finished || !this.inside(x, y)) return false;
    const end = this.endpointAt(x, y);
    if (end !== null) {
      this.paths.set(end, [{ x, y }]);
      this.status.set(end, 'routing');
      this.active = end;
      return true;
    }
    const owner = this.ownerOf(x, y);
    if (owner !== null) {
      const path = this.paths.get(owner)!;
      const idx = path.findIndex((c) => c.x === x && c.y === y);
      this.paths.set(owner, path.slice(0, idx + 1));
      this.status.set(owner, 'routing');
      this.active = owner;
      return true;
    }
    return false;
  }

  /** Extends the active cable toward a cell; fast swipes are walked one cell at a time. */
  dragTo(x: number, y: number) {
    if (this.active === null || this.finished) return;
    let guard = 0;
    while (this.active !== null && guard++ < 64) {
      const path = this.paths.get(this.active)!;
      const last = path[path.length - 1];
      if (last.x === x && last.y === y) return;
      const dx = Math.sign(x - last.x);
      const dy = Math.sign(y - last.y);
      const primary = Math.abs(x - last.x) >= Math.abs(y - last.y) ? { x: last.x + dx, y: last.y } : { x: last.x, y: last.y + dy };
      const secondary = primary.x !== last.x ? { x: last.x, y: last.y + dy } : { x: last.x + dx, y: last.y };
      if (this.step(primary)) continue;
      if ((secondary.x !== last.x || secondary.y !== last.y) && this.step(secondary)) continue;
      return;
    }
  }

  private step(c: Cell): boolean {
    const id = this.active!;
    const path = this.paths.get(id)!;
    if (!this.inside(c.x, c.y)) return false;
    const ownIdx = path.findIndex((p) => p.x === c.x && p.y === c.y);
    if (ownIdx >= 0) {
      // Going back over your own cable rewinds it.
      path.length = ownIdx + 1;
      this.emit({ type: 'step', meter: id });
      return true;
    }
    const end = this.endpointAt(c.x, c.y);
    if (end !== null) {
      const start = path[0];
      const startIsMeter = this.meterAt(start.x, start.y)?.id === id;
      const target = startIsMeter ? this.puzzle.ports[id] : this.puzzle.meters[id];
      if (end === id && target.x === c.x && target.y === c.y) {
        path.push(c);
        this.active = null;
        this.testLink(id);
        return true;
      }
      this.emit({ type: 'blocked', meter: id, cell: c });
      return false;
    }
    const other = this.ownerOf(c.x, c.y);
    if (other !== null && other !== id) {
      // Like a real cable tray: the newer cable pushes the old one out.
      const op = this.paths.get(other)!;
      const idx = op.findIndex((p) => p.x === c.x && p.y === c.y);
      op.length = idx;
      if (op.length <= 1) this.paths.delete(other);
      this.status.set(other, op.length > 1 ? 'routing' : 'idle');
      this.emit({ type: 'cut', meter: other, cell: c });
    }
    path.push(c);
    this.emit({ type: 'step', meter: id });
    return true;
  }

  endDrag() {
    if (this.active === null) return;
    const id = this.active;
    this.active = null;
    if (this.status.get(id) === 'routing' && (this.paths.get(id)?.length ?? 0) <= 1) {
      this.paths.delete(id);
      this.status.set(id, 'idle');
    }
    this.checkWin();
  }

  isConnected(id: number) {
    const path = this.paths.get(id);
    if (!path || path.length < 2) return false;
    const a = path[0];
    const b = path[path.length - 1];
    const m = this.puzzle.meters[id];
    const p = this.puzzle.ports[id];
    const is = (c: Cell, d: Cell) => c.x === d.x && c.y === d.y;
    return (is(a, m) && is(b, p)) || (is(a, p) && is(b, m));
  }

  private testLink(id: number) {
    const problem = this.configProblem(id);
    if (problem) {
      this.status.set(id, 'error');
      this.mistakes++;
      this.emit({ type: 'spark', meter: id, reason: problem });
      return;
    }
    this.status.set(id, 'online');
    this.emit({ type: 'online', meter: id });
    this.checkWin();
  }

  configure(id: number, address: number, baud: number) {
    if (this.finished) return;
    const m = this.puzzle.meters[id];
    if (m.address === address && m.baud === baud) return;
    m.address = address;
    m.baud = baud;
    for (const other of this.puzzle.meters) {
      if (other.id !== id && this.status.get(other.id) === 'online' && this.configProblem(other.id)) this.status.set(other.id, 'error');
    }
    if (this.isConnected(id)) this.testLink(id);
    for (const other of this.puzzle.meters) {
      if (other.id !== id && this.status.get(other.id) === 'error' && this.isConnected(other.id) && !this.configProblem(other.id)) {
        this.status.set(other.id, 'online');
        this.emit({ type: 'online', meter: other.id });
      }
    }
    this.checkWin();
  }

  private lastUnfilled = -1;
  private checkWin() {
    if (this.finished || this.active !== null) return;
    if (!this.puzzle.meters.every((m) => this.status.get(m.id) === 'online')) return;
    const empty = this.totalCells - this.filled;
    if (empty > 0) {
      if (empty !== this.lastUnfilled) this.emit({ type: 'unfilled', empty });
      this.lastUnfilled = empty;
      return;
    }
    this.finished = 'won';
    this.emit({ type: 'won' });
  }

  update(dt: number) {
    if (this.finished) return;
    this.timeLeft = Math.max(0, this.timeLeft - dt);
    const elapsed = this.timeTotal - this.timeLeft;
    while (this.dropouts.length && this.dropouts[0] <= elapsed) {
      this.dropouts.shift();
      this.cutRandomCable(elapsed);
    }
    if (this.timeLeft <= 0) {
      this.finished = 'timeout';
      this.emit({ type: 'timeout' });
    }
  }

  private cutRandomCable(seedish: number) {
    const online = this.puzzle.meters.filter((m) => this.status.get(m.id) === 'online' && m.id !== this.active);
    if (!online.length) return;
    const victim = online[Math.floor(seedish * 997) % online.length];
    const path = this.paths.get(victim.id)!;
    if (path.length < 3) return;
    // The cable breaks in the middle; the half still attached to its start stays in place.
    const idx = 1 + (Math.floor(seedish * 31) % (path.length - 2));
    const cell = path[idx];
    path.length = idx;
    this.status.set(victim.id, 'routing');
    this.emit({ type: 'dropout', meter: victim.id, cell });
  }

  get onlineCount() {
    return this.puzzle.meters.filter((m) => this.status.get(m.id) === 'online').length;
  }

  score() {
    return this.onlineCount * 100 + Math.round(this.timeLeft) * 10 - this.mistakes * 40;
  }
}
