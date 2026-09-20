import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

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

interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  content: string;
  createdAt: string;
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

function loadDatabase(): { users: User[]; catalogs: CatalogItem[] } {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      return {
        users: Array.isArray(parsed.users) ? parsed.users : [],
        catalogs: Array.isArray(parsed.catalogs) ? parsed.catalogs : [],
      };
    }
  } catch (err) {
    console.error("Gagal membaca database.json:", err);
  }
  return { users: [], catalogs: [] };
}

const initialDb = loadDatabase();
// Seluruh akun dummy dihapus sehingga semua pendaftaran adalah akun real
const users: User[] = initialDb.users;
const catalogs: CatalogItem[] = initialDb.catalogs;

function saveDatabase() {
  try {
    fs.writeFileSync(
      DB_FILE,
      JSON.stringify({ users, catalogs }, null, 2),
      "utf-8"
    );
  } catch (err) {
    console.error("Gagal menyimpan database.json:", err);
  }
}

// Pastikan file database tersinkronisasi
saveDatabase();

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

// Auto-cleanup items 1 week after marked as sold (terjual)
function cleanupExpiredSoldCatalogs() {
  const now = Date.now();
  let changed = false;
  for (let i = catalogs.length - 1; i >= 0; i--) {
    const item = catalogs[i];
    if (item.status === "terjual" && item.autoDeleteAt && now >= item.autoDeleteAt) {
      console.log(`[CLEANUP] Otomatis menghapus katalog terjual setelah 1 minggu: ${item.gemType} (${item.id})`);
      catalogs.splice(i, 1);
      changed = true;
    }
  }
  if (changed) {
    saveDatabase();
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  // Run cleanup every 10 minutes
  setInterval(cleanupExpiredSoldCatalogs, 10 * 60 * 1000);

  // Health
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", app: "Komunitas Batu Mulia API" });
  });

  // 1. Register (Langsung menggunakan No HP tanpa OTP)
  app.post("/api/auth/register", (req, res) => {
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
    const existsUsername = users.find(
      (u) => u.username.toLowerCase() === cleanUsername.toLowerCase()
    );
    if (existsUsername) {
      return res.status(400).json({
        success: false,
        message: `Username "${cleanUsername}" sudah digunakan. Silakan pilih username lain.`,
      });
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

    const newUser: User = {
      id: `user-${Date.now()}`,
      username: cleanUsername,
      phone: cleanRawPhone,
      password: password,
      role: "Anggota Komunitas Batu Mulia",
      avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=250&q=80",
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
      message: `Akun berhasil didaftarkan! Selamat bergabung di Komunitas Batu Mulia.`,
      user: safeUser,
    });
  });

  // 4. Login
  app.post("/api/auth/login", (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: "Username dan password wajib diisi." });
    }

    const trimmed = username.trim();
    const user = users.find(
      (u) =>
        u.username.toLowerCase() === trimmed.toLowerCase() ||
        u.phone === trimmed ||
        normalizePhone(u.phone) === normalizePhone(trimmed)
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: `Akun "${trimmed}" tidak ditemukan.`,
      });
    }

    if (user.password !== password) {
      return res.status(401).json({
        success: false,
        message: "Password yang Anda masukkan salah.",
      });
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

    return res.json({
      success: true,
      message: `Selamat datang, ${user.username}!`,
      user: safeUser,
    });
  });

  // 5. Reset Password (Cukup dengan No HP terdaftar tanpa OTP)
  app.post("/api/auth/forgot-password/reset", (req, res) => {
    const { phone, newPassword, confirmPassword } = req.body;

    if (!phone || !newPassword || !confirmPassword) {
      return res.status(400).json({ success: false, message: "Mohon lengkapi No HP dan kata sandi baru." });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: "Konfirmasi kata sandi tidak cocok." });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "Password baru minimal 6 karakter." });
    }

    const cleanRawPhone = phone.trim();
    const user = users.find(
      (u) => normalizePhone(u.phone) === normalizePhone(cleanRawPhone) || u.phone === cleanRawPhone
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: `Akun dengan Nomor HP "${cleanRawPhone}" tidak ditemukan di sistem.`,
      });
    }

    user.password = newPassword;
    saveDatabase();

    return res.json({
      success: true,
      message: "Kata sandi berhasil diperbarui! Silakan masuk dengan kata sandi baru.",
      username: user.username,
    });
  });

  // 6. User Profile Update via Settings (Gear logo - langsung update tanpa OTP)
  app.put("/api/user/update-profile", (req, res) => {
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
    if (avatar) user.avatar = avatar;
    if (bio !== undefined) user.bio = bio;

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
      message: "Profil dan data akun Anda berhasil diperbarui!",
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

    const published = catalogs.filter((c) => c.isPublished);

    // Sort by bumpedAt or publishedAt descending (highest timestamp = top)
    published.sort((a, b) => {
      const timeA = a.bumpedAt || a.publishedAt || 0;
      const timeB = b.bumpedAt || b.publishedAt || 0;
      return timeB - timeA;
    });

    return res.json({ success: true, catalogs: published });
  });

  // 11. Get Catalogs of a Specific User (for Profile page)
  app.get("/api/catalog/user/:userId", (req, res) => {
    const { userId } = req.params;
    cleanupExpiredSoldCatalogs();

    const userCatalogs = catalogs.filter((c) => c.userId === userId);
    return res.json({ success: true, catalogs: userCatalogs });
  });

  // 12. Create New Catalog (Input Katalog di Profile)
  // "setiap katalog berisi gambar dan deskripsi yang berisi (jenis batu, dimensi, dan nominal harga)dan untuk membuat katalog ada tombol input katalog, jika sudah menekan tombol save maka masuk ke halaman profile user"
  app.post("/api/catalog", (req, res) => {
    const { userId, gemType, dimensions, price, description, images } = req.body;

    if (!userId || !gemType || !dimensions || !price) {
      return res.status(400).json({
        success: false,
        message: "Jenis batu, dimensi, dan nominal harga wajib diisi.",
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
    const finalImages =
      images && images.length > 0
        ? images
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
      images: finalImages,
      status: "koleksi", // default masuk koleksi profile dulu
      isPublished: false,
      comments: [],
      likes: [],
      createdAt: "Hari ini",
    };

    catalogs.unshift(newCatalog);
    saveDatabase();

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
    const { authorId, authorName, authorAvatar, content } = req.body;

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
      authorAvatar: authorAvatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=250&q=80",
      content: content.trim(),
      createdAt: "Baru saja",
    };

    catalog.comments.push(newComment);
    saveDatabase();

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

    return res.json({
      success: true,
      hasLiked: !hasLiked,
      likesCount: catalog.likes.length,
    });
  });

  // 18. Hapus Akun Permanen dari Database
  // "Pada halaman pengaturan buat tombol hapus akun ketika sudah disetujui maka akun tersebut terhapus permanen dari database"
  app.delete("/api/user/delete-account", (req, res) => {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: "ID pengguna diperlukan." });
    }

    const userIndex = users.findIndex((u) => u.id === userId);
    if (userIndex === -1) {
      return res.status(404).json({ success: false, message: "Akun tidak ditemukan atau sudah dihapus sebelumnya." });
    }

    const deletedUser = users[userIndex];

    // 1. Hapus pengguna dari database
    users.splice(userIndex, 1);

    // 2. Hapus seluruh katalog milik pengguna ini
    let deletedCatalogCount = 0;
    for (let i = catalogs.length - 1; i >= 0; i--) {
      if (catalogs[i].userId === userId) {
        catalogs.splice(i, 1);
        deletedCatalogCount++;
      }
    }

    // 3. Bersihkan followers & following dari pengguna lain
    users.forEach((u) => {
      u.followers = (u.followers || []).filter((id) => id !== userId);
      u.following = (u.following || []).filter((id) => id !== userId);
    });

    // 4. Bersihkan likes dan komentar milik pengguna ini pada semua katalog tersisa
    catalogs.forEach((c) => {
      c.likes = (c.likes || []).filter((id) => id !== userId);
      c.comments = (c.comments || []).filter((cm) => cm.authorId !== userId);
    });

    // 5. Simpan perubahan secara permanen ke file database
    saveDatabase();

    console.log(
      `[DELETE ACCOUNT PERMANENT] Akun "${deletedUser.username}" (${userId}) dan ${deletedCatalogCount} katalog miliknya telah dihapus permanen dari database.`
    );

    return res.json({
      success: true,
      message: `Akun "${deletedUser.username}" beserta seluruh katalog dan datanya telah berhasil dihapus secara permanen dari database.`,
      deletedUsername: deletedUser.username,
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

    return res.json({
      success: true,
      message: `Katalog "${item.gemType}" berhasil dihapus.`,
    });
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
