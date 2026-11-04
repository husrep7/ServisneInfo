import type { Place } from '../api';

// Logotipi banaka za bankomate i banke u blizini (public/logos/banks). Izvor: ikona sa sajta
// banke, a za UniCredit, NLB i ProCredit znak izrezan iz službenog logotipa sa Wikimedia Commonsa.
// Banka se prepoznaje po OSM brendu/operatoru i nazivu, koji su često nepotpuni ili pogrešno
// napisani ("Raifefisen", "Imtesa"), pa su obrasci široki.

export interface Bank {
  id:    string;
  label: string;
  logo:  string;
  match: RegExp;
}

export const BANKS: Bank[] = [
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

// Naziv iz OSM-a koji ne govori ništa ("Bankomat", "ATM", "Banka")
const GENERIC = /^(bankomat|atm|banka|bank)$/i;

export function bankOf(p: Pick<Place, 'category' | 'name' | 'brand'>): Bank | null {
  if (p.category !== 'atm' && p.category !== 'bank') return null;
  const text = `${p.brand ?? ''} ${p.name}`;
  return BANKS.find(b => b.match.test(text)) ?? null;
}

// Za prikaz: "UniCredit Bank" umjesto "Bankomat"; poslovnica zadržava svoj naziv
export function placeTitle(p: Pick<Place, 'category' | 'name' | 'brand'>): string {
  const bank = bankOf(p);
  if (!bank) return p.name;
  if (GENERIC.test(p.name.trim()) || p.name.trim().toLowerCase() === (p.brand ?? '').trim().toLowerCase()) return bank.label;
  return p.name;
}
