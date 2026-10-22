import fs from "fs";
import path from "path";
import { db, connectDb } from "./index";

async function migrate() {
  await connectDb();
  const sql = fs.readFileSync(
    path.join(__dirname, "migrations/001_initial.sql"),
    "utf8"
  );
  await db.query(sql);
  console.log("✅ Migration complete");
  await db.end();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
