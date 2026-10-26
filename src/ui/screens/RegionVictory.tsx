import { useEffect, useState } from 'preact/hooks';
import { audio, buzz } from '../../audio/sfx';
import { facilityRate, isFacilityLit, regionStars } from '../../core/balance';
import { FACILITIES, REGIONS, regionById } from '../../core/levels';
import { useGame } from '../../state/store';
import { nav } from '../nav';
import { playScene } from '../story';
import { CountUp } from '../components/Common';
import { DarkMeter } from '../components/DarkMeter';
import { Genko } from '../components/Genko';
import { IsoFactory } from '../components/IsoFactory';
import { IconChip, IconStar } from '../components/Icons';

/**
 * First boss clear: the villain gets knocked out, the region's facilities light up
 * one by one, the totals roll in, and the story moves on.
 */
export function RegionVictory({ region }: { region: number }) {
  const r = regionById(region);
  const levels = useGame((s) => s.levels);
  const upgrades = useGame((s) => s.upgrades);
  const facilities = FACILITIES.filter((f) => f.region === region);
  const [phase, setPhase] = useState(0);
  const [litCount, setLitCount] = useState(0);
  const stars = regionStars(region, levels);
  const rate = facilities.filter((f) => isFacilityLit(f, levels)).reduce((s, f) => s + facilityRate(f, upgrades[f.id] ?? 0), 0);
  const nextRegion = REGIONS.find((x) => x.id === region + 1);

  useEffect(() => {
    const t: number[] = [];
    audio.play('spark');
    buzz([60, 40, 120]);
    t.push(window.setTimeout(() => audio.play('fail'), 500));
    t.push(window.setTimeout(() => setPhase(1), 1900));
    facilities.forEach((_, i) =>
      t.push(
        window.setTimeout(() => {
          setLitCount(i + 1);
          audio.play('unlock');
          buzz(25);
        }, 2400 + i * 650),
      ),
    );
    t.push(window.setTimeout(() => (setPhase(2), audio.play('win')), 2600 + facilities.length * 650));
    t.push(window.setTimeout(() => (setPhase(3), audio.play('coin')), 3600 + facilities.length * 650));
    return () => t.forEach(clearTimeout);
  }, []);

  const finish = () => {
    audio.play('tap');
    playScene(`r${region}-victory`, () => {
      // Credits roll after the story finale (Š-0) and again after the last region.
      nav.setState({ victory: null, credits: region === 6 || !nextRegion });
      // Back to the level's result, which waited underneath with its rewards.
      if (nav.getState().screen.name !== 'result') nav.getState().go({ name: 'tabs', tab: 'map' });
    });
  };

  return (
    <div class={`victory phase-${phase}`} role="dialog" aria-label={`${r.name} je osvetljena`}>
      <div class="victory-rays" aria-hidden="true" />
      {phase === 0 && (
        <div class="ko">
          <div class="ko-villain">
            <DarkMeter size={150} mood="hurt" />
          </div>
          <div class="ko-stamp">BOSS PREMAGAN!</div>
        </div>
      )}
      {phase >= 1 && (
        <div class="victory-body">
          <div class="victory-kicker">Regija osvetljena</div>
          <h1 class="victory-title">{r.name}</h1>
          <div class="victory-skyline">
            {facilities.map((f, i) => (
              <div class={`vf${i < litCount ? ' on' : ''}`} style={{ '--i': i }}>
                <IsoFactory art={f.art} lit={i < litCount} level={upgrades[f.id] ?? 0} />
                <span>{f.name}</span>
              </div>
            ))}
          </div>
          {phase >= 2 && (
            <div class="victory-stats">
              <div>
                <b class="mono" style={{ color: 'var(--green)' }}>
                  <CountUp value={Math.round(rate)} prefix="+" ms={1200} />
                </b>
                <span>kWh/h iz regije</span>
              </div>
              <div>
                <b class="mono" style={{ color: '#ffd86b' }}>
                  <IconStar width={18} height={18} /> {stars.have}/{stars.max}
                </b>
                <span>zvezdic</span>
              </div>
              <div>
                <b class="mono" style={{ color: 'var(--chip)' }}>
                  <IconChip width={18} height={18} /> +3
                </b>
                <span>čipi za bossa</span>
              </div>
            </div>
          )}
          {phase >= 3 && (
            <div class="victory-next">
              <Genko size={56} mood="wow" />
              <div>
                {region === 1 && <p><b>Odklenjeni dnevni izzivi!</b> Nov izziv vsak dan, enak za vse.</p>}
                {nextRegion?.available ? (
                  <p>
                    Na zemljevidu čaka <b>{nextRegion.name}</b>
                    {nextRegion.unlockChips ? ` (odklep: ${nextRegion.unlockChips} čipov)` : ''}.
                  </p>
                ) : !nextRegion ? (
                  <p>
                    <b>Vseh šest regij sveti.</b> Mesto je izmerjeno do zadnjega kWh.
                  </p>
                ) : (
                  <p>Temni števec se je umaknil globlje. Nadaljevanje zgodbe prihaja.</p>
                )}
              </div>
            </div>
          )}
          {phase >= 3 && (
            <button class="btn green big victory-btn" onClick={finish}>
              {nextRegion ? 'Nadaljuj zgodbo' : 'Epilog'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
