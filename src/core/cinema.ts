import type { Scene } from './story';

/**
 * Turns a scene's dialogue into a shot list, like a director's breakdown: where the
 * camera is for each line, whether it cuts or glides there, and which piece of action
 * plays. Every scene gets direction automatically from who speaks and what happens;
 * a line can still name its own `shot` or `act`.
 */
export type Shot = 'establish' | 'two' | 'facility' | 'genko' | 'dark';
export type Act = 'flyin' | 'sneak' | 'zap' | 'hit' | 'flee' | 'power' | 'blackout' | 'dawn' | 'laugh';

export interface Direction {
  shot: Shot;
  /** Glide from the previous framing instead of cutting. */
  move: boolean;
  act?: Act;
  /** State of the set while this line plays. */
  genkoOn: boolean;
  darkOn: boolean;
  /** The facility's lights are on. */
  lit: boolean;
  /** Share of city windows lit, 0..1. */
  city: number;
}

const BASE_CITY: Record<Scene['tone'], number> = { dark: 0.18, boss: 0.06, lit: 0.22, dawn: 0.35 };

export function direct(scene: Scene): Direction[] {
  let genkoOn = false;
  let darkOn = false;
  let lit = false;
  let city = BASE_CITY[scene.tone];
  let prev: Shot | null = null;
  return scene.lines.map((line, i) => {
    let shot: Shot;
    let act: Act | undefined;
    if (line.fx === 'light') {
      shot = 'facility';
      act = 'power';
    } else if (line.fx === 'zap') {
      shot = 'two';
      act = 'zap';
    } else if (line.fx === 'flash') {
      shot = 'two';
      act = 'hit';
    } else if (line.who === 'dark' && line.mood === 'fleeing') {
      shot = 'two';
      act = 'flee';
    } else if (line.who === 'genko' && !genkoOn) {
      shot = 'two';
      act = 'flyin';
    } else if (line.who === 'dark' && !darkOn) {
      shot = 'two';
      act = 'sneak';
    } else if (i === 0) {
      shot = 'establish';
      act = scene.tone === 'dawn' ? 'dawn' : scene.tone === 'boss' ? 'blackout' : undefined;
    } else if (line.who === 'genko') shot = 'genko';
    else if (line.who === 'dark') {
      shot = 'dark';
      if (line.mood === 'angry' || line.mood === 'smirk') act = i % 2 ? 'laugh' : undefined;
    } else shot = scene.facility ? 'facility' : 'establish';

    shot = line.shot ?? shot;
    act = line.act ?? act;

    if (act === 'flyin' || line.who === 'genko') genkoOn = true;
    if (act === 'sneak' || line.who === 'dark') darkOn = true;
    if (act === 'power') {
      lit = true;
      city = Math.min(1, city + 0.35);
    }
    if (act === 'dawn') city = 1;
    if (act === 'blackout') city = 0.02;
    const move = prev === 'establish' || shot === 'establish' || (prev === 'two' && shot === 'facility');
    prev = shot;
    const d: Direction = { shot, move, act, genkoOn, darkOn, lit, city };
    if (act === 'flee') darkOn = false;
    return d;
  });
}
