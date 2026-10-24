import { FACILITIES, LEVELS } from './levels';
import type { FacilityDef, GameResult, LevelDef, StarGoal } from './types';

export interface ResearchDef {
  id: string;
  name: string;
  text: string;
  costs: number[];
  /** Which InGenious feature this upgrade stands for. */
  feature: string;
  /** Region that must be unlocked before this can be researched. */
  region?: number;
}

/**
 * The lab is the long-term DP sink. Costs are tuned so a player who three-stars a region
 * can afford roughly that region's share of the tree, never all of it; the top tiers
 * and the later nodes wait for later regions.
 */
export const RESEARCH: ResearchDef[] = [
  { id: 'vzorcenje', name: 'Hitrejše vzorčenje', text: '+6 s časa pri Priklopu na stopnjo.', costs: [80, 220, 500], feature: 'Zajem podatkov' },
  { id: 'rezervoar', name: 'Pametni hranilniki', text: 'Zaloge pri Lovu na konico se praznijo 12 % počasneje na stopnjo.', costs: [100, 260, 600], feature: 'Spremljanje moči' },
  { id: 'merilniki', name: 'Boljši merilniki', text: '+15 % pasivnega pridelka kWh na stopnjo.', costs: [150, 380, 800, 1500, 2600], feature: 'Natančnost meritev' },
  { id: 'napoved', name: 'Napoved konice', text: 'Pri Lovu na konico vidiš napoved moči za 3 sekunde naprej.', costs: [400], feature: 'Napovedi', region: 2 },
  { id: 'kalibracija', name: 'Kalibracija vzorcev', text: 'V Detektivu imaš za diagnozo vzroka 2 s več na stopnjo.', costs: [220, 550], feature: 'Prepoznava vzorcev', region: 2 },
  { id: 'tarifa', name: 'Tarifni modeli', text: '+10 % kWh nagrade za vsako opravljeno stopnjo na stopnjo.', costs: [300, 750, 1500], feature: 'Obračun energije', region: 2 },
  { id: 'spomin', name: 'Pomnilnik prehoda', text: 'Pasivni števec polni do 4 ure dlje, ko te ni.', costs: [300, 800], feature: 'Lokalni pomnilnik', region: 3 },
  { id: 'ai', name: 'AI analiza', text: 'Opozori na napačne nastavitve merilnikov in namigne anomalije v Detektivu.', costs: [1000], feature: 'Analize', region: 3 },
  { id: 'pragovi', name: 'Pametni alarmi', text: 'Pri Alarmu! imajo cepiva 1,5 s več, preden se pokvarijo, na stopnjo.', costs: [900, 2200], feature: 'Alarmi in obvestila', region: 5 },
  { id: 'validacija', name: 'Preverjanje uvoza', text: 'Pri Selitvi platforma označi pokvarjene zapise in dvojnike.', costs: [2600], feature: 'Uvoz meritev', region: 6 },
];

export interface SkinDef {
  id: string;
  name: string;
  cost: number;
  body: string;
  screen: string;
  glow: string;
  /** Skins that are earned, not bought. */
  unlock?: 'region1-gold';
}

export const SKINS: SkinDef[] = [
  { id: 'klasicen', name: 'Klasični InGenious', cost: 0, body: '#dfe8ff', screen: '#0b1a33', glow: '#38e1ff' },
  { id: 'neon', name: 'Neon InGenious', cost: 3, body: '#ffd6f5', screen: '#1d0b2e', glow: '#ff4fd8' },
  { id: 'retro', name: 'Retro terminal', cost: 5, body: '#c9d6b8', screen: '#071a07', glow: '#5dff6a' },
  { id: 'nocni', name: 'Nočna izmena', cost: 8, body: '#5a6b8f', screen: '#03060f', glow: '#ffb340' },
  { id: 'zlati', name: 'Zlati InGenious', cost: 0, body: '#ffd86b', screen: '#2a1a00', glow: '#fff1a8', unlock: 'region1-gold' },
];

export const BASE_OFFLINE_CAP_H = 8;

export function offlineCapHours(research: Record<string, number>) {
  return BASE_OFFLINE_CAP_H + 4 * (research.spomin ?? 0);
}

export function idleMultiplier(research: Record<string, number>) {
  return 1 + 0.15 * (research.merilniki ?? 0);
}

export function facilityRate(f: FacilityDef, upgrades: number) {
  return f.baseRate * (1 + 0.6 * upgrades);
}

/** Each level costs 70 % more while adding a flat +60 % of the base rate: later levels are a long-term goal. */
export function facilityUpgradeCost(f: FacilityDef, level: number) {
  return Math.round((f.upgradeBaseCost * 2 * Math.pow(1.7, level)) / 10) * 10;
}

export const MAX_FACILITY_LEVEL = 10;

export function isFacilityLit(f: FacilityDef, levels: Record<string, { stars: number }>) {
  return f.levels.every((id) => (levels[id]?.stars ?? 0) > 0);
}

/** Total kWh per hour from lit facilities. */
export function idleRate(levels: Record<string, { stars: number }>, upgrades: Record<string, number>, research: Record<string, number>) {
  let rate = 0;
  for (const f of FACILITIES) if (isFacilityLit(f, levels)) rate += facilityRate(f, upgrades[f.id] ?? 0);
  return rate * idleMultiplier(research);
}

/** Idle gain over an interval, capped by how long the gateway can buffer. */
export function idleGain(ratePerHour: number, elapsedMs: number, capHours: number) {
  const hours = Math.min(Math.max(0, elapsedMs) / 3_600_000, capHours);
  return ratePerHour * hours;
}

export interface StarCheck {
  goal: StarGoal;
  met: boolean;
  label: string;
  /** "še 2 kW" style hint when the goal was missed. */
  nearMiss?: string;
}

export function goalLabel(goal: StarGoal): string {
  switch (goal.type) {
    case 'complete':
      return 'Opravi nalogo';
    case 'mistakes':
      return goal.label ?? (goal.max === 0 ? 'Brez napake' : `Največ ${goal.max} napak`);
    case 'timeLeft':
      return `Ostane vsaj ${goal.min} s`;
    case 'metric':
      return goal.label;
  }
}

export function checkStars(level: LevelDef, result: GameResult): StarCheck[] {
  return level.stars.map((goal) => {
    const label = goalLabel(goal);
    if (!result.completed) return { goal, met: false, label, nearMiss: goal.type === 'complete' ? result.failHint : undefined };
    switch (goal.type) {
      case 'complete':
        return { goal, met: true, label };
      case 'mistakes': {
        const met = result.mistakes <= goal.max;
        return { goal, met, label, nearMiss: met ? undefined : `${result.mistakes - goal.max} ${plural(result.mistakes - goal.max, 'napaka', 'napaki', 'napake', 'napak')} preveč` };
      }
      case 'timeLeft': {
        const met = result.timeLeft >= goal.min;
        return { goal, met, label, nearMiss: met ? undefined : `še ${Math.ceil(goal.min - result.timeLeft)} s hitreje` };
      }
      case 'metric': {
        const v = result.metrics[goal.key] ?? 0;
        const met = goal.op === '<=' ? v <= goal.value : v >= goal.value;
        const diff = Math.ceil(Math.abs(v - goal.value));
        const nearMiss = met ? undefined : goal.unit ? `še ${diff} ${goal.unit}` : `še ${diff}`;
        return { goal, met, label, nearMiss };
      }
    }
  });
}

/** Stars are cumulative: the third star only counts when the level is completed. */
export function starCount(checks: StarCheck[]) {
  return checks.filter((c) => c.met).length;
}

export interface Reward {
  kwh: number;
  dp: number;
  chips: number;
}

export function rewardFor(level: LevelDef, stars: number, prevStars: number, bonusDp = 0, tarifa = 0): Reward {
  if (stars === 0) return { kwh: 0, dp: Math.round(level.reward.dp * 0.15), chips: 0 };
  const replay = prevStars > 0;
  const kwh = Math.round(level.reward.kwh * (0.4 + 0.2 * stars) * (replay ? 0.35 : 1) * (1 + 0.1 * tarifa));
  const dp = Math.round(level.reward.dp * (0.5 + stars / 6) * (replay ? 0.5 : 1)) + bonusDp;
  let chips = 0;
  if (stars === 3 && prevStars < 3) chips += 1;
  if (level.boss && !replay) chips += 3;
  return { kwh, dp, chips };
}

export function plural(n: number, one: string, two: string, few: string, many: string) {
  const m = Math.abs(n) % 100;
  if (m === 1) return one;
  if (m === 2) return two;
  if (m === 3 || m === 4) return few;
  return many;
}

export function regionComplete(region: number, levels: Record<string, { stars: number }>) {
  const ls = LEVELS.filter((l) => l.region === region);
  return ls.length > 0 && ls.every((l) => (levels[l.id]?.stars ?? 0) > 0);
}

export function regionStars(region: number, levels: Record<string, { stars: number }>) {
  const ls = LEVELS.filter((l) => l.region === region);
  return { have: ls.reduce((s, l) => s + (levels[l.id]?.stars ?? 0), 0), max: ls.length * 3 };
}

/** A level is playable once the previous one in its region has at least one star. */
export function isLevelUnlocked(level: LevelDef, levels: Record<string, { stars: number }>, regionsUnlocked: number[]) {
  if (!regionsUnlocked.includes(level.region)) return false;
  if (level.index === 1) return true;
  const prev = LEVELS.find((l) => l.region === level.region && l.index === level.index - 1);
  return !!prev && (levels[prev.id]?.stars ?? 0) > 0;
}
