import { describe, expect, it } from 'vitest';
import { LEVELS } from '../src/core/levels';
import type { UrnikParams } from '../src/core/types';
import { checkPlan, generateDay, UrnikGame } from '../src/games/urnik/logic';

const stages = LEVELS.flatMap((l) => l.stages.filter((s) => s.kind === 'urnik').map((s) => ({ id: l.id, params: s.params as UrnikParams })));

/** Every plan, for small days: the solver must agree with brute force. */
function bruteBest(day: ReturnType<typeof generateDay>) {
  const n = day.blocks * day.units;
  let best = -Infinity;
  for (let mask = 0; mask < 1 << n; mask++) {
    const plan = Array.from({ length: day.units }, (_, u) => Array.from({ length: day.blocks }, (_, i) => (mask >> (u * day.blocks + i)) & 1));
    if (plan.some((row, u) => row.some((v, i) => v && day.locked[u][i]))) continue;
    const c = checkPlan(day, plan);
    if (c.valid) best = Math.max(best, c.profit);
  }
  return best;
}

describe('Vozni red', () => {
  it('replaces the old cogeneration game in region 4', () => {
    expect(stages.filter((s) => s.id.startsWith('r4-')).length).toBeGreaterThanOrEqual(6);
  });

  it.each(stages)('$id: the best plan is valid, passes and matches its profit', ({ params }) => {
    const day = generateDay(params);
    const c = checkPlan(day, day.bestPlan);
    expect(c.valid).toBe(true);
    expect(c.profit).toBe(day.best);
    expect(day.pass).toBeLessThanOrEqual(day.best);
    expect(day.pass).toBeGreaterThan(0);
  });

  it.each(stages)('$id: doing nothing or running all day is never enough', ({ params }) => {
    const day = generateDay(params);
    const idle = checkPlan(
      day,
      day.bestPlan.map((r) => r.map(() => 0)),
    );
    const all = checkPlan(
      day,
      day.bestPlan.map((r, u) => r.map((_, i) => (day.locked[u][i] ? 0 : 1))),
    );
    expect(idle.valid && idle.profit >= day.pass).toBe(false);
    expect(all.valid && all.profit >= day.pass).toBe(false);
  });

  it.each(stages.filter((s) => (s.params.units ?? 1) === 1))('$id: the solver finds the true optimum', ({ params }) => {
    const day = generateDay(params);
    expect(bruteBest(day)).toBe(day.best);
  });

  it('flags cold radiators and an overflowing tank', () => {
    const day = generateDay(stages[0].params);
    const idle = checkPlan(day, [day.margin.map(() => 0)]);
    expect(idle.cold.length).toBeGreaterThan(0);
    const all = checkPlan(day, [day.margin.map(() => 1)]);
    expect(all.overflow.length).toBeGreaterThan(0);
  });

  it('plays a whole day: plan, submit, replay, finish', () => {
    const game = new UrnikGame(stages[1].params);
    expect(game.submit()).toBe(false);
    game.day.bestPlan[0].forEach((on, i) => on && game.toggle(0, i));
    expect(game.check.valid).toBe(true);
    expect(game.submit()).toBe(true);
    for (let i = 0; i < 100 && !game.finished; i++) game.update(0.1);
    expect(game.finished).toBe(true);
    expect(game.passed).toBe(true);
  });

  it('runs out of time with whatever plan is on the board', () => {
    const game = new UrnikGame(stages[1].params);
    for (let i = 0; i < 4000 && !game.finished; i++) game.update(0.1);
    expect(game.submitted).toBe(true);
    expect(game.passed).toBe(false);
  });

  it('service blocks cannot be switched on', () => {
    const s = stages.find((x) => x.params.service)!;
    const game = new UrnikGame(s.params);
    const u = game.day.locked.findIndex((r) => r.some(Boolean));
    const i = game.day.locked[u].indexOf(true);
    expect(game.toggle(u, i)).toBe(false);
  });
});
