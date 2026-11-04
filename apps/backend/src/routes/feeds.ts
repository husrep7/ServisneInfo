import { FastifyInstance } from "fastify";
import { z } from "zod";
import { config } from "../config";
import { db } from "../db";
import { streetOnly } from "../services/gazetteer";

// Web syndication — izlaz (ADR-0002): isti podaci kao /incidents u standardnim formatima
// koje drugi mogu pretplatiti bez naše aplikacije:
//   /feeds/prekidi.rss   RSS 2.0 (čitači vijesti, portali, Slack/Discord, IFTTT) + GeoRSS tačka
//   /feeds/prekidi.json  JSON Feed 1.1 (programi, widgeti)
//   /feeds/prekidi.ics   iCalendar (Google/Apple/Outlook kalendar: planirani prekidi kao događaji)
// Filteri: ?type=water,electricity i ?lat&lng&radius (metara) za feed samo za moju ulicu.

const TYPES = ["water", "electricity", "gas", "heating", "internet"] as const;
const TYPE_LABEL: Record<string, string> = {
  water: "Voda", electricity: "Struja", gas: "Gas", heating: "Grijanje", internet: "Internet",
};

const FeedQuery = z.object({
  type: z.string().optional()
    .transform((v) => (v ? v.split(",").map((s) => s.trim()) : []))
    .pipe(z.array(z.enum(TYPES))),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().int().min(100).max(20_000).default(1000),
});

interface FeedRow {
  id: string;
  type: string;
  title: string;
  description: string | null;
  status: string;
  starts_at: Date | null;
  ends_at: Date | null;
  created_at: Date;
  updated_at: Date;
  affected_addresses: string[] | null;
  source_url: string | null;
  lat: number | null;
  lng: number | null;
}

async function feedRows(q: z.infer<typeof FeedQuery>): Promise<FeedRow[]> {
  const params: unknown[] = [];
  let where = `status IN ('active', 'scheduled') AND (ends_at IS NULL OR ends_at > NOW())`;
  if (q.type.length) {
    params.push(q.type);
    where += ` AND type = ANY($${params.length}::incident_type[])`;
  }
  if (q.lat !== undefined && q.lng !== undefined) {
    params.push(q.lng, q.lat, q.radius);
    where += ` AND affected_area IS NOT NULL AND ST_DWithin(affected_area::geography,
      ST_SetSRID(ST_MakePoint($${params.length - 2}, $${params.length - 1}), 4326)::geography, $${params.length})`;
  }
  const { rows } = await db.query<FeedRow>(
    `SELECT id, type::text, title, description, status::text, starts_at, ends_at, created_at, updated_at,
            affected_addresses, source_url,
            ST_Y(ST_Centroid(affected_area)) AS lat, ST_X(ST_Centroid(affected_area)) AS lng
       FROM incidents WHERE ${where}
      ORDER BY created_at DESC LIMIT 100`,
    params
  );
  return rows;
}

const link = (id: string) => `${config.webUrl}/incidents/${id}`;

function xml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]!))
    // XML 1.0 ne dozvoljava kontrolne znakove koji se ponekad pojave u scrapovanom tekstu
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

// Kratak sažetak umjesto cijele obavijesti: "Struja · Gatačka, Kraljice Jelene i još 3".
// Isto pravilo kao incidentWhere na webu (apps/web/src/types.ts).
export function shortSummary(r: Pick<FeedRow, "type" | "affected_addresses" | "title">): string {
  // Kad izvlačenje adresa ne uspije, u listi je cijeli tekst obavijesti — to nije ulica
  const streets = [...new Set((r.affected_addresses ?? [])
    .filter((a) => a.length <= 60 && !a.includes(":"))
    .map(streetOnly).filter(Boolean))];
  // "Isključenje struje — Novi Grad, 05.11.2026 13:30-15:00" → "Novi Grad"
  const fromTitle = r.title.match(/—\s*([^,]+)/)?.[1].trim();
  const where = streets.length === 0 ? (fromTitle ?? r.title)
    : streets.length <= 2 ? streets.join(", ")
    : `${streets.slice(0, 2).join(", ")} i još ${streets.length - 2}`;
  return `${TYPE_LABEL[r.type] ?? r.type} · ${where}`;
}

function rss(rows: FeedRow[], selfUrl: string): string {
  const items = rows.map((r) => `    <item>
      <title>${xml(shortSummary(r))}</title>
      <link>${xml(link(r.id))}</link>
      <guid isPermaLink="false">servisneinfo:${r.id}</guid>
      <pubDate>${r.created_at.toUTCString()}</pubDate>
      <category>${xml(r.type)}</category>
      <category>${xml(r.status)}</category>
      <description>${xml([r.title, r.description].filter(Boolean).join("\n\n"))}</description>${
        r.lat != null && r.lng != null ? `\n      <georss:point>${r.lat.toFixed(5)} ${r.lng.toFixed(5)}</georss:point>` : ""
      }
    </item>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:georss="http://www.georss.org/georss">
  <channel>
    <title>ServisneInfo — prekidi u Kantonu Sarajevo</title>
    <link>${xml(config.webUrl)}</link>
    <atom:link href="${xml(selfUrl)}" rel="self" type="application/rss+xml" />
    <description>Aktivni i planirani prekidi vode, struje, gasa, grijanja i interneta</description>
    <language>bs</language>
    <ttl>15</ttl>
${items}
  </channel>
</rss>
`;
}

function jsonFeed(rows: FeedRow[], selfUrl: string) {
  return {
    version: "https://jsonfeed.org/version/1.1",
    title: "ServisneInfo — prekidi u Kantonu Sarajevo",
    home_page_url: config.webUrl,
    feed_url: selfUrl,
    language: "bs",
    items: rows.map((r) => ({
      id: r.id,
      url: link(r.id),
      external_url: r.source_url ?? undefined,
      title: shortSummary(r),
      content_text: [r.title, r.description].filter(Boolean).join("\n\n"),
      date_published: r.created_at.toISOString(),
      date_modified: r.updated_at.toISOString(),
      tags: [r.type, r.status],
      // Proširenje (prefiks _ po JSON Feed specifikaciji): podaci za mape i kalendare
      _servisneinfo: {
        type: r.type, status: r.status,
        starts_at: r.starts_at?.toISOString() ?? null, ends_at: r.ends_at?.toISOString() ?? null,
        streets: r.affected_addresses ?? [],
        point: r.lat != null && r.lng != null ? { lat: r.lat, lng: r.lng } : null,
      },
    })),
  };
}

// iCalendar: tekst se escapuje, a redovi duži od 75 okteta se prelamaju (RFC 5545 §3.1)
function icsText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function fold(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  for (const ch of line) {
    if (Buffer.byteLength(current + ch, "utf8") > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = "";
    }
    current += ch;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

const icsDate = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

function ics(rows: FeedRow[]): string {
  const events = rows.filter((r) => r.starts_at).flatMap((r) => {
    const start = r.starts_at!;
    // Bez najavljenog kraja događaj traje 2 sata, da bude vidljiv u kalendaru
    const end = r.ends_at && r.ends_at > start ? r.ends_at : new Date(start.getTime() + 2 * 3600e3);
    return [
      "BEGIN:VEVENT",
      `UID:${r.id}@servisneinfo`,
      `DTSTAMP:${icsDate(r.updated_at)}`,
      `DTSTART:${icsDate(start)}`,
      `DTEND:${icsDate(end)}`,
      `SUMMARY:${icsText(shortSummary(r))}`,
      `DESCRIPTION:${icsText([r.title, r.description].filter(Boolean).join("\n\n"))}`,
      `URL:${link(r.id)}`,
      ...(r.lat != null && r.lng != null ? [`GEO:${r.lat.toFixed(5)};${r.lng.toFixed(5)}`] : []),
      `CATEGORIES:${icsText(TYPE_LABEL[r.type] ?? r.type)}`,
      r.status === "active" ? "STATUS:CONFIRMED" : "STATUS:TENTATIVE",
      "END:VEVENT",
    ];
  });
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ServisneInfo//Prekidi//BS",
    "CALSCALE:GREGORIAN",
    "X-WR-CALNAME:Prekidi — ServisneInfo",
    "X-PUBLISHED-TTL:PT15M",
    "REFRESH-INTERVAL;VALUE=DURATION:PT15M",
    ...events,
    "END:VCALENDAR",
  ].map(fold).join("\r\n") + "\r\n";
}

export async function feedsRoutes(app: FastifyInstance) {
  // req.host uključuje port (Fastify 5), req.hostname ne
  const selfUrl = (req: { protocol: string; host: string; url: string }) => `${req.protocol}://${req.host}${req.url}`;

  app.get("/feeds/prekidi.rss", async (req, reply) => {
    const rows = await feedRows(FeedQuery.parse(req.query));
    return reply.header("Cache-Control", "public, max-age=300")
      .type("application/rss+xml; charset=utf-8").send(rss(rows, selfUrl(req)));
  });

  app.get("/feeds/prekidi.json", async (req, reply) => {
    const rows = await feedRows(FeedQuery.parse(req.query));
    return reply.header("Cache-Control", "public, max-age=300")
      .type("application/feed+json; charset=utf-8").send(jsonFeed(rows, selfUrl(req)));
  });

  app.get("/feeds/prekidi.ics", async (req, reply) => {
    const rows = await feedRows(FeedQuery.parse(req.query));
    return reply.header("Cache-Control", "public, max-age=300")
      .header("Content-Disposition", 'inline; filename="prekidi.ics"')
      .type("text/calendar; charset=utf-8").send(ics(rows));
  });
}
