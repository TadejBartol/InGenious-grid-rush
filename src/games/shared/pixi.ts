import { Application, Container, Graphics, Text, type TextStyleOptions } from 'pixi.js';
import { useEffect, useRef } from 'preact/hooks';

export type Teardown = () => void;

/**
 * Mounts a PixiJS application into a host div for the lifetime of the component.
 * `setup` runs once the renderer is ready and may return a teardown.
 */
export function usePixi(setup: (app: Application, host: HTMLDivElement) => Teardown | void) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = host.current!;
    const app = new Application();
    let teardown: Teardown | void;
    let alive = true;
    let ready = false;
    app
      .init({
        resizeTo: el,
        backgroundAlpha: 0,
        antialias: true,
        autoDensity: true,
        resolution: Math.min(window.devicePixelRatio || 1, 3),
        preference: 'webgl',
        powerPreference: 'high-performance',
      })
      .then(() => {
        ready = true;
        if (!alive) {
          app.destroy(true, { children: true });
          return;
        }
        el.appendChild(app.canvas);
        app.canvas.setAttribute('aria-hidden', 'true');
        teardown = setup(app, el);
      });
    return () => {
      alive = false;
      teardown?.();
      if (ready) app.destroy(true, { children: true });
    };
  }, []);
  return host;
}

export const FONT = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
export const MONO = 'ui-monospace, SF Mono, Roboto Mono, Menlo, monospace';

export function label(text: string, style: TextStyleOptions) {
  return new Text({ text, style: { fontFamily: FONT, fill: 0xe6ecff, ...style } });
}

export const COLORS = {
  brand: 0x38e1ff,
  green: 0x3dff9a,
  orange: 0xffb340,
  red: 0xff3b5c,
  text: 0xe6ecff,
  muted: 0x8b98c4,
  line: 0x22305f,
  panel: 0x0f1733,
  bg: 0x070b1a,
};

interface Particle {
  g: Graphics;
  vx: number;
  vy: number;
  life: number;
  max: number;
  gravity: number;
}

/** Small pooled particle system for sparks, bursts and data dots. */
export class Particles {
  readonly layer = new Container();
  private items: Particle[] = [];
  private pool: Graphics[] = [];
  reduced = false;

  burst(x: number, y: number, color: number, count = 18, speed = 220, opts: { gravity?: number; size?: number; life?: number } = {}) {
    const n = this.reduced ? Math.ceil(count / 3) : count;
    for (let i = 0; i < n; i++) {
      const g = this.pool.pop() ?? new Graphics();
      g.clear();
      const size = (opts.size ?? 3) * (0.5 + Math.random());
      g.circle(0, 0, size).fill({ color });
      g.position.set(x, y);
      g.alpha = 1;
      g.blendMode = 'add';
      this.layer.addChild(g);
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.3 + Math.random() * 0.7);
      const life = (opts.life ?? 0.6) * (0.6 + Math.random() * 0.6);
      this.items.push({ g, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, gravity: opts.gravity ?? 300 });
    }
  }

  update(dt: number) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.layer.removeChild(p.g);
        this.pool.push(p.g);
        this.items.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * dt;
      p.vx *= 0.98;
      p.g.x += p.vx * dt;
      p.g.y += p.vy * dt;
      p.g.alpha = p.life / p.max;
    }
  }
}

/** Floating "+100 DP" style text. */
export class Floaters {
  readonly layer = new Container();
  private items: { t: Text; life: number; vy: number }[] = [];

  add(text: string, x: number, y: number, color: number, size = 16) {
    const t = label(text, { fontFamily: MONO, fontSize: size, fontWeight: '800', fill: color, dropShadow: { color, blur: 8, distance: 0, alpha: 0.8 } });
    t.anchor.set(0.5);
    t.position.set(x, y);
    this.layer.addChild(t);
    this.items.push({ t, life: 1.1, vy: -50 });
  }

  update(dt: number) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const f = this.items[i];
      f.life -= dt;
      f.t.y += f.vy * dt;
      f.t.alpha = Math.min(1, f.life * 2);
      if (f.life <= 0) {
        f.t.destroy();
        this.items.splice(i, 1);
      }
    }
  }
}
