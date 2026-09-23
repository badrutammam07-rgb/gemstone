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

  // Turn on local camera for host
  const startCamera = async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: true,
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraOn(true);
      setIsMicOn(true);
    } catch (err: any) {
      console.warn("Camera access warning:", err);
      setCameraError(
        "Kamera/Mikrofon belum diizinkan atau tidak tersedia. Menjalankan simulasi siaran visual interaktif."
      );
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

  const isHost = streamInfo?.hostId === currentUser.id || (!streamInfo && isHostMode);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-0 md:p-4">
      <div className="relative w-full h-full md:max-w-4xl md:h-[90vh] bg-slate-950 md:rounded-3xl border border-slate-800 flex flex-col overflow-hidden shadow-2xl">
        {/* Top Floating Header */}
        <div className="absolute top-0 left-0 right-0 z-30 p-3 sm:p-4 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent">
          {/* Host Info & Live Badge */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src={streamInfo?.hostAvatar || currentUser.avatar}
                alt="Host Avatar"
                className="w-10 h-10 rounded-full object-cover border-2 border-rose-500 shadow-md"
              />
              <span className="absolute -bottom-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white leading-tight drop-shadow-md">
                  {streamInfo?.hostName || currentUser.username}
                </h3>
                <span className="bg-rose-600 text-white text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                  <Radio className="w-3 h-3 animate-pulse" /> LIVE
                </span>
              </div>
              <p className="text-[11px] text-slate-300 drop-shadow-md line-clamp-1 max-w-[200px] sm:max-w-xs">
                {streamInfo?.title || streamTitle}
              </p>
            </div>
          </div>

          {/* Right: Viewer Count & Actions */}
          <div className="flex items-center gap-2">
            {/* Live Viewer Counter */}
            <div className="bg-black/60 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-full flex items-center gap-1.5 text-xs text-white font-bold shadow-lg">
              <Eye className="w-3.5 h-3.5 text-rose-400" />
              <span>{viewerCount} Penonton</span>
            </div>

            {/* End Live (for host) or Exit (for viewer) */}
            {isHost && isLiveActive ? (
              <button
                type="button"
                onClick={handleEndLive}
                className="bg-rose-600/90 hover:bg-rose-600 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
                title="Akhiri Sesi Live (Data Langsung Dihapus Bersih)"
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
                className="p-2 bg-black/60 hover:bg-black/80 text-white rounded-full border border-white/20 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* System Alert Notification */}
        {systemAlert && (
          <div className="absolute top-16 left-4 right-4 z-40">
            <div className="bg-rose-950/90 border border-rose-500/50 text-white text-xs p-3 rounded-xl shadow-2xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{systemAlert}</span>
            </div>
          </div>
        )}

        {/* Content Area */}
        {!isLiveActive && isHost ? (
          /* Host Pre-Live Setup Form */
          <div className="flex-1 flex flex-col justify-center items-center p-6 text-center z-10 max-w-lg mx-auto w-full">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-rose-600 to-amber-500 flex items-center justify-center shadow-xl shadow-rose-900/30 mb-4 animate-bounce">
              <Radio className="w-8 h-8 text-white" />
            </div>

            <h2 className="text-xl font-black text-white mb-2">Mulai Live Streaming Jual Beli</h2>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              Tampilkan batu mulia terbaik Anda secara langsung kepada seluruh anggota komunitas.
              Penonton dapat melihat batu secara detail, berinteraksi via komentar langsung, dan
              melihat jumlah penonton aktif.
            </p>

            <div className="w-full space-y-4 text-left bg-slate-900/90 p-5 rounded-2xl border border-slate-800 mb-6 shadow-xl">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Judul Sesi Live Streaming:
                </label>
                <input
                  type="text"
                  value={streamTitle}
                  onChange={(e) => setStreamTitle(e.target.value)}
                  placeholder="Misal: Obral Batu Bacan Doko & Ruby Asli Garansi"
                  className="w-full bg-slate-950 border border-slate-700 text-sm text-white px-3.5 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Sematkan Produk Katalog Utama (Opsional):
                </label>
                {selectedCatalogToPin ? (
                  <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-emerald-500/40">
                    <div className="flex items-center gap-3">
                      <img
                        src={selectedCatalogToPin.images?.[0] || ""}
                        alt={selectedCatalogToPin.gemType}
                        className="w-12 h-12 rounded-lg object-cover border border-slate-700"
                      />
                      <div>
                        <p className="text-xs font-bold text-white">{selectedCatalogToPin.gemType}</p>
                        <p className="text-xs font-extrabold text-emerald-400">
                          {selectedCatalogToPin.price}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedCatalogToPin(null)}
                      className="text-xs text-slate-400 hover:text-rose-400 p-1"
                    >
                      Batal
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowCatalogSelector(true)}
                    className="w-full py-2.5 px-3 bg-slate-950 border border-dashed border-slate-700 hover:border-emerald-500/60 rounded-xl text-xs text-slate-400 hover:text-emerald-400 flex items-center justify-center gap-2 transition-all cursor-pointer"
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
                  <strong className="font-semibold">Privasi Terjamin:</strong> Setelah live
                  diakhiri, tidak ada data video, komentar, maupun riwayat penonton yang akan
                  disimpan di database. Sistem langsung menghapus bersih semuanya.
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
        ) : (
          /* Live Streaming Active Viewport */
          <div className="relative flex-1 w-full h-full flex flex-col md:flex-row overflow-hidden bg-black">
            {/* Left/Main: Video Feed Area */}
            <div className="relative flex-1 h-[55%] md:h-full bg-slate-900 flex items-center justify-center overflow-hidden">
              {/* Actual Video Tag for Host Camera Stream */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted={isHost} // Mute self to prevent feedback loop
                className={`w-full h-full object-cover ${!isCameraOn ? "hidden" : ""}`}
              />

              {/* Visual Fallback / Animation when camera is loading or viewer mode */}
              {!isCameraOn || (!videoRef.current?.srcObject && !isHost) ? (
                <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-slate-900 via-emerald-950/30 to-slate-950 relative">
                  <div className="relative mb-4">
                    <img
                      src={
                        pinnedProduct?.photoUrl ||
                        streamInfo?.hostAvatar ||
                        currentUser.avatar
                      }
                      alt="Live Display"
                      className="w-32 h-32 rounded-3xl object-cover border-4 border-rose-500 shadow-2xl animate-pulse"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent rounded-3xl" />
                  </div>

                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-rose-600/20 border border-rose-500/40 rounded-full text-rose-300 text-xs font-bold mb-2">
                    <Radio className="w-3.5 h-3.5 animate-ping" /> Siaran Langsung Sedang Berlangsung
                  </div>
                  <h4 className="text-white font-extrabold text-base max-w-sm">
                    {streamInfo?.title || streamTitle}
                  </h4>
                  <p className="text-slate-400 text-xs mt-1">
                    Dipandu oleh {streamInfo?.hostName || currentUser.username}
                  </p>
                </div>
              ) : null}

              {/* Host Floating Media Controls (Camera / Mic) */}
              {isHost && isLiveActive && (
                <div className="absolute bottom-4 left-4 z-30 flex items-center gap-2 bg-black/70 backdrop-blur-md p-1.5 rounded-2xl border border-white/10">
                  <button
                    type="button"
                    onClick={toggleCamera}
                    className={`p-2.5 rounded-xl transition-all cursor-pointer ${
                      isCameraOn
                        ? "bg-slate-800 text-white hover:bg-slate-700"
                        : "bg-rose-600 text-white"
                    }`}
                    title={isCameraOn ? "Matikan Kamera" : "Nyalakan Kamera"}
                  >
                    {isCameraOn ? <Camera className="w-4 h-4" /> : <CameraOff className="w-4 h-4" />}
                  </button>

                  <button
                    type="button"
                    onClick={toggleMic}
                    className={`p-2.5 rounded-xl transition-all cursor-pointer ${
                      isMicOn
                        ? "bg-slate-800 text-white hover:bg-slate-700"
                        : "bg-rose-600 text-white"
                    }`}
                    title={isMicOn ? "Matikan Mikrofon" : "Nyalakan Mikrofon"}
                  >
                    {isMicOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                  </button>

                  {userCatalogs.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowCatalogSelector(true)}
                      className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                      title="Sematkan Produk Katalog"
                    >
                      <Pin className="w-3.5 h-3.5" />
                      <span>Sematkan Batu</span>
                    </button>
                  )}
                </div>
              )}

              {/* Pinned Product Card Floating Banner */}
              {pinnedProduct && (
                <div className="absolute top-20 left-4 right-4 sm:right-auto sm:max-w-xs z-30 bg-slate-900/90 backdrop-blur-md border border-emerald-500/50 p-2.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-fade-in">
                  <img
                    src={pinnedProduct.photoUrl}
                    alt={pinnedProduct.title}
                    className="w-14 h-14 rounded-xl object-cover border border-emerald-500/40 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                      <Pin className="w-3 h-3" /> Produk Disematkan
                    </div>
                    <p className="text-xs font-bold text-white truncate">{pinnedProduct.title}</p>
                    <p className="text-xs font-extrabold text-amber-400">{pinnedProduct.price}</p>
                  </div>

                  {isHost ? (
                    <button
                      type="button"
                      onClick={handleUnpinProduct}
                      className="text-slate-400 hover:text-rose-400 p-1"
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
                        className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] rounded-lg shrink-0 cursor-pointer shadow-sm"
                      >
                        Beli / Nego
                      </button>
                    )
                  )}
                </div>
              )}
            </div>

            {/* Right/Bottom: Real-time Live Comments & Chat Section */}
            <div className="w-full md:w-80 lg:w-96 h-[45%] md:h-full bg-slate-950/95 border-t md:border-t-0 md:border-l border-slate-800 flex flex-col justify-between z-20">
              {/* Header Comments */}
              <div className="p-3 border-b border-slate-800/80 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <MessageCircle className="w-4 h-4 text-emerald-400" />
                  <span>Komentar Langsung Penonton</span>
                </div>
                <span className="text-[10px] text-slate-500">Live RAM Volatile</span>
              </div>

              {/* Comments Feed List */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                {comments.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-500">
                    <Flame className="w-8 h-8 text-slate-600 mb-2" />
                    <p className="text-xs">Belum ada komentar.</p>
                    <p className="text-[11px] text-slate-600">
                      Jadilah yang pertama menyapa atau menanyakan spesifikasi batu mulia!
                    </p>
                  </div>
                ) : (
                  comments.map((c) => {
                    const isSystem = c.senderId === "system";
                    if (isSystem) {
                      return (
                        <div
                          key={c.id}
                          className="bg-emerald-950/30 border border-emerald-900/50 rounded-lg px-2.5 py-1 text-[11px] text-emerald-400 text-center font-medium"
                        >
                          {c.message}
                        </div>
                      );
                    }

                    const isAuthorHost = streamInfo?.hostId === c.senderId;

                    return (
                      <div
                        key={c.id}
                        className="flex items-start gap-2 text-xs leading-relaxed animate-fade-in"
                      >
                        <img
                          src={c.senderAvatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80&auto=format&fit=crop&q=80"}
                          alt={c.senderName}
                          className="w-6 h-6 rounded-full object-cover border border-slate-700 shrink-0 mt-0.5"
                        />
                        <div className="bg-slate-900/80 rounded-xl px-2.5 py-1.5 border border-slate-800/70 max-w-[85%]">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span
                              className={`font-bold ${
                                isAuthorHost ? "text-amber-400" : "text-slate-300"
                              }`}
                            >
                              {c.senderName}
                            </span>
                            {isAuthorHost && (
                              <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1 rounded font-bold">
                                Host
                              </span>
                            )}
                          </div>
                          <p className="text-slate-100 text-xs break-words">{c.message}</p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={commentsEndRef} />
              </div>

              {/* Comment Input Box */}
              <form
                onSubmit={handleSendComment}
                className="p-3 border-t border-slate-800 bg-slate-900/60 flex items-center gap-2"
              >
                <input
                  type="text"
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  placeholder="Kirim komentar atau ajukan pertanyaan..."
                  className="flex-1 bg-slate-950 border border-slate-700 text-xs text-white px-3 py-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-500"
                  maxLength={150}
                />
                <button
                  type="submit"
                  disabled={!commentInput.trim()}
                  className="p-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl transition-all cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Modal Selector to Pin User Catalog */}
        {showCatalogSelector && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-5 shadow-2xl flex flex-col max-h-[80vh]">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Pin className="w-4 h-4 text-emerald-400" />
                  Pilih Batu Mulia untuk Disematkan
                </h3>
                <button
                  type="button"
                  onClick={() => setShowCatalogSelector(false)}
                  className="text-slate-400 hover:text-white p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {userCatalogs.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">
                    Anda belum memiliki katalog batu mulia aktif di profil.
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
                      className="flex items-center justify-between p-2.5 bg-slate-950 hover:bg-emerald-950/40 rounded-xl border border-slate-800 hover:border-emerald-500/50 cursor-pointer transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={cat.images?.[0] || ""}
                          alt={cat.gemType}
                          className="w-12 h-12 rounded-lg object-cover border border-slate-700"
                        />
                        <div>
                          <p className="text-xs font-bold text-white">{cat.gemType}</p>
                          <p className="text-xs font-extrabold text-emerald-400">{cat.price}</p>
                          <p className="text-[10px] text-slate-500">{cat.dimensions}</p>
                        </div>
                      </div>
                      <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/30">
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
    </div>
  );
};
