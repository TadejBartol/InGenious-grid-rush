import { FACILITIES } from '../../core/levels';
import { facilityRate, facilityUpgradeCost, idleMultiplier, isFacilityLit, MAX_FACILITY_LEVEL, offlineCapHours, RESEARCH } from '../../core/balance';
import { fmt } from '../../core/format';
import { audio, buzz } from '../../audio/sfx';
import { store, useGame } from '../../state/store';
import { Cost } from '../components/Common';
import { GenkoSays } from '../components/Genko';

export function UpgradesScreen() {
  const s = useGame((x) => x);
  const lit = FACILITIES.filter((f) => s.regionsUnlocked.includes(f.region));
  const buy = (ok: boolean) => {
    if (ok) {
      audio.play('coin');
      buzz(15);
    } else audio.play('blocked');
  };
  return (
    <>
      <div class="section-title">Objekti · porabi kWh</div>
      <p class="small muted" style={{ margin: '-4px 2px 10px' }}>
        Optimizacija osvetljenih objektov pospeši idle števec. Trenutni množitelj merilnikov ×{idleMultiplier(s.research).toFixed(2)} · pomnilnik prehoda {offlineCapHours(s.research)} h.
      </p>
      {lit.map((f) => {
        const isLit = isFacilityLit(f, s.levels);
        const lvl = s.upgrades[f.id] ?? 0;
        const cost = facilityUpgradeCost(f, lvl);
        const maxed = lvl >= MAX_FACILITY_LEVEL;
        return (
          <div class="card upgrade">
            <div class="grow">
              <b>{f.name}</b>
              <div class="small muted">
                {isLit ? `${fmt(facilityRate(f, lvl))} → ${fmt(facilityRate(f, lvl + 1))} kWh/h` : 'Osvetli objekt, da ga lahko optimiziraš.'}
              </div>
              <div class="lvl-pips" aria-label={`Stopnja ${lvl} od ${MAX_FACILITY_LEVEL}`}>
                {Array.from({ length: MAX_FACILITY_LEVEL }, (_, i) => (
                  <i class={i < lvl ? 'on' : ''} />
                ))}
              </div>
            </div>
            <button class="btn small-btn" disabled={!isLit || maxed || s.kwh < cost} onClick={() => buy(store.getState().buyUpgrade(f.id))}>
              {maxed ? 'MAX' : <Cost kind="kwh" n={cost} />}
            </button>
          </div>
        );
      })}

      <div class="section-title">Raziskave · porabi DP</div>
      {RESEARCH.map((r) => {
        const lvl = s.research[r.id] ?? 0;
        const maxed = lvl >= r.costs.length;
        const cost = r.costs[lvl];
        return (
          <div class="card upgrade">
            <div class="grow">
              <b>{r.name}</b>
              <div class="small muted">{r.text}</div>
              <div class="tiny" style={{ color: 'var(--brand)', marginTop: '4px' }}>
                InGenious: {r.feature}
              </div>
              <div class="lvl-pips">
                {r.costs.map((_, i) => (
                  <i class={i < lvl ? 'on' : ''} />
                ))}
              </div>
            </div>
            <button class="btn small-btn" disabled={maxed || s.dp < cost} onClick={() => buy(store.getState().buyResearch(r.id))}>
              {maxed ? 'MAX' : <Cost kind="dp" n={cost} />}
            </button>
          </div>
        );
      })}
      <div style={{ marginTop: '14px' }}>
        <GenkoSays text="Brez nakupov s pravim denarjem. Vse se zasluži z znanjem. Kot v pravi energetiki." mood="smug" />
      </div>
    </>
  );
}
