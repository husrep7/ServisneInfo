import { db } from "../db";
import { overpass } from "./places";

// Lokalni registar ulica i naselja (ADR-0004). Uvozi se jednom dnevno uz objekte
// (jobs/places.job.ts) i služi za pretragu mjesta i geokodiranje ulica iz obavijesti,
// tako da javni Nominatim zovemo samo za ono što ovdje nije pronađeno.

const CANTON_BBOX = "43.70,18.10,44.05,18.65";

export const GAZETTEER_QUERY = `[out:json][timeout:180];(
  way["highway"]["name"](${CANTON_BBOX});
  node["place"~"^(suburb|neighbourhood|quarter|village|hamlet|town)$"]["name"](${CANTON_BBOX});
);out center tags;`;

const DIACRITICS: Record<string, string> = { č: "c", ć: "c", š: "s", ž: "z", đ: "dj" };

// "Kralja Tvrtka" i "kod Kralja Tvrtka" → "kralj tvrtk"; "Ferhadije"/"Ferhadija" → "ferhadij".
// Padeži se u bosanskom uglavnom razlikuju u završnom samoglasniku, pa ga skidamo.
export function stem(text: string): string {
  return text
    .toLowerCase()
    .replace(/[čćšžđ]/g, (c) => DIACRITICS[c])
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w.length > 3 ? w.replace(/(ima|ama|om|em|oj|u|a|e|i|o)$/, "") : w))
    .join(" ");
}

// Kućni brojevi i oznake iz obavijesti: "Gatačka 1-4, 6-7, BB" → "Gatačka"
export function streetOnly(address: string): string {
  return address
    .replace(/\b(ulica|ul\.)\s+/i, "")
    .split(",")[0]
    .replace(/\s+(\d+[A-Za-z]?([-–/]\d+[A-Za-z]?)?|bb|BB|DO\d+|K\d+)(\s.*)?$/, "")
    .trim();
}

interface Element {
  type: "node" | "way" | "relation";
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export async function importGazetteer(): Promise<number> {
  const elements = (await overpass.query(GAZETTEER_QUERY)) as Element[];
  const groups = new Map<string, { name: string; kind: "street" | "area"; points: [number, number][] }>();
  for (const el of elements) {
    const name = el.tags?.name?.trim();
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (!name || lat === undefined || lng === undefined) continue;
    const kind = el.type === "node" ? "area" : "street";
    const key = `${kind}:${name}`;
    const g = groups.get(key) ?? { name, kind, points: [] };
    g.points.push([lng, lat]);
    groups.set(key, g);
  }
  const rows = [...groups.values()];
  if (rows.length < 500) throw new Error(`Overpass vratio samo ${rows.length} naziva`);

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM gazetteer");
    await client.query(
      `INSERT INTO gazetteer (name, name_stem, kind, location)
       SELECT t.name, t.stem, t.kind, ST_SetSRID(ST_GeomFromText(t.wkt), 4326)
         FROM unnest($1::text[], $2::text[], $3::text[], $4::text[]) AS t(name, stem, kind, wkt)`,
      [
        rows.map((r) => r.name),
        rows.map((r) => stem(r.name)),
        rows.map((r) => r.kind),
        rows.map((r) => `MULTIPOINT(${r.points.map(([x, y]) => `${x} ${y}`).join(",")})`),
      ]
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  return rows.length;
}

export interface GazetteerMatch {
  label: string;
  kind:  "street" | "area";
  lat:   number;
  lng:   number;
}

// Naziv iz registra: tačan stem, pa naziv koji počinje upitom. Za ulicu se vraća njen segment
// najbliži korisniku (ako je poznata lokacija), inače segment najbliži središtu ulice.
export async function lookupPlace(text: string, near?: { lat: number; lng: number }): Promise<GazetteerMatch | null> {
  const q = stem(text);
  if (q.length < 3) return null;
  const { rows } = await db.query<GazetteerMatch>(
    `WITH ref AS (SELECT CASE WHEN $2::float8 IS NULL THEN NULL
                         ELSE ST_SetSRID(ST_MakePoint($2, $3), 4326) END AS pt)
     SELECT g.name AS label, g.kind,
            ST_Y(p.pt) AS lat, ST_X(p.pt) AS lng
       FROM gazetteer g, ref,
            LATERAL (SELECT ST_ClosestPoint(g.location, COALESCE(ref.pt, ST_Centroid(g.location))) AS pt) p
      WHERE g.name_stem = $1 OR g.name_stem LIKE $1 || ' %' OR g.name_stem LIKE $1 || '%'
      ORDER BY (g.name_stem = $1) DESC,
               -- Naselje ("Grbavica") prije istoimene ulice, osim kad je ulica tačan pogodak
               (g.kind = 'area') DESC,
               length(g.name_stem) ASC,
               CASE WHEN ref.pt IS NULL THEN 0 ELSE ST_Distance(p.pt, ref.pt) END ASC
      LIMIT 1`,
    [q, near?.lng ?? null, near?.lat ?? null]
  );
  return rows[0] ?? null;
}

// Za scrapere: tačka ulice iz obavijesti ili null kad je nema u registru
export async function lookupStreet(address: string): Promise<[number, number] | null> {
  const name = streetOnly(address);
  if (name.length < 3) return null;
  const { rows } = await db.query<{ lng: number; lat: number }>(
    `SELECT ST_X(ST_ClosestPoint(location, ST_Centroid(location))) AS lng,
            ST_Y(ST_ClosestPoint(location, ST_Centroid(location))) AS lat
       FROM gazetteer WHERE kind = 'street' AND name_stem = $1 LIMIT 1`,
    [stem(name)]
  );
  return rows[0] ? [rows[0].lng, rows[0].lat] : null;
}
