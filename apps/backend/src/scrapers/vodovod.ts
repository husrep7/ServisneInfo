import { fetchHtml, parseBosnianDate, runScraper, ParsedItem } from './base';
import type { ScraperResult } from './index';

const BASE = 'https://www.viksa.ba';
const URL  = process.env.VODOVOD_URL ?? `${BASE}/objave/servisne_informacije`;

// ViK objavljuje radove za DANAS ili SUTRA — prihvatamo do +2 dana
function isRelevantDate(date: Date | null): boolean {
  if (!date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + 3); // danas + sutra + prekosutra
  return date >= today && date <= maxDate;
}

// ViK tekst sadrži više datuma — uzmi NAJRANIJI koji je danas ili u budućnosti
function extractRelevantDate(text: string): Date | null {
  const matches = [...text.matchAll(/(\d{1,2})\.(\d{1,2})\.(\d{4})/g)];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dates = matches
    .map(m => {
      const [, d, mo, y] = m;
      return new Date(`${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}T00:00:00`);
    })
    .filter(d => !isNaN(d.getTime()) && d >= today)
    .sort((a, b) => a.getTime() - b.getTime());

  return dates[0] ?? null;
}

async function scrape(): Promise<ParsedItem[]> {
  const $ = await fetchHtml(URL);
  const items: ParsedItem[] = [];

  $('h5').each((_, el) => {
    const title = $(el).text().trim();
    if (!title || title.length < 10) return;

    const parent = $(el).parent();
    const body   = parent.find('p').map((_, p) => $(p).text().trim()).get().join(' ').trim();
    const link   = parent.find('a').first().attr('href') ?? URL;

    if (!/redukcij|prekid|havarij|voda|isklju|radov|popravk|kanali|vodosnabdij/i.test(title + ' ' + body)) return;

    // Izvuci relevantni datum (danas ili budući) iz teksta
    const startsAt = extractRelevantDate(body) ?? extractRelevantDate(title);

    // Preskoči ako nema relevantnog datuma (stara obavijest)
    if (!startsAt) return;

    items.push({
      title,
      description: body || title,
      sourceUrl: link.startsWith('http') ? link : `${BASE}${link}`,
      startsAt,
      endsAt: null,
    });
  });

  return items;
}

export async function runVodovodScraper(): Promise<ScraperResult> {
  return runScraper('KJKP Vodovod', scrape, 'water');
}
