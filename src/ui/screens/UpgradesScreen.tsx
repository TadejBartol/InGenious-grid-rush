import { useEffect, useRef, useState } from 'preact/hooks';
import { FACILITIES, regionById } from '../../core/levels';
import { facilityRate, facilityUpgradeCost, idleMultiplier, isFacilityLit, MAX_FACILITY_LEVEL, offlineCapHours, RESEARCH, type ResearchDef } from '../../core/balance';
import { fmt } from '../../core/format';
import { audio, buzz } from '../../audio/sfx';
import { store, useGame } from '../../state/store';
import { Cost } from '../components/Common';
import { GenkoSays } from '../components/Genko';
import { IsoFactory } from '../components/IsoFactory';
import { IconBolt, IconChart, IconData, IconDark, IconLock, IconPlug, IconSearch, IconStar, IconUp, IconWave } from '../components/Icons';

type Tab = 'objekti' | 'lab';
let lastTab: Tab = 'objekti';
let lastFacility = 0;

interface Burst {
  id: number;
  x: number;
  y: number;
  text: string;
  kind: 'kwh' | 'dp';
}

/** Little "+12 kWh/h" sparks that fly up from where you tapped. */
function useBursts() {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const add = (x: number, y: number, text: string, kind: Burst['kind']) => {
    const id = Math.random();
    setBursts((b) => [...b, { id, x, y, text, kind }]);
    setTimeout(() => setBursts((b) => b.filter((q) => q.id !== id)), 1100);
  };
  const layer = (
    <div class="burst-layer" aria-hidden="true">
      {bursts.map((b) => (
        <span class={`burst ${b.kind}`} key={b.id} style={{ left: `${b.x}px`, top: `${b.y}px` }}>
          {b.text}
          {Array.from({ length: 8 }, (_, i) => (
            <i style={{ '--a': `${i * 45}deg` }} />
          ))}
        </span>
      ))}
    </div>
  );
  return { add, layer };
}

/** Press once to buy, hold to keep buying. */
function useHold(action: () => boolean) {
  const timer = useRef<number>();
  const stop = () => {
    clearTimeout(timer.current);
    timer.current = undefined;
  };
  useEffect(() => stop, []);
  return {
    onPointerDown: (e: PointerEvent) => {
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      if (!action()) return;
      let delay = 380;
      const loop = () => {
        timer.current = window.setTimeout(() => {
          if (action()) {
            delay = Math.max(90, delay * 0.8);
            loop();
          }
        }, delay);
      };
      loop();
    },
    onPointerUp: stop,
    onPointerCancel: stop,
    onPointerLeave: stop,
  };
}

export function UpgradesScreen() {
  const [tab, setTab] = useState<Tab>(lastTab);
  lastTab = tab;
  const research = useGame((s) => s.research);
  return (
    <>
      <div class="seg" role="tablist">
        <button role="tab" aria-selected={tab === 'objekti'} class={tab === 'objekti' ? 'on' : ''} onClick={() => (audio.play('tap'), setTab('objekti'))}>
          <IconBolt width={16} height={16} /> Objekti
        </button>
        <button role="tab" aria-selected={tab === 'lab'} class={tab === 'lab' ? 'on' : ''} onClick={() => (audio.play('tap'), setTab('lab'))}>
          <IconData width={16} height={16} /> Laboratorij
        </button>
      </div>
      {tab === 'objekti' ? <Facilities /> : <Lab />}
      <p class="tiny muted" style={{ textAlign: 'center', margin: '14px 0 4px' }}>
        Množitelj merilnikov ×{idleMultiplier(research).toFixed(2)} · pomnilnik prehoda {offlineCapHours(research)} h
      </p>
    </>
  );
}

function Facilities() {
  const s = useGame((x) => x);
  const list = FACILITIES.filter((f) => s.regionsUnlocked.includes(f.region));
  const [idx, setIdx] = useState(Math.min(lastFacility, list.length - 1));
  lastFacility = idx;
  const [pulse, setPulse] = useState(0);
  const { add, layer } = useBursts();
  const strip = useRef<HTMLDivElement>(null);
  const f = list[idx];
  const isLit = isFacilityLit(f, s.levels);
  const lvl = s.upgrades[f.id] ?? 0;
  const cost = facilityUpgradeCost(f, lvl);
  const maxed = lvl >= MAX_FACILITY_LEVEL;
  const gain = facilityRate(f, lvl + 1) - facilityRate(f, lvl);
  const btn = useRef<HTMLButtonElement>(null);

  const buy = () => {
    const st = store.getState();
    const l = st.upgrades[f.id] ?? 0;
    const g = facilityRate(f, l + 1) - facilityRate(f, l);
    if (!st.buyUpgrade(f.id)) {
      audio.play('blocked');
      return false;
    }
    audio.play((st.upgrades[f.id] ?? 0) % 5 === 0 ? 'star3' : 'coin');
    buzz(15);
    setPulse((p) => p + 1);
    const r = btn.current?.getBoundingClientRect();
    if (r) add(r.left + r.width / 2, r.top, `+${fmt(g)} kWh/h`, 'kwh');
    return true;
  };
  const hold = useHold(buy);

  const go = (i: number) => {
    const n = (i + list.length) % list.length;
    audio.play('tap');
    setIdx(n);
    strip.current?.children[n]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  };

  return (
    <div class="fac">
      <div class="fac-strip" ref={strip} role="tablist" aria-label="Objekti">
        {list.map((x, i) => {
          const litX = isFacilityLit(x, s.levels);
          return (
            <button role="tab" aria-selected={i === idx} class={`fac-thumb${i === idx ? ' on' : ''}${litX ? ' lit' : ''}`} onClick={() => go(i)}>
              <span class="fac-thumb-art">
                <IsoFactory art={x.art} lit={litX} level={0} />
              </span>
              <span class="fac-thumb-lvl mono">{litX ? `${s.upgrades[x.id] ?? 0}` : <IconLock width={12} height={12} />}</span>
            </button>
          );
        })}
      </div>

      <div class={`fac-stage${isLit ? ' lit' : ''}`} key={f.id}>
        <div class="fac-region tiny">{regionById(f.region).name}</div>
        <button class="fac-nav prev" onClick={() => go(idx - 1)} aria-label="Prejšnji objekt">
          ‹
        </button>
        <button class="fac-nav next" onClick={() => go(idx + 1)} aria-label="Naslednji objekt">
          ›
        </button>
        <div class="fac-art" key={pulse} style={{ '--lvl': lvl }}>
          <IsoFactory art={f.art} lit={isLit} level={lvl} />
        </div>
        <h2 class="fac-name">{f.name}</h2>
        <p class="small muted fac-desc">{f.description}</p>
        {isLit ? (
          <div class="fac-rate">
            <span class="mono big-rate">{fmt(facilityRate(f, lvl))}</span>
            <span class="small"> kWh/h</span>
            {!maxed && <span class="fac-next mono">+{fmt(gain)}</span>}
          </div>
        ) : (
          <div class="fac-rate dark">V temi · reši vse stopnje objekta, da ga osvetliš</div>
        )}
        <div class="fac-ring" role="img" aria-label={`Optimizacija ${lvl} od ${MAX_FACILITY_LEVEL}`}>
          {Array.from({ length: MAX_FACILITY_LEVEL }, (_, i) => (
            <i class={`${i < lvl ? 'on' : ''}${i === 4 || i === 9 ? ' milestone' : ''}`} style={{ animationDelay: `${i * 30}ms` }} />
          ))}
        </div>
        <button ref={btn} class={`fac-buy${maxed ? ' maxed' : ''}`} disabled={!isLit || maxed || s.kwh < cost} {...hold}>
          {maxed ? (
            <b>Popolnoma optimizirano</b>
          ) : (
            <>
              <IconUp width={22} height={22} />
              <span>
                <b>Optimiziraj</b>
                <Cost kind="kwh" n={cost} />
              </span>
            </>
          )}
        </button>
        {isLit && !maxed && s.kwh < cost && <p class="tiny muted">Še {fmt(cost - Math.floor(s.kwh))} kWh. Števec se polni sam, tudi ko igra miruje.</p>}
        {isLit && !maxed && s.kwh >= cost && <p class="tiny muted">Drži gumb za hitro nadgrajevanje.</p>}
      </div>
      {layer}
    </div>
  );
}

const RESEARCH_ICON: Record<string, typeof IconBolt> = {
  vzorcenje: IconPlug,
  rezervoar: IconChart,
  napoved: IconWave,
  merilniki: IconBolt,
  ai: IconSearch,
  spomin: IconData,
  kalibracija: IconDark,
  tarifa: IconStar,
};

// Node positions on the circuit board, in % of its box. The InGenious core sits in the middle.
const NODE_POS: Record<string, { x: number; y: number }> = {
  vzorcenje: { x: 17, y: 12 },
  rezervoar: { x: 83, y: 12 },
  merilniki: { x: 17, y: 37 },
  napoved: { x: 83, y: 37 },
  kalibracija: { x: 17, y: 63 },
  tarifa: { x: 83, y: 63 },
  spomin: { x: 17, y: 88 },
  ai: { x: 83, y: 88 },
};

function Lab() {
  const research = useGame((s) => s.research);
  const regions = useGame((s) => s.regionsUnlocked);
  const open = (x: ResearchDef) => regions.includes(x.region ?? 1);
  const dp = useGame((s) => Math.floor(s.dp));
  const [sel, setSel] = useState<string>(RESEARCH[0].id);
  const [flash, setFlash] = useState<{ id: string; n: number } | null>(null);
  const { add, layer } = useBursts();
  const r = RESEARCH.find((x) => x.id === sel)!;
  const lvl = research[r.id] ?? 0;
  const maxed = lvl >= r.costs.length;
  const cost = r.costs[lvl];
  const btn = useRef<HTMLButtonElement>(null);
  const locked = !open(r);

  const buy = () => {
    if (!store.getState().buyResearch(r.id)) {
      audio.play('blocked');
      return;
    }
    audio.play('unlock');
    buzz([15, 30, 15]);
    setFlash({ id: r.id, n: Math.random() });
    const b = btn.current?.getBoundingClientRect();
    if (b) add(b.left + b.width / 2, b.top, 'NADGRAJENO', 'dp');
  };

  return (
    <div class="lab">
      <div class="board">
        <svg class="traces" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {RESEARCH.map((x) => {
            const p = NODE_POS[x.id];
            const on = (research[x.id] ?? 0) > 0;
            const d = `M50 50 L${p.x < 50 ? 34 : 66} 50 L${p.x < 50 ? 34 : 66} ${p.y} L${p.x} ${p.y}`;
            return (
              <g>
                <path d={d} class={`trace${on ? ' on' : ''}`} />
                {on && <path d={d} class="trace-flow" key={flash?.id === x.id ? flash.n : 0} />}
              </g>
            );
          })}
        </svg>
        <div class="core">
          <span>InGenious</span>
          <small class="mono">{Object.values(research).reduce((a, b) => a + b, 0)}/{RESEARCH.reduce((a, x) => a + x.costs.length, 0)}</small>
        </div>
        {RESEARCH.map((x) => (
          <LabNode
            r={x}
            level={research[x.id] ?? 0}
            selected={sel === x.id}
            locked={!open(x)}
            affordable={open(x) && (research[x.id] ?? 0) < x.costs.length && dp >= x.costs[research[x.id] ?? 0]}
            flash={flash?.id === x.id ? flash.n : 0}
            onSelect={() => (audio.play('tap'), setSel(x.id))}
          />
        ))}
      </div>
      <div class="lab-panel card" key={r.id}>
        <div class="row">
          <b class="grow">{r.name}</b>
          <span class="tiny" style={{ color: 'var(--brand)' }}>
            InGenious: {r.feature}
          </span>
        </div>
        <p class="small muted" style={{ margin: '6px 0 8px' }}>
          {r.text}
        </p>
        <div class="lvl-pips" aria-label={`Stopnja ${lvl} od ${r.costs.length}`}>
          {r.costs.map((_, i) => (
            <i class={i < lvl ? 'on' : ''} />
          ))}
        </div>
        <button ref={btn} class="btn primary big" style={{ marginTop: '10px' }} disabled={locked || maxed || dp < cost} onClick={buy}>
          {locked ? (
            <>
              <IconLock width={16} height={16} /> Odklene se z regijo {r.region}
            </>
          ) : maxed ? (
            'Raziskano do konca'
          ) : (
            <>
              Raziskuj · <Cost kind="dp" n={cost} />
            </>
          )}
        </button>
        {locked && <p class="tiny muted" style={{ marginTop: '6px' }}>Najprej odkleni regijo {regionById(r.region!).name} na zemljevidu.</p>}
        {!locked && !maxed && dp < cost && <p class="tiny muted" style={{ marginTop: '6px' }}>Še {fmt(cost - dp)} DP. DP dobiš za zvezdice, combo in hitre najdbe.</p>}
      </div>
      <div style={{ marginTop: '12px' }}>
        <GenkoSays text="Brez nakupov s pravim denarjem. Vse se zasluži z znanjem. Kot v pravi energetiki." mood="smug" />
      </div>
      {layer}
    </div>
  );
}

function LabNode({ r, level, selected, locked, affordable, flash, onSelect }: { r: ResearchDef; level: number; selected: boolean; locked: boolean; affordable: boolean; flash: number; onSelect: () => void }) {
  const p = NODE_POS[r.id];
  const Icon = RESEARCH_ICON[r.id] ?? IconData;
  const maxed = level >= r.costs.length;
  return (
    <button
      class={`lab-node${selected ? ' sel' : ''}${level > 0 ? ' on' : ''}${maxed ? ' max' : ''}${affordable ? ' can' : ''}${locked ? ' locked' : ''}`}
      style={{ left: `${p.x}%`, top: `${p.y}%` }}
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`${r.name}, stopnja ${level} od ${r.costs.length}`}
      key={flash || undefined}
    >
      {locked ? <IconLock width={22} height={22} /> : <Icon width={24} height={24} />}
      <span class="lab-pips">
        {r.costs.map((_, i) => (
          <i class={i < level ? 'on' : ''} />
        ))}
      </span>
      <span class="lab-name">{r.name}</span>
    </button>
  );
}
