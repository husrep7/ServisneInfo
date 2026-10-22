import { Pool } from "pg";
import { config } from "../config";

export const db = new Pool({ connectionString: config.databaseUrl });

export async function connectDb() {
  const client = await db.connect();
  await client.query("SELECT 1");
  client.release();
  console.log("✅ PostgreSQL connected");
}
