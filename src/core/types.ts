export type GameKind = 'priklop' | 'konica' | 'detektiv' | 'wmbus' | 'toplovod' | 'puscanje' | 'polnilnica' | 'alarm' | 'selitev';

export interface PriklopParams {
  cols: number;
  rows: number;
  meters: number;
  timeSec: number;
  /** Meters shipped with an address that collides with another meter. */
  conflicts: number;
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
  /** Planned events on the production schedule that look like anomalies but are not. */
  decoys?: number;
  /** Anomaly strength, 1 = obvious; lower values hide them in the noise. */
  scale?: number;
  seed: number;
}

export interface WmbusParams {
  cols: number;
  rows: number;
  /** Number of water/heat meters to cover. */
  meters: number;
  /** Receivers (gateways) and repeaters the player may place. */
  gateways: number;
  repeaters: number;
  /** Extra repeaters beyond the known solution; the third star asks you not to need them. */
  spare?: number;
  /** Radio range in cells (Euclidean). */
  range: number;
  /** Share of cells that are buildings blocking placement. */
  obstacles: number;
  timeSec: number;
  seed: number;
}

export interface ToplovodParams {
  cols: number;
  rows: number;
  /** Share of cells taken by other buildings: no pipe there. */
  obstacles?: number;
  /** Range of buildings to heat (tree leaves). */
  houses: [number, number];
  /** Pipes already welded in place (a gentle start). */
  locked?: number;
  /** Seconds between the Dark Meter twisting a hot pipe (boss). */
  sabotage?: number;
  timeSec: number;
  seed: number;
}

export interface PuscanjeParams {
  cols: number;
  rows: number;
  leaks: number;
  /** Extra heat meters revealed at the start beyond what logic needs. */
  extraMeters?: number;
  /** Thermal camera charges: each reveals one safe, useful cell. */
  camera?: number;
  timeSec: number;
  seed: number;
}

export interface PolnilnicaParams {
  /** Vehicles besides the EVs. */
  cars: number;
  trucks: number;
  evs: number;
  /** Moves each EV can make on its battery (undefined = plenty). */
  battery?: number;
  /** Chargers on the board edge with their power (kW). */
  chargers: number[];
  /** Site connection limit (kW); undefined = no limit. */
  limitKw?: number;
  /** Player moves an EV keeps a charger busy after plugging in. */
  chargeMoves?: number;
  /** The dark car moves by itself every N player moves (boss). */
  darkEvery?: number;
  /** Shortest solution length the generator aims for. */
  minMoves: [number, number];
  seed: number;
}

export type AlarmCause = 'vrata' | 'izpad' | 'kompresor' | 'zmrzal' | 'torba' | 'senzor';

export interface AlarmParams {
  durationSec: number;
  /** Health centres (ZD) watched at once; a power cut hits every fridge of one centre. */
  sites: number;
  /** Vaccine fridges in total, spread over the sites. */
  fridges: number;
  /** Courier cool bags on the road. */
  bags?: number;
  /** Real incidents that will spoil the vaccines unless handled. */
  incidents: number;
  causes: AlarmCause[];
  /** Sensor glitches: an alarm with nothing behind it. */
  glitches: number;
  /** Ordinary door openings by the nurses: short bumps that only a too-tight limit turns into alarms. */
  openings: number;
  /** Alarm limit the round starts with (°C); the player can move it. */
  threshold: number;
  /** Incident heating speed, 1 = normal. */
  speed?: number;
  /** Fridges that may be lost and still pass (boss rounds). */
  maxLost?: number;
  seed: number;
}

export interface SelitevParams {
  /** Records the old system hands over. */
  records: number;
  /** New meters (lanes) on the InGenious side. */
  targets: number;
  /** Share of records stored in Wh that must be converted to kWh. */
  convert: number;
  /** Share of corrupt records (#####, negative readings) that must be thrown away. */
  corrupt: number;
  /** Share of records for a month that was already imported. */
  duplicates: number;
  /** Seconds a record waits at the reading head before it is lost. */
  cardSec: number;
  /** Hide the code-to-meter table after the first records: the player must remember it. */
  hideMap?: boolean;
  /** Share of records that must arrive intact to pass. */
  pass: number;
  seed: number;
}

export type Stage =
  | { kind: 'priklop'; params: PriklopParams }
  | { kind: 'konica'; params: KonicaParams }
  | { kind: 'detektiv'; params: DetektivParams }
  | { kind: 'wmbus'; params: WmbusParams }
  | { kind: 'toplovod'; params: ToplovodParams }
  | { kind: 'puscanje'; params: PuscanjeParams }
  | { kind: 'polnilnica'; params: PolnilnicaParams }
  | { kind: 'alarm'; params: AlarmParams }
  | { kind: 'selitev'; params: SelitevParams };

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
  art: 'livarna' | 'peskanje' | 'kompresor' | 'hladilnica' | 'trafo' | 'pakirnica' | 'cistilna' | 'vodarna' | 'toplarna' | 'bolnisnica' | 'zd' | 'dostava' | 'arhiv' | 'omara' | 'polnilnica';
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
