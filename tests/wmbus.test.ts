import { describe, expect, it } from 'vitest';
import { coverage, generateWmbus, WmbusGame } from '../src/games/wmbus/logic';
import { LEVELS } from '../src/core/levels';
import type { WmbusParams } from '../src/core/types';

const stages = LEVELS.flatMap((l) => l.stages.filter((s) => s.kind === 'wmbus').map((s) => ({ id: l.id, params: s.params as WmbusParams })));

describe('wM-Bus puzzles', () => {
  it.each(stages)('$id: the known solution covers every meter within budget', ({ params }) => {
    const p = generateWmbus(params);
    const c = coverage(p, p.solution);
    expect(c.covered.size).toBe(p.meters.length);
    expect(c.linked.size).toBe(p.solution.length);
    expect(p.solution.filter((d) => d.kind === 'repeater').length).toBeLessThanOrEqual(p.budget.repeater);
    for (const d of p.solution) expect(p.blocked.has(d.y * p.cols + d.x)).toBe(false);
  });

  it.each(stages.filter((s) => s.params.repeaters > 0))('$id: gateways alone are not enough', ({ params }) => {
    const p = generateWmbus(params);
    expect(coverage(p, p.solution.filter((d) => d.kind === 'gateway')).covered.size).toBeLessThan(p.meters.length);
  });

  it('is deterministic', () => {
    const a = generateWmbus(stages[3].params);
    const b = generateWmbus(stages[3].params);
    expect(a.meters).toEqual(b.meters);
    expect([...a.blocked]).toEqual([...b.blocked]);
  });
});

describe('wM-Bus game', () => {
  const params = stages.find((s) => s.params.repeaters > 0)!.params;

  it('wins when the solution is placed and counts pick-ups as mistakes', () => {
    const g = new WmbusGame(params);
    const events: string[] = [];
    g.on((e) => events.push(e.type));
    const [first, ...rest] = g.puzzle.solution;
    g.tap(first.x, first.y, first.kind);
    g.tap(first.x, first.y, first.kind); // pick it up again
    expect(g.mistakes).toBe(1);
    for (const d of [first, ...rest]) g.tap(d.x, d.y, d.kind);
    expect(g.finished).toBe('won');
    expect(events).toContain('removed');
    expect(events[events.length - 1]).toBe('won');
  });

  it('a repeater out of range of any gateway covers nothing', () => {
    const g = new WmbusGame(params);
    const rep = g.puzzle.solution.find((d) => d.kind === 'repeater')!;
    g.tap(rep.x, rep.y, 'repeater');
    expect(g.coveredCount).toBe(0);
    expect(g.isLinked(g.devices[0])).toBe(false);
  });

  it('refuses buildings, meters and an empty budget', () => {
    const g = new WmbusGame(params);
    const reasons: string[] = [];
    g.on((e) => e.type === 'blocked' && reasons.push(e.reason));
    const b = [...g.puzzle.blocked][0];
    g.tap(b % g.puzzle.cols, Math.floor(b / g.puzzle.cols), 'gateway');
    const m = g.puzzle.meters[0];
    g.tap(m.x, m.y, 'gateway');
    const gw = g.puzzle.solution.find((d) => d.kind === 'gateway')!;
    g.tap(gw.x, gw.y, 'gateway');
    const free = g.puzzle.solution.find((d) => d.kind === 'repeater')!;
    g.tap(free.x, free.y, 'gateway');
    expect(reasons).toEqual(['building', 'meter', 'budget']);
  });

  it('times out', () => {
    const g = new WmbusGame(params);
    g.update(params.timeSec + 1);
    expect(g.finished).toBe('timeout');
  });
});
