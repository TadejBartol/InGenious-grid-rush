import { createRng, type Rng } from '../../core/rng';
import type { PrestreziParams } from '../../core/types';

/**
 * Prestrezi: sensors in the hospital fire their readings up through the screen and
 * the Dark Meter slips fakes in between. A swipe cuts the fakes before they reach the
 * patient's record; real readings, and above all real alarms, must be left alone.
 * The world is a fixed W × H box; the view scales it to the screen.
 */

export const W = 360;
export const H = 640;
const GRAVITY = 650;
/** How far the finger has to travel in one stroke before it cuts (no tap-and-hold). */
const MIN_TRAVEL = 6;
const SLOW_FACTOR = 0.4;

export type ItemKind = 'real' | 'fake' | 'alarm' | 'armored' | 'ai' | 'shield';

export interface Item {
  id: number;
  kind: ItemKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  rot: number;
  vr: number;
  /** Armored packets take one hit per stroke. */
  hp: number;
  maxHp: number;
  /** A disguised fake looks real until this time. */
  revealAt: number;
  label: string;
  born: number;
  /** Small fakes released by a destroyed armored packet. */
  shard?: boolean;
}

export interface Launch {
  t: number;
  kind: ItemKind;
  x: number;
  vx: number;
  vy: number;
  cloak: boolean;
}

export type PrestreziEvent =
  | { type: 'launch'; item: Item }
  | { type: 'cut'; item: Item; angle: number; combo: number }
  | { type: 'hit'; item: Item; angle: number }
  | { type: 'badcut'; item: Item; angle: number }
  | { type: 'miss'; item: Item }
  | { type: 'saved'; item: Item }
  | { type: 'reveal'; item: Item }
  | { type: 'slowmo'; item: Item; angle: number }
  | { type: 'purge'; item: Item; angle: number; items: Item[] }
  | { type: 'combo'; count: number; x: number; y: number; bonus: number }
  | { type: 'life'; lives: number }
  | { type: 'won' }
  | { type: 'lost' };

const RADIUS: Record<ItemKind, number> = { real: 30, fake: 30, alarm: 32, armored: 44, ai: 28, shield: 28 };
const FAKE_LABELS = ['31°', '−40°', '###', '99°', '0xFF', '??', '−0°', '88°'];

const isFake = (it: Item) => it.kind === 'fake' || it.kind === 'armored';
/** Forgiving blade: fakes and power-ups are easy to hit, real readings hard to clip by accident. */
const hitRadius = (it: Item) => (it.kind === 'real' || it.kind === 'alarm' ? it.r * 0.62 : it.r * 1.1);

/** A throw from below the screen that peaks at apexY and comes down near xEnd. */
function arc(rng: Rng, x0: number, apexY: number, speed: number) {
  const g = GRAVITY * speed * speed;
  const y0 = H + 40;
  const vy = -Math.sqrt(2 * g * (y0 - apexY));
  const flight = (2 * -vy) / g;
  const xEnd = Math.min(W - 40, Math.max(40, x0 + (rng.next() - 0.5) * 220));
  return { vx: (xEnd - x0) / flight, vy };
}

/** The whole round's throws, fixed by the seed: volleys get bigger and closer together. */
export function schedule(p: PrestreziParams): Launch[] {
  const rng = createRng(p.seed);
  const speed = p.speed ?? 1;
  const out: Launch[] = [];
  const end = p.durationSec - 1.6;
  const special: ItemKind[] = [...Array(p.armored ?? 0).fill('armored'), ...Array(p.ai ?? 0).fill('ai'), ...Array(p.shield ?? 0).fill('shield')];
  // Spread the specials and the combo clusters evenly over the middle of the round.
  const slots = (n: number, from: number, to: number) => Array.from({ length: n }, (_, i) => from + ((to - from) * (i + 0.5)) / n + (rng.next() - 0.5) * 2);
  const specialAt = rng.shuffle(special).map((k, i, a) => ({ kind: k, t: slots(a.length, end * 0.2, end * 0.95)[i] }));
  const clusterAt = slots(p.clusters ?? 0, end * 0.15, end * 0.9);
  let clustered = 0;
  let t = 0.9;
  while (t < end) {
    const f = t / end;
    const gap = p.gap[0] + (p.gap[1] - p.gap[0]) * f;
    const max = Math.round(p.volley[0] + (p.volley[1] - p.volley[0]) * f);
    const cluster = clusterAt.findIndex((c) => c <= t);
    if (cluster >= 0) {
      clusterAt.splice(cluster, 1);
      // Three or four fakes on one line, side by side: one swipe takes them all.
      const n = clustered++ % 2 ? 4 : 3;
      const x0 = 50 + rng.next() * (W - 100 - (n - 1) * 62);
      const apex = H * (0.2 + rng.next() * 0.12);
      const a = arc(rng, x0, apex, speed);
      for (let i = 0; i < n; i++) out.push({ t, kind: 'fake', x: x0 + i * 62, vx: a.vx * 0.3, vy: a.vy, cloak: false });
      t += gap * 1.3;
      continue;
    }
    const n = rng.int(1, Math.max(1, max));
    const stagger = n > 2 && rng.chance(0.4);
    const used: number[] = [];
    for (let i = 0; i < n; i++) {
      let x = 50 + rng.next() * (W - 100);
      for (let k = 0; k < 6 && used.some((u) => Math.abs(u - x) < 95); k++) x = 50 + rng.next() * (W - 100);
      used.push(x);
      const roll = rng.next();
      const kind: ItemKind = roll < p.fake ? 'fake' : roll < p.fake + (p.alarm ?? 0) ? 'alarm' : 'real';
      const a = arc(rng, x, H * (0.1 + rng.next() * 0.32), speed);
      out.push({ t: t + (stagger ? i * 0.16 : rng.next() * 0.08), kind, x, vx: a.vx, vy: a.vy, cloak: kind === 'fake' && rng.chance(p.cloak ?? 0) });
    }
    const due = specialAt.filter((s) => s.t <= t);
    for (const s of due) {
      specialAt.splice(specialAt.indexOf(s), 1);
      const x = 80 + rng.next() * (W - 160);
      const a = arc(rng, x, H * (s.kind === 'armored' ? 0.22 : 0.18 + rng.next() * 0.15), speed * (s.kind === 'armored' ? 0.85 : 1));
      out.push({ t: t + 0.25, kind: s.kind, x, vx: a.vx * 0.5, vy: a.vy, cloak: false });
    }
    t += gap * (0.8 + rng.next() * 0.4);
  }
  return out.sort((a, b) => a.t - b.t);
}

export class PrestreziGame {
  readonly params: PrestreziParams;
  readonly plan: Launch[];
  readonly speed: number;
  time = 0;
  items: Item[] = [];
  lives: number;
  readonly maxLives: number;
  score = 0;
  caught = 0;
  missed = 0;
  saved = 0;
  mistakes = 0;
  bestCombo = 0;
  fakesTotal = 0;
  slowLeft = 0;
  finished: 'won' | 'lost' | null = null;
  private next = 0;
  private nextId = 1;
  private rng: Rng;
  private stroke: { x: number; y: number; travel: number; hit: Set<number>; fakes: number; at: { x: number; y: number } } | null = null;
  private listeners: ((e: PrestreziEvent) => void)[] = [];

  constructor(p: PrestreziParams, extraLives = 0) {
    this.params = p;
    this.plan = schedule(p);
    this.speed = p.speed ?? 1;
    this.lives = this.maxLives = p.lives + extraLives;
    this.rng = createRng(p.seed ^ 0x5bd1e995);
    this.fakesTotal = this.plan.filter((l) => l.kind === 'fake' || l.kind === 'armored').length;
  }

  on(fn: (e: PrestreziEvent) => void) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  private emit(e: PrestreziEvent) {
    for (const l of this.listeners) l(e);
  }

  get timeLeft() {
    return Math.max(0, this.params.durationSec - this.time);
  }

  get slowmo() {
    return this.slowLeft > 0;
  }

  /** True while a disguised fake still looks like a real reading. */
  disguised(it: Item) {
    return it.kind === 'fake' && this.time < it.revealAt;
  }

  private spawn(l: Launch) {
    const r = RADIUS[l.kind];
    const flight = (2 * -l.vy) / (GRAVITY * this.speed * this.speed);
    const it: Item = {
      id: this.nextId++,
      kind: l.kind,
      x: l.x,
      y: H + 40,
      vx: l.vx,
      vy: l.vy,
      r,
      rot: this.rng.next() * Math.PI * 2,
      vr: (this.rng.next() - 0.5) * (l.kind === 'armored' ? 1.2 : 3),
      hp: l.kind === 'armored' ? 3 : 1,
      maxHp: l.kind === 'armored' ? 3 : 1,
      revealAt: l.cloak ? this.time + flight * 0.42 : -1,
      label: this.label(l.kind),
      born: this.time,
    };
    this.items.push(it);
    this.emit({ type: 'launch', item: it });
  }

  private label(kind: ItemKind) {
    const c = (v: number) => `${v.toFixed(1).replace('.', ',')}°`;
    if (kind === 'real') return c(2.4 + this.rng.next() * 5.4);
    if (kind === 'alarm') return c(8.6 + this.rng.next() * 3);
    if (kind === 'fake' || kind === 'armored') return this.rng.pick(FAKE_LABELS);
    return kind === 'ai' ? 'AI' : '✓';
  }

  update(dt: number) {
    if (this.finished) return;
    const real = dt;
    if (this.slowLeft > 0) {
      this.slowLeft = Math.max(0, this.slowLeft - real);
      dt *= SLOW_FACTOR;
    }
    this.time += dt;
    while (this.next < this.plan.length && this.plan[this.next].t <= this.time) this.spawn(this.plan[this.next++]);
    const g = GRAVITY * this.speed * this.speed;
    for (const it of [...this.items]) {
      it.vy += g * dt;
      it.x += it.vx * dt;
      it.y += it.vy * dt;
      it.rot += it.vr * dt;
      if (it.x < it.r && it.vx < 0) it.vx = -it.vx;
      if (it.x > W - it.r && it.vx > 0) it.vx = -it.vx;
      if (it.revealAt > 0 && this.time >= it.revealAt && it.revealAt > this.time - dt) this.emit({ type: 'reveal', item: it });
      if (it.vy > 0 && it.y > H + it.r + 10) {
        this.items.splice(this.items.indexOf(it), 1);
        if (isFake(it)) {
          this.missed++;
          this.emit({ type: 'miss', item: it });
          this.loseLife();
        } else if (it.kind === 'real' || it.kind === 'alarm') {
          this.saved++;
          this.score += 2;
          this.emit({ type: 'saved', item: it });
        }
      }
      if (this.finished) return;
    }
    if (this.time >= this.params.durationSec && this.next >= this.plan.length && !this.items.length) this.end('won');
  }

  private loseLife() {
    this.lives = Math.max(0, this.lives - 1);
    this.emit({ type: 'life', lives: this.lives });
    if (this.lives === 0) this.end('lost');
  }

  private end(how: 'won' | 'lost') {
    if (this.finished) return;
    if (this.stroke) this.endStroke();
    this.finished = how;
    this.emit({ type: how });
  }

  beginStroke(x: number, y: number) {
    if (this.stroke) this.endStroke();
    this.stroke = { x, y, travel: 0, hit: new Set(), fakes: 0, at: { x, y } };
  }

  /** Moves the blade; everything the segment since the last point crosses gets cut. */
  strokeTo(x: number, y: number) {
    const s = this.stroke;
    if (!s || this.finished) return;
    const x0 = s.x;
    const y0 = s.y;
    const len = Math.hypot(x - x0, y - y0);
    s.x = x;
    s.y = y;
    s.travel += len;
    if (s.travel < MIN_TRAVEL || len === 0) return;
    const angle = Math.atan2(y - y0, x - x0);
    for (const it of [...this.items]) {
      if (s.hit.has(it.id) || !this.items.includes(it)) continue;
      if (segDist(x0, y0, x, y, it.x, it.y) > hitRadius(it)) continue;
      s.hit.add(it.id);
      this.cut(it, angle);
      if (this.finished) return;
    }
  }

  endStroke() {
    const s = this.stroke;
    this.stroke = null;
    if (!s || s.fakes < 3) return;
    const bonus = s.fakes * 10;
    this.score += bonus;
    this.bestCombo = Math.max(this.bestCombo, s.fakes);
    this.emit({ type: 'combo', count: s.fakes, x: s.at.x, y: s.at.y, bonus });
  }

  private remove(it: Item) {
    const i = this.items.indexOf(it);
    if (i >= 0) this.items.splice(i, 1);
  }

  private cut(it: Item, angle: number) {
    const s = this.stroke!;
    switch (it.kind) {
      case 'fake':
      case 'armored': {
        if (it.kind === 'armored' && --it.hp > 0) {
          it.vy = Math.min(it.vy, it.vy * 0.5 - 60);
          this.score += 5;
          this.emit({ type: 'hit', item: it, angle });
          return;
        }
        this.remove(it);
        this.caught++;
        s.fakes++;
        s.at = { x: it.x, y: it.y };
        this.bestCombo = Math.max(this.bestCombo, 1);
        this.score += it.kind === 'armored' ? 30 : 10;
        this.emit({ type: 'cut', item: it, angle, combo: s.fakes });
        if (it.kind === 'armored' && this.params.splits) this.split(it);
        return;
      }
      case 'real':
      case 'alarm':
        this.remove(it);
        this.mistakes++;
        this.emit({ type: 'badcut', item: it, angle });
        this.loseLife();
        return;
      case 'ai':
        this.remove(it);
        this.slowLeft = this.params.slowSec ?? 3;
        this.emit({ type: 'slowmo', item: it, angle });
        return;
      case 'shield': {
        this.remove(it);
        const purged = this.items.filter((x) => x.kind === 'fake');
        for (const x of purged) this.remove(x);
        this.caught += purged.length;
        this.score += purged.length * 10;
        if (purged.length >= 3) this.bestCombo = Math.max(this.bestCombo, purged.length);
        this.emit({ type: 'purge', item: it, angle, items: purged });
        return;
      }
    }
  }

  /**
   * A safe cut for the playtest bot: a straight line through one or more revealed fakes
   * that stays clear of every real reading. Takes a whole cluster when it can.
   */
  suggestCut(lead = 0): { x0: number; y0: number; x1: number; y1: number } | null {
    const at = (it: Item) => ({ x: it.x + it.vx * lead, y: it.y + it.vy * lead + 0.5 * GRAVITY * this.speed * this.speed * lead * lead });
    const danger = this.items.filter((it) => it.kind === 'real' || it.kind === 'alarm' || this.disguised(it)).map((it) => ({ ...at(it), r: it.r }));
    const safe = (x0: number, y0: number, x1: number, y1: number) => danger.every((d) => segDist(x0, y0, x1, y1, d.x, d.y) > d.r * 0.92 + 5);
    const targets = this.items
      .filter((it) => (isFake(it) && !this.disguised(it)) || it.kind === 'ai' || it.kind === 'shield')
      .map((it) => ({ it, ...at(it) }))
      .filter((t) => t.y > 30 && t.y < H - 30);
    targets.sort((a, b) => b.y - a.y);
    for (const t of targets) {
      const row = targets.filter((o) => Math.abs(o.y - t.y) < 22).sort((a, b) => a.x - b.x);
      if (row.length >= 3) {
        const x0 = row[0].x - row[0].it.r;
        const x1 = row[row.length - 1].x + row[row.length - 1].it.r;
        const y = row.reduce((a, o) => a + o.y, 0) / row.length;
        if (safe(x0, y, x1, y)) return { x0, y0: y, x1, y1: y };
      }
    }
    const inRow = (t: (typeof targets)[number]) => targets.filter((o) => Math.abs(o.y - t.y) < 22).length >= 3;
    for (const t of targets) {
      // Leave a rising cluster for one combo swipe.
      if (t.it.vy < 0 && inRow(t)) continue;
      const r = Math.max(10, t.it.r * 0.6);
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 8;
        const dx = Math.cos(a) * r;
        const dy = Math.sin(a) * r;
        if (safe(t.x - dx, t.y - dy, t.x + dx, t.y + dy)) return { x0: t.x - dx, y0: t.y - dy, x1: t.x + dx, y1: t.y + dy };
      }
    }
    return null;
  }

  /** A destroyed armored packet bursts into two small fakes that fly apart. */
  private split(it: Item) {
    for (const dir of [-1, 1]) {
      const shard: Item = {
        ...it,
        id: this.nextId++,
        kind: 'fake',
        r: 22,
        hp: 1,
        maxHp: 1,
        vx: dir * (90 + this.rng.next() * 60),
        vy: -420 - this.rng.next() * 120,
        revealAt: -1,
        label: this.rng.pick(FAKE_LABELS),
        shard: true,
        born: this.time,
      };
      this.items.push(shard);
      this.fakesTotal++;
      this.emit({ type: 'launch', item: shard });
    }
  }
}

/** Distance from point (px, py) to the segment (x0, y0)–(x1, y1). */
export function segDist(x0: number, y0: number, x1: number, y1: number, px: number, py: number) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / l2)) : 0;
  return Math.hypot(x0 + t * dx - px, y0 + t * dy - py);
}

/** Plays a whole round with the bot, cutting at most once every `every` seconds. */
export function autoplay(p: PrestreziParams, opts: { every?: number; idle?: boolean } = {}) {
  const game = new PrestreziGame(p);
  const dt = 1 / 60;
  let wait = 0;
  while (!game.finished && game.time < p.durationSec + 30) {
    game.update(dt);
    wait -= dt;
    if (opts.idle || wait > 0) continue;
    const c = game.suggestCut();
    if (!c) continue;
    game.beginStroke(c.x0, c.y0);
    game.strokeTo(c.x1, c.y1);
    game.endStroke();
    wait = opts.every ?? 0;
  }
  return game;
}
