import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import {
  initTursoSchema,
  getUserByUsernameOrPhone,
  getUserById,
  getUserByPhone,
  getAllUsers,
  insertUser,
  updatePasswordByPhone,
  updateUserProfile,
  updateUserFollow,
  deleteUserAndData,
  getAllCatalogsFromTurso,
  saveCatalogToTurso,
  deleteCatalogFromTurso,
  getAllTransactionRoomsFromTurso,
  saveTransactionRoomToTurso,
  deleteTransactionRoomFromTurso,
  deleteExpiredSoldCatalogsFromTurso,
  deleteInactiveTransactionRoomsFromTurso,
  deleteTransactionRoomsByCatalogId,
  saveNotificationToTurso,
  getNotificationsFromTurso,
  markNotificationReadInTurso,
  markAllNotificationsReadInTurso,
} from "./server/turso";
import { uploadMediaPhoto } from "./server/cloudinary";

export type NotificationType =
  | "offer"
  | "counter_offer"
  | "offer_accepted"
  | "comment"
  | "comment_reply";

export interface AppNotification {
  id: string;
  recipientId: string;
  actorId: string;
  actorName: string;
  actorAvatar?: string;
  type: NotificationType;
  title: string;
  message: string;
  catalogId: string;
  gemType: string;
  catalogImage?: string;
  commentId?: string;
  offerId?: string;
  isRead: boolean;
  createdAt: number;
}

interface User {
  id: string;
  username: string;
  phone: string;
  password: string;
  role: string;
  avatar: string;
  bio?: string;
  followers: string[]; // user IDs
  following: string[]; // user IDs
  joinDate: string;
}

interface NegotiationOffer {
  id: string;
  catalogId: string;
  buyerId: string;
  buyerName: string;
  buyerAvatar: string;
  buyerPhone?: string;
  sellerId: string;
  offerPrice: string;
  note?: string;
  status: "pending" | "accepted" | "countered";
  createdAt: string;
  updatedAt?: number;
  counterPrice?: string;
  counterNote?: string;
  counteredAt?: string;
  acceptedPrice?: string;
  acceptedAt?: string;
}

interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  content: string;
  createdAt: string;
  replyToId?: string;
  replyToAuthorId?: string;
  replyToAuthorName?: string;
  isOffer?: boolean;
  offerId?: string;
  offerPrice?: string;
  offerStatus?: "pending" | "accepted" | "countered";
  counterPrice?: string;
  counterNote?: string;
}

interface CatalogItem {
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
  comments: Comment[];
  likes: string[];
  createdAt: string;
  offers?: NegotiationOffer[];
}

interface FaceIdVerification {
  verified: boolean;
  facePhotoUrl: string;
  verifiedAt: number;
}

interface GpsVerification {
  verified: boolean;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  locationName: string;
  verifiedAt: number;
}

interface PartyVerification {
  userId: string;
  username: string;
  userAvatar: string;
  userPhone?: string;
  faceId?: FaceIdVerification;
  gps?: GpsVerification;
  isFullyVerified: boolean;
}

interface RoomChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  content: string;
  createdAt: string;
  timestamp: number;
}

interface TransactionRoom {
  id: string;
  catalogId: string;
  offerId: string;
  gemType: string;
  dimensions: string;
  gemImage: string;
  videoUrl?: string;
  agreedPrice: string;
  seller: PartyVerification;
  buyer: PartyVerification;
  status: "pending_verification" | "active" | "expired";
  createdAt: number;
  lastActivityAt: number;
  expiresAt: number;
  messages: RoomChatMessage[];
}

// Persistent File Database (JSON)
const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "database.json");

if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    console.error("Gagal membuat direktori data:", err);
  }
}

function loadDatabase(): {
  users: User[];
  catalogs: CatalogItem[];
  transactionRooms: TransactionRoom[];
  notifications: AppNotification[];
} {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      return {
        users: Array.isArray(parsed.users) ? parsed.users : [],
        catalogs: Array.isArray(parsed.catalogs) ? parsed.catalogs : [],
        transactionRooms: Array.isArray(parsed.transactionRooms)
          ? parsed.transactionRooms
          : [],
        notifications: Array.isArray(parsed.notifications)
          ? parsed.notifications
          : [],
      };
    }
  } catch (err) {
    console.error("Gagal membaca database.json:", err);
  }
  return { users: [], catalogs: [], transactionRooms: [], notifications: [] };
}

const initialDb = loadDatabase();
// Seluruh akun dummy dihapus sehingga semua pendaftaran adalah akun real
const users: User[] = initialDb.users;
const catalogs: CatalogItem[] = initialDb.catalogs;
let transactionRooms: TransactionRoom[] = initialDb.transactionRooms;
let notifications: AppNotification[] = initialDb.notifications || [];

// 1 Minggu dalam Milidetik (7 hari) untuk masa kadaluarsa jika tidak aktif komunikasinya / setelah terjual
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

async function runAutoCleanup() {
  const now = Date.now();
  const sevenDaysAgo = now - SEVEN_DAYS_MS;

  // 1. Identifikasi dan hapus katalog berstatus terjual yang sudah lewat 1 minggu
  let catalogChanged = false;
  const expiredCatalogIds: string[] = [];

  for (let i = catalogs.length - 1; i >= 0; i--) {
    const item = catalogs[i];
    if (item.status === "terjual" && item.autoDeleteAt && now >= item.autoDeleteAt) {
      console.log(
        `[AUTO-CLEANUP] Otomatis menghapus katalog terjual setelah 1 minggu: ${item.gemType} (${item.id})`
      );
      expiredCatalogIds.push(item.id);
      catalogs.splice(i, 1);
      catalogChanged = true;
    }
  }

  // 2. Identifikasi dan hapus room transaksi yang tidak aktif selama 1 minggu ATAU terhubung ke katalog yang sudah terhapus
  let roomsChanged = false;
  const expiredRoomIds: string[] = [];

  transactionRooms = transactionRooms.filter((r) => {
    const isInactive1Week = now - r.lastActivityAt > SEVEN_DAYS_MS;
    const isCatalogDeleted = expiredCatalogIds.includes(r.catalogId);
    if (isInactive1Week || isCatalogDeleted) {
      expiredRoomIds.push(r.id);
      roomsChanged = true;
      return false;
    }
    return true;
  });

  if (catalogChanged || roomsChanged) {
    saveDatabase();
  }

  // 3. Eksekusi pembersihan permanen di database Turso
  try {
    const deletedSoldTurso = await deleteExpiredSoldCatalogsFromTurso(now);
    const deletedRoomsTurso = await deleteInactiveTransactionRoomsFromTurso(sevenDaysAgo);

    for (const cId of expiredCatalogIds) {
      await deleteCatalogFromTurso(cId);
      await deleteTransactionRoomsByCatalogId(cId);
    }

    for (const rId of expiredRoomIds) {
      await deleteTransactionRoomFromTurso(rId);
    }

    if (
      deletedSoldTurso > 0 ||
      deletedRoomsTurso > 0 ||
      expiredCatalogIds.length > 0 ||
      expiredRoomIds.length > 0
    ) {
      console.log(
        `[Turso DB] Auto-cleanup: Terhapus ${deletedSoldTurso + expiredCatalogIds.length} katalog terjual (>1 minggu) & ${deletedRoomsTurso + expiredRoomIds.length} room transaksi tidak aktif (>1 minggu).`
      );
    }
  } catch (err) {
    console.error("[Turso DB] Auto-cleanup error:", err);
  }
}

function cleanupExpiredRooms() {
  runAutoCleanup().catch((e) => console.warn("[Auto Cleanup Warning]", e));
}

function cleanupExpiredSoldCatalogs() {
  runAutoCleanup().catch((e) => console.warn("[Auto Cleanup Warning]", e));
}

function saveDatabase() {
  try {
    fs.writeFileSync(
      DB_FILE,
      JSON.stringify({ users, catalogs, transactionRooms, notifications }, null, 2),
      "utf-8"
    );
  } catch (err) {
    console.error("Gagal menyimpan database.json:", err);
  }
}

async function addAppNotification(notifData: {
  recipientId: string;
  actorId: string;
  actorName: string;
  actorAvatar?: string;
  type: NotificationType;
  title: string;
  message: string;
  catalogId: string;
  gemType: string;
  catalogImage?: string;
  commentId?: string;
  offerId?: string;
}): Promise<AppNotification | null> {
  // Jangan beri notifikasi ke diri sendiri
  if (notifData.recipientId === notifData.actorId) return null;

  const newNotif: AppNotification = {
    ...notifData,
    id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    isRead: false,
    createdAt: Date.now(),
  };

  notifications.unshift(newNotif);
  // Simpan maksimal 150 notifikasi di memori
  if (notifications.length > 150) {
    notifications = notifications.slice(0, 150);
  }

  saveDatabase();
  saveNotificationToTurso(newNotif).catch((e) =>
    console.warn("[Turso DB] Error saving notification:", e)
  );

  return newNotif;
}

// Pastikan file database tersinkronisasi
saveDatabase();

async function syncFromTurso() {
  try {
    const tursoUsers = await getAllUsers();
    if (tursoUsers.length > 0) {
      users.length = 0;
      for (const u of tursoUsers) {
        users.push({
          id: u.id,
          username: u.username,
          phone: u.phone,
          password: u.password,
          role: u.role,
          avatar: u.avatar,
          bio: u.bio,
          followers: u.followers || [],
          following: u.following || [],
          joinDate: u.joinDate || "Terdaftar",
        });
      }
    } else {
      // Seed Turso if empty but local has users
      for (const u of users) {
        await insertUser(u);
      }
    }

    const tursoCatalogs = await getAllCatalogsFromTurso();
    if (tursoCatalogs.length > 0) {
      catalogs.length = 0;
      for (const c of tursoCatalogs) {
        catalogs.push(c as CatalogItem);
      }
    } else {
      // Seed Turso if empty but local has catalogs
      for (const c of catalogs) {
        await saveCatalogToTurso(c);
      }
    }

    const tursoRooms = await getAllTransactionRoomsFromTurso();
    if (tursoRooms.length > 0) {
      transactionRooms = tursoRooms as TransactionRoom[];
    } else {
      // Seed Turso if empty but local has rooms
      for (const r of transactionRooms) {
        await saveTransactionRoomToTurso(r);
      }
    }

    saveDatabase();
    console.log(
      `[Turso DB] Sinkronisasi berhasil: ${users.length} pengguna, ${catalogs.length} katalog, ${transactionRooms.length} room transaksi.`
    );
  } catch (err) {
    console.error("[Turso DB] Error saat sinkronisasi:", err);
  }
}

// Helper to normalize phone
function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/[^0-9]/g, "");
  if (cleaned.startsWith("0")) {
    cleaned = "62" + cleaned.slice(1);
  } else if (!cleaned.startsWith("62")) {
    cleaned = "62" + cleaned;
  }
  return cleaned;
}

// Helper untuk menjaga privasi penawaran:
// "hanya calon pembeli tersebut dan penjual yang dapat melihat, calon pembeli lain tidak dapat melihat yang orang lain tawar. Namun di kolom komentar tetap tertulis bahwa user tersebut telah melakukan penawaran."
function sanitizeCatalogForViewer(catalog: CatalogItem, viewerId?: string): CatalogItem {
  const isOwner = Boolean(viewerId && catalog.userId === viewerId);

  // 1. Sanitasi komentar penawaran
  const sanitizedComments: Comment[] = (catalog.comments || []).map((comm) => {
    if (!comm.isOffer) {
      return { ...comm };
    }

    const isThisBuyer = Boolean(viewerId && comm.authorId === viewerId);

    // Jika viewer adalah penjual atau penawar itu sendiri: tampilkan harga & status lengkap
    if (isOwner || isThisBuyer) {
      return { ...comm };
    }

    // Jika calon pembeli lain / pengunjung umum: sembunyikan nominal penawaran maupun harga banding!
    let publicContent = `${comm.authorName} telah melakukan penawaran harga.`;
    if (comm.offerStatus === "countered") {
      publicContent = `Sedang ada negosiasi yang belum sepakat.`;
    } else if (comm.offerStatus === "accepted") {
      publicContent = `Penawaran harga dari ${comm.authorName} telah disepakati oleh penjual!`;
    }

    return {
      id: comm.id,
      authorId: comm.authorId,
      authorName: comm.authorName,
      authorAvatar: comm.authorAvatar,
      content: publicContent,
      createdAt: comm.createdAt,
      isOffer: true,
      offerId: comm.offerId,
      offerStatus: comm.offerStatus || "pending",
      // offerPrice dan counterPrice sengaja disembunyikan agar pembeli lain tidak dapat melihat nominal tawaran
    };
  });

  // 2. Sanitasi array offers (hanya penjual dan pembeli bersangkutan)
  let sanitizedOffers: NegotiationOffer[] = [];
  if (isOwner) {
    // Penjual dapat melihat seluruh penawaran yang masuk
    sanitizedOffers = catalog.offers || [];
  } else if (viewerId) {
    // Calon pembeli HANYA dapat melihat penawaran miliknya sendiri
    sanitizedOffers = (catalog.offers || []).filter((o) => o.buyerId === viewerId);
  }

  return {
    ...catalog,
    comments: sanitizedComments,
    offers: sanitizedOffers,
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  // Initialize Turso tables, sync data, and run auto cleanup
  try {
    await initTursoSchema();
    await syncFromTurso();
    await runAutoCleanup();
  } catch (tursoInitErr) {
    console.error("[Turso Init Warning]", tursoInitErr);
  }

  // Run cleanup every 5 minutes (menghapus katalog terjual > 1 minggu & room cekout tidak aktif > 1 minggu)
  setInterval(() => {
    runAutoCleanup().catch((e) => console.warn("[Auto Cleanup Warning]", e));
  }, 5 * 60 * 1000);

  // Health
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", app: "Komunitas Batu Mulia API" });
  });

  // Cache video yang berhasil diekstrak agar pemuatan super cepat
  const videoStreamCache = new Map<string, { directUrl: string; expiresAt: number }>();

  // Endpoint untuk mengekstrak dan menyelesaikan stream video langsung (.mp4)
  // Memungkinkan video diputar dengan tag native HTML5 <video> sehingga 100% Auto-play dan Replay (Loop) tanpa henti
  app.get("/api/resolve-video", async (req, res) => {
    try {
      const videoUrl = String(req.query.url || "").trim();
      if (!videoUrl) {
        return res.status(400).json({ success: false, message: "URL video tidak diberikan." });
      }

      // Periksa cache
      const cached = videoStreamCache.get(videoUrl);
      if (cached && cached.expiresAt > Date.now()) {
        return res.json({ success: true, directUrl: cached.directUrl, cached: true });
      }

      // 1. Format video langsung
      if (videoUrl.match(/\.(mp4|webm|ogg|mov)(\?.*)?$/i)) {
        return res.json({ success: true, directUrl: videoUrl, platform: "direct" });
      }

      // 2. Instagram Reel / Post
      const igMatch = videoUrl.match(/instagram\.com\/(?:p|reel|reels|share\/reel)\/([A-Za-z0-9_-]+)/i);
      if (igMatch) {
        const shortcode = igMatch[1];
        const embedUrl = `https://www.instagram.com/p/${shortcode}/embed/`;
        // Fetch tanpa custom User-Agent agar Instagram mengembalikan format SSR yang memuat video_url langsung
        const igRes = await fetch(embedUrl);

        if (igRes.ok) {
          const html = await igRes.text();
          const idx = html.indexOf("video_url");
          if (idx !== -1) {
            const httpIdx = html.indexOf("http", idx);
            const endQuoteIdx = html.indexOf('"', httpIdx);
            if (httpIdx !== -1 && endQuoteIdx !== -1) {
              const rawUrl = html.substring(httpIdx, endQuoteIdx);
              const cleanUrl = rawUrl
                .replace(/\\u0026/gi, "&")
                .replace(/\\u00253D/gi, "%3D")
                .replace(/\\u003D/gi, "=")
                .replace(/\\+/g, "");

              if (cleanUrl.startsWith("http") && cleanUrl.includes(".mp4")) {
                // Simpan di cache selama 3 jam
                videoStreamCache.set(videoUrl, {
                  directUrl: cleanUrl,
                  expiresAt: Date.now() + 3 * 60 * 60 * 1000,
                });

                return res.json({
                  success: true,
                  directUrl: cleanUrl,
                  platform: "instagram",
                  shortcode,
                });
              }
            }
          }
        }
      }

      return res.json({ success: false, directUrl: null });
    } catch (err: any) {
      console.warn("[Resolve Video Error]", err?.message || err);
      return res.json({ success: false, directUrl: null });
    }
  });

  // Media Photo Upload to Cloudinary
  // "Untuk penyimpanan media foto gunakan Cloudinary" (Akun: ibnu.92sholihin@gmail.com)
  app.post("/api/upload", async (req, res) => {
    try {
      const { image, folder } = req.body;
      if (!image) {
        return res.status(400).json({ success: false, message: "Berkas foto tidak ditemukan." });
      }
      const uploadResult = await uploadMediaPhoto(image, folder || "katalog");
      return res.json(uploadResult);
    } catch (err: any) {
      console.error("[Upload API Error]", err);
      return res.status(500).json({
        success: false,
        message: err?.message || "Gagal mengunggah foto ke Cloudinary.",
      });
    }
  });

  // Check Phone Existence for Account Verification
  app.get("/api/auth/check-phone", async (req, res) => {
    try {
      const phoneParam = (req.query.phone as string) || "";
      if (!phoneParam.trim()) {
        return res.status(400).json({ success: false, message: "Nomor HP wajib disertakan." });
      }

      const cleanRawPhone = phoneParam.trim();
      // Check Turso first
      let user = await getUserByPhone(cleanRawPhone);
      // Fallback check in memory
      if (!user) {
        const found = users.find(
          (u) => normalizePhone(u.phone) === normalizePhone(cleanRawPhone) || u.phone === cleanRawPhone
        );
        if (found) {
          user = {
            id: found.id,
            username: found.username,
            phone: found.phone,
            password: found.password,
            role: found.role,
            avatar: found.avatar,
            bio: found.bio || "",
            followers: found.followers || [],
            following: found.following || [],
            joinDate: found.joinDate || "Terdaftar",
          };
        }
      }

      if (!user) {
        return res.status(404).json({
          success: false,
          message: `Nomor HP "${cleanRawPhone}" belum terdaftar di sistem.`,
        });
      }

      return res.json({
        success: true,
        username: user.username,
        phone: user.phone,
      });
    } catch (err: any) {
      console.error("[Check Phone Error]", err);
      return res.status(500).json({ success: false, message: "Gagal memeriksa nomor HP." });
    }
  });

  // 1. Register (Menyimpan USERNAME & PASSWORD di Database Turso)
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { username, phone, password, confirmPassword } = req.body;

      if (!username || !phone || !password || !confirmPassword) {
        return res.status(400).json({
          success: false,
          message: "Mohon lengkapi semua data pendaftaran (Username, No HP, dan Password).",
        });
      }

      if (password !== confirmPassword) {
        return res.status(400).json({ success: false, message: "Konfirmasi password tidak cocok." });
      }

      const cleanRawPhone = phone.trim();
      if (cleanRawPhone.length < 9) {
        return res.status(400).json({ success: false, message: "Nomor HP minimal 10 digit." });
      }

      const cleanUsername = username.trim();

      // Check existence in Turso or memory
      try {
        const existingTurso = await getUserByUsernameOrPhone(cleanUsername);
        if (existingTurso) {
          return res.status(400).json({
            success: false,
            message: `Username "${cleanUsername}" sudah digunakan. Silakan pilih username lain.`,
          });
        }
      } catch (checkErr) {
        console.warn("[Register] Turso username check warning:", checkErr);
      }

      const existsUsername = users.find(
        (u) => u.username.toLowerCase() === cleanUsername.toLowerCase()
      );
      if (existsUsername) {
        return res.status(400).json({
          success: false,
          message: `Username "${cleanUsername}" sudah digunakan. Silakan pilih username lain.`,
        });
      }

      try {
        const existingTursoPhone = await getUserByPhone(cleanRawPhone);
        if (existingTursoPhone) {
          return res.status(400).json({
            success: false,
            message: `Nomor HP "${cleanRawPhone}" sudah terdaftar. Silakan login atau gunakan nomor lain.`,
          });
        }
      } catch (checkPhoneErr) {
        console.warn("[Register] Turso phone check warning:", checkPhoneErr);
      }

      const existsPhone = users.find(
        (u) => normalizePhone(u.phone) === normalizePhone(cleanRawPhone) || u.phone === cleanRawPhone
      );
      if (existsPhone) {
        return res.status(400).json({
          success: false,
          message: `Nomor HP "${cleanRawPhone}" sudah terdaftar. Silakan login atau gunakan nomor lain.`,
        });
      }

      const newId = `user-${Date.now()}`;
      const defaultAvatar = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=250&q=80";

      // Save to Turso Database
      try {
        await insertUser({
          id: newId,
          username: cleanUsername,
          phone: cleanRawPhone,
          password: password,
          role: "Anggota Komunitas Batu Mulia",
          avatar: defaultAvatar,
          bio: "Pecinta batu mulia baru bergabung di Komunitas.",
          joinDate: "Baru saja",
        });
        console.log(`[Turso DB] Pengguna "${cleanUsername}" berhasil disimpan di database Turso.`);
      } catch (dbErr) {
        console.error("[Turso DB] Warning saat simpan ke Turso:", dbErr);
      }

      const newUser: User = {
        id: newId,
        username: cleanUsername,
        phone: cleanRawPhone,
        password: password,
        role: "Anggota Komunitas Batu Mulia",
        avatar: defaultAvatar,
        bio: "Pecinta batu mulia baru bergabung di Komunitas.",
        followers: [],
        following: [],
        joinDate: "Baru saja",
      };

      users.push(newUser);
      saveDatabase();

      const safeUser = {
        id: newUser.id,
        username: newUser.username,
        phone: newUser.phone,
        role: newUser.role,
        avatar: newUser.avatar,
        bio: newUser.bio,
        followers: newUser.followers,
        following: newUser.following,
        joinDate: newUser.joinDate,
      };

      return res.status(201).json({
        success: true,
        message: `Akun berhasil didaftarkan di Database! Selamat bergabung di Komunitas Batu Mulia.`,
        user: safeUser,
      });
    } catch (err: any) {
      console.error("[Register Error]", err);
      return res.status(500).json({
        success: false,
        message: err?.message || "Terjadi kesalahan pada server saat mendaftarkan akun. Silakan coba lagi.",
      });
    }
  });

  // 4. Login (Autentikasi USERNAME & PASSWORD via Database Turso)
  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: "Username dan password wajib diisi." });
    }

    const trimmed = username.trim();

    // Check Turso Database first
    let userFromDb = await getUserByUsernameOrPhone(trimmed);

    // Fallback to in-memory/file db
    if (!userFromDb) {
      const memUser = users.find(
        (u) =>
          u.username.toLowerCase() === trimmed.toLowerCase() ||
          u.phone === trimmed ||
          normalizePhone(u.phone) === normalizePhone(trimmed)
      );
      if (memUser) {
        userFromDb = {
          id: memUser.id,
          username: memUser.username,
          phone: memUser.phone,
          password: memUser.password,
          role: memUser.role,
          avatar: memUser.avatar,
          bio: memUser.bio || "",
          followers: memUser.followers || [],
          following: memUser.following || [],
          joinDate: memUser.joinDate || "Terdaftar",
        };
      }
    }

    if (!userFromDb) {
      return res.status(401).json({
        success: false,
        message: `Akun "${trimmed}" tidak ditemukan di database.`,
      });
    }

    if (userFromDb.password !== password) {
      return res.status(401).json({
        success: false,
        message: "Password yang Anda masukkan salah.",
      });
    }

    const safeUser = {
      id: userFromDb.id,
      username: userFromDb.username,
      phone: userFromDb.phone,
      role: userFromDb.role,
      avatar: userFromDb.avatar,
      bio: userFromDb.bio,
      followers: userFromDb.followers || [],
      following: userFromDb.following || [],
      joinDate: userFromDb.joinDate,
    };

    return res.json({
      success: true,
      message: `Selamat datang, ${userFromDb.username}!`,
      user: safeUser,
    });
  });

  // 5. Reset Password di Database Turso (Verifikasi Langsung Nomor HP)
  app.post("/api/auth/forgot-password/reset", async (req, res) => {
    const { phone, newPassword, confirmPassword } = req.body;

    if (!phone || !newPassword || !confirmPassword) {
      return res.status(400).json({ success: false, message: "Mohon lengkapi No HP dan kata sandi baru." });
    }

    const cleanRawPhone = phone.trim();

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: "Konfirmasi kata sandi baru tidak cocok." });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "Kata sandi baru minimal 6 karakter." });
    }

    // Periksa user di Turso atau memory
    let user = await getUserByPhone(cleanRawPhone);
    if (!user) {
      const found = users.find(
        (u) => normalizePhone(u.phone) === normalizePhone(cleanRawPhone) || u.phone === cleanRawPhone
      );
      if (found) user = found as any;
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: `Nomor HP "${cleanRawPhone}" belum terdaftar pada akun Komunitas Batu Mulia.`,
      });
    }

    // Update in Turso Database
    try {
      await updatePasswordByPhone(cleanRawPhone, newPassword);
      console.log(`[Turso DB] Password untuk No HP "${cleanRawPhone}" berhasil diupdate di Turso.`);
    } catch (dbErr) {
      console.error("[Turso DB] Warning update password di Turso:", dbErr);
    }

    const localUser = users.find(
      (u) => normalizePhone(u.phone) === normalizePhone(cleanRawPhone) || u.phone === cleanRawPhone
    );

    if (localUser) {
      localUser.password = newPassword;
      saveDatabase();
    }

    const targetUsername = user.username || cleanRawPhone;

    return res.json({
      success: true,
      message: `Kata sandi untuk akun "${targetUsername}" berhasil diperbarui di database! Silakan masuk dengan kata sandi baru.`,
      username: targetUsername,
    });
  });

  // 6. User Profile Update via Settings (Disimpan ke Database Turso)
  app.put("/api/user/update-profile", async (req, res) => {
    const {
      userId,
      avatar,
      currentPassword,
      newPassword,
      newUsername,
      newPhone,
      bio,
    } = req.body;

    const userIndex = users.findIndex((u) => u.id === userId);
    if (userIndex === -1) {
      return res.status(404).json({ success: false, message: "Pengguna tidak ditemukan." });
    }

    const user = users[userIndex];
    const isUsernameChanged = newUsername && newUsername.trim() !== user.username;
    const isPhoneChanged = newPhone && newPhone.trim() !== user.phone;

    // Check if new username is taken
    if (isUsernameChanged) {
      const existingUsername = users.find(
        (u) =>
          u.id !== user.id &&
          u.username.toLowerCase() === newUsername.trim().toLowerCase()
      );
      if (existingUsername) {
        return res.status(400).json({
          success: false,
          message: `Username "${newUsername.trim()}" sudah dipakai oleh pengguna lain.`,
        });
      }
    }

    // Check if new phone is taken
    if (isPhoneChanged) {
      const cleanNewPhone = newPhone.trim();
      if (cleanNewPhone.length < 9) {
        return res.status(400).json({
          success: false,
          message: "Nomor HP baru minimal 10 digit.",
        });
      }
      const existingPhone = users.find(
        (u) =>
          u.id !== user.id &&
          (normalizePhone(u.phone) === normalizePhone(cleanNewPhone) || u.phone === cleanNewPhone)
      );
      if (existingPhone) {
        return res.status(400).json({
          success: false,
          message: `Nomor HP "${cleanNewPhone}" sudah digunakan akun lain.`,
        });
      }
    }

    // If password changed, verify current password
    if (newPassword) {
      if (!currentPassword || currentPassword !== user.password) {
        return res.status(400).json({
          success: false,
          message: "Password saat ini salah. Tidak dapat mengubah password.",
        });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: "Password baru minimal 6 karakter.",
        });
      }
      user.password = newPassword;
    }

    const oldUsername = user.username;
    if (newUsername && newUsername.trim()) user.username = newUsername.trim();
    if (newPhone && newPhone.trim()) user.phone = newPhone.trim();
    if (avatar) {
      let finalAvatar = avatar;
      if (typeof avatar === "string" && avatar.startsWith("data:")) {
        try {
          const upRes = await uploadMediaPhoto(avatar, "avatar");
          if (upRes && upRes.url) {
            finalAvatar = upRes.url;
          }
        } catch (upErr) {
          console.warn("[Cloudinary] Upload profile avatar warning:", upErr);
        }
      }
      user.avatar = finalAvatar;
    }
    if (bio !== undefined) user.bio = bio;

    // Update in Turso Database
    try {
      await updateUserProfile(user.id, {
        newUsername: user.username,
        newPhone: user.phone,
        avatar: user.avatar,
        bio: user.bio,
        newPassword: user.password,
      });
      console.log(`[Turso DB] Profil user ${user.username} berhasil disinkronkan ke Turso.`);
    } catch (dbErr) {
      console.error("[Turso DB] Warning sync update profil:", dbErr);
    }

    // Cascade update username & avatar to all catalogs and comments
    catalogs.forEach((c) => {
      if (c.userId === user.id) {
        c.username = user.username;
        c.userAvatar = user.avatar;
      }
      c.comments.forEach((cm) => {
        if (cm.authorId === user.id) {
          cm.authorName = user.username;
          cm.authorAvatar = user.avatar;
        }
      });
    });

    console.log(`[PROFILE UPDATE] User ${oldUsername} updated to ${user.username}`);
    saveDatabase();

    const safeUser = {
      id: user.id,
      username: user.username,
      phone: user.phone,
      role: user.role,
      avatar: user.avatar,
      bio: user.bio,
      followers: user.followers || [],
      following: user.following || [],
      joinDate: user.joinDate,
    };

    return res.json({
      success: true,
      message: "Profil dan data akun Anda berhasil diperbarui di database!",
      user: safeUser,
    });
  });

  // 7. Search Users
  app.get("/api/users/search", (req, res) => {
    const q = ((req.query.q as string) || "").trim().toLowerCase();
    if (!q) {
      return res.json({ success: true, users: [] });
    }

    const matches = users
      .filter((u) => u.username.toLowerCase().includes(q))
      .map((u) => ({
        id: u.id,
        username: u.username,
        role: u.role,
        avatar: u.avatar,
        bio: u.bio,
        followersCount: (u.followers || []).length,
        followingCount: (u.following || []).length,
      }));

    return res.json({ success: true, users: matches });
  });

  // 8. Get Specific User Profile by ID or Username
  app.get("/api/users/:id", (req, res) => {
    const { id } = req.params;
    const user = users.find((u) => u.id === id || u.username.toLowerCase() === id.toLowerCase());

    if (!user) {
      return res.status(404).json({ success: false, message: "Pengguna tidak ditemukan." });
    }

    const safeUser = {
      id: user.id,
      username: user.username,
      phone: user.phone,
      role: user.role,
      avatar: user.avatar,
      bio: user.bio,
      followers: user.followers || [],
      following: user.following || [],
      joinDate: user.joinDate,
    };

    return res.json({ success: true, user: safeUser });
  });

  // 9. Follow / Unfollow User
  app.post("/api/users/:targetUserId/follow", (req, res) => {
    const { targetUserId } = req.params;
    const { currentUserId } = req.body;

    if (!currentUserId || currentUserId === targetUserId) {
      return res.status(400).json({ success: false, message: "Aksi ikuti tidak valid." });
    }

    const targetUser = users.find((u) => u.id === targetUserId);
    const currentUser = users.find((u) => u.id === currentUserId);

    if (!targetUser || !currentUser) {
      return res.status(404).json({ success: false, message: "Pengguna tidak ditemukan." });
    }

    targetUser.followers = targetUser.followers || [];
    currentUser.following = currentUser.following || [];

    const isFollowing = targetUser.followers.includes(currentUser.id);

    if (isFollowing) {
      // Unfollow
      targetUser.followers = targetUser.followers.filter((id) => id !== currentUser.id);
      currentUser.following = currentUser.following.filter((id) => id !== targetUser.id);
    } else {
      // Follow
      targetUser.followers.push(currentUser.id);
      currentUser.following.push(targetUser.id);
    }
    saveDatabase();
    updateUserFollow(targetUser.id, targetUser.followers, targetUser.following).catch((e) =>
      console.warn(`[Turso DB] Failed updating follow for ${targetUser.id}:`, e)
    );
    updateUserFollow(currentUser.id, currentUser.followers, currentUser.following).catch((e) =>
      console.warn(`[Turso DB] Failed updating follow for ${currentUser.id}:`, e)
    );

    return res.json({
      success: true,
      isFollowing: !isFollowing,
      targetFollowersCount: targetUser.followers.length,
      currentFollowingCount: currentUser.following.length,
      message: !isFollowing
        ? `Anda sekarang mengikuti ${targetUser.username}`
        : `Batal mengikuti ${targetUser.username}`,
    });
  });

  // 10. Get Beranda Feed (Dashboard: all published catalogs from any user)
  // "postingan terbaru yang dibuat oleh user manapun akan selalu berada paling atas"
  // "Ketika user klik tombol sundul maka sistem akan menaikan postingan katalog tersebut paling atas"
  app.get("/api/catalog/feed", (req, res) => {
    cleanupExpiredSoldCatalogs();

    const viewerId = (req.query.currentUserId as string) || undefined;
    const published = catalogs.filter((c) => c.isPublished);

    // Sort by bumpedAt or publishedAt descending (highest timestamp = top)
    published.sort((a, b) => {
      const timeA = a.bumpedAt || a.publishedAt || 0;
      const timeB = b.bumpedAt || b.publishedAt || 0;
      return timeB - timeA;
    });

    const sanitized = published.map((c) => sanitizeCatalogForViewer(c, viewerId));

    return res.json({ success: true, catalogs: sanitized });
  });

  // 11. Get Catalogs of a Specific User (for Profile page)
  app.get("/api/catalog/user/:userId", (req, res) => {
    const { userId } = req.params;
    const viewerId = (req.query.currentUserId as string) || undefined;
    cleanupExpiredSoldCatalogs();

    const userCatalogs = catalogs.filter((c) => c.userId === userId);
    const sanitized = userCatalogs.map((c) => sanitizeCatalogForViewer(c, viewerId));
    return res.json({ success: true, catalogs: sanitized });
  });

  // 12. Create New Catalog (Input Katalog di Profile)
  // "setiap katalog berisi gambar dan deskripsi yang berisi (jenis batu, dimensi, dan nominal harga)dan untuk membuat katalog ada tombol input katalog, jika sudah menekan tombol save maka masuk ke halaman profile user"
  // "user selain mengisi foto dan keterangan, wajib mengisi URL video baik dari youtube, tiktok ataupun Instagram yang dapat diputar langsung diaplikasi agar calon pembeli melihat secara detail batu yang ingin dibeli."
  app.post("/api/catalog", async (req, res) => {
    const { userId, gemType, dimensions, price, description, images, videoUrl } = req.body;

    if (!userId || !gemType || !dimensions || !price) {
      return res.status(400).json({
        success: false,
        message: "Jenis batu, dimensi, dan nominal harga wajib diisi.",
      });
    }

    if (!videoUrl || typeof videoUrl !== "string" || !videoUrl.trim()) {
      return res.status(400).json({
        success: false,
        message: "URL video wajib diisi (YouTube, TikTok, atau Instagram) agar calon pembeli dapat melihat detail batu.",
      });
    }

    const cleanVideoUrl = videoUrl.trim();
    const isYt = /(?:youtube\.com|youtu\.be)/i.test(cleanVideoUrl);
    const isTiktok = /tiktok\.com/i.test(cleanVideoUrl);
    const isIg = /instagram\.com/i.test(cleanVideoUrl);
    const isDirectVid =
      /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(cleanVideoUrl) ||
      (cleanVideoUrl.includes("cloudinary.com") && cleanVideoUrl.includes("/video/"));

    if (!isYt && !isTiktok && !isIg && !isDirectVid) {
      return res.status(400).json({
        success: false,
        message: "URL video tidak valid. Wajib menyertakan tautan resmi dari YouTube, TikTok, atau Instagram.",
      });
    }

    const user = users.find((u) => u.id === userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "Pengguna tidak ditemukan." });
    }

    const sampleGems = [
      "https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=800&q=80",
    ];

    const processedImages: string[] = [];
    if (images && Array.isArray(images) && images.length > 0) {
      for (const img of images) {
        if (typeof img === "string" && img.startsWith("data:")) {
          try {
            const upRes = await uploadMediaPhoto(img, "katalog");
            processedImages.push(upRes.url);
          } catch (uploadErr) {
            console.warn("[Cloudinary] Upload catalog photo error:", uploadErr);
            processedImages.push(img);
          }
        } else if (typeof img === "string" && img.trim()) {
          processedImages.push(img.trim());
        }
      }
    }

    const finalImages =
      processedImages.length > 0
        ? processedImages
        : [sampleGems[Math.floor(Math.random() * sampleGems.length)]];

    const newCatalog: CatalogItem = {
      id: `cat-${Date.now()}`,
      userId: user.id,
      username: user.username,
      userAvatar: user.avatar,
      gemType: gemType.trim(),
      dimensions: dimensions.trim(),
      price: price.trim(),
      description: description ? description.trim() : "",
      videoUrl: cleanVideoUrl,
      images: finalImages,
      status: "koleksi", // default masuk koleksi profile dulu
      isPublished: false,
      comments: [],
      likes: [],
      createdAt: "Hari ini",
    };

    catalogs.unshift(newCatalog);
    saveDatabase();
    saveCatalogToTurso(newCatalog).catch((e) =>
      console.warn(`[Turso DB] Failed saving new catalog ${newCatalog.id}:`, e)
    );

    console.log(`[CATALOG] New item saved to profile for ${user.username}: ${newCatalog.gemType}`);

    return res.status(201).json({
      success: true,
      message: `Katalog "${newCatalog.gemType}" berhasil disimpan ke profil Anda!`,
      catalog: newCatalog,
    });
  });

  // 13. Tombol "Jual": publish to Beranda & status 'dijual'
  // "Ketika user klik tombol jual maka otomatis akan masuk ke halaman beranda dan dapat dilihat oleh semua pengguna aplikasi ini, postingan terbaru yang dibuat oleh user manapun akan selalu berada paling atas dengan menampilkan username dan katalognya."
  app.put("/api/catalog/:id/sell", (req, res) => {
    const { id } = req.params;
    const { userId } = req.body;

    const catalog = catalogs.find((c) => c.id === id);
    if (!catalog) {
      return res.status(404).json({ success: false, message: "Katalog tidak ditemukan." });
    }

    if (catalog.userId !== userId) {
      return res.status(403).json({ success: false, message: "Bukan pemilik katalog ini." });
    }

    catalog.status = "dijual";
    catalog.isPublished = true;
    const now = Date.now();
    catalog.publishedAt = now;
    catalog.bumpedAt = now; // terbaru selalu paling atas

    console.log(`[CATALOG] Item published for SALE to Beranda: ${catalog.gemType}`);
    saveDatabase();
    saveCatalogToTurso(catalog).catch((e) =>
      console.warn(`[Turso DB] Failed saving catalog ${catalog.id}:`, e)
    );

    return res.json({
      success: true,
      message: `Katalog "${catalog.gemType}" sekarang aktif DIJUAL dan tampil paling atas di Beranda!`,
      catalog,
    });
  });

  // 14. Tombol "Sundul": naikan postingan katalog paling atas
  // "Ketika user klik tombol sundul maka sistem akan menaikan postingan katalog tersebut paling atas."
  app.put("/api/catalog/:id/bump", (req, res) => {
    const { id } = req.params;
    const { userId } = req.body;

    const catalog = catalogs.find((c) => c.id === id);
    if (!catalog) {
      return res.status(404).json({ success: false, message: "Katalog tidak ditemukan." });
    }

    if (catalog.userId !== userId) {
      return res.status(403).json({ success: false, message: "Bukan pemilik katalog ini." });
    }

    if (!catalog.isPublished) {
      catalog.isPublished = true;
      catalog.status = "dijual";
    }

    // Set bumpedAt to highest current time
    catalog.bumpedAt = Date.now();

    console.log(`[CATALOG] Item BUMPED to top of Beranda: ${catalog.gemType}`);
    saveDatabase();
    saveCatalogToTurso(catalog).catch((e) =>
      console.warn(`[Turso DB] Failed saving bumped catalog ${catalog.id}:`, e)
    );

    return res.json({
      success: true,
      message: `Sukses disundul! Katalog "${catalog.gemType}" sekarang berada di urutan paling atas Beranda.`,
      catalog,
    });
  });

  // 15. Tombol "Terjual / Laku"
  // "Ketika user klik tombol terjual maka otomatis 1 Minggu setelah postingan itu terjual akan terhapus oleh database."
  app.put("/api/catalog/:id/sold", (req, res) => {
    const { id } = req.params;
    const { userId } = req.body;

    const catalog = catalogs.find((c) => c.id === id);
    if (!catalog) {
      return res.status(404).json({ success: false, message: "Katalog tidak ditemukan." });
    }

    if (catalog.userId !== userId) {
      return res.status(403).json({ success: false, message: "Bukan pemilik katalog ini." });
    }

    const now = Date.now();
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;

    catalog.status = "terjual";
    catalog.soldAt = now;
    catalog.autoDeleteAt = now + oneWeekMs; // 1 minggu ke depan

    console.log(`[CATALOG] Item marked SOLD: ${catalog.gemType}, scheduled deletion in 1 week.`);
    saveDatabase();
    saveCatalogToTurso(catalog).catch((e) =>
      console.warn(`[Turso DB] Failed saving sold catalog ${catalog.id}:`, e)
    );

    return res.json({
      success: true,
      message: `Selamat! Batu mulia "${catalog.gemType}" berstatus TERJUAL / LAKU. Otomatis akan terhapus dari sistem dalam 1 minggu.`,
      catalog,
      autoDeleteAt: catalog.autoDeleteAt,
    });
  });

  // 16. Comment on Catalog
  // "Setiap user bisa mengomentari katalog tersebut."
  app.post("/api/catalog/:id/comment", (req, res) => {
    const { id } = req.params;
    const {
      authorId,
      authorName,
      authorAvatar,
      content,
      replyToId,
      replyToAuthorId,
      replyToAuthorName,
    } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: "Komentar tidak boleh kosong." });
    }

    const catalog = catalogs.find((c) => c.id === id);
    if (!catalog) {
      return res.status(404).json({ success: false, message: "Katalog tidak ditemukan." });
    }

    const newComment: Comment = {
      id: `comm-${Date.now()}`,
      authorId: authorId || "user-unknown",
      authorName: authorName || "Pengguna",
      authorAvatar:
        authorAvatar ||
        "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=250&q=80",
      content: content.trim(),
      createdAt: "Baru saja",
      replyToId: replyToId || undefined,
      replyToAuthorId: replyToAuthorId || undefined,
      replyToAuthorName: replyToAuthorName || undefined,
    };

    catalog.comments.push(newComment);
    saveDatabase();
    saveCatalogToTurso(catalog).catch((e) =>
      console.warn(`[Turso DB] Failed saving commented catalog ${catalog.id}:`, e)
    );

    // 1. Notifikasi jika membalas komentar orang lain
    if (replyToAuthorId && replyToAuthorId !== authorId) {
      addAppNotification({
        recipientId: replyToAuthorId,
        actorId: authorId,
        actorName: authorName || "Pengguna",
        actorAvatar: authorAvatar,
        type: "comment_reply",
        title: "Balasan Komentar",
        message: `${authorName || "Seseorang"} membalas komentar Anda di batu "${catalog.gemType}": "${content.trim().slice(0, 65)}"`,
        catalogId: catalog.id,
        gemType: catalog.gemType,
        catalogImage: catalog.images?.[0] || "",
        commentId: newComment.id,
      }).catch((e) => console.warn("Failed sending reply notif:", e));
    }

    // 2. Notifikasi komentar baru ke pemilik katalog
    if (catalog.userId !== authorId && catalog.userId !== replyToAuthorId) {
      addAppNotification({
        recipientId: catalog.userId,
        actorId: authorId,
        actorName: authorName || "Pengguna",
        actorAvatar: authorAvatar,
        type: "comment",
        title: "Komentar Baru",
        message: `${authorName || "Seseorang"} mengomentari batu permata Anda "${catalog.gemType}": "${content.trim().slice(0, 65)}"`,
        catalogId: catalog.id,
        gemType: catalog.gemType,
        catalogImage: catalog.images?.[0] || "",
        commentId: newComment.id,
      }).catch((e) => console.warn("Failed sending comment notif:", e));
    }

    return res.status(201).json({
      success: true,
      comment: newComment,
      totalComments: catalog.comments.length,
    });
  });

  // 17. Like Catalog
  app.post("/api/catalog/:id/like", (req, res) => {
    const { id } = req.params;
    const { userId } = req.body;

    const catalog = catalogs.find((c) => c.id === id);
    if (!catalog) {
      return res.status(404).json({ success: false, message: "Katalog tidak ditemukan." });
    }

    catalog.likes = catalog.likes || [];
    const hasLiked = catalog.likes.includes(userId);

    if (hasLiked) {
      catalog.likes = catalog.likes.filter((uid) => uid !== userId);
    } else {
      catalog.likes.push(userId);
    }
    saveDatabase();
    saveCatalogToTurso(catalog).catch((e) =>
      console.warn(`[Turso DB] Failed saving liked catalog ${catalog.id}:`, e)
    );

    return res.json({
      success: true,
      hasLiked: !hasLiked,
      likesCount: catalog.likes.length,
    });
  });

  // 18. Negosiasi / Tawar Harga Privat pada Postingan
  // "Buatkan fitur negosiasi pada bagian postingan user namun hanya calon pembeli tersebut dan penjual yang dapat melihat, calon pembeli lain tidak dapat melihat yang orang lain tawar. Namun di kolom komentar tetap tertulis bahwa user tersebut telah melakukan penawaran."
  app.post("/api/catalog/:id/offer", (req, res) => {
    const { id } = req.params;
    const { buyerId, buyerName, buyerAvatar, buyerPhone, offerPrice, note } = req.body;

    if (!buyerId || !offerPrice || !String(offerPrice).trim()) {
      return res.status(400).json({
        success: false,
        message: "Nominal penawaran harga wajib diisi.",
      });
    }

    const catalog = catalogs.find((c) => c.id === id);
    if (!catalog) {
      return res.status(404).json({ success: false, message: "Katalog tidak ditemukan." });
    }

    if (catalog.userId === buyerId) {
      return res.status(400).json({
        success: false,
        message: "Anda tidak dapat menawar katalog barang milik Anda sendiri.",
      });
    }

    if (catalog.status === "terjual") {
      return res.status(400).json({
        success: false,
        message: "Katalog ini sudah berstatus terjual.",
      });
    }

    catalog.offers = catalog.offers || [];
    const existingIndex = catalog.offers.findIndex((o) => o.buyerId === buyerId);
    const offerId = existingIndex !== -1 ? catalog.offers[existingIndex].id : `off-${Date.now()}`;

    const newOffer: NegotiationOffer = {
      id: offerId,
      catalogId: catalog.id,
      buyerId,
      buyerName: buyerName || "Calon Pembeli",
      buyerAvatar:
        buyerAvatar ||
        "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=250&q=80",
      buyerPhone: buyerPhone || "",
      sellerId: catalog.userId,
      offerPrice: String(offerPrice).trim(),
      note: note ? String(note).trim() : "",
      status: "pending",
      createdAt: "Baru saja",
      updatedAt: Date.now(),
    };

    if (existingIndex !== -1) {
      catalog.offers[existingIndex] = newOffer;
    } else {
      catalog.offers.push(newOffer);
    }

    // Catat ke kolom komentar agar selalu tercatat bahwa user tersebut telah menawar:
    // "Namun di kolom komentar tetap tertulis bahwa user tersebut telah melakukan penawaran."
    const offerComment: Comment = {
      id: `comm-offer-${Date.now()}`,
      authorId: buyerId,
      authorName: buyerName || "Calon Pembeli",
      authorAvatar:
        buyerAvatar ||
        "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=250&q=80",
      content: note && String(note).trim() ? String(note).trim() : "Telah melakukan penawaran harga.",
      createdAt: "Baru saja",
      isOffer: true,
      offerId,
      offerPrice: String(offerPrice).trim(),
      offerStatus: "pending",
    };

    catalog.comments.push(offerComment);
    saveDatabase();
    saveCatalogToTurso(catalog).catch((e) =>
      console.warn(`[Turso DB] Failed saving offer catalog ${catalog.id}:`, e)
    );

    // Notifikasi penawaran baru ke penjual
    addAppNotification({
      recipientId: catalog.userId,
      actorId: buyerId,
      actorName: buyerName || "Calon Pembeli",
      actorAvatar: buyerAvatar,
      type: "offer",
      title: "Penawaran Harga Baru",
      message: `${buyerName || "Seseorang"} mengajukan penawaran harga sebesar ${offerPrice} untuk batu "${catalog.gemType}".`,
      catalogId: catalog.id,
      gemType: catalog.gemType,
      catalogImage: catalog.images?.[0] || "",
      offerId: newOffer.id,
    }).catch((e) => console.warn("Failed sending offer notif:", e));

    console.log(`[NEGO PRIVAT] ${buyerName} menawar ${catalog.gemType}: ${offerPrice}`);

    const sanitizedCatalog = sanitizeCatalogForViewer(catalog, buyerId);

    return res.status(201).json({
      success: true,
      message: `Penawaran harga berhasil diajukan! Hanya Anda dan penjual (${catalog.username}) yang dapat melihat nominal ini.`,
      offer: newOffer,
      catalog: sanitizedCatalog,
    });
  });

  // 19. Respons Penawaran oleh Penjual: Sepakat / Terima Tawaran Pembeli
  // "Penjual tidak boleh menolak penawaran namun mengajukan harga banding secara manual"
  app.put("/api/catalog/:id/offer/:offerId/respond", (req, res) => {
    const { id, offerId } = req.params;
    const { sellerId, status } = req.body;

    if (status !== "accepted") {
      return res.status(400).json({
        success: false,
        message: "Penjual tidak dapat menolak tawaran. Silakan gunakan fitur Ajukan Harga Banding jika harga belum sesuai.",
      });
    }

    const catalog = catalogs.find((c) => c.id === id);
    if (!catalog) {
      return res.status(404).json({ success: false, message: "Katalog tidak ditemukan." });
    }

    if (catalog.userId !== sellerId) {
      return res.status(403).json({
        success: false,
        message: "Hanya penjual pemilik katalog ini yang berhak merespons penawaran.",
      });
    }

    catalog.offers = catalog.offers || [];
    const offer = catalog.offers.find((o) => o.id === offerId);
    if (!offer) {
      return res.status(404).json({ success: false, message: "Penawaran tidak ditemukan." });
    }

    offer.status = "accepted";
    offer.acceptedPrice = offer.offerPrice;
    offer.updatedAt = Date.now();

    // Perbarui status di komentar penawaran
    catalog.comments.forEach((cm) => {
      if (cm.offerId === offerId) {
        cm.offerStatus = "accepted";
      }
    });

    // Tambahkan komentar konfirmasi respons dari penjual di postingan
    const sellerUser = users.find((u) => u.id === sellerId);
    const sellerName = sellerUser ? sellerUser.username : catalog.username;
    const sellerAvatar = sellerUser ? sellerUser.avatar : catalog.userAvatar;

    const feedbackComment: Comment = {
      id: `comm-resp-${Date.now()}`,
      authorId: sellerId,
      authorName: sellerName,
      authorAvatar: sellerAvatar,
      content: `Tawaran harga dari @${offer.buyerName} telah DISETUJUI oleh penjual! Silakan lanjutkan transaksi via WhatsApp.`,
      createdAt: "Baru saja",
      isOffer: true,
      offerId: offer.id,
      offerPrice: offer.offerPrice,
      offerStatus: "accepted",
    };

    catalog.comments.push(feedbackComment);
    saveDatabase();
    saveCatalogToTurso(catalog).catch((e) =>
      console.warn(`[Turso DB] Failed saving accepted offer catalog ${catalog.id}:`, e)
    );

    // Notifikasi persetujuan tawaran ke pembeli
    addAppNotification({
      recipientId: offer.buyerId,
      actorId: sellerId,
      actorName: sellerName || "Penjual",
      actorAvatar: sellerAvatar,
      type: "offer_accepted",
      title: "Penawaran Anda Disetujui!",
      message: `Selamat! Penjual telah menyetujui tawaran Anda sebesar ${offer.offerPrice} untuk batu "${catalog.gemType}".`,
      catalogId: catalog.id,
      gemType: catalog.gemType,
      catalogImage: catalog.images?.[0] || "",
      offerId: offer.id,
    }).catch((e) => console.warn("Failed sending accept notif:", e));

    const sanitizedCatalog = sanitizeCatalogForViewer(catalog, sellerId);

    return res.json({
      success: true,
      message: `Tawaran dari ${offer.buyerName} sebesar ${offer.offerPrice} berhasil DISETUJUI!`,
      offer,
      catalog: sanitizedCatalog,
    });
  });

  // 19b. Penjual Mengajukan Harga Banding Secara Manual
  // "contoh Budi menawar 700rb namun penjual belum sepakat dengan harga tersebut dan dapat mengajukan harga ke si Budi dengan harga yang penjual inginkan"
  app.post("/api/catalog/:id/offer/:offerId/counter", (req, res) => {
    const { id, offerId } = req.params;
    const { sellerId, counterPrice, counterNote } = req.body;

    if (!counterPrice || !String(counterPrice).trim()) {
      return res.status(400).json({
        success: false,
        message: "Nominal harga banding yang diajukan penjual wajib diisi.",
      });
    }

    const catalog = catalogs.find((c) => c.id === id);
    if (!catalog) {
      return res.status(404).json({ success: false, message: "Katalog tidak ditemukan." });
    }

    if (catalog.userId !== sellerId) {
      return res.status(403).json({
        success: false,
        message: "Hanya penjual pemilik katalog ini yang berhak mengajukan harga banding.",
      });
    }

    catalog.offers = catalog.offers || [];
    const offer = catalog.offers.find((o) => o.id === offerId);
    if (!offer) {
      return res.status(404).json({ success: false, message: "Penawaran tidak ditemukan." });
    }

    const trimmedCounterPrice = String(counterPrice).trim();
    const trimmedCounterNote = counterNote ? String(counterNote).trim() : "";

    offer.status = "countered";
    offer.counterPrice = trimmedCounterPrice;
    offer.counterNote = trimmedCounterNote;
    offer.counteredAt = "Baru saja";
    offer.updatedAt = Date.now();

    // Perbarui status di seluruh komentar penawaran terkait
    catalog.comments.forEach((cm) => {
      if (cm.offerId === offerId) {
        cm.offerStatus = "countered";
        cm.counterPrice = trimmedCounterPrice;
        cm.counterNote = trimmedCounterNote;
      }
    });

    // Tambahkan catatan komentar harga banding dari penjual
    const sellerUser = users.find((u) => u.id === sellerId);
    const sellerName = sellerUser ? sellerUser.username : catalog.username;
    const sellerAvatar = sellerUser ? sellerUser.avatar : catalog.userAvatar;

    const counterComment: Comment = {
      id: `comm-counter-${Date.now()}`,
      authorId: sellerId,
      authorName: sellerName,
      authorAvatar: sellerAvatar,
      content: trimmedCounterNote
        ? `Penjual mengajukan harga banding: "${trimmedCounterNote}"`
        : `Penjual mengajukan harga banding kepada @${offer.buyerName}.`,
      createdAt: "Baru saja",
      isOffer: true,
      offerId: offer.id,
      offerPrice: offer.offerPrice,
      counterPrice: trimmedCounterPrice,
      counterNote: trimmedCounterNote,
      offerStatus: "countered",
    };

    catalog.comments.push(counterComment);
    saveDatabase();
    saveCatalogToTurso(catalog).catch((e) =>
      console.warn(`[Turso DB] Failed saving counter offer catalog ${catalog.id}:`, e)
    );

    // Notifikasi harga banding ke calon pembeli
    addAppNotification({
      recipientId: offer.buyerId,
      actorId: sellerId,
      actorName: sellerName || "Penjual",
      actorAvatar: sellerAvatar,
      type: "counter_offer",
      title: "Pengajuan Harga Banding",
      message: `Penjual mengajukan harga banding ${trimmedCounterPrice} untuk batu "${catalog.gemType}".`,
      catalogId: catalog.id,
      gemType: catalog.gemType,
      catalogImage: catalog.images?.[0] || "",
      offerId: offer.id,
    }).catch((e) => console.warn("Failed sending counter notif:", e));

    console.log(
      `[HARGA BANDING] Penjual ${sellerName} mengajukan harga banding ${trimmedCounterPrice} ke ${offer.buyerName} (Tawaran awal: ${offer.offerPrice})`
    );

    const sanitizedCatalog = sanitizeCatalogForViewer(catalog, sellerId);

    return res.json({
      success: true,
      message: `Harga banding sebesar ${trimmedCounterPrice} berhasil diajukan ke @${offer.buyerName}! Hanya Anda dan calon pembeli tersebut yang dapat melihat nominal ini.`,
      offer,
      catalog: sanitizedCatalog,
    });
  });

  // 19c. Calon Pembeli Menyetujui / Menyepakati Harga Banding dari Penjual
  app.post("/api/catalog/:id/offer/:offerId/buyer-accept", (req, res) => {
    const { id, offerId } = req.params;
    const { buyerId } = req.body;

    const catalog = catalogs.find((c) => c.id === id);
    if (!catalog) {
      return res.status(404).json({ success: false, message: "Katalog tidak ditemukan." });
    }

    catalog.offers = catalog.offers || [];
    const offer = catalog.offers.find((o) => o.id === offerId);
    if (!offer) {
      return res.status(404).json({ success: false, message: "Penawaran tidak ditemukan." });
    }

    if (offer.buyerId !== buyerId) {
      return res.status(403).json({
        success: false,
        message: "Hanya calon pembeli yang bersangkutan yang dapat menyepakati harga banding ini.",
      });
    }

    const finalPrice = offer.counterPrice || offer.offerPrice;
    offer.status = "accepted";
    offer.acceptedPrice = finalPrice;
    offer.updatedAt = Date.now();

    catalog.comments.forEach((cm) => {
      if (cm.offerId === offerId) {
        cm.offerStatus = "accepted";
      }
    });

    const acceptComment: Comment = {
      id: `comm-buyer-acc-${Date.now()}`,
      authorId: buyerId,
      authorName: offer.buyerName,
      authorAvatar: offer.buyerAvatar,
      content: `Sepakat! @${offer.buyerName} menyetujui harga banding ${finalPrice}. Silakan lanjutkan transaksi via WhatsApp.`,
      createdAt: "Baru saja",
      isOffer: true,
      offerId: offer.id,
      offerPrice: offer.offerPrice,
      counterPrice: offer.counterPrice,
      offerStatus: "accepted",
    };

    catalog.comments.push(acceptComment);
    saveDatabase();
    saveCatalogToTurso(catalog).catch((e) =>
      console.warn(`[Turso DB] Failed saving buyer-accept catalog ${catalog.id}:`, e)
    );

    // Notifikasi kesepakatan harga banding ke penjual
    addAppNotification({
      recipientId: catalog.userId,
      actorId: buyerId,
      actorName: offer.buyerName,
      actorAvatar: offer.buyerAvatar,
      type: "offer_accepted",
      title: "Harga Banding Disepakati!",
      message: `${offer.buyerName} menyetujui harga banding ${finalPrice} untuk batu "${catalog.gemType}". Silakan lanjutkan transaksi!`,
      catalogId: catalog.id,
      gemType: catalog.gemType,
      catalogImage: catalog.images?.[0] || "",
      offerId: offer.id,
    }).catch((e) => console.warn("Failed sending buyer-accept notif:", e));

    const sanitizedCatalog = sanitizeCatalogForViewer(catalog, buyerId);

    return res.json({
      success: true,
      message: `Selamat! Anda telah menyepakati harga banding sebesar ${finalPrice}. Silakan hubungi penjual via WhatsApp untuk transaksi.`,
      offer,
      catalog: sanitizedCatalog,
    });
  });

  // 20. Hapus Akun Permanen dari Database (Turso Database & File)
  // "Pada halaman pengaturan buat tombol hapus akun ketika sudah disetujui maka akun tersebut terhapus permanen dari database"
  app.delete("/api/user/delete-account", async (req, res) => {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: "ID pengguna diperlukan." });
    }

    const userIndex = users.findIndex((u) => u.id === userId);
    const userFromDb = await getUserById(userId);

    if (userIndex === -1 && !userFromDb) {
      return res.status(404).json({ success: false, message: "Akun tidak ditemukan atau sudah dihapus sebelumnya." });
    }

    const usernameToDelete = userIndex !== -1 ? users[userIndex].username : userFromDb?.username || "Pengguna";

    // 1. Hapus dari Database Turso
    try {
      await deleteUserAndData(userId);
      console.log(`[Turso DB] Akun ${usernameToDelete} (${userId}) berhasil dihapus permanen dari Turso.`);
    } catch (dbErr) {
      console.error("[Turso DB] Warning hapus akun dari Turso:", dbErr);
    }

    // 2. Hapus pengguna dari in-memory / JSON database
    if (userIndex !== -1) {
      users.splice(userIndex, 1);
    }

    // 3. Hapus seluruh katalog milik pengguna ini
    let deletedCatalogCount = 0;
    for (let i = catalogs.length - 1; i >= 0; i--) {
      if (catalogs[i].userId === userId) {
        catalogs.splice(i, 1);
        deletedCatalogCount++;
      }
    }

    // 4. Bersihkan followers & following dari pengguna lain
    users.forEach((u) => {
      u.followers = (u.followers || []).filter((id) => id !== userId);
      u.following = (u.following || []).filter((id) => id !== userId);
    });

    // 5. Bersihkan likes dan komentar milik pengguna ini pada semua katalog tersisa
    catalogs.forEach((c) => {
      c.likes = (c.likes || []).filter((id) => id !== userId);
      c.comments = (c.comments || []).filter((cm) => cm.authorId !== userId);
    });

    // 6. Simpan perubahan secara permanen ke file database
    saveDatabase();

    console.log(
      `[DELETE ACCOUNT PERMANENT] Akun "${usernameToDelete}" (${userId}) dan ${deletedCatalogCount} katalog miliknya telah dihapus permanen dari database.`
    );

    return res.json({
      success: true,
      message: `Akun "${usernameToDelete}" beserta seluruh katalog dan datanya telah berhasil dihapus secara permanen dari database.`,
      deletedUsername: usernameToDelete,
    });
  });

  // 19. Hapus Katalog Spesifik
  app.delete("/api/catalog/:id", (req, res) => {
    const { id } = req.params;
    const { userId } = req.body;

    const catalogIndex = catalogs.findIndex((c) => c.id === id);
    if (catalogIndex === -1) {
      return res.status(404).json({ success: false, message: "Katalog tidak ditemukan." });
    }

    const item = catalogs[catalogIndex];
    if (item.userId !== userId) {
      return res.status(403).json({ success: false, message: "Hanya pemilik yang dapat menghapus katalog ini." });
    }

    catalogs.splice(catalogIndex, 1);
    saveDatabase();
    deleteCatalogFromTurso(id).catch((e) =>
      console.warn(`[Turso DB] Failed deleting catalog ${id}:`, e)
    );

    return res.json({
      success: true,
      message: `Katalog "${item.gemType}" berhasil dihapus.`,
    });
  });

  // ==========================================
  // API ROOM TRANSAKSI AMAN (FACE ID & GPS AKURAT)
  // "Jika calon pembeli srius membeli atas kesepakatan harga dari negosiasi
  // buatkan tombol cekout dan otomatis akan membuatkan room antar penjual dan pembelinya
  // namun dengan syarat keduanya wajib mengaktifkan face id dan GPS akurat baru room itu terbentuk.
  // Jika salah satu tidak mengaktifkan maka salah satu antara penjual ataupun pembeli tidak bisa masuk ke room itu.
  // Dan tampilkan notifikasi saat sebelum mengaktifkan FACE ID yang jelas dan GPS yang akurat
  // dengan tulisan DEMI KEAMANAN TRANSAKSI MAKA KEDUA BELAH PIHAK WAJIB MENGENALI WAJAH DAN LOKASI YANG JELAS.
  // dan di room terbesbut mereka bisa saling berkomntar seperti kolom chatt.
  // Room tersebut akan otomatis terhapus 1 Minggu stelah tidak aktif komunikasinya antara penjual dan pembeli tersebut"
  // ==========================================

  // 1. Ambil Semua Room Transaksi Pengguna
  app.get("/api/rooms/user/:userId", (req, res) => {
    cleanupExpiredRooms();
    const { userId } = req.params;
    const userRooms = transactionRooms.filter(
      (r) => r.seller.userId === userId || r.buyer.userId === userId
    );
    return res.json({ success: true, rooms: userRooms });
  });

  // 2. Buat atau Dapatkan Room Transaksi atas Kesepakatan Harga (Tombol Cekout)
  app.post("/api/rooms/create-or-get", (req, res) => {
    cleanupExpiredRooms();
    const { catalogId, offerId, buyerId } = req.body;

    if (!catalogId || !offerId) {
      return res.status(400).json({
        success: false,
        message: "ID Katalog dan ID Penawaran diperlukan.",
      });
    }

    const catalog = catalogs.find((c) => c.id === catalogId);
    if (!catalog) {
      return res.status(404).json({
        success: false,
        message: "Katalog permata tidak ditemukan.",
      });
    }

    catalog.offers = catalog.offers || [];
    const offer = catalog.offers.find((o) => o.id === offerId);
    if (!offer) {
      return res.status(404).json({
        success: false,
        message: "Penawaran tidak ditemukan.",
      });
    }

    if (offer.status !== "accepted") {
      return res.status(400).json({
        success: false,
        message:
          "Cekout dan pembuatan room hanya dapat dilakukan jika harga penawaran sudah disepakati oleh kedua belah pihak.",
      });
    }

    // Cek apakah room untuk transaksi ini sudah pernah dibuat sebelumnya
    const existingRoom = transactionRooms.find(
      (r) => r.catalogId === catalogId && r.offerId === offerId
    );

    if (existingRoom) {
      return res.json({
        success: true,
        room: existingRoom,
        isNew: false,
        message: "Room transaksi aktif dimuat.",
      });
    }

    // Buat Room Transaksi Baru
    const sellerUser = users.find((u) => u.id === catalog.userId);
    const finalBuyerId = buyerId || offer.buyerId;
    const buyerUser = users.find((u) => u.id === finalBuyerId);
    const agreedPrice = offer.acceptedPrice || offer.counterPrice || offer.offerPrice;

    const newRoom: TransactionRoom = {
      id: `room-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      catalogId: catalog.id,
      offerId: offer.id,
      gemType: catalog.gemType,
      dimensions: catalog.dimensions,
      gemImage: catalog.images && catalog.images.length > 0 ? catalog.images[0] : "",
      videoUrl: catalog.videoUrl,
      agreedPrice,
      seller: {
        userId: catalog.userId,
        username: sellerUser ? sellerUser.username : catalog.username,
        userAvatar: sellerUser ? sellerUser.avatar : catalog.userAvatar,
        userPhone: sellerUser ? sellerUser.phone : undefined,
        isFullyVerified: false,
      },
      buyer: {
        userId: finalBuyerId,
        username: buyerUser ? buyerUser.username : offer.buyerName,
        userAvatar: buyerUser ? buyerUser.avatar : offer.buyerAvatar,
        userPhone: buyerUser ? buyerUser.phone : offer.buyerPhone,
        isFullyVerified: false,
      },
      status: "pending_verification",
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
      expiresAt: Date.now() + SEVEN_DAYS_MS,
      messages: [
        {
          id: `msg-system-${Date.now()}`,
          senderId: "system",
          senderName: "Sistem Keamanan Komunitas",
          senderAvatar: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=150&q=80",
          content: `Room Transaksi Resmi dibuat atas kesepakatan harga ${agreedPrice}. DEMI KEAMANAN TRANSAKSI MAKA KEDUA BELAH PIHAK WAJIB MENGENALI WAJAH DAN LOKASI YANG JELAS dengan mengaktifkan Face ID dan GPS akurat sebelum dapat saling mengobrol di room ini.`,
          createdAt: "Baru saja",
          timestamp: Date.now(),
        },
      ],
    };

    transactionRooms.unshift(newRoom);
    saveDatabase();
    saveTransactionRoomToTurso(newRoom).catch((e) =>
      console.warn(`[Turso DB] Failed saving room ${newRoom.id}:`, e)
    );

    console.log(
      `[ROOM CEKOUT] Room transaksi baru ${newRoom.id} dibuat untuk ${newRoom.gemType} (Penjual: ${newRoom.seller.username}, Pembeli: ${newRoom.buyer.username}, Harga: ${agreedPrice})`
    );

    return res.json({
      success: true,
      room: newRoom,
      isNew: true,
      message: "Room transaksi berhasil dibuat. Silakan selesaikan verifikasi Face ID & GPS akurat.",
    });
  });

  // 3. Detail Room Transaksi
  app.get("/api/rooms/:roomId", (req, res) => {
    cleanupExpiredRooms();
    const { roomId } = req.params;
    const { userId } = req.query;

    const room = transactionRooms.find((r) => r.id === roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message:
          "Room transaksi tidak ditemukan atau telah otomatis terhapus karena tidak aktif komunikasinya lebih dari 1 minggu.",
      });
    }

    // Pastikan hanya penjual atau pembeli yang dapat mengakses room ini
    if (userId && room.seller.userId !== userId && room.buyer.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: "Anda tidak memiliki hak akses ke room transaksi privat ini.",
      });
    }

    return res.json({ success: true, room });
  });

  // 4. Verifikasi Wajah (Face ID) & GPS Akurat oleh Penjual / Pembeli
  app.post("/api/rooms/:roomId/verify", async (req, res) => {
    cleanupExpiredRooms();
    const { roomId } = req.params;
    const { userId, facePhotoUrl, latitude, longitude, accuracyMeters, locationName } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: "ID Pengguna diperlukan." });
    }

    if (!facePhotoUrl || !String(facePhotoUrl).trim()) {
      return res.status(400).json({
        success: false,
        message: "Foto scan Face ID wajah yang jelas wajib diaktifkan demi keamanan transaksi.",
      });
    }

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        success: false,
        message: "Akses lokasi GPS yang akurat wajib diaktifkan demi keamanan transaksi.",
      });
    }

    const room = transactionRooms.find((r) => r.id === roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room transaksi tidak ditemukan atau sudah kadaluarsa.",
      });
    }

    const isSeller = room.seller.userId === userId;
    const isBuyer = room.buyer.userId === userId;

    if (!isSeller && !isBuyer) {
      return res.status(403).json({
        success: false,
        message: "Hanya penjual atau pembeli bersangkutan yang dapat melakukan verifikasi.",
      });
    }

    const targetParty = isSeller ? room.seller : room.buyer;
    const now = Date.now();

    let finalFacePhotoUrl = String(facePhotoUrl).trim();
    if (finalFacePhotoUrl.startsWith("data:")) {
      try {
        const upRes = await uploadMediaPhoto(finalFacePhotoUrl, "face_id");
        if (upRes && upRes.url) {
          finalFacePhotoUrl = upRes.url;
        }
      } catch (uploadErr) {
        console.warn("[Cloudinary] Upload face id photo warning:", uploadErr);
      }
    }

    targetParty.faceId = {
      verified: true,
      facePhotoUrl: finalFacePhotoUrl,
      verifiedAt: now,
    };

    targetParty.gps = {
      verified: true,
      latitude: Number(latitude),
      longitude: Number(longitude),
      accuracyMeters: Number(accuracyMeters) || 10,
      locationName: String(locationName || "Lokasi Presisi Terverifikasi").trim(),
      verifiedAt: now,
    };

    targetParty.isFullyVerified = true;

    // Periksa apakah KEDUA BELAH PIHAK sudah selesai mengaktifkan Face ID & GPS
    const isBothVerified = room.seller.isFullyVerified && room.buyer.isFullyVerified;

    if (isBothVerified) {
      room.status = "active";
      room.messages.push({
        id: `msg-verified-${Date.now()}`,
        senderId: "system",
        senderName: "Sistem Keamanan Komunitas",
        senderAvatar: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=150&q=80",
        content: `🔒 KEDUA BELAH PIHAK LENGKAP TERVERIFIKASI! Penjual (@${room.seller.username}) dan Pembeli (@${room.buyer.username}) telah berhasil mengaktifkan Face ID yang jelas dan GPS yang akurat. Ruang obrolan transaksi resmi dibuka!`,
        createdAt: "Baru saja",
        timestamp: Date.now(),
      });
    }

    room.lastActivityAt = now;
    room.expiresAt = now + SEVEN_DAYS_MS;
    saveDatabase();
    saveTransactionRoomToTurso(room).catch((e) =>
      console.warn(`[Turso DB] Failed saving verified room ${room.id}:`, e)
    );

    console.log(
      `[VERIFIKASI BERHASIL] Pengguna ${targetParty.username} (${isSeller ? "Penjual" : "Pembeli"}) berhasil verifikasi Face ID & GPS di room ${room.id}. Keduanya aktif? ${isBothVerified}`
    );

    return res.json({
      success: true,
      message: isBothVerified
        ? "Selamat! Kedua belah pihak telah terverifikasi. Room obrolan transaksi sekarang dapat digunakan sepenuhnya."
        : "Verifikasi Face ID dan GPS Anda berhasil! Menunggu pihak lawan mengaktifkan verifikasi agar room obrolan terbuka.",
      room,
      isBothVerified,
    });
  });

  // 5. Kirim Pesan / Komentar di Dalam Room Transaksi
  app.post("/api/rooms/:roomId/messages", (req, res) => {
    cleanupExpiredRooms();
    const { roomId } = req.params;
    const { senderId, content } = req.body;

    if (!senderId || !content || !String(content).trim()) {
      return res.status(400).json({
        success: false,
        message: "Pengirim dan isi pesan tidak boleh kosong.",
      });
    }

    const room = transactionRooms.find((r) => r.id === roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room transaksi tidak ditemukan atau telah otomatis terhapus karena tidak aktif 1 minggu.",
      });
    }

    // SYARAT MUTLAK: Keduanya WAJIB mengaktifkan Face ID dan GPS akurat baru bisa saling berkomentar di room
    if (!room.seller.isFullyVerified || !room.buyer.isFullyVerified) {
      return res.status(403).json({
        success: false,
        message:
          "Pesan tidak dapat dikirim! Kedua belah pihak (penjual & pembeli) wajib mengaktifkan Face ID dan GPS akurat terlebih dahulu sebelum dapat saling berkomentar.",
      });
    }

    const isSeller = room.seller.userId === senderId;
    const isBuyer = room.buyer.userId === senderId;

    if (!isSeller && !isBuyer) {
      return res.status(403).json({
        success: false,
        message: "Hanya penjual dan pembeli yang berhak mengirim pesan di room ini.",
      });
    }

    const senderParty = isSeller ? room.seller : room.buyer;
    const now = Date.now();

    const newMsg: RoomChatMessage = {
      id: `msg-${now}-${Math.random().toString(36).slice(2, 6)}`,
      senderId,
      senderName: senderParty.username,
      senderAvatar: senderParty.userAvatar,
      content: String(content).trim(),
      createdAt: "Baru saja",
      timestamp: now,
    };

    room.messages.push(newMsg);
    // Reset masa aktif: otomatis terhapus 1 minggu setelah TIDAK AKTIF komunikasinya
    room.lastActivityAt = now;
    room.expiresAt = now + SEVEN_DAYS_MS;

    saveDatabase();
    saveTransactionRoomToTurso(room).catch((e) =>
      console.warn(`[Turso DB] Failed saving room chat ${room.id}:`, e)
    );

    return res.json({
      success: true,
      message: newMsg,
      room,
    });
  });

  // 24. Notifikasi Pengguna: Penawaran, Komentar & Balasan Komentar
  // "Dan buatkan notifikasi pada akun jika ada yang melakukan penawaran, komentar atau membalas komentar anda. Jika itu d klik langsung arahkan ke sasaran tersebut"
  app.get("/api/notifications/:userId", async (req, res) => {
    const { userId } = req.params;
    try {
      let userNotifs = notifications.filter((n) => n.recipientId === userId);
      // Jika di memori masih kosong, ambil dari Turso
      if (userNotifs.length === 0) {
        const fromTurso = await getNotificationsFromTurso(userId);
        if (fromTurso && fromTurso.length > 0) {
          userNotifs = fromTurso;
          fromTurso.forEach((fn) => {
            if (!notifications.some((n) => n.id === fn.id)) {
              notifications.push(fn);
            }
          });
        }
      }
      userNotifs.sort((a, b) => b.createdAt - a.createdAt);
      const unreadCount = userNotifs.filter((n) => !n.isRead).length;

      return res.json({
        success: true,
        notifications: userNotifs,
        unreadCount,
      });
    } catch (err: any) {
      console.error("Gagal mengambil notifikasi:", err);
      return res.status(500).json({ success: false, message: "Gagal mengambil notifikasi." });
    }
  });

  // Tandai 1 Notifikasi Dibaca
  app.post("/api/notifications/:id/read", (req, res) => {
    const { id } = req.params;
    const notif = notifications.find((n) => n.id === id);
    if (notif) {
      notif.isRead = true;
      saveDatabase();
    }
    markNotificationReadInTurso(id).catch((e) =>
      console.warn("[Turso DB] Error markNotificationReadInTurso:", e)
    );
    return res.json({ success: true });
  });

  // Tandai Semua Notifikasi Dibaca
  app.post("/api/notifications/:userId/read-all", (req, res) => {
    const { userId } = req.params;
    notifications.forEach((n) => {
      if (n.recipientId === userId) {
        n.isRead = true;
      }
    });
    saveDatabase();
    markAllNotificationsReadInTurso(userId).catch((e) =>
      console.warn("[Turso DB] Error markAllNotificationsReadInTurso:", e)
    );
    return res.json({ success: true });
  });

  // Vite Middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server Komunitas Batu Mulia running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Server start error:", err);
});
