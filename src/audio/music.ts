/**
 * The soundtrack: four composed pieces for a small synth band (drums, bass, pad,
 * arpeggio, lead) with reverb, tempo-synced delay and kick sidechain.
 *
 * Each piece is rendered once, off the main thread, into a seamless loop
 * (OfflineAudioContext), then simply looped. Building the notes live on a phone
 * stuttered whenever the game was busy drawing; a looping buffer costs nothing to play.
 *
 *  - menu  "Svetla mreža": A minor synthwave with its melody from the start; lit
 *          facilities bring in the drums and then the full sixteenth arpeggio.
 *  - play  "Konica": driving D minor electro under the levels; a calm and a hot mix
 *          run in sync and crossfade with the level's pressure.
 *  - boss  "Temni števec": E phrygian, heavy sixteenth bass and toms.
 *  - story "Za zaveso": slow pads under the cutscenes.
 */
export type Track = 'menu' | 'play' | 'boss' | 'story';

type Chord = { root: number; minor: boolean; seventh?: boolean };
type Note = [bar: number, step: number, midi: number, len: number];

interface Piece {
  bpm: number;
  chords: Chord[];
  kick: string;
  snare: string;
  hat: string;
  open?: string;
  bass: (step: number, chord: Chord, bar: number) => { midi: number; len: number; vel: number } | null;
  arp?: number[];
  lead?: Note[];
  padVel: number;
}

const m = (root: number, seventh = false): Chord => ({ root, minor: true, seventh });
const M = (root: number, seventh = false): Chord => ({ root, minor: false, seventh });

const PIECES: Record<Track, Piece> = {
  menu: {
    bpm: 92,
    chords: [m(45), M(41, true), M(48), M(43), m(45), M(41, true), m(50), M(40)],
    kick: 'x.......x..x....',
    snare: '....x.......x...',
    hat: '..x...x...x...x.',
    bass: (s, c) => (s === 0 ? { midi: c.root - 12, len: 7, vel: 0.9 } : s === 8 ? { midi: c.root - 12, len: 3, vel: 0.7 } : s === 12 ? { midi: c.root - 5, len: 3, vel: 0.6 } : null),
    arp: [0, 7, 12, 7, 15, 12, 19, 12],
    lead: [
      [0, 0, 76, 6], [0, 6, 74, 2], [0, 8, 72, 4], [0, 12, 69, 4],
      [1, 0, 69, 4], [1, 4, 72, 4], [1, 8, 77, 6], [1, 14, 76, 2],
      [2, 0, 76, 6], [2, 6, 79, 2], [2, 8, 76, 4], [2, 12, 72, 4],
      [3, 0, 74, 8], [3, 8, 71, 4], [3, 12, 67, 4],
      [4, 0, 76, 4], [4, 4, 81, 4], [4, 8, 79, 4], [4, 12, 76, 4],
      [5, 0, 77, 6], [5, 6, 76, 2], [5, 8, 72, 8],
      [6, 0, 74, 4], [6, 4, 77, 4], [6, 8, 81, 4], [6, 12, 79, 4],
      [7, 0, 80, 8], [7, 8, 76, 8],
    ],
    padVel: 1,
  },
  play: {
    bpm: 116,
    chords: [m(50), M(46), M(41), M(48), m(50), M(46), M(41), M(45)],
    kick: 'x...x...x...x...',
    snare: '....x.......x...',
    hat: 'xxxxxxxxxxxxxxxx',
    open: '..x...x...x...x.',
    bass: (s, c) => (s % 4 === 2 ? { midi: c.root - 12 + (s === 14 ? 12 : 0), len: 1.6, vel: 0.85 } : s === 0 ? { midi: c.root - 24, len: 1.6, vel: 1 } : null),
    arp: [0, 12, 7, 15, 12, 19, 15, 24],
    lead: [
      [0, 0, 74, 3], [0, 3, 77, 3], [0, 6, 81, 2], [0, 8, 79, 4], [0, 12, 77, 2], [0, 14, 76, 2],
      [1, 0, 74, 6], [1, 6, 70, 2], [1, 8, 74, 8],
      [2, 0, 72, 3], [2, 3, 77, 3], [2, 6, 81, 2], [2, 8, 84, 4], [2, 12, 81, 4],
      [3, 0, 79, 8], [3, 8, 76, 4], [3, 12, 72, 4],
    ],
    padVel: 0.55,
  },
  boss: {
    bpm: 128,
    chords: [m(40), M(41), m(40), M(38), M(36), M(41), m(40), M(35)],
    kick: 'x..x..x.x..x..x.',
    snare: '....x.......x...',
    hat: 'x.xxx.xxx.xxx.xx',
    open: '......x.......x.',
    bass: (s, c) => ({ midi: c.root - 12 + (s === 7 || s === 15 ? 12 : 0), len: 0.8, vel: s % 4 === 0 ? 1 : 0.65 }),
    arp: [0, 1, 7, 12, 13, 12, 7, 1],
    lead: [
      [0, 0, 76, 8], [0, 8, 77, 8], [1, 0, 76, 12], [1, 12, 74, 4],
      [2, 0, 76, 8], [2, 8, 79, 8], [3, 0, 77, 12], [3, 12, 76, 4],
    ],
    padVel: 0.6,
  },
  story: {
    bpm: 64,
    chords: [m(45, true), M(41, true), M(48), M(43)],
    kick: '................',
    snare: '................',
    hat: '................',
    bass: (s, c) => (s === 0 ? { midi: c.root - 12, len: 15, vel: 0.5 } : null),
    padVel: 0.9,
  },
};

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
const chordTones = (c: Chord) => [0, c.minor ? 3 : 4, 7, ...(c.seventh ? [c.minor ? 10 : 11] : [])];

/** Renders one loop of a piece into an offline context. */
class Band {
  private mix: GainNode;
  private duck: GainNode;
  private drums: GainNode;
  private reverbSend: GainNode;
  private delay: DelayNode;
  private delaySend: GainNode;
  private step = 0;
  private bar = 0;
  private tempo: number;

  constructor(
    private ctx: BaseAudioContext,
    private noise: AudioBuffer,
    private track: Track,
    private lit: number,
    private intensity: number,
  ) {
    this.tempo = PIECES[track].bpm;
    this.mix = ctx.createGain();
    this.mix.connect(ctx.destination);
    this.duck = ctx.createGain();
    this.duck.connect(this.mix);
    this.drums = ctx.createGain();
    this.drums.gain.value = 0.9;
    this.drums.connect(this.mix);

    // Hall reverb from a decaying noise burst.
    const reverb = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 2.6);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let k = 0; k < len; k++) d[k] = (Math.random() * 2 - 1) * Math.pow(1 - k / len, 3.2);
    }
    reverb.buffer = ir;
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.35;
    this.reverbSend.connect(reverb).connect(this.mix);

    // Dotted-eighth echo with a darkening feedback loop.
    this.delay = ctx.createDelay(2);
    this.delay.delayTime.value = (60 / this.tempo) * 0.75;
    const fb = ctx.createGain();
    fb.gain.value = 0.38;
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 2400;
    this.delaySend = ctx.createGain();
    this.delaySend.gain.value = 0.3;
    this.delaySend.connect(this.delay);
    this.delay.connect(tone).connect(fb).connect(this.delay);
    tone.connect(this.mix);
  }

  /** Bars in one full cycle: one pass through the chord progression. */
  static bars(track: Track) {
    return PIECES[track].chords.length;
  }

  static loopSeconds(track: Track) {
    return (Band.bars(track) * 16 * 60) / PIECES[track].bpm / 4;
  }

  /** Schedules every note of one cycle starting at t = 0. */
  score() {
    const p = PIECES[this.track];
    const dur = 60 / this.tempo / 4;
    const steps = Band.bars(this.track) * 16;
    for (let k = 0; k < steps; k++) {
      this.step = k % 16;
      this.bar = Math.floor(k / 16);
      this.playStep(p, k * dur, dur);
    }
  }

  private layers() {
    if (this.track !== 'menu') return { bass: true, arp: this.track !== 'story', drums: this.track !== 'story', lead: this.track !== 'story' };
    // The melody and its harmony are there from the first minute; the campaign adds the groove.
    return { bass: true, arp: true, drums: this.lit >= 2, lead: true };
  }

  private playStep(p: Piece, t: number, dur: number) {
    const s = this.step;
    const bar = this.bar;
    const chord = p.chords[bar % p.chords.length];
    const L = this.layers();
    const busy = this.track === 'play' ? this.intensity : 1;

    if (s === 0) this.pad(chord, t, dur * 16, p.padVel);
    if (L.bass) {
      const b = p.bass(s, chord, bar);
      if (b) this.bass(b.midi, t, b.len * dur, b.vel);
    }
    if (L.drums) {
      if (p.kick[s] === 'x') this.kick(t);
      if (p.snare[s] === 'x') this.snare(t, this.track === 'menu' ? 0.35 : 0.7);
      // Hats thin out when the level is calm and fill in as the pressure rises.
      if (p.hat[s] === 'x' && (s % 2 === 0 || busy > 0.45)) this.hat(t, s % 4 === 2 ? 0.09 : 0.05, 0.04);
      if (p.open?.[s] === 'x' && busy > 0.25) this.hat(t, 0.06, 0.16);
      // Fill into every eighth bar.
      if (bar % 8 === 7 && s >= 12 && (this.track === 'boss' || busy > 0.7)) this.tom(t, 160 - (s - 12) * 22);
    }
    if (L.arp && p.arp) {
      const tones = chordTones(chord);
      const off = p.arp[s % p.arp.length];
      // Map the pattern's interval onto the actual chord quality.
      const deg = off % 12;
      const fixed = deg === 3 || deg === 4 ? tones[1] : deg;
      const midi = chord.root + 12 + Math.floor(off / 12) * 12 + fixed;
      if (this.track !== 'menu' || s % 2 === 0 || this.lit >= 5) this.pluck(midi, t, dur * 1.8, 0.5 + 0.5 * busy);
    }
    if (L.lead && p.lead) {
      const loop = Math.max(...p.lead.map((n) => n[0])) + 1;
      for (const [nb, ns, midi, len] of p.lead) if (nb === bar % loop && ns === s) this.lead(midi, t, len * dur);
    }
  }

  // ---------- instruments ----------

  private env(g: GainNode, t: number, a: number, peak: number, hold: number, r: number) {
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setValueAtTime(peak, t + a + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + r);
  }

  private pad(c: Chord, t: number, len: number, vel: number) {
    const ctx = this.ctx;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(this.track === 'boss' ? 700 : 1100, t);
    f.frequency.linearRampToValueAtTime(this.track === 'play' ? 900 + 1400 * this.intensity : 1600, t + len * 0.6);
    f.Q.value = 0.7;
    const g = ctx.createGain();
    const a = Math.min(0.8, len * 0.25);
    this.env(g, t, a, 0.05 * vel, len * 0.6, len * 0.5);
    const end = t + a + len * 1.1 + 0.1;
    f.connect(g);
    g.connect(this.duck);
    g.connect(this.reverbSend);
    const notes = chordTones(c).map((x) => c.root + 12 + x);
    for (const n of notes)
      for (const det of [-7, 7]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = hz(n);
        o.detune.value = det;
        o.connect(f);
        o.start(t);
        o.stop(end);
      }
  }

  private bass(midi: number, t: number, len: number, vel: number) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = this.track === 'boss' ? 'sawtooth' : 'square';
    o.frequency.value = hz(midi);
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = hz(midi);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(this.track === 'boss' ? 1100 : 700, t);
    f.frequency.exponentialRampToValueAtTime(220, t + Math.max(0.08, len));
    f.Q.value = 4;
    const g = ctx.createGain();
    this.env(g, t, 0.006, 0.16 * vel, len * 0.5, len * 0.6 + 0.05);
    const sg = ctx.createGain();
    sg.gain.value = 0.9;
    o.connect(f).connect(g);
    sub.connect(sg).connect(g);
    g.connect(this.duck);
    o.start(t);
    sub.start(t);
    o.stop(t + len * 1.2 + 0.1);
    sub.stop(t + len * 1.2 + 0.1);
  }

  private pluck(midi: number, t: number, len: number, vel: number) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = hz(midi);
    const o2 = ctx.createOscillator();
    o2.type = 'triangle';
    o2.frequency.value = hz(midi + 12);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    const open = this.track === 'play' ? 1200 + 3800 * this.intensity : this.track === 'boss' ? 3200 : 2600;
    f.frequency.setValueAtTime(open, t);
    f.frequency.exponentialRampToValueAtTime(400, t + len);
    const g = ctx.createGain();
    this.env(g, t, 0.003, 0.035 * vel, 0.01, len);
    o.connect(f);
    o2.connect(f);
    f.connect(g);
    g.connect(this.mix);
    g.connect(this.delaySend);
    o.start(t);
    o2.start(t);
    o.stop(t + len + 0.1);
    o2.stop(t + len + 0.1);
  }

  private lead(midi: number, t: number, len: number) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = this.track === 'boss' ? 'sawtooth' : 'triangle';
    o.frequency.value = hz(midi);
    const o2 = ctx.createOscillator();
    o2.type = 'sawtooth';
    o2.frequency.value = hz(midi);
    o2.detune.value = 9;
    // Delayed vibrato, like a held synth lead.
    const vib = ctx.createOscillator();
    vib.frequency.value = 5.2;
    const vd = ctx.createGain();
    vd.gain.setValueAtTime(0, t);
    vd.gain.linearRampToValueAtTime(hz(midi) * 0.006, t + Math.min(0.4, len));
    vib.connect(vd);
    vd.connect(o.frequency);
    vd.connect(o2.frequency);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 2600;
    const g = ctx.createGain();
    const mix = ctx.createGain();
    mix.gain.value = 0.35;
    this.env(g, t, 0.03, 0.06, Math.max(0, len - 0.1), 0.35);
    o.connect(f);
    o2.connect(mix).connect(f);
    f.connect(g);
    g.connect(this.mix);
    g.connect(this.delaySend);
    g.connect(this.reverbSend);
    for (const x of [o, o2, vib]) {
      x.start(t);
      x.stop(t + len + 0.5);
    }
  }

  private kick(t: number) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(this.track === 'menu' ? 0.3 : 0.45, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    o.connect(g).connect(this.drums);
    o.start(t);
    o.stop(t + 0.35);
    // Sidechain: pads and bass breathe with the kick.
    this.duck.gain.cancelScheduledValues(t);
    this.duck.gain.setValueAtTime(0.45, t);
    this.duck.gain.linearRampToValueAtTime(1, t + 0.22);
  }

  private snare(t: number, vol: number) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1900;
    f.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.22 * vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    src.connect(f).connect(g);
    g.connect(this.drums);
    g.connect(this.reverbSend);
    src.start(t, Math.random() * 0.3);
    src.stop(t + 0.2);
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(140, t + 0.08);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.16 * vol, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    o.connect(og).connect(this.drums);
    o.start(t);
    o.stop(t + 0.12);
  }

  private hat(t: number, vol: number, len: number) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.connect(f).connect(g).connect(this.drums);
    src.start(t, Math.random() * 0.3);
    src.stop(t + len + 0.02);
  }

  private tom(t: number, freq: number) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 0.55, t + 0.2);
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.connect(g);
    g.connect(this.drums);
    g.connect(this.reverbSend);
    o.start(t);
    o.stop(t + 0.28);
  }
}

/** Menu layering steps: the arrangement only changes at these lit-facility counts. */
const MENU_STEPS = [0, 2, 5];
const SAMPLE_RATE = 32000;

type Loop = { buffer: AudioBuffer; seconds: number };

/** Plays the rendered loops and crossfades between them. */
export class Music {
  private ctx: AudioContext | null = null;
  private out!: GainNode;
  private noise!: AudioBuffer;
  private cache = new Map<string, Promise<Loop>>();
  /** What is sounding now: one source per mix (play has a calm and a hot one). */
  private voices: { key: string; src: AudioBufferSourceNode; gain: GainNode; role: 'main' | 'calm' | 'hot' }[] = [];
  private track: Track | null = null;
  private wanted: Track = 'menu';
  private menuStep = 0;
  private startedAt = 0;
  private token = 0;
  private _intensity = 0.35;
  private _enabled = true;

  attach(ctx: AudioContext, dest: AudioNode, noise: AudioBuffer) {
    this.ctx = ctx;
    this.noise = noise;
    this.out = ctx.createGain();
    this.out.connect(dest);
    // The rest is rendered a little later, so it never competes with the first screens.
    void this.switchTo(this.wanted).then(() => window.setTimeout(() => void this.prewarm(), 4000));
  }

  /** Renders the other pieces in the background, one after another, so later switches are instant. */
  private async prewarm() {
    for (const [track, role] of [['play', 'calm'], ['play', 'hot'], ['story', 'main'], ['boss', 'main']] as const) {
      if (!this._enabled) return;
      await this.loop(track, role);
    }
  }

  /** Facilities lit across the campaign: the menu theme adds a layer as they light up. */
  set lit(n: number) {
    const step = MENU_STEPS.filter((x) => x <= n).length - 1;
    if (step === this.menuStep) return;
    this.menuStep = step;
    if (this.track === 'menu') void this.switchTo('menu', true);
  }

  /** 0..1: how hard the level music pushes; crossfades the calm and the hot mix. */
  set intensity(v: number) {
    this._intensity = v;
    this.applyIntensity(0.4);
  }

  get intensity() {
    return this._intensity;
  }

  /** With music off nothing plays and nothing is rendered. */
  set enabled(on: boolean) {
    // Settings are re-applied on every store change (once a second with the idle
    // trickle); restarting here made the music jump back to its first bars each time.
    if (on === this._enabled) return;
    this._enabled = on;
    if (!on) this.fadeOut(this.voices, 0.3);
    else if (this.ctx) {
      this.track = null;
      void this.switchTo(this.wanted);
    }
  }

  get current() {
    return this.track;
  }

  play(track: Track) {
    this.wanted = track;
    if (track !== this.track) void this.switchTo(track);
  }

  private key(track: Track, role: 'main' | 'calm' | 'hot') {
    return track === 'menu' ? `menu:${this.menuStep}` : `${track}:${role}`;
  }

  private loop(track: Track, role: 'main' | 'calm' | 'hot'): Promise<Loop> {
    const key = this.key(track, role);
    let p = this.cache.get(key);
    if (!p) {
      const lit = track === 'menu' ? MENU_STEPS[this.menuStep] : 0;
      const intensity = role === 'hot' ? 1 : role === 'calm' ? 0.3 : 0.5;
      p = renderLoop(track, lit, intensity, this.noise);
      this.cache.set(key, p);
      // Only one menu arrangement is ever needed again: drop the older ones.
      for (const k of [...this.cache.keys()]) if (k.startsWith('menu:') && k !== key && track === 'menu') this.cache.delete(k);
    }
    return p;
  }

  /** Starts `track`; `inPlace` keeps the musical position (a new menu layer joins in time). */
  private async switchTo(track: Track, inPlace = false) {
    const ctx = this.ctx;
    this.track = track;
    if (!ctx || !this._enabled) return;
    const my = ++this.token;
    const roles: ('main' | 'calm' | 'hot')[] = track === 'play' ? ['calm', 'hot'] : ['main'];
    const loops = await Promise.all(roles.map((r) => this.loop(track, r)));
    if (my !== this.token || !this._enabled) return;
    const old = this.voices;
    const t = ctx.currentTime + 0.05;
    const offset = inPlace ? (t - this.startedAt) % loops[0].seconds : 0;
    if (!inPlace) this.startedAt = t;
    this.voices = roles.map((role, k) => {
      const src = ctx.createBufferSource();
      src.buffer = loops[k].buffer;
      src.loop = true;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(gain).connect(this.out);
      src.start(t, offset);
      return { key: this.key(track, role), src, gain, role };
    });
    const fadeIn = inPlace ? 1.5 : track === 'story' ? 2.5 : 1.2;
    this.applyIntensity(fadeIn, t);
    this.fadeOut(old, inPlace ? 1.5 : 0.5);
  }

  private applyIntensity(tc: number, at?: number) {
    if (!this.ctx) return;
    const t = at ?? this.ctx.currentTime;
    const k = Math.max(0, Math.min(1, (this._intensity - 0.3) / 0.7));
    for (const v of this.voices) {
      const target = v.role === 'main' ? 1 : v.role === 'hot' ? k : 1 - k;
      v.gain.gain.cancelScheduledValues(t);
      v.gain.gain.setValueAtTime(v.gain.gain.value, t);
      v.gain.gain.linearRampToValueAtTime(target, t + tc);
    }
  }

  private fadeOut(list: typeof this.voices, sec: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const v of list) {
      v.gain.gain.cancelScheduledValues(t);
      v.gain.gain.setValueAtTime(v.gain.gain.value, t);
      v.gain.gain.linearRampToValueAtTime(0, t + sec);
      v.src.stop(t + sec + 0.05);
    }
    if (list === this.voices) this.voices = [];
  }
}

/** Renders one cycle plus its reverb tail, then folds the tail onto the start so the loop is seamless. */
async function renderLoop(track: Track, lit: number, intensity: number, noise: AudioBuffer): Promise<Loop> {
  const seconds = Band.loopSeconds(track);
  const tail = 3;
  const n = Math.ceil(seconds * SAMPLE_RATE);
  const ctx = new OfflineAudioContext(2, n + tail * SAMPLE_RATE, SAMPLE_RATE);
  new Band(ctx, noise, track, lit, intensity).score();
  const full = await ctx.startRendering();
  const buffer = new AudioBuffer({ numberOfChannels: 2, length: n, sampleRate: SAMPLE_RATE });
  for (let ch = 0; ch < 2; ch++) {
    const src = full.getChannelData(ch);
    const dst = buffer.getChannelData(ch);
    dst.set(src.subarray(0, n));
    for (let k = n; k < src.length; k++) dst[k - n] += src[k];
  }
  return { buffer, seconds: n / SAMPLE_RATE };
}

export const music = new Music();
