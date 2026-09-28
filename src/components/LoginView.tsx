import React, { useState, useRef, useEffect } from "react";
import {
  Gem,
  User as UserIcon,
  Camera,
  ArrowRight,
  AlertCircle,
  ShieldCheck,
  ScanFace,
  RefreshCw,
  Lock,
  Sparkles,
  Upload,
} from "lucide-react";
import { User as UserType } from "../types";
import {
  extractFaceDescriptorFromCanvas,
  extractFaceDescriptorFromDataUrl,
} from "../utils/faceIdEngine";

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
  const [username, setUsername] = useState(lockedUser?.username || "");
  const [cameraActive, setCameraActive] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (lockedUser?.username) {
      setUsername(lockedUser.username);
    }
  }, [lockedUser]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    setErrorMessage(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Kamera tidak didukung oleh browser Anda. Silakan unggah foto selfie.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 480 },
          height: { ideal: 480 },
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
      console.warn("[Login Camera Warning]", err);
      setErrorMessage(
        "Kamera tidak dapat diakses langsung. Anda dapat mengunggah foto selfie atau mengizinkan akses kamera browser."
      );
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setCameraActive(false);
  };

  // Eksekusi Verifikasi Face ID ke Server
  const processFaceLogin = async (descriptor: any, photoUrl?: string) => {
    setIsScanning(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/auth/face-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usernameOrPhone: username.trim() || undefined,
          facePhoto: photoUrl,
          faceDescriptor: descriptor,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Verifikasi Face ID tidak berhasil.");
      }

      setSuccessNotice(data.message || `Face ID Cocok! Selamat datang kembali.`);
      stopCamera();

      setTimeout(() => {
        onLoginSuccess(data.user);
      }, 700);
    } catch (err: any) {
      setErrorMessage(err.message || "Gagal masuk menggunakan Face ID.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleCaptureAndLogin = async () => {
    if (!videoRef.current) return;
    setIsScanning(true);
    setErrorMessage(null);

    try {
      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 320;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });

      if (!ctx) throw new Error("Gagal menginisialisasi canvas");

      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
      const descriptor = extractFaceDescriptorFromCanvas(canvas);

      await processFaceLogin(descriptor, dataUrl);
    } catch (err: any) {
      console.error("[Login Snapshot Error]", err);
      setErrorMessage("Gagal menganalisis wajah dari kamera. Silakan coba lagi.");
      setIsScanning(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorMessage("Pilih berkas foto wajah selfie yang valid.");
      return;
    }

    setIsScanning(true);
    setErrorMessage(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const dataUrl = event.target?.result as string;
        const descriptor = await extractFaceDescriptorFromDataUrl(dataUrl);
        await processFaceLogin(descriptor, dataUrl);
      } catch (err: any) {
        console.error("[File Face Parse Error]", err);
        setErrorMessage("Gagal mengekstraksi biometrik wajah dari foto.");
        setIsScanning(false);
      }
    };
    reader.onerror = () => {
      setIsScanning(false);
      setErrorMessage("Gagal membaca berkas gambar.");
    };
    reader.readAsDataURL(file);
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
          Akses aman biometrik Komunitas Pecinta Batu Mulia Nusantara
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
                Aplikasi mendeteksi perpindahan layar ke aplikasi lain selama 5 menit. Silakan pindai Face ID Anda untuk masuk kembali sebagai{" "}
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
            <span className="flex-1 leading-relaxed">{successNotice}</span>
          </div>
        )}

        {/* Field Nama / Nomor HP untuk Memastikan Akun Tidak Tertukar */}
        {/* "Pastikan database face id dan username sama agar saat login tidak tertukar dengan username lain" */}
        <div className="mb-4">
          <label
            htmlFor="input-login-username"
            className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between"
          >
            <span>Nama Lengkap atau Nomor HP</span>
            <span className="text-[11px] text-emerald-400 font-normal">
              Pencocokan 100% Akurat
            </span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <UserIcon className="w-4 h-4" />
            </div>
            <input
              id="input-login-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ketik Nama atau No HP akun Anda"
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-950/70 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-slate-100 placeholder:text-slate-500 transition-all"
            />
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Menjamin Face ID mencocokkan akun Anda secara tepat tanpa tertukar
          </p>
        </div>

        {/* Face ID Viewfinder Box */}
        <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 flex flex-col items-center justify-center p-3 min-h-[230px] mb-4">
          {cameraActive ? (
            <div className="relative w-full flex flex-col items-center">
              <div className="relative w-56 h-56 rounded-full overflow-hidden border-2 border-emerald-400/90 shadow-inner bg-black flex items-center justify-center">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  autoPlay
                  className="w-full h-full object-cover scale-x-[-1]"
                />
                {/* Oval Biometric Target */}
                <div className="absolute inset-0 border-2 border-dashed border-emerald-400 rounded-full pointer-events-none animate-pulse" />
                {/* Scanning Laser Beam */}
                <div className="absolute top-1/2 left-0 right-0 h-1 bg-emerald-400 shadow-[0_0_12px_#10b981] animate-bounce pointer-events-none" />
              </div>
              <p className="text-xs text-emerald-300 font-semibold mt-2.5 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                Posisikan wajah Anda tegak lurus di lingkaran
              </p>

              <div className="flex items-center gap-2 mt-3">
                <button
                  id="btn-scan-and-login"
                  type="button"
                  onClick={handleCaptureAndLogin}
                  disabled={isScanning}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-900/30 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isScanning ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <ScanFace className="w-4 h-4" />
                  )}
                  {isScanning ? "Memverifikasi Biometrik..." : "Pindai Wajah & Masuk"}
                </button>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-3 py-2.5 rounded-xl transition-colors cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-emerald-400 mb-3 shadow-inner">
                <ScanFace className="w-8 h-8" />
              </div>
              <h4 className="text-sm font-semibold text-slate-200">
                Pindai Face ID Biometrik
              </h4>
              <p className="text-xs text-slate-400 max-w-xs mt-1 mb-4">
                Buka kamera untuk memindai wajah Anda dan masuk ke sistem secara otomatis.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  id="btn-open-login-camera"
                  type="button"
                  onClick={startCamera}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-md shadow-emerald-950/30 transition-all cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  Buka Kamera Face ID
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Upload Selfie
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>
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
