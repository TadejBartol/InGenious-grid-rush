import { useEffect, useMemo, useState } from 'preact/hooks';
import { audio, buzz } from '../../audio/sfx';
import { GENKO, pick } from '../../core/genko';
import { facilityById, LEVELS } from '../../core/levels';
import { facilityRate } from '../../core/balance';
import { fmt } from '../../core/format';
import { dailyNumber } from '../../core/daily';
import type { LevelOutcome } from '../../state/store';
import { nav, type Screen } from '../nav';
import { GenkoSays } from '../components/Genko';
import { CountUp, Stars } from '../components/Common';
import { IconCheck, IconRetry, IconShare, IconX } from '../components/Icons';
import { KIND_NAME } from './PlayScreen';

/** Rough demand charge used for the "what this means in euros" line. */
const EUR_PER_KW_YEAR = 48;

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
        }, 450 + i * 350),
      );
    if (reward.kwh > 0) timers.push(window.setTimeout(() => audio.play('coin'), 450 + stars * 350 + 100));
    if (outcome.litFacility || outcome.regionDone) timers.push(window.setTimeout(() => audio.play('unlock'), 1700));
    // First boss clear: hand over to the big region celebration.
    if (outcome.regionDone) timers.push(window.setTimeout(() => nav.setState({ victory: level.region }), 2600));
    return () => timers.forEach(clearTimeout);
  }, []);

  const line = useMemo(() => (stars === 3 ? pick(GENKO.perfect) : stars > 0 ? pick(GENKO.win) : pick(GENKO.fail)), []);
  const next = !isDaily ? LEVELS.find((l) => l.region === level.region && l.index === level.index + 1) : undefined;
  const lit = outcome.litFacility ? facilityById(outcome.litFacility) : null;
  const m = result.metrics;
  const confetti = useMemo(
    () =>
      stars > 0
        ? Array.from({ length: 22 }, (_, i) => ({
            left: `${(i * 37) % 100}%`,
            delay: `${(i % 7) * 0.12}s`,
            dur: `${2.2 + (i % 5) * 0.35}s`,
            rot: `${(i % 2 ? 1 : -1) * (90 + i * 13)}deg`,
            text: `+${Math.max(1, Math.round(reward.kwh / (3 + (i % 4))))}`,
          }))
        : [],
    [],
  );

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
      {!document.documentElement.classList.contains('reduced-motion') && (
        <div class="confetti" aria-hidden="true">
          {confetti.map((c) => (
            <span style={{ left: c.left, animationDelay: c.delay, animationDuration: c.dur, ['--rot' as string]: c.rot }}>{c.text}</span>
          ))}
        </div>
      )}
      <div class="tiny muted" style={{ textAlign: 'center', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
        {level.name}
      </div>
      <h1>{stars === 3 ? 'Popolno!' : stars > 0 ? 'Opravljeno!' : 'Skoraj!'}</h1>
      <Stars n={shown} big label={`${stars} od 3 zvezdic`} />
      <div style={{ margin: '8px 0 14px' }}>
        <GenkoSays text={line} mood={stars === 3 ? 'wow' : stars > 0 ? 'happy' : 'worried'} />
      </div>

      <ul class="goal-list card" style={{ margin: '0 0 12px' }}>
        {checks.map((c) => (
          <li>
            {c.met ? <IconCheck style={{ color: 'var(--green)' }} /> : <IconX style={{ color: 'var(--red)' }} />}
            <span class="grow">{c.label}</span>
            {!c.met && c.nearMiss && <span class="small" style={{ color: 'var(--orange)' }}>{c.nearMiss}</span>}
          </li>
        ))}
      </ul>

      {m.baseline !== undefined && (
        <>
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
            <p class="small muted" style={{ textAlign: 'center', marginBottom: '8px' }}>
              −{fmt(m.saved)} kW obračunske moči ≈ {fmt(m.saved * EUR_PER_KW_YEAR)} € manj omrežnine na leto (ocena)
            </p>
          )}
        </>
      )}

      {result.notes && result.notes.length > 0 && (
        <div class="card small" style={{ marginBottom: '10px', display: 'grid', gap: '6px', lineHeight: 1.4 }}>
          {result.notes.map((n) => (
            <div style={{ color: n.startsWith('✓') ? 'var(--text)' : 'var(--muted)' }}>{n}</div>
          ))}
        </div>
      )}

      <div class="reward-row">
        {reward.kwh > 0 && (
          <div class="reward">
            <b style={{ color: 'var(--green)' }}><CountUp prefix="+" value={reward.kwh} delay={450 + stars * 350} /></b>
            <span>kWh</span>
          </div>
        )}
        <div class="reward">
          <b style={{ color: 'var(--dp)' }}><CountUp prefix="+" value={reward.dp} delay={600 + stars * 350} /></b>
          <span>DP</span>
        </div>
        {reward.chips > 0 && (
          <div class="reward">
            <b style={{ color: 'var(--chip)' }}><CountUp prefix="+" value={reward.chips} delay={750 + stars * 350} ms={400} /></b>
            <span>InGenious čipi</span>
          </div>
        )}
      </div>

      {lit && (
        <div class="card" style={{ borderColor: 'var(--green)', marginBottom: '10px' }}>
          <b style={{ color: 'var(--green)' }}>{lit.name} je osvetljena!</b>
          <p class="small muted" style={{ marginTop: '4px' }}>
            Idle števec zdaj polni +{fmt(facilityRate(lit, 0))} kWh/h, tudi ko igra ni odprta.
          </p>
        </div>
      )}
      {outcome.regionDone && (
        <div class="card" style={{ borderColor: 'var(--chip)', marginBottom: '10px' }}>
          <b style={{ color: 'var(--chip)' }}>Regija dokončana!</b>
          <p class="small muted" style={{ marginTop: '4px' }}>
            {level.region === 1 ? 'Odklenil si dnevne izzive. Na zemljevidu te čaka Mlekarna.' : 'Temni števec je izgubil še en vir moči.'}
          </p>
        </div>
      )}
      {outcome.newCard && (
        <div class={`dcard ${level.card.rarity}`} style={{ minHeight: 0, marginBottom: '10px' }}>
          <span class="rarity">Nova kartica · {level.card.rarity}</span>
          <b>{level.card.name}</b>
          {level.card.text}
        </div>
      )}
      {outcome.daily?.usedFreeze && <p class="small" style={{ textAlign: 'center', color: 'var(--orange)' }}>Zamrzovalnik niza je rešil tvoj niz. 🧊</p>}

      <div style={{ flex: 1 }} />
      <div style={{ display: 'grid', gap: '10px', marginTop: '12px' }}>
        {isDaily && stars > 0 && (
          <button class="btn primary big" onClick={share}>
            <IconShare width={18} /> {copied ? 'Kopirano!' : 'Deli rezultat'}
          </button>
        )}
        {stars < 3 && (
          <button class={`btn big ${stars === 0 ? 'primary' : ''}`} onClick={playAgain}>
            <IconRetry width={18} /> Poskusi znova
          </button>
        )}
        {next && stars > 0 && (
          <button class="btn green big" onClick={() => {
              nav.getState().go({ name: 'region', region: next.region });
              nav.getState().openIntro(next);
            }}>
            Naprej: {next.name}
          </button>
        )}
        <button class="btn big" onClick={() => nav.getState().go(from)}>
          {isDaily ? 'Nazaj' : 'Na zemljevid regije'}
        </button>
      </div>
    </div>
  );
}
