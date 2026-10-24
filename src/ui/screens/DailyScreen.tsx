import { addDays, dailyLevel, dailyNumber, dateKey, liveStreak, weekKey } from '../../core/daily';
import { audio } from '../../audio/sfx';
import { useGame } from '../../state/store';
import { nav, useNav } from '../nav';
import { GenkoSays } from '../components/Genko';
import { Stars } from '../components/Common';
import { IconFlame, IconLock } from '../components/Icons';
import { LevelIntro } from './RegionScreen';
import { KIND_NAME } from './PlayScreen';

export const DAILY_UNLOCK_LEVEL = 'r1-10';

export function DailyScreen() {
  const levels = useGame((s) => s.levels);
  const daily = useGame((s) => s.daily);
  const streak = useGame((s) => s.streak);
  const { intro } = useNav();
  const today = dateKey(new Date());
  const isOpen = (levels[DAILY_UNLOCK_LEVEL]?.stars ?? 0) > 0;

  if (!isOpen) {
    const done = Object.keys(levels).filter((k) => k.startsWith('r1-') && levels[k].stars > 0).length;
    return (
      <div class="card daily-hero" style={{ marginTop: '10px' }}>
        <IconLock width={36} height={36} style={{ color: 'var(--muted)' }} />
        <h2>Dnevni izziv</h2>
        <p class="small muted">En ročno sestavljen problem na dan, enak za vse igralce. Odkleneš ga, ko premagaš bossa Industrijske cone.</p>
        <p class="mono" style={{ marginTop: '12px', color: 'var(--brand)' }}>
          Regija 1: {done}/10 stopenj
        </p>
      </div>
    );
  }

  // Detektiv joins the daily rotation once the player has learned it in region 2.
  const level = dailyLevel(today, (levels['r2-1']?.stars ?? 0) > 0);
  const mine = daily[today];
  const live = liveStreak(streak, today);
  const freezeLeft = streak.freezeWeek !== weekKey(today);
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));

  return (
    <>
      <div class="card daily-hero" style={{ marginTop: '10px' }}>
        <div class="tiny muted" style={{ letterSpacing: '0.14em', textTransform: 'uppercase' }}>
          Dnevni izziv #{dailyNumber(today)}
        </div>
        <h2>{KIND_NAME[level.stages[0].kind]}</h2>
        {mine ? <Stars n={mine.stars} /> : <p class="small muted">Danes še nisi igral. Enak problem igrajo vsi.</p>}
        <button
          class="btn primary big"
          style={{ marginTop: '14px' }}
          onClick={() => {
            audio.play('tap');
            nav.getState().openIntro(level);
          }}
        >
          {mine ? 'Izboljšaj rezultat' : 'Igraj današnji izziv'}
        </button>
        {mine && <div class="share-box" style={{ marginTop: '12px' }}>{mine.emoji}</div>}
      </div>

      <div class="card" style={{ marginTop: '12px' }}>
        <div class="row">
          <IconFlame width={28} height={28} style={{ color: 'var(--orange)' }} />
          <div class="grow">
            <b>Niz: {live} {live === 1 ? 'dan' : live === 2 ? 'dneva' : live > 2 && live < 5 ? 'dnevi' : 'dni'}</b>
            <div class="small muted">Najdaljši: {streak.best} · zamrzovalnik ta teden: {freezeLeft ? 'na voljo 🧊' : 'porabljen'}</div>
          </div>
        </div>
        <div class="week" aria-label="Zadnjih 7 dni">
          {days.map((d) => (
            <div class={`${daily[d] && daily[d].stars > 0 ? 'done' : ''}${d === today ? ' today' : ''}`}>{['N', 'P', 'T', 'S', 'Č', 'P', 'S'][new Date(d + 'T12:00').getDay()]}</div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: '12px' }}>
        <GenkoSays text="Vsak dan v nizu prinese Genko čip, vsak sedmi pa še dva zraven. En zamujen dan na teden ti oprostim." mood="smug" />
      </div>
      {intro && <LevelIntro level={intro} best={mine?.stars ?? 0} />}
    </>
  );
}
