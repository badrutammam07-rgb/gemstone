import React, { useState, useRef, useEffect } from "react";
import {
  Gem,
  Settings,
  LogOut,
  Search,
  Users,
  UserCheck,
  User as UserIcon,
  Home,
  X,
  Sparkles,
  ShieldCheck,
  Bell,
  Radio,
} from "lucide-react";
import { User } from "../types";

interface Props {
  currentUser: User;
  activeView: "beranda" | "profile";
  onSelectView: (view: "beranda" | "profile") => void;
  onOpenSettings: () => void;
  onLogout: () => void;
  onSelectOtherUser: (userId: string) => void;
  onOpenRoomsList?: () => void;
  unreadNotifCount?: number;
  onOpenNotifications?: () => void;
  onOpenLiveStream?: () => void;
  activeLiveCount?: number;
}

export const HeaderNav: React.FC<Props> = ({
  currentUser,
  activeView,
  onSelectView,
  onOpenSettings,
  onLogout,
  onSelectOtherUser,
  onOpenRoomsList,
  unreadNotifCount = 0,
  onOpenNotifications,
  onOpenLiveStream,
  activeLiveCount = 0,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handlePerformSearch = async (queryToSearch?: string) => {
    const term = (queryToSearch !== undefined ? queryToSearch : searchQuery).trim();
    if (!term) return;
    setIsSearching(true);
    setShowSearchDropdown(true);
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(term)}`);
      const data = await res.json();
      if (data.success) {
        setSearchResults(data.users || []);
      }
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const onSubmitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    handlePerformSearch();
  };

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(() => {
      handlePerformSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Click outside to close search dropdown and collapse
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchDropdown(false);
        setIsSearchActive(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const followerCount = (currentUser.followers || []).length;
  const followingCount = (currentUser.following || []).length;

  return (
    <header
      id="header-app"
      className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-emerald-900/50 px-3 sm:px-4 lg:px-8 py-2.5 sm:py-3 shadow-xl"
    >
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-4">
        {/* Left: Brand & User Info in Header */}
        <div className="flex items-center justify-between md:justify-start gap-2.5 sm:gap-4 shrink-0">
          {/* Brand Logo */}
          <div
            onClick={() => onSelectView("beranda")}
            className="flex items-center gap-2 cursor-pointer group shrink-0"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-emerald-400 p-0.5 shadow-lg shadow-emerald-900/40 flex items-center justify-center group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-slate-900 rounded-[10px] flex items-center justify-center">
                <Gem className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
              </div>
            </div>
            <div className="hidden xs:block sm:block">
              <span className="text-xs sm:text-base font-bold tracking-tight text-white block leading-tight">
                Komunitas Batu Mulia
              </span>
              <span className="text-[9px] sm:text-[10px] text-emerald-400 font-semibold tracking-wide">
                Nusantara Gemstone
              </span>
            </div>
          </div>

          {/* User Profile Info in Header (Foto, Username, Pengikut, Mengikuti) */}
          <div
            id="header-user-badge"
            onClick={() => onSelectView("profile")}
            className="flex items-center gap-2 sm:gap-3 bg-slate-800/80 hover:bg-slate-800 border border-emerald-500/30 hover:border-emerald-500/60 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-2xl transition-all cursor-pointer shadow-sm shrink-0"
            title="Klik untuk membuka Profil Saya"
          >
            <img
              src={currentUser.avatar}
              alt={currentUser.username}
              referrerPolicy="no-referrer"
              className="w-7 h-7 sm:w-9 sm:h-9 rounded-full object-cover border-2 border-emerald-400 shadow-sm shrink-0"
            />
            <div className="text-left">
              <div className="text-xs sm:text-sm font-bold text-white leading-tight flex items-center gap-1.5 max-w-[130px] sm:max-w-none truncate">
                <span className="truncate">{currentUser.username}</span>
                {activeView === "profile" && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                )}
              </div>
              {/* Followers and Following counters in header */}
              <div className="flex items-center gap-1.5 text-[9px] sm:text-[11px] text-slate-300 mt-0.5 whitespace-nowrap">
                <span className="flex items-center gap-0.5 font-medium">
                  <strong className="text-emerald-400 font-bold">{followerCount}</strong> Pengikut
                </span>
                <span className="text-slate-600">•</span>
                <span className="flex items-center gap-0.5 font-medium">
                  <strong className="text-teal-300 font-bold">{followingCount}</strong> Mengikuti
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Center/Right: Search Bar & Navigation Actions with MODE SCROLL */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between md:justify-end gap-2 sm:gap-3 w-full md:w-auto">
          {/* Kolom Pencarian Username dengan Ukuran Jelas, Panjang Optimal, & Tombol Cari */}
          <div
            ref={searchRef}
            className={`relative transition-all duration-300 ease-in-out w-full sm:w-auto ${
              isSearchActive
                ? "sm:min-w-[280px] md:w-80 lg:w-[420px] z-30"
                : "sm:min-w-[180px] sm:w-60 md:w-56 lg:w-64"
            }`}
          >
            <form onSubmit={onSubmitSearch} className="flex items-center gap-1.5 w-full">
              <div className="relative flex-1">
                <Search
                  className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 transition-colors pointer-events-none ${
                    isSearchActive ? "text-emerald-400" : "text-slate-400"
                  }`}
                />
                <input
                  id="input-search-users"
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onFocus={() => {
                    setIsSearchActive(true);
                    setShowSearchDropdown(true);
                  }}
                  onClick={() => {
                    setIsSearchActive(true);
                    setShowSearchDropdown(true);
                  }}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSearchDropdown(true);
                  }}
                  placeholder="Cari username kolektor..."
                  className={`w-full bg-slate-950/90 border ${
                    isSearchActive
                      ? "border-emerald-400 ring-2 ring-emerald-500/30 bg-slate-950 text-white shadow-lg shadow-emerald-950/30"
                      : "border-slate-700/80 text-white"
                  } text-xs sm:text-sm pl-9 pr-8 py-2 rounded-xl focus:outline-none transition-all placeholder:text-slate-500 font-medium`}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setSearchResults([]);
                      if (searchInputRef.current) searchInputRef.current.focus();
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5"
                    title="Hapus ketikan pencarian"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Tombol Klik Cari */}
              <button
                type="submit"
                id="btn-search-user-submit"
                className="px-3 sm:px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs sm:text-sm rounded-xl flex items-center gap-1.5 shadow-md shadow-emerald-950/50 transition-all shrink-0 cursor-pointer border border-emerald-400/40 hover:shadow-emerald-500/20"
                title="Klik untuk mencari username kolektor"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Cari</span>
              </button>
            </form>

            {/* Search Dropdown Results */}
            {showSearchDropdown && (searchQuery.trim().length > 0 || isSearching) && (
              <div className="absolute top-full mt-2 left-0 right-0 bg-slate-900/98 border border-slate-700 rounded-xl shadow-2xl p-2 z-50 max-h-72 overflow-y-auto backdrop-blur-md">
                {isSearching ? (
                  <div className="p-3 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                    <span>Mencari username...</span>
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="p-3 text-center text-xs text-slate-400">
                    Tidak ditemukan kolektor dengan username "{searchQuery}"
                  </div>
                ) : (
                  searchResults.map((usr) => (
                    <div
                      key={usr.id}
                      onClick={() => {
                        onSelectOtherUser(usr.id);
                        setShowSearchDropdown(false);
                        setIsSearchActive(false);
                        setSearchQuery("");
                      }}
                      className="flex items-center justify-between p-2.5 hover:bg-slate-800/90 rounded-lg cursor-pointer transition-colors group"
                    >
                      <div className="flex items-center gap-2.5">
                        <img
                          src={usr.avatar}
                          alt={usr.username}
                          className="w-8 h-8 rounded-full object-cover border border-emerald-500/40 group-hover:border-emerald-400 transition-colors"
                        />
                        <div>
                          <p className="text-xs sm:text-sm font-bold text-white leading-tight group-hover:text-emerald-300 transition-colors">
                            {usr.username}
                          </p>
                          <p className="text-[10px] text-slate-400">{usr.role || "Kolektor Gemstone"}</p>
                        </div>
                      </div>
                      <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                        {usr.followersCount || 0} Pengikut
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* 🔄 MODE SCROLL: Bar Navigasi & Aksi (Jika layar sempit / tidak muat, geser mulus tanpa merusak tampilan) */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-none py-1 px-0.5 w-full sm:w-auto shrink-0 touch-scroll select-none">
            {/* Navigation Tabs (Beranda vs Profil) */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
              <button
                id="btn-nav-beranda"
                type="button"
                onClick={() => onSelectView("beranda")}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  activeView === "beranda"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
                title="Dashboard Beranda Postingan"
              >
                <Home className="w-3.5 h-3.5 shrink-0" />
                <span className="whitespace-nowrap">Beranda</span>
              </button>
              <button
                id="btn-nav-profile"
                type="button"
                onClick={() => onSelectView("profile")}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  activeView === "profile"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
                title="Katalog & Profil Saya"
              >
                <Gem className="w-3.5 h-3.5 shrink-0" />
                <span className="whitespace-nowrap">Profil & Katalog</span>
              </button>
            </div>

            {/* Tombol Live Streaming Interaktif */}
            {onOpenLiveStream && (
              <button
                id="btn-nav-live-stream"
                type="button"
                onClick={onOpenLiveStream}
                className="relative px-2.5 sm:px-3 py-1.5 text-xs font-black bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white rounded-xl shadow-md shadow-rose-900/40 transition-all flex items-center gap-1.5 cursor-pointer border border-rose-400/40 active:scale-95 shrink-0"
                title="Live Streaming Jual Beli Batu Mulia"
              >
                <Radio className="w-3.5 h-3.5 animate-pulse text-white shrink-0" />
                <span className="uppercase tracking-wide whitespace-nowrap">Live</span>
                {activeLiveCount > 0 && (
                  <span className="ml-1 bg-white text-rose-700 text-[10px] font-black px-1.5 py-0.2 rounded-full">
                    {activeLiveCount}
                  </span>
                )}
              </button>
            )}

            {/* Lonceng Notifikasi Akun */}
            <button
              id="btn-nav-notifications"
              type="button"
              onClick={onOpenNotifications}
              className="relative p-2 text-slate-300 hover:text-emerald-400 bg-slate-800/90 hover:bg-emerald-950/60 border border-slate-700/80 hover:border-emerald-500/40 rounded-xl transition-all cursor-pointer shadow-sm shrink-0"
              title="Notifikasi Penawaran & Komentar Akun Anda"
            >
              <Bell className="w-4 h-4 shrink-0" />
              {unreadNotifCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white font-black text-[10px] rounded-full flex items-center justify-center animate-pulse shadow-md border-2 border-slate-900">
                  {unreadNotifCount > 99 ? "99+" : unreadNotifCount}
                </span>
              )}
            </button>

            {/* Tombol Akses Cepat Room Transaksi */}
            {onOpenRoomsList && (
              <button
                id="btn-nav-rooms"
                type="button"
                onClick={onOpenRoomsList}
                className="px-2.5 py-1.5 text-xs font-bold bg-slate-800/90 hover:bg-emerald-950/60 text-slate-300 hover:text-emerald-400 border border-slate-700/80 hover:border-emerald-500/40 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shrink-0"
                title="Daftar Room Transaksi Berproteksi Face ID & GPS"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="whitespace-nowrap">Room Transaksi</span>
              </button>
            )}

            {/* Logo Gear (Settings) */}
            <button
              id="btn-open-settings"
              type="button"
              onClick={onOpenSettings}
              className="p-2 text-slate-400 hover:text-emerald-400 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-xl transition-all cursor-pointer shadow-sm hover:rotate-45 shrink-0"
              title="Logo Gear: Pengaturan Profil, Password, Username & No HP"
            >
              <Settings className="w-4 h-4 shrink-0" />
            </button>

            {/* Logo Pintu (Logout) */}
            <button
              id="btn-door-logout"
              type="button"
              onClick={onLogout}
              className="p-2 text-slate-400 hover:text-red-400 bg-slate-800/80 hover:bg-red-500/10 border border-slate-700/80 hover:border-red-500/30 rounded-xl transition-all cursor-pointer shadow-sm shrink-0"
              title="Logo Pintu: Keluar / Logout Akun"
            >
              <LogOut className="w-4 h-4 shrink-0" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
