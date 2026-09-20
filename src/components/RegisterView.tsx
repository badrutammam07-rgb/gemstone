import React, { useState } from "react";
import { User, Phone, Lock, Eye, EyeOff, ArrowLeft, CheckCircle2, AlertCircle, ShieldCheck } from "lucide-react";
import { User as UserType } from "../types";

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
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!username.trim()) {
      setErrorMessage("Nama untuk username wajib diisi.");
      return;
    }

    if (!phone.trim() || phone.trim().length < 9) {
      setErrorMessage("Silakan masukkan Nomor HP yang valid (minimal 10 digit).");
      return;
    }

    if (!password) {
      setErrorMessage("Password wajib diisi.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Konfirmasi password tidak sesuai dengan password.");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("Password minimal 6 karakter demi keamanan akun.");
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
          password,
          confirmPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Pendaftaran akun gagal.");
      }

      setSuccessMessage("Pendaftaran berhasil! Mengalihkan ke aplikasi...");
      setTimeout(() => {
        onRegisterSuccess(data.user);
      }, 600);
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
          onClick={onNavigateToLogin}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-emerald-400 mb-3 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Kembali ke Halaman Login
        </button>
        <h1 className="text-2xl font-bold tracking-tight text-slate-100">
          Daftar Akun Baru
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Bergabunglah dengan ribuan kolektor & penikmat batu mulia se-Nusantara
        </p>
      </div>

      {/* Main Form Card */}
      <div
        id="card-register"
        className="bg-slate-900/90 rounded-2xl border border-slate-800 shadow-2xl p-6 sm:p-7 backdrop-blur-sm"
      >
        {/* Info Pendaftaran Cepat dengan No HP */}
        <div className="mb-5 bg-emerald-950/60 border border-emerald-800/80 rounded-xl p-3 flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-xs text-emerald-200 leading-relaxed">
            <strong className="font-semibold text-emerald-100">Pendaftaran Langsung dengan No HP</strong>:
            Cukup masukkan nomor handphone aktif Anda untuk registrasi dan login dengan cepat dan aman.
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
          {/* Nama (Username) */}
          <div>
            <label
              htmlFor="input-register-username"
              className="block text-xs font-semibold text-slate-300 mb-1.5"
            >
              Nama Lengkap / Username Komunitas
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <User className="w-4 h-4" />
              </div>
              <input
                id="input-register-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Masukkan nama pengguna"
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-800/80 border border-slate-700 rounded-xl focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all placeholder:text-slate-500 text-slate-100"
                required
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Nama ini akan tampil pada katalog batu mulia dan profil publik Anda
            </p>
          </div>

          {/* Nomor HP */}
          <div>
            <label
              htmlFor="input-register-phone"
              className="block text-xs font-semibold text-slate-300 mb-1.5"
            >
              Nomor Handphone (No HP)
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
                placeholder="Contoh: 081298765432"
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-800/80 border border-slate-700 rounded-xl focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all placeholder:text-slate-500 text-slate-100 font-mono"
                required
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Digunakan untuk masuk akun dan pemulihan kata sandi (Lupa Password)
            </p>
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="input-register-password"
              className="block text-xs font-semibold text-slate-300 mb-1.5"
            >
              Kata Sandi (Password)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="input-register-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                className="w-full pl-10 pr-10 py-2.5 text-sm bg-slate-800/80 border border-slate-700 rounded-xl focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all placeholder:text-slate-500 text-slate-100"
                required
              />
              <button
                id="btn-toggle-register-password"
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Konfirmasi Password */}
          <div>
            <label
              htmlFor="input-register-confirm-password"
              className="block text-xs font-semibold text-slate-300 mb-1.5"
            >
              Konfirmasi Kata Sandi
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="input-register-confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ulangi kata sandi di atas"
                className="w-full pl-10 pr-10 py-2.5 text-sm bg-slate-800/80 border border-slate-700 rounded-xl focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all placeholder:text-slate-500 text-slate-100"
                required
              />
              <button
                id="btn-toggle-register-confirm-password"
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            id="btn-submit-register"
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold py-2.5 px-4 rounded-xl shadow-lg shadow-emerald-950/40 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer pt-2.5 mt-3"
          >
            {isLoading ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Mendaftarkan Akun...
              </span>
            ) : (
              <span>Daftar Akun Sekarang</span>
            )}
          </button>
        </form>

        {/* Link to login */}
        <div className="mt-5 text-center pt-4 border-t border-slate-800">
          <p className="text-xs text-slate-400">
            Sudah memiliki akun?{" "}
            <button
              id="btn-switch-to-login"
              type="button"
              onClick={onNavigateToLogin}
              className="text-emerald-400 hover:text-emerald-300 font-bold hover:underline cursor-pointer"
            >
              Masuk di sini
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
