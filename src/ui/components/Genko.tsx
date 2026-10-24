import { SKINS } from '../../core/balance';
import { useGame } from '../../state/store';

export type Mood = 'happy' | 'smug' | 'worried' | 'wow';

/** Round robot whose face screen shows tiny charts instead of eyes. */
export function Genko({ size = 64, mood = 'happy', skin }: { size?: number; mood?: Mood; skin?: string }) {
  const equipped = useGame((s) => s.skin);
  const sk = SKINS.find((x) => x.id === (skin ?? equipped)) ?? SKINS[0];
  const eye = (cx: number) => {
    switch (mood) {
      case 'worried':
        return <path class="genko-eye" d={`M${cx - 6} ${42} l4 -6 l4 4 l4 -8`} stroke={sk.glow} stroke-width={3} fill="none" stroke-linecap="round" stroke-linejoin="round" />;
      case 'wow':
        return <circle class="genko-eye" cx={cx} cy={38} r={5} stroke={sk.glow} stroke-width={3} fill="none" />;
      case 'smug':
        return <path class="genko-eye" d={`M${cx - 6} 38 h12`} stroke={sk.glow} stroke-width={3} stroke-linecap="round" />;
      default:
        return (
          <g class="genko-eye" fill={sk.glow}>
            <rect x={cx - 6} y={38} width={3} height={6} rx={1} />
            <rect x={cx - 1.5} y={33} width={3} height={11} rx={1} />
            <rect x={cx + 3} y={36} width={3} height={8} rx={1} />
          </g>
        );
    }
  };
  const mouth =
    mood === 'worried' ? 'M40 56 q10 -6 20 0' : mood === 'smug' ? 'M40 54 q12 6 22 -3' : mood === 'wow' ? 'M46 54 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0' : 'M40 53 q10 8 20 0';
  return (
    <svg class="genko" width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="Robotek InGenious">
      <defs>
        <radialGradient id={`gb-${sk.id}`} cx="35%" cy="30%" r="75%">
          <stop offset="0" stop-color="#ffffff" />
          <stop offset="1" stop-color={sk.body} />
        </radialGradient>
      </defs>
      <line x1="50" y1="12" x2="50" y2="4" stroke={sk.body} stroke-width="3" />
      <circle cx="50" cy="4" r="3.5" fill={sk.glow}>
        <animate attributeName="opacity" values="1;0.3;1" dur="1.6s" repeatCount="indefinite" />
      </circle>
      <circle cx="50" cy="52" r="40" fill={`url(#gb-${sk.id})`} />
      <rect x="22" y="24" width="56" height="44" rx="16" fill={sk.screen} />
      <rect x="22" y="24" width="56" height="44" rx="16" fill="none" stroke={sk.glow} stroke-opacity="0.35" stroke-width="2" />
      {eye(38)}
      {eye(62)}
      <path d={mouth} stroke={sk.glow} stroke-width={3} fill="none" stroke-linecap="round" />
      <circle cx="14" cy="56" r="5" fill={sk.body} />
      <circle cx="86" cy="56" r="5" fill={sk.body} />
    </svg>
  );
}

export function GenkoSays({ text, mood = 'happy', size = 52 }: { text: string; mood?: Mood; size?: number }) {
  return (
    <div class="genko-line">
      <Genko size={size} mood={mood} />
      <div class="bubble" key={text}>
        {text}
      </div>
    </div>
  );
}
