import { createRng, type Rng } from '../../core/rng';
import type { ToplovodParams } from '../../core/types';

/**
 * Toplovod: rotate pipe tiles until hot water from the plant reaches every building
 * and no pipe end is left open. The board is a random spanning tree over the free
 * cells (every leaf is a building), so a full solution always exists.
 */

// Openings as bits: north, east, south, west.
export const N = 1;
export const E = 2;
export const S = 4;
export const W = 8;
const DIRS = [
  { bit: N, dx: 0, dy: -1, back: S },
  { bit: E, dx: 1, dy: 0, back: W },
  { bit: S, dx: 0, dy: 1, back: N },
  { bit: W, dx: -1, dy: 0, back: E },
];

export const rotateCw = (m: number) => ((m << 1) | (m >> 3)) & 15;

export type TileKind = 'pipe' | 'source' | 'house' | 'block';

export interface Tile {
  kind: TileKind;
  /** Openings now. */
  mask: number;
  /** Openings in the generated solution. */
  solved: number;
  /** Fixed by the plan: shown as already welded, cannot be rotated. */
  locked: boolean;
  /** Buildings: a hospital or school must be warm, a house shows as a block of flats. */
  label?: 'bolnisnica' | 'sola' | 'blok';
}

export interface Board {
  cols: number;
  rows: number;
  tiles: Tile[];
  source: number;
  /** Rotations needed to reach the generated solution (a fair par, sometimes beatable). */
  par: number;
}

/** Minimal clockwise turns from mask a to mask b, or -1 if b is not a rotation of a. */
export function turnsTo(a: number, b: number) {
  let m = a;
  for (let i = 0; i < 4; i++) {
    if (m === b) return i;
    m = rotateCw(m);
  }
  return -1;
}

function buildTree(cols: number, rows: number, blocked: Set<number>, source: number, rng: Rng) {
  const masks = new Array<number>(cols * rows).fill(0);
  const inTree = new Set([source]);
  const frontier: [number, number][] = [];
  const push = (c: number) => {
    const x = c % cols;
    const y = Math.floor(c / cols);
    DIRS.forEach((d, di) => {
      const nx = x + d.dx;
      const ny = y + d.dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) return;
      const n = ny * cols + nx;
      if (!blocked.has(n) && !inTree.has(n)) frontier.push([c, di]);
    });
  };
  push(source);
  while (frontier.length) {
    const [c, di] = frontier.splice(rng.int(0, frontier.length - 1), 1)[0];
    const d = DIRS[di];
    const n = c + d.dy * cols + d.dx;
    if (inTree.has(n)) continue;
    // Keep the source a single outlet or two, so the plant reads as a plant.
    if (c === source && masks[c] && rng.chance(0.75)) continue;
    // Crosses are rare in real networks: a fourth branch only now and then.
    if ([1, 2, 4, 8].filter((b) => masks[c] & b).length >= 3 && frontier.length && rng.chance(0.85)) continue;
    masks[c] |= d.bit;
    masks[n] |= d.back;
    inTree.add(n);
    push(n);
  }
  return { masks, size: inTree.size };
}

export function generateBoard(p: ToplovodParams): Board {
  const { cols, rows } = p;
  for (let attempt = 0; attempt < 60; attempt++) {
    const rng = createRng(p.seed + attempt * 101);
    const source = Math.floor(cols / 2) + (attempt % 2 ? 0 : -((cols + 1) % 2));
    const blocked = new Set<number>();
    const want = Math.round(cols * rows * (p.obstacles ?? 0));
    for (let k = 0; k < want * 3 && blocked.size < want; k++) {
      const c = rng.int(cols, cols * rows - 1);
      if (c !== source) blocked.add(c);
    }
    const free = cols * rows - blocked.size;
    const { masks, size } = buildTree(cols, rows, blocked, source, rng);
    if (size !== free) continue;
    const bits = (m: number) => (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1) + ((m >> 3) & 1);
    const leaves = masks.map((m, i) => (i !== source && !blocked.has(i) && bits(m) === 1 ? i : -1)).filter((i) => i >= 0);
    if (leaves.length < p.houses[0] || leaves.length > p.houses[1]) continue;
    const labels: Tile['label'][] = ['bolnisnica', 'sola'];
    const tiles: Tile[] = masks.map((m, i) => {
      if (blocked.has(i)) return { kind: 'block', mask: 0, solved: 0, locked: true };
      if (i === source) return { kind: 'source', mask: m, solved: m, locked: true };
      if (bits(m) === 1) return { kind: 'house', mask: m, solved: m, locked: true, label: 'blok' };
      return { kind: 'pipe', mask: m, solved: m, locked: false };
    });
    rng
      .shuffle(leaves.slice())
      .slice(0, 2)
      .forEach((i, k) => (tiles[i].label = labels[k]));
    const pipes = tiles.map((t, i) => (t.kind === 'pipe' ? i : -1)).filter((i) => i >= 0);
    for (const i of rng.shuffle(pipes.slice()).slice(0, p.locked ?? 0)) tiles[i].locked = true;
    let par = 0;
    for (const i of pipes) {
      const t = tiles[i];
      if (t.locked) continue;
      // Straight pipes and crosses look the same after half or full turns: scramble visibly.
      for (let k = 0, n = rng.int(1, 3); k < n; k++) t.mask = rotateCw(t.mask);
      if (t.mask === t.solved) t.mask = rotateCw(t.mask);
      par += turnsTo(t.mask, t.solved);
    }
    const board = { cols, rows, tiles, source, par };
    if (analyse(board).solved) continue;
    return board;
  }
  throw new Error(`Toplovod: no board for seed ${p.seed}`);
}

export interface Flow {
  /** Cells reached by hot water. */
  hot: Set<number>;
  /** Open pipe ends of hot tiles, as [cell, direction bit]: hot water sprays out there. */
  leaks: [number, number][];
  housesHot: number;
  houses: number;
  solved: boolean;
}

export function analyse(b: Board): Flow {
  const { cols, rows, tiles } = b;
  const hot = new Set([b.source]);
  const queue = [b.source];
  const leaks: [number, number][] = [];
  while (queue.length) {
    const c = queue.shift()!;
    const x = c % cols;
    const y = Math.floor(c / cols);
    for (const d of DIRS) {
      if (!(tiles[c].mask & d.bit)) continue;
      const nx = x + d.dx;
      const ny = y + d.dy;
      const n = ny * cols + nx;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || !(tiles[n].mask & d.back)) {
        leaks.push([c, d.bit]);
        continue;
      }
      if (!hot.has(n)) {
        hot.add(n);
        queue.push(n);
      }
    }
  }
  const houses = tiles.filter((t) => t.kind === 'house').length;
  const housesHot = tiles.filter((t, i) => t.kind === 'house' && hot.has(i)).length;
  return { hot, leaks, housesHot, houses, solved: housesHot === houses && leaks.length === 0 };
}

export type ToplovodEvent = { type: 'turn'; cell: number } | { type: 'sabotage'; cell: number } | { type: 'warm'; cell: number } | { type: 'won' } | { type: 'timeout' };

export class ToplovodGame {
  readonly board: Board;
  readonly timeTotal: number;
  timeLeft: number;
  flow: Flow;
  turns = 0;
  sabotaged = 0;
  finished: 'won' | 'timeout' | null = null;
  private sabotageIn: number;
  private rng: Rng;
  private listeners: ((e: ToplovodEvent) => void)[] = [];

  constructor(readonly params: ToplovodParams) {
    this.board = generateBoard(params);
    this.timeTotal = params.timeSec;
    this.timeLeft = params.timeSec;
    this.flow = analyse(this.board);
    this.sabotageIn = params.sabotage ?? Infinity;
    this.rng = createRng(params.seed ^ 0x5eed);
  }

  on(fn: (e: ToplovodEvent) => void) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  private emit(e: ToplovodEvent) {
    for (const l of this.listeners) l(e);
  }

  private reflow() {
    const before = this.flow.hot;
    this.flow = analyse(this.board);
    this.board.tiles.forEach((t, i) => t.kind === 'house' && this.flow.hot.has(i) && !before.has(i) && this.emit({ type: 'warm', cell: i }));
    if (this.flow.solved && !this.finished) {
      this.finished = 'won';
      this.emit({ type: 'won' });
    }
  }

  rotate(cell: number) {
    const t = this.board.tiles[cell];
    if (this.finished || !t || t.kind !== 'pipe' || t.locked) return false;
    t.mask = rotateCw(t.mask);
    this.turns++;
    this.emit({ type: 'turn', cell });
    this.reflow();
    return true;
  }

  update(dt: number) {
    if (this.finished) return;
    this.timeLeft = Math.max(0, this.timeLeft - dt);
    if (this.timeLeft <= 0) {
      this.finished = 'timeout';
      this.emit({ type: 'timeout' });
      return;
    }
    this.sabotageIn -= dt;
    if (this.sabotageIn <= 0) {
      this.sabotageIn = this.params.sabotage ?? Infinity;
      // The Dark Meter twists a pipe that already carries water: the cruellest spot.
      const targets = this.board.tiles.map((t, i) => (t.kind === 'pipe' && !t.locked && this.flow.hot.has(i) && i !== this.board.source ? i : -1)).filter((i) => i >= 0);
      const pool = targets.length ? targets : this.board.tiles.map((t, i) => (t.kind === 'pipe' && !t.locked ? i : -1)).filter((i) => i >= 0);
      if (!pool.length) return;
      const cell = this.rng.pick(pool);
      this.board.tiles[cell].mask = rotateCw(this.board.tiles[cell].mask);
      this.sabotaged++;
      this.emit({ type: 'sabotage', cell });
      this.reflow();
    }
  }
}
