/** The INEA InGenious wordmark (white INEA, green INGENIOUS), drawn for dark backgrounds. */
export function BrandLogo({ height = 32, class: cls = '' }: { height?: number; class?: string }) {
  return <img class={`brand-logo ${cls}`} src={`${import.meta.env.BASE_URL}brand/inea-ingenious.png`} alt="INEA InGenious" height={height} style={{ height: `${height}px` }} draggable={false} />;
}
