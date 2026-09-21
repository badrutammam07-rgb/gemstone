import React, { useState, useEffect } from "react";
import {
  X,
  ShieldCheck,
  Banknote,
  Send,
  AlertCircle,
  CheckCircle2,
  Lock,
  MessageSquare,
  Sparkles,
  Phone,
} from "lucide-react";
import { User, CatalogItem, NegotiationOffer } from "../types";
import {
  formatToRupiah,
  formatRupiahNumber,
  parseRupiahNumber,
  rupiahToTerbilang,
} from "../utils/currencyUtils";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  catalog: CatalogItem;
  currentUser: User;
  onOfferSuccess: (updatedCatalog: CatalogItem, offer: NegotiationOffer) => void;
  onCheckout?: (catalogId: string, offerId: string) => void;
}

export const NegotiateModal: React.FC<Props> = ({
  isOpen,
  onClose,
  catalog,
  currentUser,
  onOfferSuccess,
  onCheckout,
}) => {
  const [offerPriceRaw, setOfferPriceRaw] = useState("");
  const [note, setNote] = useState("");
  const [buyerPhone, setBuyerPhone] = useState(currentUser.phone || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Cek apakah pembeli sudah pernah menawar sebelumnya
  const existingOffer = catalog.offers?.find((o) => o.buyerId === currentUser.id);

  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setSuccessMessage(null);
      if (existingOffer) {
        // Isi dengan penawaran lama
        const parsed = parseRupiahNumber(existingOffer.offerPrice);
        setOfferPriceRaw(parsed > 0 ? String(parsed) : existingOffer.offerPrice.replace(/\D/g, ""));
        setNote(existingOffer.note || "");
        if (existingOffer.buyerPhone) setBuyerPhone(existingOffer.buyerPhone);
      } else {
        setOfferPriceRaw("");
        setNote("");
        setBuyerPhone(currentUser.phone || "");
      }
    }
  }, [isOpen, existingOffer, currentUser]);

  if (!isOpen) return null;

  const originalPriceNum = parseRupiahNumber(catalog.price);
  const currentOfferNum = parseRupiahNumber(offerPriceRaw);
  const terbilangText = rupiahToTerbilang(currentOfferNum);

  // Quick discount buttons (misal 5%, 10%, 15% jika harga asli valid)
  const quickDiscounts = originalPriceNum > 0 ? [5, 10, 15, 20] : [];

  const handleApplyDiscount = (percent: number) => {
    if (originalPriceNum <= 0) return;
    const discounted = Math.round(originalPriceNum * (1 - percent / 100));
    setOfferPriceRaw(String(discounted));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!currentOfferNum || currentOfferNum <= 0) {
      setErrorMessage("Silakan masukkan nominal penawaran harga yang valid.");
      return;
    }

    if (originalPriceNum > 0 && currentOfferNum > originalPriceNum) {
      setErrorMessage("Nominal penawaran tidak boleh melebihi harga buka dari penjual.");
      return;
    }

    setIsSubmitting(true);

    try {
      const formattedPrice = formatToRupiah(currentOfferNum);
      const res = await fetch(`/api/catalog/${catalog.id}/offer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerId: currentUser.id,
          buyerName: currentUser.username,
          buyerAvatar: currentUser.avatar,
          buyerPhone: buyerPhone.trim(),
          offerPrice: formattedPrice,
          note: note.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Gagal mengirim penawaran harga.");
      }

      setSuccessMessage(
        `Penawaran sebesar ${formattedPrice} berhasil dikirim ke ${catalog.username}! Hanya Anda dan penjual yang dapat melihat nominal ini.`
      );

      setTimeout(() => {
        onOfferSuccess(data.catalog, data.offer);
        onClose();
      }, 1200);
    } catch (err: any) {
      setErrorMessage(err.message || "Terjadi kesalahan saat memproses penawaran.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div
        id="modal-negotiation-box"
        className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
      >
        {/* Header Modal */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">
                {existingOffer ? "Ubah Penawaran Harga" : "Tawar Harga (Negosiasi)"}
              </h3>
              <p className="text-xs text-slate-400">
                Ajukan tawaran langsung ke penjual: <strong className="text-slate-200">{catalog.username}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 transition-colors cursor-pointer"
            title="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
          {/* Card Ringkasan Produk */}
          <div className="flex items-center gap-3.5 p-3.5 bg-slate-950/80 rounded-2xl border border-slate-800">
            {catalog.images && catalog.images.length > 0 && (
              <img
                src={catalog.images[0]}
                alt={catalog.gemType}
                referrerPolicy="no-referrer"
                className="w-14 h-14 rounded-xl object-cover border border-slate-700 shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">
                Batu Mulia
              </span>
              <h4 className="text-sm font-bold text-white truncate">{catalog.gemType}</h4>
              <div className="flex items-center gap-2 mt-0.5 text-xs">
                <span className="text-slate-400">Dimensi: {catalog.dimensions}</span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-400">
                  Harga Asli: <strong className="text-emerald-400">{formatToRupiah(catalog.price)}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Privacy Guarantee Banner Sesuai Permintaan */}
          <div className="bg-emerald-950/50 border border-emerald-800/80 rounded-2xl p-3.5 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed text-emerald-200">
              <strong className="text-emerald-300 block mb-0.5">
                Privasi Penawaran Terjaga 100%
              </strong>
              <span>
                Hanya <strong>Anda</strong> dan <strong>Penjual ({catalog.username})</strong> yang dapat melihat nominal tawaran Anda. Calon pembeli lain tidak dapat melihat harga yang Anda tawar (hanya melihat keterangan bahwa Anda telah melakukan penawaran).
              </span>
            </div>
          </div>

          {/* Existing offer / Counter offer alert */}
          {existingOffer && (
            <div className="space-y-2">
              {existingOffer.status === "countered" && existingOffer.counterPrice ? (
                <div className="bg-sky-950/60 border border-sky-700/80 rounded-2xl p-4 text-xs space-y-2.5 shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sky-300 flex items-center gap-1.5 text-xs sm:text-sm">
                      <Sparkles className="w-4 h-4 text-sky-400" />
                      Penjual Mengajukan Harga Banding
                    </span>
                    <span className="text-[10px] bg-sky-900/80 text-sky-200 px-2 py-0.5 rounded-full border border-sky-700 font-semibold">
                      Harga Banding
                    </span>
                  </div>

                  <div className="bg-slate-950/70 p-3 rounded-xl border border-sky-800/60 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-xs">Tawaran Awal Anda:</span>
                      <span className="font-mono text-slate-300 line-through">{existingOffer.offerPrice}</span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                      <span className="text-sky-300 font-bold text-xs">Harga Banding Penjual:</span>
                      <span className="font-mono font-black text-white text-base sm:text-lg text-sky-400">
                        {existingOffer.counterPrice}
                      </span>
                    </div>
                    {existingOffer.counterNote && (
                      <p className="text-slate-300 text-xs pt-1 italic">
                        "{existingOffer.counterNote}"
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-[11px] text-slate-400">
                      Setuju dengan harga ini?
                    </span>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={async () => {
                        setIsSubmitting(true);
                        setErrorMessage(null);
                        try {
                          const res = await fetch(`/api/catalog/${catalog.id}/offer/${existingOffer.id}/buyer-accept`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ buyerId: currentUser.id }),
                          });
                          const data = await res.json();
                          if (!res.ok || !data.success) {
                            throw new Error(data.message || "Gagal menyepakati harga banding.");
                          }
                          setSuccessMessage(data.message);
                          setTimeout(() => {
                            onOfferSuccess(data.catalog, data.offer);
                            onClose();
                          }, 1500);
                        } catch (err: any) {
                          setErrorMessage(err.message || "Terjadi kesalahan.");
                        } finally {
                          setIsSubmitting(false);
                        }
                      }}
                      className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Sepakati {existingOffer.counterPrice}</span>
                    </button>
                  </div>

                  <p className="text-[10px] text-slate-400 text-center border-t border-slate-800/80 pt-2">
                    Atau jika masih ingin menawar ulang, Anda dapat mengisi nominal baru pada formulir di bawah.
                  </p>
                </div>
              ) : existingOffer.status === "accepted" ? (
                <div className="bg-emerald-950/70 border-2 border-emerald-500 rounded-2xl p-4 text-xs space-y-3 shadow-lg animate-fade-in">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-emerald-300 flex items-center gap-1.5 text-xs sm:text-sm">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      Kesepakatan Harga Tercapai!
                    </span>
                    <span className="bg-emerald-500 text-slate-950 text-[10px] font-black px-2.5 py-0.5 rounded-full">
                      SIAP CEKOUT
                    </span>
                  </div>

                  <div className="bg-slate-950/80 p-3 rounded-xl border border-emerald-800/80 flex items-center justify-between">
                    <div>
                      <span className="text-slate-400 text-[11px] block">Nominal Disepakati:</span>
                      <span className="font-mono font-black text-emerald-400 text-base sm:text-lg">
                        {existingOffer.acceptedPrice || existingOffer.counterPrice || existingOffer.offerPrice}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-300">
                      Penjual: <strong>@{catalog.username}</strong>
                    </span>
                  </div>

                  <p className="text-[11px] text-emerald-200 leading-relaxed">
                    Harga negosiasi telah disepakati! Jika Anda serius membeli, silakan klik tombol <strong>Cekout Transaksi</strong> di bawah. Sistem akan otomatis membuatkan Room Transaksi privat berproteksi Face ID & GPS akurat.
                  </p>

                  {onCheckout && (
                    <button
                      type="button"
                      onClick={() => {
                        onCheckout(catalog.id, existingOffer.id);
                        onClose();
                      }}
                      className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm py-3 rounded-xl transition-all shadow-lg shadow-emerald-900/50 flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.01]"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>CEKOUT & BUAT ROOM TRANSAKSI AMAN</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="bg-amber-950/40 border border-amber-800/60 rounded-xl p-3 text-xs text-amber-200 flex items-center justify-between">
                  <div>
                    <span className="font-semibold block">Tawaran Anda Saat Ini:</span>
                    <span className="font-mono font-bold text-amber-400 text-sm">
                      {existingOffer.offerPrice}
                    </span>
                    <span className="ml-2 text-[10px] bg-amber-900/60 px-2 py-0.5 rounded-md text-amber-200 border border-amber-700/50">
                      Status: Menunggu Tanggapan Penjual
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Alerts */}
          {errorMessage && (
            <div className="bg-red-950/80 border border-red-800 text-red-200 text-xs rounded-xl p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="bg-emerald-950/80 border border-emerald-700 text-emerald-200 text-xs rounded-xl p-3 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Input Nominal Penawaran */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="input-offer-price"
                  className="block text-xs font-semibold text-slate-300"
                >
                  Nominal Penawaran Anda (Rupiah) <span className="text-red-400">*</span>
                </label>
                {quickDiscounts.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-400">Cepat:</span>
                    {quickDiscounts.map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => handleApplyDiscount(pct)}
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 hover:bg-emerald-900/70 text-slate-300 hover:text-emerald-300 border border-slate-700 transition-colors"
                        title={`Tawar dengan potongan ${pct}%`}
                      >
                        -{pct}%
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-emerald-400 font-bold text-sm">
                  Rp
                </div>
                <input
                  id="input-offer-price"
                  type="text"
                  inputMode="numeric"
                  value={formatRupiahNumber(offerPriceRaw)}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/\D/g, "");
                    setOfferPriceRaw(cleaned);
                  }}
                  placeholder="Contoh: 2.800.000"
                  className="w-full pl-12 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono font-bold text-base focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder:text-slate-600 transition-all"
                  required
                />
              </div>

              {/* Terbilang */}
              {terbilangText && (
                <p className="text-[11px] text-emerald-400 font-medium italic mt-1.5 bg-emerald-950/40 p-2 rounded-lg border border-emerald-900/50 flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 shrink-0" />
                  <span>{terbilangText}</span>
                </p>
              )}
            </div>

            {/* Pesan / Catatan Negosiasi */}
            <div>
              <label
                htmlFor="input-offer-note"
                className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1"
              >
                <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                Catatan / Pesan untuk Penjual (Opsional)
              </label>
              <textarea
                id="input-offer-note"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Contoh: Nego tipis ya Om, siap transfer hari ini / COD di seputaran pasar rawa bening..."
                className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-600 resize-none"
              />
            </div>

            {/* Nomor HP / WhatsApp Pembeli untuk Follow-up */}
            <div>
              <label
                htmlFor="input-offer-phone"
                className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1"
              >
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                Nomor WhatsApp Anda (Untuk Konfirmasi Transaksi)
              </label>
              <input
                id="input-offer-phone"
                type="tel"
                value={buyerPhone}
                onChange={(e) => setBuyerPhone(e.target.value)}
                placeholder="Contoh: 08123456789"
                className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-600"
              />
            </div>

            {/* Buttons */}
            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-semibold transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                id="btn-submit-offer"
                type="submit"
                disabled={isSubmitting || !currentOfferNum}
                className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-lg shadow-emerald-950/50 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Mengirim Penawaran...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    {existingOffer ? "Perbarui Penawaran" : "Kirim Penawaran Harga"}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
