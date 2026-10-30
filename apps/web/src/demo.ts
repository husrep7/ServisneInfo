// Demo podaci za lokalni razvoj bez backenda: VITE_DEMO=1 npm run dev
// U produkcijskom buildu (bez VITE_DEMO) ovaj fajl se ne koristi.
import type { Incident } from './types';
import type { ScraperStatus } from './api';

const H = 3600e3;

function area(lat: number, lng: number): Incident['area_geojson'] {
  const d = 0.004;
  return { type: 'Polygon', coordinates: [[[lng - d, lat - d], [lng + d, lat - d], [lng + d, lat + d], [lng - d, lat + d], [lng - d, lat - d]]] };
}

function make(id: string, type: Incident['type'], title: string, status: Incident['status'],
  startH: number, endH: number, municipality: string, addresses: string[], lat: number, lng: number): Incident {
  const now = Date.now();
  return {
    id, type, title, status, municipality,
    description: 'Zbog radova na mreži doći će do prekida u navedenim ulicama. Molimo građane za razumijevanje.',
    source_url: 'https://example.com',
    affected_addresses: addresses,
    starts_at: new Date(now + startH * H).toISOString(),
    ends_at: new Date(now + endH * H).toISOString(),
    created_at: new Date(now - (10 - Number(id)) * H).toISOString(),
    area_geojson: area(lat, lng),
    distance_meters: null,
  };
}

export const DEMO_INCIDENTS: Incident[] = [
  make('1', 'water',       'Prekid vodosnabdijevanja zbog kvara na cjevovodu', 'active',    -2, 3,  'Novo Sarajevo', ['Zagrebačka', 'Grbavička 12–30'], 43.851, 18.393),
  make('2', 'electricity', 'Planirani radovi na niskonaponskoj mreži',          'active',    -1, 4,  'Centar',        ['Titova', 'Ferhadija'],            43.859, 18.425),
  make('3', 'heating',     'Kvar na toplovodu – bez grijanja',                  'active',    -5, 6,  'Novi Grad',     ['Kolodvorska', 'Džemala Bijedića'], 43.849, 18.37),
  make('4', 'gas',         'Isključenje gasa zbog održavanja',                  'scheduled', 20, 26, 'Stari Grad',    ['Bistrik', 'Logavina'],            43.86,  18.434),
  make('5', 'internet',    'Smetnje na optičkoj mreži',                         'scheduled', 30, 34, 'Ilidža',        ['Butmirska cesta'],                43.83,  18.31),
  make('6', 'electricity', 'Zamjena trafostanice',                              'scheduled', 44, 50, 'Vogošća',       ['Jošanička', 'Igmanska'],          43.902, 18.344),
];

export const DEMO_SCRAPERS: ScraperStatus[] = [
  { source: 'KJKP Vodovod',              incidents_found: 4, incidents_new: 1, error: null, ran_at: new Date(Date.now() - 6 * 60e3).toISOString() },
  { source: 'Elektrodistribucija EPBiH', incidents_found: 7, incidents_new: 0, error: null, ran_at: new Date(Date.now() - 6 * 60e3).toISOString() },
  { source: 'Sarajevogas',               incidents_found: 1, incidents_new: 0, error: null, ran_at: new Date(Date.now() - 6 * 60e3).toISOString() },
  { source: 'Toplane Sarajevo',          incidents_found: 2, incidents_new: 1, error: null, ran_at: new Date(Date.now() - 6 * 60e3).toISOString() },
  { source: 'BH Telecom',                incidents_found: 0, incidents_new: 0, error: 'timeout', ran_at: new Date(Date.now() - 40 * 60e3).toISOString() },
];
