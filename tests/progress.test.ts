import { beforeEach, describe, expect, it } from 'vitest';
import { checkStars, idleGain, idleRate, rewardFor, isLevelUnlocked, RESEARCH } from '../src/core/balance';
import { advanceStreak, liveStreak, dailyLevel, dateKey, weekKey } from '../src/core/daily';
import { LEVELS, levelById } from '../src/core/levels';
import { freshSave, migrate } from '../src/state/save';
import { store } from '../src/state/store';
import type { GameResult } from '../src/core/types';

const win = (over: Partial<GameResult> = {}): GameResult => ({ kind: 'priklop', completed: true, mistakes: 0, timeLeft: 50, timeTotal: 75, score: 500, metrics: {}, emoji: '', ...over });

describe('stars', () => {
  it('gives near-miss hints', () => {
    const lvl = levelById('r1-3')!;
    const checks = checkStars(lvl, win({ kind: 'konica', metrics: { peak: 472.4 }, mistakes: 1 }));
    expect(checks.map((c) => c.met)).toEqual([true, false, false]);
    expect(checks[1].nearMiss).toBe('še 3 kW');
    expect(checks[2].nearMiss).toBe('1 napaka preveč');
    expect(checks[2].label).toBe('Brez zastoja proizvodnje');
  });

  it('no stars when not completed, with a fail hint on the first goal', () => {
    const checks = checkStars(levelById('r1-1')!, win({ completed: false, failHint: 'še 1 merilnik' }));
    expect(checks.every((c) => !c.met)).toBe(true);
    expect(checks[0].nearMiss).toBe('še 1 merilnik');
  });
});

describe('economy', () => {
  it('replays pay less than first clears', () => {
    const lvl = levelById('r1-1')!;
    expect(rewardFor(lvl, 3, 0).kwh).toBeGreaterThan(rewardFor(lvl, 3, 3).kwh * 2);
    expect(rewardFor(lvl, 3, 0).chips).toBe(1);
    expect(rewardFor(lvl, 3, 3).chips).toBe(0);
    expect(rewardFor(levelById('r1-10')!, 1, 0).chips).toBe(3);
  });

  it('idle only runs for lit facilities and is capped', () => {
    expect(idleRate({}, {}, {})).toBe(0);
    const levels = { 'r1-1': { stars: 1 }, 'r1-2': { stars: 2 }, 'r1-3': { stars: 1 } };
    const rate = idleRate(levels, {}, {});
    expect(rate).toBeGreaterThan(0);
    expect(idleGain(rate, 100 * 3_600_000, 8)).toBeCloseTo(rate * 8);
  });

  it('levels unlock in order', () => {
    const l2 = levelById('r1-2')!;
    expect(isLevelUnlocked(l2, {}, [1])).toBe(false);
    expect(isLevelUnlocked(l2, { 'r1-1': { stars: 1 } }, [1])).toBe(true);
    expect(isLevelUnlocked(levelById('r2-1')!, {}, [1])).toBe(false);
  });

  it('every level has a unique id and card', () => {
    expect(new Set(LEVELS.map((l) => l.id)).size).toBe(LEVELS.length);
    expect(new Set(LEVELS.map((l) => l.card.id)).size).toBe(LEVELS.length);
  });
});

describe('streak', () => {
  it('counts consecutive days, forgives one gap per week', () => {
    let s = advanceStreak({ streak: 0, best: 0 }, '2026-10-19').state;
    s = advanceStreak(s, '2026-10-20').state;
    expect(s.streak).toBe(2);
    const gap = advanceStreak(s, '2026-10-22');
    expect(gap.usedFreeze).toBe(true);
    expect(gap.state.streak).toBe(3);
    const gap2 = advanceStreak(gap.state, '2026-10-24');
    expect(gap2.usedFreeze).toBe(false);
    expect(gap2.state.streak).toBe(1);
    expect(gap2.state.best).toBe(3);
  });

  it('same day does not double count', () => {
    const s = advanceStreak({ streak: 3, best: 3, lastDate: '2026-10-24' }, '2026-10-24');
    expect(s.counted).toBe(false);
  });

  it('live streak expires', () => {
    expect(liveStreak({ streak: 5, best: 5, lastDate: '2026-10-20' }, '2026-10-24')).toBe(0);
    expect(liveStreak({ streak: 5, best: 5, lastDate: '2026-10-23' }, '2026-10-24')).toBe(5);
  });

  it('week keys and dates', () => {
    expect(weekKey('2026-10-24')).toBe('2026-W43');
    expect(dateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(dailyLevel('2026-10-24', true)).toEqual(dailyLevel('2026-10-24', true));
  });
});

describe('save', () => {
  it('migrates garbage to a valid save', () => {
    const s = migrate({ kwh: 'lots', levels: [], settings: { sound: false }, regionsUnlocked: [2] }, 1000);
    expect(s.kwh).toBe(0);
    expect(s.levels).toEqual({});
    expect(s.settings.sound).toBe(false);
    expect(s.settings.music).toBe(true);
    expect(s.regionsUnlocked).toEqual([1, 2]);
    expect(migrate(null, 5)).toEqual(freshSave(5));
  });

  it('never credits time from the future', () => {
    const s = migrate({ lastTick: 10_000 }, 5_000);
    expect(s.lastTick).toBe(5_000);
  });
});

describe('store', () => {
  beforeEach(() => store.getState().reset(0));

  it('completing levels lights a facility and starts idle', () => {
    const st = store.getState();
    st.completeLevel(levelById('r1-1')!, [win()], 0);
    st.completeLevel(levelById('r1-2')!, [win()], 0);
    const out = store.getState().completeLevel(levelById('r1-3')!, [win({ kind: 'konica', metrics: { peak: 400 } })], 0);
    expect(out.litFacility).toBe('livarna');
    expect(out.stars).toBe(3);
    const before = store.getState().kwh;
    store.getState().tick(3_600_000);
    expect(store.getState().kwh - before).toBeCloseTo(36, 0);
  });

  it('offline gain is reported on init', () => {
    store.getState().init({ ...freshSave(0), levels: { 'r1-1': { stars: 1 }, 'r1-2': { stars: 1 }, 'r1-3': { stars: 1 } } }, 2 * 3_600_000);
    expect(store.getState().offlineGain?.kwh).toBeCloseTo(72, 0);
  });

  it('upgrades cost kWh and raise the rate', () => {
    store.getState().init({ ...freshSave(0), kwh: 1000, levels: { 'r1-1': { stars: 1 }, 'r1-2': { stars: 1 }, 'r1-3': { stars: 1 } } }, 0);
    expect(store.getState().buyUpgrade('livarna')).toBe(true);
    expect(store.getState().kwh).toBe(760);
    expect(store.getState().buyUpgrade('peskanje')).toBe(false);
  });

  it('later lab nodes wait for their region', () => {
    store.getState().init({ ...freshSave(0), dp: 5000 }, 0);
    expect(store.getState().buyResearch('napoved')).toBe(false);
    expect(store.getState().buyResearch('vzorcenje')).toBe(true);
    store.getState().init({ ...freshSave(0), dp: 5000, regionsUnlocked: [1, 2] }, 0);
    expect(store.getState().buyResearch('napoved')).toBe(true);
  });

  it('two three-starred regions pay for a good part of their lab, never all of it', () => {
    const dp = LEVELS.filter((l) => l.region <= 2).reduce((s, l) => s + rewardFor(l, 3, 0).dp, 0);
    const lab = RESEARCH.filter((r) => (r.region ?? 1) <= 2).reduce((s, r) => s + r.costs.reduce((a, b) => a + b, 0), 0);
    expect(dp).toBeGreaterThan(lab * 0.12);
    expect(dp).toBeLessThan(lab * 0.4);
  });

  it('the whole campaign pays for nearly the whole lab; daily challenges finish it', () => {
    const dp = LEVELS.reduce((s, l) => s + rewardFor(l, 3, 0).dp, 0);
    const lab = RESEARCH.reduce((s, r) => s + r.costs.reduce((a, b) => a + b, 0), 0);
    expect(dp).toBeGreaterThan(lab * 0.9);
    expect(dp).toBeLessThan(lab * 1.3);
  });

  it('daily challenge grows the streak once per day', () => {
    const lvl = dailyLevel('2026-10-24', false);
    const a = store.getState().completeLevel(lvl, [win({ kind: lvl.stages[0].kind })], 0);
    expect(a.daily?.streak).toBe(1);
    expect(a.reward.chips).toBeGreaterThanOrEqual(1);
    const b = store.getState().completeLevel(lvl, [win({ kind: lvl.stages[0].kind })], 0);
    expect(b.daily?.counted).toBe(false);
  });
});
