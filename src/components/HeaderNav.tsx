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
}

export const HeaderNav: React.FC<Props> = ({
  currentUser,
  activeView,
  onSelectView,
  onOpenSettings,
  onLogout,
  onSelectOtherUser,
  onOpenRoomsList,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery.trim())}`);
        const data = await res.json();
        if (data.success) {
          setSearchResults(data.users || []);
        }
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Click outside to close search dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchDropdown(false);
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
      className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-emerald-900/50 px-4 lg:px-8 py-3 shadow-xl"
    >
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        {/* Left: Brand & User Info in Header */}
        <div className="flex items-center justify-between md:justify-start gap-3 sm:gap-4">
          {/* Brand Logo */}
          <div
            onClick={() => onSelectView("beranda")}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-emerald-400 p-0.5 shadow-lg shadow-emerald-900/40 flex items-center justify-center group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-slate-900 rounded-[10px] flex items-center justify-center">
                <Gem className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
            <div className="hidden sm:block">
              <span className="text-sm sm:text-base font-bold tracking-tight text-white block leading-tight">
                Komunitas Batu Mulia
              </span>
              <span className="text-[10px] text-emerald-400 font-semibold tracking-wide">
                Nusantara Gemstone
              </span>
            </div>
          </div>

          {/* User Profile Info in Header (Foto, Username, Pengikut, Mengikuti) */}
          <div
            id="header-user-badge"
            onClick={() => onSelectView("profile")}
            className="flex items-center gap-3 bg-slate-800/80 hover:bg-slate-800 border border-emerald-500/30 hover:border-emerald-500/60 px-3 py-1.5 rounded-2xl transition-all cursor-pointer shadow-sm"
            title="Klik untuk membuka Profil Saya"
          >
            <img
              src={currentUser.avatar}
              alt={currentUser.username}
              referrerPolicy="no-referrer"
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover border-2 border-emerald-400 shadow-sm"
            />
            <div className="text-left">
              <div className="text-xs sm:text-sm font-bold text-white leading-tight flex items-center gap-1.5">
                <span>{currentUser.username}</span>
                {activeView === "profile" && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                )}
              </div>
              {/* Followers and Following counters in header */}
              <div className="flex items-center gap-2 text-[10px] sm:text-[11px] text-slate-300 mt-0.5">
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

        {/* Center/Right: Search Bar, Tabs, Settings Gear & Door Logout */}
        <div className="flex items-center justify-between md:justify-end gap-2 sm:gap-3 w-full md:w-auto">
          {/* Search Box */}
          <div ref={searchRef} className="relative flex-1 sm:w-64 md:w-56 lg:w-64">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="input-search-users"
                type="text"
                value={searchQuery}
                onFocus={() => setShowSearchDropdown(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSearchDropdown(true);
                }}
                placeholder="Cari username kolektor..."
                className="w-full bg-slate-950/90 border border-slate-700/80 text-xs text-white pl-8 pr-7 py-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setSearchResults([]);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Search Dropdown Results */}
            {showSearchDropdown && searchQuery.trim() && (
              <div className="absolute top-full mt-2 left-0 right-0 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 z-50 max-h-60 overflow-y-auto">
                {isSearching ? (
                  <div className="p-3 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                    <span className="w-3 h-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                    <span>Mencari username...</span>
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="p-3 text-center text-xs text-slate-500">
                    Tidak ditemukan kolektor dengan username "{searchQuery}"
                  </div>
                ) : (
                  searchResults.map((usr) => (
                    <div
                      key={usr.id}
                      onClick={() => {
                        onSelectOtherUser(usr.id);
                        setShowSearchDropdown(false);
                        setSearchQuery("");
                      }}
                      className="flex items-center justify-between p-2 hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <img
                          src={usr.avatar}
                          alt={usr.username}
                          className="w-7 h-7 rounded-full object-cover border border-emerald-500/40"
                        />
                        <div>
                          <p className="text-xs font-bold text-white leading-tight">
                            {usr.username}
                          </p>
                          <p className="text-[10px] text-slate-400">{usr.role}</p>
                        </div>
                      </div>
                      <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                        {usr.followersCount} Pengikut
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Navigation Tabs (Beranda vs Profil) */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
            <button
              id="btn-nav-beranda"
              type="button"
              onClick={() => onSelectView("beranda")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeView === "beranda"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
              title="Dashboard Beranda Postingan"
            >
              <Home className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Beranda</span>
            </button>
            <button
              id="btn-nav-profile"
              type="button"
              onClick={() => onSelectView("profile")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeView === "profile"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
              title="Katalog & Profil Saya"
            >
              <Gem className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Profil & Katalog</span>
            </button>
          </div>

          {/* Tombol Akses Cepat Room Transaksi */}
          {onOpenRoomsList && (
            <button
              id="btn-nav-rooms"
              type="button"
              onClick={onOpenRoomsList}
              className="px-2.5 py-1.5 text-xs font-bold bg-slate-800/90 hover:bg-emerald-950/60 text-slate-300 hover:text-emerald-400 border border-slate-700/80 hover:border-emerald-500/40 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Daftar Room Transaksi Berproteksi Face ID & GPS"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="hidden md:inline">Room Transaksi</span>
            </button>
          )}

          {/* Logo Gear (Settings) */}
          <button
            id="btn-open-settings"
            type="button"
            onClick={onOpenSettings}
            className="p-2 text-slate-400 hover:text-emerald-400 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-xl transition-all cursor-pointer shadow-sm hover:rotate-45"
            title="Logo Gear: Pengaturan Profil, Password, Username & No HP"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Logo Pintu (Logout) */}
          <button
            id="btn-door-logout"
            type="button"
            onClick={onLogout}
            className="p-2 text-slate-400 hover:text-red-400 bg-slate-800/80 hover:bg-red-500/10 border border-slate-700/80 hover:border-red-500/30 rounded-xl transition-all cursor-pointer shadow-sm"
            title="Logo Pintu: Keluar / Logout Akun"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
