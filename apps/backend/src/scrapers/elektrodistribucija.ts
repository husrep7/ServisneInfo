import axios from 'axios';
import * as cheerio from 'cheerio';
import { sarajevoDate, runScraper, ParsedItem } from './base';
import type { ScraperResult } from './index';

const URL = process.env.ELEKTRO_URL ?? 'https://www.epbih.ba/stranica/servisne-informacije';

const SARAJEVO_OPCINE = [
  'centar', 'stari grad', 'novi grad', 'novo sarajevo',
  'hadžići', 'hadzici', 'ilidža', 'ilidza',
  'vogošća', 'vogosca', 'trnovo', 'ilijaš', 'ilijas',
];

function isSarajevo(opcina: string): boolean {
  return SARAJEVO_OPCINE.some(s => opcina.toLowerCase().includes(s));
}

// Parse "13.09.2026" + "08:00-14:00" into Date objects
function parseDatetime(dateStr: string, timeStr: string): { startsAt: Date | null; endsAt: Date | null } {
  const dm = dateStr.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (!dm) return { startsAt: null, endsAt: null };
  const [d, mo, y] = [+dm[1], +dm[2], +dm[3]];

  const timeParts = timeStr.match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/);
  if (!timeParts) return { startsAt: sarajevoDate(y, mo, d), endsAt: null };

  const [, sh, sm, eh, em] = timeParts;
  return {
    startsAt: sarajevoDate(y, mo, d, +sh, +sm),
    endsAt:   sarajevoDate(y, mo, d, +eh, +em),
  };
}

async function scrape(): Promise<ParsedItem[]> {
  const res = await axios.get<string>(URL, {
    headers: { 'User-Agent': 'KomunalniInfo/1.0 (info@komunalniinfo.ba)' },
    timeout: 12000,
  });
  const $ = cheerio.load(res.data);

  // Group rows by opcina+date+time into incidents
  const groups = new Map<string, { opcina: string; ulice: string[]; dateStr: string; timeStr: string }>();

  $('tr').each((_, row) => {
    const cells = $(row).find('td');
    if (cells.length < 5) return;

    const opcina  = $(cells[0]).text().trim();
    const ulica   = $(cells[1]).text().trim();
    const brojevi = $(cells[2]).text().trim();
    const date    = $(cells[3]).text().trim();
    const time    = $(cells[4]).text().trim();

    if (!isSarajevo(opcina)) return;
    if (!ulica || !date) return;

    const key = `${opcina}__${date}__${time}`;
    const addr = brojevi ? `${ulica} ${brojevi}` : ulica;

    if (!groups.has(key)) {
      groups.set(key, { opcina, ulice: [], dateStr: date, timeStr: time });
    }
    groups.get(key)!.ulice.push(addr);
  });

  const items: ParsedItem[] = [];

  for (const [, g] of groups) {
    if (g.ulice.length === 0) continue;

    const { startsAt, endsAt } = parseDatetime(g.dateStr, g.timeStr);
    const uliceSample = g.ulice.slice(0, 5).join(', ');
    const more = g.ulice.length > 5 ? ` i još ${g.ulice.length - 5} ulica` : '';

    items.push({
      title:       `Isključenje struje — ${g.opcina}, ${g.dateStr} ${g.timeStr}`,
      description: `Planirano isključenje električne energije u ${g.opcina}. Zahvaćene ulice: ${uliceSample}${more}.`,
      sourceUrl:   URL,
      startsAt,
      endsAt,
    });
  }

  return items;
}

export async function runElektroScraper(): Promise<ScraperResult> {
  return runScraper('Elektrodistribucija EPBiH', scrape, 'electricity');
}
