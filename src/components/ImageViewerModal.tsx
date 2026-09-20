import React, { useState, useEffect } from "react";
import {
  X,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Sparkles,
  Ruler,
  Banknote,
  Gem,
} from "lucide-react";
import { formatToRupiah } from "../utils/currencyUtils";

interface Props {
  isOpen: boolean;
  imageUrl: string | null;
  title?: string;
  dimensions?: string;
  price?: string;
  sellerName?: string;
  onClose: () => void;
}

export const ImageViewerModal: React.FC<Props> = ({
  isOpen,
  imageUrl,
  title,
  dimensions,
  price,
  sellerName,
  onClose,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // Reset zoom on open
  useEffect(() => {
    if (isOpen) {
      setZoomLevel(1);
    }
  }, [isOpen, imageUrl]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !imageUrl) return null;

  const toggleZoom = () => {
    setZoomLevel((prev) => (prev === 1 ? 1.75 : prev === 1.75 ? 2.5 : 1));
  };

  return (
    <div
      id="modal-fullscreen-image-viewer"
      className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col justify-between p-3 sm:p-5 select-none animate-fade-in"
      onClick={(e) => {
        // Close if clicking outside the image container
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-4 z-10 bg-slate-900/80 border border-slate-800/80 rounded-2xl p-3 sm:px-5 backdrop-blur-md shadow-2xl">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl shrink-0">
            <Gem className="w-5 h-5" />
          </div>
          <div className="truncate">
            <h3 className="text-white font-bold text-sm sm:text-base truncate flex items-center gap-2">
              <span>{title || "Foto Batu Permata"}</span>
              {sellerName && (
                <span className="text-xs text-slate-400 font-normal">
                  oleh @{sellerName}
                </span>
              )}
            </h3>
            <div className="flex items-center gap-3 text-xs mt-0.5">
              {dimensions && (
                <span className="text-teal-300 font-mono flex items-center gap-1">
                  <Ruler className="w-3 h-3 text-teal-400" /> {dimensions}
                </span>
              )}
              {price && (
                <span className="text-emerald-400 font-bold font-mono flex items-center gap-1 tracking-tight">
                  <Banknote className="w-3.5 h-3.5 text-emerald-400" /> {formatToRupiah(price)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            id="btn-viewer-toggle-zoom"
            type="button"
            onClick={toggleZoom}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-3 py-2 rounded-xl border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Ubah perbesaran detail"
          >
            {zoomLevel > 1 ? (
              <>
                <ZoomOut className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline font-mono">{zoomLevel}x</span>
              </>
            ) : (
              <>
                <ZoomIn className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Perbesar</span>
              </>
            )}
          </button>

          <button
            id="btn-close-image-viewer"
            type="button"
            onClick={onClose}
            className="bg-slate-800 hover:bg-red-500/30 text-slate-300 hover:text-red-300 p-2 rounded-xl border border-slate-700 transition-colors cursor-pointer"
            title="Tutup (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Middle: Fullscreen Image Viewport */}
      <div
        className="flex-1 flex items-center justify-center p-2 sm:p-4 overflow-auto min-h-0 cursor-zoom-in"
        onClick={toggleZoom}
        title="Klik gambar untuk perbesar / perkecil"
      >
        <img
          src={imageUrl}
          alt={title || "Foto Penuh"}
          referrerPolicy="no-referrer"
          style={{
            transform: `scale(${zoomLevel})`,
            transition: "transform 0.25s cubic-bezier(0.2, 0, 0, 1)",
          }}
          className={`max-h-[78vh] max-w-[95vw] object-contain rounded-xl shadow-2xl ${
            zoomLevel > 1 ? "cursor-zoom-out" : "cursor-zoom-in"
          }`}
        />
      </div>

      {/* Bottom Bar info */}
      <div className="flex items-center justify-between gap-4 text-xs text-slate-400 bg-slate-900/60 border border-slate-800/80 rounded-2xl py-2.5 px-4 backdrop-blur-md">
        <span className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          Tampilan Penuh Batu Mulia Nusantara • Klik gambar untuk memperbesar detail kristal
        </span>
        <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">
          Tekan ESC untuk menutup
        </span>
      </div>
    </div>
  );
};
