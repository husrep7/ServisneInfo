import axios from 'axios';
import { db } from '../db';
import { config } from '../config';

// Pravila za alarm (#19)
export const HEALTH_RULES = {
  failingAfterErrors: 3,   // toliko uzastopnih grešaka = izvor ne radi
  emptyAfterRuns:     4,   // toliko uzastopnih uspješnih scrapea sa 0 rezultata (~1 h pri intervalu od 15 min)
  normallyHasData:    0.5, // ... a izvor je u zadnjih 7 dana imao rezultate u bar polovini uspješnih scrapea
  windowDays:         7,
};

export type Health = 'ok' | 'failing' | 'empty';

export interface SourceHealth {
  source: string;
  health: Health;
  detail: string | null;
}

interface Run { source: string; incidents_found: number; error: string | null }

// Runs su sortirani od najnovijeg
export function evaluate(source: string, runs: Run[]): SourceHealth {
  let errors = 0;
  while (errors < runs.length && runs[errors].error) errors++;
  if (errors >= HEALTH_RULES.failingAfterErrors) {
    return { source, health: 'failing', detail: `${errors} uzastopnih grešaka: ${runs[0].error}` };
  }

  const ok = runs.filter((r) => !r.error);
  let empty = 0;
  while (empty < ok.length && ok[empty].incidents_found === 0) empty++;
  const withData = ok.filter((r) => r.incidents_found > 0).length;
  // Prazni scrapeovi se ne računaju u "obično ima podataka", inače bi se sami poništili
  const baseline = ok.length - empty;
  if (empty >= HEALTH_RULES.emptyAfterRuns && baseline > 0
      && withData / baseline >= HEALTH_RULES.normallyHasData) {
    return { source, health: 'empty', detail: `${empty} uzastopnih scrapea bez rezultata, a izvor obično ima obavijesti` };
  }
  return { source, health: 'ok', detail: null };
}

export async function computeHealth(now: Date = new Date()): Promise<SourceHealth[]> {
  const { rows } = await db.query<Run>(
    `SELECT source, incidents_found, error FROM scraper_runs
      WHERE ran_at > $1::timestamptz - make_interval(days => $2)
      ORDER BY source, ran_at DESC`,
    [now, HEALTH_RULES.windowDays]
  );
  const bySource = new Map<string, Run[]>();
  for (const r of rows) {
    if (!bySource.has(r.source)) bySource.set(r.source, []);
    bySource.get(r.source)!.push(r);
  }
  return [...bySource].map(([source, runs]) => evaluate(source, runs));
}

// Kanal za alarm: Slack-kompatibilan webhook ({ text }); testovi ga zamjenjuju
export const alertTransport = {
  send: async (text: string): Promise<void> => {
    if (!config.alertWebhookUrl) {
      console.warn(`[Scraper alert] ALERT_WEBHOOK_URL nije postavljen: ${text}`);
      return;
    }
    await axios.post(config.alertWebhookUrl, { text }, { timeout: 5000 });
  },
};

// Šalje alarm samo kad se zdravlje izvora promijeni (kvar ili oporavak)
export async function checkScraperHealth(now: Date = new Date()): Promise<SourceHealth[]> {
  const current = await computeHealth(now);
  const { rows } = await db.query<{ source: string; health: Health }>('SELECT source, health FROM scraper_alerts');
  const previous = new Map(rows.map((r) => [r.source, r.health]));
  const changed: SourceHealth[] = [];

  for (const h of current) {
    const before = previous.get(h.source) ?? 'ok';
    if (before === h.health) continue;
    await db.query(
      `INSERT INTO scraper_alerts (source, health, detail, changed_at) VALUES ($1, $2, $3, $4)
       ON CONFLICT (source) DO UPDATE SET health = EXCLUDED.health, detail = EXCLUDED.detail, changed_at = EXCLUDED.changed_at`,
      [h.source, h.health, h.detail, now]
    );
    changed.push(h);
  }

  for (const h of changed) {
    const text = h.health === 'ok'
      ? `✅ ServisneInfo: izvor "${h.source}" ponovo radi.`
      : `🚨 ServisneInfo: izvor "${h.source}" ${h.health === 'failing' ? 'ne radi' : 'ne vraća obavijesti'} — ${h.detail}`;
    await alertTransport.send(text).catch((err) => console.error(`[Scraper alert] slanje nije uspjelo: ${err}`));
  }
  return current;
}
