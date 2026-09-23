import { createClient } from "@libsql/client";
import fs from "fs";
import path from "path";

// Function to dump all data from the source Turso database
export async function exportCurrentTursoData(sourceUrl?: string, sourceToken?: string) {
  const url = sourceUrl || process.env.TURSO_DATABASE_URL;
  const authToken = sourceToken || process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    throw new Error("Missing source TURSO_DATABASE_URL or TURSO_AUTH_TOKEN");
  }

  console.log(`[Backup] Connecting to source database: ${url}...`);
  const client = createClient({ url, authToken });

  const tables = ["users", "catalogs_v2", "transaction_rooms", "notifications"];
  const exportData: Record<string, any[]> = {};

  for (const table of tables) {
    try {
      const result = await client.execute(`SELECT * FROM ${table}`);
      exportData[table] = result.rows || [];
      console.log(`[Backup] Table ${table}: ${exportData[table].length} rows exported.`);
    } catch (err: any) {
      console.warn(`[Backup] Warning reading table ${table}:`, err?.message || err);
      exportData[table] = [];
    }
  }

  const backupDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const backupFilePath = path.join(backupDir, "turso_backup.json");
  fs.writeFileSync(backupFilePath, JSON.stringify(exportData, null, 2), "utf-8");
  console.log(`[Backup] Backup successfully saved to ${backupFilePath}`);

  return exportData;
}

// Function to import all data into the target Turso database
export async function importToNewTurso(targetUrl: string, targetToken: string, data?: Record<string, any[]>) {
  if (!targetUrl || !targetToken) {
    throw new Error("Target TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be provided");
  }

  let importData = data;
  if (!importData) {
    const backupFilePath = path.join(process.cwd(), "data", "turso_backup.json");
    if (!fs.existsSync(backupFilePath)) {
      throw new Error(`Backup file not found at ${backupFilePath}. Run export first.`);
    }
    importData = JSON.parse(fs.readFileSync(backupFilePath, "utf-8"));
  }

  console.log(`[Migrate] Connecting to new Turso database: ${targetUrl}...`);
  const client = createClient({ url: targetUrl, authToken: targetToken });

  // 1. Initialize schema in new database
  console.log(`[Migrate] Creating tables in new database if not exist...`);
  await client.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'Anggota Komunitas Batu Mulia',
      avatar TEXT,
      bio TEXT,
      followers TEXT DEFAULT '[]',
      following TEXT DEFAULT '[]',
      join_date TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS catalogs_v2 (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      user_avatar TEXT,
      gem_type TEXT NOT NULL,
      dimensions TEXT NOT NULL,
      price TEXT NOT NULL,
      description TEXT,
      video_url TEXT NOT NULL,
      images TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'koleksi',
      is_published INTEGER NOT NULL DEFAULT 0,
      published_at INTEGER,
      bumped_at INTEGER,
      sold_at INTEGER,
      auto_delete_at INTEGER,
      comments TEXT NOT NULL DEFAULT '[]',
      likes TEXT NOT NULL DEFAULT '[]',
      offers TEXT NOT NULL DEFAULT '[]',
      created_at TEXT DEFAULT 'Hari ini'
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS transaction_rooms (
      id TEXT PRIMARY KEY,
      catalog_id TEXT NOT NULL,
      offer_id TEXT NOT NULL,
      gem_type TEXT NOT NULL,
      dimensions TEXT NOT NULL,
      gem_image TEXT,
      video_url TEXT,
      agreed_price TEXT NOT NULL,
      seller_data TEXT NOT NULL,
      buyer_data TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      last_activity_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      messages TEXT NOT NULL DEFAULT '[]'
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      recipient_id TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      actor_name TEXT NOT NULL,
      actor_avatar TEXT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      catalog_id TEXT NOT NULL,
      gem_type TEXT NOT NULL,
      catalog_image TEXT,
      comment_id TEXT,
      offer_id TEXT,
      is_read INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL
    );
  `);

  // 2. Insert records into each table
  for (const [table, rows] of Object.entries(importData!)) {
    if (!rows || rows.length === 0) {
      console.log(`[Migrate] Skipping empty table ${table}`);
      continue;
    }

    console.log(`[Migrate] Migrating ${rows.length} rows to ${table}...`);
    for (const row of rows) {
      const keys = Object.keys(row);
      const placeholders = keys.map(() => "?").join(", ");
      const values = keys.map((k) => row[k]);

      await client.execute({
        sql: `INSERT OR REPLACE INTO ${table} (${keys.join(", ")}) VALUES (${placeholders})`,
        args: values,
      });
    }
    console.log(`[Migrate] Table ${table} successfully migrated!`);
  }

  // 3. Verification
  console.log(`[Migrate] Verifying rows in new database:`);
  for (const table of ["users", "catalogs_v2", "transaction_rooms", "notifications"]) {
    try {
      const res = await client.execute(`SELECT COUNT(*) as count FROM ${table}`);
      console.log(`[Verify] Table ${table} now has: ${res.rows[0].count} rows.`);
    } catch (e: any) {
      console.warn(`[Verify] Error checking ${table}:`, e?.message || e);
    }
  }

  console.log(`[Migrate] MIGRATION COMPLETED SUCCESSFULLY!`);
}

// Allow CLI execution:
// tsx scripts/migrate_turso.ts [export | import <target_url> <target_token> | full <target_url> <target_token>]
async function main() {
  const mode = process.argv[2] || "export";
  if (mode === "export") {
    await exportCurrentTursoData();
  } else if (mode === "import") {
    const targetUrl = process.argv[3];
    const targetToken = process.argv[4];
    await importToNewTurso(targetUrl, targetToken);
  } else if (mode === "full") {
    const targetUrl = process.argv[3];
    const targetToken = process.argv[4];
    const data = await exportCurrentTursoData();
    await importToNewTurso(targetUrl, targetToken, data);
  } else {
    console.log("Usage: tsx scripts/migrate_turso.ts [export | import <target_url> <target_token> | full <target_url> <target_token>]");
  }
}

if (process.argv[1]?.endsWith("migrate_turso.ts")) {
  main().catch((err) => {
    console.error("[Migrate Error]:", err);
    process.exit(1);
  });
}
