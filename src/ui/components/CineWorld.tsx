import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { Direction, Shot } from '../../core/cinema';
import type { FacilityDef } from '../../core/types';
import type { Scene, StoryMood } from '../../core/story';
import { DarkMeter } from './DarkMeter';
import { Genko, type Mood } from './Genko';
import { IsoFactory } from './IsoFactory';

/**
 * The cutscene set: one small world (sky, city, power lines, the stage) filmed by a
 * camera. Every layer is moved by the same camera at its own depth, so pans and
 * push-ins get real parallax. Shots come from cinema.ts; this file only stages them.
 *
 * World units: the stage is about 640 wide, the horizon sits at y 745 and the actors
 * stand on y 790. A zoom-1 frame shows roughly 440 x 600 of it.
 */
const FRAME_W = 440;
const FRAME_H = 600;
const HORIZON = 745;

type Framing = { x: number; y: number; z: number };
const CAM: Record<Shot | 'crane', Framing> = {
  crane: { x: 320, y: 300, z: 1 },
  establish: { x: 320, y: 560, z: 1 },
  two: { x: 322, y: 640, z: 1.15 },
  facility: { x: 320, y: 630, z: 1.55 },
  genko: { x: 214, y: 650, z: 2 },
  dark: { x: 436, y: 664, z: 2 },
};

const GENKO = { x: 205, y: 700 };
const DARK = { x: 440, y: 728 };

/** Depth of each layer: 0 is pinned to the lens, 1 moves with the stage. */
const DEPTH = { sky: 0.1, far: 0.4, mid: 0.7, stage: 1, fore: 1.35 };

function layer(cam: Framing, f: number, w: number, h: number) {
  const s = Math.min(w / FRAME_W, h / FRAME_H) * (1 + (cam.z - 1) * f);
  const ax = 320 + (cam.x - 320) * f;
  const ay = 560 + (cam.y - 560) * f;
  return `translate(${w / 2}px,${h / 2}px) scale(${s}) translate(${-ax}px,${-ay}px)`;
}

/** Same city every time: a seeded skyline with numbered windows. */
function rng(seed: number) {
  return () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
}
const SKYLINE = (() => {
  const r = rng(7);
  const towers: { x: number; w: number; h: number }[] = [];
  const windows: { x: number; y: number; th: number; d: number }[] = [];
  for (let x = -520; x < 1160; ) {
    const w = 34 + r() * 46;
    // Lower in the middle so the facility stands clear against the sky.
    const mid = Math.abs(x + w / 2 - 320) < 150;
    const h = (mid ? 40 : 70) + r() * (mid ? 60 : 170);
    towers.push({ x, w, h });
    for (let wy = HORIZON - h + 10; wy < HORIZON - 8; wy += 12)
      for (let wx = x + 6; wx < x + w - 8; wx += 10)
        if (r() < 0.55) windows.push({ x: wx, y: wy, th: r(), d: Math.abs(wx - 320) });
    x += w + 4 + r() * 10;
  }
  return { towers, windows };
})();

const PYLONS = [-430, -160, 110, 530, 800, 1070];
const PYLON_BASE = 752;
const TIPS = [
  [-50, -188],
  [50, -188],
  [38, -150],
];
function pylonPath(x: number) {
  const b = PYLON_BASE;
  let d = `M${x - 30} ${b} L${x - 6} ${b - 215} L${x} ${b - 240} L${x + 6} ${b - 215} L${x + 30} ${b} `;
  d += `M${x - 50} ${b - 188} L${x + 50} ${b - 188} M${x - 38} ${b - 150} L${x + 38} ${b - 150} `;
  for (let k = 0; k < 6; k++) {
    const y0 = b - k * 34;
    const y1 = y0 - 34;
    const half = (y: number) => 30 - ((b - y) / 215) * 24;
    d += `M${x - half(y0)} ${y0} L${x + half(y1)} ${y1} M${x + half(y0)} ${y0} L${x - half(y1)} ${y1} `;
  }
  return d;
}
const CABLES = PYLONS.slice(1).flatMap((x, k) =>
  TIPS.map(([dx, dy]) => {
    const a = PYLONS[k] + dx;
    const y = PYLON_BASE + dy;
    return { d: `M${a} ${y} Q${(a + x + dx) / 2} ${y + 46} ${x + dx} ${y}`, d0: Math.abs((a + x + dx) / 2 - 320) };
  }),
);

/** Lightning from InGenious to the Dark Meter, jagged the same way every time. */
const BOLT = (() => {
  const r = rng(3);
  const a = { x: GENKO.x + 44, y: GENKO.y - 6 };
  const b = { x: DARK.x - 46, y: DARK.y - 20 };
  let d = `M${a.x} ${a.y}`;
  for (let k = 1; k < 9; k++) {
    const t = k / 9;
    d += ` L${a.x + (b.x - a.x) * t + (r() - 0.5) * 10} ${a.y + (b.y - a.y) * t + (r() - 0.5) * 34}`;
  }
  return `${d} L${b.x} ${b.y}`;
})();

const SPARKS = Array.from({ length: 14 }, (_, k) => {
  const a = (k / 14) * Math.PI * 2 + 0.3;
  const len = 40 + ((k * 37) % 30);
  return { dx: Math.cos(a) * len, dy: Math.sin(a) * len * 0.8, delay: (k % 4) * 30 };
});

/** Data packets from InGenious to the facility: a gentle arc over the stage. */
const LINK = `M${GENKO.x + 30} ${GENKO.y - 20} Q${(GENKO.x + 320) / 2} ${GENKO.y - 150} 320 ${HORIZON - 60}`;
/** Lightning that forks down from the clouds in a storm. */
const SKY_BOLT = (() => {
  const r = rng(11);
  let x = 520;
  let d = `M${x} 80`;
  for (let y = 80; y < 640; y += 50) d += ` L${(x += (r() - 0.5) * 70)} ${y}`;
  return d;
})();
const CARS = Array.from({ length: 5 }, (_, k) => ({ y: HORIZON + 8 + (k % 3) * 9, dur: 9 + ((k * 7) % 6), delay: -k * 2.3, dir: k % 2 }));
const BIRDS = Array.from({ length: 6 }, (_, k) => ({ x: -80 - k * 26, y: 420 + ((k * 37) % 70), s: 0.7 + (k % 3) * 0.2, delay: k * 0.35 }));
const HEAL = Array.from({ length: 12 }, (_, k) => ({ dx: ((k * 47) % 110) - 55, delay: (k % 6) * 140, dur: 1300 + ((k * 211) % 900) }));

const genkoMood = (m?: StoryMood): Mood => (m === 'smug' || m === 'worried' || m === 'wow' ? m : 'happy');

interface Props {
  scene: Scene;
  dirs: Direction[];
  i: number;
  reduced: boolean;
  fac?: FacilityDef;
}

export function CineWorld({ scene, dirs, i, reduced, fac }: Props) {
  const vp = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 390, h: 600 });
  const [ready, setReady] = useState(false);
  const d = dirs[i];
  const [cam, setCam] = useState<{ at: Shot | 'crane'; ms: number }>({ at: reduced ? d.shot : 'crane', ms: 0 });
  const [drift, setDrift] = useState({ s: 1, ms: 0 });
  const [cuts, setCuts] = useState(0);

  useLayoutEffect(() => {
    const el = vp.current!;
    const measure = () => setSize({ w: el.clientWidth || 390, h: el.clientHeight || 600 });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Each line: glide or cut to its framing, then let the lens creep in until the next line.
  useEffect(() => {
    if (reduced) {
      setCam({ at: d.shot, ms: 0 });
      setReady(true);
      return;
    }
    const prev = dirs[i - 1]?.shot;
    const ms = i === 0 ? 3600 : d.move ? (d.shot === 'establish' || prev === 'establish' ? 2100 : 1500) : 0;
    let raf = 0;
    if (i === 0) {
      // Let the crane framing paint once, then lower the camera onto the set.
      raf = requestAnimationFrame(() => {
        raf = requestAnimationFrame(() => {
          setCam({ at: d.shot, ms });
          setReady(true);
        });
      });
    } else {
      setCam({ at: d.shot, ms });
      if (!ms) setCuts((c) => c + 1);
    }
    setDrift({ s: 1, ms });
    const push = d.act === 'laugh' ? { s: 1.1, ms: 2400 } : d.beat === 'reveal' ? { s: 1.16, ms: 5200 } : { s: 1.06, ms: 12000 };
    const t = window.setTimeout(() => setDrift(push), ms + 40);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [i, reduced]);

  const frame = CAM[cam.at];
  const tf = (f: number) => ({ transform: layer(frame, f, size.w, size.h), transitionDuration: `${cam.ms}ms` });
  const act = d.act;
  const city = ready ? d.city : dirs[0].act === 'blackout' ? 0.55 : d.city;
  const warm = scene.tone === 'dawn' && ready;
  const lit = d.lit;
  const line = scene.lines[i];
  const lastMood = (who: 'genko' | 'dark') => [...scene.lines.slice(0, i + 1)].reverse().find((l) => l.who === who)?.mood;
  const beat = d.beat;
  const shake = !reduced && (act === 'hit' || act === 'zap' || act === 'laugh' || (line.who === 'dark' && line.mood === 'angry'));
  const healed = lastMood('dark') === 'healed';
  // Once the meter is read, the storm breaks into plain rain.
  const sky = scene.weather ?? (scene.tone === 'dark' || scene.tone === 'boss' ? 'rain' : 'clear');
  const weather = healed && sky === 'storm' ? 'rain' : sky;
  const scanTo = fac ? { x: 320, y: HORIZON - 50 } : DARK;

  return (
    <div class={`cine tone-${scene.tone} wx-${weather}${healed ? ' healed' : ''}${reduced ? ' still' : ''}`} ref={vp} aria-hidden="true">
      <div class={`cine-rig${shake ? ` shake-${i % 2}` : ''}${scene.tone === 'boss' && !reduced ? ' handheld' : ''}${d.dutch && !reduced ? ' dutch' : ''}`}>
        <div class="cine-drift" style={{ transform: `scale(${drift.s})`, transitionDuration: `${reduced ? 0 : drift.ms}ms` }}>
          {/* Sky: gradient, moon or sun, stars. */}
          <div class="cine-layer" style={tf(DEPTH.sky)}>
            <svg class="cine-svg" width="640" height="1000">
              <defs>
                <linearGradient id="cine-sky" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" class="sk0" />
                  <stop offset="0.55" class="sk1" />
                  <stop offset="0.78" class="sk2" />
                  <stop offset="1" class="sk3" />
                </linearGradient>
                <linearGradient id="cine-dawn" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stop-color="#1d3d6a" />
                  <stop offset="0.55" stop-color="#5a6a9a" />
                  <stop offset="0.76" stop-color="#f2a35e" />
                  <stop offset="1" stop-color="#ffd38a" />
                </linearGradient>
                <radialGradient id="cine-sun">
                  <stop offset="0" stop-color="#fff4c4" />
                  <stop offset="0.35" stop-color="#ffd27a" stop-opacity="0.9" />
                  <stop offset="1" stop-color="#ff9a4a" stop-opacity="0" />
                </radialGradient>
              </defs>
              <rect x="-1200" y="-700" width="3040" height="2400" fill="url(#cine-sky)" />
              {scene.tone === 'dawn' && (
                <>
                  <rect class={`cine-warm${warm ? ' on' : ''}`} x="-1200" y="-700" width="3040" height="2400" fill="url(#cine-dawn)" />
                  <circle class={`cine-sun${warm ? ' up' : ''}`} cx="190" cy="590" r="110" fill="url(#cine-sun)" />
                </>
              )}
              {weather === 'storm' && !reduced && (
                <g class="cine-skybolt">
                  <path class="glow" d={SKY_BOLT} />
                  <path d={SKY_BOLT} />
                </g>
              )}
              <g class={`cine-clouds${weather === 'clear' ? ' thin' : ''}`}>
                {[0, 1, 2, 3].map((k) => (
                  <ellipse cx={-120 + k * 260} cy={250 + (k % 2) * 90} rx={180 + (k % 3) * 40} ry={26 + (k % 2) * 10} style={{ animationDelay: `${-k * 9}s` }} />
                ))}
              </g>
              {scene.tone === 'dawn' && !reduced && (
                <g class="cine-birds">
                  {BIRDS.map((b) => (
                    <path d={`M${b.x} ${b.y} q6 -6 12 0 q6 -6 12 0`} style={{ animationDelay: `${b.delay}s`, strokeWidth: 2 * b.s }} />
                  ))}
                </g>
              )}
              {scene.tone !== 'dawn' && (
                <g class="cine-stars">
                  {SKYLINE.windows.slice(0, 46).map((w, k) => (
                    <circle cx={((w.x * 7) % 1100) - 230} cy={120 + ((w.y * 13) % 420)} r={k % 5 ? 1 : 1.6} />
                  ))}
                  <circle class="cine-moon" cx="468" cy="330" r="34" />
                </g>
              )}
            </svg>
          </div>

          {/* Far: the city. Windows come on outward from the facility as the grid is read. */}
          <div class="cine-layer" style={tf(DEPTH.far)}>
            <svg class="cine-svg" width="640" height="1000">
              <rect class="cine-glow" x="-800" y={HORIZON - 160} width="2240" height="220" />
              {SKYLINE.towers.map((t) => (
                <rect class="cine-tower" x={t.x} y={HORIZON - t.h} width={t.w} height={t.h + 500} />
              ))}
              {SKYLINE.windows.map((w) => (
                <rect
                  class={`cine-win${w.th < city ? ' on' : ''}`}
                  x={w.x}
                  y={w.y}
                  width="4"
                  height="6"
                  style={{ transitionDelay: `${Math.round(w.d * (city < 0.1 ? 0.6 : 2.2))}ms` }}
                />
              ))}
            </svg>
          </div>

          {/* Mid: pylons and the lines; power runs along them when a facility comes online. */}
          <div class="cine-layer" style={tf(DEPTH.mid)}>
            <svg class="cine-svg" width="640" height="1000">
              <rect class="cine-mid-ground" x="-900" y={PYLON_BASE - 6} width="2400" height="700" />
              {PYLONS.map((x) => (
                <path class="cine-pylon" d={pylonPath(x)} />
              ))}
              {CABLES.map((c) => (
                <path class="cine-cable" d={c.d} />
              ))}
              {PYLONS.map((x, k) => (
                <circle class="cine-beacon" cx={x} cy={PYLON_BASE - 242} r="3.2" style={{ animationDelay: `${(k % 3) * 0.6}s` }} />
              ))}
              {lit &&
                CABLES.map((c) => (
                  <path class="cine-current" d={c.d} style={{ animationDelay: `${Math.round(c.d0 * 1.4)}ms` }} />
                ))}
            </svg>
          </div>

          {/* Stage: ground, the facility, the actors and the action. */}
          <div class="cine-layer" style={tf(DEPTH.stage)}>
            <svg class="cine-svg" width="640" height="1000">
              <defs>
                <linearGradient id="cine-ground" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" class="gr0" />
                  <stop offset="0.25" class="gr1" />
                  <stop offset="1" stop-color="#020108" />
                </linearGradient>
                <radialGradient id="cine-pool">
                  <stop offset="0" stop-color="#3dff9a" stop-opacity="0.45" />
                  <stop offset="1" stop-color="#3dff9a" stop-opacity="0" />
                </radialGradient>
              </defs>
              <rect x="-900" y={HORIZON} width="2440" height="800" fill="url(#cine-ground)" />
              <path class="cine-rail" d={`M-900 ${HORIZON + 0.5} H1540`} />
              {!reduced && (
                <g class="cine-cars">
                  {CARS.map((c) => (
                    <g class={c.dir ? 'rev' : ''} style={{ animationDuration: `${c.dur}s`, animationDelay: `${c.delay}s` }}>
                      <rect x="0" y={c.y} width="7" height="2.4" rx="1" />
                      <rect x="11" y={c.y} width="7" height="2.4" rx="1" />
                    </g>
                  ))}
                </g>
              )}
              {[-3, -2, -1, 0, 1, 2, 3].map((k) => (
                <path class="cine-lane" d={`M${320 + k * 40} ${HORIZON} L${320 + k * 260} 1100`} />
              ))}
              <ellipse class={`cine-pool${lit ? ' on' : ''}`} cx="320" cy="780" rx="230" ry="44" fill="url(#cine-pool)" />
              <ellipse class={`cine-shadow${d.genkoOn ? ' on' : ''}`} cx={GENKO.x} cy="798" rx="34" ry="7" />
              <ellipse class={`cine-shadow${d.darkOn ? ' on' : ''}`} cx={DARK.x} cy="796" rx="44" ry="8" />
            </svg>

            {fac && (
              <div class={`cine-fac${lit ? ' on' : ''}${act === 'power' ? ' act-power' : ''}`} key={act === 'power' ? `p${i}` : 'fac'}>
                <div class="cine-beam" />
                <IsoFactory art={fac.art} lit={lit} />
                <span class="cine-fac-name">{fac.name}</span>
                {act === 'power' && <i class="cine-ring" />}
              </div>
            )}

            <div class={`cine-actor genko-a${d.genkoOn ? ' on' : ''}${line.who === 'genko' ? ' talk' : ''}`} style={{ left: `${GENKO.x - 55}px`, top: `${GENKO.y - 55}px` }}>
              <div class={`cine-act${act ? ` act-${act}` : ''}`} key={`g${i}`}>
                <Genko size={110} mood={genkoMood(lastMood('genko'))} />
                {act === 'flyin' && <i class="cine-trail" />}
              </div>
            </div>

            <div class={`cine-actor dark-a${d.darkOn ? ' on' : ''}${line.who === 'dark' ? ' talk' : ''}`} style={{ left: `${DARK.x - 60}px`, top: `${DARK.y - 60}px` }}>
              <div class={`cine-act${act ? ` act-${act}` : ''}`} key={`d${i}`}>
                <DarkMeter size={120} mood={lastMood('dark') ?? 'smirk'} />
                {act === 'sneak' && <i class="cine-smoke" />}
                {act === 'flee' && <i class="cine-smoke late" />}
              </div>
            </div>

            {beat === 'scan' && !reduced && (
              <svg class="cine-svg cine-fx" width="640" height="1000" key={`sc${i}`}>
                <defs>
                  <linearGradient id="cine-scan-g" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0" stop-color="#5cf2ff" stop-opacity="0.75" />
                    <stop offset="1" stop-color="#5cf2ff" stop-opacity="0" />
                  </linearGradient>
                </defs>
                <g class="cine-scan" style={{ transformOrigin: `${GENKO.x + 16}px ${GENKO.y - 12}px` }}>
                  <path d={`M${GENKO.x + 16} ${GENKO.y - 12} L${scanTo.x + 40} ${scanTo.y - 90} L${scanTo.x + 40} ${scanTo.y + 70} Z`} fill="url(#cine-scan-g)" />
                </g>
                <g class="cine-readout" transform={`translate(${scanTo.x + 34} ${scanTo.y - 96})`}>
                  <rect width="104" height="34" rx="5" />
                  <text x="8" y="14">ODČITEK</text>
                  <text x="8" y="28" class="v">
                    {(1000 + ((i * 7919) % 8999)).toLocaleString('sl-SI')} kWh
                  </text>
                </g>
              </svg>
            )}
            {beat === 'connect' && !reduced && (
              <svg class="cine-svg cine-fx" width="640" height="1000" key={`cn${i}`}>
                <path class="cine-link" d={LINK} />
                {[0, 1, 2, 3, 4, 5].map((k) => (
                  <rect class="cine-packet" width="7" height="7" rx="1.5" x="-3.5" y="-3.5">
                    <animateMotion dur="1.4s" begin={`${k * 0.22}s`} repeatCount="indefinite" rotate="auto" {...({ path: LINK } as Record<string, string>)} />
                  </rect>
                ))}
              </svg>
            )}
            {act === 'heal' && !reduced && (
              <div class="cine-heal" key={`hl${i}`} style={{ left: `${DARK.x}px`, top: `${DARK.y}px` }}>
                <i class="ring" />
                <i class="ring late" />
                {HEAL.map((h) => (
                  <b style={{ '--dx': `${h.dx}px`, animationDelay: `${h.delay}ms`, animationDuration: `${h.dur}ms` }} />
                ))}
              </div>
            )}
            {(act === 'zap' || act === 'hit') && !reduced && (
              <svg class="cine-svg cine-fx" width="640" height="1000" key={`fx${i}`}>
                {act === 'zap' && (
                  <g class="cine-bolt">
                    <path class="glow" d={BOLT} />
                    <path d={BOLT} />
                    <path class="core" d={BOLT} />
                  </g>
                )}
                {act === 'hit' && (
                  <g class="cine-sparks" transform={`translate(${DARK.x} ${DARK.y - 10})`}>
                    {SPARKS.map((s) => (
                      <path d={`M0 0 L${s.dx} ${s.dy}`} style={{ animationDelay: `${s.delay}ms` }} />
                    ))}
                    <circle r="26" class="burst" />
                  </g>
                )}
              </svg>
            )}
          </div>

          {/* Foreground: dark shapes close to the lens give depth on push-ins. */}
          <div class="cine-layer" style={tf(DEPTH.fore)}>
            <svg class="cine-svg" width="640" height="1000">
              <path class="cine-fore" d="M-260 1000 L-260 880 L-40 892 L40 928 L80 1000 Z" />
              <path class="cine-fore" d="M900 1000 L900 870 L700 884 L612 930 L580 1000 Z" />
              <path class="cine-fore post" d="M58 1000 L66 860 L74 860 L82 1000 Z M552 1000 L560 850 L568 850 L576 1000 Z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Lens: weather, grade, flashes, grain, vignette. */}
      {(weather === 'rain' || weather === 'storm') && <div class={`cine-rain${weather === 'storm' ? ' heavy' : ''}`} />}
      {weather === 'snow' && (
        <>
          <div class="cine-snow" />
          <div class="cine-snow near" />
        </>
      )}
      {weather === 'storm' && !reduced && <div class="cine-lightning" />}
      {beat === 'reveal' && <div class="cine-spot" key={`sp${i}`} />}
      {beat === 'glitch' && !reduced && <div class="cine-glitch" key={`gl${i}`} />}
      {!reduced && act === 'heal' && <div class="cine-flash heal" key={`hf${i}`} />}
      {scene.tone === 'boss' && !healed && <div class="cine-alarm" />}
      {!reduced && act === 'power' && <div class="cine-flare" key={`fl${i}`} />}
      {!reduced && (act === 'hit' || act === 'zap') && <div class={`cine-flash ${act}`} key={`fx${i}`} />}
      {!reduced && cuts > 0 && <div class="cine-cut" key={`c${cuts}`} />}
      <div class="cine-grade" />
      {!reduced && <div class="cine-grain" />}
      <div class="cine-vignette" />
      {i === 0 && <ChapterCard title={scene.title} />}
    </div>
  );
}

/** Opening title, like the first seconds of an episode. */
function ChapterCard({ title }: { title: string }) {
  const [kicker, name] = title.includes('·') ? title.split('·').map((s) => s.trim()) : ['', title];
  return (
    <div class="cine-card">
      {kicker && <small>{kicker}</small>}
      <strong>{name}</strong>
    </div>
  );
}
