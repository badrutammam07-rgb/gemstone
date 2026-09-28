import React, { useState, useRef, useEffect } from "react";
import {
  Camera,
  ArrowRight,
  AlertCircle,
  ShieldCheck,
  ScanFace,
  RefreshCw,
  Lock,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { User as UserType } from "../types";
import { extractFaceDescriptorFromCanvas } from "../utils/faceIdEngine";

interface Props {
  onLoginSuccess: (user: UserType) => void;
  onNavigateToRegister: () => void;
  onNavigateToForgotPassword?: () => void;
  lockedUser?: { username: string; phone?: string; avatar?: string } | null;
}

export const LoginView: React.FC<Props> = ({
  onLoginSuccess,
  onNavigateToRegister,
  lockedUser,
}) => {
  const [cameraActive, setCameraActive] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [identifiedUser, setIdentifiedUser] = useState<UserType | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Otomatis aktifkan kamera saat halaman login dimuat untuk pengalaman Face ID instan
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
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
      video.play().catch((e) => console.warn("[Login Video Play Effect Warning]", e));
    }
  }, [cameraActive]);

  // Callback ref untuk memastikan video langsung menerima media stream saat elemen di-render
  const attachVideoRef = (el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && mediaStreamRef.current) {
      if (el.srcObject !== mediaStreamRef.current) {
        el.srcObject = mediaStreamRef.current;
      }
      el.setAttribute("playsinline", "true");
      el.setAttribute("webkit-playsinline", "true");
      el.muted = true;
      el.play().catch((e) => console.warn("[Login Video Play Callback Warning]", e));
    }
  };

  const startCamera = async () => {
    setErrorMessage(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error(
          "Kamera tidak didukung oleh browser Anda. Pemindaian Face ID wajib menggunakan kamera langsung demi keamanan akun."
        );
      }

      // Ambil stream dengan fallback constraints
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

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        videoRef.current.setAttribute("webkit-playsinline", "true");
        videoRef.current.muted = true;
        videoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      console.warn("[Login Camera Warning]", err);
      setErrorMessage(
        "Kamera belum aktif. Klik tombol 'Buka Kamera Face ID' di bawah dan izinkan akses kamera perangkat Anda untuk masuk."
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

  // Eksekusi Verifikasi Face ID ke Server Murni Tanpa Input Username / No HP
  const processFaceLogin = async (descriptor: any, photoUrl?: string) => {
    setIsScanning(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/auth/face-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Jika sesi terkunci untuk pengguna tertentu, berikan petunjuk opsional
          usernameOrPhone: lockedUser?.username ? lockedUser.username : undefined,
          facePhoto: photoUrl,
          faceDescriptor: descriptor,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Wajah tidak cocok dengan akun terdaftar manapun.");
      }

      setIdentifiedUser(data.user);
      setSuccessNotice(data.message || `Face ID Cocok! Selamat datang kembali, ${data.user.username}.`);
      stopCamera();

      setTimeout(() => {
        onLoginSuccess(data.user);
      }, 800);
    } catch (err: any) {
      setErrorMessage(err.message || "Gagal masuk menggunakan Face ID.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleCaptureAndLogin = async () => {
    if (!videoRef.current) {
      await startCamera();
      return;
    }
    setIsScanning(true);
    setErrorMessage(null);

    try {
      const video = videoRef.current;
      if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
        throw new Error("Kamera masih memuat gambar, mohon tunggu 1 detik lalu klik lagi.");
      }

      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 320;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });

      if (!ctx) throw new Error("Gagal menginisialisasi canvas");

      // Potong kotak tengah (center-crop) agar proporsi wajah 100% konsisten dengan saat mendaftar
      const vWidth = video.videoWidth;
      const vHeight = video.videoHeight;
      const minDim = Math.min(vWidth, vHeight);
      const cropX = (vWidth - minDim) / 2;
      const cropY = (vHeight - minDim) / 2;

      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, cropX, cropY, minDim, minDim, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
      const descriptor = extractFaceDescriptorFromCanvas(canvas);

      await processFaceLogin(descriptor, dataUrl);
    } catch (err: any) {
      console.error("[Login Snapshot Error]", err);
      setErrorMessage(err.message || "Gagal menganalisis wajah dari kamera. Silakan coba lagi.");
      setIsScanning(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Brand Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-700 via-teal-600 to-emerald-400 p-0.5 shadow-xl shadow-emerald-950/20 mb-3 ring-4 ring-emerald-500/20">
          <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center">
            <ScanFace className="w-8 h-8 text-emerald-400 animate-pulse" />
          </div>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100">
          Masuk dengan Face ID
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Cukup pindai wajah — masuk otomatis tanpa ketik username atau nomor HP
        </p>
      </div>

      {/* Main Login Card */}
      <div
        id="card-login"
        className="bg-slate-900/90 rounded-2xl border border-slate-800 shadow-2xl p-6 sm:p-7 backdrop-blur-sm"
      >
        {/* Notice jika sesi terkunci karena berpindah layar > 5 menit */}
        {lockedUser && (
          <div className="mb-5 bg-amber-950/70 border border-amber-700/80 rounded-xl p-3.5 flex items-start gap-3">
            <Lock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-amber-200">
                Sesi Terkunci Otomatis (5 Menit Tidak Aktif)
              </h4>
              <p className="text-xs text-amber-300/90 mt-0.5 leading-relaxed">
                Pindai Face ID Anda untuk melanjutkan sesi akun{" "}
                <strong className="text-white underline">{lockedUser.username}</strong>.
              </p>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div
            id="alert-login-error"
            className="mb-4 bg-red-950/80 border border-red-800 text-red-200 text-xs rounded-xl p-3 flex items-start gap-2 animate-shake"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
            <span className="flex-1 leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {/* Success Alert */}
        {successNotice && (
          <div
            id="alert-login-success"
            className="mb-4 bg-emerald-950/80 border border-emerald-700 text-emerald-200 text-xs rounded-xl p-3 flex items-start gap-2 animate-fade-in"
          >
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
            <div className="flex-1">
              <span className="font-semibold block">{successNotice}</span>
              {identifiedUser && (
                <div className="flex items-center gap-2 mt-1.5 text-emerald-300">
                  {identifiedUser.avatar && (
                    <img
                      src={identifiedUser.avatar}
                      alt={identifiedUser.username}
                      className="w-5 h-5 rounded-full object-cover border border-emerald-400"
                    />
                  )}
                  <span className="text-xs font-bold">Akun: {identifiedUser.username}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Informational Badge */}
        <div className="mb-4 bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Verifikasi Biometrik Super Akurat</span>
          </div>
          <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-2.5 py-0.5 rounded-full">
            100% Bebas Tertukar
          </span>
        </div>

        {/* Face ID Viewfinder Box */}
        <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 flex flex-col items-center justify-center p-3 min-h-[250px] mb-4">
          {cameraActive ? (
            <div className="relative w-full flex flex-col items-center">
              <div className="relative w-56 h-56 rounded-full overflow-hidden border-2 border-emerald-400/90 shadow-[0_0_20px_rgba(16,185,129,0.2)] bg-black flex items-center justify-center">
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
                {/* Oval Biometric Target */}
                <div className="absolute inset-0 border-2 border-dashed border-emerald-400 rounded-full pointer-events-none animate-pulse" />
                {/* Scanning Laser Beam */}
                <div className="absolute top-1/2 left-0 right-0 h-1 bg-emerald-400 shadow-[0_0_12px_#10b981] animate-bounce pointer-events-none" />
              </div>

              <p className="text-xs text-emerald-300 font-semibold mt-3 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
                Posisikan wajah Anda tegak lurus di dalam lingkaran
              </p>

              <div className="w-full flex flex-col gap-2 mt-4">
                <button
                  id="btn-scan-and-login"
                  type="button"
                  onClick={handleCaptureAndLogin}
                  disabled={isScanning}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/40 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isScanning ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <ScanFace className="w-5 h-5" />
                  )}
                  {isScanning ? "Menganalisis Biometrik Wajah..." : "Pindai Wajah & Masuk Sekarang"}
                </button>
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={startCamera}
                    className="text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer py-1"
                  >
                    Segarkan Kamera
                  </button>
                  <span className="text-slate-700">•</span>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer py-1"
                  >
                    Matikan Kamera
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-emerald-400 mb-3 shadow-inner">
                <ScanFace className="w-8 h-8" />
              </div>
              <h4 className="text-sm font-semibold text-slate-200">
                Pindai Face ID Biometrik Langsung
              </h4>
              <p className="text-xs text-slate-400 max-w-xs mt-1 mb-4">
                Login otomatis dengan mengenali wajah Anda. Wajah langsung dipindai real-time tanpa mengetik apapun.
              </p>

              <button
                id="btn-open-login-camera"
                type="button"
                onClick={startCamera}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-6 py-3 rounded-xl flex items-center gap-2 shadow-md shadow-emerald-950/30 transition-all cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                Buka Kamera Face ID
              </button>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-800" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-slate-900 px-3 text-slate-500 font-medium">
              Belum memiliki akun?
            </span>
          </div>
        </div>

        {/* Register Button */}
        <button
          id="btn-goto-register-from-login"
          type="button"
          onClick={() => {
            stopCamera();
            onNavigateToRegister();
          }}
          className="w-full bg-slate-800/80 hover:bg-slate-800 text-slate-300 font-semibold py-2.5 px-4 rounded-xl border border-slate-700 transition-colors text-sm flex items-center justify-center gap-2 cursor-pointer"
        >
          Daftar Akun Baru (Nama, No Telp & Face ID)
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
