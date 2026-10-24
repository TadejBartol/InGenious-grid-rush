import { createRng } from '../../core/rng';
import type { SelitevParams } from '../../core/types';

/**
 * Selitev: thirty years of readings leave the old Š-0 system for InGenious, one
 * record at a time. Each record must land on the right new meter, in kWh, once, and
 * clean. Corrupt and duplicate records go to the bin. A record left at the reading
 * head too long falls off, and that month becomes a hole in the history.
 */
export const MONTHS = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'avg', 'sep', 'okt', 'nov', 'dec'];

/** New meters on the InGenious side, the facilities Š-0 once counted alone. */
const TARGETS = [
  { name: 'Livarna', color: 0x38e1ff, kwh: [38000, 62000] },
  { name: 'Mlekarna', color: 0xffd34d, kwh: [21000, 34000] },
  { name: 'Vodarna', color: 0x3dff9a, kwh: [9000, 16000] },
  { name: 'Toplarna', color: 0xff8a4f, kwh: [52000, 88000] },
  { name: 'Bolnišnica', color: 0xff6b9a, kwh: [27000, 41000] },
];

export interface Target {
  id: number;
  name: string;
  code: string;
  color: number;
  year: number;
  /** Months already imported. */
  slots: boolean[];
}

export type Flaw = 'hash' | 'negative';

export interface DataRecord {
  id: number;
  target: number;
  month: number;
  year: number;
  /** Value in kWh, whatever unit it is shown in. */
  kwh: number;
  unit: 'kWh' | 'Wh';
  flaw?: Flaw;
  duplicate?: boolean;
}

export type SelitevVerdict = 'ok' | 'cleaned' | 'wrongMeter' | 'unconverted' | 'overConverted' | 'corruptIn' | 'duplicateIn' | 'goodBinned' | 'lost' | 'slipped';

export type SelitevEvent =
  | { type: 'converted'; record: DataRecord }
  | { type: 'routed'; record: DataRecord; target: number; verdict: SelitevVerdict; combo: number }
  | { type: 'binned'; record: DataRecord; verdict: SelitevVerdict; combo: number }
  | { type: 'timeout'; record: DataRecord; verdict: SelitevVerdict }
  | { type: 'finished' };

export const VERDICT_TEXT: Record<Exclude<SelitevVerdict, 'ok' | 'cleaned'>, string> = {
  wrongMeter: 'Napačen merilnik! Podatki so pristali pri drugem objektu.',
  unconverted: 'Vrednost je bila v Wh: v bazi je zdaj 1000× preveč.',
  overConverted: 'Zapis je bil že v kWh. Zdaj je 1000× premalo.',
  corruptIn: 'Pokvarjen zapis je prišel v bazo.',
  duplicateIn: 'Ta mesec je bil že uvožen: zdaj je štet dvakrat.',
  goodBinned: 'Zavrgel si dober zapis. Mesec manjka.',
  lost: 'Zapis je padel z glave. V zgodovini je luknja.',
  slipped: 'Slab zapis je zdrsnil v bazo.',
};

export class SelitevGame {
  readonly p: SelitevParams;
  readonly targets: Target[] = [];
  readonly records: DataRecord[] = [];
  index = 0;
  /** Seconds the current record has waited at the head. */
  wait = 0;
  /** The current record has been converted from Wh. */
  converted = false;
  correct = 0;
  cleaned = 0;
  mistakes = 0;
  lost = 0;
  combo = 0;
  bestCombo = 0;
  elapsed = 0;
  finished = false;
  private listeners: ((e: SelitevEvent) => void)[] = [];

  constructor(p: SelitevParams) {
    this.p = p;
    const rng = createRng(p.seed);
    const pick = rng.shuffle([...TARGETS.keys()]).slice(0, Math.max(2, Math.min(TARGETS.length, p.targets)));
    const codes = new Set<number>();
    for (const k of pick) {
      let c = rng.int(3, 98);
      while (codes.has(c)) c = rng.int(3, 98);
      codes.add(c);
      const t = TARGETS[k];
      this.targets.push({ id: this.targets.length, name: t.name, code: `Š-0/${String(c).padStart(3, '0')}`, color: t.color, year: rng.int(1988, 2008), slots: new Array(12).fill(false) });
    }
    // Months go out in order per meter; meters interleave like the old export did.
    const next = this.targets.map(() => 0);
    const emitted: DataRecord[] = [];
    for (let i = 0; i < p.records; i++) {
      const roll = rng.next();
      if (roll < p.duplicates && emitted.length > 2) {
        const src = rng.pick(emitted.filter((r) => !r.flaw && !r.duplicate));
        if (src) {
          this.records.push({ ...src, id: i, duplicate: true, unit: rng.chance(p.convert) ? 'Wh' : 'kWh' });
          continue;
        }
      }
      const free = this.targets.filter((t) => next[t.id] < 12);
      const t = free.length ? rng.pick(free) : rng.pick(this.targets);
      const month = next[t.id] % 12;
      next[t.id]++;
      const range = TARGETS.find((x) => x.name === t.name)!.kwh;
      const r: DataRecord = { id: i, target: t.id, month, year: t.year, kwh: Math.round((range[0] + rng.next() * (range[1] - range[0])) / 10) * 10, unit: rng.chance(p.convert) ? 'Wh' : 'kWh' };
      if (roll >= p.duplicates && roll < p.duplicates + p.corrupt) r.flaw = rng.chance(0.5) ? 'hash' : 'negative';
      // A corrupt record does not use up the month: the good one may still come.
      if (r.flaw) next[t.id]--;
      this.records.push(r);
      emitted.push(r);
    }
  }

  on(fn: (e: SelitevEvent) => void) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }
  private emit(e: SelitevEvent) {
    for (const l of this.listeners) l(e);
  }

  get current(): DataRecord | undefined {
    return this.records[this.index];
  }
  /** Seconds this record may wait; the stream speeds up as the migration goes on. */
  get cardSec() {
    return this.p.cardSec * (1 - 0.25 * (this.index / Math.max(1, this.records.length)));
  }
  get valid() {
    return this.records.filter((r) => !r.flaw && !r.duplicate).length;
  }
  /** Share of good records that arrived intact. */
  get integrity() {
    return this.valid ? this.correct / this.valid : 1;
  }
  get passed() {
    return this.integrity >= this.p.pass;
  }
  /** The code table stays visible for the first records, then (on hard levels) it must be remembered. */
  get mapVisible() {
    return !this.p.hideMap || this.index < Math.min(6, this.targets.length * 2);
  }
  bad(r: DataRecord) {
    return !!r.flaw || !!r.duplicate || (this.targets[r.target]?.slots[r.month] ?? false);
  }

  update(dt: number) {
    if (this.finished) return;
    this.elapsed += dt;
    const r = this.current;
    if (!r) return;
    this.wait += dt;
    if (this.wait >= this.cardSec) {
      const verdict: SelitevVerdict = this.bad(r) ? 'slipped' : 'lost';
      this.combo = 0;
      if (verdict === 'lost') this.lost++;
      else this.mistakes++;
      this.emit({ type: 'timeout', record: r, verdict });
      this.advance();
    }
  }

  convert() {
    const r = this.current;
    if (!r || this.finished || this.converted) return;
    this.converted = true;
    this.emit({ type: 'converted', record: r });
  }

  route(target: number) {
    const r = this.current;
    if (!r || this.finished) return;
    const t = this.targets[target];
    let verdict: SelitevVerdict = 'ok';
    if (r.flaw) verdict = 'corruptIn';
    else if (r.duplicate || (r.target === target && t.slots[r.month])) verdict = 'duplicateIn';
    else if (r.target !== target) verdict = 'wrongMeter';
    else if (r.unit === 'Wh' && !this.converted) verdict = 'unconverted';
    else if (r.unit === 'kWh' && this.converted) verdict = 'overConverted';
    if (verdict === 'ok') {
      t.slots[r.month] = true;
      this.correct++;
      this.combo++;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
    } else {
      this.mistakes++;
      this.combo = 0;
      // The good month went to the wrong place, so it is missing where it belongs.
      if (!r.flaw && !r.duplicate) this.lost++;
    }
    this.emit({ type: 'routed', record: r, target, verdict, combo: this.combo });
    this.advance();
  }

  bin() {
    const r = this.current;
    if (!r || this.finished) return;
    let verdict: SelitevVerdict;
    if (this.bad(r)) {
      verdict = 'cleaned';
      this.cleaned++;
      this.combo++;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
    } else {
      verdict = 'goodBinned';
      this.mistakes++;
      this.lost++;
      this.combo = 0;
    }
    this.emit({ type: 'binned', record: r, verdict, combo: this.combo });
    this.advance();
  }

  private advance() {
    this.index++;
    this.wait = 0;
    this.converted = false;
    if (this.index >= this.records.length) {
      this.finished = true;
      this.emit({ type: 'finished' });
    }
  }
}

/** Shown value of a record, as the old system printed it. */
export function shownValue(r: DataRecord, converted: boolean): string {
  if (r.flaw === 'hash') return '#####';
  const v = r.flaw === 'negative' ? -r.kwh : r.kwh;
  const n = r.unit === 'Wh' && !converted ? v * 1000 : v;
  return n.toLocaleString('sl-SI').replace(/ /g, ' ');
}

/** Reference player for balance tests. `slip` is the share of records it gets wrong on purpose. */
export function autoplaySelitev(p: SelitevParams, opts: { think?: number; slip?: number } = {}) {
  const game = new SelitevGame(p);
  const think = opts.think ?? 1;
  let k = 0;
  while (!game.finished) {
    game.update(0.05);
    const r = game.current;
    if (!r || game.wait < think) continue;
    k++;
    if (opts.slip && (k * 0.618) % 1 < opts.slip) game.route((r.target + 1) % game.targets.length);
    else if (game.bad(r)) game.bin();
    else {
      if (r.unit === 'Wh') game.convert();
      game.route(r.target);
    }
  }
  return game;
}
