import { useEffect, useState } from 'preact/hooks';
import { store, useGame } from '../../state/store';
import { allEvents, anonId, clearSave } from '../../state/persist';
import { nav, type Screen } from '../nav';
import { Toggle } from '../components/Common';
import { IconBack } from '../components/Icons';
import { Genko } from '../components/Genko';
import { installPrompt, promptInstall } from '../../pwa';

export function SettingsScreen({ from }: { from: Screen }) {
  const settings = useGame((s) => s.settings);
  const stats = useGame((s) => s.stats);
  const [confirm, setConfirm] = useState(false);
  const [canInstall, setCanInstall] = useState(installPrompt.available);
  useEffect(() => installPrompt.subscribe(setCanInstall), []);
  const set = store.getState().setSetting;

  const exportAnalytics = async () => {
    const events = await allEvents();
    const blob = new Blob([JSON.stringify({ player: anonId(), stats, events }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `grid-rush-analitika-${anonId()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <div class="content" style={{ paddingTop: 'calc(var(--safe-top) + 12px)' }}>
      <div class="region-head">
        <button class="icon-btn" onClick={() => nav.getState().go(from)} aria-label="Nazaj">
          <IconBack />
        </button>
        <h1 class="grow">Nastavitve</h1>
      </div>
      <div class="card" style={{ paddingTop: 0, paddingBottom: 0 }}>
        <div class="toggle-row">
          Zvočni učinki <Toggle label="Zvočni učinki" checked={settings.sound} onChange={(v) => set('sound', v)} />
        </div>
        <div class="toggle-row">
          Glasba <Toggle label="Glasba" checked={settings.music} onChange={(v) => set('music', v)} />
        </div>
        <div class="toggle-row">
          Vibracije <Toggle label="Vibracije" checked={settings.haptics} onChange={(v) => set('haptics', v)} />
        </div>
        <div class="toggle-row" style={{ borderBottom: 0 }}>
          Manj animacij <Toggle label="Manj animacij" checked={settings.reducedMotion} onChange={(v) => set('reducedMotion', v)} />
        </div>
      </div>

      {canInstall && (
        <button class="btn primary big" style={{ marginTop: '14px' }} onClick={() => void promptInstall()}>
          Namesti na domači zaslon
        </button>
      )}

      <div class="section-title">Napredek</div>
      <div class="card small" style={{ display: 'grid', gap: '6px' }}>
        <div class="row">
          <span class="grow muted">Seje</span>
          <b class="mono">{stats.sessions}</b>
        </div>
        <div class="row">
          <span class="grow muted">Odigrane stopnje</span>
          <b class="mono">{stats.plays}</b>
        </div>
        <div class="row">
          <span class="grow muted">Dnevi z igranjem</span>
          <b class="mono">{stats.days.length}</b>
        </div>
        <p class="tiny muted" style={{ marginTop: '4px' }}>
          Vsi podatki ostanejo na tej napravi. Za test retencije lahko izvoziš anonimni dnevnik dogodkov.
        </p>
        <button class="btn small-btn" onClick={exportAnalytics}>
          Izvozi analitiko (JSON)
        </button>
      </div>

      <div class="section-title">Nevarno območje</div>
      <button
        class="btn big"
        style={{ borderColor: 'var(--red)', color: confirm ? '#fff' : 'var(--red)', background: confirm ? 'var(--red)' : undefined }}
        onClick={async () => {
          if (!confirm) return setConfirm(true);
          await clearSave();
          store.getState().reset(Date.now());
          setConfirm(false);
          nav.getState().go({ name: 'title' });
        }}
      >
        {confirm ? 'Res izbrišem ves napredek?' : 'Ponastavi napredek'}
      </button>

      <div class="row" style={{ marginTop: '22px', opacity: 0.8 }}>
        <Genko size={40} mood="smug" />
        <p class="tiny muted grow">
          InGenious Grid Rush v{__APP_VERSION__} · igra deluje brez povezave. Brez nakupov, brez oglasov. Vsaka mehanika je funkcija platforme InGenious.
        </p>
      </div>
    </div>
  );
}
