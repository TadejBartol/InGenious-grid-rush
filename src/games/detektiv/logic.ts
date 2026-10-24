import { createRng, type Rng } from '../../core/rng';
import type { AnomalyKind, DetektivParams } from '../../core/types';
import { weeklyProfile } from '../../data/profiles';

/** Hourly resolution, one week. */
export const POINTS = 168;
export const VIEW_HOURS = 30;
const TOLERANCE = 2;

export interface Anomaly {
  kind: AnomalyKind;
  start: number;
  len: number;
  found: boolean;
  missed: boolean;
}

export const ANOMALY_INFO: Record<AnomalyKind, { name: string; why: string }> = {
  nocna: { name: 'Nočna poraba', why: 'Ponoči ne dela nihče, števec pa se vrti. Nekdo ni ugasnil linije.' },
  zrak: { name: 'Puščanje zraka', why: 'Med vikendom kompresor vzdržuje tlak v puščajočem omrežju.' },
  prazniTek: { name: 'Prazni tek kompresorja', why: 'Kompresor se vklaplja in izklaplja, ne da bi kdo rabil zrak.' },
  konica: { name: 'Nenadna konica', why: 'Vse peči so se vklopile hkrati. Obračunska moč bo boleča.' },
  hladilnik: { name: 'Odprta hladilnica', why: 'Vrata hladilnice so ostala odprta, kompresorji hladilnice garajo.' },
};

export type DetektivEvent =
  | { type: 'found'; anomaly: Anomaly; combo: number; points: number }
  | { type: 'wrong'; hour: number }
  | { type: 'missed'; anomaly: Anomaly }
  | { type: 'finished' };

export interface Dataset {
  normal: number[];
  actual: number[];
  anomalies: Anomaly[];
}

export function generateDataset(p: DetektivParams): Dataset {
  const rng = createRng(p.seed);
  const normal = weeklyProfile(p.profile, rng);
  const actual = normal.map((v) => v * (1 + (rng.next() - 0.5) * 2 * p.noise));
  const anomalies: Anomaly[] = [];
  const taken: [number, number][] = [];
  const peak = Math.max(...normal);
  for (let i = 0; i < p.anomalies; i++) {
    const kind = p.kinds[i % p.kinds.length];
    const placed = placeAnomaly(kind, rng, taken);
    if (!placed) continue;
    taken.push([placed.start - 3, placed.start + placed.len + 3]);
    anomalies.push({ kind, start: placed.start, len: placed.len, found: false, missed: false });
    applyAnomaly(actual, kind, placed.start, placed.len, peak, rng);
  }
  anomalies.sort((a, b) => a.start - b.start);
  return { normal, actual, anomalies };
}

function placeAnomaly(kind: AnomalyKind, rng: Rng, taken: [number, number][]) {
  for (let tries = 0; tries < 80; tries++) {
    let start: number;
    let len: number;
    // Early hours stay clean so the player first sees what "normal" looks like.
    switch (kind) {
      case 'nocna': {
        const day = rng.int(0, 4);
        start = day * 24 + 22;
        len = rng.int(5, 7);
        break;
      }
      case 'zrak':
        start = rng.int(5 * 24, 6 * 24 + 6);
        len = rng.int(10, 16);
        break;
      case 'prazniTek': {
        const day = rng.int(0, 4);
        start = day * 24 + rng.pick([12, 18]);
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
    if (start < 14 || start + len >= POINTS) continue;
    if (taken.some(([a, b]) => start < b && start + len > a)) continue;
    return { start, len };
  }
  return null;
}

function applyAnomaly(data: number[], kind: AnomalyKind, start: number, len: number, peak: number, rng: Rng) {
  for (let h = start; h < start + len && h < data.length; h++) {
    const i = h - start;
    switch (kind) {
      case 'nocna':
        data[h] += peak * (0.32 + rng.next() * 0.06);
        break;
      case 'zrak':
        data[h] += peak * 0.22;
        break;
      case 'prazniTek':
        data[h] += peak * (i % 2 === 0 ? 0.3 : 0.05);
        break;
      case 'konica':
        data[h] += peak * (i === 0 ? 0.55 : 0.35);
        break;
      case 'hladilnik':
        data[h] += peak * (0.2 + 0.04 * i);
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
  finished = false;
  private listeners: ((e: DetektivEvent) => void)[] = [];

  constructor(params: DetektivParams) {
    this.params = params;
    this.data = generateDataset(params);
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

  /** Playback head in hours. The view keeps a few hours of lead-in visible before data starts moving. */
  get cursor() {
    return Math.min(POINTS, (this.t / this.params.durationSec) * (POINTS + VIEW_HOURS * 0.4));
  }

  get timeLeft() {
    return Math.max(0, this.params.durationSec - this.t);
  }

  get viewStart() {
    return Math.max(0, this.cursor - VIEW_HOURS);
  }

  update(dt: number) {
    if (this.finished) return;
    this.t += dt;
    const start = this.viewStart;
    for (const a of this.data.anomalies) {
      if (!a.found && !a.missed && a.start + a.len < start) {
        a.missed = true;
        this.combo = 0;
        this.emit({ type: 'missed', anomaly: a });
      }
    }
    if (this.t >= this.params.durationSec) {
      for (const a of this.data.anomalies) if (!a.found && !a.missed) a.missed = true;
      this.finished = true;
      this.emit({ type: 'finished' });
    }
  }

  /** Tap at an hour on the chart. Only already-drawn data can be accused. */
  tap(hour: number) {
    if (this.finished || hour > this.cursor + 0.5) return null;
    const hit = this.data.anomalies.find(
      (a) => !a.found && !a.missed && hour >= a.start - TOLERANCE && hour <= a.start + a.len + TOLERANCE && a.start <= this.cursor,
    );
    if (hit) {
      hit.found = true;
      this.combo++;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      const points = this.combo >= 3 ? 200 : 100;
      this.points += points;
      this.emit({ type: 'found', anomaly: hit, combo: this.combo, points });
      return hit;
    }
    if (this.data.anomalies.some((a) => a.found && hour >= a.start - TOLERANCE && hour <= a.start + a.len + TOLERANCE)) return null;
    this.mistakes++;
    this.combo = 0;
    this.emit({ type: 'wrong', hour });
    return null;
  }

  get foundCount() {
    return this.data.anomalies.filter((a) => a.found).length;
  }
}
