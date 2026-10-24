import { useMemo, useState } from 'preact/hooks';
import { FACILITIES, LEVELS, REGIONS } from '../../core/levels';
import { isFacilityLit, isLevelUnlocked, regionComplete, regionStars } from '../../core/balance';
import { GENKO, pick } from '../../core/genko';
import { audio } from '../../audio/sfx';
import { store, useGame } from '../../state/store';
import { nav } from '../nav';
import { Genko, GenkoSays } from '../components/Genko';
import { Cost, Sheet } from '../components/Common';
import { IconLock, IconPlay } from '../components/Icons';
import { KIND_NAME } from './PlayScreen';
import type { RegionDef } from '../../core/types';

/** Stylised outline of Slovenia, 100×66 units. */
const SLOVENIA =
  'M14 14 L24 10 L34 9 L44 11 L52 8 L60 10 L68 8 L76 6 L84 2 L92 4 L96 10 L94 16 L88 18 L88 24 L84 28 L80 34 L76 36 L72 42 L66 44 L62 50 L58 52 L52 56 L46 58 L40 62 L34 60 L30 56 L24 58 L20 56 L14 58 L10 56 L6 52 L8 46 L12 42 L10 36 L6 30 L8 24 L12 20 Z';

/** The Dark Meter weakens as facilities light up across the whole campaign (6 regions × 3 facilities). */
export function darkMeterStrength(lit: number) {
  return Math.max(0, Math.round(100 - (lit / 18) * 100));
}

export function MapScreen() {
  const levels = useGame((s) => s.levels);
  const unlocked = useGame((s) => s.regionsUnlocked);
  const chips = useGame((s) => s.chips);
  const [sheet, setSheet] = useState<RegionDef | null>(null);
  const lit = FACILITIES.filter((f) => isFacilityLit(f, levels)).length;
  const strength = darkMeterStrength(lit);
  // The loop always shows the next goal.
  const next = LEVELS.find((l) => isLevelUnlocked(l, levels, unlocked) && !(levels[l.id]?.stars > 0));
  const tip = useMemo(() => (lit === 0 ? 'Začni v Industrijski coni. Livarna nima niti enega merilnika.' : pick(GENKO.idle)), [lit]);

  const open = (r: RegionDef) => {
    audio.play('tap');
    if (unlocked.includes(r.id)) nav.getState().go({ name: 'region', region: r.id });
    else setSheet(r);
  };

  return (
    <>
      <div class="card dark-meter" style={{ marginTop: '6px' }}>
        <svg width="42" height="42" viewBox="0 0 42 42" aria-hidden="true">
          <circle cx="21" cy="21" r="18" fill="#1a0610" stroke="#ff3b5c" stroke-width="2" opacity={0.4 + strength / 170} />
          <path d="M11 24 l5 -6 l5 4 l5 -9 l5 7" stroke="#ff3b5c" stroke-width="2.5" fill="none" stroke-linecap="round" />
        </svg>
        <div class="grow">
          <div class="row">
            <b class="grow">Temni števec</b>
            <span class="mono small" style={{ color: 'var(--red)' }}>
              {strength} %
            </span>
          </div>
          <div class="dm-bar">
            <i style={{ width: `${strength}%` }} />
          </div>
        </div>
      </div>

      <div class="map-wrap">
        <svg class="map-svg" viewBox="0 0 100 66" role="img" aria-label="Zemljevid Slovenije z regijami">
          <defs>
            <linearGradient id="land" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#13214a" />
              <stop offset="1" stop-color="#0b1430" />
            </linearGradient>
            <pattern id="dots" width="3" height="3" patternUnits="userSpaceOnUse">
              <circle cx="1.5" cy="1.5" r="0.35" fill="#38e1ff" opacity="0.25" />
            </pattern>
          </defs>
          <path d={SLOVENIA} fill="url(#land)" stroke="#38e1ff" stroke-width="0.5" stroke-opacity="0.7" />
          <path d={SLOVENIA} fill="url(#dots)" />
          {REGIONS.slice(1).map((r, i) => {
            const a = REGIONS[i];
            return <line x1={a.pos.x} y1={(a.pos.y * 66) / 100} x2={r.pos.x} y2={(r.pos.y * 66) / 100} stroke="#38e1ff" stroke-width="0.35" stroke-dasharray="1 1.2" opacity={unlocked.includes(r.id) ? 0.8 : 0.25} />;
          })}
        </svg>
        {REGIONS.map((r) => {
          const done = regionComplete(r.id, levels);
          const isOpen = unlocked.includes(r.id);
          const st = regionStars(r.id, levels);
          return (
            <button class={`region-node ${done ? 'done' : isOpen ? 'open' : 'locked'}`} style={{ left: `${r.pos.x}%`, top: `${r.pos.y}%` }} onClick={() => open(r)} aria-label={`${r.name}${isOpen ? '' : ', zaklenjeno'}`}>
              <span class="dot">{isOpen ? r.id : <IconLock />}</span>
              <span>{r.name}</span>
              {isOpen && st.max > 0 && <span class="tiny mono muted">★ {st.have}/{st.max}</span>}
            </button>
          );
        })}
      </div>

      {next && (
        <button
          class="card level-btn next"
          style={{ marginTop: '4px' }}
          onClick={() => {
            audio.play('tap');
            nav.getState().go({ name: 'region', region: next.region });
            nav.getState().openIntro(next);
          }}
        >
          <span class="level-num">
            <IconPlay width={14} />
          </span>
          <span class="grow">
            <span class="tiny muted">Naslednji cilj · {next.region}-{next.index}</span>
            <b class="small" style={{ display: 'block' }}>
              {next.name}
            </b>
            <span class="level-kind">{next.stages.map((x) => KIND_NAME[x.kind]).join(' + ')}</span>
          </span>
        </button>
      )}

      <div style={{ marginTop: '12px' }}>
        <GenkoSays text={tip} />
      </div>

      {sheet && (
        <Sheet label={sheet.name} onClose={() => setSheet(null)}>
          <RegionLocked region={sheet} chips={chips} levels={levels} onClose={() => setSheet(null)} />
        </Sheet>
      )}
    </>
  );
}

function RegionLocked({ region, chips, levels, onClose }: { region: RegionDef; chips: number; levels: Record<string, { stars: number }>; onClose: () => void }) {
  const prevDone = regionComplete(region.id - 1, levels);
  const prev = REGIONS.find((r) => r.id === region.id - 1)!;
  return (
    <div style={{ display: 'grid', gap: '12px' }}>
      <div class="row">
        <Genko size={56} mood={region.available ? 'happy' : 'smug'} />
        <div class="grow">
          <h2 style={{ fontSize: '20px' }}>{region.name}</h2>
          <div class="small muted">{region.theme}</div>
        </div>
      </div>
      <div class="lesson">Nova mehanika: {region.mechanic}</div>
      {!region.available ? (
        <p class="small muted">Ta regija je v pripravi za naslednjo fazo razvoja. Temni števec se tam že skriva.</p>
      ) : !prevDone ? (
        <p class="small muted">Najprej osvetli vse objekte v regiji »{prev.name}« in premagaj bossa.</p>
      ) : (
        <button
          class="btn primary big"
          disabled={chips < region.unlockChips}
          onClick={() => {
            if (store.getState().unlockRegion(region.id)) {
              audio.play('unlock');
              onClose();
              nav.getState().go({ name: 'region', region: region.id });
            }
          }}
        >
          Odkleni za <Cost kind="chips" n={region.unlockChips} /> čipe
        </button>
      )}
    </div>
  );
}
