import { useEffect, useState } from 'preact/hooks';
import { audio } from '../../audio/sfx';
import { installPrompt, isIos, isMobile, isStandalone, promptInstall } from '../../pwa';
import { Sheet } from './Common';

/**
 * "Install the game" for phones. Android Chrome gets the system install dialog in one
 * tap; Safari on iPhone has no such dialog, so it shows the two steps instead, as does
 * any other browser that did not offer a prompt.
 */
export function InstallButton({ big = false, always = false }: { big?: boolean; always?: boolean }) {
  const [canPrompt, setCanPrompt] = useState(installPrompt.available);
  const [installed, setInstalled] = useState(isStandalone());
  const [help, setHelp] = useState(false);
  useEffect(() => installPrompt.subscribe(setCanPrompt), []);
  useEffect(() => {
    const done = () => setInstalled(true);
    window.addEventListener('appinstalled', done);
    return () => window.removeEventListener('appinstalled', done);
  }, []);

  if (installed || !(canPrompt || always || isMobile())) return null;

  const tap = async (e: Event) => {
    e.stopPropagation();
    audio.unlock();
    audio.play('tap');
    if (canPrompt) await promptInstall();
    else setHelp(true);
  };

  const ios = isIos();
  return (
    <>
      <button class={`btn install-btn${big ? ' big' : ''}`} onClick={tap}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M12 3v11m0 0-4-4m4 4 4-4M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        Namesti igro
      </button>
      {help && (
        <Sheet center label="Namesti igro" onClose={() => setHelp(false)}>
          <h2 style={{ textAlign: 'center', marginBottom: '6px' }}>Namesti igro</h2>
          <p class="muted small" style={{ textAlign: 'center', marginBottom: '14px' }}>
            Igra dobi svojo ikono, teče čez cel zaslon in deluje brez povezave.
          </p>
          <ol class="install-steps">
            {ios ? (
              <>
                <li>
                  V Safariju tapni <b>Deli</b>
                  <svg viewBox="0 0 24 24" width="20" height="20" aria-label="ikona Deli">
                    <path d="M12 15V3m0 0-4 4m4-4 4 4M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                  spodaj na zaslonu.
                </li>
                <li>
                  Podrsaj navzdol in izberi <b>Dodaj na začetni zaslon</b>.
                </li>
                <li>
                  Potrdi z <b>Dodaj</b>. Ikona Grid Rush je na začetnem zaslonu.
                </li>
              </>
            ) : (
              <>
                <li>
                  Odpri meni brskalnika <b>⋮</b> zgoraj desno.
                </li>
                <li>
                  Izberi <b>Namesti aplikacijo</b> ali <b>Dodaj na začetni zaslon</b>.
                </li>
                <li>Potrdi in igro odpri z ikone na domačem zaslonu.</li>
              </>
            )}
          </ol>
          <button class="btn primary big" style={{ marginTop: '16px', width: '100%' }} onClick={() => setHelp(false)}>
            Razumem
          </button>
        </Sheet>
      )}
    </>
  );
}
