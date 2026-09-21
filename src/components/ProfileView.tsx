import React, { useState, useEffect, useRef } from "react";
import {
  Gem,
  PlusCircle,
  Tag,
  ArrowUpCircle,
  CheckCircle,
  Clock,
  Sparkles,
  Ruler,
  UserPlus,
  UserCheck,
  ArrowLeft,
  Share2,
  Calendar,
  MessageCircle,
  AlertTriangle,
  Camera,
  Upload,
  FileText,
  Settings,
  Edit3,
  Maximize2,
  Banknote,
  Handshake,
  ShieldCheck,
  Play,
  Video,
  Film,
  Image as ImageIcon,
} from "lucide-react";
import { User, CatalogItem, NegotiationOffer } from "../types";
import { InputCatalogModal } from "./InputCatalogModal";
import { ProfileCropModal } from "./ProfileCropModal";
import { NegotiateModal } from "./NegotiateModal";
import { SellerOffersModal } from "./SellerOffersModal";
import { formatToRupiah } from "../utils/currencyUtils";
import { parseVideoUrl } from "../utils/videoUtils";
import { CatalogVideoPlayer } from "./CatalogVideoPlayer";

interface Props {
  currentUser: User;
  viewingUserId?: string; // If viewing another user's profile
  onBackToBeranda: () => void;
  onRefreshCurrentUser?: (updatedUser: User) => void;
  onOpenSettings?: () => void;
  onOpenFullscreen?: (data: {
    imageUrl: string;
    title: string;
    dimensions?: string;
    price?: string;
  }) => void;
  onOpenTransactionRoom?: (data: { catalogId?: string; offerId?: string; roomId?: string }) => void;
}

export const ProfileView: React.FC<Props> = ({
  currentUser,
  viewingUserId,
  onBackToBeranda,
  onRefreshCurrentUser,
  onOpenSettings,
  onOpenFullscreen,
  onOpenTransactionRoom,
}) => {
  const isOwnProfile = !viewingUserId || viewingUserId === currentUser.id;
  const targetUserId = viewingUserId || currentUser.id;

  const [profileUser, setProfileUser] = useState<User | null>(
    isOwnProfile ? currentUser : null
  );
  const [catalogs, setCatalogs] = useState<CatalogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInputModalOpen, setIsInputModalOpen] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [cropModalSrc, setCropModalSrc] = useState<string | null>(null);
  const [isCropOpen, setIsCropOpen] = useState(false);

  // State Fitur Negosiasi Privat
  const [negotiatingCatalog, setNegotiatingCatalog] = useState<CatalogItem | null>(null);
  const [viewingOffersCatalog, setViewingOffersCatalog] = useState<CatalogItem | null>(null);

  // Tab Media (Foto vs Video) per item
  const [activeMediaTabs, setActiveMediaTabs] = useState<Record<string, "photo" | "video">>({});
  const getActiveTab = (itemId: string) => activeMediaTabs[itemId] || "photo";
  const toggleMediaTab = (itemId: string, tab: "photo" | "video") => {
    setActiveMediaTabs((prev) => ({ ...prev, [itemId]: tab }));
  };

  const avatarFileInputRef = useRef<HTMLInputElement>(null);

  // Sync profileUser when currentUser is updated (e.g. from Settings modal)
  useEffect(() => {
    if (isOwnProfile) {
      setProfileUser(currentUser);
    }
  }, [currentUser, isOwnProfile]);

  // Fetch target user data & catalogs
  useEffect(() => {
    fetchProfileData();
  }, [targetUserId, currentUser.id]);

  const fetchProfileData = async () => {
    setIsLoading(true);
    try {
      // Fetch user profile info
      const userRes = await fetch(`/api/users/${targetUserId}`);
      const userData = await userRes.json();
      if (userData.success) {
        setProfileUser(userData.user);
      }

      // Fetch user's catalogs with privacy sanitization
      const catRes = await fetch(`/api/catalog/user/${targetUserId}?currentUserId=${encodeURIComponent(currentUser.id)}`);
      const catData = await catRes.json();
      if (catData.success) {
        setCatalogs(catData.catalogs);
      }
    } catch (err) {
      console.error("Gagal mengambil data profil:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Follow / Unfollow
  const handleToggleFollow = async () => {
    if (!profileUser || isOwnProfile) return;

    try {
      const res = await fetch(`/api/users/${profileUser.id}/follow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentUserId: currentUser.id }),
      });
      const data = await res.json();
      if (data.success) {
        setProfileUser((prev) => {
          if (!prev) return null;
          const isF = data.isFollowing;
          const newFollowers = isF
            ? [...prev.followers, currentUser.id]
            : prev.followers.filter((id) => id !== currentUser.id);
          return { ...prev, followers: newFollowers };
        });

        // Update current user following list in state
        const updatedFollowing = data.isFollowing
          ? [...(currentUser.following || []), profileUser.id]
          : (currentUser.following || []).filter((id) => id !== profileUser.id);

        if (onRefreshCurrentUser) {
          onRefreshCurrentUser({ ...currentUser, following: updatedFollowing });
        }

        setActionNotice(data.message);
        setTimeout(() => setActionNotice(null), 4000);
      }
    } catch (err) {
      console.error("Gagal mengubah status ikuti:", err);
    }
  };

  // Tombol Jual: Publish to Beranda
  // "Ketika user klik tombol jual maka otomatis akan masuk ke halaman beranda dan dapat dilihat oleh semua pengguna aplikasi ini, postingan terbaru yang dibuat oleh user manapun akan selalu berada paling atas dengan menampilkan username dan katalognya."
  const handleSell = async (catalogId: string) => {
    try {
      const res = await fetch(`/api/catalog/${catalogId}/sell`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUser.id }),
      });
      const data = await res.json();
      if (data.success) {
        setCatalogs((prev) =>
          prev.map((c) => (c.id === catalogId ? data.catalog : c))
        );
        setActionNotice(
          `Batu "${data.catalog.gemType}" berhasil diaktifkan untuk DIJUAL dan langsung tampil paling atas di Beranda!`
        );
        setTimeout(() => setActionNotice(null), 5000);
      }
    } catch (err) {
      console.error("Gagal mengaktifkan jual:", err);
    }
  };

  // Tombol Sundul: Naikkan postingan ke paling atas
  // "Ketika user klik tombol sundul maka sistem akan menaikan postingan katalog tersebut paling atas."
  const handleBump = async (catalogId: string) => {
    try {
      const res = await fetch(`/api/catalog/${catalogId}/bump`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUser.id }),
      });
      const data = await res.json();
      if (data.success) {
        setCatalogs((prev) =>
          prev.map((c) => (c.id === catalogId ? data.catalog : c))
        );
        setActionNotice(
          `Batu "${data.catalog.gemType}" berhasil DISUNDUL ke posisi paling atas Beranda!`
        );
        setTimeout(() => setActionNotice(null), 5000);
      }
    } catch (err) {
      console.error("Gagal menyundul:", err);
    }
  };

  // Tombol Terjual / Laku
  // "Ketika user klik tombol terjual maka otomatis 1 Minggu setelah postingan itu terjual akan terhapus oleh database."
  const handleSold = async (catalogId: string) => {
    try {
      const res = await fetch(`/api/catalog/${catalogId}/sold`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUser.id }),
      });
      const data = await res.json();
      if (data.success) {
        setCatalogs((prev) =>
          prev.map((c) => (c.id === catalogId ? data.catalog : c))
        );
        setActionNotice(
          `Status diubah menjadi TERJUAL / LAKU. Sistem akan menghapusnya otomatis dalam 1 minggu.`
        );
        setTimeout(() => setActionNotice(null), 5000);
      }
    } catch (err) {
      console.error("Gagal menandai terjual:", err);
    }
  };

  // Direct avatar upload: open interactive circle fit modal
  const handleDirectAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];

    if (!file.type.startsWith("image/")) {
      setActionNotice("Pilih berkas gambar yang valid (JPG, PNG, atau WebP).");
      setTimeout(() => setActionNotice(null), 4000);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setCropModalSrc(event.target?.result as string);
      setIsCropOpen(true);
    };
    reader.onerror = () => {
      setActionNotice("Gagal membaca berkas gambar dari perangkat.");
      setTimeout(() => setActionNotice(null), 4000);
    };
    reader.readAsDataURL(file);

    // Reset input value so same file can be re-selected if needed
    e.target.value = "";
  };

  // Called when user completes circle crop & smart 100KB compression
  const handleCropConfirm = async (compressedDataUrl: string, sizeKb: string) => {
    setIsUploadingAvatar(true);
    try {
      const res = await fetch("/api/user/update-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          avatar: compressedDataUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Gagal memperbarui foto profil.");
      }

      setProfileUser(data.user);
      if (onRefreshCurrentUser) {
        onRefreshCurrentUser(data.user);
      }
      setActionNotice(
        `Foto profil disesuaikan ke lingkaran & terkompresi otomatis: ${sizeKb} (Maks 100 KB)!`
      );
      setTimeout(() => setActionNotice(null), 5000);
    } catch (err: any) {
      setActionNotice(err.message || "Gagal mengunggah foto dari perangkat.");
      setTimeout(() => setActionNotice(null), 4000);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const isFollowingTarget =
    profileUser &&
    !isOwnProfile &&
    (profileUser.followers || []).includes(currentUser.id);

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6 w-full">
      {/* Notice Banner */}
      {actionNotice && (
        <div className="mb-6 bg-emerald-600 text-white text-xs sm:text-sm font-semibold p-3.5 rounded-xl shadow-lg flex items-center gap-2 animate-fade-in">
          <Sparkles className="w-4 h-4 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Profile Header Card */}
      {profileUser && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl mb-8 relative overflow-hidden backdrop-blur-md">
          <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6 relative z-10">
            {/* User Info */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 text-center sm:text-left">
              {/* Avatar with Media Device Upload Support */}
              <div className="relative group shrink-0">
                <img
                  src={profileUser.avatar}
                  alt={profileUser.username}
                  referrerPolicy="no-referrer"
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border-4 border-emerald-500/80 shadow-xl shadow-emerald-950/50"
                />
                {isOwnProfile && (
                  <>
                    <input
                      ref={avatarFileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleDirectAvatarUpload}
                    />
                    <button
                      id="btn-change-profile-photo"
                      type="button"
                      onClick={() => avatarFileInputRef.current?.click()}
                      disabled={isUploadingAvatar}
                      className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white text-[10px] font-bold transition-opacity cursor-pointer"
                      title="Klik untuk memilih foto dari media perangkat"
                    >
                      <Camera className="w-5 h-5 mb-0.5 text-emerald-400" />
                      <span>{isUploadingAvatar ? "Memproses..." : "Ganti Foto"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => avatarFileInputRef.current?.click()}
                      className="absolute bottom-0 right-0 sm:hidden bg-emerald-500 text-slate-950 p-1.5 rounded-full shadow-md border-2 border-slate-900 cursor-pointer"
                      title="Ganti Foto Profil"
                    >
                      <Camera className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>

              <div className="flex-1">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                    {profileUser.username}
                  </h2>
                  <span className="bg-emerald-500/20 text-emerald-300 text-xs px-2.5 py-0.5 rounded-full border border-emerald-500/30 font-semibold">
                    {profileUser.role}
                  </span>
                </div>

                <p className="text-xs text-slate-400 mt-1">
                  Bergabung sejak {profileUser.joinDate} • WhatsApp: {profileUser.phone}
                </p>

                {/* Bio Profil - Dilihat oleh pengunjung profile */}
                <div className="mt-3.5 pt-3 border-t border-slate-800/80 max-w-xl">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                      <FileText className="w-3.5 h-3.5" />
                      <span>Bio Profil</span>
                    </div>
                    {isOwnProfile && onOpenSettings && (
                      <button
                        id="btn-edit-bio-quick"
                        type="button"
                        onClick={onOpenSettings}
                        className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Edit Bio di Pengaturan</span>
                      </button>
                    )}
                  </div>

                  {profileUser.bio && profileUser.bio.trim() ? (
                    <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 leading-relaxed font-normal shadow-sm">
                      "{profileUser.bio}"
                    </div>
                  ) : isOwnProfile ? (
                    <button
                      id="btn-add-bio-prompt"
                      type="button"
                      onClick={onOpenSettings}
                      className="w-full text-left bg-slate-950/40 hover:bg-slate-950/70 border border-dashed border-slate-700/80 hover:border-emerald-500/50 rounded-xl p-3 text-xs text-emerald-300/90 transition-colors flex items-center gap-2 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>+ Tambahkan bio profil Anda di Pengaturan agar pengunjung mengenal spesialisasi batu mulia Anda</span>
                    </button>
                  ) : (
                    <p className="text-xs text-slate-500 italic bg-slate-950/40 border border-slate-800/60 rounded-xl p-3">
                      Pengguna ini belum menuliskan bio profil.
                    </p>
                  )}
                </div>

                {/* Followers and Following Counters */}
                <div className="flex items-center justify-center sm:justify-start gap-6 mt-4 pt-3 border-t border-slate-800/80">
                  <div>
                    <span className="text-lg font-black text-emerald-400 font-mono block">
                      {(profileUser.followers || []).length}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">Pengikut</span>
                  </div>
                  <div className="border-l border-slate-800 pl-6">
                    <span className="text-lg font-black text-teal-300 font-mono block">
                      {(profileUser.following || []).length}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">Mengikuti</span>
                  </div>
                  <div className="border-l border-slate-800 pl-6">
                    <span className="text-lg font-black text-amber-400 font-mono block">
                      {catalogs.length}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">Koleksi Batu</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Profile Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              {isOwnProfile ? (
                /* Tombol Profil Sendiri: Input Katalog & Pengaturan Profil */
                <div className="flex flex-wrap items-center gap-2">
                  {onOpenSettings && (
                    <button
                      id="btn-open-settings-profile"
                      type="button"
                      onClick={onOpenSettings}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs sm:text-sm px-3.5 py-2.5 rounded-xl transition-colors flex items-center gap-2 border border-slate-700 cursor-pointer shadow-sm"
                    >
                      <Settings className="w-4 h-4 text-emerald-400" />
                      <span>Edit Profil & Bio</span>
                    </button>
                  )}
                  <button
                    id="btn-input-catalog"
                    type="button"
                    onClick={() => setIsInputModalOpen(true)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl transition-colors flex items-center gap-2 shadow-lg shadow-emerald-950/40 cursor-pointer"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Input Katalog Baru</span>
                  </button>
                </div>
              ) : (
                /* Tombol Ikuti pada halaman profile orang lain */
                <div className="flex items-center gap-2">
                  <button
                    id="btn-follow-user"
                    type="button"
                    onClick={handleToggleFollow}
                    className={`font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-md ${
                      isFollowingTarget
                        ? "bg-slate-800 hover:bg-red-500/20 text-slate-300 hover:text-red-400 border border-slate-700 hover:border-red-500/40"
                        : "bg-emerald-600 hover:bg-emerald-500 text-slate-950 shadow-emerald-950/40"
                    }`}
                  >
                    {isFollowingTarget ? (
                      <>
                        <UserCheck className="w-4 h-4" />
                        <span>Mengikuti</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        <span>Ikuti Profil</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={onBackToBeranda}
                    className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-3.5 py-2.5 rounded-xl text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
                  >
                    Ke Beranda
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Catalog Grid Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Gem className="w-5 h-5 text-emerald-400" />
            <span>Katalog Koleksi {profileUser?.username}</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Daftar batu mulia lengkap dengan jenis, dimensi, dan nominal harga
          </p>
        </div>
      </div>

      {/* Catalog Cards Grid */}
      {isLoading ? (
        <div className="py-20 text-center text-slate-400 flex flex-col items-center gap-2">
          <div className="w-7 h-7 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs">Memuat katalog dari backend...</p>
        </div>
      ) : catalogs.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center">
          <Gem className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h4 className="text-sm font-bold text-white">Belum Ada Katalog Tersimpan</h4>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {isOwnProfile
              ? "Klik tombol 'Input Katalog Baru' di atas untuk menyimpan batu permata dengan jenis, dimensi, dan nominal harga."
              : "Kolektor ini belum menambahkan katalog batu mulia ke profilnya."}
          </p>
          {isOwnProfile && (
            <button
              type="button"
              onClick={() => setIsInputModalOpen(true)}
              className="mt-4 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs px-4 py-2 rounded-xl"
            >
              Input Katalog Sekarang
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {catalogs.map((item) => {
            const isSold = item.status === "terjual";
            const isForSale = item.status === "dijual";

            return (
              <div
                key={item.id}
                id={`catalog-item-${item.id}`}
                className={`bg-slate-900/90 border rounded-2xl overflow-hidden shadow-xl flex flex-col justify-between transition-all ${
                  isSold
                    ? "border-slate-800 opacity-80"
                    : isForSale
                    ? "border-emerald-600/50 hover:border-emerald-500"
                    : "border-slate-800 hover:border-slate-700"
                }`}
              >
                {/* Media Switcher Tab Header & Content */}
                <div>
                  <div>
                    {item.videoUrl && (
                      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-950 border-b border-slate-800 text-xs">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => toggleMediaTab(item.id, "photo")}
                          className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all cursor-pointer text-[11px] ${
                            getActiveTab(item.id) === "photo"
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                              : "text-slate-400 hover:text-white"
                          }`}
                        >
                          <ImageIcon className="w-3 h-3" />
                          <span>Foto</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleMediaTab(item.id, "video")}
                          className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all cursor-pointer text-[11px] ${
                            getActiveTab(item.id) === "video"
                              ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                              : "text-slate-300 hover:text-white bg-slate-900 border border-slate-800"
                          }`}
                        >
                          <Play className="w-3 h-3 fill-current text-rose-400" />
                          <span>Video Detail</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {getActiveTab(item.id) === "video" && item.videoUrl ? (
                    <div className="w-full bg-black p-2">
                      <CatalogVideoPlayer
                        videoUrl={item.videoUrl}
                        gemTitle={item.gemType}
                        compact={true}
                      />
                    </div>
                  ) : (
                    <div
                      onClick={() => {
                        if (onOpenFullscreen) {
                          onOpenFullscreen({
                            imageUrl: item.images[0],
                            title: item.gemType,
                            dimensions: item.dimensions,
                            price: formatToRupiah(item.price),
                          });
                        }
                      }}
                      className="relative h-48 w-full bg-black overflow-hidden cursor-pointer group select-none"
                      title="Klik foto batu untuk melihat tampilan penuh"
                    >
                      <img
                        src={item.images[0]}
                        alt={item.gemType}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />

                      {/* Fullscreen Overlay Hint */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-200 pointer-events-none">
                        <span className="bg-slate-900/90 text-white text-[11px] font-bold px-3 py-1.5 rounded-full border border-slate-700 shadow-xl flex items-center gap-1.5 backdrop-blur-md">
                          <Maximize2 className="w-3.5 h-3.5 text-emerald-400" />
                          Tampilan Penuh
                        </span>
                      </div>

                      {/* Status Pill on top of image */}
                      <div className="absolute top-3 left-3">
                        {isSold ? (
                          <span className="bg-red-950/90 text-red-300 text-xs font-bold px-2.5 py-1 rounded-lg border border-red-800 flex items-center gap-1 backdrop-blur-sm">
                            <CheckCircle className="w-3.5 h-3.5 text-red-400" />
                            Terjual / Laku
                          </span>
                        ) : isForSale ? (
                          <span className="bg-emerald-950/90 text-emerald-300 text-xs font-bold px-2.5 py-1 rounded-lg border border-emerald-700 flex items-center gap-1 backdrop-blur-sm">
                            <Tag className="w-3.5 h-3.5 text-emerald-400" />
                            Aktif Dijual di Beranda
                          </span>
                        ) : (
                          <span className="bg-slate-950/90 text-slate-300 text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-800 backdrop-blur-sm">
                            Koleksi Pribadi
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                  {/* Details Body: Jenis Batu, Dimensi, Nominal Harga */}
                  <div className="p-4 sm:p-5 space-y-3">
                    <div>
                      <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                        Jenis Batu Mulia
                      </span>
                      <h4 className="text-base font-bold text-white mt-0.5">{item.gemType}</h4>
                    </div>

                    <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 space-y-1.5 text-xs">
                      {/* Dimensi */}
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 flex items-center gap-1">
                          <Ruler className="w-3.5 h-3.5 text-teal-400" /> Dimensi:
                        </span>
                        <span className="font-mono text-slate-200 font-semibold">
                          {item.dimensions}
                        </span>
                      </div>

                      {/* Nominal Harga */}
                      <div className="flex items-center justify-between border-t border-slate-800/80 pt-1.5">
                        <span className="text-slate-400 flex items-center gap-1">
                          <Banknote className="w-3.5 h-3.5 text-emerald-400" /> Harga:
                        </span>
                        <span className="font-mono text-emerald-400 font-bold text-sm tracking-tight">
                          {formatToRupiah(item.price)}
                        </span>
                      </div>
                    </div>

                    {item.description && (
                      <p className="text-xs text-slate-300 leading-relaxed line-clamp-3">
                        {item.description}
                      </p>
                    )}

                    {/* Notice if sold and pending 1-week auto-deletion */}
                    {isSold && item.autoDeleteAt && (
                      <div className="bg-amber-950/40 border border-amber-800/50 p-2.5 rounded-xl text-[11px] text-amber-300 flex items-start gap-1.5">
                        <Clock className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
                        <span>
                          Postingan ini terjual dan akan dihapus otomatis dari database 1 minggu setelah transaksi.
                        </span>
                      </div>
                    )}

                    {/* Banner Penawaran Masuk (Jika ada tawaran pada item ini) */}
                    {isOwnProfile && !isSold && (item.offers || []).length > 0 && (
                      <div className="bg-amber-950/40 border border-amber-800/70 p-2.5 rounded-xl flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <Handshake className="w-3.5 h-3.5 text-amber-400" />
                          <span className="font-bold text-amber-300">
                            {(item.offers || []).length} Penawaran Masuk
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setViewingOffersCatalog(item)}
                          className="text-[11px] font-bold text-amber-300 hover:text-white bg-amber-900/60 px-2 py-0.5 rounded-lg border border-amber-700/60 cursor-pointer"
                        >
                          Lihat
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons: Jual, Sundul, Terjual (Hanya untuk pemilik katalog) */}
                {isOwnProfile && (
                  <div className="p-4 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between gap-2">
                    {/* 1. Tombol Jual */}
                    {!isForSale && !isSold && (
                      <button
                        id={`btn-sell-${item.id}`}
                        type="button"
                        onClick={() => handleSell(item.id)}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs py-2 px-2.5 rounded-xl transition-colors flex items-center justify-center gap-1 cursor-pointer"
                        title="Publish ke Beranda dan aktifkan penjualan"
                      >
                        <Tag className="w-3.5 h-3.5" />
                        <span>Jual ke Beranda</span>
                      </button>
                    )}

                    {/* 2. Tombol Sundul (Aktif jika sedang dijual) */}
                    {isForSale && !isSold && (
                      <button
                        id={`btn-bump-${item.id}`}
                        type="button"
                        onClick={() => handleBump(item.id)}
                        className="flex-1 bg-teal-600 hover:bg-teal-500 text-slate-950 font-bold text-xs py-2 px-2.5 rounded-xl transition-colors flex items-center justify-center gap-1 cursor-pointer"
                        title="Naikkan postingan katalog ini paling atas di Beranda"
                      >
                        <ArrowUpCircle className="w-3.5 h-3.5" />
                        <span>Sundul</span>
                      </button>
                    )}

                    {/* 3. Tombol Terjual / Laku */}
                    {!isSold && (
                      <button
                        id={`btn-sold-${item.id}`}
                        type="button"
                        onClick={() => handleSold(item.id)}
                        className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs py-2 px-2.5 rounded-xl transition-colors flex items-center justify-center gap-1 border border-slate-700 cursor-pointer"
                        title="Tandai terjual (akan dihapus otomatis dalam 1 minggu)"
                      >
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Terjual</span>
                      </button>
                    )}

                    {isSold && (
                      <span className="text-xs font-semibold text-slate-400 italic w-full text-center py-1">
                        ✓ Transaksi Selesai
                      </span>
                    )}
                  </div>
                )}

                {/* Action Buttons untuk Pengunjung Profil Lain */}
                {!isOwnProfile && isForSale && !isSold && (
                  <div className="p-3.5 bg-slate-950/90 border-t border-slate-800 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setNegotiatingCatalog(item)}
                      className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <Handshake className="w-3.5 h-3.5" />
                      <span>Tawar Harga</span>
                    </button>
                    <a
                      href={`https://wa.me/6281234567890?text=${encodeURIComponent(
                        `Halo ${profileUser?.username}, saya tertarik dengan batu mulia "${item.gemType}" (Harga: ${formatToRupiah(item.price)}) di Komunitas Batu Mulia.`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold py-2 px-3 rounded-xl transition-colors border border-slate-700"
                    >
                      Tanya WA
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Input Catalog Modal */}
      <InputCatalogModal
        userId={currentUser.id}
        isOpen={isInputModalOpen}
        onClose={() => setIsInputModalOpen(false)}
        onOpenFullscreen={onOpenFullscreen}
        onCatalogSaved={(newItem) => {
          setCatalogs((prev) => [newItem, ...prev]);
          setActionNotice(
            `Katalog "${newItem.gemType}" berhasil disimpan ke profil Anda! Klik tombol 'Jual' jika ingin menampilkannya di Beranda.`
          );
          setTimeout(() => setActionNotice(null), 5000);
        }}
      />

      {/* Profile Photo Interactive Circle Crop & Fit Modal */}
      <ProfileCropModal
        isOpen={isCropOpen}
        imageSrc={cropModalSrc}
        onClose={() => setIsCropOpen(false)}
        onConfirm={handleCropConfirm}
      />

      {/* Modal Negosiasi (Calon Pembeli) */}
      {negotiatingCatalog && (
        <NegotiateModal
          isOpen={!!negotiatingCatalog}
          onClose={() => setNegotiatingCatalog(null)}
          catalog={negotiatingCatalog}
          currentUser={currentUser}
          onOfferSuccess={(updatedCatalog) => {
            setCatalogs((prev) =>
              prev.map((c) => (c.id === updatedCatalog.id ? updatedCatalog : c))
            );
            setActionNotice("Penawaran Anda berhasil dikirim ke penjual secara privat.");
            setTimeout(() => setActionNotice(null), 5000);
          }}
          onCheckout={(catalogId, offerId) => {
            if (onOpenTransactionRoom) {
              onOpenTransactionRoom({ catalogId, offerId });
            }
          }}
        />
      )}

      {/* Modal Penawaran Masuk (Penjual) */}
      {viewingOffersCatalog && (
        <SellerOffersModal
          isOpen={!!viewingOffersCatalog}
          onClose={() => setViewingOffersCatalog(null)}
          catalog={viewingOffersCatalog}
          sellerId={currentUser.id}
          onRespondOffer={(updatedCatalog) => {
            setCatalogs((prev) =>
              prev.map((c) => (c.id === updatedCatalog.id ? updatedCatalog : c))
            );
            if (viewingOffersCatalog && viewingOffersCatalog.id === updatedCatalog.id) {
              setViewingOffersCatalog(updatedCatalog);
            }
          }}
          onOpenRoom={(catalogId, offerId) => {
            if (onOpenTransactionRoom) {
              onOpenTransactionRoom({ catalogId, offerId });
            }
          }}
        />
      )}
    </div>
  );
};
