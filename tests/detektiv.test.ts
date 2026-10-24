import { describe, expect, it } from 'vitest';
import { DetektivGame, generateDataset, POINTS } from '../src/games/detektiv/logic';
import { LEVELS } from '../src/core/levels';
import type { DetektivParams } from '../src/core/types';
import { perfectDetektiv } from './helpers';

const stages = LEVELS.flatMap((l) => l.stages.filter((s) => s.kind === 'detektiv').map((s) => ({ id: l.id, params: s.params as DetektivParams })));

describe('Detektiv', () => {
  it.each(stages)('$id: places all anomalies without overlap', ({ params }) => {
    const d = generateDataset(params);
    expect(d.anomalies.length).toBe(params.anomalies);
    expect(d.decoys.length).toBe(params.decoys ?? 0);
    const all = [...d.anomalies, ...d.decoys].sort((a, b) => a.start - b.start);
    for (let i = 1; i < all.length; i++) expect(all[i].start).toBeGreaterThanOrEqual(all[i - 1].start + all[i - 1].len);
    // Anomalies must still stand out from the typical week, even when subtle, and leave time to react.
    for (const a of d.anomalies) {
      let diff = 0;
      for (let h = a.start; h < a.start + a.len; h++) diff += d.actual[h] - d.normal[h];
      expect(diff / a.len).toBeGreaterThan(Math.max(...d.normal) * 0.065);
      expect(a.start + a.len).toBeLessThanOrEqual(POINTS - 6);
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
    expect(g.points).toBe(100 + 100 + 200 * (g.foundCount - 2) + 50 * g.fastFinds);
  });

  it('the chart reaches the end of the week exactly when time runs out', () => {
    const p = stages[0].params;
    const g = new DetektivGame(p);
    while (g.t < p.durationSec - 1) g.update(0.1);
    expect(g.cursor).toBeLessThan(POINTS);
    expect(g.finished).toBe(false);
    while (!g.finished) g.update(0.1);
    expect(g.cursor).toBe(POINTS);
  });

  it('a tap opens a diagnosis and slows time down', () => {
    const g = new DetektivGame(stages[0].params);
    const a = g.data.anomalies[0];
    while (g.cursor < a.start + a.len) g.update(0.1);
    g.tap(a.start + 1);
    expect(g.pending?.anomaly).toBe(a);
    expect(g.pending?.options).toContain(a.kind);
    expect(new Set(g.pending?.options).size).toBe(3);
    const t = g.t;
    g.update(1);
    expect(g.t - t).toBeCloseTo(0.3);
    g.diagnose(a.kind);
    expect(a.found && !a.misread).toBe(true);
    expect(g.mistakes).toBe(0);
  });

  it('a wrong diagnosis is a mistake, and so is running out of time', () => {
    const g = new DetektivGame(stages[1].params);
    const [a, b] = g.data.anomalies;
    while (g.cursor < a.start + a.len) g.update(0.1);
    g.tap(a.start + 1);
    g.diagnose(g.pending!.options.find((k) => k !== a.kind)!);
    expect(a.misread).toBe(true);
    expect(g.mistakes).toBe(1);
    while (g.cursor < b.start + b.len) g.update(0.1);
    g.tap(b.start + 1);
    for (let i = 0; i < 80 && g.pending; i++) g.update(0.1);
    expect(b.misread).toBe(true);
    expect(g.mistakes).toBe(2);
    expect(g.readCount).toBe(0);
    expect(g.foundCount).toBe(2);
  });

  it('accusing a planned event from the schedule is a mistake', () => {
    const p = stages.find((s) => (s.params.decoys ?? 0) > 0)!.params;
    const g = new DetektivGame(p);
    const d = g.data.decoys[0];
    while (g.cursor < d.start + d.len) g.update(0.1);
    g.tap(d.start + 1);
    expect(g.pending).toBeNull();
    expect(d.accused).toBe(true);
    expect(g.mistakes).toBe(1);
    // A second tap on the same event is not punished twice.
    g.tap(d.start + 1);
    expect(g.mistakes).toBe(1);
  });
});
