import { describe, expect, it } from 'vitest';
import { LEVELS } from '../src/core/levels';
import type { ToplovodParams } from '../src/core/types';
import { analyse, rotateCw, ToplovodGame, turnsTo } from '../src/games/toplovod/logic';

const stages = LEVELS.flatMap((l) => l.stages.filter((s) => s.kind === 'toplovod').map((s) => ({ id: l.id, params: s.params as ToplovodParams })));

/** Turns every pipe into its planned position, the way a perfect player would. */
function solve(game: ToplovodGame) {
  game.board.tiles.forEach((t, i) => {
    if (t.kind !== 'pipe' || t.locked) return;
    for (let k = turnsTo(t.mask, t.solved); k > 0; k--) game.rotate(i);
  });
}

describe('Toplovod', () => {
  it('region 4 is built on pipes and leaks', () => {
    const kinds = LEVELS.filter((l) => l.region === 4).flatMap((l) => l.stages.map((s) => s.kind));
    expect(kinds).toContain('toplovod');
    expect(kinds).toContain('puscanje');
  });

  it.each(stages)('$id: starts unsolved and the plan heats every building without leaks', ({ params }) => {
    const game = new ToplovodGame(params);
    expect(game.flow.solved).toBe(false);
    const f = analyse({ ...game.board, tiles: game.board.tiles.map((t) => ({ ...t, mask: t.solved })) });
    expect(f.solved).toBe(true);
    expect(f.houses).toBeGreaterThanOrEqual(params.houses[0]);
  });

  it.each(stages)('$id: a perfect player wins in exactly par turns', ({ params }) => {
    const game = new ToplovodGame({ ...params, sabotage: undefined });
    solve(game);
    expect(game.finished).toBe('won');
    expect(game.turns).toBe(game.board.par);
  });

  it('rotation is a quarter turn clockwise', () => {
    expect(rotateCw(1)).toBe(2);
    expect(rotateCw(8)).toBe(1);
    expect(rotateCw(5)).toBe(10);
  });

  it('locked pipes and buildings do not turn', () => {
    const game = new ToplovodGame(stages[0].params);
    const locked = game.board.tiles.findIndex((t) => t.locked);
    expect(game.rotate(locked)).toBe(false);
  });

  it('the boss twists hot pipes over time, and the clock can run out', () => {
    const boss = stages.find((s) => s.params.sabotage)!;
    const game = new ToplovodGame(boss.params);
    for (let i = 0; i < 400 && !game.finished; i++) game.update(0.1);
    expect(game.sabotaged).toBeGreaterThan(0);
    for (let i = 0; i < 3000 && !game.finished; i++) game.update(0.1);
    expect(game.finished).toBe('timeout');
  });
});
