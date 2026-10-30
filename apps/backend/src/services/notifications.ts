import Expo, { ExpoPushMessage, ExpoPushTicket } from "expo-server-sdk";
import { db } from "../db";
import { config } from "../config";

const expo = new Expo({ accessToken: config.expoAccessToken || undefined });

// Slanje prema Expo-u; testovi ga zamjenjuju
export const pushTransport = {
  send: (messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]> => expo.sendPushNotificationsAsync(messages),
};

export interface IncidentRow {
  id: string;
  type: string;
  title: string;
  description: string | null;
}

// Koraci obavijesti (KTD3): najava pri objavi, podsjetnik prije početka, početak
export type NotifyStep = "announce" | "reminder" | "start";

export interface Recipient {
  id: string;
  expo_token: string;
  // Oznaka prve sačuvane adrese u zoni; null kad je okidač trenutna lokacija
  matched_label: string | null;
  reminder_minutes: number | null;
}

interface IncidentInfo {
  id: string;
  type: string;
  title: string;
  starts_at: Date | null;
  ends_at: Date | null;
  origin: "official" | "user";
}

const TYPE_EMOJI: Record<string, string> = {
  water: "💧",
  electricity: "⚡",
  gas: "🔥",
  heating: "🏠",
  internet: "🌐",
};

// "vode", "struje"… za "nema …" i "nestaje …"
const TYPE_GENITIVE: Record<string, string> = {
  water: "vode",
  electricity: "struje",
  gas: "gasa",
  heating: "grijanja",
  internet: "interneta",
};

// Uređaji koje za dati prekid i korak treba obavijestiti (R8, R13, KTD11):
// bilo koja adresa u zoni, ili uključena lokacija sa zadnjom tačkom u zoni;
// bez isključenog tipa, sa push tokenom i bez već poslanog istog koraka.
// Svaki uređaj se pojavljuje jednom, i kad mu je više adresa u zoni (AE3).
export async function findRecipients(incidentId: string, step: NotifyStep, onlyDeviceId?: string): Promise<Recipient[]> {
  const { rows } = await db.query<Recipient>(
    `SELECT dt.id, dt.expo_token, dt.reminder_minutes,
            (SELECT da.label FROM device_addresses da
              WHERE da.device_id = dt.id AND ST_Intersects(da.location, i.affected_area)
              ORDER BY da.created_at LIMIT 1) AS matched_label
       FROM device_tokens dt, incidents i
      WHERE i.id = $1
        AND ($3::uuid IS NULL OR dt.id = $3)
        AND i.affected_area IS NOT NULL
        AND dt.expo_token IS NOT NULL
        AND NOT (i.type = ANY (dt.muted_types))
        AND (
          EXISTS (SELECT 1 FROM device_addresses da
                   WHERE da.device_id = dt.id AND ST_Intersects(da.location, i.affected_area))
          OR (dt.location_enabled AND dt.last_lat IS NOT NULL AND dt.last_lng IS NOT NULL
              AND ST_Intersects(ST_SetSRID(ST_MakePoint(dt.last_lng, dt.last_lat), 4326), i.affected_area))
        )
        AND NOT EXISTS (SELECT 1 FROM sent_notifications sn
                         WHERE sn.incident_id = i.id AND sn.token_id = dt.id AND sn.step = $2)`,
    [incidentId, step, onlyDeviceId ?? null]
  );
  return rows;
}

const TZ = "Europe/Sarajevo";

function sarajevoDay(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: TZ });
}

function hour(d: Date): string {
  const [h, m] = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: TZ }).split(":");
  return m === "00" ? h : `${h}:${m}`;
}

// "Sutra 08–14h", "Danas od 22h", "4. 11. 08–14h"
export function whenText(start: Date | null, end: Date | null, now = new Date()): string {
  if (!start) return "";
  const day = sarajevoDay(start);
  const label = day === sarajevoDay(now) ? "Danas"
    : day === sarajevoDay(new Date(now.getTime() + 864e5)) ? "Sutra"
    : (([, m, d]) => `${Number(d)}. ${Number(m)}.`)(day.split("-"));
  if (end && sarajevoDay(end) === day) return `${label} ${hour(start)}–${hour(end)}h`;
  return `${label} od ${hour(start)}h`;
}

function reminderText(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.round(minutes / 60);
  return h === 1 ? "1 sat" : h < 5 ? `${h} sata` : `${h} sati`;
}

// Naslov i tekst zavise od koraka; oznaka je adresa koja se poklopila ili "vaša lokacija"
export function buildMessage(incident: IncidentInfo, step: NotifyStep, recipient: Pick<Recipient, "matched_label" | "reminder_minutes">, now = new Date()) {
  const emoji = TYPE_EMOJI[incident.type] ?? "📢";
  const what = TYPE_GENITIVE[incident.type] ?? "usluge";
  const where = recipient.matched_label ?? "vaša lokacija";
  const userNote = incident.origin === "user" ? " (prijava korisnika)" : "";

  let title: string;
  if (step === "announce") {
    const when = whenText(incident.starts_at, incident.ends_at, now);
    title = `${emoji} ${when ? `${when} nema ${what}` : `Nema ${what}`} – ${where}${userNote}`;
  } else if (step === "reminder") {
    const mins = incident.starts_at
      ? Math.max(1, Math.round((incident.starts_at.getTime() - now.getTime()) / 60_000))
      : recipient.reminder_minutes ?? 60;
    title = `${emoji} Za ${reminderText(mins)} nestaje ${what} – ${where}${userNote}`;
  } else {
    title = `${emoji} Nema ${what} – ${where}${userNote}`;
  }
  const body = incident.origin === "user" ? `Prijava korisnika: ${incident.title}` : incident.title;
  return { title, body };
}

// Šalje dati korak svim primaocima, najviše jednom po (prekid, uređaj, korak) — R12.
// Svaka trojka se prvo zauzme upisom u evidenciju; push ide samo zauzetim redovima,
// a kad Expo vrati grešku, zauzeće se briše da se može pokušati ponovo.
// onlyDeviceId: samo taj uređaj (npr. kad uđe u zonu sa novom lokacijom)
export async function notifyIncident(incidentId: string, step: NotifyStep, onlyDeviceId?: string): Promise<number> {
  const { rows: [incident] } = await db.query<IncidentInfo>(
    "SELECT id, type, title, starts_at, ends_at, origin FROM incidents WHERE id = $1", [incidentId]
  );
  if (!incident) return 0;

  const candidates = (await findRecipients(incidentId, step, onlyDeviceId))
    .filter((r) => Expo.isExpoPushToken(r.expo_token));
  if (candidates.length === 0) return 0;

  const { rows: claimedRows } = await db.query<{ token_id: string }>(
    `INSERT INTO sent_notifications (incident_id, token_id, step)
     SELECT $1, unnest($2::uuid[]), $3
     ON CONFLICT (incident_id, token_id, step) DO NOTHING
     RETURNING token_id`,
    [incidentId, candidates.map((c) => c.id), step]
  );
  const claimed = new Set(claimedRows.map((r) => r.token_id));
  const recipients = candidates.filter((c) => claimed.has(c.id));
  if (recipients.length === 0) return 0;

  const now = new Date();
  const messages: ExpoPushMessage[] = recipients.map((r) => {
    const { title, body } = buildMessage(incident, step, r, now);
    return {
      to: r.expo_token,
      title,
      body,
      data: { incidentId: incident.id, type: incident.type, step },
      sound: "default",
    };
  });

  // Tickete uparujemo s porukama po redoslijedu, chunk po chunk
  const tickets: (ExpoPushTicket | null)[] = [];
  for (const chunk of expo.chunkPushNotifications(messages)) {
    try {
      tickets.push(...(await pushTransport.send(chunk)));
    } catch (err) {
      console.error(`[notify] Expo send failed: ${err}`);
      tickets.push(...chunk.map(() => null));
    }
  }

  let sent = 0;
  for (let i = 0; i < recipients.length; i++) {
    const ticket = tickets[i];
    if (ticket?.status === "ok") {
      sent++;
      continue;
    }
    await db.query(
      "DELETE FROM sent_notifications WHERE incident_id = $1 AND token_id = $2 AND step = $3",
      [incidentId, recipients[i].id, step]
    );
    if (ticket?.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
      // Aplikacija je obrisana / token nevažeći — brišemo samo push token, adrese i postavke ostaju
      await db.query("UPDATE device_tokens SET expo_token = NULL WHERE id = $1", [recipients[i].id]);
    }
  }

  console.log(`📲 [${step}] Notified ${sent}/${recipients.length} devices for incident ${incidentId}`);
  return sent;
}
