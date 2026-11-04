import { fetchHtml, runScraper, sarajevoDate, sarajevoToday, ParsedItem } from './base';
import { fetchFeed } from './feed';
import type { ScraperResult } from './index';

const BASE = 'https://www.sarajevogas.ba';
const URL  = process.env.SARAJEVOGAS_URL ?? `${BASE}/novosti`;
// WordPress RSS (ADR-0002) — primarni izvor; HTML stranica je rezerva kad feed ne radi
const FEED = process.env.SARAJEVOGAS_FEED_URL ?? `${BASE}/feed/`;

const RELEVANT = /prekid|isklju|gas|plin|havarij|bez\s+gasa|radov|servisn|snabdijeva/i;
// Feed nosi sve vijesti preduzeća (seminari, cijene, intervjui), a skoro svaka spominje gas —
// zato za feed tražimo riječi koje opisuju prekid ili radove na mreži
const FEED_RELEVANT = /prekid|isklju|havarij|bez\s+gasa|radov|servisn\p{L}* informacij|snabdij|kontrol\p{L}* gasovod|intervenc/iu;

const BS_MONTHS: Record<string, string> = {
  'januar': '01', 'januara': '01', 'februar': '02', 'februara': '02', 'february': '02', 'mart': '03', 'marta': '03',
  'april': '04', 'aprila': '04', 'maj': '05', 'maja': '05',
  'juni': '06', 'juna': '06', 'juli': '07', 'jula': '07',
  'august': '08', 'augusta': '08', 'septembar': '09', 'septembra': '09',
  'oktobar': '10', 'oktobra': '10', 'novembar': '11', 'novembra': '11',
  'decembar': '12', 'decembra': '12',
};

// Parsiraj "12. Septembra 2026." ili "12.09.2026" u Date
export function parseBsDate(text: string): Date | null {
  // "12. Septembra 2026."
  const m1 = text.match(/(\d{1,2})\.\s+([a-zčćšžđA-ZČĆŠŽĐ]+)\s+(\d{4})/i);
  if (m1) {
    const [, d, monthName, y] = m1;
    const mo = BS_MONTHS[monthName.toLowerCase()];
    if (!mo) return null;
    return sarajevoDate(+y, +mo, +d);
  }
  // "12.09.2026"
  const m2 = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (m2) {
    const [, d, mo, y] = m2;
    return sarajevoDate(+y, +mo, +d);
  }
  return null;
}

function isToday(date: Date | null): boolean {
  return date !== null && date.getTime() === sarajevoToday().getTime();
}

// Datum objave po sarajevskom kalendaru, bez sata — isti oblik kao iz HTML-a, pa dedup ključ
// ostaje isti bez obzira odakle je obavijest stigla
function sarajevoDay(d: Date): Date | null {
  const [y, mo, day] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Sarajevo' }).format(d).split('-').map(Number);
  return sarajevoDate(y, mo, day);
}

async function scrapeFeed(): Promise<ParsedItem[]> {
  const items = await fetchFeed(FEED);
  return items
    .filter((i) => i.publishedAt && isToday(sarajevoDay(i.publishedAt)))
    .filter((i) => FEED_RELEVANT.test(`${i.title} ${i.description}`))
    .map((i) => ({
      title: i.title,
      description: i.description || i.title,
      sourceUrl: i.link || URL,
      startsAt: sarajevoDay(i.publishedAt!),
      endsAt: null,
    }));
}

async function scrape(): Promise<ParsedItem[]> {
  try {
    return await scrapeFeed();
  } catch (err) {
    console.warn(`[Sarajevogas] feed nije dostupan, koristim HTML: ${err}`);
    return scrapeHtml();
  }
}

async function scrapeHtml(): Promise<ParsedItem[]> {
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
    if (!RELEVANT.test(title + ' ' + body)) return;

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
