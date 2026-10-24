import { describe, expect, it } from 'vitest';
import { autoplay, baselinePeak, KonicaSim } from '../src/games/konica/logic';
import { LEVELS } from '../src/core/levels';
import { addDays, dailyLevel } from '../src/core/daily';
import type { KonicaParams } from '../src/core/types';

const stages = LEVELS.flatMap((l) => l.stages.filter((s) => s.kind === 'konica').map((s) => ({ id: l.id, params: s.params as KonicaParams })));

describe('Lov na konico balance', () => {
  it.each(stages)('$id: doing nothing fails, a decent controller passes', ({ id, params }) => {
    const base = baselinePeak(params);
    const bot = autoplay(params);
    // eslint-disable-next-line no-console
    console.log(`${id}: limit ${params.limitKw} baseline ${base.toFixed(0)} bot peak ${bot.peak.toFixed(0)} stalls ${bot.stalls} over ${bot.overSeconds.toFixed(1)}s`);
    expect(base).toBeGreaterThan(params.limitKw * (1 + params.tolerance));
    expect(bot.passed).toBe(true);
  });

  it('daily konica challenges are beatable', () => {
    let day = '2026-10-01';
    for (let i = 0; i < 45; i++) {
      const st = dailyLevel(day, false).stages[0];
      if (st.kind === 'konica') {
        expect(baselinePeak(st.params)).toBeGreaterThan(st.params.limitKw);
        expect(autoplay(st.params).passed).toBe(true);
      }
      day = addDays(day, 1);
    }
  });
});

describe('Lov na konico simulation', () => {
  const params = stages[0].params;

  it('critical consumers refuse to switch off', () => {
    const sim = new KonicaSim(params);
    const events: string[] = [];
    sim.on((e) => events.push(e.type));
    sim.toggle('linija1');
    expect(events).toContain('refused');
    expect(sim.consumers.find((c) => c.def.id === 'linija1')!.on).toBe(true);
  });

  it('switching off lowers power and drains the buffer, then stalls', () => {
    const sim = new KonicaSim(params);
    sim.update(8);
    const before = sim.power;
    sim.toggle('pec');
    sim.update(2);
    expect(sim.power).toBeLessThan(before - 100);
    const pec = sim.consumers.find((c) => c.def.id === 'pec')!;
    expect(pec.buffer).toBeLessThan(1);
    sim.update(20);
    expect(sim.stalls).toBe(1);
    expect(pec.on).toBe(true);
  });

  it('is deterministic', () => {
    const a = autoplay(params);
    const b = autoplay(params);
    expect(a.peak).toBe(b.peak);
    expect(a.samples.length).toBe(b.samples.length);
  });

  it('records samples for the whole window', () => {
    const sim = new KonicaSim(params);
    sim.update(params.durationSec + 1);
    expect(sim.finished).toBe(true);
    expect(sim.samples.length).toBeGreaterThanOrEqual(Math.floor(params.durationSec / 0.1) - 1);
  });
});
