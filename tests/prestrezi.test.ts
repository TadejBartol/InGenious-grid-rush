import { describe, expect, it } from 'vitest';
import { autoplay, H, PrestreziGame, schedule } from '../src/games/prestrezi/logic';
import { LEVELS } from '../src/core/levels';
import type { PrestreziParams } from '../src/core/types';

const stages = LEVELS.flatMap((l) => l.stages.filter((s) => s.kind === 'prestrezi').map((s) => ({ id: l.id, params: s.params as PrestreziParams })));

describe('Prestrezi', () => {
  it('the same seed throws the same round', () => {
    const p = stages[0].params;
    expect(schedule(p)).toEqual(schedule(p));
  });

  it('a cut through a fake catches it, a cut through a real reading costs a heart', () => {
    const game = new PrestreziGame({ durationSec: 30, lives: 3, gap: [1, 1], volley: [2, 2], fake: 0.5, seed: 7 });
    while (game.items.length < 2) game.update(1 / 60);
    for (let i = 0; i < 40; i++) game.update(1 / 60);
    const real = game.items.find((it) => it.kind === 'real');
    const fake = game.items.find((it) => it.kind === 'fake');
    if (fake) {
      game.beginStroke(fake.x - 40, fake.y);
      game.strokeTo(fake.x + 40, fake.y);
      game.endStroke();
      expect(game.caught).toBe(1);
    }
    if (real && game.items.includes(real)) {
      game.beginStroke(real.x, real.y - 40);
      game.strokeTo(real.x, real.y + 40);
      game.endStroke();
      expect(game.mistakes).toBe(1);
      expect(game.lives).toBe(2);
    }
    expect(fake || real).toBeTruthy();
  });

  it('a tap without a swipe cuts nothing', () => {
    const game = new PrestreziGame({ durationSec: 30, lives: 3, gap: [1, 1], volley: [1, 1], fake: 1, seed: 3 });
    while (!game.items.length) game.update(1 / 60);
    for (let i = 0; i < 30; i++) game.update(1 / 60);
    const it = game.items[0];
    game.beginStroke(it.x, it.y);
    game.strokeTo(it.x + 2, it.y);
    expect(game.caught).toBe(0);
  });

  it('fakes that get through cost hearts, an idle player fails every level', () => {
    for (const s of stages) {
      const g = autoplay(s.params, { idle: true });
      expect(g.finished, s.id).toBe('lost');
      expect(g.missed).toBeGreaterThan(0);
    }
  });

  it('a sharp player clears every level without touching a real reading', () => {
    for (const s of stages) {
      const g = autoplay(s.params);
      expect(g.finished, s.id).toBe('won');
      expect(g.mistakes, s.id).toBe(0);
      expect(g.missed, s.id).toBe(0);
      expect(g.caught).toBe(g.fakesTotal);
    }
  });

  it('combo stars are reachable: clusters let one swipe take three or more', () => {
    for (const s of stages) {
      const lvl = LEVELS.find((l) => l.id === s.id)!;
      const goal = lvl.stars.find((x) => x.type === 'metric' && x.key === 'combo');
      if (!goal || goal.type !== 'metric') continue;
      const g = autoplay(s.params);
      expect(g.bestCombo, s.id).toBeGreaterThanOrEqual(goal.value);
    }
  });

  it('a slower player still survives the first level', () => {
    const g = autoplay(stages[0].params, { every: 0.45 });
    expect(g.finished).toBe('won');
  });

  it('everything stays inside the play area', () => {
    for (const s of stages) for (const l of schedule(s.params)) expect(l.vy).toBeLessThan(-Math.sqrt(2 * 600 * (H * 0.4)));
  });
});
