import React, { useState } from "react";
import { Gem, Lock, User, Eye, EyeOff, ArrowRight, AlertCircle, ShieldCheck } from "lucide-react";
import { User as UserType } from "../types";

interface Props {
  onLoginSuccess: (user: UserType) => void;
  onNavigateToRegister: () => void;
  onNavigateToForgotPassword: () => void;
}

export const LoginView: React.FC<Props> = ({
  onLoginSuccess,
  onNavigateToRegister,
  onNavigateToForgotPassword,
}) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!username.trim()) {
      setErrorMessage("Silakan masukkan username atau nomor telepon Anda.");
      return;
    }

    if (!password) {
      setErrorMessage("Silakan masukkan password akun Anda.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      let data: any = {};
      try {
        const rawText = await response.text();
        data = JSON.parse(rawText);
      } catch (parseErr) {
        console.error("[Login] Response parse error:", parseErr);
        throw new Error("Gagal memproses respon masuk. Silakan coba lagi.");
      }

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Gagal masuk. Periksa username dan password.");
      }

      // Login success
      onLoginSuccess(data.user);
    } catch (err: any) {
      setErrorMessage(err.message || "Terjadi kesalahan pada sistem backend.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Gemstone Brand Badge */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-700 via-teal-600 to-emerald-400 p-0.5 shadow-xl shadow-emerald-950/20 mb-4 ring-4 ring-emerald-500/20">
          <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center">
            <Gem className="w-8 h-8 text-emerald-400 animate-pulse" />
          </div>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          Komunitas Pecinta Batu Mulia
        </h1>
        <p className="text-sm text-slate-600 mt-2">
          Ruang silaturahmi, edukasi lab, bursa, dan koleksi permata Nusantara
        </p>
      </div>

      {/* Main Login Card */}
      <div
        id="card-login"
        className="bg-white/95 rounded-2xl border border-slate-200/90 shadow-xl shadow-slate-200/50 p-6 sm:p-8 backdrop-blur-sm"
      >
        <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Masuk ke Akun</h2>
            <p className="text-xs text-slate-500">Gunakan kredensial yang telah didaftarkan</p>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full border border-emerald-200/60">
            <ShieldCheck className="w-3.5 h-3.5" />
            Keamanan Terenkripsi
          </span>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div
            id="alert-login-error"
            className="mb-5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl p-3 flex items-start gap-2 animate-shake"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
            <span className="flex-1 leading-relaxed">{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          {/* Username / No HP */}
          <div>
            <label
              htmlFor="input-username"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Username / No HP
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                id="input-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Masukkan username atau No HP"
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50/50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all placeholder:text-slate-400 text-slate-900"
                required
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Gunakan username atau nomor handphone yang telah terdaftar
            </p>
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="input-password"
                className="text-xs font-semibold text-slate-700"
              >
                Password
              </label>
              <button
                id="btn-goto-forgot-password"
                type="button"
                onClick={onNavigateToForgotPassword}
                className="text-xs text-emerald-700 hover:text-emerald-800 font-medium hover:underline"
              >
                Lupa Password?
              </button>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="input-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan kata sandi akun"
                className="w-full pl-10 pr-10 py-2.5 text-sm bg-slate-50/50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all placeholder:text-slate-400 text-slate-900"
                required
              />
              <button
                id="btn-toggle-password-visibility"
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Login Submit Button */}
          <button
            id="btn-submit-login"
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold py-2.5 px-4 rounded-xl shadow-md shadow-emerald-900/10 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {isLoading ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Memverifikasi Akun...
              </span>
            ) : (
              <>
                <span>Masuk ke Komunitas</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-white px-3 text-slate-500 font-medium">
              Belum punya akun permata?
            </span>
          </div>
        </div>

        {/* Register Button */}
        <button
          id="btn-goto-register"
          type="button"
          onClick={onNavigateToRegister}
          className="w-full bg-slate-50 hover:bg-slate-100 text-slate-800 font-semibold py-2.5 px-4 rounded-xl border border-slate-300 transition-colors text-sm flex items-center justify-center gap-2"
        >
          Daftar Akun Baru
        </button>
      </div>

      {/* Footer Info */}
      <div className="text-center mt-6">
        <p className="text-xs text-slate-500">
          Data tersimpan aman di server backend • Bebas biaya registrasi
        </p>
      </div>
    </div>
  );
};
