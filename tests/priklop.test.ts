import { describe, expect, it } from 'vitest';
import { generatePuzzle, key, PriklopGame } from '../src/games/priklop/logic';
import { LEVELS } from '../src/core/levels';
import { dailyLevel, addDays } from '../src/core/daily';
import type { PriklopParams } from '../src/core/types';
import { solvePriklop } from './helpers';

const priklopStages = LEVELS.flatMap((l) => l.stages.filter((s) => s.kind === 'priklop').map((s) => ({ id: l.id, params: s.params as PriklopParams })));

describe('Priklop generator', () => {
  it('is deterministic per seed', () => {
    const p = priklopStages[2].params;
    const a = generatePuzzle(p);
    const b = generatePuzzle(p);
    expect(a.meters).toEqual(b.meters);
    expect([...a.obstacles]).toEqual([...b.obstacles]);
  });

  it.each(priklopStages)('$id: solution routes avoid obstacles and each other', ({ params }) => {
    const pz = generatePuzzle(params);
    expect(pz.meters).toHaveLength(params.meters);
    const seen = new Set<number>();
    for (const route of pz.solution) {
      for (const c of route) {
        const k = key(pz.cols, c.x, c.y);
        expect(pz.obstacles.has(k)).toBe(false);
        expect(seen.has(k)).toBe(false);
        seen.add(k);
      }
      for (let i = 1; i < route.length; i++) expect(Math.abs(route[i].x - route[i - 1].x) + Math.abs(route[i].y - route[i - 1].y)).toBe(1);
    }
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
  const params: PriklopParams = { cols: 5, rows: 6, meters: 3, timeSec: 60, obstacles: 0.2, conflicts: 1, baudMismatch: 0, dropouts: [], seed: 42 };

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

  it('cannot route through obstacles or other cables', () => {
    const game = new PriklopGame({ ...params, conflicts: 0 });
    const [a, b] = game.puzzle.solution;
    game.startDrag(a[0].x, a[0].y);
    for (const c of a.slice(1)) game.dragTo(c.x, c.y);
    game.startDrag(b[0].x, b[0].y);
    const target = a[Math.floor(a.length / 2)];
    game.dragTo(target.x, target.y);
    const path = game.paths.get(1)!;
    expect(path.some((c) => c.x === target.x && c.y === target.y)).toBe(false);
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
    expect(g2.status.get(0)).toBe('idle');
  });
});
