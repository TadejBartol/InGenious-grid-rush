import { describe, expect, it } from 'vitest';
import { AlarmSim, autoplayAlarm, FIX } from '../src/games/alarm/logic';
import type { AlarmParams } from '../src/core/types';

const base: AlarmParams = { durationSec: 80, sites: 2, fridges: 4, bags: 1, incidents: 5, causes: ['vrata', 'izpad', 'kompresor', 'torba', 'zmrzal'], glitches: 2, openings: 6, threshold: 7.5, seed: 42 };

describe('Alarm!', () => {
  it('a prompt player saves every fridge', () => {
    const sim = autoplayAlarm(base, { delay: 1.5 });
    expect(sim.lostUnits).toBe(0);
    expect(sim.passed).toBe(true);
    expect(sim.fixed.length).toBe(sim.incidents.length);
  });

  it('an idle player loses vaccines and fails', () => {
    const sim = autoplayAlarm(base, { idle: true });
    expect(sim.lostUnits).toBeGreaterThan(0);
    expect(sim.passed).toBe(false);
  });

  it('a tighter limit warns earlier but rings on ordinary door openings', () => {
    const loose = autoplayAlarm(base, { delay: 1.5, threshold: 7.5 });
    const tuned = autoplayAlarm(base, { delay: 1.5, threshold: 6 });
    const tight = autoplayAlarm(base, { delay: 1.5, threshold: 4.5 });
    expect(tuned.avgResponse).toBeLessThan(loose.avgResponse);
    expect(tight.falseAlarms).toBeGreaterThan(tuned.falseAlarms);
  });

  it('wrong answers count as mistakes, the right one ends the incident', () => {
    const sim = new AlarmSim(base);
    while (!sim.incidents.some((x) => x.active)) sim.update(0.1);
    const x = sim.incidents.find((i) => i.active)!;
    const wrong = sim.options(x.unit).find((a) => a !== FIX[x.cause])!;
    expect(sim.options(x.unit)).toContain(FIX[x.cause]);
    expect(sim.respond(x.unit, wrong)).toBe(false);
    expect(sim.mistakes).toBe(1);
    expect(sim.respond(x.unit, FIX[x.cause])).toBe(true);
    expect(x.done).toBe(true);
  });

  it('a power cut warms every fridge of that centre and one generator fixes all', () => {
    const sim = new AlarmSim({ ...base, causes: ['izpad'], incidents: 1, glitches: 0, openings: 0, bags: 0 });
    const x = sim.incidents[0];
    while (!x.active) sim.update(0.1);
    for (let k = 0; k < 40; k++) sim.update(0.1);
    const site = sim.units.filter((u) => u.site === x.site);
    expect(site.length).toBeGreaterThan(1);
    for (const u of site) expect(u.temp).toBeGreaterThan(4.8);
    const other = site.find((u) => u.id !== x.unit)!;
    expect(sim.respond(other.id, 'agregat')).toBe(true);
    expect(site.every((u) => u.power)).toBe(true);
  });
});
