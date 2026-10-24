import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { fmt, fmtExact } from '../../core/format';
import { idleRate } from '../../core/balance';
import { liveStreak, dateKey } from '../../core/daily';
import { useGame } from '../../state/store';
import { useNav } from '../nav';
import { audio } from '../../audio/sfx';
import { IconBolt, IconChip, IconData, IconFlame, IconGear, IconStar } from './Icons';
import { CurrencyInfo, type Currency } from './CurrencyInfo';

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

/** Size of the trickle step the progress bar fills towards: a step lands every 10 to 30 seconds. */
function trickleUnit(rate: number) {
  return Math.max(1, Math.pow(10, Math.round(Math.log10(Math.max(1, rate / 240)))));
}

/**
 * Mechanical-style savings counter that ticks like an old electricity meter. Level rewards
 * wait until the player is back from the result screen, then roll in with a "+N kWh" chip;
 * the thin bar underneath fills with the idle trickle so the passive income is always visible.
 */
export function SavingsCounter() {
  const kwh = useGame((s) => Math.floor(s.kwh));
  const raw = useGame((s) => s.kwh);
  const rate = useGame((s) => idleRate(s.levels, s.upgrades, s.research));
  const away = ['play', 'result'].includes(useNav().screen.name);
  const [shown, setShown] = useState(kwh);
  const [gain, setGain] = useState<{ n: number; id: number } | null>(null);
  const shownRef = useRef(kwh);
  useEffect(() => {
    if (away) return;
    const from = shownRef.current;
    const diff = kwh - from;
    if (diff <= 0 || diff < 20) {
      // Small increments are the idle trickle: give them the mechanical meter click.
      if (diff > 0) audio.play('tick');
      shownRef.current = kwh;
      setShown(kwh);
      return;
    }
    setGain({ n: diff, id: Date.now() });
    audio.play('coin');
    const t0 = performance.now();
    const dur = 1300;
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / dur);
      const v = Math.round(from + diff * (1 - Math.pow(1 - k, 3)));
      shownRef.current = v;
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [kwh, away]);
  useEffect(() => {
    if (!gain) return;
    const t = setTimeout(() => setGain(null), 1800);
    return () => clearTimeout(t);
  }, [gain]);
  const unit = trickleUnit(rate);
  const frac = rate > 0 ? (raw % unit) / unit : 0;
  const text = shown >= 1e7 ? fmt(shown) : fmtExact(shown);
  return (
    <div class={`counter${gain ? ' gaining' : ''}`} aria-live="off">
      <div class="counter-label">Prihranjeno</div>
      {gain && (
        <span class="counter-gain" key={gain.id}>
          +{fmt(gain.n)} kWh
        </span>
      )}
      <div class="counter-digits" aria-label={`${fmtExact(kwh)} kWh prihranjeno`}>
        {[...text].map((ch, i) => (
          // Keyed by value, so a changed digit remounts and replays the roll animation.
          <span key={`${text.length - i}-${ch}`} class={`digit roll${/\d/.test(ch) ? '' : ' sep'}`}>
            {ch}
          </span>
        ))}
        <span class="counter-unit">kWh</span>
      </div>
      {rate > 0 && (
        <div class="counter-flow" title={`Naslednjih ${fmt(unit)} kWh`}>
          <i key={Math.floor(raw / unit)} style={{ transform: `scaleX(${frac})` }} />
        </div>
      )}
      <div class="counter-rate">{rate > 0 ? `+${fmt(rate)} kWh/h · objekti varčujejo zate` : 'Osvetli prvi objekt in začel bo varčevati sam'}</div>
    </div>
  );
}

export function Wallet({ onInfo }: { onInfo: (kind: Currency) => void }) {
  const dp = useGame((s) => Math.floor(s.dp));
  const chips = useGame((s) => s.chips);
  const streak = useGame((s) => liveStreak(s.streak, dateKey(new Date())));
  const open = (kind: Currency) => () => {
    audio.play('tap');
    onInfo(kind);
  };
  return (
    <div class="wallet">
      <button class="pill dp" onClick={open('dp')} aria-label={`${fmt(dp)} podatkovnih točk, kaj je to?`}>
        <IconData />
        {fmt(dp)} DP
      </button>
      <span class="row" style={{ gap: '4px' }}>
        {streak > 0 && (
          <button class="pill streak" onClick={open('streak')} aria-label={`Niz ${streak} dni, kaj je to?`}>
            <IconFlame />
            {streak}
          </button>
        )}
        <button class="pill chips" onClick={open('chips')} aria-label={`${chips} InGenious čipov, kaj je to?`}>
          <IconChip />
          {chips}
        </button>
      </span>
    </div>
  );
}

export function TopBar({ onSettings }: { onSettings: () => void }) {
  const [info, setInfo] = useState<Currency | null>(null);
  return (
    <header class="topbar">
      <button class="counter-btn" onClick={() => (audio.play('tap'), setInfo('kwh'))} aria-label="Kaj so prihranjene kWh?">
        <SavingsCounter />
      </button>
      <Wallet onInfo={setInfo} />
      {info && <CurrencyInfo kind={info} onClose={() => setInfo(null)} />}
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
