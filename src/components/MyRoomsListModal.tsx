import React, { useState, useEffect } from "react";
import {
  X,
  ShieldCheck,
  Lock,
  CheckCircle2,
  Clock,
  ArrowRight,
  MessageSquare,
  RefreshCw,
  ShoppingBag,
} from "lucide-react";
import { User, TransactionRoom } from "../types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onOpenRoom: (roomId: string) => void;
}

export const MyRoomsListModal: React.FC<Props> = ({
  isOpen,
  onClose,
  currentUser,
  onOpenRoom,
}) => {
  const [rooms, setRooms] = useState<TransactionRoom[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchRooms = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/rooms/user/${currentUser.id}`);
      const data = await res.json();
      if (data.success) {
        setRooms(data.rooms || []);
      }
    } catch (err) {
      console.error("Gagal mengambil daftar room:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchRooms();
    }
  }, [isOpen, currentUser.id]);

  const calculateRemaining = (expiresAt: number) => {
    const diff = expiresAt - Date.now();
    if (diff <= 0) return "Kedaluwarsa";
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    return `${days}h ${hours}j tersisa`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div
        id="modal-my-rooms-box"
        className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">
                Daftar Room Transaksi Aman
              </h3>
              <p className="text-xs text-slate-400">
                Room privat berproteksi Face ID & GPS akurat
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchRooms}
              className="p-2 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              title="Perbarui"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              title="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Security Policy Reminder */}
        <div className="bg-amber-950/30 border-b border-amber-900/40 p-3 text-[11px] text-amber-200/90 font-medium flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            Room otomatis terhapus jika 1 minggu tidak ada komunikasi aktif antara penjual & pembeli.
          </span>
        </div>

        {/* Content List */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1">
          {loading ? (
            <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin" />
              <span className="text-xs">Memuat daftar room transaksi...</span>
            </div>
          ) : rooms.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <ShoppingBag className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-sm font-bold text-slate-300">Belum Ada Room Transaksi Aktif</p>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Room otomatis dibuat saat calon pembeli menekan tombol Cekout atas harga negosiasi yang telah disepakati.
              </p>
            </div>
          ) : (
            rooms.map((room) => {
              const isSeller = room.seller.userId === currentUser.id;
              const other = isSeller ? room.buyer : room.seller;
              const isBoth = room.seller.isFullyVerified && room.buyer.isFullyVerified;
              const myParty = isSeller ? room.seller : room.buyer;

              return (
                <div
                  key={room.id}
                  onClick={() => {
                    onOpenRoom(room.id);
                    onClose();
                  }}
                  className="bg-slate-950/80 hover:bg-slate-950 border border-slate-800 hover:border-emerald-500/50 p-3.5 rounded-2xl transition-all cursor-pointer shadow-sm group space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {room.gemImage && (
                        <img
                          src={room.gemImage}
                          alt={room.gemType}
                          className="w-10 h-10 rounded-xl object-cover border border-slate-700 shrink-0"
                        />
                      )}
                      <div className="min-w-0">
                        <h4 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-emerald-400 transition-colors">
                          {room.gemType}
                        </h4>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                          <span>{isSeller ? "Pembeli:" : "Penjual:"} <strong>@{other.username}</strong></span>
                          <span>•</span>
                          <span className="font-mono text-emerald-400 font-bold">{room.agreedPrice}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end shrink-0">
                      {isBoth ? (
                        <span className="bg-emerald-500/10 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Aktif
                        </span>
                      ) : (
                        <span className="bg-amber-500/10 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/30 flex items-center gap-1">
                          <Lock className="w-3 h-3 text-amber-400" /> Menunggu Verifikasi
                        </span>
                      )}
                      <span className="text-[10px] text-slate-500 mt-1">
                        {calculateRemaining(room.expiresAt)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] pt-2 border-t border-slate-900 text-slate-400">
                    <span className="flex items-center gap-1">
                      Status Anda:{" "}
                      <strong className={myParty.isFullyVerified ? "text-emerald-400" : "text-amber-400"}>
                        {myParty.isFullyVerified ? "Sudah Verifikasi" : "Belum Aktifkan Face ID & GPS"}
                      </strong>
                    </span>
                    <span className="text-emerald-400 font-semibold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                      <span>Buka Room</span>
                      <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
