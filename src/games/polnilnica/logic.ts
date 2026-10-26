import { createRng, type Rng } from '../../core/rng';
import type { PolnilnicaParams } from '../../core/types';
import BOARDS from './boards.json';

/**
 * Polnilnica: a sliding-car puzzle on a 6×6 car park. Electric cars (EV) must drive
 * out through a charger on the edge of the lot. Every EV move costs battery, a charger
 * stays busy while the car charges, and the site connection has a power limit.
 * A breadth-first solver checks every board and knows the shortest solution.
 */

export const SIZE = 6;

export type VehicleType = 'ev' | 'car' | 'truck' | 'dark';
export type Side = 'N' | 'E' | 'S' | 'W';

export interface Vehicle {
  id: number;
  type: VehicleType;
  dir: 'h' | 'v';
  len: number;
  /** Fixed row (h) or column (v). */
  line: number;
}

export interface Charger {
  id: number;
  side: Side;
  /** Row for E/W, column for N/S. */
  line: number;
  kw: number;
}

export interface Lot {
  vehicles: Vehicle[];
  chargers: Charger[];
  limitKw: number;
  chargeMoves: number;
  darkEvery: number;
  /** Battery each EV starts with; Infinity when it does not matter. */
  battery: number;
}

/** Everything that changes during play. */
export interface LotState {
  /** Offset of each vehicle along its axis (x for h, y for v); -1 once an EV has left to charge. */
  pos: number[];
  battery: number[];
  /** Moves left until each charger is free again. */
  busy: number[];
  /** Direction the dark car is heading (+1/-1) and player moves since it last moved. */
  darkDir: number;
  darkTick: number;
  moves: number;
}

export interface Move {
  vehicle: number;
  /** New offset, or 'exit' with the charger used. */
  to: number;
  charger?: number;
}

const cellsOf = (v: Vehicle, p: number) => Array.from({ length: v.len }, (_, k) => (v.dir === 'h' ? v.line * SIZE + p + k : (p + k) * SIZE + v.line));

function occupancy(lot: Lot, s: LotState) {
  const occ = new Int8Array(SIZE * SIZE).fill(-1);
  lot.vehicles.forEach((v, i) => {
    if (s.pos[i] < 0) return;
    for (const c of cellsOf(v, s.pos[i])) occ[c] = i;
  });
  return occ;
}

export const usedKw = (lot: Lot, busy: number[]) => lot.chargers.reduce((sum, c, i) => sum + (busy[i] > 0 ? c.kw : 0), 0);

/** Chargers a vehicle could leave through: on its own line, at either end. */
export function chargersFor(lot: Lot, v: Vehicle) {
  return lot.chargers.filter((c) => (v.dir === 'h' ? (c.side === 'E' || c.side === 'W') && c.line === v.line : (c.side === 'N' || c.side === 'S') && c.line === v.line));
}

/** Free range of offsets for a vehicle, plus whether it can reach each end of its line. */
export function slideRange(lot: Lot, s: LotState, i: number, occ = occupancy(lot, s)) {
  const v = lot.vehicles[i];
  const free = (p: number) => {
    const o = occ[v.dir === 'h' ? v.line * SIZE + p : p * SIZE + v.line];
    return o < 0 || o === i;
  };
  let lo = s.pos[i];
  while (lo > 0 && free(lo - 1)) lo--;
  let hi = s.pos[i];
  while (hi + v.len < SIZE && free(hi + v.len)) hi++;
  return { lo, hi, atStart: lo === 0, atEnd: hi + v.len === SIZE };
}

/** Why an EV cannot plug into this charger right now, or null if it can. */
export function plugProblem(lot: Lot, s: LotState, i: number, chargerId: number): 'battery' | 'busy' | 'limit' | null {
  if (s.battery[i] <= 0) return 'battery';
  const c = lot.chargers[chargerId];
  const busy = s.busy.map((b) => Math.max(0, b - 1));
  if (busy[chargerId] > 0) return 'busy';
  if (usedKw(lot, busy) + c.kw > lot.limitKw) return 'limit';
  return null;
}

export function legalMoves(lot: Lot, s: LotState): Move[] {
  const out: Move[] = [];
  const occ = occupancy(lot, s);
  lot.vehicles.forEach((v, i) => {
    if (s.pos[i] < 0 || v.type === 'dark') return;
    if (v.type === 'ev' && s.battery[i] <= 0) return;
    const { lo, hi, atStart, atEnd } = slideRange(lot, s, i, occ);
    for (let p = lo; p <= hi; p++) if (p !== s.pos[i]) out.push({ vehicle: i, to: p });
    if (v.type !== 'ev') return;
    for (const c of chargersFor(lot, v)) {
      const reach = c.side === 'W' || c.side === 'N' ? atStart : atEnd;
      if (reach && !plugProblem(lot, s, i, c.id)) out.push({ vehicle: i, to: -1, charger: c.id });
    }
  });
  return out;
}

export function applyMove(lot: Lot, s: LotState, m: Move): LotState {
  const pos = s.pos.slice();
  const battery = s.battery.slice();
  const busy = s.busy.map((b) => Math.max(0, b - 1));
  const v = lot.vehicles[m.vehicle];
  if (v.type === 'ev') battery[m.vehicle]--;
  pos[m.vehicle] = m.to;
  if (m.charger !== undefined) busy[m.charger] = lot.chargeMoves;
  const next: LotState = { pos, battery, busy, darkDir: s.darkDir, darkTick: s.darkTick + 1, moves: s.moves + 1 };
  const dark = lot.vehicles.findIndex((x) => x.type === 'dark');
  if (dark >= 0 && lot.darkEvery && next.darkTick >= lot.darkEvery) {
    next.darkTick = 0;
    const { lo, hi } = slideRange(lot, next, dark);
    // The dark car creeps one cell; at a wall or another car it turns round.
    let step = next.darkDir;
    if (pos[dark] + step < lo || pos[dark] + step > hi) step = -step;
    if (pos[dark] + step >= lo && pos[dark] + step <= hi) pos[dark] += step;
    next.darkDir = step;
  }
  return next;
}

export const isWon = (lot: Lot, s: LotState) => lot.vehicles.every((v, i) => v.type !== 'ev' || s.pos[i] < 0);

const keyOf = (s: LotState) => `${s.pos.join(',')}|${s.battery.join(',')}|${s.busy.join(',')}|${s.darkDir}${s.darkTick}`;

/** Shortest solution from a state (BFS); null if none within the node budget. */
export function solve(lot: Lot, start: LotState, budget = 80000): Move[] | null {
  if (isWon(lot, start)) return [];
  const seen = new Map<string, { prev: string | null; move: Move | null }>();
  const k0 = keyOf(start);
  seen.set(k0, { prev: null, move: null });
  let frontier: [string, LotState][] = [[k0, start]];
  while (frontier.length && seen.size < budget) {
    const next: [string, LotState][] = [];
    for (const [k, s] of frontier) {
      for (const m of legalMoves(lot, s)) {
        const n = applyMove(lot, s, m);
        const nk = keyOf(n);
        if (seen.has(nk)) continue;
        seen.set(nk, { prev: k, move: m });
        if (isWon(lot, n)) {
          const path: Move[] = [];
          let cur: string | null = nk;
          while (cur) {
            const e: { prev: string | null; move: Move | null } = seen.get(cur)!;
            if (e.move) path.unshift(e.move);
            cur = e.prev;
          }
          return path;
        }
        next.push([nk, n]);
      }
    }
    frontier = next;
  }
  return null;
}

function place(rng: Rng, vehicles: Vehicle[], pos: number[], v: Omit<Vehicle, 'id' | 'line'>, line?: number) {
  for (let t = 0; t < 40; t++) {
    const l = line ?? rng.int(0, SIZE - 1);
    const p = rng.int(0, SIZE - v.len);
    const cand: Vehicle = { ...v, id: vehicles.length, line: l };
    const taken = new Set(vehicles.flatMap((o, i) => cellsOf(o, pos[i])));
    if (cellsOf(cand, p).some((c) => taken.has(c))) continue;
    vehicles.push(cand);
    pos.push(p);
    return true;
  }
  return false;
}

export interface Puzzle {
  lot: Lot;
  start: LotState;
  solution: Move[];
}

/** Random boards checked by the solver. Slow for long puzzles: levels ship precomputed boards (scripts/gen-polnilnica.ts). */
export function generatePuzzle(p: PolnilnicaParams, attempts = 400): Puzzle {
  const [lo, hi] = p.minMoves;
  let best: Puzzle | null = null;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const rng = createRng(p.seed + attempt * 7717);
    const vehicles: Vehicle[] = [];
    const pos: number[] = [];
    const chargers: Charger[] = [];
    const usedEdges = new Set<string>();
    let ok = true;
    const ownChargers = Math.min(p.evs, p.chargers.length);
    for (let e = 0; e < ownChargers && ok; e++) ok = place(rng, vehicles, pos, { type: 'ev', dir: rng.chance(0.5) ? 'h' : 'v', len: 2 });
    // Each EV gets a charger on its own line; the rest go anywhere on the edge.
    p.chargers.forEach((kw, k) => {
      const ev = vehicles[k % Math.max(1, ownChargers)];
      let side: Side;
      let line: number;
      if (k < ownChargers && ev) {
        side = ev.dir === 'h' ? (rng.chance(0.5) ? 'E' : 'W') : rng.chance(0.5) ? 'N' : 'S';
        line = ev.line;
      } else {
        side = rng.pick(['N', 'E', 'S', 'W'] as Side[]);
        line = rng.int(0, SIZE - 1);
      }
      if (usedEdges.has(`${side}${line}`)) ok = k >= ownChargers;
      else {
        usedEdges.add(`${side}${line}`);
        chargers.push({ id: chargers.length, side, line, kw });
      }
    });
    // More EVs than chargers: the extra ones queue on a charger's line and wait their turn.
    for (let e = ownChargers; e < p.evs && ok; e++) {
      const c = chargers[e % chargers.length];
      ok = place(rng, vehicles, pos, { type: 'ev', dir: c.side === 'E' || c.side === 'W' ? 'h' : 'v', len: 2 }, c.line);
    }
    if (!ok) continue;
    if (p.darkEvery) ok = place(rng, vehicles, pos, { type: 'dark', dir: rng.chance(0.5) ? 'h' : 'v', len: 2 });
    for (let t = 0; t < p.trucks && ok; t++) ok = place(rng, vehicles, pos, { type: 'truck', dir: rng.chance(0.5) ? 'h' : 'v', len: 3 });
    for (let c = 0; c < p.cars && ok; c++) ok = place(rng, vehicles, pos, { type: 'car', dir: rng.chance(0.5) ? 'h' : 'v', len: 2 });
    if (!ok) continue;
    const lot: Lot = { vehicles, chargers, limitKw: p.limitKw ?? Infinity, chargeMoves: p.chargeMoves ?? 0, darkEvery: p.darkEvery ?? 0, battery: p.battery ?? 99 };
    // Park each EV right at its charger, then scramble the lot with random legal moves:
    // the board stays solvable and the solver only has to measure how hard it became.
    for (let e = 0; e < p.evs; e++) {
      const c = chargers.find((x) => x.line === vehicles[e].line && (vehicles[e].dir === 'h' ? x.side === 'E' || x.side === 'W' : x.side === 'N' || x.side === 'S'));
      if (!c) continue;
      const want = c.side === 'W' || c.side === 'N' ? 0 : SIZE - vehicles[e].len;
      const trial = pos.slice();
      trial[e] = want;
      const st: LotState = { pos: trial, battery: [], busy: [], darkDir: 1, darkTick: 0, moves: 0 };
      const occ = occupancy(lot, { ...st, pos: trial.map((x, i) => (i === e ? -1 : x)) });
      if (cellsOf(vehicles[e], want).every((cell) => occ[cell] < 0)) pos[e] = want;
    }
    const free: Lot = { ...lot, limitKw: Infinity, chargeMoves: 0, darkEvery: 0, battery: 99 };
    let walk: LotState = { pos, battery: vehicles.map(() => 99), busy: chargers.map(() => 0), darkDir: 1, darkTick: 0, moves: 0 };
    for (let k = 0, n = rng.int(30, 90); k < n; k++) {
      const ms = legalMoves(free, walk).filter((m) => m.charger === undefined);
      if (!ms.length) break;
      walk = applyMove(free, walk, rng.pick(ms));
    }
    pos.splice(0, pos.length, ...walk.pos);
    const start: LotState = { pos, battery: vehicles.map((v) => (v.type === 'ev' ? lot.battery : 0)), busy: chargers.map(() => 0), darkDir: 1, darkTick: 0, moves: 0 };
    const solution = solve(lot, start, 30000);
    if (!solution) continue;
    const n = solution.length;
    if (n >= lo && n <= hi) return { lot, start, solution };
    // Keep the hardest board under the cap in case nothing lands in range.
    if (n <= hi && (!best || n > best.solution.length)) best = { lot, start, solution };
  }
  if (best && best.solution.length >= Math.max(2, lo - 3)) return best;
  throw new Error(`Polnilnica: no board for seed ${p.seed}`);
}

export type PolnilnicaEvent =
  | { type: 'move'; move: Move }
  | { type: 'plug'; vehicle: number; charger: number }
  | { type: 'dark'; vehicle: number }
  | { type: 'flat'; vehicle: number }
  | { type: 'won' };

export class PolnilnicaGame {
  readonly lot: Lot;
  readonly par: number;
  state: LotState;
  history: LotState[] = [];
  hints = 0;
  undos = 0;
  finished = false;
  private listeners: ((e: PolnilnicaEvent) => void)[] = [];

  constructor(p: PolnilnicaParams, extraBattery = 0) {
    const pre = (BOARDS as Record<string, { lot: Omit<Lot, 'limitKw'> & { limitKw: number | null }; start: LotState; par: number }>)[p.seed];
    if (pre) {
      this.lot = { ...pre.lot, limitKw: pre.lot.limitKw ?? Infinity } as Lot;
      this.state = structuredClone(pre.start);
      this.par = pre.par;
    } else {
      const pz = generatePuzzle(p);
      this.lot = pz.lot;
      this.state = pz.start;
      this.par = pz.solution.length;
    }
    if (extraBattery && this.lot.battery < 50) {
      this.lot.battery += extraBattery;
      this.state.battery = this.state.battery.map((b, i) => (this.lot.vehicles[i].type === 'ev' ? b + extraBattery : b));
    }
  }

  on(fn: (e: PolnilnicaEvent) => void) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  private emit(e: PolnilnicaEvent) {
    for (const l of this.listeners) l(e);
  }

  /** Plays a move if it is legal; returns false otherwise. */
  play(m: Move) {
    if (this.finished) return false;
    const legal = legalMoves(this.lot, this.state).find((x) => x.vehicle === m.vehicle && x.to === m.to && x.charger === m.charger);
    if (!legal) return false;
    const dark = this.lot.vehicles.findIndex((v) => v.type === 'dark');
    const darkBefore = dark >= 0 ? this.state.pos[dark] : -1;
    this.history.push(this.state);
    this.state = applyMove(this.lot, this.state, legal);
    this.emit({ type: 'move', move: legal });
    if (legal.charger !== undefined) this.emit({ type: 'plug', vehicle: legal.vehicle, charger: legal.charger });
    else if (this.lot.vehicles[legal.vehicle].type === 'ev' && this.state.battery[legal.vehicle] === 0) this.emit({ type: 'flat', vehicle: legal.vehicle });
    if (dark >= 0 && this.state.pos[dark] !== darkBefore) this.emit({ type: 'dark', vehicle: dark });
    if (isWon(this.lot, this.state)) {
      this.finished = true;
      this.emit({ type: 'won' });
    }
    return true;
  }

  undo() {
    if (this.finished || !this.history.length) return false;
    this.state = this.history.pop()!;
    this.undos++;
    return true;
  }

  /** Next move of a shortest solution from here, or null if the lot is stuck. */
  hint(): Move | null {
    if (this.finished) return null;
    const path = solve(this.lot, this.state, 120000);
    if (!path?.length) return null;
    this.hints++;
    return path[0];
  }

  /** Shortest way to finish from here, for automated playtests (does not count as a hint). */
  route(): Move[] | null {
    return solve(this.lot, this.state, 200000);
  }

  get stuck() {
    return !this.finished && !solve(this.lot, this.state, 120000);
  }
}
