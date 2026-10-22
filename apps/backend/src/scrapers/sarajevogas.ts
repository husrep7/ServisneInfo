import { fetchHtml, runScraper, ParsedItem } from './base';
import type { ScraperResult } from './index';

const BASE = 'https://www.sarajevogas.ba';
const URL  = process.env.SARAJEVOGAS_URL ?? `${BASE}/novosti`;

const BS_MONTHS: Record<string, string> = {
  'januar': '01', 'februara': '02', 'february': '02', 'mart': '03', 'marta': '03',
  'april': '04', 'aprila': '04', 'maj': '05', 'maja': '05',
  'juni': '06', 'juna': '06', 'juli': '07', 'jula': '07',
  'august': '08', 'augusta': '08', 'septembar': '09', 'septembra': '09',
  'oktobar': '10', 'oktobra': '10', 'novembar': '11', 'novembra': '11',
  'decembar': '12', 'decembra': '12',
};

// Parsiraj "12. Septembra 2026." ili "12.09.2026" u Date
function parseBsDate(text: string): Date | null {
  // "12. Septembra 2026."
  const m1 = text.match(/(\d{1,2})\.\s+([a-zčćšžđA-ZČĆŠŽĐ]+)\s+(\d{4})/i);
  if (m1) {
    const [, d, monthName, y] = m1;
    const mo = BS_MONTHS[monthName.toLowerCase()];
    if (!mo) return null;
    const date = new Date(`${y}-${mo}-${d.padStart(2, '0')}T00:00:00`);
    return isNaN(date.getTime()) ? null : date;
  }
  // "12.09.2026"
  const m2 = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (m2) {
    const [, d, mo, y] = m2;
    const date = new Date(`${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}T00:00:00`);
    return isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function isToday(date: Date | null): boolean {
  if (!date) return false;
  const today = new Date();
  return date.getFullYear() === today.getFullYear() &&
         date.getMonth()    === today.getMonth() &&
         date.getDate()     === today.getDate();
}

async function scrape(): Promise<ParsedItem[]> {
  const $ = await fetchHtml(URL);
  const items: ParsedItem[] = [];

  // Sarajevogas WordPress: artikli su u .elementor-post ili article ili .post
  $('article, .elementor-post, .post, .novost, .entry').each((_, el) => {
    const title = $(el).find('h1,h2,h3,h4,.entry-title,.elementor-post__title').first().text().trim();
    const body  = $(el).find('p,.entry-content,.elementor-post__excerpt,.excerpt').first().text().trim();
    const link  = $(el).find('a').first().attr('href') ?? URL;
    const dateText = $(el).find('time,.entry-date,.elementor-post-date,.posted-on,.date').first().text().trim()
      || $(el).find('[datetime]').first().attr('datetime')
      || '';

    if (!title || title.length < 8) return;
    if (!/prekid|isklju|gas|plin|havarij|bez\s+gasa|radov|servisn|snabdijeva/i.test(title + ' ' + body)) return;

    const publishedAt = parseBsDate(dateText);

    // Uzimamo samo današnje vijesti
    if (!isToday(publishedAt)) return;

    items.push({
      title,
      description: body || title,
      sourceUrl: link.startsWith('http') ? link : `${BASE}${link}`,
      startsAt: publishedAt,
      endsAt: null,
    });
  });

  return items;
}

export async function runSarajevoGasScraper(): Promise<ScraperResult> {
  return runScraper('Sarajevogas', scrape, 'gas');
}
