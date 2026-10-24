import { createRng, type Rng } from '../../core/rng';
import type { AnomalyKind, DetektivParams } from '../../core/types';
import { weeklyProfile } from '../../data/profiles';

/** Hourly resolution, one week. */
export const POINTS = 168;
export const VIEW_HOURS = 30;
/** Hours already drawn when the round starts, so the player first sees what "normal" looks like. */
export const LEAD_HOURS = VIEW_HOURS * 0.4;
const TOLERANCE = 1.5;
/** Nothing suspicious in the last hours: the player needs time to react before the clock runs out. */
const TAIL = 6;
/** Time runs at this speed while the player is diagnosing. */
export const DIAGNOSE_SLOWMO = 0.3;
/** Real seconds to pick a diagnosis before it counts as a wrong one. */
export const DIAGNOSE_SEC = 7;

export interface Anomaly {
  kind: AnomalyKind;
  start: number;
  len: number;
  found: boolean;
  missed: boolean;
  /** Spotted, but the player picked the wrong cause. */
  misread?: boolean;
}

/** A planned event on the production schedule: looks like an anomaly, is not. */
export interface Decoy {
  name: string;
  mimics: AnomalyKind;
  start: number;
  len: number;
  /** The player accused it. */
  accused: boolean;
}

export const ANOMALY_INFO: Record<AnomalyKind, { name: string; why: string; clue: string }> = {
  nocna: { name: 'Nočna poraba', why: 'Ponoči ne dela nihče, števec pa se vrti. Nekdo ni ugasnil linije.', clue: 'ravna planota ponoči' },
  zrak: { name: 'Puščanje zraka', why: 'Med vikendom kompresor vzdržuje tlak v puščajočem omrežju.', clue: 'dolga stopnica čez vikend' },
  prazniTek: { name: 'Prazni tek kompresorja', why: 'Kompresor se vklaplja in izklaplja, ne da bi kdo rabil zrak.', clue: 'žagast vzorec gor-dol' },
  konica: { name: 'Nenadna konica', why: 'Vse peči so se vklopile hkrati. Obračunska moč bo boleča.', clue: 'kratek oster vrh' },
  hladilnik: { name: 'Odprta hladilnica', why: 'Vrata hladilnice so ostala odprta, kompresorji hladilnice garajo.', clue: 'klanec, ki narašča' },
};

/** Planned events that produce the same shape as an anomaly. */
const PLANNED: Record<AnomalyKind, string> = {
  nocna: 'Nočna izmena',
  zrak: 'Vikend servis',
  prazniTek: 'Test kompresorja',
  konica: 'Zagon peči',
  hladilnik: 'Polnjenje hladilnice',
};

export const ALL_KINDS = Object.keys(ANOMALY_INFO) as AnomalyKind[];

export type DetektivEvent =
  | { type: 'suspect'; anomaly: Anomaly; options: AnomalyKind[] }
  | { type: 'found'; anomaly: Anomaly; combo: number; points: number; fast: boolean }
  | { type: 'misread'; anomaly: Anomaly; picked: AnomalyKind | null }
  | { type: 'decoy'; decoy: Decoy }
  | { type: 'wrong'; hour: number }
  | { type: 'missed'; anomaly: Anomaly }
  | { type: 'finished' };

export interface Dataset {
  normal: number[];
  actual: number[];
  anomalies: Anomaly[];
  decoys: Decoy[];
}

export function generateDataset(p: DetektivParams): Dataset {
  const rng = createRng(p.seed);
  const normal = weeklyProfile(p.profile, rng);
  const actual = normal.map((v) => v * (1 + (rng.next() - 0.5) * 2 * p.noise));
  const anomalies: Anomaly[] = [];
  const decoys: Decoy[] = [];
  const taken: [number, number][] = [];
  const peak = Math.max(...normal);
  const scale = p.scale ?? 1;
  for (let i = 0; i < p.anomalies; i++) {
    const kind = p.kinds[i % p.kinds.length];
    const placed = place(kind, rng, taken);
    if (!placed) continue;
    taken.push([placed.start - 3, placed.start + placed.len + 3]);
    anomalies.push({ kind, start: placed.start, len: placed.len, found: false, missed: false });
    shape(actual, kind, placed.start, placed.len, peak * scale, rng);
  }
  for (let i = 0; i < (p.decoys ?? 0); i++) {
    // Mimic one of the level's anomaly kinds; when the week is too crowded for one shape, try the next.
    let mimics = p.kinds[0];
    let placed: ReturnType<typeof place> = null;
    for (let k = 0; k < p.kinds.length && !placed; k++) {
      mimics = p.kinds[(i + 1 + k) % p.kinds.length];
      placed = place(mimics, rng, taken);
    }
    if (!placed) continue;
    taken.push([placed.start - 3, placed.start + placed.len + 3]);
    decoys.push({ name: PLANNED[mimics], mimics, start: placed.start, len: placed.len, accused: false });
    // A planned event is a normal, full-strength load: it is the schedule that explains it.
    shape(actual, mimics, placed.start, placed.len, peak * Math.max(scale, 0.85), rng);
  }
  anomalies.sort((a, b) => a.start - b.start);
  decoys.sort((a, b) => a.start - b.start);
  return { normal, actual, anomalies, decoys };
}

function place(kind: AnomalyKind, rng: Rng, taken: [number, number][]) {
  for (let tries = 0; tries < 120; tries++) {
    let start: number;
    let len: number;
    switch (kind) {
      case 'nocna': {
        const day = rng.int(0, 5);
        start = day * 24 + 22;
        len = rng.int(5, 7);
        break;
      }
      case 'zrak':
        start = rng.int(5 * 24, 6 * 24 + 4);
        len = rng.int(9, 14);
        break;
      case 'prazniTek': {
        const day = rng.int(0, 6);
        start = day * 24 + rng.pick([1, 12, 18]);
        len = rng.int(4, 6);
        break;
      }
      case 'konica':
        start = rng.int(0, 4) * 24 + rng.int(8, 14);
        len = 2;
        break;
      case 'hladilnik':
        start = rng.int(0, 6) * 24 + rng.int(2, 18);
        len = rng.int(4, 7);
        break;
    }
    if (start < LEAD_HOURS + 3 || start + len > POINTS - TAIL) continue;
    if (taken.some(([a, b]) => start < b && start + len > a)) continue;
    return { start, len };
  }
  return null;
}

/** Adds the load signature of a kind; `amp` is the strength in kW at scale 1. */
function shape(data: number[], kind: AnomalyKind, start: number, len: number, amp: number, rng: Rng) {
  for (let h = start; h < start + len && h < data.length; h++) {
    const i = h - start;
    switch (kind) {
      case 'nocna':
        data[h] += amp * (0.3 + rng.next() * 0.06);
        break;
      case 'zrak':
        data[h] += amp * 0.22;
        break;
      case 'prazniTek':
        data[h] += amp * (i % 2 === 0 ? 0.32 : 0.06);
        break;
      case 'konica':
        data[h] += amp * (i === 0 ? 0.55 : 0.35);
        break;
      case 'hladilnik':
        data[h] += amp * (0.14 + 0.05 * i);
        break;
    }
  }
}

export class DetektivGame {
  readonly params: DetektivParams;
  readonly data: Dataset;
  t = 0;
  mistakes = 0;
  combo = 0;
  bestCombo = 0;
  points = 0;
  fastFinds = 0;
  finished = false;
  /** The anomaly the player tapped and must now diagnose. */
  pending: { anomaly: Anomaly; options: AnomalyKind[]; left: number } | null = null;
  /** Real seconds the player gets to name the cause (the Kalibracija research adds to it). */
  readonly diagnoseSec: number;
  private rng: Rng;
  private listeners: ((e: DetektivEvent) => void)[] = [];

  constructor(params: DetektivParams, opts: { diagnoseSec?: number } = {}) {
    this.params = params;
    this.diagnoseSec = opts.diagnoseSec ?? DIAGNOSE_SEC;
    this.data = generateDataset(params);
    this.rng = createRng(params.seed ^ 0x5eed);
  }

  on(fn: (e: DetektivEvent) => void) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  private emit(e: DetektivEvent) {
    for (const l of this.listeners) l(e);
  }

  /** Playback head in hours: starts after the lead-in and reaches the end of the week exactly when time runs out. */
  get cursor() {
    return Math.min(POINTS, LEAD_HOURS + (this.t / this.params.durationSec) * (POINTS - LEAD_HOURS));
  }

  get timeLeft() {
    return Math.max(0, this.params.durationSec - this.t);
  }

  get viewStart() {
    return Math.max(0, this.cursor - VIEW_HOURS);
  }

  /** `dt` in real seconds; game time slows down while a diagnosis is open. */
  update(dt: number) {
    if (this.finished) return;
    if (this.pending) {
      this.pending.left -= dt;
      if (this.pending.left <= 0) this.diagnose(null);
      dt *= DIAGNOSE_SLOWMO;
    }
    this.t = Math.min(this.params.durationSec, this.t + dt);
    const start = this.viewStart;
    for (const a of this.data.anomalies) {
      if (!a.found && !a.missed && a !== this.pending?.anomaly && a.start + a.len < start) {
        a.missed = true;
        this.combo = 0;
        this.emit({ type: 'missed', anomaly: a });
      }
    }
    if (this.t >= this.params.durationSec) {
      if (this.pending) this.diagnose(null);
      for (const a of this.data.anomalies) if (!a.found && !a.missed) a.missed = true;
      this.finished = true;
      this.emit({ type: 'finished' });
    }
  }

  private near(hour: number, x: { start: number; len: number }) {
    return hour >= x.start - TOLERANCE && hour <= x.start + x.len + TOLERANCE - 1;
  }

  /** Tap at an hour on the chart. Only already-drawn data can be accused. */
  tap(hour: number) {
    if (this.finished || this.pending || hour > this.cursor + 0.5) return null;
    const hit = this.data.anomalies.find((a) => !a.found && !a.missed && a.start <= this.cursor && this.near(hour, a));
    if (hit) {
      const options = this.optionsFor(hit.kind);
      this.pending = { anomaly: hit, options, left: this.diagnoseSec };
      this.emit({ type: 'suspect', anomaly: hit, options });
      return hit;
    }
    if (this.data.anomalies.some((a) => a.found && this.near(hour, a))) return null;
    const decoy = this.data.decoys.find((d) => d.start <= this.cursor && this.near(hour, d));
    if (decoy) {
      if (decoy.accused) return null;
      decoy.accused = true;
      this.mistakes++;
      this.combo = 0;
      this.emit({ type: 'decoy', decoy });
      return null;
    }
    this.mistakes++;
    this.combo = 0;
    this.emit({ type: 'wrong', hour });
    return null;
  }

  /** Three causes to pick from: the right one and two look-alikes, in a shuffled order. */
  private optionsFor(kind: AnomalyKind): AnomalyKind[] {
    const others = ALL_KINDS.filter((k) => k !== kind);
    const own = others.filter((k) => this.params.kinds.includes(k));
    const pool = [...this.rng.shuffle(own), ...this.rng.shuffle(others.filter((k) => !own.includes(k)))];
    return this.rng.shuffle([kind, pool[0], pool[1]]);
  }

  /** Resolves the pending tap; null means the player ran out of time. */
  diagnose(kind: AnomalyKind | null) {
    const p = this.pending;
    if (!p) return;
    this.pending = null;
    const a = p.anomaly;
    a.found = true;
    if (kind !== a.kind) {
      a.misread = true;
      this.mistakes++;
      this.combo = 0;
      this.points += 25;
      this.emit({ type: 'misread', anomaly: a, picked: kind });
      return;
    }
    this.combo++;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    // Early detection pays: spotted before the anomaly has fully played out.
    const fast = this.cursor < a.start + a.len + 1;
    if (fast) this.fastFinds++;
    const points = (this.combo >= 3 ? 200 : 100) + (fast ? 50 : 0);
    this.points += points;
    this.emit({ type: 'found', anomaly: a, combo: this.combo, points, fast });
  }

  get foundCount() {
    return this.data.anomalies.filter((a) => a.found).length;
  }

  get readCount() {
    return this.data.anomalies.filter((a) => a.found && !a.misread).length;
  }
}
