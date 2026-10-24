import { useEffect, useRef, useState } from 'preact/hooks';
import { audio, buzz } from '../../audio/sfx';
import { voice } from '../../audio/voice';
import { facilityById } from '../../core/levels';
import type { Scene, StoryMood } from '../../core/story';
import { useGame } from '../../state/store';
import { DarkMeter } from './DarkMeter';
import { Genko, type Mood } from './Genko';
import { IsoFactory } from './IsoFactory';

const genkoMood = (m?: StoryMood): Mood => (m === 'smug' || m === 'worried' || m === 'wow' ? m : 'happy');

/** Survives between scenes: once a player turns auto-play off, it stays off. */
let autoPlay = true;

/** Lightning path from InGenious (left) to the Dark Meter (right). */
const BOLT = 'M47 82 L101 50 L125 72 L179 28 L211 60 L257 22 L281 50 L343 33';

/**
 * Cinematic cutscene: letterbox, a slow camera that leans towards whoever talks,
 * two actors, an optional facility centre stage, stage effects and spoken lines.
 * Lines advance on their own (auto) or on tap.
 */
export function StoryScene({ scene, onDone }: { scene: Scene; onDone: () => void }) {
  const reduced = useGame((s) => s.settings.reducedMotion);
  const voiceOn = useGame((s) => s.settings.voice);
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState(0);
  const [step, setStep] = useState(22);
  const [talking, setTalking] = useState(false);
  const [auto, setAuto] = useState(autoPlay);
  const [fxKey, setFxKey] = useState(0);
  const line = scene.lines[i];
  const full = typed >= line.text.length;
  const timer = useRef<number>();
  const spokenUntil = useRef(0);
  const fac = scene.facility ? facilityById(scene.facility) : undefined;
  const lit = scene.lines.slice(0, i + 1).some((l) => l.fx === 'light');

  useEffect(() => () => voice.stop(), []);

  useEffect(() => {
    setTyped(reduced ? line.text.length : 0);
    setStep(22);
    setTalking(false);
    spokenUntil.current = 0;
    if (line.fx) {
      setFxKey((k) => k + 1);
      if (line.fx === 'zap') (audio.play('zap'), buzz([30, 20, 60]));
      if (line.fx === 'flash') (audio.play('boom'), buzz([80, 40, 120]));
      if (line.fx === 'light') (audio.play('powerup'), buzz(40));
    } else if (line.who === 'dark') {
      audio.play(line.mood === 'angry' ? 'alarm' : 'blocked');
      if (line.mood === 'angry') buzz([40, 30, 40]);
    } else if (line.who === 'genko') audio.play('online');

    if (!voiceOn) return;
    let live = true;
    void voice.speak(scene.id, i, line.who, line.text).then((ms) => {
      if (!live || ms === null) return;
      setTalking(true);
      spokenUntil.current = Date.now() + ms;
      // Type along with the voice so the last word lands as it is spoken.
      if (!reduced) setStep(Math.min(70, Math.max(16, ms / Math.max(1, line.text.length / 2))));
    });
    return () => {
      live = false;
    };
  }, [i]);

  useEffect(() => {
    if (full) return;
    timer.current = window.setTimeout(() => {
      setTyped((t) => Math.min(line.text.length, t + 2));
      if (typed % 6 === 0 && !talking) audio.play('tick');
    }, step);
    return () => clearTimeout(timer.current);
  }, [typed, i, step]);

  const advance = () => {
    voice.stop();
    if (i < scene.lines.length - 1) setI(i + 1);
    else onDone();
  };

  // Auto-play: wait for the voice (or a reading pause), then move on.
  useEffect(() => {
    if (!full || !auto) return;
    const read = Math.max(1500, line.text.length * 42);
    const wait = Math.max(spokenUntil.current - Date.now() + 650, talking ? 650 : read);
    const t = window.setTimeout(advance, wait);
    return () => clearTimeout(t);
  }, [full, auto, i, talking]);

  const next = () => {
    if (!full) return setTyped(line.text.length);
    audio.play('tap');
    advance();
  };

  const darkOn = scene.lines.slice(0, i + 1).some((l) => l.who === 'dark');
  const genkoOn = scene.lines.slice(0, i + 1).some((l) => l.who === 'genko');
  const lastDark = [...scene.lines.slice(0, i + 1)].reverse().find((l) => l.who === 'dark');
  const lastGenko = [...scene.lines.slice(0, i + 1)].reverse().find((l) => l.who === 'genko');
  const cam = line.who === 'genko' ? 'cam-left' : line.who === 'dark' ? 'cam-right' : 'cam-mid';
  const hurt = line.fx === 'flash';

  return (
    <div class={`story tone-${scene.tone}${line.who === 'dark' && line.mood === 'angry' && !reduced ? ' quake' : ''}`} role="dialog" aria-label={scene.title} onClick={next}>
      <div class={`story-cam ${reduced ? '' : cam}`}>
        <div class="story-sky" aria-hidden="true">
          <div class="story-city" />
          {scene.tone !== 'dawn' && scene.tone !== 'lit' && <div class="story-rain" />}
          {scene.tone === 'dawn' && <div class="story-sun" />}
          {scene.tone === 'lit' && <div class="story-stars" />}
        </div>

        {fac && (
          <div class={`story-fac${lit ? ' on' : ''}`} aria-hidden="true">
            <div class="story-fac-beam" />
            <IsoFactory art={fac.art} lit={lit} />
            <span class="story-fac-name">{fac.name}</span>
          </div>
        )}

        <div class="story-stage">
          <div class={`actor genko-actor${genkoOn ? ' in' : ''}${line.who === 'genko' ? ' speaking' : ''}`}>
            <Genko size={120} mood={genkoMood(lastGenko?.mood)} />
            <span class="actor-name">InGenious</span>
          </div>
          <div
            class={`actor dark-actor${darkOn ? ' in' : ''}${line.who === 'dark' ? ' speaking' : ''}${hurt ? ' hit' : ''}${lastDark?.mood === 'fleeing' && line.who === 'dark' ? ' flee' : ''}`}
          >
            <DarkMeter size={128} mood={lastDark?.mood ?? 'smirk'} />
            <span class="actor-name">Temni števec</span>
          </div>
        </div>
      </div>

      {line.fx === 'zap' && !reduced && (
        <svg class="story-zap" key={`z${fxKey}`} viewBox="0 0 390 110" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <path class="bolt-glow" d={BOLT} />
          <path d={BOLT} />
          <path class="bolt-core" d={BOLT} />
        </svg>
      )}
      {line.fx && !reduced && <div class={`story-flash fx-${line.fx}`} key={`f${fxKey}`} aria-hidden="true" />}

      <div class="story-bar top">
        <span class="story-title">{scene.title}</span>
        <button
          class={`story-auto${auto ? ' on' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            audio.play('tap');
            autoPlay = !auto;
            setAuto(!auto);
          }}
          aria-pressed={auto}
        >
          Auto ▸
        </button>
        <button
          class="story-skip"
          onClick={(e) => {
            e.stopPropagation();
            audio.play('tap');
            voice.stop();
            onDone();
          }}
        >
          Preskoči
        </button>
      </div>

      <div class="story-bar bottom">
        {line.who === 'narrator' ? (
          <p class="story-caption" key={i}>
            {line.text.slice(0, typed)}
            {!full && <i class="caret" />}
          </p>
        ) : (
          <div class={`story-bubble ${line.who}`} key={i}>
            <b>
              {line.who === 'genko' ? 'InGenious' : 'Temni števec'}
              {talking && <span class="voice-wave" aria-hidden="true"><i /><i /><i /><i /></span>}
            </b>
            <p>
              {line.text.slice(0, typed)}
              {!full && <i class="caret" />}
            </p>
          </div>
        )}
        <div class="story-foot">
          <span class="story-dots">
            {scene.lines.map((_, k) => (
              <i class={k < i ? 'on' : k === i ? `on now${auto && full ? ' run' : ''}` : ''} />
            ))}
          </span>
          <span class="story-hint">{full ? (i < scene.lines.length - 1 ? 'Tapni za naprej ▸' : 'Tapni za nadaljevanje ▸') : ' '}</span>
        </div>
      </div>
    </div>
  );
}
