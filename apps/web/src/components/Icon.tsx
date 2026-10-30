import type { IncidentType } from '../types';
import { TYPE_ICON_PATHS } from '../icons';

const UI_PATHS = {
  home:     ['M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z', 'M9 21v-9h6v9'],
  map:      ['M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z', 'M8 2v16', 'M16 6v16'],
  user:     ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
  plus:     ['M12 5v14', 'M5 12h14'],
  back:     ['M19 12H5', 'M12 19l-7-7 7-7'],
  chevron:  ['M9 18l6-6-6-6'],
  down:     ['M6 9l6 6 6-6'],
  pin:      ['M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z', 'M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
  clock:    ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 6v6l4 2'],
  phone:    ['M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z'],
  external: ['M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6', 'M15 3h6v6', 'M10 14 21 3'],
  check:    ['M22 11.08V12a10 10 0 1 1-5.93-9.14', 'M22 4 12 14.01l-3-3'],
  alert:    ['M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z', 'M12 9v4', 'M12 17h.01'],
  refresh:  ['M23 4v6h-6', 'M1 20v-6h6', 'M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15'],
  moon:     ['M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z'],
  sun:      ['M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z', 'M12 1v2', 'M12 21v2', 'M4.22 4.22l1.42 1.42', 'M18.36 18.36l1.42 1.42', 'M1 12h2', 'M21 12h2', 'M4.22 19.78l1.42-1.42', 'M18.36 5.64l1.42-1.42'],
  send:     ['M22 2 11 13', 'M22 2 15 22l-4-9-9-4 20-7z'],
} as const;

export type IconName = keyof typeof UI_PATHS;

interface IconProps { size?: number; strokeWidth?: number; className?: string }

function Svg({ paths, size = 20, strokeWidth = 2, className }: IconProps & { paths: readonly string[] }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {paths.map(d => <path key={d} d={d} />)}
    </svg>
  );
}

export function Icon({ name, ...rest }: IconProps & { name: IconName }) {
  return <Svg paths={UI_PATHS[name]} {...rest} />;
}

export function TypeIcon({ type, ...rest }: IconProps & { type: IncidentType }) {
  return <Svg paths={TYPE_ICON_PATHS[type]} {...rest} />;
}

export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="var(--primary)" />
      <rect x="7" y="15" width="4" height="10" rx="1.5" fill="#fff" opacity=".75" />
      <rect x="14" y="9" width="4" height="16" rx="1.5" fill="#fff" />
      <rect x="21" y="18" width="4" height="7" rx="1.5" fill="#fff" opacity=".75" />
    </svg>
  );
}
