import { createRng } from '../../core/rng';
import type { UrnikParams } from '../../core/types';

/**
 * Vozni red toplarne: a planning puzzle instead of a reflex game.
 * The day is split into blocks. For each block the player decides whether the CHP runs.
 * Running earns the block's margin and puts heat into the tank; the city takes its demand
 * out of the tank. The tank may never run dry (cold radiators) or overflow (heat dumped).
 * The best plan is known (dynamic programming), so the puzzle has a clear "perfect" answer.
 */

export interface UrnikDay {
  blocks: number;
  /** Profit of one unit running for one block (EUR), can be negative when power is cheap. */
  margin: number[];
  /** Heat the city takes out of the tank in each block. */
  demand: number[];
  /** Blocks with a price spike, for the UI. */
  spikes: number[];
  /** locked[u][i]: unit u is in service during block i and cannot run. */
  locked: boolean[][];
  capacity: number;
  start: number;
  /** Heat one running unit puts into the tank per block. */
  out: number;
  units: number;
  startCost: number;
  /** The tank must end the day at least as full as it started. */
  keepEnd: boolean;
  best: number;
  bestPlan: number[][];
  pass: number;
}

export interface PlanCheck {
  profit: number;
  /** Tank level after each block, clamped to the tank so the bar stays readable. */
  tank: number[];
  cold: number[];
  overflow: number[];
  starts: number;
  endOk: boolean;
  valid: boolean;
}

export const blockHours = (blocks: number) => 24 / blocks;
export const blockLabel = (blocks: number, i: number) => String(i * blockHours(blocks)).padStart(2, '0');

export function checkPlan(day: UrnikDay, plan: number[][]): PlanCheck {
  let tank = day.start;
  let profit = 0;
  let starts = 0;
  const levels: number[] = [];
  const cold: number[] = [];
  const overflow: number[] = [];
  for (let i = 0; i < day.blocks; i++) {
    let on = 0;
    for (let u = 0; u < day.units; u++) {
      if (!plan[u][i]) continue;
      on++;
      if (i === 0 || !plan[u][i - 1]) starts++;
    }
    profit += on * day.margin[i];
    tank += on * day.out - day.demand[i];
    if (tank < 0) {
      cold.push(i);
      tank = 0;
    } else if (tank > day.capacity) {
      overflow.push(i);
      tank = day.capacity;
    }
    levels.push(tank);
  }
  profit -= starts * day.startCost;
  const endOk = !day.keepEnd || tank >= day.start;
  return { profit, tank: levels, cold, overflow, starts, endOk, valid: !cold.length && !overflow.length && endOk };
}

/** Exact best plan: states are (tank level, which units ran in the previous block). */
export function solve(day: Omit<UrnikDay, 'best' | 'bestPlan' | 'pass'>): { best: number; plan: number[][] } | null {
  const { blocks, units, capacity } = day;
  const masks = 1 << units;
  const S = (capacity + 1) * masks;
  let cur = new Array<number>(S).fill(-Infinity);
  cur[day.start * masks] = 0;
  const from: Int32Array[] = [];
  const pop = (m: number) => (m & 1) + ((m >> 1) & 1);
  for (let i = 0; i < blocks; i++) {
    const next = new Array<number>(S).fill(-Infinity);
    const back = new Int32Array(S).fill(-1);
    for (let s = 0; s < S; s++) {
      if (cur[s] === -Infinity) continue;
      const tank = Math.floor(s / masks);
      const prev = s % masks;
      for (let m = 0; m < masks; m++) {
        let ok = true;
        for (let u = 0; u < units; u++) if (m & (1 << u) && day.locked[u][i]) ok = false;
        if (!ok) continue;
        const t = tank + pop(m) * day.out - day.demand[i];
        if (t < 0 || t > capacity) continue;
        const starts = pop(m & ~prev);
        const v = cur[s] + pop(m) * day.margin[i] - starts * day.startCost;
        const ns = t * masks + m;
        if (v > next[ns]) {
          next[ns] = v;
          back[ns] = s;
        }
      }
    }
    from.push(back);
    cur = next;
  }
  let bestS = -1;
  for (let s = 0; s < S; s++) {
    if (cur[s] === -Infinity) continue;
    if (day.keepEnd && Math.floor(s / masks) < day.start) continue;
    if (bestS < 0 || cur[s] > cur[bestS]) bestS = s;
  }
  if (bestS < 0) return null;
  const plan = Array.from({ length: units }, () => new Array<number>(blocks).fill(0));
  let s = bestS;
  for (let i = blocks - 1; i >= 0; i--) {
    const m = s % masks;
    for (let u = 0; u < units; u++) plan[u][i] = m & (1 << u) ? 1 : 0;
    s = from[i][s];
  }
  return { best: cur[bestS], plan };
}

/** Margin shape over the day (EUR per block at full swing): cheap night, solar dip at noon, dear evening. */
function marginAt(h: number) {
  if (h < 5) return -10;
  if (h < 7) return 10;
  if (h < 10) return 35;
  if (h < 15) return -15;
  if (h < 17) return 15;
  if (h < 21) return 50;
  return 15;
}

/** Heat the city or the hospital takes (average per block): a hard morning peak, a softer evening one. */
function demandAt(h: number, profile: UrnikParams['profile']) {
  const hospital = profile === 'bolnisnica';
  if (h < 5) return hospital ? 1 : 0.6;
  if (h < 9) return hospital ? 2.6 : 2;
  if (h < 16) return hospital ? 1 : 0.7;
  if (h < 21) return hospital ? 1.7 : 1.6;
  return hospital ? 1 : 0.5;
}

const round5 = (v: number) => Math.round(v / 5) * 5;

export function generateDay(p: UrnikParams): UrnikDay {
  for (let attempt = 0; attempt < 40; attempt++) {
    const rng = createRng(p.seed + attempt * 7919);
    const { blocks } = p;
    const hb = blockHours(blocks);
    const units = p.units ?? 1;
    // One running unit covers what an average block of the day needs, a little more.
    const out = Math.round(hb);
    const margin: number[] = [];
    const demand: number[] = [];
    for (let i = 0; i < blocks; i++) {
      const h = i * hb + hb / 2;
      margin.push(round5(marginAt(h) * p.swing + rng.int(-2, 2) * 5));
      // Demand scales with the plant: two units heat twice as much.
      demand.push(Math.floor(demandAt(h, p.profile) * units * (hb / 2) + rng.next()));
    }
    const spikes: number[] = [];
    const pool = rng.shuffle([...Array(blocks).keys()].filter((i) => i > 0 && i < blocks - 1));
    for (const i of pool.slice(0, p.spikes ?? 0)) {
      margin[i] = round5(Math.max(margin[i], 20) + rng.int(5, 9) * 10);
      spikes.push(i);
    }
    const locked = Array.from({ length: units }, () => new Array<boolean>(blocks).fill(false));
    for (let k = 0; k < (p.service ?? 0); k++) {
      const u = k % units;
      const i = rng.int(1, blocks - 2);
      locked[u][i] = true;
    }
    const base = { blocks, margin, demand, spikes, locked, capacity: p.capacity * units, start: p.start * units, out, units, startCost: p.startCost ?? 0, keepEnd: !!p.keepEnd };
    const sol = solve(base);
    if (!sol || sol.best < 40) continue;
    return { ...base, best: sol.best, bestPlan: sol.plan, pass: round5(sol.best * p.pass) };
  }
  throw new Error(`Urnik: no playable day for seed ${p.seed}`);
}

export type UrnikEvent = { type: 'change' } | { type: 'run' } | { type: 'finished' };

/** Game state: the plan the player is building and the clock. */
export class UrnikGame {
  readonly day: UrnikDay;
  readonly timeTotal: number;
  timeLeft: number;
  plan: number[][];
  check: PlanCheck;
  /** Block the "day replay" has reached after the plan is submitted, -1 while planning. */
  replay = -1;
  submitted = false;
  finished = false;
  edits = 0;
  private listeners: ((e: UrnikEvent) => void)[] = [];

  constructor(p: UrnikParams) {
    this.day = generateDay(p);
    this.timeTotal = p.timeSec;
    this.timeLeft = p.timeSec;
    this.plan = Array.from({ length: this.day.units }, () => new Array<number>(this.day.blocks).fill(0));
    this.check = checkPlan(this.day, this.plan);
  }

  on(fn: (e: UrnikEvent) => void) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  private emit(e: UrnikEvent) {
    for (const l of this.listeners) l(e);
  }

  set(unit: number, block: number, on: boolean) {
    if (this.submitted || this.day.locked[unit][block]) return false;
    const v = on ? 1 : 0;
    if (this.plan[unit][block] === v) return false;
    this.plan[unit][block] = v;
    this.edits++;
    this.check = checkPlan(this.day, this.plan);
    this.emit({ type: 'change' });
    return true;
  }

  toggle(unit: number, block: number) {
    return this.set(unit, block, !this.plan[unit][block]);
  }

  clear() {
    if (this.submitted) return;
    this.plan = this.plan.map((r) => r.map(() => 0));
    this.check = checkPlan(this.day, this.plan);
    this.emit({ type: 'change' });
  }

  /** Locks the plan and plays the day; only a valid plan can be submitted before the clock runs out. */
  submit(force = false) {
    if (this.submitted || (!force && !this.check.valid)) return false;
    this.submitted = true;
    this.replay = 0;
    this.emit({ type: 'run' });
    return true;
  }

  get passed() {
    return this.check.valid && this.check.profit >= this.day.pass;
  }

  update(dt: number) {
    if (this.finished) return;
    if (!this.submitted) {
      this.timeLeft = Math.max(0, this.timeLeft - dt);
      if (this.timeLeft <= 0) this.submit(true);
      return;
    }
    this.replay += dt * (this.day.blocks / 2.4);
    if (this.replay >= this.day.blocks) {
      this.replay = this.day.blocks;
      this.finished = true;
      this.emit({ type: 'finished' });
    }
  }
}
