import * as cheerio from 'cheerio';
import { fetchHtml, parseBosnianDate, runScraper, ParsedItem } from './base';
import type { ScraperResult } from './index';

// KJKP Toplane Sarajevo — tabela: Kotlovnica | Adresa | Nadležnost | Nosilac radova |
//   Početak radova | Planirani rok završetka | Broj stanova | Razlog negrijanja
const BASE = 'https://www.toplanesarajevo.ba';
const URL  = process.env.TOPLANE_URL ?? `${BASE}/korisnici/obavijest-o-radovima`;

async function scrape(): Promise<ParsedItem[]> {
  return parseToplane(await fetchHtml(URL));
}

export function parseToplane($: cheerio.CheerioAPI): ParsedItem[] {
  const items: ParsedItem[] = [];

  // Page heading contains the date: "Pregled objekata koji se ne griju na dan 13.9.2026."
  const pageTitle = $('h1,h2,h3,.page-title,title').first().text().trim();
  const pageDate  = parseBosnianDate(pageTitle);

  // Parse each table row — skip header row (th)
  $('table tr').each((_, row) => {
    const cells = $(row).find('td');
    if (cells.length < 6) return; // skip header

    const kotlovnica  = $(cells[0]).text().trim();
    const adresa      = $(cells[1]).text().trim();
    const nadleznost  = $(cells[2]).text().trim();
    const pocetakStr  = $(cells[4]).text().trim();
    const krajStr     = $(cells[5]).text().trim();
    const razlog      = $(cells[7])?.text().trim() ?? '';

    if (!kotlovnica && !adresa) return;

    const title = `Obustava grijanja — ${kotlovnica || adresa}`;
    const description = [
      adresa      ? `Adresa: ${adresa}`       : '',
      nadleznost  ? `Nadležnost: ${nadleznost}` : '',
      razlog      ? `Razlog: ${razlog}`         : '',
    ].filter(Boolean).join('. ');

    items.push({
      title,
      description,
      sourceUrl: URL,
      startsAt: parseBosnianDate(pocetakStr) ?? pageDate,
      endsAt:   parseBosnianDate(krajStr),
    });
  });

  return items;
}

export async function runToplaneScraper(): Promise<ScraperResult> {
  return runScraper('Toplane Sarajevo', scrape, 'heating');
}
