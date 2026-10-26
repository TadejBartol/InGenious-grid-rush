import { createRng } from '../../core/rng';
import type { PuscanjeParams } from '../../core/types';

/**
 * Lov na puščanje: the district heating network under the streets is a grid of
 * pipe sections, some of them leaking. Every inspected section gets a heat meter
 * that shows how many of its eight neighbours leak. From the numbers the player
 * finds every leak and closes its valve. Boards are checked by a logic solver, so
 * they never need a guess.
 */

export type CellState = 'hidden' | 'open' | 'closed' | 'burst';

export interface Field {
  cols: number;
  rows: number;
  leak: boolean[];
  /** Leaking neighbours of each cell. */
  count: number[];
  /** Cells shown at the start: the meters the network already had. */
  start: number[];
}

export function neighbours(cols: number, rows: number, c: number) {
  const x = c % cols;
  const y = Math.floor(c / cols);
  const out: number[] = [];
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < cols && ny < rows) out.push(ny * cols + nx);
    }
  return out;
}

/** Opens a cell and, like a zero on a meter, everything around a zero. */
export function reveal(f: Field, state: CellState[], c: number) {
  const stack = [c];
  while (stack.length) {
    const k = stack.pop()!;
    if (state[k] !== 'hidden' || f.leak[k]) continue;
    state[k] = 'open';
    if (f.count[k] === 0) stack.push(...neighbours(f.cols, f.rows, k));
  }
}

/**
 * Pure deduction: single-cell rules plus the subset rule between two meters.
 * Returns the cells it could prove safe and the leaks it could prove, one step at a time.
 */
export function deduce(f: Field, state: CellState[]): { safe: Set<number>; leaks: Set<number> } {
  const safe = new Set<number>();
  const leaks = new Set<number>();
  const known = (k: number) => state[k] === 'closed' || state[k] === 'burst' || leaks.has(k);
  const unknown = (k: number) => state[k] === 'hidden' && !leaks.has(k) && !safe.has(k);
  const constraints: { cells: number[]; need: number }[] = [];
  for (let c = 0; c < f.leak.length; c++) {
    if (state[c] !== 'open') continue;
    const nb = neighbours(f.cols, f.rows, c);
    const cells = nb.filter(unknown);
    if (!cells.length) continue;
    constraints.push({ cells, need: f.count[c] - nb.filter(known).length });
  }
  for (const { cells, need } of constraints) {
    if (need === 0) cells.forEach((k) => safe.add(k));
    else if (need === cells.length) cells.forEach((k) => leaks.add(k));
  }
  if (safe.size || leaks.size) return { safe, leaks };
  for (const a of constraints)
    for (const b of constraints) {
      if (a === b || a.cells.length >= b.cells.length) continue;
      if (!a.cells.every((k) => b.cells.includes(k))) continue;
      const rest = b.cells.filter((k) => !a.cells.includes(k));
      const need = b.need - a.need;
      if (need === 0) rest.forEach((k) => safe.add(k));
      else if (need === rest.length) rest.forEach((k) => leaks.add(k));
    }
  return { safe, leaks };
}

/** Plays the board with logic only; true if every leak gets found without a guess. */
export function solvable(f: Field) {
  const state: CellState[] = f.leak.map(() => 'hidden');
  for (const c of f.start) reveal(f, state, c);
  for (;;) {
    const { safe, leaks } = deduce(f, state);
    if (!safe.size && !leaks.size) break;
    safe.forEach((k) => reveal(f, state, k));
    leaks.forEach((k) => (state[k] = 'closed'));
  }
  return f.leak.every((l, k) => !l || state[k] === 'closed');
}

export function generateField(p: PuscanjeParams): Field {
  const { cols, rows } = p;
  const n = cols * rows;
  for (let attempt = 0; attempt < 200; attempt++) {
    const rng = createRng(p.seed + attempt * 313);
    const leak = new Array<boolean>(n).fill(false);
    const cells = rng.shuffle([...Array(n).keys()]);
    // Keep the middle of the bottom row clear: the plant's own meter starts there.
    const entry = (rows - 1) * cols + Math.floor(cols / 2);
    const nearEntry = new Set([entry, ...neighbours(cols, rows, entry)]);
    let placed = 0;
    for (const c of cells) {
      if (placed >= p.leaks) break;
      if (nearEntry.has(c)) continue;
      leak[c] = true;
      placed++;
    }
    const count = leak.map((_, c) => neighbours(cols, rows, c).filter((k) => leak[k]).length);
    const field: Field = { cols, rows, leak, count, start: [entry] };
    // Add meters where logic gets stuck, until the board solves; few meters means a hard board.
    const safeCells = rng.shuffle(cells.filter((c) => !leak[c] && !nearEntry.has(c)));
    for (let k = 0; k < (p.extraMeters ?? 0); k++) if (safeCells[k] !== undefined) field.start.push(safeCells[k]);
    let tries = 0;
    while (!solvable(field) && tries++ < 12) {
      const state: CellState[] = leak.map(() => 'hidden');
      for (const c of field.start) reveal(field, state, c);
      for (;;) {
        const { safe, leaks } = deduce(field, state);
        if (!safe.size && !leaks.size) break;
        safe.forEach((k) => reveal(field, state, k));
        leaks.forEach((k) => (state[k] = 'closed'));
      }
      // A hidden safe cell next to what is known gives the most information.
      const frontier = safeCells.filter((c) => state[c] === 'hidden' && neighbours(cols, rows, c).some((k) => state[k] === 'open'));
      const pick = frontier[0] ?? safeCells.find((c) => state[c] === 'hidden');
      if (pick === undefined) break;
      field.start.push(pick);
    }
    if (solvable(field)) return field;
  }
  throw new Error(`Puscanje: no board for seed ${p.seed}`);
}

export type PuscanjeEvent =
  | { type: 'open'; cell: number; count: number }
  | { type: 'closed'; cell: number }
  | { type: 'burst'; cell: number }
  | { type: 'wrongValve'; cell: number }
  | { type: 'won' }
  | { type: 'timeout' };

export class PuscanjeGame {
  readonly field: Field;
  readonly timeTotal: number;
  timeLeft: number;
  state: CellState[];
  mistakes = 0;
  camera: number;
  finished: 'won' | 'timeout' | null = null;
  private listeners: ((e: PuscanjeEvent) => void)[] = [];

  constructor(p: PuscanjeParams) {
    this.field = generateField(p);
    this.timeTotal = p.timeSec;
    this.timeLeft = p.timeSec;
    this.camera = p.camera ?? 0;
    this.state = this.field.leak.map(() => 'hidden');
    for (const c of this.field.start) reveal(this.field, this.state, c);
  }

  on(fn: (e: PuscanjeEvent) => void) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  private emit(e: PuscanjeEvent) {
    for (const l of this.listeners) l(e);
  }

  get leaksLeft() {
    return this.field.leak.filter((l, k) => l && this.state[k] === 'hidden').length;
  }

  get leaksTotal() {
    return this.field.leak.filter(Boolean).length;
  }

  private checkWin() {
    if (!this.finished && this.leaksLeft === 0) {
      this.finished = 'won';
      this.emit({ type: 'won' });
    }
  }

  /** Dig and fit a meter. A leak there means a burst: a mistake, and the valve gets closed anyway. */
  inspect(c: number) {
    if (this.finished || this.state[c] !== 'hidden') return false;
    if (this.field.leak[c]) {
      this.state[c] = 'burst';
      this.mistakes++;
      this.emit({ type: 'burst', cell: c });
      this.checkWin();
      return true;
    }
    reveal(this.field, this.state, c);
    this.emit({ type: 'open', cell: c, count: this.field.count[c] });
    return true;
  }

  /** Close the valve on a section the player believes leaks. A wrong guess costs a mistake. */
  close(c: number) {
    if (this.finished || this.state[c] !== 'hidden') return false;
    if (!this.field.leak[c]) {
      this.mistakes++;
      this.emit({ type: 'wrongValve', cell: c });
      reveal(this.field, this.state, c);
      return true;
    }
    this.state[c] = 'closed';
    this.emit({ type: 'closed', cell: c });
    this.checkWin();
    return true;
  }

  /** Thermal camera: shows one safe section the player could have worked out next. */
  useCamera() {
    if (this.finished || this.camera <= 0) return null;
    const { safe } = deduce(this.field, this.state);
    const cell = [...safe][0] ?? this.field.leak.findIndex((l, k) => !l && this.state[k] === 'hidden');
    if (cell < 0) return null;
    this.camera--;
    this.inspect(cell);
    return cell;
  }

  update(dt: number) {
    if (this.finished) return;
    this.timeLeft = Math.max(0, this.timeLeft - dt);
    if (this.timeLeft <= 0) {
      this.finished = 'timeout';
      this.emit({ type: 'timeout' });
    }
  }
}
