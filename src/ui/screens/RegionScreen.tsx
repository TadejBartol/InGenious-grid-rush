import { useEffect } from 'preact/hooks';
import { FACILITIES, levelsOfRegion, regionById } from '../../core/levels';
import { isFacilityLit, isLevelUnlocked, facilityRate, goalLabel } from '../../core/balance';
import { fmt } from '../../core/format';
import { audio } from '../../audio/sfx';
import { useGame } from '../../state/store';
import { nav, useNav } from '../nav';
import { GenkoSays } from '../components/Genko';
import { IsoFactory } from '../components/IsoFactory';
import { Sheet, Stars } from '../components/Common';
import { IconBack, IconLock, IconStar } from '../components/Icons';
import { KIND_NAME } from './PlayScreen';
import type { LevelDef } from '../../core/types';

export function RegionScreen({ region }: { region: number }) {
  const r = regionById(region);
  const levels = useGame((s) => s.levels);
  const unlocked = useGame((s) => s.regionsUnlocked);
  const upgrades = useGame((s) => s.upgrades);
  const { intro } = useNav();
  const all = levelsOfRegion(region);
  const nextId = all.find((l) => isLevelUnlocked(l, levels, unlocked) && !(levels[l.id]?.stars > 0))?.id;
  useEffect(() => {
    document.querySelector('.level-btn.next')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [region]);

  return (
    <>
      <div class="region-head">
        <button class="icon-btn" onClick={() => nav.getState().go({ name: 'tabs', tab: 'map' })} aria-label="Nazaj na zemljevid">
          <IconBack />
        </button>
        <div class="grow">
          <h1>{r.name}</h1>
          <div class="small muted">{r.theme}</div>
        </div>
      </div>
      {FACILITIES.filter((f) => f.region === region).map((f) => {
        const lit = isFacilityLit(f, levels);
        const ls = all.filter((l) => l.facilityId === f.id);
        return (
          <section class={`card facility${lit ? ' lit' : ''}`} aria-label={f.name}>
            <div class="facility-art">
              <IsoFactory art={f.art} lit={lit} level={upgrades[f.id] ?? 0} />
            </div>
            <span class={`lit-tag${lit ? '' : ' dark'}`}>{lit ? `Osvetljeno · +${fmt(facilityRate(f, upgrades[f.id] ?? 0))} kWh/h` : 'V temi'}</span>
            <b>{f.name}</b>
            <div class="small muted">{f.description}</div>
            <div class="levels">
              {ls.map((l) => (
                <LevelButton level={l} stars={levels[l.id]?.stars ?? 0} open={isLevelUnlocked(l, levels, unlocked)} next={l.id === nextId} />
              ))}
            </div>
          </section>
        );
      })}
      {intro && <LevelIntro level={intro} best={levels[intro.id]?.stars ?? 0} />}
    </>
  );
}

function LevelButton({ level, stars, open, next }: { level: LevelDef; stars: number; open: boolean; next: boolean }) {
  const kinds = level.stages.map((s) => KIND_NAME[s.kind]).join(' + ');
  return (
    <button
      class={`level-btn${next ? ' next' : ''}${level.boss ? ' boss' : ''}`}
      disabled={!open}
      onClick={() => {
        audio.play('tap');
        nav.getState().openIntro(level);
      }}
      aria-label={`Stopnja ${level.index}: ${level.name}${open ? '' : ', zaklenjena'}`}
    >
      <span class="level-num">{open ? level.index : <IconLock width={14} />}</span>
      <span class="grow">
        <b class="small">{level.name}</b>
        <div class="level-kind">{level.boss ? `BOSS · ${kinds}` : kinds}</div>
      </span>
      <Stars n={stars} />
    </button>
  );
}

export function LevelIntro({ level, best }: { level: LevelDef; best: number }) {
  const close = () => nav.getState().openIntro(null);
  const screen = nav.getState().screen;
  return (
    <Sheet label={level.name} onClose={close}>
      <div class="tiny muted" style={{ letterSpacing: '0.14em', textTransform: 'uppercase' }}>
        {level.region > 0 ? `Stopnja ${level.region}-${level.index}` : 'Dnevni izziv'} · {level.stages.map((s) => KIND_NAME[s.kind]).join(' + ')}
      </div>
      <h2 style={{ fontSize: '22px', margin: '4px 0 12px' }}>{level.name}</h2>
      <GenkoSays text={level.intro} mood={level.boss ? 'worried' : 'happy'} />
      <div class="lesson" style={{ marginTop: '12px' }}>
        {level.lesson}
      </div>
      <ul class="goal-list">
        {level.stars.map((g, i) => (
          <li>
            <IconStar class={i < best ? 'star-on' : 'star-off'} />
            {goalLabel(g)}
          </li>
        ))}
      </ul>
      <button
        class="btn primary big"
        onClick={() => {
          audio.unlock();
          audio.play('go');
          nav.getState().go({ name: 'play', level, from: screen });
        }}
      >
        {best > 0 ? 'Igraj znova' : 'Igraj'}
      </button>
    </Sheet>
  );
}
