import { describe, expect, it } from 'vitest';
import { DetektivGame, generateDataset } from '../src/games/detektiv/logic';
import { LEVELS } from '../src/core/levels';
import type { DetektivParams } from '../src/core/types';
import { perfectDetektiv } from './helpers';

const stages = LEVELS.flatMap((l) => l.stages.filter((s) => s.kind === 'detektiv').map((s) => ({ id: l.id, params: s.params as DetektivParams })));

describe('Detektiv', () => {
  it.each(stages)('$id: places all anomalies without overlap', ({ params }) => {
    const d = generateDataset(params);
    expect(d.anomalies.length).toBe(params.anomalies);
    for (let i = 1; i < d.anomalies.length; i++) expect(d.anomalies[i].start).toBeGreaterThanOrEqual(d.anomalies[i - 1].start + d.anomalies[i - 1].len);
    // Anomalies must stand out from the typical week.
    for (const a of d.anomalies) {
      let diff = 0;
      for (let h = a.start; h < a.start + a.len; h++) diff += d.actual[h] - d.normal[h];
      expect(diff / a.len).toBeGreaterThan(Math.max(...d.normal) * 0.1);
    }
  });

  it.each(stages)('$id: a perfect player finds everything', ({ params }) => {
    const g = perfectDetektiv(params);
    expect(g.foundCount).toBe(params.anomalies);
    expect(g.mistakes).toBe(0);
  });

  it('wrong taps cost a mistake and reset the combo', () => {
    const g = new DetektivGame(stages[0].params);
    while (g.cursor < 12) g.update(0.1);
    g.tap(3);
    expect(g.mistakes).toBe(1);
    expect(g.combo).toBe(0);
  });

  it('cannot accuse the future', () => {
    const g = new DetektivGame(stages[0].params);
    g.update(0.5);
    expect(g.tap(160)).toBeNull();
    expect(g.mistakes).toBe(0);
  });

  it('three in a row doubles the points', () => {
    const g = perfectDetektiv({ ...stages[0].params, anomalies: 4, kinds: ['hladilnik', 'konica', 'nocna'] });
    expect(g.bestCombo).toBeGreaterThanOrEqual(3);
    expect(g.points).toBe(100 + 100 + 200 * (g.foundCount - 2));
  });
});
