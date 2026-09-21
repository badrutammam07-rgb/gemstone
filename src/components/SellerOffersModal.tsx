import React, { useState } from "react";
import {
  X,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Phone,
  MessageCircle,
  AlertCircle,
  ExternalLink,
  Handshake,
  ArrowLeftRight,
  Send,
} from "lucide-react";
import { CatalogItem, NegotiationOffer } from "../types";
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
  sellerId: string;
  onRespondOffer: (updatedCatalog: CatalogItem) => void;
}

export const SellerOffersModal: React.FC<Props> = ({
  isOpen,
  onClose,
  catalog,
  sellerId,
  onRespondOffer,
}) => {
  const [respondingOfferId, setRespondingOfferId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // State untuk form input Harga Banding Manual
  const [activeCounterOfferId, setActiveCounterOfferId] = useState<string | null>(null);
  const [counterPriceInput, setCounterPriceInput] = useState<string>("");
  const [counterNoteInput, setCounterNoteInput] = useState<string>("");
  const [isSubmittingCounter, setIsSubmittingCounter] = useState(false);

  if (!isOpen) return null;

  const offers = catalog.offers || [];

  // 1. Penjual Menyepakati Tawaran Pembeli
  const handleAcceptOffer = async (offerId: string) => {
    setRespondingOfferId(offerId);
    setErrorMessage(null);
    setActionNotice(null);

    try {
      const res = await fetch(`/api/catalog/${catalog.id}/offer/${offerId}/respond`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sellerId, status: "accepted" }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Gagal menyepakati penawaran.");
      }

      setActionNotice(data.message);
      onRespondOffer(data.catalog);
    } catch (err: any) {
      setErrorMessage(err.message || "Terjadi kesalahan saat memproses penawaran.");
    } finally {
      setRespondingOfferId(null);
    }
  };

  // Buka formulir input harga banding
  const handleOpenCounterForm = (offer: NegotiationOffer) => {
    setActiveCounterOfferId(offer.id);
    setErrorMessage(null);
    setActionNotice(null);

    // Pre-fill counter price jika sebelumnya sudah pernah diajukan, atau kosongkan
    if (offer.counterPrice) {
      const num = parseRupiahNumber(offer.counterPrice);
      setCounterPriceInput(formatRupiahNumber(num));
    } else {
      // Default rekomendasi di tengah-tengah atau harga katalog
      setCounterPriceInput("");
    }
    setCounterNoteInput(offer.counterNote || "");
  };

  // 2. Penjual Mengajukan Harga Banding Secara Manual
  const handleSubmitCounter = async (offer: NegotiationOffer) => {
    const rawDigits = counterPriceInput.replace(/\D/g, "");
    if (!rawDigits || parseInt(rawDigits, 10) <= 0) {
      setErrorMessage("Silakan masukkan nominal harga banding yang valid.");
      return;
    }

    setIsSubmittingCounter(true);
    setErrorMessage(null);
    setActionNotice(null);

    const formattedCounterPrice = `Rp ${formatRupiahNumber(rawDigits)}`;

    try {
      const res = await fetch(`/api/catalog/${catalog.id}/offer/${offer.id}/counter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sellerId,
          counterPrice: formattedCounterPrice,
          counterNote: counterNoteInput.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Gagal mengajukan harga banding.");
      }

      setActionNotice(data.message);
      setActiveCounterOfferId(null);
      setCounterPriceInput("");
      setCounterNoteInput("");
      onRespondOffer(data.catalog);
    } catch (err: any) {
      setErrorMessage(err.message || "Terjadi kesalahan saat mengajukan harga banding.");
    } finally {
      setIsSubmittingCounter(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div
        id="modal-seller-offers-box"
        className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
              <Handshake className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">
                Daftar Penawaran Masuk ({offers.length})
              </h3>
              <p className="text-xs text-slate-400">
                Katalog: <strong className="text-slate-200">{catalog.gemType}</strong> • Harga Buka:{" "}
                <span className="text-emerald-400 font-bold">{formatToRupiah(catalog.price)}</span>
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

        {/* Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
          {/* Info Banner */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 flex items-center gap-2.5 text-xs text-slate-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Nominal penawaran &amp; harga banding bersifat <strong>rahasia (privat)</strong>, hanya dapat dilihat oleh Anda dan calon pembeli bersangkutan.
            </span>
          </div>

          {/* Feedback Notices */}
          {actionNotice && (
            <div className="bg-emerald-950/80 border border-emerald-700 text-emerald-200 text-xs rounded-xl p-3 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
              <span>{actionNotice}</span>
            </div>
          )}

          {errorMessage && (
            <div className="bg-red-950/80 border border-red-800 text-red-200 text-xs rounded-xl p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* List Offers */}
          {offers.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <MessageCircle className="w-12 h-12 text-slate-600 mx-auto mb-2" />
              <p className="text-xs">Belum ada penawaran harga yang masuk untuk batu mulia ini.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {offers.map((offer) => {
                const isAccepted = offer.status === "accepted";
                const isCountered = offer.status === "countered";
                const isPending = offer.status === "pending";
                const isResponding = respondingOfferId === offer.id;
                const isCounteringThis = activeCounterOfferId === offer.id;

                const counterNumber = parseRupiahNumber(counterPriceInput);
                const counterTerbilang = rupiahToTerbilang(counterNumber);

                const phoneClean = (offer.buyerPhone || "").replace(/[^0-9]/g, "");
                const waLink = phoneClean
                  ? `https://wa.me/${phoneClean.startsWith("0") ? "62" + phoneClean.slice(1) : phoneClean}?text=${encodeURIComponent(
                      `Halo ${offer.buyerName}, saya penjual batu mulia "${catalog.gemType}" di Komunitas Batu Mulia. Mengenai tawaran Anda (${offer.offerPrice})...`
                    )}`
                  : null;

                return (
                  <div
                    key={offer.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      isAccepted
                        ? "bg-emerald-950/30 border-emerald-800/80"
                        : isCountered
                        ? "bg-sky-950/20 border-sky-800/70"
                        : "bg-slate-950/80 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      {/* Profil Penawar */}
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <img
                          src={offer.buyerAvatar}
                          alt={offer.buyerName}
                          referrerPolicy="no-referrer"
                          className="w-10 h-10 rounded-full object-cover border border-emerald-500/40 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-white">
                              {offer.buyerName}
                            </span>

                            {/* Status Badges */}
                            {isAccepted && (
                              <span className="bg-emerald-900/60 text-emerald-300 border border-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Disepakati
                              </span>
                            )}
                            {isCountered && (
                              <span className="bg-sky-900/60 text-sky-300 border border-sky-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                <ArrowLeftRight className="w-3 h-3" /> Harga Banding Terkirim
                              </span>
                            )}
                            {isPending && (
                              <span className="bg-amber-900/60 text-amber-300 border border-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Clock className="w-3 h-3" /> Menunggu Tanggapan Anda
                              </span>
                            )}
                          </div>

                          {/* Nominal Tawaran Calon Pembeli */}
                          <div className="mt-1 flex items-baseline gap-1.5 flex-wrap">
                            <span className="text-xs text-slate-400">Tawaran Pembeli:</span>
                            <span className="text-base font-black font-mono text-emerald-400">
                              {offer.offerPrice}
                            </span>
                          </div>

                          {/* Pesan Pembeli */}
                          {offer.note && (
                            <p className="text-xs text-slate-300 mt-1 bg-slate-900/90 p-2 rounded-lg border border-slate-800/80 leading-relaxed italic">
                              "{offer.note}"
                            </p>
                          )}

                          {/* Tampilan Harga Banding yang Pernah Diajukan Penjual */}
                          {offer.counterPrice && (
                            <div className="mt-2.5 bg-sky-950/60 border border-sky-800/70 p-2.5 rounded-xl text-xs space-y-1">
                              <div className="flex items-center justify-between text-sky-300 font-semibold">
                                <span className="flex items-center gap-1">
                                  <ArrowLeftRight className="w-3 h-3 text-sky-400" />
                                  Harga Banding dari Anda:
                                </span>
                                <span className="font-mono font-black text-white text-sm">
                                  {offer.counterPrice}
                                </span>
                              </div>
                              {offer.counterNote && (
                                <p className="text-slate-300 text-[11px] italic">
                                  Pesan Anda: "{offer.counterNote}"
                                </p>
                              )}
                              <p className="text-[10px] text-sky-400/80">
                                {isAccepted
                                  ? "✓ Calon pembeli telah menyepakati harga ini!"
                                  : "Menunggu respon persetujuan atau tawar balik dari calon pembeli."}
                              </p>
                            </div>
                          )}

                          {offer.buyerPhone && (
                            <div className="mt-2 flex items-center gap-1 text-[11px] text-slate-400">
                              <Phone className="w-3 h-3 text-slate-500" />
                              <span>HP/WA: {offer.buyerPhone}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Tombol Aksi Penjual */}
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        {!isAccepted && (
                          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1.5">
                            {/* Tombol Sepakat / Terima */}
                            <button
                              type="button"
                              onClick={() => handleAcceptOffer(offer.id)}
                              disabled={isResponding || isSubmittingCounter}
                              className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1 shadow-sm cursor-pointer disabled:opacity-50"
                              title="Sepakati / terima tawaran harga ini"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Sepakat</span>
                            </button>

                            {/* Tombol Ajukan Harga Banding (Tidak boleh menolak, harus ajukan harga banding) */}
                            <button
                              type="button"
                              onClick={() => {
                                if (isCounteringThis) {
                                  setActiveCounterOfferId(null);
                                } else {
                                  handleOpenCounterForm(offer);
                                }
                              }}
                              disabled={isResponding || isSubmittingCounter}
                              className={`text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1 border cursor-pointer ${
                                isCounteringThis
                                  ? "bg-slate-800 text-slate-300 border-slate-700"
                                  : "bg-sky-950/80 hover:bg-sky-900 text-sky-200 border-sky-700/80"
                              }`}
                              title="Ajukan harga banding secara manual ke calon pembeli"
                            >
                              <ArrowLeftRight className="w-3.5 h-3.5 text-sky-400" />
                              <span>{isCountered ? "Ubah Harga Banding" : "Harga Banding"}</span>
                            </button>
                          </div>
                        )}

                        {/* WhatsApp Contact */}
                        {waLink && (
                          <a
                            href={waLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-teal-700/80 hover:bg-teal-600 text-white font-semibold text-xs px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1 mt-1"
                            title="Chat calon pembeli via WhatsApp"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>Chat WA</span>
                          </a>
                        )}
                      </div>
                    </div>

                    {/* FORM INPUT HARGA BANDING MANUAL */}
                    {isCounteringThis && (
                      <div className="mt-3 pt-3 border-t border-slate-800 animate-fade-in bg-slate-900/90 p-3.5 rounded-xl">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
                            <ArrowLeftRight className="w-3.5 h-3.5" />
                            <span>Ajukan Harga Banding Manual ke {offer.buyerName}</span>
                          </label>
                          <span className="text-[11px] text-slate-400">
                            Tawaran Pembeli: <strong className="text-emerald-400">{offer.offerPrice}</strong>
                          </span>
                        </div>

                        {/* Input Nominal Rupiah Manual */}
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-sky-400 text-sm">
                            Rp
                          </span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={counterPriceInput}
                            onChange={(e) => setCounterPriceInput(formatRupiahNumber(e.target.value))}
                            placeholder="Contoh: 850.000"
                            className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-sky-800/80 focus:border-sky-500 rounded-xl text-white font-bold font-mono text-sm placeholder-slate-600 outline-none transition-all"
                            autoFocus
                          />
                        </div>

                        {/* Preview Terbilang */}
                        {counterTerbilang && (
                          <div className="mt-1.5 text-[11px] text-sky-300 font-medium italic">
                            Terbilang: {counterTerbilang}
                          </div>
                        )}

                        {/* Input Pesan / Catatan Opsional */}
                        <div className="mt-2.5">
                          <textarea
                            value={counterNoteInput}
                            onChange={(e) => setCounterNoteInput(e.target.value)}
                            placeholder={`Tulis pesan atau alasan untuk ${offer.buyerName} (contoh: Belum dapet kalau ${offer.offerPrice} ya Om, nett segini siap lepas...)`}
                            rows={2}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-xl text-xs text-slate-200 placeholder-slate-600 outline-none resize-none transition-all"
                          />
                        </div>

                        {/* Tombol Kirim Harga Banding & Batal */}
                        <div className="mt-3 flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setActiveCounterOfferId(null)}
                            disabled={isSubmittingCounter}
                            className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                          >
                            Batal
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSubmitCounter(offer)}
                            disabled={isSubmittingCounter || !counterPriceInput}
                            className="bg-gradient-to-r from-sky-600 to-teal-600 hover:from-sky-500 hover:to-teal-500 text-white font-bold text-xs px-4 py-1.5 rounded-xl transition-all flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>{isSubmittingCounter ? "Mengirim..." : "Kirim Harga Banding"}</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
