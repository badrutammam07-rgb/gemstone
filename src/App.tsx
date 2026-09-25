import React, { useState, useEffect } from "react";
import { LoginView } from "./components/LoginView";
import { RegisterView } from "./components/RegisterView";
import { ForgotPasswordView } from "./components/ForgotPasswordView";
import { HeaderNav } from "./components/HeaderNav";
import { DashboardBeranda } from "./components/DashboardBeranda";
import { ProfileView } from "./components/ProfileView";
import { SettingsModal } from "./components/SettingsModal";
import { ImageViewerModal } from "./components/ImageViewerModal";
import { TransactionRoomModal } from "./components/TransactionRoomModal";
import { MyRoomsListModal } from "./components/MyRoomsListModal";
import { NotificationModal } from "./components/NotificationModal";
import { LiveStreamingModal } from "./components/LiveStreamingModal";
import { User, AppNotification, CatalogItem } from "./types";
import { CheckCircle2 } from "lucide-react";

export default function App() {
  // Navigation states: "login" (first page), "register", "forgot_password", "main"
  const [currentAuthView, setCurrentAuthView] = useState<"login" | "register" | "forgot_password">("login");
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Main app tab state: "beranda" | "profile"
  const [mainView, setMainView] = useState<"beranda" | "profile">("beranda");
  const [viewingUserId, setViewingUserId] = useState<string | undefined>(undefined);

  // Settings modal state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Room Transaksi Modal & List Modal state
  const [activeRoomParams, setActiveRoomParams] = useState<{
    roomId?: string;
    catalogId?: string;
    offerId?: string;
    verificationData?: any;
  } | null>(null);
  const [isMyRoomsListOpen, setIsMyRoomsListOpen] = useState(false);

  // Notification state
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState<number>(0);
  const [isNotifModalOpen, setIsNotifModalOpen] = useState<boolean>(false);
  const [highlightTarget, setHighlightTarget] = useState<{
    catalogId: string;
    offerId?: string;
    commentId?: string;
    type?: string;
  } | null>(null);

  // Live streaming states (RAM Volatile only - Zero DB persistence)
  const [liveStreamSessionState, setLiveStreamSessionState] = useState<{
    isOpen: boolean;
    streamId?: string;
    isHostMode?: boolean;
    pinnedCatalog?: CatalogItem | null;
  } | null>(null);
  const [activeLiveCount, setActiveLiveCount] = useState<number>(0);
  const [userCatalogs, setUserCatalogs] = useState<CatalogItem[]>([]);

  // Lightbox / Fullscreen Image viewer state for gemstone catalogs (avatars are excluded)
  const [fullscreenImage, setFullscreenImage] = useState<{
    imageUrl: string;
    title?: string;
    dimensions?: string;
    price?: string;
    sellerName?: string;
  } | null>(null);

  const [systemNotice, setSystemNotice] = useState<string | null>(null);

  // Check if session exists in storage and verify with backend database
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem("komunitas_batu_mulia_user");
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (parsed && parsed.id) {
          // Verifikasi ke database server apakah akun masih ada
          fetch(`/api/users/${parsed.id}`)
            .then((res) => {
              if (res.ok) return res.json();
              throw new Error("Akun tidak ditemukan di database");
            })
            .then((data) => {
              if (data.success && data.user) {
                setCurrentUser(data.user);
                localStorage.setItem("komunitas_batu_mulia_user", JSON.stringify(data.user));
              } else {
                localStorage.removeItem("komunitas_batu_mulia_user");
                setCurrentUser(null);
              }
            })
            .catch(() => {
              // Akun telah terhapus dari database atau akun dummy lama
              localStorage.removeItem("komunitas_batu_mulia_user");
              setCurrentUser(null);
            });
          return;
        }
      }
      localStorage.removeItem("komunitas_batu_mulia_user");
      setCurrentUser(null);
    } catch {
      localStorage.removeItem("komunitas_batu_mulia_user");
      setCurrentUser(null);
    }
  }, []);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    try {
      localStorage.setItem("komunitas_batu_mulia_user", JSON.stringify(user));
    } catch {}
    setMainView("beranda");
    setViewingUserId(undefined);
  };

  const handleRegisterSuccess = (user: User) => {
    setCurrentUser(user);
    try {
      localStorage.setItem("komunitas_batu_mulia_user", JSON.stringify(user));
    } catch {}
    setMainView("beranda");
    setViewingUserId(undefined);
    setSystemNotice(`Akun ${user.username} berhasil dibuat & tersimpan di database real!`);
    setTimeout(() => setSystemNotice(null), 5000);
  };

  const handlePasswordResetSuccess = (username: string) => {
    setCurrentAuthView("login");
    setSystemNotice(`Password untuk ${username} berhasil diperbarui! Silakan login.`);
    setTimeout(() => setSystemNotice(null), 6000);
  };

  const handleAccountDeleted = (deletedUsername: string) => {
    setIsSettingsOpen(false);
    setCurrentUser(null);
    try {
      localStorage.removeItem("komunitas_batu_mulia_user");
    } catch {}
    setCurrentAuthView("register");
    setSystemNotice(`Akun "${deletedUsername}" telah berhasil dihapus secara permanen dari database. Silakan buat akun baru secara real.`);
    setTimeout(() => setSystemNotice(null), 8000);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem("komunitas_batu_mulia_user");
    } catch {}
    setCurrentAuthView("login");
    setIsSettingsOpen(false);
    setNotifications([]);
    setUnreadNotifCount(0);
  };

  // Ambil data notifikasi akun secara periodik
  const fetchNotifications = async () => {
    if (!currentUser) return;
    try {
      const res = await fetch(`/api/notifications/${currentUser.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setNotifications(data.notifications || []);
          setUnreadNotifCount(data.unreadCount || 0);
        }
      }
    } catch (err) {
      console.error("Gagal mengambil notifikasi:", err);
    }
  };

  // Ambil jumlah active live streams & catalog milik currentUser
  const fetchLiveStatus = async () => {
    try {
      const res = await fetch("/api/live/streams");
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setActiveLiveCount((data.streams || []).length);
        }
      }
    } catch (e) {
      console.warn("Gagal mengambil active live:", e);
    }
  };

  const fetchCurrentUserCatalogs = async () => {
    if (!currentUser) return;
    try {
      const res = await fetch(`/api/user/${currentUser.id}/catalogs`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setUserCatalogs(data.catalogs || []);
        }
      }
    } catch (e) {
      console.warn("Gagal mengambil katalog user:", e);
    }
  };

  useEffect(() => {
    if (!currentUser) return;
    fetchNotifications();
    fetchLiveStatus();
    fetchCurrentUserCatalogs();
    const interval = setInterval(() => {
      fetchNotifications();
      fetchLiveStatus();
    }, 8000);
    return () => clearInterval(interval);
  }, [currentUser?.id]);

  const handleMarkNotifRead = async (notifId: string) => {
    try {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, isRead: true } : n))
      );
      setUnreadNotifCount((prev) => Math.max(0, prev - 1));
      await fetch(`/api/notifications/${notifId}/read`, { method: "POST" });
    } catch (e) {
      console.error("Error mark notif read:", e);
    }
  };

  const handleMarkAllNotifsRead = async () => {
    if (!currentUser) return;
    try {
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadNotifCount(0);
      await fetch(`/api/notifications/${currentUser.id}/read-all`, { method: "POST" });
    } catch (e) {
      console.error("Error mark all notifs read:", e);
    }
  };

  // Arahkan langsung ke sasaran postingan / komentar / penawaran ketika notifikasi diklik
  const handleNavigateToTarget = (notif: AppNotification) => {
    setIsNotifModalOpen(false);
    setMainView("beranda");
    setHighlightTarget({
      catalogId: notif.catalogId,
      offerId: notif.offerId,
      commentId: notif.commentId,
      type: notif.type,
    });
  };

  // If user is logged in, render the main authenticated application
  if (currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
        {/* Header containing User Photo, Username, Followers/Following, Search, Settings Gear & Logout Door */}
        <HeaderNav
          currentUser={currentUser}
          activeView={mainView}
          onSelectView={(view) => {
            setMainView(view);
            if (view === "profile") {
              setViewingUserId(currentUser.id);
            }
          }}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onLogout={handleLogout}
          onSelectOtherUser={(userId) => {
            setViewingUserId(userId);
            setMainView("profile");
          }}
          onOpenRoomsList={() => setIsMyRoomsListOpen(true)}
          unreadNotifCount={unreadNotifCount}
          onOpenNotifications={() => {
            fetchNotifications();
            setIsNotifModalOpen(true);
          }}
          onOpenLiveStream={() => {
            setLiveStreamSessionState({
              isOpen: true,
              isHostMode: true,
            });
          }}
          activeLiveCount={activeLiveCount}
        />

        {/* System Notice Toast */}
        {systemNotice && (
          <div className="max-w-md mx-auto w-full px-4 pt-4 z-20">
            <div className="bg-emerald-600 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{systemNotice}</span>
            </div>
          </div>
        )}

        {/* Main Body: Dashboard Beranda vs Profile View */}
        <main className="flex-1">
          {mainView === "beranda" ? (
            <DashboardBeranda
              currentUser={currentUser}
              onSelectUser={(userId) => {
                setViewingUserId(userId);
                setMainView("profile");
              }}
              onNavigateToProfile={() => {
                setViewingUserId(currentUser.id);
                setMainView("profile");
              }}
              onOpenFullscreen={(data) => setFullscreenImage(data)}
              onOpenTransactionRoom={(params) => setActiveRoomParams(params)}
              highlightTarget={highlightTarget}
              onClearHighlightTarget={() => setHighlightTarget(null)}
              onOpenLiveStream={(streamId) => {
                setLiveStreamSessionState({
                  isOpen: true,
                  streamId,
                  isHostMode: false,
                });
              }}
              onStartLiveHost={() => {
                setLiveStreamSessionState({
                  isOpen: true,
                  isHostMode: true,
                });
              }}
            />
          ) : (
            <ProfileView
              currentUser={currentUser}
              viewingUserId={viewingUserId || currentUser.id}
              onBackToBeranda={() => setMainView("beranda")}
              onOpenSettings={() => setIsSettingsOpen(true)}
              onOpenFullscreen={(data) => setFullscreenImage(data)}
              onOpenTransactionRoom={(params) => setActiveRoomParams(params)}
              onStartLiveWithCatalog={(catalog) => {
                setLiveStreamSessionState({
                  isOpen: true,
                  isHostMode: true,
                  pinnedCatalog: catalog,
                });
              }}
              onRefreshCurrentUser={(updated) => {
                setCurrentUser(updated);
                try {
                  localStorage.setItem("komunitas_batu_mulia_user", JSON.stringify(updated));
                } catch {}
              }}
            />
          )}
        </main>

        {/* Modal Settings (Gear icon) */}
        {isSettingsOpen && (
          <SettingsModal
            user={currentUser}
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            onProfileUpdated={(updated) => {
              setCurrentUser(updated);
              try {
                localStorage.setItem("komunitas_batu_mulia_user", JSON.stringify(updated));
              } catch {}
              setSystemNotice("Pengaturan profil berhasil diperbarui!");
              setTimeout(() => setSystemNotice(null), 4000);
            }}
            onAccountDeleted={handleAccountDeleted}
          />
        )}

        {/* Room Transaksi Eksklusif (Face ID & GPS Akurat) Modal */}
        {activeRoomParams && (
          <TransactionRoomModal
            isOpen={!!activeRoomParams}
            onClose={() => setActiveRoomParams(null)}
            roomId={activeRoomParams.roomId}
            catalogId={activeRoomParams.catalogId}
            offerId={activeRoomParams.offerId}
            currentUser={currentUser}
            initialVerification={activeRoomParams.verificationData}
            onOpenFullscreen={(data) => setFullscreenImage(data)}
          />
        )}

        {/* Daftar Room Transaksi Saya */}
        {isMyRoomsListOpen && (
          <MyRoomsListModal
            isOpen={isMyRoomsListOpen}
            onClose={() => setIsMyRoomsListOpen(false)}
            currentUser={currentUser}
            onOpenRoom={(roomId) => setActiveRoomParams({ roomId })}
          />
        )}

        {/* Fullscreen Image Lightbox Viewer (Hanya untuk foto batu/katalog, foto profil tidak dapat dilihat penuh) */}
        <ImageViewerModal
          isOpen={!!fullscreenImage}
          imageUrl={fullscreenImage?.imageUrl || null}
          title={fullscreenImage?.title}
          dimensions={fullscreenImage?.dimensions}
          price={fullscreenImage?.price}
          sellerName={fullscreenImage?.sellerName}
          onClose={() => setFullscreenImage(null)}
        />

        {/* Modal Notifikasi Akun */}
        <NotificationModal
          isOpen={isNotifModalOpen}
          onClose={() => setIsNotifModalOpen(false)}
          notifications={notifications}
          unreadCount={unreadNotifCount}
          onMarkAsRead={handleMarkNotifRead}
          onMarkAllAsRead={handleMarkAllNotifsRead}
          onNavigateToTarget={handleNavigateToTarget}
          onOpenRoom={(roomId, catalogId, offerId) => {
            setIsNotifModalOpen(false);
            setActiveRoomParams({ roomId, catalogId, offerId });
          }}
        />

        {/* Modal Live Streaming (100% In-Memory - Zero Persistence Database) */}
        {liveStreamSessionState?.isOpen && (
          <LiveStreamingModal
            currentUser={currentUser}
            streamId={liveStreamSessionState.streamId}
            isHostMode={liveStreamSessionState.isHostMode}
            initialPinnedCatalog={liveStreamSessionState.pinnedCatalog}
            userCatalogs={userCatalogs}
            onClose={() => {
              setLiveStreamSessionState(null);
              fetchLiveStatus();
            }}
            onSelectProduct={(catalogId) => {
              setLiveStreamSessionState(null);
              setMainView("beranda");
              setHighlightTarget({ catalogId, type: "offer" });
            }}
          />
        )}
      </div>
    );
  }

  // Unauthenticated Auth views: Login (First page), Register, Forgot Password
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950 flex flex-col justify-between p-4 sm:p-6 lg:p-8 font-sans selection:bg-emerald-500 selection:text-white">
      {/* Background ambient lighting */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -right-40 w-96 h-96 bg-teal-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-emerald-800/10 rounded-full blur-3xl" />
      </div>

      {/* Top Banner Notice */}
      {systemNotice && (
        <div className="max-w-md mx-auto w-full mb-4 z-20">
          <div className="bg-emerald-600 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{systemNotice}</span>
          </div>
        </div>
      )}

      {/* Main Form Views */}
      <div className="my-auto z-10 w-full py-6">
        {currentAuthView === "login" && (
          <LoginView
            onLoginSuccess={handleLoginSuccess}
            onNavigateToRegister={() => {
              setCurrentAuthView("register");
            }}
            onNavigateToForgotPassword={() => {
              setCurrentAuthView("forgot_password");
            }}
          />
        )}

        {currentAuthView === "register" && (
          <RegisterView
            onRegisterSuccess={handleRegisterSuccess}
            onNavigateToLogin={() => {
              setCurrentAuthView("login");
            }}
          />
        )}

        {currentAuthView === "forgot_password" && (
          <ForgotPasswordView
            onNavigateToLogin={() => {
              setCurrentAuthView("login");
            }}
            onPasswordResetSuccess={handlePasswordResetSuccess}
          />
        )}
      </div>

      {/* Footer */}
      <footer className="text-center text-xs text-slate-500 py-4 z-10">
        <p>
          Komunitas Pecinta Batu Mulia Nusantara • Platform Jual Beli & Edukasi
        </p>
      </footer>
    </div>
  );
}
