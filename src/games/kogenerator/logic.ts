import { createRng } from '../../core/rng';
import type { KogeneratorParams } from '../../core/types';

/** Simulated hours per day; the real duration of a day comes from the params. */
export const HOURS = 24;
export const SAMPLES_PER_HOUR = 4;
/** Heat (kWth) produced per kWe of electricity. */
export const HEAT_RATIO = 1.2;
export const ETA_E = 0.4;
/** Below this load the engine cannot run: it is either off or at least this. */
export const MIN_LOAD = 0.4;
export const GAS_EUR = 45;
export const HEAT_EUR = 55;
export const T_MIN = 68;
export const T_MAX = 92;
export const T_TARGET = 80;
/** Loop temperature change in °C per hour per kW of imbalance, relative to CHP heat at full load. */
const T_GAIN = 14;

export interface Spike {
  hour: number;
  len: number;
  extra: number;
}

export interface KogenDay {
  /** EUR/MWh electricity, one value per sample. */
  price: number[];
  /** kWth heat demand, one value per sample. */
  demand: number[];
  spikes: Spike[];
}

const bump = (h: number, at: number, width: number) => {
  const d = ((h - at + 36) % 24) - 12;
  return Math.exp(-(d * d) / (2 * width * width));
};

export function generateDay(p: KogeneratorParams): KogenDay {
  const rng = createRng(p.seed);
  const n = HOURS * SAMPLES_PER_HOUR;
  const heatFull = p.chpKw * HEAT_RATIO;
  const spikes: Spike[] = [];
  for (let i = 0; i < p.spikes; i++) spikes.push({ hour: rng.int(7, 20) + rng.next() * 0.5, len: 1 + rng.next(), extra: 140 + rng.int(0, 80) });
  const phase = rng.next() * 0.6;
  const price: number[] = [];
  const demand: number[] = [];
  for (let i = 0; i < n; i++) {
    const h = i / SAMPLES_PER_HOUR;
    // Day-ahead shape: cheap night, morning ramp, solar dip at noon, expensive evening.
    const shape = -0.75 + 1.0 * bump(h, 8 + phase, 1.6) - 0.5 * bump(h, 13, 2) + 1.5 * bump(h, 19 + phase, 2) + 0.15 * Math.sin(i * 1.7 + rng.next());
    let eur = 95 + 90 * p.priceSwing * shape;
    for (const s of spikes) if (h >= s.hour && h < s.hour + s.len) eur += s.extra;
    price.push(Math.max(15, Math.round(eur)));
    // District heating: morning and evening peaks, night setback.
    const d = 0.55 + 0.45 * bump(h, 7, 1.8) + 0.35 * bump(h, 19, 2.5) - 0.15 * bump(h, 2, 2.5) + 0.03 * (rng.next() - 0.5);
    demand.push(Math.round(heatFull * p.demandScale * d));
  }
  return { price, demand, spikes };
}

export interface KogenControls {
  /** 0 or MIN_LOAD..1 */
  load: number;
  /** -1 = discharge storage into the loop, +1 = charge storage from the loop. */
  storage: number;
}

export type KogenEvent = { type: 'cold' } | { type: 'dump' } | { type: 'spike'; spike: Spike } | { type: 'finished' };

export class KogenSim {
  readonly p: KogeneratorParams;
  readonly day: KogenDay;
  /** Simulated hours since midnight. */
  hour = 0;
  temp = T_TARGET;
  /** Storage state of charge 0..1. */
  soc = 0.5;
  controls: KogenControls = { load: 0, storage: 0 };
  profit = 0;
  gasKwh = 0;
  elecKwh = 0;
  usefulHeatKwh = 0;
  dumpedKwh = 0;
  coldEvents = 0;
  coldHours = 0;
  finished = false;
  private wasCold = false;
  private wasDumping = false;
  private seenSpikes = new Set<Spike>();
  private listeners: ((e: KogenEvent) => void)[] = [];
  /** Last-tick flows, for the gauges. */
  flow = { elec: 0, heat: 0, toStorage: 0, demand: 0, dump: 0 };

  constructor(p: KogeneratorParams) {
    this.p = p;
    this.day = generateDay(p);
  }

  on(fn: (e: KogenEvent) => void) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }
  private emit(e: KogenEvent) {
    for (const l of this.listeners) l(e);
  }

  sample(series: number[], hour = this.hour) {
    const i = Math.min(series.length - 1, Math.max(0, Math.floor(hour * SAMPLES_PER_HOUR)));
    return series[i];
  }
  get price() {
    return this.sample(this.day.price);
  }
  get demand() {
    return this.sample(this.day.demand);
  }
  get storageMaxKw() {
    return this.p.chpKw * HEAT_RATIO * 0.8;
  }
  /** Total fuel efficiency so far: (electricity + useful heat) / gas. */
  get efficiency() {
    return this.gasKwh > 0 ? (this.elecKwh + this.usefulHeatKwh) / this.gasKwh : 0;
  }

  setLoad(load: number) {
    this.controls.load = load < MIN_LOAD / 2 ? 0 : Math.min(1, Math.max(MIN_LOAD, load));
  }
  setStorage(v: number) {
    this.controls.storage = Math.abs(v) < 0.08 ? 0 : Math.max(-1, Math.min(1, v));
  }

  /** Advance by real seconds. */
  update(dtReal: number) {
    if (this.finished) return;
    const dh = (dtReal / this.p.durationSec) * HOURS;
    const elec = this.controls.load * this.p.chpKw;
    const heat = elec * HEAT_RATIO;
    const cap = this.p.storageKwh;
    let toStorage = this.controls.storage * this.storageMaxKw;
    if (toStorage > 0) toStorage = Math.min(toStorage, ((1 - this.soc) * cap) / dh);
    else toStorage = Math.max(toStorage, (-this.soc * cap) / dh);
    const demand = this.demand;
    const net = heat - toStorage - demand;
    const heatFull = this.p.chpKw * HEAT_RATIO;
    let temp = this.temp + (net / heatFull) * T_GAIN * dh;
    let dump = 0;
    // The emergency cooler throws away whatever would push the loop past T_MAX.
    if (temp > T_MAX) {
      dump = ((temp - T_MAX) / (T_GAIN * dh)) * heatFull;
      temp = T_MAX;
    }
    temp = Math.max(55, temp);
    this.temp = temp;
    this.soc = Math.min(1, Math.max(0, this.soc + (toStorage * dh) / cap));

    const gas = elec / ETA_E;
    const useful = Math.max(0, heat - dump);
    this.gasKwh += gas * dh;
    this.elecKwh += elec * dh;
    this.usefulHeatKwh += useful * dh;
    this.dumpedKwh += dump * dh;
    // Electricity sold at the spot price, useful heat sold to the district network, gas bought.
    this.profit += ((elec * this.price) / 1000 + (useful * HEAT_EUR) / 1000 - (gas * GAS_EUR) / 1000) * dh;
    this.flow = { elec, heat, toStorage, demand, dump };

    const cold = this.temp < T_MIN;
    if (cold) this.coldHours += dh;
    if (cold && !this.wasCold) {
      this.coldEvents++;
      this.emit({ type: 'cold' });
    }
    this.wasCold = cold;
    const dumping = dump > heatFull * 0.05;
    if (dumping && !this.wasDumping) this.emit({ type: 'dump' });
    this.wasDumping = dumping;
    for (const s of this.day.spikes)
      if (!this.seenSpikes.has(s) && this.hour >= s.hour - 0.75) {
        this.seenSpikes.add(s);
        this.emit({ type: 'spike', spike: s });
      }

    this.hour += dh;
    if (this.hour >= HOURS) {
      this.hour = HOURS;
      this.finished = true;
      this.emit({ type: 'finished' });
    }
  }
}

/** Reference player for balance tests: runs on price, keeps the loop at target with storage. */
export function autoplayKogen(p: KogeneratorParams, opts: { threshold?: number } = {}) {
  const sim = new KogenSim(p);
  const sorted = [...sim.day.price].sort((a, b) => a - b);
  const threshold = opts.threshold ?? Math.max(GAS_EUR / ETA_E - HEAT_EUR * HEAT_RATIO * 0.7, sorted[Math.floor(sorted.length * 0.45)]);
  const dt = 0.1;
  while (!sim.finished) {
    const heatFull = p.chpKw * HEAT_RATIO;
    const ahead = sim.sample(sim.day.demand, sim.hour + 1);
    let load = sim.price >= threshold ? 1 : 0;
    // Don't let the storage run dry while the network still needs heat.
    if (!load && sim.soc < 0.12 && ahead > 0) load = Math.min(1, Math.max(0.4, (ahead * 1.05) / heatFull));
    sim.setLoad(load);
    const heat = sim.controls.load * heatFull;
    const want = heat - sim.demand + (sim.temp - T_TARGET) * heatFull * 0.08;
    sim.setStorage(want / sim.storageMaxKw);
    sim.update(dt);
  }
  return sim;
}
