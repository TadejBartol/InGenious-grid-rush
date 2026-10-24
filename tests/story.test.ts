import { describe, expect, it } from 'vitest';
import { FACILITIES, REGIONS } from '../src/core/levels';
import { SCENES, sceneById } from '../src/core/story';

describe('zgodba', () => {
  it('ima enolične prizore z vsebino', () => {
    expect(new Set(SCENES.map((s) => s.id)).size).toBe(SCENES.length);
    for (const s of SCENES) expect(s.lines.length).toBeGreaterThan(0);
  });

  it('pokrije vsako igralno regijo: uvod, boss, posmeh, KO, zmaga', () => {
    for (const r of REGIONS.filter((x) => x.available))
      for (const part of ['intro', 'boss', 'taunt', 'ko', 'victory']) expect(sceneById(`r${r.id}-${part}`), `r${r.id}-${part}`).toBeTruthy();
  });

  it('ima prizor za vsak objekt, ki ga ne prižge boss', () => {
    for (const f of FACILITIES) {
      const bossFacility = SCENES.some((s) => s.id.endsWith('-ko') && s.facility === f.id);
      expect(bossFacility || !!sceneById(`fac-${f.id}`), f.id).toBe(true);
    }
  });

  it('objekt na odru se prižge in obstaja', () => {
    for (const s of SCENES.filter((x) => x.facility)) {
      expect(FACILITIES.some((f) => f.id === s.facility)).toBe(true);
      expect(s.lines.some((l) => l.fx === 'light')).toBe(true);
    }
  });
});
