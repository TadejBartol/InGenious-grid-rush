import { createStore } from 'zustand/vanilla';
import { useEffect, useReducer } from 'preact/hooks';
import type { LevelDef } from '../core/types';
import type { LevelOutcome } from '../state/store';

export type Tab = 'map' | 'upgrades' | 'daily' | 'collection';

export type Screen =
  | { name: 'title' }
  | { name: 'tabs'; tab: Tab }
  | { name: 'region'; region: number }
  | { name: 'play'; level: LevelDef; from: Screen }
  | { name: 'result'; outcome: LevelOutcome; from: Screen }
  | { name: 'settings'; from: Screen };

interface NavState {
  screen: Screen;
  /** Level whose intro card is open. */
  intro: LevelDef | null;
  /** Story scene playing on top of everything, and what to do after it. */
  scene: { id: string; then?: () => void } | null;
  /** Region victory celebration after a first boss clear. */
  victory: number | null;
  go(screen: Screen): void;
  openIntro(level: LevelDef | null): void;
}

export const nav = createStore<NavState>()((set) => ({
  screen: { name: 'title' },
  intro: null,
  scene: null,
  victory: null,
  go: (screen) => set({ screen, intro: null }),
  openIntro: (intro) => set({ intro }),
}));

export function useNav() {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => nav.subscribe(() => force(0)), []);
  return nav.getState();
}
