import type { Scene } from './story';

/**
 * Turns a scene's dialogue into a shot list, like a director's breakdown: where the
 * camera is for each line, whether it cuts or glides there, and which piece of action
 * plays. Every scene gets direction automatically from who speaks and what happens;
 * a line can still name its own `shot` or `act`.
 */
export type Shot = 'establish' | 'two' | 'facility' | 'genko' | 'dark';
/** Pieces of action. The first group moves an actor or the set; the second is a beat
 * layered over whatever else the line does (see `Direction.beat`). */
export type Act = 'flyin' | 'sneak' | 'zap' | 'hit' | 'flee' | 'power' | 'blackout' | 'dawn' | 'laugh' | 'heal' | Beat;
/** scan: InGenious sweeps a sensor beam; connect: data packets run to the facility;
 * reveal: a clue under a spotlight; glitch: the Dark Meter tears the picture. */
export type Beat = 'scan' | 'connect' | 'reveal' | 'glitch';
const BEATS: Act[] = ['scan', 'connect', 'reveal', 'glitch'];

export interface Direction {
  shot: Shot;
  /** Glide from the previous framing instead of cutting. */
  move: boolean;
  act?: Exclude<Act, Beat>;
  /** Overlay beat that plays on top of `act`. */
  beat?: Beat;
  /** Tilt the lens a little: unease, a revelation, the villain's grip on the picture. */
  dutch: boolean;
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

    let beat: Beat | undefined;
    if (line.act && BEATS.includes(line.act)) {
      beat = line.act as Beat;
      // A beat never steals an entrance; it plays on top of it.
      if (beat === 'reveal' && !line.shot && act !== 'flyin' && act !== 'sneak') shot = scene.facility ? 'facility' : 'establish';
      if (beat === 'glitch' && !line.shot && act !== 'sneak') shot = 'dark';
    } else act = line.act ?? act;
    // A healed meter does not sneak in: it simply glows into the frame.
    if (act === 'sneak' && line.mood === 'healed') act = 'heal';
    shot = line.shot ?? shot;

    if (act === 'flyin' || line.who === 'genko') genkoOn = true;
    if (act === 'sneak' || act === 'heal' || line.who === 'dark') darkOn = true;
    if (act === 'power') {
      lit = true;
      city = Math.min(1, city + 0.35);
    }
    if (act === 'dawn') city = 1;
    if (act === 'blackout') city = 0.02;
    const move = prev === 'establish' || shot === 'establish' || (prev === 'two' && shot === 'facility');
    prev = shot;
    if (act === 'heal') city = Math.min(1, city + 0.2);
    const dutch = beat === 'glitch' || beat === 'reveal' || (line.who === 'dark' && line.mood === 'angry' && scene.tone === 'boss');
    const d: Direction = { shot, move, act: act as Exclude<Act, Beat> | undefined, beat, dutch, genkoOn, darkOn, lit, city };
    if (act === 'flee') darkOn = false;
    return d;
  });
}
