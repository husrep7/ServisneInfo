import { fetchHtml, parseBosnianDate, runScraper, ParsedItem } from './base';
import type { ScraperResult } from './index';

const BASE = 'https://www.bhtelecom.ba';
const URL  = process.env.BHTELEKOM_URL ?? `${BASE}/bs/pomoc/smetnje`;

async function scrape(): Promise<ParsedItem[]> {
  const $ = await fetchHtml(URL);
  const items: ParsedItem[] = [];

  $('article, .smetnja, .news-item, .obavjestenje, .post, li.item, tr').each((_, el) => {
    const title = $(el).find('h1,h2,h3,h4,.title,.naslov').first().text().trim()
      || $(el).find('td').first().text().trim();
    const body  = $(el).find('p,.content,.text,.opis').first().text().trim();
    const link  = $(el).find('a').first().attr('href') ?? URL;
    const date  = $(el).find('.date,time,.datum,td:nth-child(2)').first().text().trim();

    if (!title || title.length < 8) return;
    if (!/internet|smetnja|prekid|isklju|mreža|servis|telekomun/i.test(title + ' ' + body)) return;

    items.push({
      title,
      description: body || title,
      sourceUrl: link.startsWith('http') ? link : `${BASE}${link}`,
      startsAt: parseBosnianDate(date),
      endsAt: null,
    });
  });

  return items;
}

export async function runBhTelekomScraper(): Promise<ScraperResult> {
  return runScraper('BH Telecom', scrape, 'internet');
}
