import { useEffect, useState } from 'preact/hooks';
import { fmt, fmtDuration } from '../core/format';
import { dateKey } from '../core/daily';
import { audio } from '../audio/sfx';
import { store, useGame } from '../state/store';
import { reloadForUpdate, updateReady } from '../pwa';
import { nav, useNav, type Tab } from './nav';
import { Sheet, TopBar } from './components/Common';
import { Genko } from './components/Genko';
import { IconCalendar, IconCards, IconMap, IconUp } from './components/Icons';
import { MapScreen } from './screens/MapScreen';
import { RegionScreen } from './screens/RegionScreen';
import { PlayScreen } from './screens/PlayScreen';
import { ResultScreen } from './screens/ResultScreen';
import { UpgradesScreen } from './screens/UpgradesScreen';
import { CollectionScreen } from './screens/CollectionScreen';
import { DailyScreen, DAILY_UNLOCK_LEVEL } from './screens/DailyScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { TitleScreen } from './screens/TitleScreen';
import { StoryScene } from './components/StoryScene';
import { RegionVictory } from './screens/RegionVictory';
import { sceneById } from '../core/story';
import { FACILITIES } from '../core/levels';
import { facilityUpgradeCost, isFacilityLit, MAX_FACILITY_LEVEL, RESEARCH } from '../core/balance';
import { endScene } from './story';

const TABS: { id: Tab; name: string; icon: typeof IconMap }[] = [
  { id: 'map', name: 'Zemljevid', icon: IconMap },
  { id: 'upgrades', name: 'Nadgradnje', icon: IconUp },
  { id: 'daily', name: 'Izziv', icon: IconCalendar },
  { id: 'collection', name: 'Zbirka', icon: IconCards },
];

export function App() {
  const { screen, scene, victory } = useNav();
  const ready = useGame((s) => s.ready);
  const offline = useGame((s) => s.offlineGain);
  const dailyDue = useGame((s) => (s.levels[DAILY_UNLOCK_LEVEL]?.stars ?? 0) > 0 && !s.daily[dateKey(new Date())]);
  // Savings are only felt when they can be spent: flag the upgrades tab as soon as something is affordable.
  const canBuy = useGame(
    (s) =>
      FACILITIES.some((f) => isFacilityLit(f, s.levels) && (s.upgrades[f.id] ?? 0) < MAX_FACILITY_LEVEL && s.kwh >= facilityUpgradeCost(f, s.upgrades[f.id] ?? 0)) ||
      RESEARCH.some((r) => s.regionsUnlocked.includes(r.region ?? 1) && (s.research[r.id] ?? 0) < r.costs.length && s.dp >= r.costs[s.research[r.id] ?? 0]),
  );
  const [update, setUpdate] = useState(updateReady.available);
  // The soundtrack follows the screen: cutscenes, boss fights, levels and the menus each have their piece.
  const track = scene ? 'story' : screen.name === 'play' ? (screen.level.boss ? 'boss' : 'play') : 'menu';
  useEffect(() => audio.setTrack(track), [track]);
  useEffect(() => updateReady.subscribe(setUpdate), []);

  if (!ready) return null;
  if (screen.name === 'title') return <div class="shell"><TitleScreen /></div>;

  const base = screen.name === 'play' || screen.name === 'result' || screen.name === 'settings' ? screen.from : screen;
  const tab = base.name === 'tabs' ? base.tab : base.name === 'region' ? 'map' : 'map';
  const openSettings = () => nav.getState().go({ name: 'settings', from: screen });

  return (
    <div class="shell">
      {screen.name === 'settings' ? (
        <SettingsScreen from={screen.from} />
      ) : (
        <>
          <TopBar onSettings={openSettings} />
          <main class="content" key={base.name === 'region' ? `r${base.region}` : base.name === 'tabs' ? base.tab : base.name}>
            {base.name === 'region' && <RegionScreen region={base.region} />}
            {base.name === 'tabs' && base.tab === 'map' && <MapScreen />}
            {base.name === 'tabs' && base.tab === 'upgrades' && <UpgradesScreen />}
            {base.name === 'tabs' && base.tab === 'daily' && <DailyScreen />}
            {base.name === 'tabs' && base.tab === 'collection' && <CollectionScreen />}
          </main>
          <nav class="tabbar" aria-label="Glavni meni">
            {TABS.map((t) => (
              <button
                class="tab"
                aria-current={tab === t.id ? 'page' : undefined}
                onClick={() => {
                  audio.play('tap');
                  nav.getState().go({ name: 'tabs', tab: t.id });
                }}
              >
                <t.icon />
                {t.name}
                {t.id === 'daily' && dailyDue && <span class="badge-dot" aria-label="Nov izziv" />}
                {t.id === 'upgrades' && canBuy && <span class="badge-dot buy" aria-hidden="true" />}
              </button>
            ))}
          </nav>
        </>
      )}
      {screen.name === 'play' && <PlayScreen level={screen.level} from={screen.from} key={screen.level.id + Date.now()} />}
      {screen.name === 'result' && <ResultScreen outcome={screen.outcome} from={screen.from} />}
      {victory !== null && <RegionVictory region={victory} />}
      {scene && sceneById(scene.id) && <StoryScene scene={sceneById(scene.id)!} onDone={endScene} key={scene.id} />}
      {offline && screen.name !== 'play' && screen.name !== 'result' && (
        <Sheet center label="Prihranek v odsotnosti" onClose={() => store.getState().dismissOffline()}>
          <div style={{ textAlign: 'center', display: 'grid', gap: '10px', justifyItems: 'center' }}>
            <Genko size={84} mood="wow" />
            <p class="muted small">V tvoji odsotnosti ({fmtDuration(offline.ms)}) si prihranil</p>
            <div class="mono" style={{ fontSize: '40px', fontWeight: 800, color: 'var(--green)', textShadow: '0 0 20px rgba(61,255,154,.6)' }}>
              {fmt(offline.kwh)} kWh
            </div>
            <button
              class="btn green big"
              onClick={() => {
                audio.unlock();
                audio.play('coin');
                store.getState().dismissOffline();
              }}
            >
              Poberi
            </button>
          </div>
        </Sheet>
      )}
      {update && (
        <div class="update-banner" role="status">
          <span class="grow">Na voljo je nova različica igre.</span>
          <button class="btn small-btn primary" onClick={reloadForUpdate}>
            Posodobi
          </button>
        </div>
      )}
    </div>
  );
}
