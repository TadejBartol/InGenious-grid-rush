import type { JSX } from 'preact';

type P = JSX.SVGAttributes<SVGSVGElement>;
const base = (props: P, children: JSX.Element | JSX.Element[]) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={2} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" {...props}>
    {children}
  </svg>
);

export const IconBolt = (p: P) => base(p, <path d="M13 2 4 14h7l-1 8 9-12h-7z" fill="currentColor" stroke="none" />);
export const IconData = (p: P) =>
  base(p, [<circle cx="12" cy="12" r="9" />, <path d="M7 14l3-3 2 2 5-5" />]);
export const IconChip = (p: P) =>
  base(p, [<rect x="6" y="6" width="12" height="12" rx="2" />, <path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" />]);
export const IconFlame = (p: P) => base(p, <path d="M12 2s5 5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-4 1-6.5 1-8.5z" fill="currentColor" stroke="none" />);
export const IconMap = (p: P) => base(p, [<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z" />, <path d="M9 4v14M15 6v14" />]);
export const IconUp = (p: P) => base(p, [<path d="M12 19V5M5 12l7-7 7 7" />]);
export const IconCalendar = (p: P) => base(p, [<rect x="3" y="5" width="18" height="16" rx="2" />, <path d="M3 10h18M8 3v4M16 3v4" />]);
export const IconCards = (p: P) => base(p, [<rect x="3" y="6" width="13" height="15" rx="2" />, <path d="M8 3h11a2 2 0 0 1 2 2v13" />]);
export const IconGear = (p: P) =>
  base(p, [
    <circle cx="12" cy="12" r="3" />,
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />,
  ]);
export const IconBack = (p: P) => base(p, <path d="M15 18l-6-6 6-6" />);
export const IconPause = (p: P) => base(p, [<path d="M9 5v14M15 5v14" />]);
export const IconInfo = (p: P) => base(p, [<circle cx="12" cy="12" r="9" />, <path d="M12 11v6M12 7.5v.5" />]);
export const IconLock = (p: P) => base(p, [<rect x="5" y="11" width="14" height="10" rx="2" />, <path d="M8 11V7a4 4 0 0 1 8 0v4" />]);
export const IconStar = (p: P) => base(p, <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" fill="currentColor" stroke="none" />);
export const IconCheck = (p: P) => base(p, <path d="M5 12l5 5 9-10" />);
export const IconX = (p: P) => base(p, <path d="M6 6l12 12M18 6 6 18" />);
export const IconShare = (p: P) => base(p, [<path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />, <path d="M16 6l-4-4-4 4M12 2v13" />]);
export const IconPlay = (p: P) => base(p, <path d="M7 4v16l13-8z" fill="currentColor" stroke="none" />);
export const IconRetry = (p: P) => base(p, [<path d="M3 12a9 9 0 1 0 3-6.7L3 8" />, <path d="M3 3v5h5" />]);

const consumerIcons: Record<string, (p: P) => JSX.Element> = {
  kompresor: (p) => base(p, [<circle cx="9" cy="13" r="5" />, <path d="M14 13h6v-4M9 10v3l2 1" />]),
  pec: (p) => base(p, [<rect x="4" y="8" width="16" height="12" rx="2" />, <path d="M8 4c0 2 2 2 2 4M14 4c0 2 2 2 2 4M8 14h8" />]),
  susilnik: (p) => base(p, [<path d="M4 20h16M6 20V9l6-5 6 5v11" />, <path d="M9 14c1-1 2 1 3 0s2 1 3 0" />]),
  peskalnik: (p) => base(p, [<path d="M4 18h16M6 18l3-10h6l3 10" />, <circle cx="12" cy="5" r="1" />, <circle cx="9" cy="3" r="0.5" />, <circle cx="15" cy="3" r="0.5" />]),
  klima: (p) => base(p, [<circle cx="12" cy="12" r="2" />, <path d="M12 10c0-4 4-6 5-3M14 12c4 0 6 4 3 5M12 14c0 4-4 6-5 3M10 12c-4 0-6-4-3-5" />]),
  linija: (p) => base(p, [<path d="M3 17h18M5 17v-5h4v5M11 17V9h4v8M17 17v-3h3" />]),
  hladilnik: (p) => base(p, [<path d="M12 2v20M4 6l16 12M20 6 4 18" />]),
};

export const ConsumerIcon = ({ name, ...p }: P & { name: string }) => (consumerIcons[name] ?? consumerIcons.linija)(p);

export const IconPlug = (p: P) => base(p, [<path d="M9 2v6M15 2v6" />, <path d="M6 8h12v3a6 6 0 0 1-12 0z" />, <path d="M12 17v5" />]);
export const IconChart = (p: P) => base(p, [<path d="M3 3v18h18" />, <path d="M6 15l4-6 4 3 5-8" />]);
export const IconSearch = (p: P) => base(p, [<circle cx="11" cy="11" r="7" />, <path d="M21 21l-5-5" />]);
export const IconWave = (p: P) => base(p, [<circle cx="12" cy="18" r="2" />, <path d="M8.5 14.5a5 5 0 0 1 7 0M5.5 11.5a9 9 0 0 1 13 0M2.5 8.5a13 13 0 0 1 19 0" />]);
export const IconCogen = (p: P) => base(p, [<path d="M12 3c2 3 4 5 4 8a4 4 0 0 1-8 0c0-3 2-5 4-8z" />, <path d="M10 21h4M12 15v6" />]);
export const IconDark = (p: P) => base(p, [<circle cx="12" cy="12" r="9" />, <path d="M7 15l3-4 2 2 2-4 3 5" />]);
export const IconTrophy = (p: P) => base(p, [<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" />, <path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4" />]);
export const IconBell = (p: P) => base(p, [<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" />, <path d="M10 21h4" />]);
export const IconDatabase = (p: P) => base(p, [<ellipse cx="12" cy="5" rx="8" ry="3" />, <path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />]);
