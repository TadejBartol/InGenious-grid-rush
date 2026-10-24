import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { fmt, fmtExact } from '../../core/format';
import { idleRate } from '../../core/balance';
import { liveStreak, dateKey } from '../../core/daily';
import { useGame } from '../../state/store';
import { audio } from '../../audio/sfx';
import { IconBolt, IconChip, IconData, IconFlame, IconGear, IconStar } from './Icons';

export function Stars({ n, max = 3, big = false, label }: { n: number; max?: number; big?: boolean; label?: string }) {
  return (
    <span class={`stars${big ? ' big' : ''}`} role="img" aria-label={label ?? `${n} od ${max} zvezdic`}>
      {Array.from({ length: max }, (_, i) => (
        <IconStar class={i < n ? 'star-on' : 'star-off'} style={big ? { animationDelay: `${0.25 + i * 0.35}s` } : undefined} />
      ))}
    </span>
  );
}

/** Number that rolls up from zero, for rewards. */
export function CountUp({ value, delay = 0, ms = 900, prefix = '' }: { value: number; delay?: number; ms?: number; prefix?: string }) {
  const reduced = document.documentElement.classList.contains('reduced-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [shown, setShown] = useState(reduced ? value : 0);
  useEffect(() => {
    if (reduced) return setShown(value);
    let raf = 0;
    let t0 = 0;
    const frame = (t: number) => {
      if (!t0) t0 = t;
      const k = Math.min(1, (t - t0) / ms);
      setShown(Math.round(value * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(frame);
    };
    const timer = setTimeout(() => (raf = requestAnimationFrame(frame)), delay);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [value]);
  return (
    <span class={shown === value && value > 0 ? 'count-done' : undefined}>
      {prefix}
      {fmt(shown)}
    </span>
  );
}

/** Mechanical-style savings counter that ticks like an old electricity meter. */
export function SavingsCounter() {
  const kwh = useGame((s) => Math.floor(s.kwh));
  const rate = useGame((s) => idleRate(s.levels, s.upgrades, s.research));
  const prev = useRef(kwh);
  useEffect(() => {
    // Small increments are the idle trickle: give them the mechanical meter click.
    if (kwh > prev.current && kwh - prev.current < 50) audio.play('tick');
    prev.current = kwh;
  }, [kwh]);
  const text = kwh >= 1e7 ? fmt(kwh) : fmtExact(kwh);
  return (
    <div class="counter" aria-live="off">
      <div class="counter-label">Prihranjeno</div>
      <div class="counter-digits" aria-label={`${fmtExact(kwh)} kWh prihranjeno`}>
        {[...text].map((ch, i) => (
          // Keyed by value, so a changed digit remounts and replays the roll animation.
          <span key={`${text.length - i}-${ch}`} class={`digit roll${/\d/.test(ch) ? '' : ' sep'}`}>
            {ch}
          </span>
        ))}
        <span class="counter-unit">kWh</span>
      </div>
      <div class="counter-rate">{rate > 0 ? `+${fmt(rate)} kWh/h iz osvetljenih objektov` : 'Osvetli prvi objekt za idle prihranek'}</div>
    </div>
  );
}

export function Wallet() {
  const dp = useGame((s) => Math.floor(s.dp));
  const chips = useGame((s) => s.chips);
  const streak = useGame((s) => liveStreak(s.streak, dateKey(new Date())));
  return (
    <div class="wallet">
      <span class="pill dp" title="Podatkovne točke">
        <IconData />
        {fmt(dp)} DP
      </span>
      <span class="row" style={{ gap: '4px' }}>
        {streak > 0 && (
          <span class="pill streak" title="Niz dni">
            <IconFlame />
            {streak}
          </span>
        )}
        <span class="pill chips" title="Genko čipi">
          <IconChip />
          {chips}
        </span>
      </span>
    </div>
  );
}

export function TopBar({ onSettings }: { onSettings: () => void }) {
  return (
    <header class="topbar">
      <SavingsCounter />
      <Wallet />
      <button class="icon-btn" onClick={onSettings} aria-label="Nastavitve">
        <IconGear />
      </button>
    </header>
  );
}

export function Sheet({ children, onClose, center = false, label }: { children: ComponentChildren; onClose?: () => void; center?: boolean; label: string }) {
  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div class={`overlay${center ? ' center' : ''}`} onClick={(e) => e.target === e.currentTarget && onClose?.()} role="dialog" aria-modal="true" aria-label={label}>
      <div class="sheet">{children}</div>
    </div>
  );
}

export function Cost({ kind, n }: { kind: 'kwh' | 'dp' | 'chips'; n: number }) {
  const Icon = kind === 'kwh' ? IconBolt : kind === 'dp' ? IconData : IconChip;
  const color = kind === 'kwh' ? 'var(--green)' : kind === 'dp' ? 'var(--dp)' : 'var(--chip)';
  return (
    <span class="mono" style={{ color, display: 'inline-flex', alignItems: 'center', gap: '3px', fontWeight: 700 }}>
      <Icon width={14} height={14} />
      {fmt(n)}
      {kind === 'kwh' ? ' kWh' : kind === 'dp' ? ' DP' : ''}
    </span>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button class="toggle" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} />;
}
