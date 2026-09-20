import React, { useState } from "react";
import { Phone, Lock, Eye, EyeOff, ArrowLeft, CheckCircle2, AlertCircle, KeyRound, ShieldCheck } from "lucide-react";

interface Props {
  onNavigateToLogin: () => void;
  onPasswordResetSuccess: (username: string) => void;
}

export const ForgotPasswordView: React.FC<Props> = ({
  onNavigateToLogin,
  onPasswordResetSuccess,
}) => {
  const [phone, setPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!phone.trim() || phone.trim().length < 9) {
      setErrorMessage("Silakan masukkan Nomor HP terdaftar yang valid (minimal 10 digit).");
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setErrorMessage("Kata sandi baru minimal 6 karakter.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("Konfirmasi kata sandi baru tidak cocok.");
      return;
    }

    setIsSubmitting(true);

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
        `Kata sandi untuk akun ${data.username || phone} berhasil diperbarui! Mengalihkan ke login...`
      );

      setTimeout(() => {
        onPasswordResetSuccess(data.username || phone);
      }, 1200);
    } catch (err: any) {
      setErrorMessage(err.message || "Terjadi kesalahan saat memperbarui kata sandi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
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
          Atur Ulang Kata Sandi
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Pulihkan akses akun Anda menggunakan Nomor HP terdaftar
        </p>
      </div>

      {/* Main Card */}
      <div
        id="card-forgot-password"
        className="bg-slate-900/90 rounded-2xl border border-slate-800 shadow-2xl p-6 sm:p-7 backdrop-blur-sm"
      >
        <div className="mb-5 bg-emerald-950/60 border border-emerald-800/80 rounded-xl p-3 flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-xs text-emerald-200 leading-relaxed">
            <strong className="font-semibold text-emerald-100">Pemulihan Akun via No HP</strong>:
            Masukkan nomor handphone yang Anda gunakan saat mendaftar beserta kata sandi baru.
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div
            id="alert-forgot-error"
            className="mb-4 bg-red-950/80 border border-red-800 text-red-200 text-xs rounded-xl p-3 flex items-start gap-2 animate-shake"
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

        <form onSubmit={handleResetPassword} className="space-y-4">
          {/* No HP */}
          <div>
            <label
              htmlFor="input-forgot-phone"
              className="block text-xs font-semibold text-slate-300 mb-1.5"
            >
              Nomor Handphone (No HP) Terdaftar
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
                placeholder="Contoh: 081298765432"
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-800/80 border border-slate-700 rounded-xl focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all placeholder:text-slate-500 text-slate-100 font-mono"
                required
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Masukkan nomor HP akun yang ingin Anda perbarui kata sandinya
            </p>
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

          {/* Tombol Simpan Password Baru */}
          <button
            id="btn-submit-reset-password"
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold py-2.5 px-4 rounded-xl shadow-lg shadow-emerald-950/40 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer pt-2.5 mt-3"
          >
            {isSubmitting ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Memperbarui Kata Sandi...
              </span>
            ) : (
              <span>Simpan Kata Sandi Baru</span>
            )}
          </button>
        </form>

        {/* Kembali ke Login */}
        <div className="mt-5 text-center pt-4 border-t border-slate-800">
          <button
            id="btn-cancel-to-login"
            type="button"
            onClick={onNavigateToLogin}
            className="text-xs text-slate-400 hover:text-slate-200 hover:underline cursor-pointer"
          >
            Sudah ingat kata sandi? Masuk di sini
          </button>
        </div>
      </div>
    </div>
  );
};
