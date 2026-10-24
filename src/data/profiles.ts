import type { Rng } from '../core/rng';

/**
 * Synthetic but realistic hourly load profiles (kW), modelled on typical Slovenian industrial sites:
 * two-shift foundry, 24/7 dairy with refrigeration, and a mixed substation feeder.
 * Week starts Monday 00:00. They stand in for anonymised InGenious exports (see docs/DEMO-PODATKI.md).
 */
export type ProfileId = 'livarna' | 'mlekarna' | 'trafo';

export const DAY_NAMES = ['Pon', 'Tor', 'Sre', 'Čet', 'Pet', 'Sob', 'Ned'];

export function weeklyProfile(id: ProfileId, rng: Rng): number[] {
  const out: number[] = [];
  const dayScale = Array.from({ length: 7 }, () => 0.94 + rng.next() * 0.12);
  for (let h = 0; h < 168; h++) {
    const day = Math.floor(h / 24);
    const hour = h % 24;
    const weekend = day >= 5;
    let kw: number;
    switch (id) {
      case 'livarna': {
        const shift = hour >= 6 && hour < 22;
        const lunch = hour === 12 || hour === 18 ? 0.8 : 1;
        const ramp = hour === 6 ? 0.7 : hour === 21 ? 0.75 : 1;
        kw = weekend ? 95 : shift ? 820 * lunch * ramp : 120;
        if (day === 5 && hour >= 6 && hour < 14) kw = 380;
        break;
      }
      case 'mlekarna': {
        const cooling = 240 + 60 * Math.sin(((hour - 9) / 24) * Math.PI * 2);
        const processing = hour >= 5 && hour < 15 ? 420 : hour >= 15 && hour < 19 ? 180 : 0;
        kw = cooling + (weekend ? processing * (day === 5 ? 0.6 : 0.15) : processing);
        break;
      }
      case 'trafo': {
        const office = hour >= 7 && hour < 16 ? 160 : 40;
        const plant = hour >= 6 && hour < 22 ? 380 : 90;
        kw = weekend ? 110 : office + plant;
        break;
      }
    }
    out.push(kw * dayScale[day]);
  }
  return out;
}
