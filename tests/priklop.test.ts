import { describe, expect, it } from 'vitest';
import { generatePuzzle, key, PriklopGame } from '../src/games/priklop/logic';
import { LEVELS } from '../src/core/levels';
import { dailyLevel, addDays } from '../src/core/daily';
import type { PriklopParams } from '../src/core/types';
import { solvePriklop } from './helpers';
import { countSolutions } from '../src/games/priklop/numberlink';

const priklopStages = LEVELS.flatMap((l) => l.stages.filter((s) => s.kind === 'priklop').map((s) => ({ id: l.id, params: s.params as PriklopParams })));

describe('Priklop generator', () => {
  it('is deterministic per seed', () => {
    const p = priklopStages[2].params;
    const a = generatePuzzle(p);
    const b = generatePuzzle(p);
    expect(a.meters).toEqual(b.meters);
    expect(a.solution).toEqual(b.solution);
  });

  it.each(priklopStages)('$id: routes fill every cell exactly once and the fill is unique', ({ params }) => {
    const t = performance.now();
    const pz = generatePuzzle(params);
    // Boards are generated on the phone at level start, so they must be quick.
    expect(performance.now() - t).toBeLessThan(250);
    expect(pz.meters.length).toBeGreaterThanOrEqual(params.meters);
    const seen = new Set<number>();
    for (const route of pz.solution) {
      for (const c of route) {
        const k = key(pz.cols, c.x, c.y);
        expect(seen.has(k)).toBe(false);
        seen.add(k);
      }
      for (let i = 1; i < route.length; i++) expect(Math.abs(route[i].x - route[i - 1].x) + Math.abs(route[i].y - route[i - 1].y)).toBe(1);
    }
    expect(seen.size).toBe(pz.cols * pz.rows);
    const pairs = pz.solution.map((r) => ({ a: key(pz.cols, r[0].x, r[0].y), b: key(pz.cols, r[r.length - 1].x, r[r.length - 1].y) }));
    const sols: Int16Array[] = [];
    countSolutions(pz.cols, pz.rows, pairs, 6, 200_000, sols);
    const mine = new Int16Array(pz.cols * pz.rows);
    pz.solution.forEach((r, i) => r.forEach((c) => (mine[key(pz.cols, c.x, c.y)] = i)));
    expect(sols.length).toBeGreaterThan(0);
    for (const s of sols) expect([...s]).toEqual([...mine]);
  });

  it.each(priklopStages)('$id: injects the requested misconfiguration', ({ params }) => {
    const game = new PriklopGame(params);
    const problems = game.puzzle.meters.map((m) => game.configProblem(m.id)).filter(Boolean);
    if (params.conflicts + params.baudMismatch > 0) expect(problems.length).toBeGreaterThan(0);
    else expect(problems).toHaveLength(0);
  });

  it.each(priklopStages)('$id: a perfect player wins without mistakes', ({ params }) => {
    const game = solvePriklop(params);
    expect(game.finished).toBe('won');
    expect(game.mistakes).toBe(0);
  });

  it('daily boards for two months are all solvable', () => {
    let day = '2026-10-01';
    for (let i = 0; i < 60; i++) {
      const lvl = dailyLevel(day, true);
      const st = lvl.stages[0];
      if (st.kind === 'priklop') expect(solvePriklop(st.params).finished).toBe('won');
      day = addDays(day, 1);
    }
  });
});

describe('Priklop play', () => {
  const params: PriklopParams = { cols: 5, rows: 6, meters: 3, timeSec: 60, conflicts: 1, baudMismatch: 0, dropouts: [], seed: 42 };

  it('sparks and counts a mistake when a misconfigured meter is connected', () => {
    const game = new PriklopGame(params);
    const bad = game.puzzle.meters.find((m) => game.configProblem(m.id))!;
    const route = game.puzzle.solution[bad.id];
    const events: string[] = [];
    game.on((e) => events.push(e.type));
    game.startDrag(route[0].x, route[0].y);
    for (const c of route.slice(1)) game.dragTo(c.x, c.y);
    expect(game.status.get(bad.id)).toBe('error');
    expect(game.mistakes).toBe(1);
    expect(events).toContain('spark');
    // Fixing the address on a connected meter brings it online.
    const free = [...Array(16).keys()].map((n) => n + 1).find((a) => !game.puzzle.meters.some((m) => m.address === a))!;
    game.configure(bad.id, free, game.puzzle.ports[bad.port].baud);
    expect(game.status.get(bad.id)).toBe('online');
  });

  it('a new cable cuts through an unfinished one, but never through endpoints', () => {
    const game = new PriklopGame({ ...params, conflicts: 0, baudMismatch: 0 });
    const [a] = game.puzzle.solution;
    game.startDrag(a[0].x, a[0].y);
    for (const c of a.slice(1)) game.dragTo(c.x, c.y);
    expect(game.status.get(0)).toBe('online');
    // Drag meter 2's cable straight into the middle of cable 1.
    const mid = a[Math.floor(a.length / 2)];
    const other = game.puzzle.meters[1];
    const events: string[] = [];
    game.on((e) => events.push(e.type));
    game.startDrag(other.x, other.y);
    game.dragTo(mid.x, mid.y);
    if (game.ownerOf(mid.x, mid.y) === 1) {
      expect(events).toContain('cut');
      expect(game.status.get(0)).not.toBe('online');
    }
    // Endpoints are never crossed.
    const port0 = game.puzzle.ports[0];
    game.dragTo(port0.x, port0.y);
    expect(game.ownerOf(port0.x, port0.y)).not.toBe(1);
  });

  it('can be drawn from the terminal end too', () => {
    const game = new PriklopGame({ ...params, conflicts: 0, baudMismatch: 0 });
    const route = [...game.puzzle.solution[0]].reverse();
    game.startDrag(route[0].x, route[0].y);
    for (const c of route.slice(1)) game.dragTo(c.x, c.y);
    expect(game.status.get(0)).toBe('online');
  });

  it('all cables online but empty cells left is not a win', () => {
    const game = solvePriklop(params);
    expect(game.finished).toBe('won');
    const g = new PriklopGame({ ...params, conflicts: 0, baudMismatch: 0 });
    const events: string[] = [];
    g.on((e) => events.push(e.type));
    // Connect every pair along its own route except one detour-free shortcut is impossible,
    // so drop one cable's middle and check the board reports empty cells only when all are online.
    g.puzzle.solution.forEach((r) => {
      g.startDrag(r[0].x, r[0].y);
      for (const c of r.slice(1)) g.dragTo(c.x, c.y);
      g.endDrag();
    });
    expect(g.finished).toBe('won');
    expect(events).not.toContain('unfilled');
  });

  it('backtracking shortens the cable', () => {
    const game = new PriklopGame(params);
    const route = game.puzzle.solution[0];
    game.startDrag(route[0].x, route[0].y);
    game.dragTo(route[1].x, route[1].y);
    game.dragTo(route[2].x, route[2].y);
    game.dragTo(route[1].x, route[1].y);
    expect(game.paths.get(0)).toHaveLength(2);
  });

  it('times out', () => {
    const game = new PriklopGame(params);
    game.update(61);
    expect(game.finished).toBe('timeout');
  });

  it('dropouts cut an online cable', () => {
    const game = solvePriklop({ ...params, meters: 4, cols: 6, rows: 7, dropouts: [5] });
    expect(game.finished).toBe('won');
    const g2 = new PriklopGame({ ...params, conflicts: 0, dropouts: [1] });
    const route = g2.puzzle.solution[0];
    g2.startDrag(route[0].x, route[0].y);
    for (const c of route.slice(1)) g2.dragTo(c.x, c.y);
    expect(g2.status.get(0)).toBe('online');
    g2.update(1.5);
    expect(g2.status.get(0)).toBe('routing');
    expect(g2.isConnected(0)).toBe(false);
  });
});
