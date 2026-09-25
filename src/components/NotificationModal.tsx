import React from "react";
import {
  Bell,
  X,
  CheckCheck,
  MessageSquare,
  CornerDownRight,
  HandCoins,
  ArrowLeftRight,
  ShieldCheck,
  ShieldAlert,
  ExternalLink,
  Gem,
} from "lucide-react";
import { AppNotification } from "../types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  unreadCount: number;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onNavigateToTarget: (notif: AppNotification) => void;
  onOpenRoom?: (roomId: string, catalogId?: string, offerId?: string) => void;
}

export const NotificationModal: React.FC<Props> = ({
  isOpen,
  onClose,
  notifications,
  unreadCount,
  onMarkAsRead,
  onMarkAllAsRead,
  onNavigateToTarget,
  onOpenRoom,
}) => {
  if (!isOpen) return null;

  const formatRelativeTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Baru saja";
    if (minutes < 60) return `${minutes} menit lalu`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} jam lalu`;
    const days = Math.floor(hours / 24);
    return `${days} hari lalu`;
  };

  const getNotifIcon = (type: AppNotification["type"]) => {
    switch (type) {
      case "offer":
        return <HandCoins className="w-3.5 h-3.5 text-amber-400" />;
      case "counter_offer":
        return <ArrowLeftRight className="w-3.5 h-3.5 text-sky-400" />;
      case "offer_accepted":
        return <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />;
      case "room_invitation":
        return <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />;
      case "room_accepted":
        return <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />;
      case "comment_reply":
        return <CornerDownRight className="w-3.5 h-3.5 text-teal-400" />;
      case "comment":
      default:
        return <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />;
    }
  };

  const getNotifBadgeColor = (type: AppNotification["type"]) => {
    switch (type) {
      case "offer":
        return "bg-amber-500/10 text-amber-300 border-amber-500/30";
      case "counter_offer":
        return "bg-sky-500/10 text-sky-300 border-sky-500/30";
      case "offer_accepted":
        return "bg-emerald-500/10 text-emerald-300 border-emerald-500/30";
      case "room_invitation":
        return "bg-amber-500/15 text-amber-300 border-amber-500/40 animate-pulse";
      case "room_accepted":
        return "bg-emerald-500/15 text-emerald-300 border-emerald-500/40";
      case "comment_reply":
        return "bg-teal-500/10 text-teal-300 border-teal-500/30";
      case "comment":
      default:
        return "bg-emerald-500/10 text-emerald-300 border-emerald-500/30";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div
        id="notification-modal-card"
        className="bg-slate-900 border border-emerald-900/60 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Notifikasi Akun
                </h3>
                {unreadCount > 0 && (
                  <span className="text-[10px] font-black bg-rose-500 text-white px-2 py-0.5 rounded-full shadow-sm">
                    {unreadCount} Baru
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Penawaran harga, komentar, dan balasan pada katalog Anda
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                id="btn-mark-all-read"
                type="button"
                onClick={onMarkAllAsRead}
                className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-emerald-950/60 transition-colors cursor-pointer"
                title="Tandai semua notifikasi sudah dibaca"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tandai Dibaca</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              title="Tutup Notifikasi"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 divide-y divide-slate-800/60">
          {notifications.length === 0 ? (
            <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-500">
                <Bell className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Belum Ada Notifikasi</p>
                <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1">
                  Saat ada anggota yang menawar, berkomentar, atau membalas komentar Anda, pemberitahuannya akan tampil di sini.
                </p>
              </div>
            </div>
          ) : (
            notifications.map((notif) => {
              return (
                <div
                  key={notif.id}
                  id={`notif-item-${notif.id}`}
                  onClick={() => {
                    if (!notif.isRead) {
                      onMarkAsRead(notif.id);
                    }
                    onNavigateToTarget(notif);
                  }}
                  className={`pt-2.5 first:pt-0 group p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 relative ${
                    !notif.isRead
                      ? "bg-emerald-950/30 hover:bg-emerald-950/50 border-emerald-700/50 shadow-sm"
                      : "bg-slate-950/40 hover:bg-slate-800/60 border-slate-800/70"
                  }`}
                >
                  {/* Unread Indicator Dot */}
                  {!notif.isRead && (
                    <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-emerald-400 ring-4 ring-emerald-950" />
                  )}

                  {/* Actor Avatar */}
                  <div className="relative shrink-0">
                    <img
                      src={
                        notif.actorAvatar ||
                        "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=250&q=80"
                      }
                      alt={notif.actorName}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-full object-cover border border-emerald-500/40"
                    />
                    <div className="absolute -bottom-1 -right-1 p-1 bg-slate-900 rounded-full border border-slate-700 shadow-sm">
                      {getNotifIcon(notif.type)}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors">
                        {notif.actorName}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getNotifBadgeColor(
                          notif.type
                        )}`}
                      >
                        {notif.title}
                      </span>
                      <span className="text-[10px] text-slate-500 ml-auto">
                        {formatRelativeTime(notif.createdAt)}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">
                      {notif.message}
                    </p>

                    {/* Tombol aksi cepat untuk ajakan room */}
                    {(notif.type === "room_invitation" || notif.type === "room_accepted") && onOpenRoom && (
                      <div className="mt-2.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!notif.isRead) {
                              onMarkAsRead(notif.id);
                            }
                            if (notif.roomId) {
                              onOpenRoom(notif.roomId, notif.catalogId, notif.offerId);
                            } else {
                              onNavigateToTarget(notif);
                            }
                          }}
                          className={`w-full py-1.5 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all ${
                            notif.type === "room_invitation"
                              ? "bg-amber-500 hover:bg-amber-400 text-slate-950"
                              : "bg-emerald-500 hover:bg-emerald-400 text-slate-950"
                          }`}
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>
                            {notif.type === "room_invitation"
                              ? "Verifikasi Wajah & GPS Untuk Menyetujui Room"
                              : "Masuk ke Room Transaksi"}
                          </span>
                        </button>
                      </div>
                    )}

                    {/* Target Gemstone Reference */}
                    <div className="mt-2 flex items-center justify-between gap-2 pt-1 border-t border-slate-800/60 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1 truncate font-medium text-emerald-400">
                        <Gem className="w-3 h-3 shrink-0" />
                        <span className="truncate">{notif.gemType}</span>
                      </span>

                      <span className="text-[10px] text-slate-400 group-hover:text-emerald-400 font-semibold flex items-center gap-1 shrink-0 transition-colors">
                        <span>Lihat Sasaran</span>
                        <ExternalLink className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Note */}
        <div className="px-5 py-3 bg-slate-950/80 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between shrink-0">
          <span>Klik notifikasi untuk langsung menuju postingan/tawaran</span>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-bold text-slate-300 hover:text-white px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
