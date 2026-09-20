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
} from "lucide-react";
import { User, CatalogItem } from "../types";
import { formatToRupiah } from "../utils/currencyUtils";

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

  useEffect(() => {
    fetchFeed();
  }, []);

  const fetchFeed = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/catalog/feed");
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

                {/* Body: Foto Katalog dengan Tampilan Penuh saat Diklik */}
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

                  {/* Additional description */}
                  {item.description && (
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-line pt-1">
                      {item.description}
                    </p>
                  )}
                </div>

                {/* Action Bar: Like, Komentar, Sundul, Tanya WhatsApp */}
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

                  <div className="flex items-center gap-2">
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
                        className="bg-emerald-700/80 hover:bg-emerald-600 text-white font-semibold text-xs px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1"
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
                    <h4 className="text-xs font-bold text-slate-300">
                      Diskusi & Komentar Katalog ({(item.comments || []).length})
                    </h4>

                    {/* Daftar Komentar */}
                    <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                      {(item.comments || []).length === 0 ? (
                        <p className="text-xs text-slate-500 italic">
                          Belum ada komentar untuk katalog ini. Tulis pertanyaan atau apresiasi pertama Anda!
                        </p>
                      ) : (
                        item.comments.map((comm) => (
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
                        ))
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
                        placeholder="Tulis komentar atau tawar harga..."
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
    </div>
  );
};
