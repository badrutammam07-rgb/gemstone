import React, { useState, useRef, useEffect } from "react";
import {
  User as UserIcon,
  Phone,
  Camera,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
  ScanFace,
} from "lucide-react";
import { User as UserType } from "../types";
import { extractFaceDescriptorFromCanvas } from "../utils/faceIdEngine";

interface Props {
  onRegisterSuccess: (user: UserType) => void;
  onNavigateToLogin: () => void;
}

export const RegisterView: React.FC<Props> = ({
  onRegisterSuccess,
  onNavigateToLogin,
}) => {
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");

  // Username validation state (Memastikan username tidak boleh ada yang sama)
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [usernameFeedback, setUsernameFeedback] = useState<string>("");

  // Face ID Biometric states
  const [cameraActive, setCameraActive] = useState(false);
  const [facePhoto, setFacePhoto] = useState<string | null>(null);
  const [faceDescriptor, setFaceDescriptor] = useState<any | null>(null);
  const [isProcessingFace, setIsProcessingFace] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const checkTimeoutRef = useRef<any>(null);

  // Stop camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);
    };
  }, []);

  // Hubungkan media stream ke elemen video saat cameraActive berubah
  useEffect(() => {
    if (cameraActive && videoRef.current && mediaStreamRef.current) {
      const video = videoRef.current;
      if (video.srcObject !== mediaStreamRef.current) {
        video.srcObject = mediaStreamRef.current;
      }
      video.setAttribute("playsinline", "true");
      video.setAttribute("webkit-playsinline", "true");
      video.muted = true;
      video.play().catch((e) => console.warn("[Register Video Play Effect Warning]", e));
    }
  }, [cameraActive]);

  // Callback ref untuk memastikan elemen video langsung terhubung saat dimuat di DOM
  const attachVideoRef = (el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && mediaStreamRef.current) {
      if (el.srcObject !== mediaStreamRef.current) {
        el.srcObject = mediaStreamRef.current;
      }
      el.setAttribute("playsinline", "true");
      el.setAttribute("webkit-playsinline", "true");
      el.muted = true;
      el.play().catch((e) => console.warn("[Register Video Play Callback Warning]", e));
    }
  };

  // Cek ketersediaan username ke server agar tidak ada username kembar
  const checkUsernameAvailability = async (targetUsername: string) => {
    const trimmed = targetUsername.trim();
    if (!trimmed || trimmed.length < 2) {
      setUsernameStatus("idle");
      setUsernameFeedback("");
      return;
    }

    setUsernameStatus("checking");
    try {
      const res = await fetch(`/api/auth/check-username?username=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (data.available) {
        setUsernameStatus("available");
        setUsernameFeedback(data.message || `Username "${trimmed}" dapat digunakan.`);
      } else {
        setUsernameStatus("taken");
        setUsernameFeedback(data.message || `Username "${trimmed}" sudah digunakan.`);
      }
    } catch {
      setUsernameStatus("idle");
    }
  };

  const handleUsernameChange = (val: string) => {
    setUsername(val);
    if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);
    const trimmed = val.trim();
    if (!trimmed) {
      setUsernameStatus("idle");
      setUsernameFeedback("");
      return;
    }

    checkTimeoutRef.current = setTimeout(() => {
      checkUsernameAvailability(trimmed);
    }, 400);
  };

  const startCamera = async () => {
    setErrorMessage(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error(
          "Kamera tidak didukung oleh browser Anda. Perekaman Face ID memerlukan akses kamera langsung demi keamanan."
        );
      }

      // Ambil stream dengan toleransi fallback jika ideal constraints tidak didukung browser tertentu
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 480, max: 720 },
            height: { ideal: 480, max: 720 },
          },
          audio: false,
        });
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user" },
            audio: false,
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }
      }

      mediaStreamRef.current = stream;
      setCameraActive(true);

      // Play video jika ref sudah siap
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        videoRef.current.setAttribute("webkit-playsinline", "true");
        videoRef.current.muted = true;
        videoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      console.warn("[Register Camera Warning]", err);
      setErrorMessage(
        "Kamera tidak dapat diakses langsung. Mohon izinkan akses kamera perangkat untuk pemindaian biometrik Face ID langsung demi keamanan akun."
      );
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const captureFaceSnapshot = async () => {
    if (!videoRef.current) return;
    setIsProcessingFace(true);
    setErrorMessage(null);

    try {
      const video = videoRef.current;
      if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
        throw new Error("Kamera sedang memuat gambar, silakan tunggu 1 detik lalu tekan lagi.");
      }

      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 320;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });

      if (!ctx) throw new Error("Gagal menginisialisasi canvas");

      // Potong kotak tengah (center-crop) agar proporsi wajah selalu 1:1 sempurna
      const vWidth = video.videoWidth;
      const vHeight = video.videoHeight;
      const minDim = Math.min(vWidth, vHeight);
      const cropX = (vWidth - minDim) / 2;
      const cropY = (vHeight - minDim) / 2;

      // Cerminkan horizontal agar seperti cermin alami
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, cropX, cropY, minDim, minDim, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
      const descriptor = extractFaceDescriptorFromCanvas(canvas);

      setFacePhoto(dataUrl);
      setFaceDescriptor(descriptor);
      stopCamera();
    } catch (err: any) {
      console.error("[Face Capture Error]", err);
      setErrorMessage(err.message || "Gagal menganalisis biometrik wajah. Silakan coba lagi.");
    } finally {
      setIsProcessingFace(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!username.trim()) {
      setErrorMessage("Nama lengkap / username wajib diisi.");
      return;
    }

    if (usernameStatus === "taken") {
      setErrorMessage("Username ini sudah terdaftar. Username tidak boleh ada yang sama!");
      return;
    }

    if (!phone.trim() || phone.trim().length < 9) {
      setErrorMessage("Silakan masukkan Nomor Telepon / HP yang valid (minimal 10 digit).");
      return;
    }

    if (!facePhoto || !faceDescriptor) {
      setErrorMessage("Biometrik Face ID wajib direkam melalui kamera untuk mendaftarkan akun.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          phone: phone.trim(),
          facePhoto,
          faceDescriptor,
        }),
      });

      let data: any = {};
      try {
        data = await response.json();
      } catch {
        throw new Error("Gagal membaca respon server. Silakan coba lagi.");
      }

      if (!response.ok || !data.success) {
        if (data.code === "DUPLICATE_USERNAME") {
          setUsernameStatus("taken");
          setUsernameFeedback(data.message);
        }
        throw new Error(data.message || "Pendaftaran akun gagal.");
      }

      setSuccessMessage(data.message || "Pendaftaran berhasil! Mengalihkan ke aplikasi...");
      setTimeout(() => {
        onRegisterSuccess(data.user);
      }, 700);
    } catch (err: any) {
      setErrorMessage(err.message || "Gagal mendaftarkan akun.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Header */}
      <div className="text-center mb-6">
        <button
          id="btn-back-to-login"
          type="button"
          onClick={() => {
            stopCamera();
            onNavigateToLogin();
          }}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-emerald-400 mb-3 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Kembali ke Halaman Login Face ID
        </button>
        <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center justify-center gap-2">
          <ScanFace className="w-7 h-7 text-emerald-400" />
          Daftar Akun Baru
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Pendaftaran cepat hanya berisi <span className="text-emerald-400 font-semibold">Nama, No Telp, dan Face ID</span>
        </p>
      </div>

      {/* Main Form Card */}
      <div
        id="card-register"
        className="bg-slate-900/90 rounded-2xl border border-slate-800 shadow-2xl p-6 sm:p-7 backdrop-blur-sm"
      >
        {/* Security Info Banner */}
        <div className="mb-5 bg-emerald-950/60 border border-emerald-800/80 rounded-xl p-3 flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-xs text-emerald-200 leading-relaxed">
            <strong className="font-semibold text-emerald-100">Autentikasi Biometrik Face ID</strong>:
            Akun Anda terhubung langsung ke biometrik wajah. Tanpa repot mengingat kata sandi dan dijamin tidak tertukar.
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div
            id="alert-register-error"
            className="mb-4 bg-red-950/80 border border-red-800 text-red-200 text-xs rounded-xl p-3 flex items-start gap-2 animate-shake"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
            <span className="flex-1 leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {/* Success Alert */}
        {successMessage && (
          <div
            id="alert-register-success"
            className="mb-4 bg-emerald-950/80 border border-emerald-700 text-emerald-200 text-xs rounded-xl p-3 flex items-start gap-2"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
            <span className="flex-1 leading-relaxed">{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          {/* 1. Nama Lengkap */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="input-register-username"
                className="block text-xs font-semibold text-slate-300"
              >
                Nama Lengkap / Username
              </label>
              {usernameStatus === "checking" && (
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Memeriksa keunikan...
                </span>
              )}
              {usernameStatus === "available" && (
                <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> {usernameFeedback}
                </span>
              )}
              {usernameStatus === "taken" && (
                <span className="text-[11px] text-red-400 font-semibold flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {usernameFeedback}
                </span>
              )}
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <UserIcon className="w-4 h-4" />
              </div>
              <input
                id="input-register-username"
                type="text"
                value={username}
                onChange={(e) => handleUsernameChange(e.target.value)}
                placeholder="Masukkan nama lengkap unik Anda"
                className={`w-full pl-10 pr-4 py-2.5 text-sm bg-slate-950/70 border rounded-xl focus:outline-none focus:ring-2 focus:border-transparent text-slate-100 placeholder:text-slate-500 transition-all ${
                  usernameStatus === "taken"
                    ? "border-red-500 focus:ring-red-500"
                    : usernameStatus === "available"
                    ? "border-emerald-500/80 focus:ring-emerald-500"
                    : "border-slate-700 focus:ring-emerald-500"
                }`}
                required
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Username wajib unik dan tidak boleh ada yang sama dengan anggota lain.
            </p>
          </div>

          {/* 2. Nomor Telepon */}
          <div>
            <label
              htmlFor="input-register-phone"
              className="block text-xs font-semibold text-slate-300 mb-1.5"
            >
              Nomor Telepon (HP / WhatsApp)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Phone className="w-4 h-4" />
              </div>
              <input
                id="input-register-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Contoh: 081234567890"
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-950/70 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-slate-100 placeholder:text-slate-500 transition-all"
                required
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Nomor aktif untuk keperluan transaksi dan verifikasi komunitas
            </p>
          </div>

          {/* 3. Perekaman Face ID */}
          <div className="pt-2 border-t border-slate-800">
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ScanFace className="w-4 h-4 text-emerald-400" />
                Perekaman Face ID Wajib
              </span>
              {facePhoto && (
                <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Face ID Siap
                </span>
              )}
            </label>

            {/* Viewfinder Camera Box / Captured Preview */}
            <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 flex flex-col items-center justify-center p-3 min-h-[220px]">
              {facePhoto ? (
                // Captured Face Preview
                <div className="flex flex-col items-center py-2 animate-fade-in text-center">
                  <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-emerald-500 shadow-lg shadow-emerald-500/20 mb-3 ring-4 ring-emerald-500/20">
                    <img
                      src={facePhoto}
                      alt="Face ID Preview"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-emerald-500/10 pointer-events-none" />
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 border border-emerald-500/40 rounded-full text-emerald-300 text-xs font-semibold mb-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Biometrik Wajah Berhasil Dipindai
                  </div>
                  <p className="text-[11px] text-slate-400 max-w-xs">
                    Wajah Anda telah tersimpan di database Face ID dan siap digunakan untuk login.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setFacePhoto(null);
                      setFaceDescriptor(null);
                      startCamera();
                    }}
                    className="mt-3 text-xs text-slate-400 hover:text-white flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Pindai Ulang Wajah
                  </button>
                </div>
              ) : cameraActive ? (
                // Live Camera Active
                <div className="relative w-full flex flex-col items-center">
                  <div className="relative w-56 h-56 rounded-full overflow-hidden border-2 border-emerald-400/80 shadow-inner bg-black flex items-center justify-center">
                    <video
                      ref={attachVideoRef}
                      playsInline
                      muted
                      autoPlay
                      onLoadedMetadata={(e) => {
                        (e.target as HTMLVideoElement).play().catch(() => {});
                      }}
                      className="w-full h-full object-cover scale-x-[-1]"
                    />
                    {/* Oval Biometric Guide */}
                    <div className="absolute inset-0 border-2 border-dashed border-emerald-400/60 rounded-full pointer-events-none animate-pulse" />
                    <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-emerald-400/80 shadow-[0_0_10px_#10b981] animate-bounce pointer-events-none" />
                  </div>
                  <p className="text-[11px] text-emerald-300 font-medium mt-2">
                    Posisikan wajah Anda tepat di dalam lingkaran
                  </p>

                  <div className="flex items-center gap-2 mt-3">
                    <button
                      type="button"
                      onClick={captureFaceSnapshot}
                      disabled={isProcessingFace}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-lg shadow-emerald-900/30 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isProcessingFace ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Camera className="w-3.5 h-3.5" />
                      )}
                      {isProcessingFace ? "Menganalisis Biometrik..." : "Ambil Foto Face ID"}
                    </button>
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-3 py-2 rounded-xl transition-colors cursor-pointer"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              ) : (
                // Camera Inactive / Trigger Button
                <div className="text-center py-4 flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-emerald-400 mb-3 shadow-inner">
                    <ScanFace className="w-8 h-8" />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-200">
                    Perekaman Biometrik Wajah Langsung
                  </h4>
                  <p className="text-xs text-slate-400 max-w-xs mt-1 mb-4">
                    Demi keamanan tingkat tinggi, pemindaian wajah wajib dilakukan secara langsung melalui kamera (tanpa upload foto).
                  </p>

                  <button
                    id="btn-start-face-camera"
                    type="button"
                    onClick={startCamera}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-md shadow-emerald-950/20 transition-all cursor-pointer"
                  >
                    <Camera className="w-4 h-4" />
                    Buka Kamera & Pindai Wajah Langsung
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Register Submit Button */}
          <button
            id="btn-submit-register"
            type="submit"
            disabled={isLoading || !facePhoto}
            className="w-full mt-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold py-2.5 px-4 rounded-xl shadow-lg shadow-emerald-950/30 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isLoading ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Mendaftarkan Akun & Face ID...
              </span>
            ) : (
              <>
                <ScanFace className="w-4 h-4" />
                <span>Daftarkan Akun Baru</span>
              </>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-800" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-slate-900 px-3 text-slate-500 font-medium">
              Sudah punya akun terdaftar?
            </span>
          </div>
        </div>

        {/* Back to Login */}
        <button
          id="btn-goto-login-from-register"
          type="button"
          onClick={() => {
            stopCamera();
            onNavigateToLogin();
          }}
          className="w-full bg-slate-800/80 hover:bg-slate-800 text-slate-300 font-semibold py-2.5 px-4 rounded-xl border border-slate-700 transition-colors text-sm flex items-center justify-center gap-2 cursor-pointer"
        >
          Masuk dengan Face ID
        </button>
      </div>
    </div>
  );
};
