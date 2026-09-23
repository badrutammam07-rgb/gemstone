import React, { useState, useEffect, useRef } from "react";
import { AlertCircle, Loader2, Sparkles, Volume2, VolumeX, RotateCcw } from "lucide-react";
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
  const [directVideoUrl, setDirectVideoUrl] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const parsed = parseVideoUrl(videoUrl);

  // Pastikan browser memperlakukan video sebagai muted secara default agar auto-play tidak diblokir
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
      videoRef.current.defaultMuted = isMuted;
    }
  }, [isMuted, directVideoUrl]);

  // Coba ekstrak video langsung (.mp4) dari backend agar bisa Auto-play dan Loop tanpa batasan iframe pihak ketiga
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setHasError(false);

    if (!parsed.isValid) {
      setIsLoading(false);
      return;
    }

    if (parsed.isDirectVideo && parsed.embedUrl) {
      setDirectVideoUrl(parsed.embedUrl);
      setIsLoading(false);
      return;
    }

    // Panggil API resolver di server untuk Instagram atau format lainnya
    fetch(`/api/resolve-video?url=${encodeURIComponent(videoUrl)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.success && data.directUrl) {
          setDirectVideoUrl(data.directUrl);
        } else {
          setDirectVideoUrl(null);
        }
      })
      .catch((err) => {
        console.warn("[Video Resolver] Fallback ke iframe:", err);
        if (isMounted) {
          setDirectVideoUrl(null);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [videoUrl]);

  // Handler pergantian suara (mute / unmute)
  const toggleMute = () => {
    if (videoRef.current) {
      const nextMuted = !videoRef.current.muted;
      videoRef.current.muted = nextMuted;
      setIsMuted(nextMuted);
    } else {
      setIsMuted((prev) => !prev);
    }
  };

  // Handler putar ulang manual jika pengguna ingin memicu langsung
  const handleReplay = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  };

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

  const isInstagram = parsed.platform === "instagram";

  // Dimensi kontainer video
  let containerDimensions = "aspect-video w-full";
  if (isInstagram || parsed.platform === "tiktok" || parsed.aspectRatio === "9/16") {
    containerDimensions = compact
      ? "h-[360px] max-w-[280px] mx-auto"
      : "aspect-[9/16] max-h-[500px] w-full";
  } else if (parsed.aspectRatio === "1/1") {
    containerDimensions = compact
      ? "aspect-square max-w-[280px] mx-auto"
      : "aspect-square max-h-[460px] w-full";
  } else {
    containerDimensions = compact ? "h-56 w-full" : "aspect-video w-full";
  }

  return (
    <div
      className={`relative bg-black rounded-2xl overflow-hidden border border-slate-800 shadow-xl w-full flex flex-col ${className}`}
    >
      {/* Video Viewport - Memutar video murni tanpa gangguan pihak ketiga */}
      <div className={`relative ${containerDimensions} bg-black flex items-center justify-center overflow-hidden`}>
        {/* Loading Spinner */}
        {isLoading && (
          <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center gap-2 text-slate-400 z-10 pointer-events-none">
            <Loader2 className="w-7 h-7 text-emerald-400 animate-spin" />
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              Menyiapkan video...
            </span>
          </div>
        )}

        {/* 1. NATIVE HTML5 VIDEO (MP4 STREAM LANGSUNG): AUTO-PLAY & REPLAY LOOP INDEFINITELY */}
        {directVideoUrl ? (
          <>
            <video
              ref={videoRef}
              src={directVideoUrl}
              autoPlay
              muted={isMuted}
              loop
              playsInline
              controls
              onLoadedData={() => {
                setIsLoading(false);
                if (videoRef.current) {
                  videoRef.current.play().catch(() => {});
                }
              }}
              onCanPlay={() => {
                if (videoRef.current && videoRef.current.paused) {
                  videoRef.current.play().catch(() => {});
                }
              }}
              onEnded={() => {
                // Replay berulang otomatis tanpa henti (Loop)
                if (videoRef.current) {
                  videoRef.current.currentTime = 0;
                  videoRef.current.play().catch(() => {});
                }
              }}
              onError={() => {
                // Jika stream kadaluarsa atau terjadi galat, fallback ke iframe
                console.warn("[Video Tag Error] Fallback ke iframe");
                setDirectVideoUrl(null);
              }}
              className="w-full h-full object-contain bg-black"
            />

            {/* Tombol Kontrol Nyalakan Suara & Putar Ulang */}
            <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1.5 pointer-events-auto">
              <button
                type="button"
                onClick={toggleMute}
                title={isMuted ? "Nyalakan Suara" : "Bisukan"}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-slate-950/80 hover:bg-slate-900 text-white backdrop-blur-md border border-slate-700/60 text-[11px] font-medium shadow-lg transition-transform active:scale-95"
              >
                {isMuted ? (
                  <>
                    <VolumeX className="w-3.5 h-3.5 text-amber-400" />
                    <span>Nyalakan Suara</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Suara Aktif</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleReplay}
                title="Putar Ulang dari Awal"
                className="p-1.5 rounded-full bg-slate-950/80 hover:bg-slate-900 text-white backdrop-blur-md border border-slate-700/60 shadow-lg transition-transform active:scale-95"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-300" />
              </button>
            </div>
          </>
        ) : isInstagram ? (
          /* 2. Fallback Iframe Instagram */
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
            scrolling="no"
            className="absolute inset-x-0 w-full border-0 bg-black pointer-events-auto"
            style={{
              top: "-58px",
              height: "calc(100% + 220px)",
              touchAction: "manipulation",
            }}
          />
        ) : (
          /* 3. Iframe YouTube / Platform Lain (sudah dikonfigurasi autoplay=1&mute=1&loop=1&playlist=ID) */
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
            scrolling="no"
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
