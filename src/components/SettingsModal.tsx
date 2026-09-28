import React, { useState } from "react";
import {
  X,
  Settings,
  User as UserIcon,
  Phone,
  AlertCircle,
  CheckCircle2,
  Save,
} from "lucide-react";
import { User } from "../types";

interface Props {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdated: (updatedUser: User) => void;
  onAccountDeleted?: (username: string) => void;
}

export const SettingsModal: React.FC<Props> = ({
  user,
  isOpen,
  onClose,
  onProfileUpdated,
}) => {
  const [newUsername, setNewUsername] = useState(user.username);
  const [newPhone, setNewPhone] = useState(user.phone);

  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!newUsername.trim()) {
      setErrorMessage("Nama lengkap / username wajib diisi.");
      return;
    }

    if (!newPhone.trim() || newPhone.trim().length < 9) {
      setErrorMessage("Silakan masukkan Nomor Telepon yang valid (minimal 10 digit).");
      return;
    }

    setIsSaving(true);

    try {
      const res = await fetch("/api/user/update-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          newUsername: newUsername.trim(),
          newPhone: newPhone.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Gagal memperbarui pengaturan akun.");
      }

      setSuccessMessage(data.message || "Nama dan nomor telepon berhasil disimpan!");
      onProfileUpdated(data.user);
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setErrorMessage(err.message || "Terjadi kesalahan saat menyimpan pengaturan.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      id="modal-settings"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm overflow-y-auto p-4 flex justify-center items-center"
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative my-auto">
        {/* Header */}
        <div className="bg-slate-900/95 backdrop-blur-md p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/20 rounded-xl text-emerald-400">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Pengaturan Akun</h3>
              <p className="text-xs text-slate-400">Hanya dapat mengubah nama dan nomor telepon</p>
            </div>
          </div>
          <button
            id="btn-close-settings-modal"
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSaveSettings} className="p-5 sm:p-6 space-y-4">
          {/* Alerts */}
          {errorMessage && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs p-3 rounded-xl flex items-start gap-2 animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs p-3 rounded-xl flex items-start gap-2 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* 1. Nama Lengkap / Username */}
          <div>
            <label
              htmlFor="settings-username"
              className="block text-xs font-semibold text-slate-300 mb-1.5"
            >
              Nama Lengkap / Username
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <UserIcon className="w-4 h-4" />
              </div>
              <input
                id="settings-username"
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="Masukkan nama lengkap"
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-950 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-slate-100 placeholder:text-slate-500 transition-all"
                required
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Nama ini akan ditampilkan pada katalog dan transaksi komunitas
            </p>
          </div>

          {/* 2. Nomor Telepon */}
          <div>
            <label
              htmlFor="settings-phone"
              className="block text-xs font-semibold text-slate-300 mb-1.5"
            >
              Nomor Telepon (No HP / WhatsApp)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Phone className="w-4 h-4" />
              </div>
              <input
                id="settings-phone"
                type="tel"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="Contoh: 081234567890"
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-950 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-slate-100 placeholder:text-slate-500 transition-all"
                required
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Digunakan untuk kontak transaksi dan notifikasi penawaran
            </p>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              id="btn-save-settings"
              type="submit"
              disabled={isSaving}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-lg shadow-emerald-900/30 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              {isSaving ? "Menyimpan..." : "Simpan Perubahan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
