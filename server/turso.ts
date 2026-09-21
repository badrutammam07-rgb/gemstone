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
      sql: "DELETE FROM catalogs_v2 WHERE user_id = ?",
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

export async function getAllUsers(): Promise<TursoUser[]> {
  try {
    const rs = await safeExecute("SELECT * FROM users ORDER BY created_at DESC");
    if (!rs || !rs.rows) return [];
    return rs.rows.map((row: any) => ({
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
    }));
  } catch (err) {
    console.error("[Turso DB] getAllUsers error:", err);
    return [];
  }
}

export async function updateUserFollow(
  id: string,
  followers: string[],
  following: string[]
): Promise<boolean> {
  try {
    const rs = await safeExecute({
      sql: `UPDATE users SET followers = ?, following = ? WHERE id = ?`,
      args: [JSON.stringify(followers), JSON.stringify(following), id],
    });
    return (rs?.rowsAffected || 0) > 0;
  } catch (err) {
    console.error("[Turso DB] updateUserFollow error:", err);
    return false;
  }
}

export interface TursoCatalogItem {
  id: string;
  userId: string;
  username: string;
  userAvatar: string;
  gemType: string;
  dimensions: string;
  price: string;
  description?: string;
  videoUrl: string;
  images: string[];
  status: "koleksi" | "dijual" | "terjual";
  isPublished: boolean;
  publishedAt?: number;
  bumpedAt?: number;
  soldAt?: number;
  autoDeleteAt?: number;
  comments: any[];
  likes: string[];
  createdAt: string;
  offers?: any[];
}

export async function getAllCatalogsFromTurso(): Promise<TursoCatalogItem[]> {
  try {
    const rs = await safeExecute("SELECT * FROM catalogs_v2 ORDER BY rowid DESC");
    if (!rs || !rs.rows) return [];
    return rs.rows.map((row: any) => ({
      id: String(row.id),
      userId: String(row.user_id),
      username: String(row.username),
      userAvatar: String(row.user_avatar || ""),
      gemType: String(row.gem_type),
      dimensions: String(row.dimensions),
      price: String(row.price),
      description: row.description ? String(row.description) : "",
      videoUrl: String(row.video_url || ""),
      images: JSON.parse(String(row.images || "[]")),
      status: String(row.status || "koleksi") as any,
      isPublished: Boolean(row.is_published),
      publishedAt: row.published_at ? Number(row.published_at) : undefined,
      bumpedAt: row.bumped_at ? Number(row.bumped_at) : undefined,
      soldAt: row.sold_at ? Number(row.sold_at) : undefined,
      autoDeleteAt: row.auto_delete_at ? Number(row.auto_delete_at) : undefined,
      comments: JSON.parse(String(row.comments || "[]")),
      likes: JSON.parse(String(row.likes || "[]")),
      offers: JSON.parse(String(row.offers || "[]")),
      createdAt: String(row.created_at || "Hari ini"),
    }));
  } catch (err) {
    console.error("[Turso DB] getAllCatalogsFromTurso error:", err);
    return [];
  }
}

export async function saveCatalogToTurso(c: TursoCatalogItem): Promise<boolean> {
  try {
    await safeExecute({
      sql: `INSERT OR REPLACE INTO catalogs_v2 
        (id, user_id, username, user_avatar, gem_type, dimensions, price, description, video_url, images, status, is_published, published_at, bumped_at, sold_at, auto_delete_at, comments, likes, offers, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        c.id,
        c.userId,
        c.username,
        c.userAvatar,
        c.gemType,
        c.dimensions,
        c.price,
        c.description || "",
        c.videoUrl,
        JSON.stringify(c.images || []),
        c.status || "koleksi",
        c.isPublished ? 1 : 0,
        c.publishedAt || null,
        c.bumpedAt || null,
        c.soldAt || null,
        c.autoDeleteAt || null,
        JSON.stringify(c.comments || []),
        JSON.stringify(c.likes || []),
        JSON.stringify(c.offers || []),
        c.createdAt || "Hari ini",
      ],
    });
    return true;
  } catch (err) {
    console.error("[Turso DB] saveCatalogToTurso error:", err);
    return false;
  }
}

export async function deleteCatalogFromTurso(id: string): Promise<boolean> {
  try {
    const rs = await safeExecute({
      sql: "DELETE FROM catalogs_v2 WHERE id = ?",
      args: [id],
    });
    return (rs?.rowsAffected || 0) > 0;
  } catch (err) {
    console.error("[Turso DB] deleteCatalogFromTurso error:", err);
    return false;
  }
}

export interface TursoTransactionRoom {
  id: string;
  catalogId: string;
  offerId: string;
  gemType: string;
  dimensions: string;
  gemImage: string;
  videoUrl?: string;
  agreedPrice: string;
  seller: any;
  buyer: any;
  status: "pending_verification" | "active" | "expired";
  createdAt: number;
  lastActivityAt: number;
  expiresAt: number;
  messages: any[];
}

export async function getAllTransactionRoomsFromTurso(): Promise<TursoTransactionRoom[]> {
  try {
    const rs = await safeExecute("SELECT * FROM transaction_rooms ORDER BY created_at DESC");
    if (!rs || !rs.rows) return [];
    return rs.rows.map((row: any) => ({
      id: String(row.id),
      catalogId: String(row.catalog_id),
      offerId: String(row.offer_id),
      gemType: String(row.gem_type),
      dimensions: String(row.dimensions),
      gemImage: String(row.gem_image || ""),
      videoUrl: row.video_url ? String(row.video_url) : undefined,
      agreedPrice: String(row.agreed_price),
      seller: JSON.parse(String(row.seller_data || "{}")),
      buyer: JSON.parse(String(row.buyer_data || "{}")),
      status: String(row.status) as any,
      createdAt: Number(row.created_at),
      lastActivityAt: Number(row.last_activity_at),
      expiresAt: Number(row.expires_at),
      messages: JSON.parse(String(row.messages || "[]")),
    }));
  } catch (err) {
    console.error("[Turso DB] getAllTransactionRoomsFromTurso error:", err);
    return [];
  }
}

export async function saveTransactionRoomToTurso(r: TursoTransactionRoom): Promise<boolean> {
  try {
    await safeExecute({
      sql: `INSERT OR REPLACE INTO transaction_rooms
        (id, catalog_id, offer_id, gem_type, dimensions, gem_image, video_url, agreed_price, seller_data, buyer_data, status, created_at, last_activity_at, expires_at, messages)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        r.id,
        r.catalogId,
        r.offerId,
        r.gemType,
        r.dimensions,
        r.gemImage,
        r.videoUrl || null,
        r.agreedPrice,
        JSON.stringify(r.seller),
        JSON.stringify(r.buyer),
        r.status,
        r.createdAt,
        r.lastActivityAt,
        r.expiresAt,
        JSON.stringify(r.messages || []),
      ],
    });
    return true;
  } catch (err) {
    console.error("[Turso DB] saveTransactionRoomToTurso error:", err);
    return false;
  }
}

export async function deleteTransactionRoomFromTurso(id: string): Promise<boolean> {
  try {
    const rs = await safeExecute({
      sql: "DELETE FROM transaction_rooms WHERE id = ?",
      args: [id],
    });
    return (rs?.rowsAffected || 0) > 0;
  } catch (err) {
    console.error("[Turso DB] deleteTransactionRoomFromTurso error:", err);
    return false;
  }
}

export async function deleteExpiredSoldCatalogsFromTurso(now: number = Date.now()): Promise<number> {
  try {
    const rs = await safeExecute({
      sql: "DELETE FROM catalogs_v2 WHERE status = 'terjual' AND auto_delete_at IS NOT NULL AND auto_delete_at <= ?",
      args: [now],
    });
    return rs?.rowsAffected || 0;
  } catch (err) {
    console.error("[Turso DB] deleteExpiredSoldCatalogsFromTurso error:", err);
    return 0;
  }
}

export async function deleteInactiveTransactionRoomsFromTurso(sevenDaysAgo: number): Promise<number> {
  try {
    const rs = await safeExecute({
      sql: "DELETE FROM transaction_rooms WHERE last_activity_at < ?",
      args: [sevenDaysAgo],
    });
    return rs?.rowsAffected || 0;
  } catch (err) {
    console.error("[Turso DB] deleteInactiveTransactionRoomsFromTurso error:", err);
    return 0;
  }
}

export async function deleteTransactionRoomsByCatalogId(catalogId: string): Promise<number> {
  try {
    const rs = await safeExecute({
      sql: "DELETE FROM transaction_rooms WHERE catalog_id = ?",
      args: [catalogId],
    });
    return rs?.rowsAffected || 0;
  } catch (err) {
    console.error("[Turso DB] deleteTransactionRoomsByCatalogId error:", err);
    return 0;
  }
}
