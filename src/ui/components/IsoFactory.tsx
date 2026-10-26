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
  // Round open tank seen from the iso angle (wastewater basins, water storage).
  const tank = (cx: number, cy: number, rx: number, h: number, water: string) => (
    <g>
      <path d={`M${cx - rx} ${cy} v${-h} a${rx} ${rx * 0.5} 0 0 0 ${rx * 2} 0 v${h} a${rx} ${rx * 0.5} 0 0 1 ${-rx * 2} 0z`} fill={left} />
      <ellipse cx={cx} cy={cy - h} rx={rx} ry={rx * 0.5} fill={top} />
      <ellipse cx={cx} cy={cy - h} rx={rx - 4} ry={rx * 0.5 - 2} fill={water} opacity={lit ? 0.75 : 0.3} />
    </g>
  );
  const parts: Record<FacilityDef['art'], JSX.Element> = {
    cistilna: (
      <g>
        {tank(90, 116, 26, 12, '#5fb4ff')}
        {tank(150, 120, 30, 14, '#7ad6a0')}
        {box(186, 110, 22, 20, 24)}
        <path d="M150 106 v-14 M138 100 l24 0" stroke={top} stroke-width="3" />
      </g>
    ),
    vodarna: (
      <g>
        <path d="M112 118 l6 -50 M136 118 l-6 -50 M115 96 h18" stroke={left} stroke-width="5" />
        {tank(124, 70, 22, 22, '#5fb4ff')}
        {box(160, 120, 34, 30, 20)}
      </g>
    ),
    toplarna: (
      <g>
        {box(108, 122, 60, 44, 34)}
        {chimney(150, 80)}
        {chimney(166, 90)}
        {tank(206, 118, 14, 36, '#ff8a4f')}
      </g>
    ),
    bolnisnica: (
      <g>
        {box(118, 122, 60, 40, 44)}
        <path d="M100 52 h10 v-10 h8 v10 h10 v8 h-10 v10 h-8 v-10 h-10z" fill={lit ? '#ff6b81' : '#4a1a2a'} />
      </g>
    ),
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
    zd: (
      <g>
        {box(116, 122, 64, 42, 34)}
        {box(70, 112, 22, 18, 16)}
        <rect x="138" y="44" width="22" height="14" rx="3" fill={left} />
        <path d="M146 46 h6 v4 h4 v4 h-4 v4 h-6 v-4 h-4 v-4 h4z" fill={lit ? '#3dff9a' : '#4a1a2a'} />
      </g>
    ),
    dostava: (
      <g>
        {box(150, 118, 44, 34, 24)}
        {box(82, 124, 36, 18, 18)}
        {box(113, 106, 12, 18, 12)}
        <circle cx="92" cy="122" r="5" fill="#0b1330" stroke={top} />
        <circle cx="116" cy="110" r="5" fill="#0b1330" stroke={top} />
        <path d="M95 92 v12 M89 95 l12 6 M101 95 l-12 6" stroke={lit ? '#7fe7ff' : '#3a4785'} stroke-width="2" />
      </g>
    ),
    arhiv: (
      <g>
        {box(112, 122, 60, 40, 42)}
        <circle cx="96" cy="88" r="7" fill="none" stroke={lit ? '#7dffc4' : '#3a4785'} stroke-width="2.5" />
        <circle cx="110" cy="80" r="7" fill="none" stroke={lit ? '#7dffc4' : '#3a4785'} stroke-width="2.5" />
        <path d="M170 64 v-24 M164 46 l6 -6 l6 6" stroke={top} stroke-width="2.5" />
      </g>
    ),
    omara: (
      <g>
        {box(122, 124, 30, 24, 74)}
        <circle cx="130" cy="74" r="9" fill="#0b1330" stroke={top} stroke-width="2" />
        <circle cx="130" cy="74" r="3.5" fill={lit ? '#3dff9a' : '#ff2244'}>
          {!lit && <animate attributeName="opacity" values="1;0.3;1" dur="1.6s" repeatCount="indefinite" />}
        </circle>
        <path d="M60 122 C 90 112 100 124 118 112 M200 124 C 180 112 168 122 152 108" stroke={glow} stroke-width="2" fill="none" opacity="0.6" />
      </g>
    ),
    polnilnica: (
      <g>
        {box(150, 120, 46, 30, 16)}
        <path d="M70 92 l70 -30 l64 30 l-70 30 z" fill={top} opacity="0.9" />
        <path d="M84 100 v26 M190 98 v24 M140 70 v20" stroke={left} stroke-width="3" />
        {[0, 1, 2].map((i) => (
          <g>
            <rect x={92 + i * 24} y={104 - i * 6} width="9" height="18" rx="2" fill={left} />
            <rect x={94 + i * 24} y={107 - i * 6} width="5" height="4" rx="1" fill={lit ? '#3dff9a' : '#ff3b5c'} />
          </g>
        ))}
        <path d="M104 126 l12 -6 h14 l6 4 v6 l-14 7 h-14 z" fill={lit ? '#38e1ff' : '#3a4785'} />
        <path d="M128 80 l-6 9 h6 l-5 9" stroke={lit ? '#ffe68a' : '#3a4785'} stroke-width="2.5" fill="none" stroke-linejoin="round" />
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
