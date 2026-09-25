import React, { useState, useRef } from "react";
import {
  X,
  Gem,
  Sparkles,
  Image as ImageIcon,
  Ruler,
  FileText,
  Upload,
  Camera,
  ShieldCheck,
  Maximize2,
  Trash2,
  Banknote,
  Video,
  Film,
  Youtube,
  Instagram,
  Play,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { CatalogItem } from "../types";
import { compressImageFileToMax100KB } from "../utils/imageUtils";
import {
  formatRupiahNumber,
  formatToRupiah,
  parseRupiahNumber,
  rupiahToTerbilang,
} from "../utils/currencyUtils";
import { parseVideoUrl } from "../utils/videoUtils";
import { CatalogVideoPlayer } from "./CatalogVideoPlayer";

interface Props {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  onCatalogSaved: (newItem: CatalogItem) => void;
  onOpenFullscreen?: (data: { imageUrl: string; title: string; subtitle?: string; price?: string }) => void;
}

export const InputCatalogModal: React.FC<Props> = ({
  userId,
  isOpen,
  onClose,
  onCatalogSaved,
  onOpenFullscreen,
}) => {
  const [gemType, setGemType] = useState("");
  const [dimensions, setDimensions] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [showVideoPreview, setShowVideoPreview] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressedSizeKb, setCompressedSizeKb] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const sampleImages = [
    "https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=800&q=80",
  ];

  // Format price input on the fly with dot separator every 3 digits
  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatRupiahNumber(e.target.value);
    setPrice(formatted);
  };

  // Quick addition preset pills (e.g. +100rb, +1jt)
  const handleAddQuickPrice = (addition: number) => {
    const currentNum = parseRupiahNumber(price);
    const newNum = currentNum + addition;
    setPrice(formatRupiahNumber(newNum));
  };

  // Handle Stone Photo Upload from Device Media with auto-compression to max 100KB
  const handleDeviceImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];

    if (!file.type.startsWith("image/")) {
      setErrorMessage("Pilih berkas gambar yang valid (JPG, PNG, atau WebP).");
      return;
    }

    setIsCompressing(true);
    setErrorMessage(null);

    try {
      // Automatically compress stone photo to max 100KB while preserving optical quality
      const compressed = await compressImageFileToMax100KB(file, 1280);
      setImageUrl(compressed.dataUrl);
      setCompressedSizeKb(compressed.sizeKb);
    } catch (err: any) {
      setErrorMessage(err.message || "Gagal memproses dan mengompres foto batu.");
    } finally {
      setIsCompressing(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const numericPrice = parseRupiahNumber(price);
    if (!gemType.trim() || !dimensions.trim() || !price.trim() || numericPrice <= 0) {
      setErrorMessage("Mohon lengkapi Jenis Batu, Dimensi, dan Nominal Harga Rupiah yang valid.");
      return;
    }

    const parsedVideo = parseVideoUrl(videoUrl);
    if (!videoUrl.trim() || !parsedVideo.isValid) {
      setErrorMessage(
        parsedVideo.error ||
          "URL video (YouTube, TikTok, atau Instagram) wajib diisi agar calon pembeli dapat melihat detail batu."
      );
      return;
    }

    if (!imageUrl || !imageUrl.trim()) {
      setErrorMessage(
        "Foto batu permata wajib diupload dari media perangkat (galeri atau kamera), bukan dari URL."
      );
      return;
    }

    setIsSaving(true);

    try {
      let finalImg = imageUrl.trim();

      // Upload to Cloudinary if it's a freshly chosen base64 image from device
      if (finalImg.startsWith("data:")) {
        try {
          const uploadRes = await fetch("/api/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: finalImg, folder: "katalog" }),
          });
          const uploadData = await uploadRes.json();
          if (uploadData && uploadData.url) {
            finalImg = uploadData.url;
          }
        } catch (uploadErr) {
          console.warn("[Cloudinary] Upload warning, using local source:", uploadErr);
        }
      }

      const finalPriceString = formatToRupiah(price); // "Rp 15.000.000"

      const res = await fetch("/api/catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          gemType: gemType.trim(),
          dimensions: dimensions.trim(),
          price: finalPriceString,
          description: description.trim(),
          videoUrl: videoUrl.trim(),
          images: [finalImg],
          publishDirectly: true,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Gagal menyimpan katalog.");
      }

      onCatalogSaved(data.catalog);
      onClose();
      // Reset form
      setGemType("");
      setDimensions("");
      setPrice("");
      setDescription("");
      setImageUrl("");
      setVideoUrl("");
      setShowVideoPreview(false);
      setCompressedSizeKb(null);
    } catch (err: any) {
      setErrorMessage(err.message || "Terjadi kesalahan pada server backend.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      id="modal-input-catalog"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm overflow-y-auto p-3 sm:p-6 flex justify-center items-start"
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl my-4 sm:my-8 animate-fade-in relative">
        <div className="sticky top-0 z-20 bg-slate-900/95 backdrop-blur-md p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-500/20 rounded-xl text-emerald-400">
              <Gem className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Input Katalog Baru</h3>
              <p className="text-xs text-slate-400">Simpan koleksi batu permata ke profil Anda</p>
            </div>
          </div>
          <button
            id="btn-close-input-catalog"
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-4 sm:p-6 space-y-4 text-xs sm:text-sm">
          {errorMessage && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs p-3 rounded-xl">
              {errorMessage}
            </div>
          )}

          {/* Jenis Batu */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              Jenis Batu Mulia
            </label>
            <input
              id="input-catalog-gemtype"
              type="text"
              value={gemType}
              onChange={(e) => setGemType(e.target.value)}
              placeholder="Contoh: Bacan Doko Kristal / Safir Biru Ceylon"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              required
            />
          </div>

          {/* Dimensi & Nominal Harga */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1 flex items-center gap-1.5">
                <Ruler className="w-3.5 h-3.5 text-teal-400" />
                Dimensi (Panjang x Lebar x Tebal)
              </label>
              <input
                id="input-catalog-dimensions"
                type="text"
                value={dimensions}
                onChange={(e) => setDimensions(e.target.value)}
                placeholder="Contoh: 18.5 x 14.0 x 8.2 mm"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Banknote className="w-3.5 h-3.5 text-emerald-400" />
                  Nominal Harga (Rupiah)
                </span>
                {price && (
                  <span className="text-[10px] text-emerald-400 font-mono font-bold">
                    Rp {price}
                  </span>
                )}
              </label>

              {/* Input Angka Rupiah dengan Titik Pemisah Ribuan Otomatis & Numpad Mobile */}
              <div className="relative flex items-center">
                <div className="absolute left-3 flex items-center pointer-events-none text-emerald-400 font-extrabold font-mono text-sm select-none border-r border-slate-700 pr-2">
                  Rp
                </div>
                <input
                  id="input-catalog-price"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9.]*"
                  value={price}
                  onChange={handlePriceChange}
                  placeholder="0"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-12 pr-3.5 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono font-bold text-sm tracking-wide"
                  required
                />
              </div>

              {/* Tampilan Terbilang Kata Rupiah */}
              {price && parseRupiahNumber(price) > 0 && (
                <div className="mt-1.5 px-2.5 py-1 bg-emerald-950/50 border border-emerald-800/50 rounded-lg text-[11px] text-emerald-300 flex items-center justify-between shadow-sm">
                  <span className="italic truncate" title={rupiahToTerbilang(parseRupiahNumber(price))}>
                    {rupiahToTerbilang(parseRupiahNumber(price))}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPrice("")}
                    className="text-[10px] text-slate-400 hover:text-red-400 ml-2 font-semibold shrink-0 cursor-pointer"
                  >
                    Reset
                  </button>
                </div>
              )}

              {/* Tombol Cepat Nominal Rupiah */}
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                {[
                  { label: "+100 rb", val: 100000 },
                  { label: "+500 rb", val: 500000 },
                  { label: "+1 jt", val: 1000000 },
                  { label: "+5 jt", val: 5000000 },
                  { label: "+10 jt", val: 10000000 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => handleAddQuickPrice(preset.val)}
                    className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono font-semibold px-2 py-0.5 rounded-md border border-slate-700/80 transition-colors cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Deskripsi */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-emerald-400" />
              Deskripsi & Karakter Permata
            </label>
            <textarea
              id="input-catalog-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Jelaskan kualitas giwang, warna kristal, memo lab (jika ada), ikatan ring perak/emas..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
            />
          </div>

          {/* URL Video Detail Batu Mulia (Wajib: YouTube / TikTok / Instagram) */}
          <div className="space-y-2.5 bg-slate-950/80 p-3.5 sm:p-4 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between flex-wrap gap-1.5">
              <label className="text-slate-200 font-bold text-xs sm:text-sm flex items-center gap-2">
                <Video className="w-4 h-4 text-rose-400" />
                <span>URL Video Detail Batu Permata</span>
                <span className="bg-rose-950 text-rose-300 text-[10px] font-black px-2 py-0.5 rounded-md border border-rose-800 tracking-wide">
                  WAJIB
                </span>
              </label>
              <div className="flex items-center gap-1 text-[10px] text-slate-400">
                <span className="flex items-center gap-1 text-red-400 font-semibold">
                  <Youtube className="w-3 h-3" /> YouTube
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 text-cyan-400 font-semibold">
                  <Film className="w-3 h-3" /> TikTok
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 text-pink-400 font-semibold">
                  <Instagram className="w-3 h-3" /> Instagram
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Wajib menyertakan link video (YouTube Shorts/Video, TikTok, atau Instagram Reel) agar calon pembeli dapat memutar dan melihat kilau, giwang, dan detail 360° batu langsung di dalam aplikasi.
            </p>

            <div className="relative flex items-center">
              <input
                id="input-catalog-videourl"
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="Contoh: https://www.youtube.com/shorts/... atau https://vt.tiktok.com/..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-xs sm:text-sm placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-500 font-mono"
                required
              />
            </div>

            {/* Validasi & Deteksi Platform Real-time */}
            {videoUrl.trim() && (() => {
              const parsed = parseVideoUrl(videoUrl);
              if (parsed.isValid) {
                return (
                  <div className="flex items-center justify-between gap-2 p-2 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-xs">
                    <span className="text-emerald-300 flex items-center gap-1.5 font-semibold text-[11px]">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      Link video terverifikasi & siap diputar langsung
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowVideoPreview(!showVideoPreview)}
                      className="text-[11px] font-bold text-white bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded-lg border border-slate-700 flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                    >
                      <Play className="w-3 h-3 text-emerald-400" />
                      <span>{showVideoPreview ? "Tutup Pratinjau" : "Uji Putar"}</span>
                    </button>
                  </div>
                );
              }
              return (
                <div className="p-2 bg-amber-950/40 border border-amber-800/60 rounded-xl text-[11px] text-amber-300 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>{parsed.error}</span>
                </div>
              );
            })()}

            {/* Pratinjau Video Pemutar Langsung */}
            {showVideoPreview && videoUrl.trim() && parseVideoUrl(videoUrl).isValid && (
              <div className="pt-2">
                <CatalogVideoPlayer
                  videoUrl={videoUrl}
                  gemTitle={gemType || "Pratinjau Permata"}
                  compact={true}
                />
              </div>
            )}
          </div>

            {/* Foto Permata dengan Unggah Media Perangkat & Kompresi Otomatis Max 100KB */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-slate-300 font-semibold text-xs sm:text-sm flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Foto Batu Permata</span>
                  <span className="bg-emerald-950 text-emerald-300 text-[10px] font-black px-2 py-0.5 rounded-md border border-emerald-800 tracking-wide">
                    WAJIB DARI PERANGKAT
                  </span>
                </label>
                <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Auto Kompres Max 100 KB
                </span>
              </div>

              {/* Hidden device file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleDeviceImageUpload}
              />

              {/* Upload Area / Image Preview */}
              {imageUrl ? (
                <div className="relative rounded-2xl overflow-hidden border border-emerald-700/60 bg-slate-950 p-2.5 flex items-center gap-3">
                  <div
                    className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0 cursor-pointer group bg-black border border-slate-700"
                    onClick={() => {
                      if (onOpenFullscreen) {
                        onOpenFullscreen({
                          imageUrl,
                          title: gemType || "Pratinjau Foto Batu Permata",
                          subtitle: dimensions || undefined,
                          price: price || undefined,
                        });
                      }
                    }}
                    title="Klik untuk melihat foto dalam tampilan penuh"
                  >
                    <img
                      src={imageUrl}
                      alt="Pratinjau Batu"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Maximize2 className="w-5 h-5 text-white" />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-bold text-white block truncate flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      Foto Terpilih dari Perangkat
                    </span>
                    {compressedSizeKb ? (
                      <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1 mt-0.5">
                        <ShieldCheck className="w-3 h-3 text-emerald-400" />
                        Ukuran: {compressedSizeKb} (Maks. 100 KB)
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400">Siap disimpan ke katalog</span>
                    )}
                    <p className="text-[10px] text-slate-500 mt-1">
                      Klik gambar untuk melihat tampilan penuh
                    </p>
                  </div>

                  <div className="flex flex-col gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 flex items-center gap-1 transition-colors cursor-pointer"
                      title="Ganti Foto dari Perangkat"
                    >
                      <Camera className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="hidden sm:inline">Ganti</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setImageUrl("");
                        setCompressedSizeKb(null);
                      }}
                      className="bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
                      title="Hapus Foto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Hapus</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-emerald-600/50 hover:border-emerald-400 bg-slate-950/80 hover:bg-slate-950 rounded-2xl p-5 text-center cursor-pointer transition-all group shadow-inner"
                >
                  <div className="p-3 bg-emerald-500/10 group-hover:bg-emerald-500/20 text-emerald-400 rounded-full w-fit mx-auto mb-2 transition-colors">
                    <Upload className="w-6 h-6" />
                  </div>
                  <span className="text-xs sm:text-sm font-bold text-slate-200 block group-hover:text-emerald-300 transition-colors">
                    {isCompressing ? "Mengompres Foto (Maks 100 KB)..." : "Upload Foto dari Media Perangkat (Kamera / Galeri)"}
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-1">
                    Wajib upload file foto asli dari galeri/kamera hp/laptop • Otomatis dikompresi max 100KB tanpa mengurangi kilau giwang batu
                  </span>
                </div>
              )}
            </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
            >
              Batal
            </button>
            <button
              id="btn-save-catalog"
              type="submit"
              disabled={isSaving}
              className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold px-5 py-2 rounded-xl transition-colors cursor-pointer disabled:opacity-60 shadow-md shadow-emerald-950/40"
            >
              {isSaving ? "Menyimpan..." : "Save ke Profil"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
