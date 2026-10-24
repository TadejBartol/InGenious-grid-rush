import { openDB, type IDBPDatabase } from 'idb';
import type { SaveData } from './save';

const DB_NAME = 'ingenious-grid-rush';
const DB_VERSION = 1;
const SAVE_KEY = 'main';

export interface AnalyticsEvent {
  t: number;
  name: 'session_start' | 'session_end' | 'level_start' | 'level_end' | 'daily_end' | 'install';
  data?: Record<string, string | number | boolean>;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function db() {
  dbPromise ??= openDB(DB_NAME, DB_VERSION, {
    upgrade(d) {
      if (!d.objectStoreNames.contains('save')) d.createObjectStore('save');
      if (!d.objectStoreNames.contains('events')) d.createObjectStore('events', { autoIncrement: true });
    },
  });
  return dbPromise;
}

export async function loadSave(): Promise<unknown> {
  try {
    return await (await db()).get('save', SAVE_KEY);
  } catch {
    // Private mode or blocked storage: play without persistence.
    return undefined;
  }
}

export async function writeSave(data: SaveData) {
  try {
    await (await db()).put('save', data, SAVE_KEY);
  } catch {
    /* storage unavailable */
  }
}

export async function clearSave() {
  try {
    const d = await db();
    await d.clear('save');
    await d.clear('events');
  } catch {
    /* storage unavailable */
  }
}

export async function logEvent(e: AnalyticsEvent) {
  try {
    await (await db()).add('events', e);
  } catch {
    /* storage unavailable */
  }
  const url = import.meta.env.VITE_ANALYTICS_URL as string | undefined;
  if (url && typeof navigator !== 'undefined' && navigator.sendBeacon) {
    navigator.sendBeacon(url, JSON.stringify({ ...e, player: anonId() }));
  }
}

export async function allEvents(): Promise<AnalyticsEvent[]> {
  try {
    return (await (await db()).getAll('events')) as AnalyticsEvent[];
  } catch {
    return [];
  }
}

/** Random install id, so a test lead can tell exported analytics files apart. */
export function anonId(): string {
  try {
    let id = localStorage.getItem('grid-rush-id');
    if (!id) {
      id = Math.random().toString(36).slice(2, 10);
      localStorage.setItem('grid-rush-id', id);
    }
    return id;
  } catch {
    return 'anon';
  }
}

export async function requestPersistence() {
  try {
    await navigator.storage?.persist?.();
  } catch {
    /* not supported */
  }
}
