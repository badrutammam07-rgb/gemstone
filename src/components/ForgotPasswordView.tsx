import React, { useState, useEffect, useRef } from "react";
import {
  Phone,
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  ShieldCheck,
  Send,
  MessageSquare,
  RefreshCw,
  Info,
} from "lucide-react";
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from "firebase/auth";
import { auth } from "../lib/firebase";

interface Props {
  onNavigateToLogin: () => void;
  onPasswordResetSuccess: (username: string) => void;
}

type ForgotStep = "input_phone" | "verify_otp" | "new_password";

export const ForgotPasswordView: React.FC<Props> = ({
  onNavigateToLogin,
  onPasswordResetSuccess,
}) => {
  const [step, setStep] = useState<ForgotStep>("input_phone");
  const [phone, setPhone] = useState("");
  const [formattedPhone, setFormattedPhone] = useState("");
  const [targetUsername, setTargetUsername] = useState("");

  // OTP state
  const [otpCode, setOtpCode] = useState("");
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [countdown, setCountdown] = useState(0);

  // New Password state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

  // Countdown timer for resend OTP
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  // Clean up recaptcha on unmount
  useEffect(() => {
    return () => {
      if (recaptchaVerifierRef.current) {
        try {
          recaptchaVerifierRef.current.clear();
        } catch (e) {
          // ignore
        }
      }
    };
  }, []);

  // Format to Indonesian E.164 (+62...)
  const toE164Phone = (raw: string): string => {
    let clean = raw.trim().replace(/[^0-9]/g, "");
    if (clean.startsWith("0")) {
      return "+62" + clean.slice(1);
    } else if (clean.startsWith("62")) {
      return "+" + clean;
    } else if (!clean.startsWith("+")) {
      return "+62" + clean;
    }
    return clean;
  };

  // 1. STEP 1: Send SMS OTP via Firebase Auth
  const handleSendFirebaseSmsOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const clean = phone.trim();
    if (!clean || clean.length < 9) {
      setErrorMessage("Masukkan nomor HP yang valid (minimal 10 digit).");
      return;
    }

    setIsLoading(true);

    try {
      // 1. First check if phone exists in our database
      const checkRes = await fetch(`/api/auth/check-phone?phone=${encodeURIComponent(clean)}`);
      const checkData = await checkRes.json();

      if (!checkRes.ok || !checkData.success) {
        throw new Error(checkData.message || "Nomor HP tidak ditemukan di database.");
      }

      setTargetUsername(checkData.username || clean);

      // 2. Format to international phone (+62...)
      const e164 = toE164Phone(clean);
      setFormattedPhone(e164);

      // 3. Initialize Firebase RecaptchaVerifier
      if (!recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current = new RecaptchaVerifier(auth, "firebase-recaptcha-container", {
          size: "invisible",
          callback: () => {
            console.log("[Firebase Auth] reCAPTCHA verified successfully.");
          },
          "expired-callback": () => {
            console.warn("[Firebase Auth] reCAPTCHA expired, renewing...");
          },
        });
      }

      console.log(`[Firebase Auth] Sending SMS OTP to ${e164}...`);
      const confirmation = await signInWithPhoneNumber(auth, e164, recaptchaVerifierRef.current);
      setConfirmationResult(confirmation);
      setCountdown(60);
      setStep("verify_otp");
      setSuccessMessage(`Kode verifikasi OTP telah dikirim melalui SMS Firebase ke ${e164}.`);
    } catch (err: any) {
      console.error("[Firebase SMS Error]", err);
      let msg = err.message || "Gagal mengirim SMS verifikasi.";

      if (err.code === "auth/invalid-phone-number") {
        msg = "Format nomor HP tidak valid untuk pengiriman SMS internasional (+62).";
      } else if (err.code === "auth/too-many-requests" || err.code === "auth/quota-exceeded") {
        msg = "Kuota SMS Firebase Auth terlampaui atau terlalu banyak permintaan. Coba beberapa saat lagi atau gunakan nomor uji coba.";
      } else if (err.code === "auth/operation-not-allowed") {
        msg = "Layanan Phone Authentication belum diaktifkan di Firebase Console (Akun: ibnu.92sholihin@gmail.com). Silakan aktifkan Phone Provider di Authentication -> Sign-in method.";
      } else if (err.code === "auth/captcha-check-failed") {
        msg = "Verifikasi keamanan reCAPTCHA gagal. Silakan muat ulang halaman.";
      }

      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // 2. STEP 2: Verify SMS OTP with Firebase
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanOtp = otpCode.trim();
    if (cleanOtp.length < 6) {
      setErrorMessage("Masukkan 6 digit kode OTP yang Anda terima melalui SMS.");
      return;
    }

    if (!confirmationResult) {
      setErrorMessage("Sesi verifikasi telah kedaluwarsa. Silakan kirim ulang kode OTP.");
      return;
    }

    setIsLoading(true);

    try {
      console.log("[Firebase Auth] Verifying OTP code...");
      const result = await confirmationResult.confirm(cleanOtp);
      console.log("[Firebase Auth] Phone verified successfully! User:", result.user.phoneNumber);

      setSuccessMessage("Verifikasi SMS OTP Firebase berhasil! Silakan tentukan kata sandi baru.");
      setStep("new_password");
    } catch (err: any) {
      console.error("[Firebase OTP Verify Error]", err);
      let msg = "Kode OTP yang Anda masukkan salah atau sudah kedaluwarsa.";
      if (err.code === "auth/invalid-verification-code") {
        msg = "Kode OTP tidak valid. Periksa kembali SMS yang Anda terima.";
      } else if (err.code === "auth/code-expired") {
        msg = "Kode OTP telah kedaluwarsa. Silakan klik tombol 'Kirim Ulang Kode'.";
      }
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // 3. STEP 3: Save New Password into Turso Database
  const handleSaveNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!newPassword || newPassword.length < 6) {
      setErrorMessage("Kata sandi baru minimal 6 karakter.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("Konfirmasi kata sandi baru tidak cocok.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/forgot-password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone.trim(),
          newPassword,
          confirmPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Gagal memperbarui kata sandi.");
      }

      setSuccessMessage(
        `Kata sandi untuk akun ${data.username || targetUsername || phone} berhasil diperbarui di database Turso! Mengalihkan ke login...`
      );

      setTimeout(() => {
        onPasswordResetSuccess(data.username || targetUsername || phone);
      }, 1500);
    } catch (err: any) {
      setErrorMessage(err.message || "Terjadi kesalahan saat menyimpan kata sandi.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Invisible reCAPTCHA container for Firebase Phone Auth */}
      <div id="firebase-recaptcha-container"></div>

      {/* Header */}
      <div className="text-center mb-6">
        <button
          id="btn-back-to-login-forgot"
          type="button"
          onClick={onNavigateToLogin}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-emerald-400 mb-3 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Kembali ke Halaman Login
        </button>
        <div className="inline-flex p-2.5 bg-emerald-950/70 text-emerald-400 rounded-2xl mb-2 border border-emerald-800/80">
          <KeyRound className="w-5 h-5" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-100">
          Lupa Kata Sandi
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Verifikasi identitas via SMS Firebase Auth & Simpan ke Database Turso
        </p>
      </div>

      {/* Progress Indicator */}
      <div className="flex items-center justify-between mb-5 px-2">
        <div
          className={`flex items-center gap-1.5 text-xs font-semibold ${
            step === "input_phone"
              ? "text-emerald-400"
              : "text-emerald-600"
          }`}
        >
          <div
            className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
              step === "input_phone"
                ? "bg-emerald-500 text-slate-950"
                : "bg-emerald-900 text-emerald-300"
            }`}
          >
            1
          </div>
          <span>No HP</span>
        </div>
        <div className="h-0.5 flex-1 mx-2 bg-slate-800">
          <div
            className={`h-full bg-emerald-500 transition-all duration-300 ${
              step === "input_phone"
                ? "w-0"
                : step === "verify_otp"
                ? "w-1/2"
                : "w-full"
            }`}
          />
        </div>
        <div
          className={`flex items-center gap-1.5 text-xs font-semibold ${
            step === "verify_otp"
              ? "text-emerald-400"
              : step === "new_password"
              ? "text-emerald-600"
              : "text-slate-500"
          }`}
        >
          <div
            className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
              step === "verify_otp"
                ? "bg-emerald-500 text-slate-950"
                : step === "new_password"
                ? "bg-emerald-900 text-emerald-300"
                : "bg-slate-800 text-slate-400"
            }`}
          >
            2
          </div>
          <span>OTP SMS</span>
        </div>
        <div className="h-0.5 flex-1 mx-2 bg-slate-800">
          <div
            className={`h-full bg-emerald-500 transition-all duration-300 ${
              step === "new_password" ? "w-full" : "w-0"
            }`}
          />
        </div>
        <div
          className={`flex items-center gap-1.5 text-xs font-semibold ${
            step === "new_password" ? "text-emerald-400" : "text-slate-500"
          }`}
        >
          <div
            className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
              step === "new_password"
                ? "bg-emerald-500 text-slate-950"
                : "bg-slate-800 text-slate-400"
            }`}
          >
            3
          </div>
          <span>Password Baru</span>
        </div>
      </div>

      {/* Main Card */}
      <div
        id="card-forgot-password"
        className="bg-slate-900/90 rounded-2xl border border-slate-800 shadow-2xl p-6 sm:p-7 backdrop-blur-sm"
      >
        {/* Error Alert */}
        {errorMessage && (
          <div
            id="alert-forgot-error"
            className="mb-4 bg-red-950/80 border border-red-800 text-red-200 text-xs rounded-xl p-3 flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
            <span className="flex-1 leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {/* Success Alert */}
        {successMessage && (
          <div
            id="alert-forgot-success"
            className="mb-4 bg-emerald-950/80 border border-emerald-700 text-emerald-200 text-xs rounded-xl p-3 flex items-start gap-2"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
            <span className="flex-1 leading-relaxed">{successMessage}</span>
          </div>
        )}

        {/* STEP 1: INPUT PHONE NUMBER */}
        {step === "input_phone" && (
          <form onSubmit={handleSendFirebaseSmsOtp} className="space-y-4">
            <div className="bg-emerald-950/50 border border-emerald-800/80 rounded-xl p-3 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-xs text-emerald-200 leading-relaxed">
                <strong className="font-semibold text-emerald-100">Verifikasi SMS Firebase Auth</strong>:
                Masukkan nomor HP akun Anda. Firebase akan mengirimkan 6 digit kode OTP resmi melalui SMS ke nomor Anda.
              </div>
            </div>

            <div>
              <label
                htmlFor="input-forgot-phone"
                className="block text-xs font-semibold text-slate-300 mb-1.5"
              >
                Nomor Handphone Terdaftar
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Phone className="w-4 h-4" />
                </div>
                <input
                  id="input-forgot-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Contoh: 081234567890"
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-800/80 border border-slate-700 rounded-xl focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all placeholder:text-slate-500 text-slate-100 font-mono"
                  required
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Sistem akan memformat nomor otomatis ke format internasional (+62) untuk SMS
              </p>
            </div>

            <button
              id="btn-send-firebase-sms"
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold py-2.5 px-4 rounded-xl shadow-lg shadow-emerald-950/40 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer mt-2"
            >
              {isLoading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Mengirim SMS via Firebase...
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <Send className="w-4 h-4" />
                  Kirim Kode OTP SMS (Firebase Auth)
                </span>
              )}
            </button>
          </form>
        )}

        {/* STEP 2: VERIFY OTP CODE */}
        {step === "verify_otp" && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
              <div className="text-xs text-slate-300 flex items-center justify-between">
                <span>Kode SMS dikirim ke:</span>
                <span className="font-mono font-bold text-emerald-400">{formattedPhone}</span>
              </div>
              {targetUsername && (
                <div className="text-[11px] text-slate-400 mt-1">
                  Akun: <strong>{targetUsername}</strong>
                </div>
              )}
            </div>

            <div>
              <label
                htmlFor="input-otp-code"
                className="block text-xs font-semibold text-slate-300 mb-1.5"
              >
                Masukkan 6 Digit Kode OTP SMS
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <input
                  id="input-otp-code"
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="Contoh: 123456"
                  className="w-full pl-10 pr-4 py-2.5 text-center text-lg tracking-widest font-mono font-bold bg-slate-800/80 border border-slate-700 rounded-xl focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all placeholder:text-slate-600 text-emerald-400"
                  required
                />
              </div>
            </div>

            <button
              id="btn-verify-firebase-otp"
              type="submit"
              disabled={isLoading || otpCode.length < 6}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold py-2.5 px-4 rounded-xl shadow-lg shadow-emerald-950/40 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Memverifikasi OTP Firebase...
                </span>
              ) : (
                <span>Verifikasi Kode OTP</span>
              )}
            </button>

            {/* Resend OTP & Back */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setStep("input_phone")}
                className="text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                Ganti No HP
              </button>
              <button
                type="button"
                disabled={countdown > 0 || isLoading}
                onClick={() => handleSendFirebaseSmsOtp()}
                className="text-emerald-400 hover:text-emerald-300 font-semibold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer inline-flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${isLoading ? "animate-spin" : ""}`} />
                {countdown > 0 ? `Kirim Ulang (${countdown}s)` : "Kirim Ulang Kode"}
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: SET NEW PASSWORD */}
        {step === "new_password" && (
          <form onSubmit={handleSaveNewPassword} className="space-y-4">
            <div className="bg-emerald-950/60 border border-emerald-800 rounded-xl p-3 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-xs text-emerald-200">
                Verifikasi nomor HP via SMS Firebase berhasil! Silakan masukkan kata sandi baru untuk disimpan di database Turso.
              </div>
            </div>

            {/* Password Baru */}
            <div>
              <label
                htmlFor="input-forgot-new-password"
                className="block text-xs font-semibold text-slate-300 mb-1.5"
              >
                Kata Sandi Baru
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="input-forgot-new-password"
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="w-full pl-10 pr-10 py-2.5 text-sm bg-slate-800/80 border border-slate-700 rounded-xl focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all placeholder:text-slate-500 text-slate-100"
                  required
                />
                <button
                  id="btn-toggle-forgot-password"
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Konfirmasi Password Baru */}
            <div>
              <label
                htmlFor="input-forgot-confirm-password"
                className="block text-xs font-semibold text-slate-300 mb-1.5"
              >
                Konfirmasi Kata Sandi Baru
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="input-forgot-confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ulangi kata sandi baru"
                  className="w-full pl-10 pr-10 py-2.5 text-sm bg-slate-800/80 border border-slate-700 rounded-xl focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all placeholder:text-slate-500 text-slate-100"
                  required
                />
                <button
                  id="btn-toggle-forgot-confirm"
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              id="btn-submit-reset-password"
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold py-2.5 px-4 rounded-xl shadow-lg shadow-emerald-950/40 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer pt-2.5 mt-3"
            >
              {isLoading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Menyimpan ke Database Turso...
                </span>
              ) : (
                <span>Simpan Kata Sandi ke Database Turso</span>
              )}
            </button>
          </form>
        )}

        {/* Account information note */}
        <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1">
            <Info className="w-3 h-3 text-slate-400" />
            Integrasi: Turso + Cloudinary + Firebase
          </span>
          <span className="text-slate-400">ibnu.92sholihin@gmail.com</span>
        </div>
      </div>
    </div>
  );
};
