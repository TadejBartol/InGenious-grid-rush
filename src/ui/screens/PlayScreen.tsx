import { useEffect, useRef, useState } from 'preact/hooks';
import type { GameResult, LevelDef, Stage } from '../../core/types';
import { audio } from '../../audio/sfx';
import { PriklopView } from '../../games/priklop/PriklopView';
import { KonicaView } from '../../games/konica/KonicaView';
import { DetektivView } from '../../games/detektiv/DetektivView';
import { WmbusView } from '../../games/wmbus/WmbusView';
import { KogeneratorView } from '../../games/kogenerator/KogeneratorView';
import { logEvent } from '../../state/persist';
import { store, useGame } from '../../state/store';
import { nav, type Screen } from '../nav';
import { GenkoSays } from '../components/Genko';
import { Sheet } from '../components/Common';
import { IconPlay, IconRetry, IconX } from '../components/Icons';

export const KIND_NAME: Record<Stage['kind'], string> = { priklop: 'Priklop', konica: 'Lov na konico', detektiv: 'Detektiv', wmbus: 'Radijsko omrežje', kogenerator: 'Kogenerator' };

/** First-time tutorial bubbles, keyed by level. */
const TIPS: Record<string, string> = {
  'r1-1': 'Povleci kabel od merilnika M1 do vrat 1 na prehodu zgoraj. Kabli se ne smejo križati.',
  'r1-2': 'Dva merilnika imata isti ID. Tapni merilnik in mu nastavi prost naslov, preden ga priklopiš.',
  'r1-3': 'Tapni porabnika, da ga izklopiš. Drži krivuljo pod rdečo črto, a ne pusti, da se zaloga izprazni.',
  'r1-5': 'Številka pod vrati je hitrost, ki jo vrata pričakujejo. Merilnik mora imeti enako.',
  'r1-6': 'Ko porabnika vklopiš, za trenutek potegne več. Ne vklapljaj vsega naenkrat.',
  'r1-7': 'Pozor, povezava je nestabilna. Ko kabel pade, ga znova povleci.',
  'r2-1': 'Tapni na graf tam, kjer debela črta odstopa od svetle. Svetla je tipičen teden.',
  'r3-1': 'Drži prst na polju in poglej krog dosega. Spusti, ko krog pokrije vse vodomere.',
  'r3-2': 'Najprej prehod, nato repetitor. Repetitor mora biti v krogu prehoda, sicer ostane oranžen.',
  'r4-1': 'Motor zaženi, ko je rumena črta (cena) visoko. Toplota mora pokriti oranžne stolpce, sicer se mesto ohladi.',
  'r4-2': 'Ko motor dela več toplote, kot jo mesto rabi, potisni hranilnik na »polni«. Ko motor stoji, ga prazni.',
};

export function PlayScreen({ level, from }: { level: LevelDef; from: Screen }) {
  const [stageIdx, setStageIdx] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState<'countdown' | 'playing' | 'between'>('countdown');
  const [count, setCount] = useState(3);
  const [paused, setPaused] = useState(false);
  const results = useRef<GameResult[]>([]);
  const research = useGame((s) => s.research);
  const seenTips = useGame((s) => s.seenTips);
  const reducedMotion = useGame((s) => s.settings.reducedMotion);
  const stage = level.stages[stageIdx];
  const multi = level.stages.length > 1;

  useEffect(() => {
    void logEvent({ t: Date.now(), name: 'level_start', data: { level: level.id } });
  }, []);

  useEffect(() => {
    if (phase !== 'countdown') return;
    setCount(3);
    audio.play('count');
    let n = 3;
    const id = setInterval(() => {
      n--;
      if (n > 0) {
        setCount(n);
        audio.play('count');
      } else {
        clearInterval(id);
        audio.play('go');
        setPhase('playing');
      }
    }, 650);
    return () => clearInterval(id);
  }, [phase, stageIdx, attempt]);

  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && setPaused(true);
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, []);

  const onDone = (r: GameResult) => {
    results.current = [...results.current, r];
    // A failed boss phase ends the attempt: no point playing phase 2.
    if (stageIdx < level.stages.length - 1 && r.completed) {
      setPhase('between');
      setTimeout(() => {
        setStageIdx((i) => i + 1);
        setPhase('countdown');
      }, 2400);
      return;
    }
    const bonusDp = results.current.reduce((s, x) => s + (x.metrics.bonusDp ?? 0), 0);
    const outcome = store.getState().completeLevel(level, results.current, Date.now(), bonusDp);
    void logEvent({ t: Date.now(), name: level.id.startsWith('daily-') ? 'daily_end' : 'level_end', data: { level: level.id, stars: outcome.stars, score: outcome.result.score, mistakes: outcome.result.mistakes } });
    nav.getState().go({ name: 'result', outcome, from });
  };

  const restart = () => {
    results.current = [];
    setPaused(false);
    setStageIdx(0);
    setAttempt((a) => a + 1);
    setPhase('countdown');
  };

  const tip = TIPS[level.id] && !seenTips.includes(level.id) && stageIdx === 0 ? TIPS[level.id] : null;
  const common = {
    title: level.name,
    subtitle: multi ? `Faza ${stageIdx + 1}/${level.stages.length} · ${KIND_NAME[stage.kind]}` : KIND_NAME[stage.kind],
    paused: paused || phase !== 'playing',
    tip,
    onTipDone: () => store.getState().markTip(level.id),
    onPause: () => setPaused(true),
    onDone,
    research,
    reducedMotion,
  };
  const key = `${stageIdx}-${attempt}`;

  return (
    <div class="play">
      {stage.kind === 'priklop' && <PriklopView key={key} {...common} params={stage.params} />}
      {stage.kind === 'konica' && <KonicaView key={key} {...common} params={stage.params} />}
      {stage.kind === 'detektiv' && <DetektivView key={key} {...common} params={stage.params} />}
      {stage.kind === 'wmbus' && <WmbusView key={key} {...common} params={stage.params} />}
      {stage.kind === 'kogenerator' && <KogeneratorView key={key} {...common} params={stage.params} />}
      {phase === 'countdown' && (
        <div class="countdown" aria-live="assertive">
          <span key={count}>{count}</span>
        </div>
      )}
      {phase === 'between' && (
        <div class="overlay center">
          <div class="sheet" style={{ textAlign: 'center' }}>
            <GenkoSays text={`Faza ${stageIdx + 1} opravljena. Zdaj pa ${KIND_NAME[level.stages[stageIdx + 1].kind].toLowerCase()}!`} mood="wow" />
          </div>
        </div>
      )}
      {paused && phase !== 'between' && (
        <Sheet center label="Premor" onClose={() => setPaused(false)}>
          <h2 style={{ textAlign: 'center', marginBottom: '14px' }}>Premor</h2>
          <div style={{ display: 'grid', gap: '10px' }}>
            <button class="btn primary big" onClick={() => setPaused(false)}>
              <IconPlay width={18} /> Nadaljuj
            </button>
            <button class="btn big" onClick={restart}>
              <IconRetry width={18} /> Začni znova
            </button>
            <button class="btn big" onClick={() => nav.getState().go(from)}>
              <IconX width={18} /> Zapusti stopnjo
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
