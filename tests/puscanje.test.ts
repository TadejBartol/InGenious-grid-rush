import { describe, expect, it } from 'vitest';
import { LEVELS } from '../src/core/levels';
import type { PuscanjeParams } from '../src/core/types';
import { deduce, PuscanjeGame, solvable } from '../src/games/puscanje/logic';

const stages = LEVELS.flatMap((l) => l.stages.filter((s) => s.kind === 'puscanje').map((s) => ({ id: l.id, params: s.params as PuscanjeParams })));

/** Plays by logic only, like a careful player: never a guess, never a mistake. */
function playLogically(game: PuscanjeGame) {
  for (let i = 0; i < 1000 && !game.finished; i++) {
    const { safe, leaks } = deduce(game.field, game.state);
    if (!safe.size && !leaks.size) break;
    safe.forEach((c) => game.inspect(c));
    leaks.forEach((c) => game.close(c));
  }
}

describe('Lov na puščanje', () => {
  it.each(stages)('$id: has the requested leaks and solves without guessing', ({ params }) => {
    const game = new PuscanjeGame(params);
    expect(game.leaksTotal).toBe(params.leaks);
    expect(solvable(game.field)).toBe(true);
    playLogically(game);
    expect(game.finished).toBe('won');
    expect(game.mistakes).toBe(0);
  });

  it('digging into a leak or closing a sound pipe is a mistake', () => {
    const game = new PuscanjeGame(stages[0].params);
    const leak = game.field.leak.findIndex((l, k) => l && game.state[k] === 'hidden');
    game.inspect(leak);
    expect(game.mistakes).toBe(1);
    expect(game.state[leak]).toBe('burst');
    const sound = game.field.leak.findIndex((l, k) => !l && game.state[k] === 'hidden');
    game.close(sound);
    expect(game.mistakes).toBe(2);
    expect(game.state[sound]).toBe('open');
  });

  it('the thermal camera opens a safe section', () => {
    const game = new PuscanjeGame(stages[0].params);
    const cell = game.useCamera();
    expect(cell).not.toBeNull();
    expect(game.field.leak[cell!]).toBe(false);
    expect(game.camera).toBe((stages[0].params.camera ?? 0) - 1);
  });
});
