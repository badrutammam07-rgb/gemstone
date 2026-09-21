import { createClient, Client } from "@libsql/client";
import path from "path";
import fs from "fs";

let dbClient: Client | null = null;
let isUsingLocalFallback = false;

function createLocalClient(): Client {
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const localDbPath = path.join(dataDir, "turso_local.db");
  console.log(`[Turso DB] Using resilient libSQL database at ${localDbPath}`);
  isUsingLocalFallback = true;
  return createClient({
    url: `file:${localDbPath}`,
  });
}

export function getTursoClient(): Client {
  if (dbClient) return dbClient;

  const url = process.env.TURSO_DATABASE_URL?.trim();
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim();

  // Validate auth token: A valid Turso token must not be another libsql:// or http URL
  const isValidToken =
    authToken &&
    !authToken.startsWith("libsql://") &&
    !authToken.startsWith("http://") &&
    !authToken.startsWith("https://") &&
    authToken.length > 20;

  if (url && isValidToken) {
    console.log(`[Turso DB] Attempting remote Turso connection to ${url}`);
    try {
      dbClient = createClient({
        url,
        authToken,
      });
    } catch (e) {
      console.warn("[Turso DB] Remote client creation failed, using local libSQL:", e);
      dbClient = createLocalClient();
    }
  } else {
    if (url && !isValidToken) {
      console.warn(
        `[Turso DB] TURSO_AUTH_TOKEN is invalid or missing for remote url. Falling back to local libSQL database.`
      );
    }
    dbClient = createLocalClient();
  }

  return dbClient;
}

// Safely execute a query with automatic fallback to local DB if remote returns 400/401/network error
async function safeExecute(query: { sql: string; args?: any[] } | string): Promise<any> {
  let client = getTursoClient();
  try {
    return await client.execute(query as any);
  } catch (err: any) {
    console.warn(`[Turso DB] Error executing query on active client:`, err?.message || err);
    if (!isUsingLocalFallback) {
      console.warn("[Turso DB] Switching to local libSQL database fallback...");
      dbClient = createLocalClient();
      client = dbClient;
      await initTablesOnClient(client);
      return await client.execute(query as any);
    }
    throw err;
  }
}

async function initTablesOnClient(client: Client): Promise<void> {
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
    CREATE TABLE IF NOT EXISTS catalogs (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      owner_username TEXT NOT NULL,
      owner_phone TEXT NOT NULL,
      owner_avatar TEXT,
      title TEXT NOT NULL,
      stone_type TEXT NOT NULL,
      origin TEXT,
      dimensions TEXT,
      ring_material TEXT,
      price INTEGER NOT NULL DEFAULT 0,
      is_for_sale INTEGER NOT NULL DEFAULT 1,
      lab_memo TEXT,
      description TEXT,
      images TEXT NOT NULL DEFAULT '[]',
      likes TEXT DEFAULT '[]',
      comments TEXT DEFAULT '[]',
      last_bump_time INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
}

export async function initTursoSchema(): Promise<void> {
  try {
    let client = getTursoClient();
    try {
      await initTablesOnClient(client);
      console.log("[Turso DB] Tables schema verified successfully.");
    } catch (err: any) {
      console.warn("[Turso DB] Remote initialization failed, switching to local libSQL:", err?.message || err);
      dbClient = createLocalClient();
      await initTablesOnClient(dbClient);
      console.log("[Turso DB] Local schema verified successfully.");
    }
  } catch (err) {
    console.error("[Turso DB] Schema initialization error:", err);
  }
}

export interface TursoUser {
  id: string;
  username: string;
  phone: string;
  password: string;
  role: string;
  avatar: string;
  bio: string;
  followers: string[];
  following: string[];
  joinDate: string;
}

export async function getUserByUsernameOrPhone(identifier: string): Promise<TursoUser | null> {
  try {
    const clean = identifier.trim();
    const rs = await safeExecute({
      sql: "SELECT * FROM users WHERE LOWER(username) = LOWER(?) OR phone = ? LIMIT 1",
      args: [clean, clean],
    });

    if (!rs || !rs.rows || rs.rows.length === 0) return null;
    const row = rs.rows[0];

    return {
      id: String(row.id),
      username: String(row.username),
      phone: String(row.phone),
      password: String(row.password),
      role: String(row.role || "Anggota Komunitas Batu Mulia"),
      avatar: String(row.avatar || ""),
      bio: String(row.bio || ""),
      followers: JSON.parse(String(row.followers || "[]")),
      following: JSON.parse(String(row.following || "[]")),
      joinDate: String(row.join_date || "Terdaftar"),
    };
  } catch (err) {
    console.error("[Turso DB] getUserByUsernameOrPhone error:", err);
    return null;
  }
}

export async function getUserById(id: string): Promise<TursoUser | null> {
  try {
    const rs = await safeExecute({
      sql: "SELECT * FROM users WHERE id = ? LIMIT 1",
      args: [id],
    });

    if (!rs || !rs.rows || rs.rows.length === 0) return null;
    const row = rs.rows[0];

    return {
      id: String(row.id),
      username: String(row.username),
      phone: String(row.phone),
      password: String(row.password),
      role: String(row.role || "Anggota Komunitas Batu Mulia"),
      avatar: String(row.avatar || ""),
      bio: String(row.bio || ""),
      followers: JSON.parse(String(row.followers || "[]")),
      following: JSON.parse(String(row.following || "[]")),
      joinDate: String(row.join_date || "Terdaftar"),
    };
  } catch (err) {
    console.error("[Turso DB] getUserById error:", err);
    return null;
  }
}

export async function getUserByPhone(phone: string): Promise<TursoUser | null> {
  try {
    const clean = phone.trim();
    let altPhone = clean;
    if (clean.startsWith("+62")) {
      altPhone = "0" + clean.slice(3);
    } else if (clean.startsWith("62")) {
      altPhone = "0" + clean.slice(2);
    } else if (clean.startsWith("08")) {
      altPhone = "+628" + clean.slice(2);
    }

    const rs = await safeExecute({
      sql: "SELECT * FROM users WHERE phone = ? OR phone = ? LIMIT 1",
      args: [clean, altPhone],
    });

    if (!rs || !rs.rows || rs.rows.length === 0) return null;
    const row = rs.rows[0];

    return {
      id: String(row.id),
      username: String(row.username),
      phone: String(row.phone),
      password: String(row.password),
      role: String(row.role || "Anggota Komunitas Batu Mulia"),
      avatar: String(row.avatar || ""),
      bio: String(row.bio || ""),
      followers: JSON.parse(String(row.followers || "[]")),
      following: JSON.parse(String(row.following || "[]")),
      joinDate: String(row.join_date || "Terdaftar"),
    };
  } catch (err) {
    console.error("[Turso DB] getUserByPhone error:", err);
    return null;
  }
}

export async function insertUser(user: {
  id: string;
  username: string;
  phone: string;
  password: string;
  role?: string;
  avatar?: string;
  bio?: string;
  joinDate?: string;
}): Promise<TursoUser> {
  const role = user.role || "Anggota Komunitas Batu Mulia";
  const avatar =
    user.avatar ||
    "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=250&q=80";
  const bio = user.bio || "Pecinta batu mulia baru bergabung di Komunitas.";
  const joinDate = user.joinDate || "Baru saja";

  try {
    await safeExecute({
      sql: `INSERT INTO users (id, username, phone, password, role, avatar, bio, followers, following, join_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, '[]', '[]', ?)`,
      args: [user.id, user.username, user.phone, user.password, role, avatar, bio, joinDate],
    });
  } catch (err) {
    console.warn("[Turso DB] Insert user warning:", err);
  }

  return {
    id: user.id,
    username: user.username,
    phone: user.phone,
    password: user.password,
    role,
    avatar,
    bio,
    followers: [],
    following: [],
    joinDate,
  };
}

export async function updatePasswordByPhone(phone: string, newPassword: string): Promise<boolean> {
  try {
    const clean = phone.trim();
    let altPhone = clean;
    if (clean.startsWith("+62")) {
      altPhone = "0" + clean.slice(3);
    } else if (clean.startsWith("62")) {
      altPhone = "0" + clean.slice(2);
    } else if (clean.startsWith("08")) {
      altPhone = "+628" + clean.slice(2);
    }

    const rs = await safeExecute({
      sql: "UPDATE users SET password = ? WHERE phone = ? OR phone = ?",
      args: [newPassword, clean, altPhone],
    });

    return (rs?.rowsAffected || 0) > 0;
  } catch (err) {
    console.error("[Turso DB] updatePasswordByPhone error:", err);
    return false;
  }
}

export async function updateUserProfile(
  id: string,
  updates: {
    avatar?: string;
    bio?: string;
    newUsername?: string;
    newPhone?: string;
    newPassword?: string;
  }
): Promise<TursoUser | null> {
  try {
    const existing = await getUserById(id);
    if (!existing) return null;

    const username = updates.newUsername ? updates.newUsername.trim() : existing.username;
    const phone = updates.newPhone ? updates.newPhone.trim() : existing.phone;
    const avatar = updates.avatar !== undefined ? updates.avatar : existing.avatar;
    const bio = updates.bio !== undefined ? updates.bio : existing.bio;
    const password = updates.newPassword ? updates.newPassword : existing.password;

    await safeExecute({
      sql: `UPDATE users SET username = ?, phone = ?, avatar = ?, bio = ?, password = ? WHERE id = ?`,
      args: [username, phone, avatar, bio, password, id],
    });

    return getUserById(id);
  } catch (err) {
    console.error("[Turso DB] updateUserProfile error:", err);
    return null;
  }
}

export async function deleteUserAndData(id: string): Promise<boolean> {
  try {
    await safeExecute({
      sql: "DELETE FROM catalogs WHERE owner_id = ?",
      args: [id],
    });
    const rs = await safeExecute({
      sql: "DELETE FROM users WHERE id = ?",
      args: [id],
    });
    return (rs?.rowsAffected || 0) > 0;
  } catch (err) {
    console.error("[Turso DB] deleteUserAndData error:", err);
    return false;
  }
}
