import { createRng } from '../../core/rng';
import type { AlarmCause, AlarmParams } from '../../core/types';

/**
 * Alarm!: one night of vaccine cold chain across up to three health centres.
 * Vaccines must stay between 2 and 8 °C. Fridges and courier bags report every few
 * seconds; incidents push them out of range, and the player picks the right response.
 *
 * The alarm limit is the player's own setting, the way it is in InGenious: too tight
 * and every nurse opening a door rings it, too loose and the warning comes late.
 */
export const SAFE_MIN = 2;
export const SAFE_MAX = 8;
/** Low alarm is fixed; freezing is rare but just as fatal. */
export const LOW_ALARM = 3;
export const BASE_TEMP = 4.6;
/** Seconds out of range before the doses are lost. */
export const SPOIL_SEC = 5;
/** Game time runs at this speed while the response sheet is open. */
export const RESPOND_SLOWMO = 0.3;
export const LIMIT_MIN = 4.5;
export const LIMIT_MAX = 8;
export const DOSES = 120;
/** The last incidents start this long before the end, so every one can be handled. */
const TAIL = 24;
const GLITCH_SEC = 4.5;
const OPENING_SEC = 2.6;

/** °C per second while the incident runs (before params.speed). */
const RATE: Record<Exclude<AlarmCause, 'senzor'>, number> = {
  vrata: 0.24,
  izpad: 0.14,
  kompresor: 0.34,
  torba: 0.21,
  zmrzal: -0.24,
};

export type AlarmAction = 'zapri' | 'agregat' | 'preseli' | 'termostat' | 'vlozki' | 'lazni' | 'ok';

export const FIX: Record<AlarmCause, AlarmAction> = {
  vrata: 'zapri',
  izpad: 'agregat',
  kompresor: 'preseli',
  zmrzal: 'termostat',
  torba: 'vlozki',
  senzor: 'lazni',
};

export const ACTION_INFO: Record<AlarmAction, { label: string; icon: string }> = {
  zapri: { label: 'Zapri vrata', icon: 'door' },
  agregat: { label: 'Vklopi agregat', icon: 'bolt' },
  preseli: { label: 'Preseli cepiva v rezervni hladilnik', icon: 'move' },
  termostat: { label: 'Ponastavi termostat', icon: 'dial' },
  vlozki: { label: 'Kurir naj zamenja hladilne vložke', icon: 'ice' },
  lazni: { label: 'Lažni alarm: preveri senzor', icon: 'sensor' },
  ok: { label: 'Vse v redu, samo opazujem', icon: 'eye' },
};

export const CAUSE_INFO: Record<AlarmCause, { name: string; clue: string; why: string }> = {
  vrata: { name: 'Odprta vrata', clue: 'vratni kontakt kaže ODPRTO dlje časa', why: 'Vrata hladilnika niso dobro zaprta. Kontakt na vratih to pove prej kot termometer.' },
  izpad: { name: 'Izpad elektrike', clue: 'brez napajanja, ogrevajo se vsi hladilniki istega ZD', why: 'Ko zmanjka elektrike, se ogrejejo vsi hladilniki v stavbi hkrati. Agregat reši vse naenkrat.' },
  kompresor: { name: 'Okvara kompresorja', clue: 'vrata zaprta, elektrika je, temperatura pa hitro raste', why: 'Kompresor ne hladi več. Popravilo traja ure, cepiva morajo v rezervni hladilnik takoj.' },
  zmrzal: { name: 'Zmrzovanje', clue: 'temperatura pada proti 2 °C', why: 'Termostat se je zataknil. Zmrznjena cepiva so prav tako neuporabna kot pregreta.' },
  torba: { name: 'Topli hladilni vložki', clue: 'torba na poti, vložki se talijo', why: 'Kurir je obtičal v prometu. Sveži hladilni vložki iz najbližjega ZD rešijo pošiljko.' },
  senzor: { name: 'Napaka senzorja', clue: 'skok brez razloga, vrata zaprta, elektrika je', why: 'Senzor je za trenutek javil nesmisel. Preveri, preden pokličeš dežurnega sredi noči.' },
};

export const SITE_NAMES = ['ZD Center', 'ZD Sever', 'ZD Jug'];

export interface Unit {
  id: number;
  name: string;
  site: number;
  kind: 'fridge' | 'bag';
  /** Real temperature of the vaccines. */
  temp: number;
  /** What the sensor reports (differs during a glitch). */
  reading: number;
  door: boolean;
  power: boolean;
  /** Cool packs left in a bag, 0..1. */
  packs: number;
  alarm: boolean;
  /** Seconds out of range so far. */
  excursion: number;
  lost: boolean;
  /** Readings, one per HIST_STEP seconds. */
  history: number[];
  glitchUntil: number;
  glitchValue: number;
  doorUntil: number;
  wobble: number;
}

export interface Incident {
  id: number;
  cause: AlarmCause;
  unit: number;
  site: number;
  start: number;
  active: boolean;
  done: boolean;
  fixedAt?: number;
  lost?: boolean;
}

export type AlarmEvent =
  | { type: 'alarm'; unit: Unit; real: boolean }
  | { type: 'clear'; unit: Unit }
  | { type: 'excursion'; unit: Unit }
  | { type: 'lost'; unit: Unit }
  | { type: 'fixed'; unit: Unit; incident: Incident; response: number }
  | { type: 'dismissed'; unit: Unit }
  | { type: 'wrong'; unit: Unit; picked: AlarmAction; reason: string }
  | { type: 'finished' };

export const HIST_STEP = 0.25;
export const HIST_LEN = 72;

interface Glitch {
  at: number;
  unit: number;
  done: boolean;
}
interface Opening {
  at: number;
  unit: number;
  done: boolean;
}

export class AlarmSim {
  readonly p: AlarmParams;
  readonly units: Unit[] = [];
  readonly incidents: Incident[] = [];
  private glitches: Glitch[] = [];
  private openings: Opening[] = [];
  t = 0;
  threshold: number;
  spoilSec = SPOIL_SEC;
  mistakes = 0;
  falseAlarms = 0;
  alarmsRaised = 0;
  finished = false;
  private histAcc = 0;
  private listeners: ((e: AlarmEvent) => void)[] = [];

  constructor(p: AlarmParams, opts: { spoilBonus?: number } = {}) {
    this.p = p;
    this.threshold = p.threshold;
    this.spoilSec = SPOIL_SEC + (opts.spoilBonus ?? 0);
    const rng = createRng(p.seed);
    const sites = Math.max(1, Math.min(3, p.sites));
    const letters = 'ABCDEFGH';
    const perSite = new Array(sites).fill(0);
    for (let i = 0; i < p.fridges; i++) {
      const site = i % sites;
      this.units.push(this.makeUnit(this.units.length, `Hladilnik ${letters[perSite[site]++]}`, site, 'fridge', rng.next()));
    }
    for (let i = 0; i < (p.bags ?? 0); i++) this.units.push(this.makeUnit(this.units.length, `Torba ${i + 1}`, i % sites, 'bag', rng.next()));

    // Incidents: spread over the night, never two on the same unit (or centre) at once.
    const fridges = this.units.filter((u) => u.kind === 'fridge');
    const bags = this.units.filter((u) => u.kind === 'bag');
    const valid = p.causes.filter((c) => c !== 'senzor' && (c !== 'torba' || bags.length > 0) && (c === 'torba' || fridges.length > 0));
    const span = Math.max(8, p.durationSec - TAIL - 4);
    const busy: { unit: number; site: number; from: number; to: number; whole: boolean }[] = [];
    for (let i = 0; i < p.incidents && valid.length; i++) {
      const slot = 4 + (span * (i + 0.15 + rng.next() * 0.7)) / p.incidents;
      // Rotate through the allowed causes so every level shows its whole set.
      const causes = rng.shuffle([...valid]);
      causes.sort((a, b) => this.incidents.filter((x) => x.cause === a).length - this.incidents.filter((x) => x.cause === b).length);
      let placed = false;
      for (const cause of causes) {
        const pool = rng.shuffle(cause === 'torba' ? [...bags] : [...fridges]);
        for (const u of pool) {
          const whole = cause === 'izpad';
          const clash = busy.some((b) => slot < b.to && slot + 18 > b.from && (b.unit === u.id || ((whole || b.whole) && b.site === u.site)));
          if (clash) continue;
          busy.push({ unit: u.id, site: u.site, from: slot, to: slot + 18, whole });
          this.incidents.push({ id: this.incidents.length, cause, unit: u.id, site: u.site, start: slot, active: false, done: false });
          placed = true;
          break;
        }
        if (placed) break;
      }
    }
    for (let i = 0; i < p.glitches; i++) {
      const at = 3 + rng.next() * (p.durationSec - 10);
      const u = rng.pick(this.units);
      this.glitches.push({ at, unit: u.id, done: false });
    }
    for (let i = 0; i < p.openings && fridges.length; i++) {
      this.openings.push({ at: 2 + rng.next() * (p.durationSec - 6), unit: rng.pick(fridges).id, done: false });
    }
  }

  private makeUnit(id: number, name: string, site: number, kind: Unit['kind'], r: number): Unit {
    const temp = BASE_TEMP + (r - 0.5) * 0.6;
    return {
      id,
      name,
      site,
      kind,
      temp,
      reading: temp,
      door: false,
      power: true,
      packs: 1,
      alarm: false,
      excursion: 0,
      lost: false,
      history: new Array(HIST_LEN).fill(temp),
      glitchUntil: -1,
      glitchValue: 0,
      doorUntil: -1,
      wobble: r * 10,
    };
  }

  on(fn: (e: AlarmEvent) => void) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }
  private emit(e: AlarmEvent) {
    for (const l of this.listeners) l(e);
  }

  get timeLeft() {
    return Math.max(0, this.p.durationSec - this.t);
  }

  setThreshold(v: number) {
    this.threshold = Math.round(Math.max(LIMIT_MIN, Math.min(LIMIT_MAX, v)) * 2) / 2;
  }

  /** Incidents that currently heat or cool this unit. */
  activeOn(u: Unit) {
    return this.incidents.filter((x) => x.active && !x.done && (x.unit === u.id || (x.cause === 'izpad' && x.site === u.site && u.kind === 'fridge')));
  }

  glitching(u: Unit) {
    return this.t < u.glitchUntil;
  }

  update(dt: number) {
    if (this.finished) return;
    this.t += dt;
    const t = this.t;

    for (const x of this.incidents)
      if (!x.active && !x.done && t >= x.start) {
        x.active = true;
        if (x.cause === 'vrata') this.units[x.unit].door = true;
        if (x.cause === 'izpad') for (const u of this.units) if (u.site === x.site && u.kind === 'fridge') u.power = false;
      }
    for (const g of this.glitches)
      if (!g.done && t >= g.at) {
        g.done = true;
        const u = this.units[g.unit];
        if (u.lost || this.activeOn(u).length) continue;
        u.glitchUntil = t + GLITCH_SEC;
        u.glitchValue = 9.2 + (g.at % 1) * 1.5;
      }
    for (const o of this.openings)
      if (!o.done && t >= o.at) {
        o.done = true;
        const u = this.units[o.unit];
        if (!u.lost && !u.door) u.doorUntil = t + OPENING_SEC;
      }

    const speed = this.p.speed ?? 1;
    for (const u of this.units) {
      if (u.lost) continue;
      const active = this.activeOn(u);
      let drift = 0;
      for (const x of active) if (x.cause !== 'senzor') drift += RATE[x.cause] * speed;
      const opening = t < u.doorUntil;
      if (opening) drift += 0.5;
      if (u.kind === 'bag' && active.some((x) => x.cause === 'torba')) u.packs = Math.max(0, u.packs - dt * 0.06);
      if (drift) u.temp += drift * dt;
      else {
        const target = BASE_TEMP + Math.sin(t * 0.3 + u.wobble) * 0.25;
        u.temp += (target - u.temp) * Math.min(1, dt * 0.45);
      }
      u.temp = Math.max(-4, Math.min(22, u.temp));
      u.reading = this.glitching(u) ? u.glitchValue : u.temp;

      const out = u.reading > this.threshold || u.reading < LOW_ALARM;
      if (out && !u.alarm) {
        u.alarm = true;
        this.alarmsRaised++;
        const real = active.length > 0;
        if (!real) this.falseAlarms++;
        this.emit({ type: 'alarm', unit: u, real });
      } else if (!out && u.alarm) {
        u.alarm = false;
        this.emit({ type: 'clear', unit: u });
      }

      const bad = u.temp > SAFE_MAX || u.temp < SAFE_MIN;
      if (bad) {
        if (u.excursion === 0) this.emit({ type: 'excursion', unit: u });
        u.excursion += dt;
        if (u.excursion >= this.spoilSec) {
          u.lost = true;
          u.alarm = false;
          for (const x of active)
            if (x.cause !== 'izpad' || this.units.every((o) => o.site !== x.site || o.kind !== 'fridge' || o.lost)) {
              x.active = false;
              x.done = true;
              x.lost = true;
            }
          this.emit({ type: 'lost', unit: u });
        }
      } else u.excursion = Math.max(0, u.excursion - dt * 2);
    }

    this.histAcc += dt;
    while (this.histAcc >= HIST_STEP) {
      this.histAcc -= HIST_STEP;
      for (const u of this.units) {
        u.history.shift();
        u.history.push(u.reading);
      }
    }

    if (t >= this.p.durationSec) {
      this.finished = true;
      this.emit({ type: 'finished' });
    }
  }

  /** The player's response to a unit. */
  respond(unitId: number, action: AlarmAction): boolean {
    const u = this.units[unitId];
    if (!u || u.lost || this.finished) return false;
    const active = this.activeOn(u);
    const match = active.find((x) => FIX[x.cause] === action);
    if (match) {
      match.active = false;
      match.done = true;
      match.fixedAt = this.t;
      if (match.cause === 'vrata') u.door = false;
      if (match.cause === 'izpad') for (const o of this.units) if (o.site === match.site && o.kind === 'fridge') o.power = true;
      if (match.cause === 'torba') u.packs = 1;
      this.emit({ type: 'fixed', unit: u, incident: match, response: this.t - match.start });
      return true;
    }
    if (!active.length) {
      if (action === 'lazni' && this.t < u.glitchUntil + 2) {
        u.glitchUntil = -1;
        u.reading = u.temp;
        this.emit({ type: 'dismissed', unit: u });
        return true;
      }
      if (action === 'ok') return true;
      this.mistakes++;
      this.emit({ type: 'wrong', unit: u, picked: action, reason: action === 'lazni' ? 'Senzor je v redu.' : 'Nepotreben ukrep: dežurni je šel na pot zaman.' });
      return false;
    }
    this.mistakes++;
    this.emit({
      type: 'wrong',
      unit: u,
      picked: action,
      reason: action === 'ok' || action === 'lazni' ? 'Alarm je bil pravi! Temperatura še vedno raste.' : 'Napačen ukrep. Poglej vrata, napajanje in smer krivulje.',
    });
    return false;
  }

  /** Four answers for the sheet: the right one, the "do nothing" ones and plausible decoys. */
  options(unitId: number): AlarmAction[] {
    const u = this.units[unitId];
    const active = this.activeOn(u);
    const right = active.length ? FIX[active[0].cause] : this.t < u.glitchUntil + 2 ? 'lazni' : 'ok';
    const pool: AlarmAction[] = u.kind === 'bag' ? ['vlozki', 'agregat', 'preseli'] : ['zapri', 'agregat', 'preseli', 'termostat'];
    const set = new Set<AlarmAction>([right]);
    // Rotate decoys by time so the list is not always identical.
    const k = Math.floor(this.t * 7) + unitId;
    for (let i = 0; set.size < 3 && i < pool.length; i++) set.add(pool[(k + i) % pool.length]);
    set.add(right === 'ok' ? 'lazni' : 'ok');
    const order: AlarmAction[] = ['zapri', 'agregat', 'preseli', 'termostat', 'vlozki', 'lazni', 'ok'];
    return [...set].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  }

  get lostUnits() {
    return this.units.filter((u) => u.lost).length;
  }
  get fixed() {
    return this.incidents.filter((x) => x.fixedAt !== undefined);
  }
  /** Incidents still running at the end without being handled. */
  get unresolved() {
    return this.incidents.filter((x) => x.active && !x.done).length;
  }
  /** Average seconds from the start of an incident to the right response. Lost ones count as 20 s. */
  get avgResponse() {
    const done = this.incidents.filter((x) => x.done || x.active);
    if (!done.length) return 0;
    const sum = done.reduce((s, x) => s + (x.fixedAt !== undefined ? x.fixedAt - x.start : 20), 0);
    return sum / done.length;
  }
  get dosesSaved() {
    return this.units.filter((u) => !u.lost).length * DOSES;
  }
  get passed() {
    return this.lostUnits <= (this.p.maxLost ?? 0) && this.unresolved === 0;
  }
}

/** Reference player for balance tests: responds `delay` seconds after the alarm (or the incident start). */
export function autoplayAlarm(p: AlarmParams, opts: { delay?: number; threshold?: number; idle?: boolean } = {}) {
  const sim = new AlarmSim(p);
  if (opts.threshold) sim.setThreshold(opts.threshold);
  const delay = opts.delay ?? 2;
  const seen = new Map<number, number>();
  const dt = 0.05;
  while (!sim.finished) {
    sim.update(dt);
    if (opts.idle) continue;
    for (const x of sim.incidents) {
      if (!x.active || x.done) continue;
      const u = sim.units[x.unit];
      // Notice it when the alarm rings (a sharp player also reads the open door or the dead power).
      const noticed = u.alarm || u.door || !u.power;
      if (noticed && !seen.has(x.id)) seen.set(x.id, sim.t);
      if (seen.has(x.id) && sim.t - seen.get(x.id)! >= delay) sim.respond(x.unit, FIX[x.cause]);
    }
  }
  return sim;
}
