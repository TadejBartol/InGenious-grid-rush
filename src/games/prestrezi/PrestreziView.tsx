import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { PrestreziParams } from '../../core/types';
import { audio, buzz } from '../../audio/sfx';
import { GenkoSays } from '../../ui/components/Genko';
import { Hud, type GameProps } from '../shared/Hud';
import { useShake } from '../shared/useShake';
import { expose } from '../../testHooks';
import { H, PrestreziGame, W, type Item, type ItemKind } from './logic';

/**
 * Drawn on one 2D canvas: sprites for every kind of reading are painted once (glow
 * included) and then only blitted, so a phone keeps 60 fps with a screen full of
 * readings, halves and sparks.
 */

const SANS = "700 1px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const font = (px: number, weight = 800) => SANS.replace('700', String(weight)).replace('1px', `${px}px`);
const PAD = 14;

type Sprite = { img: HTMLCanvasElement; size: number };

function canvas(size: number, scale: number) {
  const c = document.createElement('canvas');
  c.width = c.height = Math.ceil(size * scale);
  const g = c.getContext('2d')!;
  g.scale(scale, scale);
  g.translate(size / 2, size / 2);
  return { c, g };
}

/** Irregular spikes: every fake looks a little different but the same on every frame. */
function spikes(g: CanvasRenderingContext2D, r: number, n: number, seed: number) {
  g.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2;
    const j = Math.sin(seed * 12.9898 + i * 78.233) * 0.5 + 0.5;
    const rr = i % 2 ? r * (0.72 + j * 0.08) : r * (0.98 + j * 0.12);
    g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  g.closePath();
}

function hexagon(g: CanvasRenderingContext2D, r: number) {
  g.beginPath();
  for (let i = 0; i < 6; i++) g.lineTo(Math.cos((i / 6) * Math.PI * 2 + Math.PI / 6) * r, Math.sin((i / 6) * Math.PI * 2 + Math.PI / 6) * r);
  g.closePath();
}

function eye(g: CanvasRenderingContext2D, r: number) {
  g.fillStyle = '#12010a';
  g.beginPath();
  g.ellipse(0, -r * 0.18, r * 0.42, r * 0.24, 0, 0, Math.PI * 2);
  g.fill();
  const pupil = g.createRadialGradient(0, -r * 0.18, 0, 0, -r * 0.18, r * 0.16);
  pupil.addColorStop(0, '#fff2f2');
  pupil.addColorStop(0.35, '#ff3355');
  pupil.addColorStop(1, 'rgba(255,0,60,0)');
  g.fillStyle = pupil;
  g.beginPath();
  g.arc(0, -r * 0.18, r * 0.16, 0, Math.PI * 2);
  g.fill();
}

function paint(kind: ItemKind | 'fakeAlt', r: number, scale: number): Sprite {
  const size = (r + PAD) * 2;
  const { c, g } = canvas(size, scale);
  g.shadowBlur = 16;
  switch (kind) {
    case 'real': {
      g.shadowColor = 'rgba(56, 225, 255, 0.9)';
      const f = g.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
      f.addColorStop(0, '#b9fbff');
      f.addColorStop(0.45, '#2ad4f5');
      f.addColorStop(1, '#0a5f93');
      g.fillStyle = f;
      g.beginPath();
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.fill();
      g.shadowBlur = 0;
      g.strokeStyle = 'rgba(255,255,255,0.85)';
      g.lineWidth = 2.5;
      g.beginPath();
      g.arc(0, 0, r - 4, 0, Math.PI * 2);
      g.stroke();
      // Thermometer.
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.roundRect(-2.5, -r * 0.72, 5, r * 0.36, 2.5);
      g.fill();
      g.beginPath();
      g.arc(0, -r * 0.34, 4.5, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case 'alarm': {
      g.shadowColor = 'rgba(255, 70, 90, 0.95)';
      const f = g.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
      f.addColorStop(0, '#ffd0d4');
      f.addColorStop(0.45, '#ff3b4e');
      f.addColorStop(1, '#8c0b1e');
      g.fillStyle = f;
      g.beginPath();
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.fill();
      g.shadowBlur = 0;
      g.strokeStyle = '#ffffff';
      g.lineWidth = 4;
      g.beginPath();
      g.arc(0, 0, r - 4, 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = '#ffffff';
      g.fillRect(-3, -r * 0.5 - 8, 6, 16);
      g.fillRect(-8, -r * 0.5 - 3, 16, 6);
      break;
    }
    case 'fake':
    case 'fakeAlt': {
      g.shadowColor = 'rgba(255, 40, 120, 0.95)';
      const f = g.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.05, 0, 0, r * 1.05);
      f.addColorStop(0, '#ff9bc8');
      f.addColorStop(0.4, '#ff2e7e');
      f.addColorStop(1, '#4d0428');
      g.fillStyle = f;
      spikes(g, r, 11, kind === 'fake' ? 1 : 2);
      g.fill();
      g.shadowBlur = 0;
      g.strokeStyle = 'rgba(255, 210, 230, 0.7)';
      g.lineWidth = 1.5;
      g.stroke();
      eye(g, r);
      break;
    }
    case 'armored': {
      g.shadowColor = 'rgba(160, 80, 255, 0.95)';
      const f = g.createLinearGradient(-r, -r, r, r);
      f.addColorStop(0, '#c9a2ff');
      f.addColorStop(0.35, '#6a1fe0');
      f.addColorStop(1, '#1a0438');
      g.fillStyle = f;
      hexagon(g, r);
      g.fill();
      g.shadowBlur = 0;
      g.strokeStyle = '#e3d1ff';
      g.lineWidth = 3;
      g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.25)';
      g.lineWidth = 2;
      hexagon(g, r * 0.78);
      g.stroke();
      // Rivets.
      g.fillStyle = '#e3d1ff';
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        g.beginPath();
        g.arc(Math.cos(a) * r * 0.88, Math.sin(a) * r * 0.88, 2.2, 0, Math.PI * 2);
        g.fill();
      }
      eye(g, r * 1.2);
      break;
    }
    case 'ai': {
      g.shadowColor = 'rgba(80, 160, 255, 1)';
      const f = g.createLinearGradient(0, -r, 0, r);
      f.addColorStop(0, '#9fe9ff');
      f.addColorStop(0.5, '#2f7bff');
      f.addColorStop(1, '#1b2c9e');
      g.fillStyle = f;
      hexagon(g, r);
      g.fill();
      g.shadowBlur = 0;
      g.strokeStyle = '#ffffff';
      g.lineWidth = 2.5;
      g.stroke();
      g.fillStyle = '#ffffff';
      g.font = font(r * 0.72, 900);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('AI', 0, 1);
      break;
    }
    case 'shield': {
      g.shadowColor = 'rgba(61, 255, 168, 1)';
      const f = g.createLinearGradient(0, -r, 0, r);
      f.addColorStop(0, '#b4ffd9');
      f.addColorStop(0.5, '#25d98a');
      f.addColorStop(1, '#0a6b45');
      g.fillStyle = f;
      g.beginPath();
      g.moveTo(0, -r);
      g.quadraticCurveTo(r * 0.9, -r * 0.8, r * 0.9, -r * 0.45);
      g.quadraticCurveTo(r * 0.85, r * 0.55, 0, r);
      g.quadraticCurveTo(-r * 0.85, r * 0.55, -r * 0.9, -r * 0.45);
      g.quadraticCurveTo(-r * 0.9, -r * 0.8, 0, -r);
      g.fill();
      g.shadowBlur = 0;
      g.strokeStyle = '#ffffff';
      g.lineWidth = 2.5;
      g.stroke();
      g.lineWidth = 5;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.beginPath();
      g.moveTo(-r * 0.35, 0);
      g.lineTo(-r * 0.08, r * 0.3);
      g.lineTo(r * 0.4, -r * 0.3);
      g.stroke();
      break;
    }
  }
  return { img: c, size };
}

/** The hospital at night: sky, skyline with lit windows and the glowing record line. */
function paintBackground(cw: number, ch: number, dpr: number, s: number, oy: number) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(cw * dpr);
  c.height = Math.ceil(ch * dpr);
  const g = c.getContext('2d')!;
  g.scale(dpr, dpr);
  const sky = g.createLinearGradient(0, 0, 0, ch);
  sky.addColorStop(0, '#050b1f');
  sky.addColorStop(0.55, '#0b1838');
  sky.addColorStop(1, '#0d2342');
  g.fillStyle = sky;
  g.fillRect(0, 0, cw, ch);
  const glow = g.createRadialGradient(cw / 2, ch * 0.42, 10, cw / 2, ch * 0.42, Math.max(cw, ch) * 0.7);
  glow.addColorStop(0, 'rgba(56,225,255,0.10)');
  glow.addColorStop(1, 'rgba(56,225,255,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, cw, ch);
  // Stars.
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 70; i++) {
    g.fillStyle = `rgba(200,230,255,${0.15 + rnd() * 0.45})`;
    g.fillRect(rnd() * cw, rnd() * ch * 0.55, rnd() < 0.15 ? 2 : 1, rnd() < 0.15 ? 2 : 1);
  }
  // Faint data grid.
  g.strokeStyle = 'rgba(56,225,255,0.05)';
  g.lineWidth = 1;
  for (let x = (cw % 32) / 2; x < cw; x += 32) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, ch);
    g.stroke();
  }
  for (let y = 0; y < ch; y += 32) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(cw, y);
    g.stroke();
  }
  // Skyline: hospital in the middle, health centres either side.
  const base = oy + H * s - 22 * s;
  const blocks: [number, number, number][] = [];
  let x = -10;
  while (x < cw + 10) {
    const w = (34 + rnd() * 46) * s;
    const h = (50 + rnd() * 90) * s;
    blocks.push([x, w, h]);
    x += w + 4 * s;
  }
  const mid = cw / 2;
  for (const [bx, bw, bh] of blocks) {
    const hh = Math.abs(bx + bw / 2 - mid) < 70 * s ? bh * 0.4 : bh;
    g.fillStyle = '#081329';
    g.fillRect(bx, base - hh, bw, hh + 40);
    for (let wy = base - hh + 10 * s; wy < base - 6 * s; wy += 13 * s)
      for (let wx = bx + 6 * s; wx < bx + bw - 8 * s; wx += 11 * s)
        if (rnd() < 0.3) {
          g.fillStyle = rnd() < 0.8 ? 'rgba(255,214,120,0.55)' : 'rgba(120,220,255,0.6)';
          g.fillRect(wx, wy, 4 * s, 6 * s);
        }
  }
  // The hospital with its red cross.
  const hw = 150 * s;
  const hh = 150 * s;
  g.fillStyle = '#0a1834';
  g.fillRect(mid - hw / 2, base - hh, hw, hh + 40);
  g.fillStyle = '#0d1f42';
  g.fillRect(mid - hw / 2 + 6 * s, base - hh + 6 * s, hw - 12 * s, 3 * s);
  for (let wy = base - hh + 34 * s; wy < base - 10 * s; wy += 16 * s)
    for (let wx = mid - hw / 2 + 12 * s; wx < mid + hw / 2 - 14 * s; wx += 16 * s) {
      g.fillStyle = rnd() < 0.55 ? 'rgba(170,235,255,0.55)' : 'rgba(255,214,120,0.35)';
      g.fillRect(wx, wy, 8 * s, 9 * s);
    }
  g.shadowColor = 'rgba(255,60,80,0.9)';
  g.shadowBlur = 14;
  g.fillStyle = '#ff3b4e';
  g.fillRect(mid - 4 * s, base - hh - 26 * s, 8 * s, 22 * s);
  g.fillRect(mid - 11 * s, base - hh - 19 * s, 22 * s, 8 * s);
  g.shadowBlur = 0;
  return c;
}

/** Ground in front of the readings: they rise from behind it and sink back into the record. */
function paintFront(cw: number, ch: number, dpr: number, s: number, oy: number) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(cw * dpr);
  c.height = Math.ceil(ch * dpr);
  const g = c.getContext('2d')!;
  g.scale(dpr, dpr);
  const base = oy + H * s - 22 * s;
  const fade = g.createLinearGradient(0, base - 30 * s, 0, base);
  fade.addColorStop(0, 'rgba(5,13,31,0)');
  fade.addColorStop(1, 'rgba(5,13,31,0.55)');
  g.fillStyle = fade;
  g.fillRect(0, base - 30 * s, cw, 30 * s);
  g.fillStyle = '#050d1f';
  g.fillRect(0, base, cw, ch - base);
  const line = g.createLinearGradient(0, 0, cw, 0);
  line.addColorStop(0, 'rgba(56,225,255,0)');
  line.addColorStop(0.5, 'rgba(56,225,255,0.85)');
  line.addColorStop(1, 'rgba(56,225,255,0)');
  g.fillStyle = line;
  g.fillRect(0, base, cw, 2);
  g.fillStyle = 'rgba(56,225,255,0.45)';
  g.font = font(9 * Math.max(1, s), 800);
  g.textAlign = 'center';
  g.fillText('K A R T O N   P A C I E N T A', cw / 2, base + 14 * s);
  return c;
}

interface Half {
  sprite: Sprite;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  angle: number;
  spin: number;
  vr: number;
  side: 1 | -1;
  r: number;
  label: string;
  fake: boolean;
  life: number;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
  glyph?: string;
}

interface Float {
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
  life: number;
  max: number;
}

interface Ring {
  x: number;
  y: number;
  r: number;
  grow: number;
  life: number;
  max: number;
  color: string;
  width: number;
}

export function PrestreziView(props: GameProps<PrestreziParams>) {
  const extraLives = props.research.pragovi ?? 0;
  const game = useMemo(() => new PrestreziGame(props.params, extraLives), []);
  expose('prestrezi', game);
  const host = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const [, setFrame] = useState(0);
  const [tip, setTip] = useState(props.tip ?? null);
  const [toast, setToast] = useState<{ text: string; kind: 'good' | 'bad'; id: number } | null>(null);
  const [stageRef, shake] = useShake(props.reducedMotion);
  const pausedRef = useRef(props.paused);
  pausedRef.current = props.paused;
  const tipRef = useRef(tip);
  tipRef.current = tip;
  const doneRef = useRef(false);

  const say = (text: string, kind: 'good' | 'bad') => setToast({ text, kind, id: Date.now() });
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1500);
    return () => clearTimeout(t);
  }, [toast]);

  // Everything the canvas animates lives in one mutable bag, outside Preact.
  const fx = useRef({
    halves: [] as Half[],
    sparks: [] as Spark[],
    floats: [] as Float[],
    rings: [] as Ring[],
    flashes: [] as { x0: number; y0: number; x1: number; y1: number; life: number }[],
    trail: [] as { x: number; y: number; t: number }[],
    red: 0,
    green: 0,
    clock: 0,
    view: { s: 1, ox: 0, oy: 0, cw: 0, ch: 0, dpr: 1, left: 0, top: 0, k: 1 },
  });

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    const won = game.finished === 'won';
    audio.play(won ? 'win' : 'fail');
    setTimeout(
      () =>
        props.onDone({
          kind: 'prestrezi',
          completed: won,
          mistakes: game.mistakes,
          timeLeft: 0,
          timeTotal: props.params.durationSec,
          score: game.score,
          metrics: { caught: game.caught, fakes: game.fakesTotal, missed: game.missed, combo: game.bestCombo, saved: game.saved },
          failHint: won ? undefined : game.missed ? 'lažne meritve so prišle v karton' : 'prerezal si preveč pravih meritev',
          notes: [
            `Prestreženih lažnih meritev: ${game.caught}/${game.fakesTotal}.${game.bestCombo >= 3 ? ` Najboljši kombo: ×${game.bestCombo}.` : ''}`,
            `Pravih meritev zapisanih v karton: ${game.saved}${game.mistakes ? `, po pomoti prerezanih: ${game.mistakes}` : ', nobena ni bila prerezana'}.`,
            'InGenious vsako meritev preveri, preden jo zapiše: nemogoče vrednosti in skoki ne pridejo do dežurnega.',
          ],
          emoji: `⚔️ ${game.caught}/${game.fakesTotal} ${'❤️'.repeat(game.lives)}${'🖤'.repeat(game.maxLives - game.lives)}${game.bestCombo >= 3 ? ` ×${game.bestCombo}` : ''}`,
        }),
      won ? 900 : 700,
    );
  };

  useEffect(() => {
    const f = fx.current;
    const burst = (x: number, y: number, n: number, colors: string[], speed = 260, glyphs = false) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = speed * (0.35 + Math.random() * 0.75);
        f.sparks.push({
          x,
          y,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v - 80,
          life: 0,
          max: 0.45 + Math.random() * 0.45,
          color: colors[i % colors.length],
          size: 2 + Math.random() * 3.5,
          glyph: glyphs && i % 4 === 0 ? (Math.random() < 0.5 ? '0' : '1') : undefined,
        });
      }
      if (f.sparks.length > 260) f.sparks.splice(0, f.sparks.length - 260);
    };
    const halves = (it: Item, angle: number) => {
      const sprite = spriteFor(it);
      for (const side of [1, -1] as const) {
        const push = 90 + Math.random() * 50;
        f.halves.push({
          sprite,
          x: it.x,
          y: it.y,
          vx: it.vx * 0.6 + Math.cos(angle + Math.PI / 2) * push * side,
          vy: Math.min(it.vy * 0.4, 0) + Math.sin(angle + Math.PI / 2) * push * side - 60,
          rot: it.kind === 'real' || it.kind === 'alarm' ? Math.sin(it.rot) * 0.25 : it.rot,
          angle,
          spin: 0,
          vr: side * (2 + Math.random() * 3),
          side,
          r: it.r,
          label: it.kind === 'ai' || it.kind === 'shield' ? '' : it.label,
          fake: it.kind === 'fake' || it.kind === 'armored',
          life: 0,
        });
      }
    };
    const flash = (it: Item, angle: number) => {
      const L = it.r * 1.8;
      f.flashes.push({ x0: it.x - Math.cos(angle) * L, y0: it.y - Math.sin(angle) * L, x1: it.x + Math.cos(angle) * L, y1: it.y + Math.sin(angle) * L, life: 0 });
    };
    const float = (x: number, y: number, text: string, color: string, size = 18, max = 0.9) => f.floats.push({ x, y, text, color, size, life: 0, max });
    return game.on((e) => {
      switch (e.type) {
        case 'cut':
          audio.play('slice');
          buzz(8);
          halves(e.item, e.angle);
          flash(e.item, e.angle);
          burst(e.item.x, e.item.y, e.item.kind === 'armored' ? 34 : 18, ['#ff2e7e', '#ff9bc8', '#ffd1e6', '#b00f4f'], 280, true);
          f.rings.push({ x: e.item.x, y: e.item.y, r: e.item.r * 0.7, grow: 60, life: 0, max: 0.28, color: '255,80,150', width: 3 });
          float(e.item.x, e.item.y - e.item.r - 4, `✕ ${e.item.label}  +${e.item.kind === 'armored' ? 30 : 10}`, '#ffb3d1', 17, 0.8);
          if (e.item.kind === 'armored') shake();
          break;
        case 'hit':
          audio.play('blocked');
          buzz(12);
          flash(e.item, e.angle);
          burst(e.item.x, e.item.y, 10, ['#e3d1ff', '#9a5cff', '#ffffff'], 220);
          f.rings.push({ x: e.item.x, y: e.item.y, r: e.item.r, grow: 120, life: 0, max: 0.25, color: '210,180,255', width: 4 });
          break;
        case 'badcut':
          audio.play('wrong');
          buzz([50, 40, 80]);
          shake();
          halves(e.item, e.angle);
          flash(e.item, e.angle);
          burst(e.item.x, e.item.y, 22, e.item.kind === 'alarm' ? ['#ff6b6b', '#ffffff', '#ffd0d4'] : ['#2ad4f5', '#b9fbff', '#ffffff'], 240);
          f.red = 1;
          float(e.item.x, e.item.y - e.item.r - 6, e.item.kind === 'alarm' ? 'PRAVI ALARM!' : 'PRAVA MERITEV!', '#ff6b7d', 17, 1.1);
          say(e.item.kind === 'alarm' ? 'To je bil pravi alarm. Tega ne reži!' : 'To je bila prava meritev.', 'bad');
          break;
        case 'miss':
          audio.play('boom');
          buzz([80, 40, 80]);
          shake();
          f.red = 1;
          burst(Math.min(W - 10, Math.max(10, e.item.x)), H - 22, 26, ['#ff2e7e', '#ff9bc8', '#4d0428'], 300, true);
          f.rings.push({ x: e.item.x, y: H - 22, r: 10, grow: 150, life: 0, max: 0.45, color: '255,46,126', width: 5 });
          float(Math.min(W - 60, Math.max(60, e.item.x)), H - 70, 'LAŽNA V KARTONU', '#ff6b9a', 16, 1.1);
          break;
        case 'saved':
          float(Math.min(W - 30, Math.max(30, e.item.x)), H - 40, '✓', e.item.kind === 'alarm' ? '#ff9aa5' : '#7ef0ff', 18, 0.7);
          f.rings.push({ x: Math.min(W, Math.max(0, e.item.x)), y: H - 22, r: 6, grow: 90, life: 0, max: 0.35, color: e.item.kind === 'alarm' ? '255,120,130' : '56,225,255', width: 2 });
          break;
        case 'reveal':
          audio.play('spark');
          f.rings.push({ x: e.item.x, y: e.item.y, r: e.item.r, grow: 160, life: 0, max: 0.3, color: '255,255,255', width: 3 });
          burst(e.item.x, e.item.y, 12, ['#ffffff', '#ff2e7e'], 180);
          break;
        case 'slowmo':
          audio.play('powerup');
          buzz(20);
          halves(e.item, e.angle);
          f.rings.push({ x: e.item.x, y: e.item.y, r: 10, grow: 700, life: 0, max: 0.7, color: '80,160,255', width: 6 });
          say('AI analiza: čas se upočasni', 'good');
          break;
        case 'purge':
          audio.play('zap');
          buzz([20, 30, 20]);
          halves(e.item, e.angle);
          f.green = 1;
          f.rings.push({ x: e.item.x, y: e.item.y, r: 10, grow: 900, life: 0, max: 0.8, color: '61,255,168', width: 8 });
          for (const it of e.items) {
            halves(it, Math.random() * Math.PI);
            burst(it.x, it.y, 12, ['#3dffa8', '#ff2e7e', '#ffffff'], 220, true);
          }
          say(e.items.length ? `Validator je počistil ${e.items.length} lažnih` : 'Validator: ni bilo česa čistiti', 'good');
          break;
        case 'combo':
          audio.play('star3');
          buzz([10, 20, 10, 20, 10]);
          float(Math.min(W - 90, Math.max(90, e.x)), Math.max(80, e.y - 30), `KOMBO ×${e.count}`, '#ffd23f', 30, 1.2);
          float(Math.min(W - 90, Math.max(90, e.x)), Math.max(112, e.y + 2), `+${e.bonus}`, '#ffe9a3', 18, 1.2);
          break;
        case 'won':
        case 'lost':
          finish();
          break;
      }
      if (e.type !== 'launch') setFrame((n) => n + 1);
    });
  }, []);

  // Sprites are painted per device pixel ratio and reused.
  const sprites = useRef(new Map<string, Sprite>());
  const spriteFor = (it: Item | { kind: ItemKind | 'fakeAlt'; r: number }) => {
    const v = fx.current.view;
    const kind = 'id' in it && it.kind === 'fake' && game.disguised(it) ? 'real' : it.kind;
    const key = `${kind}:${it.r}:${v.dpr * v.s}`;
    let s = sprites.current.get(key);
    if (!s) sprites.current.set(key, (s = paint(kind, it.r, v.dpr * v.s)));
    return s;
  };

  useEffect(() => {
    const c = cv.current!;
    const g = c.getContext('2d')!;
    const f = fx.current;
    let bg: HTMLCanvasElement | null = null;
    let front: HTMLCanvasElement | null = null;
    const resize = () => {
      const el = host.current!;
      const cw = el.offsetWidth;
      const ch = el.offsetHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const s = Math.min(cw / W, ch / H);
      f.view = { ...f.view, cw, ch, dpr, s, ox: (cw - W * s) / 2, oy: (ch - H * s) / 2 };
      c.width = Math.ceil(cw * dpr);
      c.height = Math.ceil(ch * dpr);
      sprites.current.clear();
      bg = paintBackground(cw, ch, dpr, s, f.view.oy);
      front = paintFront(cw, ch, dpr, s, f.view.oy);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host.current!);

    const drawItem = (it: Item) => {
      const sp = spriteFor(it);
      const disguised = game.disguised(it);
      g.save();
      g.translate(it.x, it.y);
      if (it.kind === 'alarm') {
        const p = (Math.sin(f.clock * 9) + 1) / 2;
        g.strokeStyle = `rgba(255,80,100,${0.25 + p * 0.45})`;
        g.lineWidth = 3;
        g.beginPath();
        g.arc(0, 0, it.r + 5 + p * 7, 0, Math.PI * 2);
        g.stroke();
      }
      if (it.kind === 'ai' || it.kind === 'shield') {
        g.strokeStyle = it.kind === 'ai' ? 'rgba(140,200,255,0.7)' : 'rgba(120,255,190,0.7)';
        g.lineWidth = 2;
        g.setLineDash([6, 8]);
        g.lineDashOffset = -f.clock * 40;
        g.beginPath();
        g.arc(0, 0, it.r + 8, 0, Math.PI * 2);
        g.stroke();
        g.setLineDash([]);
      }
      const spin = it.kind === 'real' || it.kind === 'alarm' || disguised ? Math.sin(it.rot) * 0.2 : Math.sin(it.rot) * 0.5;
      g.rotate(spin);
      const glitch = (it.kind === 'fake' || it.kind === 'armored') && !disguised && Math.sin(f.clock * 23 + it.id * 3.1) > 0.82;
      if (glitch) {
        g.globalAlpha = 0.5;
        g.drawImage(sp.img, -sp.size / 2 - 4, -sp.size / 2, sp.size, sp.size);
        g.globalCompositeOperation = 'lighter';
        g.drawImage(sp.img, -sp.size / 2 + 4, -sp.size / 2 + 1, sp.size, sp.size);
        g.globalCompositeOperation = 'source-over';
        g.globalAlpha = 1;
      }
      // A disguise holds, but flickers for one frame now and then: sharp eyes win.
      if (disguised && Math.sin(f.clock * 17 + it.id) > 0.985) {
        const alt = spriteFor({ kind: 'fake', r: it.r });
        g.globalAlpha = 0.55;
        g.drawImage(alt.img, -alt.size / 2, -alt.size / 2, alt.size, alt.size);
        g.globalAlpha = 1;
      } else g.drawImage(sp.img, -sp.size / 2, -sp.size / 2, sp.size, sp.size);
      g.rotate(-spin);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      if (it.kind === 'real' || it.kind === 'alarm' || disguised) {
        const text = disguised ? `${(2.8 + ((it.id * 37) % 45) / 10).toFixed(1).replace('.', ',')}°` : it.label;
        g.font = font(it.r * 0.6, 900);
        g.lineWidth = 4;
        g.lineJoin = 'round';
        g.strokeStyle = it.kind === 'alarm' ? 'rgba(90,0,15,0.85)' : 'rgba(0,40,70,0.85)';
        g.strokeText(text, 0, it.r * 0.22);
        g.fillStyle = '#ffffff';
        g.fillText(text, 0, it.r * 0.22);
      } else if (it.kind === 'fake' || it.kind === 'armored') {
        g.font = font(it.r * 0.46, 900);
        g.lineWidth = 4;
        g.lineJoin = 'round';
        g.strokeStyle = 'rgba(60,0,25,0.9)';
        g.strokeText(it.label, glitch ? 3 : 0, it.r * 0.42);
        g.fillStyle = '#ffffff';
        g.fillText(it.label, glitch ? 3 : 0, it.r * 0.42);
      }
      if (it.kind === 'armored') {
        for (let i = 0; i < it.maxHp; i++) {
          const a0 = -Math.PI / 2 + (i / it.maxHp) * Math.PI * 2 + 0.12;
          const a1 = a0 + (Math.PI * 2) / it.maxHp - 0.24;
          g.strokeStyle = i < it.hp ? '#d7b8ff' : 'rgba(215,184,255,0.18)';
          g.lineWidth = 4;
          g.beginPath();
          g.arc(0, 0, it.r + 7, a0, a1);
          g.stroke();
        }
      }
      g.restore();
    };

    const drawHalf = (h: Half) => {
      const a = h.life > 0.55 ? Math.max(0, 1 - (h.life - 0.55) / 0.5) : 1;
      if (a <= 0) return;
      g.save();
      g.globalAlpha = a;
      g.translate(h.x, h.y);
      g.rotate(h.spin + h.angle);
      g.beginPath();
      const R = h.sprite.size;
      if (h.side > 0) g.rect(-R, 0, R * 2, R);
      else g.rect(-R, -R, R * 2, R);
      g.clip();
      g.rotate(-h.angle + h.rot);
      g.drawImage(h.sprite.img, -h.sprite.size / 2, -h.sprite.size / 2, h.sprite.size, h.sprite.size);
      if (h.label) {
        g.font = font(h.r * (h.fake ? 0.46 : 0.6), 900);
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.lineWidth = 4;
        g.strokeStyle = 'rgba(20,0,20,0.8)';
        g.strokeText(h.label, 0, h.r * (h.fake ? 0.42 : 0.22));
        g.fillStyle = '#ffffff';
        g.fillText(h.label, 0, h.r * (h.fake ? 0.42 : 0.22));
      }
      g.restore();
      // The fresh cut face glows for a moment.
      if (h.life < 0.25) {
        g.save();
        g.translate(h.x, h.y);
        g.rotate(h.spin + h.angle);
        g.strokeStyle = `rgba(255,255,255,${(1 - h.life / 0.25) * 0.9})`;
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(-h.r, 0);
        g.lineTo(h.r, 0);
        g.stroke();
        g.restore();
      }
    };

    const ecg = (y: number, t: number) => {
      g.strokeStyle = 'rgba(61,255,168,0.13)';
      g.lineWidth = 2;
      g.beginPath();
      for (let x = 0; x <= W; x += 6) {
        const p = ((x + t * 120) % 240) / 240;
        const d = p > 0.45 && p < 0.5 ? -26 * Math.sin((p - 0.45) * 20 * Math.PI) : p > 0.5 && p < 0.55 ? 14 * Math.sin((p - 0.5) * 20 * Math.PI) : 0;
        if (x === 0) g.moveTo(x, y + d);
        else g.lineTo(x, y + d);
      }
      g.stroke();
    };

    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const rdt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const running = !pausedRef.current && !tipRef.current && !game.finished;
      const slow = game.slowmo;
      if (running) {
        game.update(rdt);
        if (now - lastHud > 200) {
          lastHud = now;
          setFrame((n) => n + 1);
        }
      }
      const dt = pausedRef.current ? 0 : rdt * (slow ? 0.4 : 1);
      f.clock += dt;
      const v = f.view;
      g.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
      if (bg) g.drawImage(bg, 0, 0, v.cw, v.ch);
      g.translate(v.ox, v.oy);
      g.scale(v.s, v.s);
      ecg(H * 0.36, f.clock);
      for (const h of f.halves) {
        h.life += dt;
        h.vy += 900 * dt;
        h.x += h.vx * dt;
        h.y += h.vy * dt;
        h.spin += h.vr * dt;
        drawHalf(h);
      }
      f.halves = f.halves.filter((h) => h.life < 1.05 && h.y < H + 80);
      for (const it of game.items) drawItem(it);
      if (front) {
        g.save();
        g.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
        g.drawImage(front, 0, 0, v.cw, v.ch);
        g.restore();
      }
      // Cut flashes.
      for (const fl of f.flashes) {
        fl.life += rdt;
        const a = 1 - fl.life / 0.32;
        if (a <= 0) continue;
        g.strokeStyle = `rgba(255,255,255,${a})`;
        g.lineWidth = 6 * a + 1;
        g.beginPath();
        g.moveTo(fl.x0, fl.y0);
        g.lineTo(fl.x1, fl.y1);
        g.stroke();
      }
      f.flashes = f.flashes.filter((fl) => fl.life < 0.32);
      for (const r of f.rings) {
        r.life += rdt;
        const p = r.life / r.max;
        if (p >= 1) continue;
        g.strokeStyle = `rgba(${r.color},${(1 - p) * 0.9})`;
        g.lineWidth = r.width * (1 - p) + 0.5;
        g.beginPath();
        g.arc(r.x, r.y, r.r + r.grow * p, 0, Math.PI * 2);
        g.stroke();
      }
      f.rings = f.rings.filter((r) => r.life < r.max);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      for (const s of f.sparks) {
        s.life += dt;
        s.vy += 520 * dt;
        s.vx *= 0.985;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        const a = 1 - s.life / s.max;
        if (a <= 0) continue;
        g.globalAlpha = a;
        g.fillStyle = s.color;
        if (s.glyph) {
          g.font = font(9 + s.size * 1.5, 900);
          g.fillText(s.glyph, s.x, s.y);
        } else g.fillRect(s.x - s.size / 2, s.y - s.size / 2, s.size, s.size);
      }
      g.globalAlpha = 1;
      f.sparks = f.sparks.filter((s) => s.life < s.max);
      // Blade trail: a tapered ribbon, glow first and a white core on top.
      const tn = now / 1000;
      f.trail = f.trail.filter((p) => tn - p.t < 0.22);
      if (f.trail.length > 1) {
        g.lineCap = 'round';
        for (const pass of [0, 1]) {
          for (let i = 1; i < f.trail.length; i++) {
            const k = i / (f.trail.length - 1);
            g.strokeStyle = pass ? `rgba(255,255,255,${0.35 + k * 0.65})` : `rgba(56,225,255,${0.12 + k * 0.3})`;
            g.lineWidth = pass ? 1 + k * 5 : 4 + k * 12;
            g.beginPath();
            g.moveTo(f.trail[i - 1].x, f.trail[i - 1].y);
            g.lineTo(f.trail[i].x, f.trail[i].y);
            g.stroke();
          }
        }
      }
      for (const fl of f.floats) {
        fl.life += rdt;
        const p = fl.life / fl.max;
        if (p >= 1) continue;
        const pop = p < 0.15 ? 0.6 + (p / 0.15) * 0.5 : p < 0.25 ? 1.1 - ((p - 0.15) / 0.1) * 0.1 : 1;
        g.globalAlpha = p > 0.7 ? (1 - p) / 0.3 : 1;
        g.font = font(fl.size * pop, 900);
        g.lineWidth = 4;
        g.strokeStyle = 'rgba(5,10,30,0.8)';
        g.strokeText(fl.text, fl.x, fl.y - p * 34);
        g.fillStyle = fl.color;
        g.fillText(fl.text, fl.x, fl.y - p * 34);
      }
      g.globalAlpha = 1;
      f.floats = f.floats.filter((fl) => fl.life < fl.max);
      // Screen-wide tints: red after a mistake, green after a purge, blue in slow motion.
      g.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
      if (f.red > 0) {
        const grd = g.createRadialGradient(v.cw / 2, v.ch / 2, Math.min(v.cw, v.ch) * 0.3, v.cw / 2, v.ch / 2, Math.max(v.cw, v.ch) * 0.75);
        grd.addColorStop(0, 'rgba(255,30,70,0)');
        grd.addColorStop(1, `rgba(255,30,70,${f.red * 0.45})`);
        g.fillStyle = grd;
        g.fillRect(0, 0, v.cw, v.ch);
        f.red = Math.max(0, f.red - rdt * 2.2);
      }
      if (f.green > 0) {
        g.fillStyle = `rgba(61,255,168,${f.green * 0.18})`;
        g.fillRect(0, 0, v.cw, v.ch);
        f.green = Math.max(0, f.green - rdt * 2);
      }
      if (slow) {
        const grd = g.createRadialGradient(v.cw / 2, v.ch / 2, Math.min(v.cw, v.ch) * 0.25, v.cw / 2, v.ch / 2, Math.max(v.cw, v.ch) * 0.7);
        grd.addColorStop(0, 'rgba(60,140,255,0.04)');
        grd.addColorStop(1, 'rgba(60,140,255,0.32)');
        g.fillStyle = grd;
        g.fillRect(0, 0, v.cw, v.ch);
      }
      raf = requestAnimationFrame(loop);
    };
    let lastHud = 0;
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  /** Client pixels to world units; the shell may be CSS-scaled, so measure every time. */
  const toWorld = (cx: number, cy: number) => {
    const v = fx.current.view;
    const r = cv.current!.getBoundingClientRect();
    const k = r.width / v.cw || 1;
    return { x: ((cx - r.left) / k - v.ox) / v.s, y: ((cy - r.top) / k - v.oy) / v.s };
  };
  expose('prestreziView', {
    toClient: (x: number, y: number) => {
      const v = fx.current.view;
      const r = cv.current!.getBoundingClientRect();
      const k = r.width / v.cw || 1;
      return { x: r.left + (v.ox + x * v.s) * k, y: r.top + (v.oy + y * v.s) * k };
    },
  });

  const down = useRef(false);
  const onDown = (e: PointerEvent) => {
    if (props.paused) return;
    audio.unlock();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    if (tip) {
      setTip(null);
      props.onTipDone?.();
    }
    down.current = true;
    const p = toWorld(e.clientX, e.clientY);
    fx.current.trail = [{ ...p, t: performance.now() / 1000 }];
    game.beginStroke(p.x, p.y);
    audio.play('swipe');
  };
  const onMove = (e: PointerEvent) => {
    if (!down.current || props.paused) return;
    const list = (e as PointerEvent & { getCoalescedEvents?: () => PointerEvent[] }).getCoalescedEvents?.() ?? [];
    for (const ev of list.length ? list : [e]) {
      const p = toWorld(ev.clientX, ev.clientY);
      fx.current.trail.push({ ...p, t: performance.now() / 1000 });
      game.strokeTo(p.x, p.y);
    }
    if (fx.current.trail.length > 24) fx.current.trail.splice(0, fx.current.trail.length - 24);
  };
  const onUp = () => {
    if (!down.current) return;
    down.current = false;
    game.endStroke();
  };

  const hearts = Array.from({ length: game.maxLives }, (_, i) => i < game.lives);
  return (
    <>
      <Hud title={props.title} subtitle={props.subtitle} time={game.timeLeft} onPause={props.onPause}>
        <span class="pill pz-hearts" aria-label={`Srca ${game.lives} od ${game.maxLives}`}>
          {hearts.map((on) => (
            <i class={on ? 'on' : ''} />
          ))}
        </span>
        <span class="pill" aria-label={`Prestreženih ${game.caught} od ${game.fakesTotal}`}>
          ⚔ {game.caught}
        </span>
      </Hud>
      <div class={`stage prestrezi-stage${game.slowmo ? ' slow' : ''}`} ref={stageRef}>
        <div class="pz-host" ref={host} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          <canvas ref={cv} aria-label="Meritve letijo čez zaslon. Potegni s prstom čez lažne meritve." />
        </div>
        {game.slowmo && (
          <div class="pz-slow" role="status">
            AI analiza
          </div>
        )}
        {toast && (
          <div class={`toast-line ${toast.kind}`} key={toast.id} role="status">
            {toast.text}
          </div>
        )}
        {tip && (
          <div class="pz-start" aria-hidden="true">
            <span>Potegni s prstom za začetek</span>
          </div>
        )}
        {tip && (
          <div class="hint">
            <GenkoSays text={tip} size={44} />
          </div>
        )}
      </div>
    </>
  );
}
