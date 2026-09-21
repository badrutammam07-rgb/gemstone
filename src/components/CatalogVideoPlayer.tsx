import React, { useState } from "react";
import {
  Youtube,
  Instagram,
  Film,
  ExternalLink,
  AlertCircle,
  Play,
  Loader2,
  Sparkles,
} from "lucide-react";
import { parseVideoUrl, VideoPlatform } from "../utils/videoUtils";

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
        {videoUrl && (
          <a
            href={videoUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 underline text-[11px]"
          >
            <span>Buka link di browser</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    );
  }

  // Badge styling per platform
  const getPlatformBadge = (platform: VideoPlatform) => {
    switch (platform) {
      case "youtube":
        return (
          <span className="bg-red-600/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm">
            <Youtube className="w-3 h-3" />
            {parsed.platformName}
          </span>
        );
      case "instagram":
        return (
          <span className="bg-gradient-to-r from-purple-600 to-pink-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm">
            <Instagram className="w-3 h-3" />
            {parsed.platformName}
          </span>
        );
      case "tiktok":
        return (
          <span className="bg-gradient-to-r from-cyan-600 to-slate-900 text-cyan-200 border border-cyan-500/50 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm">
            <Film className="w-3 h-3 text-cyan-400" />
            {parsed.platformName}
          </span>
        );
      default:
        return (
          <span className="bg-emerald-700 text-white text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
            <Play className="w-3 h-3" />
            {parsed.platformName}
          </span>
        );
    }
  };

  const containerHeightClass = compact
    ? "h-56"
    : parsed.aspectRatio === "9/16"
    ? "h-[460px] sm:h-[500px]"
    : parsed.aspectRatio === "4/5"
    ? "h-[420px] sm:h-[460px]"
    : "h-64 sm:h-80";

  return (
    <div
      className={`relative bg-black rounded-2xl overflow-hidden border border-slate-800 shadow-xl flex flex-col ${className}`}
    >
      {/* Top Header bar with Platform info & external link */}
      <div className="bg-slate-950/90 border-b border-slate-800/80 px-3 py-2 flex items-center justify-between z-10">
        <div className="flex items-center gap-2 min-w-0">
          {getPlatformBadge(parsed.platform)}
          {gemTitle && (
            <span className="text-xs text-slate-300 font-medium truncate hidden sm:inline">
              Detail {gemTitle}
            </span>
          )}
        </div>
        <a
          href={parsed.originalUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 bg-slate-900 hover:bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700/60 transition-colors shrink-0"
          title="Buka langsung di aplikasi aslinya"
        >
          <span>Aplikasi Asli</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Video Viewport */}
      <div className={`relative w-full ${containerHeightClass} bg-slate-950 flex items-center justify-center`}>
        {/* Loading Spinner */}
        {isLoading && (
          <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center gap-2 text-slate-400 z-10 pointer-events-none">
            <Loader2 className="w-7 h-7 text-emerald-400 animate-spin" />
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              Memuat video detail permata...
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
            title={gemTitle ? `Video Detail ${gemTitle}` : "Video Detail Permata"}
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
            <p className="text-xs text-slate-300 font-semibold mb-2">
              Tidak dapat memutar video di dalam aplikasi karena pembatasan privasi platform.
            </p>
            <a
              href={parsed.originalUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors"
            >
              <span>Buka di {parsed.platformName}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
};
