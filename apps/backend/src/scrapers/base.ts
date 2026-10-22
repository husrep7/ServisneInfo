import axios from 'axios';
import * as cheerio from 'cheerio';
import { db } from '../db';
import { parseAddressesFromText, buildPolygonFromAddresses } from '../services/geocoding';
import { notifyDevicesInArea } from '../services/notifications';
import type { ScraperResult } from './index';

export type IncidentType = 'water' | 'electricity' | 'gas' | 'heating' | 'internet';

export interface ParsedItem {
  title:       string;
  description: string;
  sourceUrl:   string;
  startsAt:    Date | null;
  endsAt:      Date | null;
}

// Common date pattern: "13.09.2026" or "13.09.2026. u 09:00" or "13.9.2026"
// Sarajevo je UTC+2 (CEST ljeto) / UTC+1 (CET zima)
// Koristimo Europe/Sarajevo offset da bi se vremena tačno pohranila u UTC
function sarajevoOffset(): string {
  const jan = new Date(Date.UTC(2026, 0, 1));
  const jul = new Date(Date.UTC(2026, 6, 1));
  const tz  = Intl.DateTimeFormat('en', { timeZone: 'Europe/Sarajevo', timeZoneName: 'shortOffset' })
    .formatToParts(jul).find(p => p.type === 'timeZoneName')?.value ?? 'GMT+2';
  const match = tz.match(/([+-]\d+)/);
  const h = match ? String(Math.abs(parseInt(match[1]))).padStart(2, '0') : '02';
  const sign = tz.includes('-') ? '-' : '+';
  return `${sign}${h}:00`;
}

const TZ_OFFSET = sarajevoOffset(); // npr. "+02:00"

export function parseBosnianDate(text: string): Date | null {
  if (!text) return null;
  const m = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})(?:[.,]?\s*u?\s*(\d{1,2})[:\.](\d{2}))?/);
  if (!m) return null;
  const [, d, mo, y, h = '0', min = '0'] = m;
  // Eksplicitno navedemo Sarajevski offset da se ispravno konvertuje u UTC
  const date = new Date(`${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}T${h.padStart(2, '0')}:${min}:00${TZ_OFFSET}`);
  return isNaN(date.getTime()) ? null : date;
}

function safeIso(d: Date | null): string | null {
  if (!d) return null;
  try { return d.toISOString(); } catch { return null; }
}

export async function fetchHtml(url: string): Promise<cheerio.CheerioAPI> {
  const res = await axios.get<string>(url, {
    headers: { 'User-Agent': 'KomunalniInfo/1.0 (info@komunalniinfo.ba)' },
    timeout: 12000,
  });
  return cheerio.load(res.data);
}

export async function saveIncidents(
  items: ParsedItem[],
  type: IncidentType,
  source: string
): Promise<ScraperResult> {
  let newCount = 0;

  for (const item of items) {
    const { rows: existing } = await db.query(
      `SELECT id FROM incidents WHERE title=$1 AND created_at > NOW() - INTERVAL '24 hours'`,
      [item.title]
    );
    if (existing.length > 0) continue;

    // Geocoding je opcionalan — preskačemo ako nema ANTHROPIC_API_KEY
    let addresses: string[] = [item.description || item.title];
    let wktMultipoint: string | null = null;
    try {
      addresses     = await parseAddressesFromText(item.description || item.title);
      wktMultipoint = await buildPolygonFromAddresses(addresses);
    } catch {
      // Nastavljamo bez geolokacije
    }

    const { rows: inserted } = await db.query<{ id: string; type: string; title: string; description: string }>(
      `INSERT INTO incidents
         (type, title, description, source_url, affected_area, affected_addresses, starts_at, ends_at, status)
       VALUES (
         $1, $2, $3, $4,
         CASE WHEN $5::text IS NOT NULL
           THEN ST_Buffer(ST_ConvexHull(ST_GeomFromText($5, 4326)), 0.0014)
           ELSE NULL END,
         $6, $7, $8,
         -- Inicijalni status na osnovu vremena
         CASE
           WHEN $7::timestamptz IS NOT NULL AND $7::timestamptz > NOW() THEN 'scheduled'::incident_status
           WHEN $8::timestamptz IS NOT NULL AND $8::timestamptz < NOW() THEN 'resolved'::incident_status
           ELSE 'active'::incident_status
         END
       )
       RETURNING id, type, title, description`,
      [type, item.title, item.description, item.sourceUrl,
       wktMultipoint, addresses,
       safeIso(item.startsAt),
       safeIso(item.endsAt)]
    );

    newCount++;
    if (inserted[0] && wktMultipoint) {
      await notifyDevicesInArea(inserted[0]);
    }
  }

  await db.query(
    `INSERT INTO scraper_runs (source, incidents_found, incidents_new) VALUES ($1,$2,$3)`,
    [source, items.length, newCount]
  );

  console.log(`[${source}] found=${items.length}, new=${newCount}`);
  return { source, found: items.length, newCount };
}

export async function runScraper(
  source: string,
  scrape: () => Promise<ParsedItem[]>,
  type: IncidentType
): Promise<ScraperResult> {
  try {
    const items = await scrape();
    return await saveIncidents(items, type, source);
  } catch (err) {
    const error = String(err);
    await db.query(
      `INSERT INTO scraper_runs (source, incidents_found, incidents_new, error) VALUES ($1,0,0,$2)`,
      [source, error]
    ).catch(() => null);
    console.error(`[${source}] FAILED:`, error);
    return { source, found: 0, newCount: 0, error };
  }
}
