import { useEffect, useMemo, useState } from 'preact/hooks';
import { audio, buzz } from '../../audio/sfx';
import { GENKO, pick } from '../../core/genko';
import { FACILITIES, facilityById, LEVELS } from '../../core/levels';
import { facilityRate } from '../../core/balance';
import { fmt } from '../../core/format';
import { dailyNumber } from '../../core/daily';
import type { LevelOutcome } from '../../state/store';
import { nav, type Screen } from '../nav';
import { playScene } from '../story';
import { IsoFactory } from '../components/IsoFactory';
import { BATTLE_MS, LevelBattle } from '../components/LevelBattle';
import { CountUp, Stars } from '../components/Common';
import { IconChip, IconCheck, IconMap, IconRetry, IconShare, IconX } from '../components/Icons';
import { KIND_NAME } from './PlayScreen';

/** Rough demand charge used for the "what this means in euros" line. */
const EUR_PER_KW_YEAR = 48;

/** The battle plays first; everything else is timed after it. */
const T0 = BATTLE_MS;

export function ResultScreen({ outcome, from }: { outcome: LevelOutcome; from: Screen }) {
  const { level, result, checks, stars, reward } = outcome;
  const isDaily = level.id.startsWith('daily-');
  const [shown, setShown] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const timers: number[] = [];
    for (let i = 0; i < stars; i++)
      timers.push(
        window.setTimeout(() => {
          audio.play(`star${i + 1}` as 'star1');
          buzz(20);
          setShown(i + 1);
        }, T0 + 200 + i * 350),
      );
    if (reward.kwh > 0) timers.push(window.setTimeout(() => audio.play('coin'), T0 + 300 + stars * 350));
    if (outcome.litFacility || outcome.regionDone) timers.push(window.setTimeout(() => audio.play('unlock'), T0 + 1300));
    // Story beats: the boss KO into the region celebration, a facility coming online,
    // or the Dark Meter gloating after a lost boss. Leaving early still plays the rewards.
    let beat: (() => void) | null = null;
    if (outcome.regionDone) beat = () => playScene(`r${level.region}-ko`, () => nav.setState({ victory: level.region }));
    else if (outcome.litFacility) beat = () => playScene(`fac-${outcome.litFacility}`);
    if (level.boss && stars === 0 && !isDaily) timers.push(window.setTimeout(() => playScene(`r${level.region}-taunt`), T0 + 1400));
    const fire = () => {
      const b = beat;
      beat = null;
      b?.();
    };
    if (beat) timers.push(window.setTimeout(fire, T0 + 2600));
    return () => {
      timers.forEach(clearTimeout);
      fire();
    };
  }, []);

  const line = useMemo(() => (stars === 3 ? pick(GENKO.perfect) : stars > 0 ? pick(GENKO.win) : pick(GENKO.fail)), []);
  const next = !isDaily ? LEVELS.find((l) => l.region === level.region && l.index === level.index + 1) : undefined;
  const lit = outcome.litFacility ? facilityById(outcome.litFacility) : null;
  const m = result.metrics;
  const art = (facilityById(level.facilityId) ?? FACILITIES.find((f) => f.region === level.region) ?? FACILITIES[0]).art;
  /** Staggered entrance delay (ms) for the sections below the battle. */
  let d = T0 - 200;
  const nextD = (step = 120) => ({ '--d': (d += step) });
  const share = async () => {
    const key = level.id.slice(6);
    const text = `InGenious Grid Rush ⚡ Dnevni izziv #${dailyNumber(key)}\n${KIND_NAME[level.stages[0].kind]} ${'⭐'.repeat(stars)}${'☆'.repeat(3 - stars)}\n${result.emoji}${outcome.daily?.streak ? `\n🔥 Niz: ${outcome.daily.streak}` : ''}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
      }
    } catch {
      /* user cancelled */
    }
  };

  const playAgain = () => nav.getState().go({ name: 'play', level, from });

  return (
    <div class="result" role="dialog" aria-label="Rezultat">
      <LevelBattle art={art} win={stars > 0} perfect={stars === 3} quip={line} kwh={reward.kwh} />

      <div class="res-head res-in" style={nextD(0)}>
        <div class="res-kicker">{level.name}</div>
        <h1>{stars === 3 ? 'Popolno!' : stars > 0 ? 'Opravljeno!' : 'Skoraj!'}</h1>
        <Stars n={shown} big label={`${stars} od 3 zvezdic`} />
      </div>

      <div class="res-rewards res-in" style={nextD()}>
        {reward.kwh > 0 && (
          <div class="reward">
            <b style={{ color: 'var(--green)' }}><CountUp prefix="+" value={reward.kwh} delay={T0 + 300 + stars * 350} /></b>
            <span>kWh</span>
          </div>
        )}
        <div class="reward">
          <b style={{ color: 'var(--dp)' }}><CountUp prefix="+" value={reward.dp} delay={T0 + 450 + stars * 350} /></b>
          <span>DP</span>
        </div>
        {reward.chips > 0 && (
          <div class="reward">
            <b style={{ color: 'var(--chip)' }}><CountUp prefix="+" value={reward.chips} delay={T0 + 600 + stars * 350} ms={400} /></b>
            <span>čipi</span>
          </div>
        )}
      </div>

      {reward.kwh > 0 && (
        <p class="res-flow res-in" style={nextD()}>
          ⚡ kWh gredo na števec prihranka · z njimi v <b>Nadgradnjah</b> izboljšaš objekte, ki potem varčujejo sami.
        </p>
      )}

      <ul class="res-goals res-in" style={nextD()}>
        {checks.map((c) => (
          <li>
            <span class={`goal-ico${c.met ? '' : ' miss'}`}>{c.met ? <IconCheck /> : <IconX />}</span>
            <span class="grow">{c.label}</span>
            {!c.met && c.nearMiss && <span class="near">{c.nearMiss}</span>}
          </li>
        ))}
      </ul>

      {m.baseline !== undefined && (
        <div class="res-in" style={nextD()}>
          <div class="compare">
            <div>
              <span class="tiny muted">Brez tebe</span>
              <b style={{ color: 'var(--red)' }}>{fmt(m.baseline)} kW</b>
            </div>
            <div>
              <span class="tiny muted">S tabo</span>
              <b style={{ color: 'var(--green)' }}>{fmt(m.peak)} kW</b>
            </div>
          </div>
          {m.saved > 0 && (
            <p class="small muted" style={{ textAlign: 'center', margin: '0 0 10px' }}>
              −{fmt(m.saved)} kW obračunske moči ≈ {fmt(m.saved * EUR_PER_KW_YEAR)} € manj omrežnine na leto (ocena)
            </p>
          )}
        </div>
      )}

      {result.notes && result.notes.length > 0 && (
        <div class="card small res-in" style={{ ...nextD(), marginBottom: '10px', display: 'grid', gap: '6px', lineHeight: 1.4 }}>
          {result.notes.map((n) => (
            <div style={{ color: n.startsWith('✓') ? 'var(--text)' : 'var(--muted)' }}>{n}</div>
          ))}
        </div>
      )}

      {lit && (
        <div class="res-unlock res-in" style={nextD(200)}>
          <span class="thumb"><IsoFactory art={lit.art} lit /></span>
          <div>
            <b style={{ color: 'var(--green)' }}>{lit.name} je osvetljena!</b>
            <p>Idle števec zdaj polni +{fmt(facilityRate(lit, 0))} kWh/h, tudi ko igra ni odprta.</p>
          </div>
        </div>
      )}
      {outcome.regionDone && (
        <div class="res-unlock chip res-in" style={nextD(200)}>
          <span class="thumb" style={{ color: 'var(--chip)' }}><IconChip width={34} height={34} /></span>
          <div>
            <b style={{ color: 'var(--chip)' }}>Regija dokončana!</b>
            <p>{level.region === 1 ? 'Odklenil si dnevne izzive. Na zemljevidu te čaka Mlekarna.' : 'Temni števec je izgubil še en vir moči.'}</p>
          </div>
        </div>
      )}
      {outcome.newCard && (
        <div class={`dcard res-card ${level.card.rarity}`} style={{ ...nextD(250), minHeight: 0 }}>
          <span class="rarity">Nova kartica · {level.card.rarity}</span>
          <b>{level.card.name}</b>
          {level.card.text}
        </div>
      )}
      {outcome.daily?.usedFreeze && <p class="small" style={{ textAlign: 'center', color: 'var(--orange)' }}>Zamrzovalnik niza je rešil tvoj niz. 🧊</p>}

      <div class="res-actions res-in" style={nextD(150)}>
        {isDaily && stars > 0 && (
          <button class="btn primary big" onClick={share}>
            <IconShare width={18} /> {copied ? 'Kopirano!' : 'Deli rezultat'}
          </button>
        )}
        {next && stars > 0 && (
          <button
            class="btn green big"
            onClick={() => {
              nav.getState().go({ name: 'region', region: next.region });
              nav.getState().openIntro(next);
            }}
          >
            Naprej: {next.name}
          </button>
        )}
        {stars === 0 && (
          <button class="btn primary big" onClick={playAgain}>
            <IconRetry width={18} /> Poskusi znova
          </button>
        )}
        <div class={stars > 0 && stars < 3 ? 'row2' : ''} style={stars > 0 && stars < 3 ? undefined : { display: 'grid' }}>
          {stars > 0 && stars < 3 && (
            <button class="btn" onClick={playAgain}>
              <IconRetry width={16} /> Za 3 zvezdice
            </button>
          )}
          <button class="btn" onClick={() => nav.getState().go(from)}>
            {isDaily ? 'Nazaj' : <><IconMap width={16} /> Zemljevid</>}
          </button>
        </div>
      </div>
    </div>
  );
}
