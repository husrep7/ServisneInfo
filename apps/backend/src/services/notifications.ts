import Expo, { ExpoPushMessage, ExpoPushTicket } from "expo-server-sdk";
import { db } from "../db";
import { config } from "../config";

const expo = new Expo({ accessToken: config.expoAccessToken || undefined });

export interface IncidentRow {
  id: string;
  type: string;
  title: string;
  description: string | null;
}

const typeEmoji: Record<string, string> = {
  water: "💧",
  electricity: "⚡",
  gas: "🔥",
  heating: "🏠",
  internet: "🌐",
};

// Find all device tokens whose last known location is inside the incident polygon,
// then send push notifications to those not yet notified.
export async function notifyDevicesInArea(incident: IncidentRow): Promise<void> {
  const { rows: tokens } = await db.query<{ id: string; expo_token: string }>(
    `SELECT dt.id, dt.expo_token
     FROM device_tokens dt
     WHERE dt.last_lat IS NOT NULL
       AND dt.last_lng IS NOT NULL
       AND ST_Within(
         ST_SetSRID(ST_MakePoint(dt.last_lng, dt.last_lat), 4326),
         (SELECT affected_area FROM incidents WHERE id = $1)
       )
       AND NOT EXISTS (
         SELECT 1 FROM sent_notifications sn
         WHERE sn.incident_id = $1 AND sn.token_id = dt.id
       )`,
    [incident.id]
  );

  if (tokens.length === 0) return;

  const emoji = typeEmoji[incident.type] || "📢";
  const messages: ExpoPushMessage[] = tokens
    .filter((t) => Expo.isExpoPushToken(t.expo_token))
    .map((t) => ({
      to: t.expo_token,
      title: `${emoji} ${incident.title}`,
      body: incident.description ?? "Kliknite za detalje.",
      data: { incidentId: incident.id, type: incident.type },
      sound: "default",
    }));

  if (messages.length === 0) return;

  const chunks = expo.chunkPushNotifications(messages);
  const tickets: ExpoPushTicket[] = [];

  for (const chunk of chunks) {
    const chunkTickets = await expo.sendPushNotificationsAsync(chunk);
    tickets.push(...chunkTickets);
  }

  // Record sent notifications to avoid duplicates
  for (let i = 0; i < tokens.length; i++) {
    const ticket = tickets[i];
    if (ticket?.status === "ok") {
      await db.query(
        "INSERT INTO sent_notifications (incident_id, token_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [incident.id, tokens[i].id]
      );
    }
  }

  console.log(`📲 Notified ${tickets.filter((t) => t.status === "ok").length} devices for incident ${incident.id}`);
}
