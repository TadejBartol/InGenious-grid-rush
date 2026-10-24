import type { Speaker } from '../core/story';
import { audio } from './sfx';

/**
 * Spoken story lines. Recorded clips in public/voice/ win (see scripts/voice.mjs);
 * without one the device's Slovenian speech voice reads the line, if it has one.
 * A clip only counts while its recorded text still matches the line, so edited
 * dialogue never plays stale audio.
 */
type Manifest = Record<string, { file: string; text: string }>;

const BASE = `${import.meta.env.BASE_URL}voice/`;
let manifest: Promise<Manifest> | null = null;
let current: HTMLAudioElement | null = null;
let token = 0;
/** One element per speaker, each wired once through its character chain. */
const players: Partial<Record<Speaker, HTMLAudioElement>> = {};
/** 0.05 s of silence, played inside the first tap so iOS lets the players speak later. */
const SILENCE = 'data:audio/wav;base64,UklGRrQBAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YZABAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA';

function player(who: Speaker) {
  let el = players[who];
  if (!el) {
    el = new Audio();
    el.preload = 'auto';
    audio.attachVoice(el, who);
    players[who] = el;
  }
  return el;
}

function loadManifest() {
  manifest ??= fetch(`${BASE}manifest.json`)
    .then((r) => (r.ok ? (r.json() as Promise<Manifest>) : {}))
    .catch(() => ({}));
  return manifest;
}

function slVoice() {
  const voices = typeof speechSynthesis === 'undefined' ? [] : speechSynthesis.getVoices();
  return voices.find((v) => v.lang.toLowerCase().startsWith('sl'));
}

/** Character per speaker for the device-voice fallback. */
const SYNTH: Record<Speaker, { pitch: number; rate: number }> = {
  genko: { pitch: 1.45, rate: 1.08 },
  dark: { pitch: 0.35, rate: 0.85 },
  narrator: { pitch: 0.95, rate: 0.95 },
};

export const voice = {
  /** Call from a user gesture, after audio.unlock(). */
  prime() {
    void loadManifest();
    for (const who of ['genko', 'dark', 'narrator'] as Speaker[]) {
      const el = player(who);
      if (el.src) continue;
      el.src = SILENCE;
      el.play().catch(() => {});
    }
  },

  /** Starts the line and resolves with its length in ms (null when silent). */
  async speak(sceneId: string, index: number, who: Speaker, text: string): Promise<number | null> {
    this.stop();
    const my = ++token;
    const clip = (await loadManifest())[`${sceneId}.${index}`];
    if (my !== token) return null;
    if (clip && clip.text === text) {
      const el = player(who);
      el.src = BASE + clip.file;
      audio.duckMusic(true);
      el.addEventListener('ended', () => audio.duckMusic(false), { once: true });
      current = el;
      const ms = await new Promise<number | null>((resolve) => {
        el.addEventListener('loadedmetadata', () => resolve(Number.isFinite(el.duration) ? el.duration * 1000 : null), { once: true });
        el.addEventListener('error', () => resolve(null), { once: true });
        el.play().catch(() => resolve(null));
      });
      return my === token ? ms : null;
    }
    const v = slVoice();
    if (!v) return null;
    const u = new SpeechSynthesisUtterance(text);
    u.voice = v;
    u.lang = v.lang;
    u.pitch = SYNTH[who].pitch;
    u.rate = SYNTH[who].rate;
    speechSynthesis.speak(u);
    // Rough estimate: Slovenian speech runs at about 14 characters per second.
    return (text.length / 14 / u.rate) * 1000;
  },

  stop() {
    token++;
    if (current) {
      current.pause();
      current.dispatchEvent(new Event('ended'));
      current = null;
    }
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
  },

  /** True when lines can be heard: recorded clips exist or the device speaks Slovenian. */
  async available() {
    return Object.keys(await loadManifest()).length > 0 || !!slVoice();
  },
};

// Voices load asynchronously on Chrome; ask early so the first line can use them.
if (typeof speechSynthesis !== 'undefined') speechSynthesis.getVoices();
