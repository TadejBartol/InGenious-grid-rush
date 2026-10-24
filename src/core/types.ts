export type GameKind = 'priklop' | 'konica' | 'detektiv';

export interface PriklopParams {
  cols: number;
  rows: number;
  meters: number;
  timeSec: number;
  /** Share of free cells turned into machines/walls. */
  obstacles: number;
  /** Meters shipped with an address that collides with another meter. */
  conflicts: number;
  /** Meters shipped with the wrong baud rate. */
  baudMismatch: number;
  /** Times (s from start) when an online cable gets cut and must be re-routed. */
  dropouts: number[];
  seed: number;
}

export interface ConsumerDef {
  id: string;
  name: string;
  icon: string;
  kw: number;
  /** Critical consumers (production) can never be switched off. */
  critical?: boolean;
  bufferLabel?: string;
  /** Buffer drained per second while off (1 = full buffer). */
  drain?: number;
  /** Buffer refilled per second while on. */
  fill?: number;
  /** Power modulation: period in seconds and depth 0..1. */
  cycle?: { period: number; depth: number };
  /** Seconds after start when the consumer comes online (e.g. a second shift). */
  startAt?: number;
}

export interface KonicaParams {
  durationSec: number;
  limitKw: number;
  /** Allowed overshoot (share of limit) that still counts as a pass. */
  tolerance: number;
  baseKw: number;
  baseNoise: number;
  baseSteps: { t: number; kw: number }[];
  consumers: ConsumerDef[];
  /** Turn-on surge multiplier (1 = no surge). */
  inrush: number;
  seed: number;
}

export type AnomalyKind = 'nocna' | 'zrak' | 'prazniTek' | 'konica' | 'hladilnik';

export interface DetektivParams {
  durationSec: number;
  profile: 'livarna' | 'mlekarna' | 'trafo';
  anomalies: number;
  kinds: AnomalyKind[];
  noise: number;
  seed: number;
}

export type Stage =
  | { kind: 'priklop'; params: PriklopParams }
  | { kind: 'konica'; params: KonicaParams }
  | { kind: 'detektiv'; params: DetektivParams };

export type StarGoal =
  | { type: 'complete' }
  | { type: 'mistakes'; max: number; label?: string }
  | { type: 'timeLeft'; min: number }
  | { type: 'metric'; key: string; op: '<=' | '>='; value: number; unit: string; label: string };

export interface LevelDef {
  id: string;
  region: number;
  index: number;
  name: string;
  facilityId: string;
  boss?: boolean;
  intro: string;
  /** Genko's tip shown on the intro card, teaches the InGenious feature behind the game. */
  lesson: string;
  stages: Stage[];
  stars: [StarGoal, StarGoal, StarGoal];
  reward: { kwh: number; dp: number };
  card: CardDef;
}

export interface CardDef {
  id: string;
  name: string;
  rarity: 'navadna' | 'redka' | 'epska';
  text: string;
}

export interface GameResult {
  kind: GameKind;
  completed: boolean;
  mistakes: number;
  timeLeft: number;
  timeTotal: number;
  score: number;
  metrics: Record<string, number>;
  /** Short emoji line for sharing the daily challenge. */
  emoji: string;
  /** How far from passing, e.g. "še 12 kW nižje", shown when the level is failed. */
  failHint?: string;
  /** Lines for the result screen, e.g. what each anomaly meant. */
  notes?: string[];
}

export interface FacilityDef {
  id: string;
  region: number;
  name: string;
  description: string;
  levels: string[];
  /** kWh per hour saved once the facility is lit, before upgrades. */
  baseRate: number;
  upgradeBaseCost: number;
  art: 'livarna' | 'peskanje' | 'kompresor' | 'hladilnica' | 'trafo' | 'pakirnica';
}

export interface RegionDef {
  id: number;
  name: string;
  theme: string;
  mechanic: string;
  /** Map position in % of the map box. */
  pos: { x: number; y: number };
  available: boolean;
  unlockChips: number;
}
