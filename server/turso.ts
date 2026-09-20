import { createClient, Client } from "@libsql/client";
import path from "path";
import fs from "fs";

let dbClient: Client | null = null;

export function getTursoClient(): Client {
  if (dbClient) return dbClient;

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (url && url.trim().length > 0) {
    console.log(`[Turso] Connecting to remote Turso database at ${url}`);
    dbClient = createClient({
      url: url.trim(),
      authToken: authToken ? authToken.trim() : undefined,
    });
  } else {
    // Local fallback using file database with libSQL
    const dataDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const localDbPath = path.join(dataDir, "turso_local.db");
    console.log(`[Turso] TURSO_DATABASE_URL not set. Using local libSQL database at ${localDbPath}`);
    dbClient = createClient({
      url: `file:${localDbPath}`,
    });
  }

  return dbClient;
}

export async function initTursoSchema(): Promise<void> {
  const db = getTursoClient();

  // Create users table for storing USERNAME, PASSWORD, and profile
  await db.execute(`
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

  // Create catalogs table for gemstones
  await db.execute(`
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

  console.log("[Turso] Tables schema verified successfully.");
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
  const db = getTursoClient();
  const clean = identifier.trim();

  const rs = await db.execute({
    sql: "SELECT * FROM users WHERE LOWER(username) = LOWER(?) OR phone = ? LIMIT 1",
    args: [clean, clean],
  });

  if (rs.rows.length === 0) return null;
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
}

export async function getUserById(id: string): Promise<TursoUser | null> {
  const db = getTursoClient();
  const rs = await db.execute({
    sql: "SELECT * FROM users WHERE id = ? LIMIT 1",
    args: [id],
  });

  if (rs.rows.length === 0) return null;
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
}

export async function getUserByPhone(phone: string): Promise<TursoUser | null> {
  const db = getTursoClient();
  const clean = phone.trim();

  // Also check standard Indonesian prefixes (08xx or +628xx or 628xx)
  let altPhone = clean;
  if (clean.startsWith("+62")) {
    altPhone = "0" + clean.slice(3);
  } else if (clean.startsWith("62")) {
    altPhone = "0" + clean.slice(2);
  } else if (clean.startsWith("08")) {
    altPhone = "+628" + clean.slice(2);
  }

  const rs = await db.execute({
    sql: "SELECT * FROM users WHERE phone = ? OR phone = ? LIMIT 1",
    args: [clean, altPhone],
  });

  if (rs.rows.length === 0) return null;
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
  const db = getTursoClient();

  const role = user.role || "Anggota Komunitas Batu Mulia";
  const avatar =
    user.avatar ||
    "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=250&q=80";
  const bio = user.bio || "Pecinta batu mulia baru bergabung di Komunitas.";
  const joinDate = user.joinDate || "Baru saja";

  await db.execute({
    sql: `INSERT INTO users (id, username, phone, password, role, avatar, bio, followers, following, join_date)
          VALUES (?, ?, ?, ?, ?, ?, ?, '[]', '[]', ?)`,
    args: [user.id, user.username, user.phone, user.password, role, avatar, bio, joinDate],
  });

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
  const db = getTursoClient();
  const clean = phone.trim();

  let altPhone = clean;
  if (clean.startsWith("+62")) {
    altPhone = "0" + clean.slice(3);
  } else if (clean.startsWith("62")) {
    altPhone = "0" + clean.slice(2);
  } else if (clean.startsWith("08")) {
    altPhone = "+628" + clean.slice(2);
  }

  const rs = await db.execute({
    sql: "UPDATE users SET password = ? WHERE phone = ? OR phone = ?",
    args: [newPassword, clean, altPhone],
  });

  return (rs.rowsAffected || 0) > 0;
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
  const db = getTursoClient();
  const existing = await getUserById(id);
  if (!existing) return null;

  const username = updates.newUsername ? updates.newUsername.trim() : existing.username;
  const phone = updates.newPhone ? updates.newPhone.trim() : existing.phone;
  const avatar = updates.avatar !== undefined ? updates.avatar : existing.avatar;
  const bio = updates.bio !== undefined ? updates.bio : existing.bio;
  const password = updates.newPassword ? updates.newPassword : existing.password;

  await db.execute({
    sql: `UPDATE users SET username = ?, phone = ?, avatar = ?, bio = ?, password = ? WHERE id = ?`,
    args: [username, phone, avatar, bio, password, id],
  });

  return getUserById(id);
}

export async function deleteUserAndData(id: string): Promise<boolean> {
  const db = getTursoClient();
  await db.execute({
    sql: "DELETE FROM catalogs WHERE owner_id = ?",
    args: [id],
  });
  const rs = await db.execute({
    sql: "DELETE FROM users WHERE id = ?",
    args: [id],
  });
  return (rs.rowsAffected || 0) > 0;
}
