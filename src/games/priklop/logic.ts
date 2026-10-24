import { createRng, type Rng } from '../../core/rng';
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
  obstacles: Set<number>;
  meters: Meter[];
  ports: Port[];
  /** One known route per meter, from meter to its port. Proves the puzzle is solvable. */
  solution: Cell[][];
}

export type MeterStatus = 'idle' | 'routing' | 'online' | 'error';

export type PriklopEvent =
  | { type: 'step'; meter: number }
  | { type: 'blocked'; meter: number; cell: Cell }
  | { type: 'online'; meter: number }
  | { type: 'spark'; meter: number; reason: 'address' | 'baud' }
  | { type: 'dropout'; meter: number; cell: Cell }
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
];

export const key = (cols: number, x: number, y: number) => y * cols + x;

const DIRS: Cell[] = [
  { x: 0, y: 1 },
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: -1 },
];

/** Builds a solvable board: routes are carved first, meters placed at their ends, obstacles fill leftovers. */
export function generatePuzzle(p: PriklopParams): Puzzle {
  for (let attempt = 0; attempt < 400; attempt++) {
    const rng = createRng(p.seed + attempt * 7919);
    const puzzle = tryGenerate(p, rng);
    if (puzzle) return puzzle;
  }
  throw new Error(`Priklop: no puzzle for seed ${p.seed}`);
}

function tryGenerate(p: PriklopParams, rng: Rng): Puzzle | null {
  const { cols, rows, meters: count } = p;
  if (count > cols) return null;
  const used = new Set<number>();
  // Ports spread along the top row so cables fan out.
  const columns = rng.shuffle([...Array(cols).keys()]).slice(0, count).sort((a, b) => a - b);
  for (const c of columns) used.add(key(cols, c, 0));

  const minLen = Math.max(3, Math.floor(rows * 0.6));
  const maxLen = Math.max(minLen + 2, Math.floor((cols * rows) / (count + 1)));
  const solution: Cell[][] = [];
  const order = rng.shuffle([...columns.keys()]);
  const routes: Cell[][] = new Array(count);

  for (const i of order) {
    const start = { x: columns[i], y: 0 };
    let route: Cell[] | null = null;
    for (let tries = 0; tries < 60 && !route; tries++) {
      route = walk(start, rng.int(minLen, maxLen), cols, rows, used, rng);
    }
    if (!route) return null;
    for (const c of route) used.add(key(cols, c.x, c.y));
    routes[i] = route;
  }

  const meters: Meter[] = [];
  const ports: Port[] = [];
  const portBaud = rng.pick(BAUDS);
  routes.forEach((route, i) => {
    const end = route[route.length - 1];
    ports.push({ id: i, x: route[0].x, y: 0, baud: i % 3 === 2 ? rng.pick(BAUDS) : portBaud });
    meters.push({ id: i, device: DEVICES[(i + p.seed) % DEVICES.length], x: end.x, y: end.y, port: i, address: i + 1, baud: 0 });
    solution.push([...route].reverse());
  });

  // Unique, shuffled addresses, then deliberately misconfigure some meters.
  const addresses = rng.shuffle([...Array(ADDRESS_MAX).keys()].map((n) => n + 1)).slice(0, count);
  meters.forEach((m, i) => {
    m.address = addresses[i];
    m.baud = ports[m.port].baud;
  });
  const victims = rng.shuffle([...meters.keys()]);
  for (let i = 0; i < Math.min(p.conflicts, count - 1); i++) {
    const m = meters[victims[i]];
    const other = meters[victims[(i + 1) % count]];
    m.address = other.address;
  }
  for (let i = 0; i < Math.min(p.baudMismatch, count); i++) {
    const m = meters[victims[count - 1 - i]];
    const wrong = BAUDS.filter((b) => b !== ports[m.port].baud);
    m.baud = rng.pick(wrong);
  }

  const obstacles = new Set<number>();
  const free: number[] = [];
  for (let y = 1; y < rows; y++) for (let x = 0; x < cols; x++) if (!used.has(key(cols, x, y))) free.push(key(cols, x, y));
  rng.shuffle(free);
  const n = Math.floor(free.length * p.obstacles);
  for (let i = 0; i < n; i++) obstacles.add(free[i]);
  // Top row cells that are not ports are part of the gateway housing.
  for (let x = 0; x < cols; x++) if (!columns.includes(x)) obstacles.add(key(cols, x, 0));

  return { cols, rows, obstacles, meters, ports, solution };
}

function walk(start: Cell, length: number, cols: number, rows: number, used: Set<number>, rng: Rng): Cell[] | null {
  const route: Cell[] = [start];
  const mine = new Set<number>([key(cols, start.x, start.y)]);
  let cur = { x: start.x, y: 1 };
  if (used.has(key(cols, cur.x, cur.y))) return null;
  route.push(cur);
  mine.add(key(cols, cur.x, cur.y));
  while (route.length < length) {
    const options = DIRS.map((d) => ({ x: cur.x + d.x, y: cur.y + d.y })).filter((c) => {
      if (c.x < 0 || c.x >= cols || c.y < 1 || c.y >= rows) return false;
      const k = key(cols, c.x, c.y);
      if (used.has(k) || mine.has(k)) return false;
      // Keep routes one cell wide: no touching our own earlier cells except the one we came from.
      let touching = 0;
      for (const d of DIRS) {
        const nk = key(cols, c.x + d.x, c.y + d.y);
        if (c.x + d.x >= 0 && c.x + d.x < cols && mine.has(nk)) touching++;
      }
      return touching <= 1;
    });
    if (options.length === 0) break;
    // Bias downward so meters end up in the plant, away from the gateway.
    const weights = options.map((c) => (c.y > cur.y ? 3 : 1));
    let r = rng.next() * weights.reduce((a, b) => a + b, 0);
    let next = options[0];
    for (let i = 0; i < options.length; i++) {
      r -= weights[i];
      if (r <= 0) {
        next = options[i];
        break;
      }
    }
    cur = next;
    route.push(cur);
    mine.add(key(cols, cur.x, cur.y));
  }
  const end = route[route.length - 1];
  if (route.length < Math.min(length, 3) || end.y < 2) return null;
  return route;
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

  /** Which meter's cable runs through a cell, if any. */
  ownerOf(x: number, y: number): number | null {
    for (const [id, path] of this.paths) if (path.some((c) => c.x === x && c.y === y)) return id;
    return null;
  }

  isBlocked(x: number, y: number) {
    const { cols, rows, obstacles } = this.puzzle;
    if (x < 0 || y < 0 || x >= cols || y >= rows) return true;
    return obstacles.has(key(cols, x, y));
  }

  /** Problems the meter's settings would cause right now. */
  configProblem(meterId: number): 'address' | 'baud' | null {
    const m = this.puzzle.meters[meterId];
    if (this.puzzle.meters.some((o) => o.id !== m.id && o.address === m.address)) return 'address';
    if (m.baud !== this.puzzle.ports[m.port].baud) return 'baud';
    return null;
  }

  startDrag(x: number, y: number): boolean {
    if (this.finished) return false;
    const meter = this.meterAt(x, y);
    if (meter) {
      this.disconnect(meter.id);
      this.paths.set(meter.id, [{ x, y }]);
      this.status.set(meter.id, 'routing');
      this.active = meter.id;
      return true;
    }
    const owner = this.ownerOf(x, y);
    if (owner !== null && this.status.get(owner) !== 'online') {
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
      // Prefer the axis with the larger distance, fall back to the other one if blocked.
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
    const prev = path[path.length - 2];
    if (prev && prev.x === c.x && prev.y === c.y) {
      path.pop();
      this.emit({ type: 'step', meter: id });
      return true;
    }
    const ownIdx = path.findIndex((p) => p.x === c.x && p.y === c.y);
    if (ownIdx >= 0) {
      path.length = ownIdx + 1;
      this.emit({ type: 'step', meter: id });
      return true;
    }
    const meter = this.puzzle.meters[id];
    const port = this.portAt(c.x, c.y);
    if (port) {
      if (port.id !== meter.port) {
        this.emit({ type: 'blocked', meter: id, cell: c });
        return false;
      }
      path.push(c);
      this.active = null;
      this.testLink(id);
      return true;
    }
    if (this.isBlocked(c.x, c.y) || this.meterAt(c.x, c.y) || this.ownerOf(c.x, c.y) !== null) {
      this.emit({ type: 'blocked', meter: id, cell: c });
      return false;
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
  }

  isConnected(id: number) {
    const path = this.paths.get(id);
    if (!path) return false;
    const end = path[path.length - 1];
    const port = this.puzzle.ports[this.puzzle.meters[id].port];
    return end.x === port.x && end.y === port.y;
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
    // A collision knocks out every online meter that shares the address.
    for (const other of this.puzzle.meters) {
      if (other.id !== id && this.status.get(other.id) === 'online' && this.configProblem(other.id)) {
        this.status.set(other.id, 'error');
      }
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

  private disconnect(id: number) {
    this.paths.delete(id);
    this.status.set(id, 'idle');
  }

  private checkWin() {
    if (this.finished) return;
    if (this.puzzle.meters.every((m) => this.status.get(m.id) === 'online')) {
      this.finished = 'won';
      this.emit({ type: 'won' });
    }
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
    const online = this.puzzle.meters.filter((m) => this.status.get(m.id) === 'online');
    if (!online.length) return;
    const victim = online[Math.floor(seedish * 997) % online.length];
    const path = this.paths.get(victim.id)!;
    // Cut somewhere in the middle, never on the meter or port itself.
    if (path.length < 3) return;
    const cell = path[1 + (Math.floor(seedish * 31) % (path.length - 2))];
    this.disconnect(victim.id);
    this.emit({ type: 'dropout', meter: victim.id, cell });
  }

  get onlineCount() {
    return this.puzzle.meters.filter((m) => this.status.get(m.id) === 'online').length;
  }

  score() {
    return this.onlineCount * 100 + Math.round(this.timeLeft) * 10 - this.mistakes * 40;
  }
}
