import type { StreakState } from '../core/daily';

export const SAVE_VERSION = 1;

export interface LevelProgress {
  stars: number;
  best: number;
  plays: number;
}

export interface Settings {
  sound: boolean;
  music: boolean;
  haptics: boolean;
  reducedMotion: boolean;
}

export interface SaveData {
  version: number;
  createdAt: number;
  /** Last time idle savings were credited. */
  lastTick: number;
  kwh: number;
  dp: number;
  chips: number;
  lifetimeKwh: number;
  levels: Record<string, LevelProgress>;
  upgrades: Record<string, number>;
  research: Record<string, number>;
  regionsUnlocked: number[];
  skin: string;
  skinsOwned: string[];
  cards: string[];
  seenTips: string[];
  streak: StreakState;
  daily: Record<string, { stars: number; score: number; emoji: string }>;
  settings: Settings;
  stats: { sessions: number; plays: number; days: string[] };
}

export function freshSave(now: number): SaveData {
  return {
    version: SAVE_VERSION,
    createdAt: now,
    lastTick: now,
    kwh: 0,
    dp: 0,
    chips: 0,
    lifetimeKwh: 0,
    levels: {},
    upgrades: {},
    research: {},
    regionsUnlocked: [1],
    skin: 'klasicen',
    skinsOwned: ['klasicen'],
    cards: [],
    seenTips: [],
    streak: { streak: 0, best: 0 },
    daily: {},
    settings: { sound: true, music: true, haptics: true, reducedMotion: false },
    stats: { sessions: 0, plays: 0, days: [] },
  };
}

/** Accepts any stored blob and returns a valid, current save. Unknown or broken data falls back to defaults field by field. */
export function migrate(raw: unknown, now: number): SaveData {
  const base = freshSave(now);
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<SaveData>;
  const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  const obj = <T>(v: unknown, d: T): T => (v && typeof v === 'object' && !Array.isArray(v) ? (v as T) : d);
  const arr = <T>(v: unknown, d: T[]): T[] => (Array.isArray(v) ? (v as T[]) : d);
  return {
    version: SAVE_VERSION,
    createdAt: num(r.createdAt, now),
    lastTick: Math.min(num(r.lastTick, now), now),
    kwh: Math.max(0, num(r.kwh, 0)),
    dp: Math.max(0, num(r.dp, 0)),
    chips: Math.max(0, num(r.chips, 0)),
    lifetimeKwh: Math.max(0, num(r.lifetimeKwh, 0)),
    levels: obj(r.levels, {}),
    upgrades: obj(r.upgrades, {}),
    research: obj(r.research, {}),
    regionsUnlocked: arr(r.regionsUnlocked, [1]).includes(1) ? arr(r.regionsUnlocked, [1]) : [1, ...arr<number>(r.regionsUnlocked, [])],
    skin: typeof r.skin === 'string' ? r.skin : base.skin,
    skinsOwned: arr(r.skinsOwned, base.skinsOwned),
    cards: arr(r.cards, []),
    seenTips: arr(r.seenTips, []),
    streak: { ...base.streak, ...obj(r.streak, {}) },
    daily: obj(r.daily, {}),
    settings: { ...base.settings, ...obj(r.settings, {}) },
    stats: { ...base.stats, ...obj(r.stats, {}) },
  };
}
