import React, { useState, useRef } from "react";
import {
  X,
  Settings,
  User as UserIcon,
  Phone,
  Lock,
  Camera,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Upload,
  Image as ImageIcon,
  FileText,
  Sparkles,
  Crop,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { User } from "../types";
import { ProfileCropModal } from "./ProfileCropModal";

interface Props {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdated: (updatedUser: User) => void;
  onAccountDeleted: (username: string) => void;
}

export const SettingsModal: React.FC<Props> = ({
  user,
  isOpen,
  onClose,
  onProfileUpdated,
  onAccountDeleted,
}) => {
  const [avatar, setAvatar] = useState(user.avatar);
  const [bio, setBio] = useState(user.bio || "");
  const [newUsername, setNewUsername] = useState(user.username);
  const [newPhone, setNewPhone] = useState(user.phone);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [photoUploadNotice, setPhotoUploadNotice] = useState<string | null>(null);
  const [cropModalSrc, setCropModalSrc] = useState<string | null>(null);
  const [isCropOpen, setIsCropOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // State untuk Hapus Akun Permanen
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isAgreedDelete, setIsAgreedDelete] = useState(false);
  const [deleteUsernameInput, setDeleteUsernameInput] = useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const isIdentityChanged =
    newUsername.trim() !== user.username || newPhone.trim() !== user.phone;

  // Handle uploading photo from user device (gallery, files, camera)
  const handleFileUpload = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setErrorMessage("Silakan pilih berkas gambar yang valid (JPG, PNG, atau WebP).");
      return;
    }

    setErrorMessage(null);
    setIsProcessingPhoto(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      setIsProcessingPhoto(false);
      setCropModalSrc(e.target?.result as string);
      setIsCropOpen(true);
    };
    reader.onerror = () => {
      setIsProcessingPhoto(false);
      setErrorMessage("Gagal membaca berkas gambar dari perangkat.");
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = (compressedDataUrl: string, sizeKb: string) => {
    setAvatar(compressedDataUrl);
    setPhotoUploadNotice(`Foto berhasil disesuaikan ke lingkaran & terkompresi: ${sizeKb} (Maks 100 KB)`);
    setTimeout(() => setPhotoUploadNotice(null), 5000);
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (newPassword && newPassword !== confirmNewPassword) {
      setErrorMessage("Konfirmasi kata sandi baru tidak cocok.");
      return;
    }

    setIsSaving(true);

    try {
      const res = await fetch("/api/user/update-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          avatar,
          bio: bio.trim(),
          newUsername: newUsername.trim(),
          newPhone: newPhone.trim(),
          currentPassword: currentPassword || undefined,
          newPassword: newPassword || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Gagal memperbarui pengaturan akun.");
      }

      setSuccessMessage(data.message || "Pengaturan profil berhasil disimpan!");
      onProfileUpdated(data.user);
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setErrorMessage(err.message || "Terjadi kesalahan saat menyimpan pengaturan.");
    } finally {
      setIsSaving(false);
    }
  };

  // Fungsi Hapus Akun Permanen setelah disetujui
  const handleConfirmDeleteAccount = async () => {
    setDeleteAccountError(null);

    if (!isAgreedDelete) {
      setDeleteAccountError("Anda harus mencentang persetujuan penghapusan akun permanen terlebih dahulu.");
      return;
    }

    if (deleteUsernameInput.trim().toLowerCase() !== user.username.toLowerCase()) {
      setDeleteAccountError(`Ketik username "${user.username}" secara tepat untuk mengonfirmasi.`);
      return;
    }

    setIsDeletingAccount(true);

    try {
      const res = await fetch("/api/user/delete-account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Gagal menghapus akun dari database.");
      }

      // Akun berhasil dihapus permanen dari database
      setIsDeleteModalOpen(false);
      onClose();
      onAccountDeleted(user.username);
    } catch (err: any) {
      setDeleteAccountError(err.message || "Terjadi kesalahan saat menghapus akun dari database.");
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const sampleAvatarOptions = [
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80",
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80",
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=250&q=80",
    "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=250&q=80",
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=250&q=80",
  ];

  return (
    <div
      id="modal-settings"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl my-8">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/20 rounded-xl text-emerald-400">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Pengaturan Akun & Profil</h3>
              <p className="text-xs text-slate-400">Ubah foto dari perangkat, bio, username, no HP & password</p>
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
        <form onSubmit={handleSaveSettings} className="p-4 sm:p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Alerts */}
          {errorMessage && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs p-3 rounded-xl flex items-start gap-2 animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs p-3 rounded-xl flex items-start gap-2 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* 1. Foto Profil dari Media Perangkat */}
          <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-emerald-400" />
                Foto Profil (Media Perangkat)
              </label>
              <span className="text-[11px] text-slate-400">JPG, PNG, WebP</span>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              {/* Avatar Preview */}
              <div className="relative group shrink-0">
                <img
                  src={avatar}
                  alt="Foto Profil"
                  referrerPolicy="no-referrer"
                  className="w-20 h-20 rounded-full object-cover border-2 border-emerald-400 shadow-md shadow-emerald-950/40"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white text-[10px] font-semibold transition-opacity cursor-pointer"
                  title="Klik untuk memilih foto"
                >
                  <Upload className="w-4 h-4 mb-0.5" />
                  Ubah
                </button>
              </div>

              {/* Upload Controls */}
              <div className="flex-1 w-full space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={onFileInputChange}
                  className="hidden"
                />

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    id="btn-upload-avatar-device"
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessingPhoto}
                    className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shadow-emerald-950/40"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>
                      {isProcessingPhoto ? "Memproses Foto..." : "Unggah dari Galeri / Kamera"}
                    </span>
                  </button>

                  <span className="text-[11px] text-slate-400">atau pilih avatar preset:</span>
                </div>

                {/* Preset Options */}
                <div className="flex items-center gap-1.5 pt-1">
                  {sampleAvatarOptions.map((url, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setAvatar(url);
                        setPhotoUploadNotice("Menggunakan avatar sampel.");
                        setTimeout(() => setPhotoUploadNotice(null), 3000);
                      }}
                      className={`w-7 h-7 rounded-full overflow-hidden border-2 transition-transform cursor-pointer ${
                        avatar === url ? "border-emerald-400 scale-110" : "border-transparent opacity-60 hover:opacity-100"
                      }`}
                      title={`Pilihan avatar ${idx + 1}`}
                    >
                      <img src={url} alt="Preset" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>

                {photoUploadNotice && (
                  <p className="text-[11px] text-emerald-300 font-medium animate-fade-in">
                    ✓ {photoUploadNotice}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* 2. Bio Profil (Dapat dilihat oleh pengunjung profile) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-emerald-400" />
                Bio Profil
              </label>
              <span className={`text-[11px] font-mono ${bio.length > 230 ? "text-amber-400" : "text-slate-400"}`}>
                {bio.length}/250 karakter
              </span>
            </div>
            <textarea
              id="input-settings-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 250))}
              rows={3}
              placeholder="Ceritakan tentang diri Anda, koleksi batu mulia favorit (Bacan, Kalimaya, Safir, Jamrud), daerah asal, atau kontak bisnis..."
              className="w-full bg-slate-950 border border-slate-700 text-xs text-white p-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-500 transition-all resize-none"
            />
            <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-emerald-400 shrink-0" />
              Bio ini dapat dilihat oleh setiap pengunjung yang membuka halaman profil Anda.
            </p>
          </div>

          {/* 3. Username Komunitas */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Username Komunitas
            </label>
            <div className="relative">
              <UserIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="input-settings-username"
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-xs text-white pl-9 pr-3 py-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                required
              />
            </div>
          </div>

          {/* 4. Nomor Telepon */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Nomor Handphone (No HP)
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="input-settings-phone"
                type="tel"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-xs text-white pl-9 pr-3 py-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                required
              />
            </div>
          </div>

          {/* 5. Ganti Password */}
          <div className="pt-2 border-t border-slate-800">
            <span className="text-xs font-bold text-slate-300 block mb-2 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
              Ganti Kata Sandi (Opsional)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Password saat ini"
                  className="w-full bg-slate-950 border border-slate-700 text-xs text-white px-3 py-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Password baru (min. 6)"
                  className="w-full bg-slate-950 border border-slate-700 text-xs text-white px-3 py-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* 6. Hapus Akun Permanen */}
          <div className="pt-3 border-t border-red-950/80">
            <div className="bg-red-950/20 border border-red-900/40 rounded-xl p-3.5 sm:p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-red-400 flex items-center gap-1.5">
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    Hapus Akun Permanen
                  </span>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                    Setelah disetujui, akun Anda dan semua katalog batu mulia yang diunggah akan dihapus permanen dari database.
                  </p>
                </div>
                <button
                  id="btn-open-delete-modal"
                  type="button"
                  onClick={() => {
                    setDeleteAccountError(null);
                    setIsAgreedDelete(false);
                    setDeleteUsernameInput("");
                    setIsDeleteModalOpen(true);
                  }}
                  className="shrink-0 bg-red-600/20 hover:bg-red-600/30 text-red-400 hover:text-red-300 border border-red-700/50 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 self-start sm:self-center shadow-sm"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Hapus Akun...
                </button>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              id="btn-save-settings"
              type="submit"
              disabled={isSaving || isProcessingPhoto}
              className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs px-5 py-2.5 rounded-xl transition-colors cursor-pointer disabled:opacity-60 shadow-md shadow-emerald-950/40"
            >
              {isSaving ? "Menyimpan Data..." : "Simpan Perubahan"}
            </button>
          </div>
        </form>
      </div>

      {/* Confirmation Modal for Permanent Account Deletion */}
      {isDeleteModalOpen && (
        <div
          id="modal-confirm-delete-account"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in"
        >
          <div className="bg-slate-900 border border-red-700/60 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl shadow-red-950/50 relative">
            <div className="flex items-start gap-3.5 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center shrink-0 text-red-400">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-white">
                  Persetujuan Hapus Akun Permanen
                </h3>
                <p className="text-xs text-red-400 mt-0.5">
                  Tindakan ini tidak dapat dibatalkan
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 text-xs text-slate-300 space-y-2 mb-4 leading-relaxed">
              <p>
                Anda akan menghapus akun <strong className="text-white">@{user.username}</strong> ({user.phone}).
              </p>
              <ul className="list-disc list-inside text-[11px] text-slate-400 space-y-1">
                <li>Seluruh data profil dan kredensial Anda akan dihapus permanen dari database.</li>
                <li>Semua postingan batu mulia, gambar katalog, komentar, dan suka akan dimusnahkan.</li>
                <li>Data tidak dapat dipulihkan kembali setelah disetujui.</li>
              </ul>
            </div>

            {deleteAccountError && (
              <div className="mb-4 bg-red-950/60 border border-red-800 text-red-300 text-xs rounded-xl p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                <span>{deleteAccountError}</span>
              </div>
            )}

            {/* Checkbox Persetujuan */}
            <label className="flex items-start gap-2.5 mb-4 cursor-pointer select-none bg-red-950/30 border border-red-900/40 p-3 rounded-xl">
              <input
                id="checkbox-agree-delete-account"
                type="checkbox"
                checked={isAgreedDelete}
                onChange={(e) => setIsAgreedDelete(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-red-700 text-red-600 focus:ring-red-500 cursor-pointer"
              />
              <span className="text-xs text-slate-200 leading-snug">
                Saya telah membaca dan <strong>menyetujui penghapusan akun ini secara permanen</strong> dari database.
              </span>
            </label>

            {/* Verifikasi Ketik Username */}
            <div className="mb-5">
              <label className="block text-[11px] text-slate-400 mb-1.5">
                Ketik username Anda <strong className="text-emerald-400 font-mono">"{user.username}"</strong> untuk konfirmasi:
              </label>
              <input
                id="input-confirm-delete-username"
                type="text"
                value={deleteUsernameInput}
                onChange={(e) => setDeleteUsernameInput(e.target.value)}
                placeholder={user.username}
                className="w-full bg-slate-950 border border-slate-700 text-xs text-white px-3.5 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 font-medium placeholder:text-slate-600"
              />
            </div>

            {/* Tombol Aksi */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={isDeletingAccount}
                className="px-4 py-2.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
              >
                Batal
              </button>
              <button
                id="btn-confirm-delete-account"
                type="button"
                onClick={handleConfirmDeleteAccount}
                disabled={
                  isDeletingAccount ||
                  !isAgreedDelete ||
                  deleteUsernameInput.trim().toLowerCase() !== user.username.toLowerCase()
                }
                className="bg-red-600 hover:bg-red-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-red-950/60 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {isDeletingAccount ? "Menghapus Akun..." : "Setujui & Hapus Akun Permanen"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Photo Crop & Fit Modal */}
      <ProfileCropModal
        isOpen={isCropOpen}
        imageSrc={cropModalSrc}
        onClose={() => setIsCropOpen(false)}
        onConfirm={handleCropComplete}
      />
    </div>
  );
};
