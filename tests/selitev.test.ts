import { describe, expect, it } from 'vitest';
import { autoplaySelitev, SelitevGame } from '../src/games/selitev/logic';
import type { SelitevParams } from '../src/core/types';

const base: SelitevParams = { records: 30, targets: 3, convert: 0.25, corrupt: 0.12, duplicates: 0.1, cardSec: 4.5, pass: 0.8, seed: 7 };

describe('Selitev', () => {
  it('a careful player migrates everything intact', () => {
    const g = autoplaySelitev(base);
    expect(g.mistakes).toBe(0);
    expect(g.lost).toBe(0);
    expect(g.integrity).toBe(1);
    expect(g.passed).toBe(true);
  });

  it('mixes in conversions, corrupt and duplicate records', () => {
    const g = new SelitevGame(base);
    expect(g.records.some((r) => r.unit === 'Wh')).toBe(true);
    expect(g.records.some((r) => r.flaw)).toBe(true);
    expect(g.records.some((r) => r.duplicate)).toBe(true);
    expect(g.records).toHaveLength(30);
  });

  it('a player who waits too long leaves holes and fails', () => {
    const g = autoplaySelitev(base, { think: 99 });
    expect(g.lost).toBe(g.valid);
    expect(g.passed).toBe(false);
  });

  it('every kind of slip is a mistake', () => {
    const g = new SelitevGame({ ...base, duplicates: 0, corrupt: 0, convert: 1 });
    const r = g.current!;
    g.route(r.target);
    expect(g.mistakes).toBe(1);
    const r2 = g.current!;
    g.convert();
    g.route((r2.target + 1) % g.targets.length);
    expect(g.mistakes).toBe(2);
    g.bin();
    expect(g.mistakes).toBe(3);
  });

  it('sloppy play drops below the pass mark', () => {
    expect(autoplaySelitev(base, { slip: 0.45 }).passed).toBe(false);
  });
});
