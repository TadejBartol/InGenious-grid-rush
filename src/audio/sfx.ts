import { music, type Track } from './music';

/**
 * All sound is synthesised with WebAudio: zero audio downloads, instant start, works offline.
 * The soundtrack lives in music.ts; this engine owns the context, the buses and the effects.
 */
export type Sfx =
  | 'tap'
  | 'step'
  | 'blocked'
  | 'connect'
  | 'spark'
  | 'online'
  | 'win'
  | 'fail'
  | 'star1'
  | 'star2'
  | 'star3'
  | 'tick'
  | 'alarm'
  | 'off'
  | 'on'
  | 'coin'
  | 'count'
  | 'go'
  | 'found'
  | 'wrong'
  | 'unlock'
  | 'zap'
  | 'boom'
  | 'powerup'
  | 'slice'
  | 'swipe';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private noise!: AudioBuffer;
  private heartbeat = 92;
  sfxOn = true;
  musicOn = true;

  /** Must run inside a user gesture on iOS/Chrome. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(this.ctx.destination);
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = this.sfxOn ? 0.9 : 0;
    this.sfxBus.connect(this.master);
    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = this.musicOn ? 0.5 : 0;
    this.musicBus.connect(this.master);
    const len = this.ctx.sampleRate * 0.5;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    music.attach(this.ctx, this.musicBus, this.noise);
  }

  suspend() {
    void this.ctx?.suspend();
  }

  resume() {
    void this.ctx?.resume();
  }

  setSfx(on: boolean) {
    this.sfxOn = on;
    if (this.ctx) this.sfxBus.gain.setTargetAtTime(on ? 0.9 : 0, this.ctx.currentTime, 0.02);
  }

  setMusic(on: boolean) {
    this.musicOn = on;
    music.enabled = on;
    if (this.ctx) this.musicBus.gain.setTargetAtTime(on ? 0.5 : 0, this.ctx.currentTime, 0.2);
  }

  private tone(freq: number, dur: number, opts: { type?: OscillatorType; vol?: number; to?: number; delay?: number; attack?: number } = {}) {
    const ctx = this.ctx;
    if (!ctx || !this.sfxOn) return;
    const t = ctx.currentTime + (opts.delay ?? 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = opts.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
    const vol = opts.vol ?? 0.2;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + (opts.attack ?? 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.sfxBus);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private hiss(dur: number, opts: { freq?: number; q?: number; vol?: number; delay?: number; type?: BiquadFilterType } = {}) {
    const ctx = this.ctx;
    if (!ctx || !this.sfxOn) return;
    const t = ctx.currentTime + (opts.delay ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = opts.type ?? 'bandpass';
    f.frequency.value = opts.freq ?? 2000;
    f.Q.value = opts.q ?? 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(opts.vol ?? 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start(t, Math.random() * 0.3);
    src.stop(t + dur + 0.02);
  }

  play(name: Sfx) {
    if (!this.ctx || !this.sfxOn) return;
    switch (name) {
      case 'tap':
        this.tone(880, 0.05, { vol: 0.08, type: 'triangle' });
        break;
      case 'step':
        this.tone(1400 + Math.random() * 200, 0.025, { vol: 0.04, type: 'square' });
        break;
      case 'blocked':
        this.tone(140, 0.08, { vol: 0.15, type: 'square', to: 90 });
        break;
      case 'connect':
        this.hiss(0.03, { freq: 4000, vol: 0.25 });
        this.tone(660, 0.06, { vol: 0.12, type: 'square' });
        this.tone(990, 0.09, { vol: 0.12, type: 'square', delay: 0.06 });
        break;
      case 'spark':
        this.hiss(0.35, { freq: 3200, q: 0.6, vol: 0.45 });
        this.hiss(0.12, { freq: 6000, vol: 0.3, delay: 0.08 });
        this.tone(90, 0.25, { vol: 0.3, type: 'sawtooth', to: 40 });
        break;
      case 'online':
        [523, 659, 784].forEach((f, i) => this.tone(f, 0.18, { vol: 0.12, type: 'triangle', delay: i * 0.06 }));
        break;
      case 'win':
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.5, { vol: 0.13, type: 'triangle', delay: i * 0.09 }));
        this.tone(262, 1.1, { vol: 0.1, delay: 0.36, attack: 0.05 });
        break;
      case 'fail':
        this.tone(392, 0.25, { vol: 0.14, type: 'triangle', to: 330 });
        this.tone(311, 0.5, { vol: 0.14, type: 'triangle', to: 196, delay: 0.22 });
        break;
      case 'star1':
      case 'star2':
      case 'star3': {
        const i = Number(name.slice(4)) - 1;
        const f = [880, 1109, 1319][i];
        this.tone(f, 0.6, { vol: 0.14, type: 'sine' });
        this.tone(f * 2, 0.3, { vol: 0.05, type: 'sine', delay: 0.01 });
        break;
      }
      case 'tick':
        this.hiss(0.018, { freq: 5000, q: 3, vol: 0.12, type: 'highpass' });
        break;
      case 'alarm':
        this.tone(880, 0.12, { vol: 0.14, type: 'square' });
        this.tone(660, 0.12, { vol: 0.14, type: 'square', delay: 0.14 });
        break;
      case 'off':
        this.tone(520, 0.12, { vol: 0.12, type: 'triangle', to: 220 });
        break;
      case 'on':
        this.tone(220, 0.14, { vol: 0.12, type: 'triangle', to: 560 });
        break;
      case 'coin':
        this.tone(1320, 0.07, { vol: 0.08, type: 'square' });
        this.tone(1760, 0.12, { vol: 0.08, type: 'square', delay: 0.05 });
        break;
      case 'count':
        this.tone(440, 0.12, { vol: 0.15, type: 'square' });
        break;
      case 'go':
        this.tone(880, 0.3, { vol: 0.16, type: 'square' });
        break;
      case 'found':
        this.tone(784, 0.08, { vol: 0.12, type: 'triangle' });
        this.tone(1175, 0.2, { vol: 0.12, type: 'triangle', delay: 0.07 });
        break;
      case 'wrong':
        this.tone(200, 0.18, { vol: 0.16, type: 'sawtooth', to: 120 });
        break;
      case 'unlock':
        [392, 523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.4, { vol: 0.1, type: 'triangle', delay: i * 0.07 }));
        break;
      case 'zap':
        this.tone(1800, 0.35, { vol: 0.16, type: 'sawtooth', to: 120 });
        this.hiss(0.5, { freq: 4500, q: 0.4, vol: 0.5 });
        this.hiss(0.2, { freq: 9000, vol: 0.3, delay: 0.15 });
        break;
      case 'boom':
        this.tone(70, 0.9, { vol: 0.45, type: 'sine', to: 28 });
        this.hiss(0.8, { freq: 300, q: 0.5, vol: 0.5, type: 'lowpass' });
        break;
      case 'slice':
        this.hiss(0.13, { freq: 5200, q: 1.4, vol: 0.4 });
        this.tone(1500, 0.08, { vol: 0.06, type: 'square', to: 420 });
        break;
      case 'swipe':
        this.hiss(0.14, { freq: 2600, q: 0.9, vol: 0.12 });
        break;
      case 'powerup':
        this.tone(110, 1.1, { vol: 0.14, type: 'sawtooth', to: 880, attack: 0.3 });
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.6, { vol: 0.09, type: 'triangle', delay: 0.9 + i * 0.05 }));
        break;
    }
  }

  /** Lowers the music while a story line is spoken. */
  duckMusic(on: boolean) {
    if (!this.ctx || !this.musicOn) return;
    this.musicBus.gain.setTargetAtTime(on ? 0.18 : 0.5, this.ctx.currentTime, on ? 0.1 : 0.4);
  }

  private voiceIns: Partial<Record<'genko' | 'dark' | 'narrator', GainNode>> = {};

  get context() {
    return this.ctx;
  }

  /**
   * Input of a speaker's character chain: a ring modulator gives InGenious its robot
   * timbre, grit and a low echo make the Dark Meter sound broken. Built once per speaker.
   */
  voiceInput(who: 'genko' | 'dark' | 'narrator'): AudioNode | null {
    const ctx = this.ctx;
    if (!ctx) return null;
    const cached = this.voiceIns[who];
    if (cached) return cached;
    const src = ctx.createGain();
    const out = ctx.createGain();
    out.gain.value = 1.1;
    out.connect(this.master);
    if (who === 'genko') {
      const dry = ctx.createGain();
      dry.gain.value = 0.75;
      const ring = ctx.createGain();
      ring.gain.value = 0;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 38;
      const depth = ctx.createGain();
      depth.gain.value = 0.55;
      lfo.connect(depth).connect(ring.gain);
      lfo.start();
      src.connect(dry).connect(out);
      src.connect(ring).connect(out);
    } else if (who === 'dark') {
      const shelf = ctx.createBiquadFilter();
      shelf.type = 'lowshelf';
      shelf.frequency.value = 220;
      shelf.gain.value = 7;
      const grit = ctx.createWaveShaper();
      const curve = new Float32Array(256);
      for (let k = 0; k < 256; k++) {
        const x = (k / 255) * 2 - 1;
        curve[k] = Math.tanh(x * 2.2) / Math.tanh(2.2);
      }
      grit.curve = curve;
      const echo = ctx.createDelay(0.5);
      echo.delayTime.value = 0.13;
      const fb = ctx.createGain();
      fb.gain.value = 0.28;
      src.connect(shelf).connect(grit).connect(out);
      grit.connect(echo).connect(fb).connect(echo);
      fb.connect(out);
    } else {
      src.connect(out);
    }
    this.voiceIns[who] = src;
    return src;
  }

  /** Facilities lit across the campaign: the menu theme gains a layer for each. */
  setHarmony(level: number) {
    music.lit = level;
  }

  /** Which piece plays: chosen by the screen (menu, level, boss, cutscene). */
  setTrack(track: Track) {
    music.play(track);
  }

  /** Level pressure 0..1: opens the filters and fills in the drums. */
  setIntensity(v: number) {
    music.intensity = Math.max(0, Math.min(1, v));
  }

  /** Lov na konico's heartbeat (92 calm .. 176 panic), mapped onto the level music's intensity. */
  get bpm() {
    return this.heartbeat;
  }

  set bpm(v: number) {
    this.heartbeat = v;
    const k = Math.max(0, Math.min(1, (v - 92) / 84));
    this.setIntensity(0.35 + 0.65 * k);
  }

  /** Lov na konico takes over the level music while it runs. */
  startBeat(bpm: number) {
    this.bpm = bpm;
  }

  stopBeat() {
    this.setIntensity(0.35);
  }
}

export const audio = new AudioEngine();

let hapticsOn = true;
export function setHaptics(on: boolean) {
  hapticsOn = on;
}

/** Vibration API (Android). iOS ignores it silently. */
export function buzz(pattern: number | number[]) {
  if (!hapticsOn) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* not supported */
  }
}
