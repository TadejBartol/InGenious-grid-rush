import { hashString } from './rng';
import type { LevelDef, Stage } from './types';

/** Local calendar date as YYYY-MM-DD; the daily puzzle changes at local midnight. */
export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(key: string, delta: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d + delta, 12);
  return dateKey(date);
}

/** ISO week id, used to grant one streak freeze per week. */
export function weekKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export interface StreakState {
  streak: number;
  best: number;
  lastDate?: string;
  freezeWeek?: string;
}

export interface StreakUpdate {
  state: StreakState;
  usedFreeze: boolean;
  /** True when this is the first completed daily of the day. */
  counted: boolean;
}

/** Advances the streak when a daily challenge is completed on `today`. */
export function advanceStreak(prev: StreakState, today: string): StreakUpdate {
  if (prev.lastDate === today) return { state: prev, usedFreeze: false, counted: false };
  let streak = 1;
  let usedFreeze = false;
  let freezeWeek = prev.freezeWeek;
  if (prev.lastDate === addDays(today, -1)) streak = prev.streak + 1;
  else if (prev.lastDate === addDays(today, -2) && prev.freezeWeek !== weekKey(today)) {
    // One missed day per week is forgiven.
    streak = prev.streak + 1;
    usedFreeze = true;
    freezeWeek = weekKey(today);
  }
  return { state: { streak, best: Math.max(prev.best, streak), lastDate: today, freezeWeek }, usedFreeze, counted: true };
}

/** Streak shown on the home screen: drops to zero once it can no longer be saved. */
export function liveStreak(s: StreakState, today: string): number {
  if (!s.lastDate) return 0;
  if (s.lastDate === today || s.lastDate === addDays(today, -1)) return s.streak;
  if (s.lastDate === addDays(today, -2) && s.freezeWeek !== weekKey(today)) return s.streak;
  return 0;
}

export function dailyChips(streak: number) {
  return 1 + (streak > 0 && streak % 7 === 0 ? 2 : 0);
}

const DAY_FIRST = Date.UTC(2026, 9, 1);

/** Challenge number, like Wordle's, so shared results are comparable. */
export function dailyNumber(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - DAY_FIRST) / 86400000) + 1;
}

/** Same hand-tuned challenge for everyone on a given date. */
export function dailyLevel(key: string, detektivUnlocked: boolean): LevelDef {
  const seed = hashString(`daily:${key}`);
  const n = dailyNumber(key);
  const kinds: Stage['kind'][] = detektivUnlocked ? ['konica', 'priklop', 'detektiv'] : ['konica', 'priklop'];
  const kind = kinds[n % kinds.length];
  const variant = seed % 3;
  let stage: Stage;
  let stars: LevelDef['stars'];
  if (kind === 'priklop') {
    stage = {
      kind,
      params: { cols: 6, rows: 6, meters: 4 + variant, timeSec: 100, conflicts: 1 + (variant > 0 ? 1 : 0), dropouts: variant === 2 ? [45] : [], seed },
    };
    stars = [{ type: 'complete' }, { type: 'timeLeft', min: 25 }, { type: 'mistakes', max: 0 }];
  } else if (kind === 'konica') {
    const limit = [640, 690, 720][variant];
    stage = {
      kind,
      params: {
        durationSec: 70,
        limitKw: limit,
        tolerance: 0.05,
        baseKw: 250 + variant * 30,
        baseNoise: 0.05,
        baseSteps: [{ t: 30, kw: 40 }],
        consumers: [
          { id: 'linija1', name: 'Linija 1', icon: 'linija', kw: 80, critical: true },
          { id: 'komp1', name: 'Kompresor 1', icon: 'kompresor', kw: 95, bufferLabel: 'Tlak zraka', drain: 1 / 11, fill: 1 / 9 },
          { id: 'komp2', name: 'Kompresor 2', icon: 'kompresor', kw: 95, bufferLabel: 'Tlak zraka', drain: 1 / 10, fill: 1 / 9 },
          { id: 'pec', name: 'Indukcijska peč', icon: 'pec', kw: 150, bufferLabel: 'Temperatura taline', drain: 1 / 15, fill: 1 / 11 },
          ...(variant > 0 ? [{ id: 'klima', name: 'Prezračevanje hale', icon: 'klima', kw: 70, bufferLabel: 'Kakovost zraka', drain: 1 / 18, fill: 1 / 10 }] : []),
        ],
        inrush: 1.4,
        seed,
      },
    };
    stars = [{ type: 'complete' }, { type: 'metric', key: 'peak', op: '<=', value: limit, unit: 'kW', label: `Konica ≤ ${limit} kW` }, { type: 'mistakes', max: 0, label: 'Brez zastoja proizvodnje' }];
  } else {
    stage = { kind: 'detektiv', params: { durationSec: 60, profile: (['livarna', 'mlekarna', 'trafo'] as const)[variant], anomalies: 4 + variant, kinds: ['nocna', 'konica', 'zrak', 'prazniTek', 'hladilnik'], noise: 0.05, decoys: 2, scale: 0.75, seed } };
    stars = [{ type: 'complete' }, { type: 'metric', key: 'missed', op: '<=', value: 0, unit: '', label: 'Najdi vse anomalije' }, { type: 'mistakes', max: 0 }];
  }
  return {
    id: `daily-${key}`,
    region: 0,
    index: n,
    name: `Dnevni izziv #${n}`,
    facilityId: 'daily',
    intro: 'Isti problem za vse igralce danes. Pokaži, kdo ima najboljši občutek za podatke.',
    lesson: 'Rezultat lahko deliš kot emoji graf. Brez spojlerjev, obljubim.',
    stages: [stage],
    stars,
    reward: { kwh: 300, dp: 60 },
    card: { id: 'daily', name: '', rarity: 'navadna', text: '' },
  };
}
