import { useState } from 'preact/hooks';
import { audio } from '../../audio/sfx';
import { GENKO } from '../../core/genko';
import { useGame } from '../../state/store';
import { nav } from '../nav';
import { Genko } from '../components/Genko';

export function TitleScreen() {
  const firstRun = useGame((s) => Object.keys(s.levels).length === 0 && s.stats.plays === 0);
  const [step, setStep] = useState(-1);

  const start = () => {
    audio.unlock();
    audio.play('go');
    if (firstRun && step < GENKO.welcome.length - 1) return setStep((s) => s + 1);
    nav.getState().go(firstRun ? { name: 'region', region: 1 } : { name: 'tabs', tab: 'map' });
  };

  return (
    <div class="title-screen" onClick={step >= 0 ? start : undefined}>
      <div class="logo">
        <small>INGENIOUS</small>
        <span>GRID RUSH</span>
      </div>
      <Genko size={120} mood={step >= 0 ? 'happy' : 'wow'} />
      {step < 0 ? (
        <>
          <p class="tagline">Priklopi merilnike, ulovi potratnost v živih podatkih in ugasni Temni števec.</p>
          <button class="btn primary big" style={{ maxWidth: '320px' }} onClick={start}>
            {firstRun ? 'Začni' : 'Nadaljuj'}
          </button>
        </>
      ) : (
        <>
          <div class="bubble" style={{ maxWidth: '340px', textAlign: 'left' }} key={step}>
            {GENKO.welcome[step]}
          </div>
          <p class="tiny muted">
            {step + 1}/{GENKO.welcome.length} · tapni za naprej
          </p>
        </>
      )}
    </div>
  );
}
