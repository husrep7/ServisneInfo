import type { IncidentType } from './types';

// SVG putanje (24×24, stroke) — koriste ih i React ikone i Leaflet markeri (HTML string)
export const TYPE_ICON_PATHS: Record<IncidentType, string[]> = {
  water:       ['M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z'],
  electricity: ['M13 2 3 14h9l-1 8 10-12h-9l1-8z'],
  gas:         ['M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z'],
  heating:     ['M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z'],
  internet:    ['M12 20h.01', 'M2 8.82a15 15 0 0 1 20 0', 'M5 12.86a10 10 0 0 1 14 0', 'M8.5 16.43a5 5 0 0 1 7 0'],
};

export function typeIconSvg(type: IncidentType, size: number, color: string): string {
  const paths = TYPE_ICON_PATHS[type].map(d => `<path d="${d}"/>`).join('');
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}
