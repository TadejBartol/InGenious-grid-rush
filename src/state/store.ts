import { createStore } from 'zustand/vanilla';
import { useEffect, useReducer, useRef } from 'preact/hooks';
import {
  RESEARCH,
  SKINS,
  checkStars,
  facilityUpgradeCost,
  idleGain,
  idleRate,
  isFacilityLit,
  MAX_FACILITY_LEVEL,
  offlineCapHours,
  regionComplete,
  rewardFor,
  starCount,
  type Reward,
  type StarCheck,
} from '../core/balance';
import { advanceStreak, dailyChips, dateKey } from '../core/daily';
import { FACILITIES, LEVELS, regionById } from '../core/levels';
import type { GameResult, LevelDef } from '../core/types';
import { freshSave, migrate, type SaveData, type Settings } from './save';

export interface LevelOutcome {
  level: LevelDef;
  result: GameResult;
  checks: StarCheck[];
  stars: number;
  prevStars: number;
  reward: Reward;
  newCard: string | null;
  litFacility: string | null;
  regionDone: boolean;
  daily?: { streak: number; usedFreeze: boolean; counted: boolean };
}

export interface GameState extends SaveData {
  ready: boolean;
  offlineGain: { kwh: number; ms: number } | null;
  init(raw: unknown, now: number): void;
  tick(now: number): void;
  dismissOffline(): void;
  completeLevel(level: LevelDef, results: GameResult[], now: number, bonusDp?: number): LevelOutcome;
  buyUpgrade(facilityId: string): boolean;
  buyResearch(id: string): boolean;
  buySkin(id: string): boolean;
  equipSkin(id: string): void;
  unlockRegion(id: number): boolean;
  markTip(id: string): void;
  setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void;
  reset(now: number): void;
}

export function mergeResults(results: GameResult[]): GameResult {
  return {
    kind: results[results.length - 1].kind,
    completed: results.every((r) => r.completed),
    mistakes: results.reduce((s, r) => s + r.mistakes, 0),
    timeLeft: results.reduce((s, r) => s + r.timeLeft, 0),
    timeTotal: results.reduce((s, r) => s + r.timeTotal, 0),
    score: results.reduce((s, r) => s + r.score, 0),
    metrics: Object.assign({}, ...results.map((r) => r.metrics)),
    emoji: results.map((r) => r.emoji).join(' '),
    failHint: results.find((r) => !r.completed)?.failHint,
    notes: results.flatMap((r) => r.notes ?? []),
  };
}

export function saveOf(s: GameState): SaveData {
  const { ready: _r, offlineGain: _o, init: _i, tick: _t, dismissOffline: _d, completeLevel: _c, buyUpgrade: _bu, buyResearch: _br, buySkin: _bs, equipSkin: _e, unlockRegion: _ur, markTip: _m, setSetting: _ss, reset: _re, ...save } = s;
  return save;
}

export const store = createStore<GameState>()((set, get) => ({
  ...freshSave(Date.now()),
  ready: false,
  offlineGain: null,

  init(raw, now) {
    const save = migrate(raw, now);
    const today = dateKey(new Date(now));
    const days = save.stats.days.includes(today) ? save.stats.days : [...save.stats.days, today].slice(-60);
    const rate = idleRate(save.levels, save.upgrades, save.research);
    const elapsed = now - save.lastTick;
    const gain = idleGain(rate, elapsed, offlineCapHours(save.research));
    set({
      ...save,
      kwh: save.kwh + gain,
      lifetimeKwh: save.lifetimeKwh + gain,
      lastTick: now,
      stats: { ...save.stats, sessions: save.stats.sessions + 1, days },
      ready: true,
      offlineGain: gain >= 1 && elapsed > 60_000 ? { kwh: gain, ms: elapsed } : null,
    });
  },

  tick(now) {
    const s = get();
    const rate = idleRate(s.levels, s.upgrades, s.research);
    const elapsed = now - s.lastTick;
    if (elapsed <= 0) return;
    const gain = idleGain(rate, elapsed, offlineCapHours(s.research));
    // Coming back from a long background stint counts as an absence too.
    const offline = elapsed > 120_000 && gain >= 1 ? { kwh: gain + (s.offlineGain?.kwh ?? 0), ms: elapsed } : s.offlineGain;
    set({ kwh: s.kwh + gain, lifetimeKwh: s.lifetimeKwh + gain, lastTick: now, offlineGain: offline });
  },

  dismissOffline() {
    set({ offlineGain: null });
  },

  completeLevel(level, results, now, bonusDp = 0) {
    const s = get();
    const result = mergeResults(results);
    const checks = checkStars(level, result);
    const stars = starCount(checks);
    const isDaily = level.id.startsWith('daily-');
    const prev = s.levels[level.id];
    const prevStars = isDaily ? (s.daily[level.id.slice(6)]?.stars ?? 0) : (prev?.stars ?? 0);
    const reward = rewardFor(level, stars, prevStars, stars > 0 ? bonusDp : 0, s.research.tarifa ?? 0);
    const wasLit = FACILITIES.filter((f) => isFacilityLit(f, s.levels)).map((f) => f.id);
    const levels = isDaily
      ? s.levels
      : { ...s.levels, [level.id]: { stars: Math.max(prevStars, stars), best: Math.max(prev?.best ?? 0, result.score), plays: (prev?.plays ?? 0) + 1 } };
    const nowLit = FACILITIES.filter((f) => isFacilityLit(f, levels)).map((f) => f.id);
    const litFacility = nowLit.find((id) => !wasLit.includes(id)) ?? null;
    const newCard = !isDaily && stars > 0 && !s.cards.includes(level.card.id) ? level.card.id : null;
    const regionDone = !isDaily && level.boss === true && stars > 0 && prevStars === 0 && regionComplete(level.region, levels);
    let chips = reward.chips;
    let streak = s.streak;
    let daily = s.daily;
    let dailyInfo: LevelOutcome['daily'];
    if (isDaily) {
      const key = level.id.slice(6);
      const prevDaily = s.daily[key];
      if (!prevDaily || stars > prevDaily.stars || (stars === prevDaily.stars && result.score > prevDaily.score)) {
        daily = { ...s.daily, [key]: { stars, score: result.score, emoji: result.emoji } };
      }
      if (stars > 0) {
        const up = advanceStreak(s.streak, key);
        streak = up.state;
        if (up.counted) chips += dailyChips(up.state.streak);
        dailyInfo = { streak: up.state.streak, usedFreeze: up.usedFreeze, counted: up.counted };
      }
    }
    // Gold Genko: every level of region 1 at three stars.
    const skinsOwned = [...s.skinsOwned];
    if (!skinsOwned.includes('zlati') && LEVELS.filter((l) => l.region === 1).every((l) => (levels[l.id]?.stars ?? 0) === 3)) skinsOwned.push('zlati');
    set({
      levels,
      daily,
      streak,
      skinsOwned,
      kwh: s.kwh + reward.kwh,
      lifetimeKwh: s.lifetimeKwh + reward.kwh,
      dp: s.dp + reward.dp,
      chips: s.chips + chips,
      cards: newCard ? [...s.cards, newCard] : s.cards,
      stats: { ...s.stats, plays: s.stats.plays + 1 },
      lastTick: Math.max(s.lastTick, Math.min(now, Date.now())),
    });
    return { level, result, checks, stars, prevStars, reward: { ...reward, chips }, newCard, litFacility, regionDone, daily: dailyInfo };
  },

  buyUpgrade(facilityId) {
    const s = get();
    const f = FACILITIES.find((x) => x.id === facilityId);
    if (!f || !isFacilityLit(f, s.levels)) return false;
    const lvl = s.upgrades[f.id] ?? 0;
    if (lvl >= MAX_FACILITY_LEVEL) return false;
    const cost = facilityUpgradeCost(f, lvl);
    if (s.kwh < cost) return false;
    set({ kwh: s.kwh - cost, upgrades: { ...s.upgrades, [f.id]: lvl + 1 } });
    return true;
  },

  buyResearch(id) {
    const s = get();
    const r = RESEARCH.find((x) => x.id === id);
    if (!r || !s.regionsUnlocked.includes(r.region ?? 1)) return false;
    const lvl = s.research[id] ?? 0;
    if (lvl >= r.costs.length || s.dp < r.costs[lvl]) return false;
    set({ dp: s.dp - r.costs[lvl], research: { ...s.research, [id]: lvl + 1 } });
    return true;
  },

  buySkin(id) {
    const s = get();
    const skin = SKINS.find((x) => x.id === id);
    if (!skin || skin.unlock || s.skinsOwned.includes(id) || s.chips < skin.cost) return false;
    set({ chips: s.chips - skin.cost, skinsOwned: [...s.skinsOwned, id], skin: id });
    return true;
  },

  equipSkin(id) {
    if (get().skinsOwned.includes(id)) set({ skin: id });
  },

  unlockRegion(id) {
    const s = get();
    const region = regionById(id);
    if (!region?.available || s.regionsUnlocked.includes(id)) return false;
    if (!regionComplete(id - 1, s.levels) || s.chips < region.unlockChips) return false;
    set({ chips: s.chips - region.unlockChips, regionsUnlocked: [...s.regionsUnlocked, id] });
    return true;
  },

  markTip(id) {
    const s = get();
    if (!s.seenTips.includes(id)) set({ seenTips: [...s.seenTips, id] });
  },

  setSetting(key, value) {
    set({ settings: { ...get().settings, [key]: value } });
  },

  reset(now) {
    set({ ...freshSave(now), ready: true, offlineGain: null });
  },
}));

/** Preact binding: re-renders only when the selected slice changes. */
export function useGame<T>(selector: (s: GameState) => T): T {
  const [, force] = useReducer((x: number) => x + 1, 0);
  const value = selector(store.getState());
  const ref = useRef({ selector, value });
  ref.current = { selector, value };
  useEffect(
    () =>
      store.subscribe((s) => {
        const next = ref.current.selector(s);
        if (!Object.is(next, ref.current.value)) force(0);
      }),
    [],
  );
  return value;
}
