import { Pool } from "pg";
import { config } from "../config";

export const db = new Pool({ connectionString: config.databaseUrl });

// Bez ovog handlera greška na idle konekciji (npr. restart baze) ruši cijeli proces
db.on("error", (err) => {
  console.error("PostgreSQL pool error:", err.message);
});

export async function connectDb() {
  const client = await db.connect();
  await client.query("SELECT 1");
  client.release();
  console.log("✅ PostgreSQL connected");
}
