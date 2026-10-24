/**
 * All sound is synthesised with WebAudio: zero audio downloads, instant start, works offline.
 * The ambient pad grows more consonant as more facilities are lit.
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
  | 'unlock';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private noise!: AudioBuffer;
  private pad: { voices: { osc: OscillatorNode; gain: GainNode }[]; gain: GainNode } | null = null;
  private beatTimer: number | null = null;
  private nextBeat = 0;
  private beatIndex = 0;
  bpm = 100;
  sfxOn = true;
  musicOn = true;
  private harmony = 0;

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
    this.startPad();
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
    }
  }

  /** 0 = only the Dark Meter's dissonance, each lit facility adds a consonant voice. */
  setHarmony(level: number) {
    this.harmony = level;
    if (this.pad) this.retunePad();
  }

  private startPad() {
    const ctx = this.ctx!;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(0.06, ctx.currentTime, 2);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.07;
    lfoGain.gain.value = 400;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start();
    filter.connect(gain).connect(this.musicBus);
    const voices = Array.from({ length: 6 }, (_, i) => {
      const osc = ctx.createOscillator();
      osc.type = i < 2 ? 'sawtooth' : 'triangle';
      const g = ctx.createGain();
      g.gain.value = 0;
      osc.connect(g).connect(filter);
      osc.start();
      return { osc, gain: g };
    });
    this.pad = { voices, gain };
    this.retunePad();
  }

  private retunePad() {
    if (!this.ctx || !this.pad) return;
    const t = this.ctx.currentTime;
    // A minor drone with a rubbing B♭; lit facilities resolve it into A major add9.
    const dark = [110, 116.5];
    const bright = [110, 164.8, 277.2, 329.6, 440, 493.9];
    const voices = this.harmony === 0 ? [...dark, 0, 0, 0, 0] : bright.map((f, i) => (i <= this.harmony + 1 ? f : 0));
    this.pad.voices.forEach((v, i) => {
      const f = voices[i];
      if (f > 0) {
        v.osc.frequency.setTargetAtTime(f, t, 0.8);
        v.gain.gain.setTargetAtTime(i < 2 ? 0.22 : 0.12, t, 1.5);
      } else v.gain.gain.setTargetAtTime(0, t, 1.5);
    });
  }

  /** Lov na konico drives the tempo up as time runs out. */
  startBeat(bpm: number) {
    if (!this.ctx) return;
    this.stopBeat();
    this.bpm = bpm;
    this.nextBeat = this.ctx.currentTime + 0.1;
    this.beatIndex = 0;
    this.beatTimer = window.setInterval(() => this.schedule(), 25);
  }

  stopBeat() {
    if (this.beatTimer !== null) window.clearInterval(this.beatTimer);
    this.beatTimer = null;
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx) return;
    while (this.nextBeat < ctx.currentTime + 0.1) {
      const t = this.nextBeat;
      if (this.musicOn) {
        if (this.beatIndex % 2 === 0) this.kick(t);
        this.hat(t, this.beatIndex % 2 === 1 ? 0.06 : 0.03);
      }
      this.nextBeat += 60 / this.bpm / 2;
      this.beatIndex++;
    }
  }

  private kick(t: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g).connect(this.musicBus);
    o.start(t);
    o.stop(t + 0.2);
  }

  private hat(t: number, vol: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    src.connect(f).connect(g).connect(this.musicBus);
    src.start(t);
    src.stop(t + 0.05);
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
