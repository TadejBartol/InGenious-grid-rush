import { render } from 'preact';
import './styles.css';
import { App } from './ui/App';
import { store, saveOf } from './state/store';
import { loadSave, logEvent, requestPersistence, writeSave } from './state/persist';
import { audio, setHaptics } from './audio/sfx';
import { voice } from './audio/voice';
import { FACILITIES, LEVELS } from './core/levels';
import { isFacilityLit } from './core/balance';
import { initPwa } from './pwa';
import { expose } from './testHooks';
import { nav } from './ui/nav';

async function boot() {
  initPwa();
  store.getState().init(await loadSave(), Date.now());
  void requestPersistence();
  void logEvent({ t: Date.now(), name: 'session_start', data: { sessions: store.getState().stats.sessions } });

  // Persist on change (debounced) and when the page is hidden.
  let timer: number | undefined;
  const flush = () => {
    window.clearTimeout(timer);
    void writeSave(saveOf(store.getState()));
  };
  store.subscribe(() => {
    window.clearTimeout(timer);
    timer = window.setTimeout(flush, 600);
  });

  const applySettings = () => {
    const s = store.getState();
    audio.setSfx(s.settings.sound);
    audio.setMusic(s.settings.music);
    setHaptics(s.settings.haptics);
    document.documentElement.classList.toggle('reduced-motion', s.settings.reducedMotion);
    audio.setHarmony(FACILITIES.filter((f) => isFacilityLit(f, s.levels)).length);
  };
  applySettings();
  store.subscribe(applySettings);

  // Idle trickle while the game is open.
  window.setInterval(() => store.getState().tick(Date.now()), 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      store.getState().tick(Date.now());
      flush();
      audio.suspend();
      void logEvent({ t: Date.now(), name: 'session_end' });
    } else {
      store.getState().tick(Date.now());
      audio.resume();
    }
  });
  window.addEventListener('pagehide', flush);
  // First gesture anywhere unlocks WebAudio (iOS requirement).
  window.addEventListener(
    'pointerdown',
    () => {
      audio.unlock();
      voice.prime();
    },
    { once: true, capture: true },
  );

  expose('store', store);
  expose('nav', nav);
  expose('levels', LEVELS);
  render(<App />, document.getElementById('app')!);
}

void boot();
