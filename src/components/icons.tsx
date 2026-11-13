import type { ReactNode } from 'react';

// A small hand-drawn icon set on a 24px grid, so the app does not depend on an icon font.
const dot = (cx: number, cy: number, r = 1.4) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill="currentColor" stroke="none" />;

const PATHS = {
  ticket: <path d="M3 9V6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v3a3 3 0 0 0 0 6v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a3 3 0 0 0 0-6ZM14.5 5v2M14.5 11v2M14.5 17v2" />,
  list: <path d="M4 6.5h16M4 12h16M4 17.5h10" />,
  calendar: <path d="M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1ZM4 10h16M8 3v4M16 3v4" />,
  chart: <path d="M5 20V11M12 20V4M19 20v-6" />,
  sliders: (
    <>
      <path d="M4 7h9M19 7h1M4 17h1M11 17h9" />
      <circle cx="16" cy="7" r="2.6" />
      <circle cx="8" cy="17" r="2.6" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  back: <path d="M19 12H5M11 6l-6 6 6 6" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  eye: (
    <>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: <path d="M4 4l16 16M9.9 5.2A9.8 9.8 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.1 3.9M6.2 6.3A17 17 0 0 0 2 12s3.6 7 10 7a9.700 9.700 0 0 0 4-.9M9.900 9.900a3 3 0 0 0 4.200 4.200" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.300-4.300" />
    </>
  ),
  check: <path d="M5 12.5l4.500 4.500L19 7.500" />,
  copy: <path d="M9 9h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1ZM5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />,
  lock: <path d="M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1ZM8 11V7a4 4 0 0 1 8 0v4" />,
  unlock: <path d="M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1ZM8 11V7a4 4 0 0 1 7.600-1.700" />,
  key: (
    <>
      <circle cx="8" cy="15.500" r="4" />
      <path d="M11 12.500 20 3.500M16.500 7l3 3M14 9.500l2 2" />
    </>
  ),
  edit: <path d="M4 20h4L19 9l-4-4L4 16v4ZM13.500 6.500l4 4" />,
  trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />,
  pause: <path d="M8 5v14M16 5v14" />,
  play: <path d="M7 5l12 7-12 7V5Z" />,
  external: <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />,
  bell: <path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4l2-2ZM10 21a2 2 0 0 0 4 0" />,
  download: <path d="M12 4v11M7 10.500l5 5 5-5M5 20h14" />,
  upload: <path d="M12 16V5M7 9.500l5-5 5 5M5 20h14" />,
  shield: <path d="M12 3l8 3v6c0 4.500-3.200 8-8 9-4.800-1-8-4.500-8-9V6l8-3Z" />,
  refresh: <path d="M20 11a8 8 0 0 0-14.500-4.500L4 8M4 4v4h4M4 13a8 8 0 0 0 14.500 4.500L20 16M20 20v-4h-4" />,
  more: <>{[dot(5, 12), dot(12, 12), dot(19, 12)]}</>,
  chevR: <path d="M9 6l6 6-6 6" />,
  chevL: <path d="M15 6l-6 6 6 6" />,
  dice: (
    <>
      <path d="M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
      {[dot(8.5, 8.5, 1.2), dot(15.5, 15.5, 1.2), dot(12, 12, 1.2), dot(15.5, 8.5, 1.2), dot(8.5, 15.5, 1.2)]}
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.500" />
      <path d="M2.500 20c0-3.600 2.900-6 6.500-6s6.500 2.400 6.500 6M16 4.600a3.500 3.500 0 0 1 0 6.800M18 14.300c2.100.8 3.500 2.800 3.500 5.700" />
    </>
  ),
  card: <path d="M3 6h18a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1ZM2 10h20M6 15h4" />,
  alert: <path d="M12 4l9.500 16h-19L12 4ZM12 10v4.500M12 17.400v.2" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.500M12 7.500v.2" />
    </>
  ),
  file: <path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1ZM14 3v5h5" />,
  device: <path d="M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1ZM11 18h2" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.800 3 2.800 15 0 18M12 3c-2.800 3-2.800 15 0 18" />
    </>
  ),
  ban: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M5.700 5.700l12.600 12.600" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  tag: (
    <>
      <path d="M4 4h7l9 9-7 7-9-9V4Z" />
      {dot(8, 8, 1.2)}
    </>
  ),
  drop: <path d="M12 3c4 4.500 6 7.500 6 10.500a6 6 0 0 1-12 0C6 10.500 8 7.500 12 3Z" />,
  coins: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.500 15c.6.9 1.500 1.300 2.600 1.300 1.500 0 2.600-.8 2.600-2s-1-1.800-2.600-2.200-2.500-1-2.500-2.200 1-2 2.500-2c1 0 1.900.4 2.400 1.200M12 6.500v11" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 22, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {PATHS[name]}
    </svg>
  );
}
