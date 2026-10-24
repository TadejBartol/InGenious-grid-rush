import type { JSX } from 'preact';
import type { FacilityDef } from '../../core/types';

/** Low-poly isometric facility. Lit: windows glow and the chimney calms down; dark: red haze of the Dark Meter. */
export function IsoFactory({ art, lit, level = 0 }: { art: FacilityDef['art']; lit: boolean; level?: number }) {
  const win = lit ? '#ffe68a' : '#1b2348';
  const glow = lit ? '#3dff9a' : '#ff3b5c';
  const top = '#3a4a86';
  const left = '#25336a';
  const right = '#1a2550';
  const box = (x: number, y: number, w: number, d: number, h: number) => {
    // Isometric box: x,y = front-bottom corner.
    const dx = w * 0.866;
    const dy = w * 0.5;
    const ex = d * 0.866;
    const ey = d * 0.5;
    return (
      <g>
        <path d={`M${x} ${y} l${-ex} ${-ey} v${-h} l${ex} ${ey} z`} fill={left} />
        <path d={`M${x} ${y} l${dx} ${-dy} v${-h} l${-dx} ${dy} z`} fill={right} />
        <path d={`M${x} ${y - h} l${-ex} ${-ey} l${dx} ${-dy} l${ex} ${ey} z`} fill={top} />
        {Array.from({ length: Math.max(1, Math.floor(w / 14)) }, (_, i) => (
          <path d={`M${x + 6 + i * 12 * 0.866} ${y - h * 0.45 - (6 + i * 12) * 0.5} l7 -4 v6 l-7 4 z`} fill={win} opacity={lit ? 1 : 0.6} />
        ))}
      </g>
    );
  };
  const chimney = (x: number, y: number) => (
    <g>
      <rect x={x} y={y - 46} width={9} height={46} fill={left} />
      <rect x={x + 9} y={y - 46} width={5} height={46} fill={right} />
      {[0, 1, 2].map((i) => (
        <circle cx={x + 7} cy={y - 52} r={lit ? 4 : 7} fill={lit ? '#9fb3ff' : '#4a1a2a'} opacity={lit ? 0.25 : 0.7}>
          <animate attributeName="cy" from={y - 50} to={y - (lit ? 70 : 90)} dur={`${lit ? 4 : 2}s`} begin={`${i * (lit ? 1.3 : 0.6)}s`} repeatCount="indefinite" />
          <animate attributeName="opacity" from={lit ? 0.25 : 0.7} to={0} dur={`${lit ? 4 : 2}s`} begin={`${i * (lit ? 1.3 : 0.6)}s`} repeatCount="indefinite" />
          <animate attributeName="r" from={lit ? 3 : 6} to={lit ? 6 : 14} dur={`${lit ? 4 : 2}s`} begin={`${i * (lit ? 1.3 : 0.6)}s`} repeatCount="indefinite" />
        </circle>
      ))}
    </g>
  );
  const parts: Record<FacilityDef['art'], JSX.Element> = {
    livarna: (
      <g>
        {chimney(150, 92)}
        {box(110, 118, 60, 40, 34)}
        {box(70, 112, 30, 26, 22)}
      </g>
    ),
    peskanje: (
      <g>
        {box(118, 120, 56, 46, 26)}
        <path d="M150 74 l12 -7 v26 l-12 7z" fill={left} />
        <circle cx="156" cy="66" r="8" fill={right} stroke={top} />
        {box(78, 110, 24, 20, 30)}
      </g>
    ),
    kompresor: (
      <g>
        {box(112, 120, 64, 36, 22)}
        {[0, 1, 2].map((i) => (
          <ellipse cx={92 + i * 26} cy={80 - i * 6} rx="9" ry="5" fill={right} stroke={top} />
        ))}
        {chimney(158, 86)}
      </g>
    ),
    hladilnica: (
      <g>
        {box(112, 120, 64, 50, 30)}
        <path d="M98 70 l16 -9 l16 9 l-16 9z" fill="#7fe7ff" opacity={lit ? 0.6 : 0.2} />
      </g>
    ),
    pakirnica: (
      <g>
        {box(118, 120, 56, 44, 24)}
        {box(74, 108, 26, 22, 36)}
        {chimney(160, 92)}
      </g>
    ),
    trafo: (
      <g>
        {box(110, 120, 40, 40, 30)}
        <path d="M150 104 v-40 M164 96 v-40 M150 64 l14 -8" stroke={top} stroke-width="3" />
        <path d="M60 60 L150 64 M164 56 L240 30" stroke={glow} stroke-width="1" opacity="0.5" />
      </g>
    ),
  };
  return (
    <svg viewBox="40 10 200 120" role="img" aria-label={lit ? 'Osvetljen objekt' : 'Neosvetljen objekt'}>
      <ellipse cx="120" cy="118" rx="90" ry="14" fill={glow} opacity={lit ? 0.12 : 0.18} />
      {parts[art]}
      {lit &&
        Array.from({ length: Math.min(level + 2, 8) }, (_, i) => (
          <circle r="2" fill="#3dff9a">
            <animateMotion dur={`${2 + (i % 3) * 0.6}s`} begin={`${i * 0.4}s`} repeatCount="indefinite" {...{ path: `M${70 + i * 18} 124 Q 120 ${100 - i * 3} 230 120` }} />
          </circle>
        ))}
    </svg>
  );
}
