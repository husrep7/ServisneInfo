import type { PlaceCategory } from '../api';

// Kategorije objekata u blizini: naziv, oznaka na mapi i boja
export const PLACE_META: Record<PlaceCategory, { label: string; plural: string; emoji: string; color: string }> = {
  atm:      { label: 'Bankomat', plural: 'Bankomati', emoji: '💳', color: '#17A774' },
  fuel:     { label: 'Pumpa',    plural: 'Pumpe',     emoji: '⛽', color: '#F2401E' },
  post:     { label: 'Pošta',    plural: 'Pošte',     emoji: '✉️', color: '#F0A000' },
  pharmacy: { label: 'Apoteka',  plural: 'Apoteke',   emoji: '💊', color: '#3D7BFF' },
  bank:     { label: 'Banka',    plural: 'Banke',     emoji: '🏦', color: '#A066FF' },
};

export const PLACE_ORDER: PlaceCategory[] = ['atm', 'fuel', 'post', 'pharmacy', 'bank'];

// Google Maps navigacija do objekta (otvara aplikaciju na mobitelu)
export function directionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
