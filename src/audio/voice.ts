import type { Speaker } from '../core/story';
import { audio } from './sfx';

/**
 * Spoken story lines. Recorded clips in public/voice/ win (see scripts/voice.mjs);
 * without one the device's Slovenian speech voice reads the line, if it has one.
 * A clip only counts while its recorded text still matches the line, so edited
 * dialogue never plays stale audio.
 *
 * Clips are decoded into WebAudio buffers and played through the same unlocked
 * context as the music. HTML audio elements are refused by mobile browsers outside
 * a tap, which left the cutscenes silent on phones.
 */
type Manifest = Record<string, { file: string; text: string }>;

const BASE = `${import.meta.env.BASE_URL}voice/`;
let manifest: Promise<Manifest> | null = null;
const clips = new Map<string, Promise<AudioBuffer | null>>();
let current: AudioBufferSourceNode | null = null;
let token = 0;

function loadManifest() {
  manifest ??= fetch(`${BASE}manifest.json`)
    .then((r) => (r.ok ? (r.json() as Promise<Manifest>) : {}))
    .catch(() => ({}));
  return manifest;
}

function clip(file: string) {
  const ctx = audio.context;
  if (!ctx) return Promise.resolve(null);
  let p = clips.get(file);
  if (!p) {
    p = fetch(BASE + file)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((data) => new Promise<AudioBuffer>((res, rej) => void ctx.decodeAudioData(data, res, rej)))
      .catch(() => {
        clips.delete(file);
        return null;
      });
    clips.set(file, p);
  }
  return p;
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
  },

  /** Fetches and decodes a whole scene in the background so lines start without a gap. */
  async preload(sceneId: string, lines: { text: string }[]) {
    const m = await loadManifest();
    lines.forEach((l, i) => {
      const c = m[`${sceneId}.${i}`];
      if (c && c.text === l.text) void clip(c.file);
    });
  },

  /** Starts the line and resolves with its length in ms (null when silent). */
  async speak(sceneId: string, index: number, who: Speaker, text: string): Promise<number | null> {
    this.stop();
    const my = ++token;
    const entry = (await loadManifest())[`${sceneId}.${index}`];
    if (my !== token) return null;
    const ctx = audio.context;
    if (entry && entry.text === text && ctx) {
      const buf = await clip(entry.file);
      const dest = audio.voiceInput(who);
      if (my !== token || !buf || !dest) return null;
      if (ctx.state === 'suspended') void ctx.resume();
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(dest);
      audio.duckMusic(true);
      src.onended = () => {
        if (current === src) current = null;
        audio.duckMusic(false);
      };
      src.start();
      current = src;
      return buf.duration * 1000;
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
      const c = current;
      current = null;
      try {
        c.stop();
      } catch {
        /* already ended */
      }
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
