import { createRng } from '../../core/rng';
import type { ConsumerDef, KonicaParams } from '../../core/types';

export const SAMPLE_DT = 0.1;
/** Billing averages demand over a window, so short surges hurt less than long plateaus. */
export const BILLING_SAMPLES = 20;
/** The 15-minute billing window is compressed into the level duration. */
export const WINDOW_MIN = 15;

export interface ConsumerState {
  def: ConsumerDef;
  on: boolean;
  buffer: number;
  /** Seconds the consumer stays force-locked on after a stall. */
  lockedFor: number;
  surgeFor: number;
  active: boolean;
  /** Smoothed actual draw, so switching ramps instead of jumping. */
  draw: number;
}

export type KonicaEvent =
  | { type: 'toggle'; id: string; on: boolean }
  | { type: 'refused'; id: string; reason: 'critical' | 'locked' | 'inactive' }
  | { type: 'stall'; id: string }
  | { type: 'overLimit' }
  | { type: 'underLimit' }
  | { type: 'consumerStart'; id: string }
  | { type: 'finished' };

const STALL_LOCK = 3;
const SURGE_TIME = 0.6;
const RAMP_FROM = 0.62;
const RAMP_TIME = 7;

export class KonicaSim {
  readonly params: KonicaParams;
  t = 0;
  consumers: ConsumerState[];
  samples: number[] = [];
  /** Rolling billing average (the meter's view), one value per sample. */
  billed: number[] = [];
  peak = 0;
  overSeconds = 0;
  stalls = 0;
  over = false;
  finished = false;
  private sampleAcc = 0;
  private smooth = 0;
  private noisePhases: number[];
  private drainScale: number;
  private listeners: ((e: KonicaEvent) => void)[] = [];

  constructor(params: KonicaParams, opts: { drainScale?: number } = {}) {
    this.params = params;
    this.drainScale = opts.drainScale ?? 1;
    const rng = createRng(params.seed);
    this.noisePhases = [rng.next() * 6.28, rng.next() * 6.28, rng.next() * 6.28];
    this.consumers = params.consumers.map((def) => {
      const active = !def.startAt;
      return { def, on: true, buffer: 1, lockedFor: 0, surgeFor: 0, active, draw: active ? def.kw : 0 };
    });
    this.smooth = this.instantPower();
  }

  on(fn: (e: KonicaEvent) => void) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  private emit(e: KonicaEvent) {
    for (const l of this.listeners) l(e);
  }

  get duration() {
    return this.params.durationSec;
  }

  get timeLeft() {
    return Math.max(0, this.params.durationSec - this.t);
  }

  get limit() {
    return this.params.limitKw;
  }

  baseAt(t: number) {
    const p = this.params;
    let kw = p.baseKw;
    for (const s of p.baseSteps) if (t >= s.t) kw += s.kw;
    const [a, b, c] = this.noisePhases;
    const wobble = Math.sin(t * 0.9 + a) * 0.5 + Math.sin(t * 2.3 + b) * 0.3 + Math.sin(t * 5.1 + c) * 0.2;
    return kw * (1 + p.baseNoise * wobble);
  }

  private targetDraw(c: ConsumerState, t: number) {
    if (!c.active || !c.on) return 0;
    let kw = c.def.kw;
    if (c.def.cycle) kw *= 1 - c.def.cycle.depth * 0.5 * (1 + Math.sin((t / c.def.cycle.period) * Math.PI * 2));
    if (c.surgeFor > 0) kw *= this.params.inrush;
    return kw;
  }

  instantPower() {
    return (this.baseAt(this.t) + this.consumers.reduce((sum, c) => sum + c.draw, 0)) * this.ramp(this.t);
  }

  /** The shift spins up over the first seconds, giving the player time to read the board. */
  ramp(t: number) {
    return Math.min(1, RAMP_FROM + ((1 - RAMP_FROM) * t) / RAMP_TIME);
  }

  /** Consumer that will come online soon, for the on-screen warning. */
  upcoming(): { def: ConsumerDef; in: number } | null {
    let best: { def: ConsumerDef; in: number } | null = null;
    for (const c of this.consumers) {
      if (c.active || c.def.startAt === undefined) continue;
      const dt = c.def.startAt - this.t;
      if (dt >= 0 && (!best || dt < best.in)) best = { def: c.def, in: dt };
    }
    return best;
  }

  /** Power the meter reports: smoothed over ~0.5 s like a real demand measurement. */
  get power() {
    return this.smooth;
  }

  /** Current billing average. */
  get demand() {
    return this.billed.length ? this.billed[this.billed.length - 1] : this.smooth;
  }

  toggle(id: string) {
    const c = this.consumers.find((x) => x.def.id === id);
    if (!c || this.finished) return;
    if (c.def.critical) return this.emit({ type: 'refused', id, reason: 'critical' });
    if (!c.active) return this.emit({ type: 'refused', id, reason: 'inactive' });
    if (c.lockedFor > 0) return this.emit({ type: 'refused', id, reason: 'locked' });
    c.on = !c.on;
    if (c.on && this.params.inrush > 1) c.surgeFor = SURGE_TIME;
    this.emit({ type: 'toggle', id, on: c.on });
  }

  update(dt: number) {
    if (this.finished) return;
    const step = Math.min(dt, 0.05);
    let remaining = dt;
    while (remaining > 1e-6 && !this.finished) {
      const h = Math.min(step, remaining);
      this.tick(h);
      remaining -= h;
    }
  }

  private tick(h: number) {
    this.t += h;
    for (const c of this.consumers) {
      if (!c.active && c.def.startAt !== undefined && this.t >= c.def.startAt) {
        c.active = true;
        c.on = true;
        c.surgeFor = this.params.inrush > 1 ? SURGE_TIME : 0;
        this.emit({ type: 'consumerStart', id: c.def.id });
      }
      if (!c.active) continue;
      c.surgeFor = Math.max(0, c.surgeFor - h);
      c.lockedFor = Math.max(0, c.lockedFor - h);
      if (!c.def.critical) {
        if (c.on) c.buffer = Math.min(1, c.buffer + (c.def.fill ?? 0.1) * h);
        else {
          c.buffer = Math.max(0, c.buffer - (c.def.drain ?? 0.1) * this.drainScale * h);
          if (c.buffer <= 0) {
            // Stall: pressure/temperature lost, the process forces the consumer back on.
            c.on = true;
            c.lockedFor = STALL_LOCK;
            c.surgeFor = this.params.inrush > 1 ? SURGE_TIME : 0;
            this.stalls++;
            this.emit({ type: 'stall', id: c.def.id });
          }
        }
      }
      const target = this.targetDraw(c, this.t);
      c.draw += (target - c.draw) * Math.min(1, h * 8);
    }
    const p = this.instantPower();
    this.smooth += (p - this.smooth) * Math.min(1, h * 4);
    const isOver = this.smooth > this.params.limitKw;
    if (isOver !== this.over) {
      this.over = isOver;
      this.emit({ type: isOver ? 'overLimit' : 'underLimit' });
    }
    this.sampleAcc += h;
    while (this.sampleAcc >= SAMPLE_DT) {
      this.sampleAcc -= SAMPLE_DT;
      this.samples.push(this.smooth);
      const window = this.samples.slice(-BILLING_SAMPLES);
      const avg = window.reduce((a, b) => a + b, 0) / window.length;
      this.billed.push(avg);
      this.peak = Math.max(this.peak, avg);
      if (avg > this.params.limitKw) this.overSeconds += SAMPLE_DT;
    }
    if (this.t >= this.params.durationSec) {
      this.finished = true;
      this.emit({ type: 'finished' });
    }
  }

  /** Passed when the billed peak stays within the tolerated overshoot. */
  get passed() {
    return this.peak <= this.params.limitKw * (1 + this.params.tolerance);
  }
}

/** Peak if nobody touched anything: the reference for savings. */
export function baselinePeak(params: KonicaParams) {
  const sim = new KonicaSim(params);
  sim.update(params.durationSec + 0.01);
  return sim.peak;
}

/** Simple greedy controller. Used by tests to prove each level is beatable, and as a balance probe. */
export function autoplay(params: KonicaParams, opts: { drainScale?: number; reaction?: number } = {}) {
  const sim = new KonicaSim(params, opts);
  const reaction = opts.reaction ?? 0.25;
  let cooldown = 0;
  const margin = params.limitKw * 0.03;
  while (!sim.finished) {
    sim.update(0.05);
    cooldown -= 0.05;
    if (cooldown > 0) continue;
    const soon = sim.upcoming();
    const reserve = soon && soon.in < 4 ? soon.def.kw * params.inrush : 0;
    const p = sim.instantPower() + reserve;
    const toggleable = sim.consumers.filter((c) => c.active && !c.def.critical && c.lockedFor <= 0);
    const urgent = toggleable.find((c) => !c.on && c.buffer < 0.18);
    if (urgent) {
      // Make room first, then restore the starving consumer.
      const donor = toggleable
        .filter((c) => c.on && c.buffer > 0.5 && c !== urgent)
        .sort((a, b) => b.buffer - a.buffer)[0];
      if (donor && p + urgent.def.kw * params.inrush > params.limitKw - margin) sim.toggle(donor.def.id);
      sim.toggle(urgent.def.id);
      cooldown = reaction;
      continue;
    }
    if (p > params.limitKw - margin) {
      const victim = toggleable.filter((c) => c.on && c.buffer > 0.3).sort((a, b) => b.buffer * b.def.kw - a.buffer * a.def.kw)[0];
      if (victim) {
        sim.toggle(victim.def.id);
        cooldown = reaction;
      }
      continue;
    }
    const offs = toggleable.filter((c) => !c.on).sort((a, b) => a.buffer - b.buffer);
    for (const c of offs) {
      if (p + c.def.kw * params.inrush < params.limitKw - margin * 2) {
        sim.toggle(c.def.id);
        cooldown = reaction;
        break;
      }
    }
  }
  return sim;
}
