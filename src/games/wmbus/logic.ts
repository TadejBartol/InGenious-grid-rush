import { createRng } from '../../core/rng';
import type { WmbusParams } from '../../core/types';

export type DeviceKind = 'gateway' | 'repeater';
export interface Cell {
  x: number;
  y: number;
}
export interface Device extends Cell {
  id: number;
  kind: DeviceKind;
}
export interface WmbusPuzzle {
  cols: number;
  rows: number;
  range: number;
  meters: (Cell & { id: number; type: 'voda' | 'toplota' })[];
  /** Cell indexes (y * cols + x) with buildings: nothing can be placed there. */
  blocked: Set<number>;
  /** One known solution; its size is the device count for the "optimal" star. */
  solution: Device[];
  budget: Record<DeviceKind, number>;
}

export const dist = (a: Cell, b: Cell) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Builds a solvable layout backwards: place a gateway and a chain of repeaters,
 * scatter meters around them, then fill the rest with buildings.
 */
export function generateWmbus(p: WmbusParams): WmbusPuzzle {
  for (let attempt = 0; attempt < 200; attempt++) {
    const puzzle = tryGenerate(p, attempt);
    if (puzzle) return puzzle;
  }
  throw new Error('wM-Bus generator failed');
}

function tryGenerate(p: WmbusParams, attempt: number): WmbusPuzzle | null {
  const rng = createRng(p.seed + attempt * 7919);
  const { cols, rows, range } = p;
  const inside = (c: Cell) => c.x >= 0 && c.y >= 0 && c.x < cols && c.y < rows;
  const key = (c: Cell) => c.y * cols + c.x;
  const solution: Device[] = [];
  const nGate = p.gateways;
  const nRep = p.repeaters;
  const total = nGate + nRep;

  // Gateways spread apart; repeaters hang off an existing node at the edge of its range.
  for (let i = 0; i < total; i++) {
    let placed: Cell | null = null;
    for (let t = 0; t < 120 && !placed; t++) {
      let c: Cell;
      if (i < nGate) c = { x: rng.int(0, cols - 1), y: rng.int(0, rows - 1) };
      else {
        const from = rng.pick(solution);
        const a = rng.next() * Math.PI * 2;
        const d = range * (0.75 + rng.next() * 0.25);
        c = { x: Math.round(from.x + Math.cos(a) * d), y: Math.round(from.y + Math.sin(a) * d) };
        if (dist(c, from) > range) continue;
      }
      if (!inside(c)) continue;
      const minGap = i < nGate ? range * 2.2 : range * 0.7;
      if (solution.some((s) => dist(s, c) < minGap)) continue;
      placed = c;
    }
    if (!placed) return null;
    solution.push({ ...placed, id: i, kind: i < nGate ? 'gateway' : 'repeater' });
  }

  // Meters: every device serves at least one, preferably near the edge of its range.
  const taken = new Set(solution.map(key));
  const meters: WmbusPuzzle['meters'] = [];
  for (let i = 0; i < p.meters; i++) {
    const host = solution[i % solution.length];
    let placed: Cell | null = null;
    for (let t = 0; t < 120 && !placed; t++) {
      const a = rng.next() * Math.PI * 2;
      const d = range * (0.45 + rng.next() * 0.55);
      const c = { x: Math.round(host.x + Math.cos(a) * d), y: Math.round(host.y + Math.sin(a) * d) };
      if (!inside(c) || taken.has(key(c)) || dist(c, host) > range || dist(c, host) < 1) continue;
      placed = c;
    }
    if (!placed) return null;
    taken.add(key(placed));
    meters.push({ ...placed, id: i, type: rng.chance(0.3) ? 'toplota' : 'voda' });
  }

  // Buildings fill a share of the free cells, never next to every free spot of a meter.
  const free: number[] = [];
  for (let k = 0; k < cols * rows; k++) if (!taken.has(k)) free.push(k);
  rng.shuffle(free);
  const blocked = new Set(free.slice(0, Math.floor(free.length * p.obstacles)));

  const puzzle: WmbusPuzzle = {
    cols,
    rows,
    range,
    meters,
    blocked,
    solution,
    budget: { gateway: nGate, repeater: nRep + (p.spare ?? 0) },
  };
  // The puzzle must not be solved by the gateways alone at their best spots.
  if (nRep > 0 && coverage(puzzle, solution.filter((d) => d.kind === 'gateway')).covered.size === meters.length) return null;
  return puzzle;
}

/** Which devices reach a gateway (directly or via repeaters) and which meters they hear. */
export function coverage(puzzle: Pick<WmbusPuzzle, 'range' | 'meters'>, devices: Device[]) {
  const linked = new Set<number>();
  const links: [Device, Device][] = [];
  const queue = devices.filter((d) => d.kind === 'gateway');
  for (const g of queue) linked.add(g.id);
  while (queue.length) {
    const d = queue.shift()!;
    for (const o of devices) {
      if (linked.has(o.id) || o.kind !== 'repeater' || dist(d, o) > puzzle.range) continue;
      linked.add(o.id);
      links.push([d, o]);
      queue.push(o);
    }
  }
  const covered = new Map<number, Device>();
  for (const m of puzzle.meters) {
    let best: Device | null = null;
    for (const d of devices) if (linked.has(d.id) && dist(d, m) <= puzzle.range && (!best || dist(d, m) < dist(best, m))) best = d;
    if (best) covered.set(m.id, best);
  }
  return { linked, links, covered };
}

export type WmbusEvent =
  | { type: 'placed'; device: Device; newlyCovered: number[] }
  | { type: 'removed'; device: Device; lost: number[] }
  | { type: 'blocked'; cell: Cell; reason: 'building' | 'meter' | 'budget' }
  | { type: 'won' }
  | { type: 'timeout' };

export class WmbusGame {
  readonly puzzle: WmbusPuzzle;
  devices: Device[] = [];
  timeLeft: number;
  readonly timeTotal: number;
  /** Devices picked up again: the "no reshuffling" star counts these. */
  mistakes = 0;
  finished: 'won' | 'timeout' | null = null;
  private nextId = 100;
  private listeners: ((e: WmbusEvent) => void)[] = [];
  private state = coverage({ range: 0, meters: [] }, []);

  constructor(params: WmbusParams, bonusTime = 0) {
    this.puzzle = generateWmbus(params);
    this.timeTotal = params.timeSec + bonusTime;
    this.timeLeft = this.timeTotal;
    this.recompute();
  }

  on(fn: (e: WmbusEvent) => void) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }
  private emit(e: WmbusEvent) {
    for (const l of this.listeners) l(e);
  }
  private recompute() {
    this.state = coverage(this.puzzle, this.devices);
  }

  get links() {
    return this.state.links;
  }
  get coveredCount() {
    return this.state.covered.size;
  }
  isLinked(d: Device) {
    return this.state.linked.has(d.id);
  }
  coveredBy(meterId: number) {
    return this.state.covered.get(meterId) ?? null;
  }
  remaining(kind: DeviceKind) {
    return this.puzzle.budget[kind] - this.devices.filter((d) => d.kind === kind).length;
  }
  deviceAt(x: number, y: number) {
    return this.devices.find((d) => d.x === x && d.y === y) ?? null;
  }
  meterAt(x: number, y: number) {
    return this.puzzle.meters.find((m) => m.x === x && m.y === y) ?? null;
  }
  isBlocked(x: number, y: number) {
    return this.puzzle.blocked.has(y * this.puzzle.cols + x);
  }

  /** Tap a cell: place the chosen device, or pick up the one standing there. */
  tap(x: number, y: number, kind: DeviceKind) {
    if (this.finished) return;
    const { cols, rows } = this.puzzle;
    if (x < 0 || y < 0 || x >= cols || y >= rows) return;
    const existing = this.deviceAt(x, y);
    if (existing) {
      const before = new Set(this.state.covered.keys());
      this.devices = this.devices.filter((d) => d !== existing);
      this.mistakes++;
      this.recompute();
      this.emit({ type: 'removed', device: existing, lost: [...before].filter((id) => !this.state.covered.has(id)) });
      return;
    }
    if (this.isBlocked(x, y)) return this.emit({ type: 'blocked', cell: { x, y }, reason: 'building' });
    if (this.meterAt(x, y)) return this.emit({ type: 'blocked', cell: { x, y }, reason: 'meter' });
    if (this.remaining(kind) <= 0) return this.emit({ type: 'blocked', cell: { x, y }, reason: 'budget' });
    const before = new Set(this.state.covered.keys());
    const device: Device = { x, y, kind, id: this.nextId++ };
    this.devices.push(device);
    this.recompute();
    this.emit({ type: 'placed', device, newlyCovered: [...this.state.covered.keys()].filter((id) => !before.has(id)) });
    if (this.coveredCount === this.puzzle.meters.length) {
      this.finished = 'won';
      this.emit({ type: 'won' });
    }
  }

  update(dt: number) {
    if (this.finished) return;
    this.timeLeft = Math.max(0, this.timeLeft - dt);
    if (this.timeLeft === 0) {
      this.finished = 'timeout';
      this.emit({ type: 'timeout' });
    }
  }

  score() {
    return Math.round(this.coveredCount * 100 + this.timeLeft * 5 - this.mistakes * 20);
  }
}
