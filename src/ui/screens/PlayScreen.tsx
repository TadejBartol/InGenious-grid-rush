import { useEffect, useRef, useState } from 'preact/hooks';
import type { GameResult, LevelDef, Stage } from '../../core/types';
import { audio } from '../../audio/sfx';
import { PriklopView } from '../../games/priklop/PriklopView';
import { KonicaView } from '../../games/konica/KonicaView';
import { DetektivView } from '../../games/detektiv/DetektivView';
import { WmbusView } from '../../games/wmbus/WmbusView';
import { ToplovodView } from '../../games/toplovod/ToplovodView';
import { PuscanjeView } from '../../games/puscanje/PuscanjeView';
import { PolnilnicaView } from '../../games/polnilnica/PolnilnicaView';
import { PrestreziView } from '../../games/prestrezi/PrestreziView';
import { SelitevView } from '../../games/selitev/SelitevView';
import { voice } from '../../audio/voice';
import { FACILITIES } from '../../core/levels';
import { sceneById } from '../../core/story';
import { logEvent } from '../../state/persist';
import { store, useGame } from '../../state/store';
import { nav, type Screen } from '../nav';
import { GenkoSays } from '../components/Genko';
import { GameHelpSheet, HelpContext } from '../components/GameHelp';
import { Sheet } from '../components/Common';
import { IconInfo, IconPlay, IconRetry, IconX } from '../components/Icons';

export const KIND_NAME: Record<Stage['kind'], string> = {
  priklop: 'Priklop',
  konica: 'Lov na konico',
  detektiv: 'Detektiv',
  wmbus: 'Radijsko omrežje',
  toplovod: 'Toplovod',
  puscanje: 'Lov na puščanje',
  polnilnica: 'Polnilnica',
  prestrezi: 'Prestrezi',
  selitev: 'Selitev',
};

/** First-time tutorial bubbles, keyed by level. */
const TIPS: Record<string, string> = {
  'r1-1': 'Povleci kabel od merilnika M1 do okrogle vtičnice iste barve. Kabli se ne smejo križati in morajo skupaj zapolniti vsa polja.',
  'r1-2': 'Dva merilnika imata isti ID. Tapni merilnik in mu nastavi prost naslov, preden ga priklopiš.',
  'r1-3': 'Tapni porabnika, da ga izklopiš. Drži krivuljo pod rdečo črto, a ne pusti, da se zaloga izprazni.',
  'r1-6': 'Ko porabnika vklopiš, za trenutek potegne več. Ne vklapljaj vsega naenkrat.',
  'r1-7': 'Pozor, povezava je nestabilna. Ko kabel pade, ga znova povleci.',
  'r2-1': 'Tapni na graf, kjer modra črta uide iz svetlega pasu. Čas se upočasni: izberi, kaj je vzrok. Prej ko opaziš, več DP.',
  'r2-4': 'Zgoraj je urnik. Kar je na njem, je načrtovano: tega ne prijavi, četudi izgleda kot anomalija.',
  'r3-1': 'Drži prst na polju in poglej krog dosega. Spusti, ko krog pokrije vse vodomere.',
  'r3-2': 'Najprej prehod, nato repetitor. Repetitor mora biti v krogu prehoda, sicer ostane oranžen.',
  'r4-1': 'Tapni cev, da jo zasukaš. Vroča voda iz toplarne mora priti do vseh stavb, noben konec cevi ne sme ostati odprt.',
  'r4-3': 'Številka na števcu pove, koliko od 8 sosednjih odsekov pušča. Kjer si prepričan, da pušča, zapri ventil. Kjer je varno, preglej.',
  'r4-10': 'Temni števec bo med igro sukal cevi, ki že nosijo vodo. Pazi na rdeč blisk in jih vrni.',
  'r7-1': 'Povleci avto naprej ali nazaj po njegovi vrsti. Avto s strelo pripelji do polnilnice ob robu parkirišča.',
  'r7-2': 'Številka na bateriji pove, koliko premikov še zmore električni avto. Ko pade na nič, obstane.',
  'r7-4': 'Polnilnice imajo moč, priključek pa mejo. Dva hitra polnilnika hkrati lahko presežeta mejo, zato počakaj, da se en avto napolni.',
  'r5-1': 'Potegni s prstom čez rdeče bodičaste meritve Temnega števca. Modre so prave: pusti jih, da padejo v karton.',
  'r5-2': 'Ko jih leti več v vrsti, jih prereži z enim potegom za kombo. Moder šesterokotnik AI upočasni čas.',
  'r5-3': 'Rdeč krog z belim križem je pravi alarm. Je strašen, a resničen: ne reži ga!',
  'r5-4': 'Nekatere lažne se preoblečejo v prave. Na vrhu leta se razkrijejo. Zeleni ščit počisti vse lažne naenkrat.',
  'r5-6': 'Vijoličen oklepni paket zdrži tri reze. Vsak potez šteje le enkrat.',
  'r6-1': 'Zgoraj je tabela kod. Vsak zapis pošlji na pravi nov merilnik, preden ga čas odnese.',
  'r6-2': 'Rumen Wh pomeni 1000× večjo številko. Najprej pritisni »Wh → kWh«, nato zapis pošlji.',
  'r6-4': '##### in negativne vrednosti v koš. Če je mesec pri merilniku že zelen, je zapis dvojnik: tudi v koš.',
};

export function PlayScreen({ level, from }: { level: LevelDef; from: Screen }) {
  const [stageIdx, setStageIdx] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState<'countdown' | 'playing' | 'between'>('countdown');
  const [count, setCount] = useState(3);
  const [paused, setPaused] = useState(false);
  const [help, setHelp] = useState(false);
  const results = useRef<GameResult[]>([]);
  const research = useGame((s) => s.research);
  const seenTips = useGame((s) => s.seenTips);
  const reducedMotion = useGame((s) => s.settings.reducedMotion);
  const stage = level.stages[stageIdx];
  const multi = level.stages.length > 1;

  useEffect(() => {
    void logEvent({ t: Date.now(), name: 'level_start', data: { level: level.id } });
    // Warm the voices of the scenes that can follow this level, so the result beat starts without a gap.
    const ids = FACILITIES.filter((f) => f.levels.includes(level.id)).map((f) => `fac-${f.id}`);
    if (level.boss) ids.push(`r${level.region}-ko`, `r${level.region}-taunt`);
    const t = window.setTimeout(
      () =>
        ids.forEach((id) => {
          const sc = sceneById(id);
          if (sc) void voice.preload(sc.id, sc.lines);
        }),
      1500,
    );
    return () => clearTimeout(t);
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
    void logEvent({
      t: Date.now(),
      name: level.id.startsWith('daily-') ? 'daily_end' : 'level_end',
      data: { level: level.id, stars: outcome.stars, score: outcome.result.score, mistakes: outcome.result.mistakes },
    });
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
    paused: paused || help || phase !== 'playing',
    tip,
    onTipDone: () => store.getState().markTip(level.id),
    onPause: () => setPaused(true),
    onDone,
    research,
    reducedMotion,
  };
  const key = `${stageIdx}-${attempt}`;

  return (
    <HelpContext.Provider value={() => setHelp(true)}>
      <div class="play">
        {stage.kind === 'priklop' && <PriklopView key={key} {...common} params={stage.params} />}
        {stage.kind === 'konica' && <KonicaView key={key} {...common} params={stage.params} />}
        {stage.kind === 'detektiv' && <DetektivView key={key} {...common} params={stage.params} />}
        {stage.kind === 'wmbus' && <WmbusView key={key} {...common} params={stage.params} />}
        {stage.kind === 'toplovod' && <ToplovodView key={key} {...common} params={stage.params} />}
        {stage.kind === 'puscanje' && <PuscanjeView key={key} {...common} params={stage.params} />}
        {stage.kind === 'polnilnica' && <PolnilnicaView key={key} {...common} params={stage.params} />}
        {stage.kind === 'prestrezi' && <PrestreziView key={key} {...common} params={stage.params} />}
        {stage.kind === 'selitev' && <SelitevView key={key} {...common} params={stage.params} />}
        {phase === 'countdown' && (
          <div class={`countdown${level.boss ? ' boss' : ''}`} aria-live="assertive">
            {level.boss && (
              <div class="boss-banner">
                <b>BOSS</b>
                <span>
                  Faza {stageIdx + 1} od {level.stages.length} · {KIND_NAME[stage.kind]}
                </span>
              </div>
            )}
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
        {help && <GameHelpSheet kind={stage.kind} kindName={KIND_NAME[stage.kind]} level={level} tip={TIPS[level.id]} onClose={() => setHelp(false)} />}
        {paused && !help && phase !== 'between' && (
          <Sheet center label="Premor" onClose={() => setPaused(false)}>
            <h2 style={{ textAlign: 'center', marginBottom: '14px' }}>Premor</h2>
            <div style={{ display: 'grid', gap: '10px' }}>
              <button class="btn primary big" onClick={() => setPaused(false)}>
                <IconPlay width={18} /> Nadaljuj
              </button>
              <button class="btn big" onClick={() => setHelp(true)}>
              <IconInfo width={18} /> Navodila
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
    </HelpContext.Provider>
  );
}
