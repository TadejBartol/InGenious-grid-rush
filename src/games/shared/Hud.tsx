import type { ComponentChildren } from 'preact';
import { useContext } from 'preact/hooks';
import type { GameResult } from '../../core/types';
import { fmtSeconds } from '../../core/format';
import { IconInfo, IconPause } from '../../ui/components/Icons';
import { HelpContext } from '../../ui/components/GameHelp';

export function Hud({ title, subtitle, time, onPause, children }: { title: string; subtitle: string; time: number | null; onPause: () => void; children?: ComponentChildren }) {
  const openHelp = useContext(HelpContext);
  return (
    <div class="hud">
      <button class="icon-btn" onClick={onPause} aria-label="Premor">
        <IconPause />
      </button>
      <div class="hud-title">
        <b>{title}</b>
        <span>{subtitle}</span>
      </div>
      {children}
      {openHelp && (
        <button class="icon-btn" onClick={openHelp} aria-label="Navodila">
          <IconInfo />
        </button>
      )}
      {time !== null && (
        <div class={`timer${time <= 10 ? ' low' : ''}`} role="timer" aria-label={`Preostali čas ${Math.ceil(time)} sekund`}>
          {fmtSeconds(time)}
        </div>
      )}
    </div>
  );
}

export interface GameProps<P> {
  params: P;
  title: string;
  subtitle: string;
  paused: boolean;
  /** Tutorial bubble, shown until the player acts. */
  tip?: string | null;
  onTipDone?: () => void;
  onPause: () => void;
  onDone: (result: GameResult) => void;
  research: Record<string, number>;
  reducedMotion: boolean;
}

/** Emoji bar chart for shared results. */
export function sparkline(values: number[], bars = 8) {
  const blocks = '▁▂▃▄▅▆▇█';
  if (!values.length) return '';
  const chunk = Math.max(1, Math.floor(values.length / bars));
  const avgs: number[] = [];
  for (let i = 0; i < bars; i++) {
    const s = values.slice(i * chunk, (i + 1) * chunk);
    if (s.length) avgs.push(s.reduce((a, b) => a + b, 0) / s.length);
  }
  const min = Math.min(...avgs);
  const max = Math.max(...avgs);
  return avgs.map((v) => blocks[Math.round(((v - min) / (max - min || 1)) * 7)]).join('');
}
