import { describe, expect, it } from 'vitest';
import { direct } from '../src/core/cinema';
import { SCENES, sceneById } from '../src/core/story';

describe('cutscene direction', () => {
  it('gives every line of every scene a shot', () => {
    for (const s of SCENES) {
      const d = direct(s);
      expect(d).toHaveLength(s.lines.length);
      for (const x of d) expect(['establish', 'two', 'facility', 'genko', 'dark']).toContain(x.shot);
    }
  });

  it('opens on the establishing shot unless a character makes an entrance', () => {
    const d = direct(sceneById('r1-intro')!);
    expect(d[0]).toMatchObject({ shot: 'establish', move: true });
    expect(d[1]).toMatchObject({ shot: 'two', act: 'flyin', genkoOn: true, darkOn: false });
    expect(d[2]).toMatchObject({ act: 'sneak', darkOn: true });
    // Later lines cut to close-ups of whoever speaks.
    expect(d[3]).toMatchObject({ shot: 'genko', move: false });
  });

  it('stages the knockout: zap, hit, then the facility powers up and the city lights', () => {
    const d = direct(sceneById('r1-ko')!);
    const acts = d.map((x) => x.act);
    expect(acts).toContain('zap');
    expect(acts).toContain('hit');
    const p = d.findIndex((x) => x.act === 'power');
    expect(d[p]).toMatchObject({ shot: 'facility', lit: true });
    expect(d[p].city).toBeGreaterThan(d[0].city);
  });

  it('sends the Dark Meter off stage after it flees', () => {
    const s = sceneById('r1-victory')!;
    const d = direct(s);
    const f = d.findIndex((x) => x.act === 'flee');
    expect(d[f].darkOn).toBe(true);
    if (f + 1 < d.length) expect(d[f + 1].darkOn).toBe(false);
    expect(d[0].act).toBe('dawn');
  });
});

describe('beats and the finale', () => {
  it('layers a beat over an entrance instead of replacing it', () => {
    const d = direct(sceneById('r6-boss')!);
    expect(d[1]).toMatchObject({ act: 'sneak', beat: 'glitch', dutch: true, darkOn: true });
    expect(d[0]).toMatchObject({ beat: 'reveal', shot: 'establish' });
  });

  it('heals the Dark Meter in the finale and lets a healed meter glow in, not sneak', () => {
    const ko = direct(sceneById('r6-ko')!);
    const h = ko.findIndex((x) => x.act === 'heal');
    expect(h).toBeGreaterThan(0);
    expect(ko[h].city).toBeGreaterThan(ko[0].city);
    const ep = direct(sceneById('r6-victory')!);
    expect(ep.map((x) => x.act)).not.toContain('sneak');
    expect(ep.find((x) => x.darkOn)?.act).toBe('heal');
  });
});
