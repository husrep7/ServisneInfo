import cron from 'node-cron';
import { db } from '../db';
import { notifyIncident } from '../services/notifications';
import { withdrawnSql } from './withdrawn';

// Podsjetnik prije početka planiranog prekida (R10, KTD4). Za svaki uređaj sa uključenim
// podsjetnikom: trenutak starts_at − podsjetnik je nastupio, a najava je stigla prije tog
// trenutka (AE2: najava unutar prozora ne daje poseban podsjetnik). Povučeni i riješeni
// prekidi se preskaču. Evidencija po koraku sprečava dupli podsjetnik (R12).
export async function sendDueReminders(now: Date = new Date()): Promise<number> {
  const { rows } = await db.query<{ incident_id: string; devices: string[] }>(
    `SELECT i.id AS incident_id, array_agg(DISTINCT dt.id) AS devices
       FROM incidents i
       JOIN sent_notifications a ON a.incident_id = i.id AND a.step = 'announce'
       JOIN device_tokens dt ON dt.id = a.token_id
      WHERE i.status = 'scheduled'
        AND i.starts_at > $1
        AND dt.reminder_minutes IS NOT NULL
        AND i.starts_at - make_interval(mins => dt.reminder_minutes) <= $1
        AND a.sent_at < i.starts_at - make_interval(mins => dt.reminder_minutes)
        AND NOT ${withdrawnSql('i')}
        AND NOT EXISTS (SELECT 1 FROM sent_notifications r
                         WHERE r.incident_id = i.id AND r.token_id = dt.id AND r.step = 'reminder')
      GROUP BY i.id`,
    [now]
  );

  let sent = 0;
  for (const r of rows) {
    sent += await notifyIncident(r.incident_id, 'reminder', { deviceIds: r.devices, now }).catch((err) => {
      console.error(`[Reminder job] ${r.incident_id}: ${err}`);
      return 0;
    });
  }
  if (sent > 0) console.log(`[Reminder job] sent=${sent}`);
  return sent;
}

let running = false;

export function startReminderJob(): cron.ScheduledTask {
  const task = cron.schedule('* * * * *', () => {
    // Jedan prolaz u isto vrijeme; dupli prolaz bi ionako bio odbijen zauzećem u evidenciji
    if (running) return;
    running = true;
    sendDueReminders().catch(console.error).finally(() => { running = false; });
  });
  console.log('✅ Reminder job scheduled every minute');
  return task;
}
