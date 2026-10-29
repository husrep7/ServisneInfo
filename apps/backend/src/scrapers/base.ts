import { createHash } from 'crypto';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { db } from '../db';
import { parseAddressesFromText, buildPolygonFromAddresses } from '../services/geocoding';
import { notifyDevicesInArea } from '../services/notifications';
import { publishIncidentEvent } from '../routes/websocket';
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
// Sarajevo je UTC+2 (CEST ljeto) / UTC+1 (CET zima) — offset računamo za svaki datum posebno
function sarajevoOffsetMinutes(at: Date): number {
  const tz = Intl.DateTimeFormat('en', { timeZone: 'Europe/Sarajevo', timeZoneName: 'shortOffset' })
    .formatToParts(at).find(p => p.type === 'timeZoneName')?.value ?? 'GMT+1';
  const m = tz.match(/([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!m) return 0;
  const mins = parseInt(m[2]) * 60 + parseInt(m[3] ?? '0');
  return m[1] === '-' ? -mins : mins;
}

// Pretvara lokalno sarajevsko vrijeme (zidni sat) u tačan UTC trenutak
export function sarajevoDate(y: number, mo: number, d: number, h = 0, min = 0): Date | null {
  const asUtc = Date.UTC(y, mo - 1, d, h, min);
  const date = new Date(asUtc - sarajevoOffsetMinutes(new Date(asUtc)) * 60_000);
  return isNaN(date.getTime()) ? null : date;
}

// Početak današnjeg dana po sarajevskom vremenu
export function sarajevoToday(): Date {
  const [y, mo, d] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Sarajevo' })
    .format(new Date()).split('-').map(Number);
  return sarajevoDate(y, mo, d)!;
}

export function parseBosnianDate(text: string): Date | null {
  if (!text) return null;
  const m = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})(?:[.,]?\s*u?\s*(\d{1,2})[:\.](\d{2}))?/);
  if (!m) return null;
  const [, d, mo, y, h = '0', min = '0'] = m;
  return sarajevoDate(+y, +mo, +d, +h, +min);
}

function safeIso(d: Date | null): string | null {
  if (!d) return null;
  try { return d.toISOString(); } catch { return null; }
}

export async function fetchHtml(url: string): Promise<cheerio.CheerioAPI> {
  const res = await axios.get<string>(url, {
    headers: { 'User-Agent': 'ServisneInfo/1.0 (info@servisneinfo.ba)' },
    timeout: 12000,
  });
  return cheerio.load(res.data);
}

export function dedupKey(source: string, item: ParsedItem): string {
  return createHash('sha256')
    .update(`${source}|${item.title}|${safeIso(item.startsAt) ?? ''}`)
    .digest('hex');
}

export async function saveIncidents(
  items: ParsedItem[],
  type: IncidentType,
  source: string
): Promise<ScraperResult> {
  let newCount = 0;

  for (const item of items) {
    const key = dedupKey(source, item);

    // Već postoji — samo osvježi last_seen_at (i ponovo aktiviraj ako je objava i dalje na izvoru)
    const { rowCount: seen } = await db.query(
      `UPDATE incidents
          SET last_seen_at = NOW(),
              status = CASE
                WHEN status = 'resolved' AND ends_at IS NULL
                 AND (starts_at IS NULL OR starts_at <= NOW()) THEN 'active'::incident_status
                ELSE status END
        WHERE dedup_key = $1`,
      [key]
    );
    if (seen) continue;

    // Geocoding je opcionalan — preskačemo ako nema ANTHROPIC_API_KEY
    let addresses: string[] = [item.description || item.title];
    let wktMultipoint: string | null = null;
    try {
      addresses     = await parseAddressesFromText(item.description || item.title);
      wktMultipoint = await buildPolygonFromAddresses(addresses);
    } catch (err) {
      console.warn(`[${source}] geocoding failed:`, String(err));
    }

    // ON CONFLICT štiti od duplikata kad se dva pokretanja preklope
    const { rows: inserted } = await db.query<{ id: string; type: string; title: string; description: string; status: string }>(
      `INSERT INTO incidents
         (type, title, description, source_url, affected_area, affected_addresses, starts_at, ends_at, status, dedup_key)
       VALUES (
         $1, $2, $3, $4,
         CASE WHEN $5::text IS NOT NULL
           THEN ST_Buffer(ST_ConvexHull(ST_GeomFromText($5, 4326))::geography, 150)::geometry
           ELSE NULL END,
         $6, $7, $8,
         -- Inicijalni status na osnovu vremena
         CASE
           WHEN $7::timestamptz IS NOT NULL AND $7::timestamptz > NOW() THEN 'scheduled'::incident_status
           WHEN $8::timestamptz IS NOT NULL AND $8::timestamptz < NOW() THEN 'resolved'::incident_status
           ELSE 'active'::incident_status
         END,
         $9
       )
       ON CONFLICT (dedup_key) DO NOTHING
       RETURNING id, type, title, description, status`,
      [type, item.title, item.description, item.sourceUrl,
       wktMultipoint, addresses,
       safeIso(item.startsAt),
       safeIso(item.endsAt),
       key]
    );

    const incident = inserted[0];
    if (!incident) continue;
    newCount++;

    // Ne čekamo Redis — ako nije dostupan, scraping ide dalje
    publishIncidentEvent('new', incident.id).catch((err) =>
      console.warn(`[${source}] publish failed:`, String(err))
    );
    if (wktMultipoint && incident.status !== 'resolved') {
      // Greška u slanju notifikacija ne smije prekinuti obradu ostalih obavijesti
      await notifyDevicesInArea(incident).catch((err) =>
        console.error(`[${source}] notify failed:`, String(err))
      );
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
