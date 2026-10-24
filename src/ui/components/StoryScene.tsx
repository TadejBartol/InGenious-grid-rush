import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { audio, buzz } from '../../audio/sfx';
import { voice } from '../../audio/voice';
import { direct } from '../../core/cinema';
import { facilityById } from '../../core/levels';
import type { Scene } from '../../core/story';
import { useGame } from '../../state/store';
import { CineWorld } from './CineWorld';

/** Survives between scenes. Off by default: the player taps to move on, and can switch it on. */
let autoPlay = false;

/**
 * Cinematic cutscene: letterbox bars around a filmed set (CineWorld) that cuts and
 * glides between shots, with spoken, typed-out lines below.
 * Lines advance on tap; auto-play is an opt-in toggle.
 */
export function StoryScene({ scene, onDone }: { scene: Scene; onDone: () => void }) {
  const reduced = useGame((s) => s.settings.reducedMotion);
  const voiceOn = useGame((s) => s.settings.voice);
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState(0);
  const [step, setStep] = useState(22);
  const [talking, setTalking] = useState(false);
  const [auto, setAuto] = useState(autoPlay);
  const line = scene.lines[i];
  const full = typed >= line.text.length;
  const timer = useRef<number>();
  const spokenUntil = useRef(0);
  const fac = scene.facility ? facilityById(scene.facility) : undefined;
  const dirs = useMemo(() => direct(scene), [scene]);

  useEffect(() => {
    void voice.preload(scene.id, scene.lines);
    return () => voice.stop();
  }, []);

  useEffect(() => {
    setTyped(reduced ? line.text.length : 0);
    setStep(22);
    setTalking(false);
    spokenUntil.current = 0;
    if (line.fx) {
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
      if (!reduced) setStep(Math.min(120, Math.max(16, ms / Math.max(1, line.text.length / 2))));
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

  return (
    <div class={`story tone-${scene.tone}`} role="dialog" aria-label={scene.title} onClick={next}>
      <CineWorld scene={scene} dirs={dirs} i={i} reduced={reduced} fac={fac} />

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
