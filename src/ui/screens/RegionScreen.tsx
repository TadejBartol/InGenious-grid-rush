import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { FACILITIES, levelsOfRegion, regionById } from '../../core/levels';
import { isFacilityLit, isLevelUnlocked, facilityRate, goalLabel, regionStars } from '../../core/balance';
import { fmt } from '../../core/format';
import { audio, buzz } from '../../audio/sfx';
import { useGame } from '../../state/store';
import { nav, useNav } from '../nav';
import { playScene } from '../story';
import { DarkMeter } from '../components/DarkMeter';
import { Genko, GenkoSays } from '../components/Genko';
import { IsoFactory } from '../components/IsoFactory';
import { Sheet } from '../components/Common';
import { IconBack, IconChart, IconCogen, IconDark, IconLock, IconPlug, IconSearch, IconStar, IconTrophy, IconWave } from '../components/Icons';
import { KIND_NAME } from './PlayScreen';
import type { FacilityDef, LevelDef, Stage } from '../../core/types';

const KIND_ICON: Record<Stage['kind'], typeof IconPlug> = {
  priklop: IconPlug,
  konica: IconChart,
  detektiv: IconSearch,
  wmbus: IconWave,
  kogenerator: IconCogen,
};

/** Remembers the last "current" level per region, so a newly unlocked node can celebrate once. */
const lastCurrent = new Map<number, string | undefined>();

const FACILITY_GAP = 210;
const NODE_GAP = 112;
const TOP = 24;

type Item = { kind: 'facility'; f: FacilityDef; y: number; side: 'left' | 'right' } | { kind: 'level'; level: LevelDef; x: number; y: number; n: number };

/** Lays the region out as a winding trail: facility vignettes, then their levels on a sine path. */
function layout(region: number, width: number) {
  const items: Item[] = [];
  let y = TOP;
  let n = 0;
  for (const f of FACILITIES.filter((x) => x.region === region)) {
    const levels = levelsOfRegion(region).filter((l) => l.facilityId === f.id);
    const firstX = 0.5 + 0.27 * Math.sin(n * 1.15);
    items.push({ kind: 'facility', f, y, side: firstX > 0.5 ? 'left' : 'right' });
    y += FACILITY_GAP;
    for (const level of levels) {
      const x = (0.5 + 0.27 * Math.sin(n * 1.15)) * width;
      items.push({ kind: 'level', level, x, y, n });
      y += level.boss ? NODE_GAP + 34 : NODE_GAP;
      n++;
    }
  }
  return { items, height: y + 140 };
}

function trail(points: { x: number; y: number }[]) {
  if (!points.length) return '';
  let d = `M${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const dy = (b.y - a.y) / 2;
    d += ` C${a.x} ${a.y + dy} ${b.x} ${b.y - dy} ${b.x} ${b.y}`;
  }
  return d;
}

export function RegionScreen({ region }: { region: number }) {
  const r = regionById(region);
  const levels = useGame((s) => s.levels);
  const unlocked = useGame((s) => s.regionsUnlocked);
  const upgrades = useGame((s) => s.upgrades);
  const { intro } = useNav();
  const all = levelsOfRegion(region);
  const current = all.find((l) => isLevelUnlocked(l, levels, unlocked) && !(levels[l.id]?.stars > 0));
  const stars = regionStars(region, levels);
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(340);
  const [celebrate, setCelebrate] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => playScene(`r${region}-intro`), 450);
    return () => clearTimeout(t);
  }, [region]);

  useLayoutEffect(() => {
    const el = box.current!;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const prev = lastCurrent.get(region);
    if (prev !== undefined && current && prev !== current.id) {
      setCelebrate(current.id);
      setTimeout(() => {
        audio.play('unlock');
        buzz(30);
      }, 450);
    }
    lastCurrent.set(region, current?.id);
    const t = setTimeout(() => document.querySelector('.node.current')?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 120);
    return () => clearTimeout(t);
  }, [region, current?.id]);

  const { items, height } = layout(region, width);
  const nodes = items.filter((i): i is Extract<Item, { kind: 'level' }> => i.kind === 'level');
  const doneUntil = current ? nodes.findIndex((n) => n.level.id === current.id) : nodes.length - 1;
  const full = trail(nodes);
  const done = trail(nodes.slice(0, Math.max(1, doneUntil + 1)));

  return (
    <>
      <div class="region-head sticky">
        <button class="icon-btn" onClick={() => nav.getState().go({ name: 'tabs', tab: 'map' })} aria-label="Nazaj na zemljevid">
          <IconBack />
        </button>
        <div class="grow">
          <h1>{r.name}</h1>
          <div class="region-progress" aria-label={`${stars.have} od ${stars.max} zvezdic`}>
            <i style={{ width: `${(stars.have / stars.max) * 100}%` }} />
            <span class="mono">★ {stars.have}/{stars.max}</span>
          </div>
        </div>
      </div>

      <div class="trail" ref={box} style={{ height: `${height}px` }}>
        <svg class="trail-svg" width={width} height={height} aria-hidden="true">
          <path d={full} class="trail-bed" />
          <path d={full} class="trail-future" />
          {doneUntil > 0 && <path d={done} class="trail-glow" />}
          {doneUntil > 0 && <path d={done} class="trail-done" />}
          {doneUntil > 0 && <path d={done} class="trail-flow" />}
        </svg>

        {items.map((it) =>
          it.kind === 'facility' ? (
            <FacilityVignette f={it.f} y={it.y} side={it.side} lit={isFacilityLit(it.f, levels)} level={upgrades[it.f.id] ?? 0} />
          ) : (
            <LevelNode
              item={it}
              stars={levels[it.level.id]?.stars ?? 0}
              open={isLevelUnlocked(it.level, levels, unlocked)}
              isCurrent={it.level.id === current?.id}
              pop={celebrate === it.level.id}
              width={width}
            />
          ),
        )}

        <div class="trail-end" style={{ top: `${height - 110}px` }}>
          {current ? (
            <span class="muted small">Premagaj bossa in osvetli regijo.</span>
          ) : (
            <span class="trail-trophy">
              <IconTrophy width={28} height={28} /> Regija osvetljena!
            </span>
          )}
        </div>
      </div>
      {intro && <LevelIntro level={intro} best={levels[intro.id]?.stars ?? 0} />}
    </>
  );
}

function FacilityVignette({ f, y, side, lit, level }: { f: FacilityDef; y: number; side: 'left' | 'right'; lit: boolean; level: number }) {
  return (
    <div class={`vignette ${side}${lit ? ' lit' : ''}`} style={{ top: `${y}px` }}>
      <div class="vignette-art">
        <IsoFactory art={f.art} lit={lit} level={level} />
      </div>
      <div class="vignette-label">
        <b>{f.name}</b>
        <span class={`lit-chip${lit ? '' : ' dark'}`}>{lit ? `Osvetljeno · +${fmt(facilityRate(f, level))} kWh/h` : 'V temi'}</span>
      </div>
    </div>
  );
}

function LevelNode({ item, stars, open, isCurrent, pop, width }: { item: Extract<Item, { kind: 'level' }>; stars: number; open: boolean; isCurrent: boolean; pop: boolean; width: number }) {
  const { level, x, y } = item;
  const Icon = level.boss ? IconDark : KIND_ICON[level.stages[0].kind];
  const state = !open ? 'locked' : stars > 0 ? 'done' : 'current';
  const kinds = level.stages.map((s) => KIND_NAME[s.kind]).join(' + ');
  const side = x > width / 2 ? 'left' : 'right';
  return (
    <div class={`node-wrap${pop ? ' pop' : ''}`} style={{ left: `${x}px`, top: `${y}px` }}>
      {isCurrent && (
        <div class="node-genko" style={{ left: side === 'left' ? '38px' : `${Math.max(8 - x, -86)}px` }}>
          <Genko size={46} mood="happy" />
          <span class="node-genko-say">Igraj!</span>
        </div>
      )}
      <button
        class={`node ${state}${level.boss ? ' boss' : ''}${isCurrent ? ' current' : ''}`}
        disabled={!open}
        onClick={() => {
          audio.play('tap');
          buzz(10);
          if (level.boss) {
            audio.play('alarm');
            buzz([40, 30, 40]);
            playScene(`r${level.region}-boss`, () => nav.getState().openIntro(level));
          } else nav.getState().openIntro(level);
        }}
        aria-label={`${level.boss ? 'BOSS · ' : ''}Stopnja ${level.index}: ${level.name}, ${kinds}${open ? `, ${stars} zvezdic` : ', zaklenjena'}`}
      >
        {open ? <Icon /> : <IconLock />}
        <span class="node-num mono">{level.index}</span>
      </button>
      {open && (
        <div class="node-stars" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <IconStar class={i < stars ? 'star-on' : 'star-off'} />
          ))}
        </div>
      )}
      {level.boss && stars === 0 && (
        <>
          <div class="boss-zone" aria-hidden="true" />
          <div class={`boss-lurker ${side === 'left' ? 'right' : 'left'}`} aria-hidden="true">
            <DarkMeter size={64} mood={open ? 'angry' : 'smirk'} />
          </div>
        </>
      )}
      {level.boss && <span class="boss-tag">BOSS</span>}
      <div class={`node-label ${side}`}>
        <b>{level.name}</b>
        <span>{level.boss ? `${level.stages.length} faze · ${kinds}` : kinds}</span>
      </div>
    </div>
  );
}

export function LevelIntro({ level, best }: { level: LevelDef; best: number }) {
  const close = () => nav.getState().openIntro(null);
  const screen = nav.getState().screen;
  return (
    <Sheet label={level.name} onClose={close}>
      {level.boss ? (
        <div class="boss-head">
          <div class="boss-head-art">
            <DarkMeter size={96} mood="angry" />
          </div>
          <div>
            <div class="boss-kicker">⚠ Boss boj · stopnja {level.region}-{level.index}</div>
            <h2>{level.name}</h2>
            <div class="boss-phases">
              {level.stages.map((st, i) => {
                const Icon = KIND_ICON[st.kind];
                return (
                  <span>
                    <Icon width={14} height={14} /> {i + 1}. {KIND_NAME[st.kind]}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div class="tiny muted" style={{ letterSpacing: '0.14em', textTransform: 'uppercase' }}>
            {level.region > 0 ? `Stopnja ${level.region}-${level.index}` : 'Dnevni izziv'} · {level.stages.map((s) => KIND_NAME[s.kind]).join(' + ')}
          </div>
          <h2 style={{ fontSize: '22px', margin: '4px 0 12px' }}>{level.name}</h2>
        </>
      )}
      <GenkoSays text={level.intro} mood={level.boss ? 'worried' : 'happy'} />
      {level.boss && <p class="small boss-warn">Faze si sledijo brez odmora. Če pade prva, druge ne boš videl.</p>}
      <div class="lesson" style={{ marginTop: '12px' }}>
        {level.lesson}
      </div>
      <ul class="goal-list">
        {level.stars.map((g, i) => (
          <li>
            <IconStar class={i < best ? 'star-on' : 'star-off'} />
            {goalLabel(g)}
          </li>
        ))}
      </ul>
      <button
        class={`btn ${level.boss ? 'danger' : 'primary'} big`}
        onClick={() => {
          audio.unlock();
          audio.play('go');
          nav.getState().go({ name: 'play', level, from: screen });
        }}
      >
        {best > 0 ? 'Igraj znova' : level.boss ? 'V boj!' : 'Igraj'}
      </button>
    </Sheet>
  );
}
