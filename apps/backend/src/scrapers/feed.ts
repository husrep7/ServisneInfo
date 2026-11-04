import axios from 'axios';
import * as cheerio from 'cheerio';

// Web syndication — ulaz (ADR-0002): RSS 2.0 i Atom feedovi izvora. Feed je ugovor koji izvor
// sam objavljuje (naslov, link, datum, sadržaj), pa se ne lomi kad izvor promijeni dizajn
// stranice, kao što se lomi HTML scraper.

export interface FeedItem {
  title:       string;
  link:        string;
  description: string;
  publishedAt: Date | null;
  categories:  string[];
}

// HTML iz <description>/<content:encoded> u čist tekst
function textOf(html: string): string {
  return cheerio.load(`<div>${html}</div>`)('div').text().replace(/\s+/g, ' ').replace(/\s*\[(…|&#8230;|\.\.\.)\]\s*$/, '').trim();
}

function date(s: string | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s.trim());
  return isNaN(d.getTime()) ? null : d;
}

export function parseFeed(xml: string): FeedItem[] {
  const $ = cheerio.load(xml, { xmlMode: true });
  const items: FeedItem[] = [];

  // RSS 2.0
  $('rss channel > item').each((_, el) => {
    const item = $(el);
    const content = item.find('content\\:encoded').first().text() || item.find('description').first().text();
    items.push({
      title:       item.children('title').first().text().trim(),
      link:        item.children('link').first().text().trim(),
      description: textOf(content),
      publishedAt: date(item.children('pubDate').first().text() || item.find('dc\\:date').first().text()),
      categories:  item.children('category').map((_, c) => $(c).text().trim()).get(),
    });
  });

  // Atom
  $('feed > entry').each((_, el) => {
    const entry = $(el);
    const linkEl = entry.children('link[rel="alternate"]').first().length
      ? entry.children('link[rel="alternate"]').first()
      : entry.children('link').first();
    const content = entry.children('content').first().text() || entry.children('summary').first().text();
    items.push({
      title:       entry.children('title').first().text().trim(),
      link:        linkEl.attr('href') ?? '',
      description: textOf(content),
      publishedAt: date(entry.children('published').first().text() || entry.children('updated').first().text()),
      categories:  entry.children('category').map((_, c) => $(c).attr('term') ?? '').get().filter(Boolean),
    });
  });

  return items.filter((i) => i.title);
}

// HTTP poziv za feed; testovi ga zamjenjuju
export const feedHttp = {
  get: async (url: string): Promise<string> => {
    const res = await axios.get<string>(url, {
      headers: { 'User-Agent': 'ServisneInfo/1.0 (info@servisneinfo.ba)', Accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9' },
      timeout: 12000,
      responseType: 'text',
    });
    return res.data;
  },
};

export async function fetchFeed(url: string): Promise<FeedItem[]> {
  return parseFeed(await feedHttp.get(url));
}
