const nf0 = new Intl.NumberFormat('sl-SI', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('sl-SI', { maximumFractionDigits: 1, minimumFractionDigits: 1 });

/** Compact Slovenian number formatting: 1.240, 12,5 tis., 3,2 mio. */
export function fmt(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${nf1.format(n / 1e9)} mrd.`;
  if (abs >= 1e6) return `${nf1.format(n / 1e6)} mio.`;
  if (abs >= 1e5) return `${nf0.format(n / 1e3)} tis.`;
  return nf0.format(Math.floor(n));
}

export function fmtExact(n: number): string {
  return nf0.format(Math.floor(n));
}

export function fmtDuration(ms: number): string {
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h} h ${m} min`;
  return `${Math.max(1, m)} min`;
}

export function fmtSeconds(s: number): string {
  const sec = Math.max(0, Math.ceil(s));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}
