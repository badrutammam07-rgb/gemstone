import React, { useState, useRef, useEffect } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  Camera,
  MapPin,
  ChevronRight,
  RefreshCw,
  Compass,
  AlertCircle,
  X,
  Lock,
} from "lucide-react";

export interface VerificationResult {
  facePhotoUrl: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  locationName: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  role: "buyer" | "seller";
  title?: string;
  gemType: string;
  agreedPrice: string;
  counterPartyName: string;
  onVerified: (result: VerificationResult) => Promise<void> | void;
}

export const TransactionSecurityVerificationModal: React.FC<Props> = ({
  isOpen,
  onClose,
  role,
  title,
  gemType,
  agreedPrice,
  counterPartyName,
  onVerified,
}) => {
  const [step, setStep] = useState<"notice" | "verify">("notice");
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedFacePhoto, setCapturedFacePhoto] = useState<string | null>(null);
  const [gpsLocation, setGpsLocation] = useState<{
    latitude: number;
    longitude: number;
    accuracyMeters: number;
    locationName: string;
  } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<"idle" | "locating" | "success" | "error">("idle");
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Reset state saat modal dibuka
  useEffect(() => {
    if (isOpen) {
      setStep("notice");
      setCapturedFacePhoto(null);
      setGpsLocation(null);
      setGpsStatus("idle");
      setGpsError(null);
      setErrorMessage(null);
      setIsSubmitting(false);
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async () => {
    setErrorMessage(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Kamera tidak didukung oleh browser ini. Silakan gunakan tombol upload file wajah.");
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
        videoRef.current.play().catch(() => {});
      }
      setCameraActive(true);
    } catch (err: any) {
      console.warn("Camera access warning:", err);
      setErrorMessage(
        "Tidak dapat mengaktifkan kamera secara otomatis. Izinkan izin kamera pada browser Anda atau unggah foto selfie wajah jelas dari perangkat."
      );
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCapturedFacePhoto(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const requestGpsLocation = () => {
    setGpsStatus("locating");
    setGpsError(null);

    if (!navigator.geolocation) {
      setGpsStatus("error");
      setGpsError("Geolocation tidak didukung oleh browser Anda.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        // Anti-Fake GPS Detection
        // 1. Check coordinates object for mock location flags (supported in modern Android WebViews / browsers)
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

        // 2. Reject impossible / suspicious accuracy values
        // Fake GPS applications often inject hardcoded accuracy == 0 or accuracy < 0.5m without satellite variance
        // Or extremely low accuracy (e.g. > 150m) which indicates imprecise/simulated location
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

        // 3. Reject invalid latitude / longitude extremes
        if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
          setGpsStatus("error");
          setGpsError("⚠️ Koordinat GPS tidak valid. Harap gunakan perangkat dengan sensor GPS asli.");
          return;
        }

        // 4. Reject exact zero coordinates (Null Island simulation)
        if (Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001) {
          setGpsStatus("error");
          setGpsError("⚠️ Koordinat GPS tidak valid (terindikasi emulator/fake GPS). Harap gunakan GPS riil.");
          return;
        }

        let locName = `Koordinat: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        try {
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
            "Gagal mendapatkan lokasi GPS akurat. Pastikan izin lokasi (GPS) diizinkan pada browser/perangkat Anda."
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

  const handleStartVerification = () => {
    setStep("verify");
    startCamera();
    requestGpsLocation();
  };

  const handleSubmit = async () => {
    if (!capturedFacePhoto) {
      setErrorMessage("Foto scan Face ID wajah yang jelas wajib diaktifkan demi keamanan transaksi.");
      return;
    }
    if (!gpsLocation) {
      setErrorMessage("Akses lokasi GPS yang akurat wajib diaktifkan demi keamanan transaksi.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      let finalFaceUrl = capturedFacePhoto;
      if (finalFaceUrl.startsWith("data:")) {
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

      await onVerified({
        facePhotoUrl: finalFaceUrl,
        latitude: gpsLocation.latitude,
        longitude: gpsLocation.longitude,
        accuracyMeters: gpsLocation.accuracyMeters,
        locationName: gpsLocation.locationName,
      });

      stopCamera();
    } catch (err: any) {
      setErrorMessage(err.message || "Gagal memproses verifikasi biometrik & GPS.");
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div
        id="modal-transaction-security-verification"
        className="bg-slate-900 border border-emerald-900/60 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]"
      >
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white leading-tight">
                {title || (role === "buyer" ? "Pengajuan Pembuatan Room Transaksi" : "Persetujuan Room Transaksi")}
              </h3>
              <p className="text-[11px] text-slate-400">
                {gemType} • Kesepakatan: <span className="text-emerald-400 font-bold">{agreedPrice}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            disabled={isSubmitting}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            title="Batal & Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
          {step === "notice" ? (
            /* STEP 1: NOTIFIKASI WAJIB AKTIFKAN KAMERA (FACE ID) & GPS AKURAT */
            <div className="flex flex-col items-center text-center space-y-4 py-2 animate-fade-in">
              <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border-2 border-amber-500/40 flex items-center justify-center text-amber-400 shadow-xl shadow-amber-500/10">
                <ShieldAlert className="w-8 h-8 animate-pulse" />
              </div>

              <div className="max-w-lg space-y-2.5">
                <div className="inline-block bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-extrabold uppercase px-3 py-1 rounded-xl">
                  {role === "buyer"
                    ? "NOTIFIKASI PERSIAPAN BUAT ROOM TRANSAKSI"
                    : "NOTIFIKASI AJAKAN ROOM DARI PEMBELI"}
                </div>

                <div className="bg-amber-950/60 border-2 border-amber-500/80 p-4 rounded-2xl text-xs sm:text-sm text-amber-200 font-black leading-relaxed shadow-lg">
                  UNTUK KEAMANAN DALAM BERTRANSAKSI, PIHAK PENJUAL DAN PEMBELI WAJIB MEMVERIFIKASI WAJAH DAN LOKASI SECARA AKURAT. DATA TERSEBUT AKAN DIKIRIMKAN KE CHATT ROOM. JIKA SALAH SATU TIDAK MENGAKTIFKAN FACE ID DAN GPS AKURAT MAKA ROOM TIDAK AKAN TERBENTUK.
                </div>

                <p className="text-xs text-slate-300 leading-relaxed pt-1">
                  {role === "buyer" ? (
                    <>
                      Sebelum pembuatan room dengan penjual (<strong>@{counterPartyName}</strong>) dilanjutkan, Anda wajib mengaktifkan <strong>kamera untuk Face ID</strong> dan juga <strong>GPS yang akurat</strong>.
                    </>
                  ) : (
                    <>
                      Ada ajakan room transaksi dari pembeli (<strong>@{counterPartyName}</strong>). Saat Anda menyetujui, Anda sebagai penjual juga <strong>wajib mengaktifkan kamera untuk Face ID</strong> dan juga <strong>GPS yang akurat</strong>.
                    </>
                  )}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left pt-2">
                  <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-2xl space-y-1">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                      <Camera className="w-4 h-4" />
                      <span>1. Kamera Face ID</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Potret wajah asli yang jelas tanpa masker/penutup agar pihak lawan dapat mengenali sosok asli Anda.
                    </p>
                  </div>

                  <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-2xl space-y-1">
                    <div className="flex items-center gap-2 text-teal-400 font-bold text-xs">
                      <MapPin className="w-4 h-4" />
                      <span>2. GPS yang Akurat</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Pendeteksian titik koordinat geolocation berakurasi tinggi untuk memastikan lokasi riil Anda.
                    </p>
                  </div>
                </div>

                <div className="bg-red-950/40 border border-red-800/60 p-3 rounded-xl text-[11px] text-red-300 font-medium">
                  ⚠️ Keduanya wajib mengaktifkan kamera & GPS akurat. Jika salah satu pihak menolak, room transaksi obrolan aman tidak akan pernah terbuka.
                </div>
              </div>

              <div className="pt-2 w-full flex flex-col sm:flex-row gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleStartVerification}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm py-3 px-5 rounded-xl transition-all shadow-lg shadow-emerald-900/50 flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.01]"
                >
                  <span>
                    {role === "buyer"
                      ? "AKTIFKAN KAMERA & GPS, LALU AJUKAN ROOM"
                      : "AKTIFKAN KAMERA & GPS, LALU SETUJUI ROOM"}
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            /* STEP 2: FORM PENGAMBILAN KAMERA FACE ID & GPS AKURAT */
            <div className="space-y-4 animate-fade-in">
              <div className="text-center space-y-1">
                <span className="text-[10px] font-bold tracking-widest text-emerald-400 uppercase bg-emerald-500/10 px-3 py-0.5 rounded-full border border-emerald-500/20">
                  Verifikasi Wajib Sebelum Room Aktif
                </span>
                <h4 className="text-sm sm:text-base font-bold text-white">
                  Aktifkan Kamera Face ID & GPS Akurat Anda
                </h4>
                <p className="text-xs text-slate-400">
                  Pastikan wajah Anda tampak jelas dan sistem mengunci koordinat GPS Anda
                </p>
              </div>

              {errorMessage && (
                <div className="bg-red-950/80 border border-red-800 text-red-200 text-xs rounded-xl p-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. Face ID Camera */}
                <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-3.5 flex flex-col items-center space-y-2.5">
                  <div className="flex items-center justify-between w-full text-xs font-bold text-white border-b border-slate-800 pb-2">
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <Camera className="w-4 h-4" />
                      <span>1. Kamera Face ID</span>
                    </span>
                    {capturedFacePhoto ? (
                      <span className="text-emerald-400 text-[10px] flex items-center gap-1 font-semibold">
                        <ShieldCheck className="w-3 h-3" /> Wajah Terambil
                      </span>
                    ) : (
                      <span className="text-amber-400 text-[10px]">Wajib Jelas</span>
                    )}
                  </div>

                  <div className="relative w-48 h-48 sm:w-52 sm:h-52 rounded-2xl bg-black border-2 border-emerald-500/40 overflow-hidden flex items-center justify-center shadow-inner">
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
                        <div className="absolute inset-3 border-2 border-dashed border-emerald-400/70 rounded-full pointer-events-none animate-pulse flex items-center justify-center">
                          <span className="text-[9px] text-emerald-300 font-semibold bg-black/60 px-2 py-0.5 rounded-full">
                            Posisikan Wajah
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="text-center p-3 space-y-2">
                        <Camera className="w-7 h-7 text-slate-600 mx-auto" />
                        <p className="text-[11px] text-slate-500">Kamera belum menyala</p>
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
                        className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs py-2 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                      >
                        <Camera className="w-3.5 h-3.5" />
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
                        <RefreshCw className="w-3 h-3" />
                        <span>Foto Ulang</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-2.5 py-2 rounded-xl cursor-pointer"
                      title="Upload foto dari file"
                    >
                      Upload
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

                {/* 2. GPS Akurat */}
                <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-3.5 flex flex-col justify-between space-y-2.5">
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between w-full text-xs font-bold text-white border-b border-slate-800 pb-2">
                      <span className="flex items-center gap-1.5 text-teal-400">
                        <MapPin className="w-4 h-4" />
                        <span>2. GPS yang Akurat</span>
                      </span>
                      {gpsStatus === "success" ? (
                        <span className="text-emerald-400 text-[10px] flex items-center gap-1 font-semibold">
                          <ShieldCheck className="w-3 h-3" /> Akurat Terkunci
                        </span>
                      ) : gpsStatus === "locating" ? (
                        <span className="text-sky-400 text-[10px] flex items-center gap-1">
                          <RefreshCw className="w-3 h-3 animate-spin" /> Mengunci GPS...
                        </span>
                      ) : (
                        <span className="text-amber-400 text-[10px]">Wajib Aktif</span>
                      )}
                    </div>

                    <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs text-slate-300 font-semibold">
                        <Compass className="w-3.5 h-3.5 text-teal-400" />
                        <span>Koordinat GPS Nyata:</span>
                      </div>

                      {gpsStatus === "success" && gpsLocation ? (
                        <div className="space-y-1 text-xs">
                          <div className="text-emerald-300 font-bold bg-emerald-950/60 p-2 rounded-lg border border-emerald-800/60 text-[11px]">
                            📍 {gpsLocation.locationName}
                          </div>
                          <div className="text-slate-400 text-[10px] grid grid-cols-2 gap-1 pt-1 font-mono">
                            <span>Lat: {gpsLocation.latitude.toFixed(5)}</span>
                            <span>Lng: {gpsLocation.longitude.toFixed(5)}</span>
                            <span className="col-span-2 text-teal-300 font-sans">
                              Akurasi: Radius ±{gpsLocation.accuracyMeters} meter
                            </span>
                          </div>
                        </div>
                      ) : gpsStatus === "locating" ? (
                        <div className="py-4 text-center text-xs text-sky-300 flex items-center justify-center gap-2">
                          <span className="w-3 h-3 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
                          <span>Mencari koordinat presisi tinggi...</span>
                        </div>
                      ) : (
                        <div className="py-3 text-center text-xs text-slate-400">
                          {gpsError ? (
                            <span className="text-red-400 text-[11px]">{gpsError}</span>
                          ) : (
                            "Klik tombol deteksi untuk mengunci koordinat GPS akurat Anda."
                          )}
                        </div>
                      )}
                    </div>

                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Titik GPS akurat mencegah penipuan lokasi dan memastikan keaslian transaksi batu mulia.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={requestGpsLocation}
                    disabled={gpsStatus === "locating"}
                    className="w-full bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-slate-950 font-bold text-xs py-2 rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>
                      {gpsStatus === "success" ? "Kunci Ulang GPS" : "Deteksi GPS Akurat Sekarang"}
                    </span>
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    stopCamera();
                    setStep("notice");
                  }}
                  disabled={isSubmitting}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
                >
                  Kembali
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!capturedFacePhoto || !gpsLocation || isSubmitting}
                  className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-black text-xs sm:text-sm px-6 py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-900/50 flex items-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Menyimpan & Memproses...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>
                        {role === "buyer"
                          ? "Ajukan & Buat Room Transaksi"
                          : "Setujui & Buka Room Transaksi"}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
