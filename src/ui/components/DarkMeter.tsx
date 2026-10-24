import type { StoryMood } from '../../core/story';

/**
 * Temni števec: an old electromechanical meter, Š-0, with a cracked glass front,
 * a spinning disc that never stops and one red counter digit for an eye.
 */
export function DarkMeter({ size = 120, mood = 'smirk' }: { size?: number; mood?: StoryMood }) {
  const angry = mood === 'angry';
  const hurt = mood === 'hurt' || mood === 'fleeing';
  // Read at last: the red eye turns grid green and the smoke stops.
  const healed = mood === 'healed';
  const eye = healed ? '#3dff9a' : angry ? '#ff2244' : hurt ? '#ff8a9a' : '#ff3b5c';
  const glow = healed ? '#3dff9a' : '#ff3b5c';
  const brow = healed ? 'M30 46 q8 -4 16 0 M54 46 q8 -4 16 0' : angry ? 'M30 44 L46 50 M70 44 L54 50' : hurt ? 'M30 50 L46 45 M70 50 L54 45' : 'M30 47 L46 47 M56 45 L70 49';
  const mouth = healed ? 'M38 76 q12 10 24 0' : angry ? 'M38 80 L44 76 L50 80 L56 76 L62 80' : hurt ? 'M40 82 q10 -8 20 0' : 'M38 78 q14 8 24 -4';
  return (
    <svg class={`dark-meter m-${mood}`} width={size} height={size} viewBox="0 0 100 110" role="img" aria-label="Temni števec">
      <defs>
        <linearGradient id="dm-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#3a2340" />
          <stop offset="1" stop-color="#140a1c" />
        </linearGradient>
        <radialGradient id={`dm-glow-${healed ? 'g' : 'r'}`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stop-color={glow} stop-opacity="0.55" />
          <stop offset="1" stop-color={glow} stop-opacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="50" cy="56" rx="50" ry="52" fill={`url(#dm-glow-${healed ? 'g' : 'r'})`} class="dm-aura" />
      {/* smoke */}
      {!healed && [0, 1, 2].map((i) => (
        <circle cx={34 + i * 16} cy="10" r="5" fill="#4a1a2a" opacity="0.6">
          <animate attributeName="cy" values="14;-6" dur={`${1.6 + i * 0.3}s`} repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.7;0" dur={`${1.6 + i * 0.3}s`} repeatCount="indefinite" />
          <animate attributeName="r" values="4;9" dur={`${1.6 + i * 0.3}s`} repeatCount="indefinite" />
        </circle>
      ))}
      {/* body */}
      <rect x="14" y="16" width="72" height="86" rx="14" fill="url(#dm-body)" stroke="#6b2a44" stroke-width="2" />
      <rect x="20" y="24" width="60" height="70" rx="10" fill="#0a0510" stroke={glow} stroke-opacity="0.35" />
      {/* counter window with one red digit-eye */}
      <rect x="30" y="30" width="40" height="12" rx="3" fill="#1a0b12" />
      {[0, 1, 2, 3, 4].map((i) => (
        <text x={34 + i * 7.5} y="39.5" font-family="monospace" font-size="9" font-weight="700" fill={i === 4 ? eye : '#6b5560'}>
          {i === 4 ? '0' : String((i * 3 + 1) % 10)}
        </text>
      ))}
      {/* eyes */}
      <path d={brow} stroke="#ff8a9a" stroke-width="3" stroke-linecap="round" />
      <circle cx="38" cy="56" r="6" fill={eye} class="dm-eye" />
      <circle cx="62" cy="56" r="6" fill={eye} class="dm-eye" />
      <circle cx="39.5" cy="54.5" r="1.8" fill="#fff" opacity="0.8" />
      <circle cx="63.5" cy="54.5" r="1.8" fill="#fff" opacity="0.8" />
      {/* spinning disc */}
      <g transform="translate(50 92)">
        <ellipse rx="18" ry="3.5" fill="#2a1520" stroke="#6b2a44" />
        <rect x="-2" y="-3.5" width="4" height="7" fill={glow} class="dm-disc" />
      </g>
      <path d={mouth} stroke="#ff8a9a" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round" />
      {/* crack */}
      <path d="M72 26 L64 38 L69 44 L60 58" stroke="#c9d6ff" stroke-opacity="0.35" stroke-width="1.2" fill="none" />
      <text x="50" y="108" text-anchor="middle" font-family="monospace" font-size="7" fill="#8b6070">
        Š-0 · 1987
      </text>
    </svg>
  );
}
