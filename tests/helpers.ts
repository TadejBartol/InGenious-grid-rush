import { PriklopGame, BAUDS, ADDRESS_MAX } from '../src/games/priklop/logic';
import { DetektivGame } from '../src/games/detektiv/logic';
import type { DetektivParams, PriklopParams } from '../src/core/types';

/** Plays a Priklop board perfectly: fix settings first, then draw the known routes. */
export function solvePriklop(params: PriklopParams) {
  const game = new PriklopGame(params);
  const { meters, ports } = game.puzzle;
  const used = new Set<number>();
  for (const m of meters) {
    let address = m.address;
    if (used.has(address)) address = [...Array(ADDRESS_MAX).keys()].map((n) => n + 1).find((a) => !used.has(a) && !meters.some((o) => o.id !== m.id && o.address === a))!;
    used.add(address);
    game.configure(m.id, address, ports[m.port].baud);
  }
  game.puzzle.solution.forEach((route) => {
    game.startDrag(route[0].x, route[0].y);
    for (const c of route.slice(1)) game.dragTo(c.x, c.y);
    game.endDrag();
  });
  return game;
}

export function perfectDetektiv(params: DetektivParams) {
  const game = new DetektivGame(params);
  while (!game.finished) {
    game.update(0.1);
    for (const a of game.data.anomalies) {
      if (!a.found && !a.missed && game.cursor >= a.start + a.len) game.tap(a.start + a.len / 2);
    }
  }
  return game;
}

export { BAUDS };
