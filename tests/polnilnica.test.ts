import { describe, expect, it } from 'vitest';
import { LEVELS } from '../src/core/levels';
import type { PolnilnicaParams } from '../src/core/types';
import BOARDS from '../src/games/polnilnica/boards.json';
import { applyMove, isWon, legalMoves, plugProblem, PolnilnicaGame, solve } from '../src/games/polnilnica/logic';

const stages = LEVELS.flatMap((l) => l.stages.filter((s) => s.kind === 'polnilnica').map((s) => ({ id: l.id, params: s.params as PolnilnicaParams })));

describe('Polnilnica', () => {
  it('region 7 is the charging park', () => {
    expect(LEVELS.filter((l) => l.region === 7)).toHaveLength(10);
    expect(stages.length).toBeGreaterThanOrEqual(7);
  });

  it.each(stages)('$id: ships a precomputed board', ({ params }) => {
    expect((BOARDS as Record<string, unknown>)[params.seed]).toBeTruthy();
  });

  it.each(stages)('$id: the shortest solution matches par and wins', ({ params }) => {
    const game = new PolnilnicaGame(params);
    const path = solve(game.lot, game.state, 400000)!;
    expect(path).not.toBeNull();
    expect(path.length).toBe(game.par);
    expect(game.par).toBeGreaterThanOrEqual(params.minMoves[0] - 3);
    for (const m of path) expect(game.play(m)).toBe(true);
    expect(game.finished).toBe(true);
  });

  it('battery, busy chargers and the power limit all block a plug', () => {
    const s = stages.find((x) => x.params.limitKw)!;
    const game = new PolnilnicaGame(s.params);
    const ev = game.lot.vehicles.findIndex((v) => v.type === 'ev');
    const st = { ...game.state, battery: game.state.battery.map(() => 0) };
    expect(plugProblem(game.lot, st, ev, 0)).toBe('battery');
    const busy = { ...game.state, busy: game.lot.chargers.map((_, i) => (i === 0 ? 5 : 0)) };
    expect(plugProblem(game.lot, busy, ev, 0)).toBe('busy');
    const big = game.lot.chargers.findIndex((c) => c.kw >= 150);
    const other = game.lot.chargers.findIndex((_, i) => i !== big);
    const full = { ...game.state, busy: game.lot.chargers.map((_, i) => (i === other ? 5 : 0)) };
    if (game.lot.chargers[big].kw + game.lot.chargers[other].kw > game.lot.limitKw) expect(plugProblem(game.lot, full, ev, big)).toBe('limit');
  });

  it('undo restores the previous state and a hint is a legal move', () => {
    const game = new PolnilnicaGame(stages[2].params);
    const m = game.hint()!;
    expect(legalMoves(game.lot, game.state).some((x) => x.vehicle === m.vehicle && x.to === m.to)).toBe(true);
    const before = game.state;
    game.play(m);
    expect(game.undo()).toBe(true);
    expect(game.state).toBe(before);
    expect(game.hints).toBe(1);
  });

  it('the dark car moves by itself on the boss board', () => {
    const s = stages.find((x) => x.params.darkEvery)!;
    const game = new PolnilnicaGame(s.params);
    const dark = game.lot.vehicles.findIndex((v) => v.type === 'dark');
    let st = game.state;
    const seen = new Set([st.pos[dark]]);
    for (let k = 0; k < 12 && !isWon(game.lot, st); k++) {
      const moves = legalMoves(game.lot, st).filter((m) => m.charger === undefined && game.lot.vehicles[m.vehicle].type !== 'ev');
      if (!moves.length) break;
      st = applyMove(game.lot, st, moves[k % moves.length]);
      seen.add(st.pos[dark]);
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});
