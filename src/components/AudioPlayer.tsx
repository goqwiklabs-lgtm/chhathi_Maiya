import React, { useState, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Repeat1, ListMusic, X, Search } from 'lucide-react';
import { Track } from '../data/tracks';

interface AudioPlayerProps {
  currentTrack: Track;
  tracks?: Track[];
  isPlaying: boolean;
  isLooping: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  onTogglePlay: () => void;
  onToggleLoop: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSelectTrack?: (index: number) => void;
  onSeek: (seconds: number) => void;
  onVolumeChange: (vol: number) => void;
  onToggleMute: () => void;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  currentTrack,
  isPlaying,
  isLooping,
  currentTime,
  duration,
  volume,
  isMuted,
  onTogglePlay,
  tracks = [],
  onSelectTrack,
  onToggleLoop,
  onNext,
  onPrev,
  onSeek,
  onVolumeChange,
  onToggleMute
}) => {
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [playlistSearch, setPlaylistSearch] = useState('');
  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  const filteredTracks = tracks.filter((t) => {
    if (!playlistSearch.trim()) return true;
    const q = playlistSearch.toLowerCase();
    return (
      t.title.toLowerCase().includes(q) ||
      t.artist.toLowerCase().includes(q) ||
      (t.titleEn && t.titleEn.toLowerCase().includes(q))
    );
  });

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || duration <= 0) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    onSeek(ratio * duration);
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none mb-[6vh] sm:mb-[7vh] flex w-full justify-center px-4 sm:px-6">
      <div className="pointer-events-auto relative flex items-center gap-3 sm:gap-4 rounded-full p-2.5 sm:p-3 pr-4 sm:pr-5 bg-white/10 backdrop-blur-2xl backdrop-saturate-150 border border-white/20 shadow-[0_8px_40px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.25)] max-w-xl w-full select-none transition-all duration-300">
        
        {/* Spinning Vinyl Record Thumbnail */}
        <div
          className="relative flex-shrink-0 group/vinyl"
          title={currentTrack.title}
        >
          <div
            className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden shadow-2xl ring-2 ring-white/30 vinyl-grooves relative ${
              isPlaying ? 'animate-[spin_10s_linear_infinite]' : ''
            }`}
            style={{ animationPlayState: isPlaying ? 'running' : 'paused' }}
          >
            {/* Album Cover Art Zoomed to Fit Full Circle */}
            <div className="absolute inset-1.5 rounded-full overflow-hidden border border-white/25">
              <img
                src={currentTrack.coverUrl}
                alt={currentTrack.title}
                onError={(e) => {
                  if (!e.currentTarget.src.includes('hqdefault.jpg')) {
                    e.currentTarget.src = currentTrack.coverUrl.replace('maxresdefault.jpg', 'hqdefault.jpg').replace('sddefault.jpg', 'hqdefault.jpg');
                  }
                }}
                className="w-full h-full object-cover scale-[1.3] transition-transform duration-300"
                draggable={false}
              />
            </div>
            
            {/* Center Spindle Hole */}
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/85 ring-2 ring-white/60 shadow-inner" />
          </div>
        </div>

        {/* Track Metadata & Progress Bar */}
        <div className="min-w-0 flex-1 flex flex-col justify-center gap-1">
          {/* Song Title (Full width with continuous marquee) */}
          <div className="overflow-hidden w-full relative select-none">
            <div className="animate-title-marquee">
              <span className="font-semibold text-xs sm:text-sm text-white drop-shadow-sm font-devanagari pr-8">
                {currentTrack.title}
              </span>
              <span className="font-semibold text-xs sm:text-sm text-white drop-shadow-sm font-devanagari pr-8">
                {currentTrack.title}
              </span>
            </div>
          </div>

          {/* Artist Name & Timer directly below artist name */}
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-0.5 sm:gap-2">
            <p className="text-[11px] sm:text-xs text-white/75 truncate font-medium">
              {currentTrack.artist}
            </p>
            {/* Timer Part: Placed just below the artist name on phones */}
            <div className="text-[10px] sm:text-[11px] text-white/60 tabular-nums font-mono">
              {formatTime(currentTime)} / {currentTrack.durationFormatted || formatTime(duration || currentTrack.duration)}
            </div>
          </div>

          {/* Scrubber Progress Bar */}
          <div
            ref={progressBarRef}
            onClick={handleProgressClick}
            className="group/bar relative h-2 sm:h-2.5 flex items-center cursor-pointer py-1"
          >
            {/* Rail */}
            <div className="w-full h-1 sm:h-1.5 rounded-full bg-white/20 overflow-hidden relative">
              <div
                className="h-full rounded-full bg-white/90 group-hover/bar:bg-white transition-all duration-100"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Scrub Handle Dot */}
            <div
              className="absolute h-3 w-3 sm:h-3.5 sm:w-3.5 -translate-x-1/2 rounded-full bg-white shadow-md opacity-0 group-hover/bar:opacity-100 transition-opacity pointer-events-none"
              style={{ left: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
          {/* Loop / Repeat Button */}
          <button
            onClick={onToggleLoop}
            className={`grid h-8 w-8 sm:h-9 sm:w-9 place-items-center rounded-full transition-all cursor-pointer active:scale-95 ${
              isLooping
                ? 'text-amber-300 bg-amber-400/20 ring-1 ring-amber-400/50'
                : 'text-white/60 hover:bg-white/15 hover:text-white'
            }`}
            title={isLooping ? "लूप चालू है (वही गीत दोहराएं)" : "लूप बंद है (एक बार दोहराने के लिए क्लिक करें)"}
            aria-label="Toggle loop song"
          >
            <Repeat1 className="w-4 h-4" />
          </button>

          {/* Previous Track */}
          <button
            onClick={onPrev}
            className="grid h-8 w-8 sm:h-9 sm:w-9 place-items-center rounded-full text-white/80 hover:bg-white/15 hover:text-white active:scale-95 transition-all cursor-pointer"
            title="पिछला गीत (Previous)"
            aria-label="Previous song"
          >
            <SkipBack className="w-4 h-4 fill-current" />
          </button>

          {/* Play / Pause Button */}
          <button
            onClick={onTogglePlay}
            className="grid h-9 w-9 sm:h-11 sm:w-11 place-items-center rounded-full bg-white text-black shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer"
            title={isPlaying ? "रोकें (Pause)" : "बजाएं (Play)"}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
            ) : (
              <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current ml-0.5" />
            )}
          </button>

          {/* Next Track */}
          <button
            onClick={onNext}
            className="grid h-8 w-8 sm:h-9 sm:w-9 place-items-center rounded-full text-white/80 hover:bg-white/15 hover:text-white active:scale-95 transition-all cursor-pointer"
            title="अगला गीत (Next)"
            aria-label="Next song"
          >
            <SkipForward className="w-4 h-4 fill-current" />
          </button>

          {/* Volume Control */}
          <div className="relative">
            <button
              onClick={onToggleMute}
              onMouseEnter={() => setShowVolumeSlider(true)}
              className="grid h-8 w-8 sm:h-9 sm:w-9 place-items-center rounded-full text-white/70 hover:bg-white/15 hover:text-white active:scale-95 transition-all cursor-pointer"
              title={isMuted ? "अनम्यूट करें" : "म्यूट करें"}
              aria-label="Volume toggle"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 text-amber-300" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>

            {/* Vertical Volume Slider Popover */}
            {showVolumeSlider && (
              <div
                onMouseLeave={() => setShowVolumeSlider(false)}
                className="absolute bottom-11 left-1/2 -translate-x-1/2 p-3 bg-black/85 backdrop-blur-xl border border-white/20 rounded-2xl shadow-xl flex flex-col items-center gap-2 z-40"
              >
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => onVolumeChange(Number(e.target.value))}
                  className="w-1.5 h-20 accent-white bg-white/20 rounded-lg appearance-none cursor-pointer [writing-mode:vertical-lr] [direction:rtl]"
                />
                <span className="text-[10px] text-white/70 font-mono">
                  {isMuted ? 0 : volume}%
                </span>
              </div>
            )}
          </div>

          {/* Playlist Popover Toggle */}
          {tracks && tracks.length > 0 && (
            <button
              onClick={() => setShowPlaylist((prev) => !prev)}
              className={`grid h-8 w-8 sm:h-9 sm:w-9 place-items-center rounded-full transition-all active:scale-95 cursor-pointer ${
                showPlaylist
                  ? 'bg-amber-400 text-black shadow-lg scale-105'
                  : 'text-white/70 hover:bg-white/15 hover:text-white'
              }`}
              title="छठ पूजा गीत संग्रह (Playlist)"
              aria-label="Playlist"
            >
              <ListMusic className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Floating Chhath Geet Sangrah (Playlist) Modal */}
        {showPlaylist && (
          <div className="absolute bottom-16 sm:bottom-20 left-1/2 -translate-x-1/2 w-[92vw] sm:w-[480px] max-h-[65vh] p-3 sm:p-4 rounded-3xl bg-black/90 backdrop-blur-2xl border border-amber-400/40 shadow-[0_16px_60px_rgba(0,0,0,0.85)] flex flex-col gap-3 z-50 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-xl bg-amber-400/20 text-amber-400">
                  <ListMusic className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-white font-devanagari">छठ पूजा गीत संग्रह</h4>
                  <p className="text-[10px] text-amber-300/80">{tracks.length} भक्ति गीत उपलब्ध</p>
                </div>
              </div>
              <button
                onClick={() => setShowPlaylist(false)}
                className="grid h-7 w-7 place-items-center rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white text-xs transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                value={playlistSearch}
                onChange={(e) => setPlaylistSearch(e.target.value)}
                placeholder="गीत या गायक खोजें (Search songs)..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white/10 border border-white/15 text-xs text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-amber-400 font-devanagari"
              />
            </div>

            {/* Song List */}
            <div className="flex-1 overflow-y-auto max-h-[42vh] flex flex-col gap-1.5 pr-1 custom-scrollbar">
              {filteredTracks.map((track) => {
                const isSelected = track.id === currentTrack.id || track.youtubeId === currentTrack.youtubeId;
                const trackOriginalIndex = tracks.findIndex(t => t.id === track.id);
                return (
                  <button
                    key={track.id}
                    onClick={() => {
                      if (onSelectTrack && trackOriginalIndex !== -1) {
                        onSelectTrack(trackOriginalIndex);
                      }
                      setShowPlaylist(false);
                    }}
                    className={`w-full text-left p-2 rounded-2xl flex items-center gap-3 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-amber-400/20 border border-amber-400/60 shadow-md text-amber-300'
                        : 'bg-white/5 hover:bg-white/10 border border-white/10 text-white'
                    }`}
                  >
                    <img
                      src={track.coverUrl}
                      alt={track.title}
                      className="h-11 w-11 rounded-xl object-cover border border-white/20 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate font-devanagari leading-snug">
                        {track.title}
                      </p>
                      <p className="text-[11px] text-white/60 truncate mt-0.5">{track.artist}</p>
                    </div>
                    <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                      <span className="text-[10px] text-white/50 font-mono">{track.durationFormatted || '5:00'}</span>
                      {isSelected && (
                        <span className="flex items-center gap-1 text-[10px] text-amber-400 font-medium">
                          <span>बज रहा है</span>
                          <span className="flex gap-0.5 items-end h-2.5">
                            <span className="w-0.5 h-full bg-amber-400 animate-pulse" />
                            <span className="w-0.5 h-1/2 bg-amber-400 animate-pulse delay-75" />
                            <span className="w-0.5 h-3/4 bg-amber-400 animate-pulse delay-150" />
                          </span>
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}

              {filteredTracks.length === 0 && (
                <div className="py-8 text-center text-xs text-white/40">
                  कोई गीत नहीं मिला (No songs found)
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
