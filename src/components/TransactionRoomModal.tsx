import React, { useState, useEffect, useRef } from "react";
import {
  X,
  ShieldCheck,
  ShieldAlert,
  Camera,
  MapPin,
  Lock,
  CheckCircle2,
  AlertCircle,
  Clock,
  Send,
  RefreshCw,
  Sparkles,
  ExternalLink,
  MessageSquare,
  ChevronRight,
  UserCheck,
  Compass,
  Video,
} from "lucide-react";
import { User, TransactionRoom, RoomChatMessage } from "../types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  roomId?: string;
  catalogId?: string;
  offerId?: string;
  currentUser: User;
  initialVerification?: {
    facePhotoUrl: string;
    latitude: number;
    longitude: number;
    accuracyMeters: number;
    locationName: string;
  };
  onOpenFullscreen?: (data: {
    imageUrl: string;
    title?: string;
    dimensions?: string;
    price?: string;
    sellerName?: string;
  }) => void;
}

export const TransactionRoomModal: React.FC<Props> = ({
  isOpen,
  onClose,
  roomId: initialRoomId,
  catalogId,
  offerId,
  currentUser,
  initialVerification,
  onOpenFullscreen,
}) => {
  const [room, setRoom] = useState<TransactionRoom | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Verification states
  const [showPreSecurityNotice, setShowPreSecurityNotice] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [capturedFacePhoto, setCapturedFacePhoto] = useState<string | null>(null);
  const [gpsLocation, setGpsLocation] = useState<{
    latitude: number;
    longitude: number;
    accuracyMeters: number;
    locationName: string;
  } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<"idle" | "locating" | "success" | "error">("idle");
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isSubmittingVerification, setIsSubmittingVerification] = useState<boolean>(false);

  // Chat message states
  const [messageInput, setMessageInput] = useState<string>("");
  const [isSendingMessage, setIsSendingMessage] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll chat to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // 1. Fetch or Create Room
  const loadRoomData = async () => {
    try {
      if (initialRoomId) {
        if (initialVerification) {
          try {
            await fetch(`/api/rooms/${initialRoomId}/verify`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                userId: currentUser.id,
                facePhotoUrl: initialVerification.facePhotoUrl,
                latitude: initialVerification.latitude,
                longitude: initialVerification.longitude,
                accuracyMeters: initialVerification.accuracyMeters,
                locationName: initialVerification.locationName,
              }),
            });
          } catch (verErr) {
            console.warn("Initial verify error:", verErr);
          }
        }

        const res = await fetch(`/api/rooms/${initialRoomId}?userId=${currentUser.id}`);
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.message || "Gagal memuat room transaksi.");
        }
        setRoom(data.room);
      } else if (catalogId && offerId) {
        const bodyPayload: any = {
          catalogId,
          offerId,
          buyerId: currentUser.id,
        };

        if (initialVerification) {
          bodyPayload.facePhotoUrl = initialVerification.facePhotoUrl;
          bodyPayload.latitude = initialVerification.latitude;
          bodyPayload.longitude = initialVerification.longitude;
          bodyPayload.accuracyMeters = initialVerification.accuracyMeters;
          bodyPayload.locationName = initialVerification.locationName;
          bodyPayload.verifiedRole = "buyer";
        }

        const res = await fetch("/api/rooms/create-or-get", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyPayload),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.message || "Gagal membuat atau memuat room transaksi.");
        }
        setRoom(data.room);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Terjadi kesalahan saat memuat room.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setErrorMessage(null);
      loadRoomData();
    } else {
      // Clean up camera on close
      stopCamera();
    }
  }, [isOpen, initialRoomId, catalogId, offerId]);

  // Polling for real-time chat & verification status updates
  useEffect(() => {
    if (!isOpen || !room) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/rooms/${room.id}?userId=${currentUser.id}`);
        const data = await res.json();
        if (data.success && data.room) {
          setRoom(data.room);
        }
      } catch (err) {
        // silent polling fail
      }
    }, 3500);

    return () => clearInterval(interval);
  }, [isOpen, room?.id, currentUser.id]);

  useEffect(() => {
    if (room?.status === "active") {
      scrollToBottom();
    }
  }, [room?.messages.length, room?.status]);

  // Determine current user's role in this room
  const isSeller = room ? room.seller.userId === currentUser.id : false;
  const isBuyer = room ? room.buyer.userId === currentUser.id : false;
  const myParty = room ? (isSeller ? room.seller : room.buyer) : null;
  const otherParty = room ? (isSeller ? room.buyer : room.seller) : null;

  const myVerified = myParty?.isFullyVerified || false;
  const otherVerified = otherParty?.isFullyVerified || false;
  const isBothVerified = room ? room.seller.isFullyVerified && room.buyer.isFullyVerified : false;

  // Kamera Face ID Controller
  const startCamera = async () => {
    setErrorMessage(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Kamera tidak didukung oleh peramban ini. Silakan gunakan upload foto wajah.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 640 },
        },
        audio: false,
      });

      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err: any) {
      console.warn("Camera access warning:", err);
      setErrorMessage("Tidak dapat mengakses kamera secara langsung. Anda dapat mengunggah foto selfie wajah jelas dari perangkat.");
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    setCameraActive(false);
  };

  const takeSnapshot = () => {
    if (!videoRef.current) return;
    try {
      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 480;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Mirror horizontally for selfie
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        setCapturedFacePhoto(dataUrl);
        stopCamera();
      }
    } catch (err) {
      console.error("Snapshot error:", err);
    }
  };

  // Fallback upload foto wajah
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCapturedFacePhoto(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // GPS Akurat Geolocation Controller
  const requestGpsLocation = () => {
    setGpsStatus("locating");
    setGpsError(null);

    if (!navigator.geolocation) {
      setGpsStatus("error");
      setGpsError("Geolocation tidak didukung oleh peramban ini.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        // Anti-Fake GPS Detection
        const coords: any = pos.coords;
        const isMocked =
          coords.isMocked === true ||
          (pos as any).isMock === true ||
          (coords.mocked === true);

        if (isMocked) {
          setGpsStatus("error");
          setGpsError(
            "⚠️ Peringatan Keamanan: Terdeteksi penggunaan Fake GPS / Mock Location! Matikan aplikasi Fake GPS untuk melanjutkan verifikasi transaksi demi keamanan kedua belah pihak."
          );
          return;
        }

        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const accuracy = Math.round(pos.coords.accuracy || 15);

        if (accuracy <= 0) {
          setGpsStatus("error");
          setGpsError(
            "⚠️ Presisi GPS tidak valid (terindikasi lokasi virtual / fake GPS). Harap gunakan sinyal GPS asli dari perangkat Anda."
          );
          return;
        }

        if (accuracy > 150) {
          setGpsStatus("error");
          setGpsError(
            `⚠️ Akurasi GPS Anda kurang presisi (±${accuracy}m). Demi keamanan transaksi, mohon aktifkan mode Lokasi Akurasi Tinggi (High Accuracy GPS) dan hindari lokasi palsu.`
          );
          return;
        }

        if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
          setGpsStatus("error");
          setGpsError("⚠️ Koordinat GPS tidak valid. Harap gunakan perangkat dengan sensor GPS asli.");
          return;
        }

        if (Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001) {
          setGpsStatus("error");
          setGpsError("⚠️ Koordinat GPS tidak valid (terindikasi emulator/fake GPS). Harap gunakan GPS riil.");
          return;
        }

        let locName = `Koordinat: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        try {
          // Reverse geocoding via Nominatim OpenStreetMap
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14`,
            { headers: { "Accept-Language": "id,en" } }
          );
          if (res.ok) {
            const data = await res.json();
            const addr = data.address;
            const city =
              addr?.city ||
              addr?.town ||
              addr?.county ||
              addr?.state_district ||
              addr?.city_district;
            const state = addr?.state;
            if (city && state) {
              locName = `${city}, ${state} (Presisi ±${accuracy}m)`;
            } else if (data.display_name) {
              locName = data.display_name.split(",").slice(0, 3).join(",") + ` (±${accuracy}m)`;
            }
          }
        } catch {
          locName = `Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)} (Presisi ±${accuracy}m)`;
        }

        setGpsLocation({
          latitude: lat,
          longitude: lng,
          accuracyMeters: accuracy,
          locationName: locName,
        });
        setGpsStatus("success");
      },
      (err) => {
        console.warn("GPS error:", err);
        setGpsStatus("error");
        setGpsError(
          err.message ||
            "Gagal mendapatkan lokasi GPS akurat. Pastikan izin lokasi aktif pada peramban Anda."
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

  // Submit Face ID & GPS Verification to Server
  const handleSubmitVerification = async () => {
    if (!room) return;
    if (!capturedFacePhoto) {
      setErrorMessage("Foto Face ID wajah yang jelas wajib diambil terlebih dahulu.");
      return;
    }
    if (!gpsLocation) {
      setErrorMessage("Lokasi GPS akurat wajib diaktifkan terlebih dahulu.");
      return;
    }

    setIsSubmittingVerification(true);
    setErrorMessage(null);

    try {
      let finalFaceUrl = capturedFacePhoto;

      // Unggah foto Face ID ke Cloudinary
      if (finalFaceUrl && finalFaceUrl.startsWith("data:")) {
        try {
          const upRes = await fetch("/api/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: finalFaceUrl, folder: "face_id" }),
          });
          const upData = await upRes.json();
          if (upData && upData.url) {
            finalFaceUrl = upData.url;
          }
        } catch (uploadErr) {
          console.warn("[Cloudinary] Upload face id photo warning:", uploadErr);
        }
      }

      const res = await fetch(`/api/rooms/${room.id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          facePhotoUrl: finalFaceUrl,
          latitude: gpsLocation.latitude,
          longitude: gpsLocation.longitude,
          accuracyMeters: gpsLocation.accuracyMeters,
          locationName: gpsLocation.locationName,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Gagal menyimpan verifikasi.");
      }

      setRoom(data.room);
      setIsVerifying(false);
      setSuccessNotice(data.message);
      setTimeout(() => setSuccessNotice(null), 6000);
    } catch (err: any) {
      setErrorMessage(err.message || "Gagal memproses verifikasi biometrik & GPS.");
    } finally {
      setIsSubmittingVerification(false);
    }
  };

  // Send Message in Room Chat
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!room || !messageInput.trim() || isSendingMessage) return;

    const content = messageInput.trim();
    setMessageInput("");
    setIsSendingMessage(true);

    try {
      const res = await fetch(`/api/rooms/${room.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderId: currentUser.id,
          content,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Gagal mengirim pesan.");
      }

      setRoom(data.room);
    } catch (err: any) {
      setErrorMessage(err.message || "Gagal mengirim pesan ke room.");
    } finally {
      setIsSendingMessage(false);
    }
  };

  // Hitung sisa hari sebelum kadaluarsa otomatis 1 minggu
  const calculateRemainingTime = (expiresAt: number) => {
    const diff = expiresAt - Date.now();
    if (diff <= 0) return "Kedaluwarsa";
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    return `${days} hari ${hours} jam`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div
        id="modal-transaction-room-box"
        className="bg-slate-900 border border-emerald-500/40 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col my-auto max-h-[95vh]"
      >
        {/* TOP BAR: Room Header */}
        <div className="px-4 py-3.5 sm:px-6 sm:py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 p-0.5 shadow-md flex items-center justify-center shrink-0">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white truncate">
                  Room Transaksi Eksklusif
                </h3>
                {isBothVerified ? (
                  <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/40 flex items-center gap-1 shrink-0">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Aktif
                  </span>
                ) : (
                  <span className="bg-amber-500/20 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/40 flex items-center gap-1 shrink-0">
                    <Lock className="w-3 h-3 text-amber-400" /> Terkunci (Wajib Verifikasi)
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                Antara Penjual <strong className="text-white">@{room?.seller.username}</strong> & Calon Pembeli <strong className="text-white">@{room?.buyer.username}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadRoomData}
              className="p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              title="Perbarui Status Room"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              title="Tutup Room"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* NOTIFIKASI TOAST */}
        {successNotice && (
          <div className="bg-emerald-900/90 text-emerald-200 text-xs px-4 py-2.5 border-b border-emerald-700 flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successNotice}</span>
          </div>
        )}

        {errorMessage && (
          <div className="bg-red-950/90 text-red-200 text-xs px-4 py-2.5 border-b border-red-800 flex items-center gap-2 animate-fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span className="flex-1">{errorMessage}</span>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-red-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* DETAIL BATU MULIA & KESEPAKATAN HARGA */}
        {room && (
          <div className="bg-slate-950/80 px-4 py-3 sm:px-6 border-b border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              {room.gemImage && (
                <img
                  src={room.gemImage}
                  alt={room.gemType}
                  className="w-12 h-12 rounded-xl object-cover border border-emerald-500/30 cursor-pointer hover:opacity-90 shadow-sm"
                  onClick={() =>
                    onOpenFullscreen &&
                    onOpenFullscreen({
                      imageUrl: room.gemImage,
                      title: room.gemType,
                      dimensions: room.dimensions,
                      price: room.agreedPrice,
                      sellerName: room.seller.username,
                    })
                  }
                />
              )}
              <div>
                <div className="font-bold text-white text-sm">{room.gemType}</div>
                <div className="text-slate-400 text-[11px]">{room.dimensions}</div>
                {room.videoUrl && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-teal-400 mt-0.5">
                    <Video className="w-3 h-3" /> Video Detail Tersedia
                  </span>
                )}
              </div>
            </div>

            <div className="flex sm:flex-col items-baseline sm:items-end justify-between w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/80">
              <span className="text-slate-400 text-[11px]">Harga Kesepakatan Negosiasi:</span>
              <span className="text-base sm:text-lg font-black font-mono text-emerald-400">
                {room.agreedPrice}
              </span>
            </div>
          </div>
        )}

        {/* ATURAN KEDALUWARSA 1 MINGGU */}
        {room && (
          <div className="bg-slate-900/90 px-4 py-2 sm:px-6 border-b border-slate-800/80 flex items-center justify-between gap-2 text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5 text-slate-300">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>
                Room otomatis terhapus jika <strong>1 minggu</strong> tidak aktif berkomunikasi.
              </span>
            </span>
            <span className="font-semibold text-emerald-400 bg-slate-950 px-2.5 py-0.5 rounded-full border border-slate-800">
              Sisa Aktif: {calculateRemainingTime(room.expiresAt)}
            </span>
          </div>
        )}

        {/* LOADING STATE */}
        {loading && (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
            <span className="text-sm font-semibold">Menyiapkan Room Transaksi Aman...</span>
          </div>
        )}

        {/* MODAL PERINGATAN WAJIB SEBELUM MENGAKTIFKAN FACE ID & GPS */}
        {showPreSecurityNotice && (
          <div className="p-5 sm:p-8 bg-slate-950/95 flex flex-col items-center text-center justify-center gap-4 animate-fade-in">
            <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border-2 border-amber-500/40 flex items-center justify-center text-amber-400 shadow-xl shadow-amber-500/10">
              <ShieldAlert className="w-8 h-8 animate-pulse" />
            </div>

            <div className="max-w-xl space-y-3">
              <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs sm:text-sm font-extrabold uppercase px-4 py-2.5 rounded-2xl tracking-wide shadow-sm">
                NOTIFIKASI RESMI KEAMANAN TRANSAKSI
              </div>

              {/* Teks Wajib Sesuai Permintaan Persis */}
              <div className="bg-amber-950/60 border-2 border-amber-500/80 p-4 rounded-2xl text-xs sm:text-sm text-amber-200 font-black leading-relaxed shadow-lg">
                UNTUK KEAMANAN DALAM BERTRANSAKSI, PIHAK PENJUAL DAN PEMBELI WAJIB MEMVERIFIKASI WAJAH DAN LOKASI SECARA AKURAT. DATA TERSEBUT AKAN DIKIRIMKAN KE CHATT ROOM. JIKA SALAH SATU TIDAK MENGAKTIFKAN FACE ID DAN GPS AKURAT MAKA ROOM TIDAK AKAN TERBENTUK.
              </div>

              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Untuk mencegah penipuan batu mulia dan menjaga keaslian transaksi bernilai tinggi, sistem komunitas mewajibkan:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left pt-2">
                <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl space-y-1.5">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs sm:text-sm">
                    <Camera className="w-4 h-4" />
                    <span>1. FACE ID (Wajah Jelas)</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Pengambilan potret wajah asli tanpa topeng/penutup agar lawan transaksi mengenali sosok penjual/pembeli.
                  </p>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl space-y-1.5">
                  <div className="flex items-center gap-2 text-teal-400 font-bold text-xs sm:text-sm">
                    <MapPin className="w-4 h-4" />
                    <span>2. GPS AKURAT (Lokasi Nyata)</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Pendeteksian koordinat geografis berpresisi tinggi untuk mengetahui titik domisili kedua belah pihak.
                  </p>
                </div>
              </div>

              <div className="bg-red-950/40 border border-red-800/60 p-3 rounded-xl text-[11px] text-red-300 font-medium">
                ⚠️ Jika salah satu pihak tidak mengaktifkan, room obrolan tidak akan terbentuk dan tidak dapat dimasuki oleh siapapun!
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowPreSecurityNotice(false);
                  setIsVerifying(true);
                  startCamera();
                  requestGpsLocation();
                }}
                className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-xs sm:text-sm px-6 py-3 rounded-2xl transition-all shadow-lg shadow-emerald-900/50 flex items-center gap-2 cursor-pointer hover:scale-102"
              >
                <span>SAYA MENGERTI, AKTIFKAN FACE ID & GPS SEKARANG</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP VERIFIKASI AKTIF: PEMINDAI KAMERA & GPS */}
        {isVerifying && !showPreSecurityNotice && (
          <div className="p-4 sm:p-6 bg-slate-950/90 space-y-5 overflow-y-auto max-h-[70vh]">
            <div className="text-center space-y-1">
              <span className="text-[10px] font-bold tracking-widest text-emerald-400 uppercase bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                Langkah Verifikasi Keamanan Wajib
              </span>
              <h4 className="text-base font-bold text-white">
                Aktifkan Face ID & GPS Akurat Anda
              </h4>
              <p className="text-xs text-slate-400">
                Posisikan wajah Anda dengan jelas dan izinkan akses lokasi berpresisi tinggi
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* BAGIAN 1: FACE ID CAMERA */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col items-center space-y-3">
                <div className="flex items-center justify-between w-full text-xs font-bold text-white border-b border-slate-800 pb-2">
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <Camera className="w-4 h-4" />
                    <span>1. Scan Wajah (Face ID)</span>
                  </span>
                  {capturedFacePhoto ? (
                    <span className="text-emerald-400 text-[10px] flex items-center gap-1 font-semibold">
                      <CheckCircle2 className="w-3 h-3" /> Siap
                    </span>
                  ) : (
                    <span className="text-amber-400 text-[10px]">Wajib Jelas</span>
                  )}
                </div>

                <div className="relative w-56 h-56 sm:w-64 sm:h-64 rounded-2xl bg-black border-2 border-emerald-500/40 overflow-hidden flex items-center justify-center shadow-inner">
                  {capturedFacePhoto ? (
                    <img
                      src={capturedFacePhoto}
                      alt="Hasil Face ID"
                      className="w-full h-full object-cover"
                    />
                  ) : cameraActive ? (
                    <>
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover transform -scale-x-100"
                      />
                      {/* Face recognition guide overlay */}
                      <div className="absolute inset-4 border-2 border-dashed border-emerald-400/70 rounded-full pointer-events-none animate-pulse flex items-center justify-center">
                        <span className="text-[10px] text-emerald-300 font-semibold bg-black/60 px-2 py-0.5 rounded-full">
                          Posisikan Wajah Di Sini
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="text-center p-4 space-y-2">
                      <Camera className="w-8 h-8 text-slate-600 mx-auto" />
                      <p className="text-xs text-slate-500">Kamera belum aktif</p>
                      <button
                        type="button"
                        onClick={startCamera}
                        className="text-xs bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-xl cursor-pointer"
                      >
                        Buka Kamera
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 w-full">
                  {cameraActive && !capturedFacePhoto && (
                    <button
                      type="button"
                      onClick={takeSnapshot}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs py-2 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Ambil Foto Wajah</span>
                    </button>
                  )}

                  {capturedFacePhoto && (
                    <button
                      type="button"
                      onClick={() => {
                        setCapturedFacePhoto(null);
                        startCamera();
                      }}
                      className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs py-2 rounded-xl flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Ulangi Foto</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-3 py-2 rounded-xl cursor-pointer"
                    title="Upload foto dari galeri/file"
                  >
                    Upload File
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="user"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </div>
              </div>

              {/* BAGIAN 2: GPS AKURAT */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-3">
                <div className="space-y-3">
                  <div className="flex items-center justify-between w-full text-xs font-bold text-white border-b border-slate-800 pb-2">
                    <span className="flex items-center gap-1.5 text-teal-400">
                      <MapPin className="w-4 h-4" />
                      <span>2. GPS Akurat (Lokasi)</span>
                    </span>
                    {gpsStatus === "success" ? (
                      <span className="text-emerald-400 text-[10px] flex items-center gap-1 font-semibold">
                        <CheckCircle2 className="w-3 h-3" /> Akurat Terdeteksi
                      </span>
                    ) : gpsStatus === "locating" ? (
                      <span className="text-sky-400 text-[10px] flex items-center gap-1">
                        <RefreshCw className="w-3 h-3 animate-spin" /> Mencari Sinyal GPS...
                      </span>
                    ) : (
                      <span className="text-amber-400 text-[10px]">Wajib Aktif</span>
                    )}
                  </div>

                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800/80 space-y-2">
                    <div className="flex items-center gap-2 text-xs text-slate-300 font-semibold">
                      <Compass className="w-4 h-4 text-teal-400" />
                      <span>Status Deteksi Geolocation:</span>
                    </div>

                    {gpsStatus === "success" && gpsLocation ? (
                      <div className="space-y-1.5 text-xs">
                        <div className="text-emerald-300 font-bold bg-emerald-950/60 p-2.5 rounded-xl border border-emerald-800/60">
                          📍 {gpsLocation.locationName}
                        </div>
                        <div className="text-slate-400 text-[11px] grid grid-cols-2 gap-1 pt-1 font-mono">
                          <span>Lat: {gpsLocation.latitude.toFixed(6)}</span>
                          <span>Lng: {gpsLocation.longitude.toFixed(6)}</span>
                          <span className="col-span-2 text-teal-300">
                            Tingkat Akurasi: Radius ±{gpsLocation.accuracyMeters} meter
                          </span>
                        </div>
                      </div>
                    ) : gpsStatus === "locating" ? (
                      <div className="py-4 text-center text-xs text-sky-300 flex items-center justify-center gap-2">
                        <span className="w-3.5 h-3.5 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
                        <span>Mengunci koordinat GPS akurat...</span>
                      </div>
                    ) : (
                      <div className="py-3 text-center text-xs text-slate-400">
                        {gpsError ? (
                          <span className="text-red-400">{gpsError}</span>
                        ) : (
                          "Klik tombol di bawah untuk mendeteksi koordinat GPS akurat Anda."
                        )}
                      </div>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    GPS akurat memastikan tidak ada manipulasi identitas wilayah antar kedua pihak sebelum kesepakatan batu mulia diserahterimakan.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={requestGpsLocation}
                  disabled={gpsStatus === "locating"}
                  className="w-full bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-slate-950 font-bold text-xs py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <MapPin className="w-4 h-4" />
                  <span>
                    {gpsStatus === "success" ? "Perbarui Koordinat GPS" : "Deteksi Lokasi GPS Akurat"}
                  </span>
                </button>
              </div>
            </div>

            {/* BUTTON SIMPAN DAN SELESAIKAN VERIFIKASI */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  setIsVerifying(false);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSubmitVerification}
                disabled={!capturedFacePhoto || !gpsLocation || isSubmittingVerification}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-slate-950 font-extrabold text-xs sm:text-sm px-6 py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-900/50 flex items-center gap-2 cursor-pointer"
              >
                {isSubmittingVerification ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Menyimpan Verifikasi...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Simpan & Verifikasi Identitas</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* TAMPILAN JIKA BELUM MEMVERIFIKASI / MENUNGGU LAWAN TRANSAKSI */}
        {!loading && !isBothVerified && !isVerifying && !showPreSecurityNotice && (
          <div className="p-6 sm:p-8 bg-slate-950/90 flex flex-col items-center justify-center text-center gap-5">
            {/* Box Status Kedua Pihak */}
            <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-center gap-2 text-amber-400 font-bold text-sm">
                <Lock className="w-4 h-4" />
                <span>Room Belum Terbuka (Akses Dibatasi)</span>
              </div>

              {/* Teks Kebijakan Keamanan Tegas */}
              <div className="bg-amber-950/40 border border-amber-800/60 p-3 rounded-2xl text-xs text-amber-200 font-bold leading-relaxed">
                DEMI KEAMANAN TRANSAKSI MAKA KEDUA BELAH PIHAK WAJIB MENGENALI WAJAH DAN LOKASI YANG JELAS.
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Jika salah satu belum mengaktifkan Face ID dan GPS yang akurat, maka penjual maupun pembeli <strong>tidak bisa masuk</strong> ke room obrolan transaksi ini.
              </p>

              {/* Status List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left pt-2">
                {/* Status Anda */}
                <div
                  className={`p-3.5 rounded-2xl border ${
                    myVerified
                      ? "bg-emerald-950/40 border-emerald-700/80"
                      : "bg-slate-950 border-amber-800/70"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold mb-1">
                    <span className="text-white">Anda ({currentUser.username}):</span>
                    {myVerified ? (
                      <span className="text-emerald-400 text-[10px] flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Lengkap
                      </span>
                    ) : (
                      <span className="text-amber-400 text-[10px] flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Belum
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {myVerified
                      ? "✓ Face ID & GPS Akurat Anda sudah aktif."
                      : "✕ Anda belum mengaktifkan Face ID & GPS."}
                  </p>
                </div>

                {/* Status Lawan Transaksi */}
                <div
                  className={`p-3.5 rounded-2xl border ${
                    otherVerified
                      ? "bg-emerald-950/40 border-emerald-700/80"
                      : "bg-slate-950 border-amber-800/70"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold mb-1">
                    <span className="text-white">Lawan (@{otherParty?.username}):</span>
                    {otherVerified ? (
                      <span className="text-emerald-400 text-[10px] flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Lengkap
                      </span>
                    ) : (
                      <span className="text-amber-400 text-[10px] flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Menunggu
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {otherVerified
                      ? "✓ Lawan transaksi telah terverifikasi."
                      : "⏳ Menunggu lawan mengaktifkan Face ID & GPS."}
                  </p>
                </div>
              </div>
            </div>

            {/* Aksi Sesuai Status Anda */}
            {!myVerified ? (
              <button
                type="button"
                onClick={() => setShowPreSecurityNotice(true)}
                className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-xs sm:text-sm px-6 py-3 rounded-2xl transition-all shadow-lg shadow-emerald-900/50 flex items-center gap-2 cursor-pointer hover:scale-102"
              >
                <Camera className="w-4 h-4" />
                <span>AKTIFKAN FACE ID & GPS AKURAT SAYA</span>
              </button>
            ) : (
              <div className="space-y-2 text-center">
                <div className="text-xs text-slate-300 flex items-center justify-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                  <span>
                    Anda sudah siap! Sistem sedang menunggu <strong>@{otherParty?.username}</strong> mengaktifkan Face ID dan GPS miliknya.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={loadRoomData}
                  className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl flex items-center gap-1.5 mx-auto cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Cek Status Verifikasi Lawan</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAMPILAN JIKA KEDUA BELAH PIHAK SUDAH LENGKAP VERIFIKASI: ROOM CHAT AKTIF */}
        {!loading && isBothVerified && room && (
          <div className="flex flex-col flex-1 min-h-[420px] max-h-[60vh] bg-slate-950">
            {/* KARTU IDENTITAS TERVERIFIKASI KEDUA BELAH PIHAK */}
            <div className="p-3 bg-slate-900/80 border-b border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {/* Penjual */}
              <div className="flex items-center gap-2.5 bg-slate-950/70 p-2 rounded-xl border border-emerald-500/20">
                <img
                  src={room.seller.faceId?.facePhotoUrl || room.seller.userAvatar}
                  alt={room.seller.username}
                  className="w-10 h-10 rounded-full object-cover border-2 border-emerald-400 shadow-sm shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-white text-xs truncate">
                      @{room.seller.username}
                    </span>
                    <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-semibold shrink-0">
                      Penjual
                    </span>
                  </div>
                  <div className="text-[10px] text-teal-300 truncate">
                    📍 {room.seller.gps?.locationName || "GPS Akurat"}
                  </div>
                </div>
              </div>

              {/* Pembeli */}
              <div className="flex items-center gap-2.5 bg-slate-950/70 p-2 rounded-xl border border-teal-500/20">
                <img
                  src={room.buyer.faceId?.facePhotoUrl || room.buyer.userAvatar}
                  alt={room.buyer.username}
                  className="w-10 h-10 rounded-full object-cover border-2 border-teal-400 shadow-sm shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-white text-xs truncate">
                      @{room.buyer.username}
                    </span>
                    <span className="text-[9px] bg-teal-500/20 text-teal-300 px-1.5 py-0.2 rounded font-semibold shrink-0">
                      Pembeli
                    </span>
                  </div>
                  <div className="text-[10px] text-teal-300 truncate">
                    📍 {room.buyer.gps?.locationName || "GPS Akurat"}
                  </div>
                </div>
              </div>
            </div>

            {/* DAFTAR PESAN / KOLOM CHAT */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
              {room.messages.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-xs">
                  Belum ada pesan di room ini. Silakan mulai berdiskusi mengenai pembayaran dan pengiriman batu mulia.
                </div>
              ) : (
                room.messages.map((msg) => {
                  const isMe = msg.senderId === currentUser.id;
                  const isSystem = msg.senderId === "system";

                  if (isSystem) {
                    return (
                      <div
                        key={msg.id}
                        className="bg-emerald-950/40 border border-emerald-800/60 p-3 rounded-2xl text-center max-w-lg mx-auto shadow-sm"
                      >
                        <span className="text-[10px] text-emerald-400 font-bold block mb-0.5">
                          SISTEM KEAMANAN KOMUNITAS
                        </span>
                        <p className="text-xs text-emerald-200 leading-relaxed font-medium">
                          {msg.content}
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={msg.id}
                      className={`flex items-end gap-2 ${
                        isMe ? "justify-end" : "justify-start"
                      }`}
                    >
                      {!isMe && (
                        <img
                          src={msg.senderAvatar}
                          alt={msg.senderName}
                          className="w-7 h-7 rounded-full object-cover border border-slate-700 shrink-0"
                        />
                      )}
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-xs ${
                          isMe
                            ? "bg-emerald-600 text-slate-950 font-medium rounded-br-none shadow-md"
                            : "bg-slate-800 text-slate-100 rounded-bl-none border border-slate-700 shadow-sm"
                        }`}
                      >
                        <div
                          className={`text-[10px] font-bold mb-1 ${
                            isMe ? "text-emerald-950" : "text-emerald-400"
                          }`}
                        >
                          {isMe ? "Anda" : `@${msg.senderName}`}
                        </div>
                        <p className="leading-relaxed break-words whitespace-pre-wrap">
                          {msg.content}
                        </p>
                        <div
                          className={`text-[9px] mt-1 text-right ${
                            isMe ? "text-emerald-900" : "text-slate-400"
                          }`}
                        >
                          {msg.createdAt}
                        </div>
                      </div>
                      {isMe && (
                        <img
                          src={msg.senderAvatar}
                          alt="Anda"
                          className="w-7 h-7 rounded-full object-cover border border-emerald-500 shrink-0"
                        />
                      )}
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* FORM INPUT CHAT */}
            <form
              onSubmit={handleSendMessage}
              className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2"
            >
              <input
                id="input-room-chat-message"
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder={`Tulis pesan atau kesepakatan transaksi dengan @${otherParty?.username}...`}
                className="flex-1 bg-slate-950 border border-slate-700 text-xs text-white px-4 py-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-500"
              />
              <button
                type="submit"
                disabled={!messageInput.trim() || isSendingMessage}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-slate-950 font-bold text-xs p-2.5 sm:px-4 sm:py-2.5 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-md shrink-0"
                title="Kirim Pesan"
              >
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Kirim</span>
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
