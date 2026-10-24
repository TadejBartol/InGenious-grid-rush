import { useEffect, useState } from 'preact/hooks';
import { audio, buzz } from '../../audio/sfx';
import type { FacilityDef } from '../../core/types';
import { DarkMeter } from './DarkMeter';
import { Genko, type Mood } from './Genko';
import { IsoFactory } from './IsoFactory';

/** Phase start times in ms: enter, charge, zap, impact, outcome, quip. */
const AT = [0, 650, 1000, 1300, 1850, 2300];
/** When the battle has played out and the rest of the result may animate in. */
export const BATTLE_MS = 2100;

/**
 * The short fight that ends every level: InGenious flies in, charges and zaps the
 * Dark Meter squatting on the facility. A win launches the meter off screen and the
 * facility lights up; a loss bounces the bolt off its shield and it stays, gloating.
 * Tap to skip to the end.
 */
export function LevelBattle({ art, win, perfect, quip, kwh }: { art: FacilityDef['art']; win: boolean; perfect: boolean; quip: string; kwh: number }) {
  const reduced = document.documentElement.classList.contains('reduced-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [phase, setPhase] = useState(reduced ? 5 : 0);

  useEffect(() => {
    if (reduced) return;
    const t = AT.slice(1).map((ms, k) => window.setTimeout(() => setPhase(k + 1), ms));
    return () => t.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (phase === 1) audio.play('on');
    if (phase === 2) (audio.play('zap'), buzz(30));
    if (phase === 3) {
      if (win) (audio.play('boom'), buzz([60, 30, 90]));
      else (audio.play('blocked'), buzz([20, 40, 20]));
    }
    if (phase === 4) audio.play(win ? 'powerup' : 'alarm');
  }, [phase]);

  const darkMood = phase < 2 ? 'smirk' : win ? (phase < 4 ? 'hurt' : 'fleeing') : phase === 2 ? 'angry' : 'smirk';
  const heroMood: Mood = phase < 1 ? 'happy' : phase < 4 ? 'smug' : win ? 'wow' : 'worried';
  const lit = win && phase >= 4;

  return (
    <div
      class={`battle ${win ? 'win' : 'lose'}${perfect ? ' perfect' : ''} ph-${phase}`}
      onClick={() => setPhase(5)}
      role="img"
      aria-label={win ? 'InGenious je izgnal Temni števec iz objekta' : 'Temni števec je ostal v objektu'}
    >
      <div class="battle-sky" aria-hidden="true" />
      <div class="battle-ground" aria-hidden="true" />
      <div class="battle-fac">
        <IsoFactory art={art} lit={lit} />
        {lit && <div class="battle-sparks" aria-hidden="true">{Array.from({ length: 10 }, (_, k) => <i style={{ '--k': k }} />)}</div>}
        {lit && kwh > 0 && (
          <div class="battle-kwh" aria-hidden="true">
            {Array.from({ length: perfect ? 7 : 4 }, (_, k) => (
              <span style={{ '--k': k }}>+{Math.max(1, Math.round(kwh / (3 + (k % 4))))}</span>
            ))}
          </div>
        )}
      </div>

      {(win ? phase < 5 : true) && (
        <div class="battle-dark">
          {!win && phase >= 3 && <div class="battle-shield" aria-hidden="true" />}
          <DarkMeter size={76} mood={darkMood} />
          {win && phase >= 3 && <div class="battle-smoke" aria-hidden="true"><i /><i /><i /><i /></div>}
        </div>
      )}

      <div class="battle-hero">
        {phase === 1 && <div class="battle-charge" aria-hidden="true" />}
        <Genko size={70} mood={heroMood} />
      </div>

      {phase === 2 && (
        <svg class="battle-bolt" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path class="b-glow" d="M24 64 L34 52 L38 60 L48 42 L52 52 L60 34 L64 40 L69 28" />
          <path class="b-mid" d="M24 64 L34 52 L38 60 L48 42 L52 52 L60 34 L64 40 L69 28" />
          <path class="b-core" d="M24 64 L34 52 L38 60 L48 42 L52 52 L60 34 L64 40 L69 28" />
        </svg>
      )}
      {(phase === 2 || phase === 3) && <div class={`battle-impact${win ? '' : ' blocked'}`} aria-hidden="true" />}
      {phase >= 4 && (
        <div class="battle-banner" aria-hidden="true">
          {win ? (perfect ? 'Popolnoma izgnan!' : 'Izgnan!') : 'Še vedno tu …'}
        </div>
      )}
      {phase >= 5 && <div class="battle-quip">{quip}</div>}
    </div>
  );
}
