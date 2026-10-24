import { registerSW } from 'virtual:pwa-register';

type Listener = (v: boolean) => void;

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function signal() {
  let value = false;
  const listeners = new Set<Listener>();
  return {
    get available() {
      return value;
    },
    set(v: boolean) {
      value = v;
      listeners.forEach((l) => l(v));
    },
    subscribe(l: Listener) {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
  };
}

export const installPrompt = signal();
export const updateReady = signal();
let deferred: BeforeInstallPromptEvent | null = null;
let applyUpdate: ((reload?: boolean) => Promise<void>) | null = null;

export function initPwa() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    installPrompt.set(true);
  });
  window.addEventListener('appinstalled', () => installPrompt.set(false));
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    applyUpdate = registerSW({
      onNeedRefresh: () => updateReady.set(true),
      onRegisteredSW: (_url, reg) => {
        // Check for a new version every hour while the game stays open.
        if (reg) setInterval(() => void reg.update(), 60 * 60 * 1000);
      },
    });
  }
}

export async function promptInstall() {
  if (!deferred) return;
  await deferred.prompt();
  await deferred.userChoice;
  deferred = null;
  installPrompt.set(false);
}

export function reloadForUpdate() {
  void applyUpdate?.(true);
}
