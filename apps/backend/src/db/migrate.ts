import fs from "fs";
import path from "path";
import { db, connectDb } from "./index";

export async function runMigrations() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const dir = path.join(__dirname, "migrations");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const { rows } = await db.query<{ name: string }>("SELECT name FROM schema_migrations");
  const applied = new Set(rows.map((r) => r.name));

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log(`✅ Applied ${file}`);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  console.log("✅ Migrations complete");
}

// Pokrenuto kao skripta (npm run migrate); testovi importuju runMigrations
if (require.main === module) {
  connectDb()
    .then(runMigrations)
    .then(() => db.end())
    .catch((err) => {
      console.error("Migration failed:", err);
      process.exit(1);
    });
}
