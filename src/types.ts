export interface User {
  id: string;
  username: string;
  phone: string;
  role: string;
  avatar: string;
  bio?: string;
  followers: string[]; // array of userIds
  following: string[]; // array of userIds
  joinDate: string;
}

export interface NegotiationOffer {
  id: string;
  catalogId: string;
  buyerId: string;
  buyerName: string;
  buyerAvatar: string;
  buyerPhone?: string;
  sellerId: string;
  offerPrice: string; // Tawaran awal dari calon pembeli (misal "Rp 700.000")
  note?: string;
  status: "pending" | "countered" | "accepted"; // Penjual tidak boleh menolak, melainkan sepakat atau mengajukan harga banding
  counterPrice?: string; // Nominal harga banding yang diajukan penjual secara manual (misal "Rp 850.000")
  counterNote?: string; // Catatan dari penjual mengenai harga banding
  counteredAt?: string;
  acceptedPrice?: string; // Nominal yang akhirnya disepakati
  createdAt: string;
  updatedAt?: number;
}

export interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  content: string;
  createdAt: string;
  replyToId?: string;
  replyToAuthorId?: string;
  replyToAuthorName?: string;
  // Field khusus fitur negosiasi privat
  isOffer?: boolean;
  offerId?: string;
  offerPrice?: string; // Hanya ditampilkan ke calon pembeli yang menawar & penjual
  counterPrice?: string; // Harga banding dari penjual (privat, hanya buyer & seller)
  counterNote?: string;
  offerStatus?: "pending" | "countered" | "accepted";
}

export interface CatalogItem {
  id: string;
  userId: string;
  username: string;
  userAvatar: string;
  gemType: string;       // Jenis batu
  dimensions: string;    // Dimensi (misal: 18 x 14 x 7 mm)
  price: string;         // Nominal harga (misal: Rp 3.500.000)
  description?: string;  // Deskripsi tambahan
  videoUrl: string;      // URL video wajib (YouTube, TikTok, Instagram) yang dapat diputar langsung di aplikasi
  images: string[];
  status: "koleksi" | "dijual" | "terjual"; // status: koleksi pribadi, dijual (ke beranda), atau terjual/laku
  isPublished: boolean;
  publishedAt?: number;
  bumpedAt?: number;     // Waktu sundul (terbaru / sundulan selalu berada paling atas)
  soldAt?: number;       // Waktu terjual
  autoDeleteAt?: number; // 1 minggu setelah terjual akan otomatis terhapus
  comments: Comment[];
  likes: string[];       // array of userIds
  createdAt: string;
  offers?: NegotiationOffer[]; // Daftar penawaran harga privat
}

export interface FaceIdVerification {
  verified: boolean;
  facePhotoUrl: string; // Foto wajah jelas hasil scan kamera / face id
  verifiedAt: number;
}

export interface GpsVerification {
  verified: boolean;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  locationName: string; // Nama wilayah / kota hasil deteksi GPS akurat
  verifiedAt: number;
}

export interface PartyVerification {
  userId: string;
  username: string;
  userAvatar: string;
  userPhone?: string;
  faceId?: FaceIdVerification;
  gps?: GpsVerification;
  isFullyVerified: boolean; // Bernilai true HANYA jika Face ID DAN GPS Akurat keduanya sudah aktif
}

export interface RoomChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  content: string;
  createdAt: string;
  timestamp: number;
}

export interface TransactionRoom {
  id: string;
  catalogId: string;
  offerId: string;
  gemType: string;
  dimensions: string;
  gemImage: string;
  videoUrl?: string;
  agreedPrice: string; // Nominal harga atas kesepakatan negosiasi
  seller: PartyVerification;
  buyer: PartyVerification;
  status: "pending_verification" | "active" | "expired";
  createdAt: number;
  lastActivityAt: number; // Waktu komunikasi terakhir, otomatis reset tiap ada chat baru
  expiresAt: number;      // lastActivityAt + 7 hari (otomatis terhapus jika 1 minggu tidak aktif)
  messages: RoomChatMessage[];
}

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
  actorAvatar: string;
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

export interface LiveStreamComment {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  message: string;
  timestamp: number;
}

export interface LivePinnedProduct {
  id?: string;
  title: string;
  price: string;
  dimensions?: string;
  photoUrl?: string;
  description?: string;
}

export interface LiveStreamSummary {
  id: string;
  hostId: string;
  hostName: string;
  hostAvatar: string;
  title: string;
  pinnedProduct?: LivePinnedProduct | null;
  startedAt: number;
  viewerCount: number;
}

