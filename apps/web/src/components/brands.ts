import type { Place, PlaceCategory } from '../api';

// Logotipi brendova za objekte u blizini: banke (public/logos/banks), pošte, pumpe i apoteke
// (public/logos/brands). Izvor: ikona sa sajta firme, a gdje je to širok natpis, znak izrezan iz
// službenog logotipa sa Wikimedia Commonsa. Brend se prepoznaje po OSM brendu/operatoru i
// nazivu, koji su često nepotpuni ili pogrešno napisani ("Raifefisen", "Imtesa").

export interface Brand {
  id:    string;
  label: string;
  logo:  string;
  // Provjerava se na brendu, nazivu i oba zajedno, pa obrazac sa ^ hvata početak polja
  match: RegExp;
}

const BANKS: Brand[] = [
  { id: 'unicredit',  label: 'UniCredit Bank',          logo: '/logos/banks/unicredit.svg',  match: /uni\s?credit/i },
  { id: 'raiffeisen', label: 'Raiffeisen Bank',         logo: '/logos/banks/raiffeisen.svg', match: /r[ae]i?f[a-z]*s+en|^rf\b/i },
  { id: 'intesa',     label: 'Intesa Sanpaolo Banka',   logo: '/logos/banks/intesa.png',     match: /[ij]m?n?tesa|sanpaolo/i },
  { id: 'sparkasse',  label: 'Sparkasse Bank',          logo: '/logos/banks/sparkasse.svg',  match: /sparkas/i },
  // Hypo Alpe Adria Bank BiH je 2016. postala Addiko Bank
  { id: 'addiko',     label: 'Addiko Bank',             logo: '/logos/banks/addiko.png',     match: /addiko|hypo/i },
  { id: 'bbi',        label: 'Bosna Bank International', logo: '/logos/banks/bbi.png',       match: /\bbbi\b|bosna bank/i },
  // Volksbank BH je postala Sberbank BH, a Sberbank BH je 2022. pripojena ASA Banci
  { id: 'asa',        label: 'ASA Banka',               logo: '/logos/banks/asa.png',        match: /\basa\b|sberbank|volksbank/i },
  { id: 'nlb',        label: 'NLB Banka',               logo: '/logos/banks/nlb.svg',        match: /\bnlb\b/i },
  { id: 'ziraat',     label: 'Ziraat Bank',             logo: '/logos/banks/ziraat.png',     match: /ziraat/i },
  { id: 'pbs',        label: 'Privredna banka Sarajevo', logo: '/logos/banks/pbs.png',       match: /privredna/i },
  { id: 'union',      label: 'Union banka',             logo: '/logos/banks/union.svg',      match: /union\s?bank/i },
  { id: 'nova',       label: 'Nova banka',              logo: '/logos/banks/nova.png',       match: /nova\s?banka/i },
  { id: 'procredit',  label: 'ProCredit Bank',          logo: '/logos/banks/procredit.svg',  match: /pro\s?credit/i },
];

const POST: Brand[] = [
  { id: 'bhposta',     label: 'BH Pošta',      logo: '/logos/brands/bhposta.svg',     match: /bh\s?po[sš]t|bhpost/i },
  { id: 'postesrpske', label: 'Pošte Srpske',  logo: '/logos/brands/postesrpske.png', match: /po[sš]te srpske/i },
];

const FUEL: Brand[] = [
  // Hifa prije Petrola: "Hifa Petrol" je Hifa
  { id: 'hifa',    label: 'Hifa Oil', logo: '/logos/brands/hifa.png',    match: /hifa/i },
  { id: 'gazprom', label: 'Gazprom',  logo: '/logos/brands/gazprom.svg', match: /gazprom/i },
  // Energopetrol pumpe su danas INA (energopetrol.ba koristi INA-in identitet)
  { id: 'ina',     label: 'INA',      logo: '/logos/brands/ina.svg',     match: /\bina\b|energopetrol|^ep$/i },
  // Samo slovenski Petrol, ne lokalne pumpe "Brkić Petrol", "ADA Petrol". "BP" ovdje znači
  // "benzinska pumpa", a ne britanski BP, pa ga ne vežemo za logo.
  { id: 'petrol',  label: 'Petrol',   logo: '/logos/brands/petrol.svg',  match: /^petrol(\s|$)/i },
];

const PHARMACY: Brand[] = [
  { id: 'apoteke-sarajevo', label: 'Apoteke Sarajevo', logo: '/logos/brands/apoteke-sarajevo.png', match: /apoteke sarajevo|sarajevo apoteke|\bju apoteke/i },
  { id: 'avicena',          label: 'Avicena',          logo: '/logos/brands/avicena.png',          match: /avicen/i },
  { id: 'pharmamed',        label: 'Pharmamed',        logo: '/logos/brands/pharmamed.png',        match: /pharmamed/i },
];

const BY_CATEGORY: Record<PlaceCategory, Brand[]> = {
  atm: BANKS, bank: BANKS, post: POST, fuel: FUEL, pharmacy: PHARMACY,
};

// Naziv iz OSM-a koji ne govori ništa ("Bankomat", "Pumpa", "Pošta", "Apoteka")
const GENERIC = /^(bankomat|atm|banka|bank|pumpa|benzinska pumpa|po[sš]ta|apoteka)$/i;

export function brandOf(p: Pick<Place, 'category' | 'name' | 'brand'>): Brand | null {
  const fields = [p.brand ?? '', p.name, `${p.brand ?? ''} ${p.name}`].map(f => f.trim()).filter(Boolean);
  return BY_CATEGORY[p.category].find(b => fields.some(f => b.match.test(f))) ?? null;
}

// Za prikaz: "UniCredit Bank" umjesto "Bankomat"; poslovnica zadržava svoj naziv
export function placeTitle(p: Pick<Place, 'category' | 'name' | 'brand'>): string {
  const brand = brandOf(p);
  if (!brand) return p.name;
  if (GENERIC.test(p.name.trim()) || p.name.trim().toLowerCase() === (p.brand ?? '').trim().toLowerCase()) return brand.label;
  return p.name;
}
