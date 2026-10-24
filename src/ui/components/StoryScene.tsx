import { useEffect, useRef, useState } from 'preact/hooks';
import { audio, buzz } from '../../audio/sfx';
import type { Scene, StoryMood } from '../../core/story';
import { useGame } from '../../state/store';
import { DarkMeter } from './DarkMeter';
import { Genko, type Mood } from './Genko';

const genkoMood = (m?: StoryMood): Mood => (m === 'smug' || m === 'worried' || m === 'wow' ? m : 'happy');

/** Comic-style cutscene: letterbox, two actors, typewriter bubbles. Tap to advance. */
export function StoryScene({ scene, onDone }: { scene: Scene; onDone: () => void }) {
  const reduced = useGame((s) => s.settings.reducedMotion);
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState(0);
  const line = scene.lines[i];
  const full = typed >= line.text.length;
  const timer = useRef<number>();

  useEffect(() => {
    setTyped(reduced ? line.text.length : 0);
    if (line.who === 'dark') {
      audio.play(line.mood === 'angry' ? 'alarm' : 'blocked');
      if (line.mood === 'angry') buzz([40, 30, 40]);
    } else if (line.who === 'genko') audio.play('online');
  }, [i]);

  useEffect(() => {
    if (full) return;
    timer.current = window.setTimeout(() => {
      setTyped((t) => Math.min(line.text.length, t + 2));
      if (typed % 6 === 0) audio.play('tick');
    }, 22);
    return () => clearTimeout(timer.current);
  }, [typed, i]);

  const next = () => {
    if (!full) return setTyped(line.text.length);
    audio.play('tap');
    if (i < scene.lines.length - 1) setI(i + 1);
    else onDone();
  };

  const darkOn = scene.lines.slice(0, i + 1).some((l) => l.who === 'dark');
  const genkoOn = scene.lines.slice(0, i + 1).some((l) => l.who === 'genko');
  const lastDark = [...scene.lines.slice(0, i + 1)].reverse().find((l) => l.who === 'dark');
  const lastGenko = [...scene.lines.slice(0, i + 1)].reverse().find((l) => l.who === 'genko');

  return (
    <div class={`story tone-${scene.tone}${line.who === 'dark' && line.mood === 'angry' && !reduced ? ' quake' : ''}`} role="dialog" aria-label={scene.title} onClick={next}>
      <div class="story-sky" aria-hidden="true">
        <div class="story-city" />
        {scene.tone !== 'dawn' && <div class="story-rain" />}
        {scene.tone === 'dawn' && <div class="story-sun" />}
      </div>
      <div class="story-bar top">
        <span class="story-title">{scene.title}</span>
        <button
          class="story-skip"
          onClick={(e) => {
            e.stopPropagation();
            audio.play('tap');
            onDone();
          }}
        >
          Preskoči
        </button>
      </div>

      <div class="story-stage">
        <div class={`actor genko-actor${genkoOn ? ' in' : ''}${line.who === 'genko' ? ' speaking' : ''}`}>
          <Genko size={120} mood={genkoMood(lastGenko?.mood)} />
          <span class="actor-name">InGenious</span>
        </div>
        <div class={`actor dark-actor${darkOn ? ' in' : ''}${line.who === 'dark' ? ' speaking' : ''}${lastDark?.mood === 'fleeing' && line.who === 'dark' ? ' flee' : ''}`}>
          <DarkMeter size={128} mood={lastDark?.mood ?? 'smirk'} />
          <span class="actor-name">Temni števec</span>
        </div>
      </div>

      <div class="story-bar bottom">
        {line.who === 'narrator' ? (
          <p class="story-caption" key={i}>
            {line.text.slice(0, typed)}
            {!full && <i class="caret" />}
          </p>
        ) : (
          <div class={`story-bubble ${line.who}`} key={i}>
            <b>{line.who === 'genko' ? 'InGenious' : 'Temni števec'}</b>
            <p>
              {line.text.slice(0, typed)}
              {!full && <i class="caret" />}
            </p>
          </div>
        )}
        <div class="story-foot">
          <span class="story-dots">
            {scene.lines.map((_, k) => (
              <i class={k <= i ? 'on' : ''} />
            ))}
          </span>
          <span class="story-hint">{full ? (i < scene.lines.length - 1 ? 'Tapni za naprej ▸' : 'Tapni za nadaljevanje ▸') : ' '}</span>
        </div>
      </div>
    </div>
  );
}
