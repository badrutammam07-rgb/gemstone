import React, { useState, useEffect } from "react";
import {
  Gem,
  ArrowUpCircle,
  MessageCircle,
  Heart,
  ExternalLink,
  Clock,
  Ruler,
  Banknote,
  Send,
  Tag,
  CheckCircle,
  Sparkles,
  RefreshCw,
  Maximize2,
  Handshake,
  Lock,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  ArrowLeftRight,
  Play,
  Video,
  Film,
  Image as ImageIcon,
} from "lucide-react";
import { User, CatalogItem, NegotiationOffer } from "../types";
import { formatToRupiah } from "../utils/currencyUtils";
import { parseVideoUrl } from "../utils/videoUtils";
import { CatalogVideoPlayer } from "./CatalogVideoPlayer";
import { NegotiateModal } from "./NegotiateModal";
import { SellerOffersModal } from "./SellerOffersModal";

interface Props {
  currentUser: User;
  onSelectUser: (userId: string) => void;
  onNavigateToProfile: () => void;
  onOpenFullscreen?: (data: {
    imageUrl: string;
    title: string;
    dimensions?: string;
    price?: string;
    sellerName?: string;
  }) => void;
}

export const DashboardBeranda: React.FC<Props> = ({
  currentUser,
  onSelectUser,
  onNavigateToProfile,
  onOpenFullscreen,
}) => {
  const [catalogs, setCatalogs] = useState<CatalogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [activeCommentsPostId, setActiveCommentsPostId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // State Fitur Negosiasi Privat
  const [negotiatingCatalog, setNegotiatingCatalog] = useState<CatalogItem | null>(null);
  const [viewingOffersCatalog, setViewingOffersCatalog] = useState<CatalogItem | null>(null);

  // Tab Media (Foto vs Video Detail) per kartu katalog
  const [activeMediaTabs, setActiveMediaTabs] = useState<Record<string, "photo" | "video">>({});

  const getActiveTab = (itemId: string) => activeMediaTabs[itemId] || "photo";
  const toggleMediaTab = (itemId: string, tab: "photo" | "video") => {
    setActiveMediaTabs((prev) => ({ ...prev, [itemId]: tab }));
  };

  useEffect(() => {
    fetchFeed();
  }, [currentUser.id]);

  const fetchFeed = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/catalog/feed?currentUserId=${encodeURIComponent(currentUser.id)}`);
      const data = await res.json();
      if (data.success) {
        setCatalogs(data.catalogs);
      }
    } catch (err) {
      console.error("Gagal mengambil feed beranda:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Sundul from Beranda if user owns the post
  const handleBump = async (catalogId: string, gemType: string) => {
    try {
      const res = await fetch(`/api/catalog/${catalogId}/bump`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUser.id }),
      });
      const data = await res.json();
      if (data.success) {
        setNotice(`Katalog "${gemType}" berhasil disundul ke urutan teratas Beranda!`);
        fetchFeed();
        setTimeout(() => setNotice(null), 4000);
      }
    } catch (err) {
      console.error("Gagal menyundul:", err);
    }
  };

  // Like
  const handleLike = async (catalogId: string) => {
    try {
      const res = await fetch(`/api/catalog/${catalogId}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUser.id }),
      });
      const data = await res.json();
      if (data.success) {
        setCatalogs((prev) =>
          prev.map((c) => {
            if (c.id === catalogId) {
              const newLikes = data.hasLiked
                ? [...c.likes, currentUser.id]
                : c.likes.filter((id) => id !== currentUser.id);
              return { ...c, likes: newLikes };
            }
            return c;
          })
        );
      }
    } catch (err) {
      console.error("Gagal like:", err);
    }
  };

  // Add Comment
  const handleAddComment = async (catalogId: string) => {
    const text = commentInputs[catalogId]?.trim();
    if (!text) return;

    try {
      const res = await fetch(`/api/catalog/${catalogId}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorId: currentUser.id,
          authorName: currentUser.username,
          authorAvatar: currentUser.avatar,
          content: text,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setCatalogs((prev) =>
          prev.map((c) => {
            if (c.id === catalogId) {
              return { ...c, comments: [...c.comments, data.comment] };
            }
            return c;
          })
        );
        setCommentInputs((prev) => ({ ...prev, [catalogId]: "" }));
      }
    } catch (err) {
      console.error("Gagal menambah komentar:", err);
    }
  };

  const handleOfferSuccess = (updatedCatalog: CatalogItem, newOffer: NegotiationOffer) => {
    setCatalogs((prev) =>
      prev.map((c) => (c.id === updatedCatalog.id ? updatedCatalog : c))
    );
    setNotice(`Penawaran Anda (${newOffer.offerPrice}) berhasil diajukan ke penjual secara privat.`);
    setTimeout(() => setNotice(null), 5000);
  };

  const handleRespondOffer = (updatedCatalog: CatalogItem) => {
    setCatalogs((prev) =>
      prev.map((c) => (c.id === updatedCatalog.id ? updatedCatalog : c))
    );
    if (viewingOffersCatalog && viewingOffersCatalog.id === updatedCatalog.id) {
      setViewingOffersCatalog(updatedCatalog);
    }
  };

  const handleBuyerAcceptCounter = async (catalogId: string, offerId: string) => {
    try {
      const res = await fetch(`/api/catalog/${catalogId}/offer/${offerId}/buyer-accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buyerId: currentUser.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Gagal menyepakati harga banding.");
      }
      setCatalogs((prev) =>
        prev.map((c) => (c.id === data.catalog.id ? data.catalog : c))
      );
      setNotice(data.message);
      setTimeout(() => setNotice(null), 5000);
    } catch (err: any) {
      setNotice(err.message || "Terjadi kesalahan saat menyepakati harga banding.");
      setTimeout(() => setNotice(null), 5000);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 lg:px-6 py-6 w-full">
      {/* Notice Banner */}
      {notice && (
        <div className="mb-6 bg-emerald-600 text-white text-xs sm:text-sm font-semibold p-3.5 rounded-xl shadow-lg flex items-center gap-2 animate-fade-in">
          <Sparkles className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Dashboard Beranda Subtitle & Info */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <span>Dashboard Beranda Komunitas</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Semua katalog batu mulia yang terpublish dari profil anggota • Postingan terbaru & sundulan selalu di posisi paling atas
          </p>
        </div>

        <button
          type="button"
          onClick={fetchFeed}
          className="text-slate-400 hover:text-emerald-400 p-2 rounded-xl bg-slate-900 border border-slate-800 transition-colors"
          title="Segarkan Beranda"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Feed List */}
      {isLoading ? (
        <div className="py-24 text-center text-slate-400 flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs">Memuat katalog beranda komunitas...</p>
        </div>
      ) : catalogs.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-12 text-center">
          <Gem className="w-14 h-14 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white">Belum Ada Katalog Dipublish</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            Buka halaman profil Anda dan klik tombol <strong>"Jual"</strong> pada salah satu katalog untuk menampilkannya di Dashboard Beranda ini!
          </p>
          <button
            type="button"
            onClick={onNavigateToProfile}
            className="mt-4 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs px-4 py-2.5 rounded-xl cursor-pointer"
          >
            Buka Profil & Input Katalog
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {catalogs.map((item, index) => {
            const hasLiked = item.likes?.includes(currentUser.id);
            const isCommentsOpen = activeCommentsPostId === item.id;
            const isOwner = item.userId === currentUser.id;
            const isSold = item.status === "terjual";

            return (
              <article
                key={item.id}
                id={`beranda-card-${item.id}`}
                className="bg-slate-900/90 border border-slate-800 hover:border-slate-700/80 rounded-3xl overflow-hidden shadow-2xl transition-all"
              >
                {/* Header Postingan: Username & Avatar Pemilik */}
                <div className="p-4 sm:p-5 flex items-center justify-between border-b border-slate-800/80 bg-slate-900/50">
                  <div
                    onClick={() => onSelectUser(item.userId)}
                    className="flex items-center gap-3 cursor-pointer group"
                    title={`Klik untuk melihat profil ${item.username}`}
                  >
                    <img
                      src={item.userAvatar}
                      alt={item.username}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-full object-cover border-2 border-emerald-500/50 group-hover:border-emerald-400 transition-colors"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white group-hover:text-emerald-300 transition-colors">
                          {item.username}
                        </span>
                        {isOwner && (
                          <span className="bg-emerald-500/20 text-emerald-400 text-[10px] px-2 py-0.5 rounded-full font-bold border border-emerald-500/30">
                            Anda
                          </span>
                        )}
                        {index === 0 && (
                          <span className="bg-amber-500/20 text-amber-300 text-[10px] px-2 py-0.5 rounded-full font-bold border border-amber-500/30 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> Paling Atas
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>
                          {item.bumpedAt
                            ? "Disundul / Diperbarui"
                            : item.createdAt || "Baru saja"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div>
                    {isSold ? (
                      <span className="bg-red-950 text-red-300 text-xs font-bold px-3 py-1 rounded-xl border border-red-800 flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5 text-red-400" />
                        Terjual
                      </span>
                    ) : (
                      <span className="bg-emerald-950 text-emerald-300 text-xs font-bold px-3 py-1 rounded-xl border border-emerald-800 flex items-center gap-1">
                        <Tag className="w-3.5 h-3.5 text-emerald-400" />
                        Dijual
                      </span>
                    )}
                  </div>
                </div>

                {/* Media Switcher Tab Header: Foto Permata vs Video Detail */}
                <div className="flex items-center justify-between px-3.5 py-2 bg-slate-950 border-y border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleMediaTab(item.id, "photo")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        getActiveTab(item.id) === "photo"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                          : "text-slate-400 hover:text-white hover:bg-slate-900"
                      }`}
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>Foto Permata</span>
                    </button>

                    {item.videoUrl ? (() => {
                      const parsed = parseVideoUrl(item.videoUrl);
                      return (
                        <button
                          type="button"
                          onClick={() => toggleMediaTab(item.id, "video")}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                            getActiveTab(item.id) === "video"
                              ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm"
                              : "text-slate-300 hover:text-white bg-slate-900/80 border border-slate-800"
                          }`}
                        >
                          <Play className="w-3 h-3 fill-current text-rose-400" />
                          <span>Video Detail</span>
                          <span className="text-[10px] opacity-75 hidden sm:inline">
                            ({parsed.platformName})
                          </span>
                        </button>
                      );
                    })() : null}
                  </div>

                  {item.videoUrl && getActiveTab(item.id) === "photo" && (
                    <button
                      type="button"
                      onClick={() => toggleMediaTab(item.id, "video")}
                      className="text-[11px] text-rose-400 hover:text-rose-300 font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Film className="w-3.5 h-3.5" />
                      <span>Putar Video Detail</span>
                    </button>
                  )}
                </div>

                {/* Media Body: Video Player Langsung vs Foto Fullscreen */}
                {getActiveTab(item.id) === "video" && item.videoUrl ? (
                  <div className="w-full bg-black p-2 sm:p-3">
                    <CatalogVideoPlayer
                      videoUrl={item.videoUrl}
                      gemTitle={item.gemType}
                    />
                  </div>
                ) : (
                  <div>
                    {item.images && item.images.length > 0 && (
                      <div
                        onClick={() => {
                          if (onOpenFullscreen) {
                            onOpenFullscreen({
                              imageUrl: item.images[0],
                              title: item.gemType,
                              dimensions: item.dimensions,
                              price: formatToRupiah(item.price),
                              sellerName: item.username,
                            });
                          }
                        }}
                        className="relative bg-black w-full overflow-hidden max-h-[440px] cursor-pointer group select-none"
                        title="Klik untuk melihat foto batu dalam tampilan penuh"
                      >
                        <img
                          src={item.images[0]}
                          alt={item.gemType}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover max-h-[440px] group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-200 pointer-events-none">
                          <span className="bg-slate-900/90 text-white text-xs font-bold px-3.5 py-1.5 rounded-full border border-slate-700 shadow-xl flex items-center gap-1.5 backdrop-blur-md">
                            <Maximize2 className="w-4 h-4 text-emerald-400" />
                            Buka Tampilan Penuh
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Banner Ajakan Menonton Video Detail Batu */}
                    {item.videoUrl && (
                      <div className="px-3.5 py-2.5 bg-slate-950 border-t border-slate-800/80 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="p-1.5 bg-rose-500/15 text-rose-400 rounded-lg shrink-0">
                            <Play className="w-4 h-4 fill-rose-400" />
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-white block truncate">
                              Video Detail Kilau & Giwang Tersedia
                            </span>
                            <span className="text-[10px] text-slate-400 block truncate">
                              Periksa detail batu 360° sebelum membeli
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleMediaTab(item.id, "video")}
                          className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs px-3 py-1.5 rounded-xl transition-colors shadow-sm flex items-center gap-1 shrink-0 cursor-pointer"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>Tonton Video</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Deskripsi Katalog: Jenis Batu, Dimensi, Nominal Harga */}
                <div className="p-4 sm:p-6 space-y-3">
                  <div>
                    <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                      Spesifikasi Katalog
                    </span>
                    <h3 className="text-lg sm:text-xl font-extrabold text-white mt-0.5">
                      {item.gemType}
                    </h3>
                  </div>

                  {/* Grid Box: Dimensi & Nominal Harga */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
                    <div className="flex items-center gap-2 text-xs">
                      <div className="p-2 bg-teal-500/10 rounded-xl text-teal-400">
                        <Ruler className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Dimensi Batu:</span>
                        <span className="text-white font-mono font-bold">{item.dimensions}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs border-t sm:border-t-0 sm:border-l border-slate-800 pt-2 sm:pt-0 sm:pl-3">
                      <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400">
                        <Banknote className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Nominal Harga:</span>
                        <span className="text-emerald-400 font-mono font-black text-sm tracking-tight">
                          {formatToRupiah(item.price)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Banner Penawaran Masuk untuk Penjual */}
                  {!isSold && isOwner && (item.offers || []).length > 0 && (
                    <div className="bg-amber-950/30 border border-amber-800/60 p-3 rounded-2xl flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-amber-500/10 rounded-xl text-amber-400 shrink-0">
                          <Handshake className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-amber-300 font-bold text-xs block">
                            {(item.offers || []).length} Penawaran Masuk dari Calon Pembeli
                          </span>
                          <p className="text-[10px] text-slate-400">
                            Privat: Hanya Anda dan masing-masing penawar yang dapat melihat nominal.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setViewingOffersCatalog(item)}
                        className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs px-3 py-1.5 rounded-xl transition-colors shadow-sm shrink-0 cursor-pointer"
                      >
                        Lihat Tawaran
                      </button>
                    </div>
                  )}

                  {/* Banner Status Penawaran Pembeli Aktif */}
                  {!isOwner && !isSold && (() => {
                    const myOffer = (item.offers || []).find((o) => o.buyerId === currentUser.id);
                    if (!myOffer) return null;
                    if (myOffer.status === "countered" && myOffer.counterPrice) {
                      return (
                        <div className="bg-sky-950/70 border border-sky-600/80 p-3 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 shadow-md">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 text-sky-300 font-bold text-xs sm:text-sm">
                              <ArrowLeftRight className="w-4 h-4 text-sky-400 shrink-0" />
                              <span>Penjual Mengajukan Harga Banding:</span>
                              <span className="font-mono font-black text-white bg-sky-900/80 px-2 py-0.5 rounded-lg border border-sky-700">
                                {myOffer.counterPrice}
                              </span>
                            </div>
                            {myOffer.counterNote && (
                              <p className="text-slate-300 italic text-xs">"{myOffer.counterNote}"</p>
                            )}
                            <p className="text-[10px] text-slate-400">
                              Tawaran awal Anda: <span className="line-through font-mono text-slate-400">{myOffer.offerPrice}</span> • Hanya Anda dan penjual yang tahu
                            </p>
                          </div>
                          <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
                            <button
                              type="button"
                              onClick={() => handleBuyerAcceptCounter(item.id, myOffer.id)}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl transition-colors shadow-sm flex items-center gap-1 cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Sepakati</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setNegotiatingCatalog(item)}
                              className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs px-3 py-1.5 rounded-xl border border-slate-700 transition-colors cursor-pointer"
                            >
                              Tawar Balik
                            </button>
                          </div>
                        </div>
                      );
                    }
                    if (myOffer.status === "accepted") {
                      return (
                        <div className="bg-emerald-950/60 border border-emerald-700/80 p-2.5 rounded-2xl flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5 text-emerald-300 font-semibold">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span>Tawaran Disepakati ({myOffer.acceptedPrice || myOffer.offerPrice})! Silakan hubungi penjual via WhatsApp.</span>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div className="bg-amber-950/40 border border-amber-800/60 p-2.5 rounded-2xl flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 text-amber-300">
                          <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>Tawaran Anda: <strong className="font-mono text-amber-200">{myOffer.offerPrice}</strong> (Menunggu respons penjual)</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setNegotiatingCatalog(item)}
                          className="text-[11px] font-bold text-amber-300 hover:text-white bg-amber-900/60 px-2 py-0.5 rounded-lg border border-amber-700/60 cursor-pointer"
                        >
                          Ubah
                        </button>
                      </div>
                    );
                  })()}

                  {/* Additional description */}
                  {item.description && (
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-line pt-1">
                      {item.description}
                    </p>
                  )}
                </div>

                {/* Action Bar: Like, Komentar, Tawar Harga, Sundul, Tanya WhatsApp */}
                <div className="px-4 sm:px-6 py-3.5 bg-slate-950/70 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-4">
                    {/* Suka */}
                    <button
                      type="button"
                      onClick={() => handleLike(item.id)}
                      className={`flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-colors ${
                        hasLiked ? "text-red-400" : "text-slate-400 hover:text-white"
                      }`}
                    >
                      <Heart
                        className={`w-4 h-4 ${hasLiked ? "fill-red-400 text-red-400" : ""}`}
                      />
                      <span>{(item.likes || []).length} Suka</span>
                    </button>

                    {/* Komentar */}
                    <button
                      type="button"
                      onClick={() =>
                        setActiveCommentsPostId(isCommentsOpen ? null : item.id)
                      }
                      className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>{(item.comments || []).length} Komentar</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Tombol Negosiasi / Tawar Harga untuk Calon Pembeli */}
                    {!isSold && !isOwner && (() => {
                      const myOffer = item.offers?.find((o) => o.buyerId === currentUser.id);
                      return (
                        <button
                          type="button"
                          onClick={() => setNegotiatingCatalog(item)}
                          className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 shadow-sm shadow-emerald-950/40 cursor-pointer"
                          title="Ajukan penawaran harga secara privat ke penjual"
                        >
                          <Handshake className="w-3.5 h-3.5" />
                          <span>{myOffer ? "Tawar Ulang" : "Tawar Harga"}</span>
                        </button>
                      );
                    })()}

                    {/* Tombol Daftar Tawaran untuk Penjual */}
                    {!isSold && isOwner && (item.offers || []).length > 0 && (
                      <button
                        type="button"
                        onClick={() => setViewingOffersCatalog(item)}
                        className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                        title="Lihat seluruh daftar penawaran dari calon pembeli"
                      >
                        <Handshake className="w-3.5 h-3.5" />
                        <span>Tawaran ({(item.offers || []).length})</span>
                      </button>
                    )}

                    {/* Tombol Sundul (jika postingan milik current user) */}
                    {isOwner && !isSold && (
                      <button
                        type="button"
                        onClick={() => handleBump(item.id, item.gemType)}
                        className="bg-teal-600 hover:bg-teal-500 text-slate-950 font-bold text-xs px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1 shadow-sm cursor-pointer"
                        title="Naikkan postingan ini ke urutan paling atas Beranda"
                      >
                        <ArrowUpCircle className="w-3.5 h-3.5" />
                        <span>Sundul</span>
                      </button>
                    )}

                    {/* Direct WhatsApp Contact */}
                    {!isSold && (
                      <a
                        href={`https://wa.me/6281234567890?text=${encodeURIComponent(
                          `Halo ${item.username}, saya tertarik dengan batu mulia "${item.gemType}" (Dimensi: ${item.dimensions}, Harga: ${formatToRupiah(item.price)}) di Komunitas Batu Mulia.`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1 border border-slate-700"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Tanya WA</span>
                      </a>
                    )}
                  </div>
                </div>

                {/* Section Komentar Interaktif */}
                {isCommentsOpen && (
                  <div className="p-4 sm:p-6 bg-slate-950 border-t border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-300">
                        Diskusi & Komentar Katalog ({(item.comments || []).length})
                      </h4>
                      {!isOwner && !isSold && (
                        <button
                          type="button"
                          onClick={() => setNegotiatingCatalog(item)}
                          className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                        >
                          <Handshake className="w-3 h-3" />
                          <span>Ajukan Penawaran Harga</span>
                        </button>
                      )}
                    </div>

                    {/* Daftar Komentar */}
                    <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                      {(item.comments || []).length === 0 ? (
                        <p className="text-xs text-slate-500 italic">
                          Belum ada komentar untuk katalog ini. Tulis pertanyaan atau apresiasi pertama Anda!
                        </p>
                      ) : (
                        item.comments.map((comm) => {
                          const isOfferComment = comm.isOffer;
                          const isMyOffer = comm.authorId === currentUser.id;
                          const isSellerOfPost = item.userId === currentUser.id;
                          const canSeeOfferAmount = isMyOffer || isSellerOfPost;

                          // Komentar Penawaran Harga
                          if (isOfferComment) {
                            return (
                              <div
                                key={comm.id}
                                className="flex items-start gap-2.5 text-xs bg-slate-900/95 p-3 rounded-xl border border-emerald-900/60 shadow-sm"
                              >
                                <img
                                  src={comm.authorAvatar}
                                  alt={comm.authorName}
                                  referrerPolicy="no-referrer"
                                  className="w-7 h-7 rounded-full object-cover mt-0.5 border border-emerald-500/50 shrink-0"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-bold text-emerald-300">
                                        {isMyOffer ? "Anda (Penawar)" : comm.authorName}
                                      </span>
                                      {comm.offerStatus === "accepted" ? (
                                        <span className="bg-emerald-900/60 text-emerald-300 border border-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                                          <CheckCircle2 className="w-3 h-3" /> Disetujui
                                        </span>
                                      ) : comm.offerStatus === "countered" ? (
                                        <span className="bg-sky-900/60 text-sky-300 border border-sky-700 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                                          <ArrowLeftRight className="w-3 h-3" /> Harga Banding
                                        </span>
                                      ) : (
                                        <span className="bg-amber-900/60 text-amber-300 border border-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                                          <Clock className="w-3 h-3" /> Penawaran Diajukan
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[10px] text-slate-500 shrink-0">
                                      {comm.createdAt}
                                    </span>
                                  </div>

                                  {/* Konten Penawaran: Privat Sesuai Hak Akses */}
                                  {canSeeOfferAmount ? (
                                    <div className="mt-1.5 space-y-1.5">
                                      <p className="text-slate-200">
                                        {isMyOffer
                                          ? "Anda telah mengajukan penawaran harga awal sebesar "
                                          : "Telah mengajukan penawaran harga awal sebesar "}
                                        <strong className="text-emerald-400 font-mono text-xs sm:text-sm font-bold bg-emerald-950/70 px-2 py-0.5 rounded-md border border-emerald-800/80">
                                          {comm.offerPrice}
                                        </strong>
                                      </p>

                                      {/* Tampilkan Harga Banding jika Penjual Mengajukan */}
                                      {comm.counterPrice && (
                                        <div className="bg-sky-950/70 p-2.5 rounded-xl border border-sky-800/80 space-y-1">
                                          <div className="flex items-center justify-between text-xs">
                                            <span className="text-sky-300 font-bold flex items-center gap-1">
                                              <ArrowLeftRight className="w-3 h-3 text-sky-400" />
                                              {isOwner ? "Harga Banding Anda:" : "Penjual Mengajukan Harga Banding:"}
                                            </span>
                                            <strong className="text-white font-mono text-xs sm:text-sm font-bold bg-sky-900/80 px-2 py-0.5 rounded-md border border-sky-700">
                                              {comm.counterPrice}
                                            </strong>
                                          </div>
                                          {comm.counterNote && (
                                            <p className="text-slate-300 italic text-[11px] pt-0.5">
                                              "{comm.counterNote}"
                                            </p>
                                          )}
                                        </div>
                                      )}

                                      {comm.content &&
                                        comm.content !== "Telah melakukan penawaran harga." &&
                                        comm.content !== "Telah mengajukan penawaran harga." && (
                                          <p className="text-slate-300 italic text-[11px] bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                                            "{comm.content}"
                                          </p>
                                        )}
                                      <div className="flex items-center gap-1 text-[10px] text-emerald-400/90 pt-0.5">
                                        <ShieldCheck className="w-3 h-3 shrink-0" />
                                        <span>
                                          {isMyOffer
                                            ? "🔒 Privasi Aman: Calon pembeli lain tidak dapat melihat nominal tawaran Anda."
                                            : "🔒 Khusus Penjual (Anda) & Penawar yang dapat melihat nominal ini."}
                                        </span>
                                      </div>
                                    </div>
                                  ) : (
                                    /* User lain hanya melihat keterangan bahwa user tersebut telah menawar */
                                    <div className="mt-1.5 space-y-1">
                                      <p className="text-slate-200 font-medium flex items-center gap-1.5">
                                        <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                        <span>
                                          {comm.offerStatus === "countered" ? (
                                            <>
                                              Penjual dan <strong className="text-slate-100">{comm.authorName}</strong> sedang bernegosiasi harga banding.
                                            </>
                                          ) : comm.offerStatus === "accepted" ? (
                                            <>
                                              Penawaran harga dari <strong className="text-slate-100">{comm.authorName}</strong> telah disepakati oleh penjual!
                                            </>
                                          ) : (
                                            <>
                                              <strong className="text-slate-100">{comm.authorName}</strong> telah melakukan penawaran harga.
                                            </>
                                          )}
                                        </span>
                                      </p>
                                      <div className="flex items-center gap-1 text-[10px] text-slate-400 bg-slate-950/60 p-1.5 rounded-lg border border-slate-800/70">
                                        <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                                        <span>
                                          🔒 Penawaran Privat: Nominal hanya dapat dilihat oleh Penjual dan Penawar yang bersangkutan.
                                        </span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          }

                          // Komentar Biasa
                          return (
                            <div
                              key={comm.id}
                              className="flex items-start gap-2.5 text-xs bg-slate-900/90 p-3 rounded-xl border border-slate-800"
                            >
                              <img
                                src={comm.authorAvatar}
                                alt={comm.authorName}
                                referrerPolicy="no-referrer"
                                className="w-7 h-7 rounded-full object-cover mt-0.5 border border-emerald-500/40"
                              />
                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-emerald-300">
                                    {comm.authorName}
                                  </span>
                                  <span className="text-[10px] text-slate-500">
                                    {comm.createdAt}
                                  </span>
                                </div>
                                <p className="text-slate-200 mt-1 leading-relaxed">
                                  {comm.content}
                                </p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Input Komentar Baru */}
                    <div className="flex items-center gap-2 pt-2">
                      <input
                        type="text"
                        value={commentInputs[item.id] || ""}
                        onChange={(e) =>
                          setCommentInputs((prev) => ({
                            ...prev,
                            [item.id]: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddComment(item.id);
                          }
                        }}
                        placeholder="Tulis komentar publik pada katalog ini..."
                        className="flex-1 bg-slate-900 border border-slate-700 text-xs text-white px-3.5 py-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddComment(item.id)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 p-2.5 rounded-xl font-bold transition-colors cursor-pointer"
                        title="Kirim Komentar"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Modal Negosiasi / Penawaran Harga Privat (Calon Pembeli) */}
      {negotiatingCatalog && (
        <NegotiateModal
          isOpen={!!negotiatingCatalog}
          onClose={() => setNegotiatingCatalog(null)}
          catalog={negotiatingCatalog}
          currentUser={currentUser}
          onOfferSuccess={handleOfferSuccess}
        />
      )}

      {/* Modal Daftar Tawaran Masuk (Penjual) */}
      {viewingOffersCatalog && (
        <SellerOffersModal
          isOpen={!!viewingOffersCatalog}
          onClose={() => setViewingOffersCatalog(null)}
          catalog={viewingOffersCatalog}
          sellerId={currentUser.id}
          onRespondOffer={handleRespondOffer}
        />
      )}
    </div>
  );
};
