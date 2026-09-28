import React, { useState, useEffect, useRef } from "react";
import {
  Video,
  Radio,
  Eye,
  Send,
  X,
  Pin,
  Sparkles,
  ShoppingBag,
  Maximize2,
  Minimize2,
  Camera,
  CameraOff,
  Mic,
  MicOff,
  Flame,
  MessageCircle,
  AlertCircle,
  CheckCircle,
  SwitchCamera,
  RefreshCw,
} from "lucide-react";
import { User, LiveStreamSummary, LiveStreamComment, LivePinnedProduct, CatalogItem } from "../types";

interface Props {
  currentUser: User;
  streamId?: string; // If viewing an existing stream
  isHostMode?: boolean; // If user is starting/hosting their own live
  initialPinnedCatalog?: CatalogItem | null;
  userCatalogs?: CatalogItem[];
  onClose: () => void;
  onSelectProduct?: (catalogId: string) => void;
}

export const LiveStreamingModal: React.FC<Props> = ({
  currentUser,
  streamId: propStreamId,
  isHostMode = false,
  initialPinnedCatalog,
  userCatalogs = [],
  onClose,
  onSelectProduct,
}) => {
  const [streamId, setStreamId] = useState<string | null>(propStreamId || null);
  const [streamInfo, setStreamInfo] = useState<LiveStreamSummary | null>(null);
  const [viewerCount, setViewerCount] = useState<number>(1);
  const [comments, setComments] = useState<LiveStreamComment[]>([]);
  const [commentInput, setCommentInput] = useState("");
  const [pinnedComment, setPinnedComment] = useState<LiveStreamComment | null>(null);
  const [pinnedProduct, setPinnedProduct] = useState<LivePinnedProduct | null>(
    initialPinnedCatalog
      ? {
          id: initialPinnedCatalog.id,
          title: initialPinnedCatalog.gemType,
          price: initialPinnedCatalog.price,
          dimensions: initialPinnedCatalog.dimensions,
          photoUrl: initialPinnedCatalog.images?.[0] || "",
          description: initialPinnedCatalog.description || "",
        }
      : null
  );

  // Host setup form states (before going live)
  const [isLiveActive, setIsLiveActive] = useState<boolean>(!isHostMode || !!propStreamId);
  const [streamTitle, setStreamTitle] = useState(
    isHostMode ? `Live Jual Batu Mulia - ${currentUser.username}` : "Live Streaming Batu Mulia"
  );
  const [selectedCatalogToPin, setSelectedCatalogToPin] = useState<CatalogItem | null>(
    initialPinnedCatalog || (userCatalogs.length > 0 ? userCatalogs[0] : null)
  );

  // Hardware Media States
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [cameraFacingMode, setCameraFacingMode] = useState<"user" | "environment">("user");
  const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Select Pin modal for host
  const [showCatalogSelector, setShowCatalogSelector] = useState(false);
  const [systemAlert, setSystemAlert] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const commentsEndRef = useRef<HTMLDivElement | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());

  // Auto-scroll comments to bottom
  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments]);

  // Turn on local camera for host with selectable facingMode
  const startCamera = async (targetFacing: "user" | "environment" = cameraFacingMode) => {
    try {
      setCameraError(null);
      // Stop old tracks first
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }

      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: { ideal: targetFacing },
          },
          audio: isMicOn,
        });
      } catch (modeErr) {
        // Fallback to basic video constraint if exact facingMode fails
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: isMicOn,
        });
      }

      mediaStreamRef.current = stream;
      if (videoRef.current && stream) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setIsCameraOn(true);
      setCameraFacingMode(targetFacing);
    } catch (err: any) {
      console.warn("Camera access warning:", err);
      setCameraError(
        "Kamera/Mikrofon belum diizinkan atau tidak tersedia. Menjalankan simulasi siaran visual interaktif."
      );
    }
  };

  // Switch between front (user) and back (environment) camera
  const handleSwitchCamera = async () => {
    if (isSwitchingCamera) return;
    setIsSwitchingCamera(true);
    const nextFacing: "user" | "environment" = cameraFacingMode === "user" ? "environment" : "user";
    try {
      await startCamera(nextFacing);
    } finally {
      setIsSwitchingCamera(false);
    }
  };

  // Stop camera and tracks
  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Toggle Camera
  const toggleCamera = () => {
    if (mediaStreamRef.current) {
      const videoTrack = mediaStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOn(videoTrack.enabled);
      }
    }
  };

  // Toggle Mic
  const toggleMic = () => {
    if (mediaStreamRef.current) {
      const audioTrack = mediaStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicOn(audioTrack.enabled);
      }
    }
  };

  // Setup WebSocket connection to /ws/live
  const connectWebSocket = (targetStreamId: string) => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/live`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      // Send join event
      ws.send(
        JSON.stringify({
          type: "join_stream",
          streamId: targetStreamId,
          user: {
            id: currentUser.id,
            name: currentUser.username,
            avatar: currentUser.avatar,
          },
        })
      );
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case "init_state": {
            setStreamInfo(data.stream);
            setViewerCount(data.stream.viewerCount || 1);
            setComments(data.stream.comments || []);
            setPinnedProduct(data.stream.pinnedProduct || null);
            setPinnedComment(data.stream.pinnedComment || null);
            break;
          }

          case "viewer_count_update": {
            setViewerCount(data.viewerCount);
            if (data.userJoined) {
              setComments((prev) => [
                ...prev,
                {
                  id: `sys-${Date.now()}`,
                  senderId: "system",
                  senderName: "Sistem",
                  senderAvatar: "",
                  message: `👋 ${data.userJoined} bergabung ke live`,
                  timestamp: Date.now(),
                },
              ]);
            }
            break;
          }

          case "new_comment": {
            setComments((prev) => [...prev, data.comment]);
            break;
          }

          case "product_pinned": {
            setPinnedProduct(data.product);
            break;
          }

          case "comment_pinned": {
            setPinnedComment(data.comment || null);
            break;
          }

          case "stream_ended": {
            setSystemAlert("Live streaming telah diakhiri oleh penjual. Tidak ada data yang tersimpan di database.");
            setIsLiveActive(false);
            stopCamera();
            setTimeout(() => {
              onClose();
            }, 3500);
            break;
          }

          case "stream_not_found": {
            setSystemAlert("Live streaming ini sudah tidak aktif.");
            setTimeout(() => onClose(), 2500);
            break;
          }

          default:
            break;
        }
      } catch (e) {
        console.error("WS Parse error:", e);
      }
    };

    ws.onclose = () => {
      console.log("WebSocket live streaming connection closed.");
    };

    ws.onerror = (err) => {
      console.error("WebSocket live error:", err);
    };
  };

  // Host starts stream
  const handleStartLiveNow = async () => {
    try {
      const pinnedPayload: LivePinnedProduct | null = selectedCatalogToPin
        ? {
            id: selectedCatalogToPin.id,
            title: selectedCatalogToPin.gemType,
            price: selectedCatalogToPin.price,
            dimensions: selectedCatalogToPin.dimensions,
            photoUrl: selectedCatalogToPin.images?.[0] || "",
            description: selectedCatalogToPin.description || "",
          }
        : null;

      const res = await fetch("/api/live/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hostId: currentUser.id,
          hostName: currentUser.username,
          hostAvatar: currentUser.avatar,
          title: streamTitle.trim() || `Live ${currentUser.username}`,
          pinnedProduct: pinnedPayload,
        }),
      });

      const data = await res.json();
      if (data.success && data.stream) {
        setStreamId(data.stream.id);
        setStreamInfo(data.stream);
        setPinnedProduct(pinnedPayload);
        setIsLiveActive(true);

        // Turn on camera for real video
        await startCamera();

        // Connect real-time socket
        connectWebSocket(data.stream.id);
      } else {
        setSystemAlert(data.message || "Gagal memulai live streaming.");
      }
    } catch (err: any) {
      console.error("Start live error:", err);
      setSystemAlert("Terjadi kesalahan saat memulai live.");
    }
  };

  // End stream (clean memory completely, zero database footprint)
  const handleEndLive = async () => {
    if (!streamId) {
      onClose();
      return;
    }

    const confirmEnd = window.confirm(
      "Apakah Anda yakin ingin mengakhiri sesi live? Sesuai ketentuan privasi, seluruh riwayat komentar, penonton, dan live streaming akan langsung dimusnahkan seketika dari sistem tanpa tersimpan di database."
    );
    if (!confirmEnd) return;

    try {
      stopCamera();
      await fetch("/api/live/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          streamId,
          hostId: currentUser.id,
        }),
      });
      if (wsRef.current) {
        wsRef.current.close();
      }
      onClose();
    } catch (err) {
      console.error("End live error:", err);
      onClose();
    }
  };

  // Pin a product during live
  const handlePinProduct = async (cat: CatalogItem) => {
    if (!streamId) return;
    const newProduct: LivePinnedProduct = {
      id: cat.id,
      title: cat.gemType,
      price: cat.price,
      dimensions: cat.dimensions,
      photoUrl: cat.images?.[0] || "",
      description: cat.description || "",
    };

    try {
      await fetch("/api/live/pin-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          streamId,
          hostId: currentUser.id,
          product: newProduct,
        }),
      });
      setPinnedProduct(newProduct);
      setShowCatalogSelector(false);
    } catch (e) {
      console.error("Pin product error:", e);
    }
  };

  // Unpin product
  const handleUnpinProduct = async () => {
    if (!streamId) return;
    try {
      await fetch("/api/live/pin-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          streamId,
          hostId: currentUser.id,
          product: null,
        }),
      });
      setPinnedProduct(null);
    } catch (e) {
      console.error("Unpin product error:", e);
    }
  };

  // Pin a comment during live (Khusus Host)
  const handlePinComment = async (comment: LiveStreamComment) => {
    if (!streamId || !isHost) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "pin_comment",
          comment,
        })
      );
    }
    try {
      await fetch("/api/live/pin-comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          streamId,
          hostId: currentUser.id,
          comment,
        }),
      });
    } catch (e) {
      console.error("Pin comment error:", e);
    }
    setPinnedComment(comment);
  };

  // Unpin comment
  const handleUnpinComment = async () => {
    if (!streamId || !isHost) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "pin_comment",
          comment: null,
        })
      );
    }
    try {
      await fetch("/api/live/pin-comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          streamId,
          hostId: currentUser.id,
          comment: null,
        }),
      });
    } catch (e) {
      console.error("Unpin comment error:", e);
    }
    setPinnedComment(null);
  };

  const handleTogglePinComment = (comment: LiveStreamComment) => {
    if (pinnedComment?.id === comment.id) {
      handleUnpinComment();
    } else {
      handlePinComment(comment);
    }
  };

  // Send a comment in live room
  const handleSendComment = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!commentInput.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    wsRef.current.send(
      JSON.stringify({
        type: "send_comment",
        message: commentInput.trim(),
      })
    );

    setCommentInput("");
  };

  // Initial connect if opening existing stream as viewer
  useEffect(() => {
    if (propStreamId) {
      connectWebSocket(propStreamId);
    }

    return () => {
      stopCamera();
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [propStreamId]);

  // Send reaction (Heart / Like) in live room
  const handleSendReaction = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(
      JSON.stringify({
        type: "send_comment",
        message: "❤️ Menyukai siaran live ini",
      })
    );
  };

  const isHost = streamInfo?.hostId === currentUser.id || (!streamInfo && isHostMode);

  return (
    <div className="fixed inset-0 z-50 bg-black w-screen h-screen overflow-hidden flex flex-col select-none">
      {/* Content Area */}
      {!isLiveActive && isHost ? (
        /* Host Pre-Live Setup Form (Scrollable modal mode to never break screen) */
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col my-auto max-h-[95vh] overflow-y-auto scrollbar-none">
            {/* Close / Cancel Button */}
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-full transition-all cursor-pointer"
              title="Tutup / Batalkan"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center pt-2">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-rose-600 to-amber-500 flex items-center justify-center shadow-xl shadow-rose-900/30 mb-4 mx-auto animate-bounce">
                <Radio className="w-8 h-8 text-white" />
              </div>

              <h2 className="text-xl font-black text-white mb-2">Mulai Live Streaming Jual Beli</h2>
              <p className="text-xs text-slate-400 mb-6 leading-relaxed max-w-md mx-auto">
                Tampilkan batu mulia terbaik Anda secara langsung kepada seluruh anggota komunitas.
                Layar live akan tampil penuh dengan obrolan interaktif langsung di atas layar.
              </p>
            </div>

            <div className="w-full space-y-4 text-left bg-slate-950/80 p-4 sm:p-5 rounded-2xl border border-slate-800/80 mb-6 shadow-xl">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Judul Sesi Live Streaming:
                </label>
                <input
                  type="text"
                  value={streamTitle}
                  onChange={(e) => setStreamTitle(e.target.value)}
                  placeholder="Misal: Obral Batu Bacan Doko & Ruby Asli Garansi"
                  className="w-full bg-slate-900 border border-slate-700 text-sm text-white px-3.5 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 placeholder:text-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Sematkan Produk Katalog Utama (Opsional):
                </label>
                {selectedCatalogToPin ? (
                  <div className="flex items-center justify-between p-3 bg-slate-900 rounded-xl border border-emerald-500/40">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={selectedCatalogToPin.images?.[0] || ""}
                        alt={selectedCatalogToPin.gemType}
                        className="w-12 h-12 rounded-lg object-cover border border-slate-700 shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate">{selectedCatalogToPin.gemType}</p>
                        <p className="text-xs font-extrabold text-emerald-400">
                          {selectedCatalogToPin.price}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedCatalogToPin(null)}
                      className="text-xs text-slate-400 hover:text-rose-400 p-1.5 shrink-0 cursor-pointer"
                    >
                      Batal
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowCatalogSelector(true)}
                    className="w-full py-2.5 px-3 bg-slate-900 border border-dashed border-slate-700 hover:border-emerald-500/60 rounded-xl text-xs text-slate-400 hover:text-emerald-400 flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    Pilih batu mulia dari katalog Anda untuk disematkan
                  </button>
                )}
              </div>

              {/* Privacy Notice Statement */}
              <div className="bg-emerald-950/40 border border-emerald-500/30 p-3 rounded-xl flex items-start gap-2.5">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-emerald-300 leading-tight">
                  <strong className="font-semibold">Privasi Terjamin:</strong> Setelah live diakhiri,
                  seluruh data video, komentar, dan penonton langsung dihapus bersih tanpa disimpan di database.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleStartLiveNow}
              className="w-full py-3.5 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-black text-sm rounded-xl shadow-xl shadow-rose-900/40 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
            >
              <Radio className="w-4 h-4" /> Mulai Siaran Live Sekarang
            </button>
          </div>
        </div>
      ) : (
        /* ==================== TRUE FULL-SCREEN LIVE STREAMING ==================== */
        <div className="relative w-full h-full overflow-hidden bg-black flex flex-col">
          {/* 1. Full-screen Video Layer */}
          <div className="absolute inset-0 w-full h-full bg-slate-950 flex items-center justify-center overflow-hidden">
            {/* Camera Video Feed */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted={isHost}
              className={`absolute inset-0 w-full h-full object-cover ${!isCameraOn ? "hidden" : ""} ${
                cameraFacingMode === "user" ? "transform -scale-x-100" : ""
              }`}
            />

            {/* Fallback / Animated Live Background when camera off or viewer mode */}
            {(!isCameraOn || (!videoRef.current?.srcObject && !isHost)) && (
              <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-slate-950 via-slate-900 to-emerald-950 overflow-hidden">
                <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-rose-600 via-emerald-600 to-black animate-pulse" />
                
                <div className="relative mb-5 z-10">
                  <img
                    src={pinnedProduct?.photoUrl || streamInfo?.hostAvatar || currentUser.avatar}
                    alt="Live Display"
                    className="w-36 h-36 sm:w-44 sm:h-44 rounded-3xl object-cover border-4 border-rose-500 shadow-2xl shadow-rose-950/60"
                  />
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-rose-600 text-white text-[10px] font-black uppercase tracking-wider px-3 py-0.5 rounded-full shadow-lg flex items-center gap-1 shrink-0">
                    <Radio className="w-3 h-3 animate-ping" /> SEDANG SIARAN
                  </div>
                </div>

                <div className="z-10 max-w-md px-4">
                  <h4 className="text-white font-black text-lg sm:text-xl drop-shadow-lg leading-snug">
                    {streamInfo?.title || streamTitle}
                  </h4>
                  <p className="text-emerald-400 text-xs sm:text-sm font-semibold mt-1.5 drop-shadow">
                    Dipandu oleh {streamInfo?.hostName || currentUser.username}
                  </p>
                  <p className="text-slate-400 text-[11px] mt-1">
                    Suara dan komentar interaktif berjalan langsung secara real-time
                  </p>
                </div>
              </div>
            )}

            {/* Atmospheric Shadows for High Text Readability */}
            <div className="absolute top-0 left-0 right-0 h-36 bg-gradient-to-b from-black/85 via-black/40 to-transparent pointer-events-none z-10" />
            <div className="absolute bottom-0 left-0 right-0 h-80 bg-gradient-to-t from-black/95 via-black/60 to-transparent pointer-events-none z-10" />
          </div>

          {/* 2. Top Header Bar (With Scroll Mode if viewport is too narrow) */}
          <div className="absolute top-0 left-0 right-0 z-30 pt-3 pb-2 px-3 sm:px-4 pointer-events-auto">
            <div className="w-full flex items-center justify-between gap-2 overflow-x-auto scrollbar-none touch-scroll py-0.5">
              {/* Host Info Capsule */}
              <div className="flex items-center gap-2.5 bg-black/55 backdrop-blur-md border border-white/15 pl-1.5 pr-3 py-1.5 rounded-full shrink-0 shadow-lg max-w-[65%] sm:max-w-md">
                <div className="relative shrink-0">
                  <img
                    src={streamInfo?.hostAvatar || currentUser.avatar}
                    alt="Host Avatar"
                    className="w-8 h-8 rounded-full object-cover border-2 border-rose-500 shadow-sm"
                  />
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                  </span>
                </div>

                <div className="min-w-0 pr-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-xs font-black text-white leading-tight truncate">
                      {streamInfo?.hostName || currentUser.username}
                    </h3>
                    <span className="bg-rose-600 text-white text-[9px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded-full flex items-center gap-0.5 shrink-0">
                      <Radio className="w-2.5 h-2.5 animate-pulse" /> LIVE
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-300 truncate">
                    {streamInfo?.title || streamTitle}
                  </p>
                </div>
              </div>

              {/* Top Right Actions: Viewers Count & Close/End Button */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Viewers Pill */}
                <div className="bg-black/55 backdrop-blur-md border border-white/15 px-2.5 py-1.5 rounded-full flex items-center gap-1.5 text-xs text-white font-bold shadow-lg shrink-0">
                  <Eye className="w-3.5 h-3.5 text-rose-400" />
                  <span>{viewerCount}</span>
                </div>

                {/* End Live (for host) or Exit (for viewer) */}
                {isHost && isLiveActive ? (
                  <button
                    type="button"
                    onClick={handleEndLive}
                    className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                    title="Akhiri Sesi Live"
                  >
                    Akhiri Live
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      stopCamera();
                      if (wsRef.current) wsRef.current.close();
                      onClose();
                    }}
                    className="p-2 bg-black/55 hover:bg-black/80 text-white rounded-full border border-white/20 transition-all cursor-pointer shrink-0 shadow-lg"
                    title="Keluar dari Live"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* System Alert Notification */}
          {systemAlert && (
            <div className="absolute top-16 left-3 right-3 sm:left-4 sm:right-4 z-40">
              <div className="bg-rose-950/95 border border-rose-500/60 text-white text-xs p-3 rounded-2xl shadow-2xl flex items-center gap-2 max-w-md mx-auto">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{systemAlert}</span>
              </div>
            </div>
          )}

          {/* 3. Pinned Product Banner (Floating cleanly below header) */}
          {pinnedProduct && (
            <div className="absolute top-16 left-3 sm:left-4 z-25 max-w-[280px] sm:max-w-xs bg-black/65 backdrop-blur-md border border-emerald-500/40 p-2.5 rounded-2xl shadow-2xl flex items-center gap-2.5 animate-fade-in pointer-events-auto">
              <img
                src={pinnedProduct.photoUrl}
                alt={pinnedProduct.title}
                className="w-12 h-12 rounded-xl object-cover border border-emerald-500/40 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 text-[9px] text-emerald-400 font-bold uppercase tracking-wider">
                  <Pin className="w-2.5 h-2.5" /> Disematkan
                </div>
                <p className="text-xs font-bold text-white truncate">{pinnedProduct.title}</p>
                <p className="text-xs font-extrabold text-amber-400">{pinnedProduct.price}</p>
              </div>

              {isHost ? (
                <button
                  type="button"
                  onClick={handleUnpinProduct}
                  className="text-slate-400 hover:text-rose-400 p-1 shrink-0"
                  title="Lepas Sematan"
                >
                  <X className="w-4 h-4" />
                </button>
              ) : (
                pinnedProduct.id &&
                onSelectProduct && (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectProduct(pinnedProduct.id!);
                    }}
                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] rounded-xl shrink-0 cursor-pointer shadow-md"
                  >
                    Beli / Nego
                  </button>
                )
              )}
            </div>
          )}

          {/* 4. Real-time Live Comments Overlay: Tanpa Background agar Tidak Menghalangi Kamera */}
          <div className="absolute bottom-24 sm:bottom-28 left-3 right-3 sm:right-auto sm:max-w-md pointer-events-none z-20 flex flex-col justify-end">
            {/* Banner Komentar Disematkan (Pinned Comment by Host) */}
            {pinnedComment && (
              <div className="mb-2 p-2.5 rounded-2xl bg-black/60 backdrop-blur-md border border-amber-500/60 shadow-xl flex items-start justify-between gap-2.5 pointer-events-auto animate-fade-in max-w-[95%] sm:max-w-md">
                <div className="flex items-start gap-2 min-w-0">
                  <div className="p-1.5 rounded-lg bg-amber-500/25 text-amber-400 shrink-0 mt-0.5">
                    <Pin className="w-3.5 h-3.5 fill-amber-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-amber-400">
                      <span>Komentar Disematkan</span>
                    </div>
                    <p className="text-white text-xs mt-0.5 leading-snug break-words">
                      <strong className="text-amber-300 font-bold mr-1.5">{pinnedComment.senderName}:</strong>
                      <span className="font-normal select-text">{pinnedComment.message}</span>
                    </p>
                  </div>
                </div>

                {isHost && (
                  <button
                    type="button"
                    onClick={handleUnpinComment}
                    className="p-1 text-slate-400 hover:text-rose-400 hover:bg-white/10 rounded-lg transition-all shrink-0 cursor-pointer"
                    title="Lepas Sematan Komentar"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}

            {/* Aliran Komentar Live: Murni Tanpa Background Kotak/Pill */}
            <div className="pointer-events-auto max-h-52 sm:max-h-72 overflow-y-auto scrollbar-none space-y-1 pr-2 touch-scroll flex flex-col">
              {comments.length === 0 ? (
                <div className="text-[11px] text-slate-200/90 font-medium py-1 [text-shadow:_0_1px_3px_rgba(0,0,0,0.95),_0_2px_6px_rgba(0,0,0,0.9)] max-w-fit">
                  👋 Selamat datang di live streaming! Komentar Anda akan muncul di layar ini.
                </div>
              ) : (
                comments.map((c) => {
                  const isSystem = c.senderId === "system";
                  if (isSystem) {
                    return (
                      <div
                        key={c.id}
                        className="inline-flex items-center gap-1.5 py-0.5 text-[11px] text-emerald-300 font-medium [text-shadow:_0_1px_3px_rgba(0,0,0,0.95),_0_2px_5px_rgba(0,0,0,0.9)]"
                      >
                        <span>{c.message}</span>
                      </div>
                    );
                  }

                  const isAuthorHost = streamInfo?.hostId === c.senderId;
                  const isThisPinned = pinnedComment?.id === c.id;

                  return (
                    <div
                      key={c.id}
                      className="group flex items-start justify-between gap-2 py-0.5 max-w-[95%] sm:max-w-md animate-fade-in transition-all"
                    >
                      <div className="inline-flex items-baseline flex-wrap gap-1.5 text-xs [text-shadow:_0_1px_3px_rgba(0,0,0,0.98),_0_2px_6px_rgba(0,0,0,0.95)] leading-snug">
                        <span
                          className={`font-black tracking-tight shrink-0 ${
                            isAuthorHost
                              ? "text-amber-300 flex items-center gap-1"
                              : "text-emerald-300"
                          }`}
                        >
                          {c.senderName}
                          {isAuthorHost && (
                            <span className="text-[9px] bg-amber-500/40 text-amber-200 px-1 py-0.2 rounded font-extrabold uppercase ml-0.5">
                              Host
                            </span>
                          )}
                          :
                        </span>
                        <span className="text-white font-medium select-text">
                          {c.message}
                        </span>
                      </div>

                      {/* Tombol Sematkan Komentar Khusus Host */}
                      {isHost && (
                        <button
                          type="button"
                          onClick={() => handleTogglePinComment(c)}
                          className={`p-1 rounded-full text-[10px] transition-all cursor-pointer shrink-0 opacity-80 sm:opacity-0 group-hover:opacity-100 ${
                            isThisPinned
                              ? "bg-amber-500 text-black font-bold opacity-100 scale-110 shadow-lg"
                              : "bg-black/50 hover:bg-amber-500 hover:text-black text-amber-300 border border-white/10"
                          }`}
                          title={isThisPinned ? "Lepas Sematan Komentar" : "Sematkan Komentar Ini"}
                        >
                          <Pin className={`w-3 h-3 ${isThisPinned ? "fill-black" : ""}`} />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={commentsEndRef} />
            </div>
          </div>

          {/* 5. Bottom Menus & Comment Input (Mode Scroll ensures screen is never broken) */}
          <div className="absolute bottom-0 left-0 right-0 z-30 p-2.5 sm:p-3 pb-3 sm:pb-4 flex flex-col gap-2 pointer-events-auto">
            {/* Mode Scroll Action Menus */}
            <div className="w-full overflow-x-auto scrollbar-none touch-scroll py-0.5 flex items-center gap-2">
              {/* Host Controls */}
              {isHost && (
                <>
                  <button
                    type="button"
                    onClick={toggleCamera}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-md ${
                      isCameraOn
                        ? "bg-black/60 hover:bg-black/80 text-white border border-white/20"
                        : "bg-rose-600 text-white"
                    }`}
                    title={isCameraOn ? "Matikan Kamera" : "Nyalakan Kamera"}
                  >
                    {isCameraOn ? <Camera className="w-3.5 h-3.5" /> : <CameraOff className="w-3.5 h-3.5" />}
                    <span>{isCameraOn ? "Kamera On" : "Kamera Off"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSwitchCamera}
                    disabled={!isCameraOn || isSwitchingCamera}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-black/60 hover:bg-black/80 text-teal-300 border border-teal-500/30 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-md disabled:opacity-50"
                    title={`Pindah kamera (${cameraFacingMode === "user" ? "ke belakang" : "ke depan"})`}
                  >
                    <SwitchCamera className={`w-3.5 h-3.5 ${isSwitchingCamera ? "animate-spin" : ""}`} />
                    <span>{cameraFacingMode === "user" ? "Kamera Belakang" : "Kamera Depan"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={toggleMic}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-md ${
                      isMicOn
                        ? "bg-black/60 hover:bg-black/80 text-white border border-white/20"
                        : "bg-rose-600 text-white"
                    }`}
                    title={isMicOn ? "Matikan Mikrofon" : "Nyalakan Mikrofon"}
                  >
                    {isMicOn ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
                    <span>{isMicOn ? "Mic On" : "Mic Off"}</span>
                  </button>

                  {userCatalogs.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowCatalogSelector(true)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer shadow-md"
                      title="Sematkan Batu Mulia"
                    >
                      <Pin className="w-3.5 h-3.5" />
                      <span>Sematkan Batu</span>
                    </button>
                  )}
                </>
              )}

              {/* Viewer Quick Action for Pinned Stone */}
              {!isHost && pinnedProduct && pinnedProduct.id && onSelectProduct && (
                <button
                  type="button"
                  onClick={() => onSelectProduct(pinnedProduct.id!)}
                  className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer shadow-lg"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Beli Batu ({pinnedProduct.price})</span>
                </button>
              )}

              {/* Reaction Heart Button */}
              <button
                type="button"
                onClick={handleSendReaction}
                className="px-3 py-1.5 bg-black/60 hover:bg-rose-950/80 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer shadow-md"
                title="Beri Like / Suka"
              >
                <Flame className="w-3.5 h-3.5 text-rose-500 fill-rose-500 animate-pulse" />
                <span>Suka</span>
              </button>
            </div>

            {/* Live Comment Input Box */}
            <form onSubmit={handleSendComment} className="w-full flex items-center gap-2">
              <input
                type="text"
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                placeholder="Tulis komentar langsung di live..."
                className="flex-1 bg-black/60 backdrop-blur-md border border-white/20 text-xs sm:text-sm text-white px-3.5 py-2.5 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder:text-slate-400 shadow-xl"
                maxLength={150}
              />
              <button
                type="submit"
                disabled={!commentInput.trim()}
                className="p-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 text-white rounded-2xl shadow-xl transition-all cursor-pointer shrink-0"
                title="Kirim Komentar"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Selector to Pin User Catalog (Scrollable) */}
      {showCatalogSelector && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl p-5 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Pin className="w-4 h-4 text-emerald-400" />
                Pilih Batu Mulia untuk Disematkan
              </h3>
              <button
                type="button"
                onClick={() => setShowCatalogSelector(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-none touch-scroll">
              {userCatalogs.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">
                  Anda belum memiliki batu mulia aktif di katalog profil Anda.
                </p>
              ) : (
                userCatalogs.map((cat) => (
                  <div
                    key={cat.id}
                    onClick={() => {
                      if (isLiveActive) {
                        handlePinProduct(cat);
                      } else {
                        setSelectedCatalogToPin(cat);
                        setShowCatalogSelector(false);
                      }
                    }}
                    className="flex items-center justify-between p-2.5 bg-slate-950 hover:bg-emerald-950/40 rounded-2xl border border-slate-800 hover:border-emerald-500/50 cursor-pointer transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={cat.images?.[0] || ""}
                        alt={cat.gemType}
                        className="w-12 h-12 rounded-xl object-cover border border-slate-700 shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate">{cat.gemType}</p>
                        <p className="text-xs font-extrabold text-emerald-400">{cat.price}</p>
                        <p className="text-[10px] text-slate-500">{cat.dimensions}</p>
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-xl border border-emerald-500/30 shrink-0">
                      Pilih
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
