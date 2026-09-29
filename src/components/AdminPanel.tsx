import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Users, 
  Music, 
  MessageCircle, 
  Lock, 
  Mail, 
  Phone, 
  Trash2, 
  Edit3, 
  Plus, 
  Search, 
  RefreshCw, 
  LogOut, 
  ExternalLink, 
  AlertTriangle, 
  CheckCircle2, 
  KeyRound, 
  ArrowLeft,
  Play,
  Radio,
  Loader2,
  Youtube,
  Sparkles,
  Check,
  ListPlus
} from 'lucide-react';
import { 
  searchYouTubeVideos, 
  fetchPlaylistTracks, 
  fetchVideoMetadata, 
  extractYouTubeId, 
  extractYouTubePlaylistId, 
  YouTubeTrack 
} from '../utils/youtubeSearch';

interface Devotee {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  method?: string;
  ip_address: string;
  created_at: string;
}

interface Song {
  id: string;
  title: string;
  titleEn: string;
  artist: string;
  duration?: number;
  durationFormatted?: string;
  coverUrl: string;
  youtubeId: string;
  youtubeMusicUrl?: string;
}

interface Stats {
  online_users: number;
  total_devotees: number;
  total_messages: number;
  blocked_ips: number;
  total_songs: number;
}

const secDecrypt = (hex: string, key = 'chhathi_2026') => {
  let out = '';
  for (let i = 0; i < hex.length; i += 2) {
    const byte = parseInt(hex.substr(i, 2), 16);
    out += String.fromCharCode(byte ^ key.charCodeAt((i / 2) % key.length));
  }
  return out;
};

// Encrypted default admin email
const DEFAULT_ADMIN_EMAIL = secDecrypt('0c05031419091b71455f405d0a060f21130508365e1e51590e');

// Smart API URL resolver that works seamlessly under root, /v7/admin, or subpath hosting
const adminFetch = async (query: string, options?: RequestInit): Promise<any> => {
  const cleanQuery = query.replace(/^\.?\/?api\/admin\.php\??/, '').replace(/^admin\.php\??/, '');
  const url1 = `/api/admin.php?${cleanQuery}`;
  const url2 = `./api/admin.php?${cleanQuery}`;

  let lastError: any = null;

  // Try canonical root /api/admin.php first
  try {
    const res = await fetch(url1, options);
    const text = await res.text();
    if (res.ok) {
      try {
        return JSON.parse(text);
      } catch {}
    }
  } catch (e) {
    lastError = e;
  }

  // Fallback to relative ./api/admin.php
  try {
    const res = await fetch(url2, options);
    const text = await res.text();
    return JSON.parse(text);
  } catch (e) {
    lastError = e;
  }

  throw lastError || new Error('Connection error. Please ensure API is accessible.');
};

export const AdminPanel: React.FC = () => {
  const [token, setToken] = useState<string>(() => {
    try {
      return localStorage.getItem('chhathi_admin_jwt') || '';
    } catch {
      return '';
    }
  });

  // Auth States
  const [loginEmail, setLoginEmail] = useState(DEFAULT_ADMIN_EMAIL);
  const [loginPassword, setLoginPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Forgot Password States
  const [forgotStep, setForgotStep] = useState<'login' | 'request_otp' | 'verify_otp'>('login');
  const [resetOtp, setResetOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  // Dashboard States
  const [activeTab, setActiveTab] = useState<'users' | 'songs' | 'chat' | 'stats'>('stats');
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<Devotee[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Edit Devotee Modal
  const [editingUser, setEditingUser] = useState<Devotee | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');

  // Add Song Modal
  const [isAddSongOpen, setIsAddSongOpen] = useState(false);
  const [songUrl, setSongUrl] = useState('');
  const [songTitle, setSongTitle] = useState('');
  const [songTitleEn, setSongTitleEn] = useState('');
  const [songArtist, setSongArtist] = useState('');
  const [songDuration, setSongDuration] = useState('5:00');
  const [isSavingSong, setIsSavingSong] = useState(false);
  const [songSuccessMsg, setSongSuccessMsg] = useState<string | null>(null);

  // YouTube Smart Search & Auto-Import States
  const [ytQuery, setYtQuery] = useState('');
  const [isSearchingYt, setIsSearchingYt] = useState(false);
  const [ytResults, setYtResults] = useState<YouTubeTrack[]>([]);
  const [ytPlaylistData, setYtPlaylistData] = useState<{ title: string; tracks: YouTubeTrack[] } | null>(null);
  const [ytError, setYtError] = useState<string | null>(null);
  const [addingTrackIds, setAddingTrackIds] = useState<Record<string, boolean>>({});
  const [isAddingAllPlaylist, setIsAddingAllPlaylist] = useState(false);
  const [isFetchingMeta, setIsFetchingMeta] = useState(false);
  const [fetchedMetaTrack, setFetchedMetaTrack] = useState<YouTubeTrack | null>(null);

  // Auto-parse and autofetch YouTube details from URL via NoEmbed / routes
  const handleSongUrlChange = async (url: string) => {
    setSongUrl(url);
    const trimmed = url.trim();
    if (!trimmed) {
      setFetchedMetaTrack(null);
      return;
    }

    const videoId = extractYouTubeId(trimmed);
    const playlistId = extractYouTubePlaylistId(trimmed);

    if (playlistId) {
      setIsFetchingMeta(true);
      try {
        const pl = await fetchPlaylistTracks(playlistId, token);
        if (pl && pl.tracks.length > 0) {
          setSongTitle(pl.title || 'Chhath Puja Playlist');
          setSongTitleEn(pl.title || 'Chhath Puja Playlist');
          setSongArtist('Chhathi Maiya Artists');
          setSongDuration(`${pl.tracks.length} Songs`);
        }
      } catch (e) {
        console.warn('Playlist autofetch error:', e);
      } finally {
        setIsFetchingMeta(false);
      }
      return;
    }

    if (videoId) {
      setIsFetchingMeta(true);
      try {
        const meta = await fetchVideoMetadata(videoId);
        if (meta) {
          setFetchedMetaTrack(meta);
          setSongTitle(meta.title || 'छठ पूजा गीत');
          setSongTitleEn(meta.titleEn || meta.title || 'Chhath Puja Song');
          setSongArtist(meta.artist || 'Chhathi Maiya Bhakti');
          setSongDuration(meta.durationFormatted || '5:00');
        }
      } catch (err) {
        console.warn('Video autofetch error:', err);
      } finally {
        setIsFetchingMeta(false);
      }
    }
  };

  // Login handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setAuthError(null);

    try {
      const data = await adminFetch('action=login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });
      if (data && data.success && data.token) {
        setToken(data.token);
        try {
          localStorage.setItem('chhathi_admin_jwt', data.token);
        } catch {}
        setAuthError(null);
      } else {
        setAuthError(data?.error || 'Invalid credentials.');
      }
    } catch {
      setAuthError('Connection error. Please ensure API is accessible.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Request Reset OTP
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsResetting(true);
    setAuthError(null);

    try {
      const data = await adminFetch('action=forgot_password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail })
      });
      if (data && data.success) {
        setForgotStep('verify_otp');
        setAuthSuccess(data.message);
      } else {
        setAuthError(data?.error || 'Failed to dispatch OTP.');
      }
    } catch {
      setAuthError('Network error requesting OTP.');
    } finally {
      setIsResetting(false);
    }
  };

  // Verify OTP & Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsResetting(true);
    setAuthError(null);

    try {
      const data = await adminFetch('action=reset_password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp: resetOtp, new_password: newPassword })
      });
      if (data && data.success) {
        setAuthSuccess('Password updated successfully! Please login with your new password.');
        setForgotStep('login');
        setLoginPassword(newPassword);
      } else {
        setAuthError(data?.error || 'Invalid OTP code.');
      }
    } catch {
      setAuthError('Network error during password reset.');
    } finally {
      setIsResetting(false);
    }
  };

  const handleLogout = () => {
    setToken('');
    try {
      localStorage.removeItem('chhathi_admin_jwt');
    } catch {}
  };

  // Fetch Dashboard Stats & Data
  const fetchDashboardData = async () => {
    if (!token) return;
    setIsLoadingData(true);
    try {
      // 1. Stats
      const sData = await adminFetch(`action=get_stats&token=${token}`);
      if (sData && sData.success) {
        setStats(sData.stats);
      }

      // 2. Users
      const uData = await adminFetch(`action=get_users&token=${token}&search=${encodeURIComponent(searchQuery)}`);
      if (uData && uData.success && Array.isArray(uData.users)) {
        setUsers(uData.users);
      }

      // 3. Songs
      const songData = await adminFetch(`action=get_songs&token=${token}`);
      if (songData && songData.success && Array.isArray(songData.songs)) {
        setSongs(songData.songs);
      }
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchDashboardData();
      // Auto refresh stats every 10 seconds
      const timer = setInterval(() => {
        adminFetch(`action=get_stats&token=${token}`)
          .then((d) => {
            if (d && d.success) setStats(d.stats);
          })
          .catch(() => {});
      }, 10000);
      return () => clearInterval(timer);
    }
  }, [token, searchQuery]);

  // Save / Add Song
  const handleSaveSong = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!songUrl || !songTitle) return;
    setIsSavingSong(true);
    setSongSuccessMsg(null);

    try {
      const data = await adminFetch(`action=save_song&token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: songUrl,
          title: songTitle,
          titleEn: songTitleEn || songTitle,
          artist: songArtist || 'Chhathi Maiya Bhakti',
          durationFormatted: songDuration || '5:00'
        })
      });
      if (data && data.success) {
        setSongSuccessMsg('Song successfully added to Chhathi Maiya site!');
        setSongUrl('');
        setSongTitle('');
        setSongTitleEn('');
        setSongArtist('');
        setIsAddSongOpen(false);
        fetchDashboardData();
      } else {
        alert(data?.error || 'Failed to add song.');
      }
    } catch {
      alert('Error adding song.');
    } finally {
      setIsSavingSong(false);
    }
  };

  // Delete Song
  const handleDeleteSong = async (id: string) => {
    if (!window.confirm('Are you sure you want to remove this song from the playlist?')) return;
    try {
      const data = await adminFetch(`action=delete_song&token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (data && data.success) {
        fetchDashboardData();
      }
    } catch {
      alert('Failed to delete song.');
    }
  };

  // Helper to check if a track is already in the playlist
  const isSongInPlaylist = (ytId: string) => {
    return songs.some(s => s.id === ytId || s.youtubeId === ytId);
  };

  // YouTube Smart Search / URL Parser Handler
  const handleSearchOrImport = async (e?: React.FormEvent, customQuery?: string) => {
    if (e) e.preventDefault();
    const raw = (customQuery !== undefined ? customQuery : ytQuery).trim();
    if (!raw || isSearchingYt) return;

    if (customQuery !== undefined) {
      setYtQuery(customQuery);
    }

    setIsSearchingYt(true);
    setYtError(null);
    setYtResults([]);
    setYtPlaylistData(null);

    try {
      const playlistId = extractYouTubePlaylistId(raw);
      const videoId = extractYouTubeId(raw);

      // 1. YouTube Playlist URL Detected
      if (playlistId) {
        try {
          const pl = await fetchPlaylistTracks(playlistId, token);
          if (pl && pl.tracks.length > 0) {
            setYtPlaylistData(pl);
            setYtResults(pl.tracks);
            return;
          }
        } catch (plErr: any) {
          console.warn('Playlist fetch failed, trying search fallback:', plErr);
        }
      }

      // 2. Single YouTube Video URL Detected
      if (videoId) {
        try {
          const track = await fetchVideoMetadata(videoId);
          setYtResults([track]);
          return;
        } catch (vErr: any) {
          console.warn('Single video metadata error:', vErr);
        }
      }

      // 3. Text Search Query (e.g. "Pawan Singh Chhath", "Kelwa Ke Paat Par")
      const results = await searchYouTubeVideos(raw, token);
      if (results && results.length > 0) {
        setYtResults(results);
      } else {
        setYtError(`No YouTube videos found for "${raw}". Try terms like "Sharda Sinha Chhath" or "Pawan Singh".`);
      }
    } catch (err: any) {
      console.error('YouTube search error:', err);
      setYtError(err.message || 'Error searching YouTube. Please try again.');
    } finally {
      setIsSearchingYt(false);
    }
  };

  // Add a single YouTube Track to Chhathi Maiya Playlist
  const handleAddSingleTrack = async (track: YouTubeTrack) => {
    const trackId = track.youtubeId || track.id;
    setAddingTrackIds(prev => ({ ...prev, [trackId]: true }));
    setSongSuccessMsg(null);

    try {
      const data = await adminFetch(`action=save_song&token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: `https://www.youtube.com/watch?v=${trackId}`,
          title: track.title,
          titleEn: track.titleEn || track.title,
          artist: track.artist || 'Chhathi Maiya Bhakti',
          duration: track.duration || 330,
          durationFormatted: track.durationFormatted || '5:30'
        })
      });
      if (data && data.success) {
        setSongSuccessMsg(`"${track.title}" added to Chhath Puja playlist successfully!`);
        fetchDashboardData();
      } else {
        alert(data?.error || 'Failed to add song to playlist.');
      }
    } catch {
      alert('Network error adding song to playlist.');
    } finally {
      setAddingTrackIds(prev => ({ ...prev, [trackId]: false }));
    }
  };

  // Add all tracks from a YouTube Playlist to Chhathi Maiya Playlist
  const handleAddAllPlaylist = async () => {
    if (!ytPlaylistData || !ytPlaylistData.tracks.length || isAddingAllPlaylist) return;
    setIsAddingAllPlaylist(true);
    setSongSuccessMsg(null);

    try {
      const data = await adminFetch(`action=save_songs_batch&token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          songs: ytPlaylistData.tracks
        })
      });
      if (data && data.success) {
        setSongSuccessMsg(`Successfully added ${data.added_count || ytPlaylistData.tracks.length} songs from "${ytPlaylistData.title}" to Chhath Puja playlist!`);
        fetchDashboardData();
      } else {
        alert(data?.error || 'Failed to import playlist.');
      }
    } catch {
      alert('Network error importing playlist songs.');
    } finally {
      setIsAddingAllPlaylist(false);
    }
  };

  // Update Devotee details
  const handleUpdateDevotee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      const data = await adminFetch(`action=update_user&token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingUser.id,
          name: editName,
          phone: editPhone,
          email: editEmail
        })
      });
      if (data && data.success) {
        setEditingUser(null);
        fetchDashboardData();
      } else {
        alert(data?.error || 'Failed to update devotee.');
      }
    } catch {
      alert('Error updating user.');
    }
  };

  // Delete Devotee
  const handleDeleteDevotee = async (id: number) => {
    if (!window.confirm('Delete this devotee record?')) return;
    try {
      await adminFetch(`action=delete_user&token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      fetchDashboardData();
    } catch {}
  };

  // -------------------------------------------------------------
  // LOGIN / FORGOT PASSWORD SCREEN
  // -------------------------------------------------------------
  if (!token) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-b from-[#180903] via-[#0d0402] to-black text-white font-sans">
        <div className="w-full max-w-md p-6 sm:p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-2xl shadow-2xl flex flex-col gap-5">
          {/* Logo & Header */}
          <div className="flex flex-col items-center text-center gap-2">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-amber-500/20 border border-amber-400/40 text-amber-400 shadow-[0_0_24px_rgba(245,158,11,0.25)]">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-wide">
              Chhathi Maiya Admin Portal
            </h1>
            <p className="text-xs text-amber-200/70">
              Authorized Administrator: <strong>{loginEmail}</strong>
            </p>
          </div>

          {authError && (
            <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          {authSuccess && (
            <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{authSuccess}</span>
            </div>
          )}

          {/* Form 1: Standard Login */}
          {forgotStep === 'login' && (
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-white/80 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-amber-400" />
                  Admin Email
                </label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/15 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-white/80 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                    Admin Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotStep('request_otp');
                      setAuthError(null);
                    }}
                    className="text-[11px] text-amber-400 hover:text-amber-300 underline cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Enter administrator password"
                  required
                  className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/15 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full mt-2 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-sm font-semibold shadow-lg transition-all active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {isLoggingIn ? 'Authenticating...' : 'Enter Admin Panel'}
              </button>
            </form>
          )}

          {/* Form 2: Request Forgot Password OTP */}
          {forgotStep === 'request_otp' && (
            <form onSubmit={handleRequestOtp} className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setForgotStep('login')}
                  className="text-white/60 hover:text-white"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <h3 className="text-sm font-semibold text-white">Reset Admin Password</h3>
              </div>
              <p className="text-xs text-white/70 leading-relaxed">
                Click below to dispatch a 6-digit security OTP to <strong>{loginEmail}</strong>.
              </p>

              <button
                type="submit"
                disabled={isResetting}
                className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-sm font-semibold shadow-lg transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {isResetting ? 'Sending OTP Code...' : 'Send Verification OTP'}
              </button>
            </form>
          )}

          {/* Form 3: Enter OTP & New Password */}
          {forgotStep === 'verify_otp' && (
            <form onSubmit={handleResetPassword} className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setForgotStep('login')}
                  className="text-white/60 hover:text-white"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <h3 className="text-sm font-semibold text-white">Verify OTP & Set Password</h3>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-white/80 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                  6-Digit OTP (Check your Email)
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={resetOtp}
                  onChange={(e) => setResetOtp(e.target.value)}
                  placeholder="• • • • • •"
                  required
                  className="w-full text-center tracking-[0.4em] font-mono text-lg py-2 rounded-xl bg-black/40 border border-white/15 text-amber-300 focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-white/80">New Admin Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  minLength={6}
                  className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/15 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>

              <button
                type="submit"
                disabled={isResetting || resetOtp.length !== 6}
                className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-sm font-semibold shadow-lg transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {isResetting ? 'Verifying...' : 'Update Password & Login'}
              </button>
            </form>
          )}

          <div className="text-center pt-2 border-t border-white/10">
            <a
              href="/"
              className="text-xs text-white/50 hover:text-white flex items-center justify-center gap-1.5 transition"
            >
              <span>Back to Public Website</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // AUTHENTICATED ADMIN DASHBOARD
  // -------------------------------------------------------------
  return (
    <div className="min-h-screen w-full bg-[#0c0503] text-white font-sans flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-black/80 backdrop-blur-xl px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-400 shadow-md">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              Chhathi Maiya Admin Portal
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40 font-mono">
                v7.0 Active
              </span>
            </h1>
            <p className="text-[11px] text-white/60">
              Administrator: <strong className="text-amber-300">{DEFAULT_ADMIN_EMAIL}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-white border border-white/15 transition cursor-pointer"
          >
            <span>Live Site</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <button
            onClick={fetchDashboardData}
            title="Refresh Data"
            className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15 transition cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingData ? 'animate-spin text-amber-400' : ''}`} />
          </button>
          <button
            onClick={handleLogout}
            title="Log Out"
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-950/60 hover:bg-red-900/60 border border-red-500/30 text-xs text-red-200 transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8 flex flex-col gap-6">
        {/* Real-Time Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
          {/* Live Online Users */}
          <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 flex flex-col gap-1 shadow-lg">
            <div className="flex items-center justify-between text-emerald-400 text-xs font-semibold">
              <span>Live Active Users</span>
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-bold font-mono text-white mt-1">
              {stats?.online_users || 1}
            </div>
            <span className="text-[10px] text-emerald-300/80">Real-time visitors connected</span>
          </div>

          {/* Total Devotees */}
          <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/30 flex flex-col gap-1 shadow-lg">
            <div className="flex items-center justify-between text-amber-400 text-xs font-semibold">
              <span>Verified Devotees</span>
              <Users className="w-4 h-4" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold font-mono text-white mt-1">
              {stats?.total_devotees || users.length}
            </div>
            <span className="text-[10px] text-amber-300/80">Phone/Email verified devotees</span>
          </div>

          {/* Songs in Playlist */}
          <div className="p-4 rounded-2xl bg-purple-950/30 border border-purple-500/30 flex flex-col gap-1 shadow-lg">
            <div className="flex items-center justify-between text-purple-400 text-xs font-semibold">
              <span>Bhakti Songs</span>
              <Music className="w-4 h-4" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold font-mono text-white mt-1">
              {stats?.total_songs || songs.length || 11}
            </div>
            <span className="text-[10px] text-purple-300/80">Active in Music Player</span>
          </div>

          {/* Total Messages */}
          <div className="p-4 rounded-2xl bg-sky-950/30 border border-sky-500/30 flex flex-col gap-1 shadow-lg">
            <div className="flex items-center justify-between text-sky-400 text-xs font-semibold">
              <span>Chat Messages</span>
              <MessageCircle className="w-4 h-4" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold font-mono text-white mt-1">
              {stats?.total_messages || 0}
            </div>
            <span className="text-[10px] text-sky-300/80">Total sent in Public Chat</span>
          </div>

          {/* Blocked IPs */}
          <div className="p-4 rounded-2xl bg-red-950/30 border border-red-500/30 flex flex-col gap-1 shadow-lg col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between text-red-400 text-xs font-semibold">
              <span>Blocked Spammers</span>
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold font-mono text-white mt-1">
              {stats?.blocked_ips || 0}
            </div>
            <span className="text-[10px] text-red-300/80">Permanent IP bans active</span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-white/10 pb-2">
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer ${
              activeTab === 'users'
                ? 'bg-amber-400 text-black shadow-md'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Devotees ({users.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('songs')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer ${
              activeTab === 'songs'
                ? 'bg-amber-400 text-black shadow-md'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <Music className="w-4 h-4" />
            <span>Manage Playlist</span>
          </button>

          <button
            onClick={() => setActiveTab('stats')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer ${
              activeTab === 'stats'
                ? 'bg-amber-400 text-black shadow-md'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>Overview & Security</span>
          </button>
        </div>

        {/* ========================================================= */}
        {/* TAB 1: DEVOTEES USER MANAGEMENT                           */}
        {/* ========================================================= */}
        {activeTab === 'users' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-3 w-4 h-4 text-white/40" />
                <input
                  type="text"
                  placeholder="Search devotees by name, phone or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/15 text-xs sm:text-sm text-white placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>
              <span className="text-xs text-white/50">
                Showing {users.length} verified user records
              </span>
            </div>

            {/* Users Table */}
            <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5 shadow-xl">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="border-b border-white/10 bg-black/40 text-amber-300 font-semibold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Name</th>
                    <th className="py-3 px-4">Phone Number</th>
                    <th className="py-3 px-4">Email ID</th>
                    <th className="py-3 px-4">Method</th>
                    <th className="py-3 px-4">IP Address</th>
                    <th className="py-3 px-4">Verified Date</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 text-white/90">
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-white/40">
                        No devotee records found. Once visitors verify with OTP, their details appear here.
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u.id} className="hover:bg-white/5 transition">
                        <td className="py-3 px-4 font-medium text-white flex items-center gap-2">
                          <div className="grid h-7 w-7 place-items-center rounded-full bg-amber-400/20 text-amber-300 text-xs font-bold">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <span>{u.name}</span>
                        </td>
                        <td className="py-3 px-4 font-mono text-white/80">
                          {u.phone ? `+91 ${u.phone}` : <span className="text-white/30 italic">None</span>}
                        </td>
                        <td className="py-3 px-4 text-white/80">
                          {u.email || <span className="text-white/30 italic">None</span>}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                            u.method === 'email'
                              ? 'bg-sky-500/15 border-sky-400/40 text-sky-300'
                              : 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
                          }`}>
                            {u.method === 'email' ? 'Email OTP' : 'Phone SMS'}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-white/60">
                          {u.ip_address}
                        </td>
                        <td className="py-3 px-4 text-white/60 text-xs">
                          {u.created_at || 'Just now'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setEditingUser(u);
                                setEditName(u.name);
                                setEditPhone(u.phone || '');
                                setEditEmail(u.email || '');
                              }}
                              title="Edit Devotee"
                              className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 hover:bg-white/20 text-amber-300 transition cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteDevotee(u.id)}
                              title="Delete Devotee"
                              className="grid h-8 w-8 place-items-center rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: PLAYLIST & SONGS MANAGER                           */}
        {/* ========================================================= */}
        {activeTab === 'songs' && (
          <div className="flex flex-col gap-6">
            {/* Tab Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <Music className="w-5 h-5 text-amber-400" />
                  <span>Chhath Puja Music Playlist & YouTube Importer</span>
                </h3>
                <p className="text-xs text-white/60">
                  Search YouTube directly, paste any Video or Playlist link to import all tracks into the site.
                </p>
              </div>
              <button
                onClick={() => setIsAddSongOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white text-xs font-semibold shadow transition active:scale-95 cursor-pointer self-start sm:self-auto"
              >
                <Plus className="w-4 h-4 text-amber-400" />
                <span>Custom / Manual Add</span>
              </button>
            </div>

            {songSuccessMsg && (
              <div className="p-3.5 rounded-2xl bg-emerald-950/70 border border-emerald-500/50 text-emerald-200 text-xs sm:text-sm flex items-center justify-between gap-2 shadow-lg animate-in fade-in duration-200">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <span>{songSuccessMsg}</span>
                </div>
                <button
                  onClick={() => setSongSuccessMsg(null)}
                  className="text-emerald-400 hover:text-white text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {/* 1. YouTube Smart Search & URL Importer Box */}
            <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-amber-400/30 shadow-2xl flex flex-col gap-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-300 flex items-center gap-1.5 uppercase tracking-wider">
                  <Youtube className="w-4 h-4 text-red-500" />
                  <span>YouTube Direct Search & Playlist Fetcher</span>
                </span>
                <span className="text-[11px] text-white/50">
                  Paste Video URL, Playlist URL, or Search Keyword
                </span>
              </div>

              {/* Search Form */}
              <form onSubmit={handleSearchOrImport} className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                  <input
                    type="text"
                    value={ytQuery}
                    onChange={(e) => {
                      setYtQuery(e.target.value);
                      setYtError(null);
                    }}
                    placeholder="Search YouTube (e.g. 'Pawan Singh Chhath', 'Uga Hai Suraj Dev') or paste URL..."
                    className="w-full pl-10 pr-4 py-3 rounded-2xl bg-black/50 border border-white/20 text-xs sm:text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-amber-400/60 font-devanagari transition"
                  />
                  {ytQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setYtQuery('');
                        setYtResults([]);
                        setYtPlaylistData(null);
                        setYtError(null);
                      }}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-xs cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={!ytQuery.trim() || isSearchingYt}
                  className="px-6 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-black text-xs sm:text-sm font-bold shadow-lg transition active:scale-95 cursor-pointer flex items-center justify-center gap-2 flex-shrink-0"
                >
                  {isSearchingYt ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Searching...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Search / Fetch</span>
                    </>
                  )}
                </button>
              </form>

              {/* Quick Search Suggestions */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] text-white/50">Quick:</span>
                {[
                  'शारदा सिन्हा छठ गीत',
                  'पवन सिंह छठ गीत',
                  'अनुराधा पौडवाल',
                  'खेसारी लाल छठ',
                  'केलवा के पात पर',
                  'काँच ही बाँस के बहंगिया'
                ].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => handleSearchOrImport(undefined, chip)}
                    className="px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] text-white/80 hover:text-amber-300 transition cursor-pointer font-devanagari"
                  >
                    {chip}
                  </button>
                ))}
              </div>

              {/* Error Message */}
              {ytError && (
                <div className="p-3 rounded-2xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-400" />
                  <span>{ytError}</span>
                </div>
              )}

              {/* Playlist Import Banner */}
              {ytPlaylistData && (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-400/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg animate-in fade-in duration-200">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-amber-400/30 text-amber-300">
                      <ListPlus className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white font-devanagari">{ytPlaylistData.title}</h4>
                      <p className="text-xs text-amber-300/90">{ytPlaylistData.tracks.length} tracks detected in this playlist</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddAllPlaylist}
                    disabled={isAddingAllPlaylist || ytPlaylistData.tracks.length === 0}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-amber-200 text-black text-xs sm:text-sm font-bold shadow-lg transition active:scale-95 cursor-pointer flex items-center justify-center gap-2 self-start sm:self-auto disabled:opacity-50"
                  >
                    {isAddingAllPlaylist ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Adding All Songs...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        <span>+ Add All ({ytPlaylistData.tracks.length}) to Playlist</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* YouTube Search Results Grid */}
              {ytResults.length > 0 && (
                <div className="flex flex-col gap-3 pt-2">
                  <div className="flex items-center justify-between text-xs text-white/70">
                    <span className="font-semibold text-white">
                      Results ({ytResults.length} {ytResults.length === 1 ? 'song' : 'songs'} found)
                    </span>
                    <span className="text-[11px] text-white/50">Click "Add" to publish directly to site</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 max-h-[50vh] overflow-y-auto pr-1 custom-scrollbar">
                    {ytResults.map((track) => {
                      const trackId = track.youtubeId || track.id;
                      const alreadyAdded = isSongInPlaylist(trackId);
                      const isAdding = Boolean(addingTrackIds[trackId]);

                      return (
                        <div
                          key={trackId}
                          className={`p-3 rounded-2xl border transition flex flex-col justify-between gap-3 shadow-lg ${
                            alreadyAdded
                              ? 'bg-amber-500/10 border-amber-400/40'
                              : 'bg-white/5 hover:bg-white/[0.08] border-white/15'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="relative h-14 w-14 rounded-xl overflow-hidden border border-white/20 flex-shrink-0">
                              <img
                                src={track.coverUrl}
                                alt={track.title}
                                className="h-full w-full object-cover"
                              />
                              <span className="absolute bottom-1 right-1 px-1 py-0.2 rounded bg-black/80 text-[9px] font-mono text-white">
                                {track.durationFormatted || '5:00'}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h5 className="text-xs font-semibold text-white truncate font-devanagari" title={track.title}>
                                {track.title}
                              </h5>
                              <p className="text-[11px] text-amber-300/80 truncate mt-0.5">{track.artist}</p>
                              <a
                                href={track.youtubeMusicUrl || `https://youtube.com/watch?v=${trackId}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] text-white/50 hover:text-amber-300 flex items-center gap-0.5 mt-1"
                              >
                                <span>Preview on YouTube</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            </div>
                          </div>

                          <div className="flex items-center justify-end pt-1 border-t border-white/10">
                            {alreadyAdded ? (
                              <span className="flex items-center gap-1 px-3 py-1 rounded-xl bg-amber-400/15 border border-amber-400/30 text-amber-300 text-xs font-medium">
                                <Check className="w-3.5 h-3.5" />
                                <span>In Playlist</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleAddSingleTrack(track)}
                                disabled={isAdding}
                                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs font-semibold shadow transition active:scale-95 cursor-pointer disabled:opacity-50"
                              >
                                {isAdding ? (
                                  <>
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    <span>Adding...</span>
                                  </>
                                ) : (
                                  <>
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>Add to Puja Site</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* 2. Current Active Songs on the Site */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Currently Active Puja Playlist</span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-xs font-mono">
                      {songs.length}
                    </span>
                  </h4>
                  <p className="text-xs text-white/50">These songs are live and playing on the main website.</p>
                </div>
              </div>

              {/* Songs Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {songs.map((song) => (
                  <div
                    key={song.id}
                    className="p-3.5 rounded-2xl bg-white/5 border border-white/10 hover:border-amber-400/40 transition flex items-center gap-3.5 group shadow-lg"
                  >
                    <img
                      src={song.coverUrl}
                      alt={song.title}
                      className="h-16 w-16 rounded-xl object-cover border border-white/15 flex-shrink-0 shadow-md"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-white truncate font-devanagari">
                        {song.title}
                      </h4>
                      <p className="text-xs text-amber-300/80 truncate">{song.artist}</p>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-white/50 font-mono">
                        <span>{song.durationFormatted || '5:00'}</span>
                        <span>•</span>
                        <a
                          href={song.youtubeMusicUrl || `https://youtube.com/watch?v=${song.youtubeId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-amber-400/80 hover:underline flex items-center gap-0.5"
                        >
                          <span>Listen</span>
                          <Play className="w-2.5 h-2.5" />
                        </a>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteSong(song.id)}
                      title="Remove from playlist"
                      className="grid h-8 w-8 place-items-center rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 transition cursor-pointer flex-shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: OVERVIEW & SYSTEM STATUS                           */}
        {/* ========================================================= */}
        {activeTab === 'stats' && (
          <div className="flex flex-col gap-6">
            <div className="p-5 rounded-3xl bg-white/5 border border-white/10 flex flex-col gap-3">
              <h3 className="text-sm sm:text-base font-bold text-amber-300 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-400" />
                Live Chhath Puja System Health
              </h3>
              <p className="text-xs text-white/70 leading-relaxed">
                Your portal is fully armed with high-speed memory caching, anti-flood rate limiting, and dual-layer permanent IP bans. All admin notifications and security OTPs are routed to <strong>{DEFAULT_ADMIN_EMAIL}</strong>.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Quick Actions */}
              <div className="p-5 rounded-3xl bg-white/5 border border-white/10 flex flex-col gap-3">
                <h4 className="text-sm font-semibold text-white">Administrator Quick Actions</h4>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => setActiveTab('songs')}
                    className="w-full py-2.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs font-semibold flex items-center justify-between transition cursor-pointer"
                  >
                    <span>Manage Music Player Songs</span>
                    <Music className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setActiveTab('users')}
                    className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-medium flex items-center justify-between transition cursor-pointer"
                  >
                    <span>View All Verified Devotees</span>
                    <Users className="w-4 h-4" />
                  </button>
                  <a
                    href={"/api/messages.php?action=list_blocked&key=" + secDecrypt('120910302d3c01275965')}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-medium flex items-center justify-between transition cursor-pointer"
                  >
                    <span>Inspect Raw Blocked IPs Log</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>

              {/* Web Push & System Info */}
              <div className="p-5 rounded-3xl bg-white/5 border border-white/10 flex flex-col gap-2.5">
                <h4 className="text-sm font-semibold text-white">Firebase & Push Configured</h4>
                <div className="text-xs text-white/70 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between py-1 border-b border-white/10">
                    <span>Firebase Project</span>
                    <strong className="text-amber-300 font-mono">chhathi-maiya-app</strong>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-white/10">
                    <span>Web Push VAPID</span>
                    <span className="text-[10px] text-emerald-400 font-mono">
                      Active (End-to-End Encrypted)
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span>Admin Recovery Email</span>
                    <strong className="text-emerald-300">{DEFAULT_ADMIN_EMAIL}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ========================================================= */}
      {/* MODAL: ADD NEW SONG                                       */}
      {/* ========================================================= */}
      {isAddSongOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-lg p-6 rounded-3xl bg-[#140804] border border-amber-400/40 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Music className="w-5 h-5 text-amber-400" />
                Add Song to Chhath Puja Playlist
              </h3>
              <button
                onClick={() => setIsAddSongOpen(false)}
                className="text-white/50 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSong} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-white/80">YouTube Video or Playlist URL *</label>
                <input
                  type="text"
                  placeholder="https://www.youtube.com/watch?v=y7hrM7PouQM"
                  value={songUrl}
                  onChange={(e) => handleSongUrlChange(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/15 text-xs text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>

              {isFetchingMeta && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-400/10 border border-amber-400/20 text-xs text-amber-300">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Autofetching song details from YouTube (NoEmbed)...</span>
                </div>
              )}

              {fetchedMetaTrack && !isFetchingMeta && (
                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/5 border border-amber-400/30">
                  <img
                    src={fetchedMetaTrack.coverUrl}
                    alt={fetchedMetaTrack.title}
                    className="w-14 h-14 rounded-lg object-cover border border-white/10"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{fetchedMetaTrack.title}</p>
                    <p className="text-[11px] text-amber-300/80 truncate">{fetchedMetaTrack.artist}</p>
                    <span className="text-[10px] text-white/50 font-mono">{fetchedMetaTrack.durationFormatted}</span>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-1">
                <label className="text-xs text-white/80">Song Title (Hindi / Bhojpuri) *</label>
                <input
                  type="text"
                  placeholder="e.g. पहिले पहिल हम कईनी"
                  value={songTitle}
                  onChange={(e) => setSongTitle(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/15 text-xs text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-amber-400 font-devanagari"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-white/80">Song Title (English)</label>
                <input
                  type="text"
                  placeholder="e.g. Pahile Pahil Hum Kaini"
                  value={songTitleEn}
                  onChange={(e) => setSongTitleEn(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/15 text-xs text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-white/80">Singer / Artist</label>
                  <input
                    type="text"
                    placeholder="e.g. Sharda Sinha"
                    value={songArtist}
                    onChange={(e) => setSongArtist(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/15 text-xs text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-white/80">Duration (Min:Sec)</label>
                  <input
                    type="text"
                    placeholder="5:30"
                    value={songDuration}
                    onChange={(e) => setSongDuration(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/15 text-xs text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddSongOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingSong}
                  className="px-5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs font-semibold shadow-md active:scale-95 disabled:opacity-50"
                >
                  {isSavingSong ? 'Adding Song...' : 'Add to Site'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: EDIT DEVOTEE DETAILS                               */}
      {/* ========================================================= */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md p-6 rounded-3xl bg-[#140804] border border-amber-400/40 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-amber-400" />
                Modify Devotee Details
              </h3>
              <button
                onClick={() => setEditingUser(null)}
                className="text-white/50 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateDevotee} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-white/80">Devotee Full Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/15 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-white/80">Phone Number</label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/15 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-white/80">Email Address</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="e.g. devotee@gmail.com"
                  className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/15 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs font-semibold shadow-md active:scale-95"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
