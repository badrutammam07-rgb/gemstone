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

export interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  content: string;
  createdAt: string;
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
}
