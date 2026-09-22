import React, { useState } from "react";
import { AlertCircle, Loader2, Sparkles } from "lucide-react";
import { parseVideoUrl } from "../utils/videoUtils";

interface Props {
  videoUrl: string;
  gemTitle?: string;
  className?: string;
  compact?: boolean;
}

export const CatalogVideoPlayer: React.FC<Props> = ({
  videoUrl,
  gemTitle,
  className = "",
  compact = false,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const parsed = parseVideoUrl(videoUrl);

  if (!parsed.isValid || !parsed.embedUrl) {
    return (
      <div
        className={`bg-slate-950 border border-slate-800 rounded-2xl p-4 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2 ${className}`}
      >
        <div className="p-2 bg-amber-500/10 text-amber-400 rounded-full">
          <AlertCircle className="w-5 h-5" />
        </div>
        <p className="font-semibold text-slate-300">
          {parsed.error || "Tautan video tidak dapat diputar."}
        </p>
      </div>
    );
  }

  const containerHeightClass = compact
    ? "h-56"
    : parsed.aspectRatio === "9/16"
    ? "h-[460px] sm:h-[500px]"
    : parsed.aspectRatio === "4/5"
    ? "h-[420px] sm:h-[460px]"
    : "h-64 sm:h-80";

  return (
    <div
      className={`relative bg-black rounded-2xl overflow-hidden border border-slate-800 shadow-xl w-full flex flex-col ${className}`}
    >
      {/* Video Viewport - Hanya menampilkan dan memutar videonya saja */}
      <div className={`relative w-full ${containerHeightClass} bg-black flex items-center justify-center`}>
        {/* Loading Spinner */}
        {isLoading && (
          <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center gap-2 text-slate-400 z-10 pointer-events-none">
            <Loader2 className="w-7 h-7 text-emerald-400 animate-spin" />
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              Memuat video...
            </span>
          </div>
        )}

        {parsed.isDirectVideo ? (
          <video
            src={parsed.embedUrl!}
            controls
            playsInline
            onLoadedData={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false);
              setHasError(true);
            }}
            className="w-full h-full object-contain bg-black"
          />
        ) : (
          <iframe
            src={parsed.embedUrl!}
            title={gemTitle ? `Video ${gemTitle}` : "Video Batu Mulia"}
            onLoad={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false);
              setHasError(true);
            }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="w-full h-full border-0 bg-black"
          />
        )}

        {hasError && (
          <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-4 text-center z-20">
            <AlertCircle className="w-7 h-7 text-amber-400 mb-2" />
            <p className="text-xs text-slate-300 font-semibold">
              Video tidak dapat diputar langsung di peramban ini.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
