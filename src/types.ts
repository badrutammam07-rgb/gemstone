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
