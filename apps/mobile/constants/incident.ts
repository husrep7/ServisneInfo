import type { AreaGeometry, Incident } from "@servisneinfo/shared";

export const TYPE_LABEL: Record<Incident["type"], string> = {
  water:       "VODOVOD",
  electricity: "ELEKTRO",
  gas:         "GAS",
  heating:     "GRIJANJE",
  internet:    "INTERNET",
};

export const TYPE_ICON: Record<Incident["type"], string> = {
  water:       "💧",
  electricity: "⚡",
  gas:         "🔥",
  heating:     "🏠",
  internet:    "🌐",
};

export const STATUS_LABEL: Record<Incident["status"], string> = {
  active:    "AKTIVNO",
  scheduled: "PLANIRANO",
  resolved:  "ZAVRŠENO",
};

// Vrijeme uvijek po Sarajevu, bez obzira na vremensku zonu telefona
const TIME_ZONE = "Europe/Sarajevo";

export function formatDateTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  try {
    return d.toLocaleString("bs-BA", {
      timeZone: TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    // Starije Intl implementacije ne znaju timeZone: lokalno vrijeme je bolje nego ništa
    return d.toLocaleString("bs-BA");
  }
}

// Zona službene obavijesti je MultiPolygon (krug oko svake ulice): jedan Polygon po dijelu
export function polygonParts(geojson: AreaGeometry) {
  const rings = geojson.type === "Polygon" ? [geojson.coordinates[0]] : geojson.coordinates.map((p) => p[0]);
  return rings.map((ring) => ring.map(([lng, lat]) => ({ latitude: lat, longitude: lng })));
}

export function incidentPath(id: string) {
  return `/incident/${id}` as const;
}

// Udaljenost između dvije tačke u metrima (haversine)
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Prijava je "kod mene" kad je u krugu od 500 m oko sačuvane adrese (isti krug kao za potvrdu, KTD6)
export const REPORT_NEAR_METERS = 500;

export function timeAgo(iso: string, now = Date.now()): string {
  const min = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (min < 1) return "upravo";
  if (min < 60) return `prije ${min} min`;
  const h = Math.floor(min / 60);
  return `prije ${h} h`;
}
