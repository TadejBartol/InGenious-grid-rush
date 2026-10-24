import { describe, expect, it } from 'vitest';
import { autoplayKogen, KogenSim, MIN_LOAD, T_MIN } from '../src/games/kogenerator/logic';
import { LEVELS } from '../src/core/levels';
import type { KogeneratorParams } from '../src/core/types';

const stages = LEVELS.flatMap((l) => l.stages.filter((s) => s.kind === 'kogenerator').map((s) => ({ id: l.id, params: s.params as KogeneratorParams })));

const constant = (p: KogeneratorParams, load: number) => {
  const sim = new KogenSim(p);
  while (!sim.finished) {
    sim.setLoad(load);
    sim.update(0.1);
  }
  return sim;
};

describe('Kogenerator balance', () => {
  it.each(stages)('$id: the reference dispatcher passes with all three stars, lazy play fails', ({ id, params }) => {
    const bot = autoplayKogen(params);
    process.stdout.write(`${id}: target ${params.targetEur} bot ${bot.profit.toFixed(0)} eff ${(bot.efficiency * 100).toFixed(1)}\n`);
    expect(bot.profit).toBeGreaterThanOrEqual(params.targetEur * 1.4);
    expect(bot.coldEvents).toBe(0);
    expect(bot.efficiency).toBeGreaterThan(0.85);
    // Leaving the engine off freezes the town, full power all day burns money.
    expect(constant(params, 0).coldEvents).toBeGreaterThan(0);
    expect(constant(params, 0).profit).toBeLessThan(params.targetEur);
    expect(constant(params, 1).profit).toBeLessThan(params.targetEur);
    expect(constant(params, 0.7).profit).toBeLessThan(params.targetEur);
  });
});

describe('Kogenerator simulation', () => {
  const p = stages[0].params;

  it('snaps load to off or the minimum load', () => {
    const sim = new KogenSim(p);
    sim.setLoad(0.1);
    expect(sim.controls.load).toBe(0);
    sim.setLoad(0.3);
    expect(sim.controls.load).toBe(MIN_LOAD);
  });

  it('charging the storage cools the loop, discharging warms it', () => {
    const a = new KogenSim(p);
    const b = new KogenSim(p);
    a.setStorage(1);
    b.setStorage(-1);
    a.update(2);
    b.update(2);
    expect(a.soc).toBeGreaterThan(0.5);
    expect(b.soc).toBeLessThan(0.5);
    expect(a.temp).toBeLessThan(b.temp);
  });

  it('dumps heat and loses efficiency when the loop is saturated', () => {
    const sim = new KogenSim({ ...p, storageKwh: 100 });
    sim.setLoad(1);
    sim.setStorage(0);
    for (let i = 0; i < 100; i++) sim.update(0.1);
    expect(sim.dumpedKwh).toBeGreaterThan(0);
    expect(sim.efficiency).toBeLessThan(0.85);
  });

  it('reports cold once per episode', () => {
    const sim = new KogenSim(p);
    const ev: string[] = [];
    sim.on((e) => ev.push(e.type));
    while (sim.temp >= T_MIN) sim.update(0.1);
    sim.update(0.5);
    expect(ev.filter((e) => e === 'cold')).toHaveLength(1);
  });

  it('is deterministic', () => {
    expect(autoplayKogen(p).profit).toBe(autoplayKogen(p).profit);
  });
});
