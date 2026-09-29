import { useState, useRef, useEffect } from 'react';
import { MessageCircle, ChevronDown } from 'lucide-react';
import { BackgroundSlideshow } from './components/BackgroundSlideshow';
import { CenterSign } from './components/CenterSign';
import { Header } from './components/Header';
import { AudioPlayer } from './components/AudioPlayer';
import { YouTubeEmbed, YouTubePlayerHandle } from './components/YouTubeEmbed';
import { PublicChat } from './components/PublicChat';
import { AdminPanel } from './components/AdminPanel';
import { TRACKS, Track } from './data/tracks';

export function App() {
  // Admin Route Check (/v7/admin/ or ?v7_admin=true)
  const [isAdminRoute, setIsAdminRoute] = useState(() => {
    return (
      window.location.pathname.startsWith('/v7/admin') ||
      window.location.search.includes('v7_admin=true') ||
      window.location.hash.includes('v7/admin')
    );
  });

  const [tracks, setTracks] = useState<Track[]>(TRACKS);

  // Fetch dynamic playlist from backend songs.php
  useEffect(() => {
    fetch('./api/songs.php')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.songs) && data.songs.length > 0) {
          setTracks(data.songs);
        }
      })
      .catch(() => {});
  }, []);

  // Pick a random track from the playlist on initial load
  const [currentTrackIndex, setCurrentTrackIndex] = useState(() =>
    Math.floor(Math.random() * TRACKS.length)
  );
  // Autoplay enabled by default when user opens the site
  const [isPlaying, setIsPlaying] = useState(true);
  const [isLooping, setIsLooping] = useState(false);
  // Motion / Shake Effect toggle with localStorage persistence
  const [isMotionEnabled, setIsMotionEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem('chhathi_motion_enabled');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  // Public Chat toggle with localStorage persistence (defaults to true)
  const [isPublicChatEnabled, setIsPublicChatEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem('chhathi_public_chat_enabled');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(tracks[0]?.duration || 353);
  const [volume, setVolume] = useState(85);
  const [isMuted, setIsMuted] = useState(false);

  const currentTrack = tracks[currentTrackIndex] || tracks[0];
  const ytPlayerRef = useRef<YouTubePlayerHandle>(null);

  const handleTogglePlay = () => {
    setIsPlaying((prev) => !prev);
  };

  const handleToggleLoop = () => {
    setIsLooping((prev) => !prev);
  };

  const handleToggleMotion = () => {
    setIsMotionEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('chhathi_motion_enabled', String(next));
      } catch {}
      return next;
    });
  };

  const handleTogglePublicChat = () => {
    setIsPublicChatEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('chhathi_public_chat_enabled', String(next));
      } catch {}
      return next;
    });
  };

  // Play randomly from playlist instead of sequentially
  const handleNext = () => {
    setCurrentTrackIndex((prev) => {
      if (tracks.length <= 1) return prev;
      let next = Math.floor(Math.random() * tracks.length);
      while (next === prev) {
        next = Math.floor(Math.random() * tracks.length);
      }
      return next;
    });
    setCurrentTime(0);
    setIsPlaying(true);
  };

  const handlePrev = () => {
    setCurrentTrackIndex((prev) => (prev - 1 + tracks.length) % tracks.length);
    setCurrentTime(0);
    setIsPlaying(true);
  };

  // When track ends: replay in loop if enabled, otherwise play next random song
  const handleTrackEnd = () => {
    if (isLooping) {
      setCurrentTime(0);
      ytPlayerRef.current?.seekTo(0);
      ytPlayerRef.current?.play();
    } else {
      handleNext();
    }
  };

  const handleSeek = (seconds: number) => {
    setCurrentTime(seconds);
    ytPlayerRef.current?.seekTo(seconds);
  };

  const handleVolumeChange = (vol: number) => {
    setVolume(vol);
    if (vol > 0 && isMuted) {
      setIsMuted(false);
    }
    ytPlayerRef.current?.setVolume(vol);
  };

  const handleToggleMute = () => {
    setIsMuted((prev) => !prev);
  };

  // Guarantee audio unblocks on first touch/click if browser autoplay policy blocks unprompted audio
  useEffect(() => {
    const handleFirstInteraction = () => {
      if (isPlaying) {
        ytPlayerRef.current?.play();
      }
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
    };

    window.addEventListener('click', handleFirstInteraction, { once: true });
    window.addEventListener('touchstart', handleFirstInteraction, { once: true });

    return () => {
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
    };
  }, [isPlaying]);

  // Keyboard navigation: Space for Play/Pause, Arrows for Prev/Next
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (isAdminRoute) {
    return <AdminPanel />;
  }

  const handleSelectTrack = (index: number) => {
    setCurrentTrackIndex(index);
    setCurrentTime(0);
    setIsPlaying(true);
  };

  return (
    <div className="relative min-h-dvh w-full overflow-x-hidden select-none">
      {/* Background Slideshow (Images 1, 2, 3 with random 20s-120s fade+blur & slow Ken Burns zoom) */}
      <BackgroundSlideshow isMotionEnabled={isMotionEnabled} />

      {/* Hero Screen: Fixed-height single viewport containing Header, Sign, Music Player & Chat jump option */}
      <section className="relative min-h-dvh w-full flex flex-col justify-between items-center overflow-hidden">
        {/* Top Metadata Header (Local Time, 🟢 Real Active User Counter, Settings, YT Music Pill) */}
        <Header
          isMotionEnabled={isMotionEnabled}
          onToggleMotion={handleToggleMotion}
          isPublicChatEnabled={isPublicChatEnabled}
          onTogglePublicChat={handleTogglePublicChat}
        />

        {/* Center Sign "जय छठी मैया" (Shifted slightly upper from center) */}
        <CenterSign />

        {/* Static Glassmorphism Bottom Audio Player */}
        <AudioPlayer
          currentTrack={currentTrack}
          tracks={tracks}
          onSelectTrack={handleSelectTrack}
          isPlaying={isPlaying}
          isLooping={isLooping}
          currentTime={currentTime}
          duration={duration}
          volume={volume}
          isMuted={isMuted}
          onTogglePlay={handleTogglePlay}
          onToggleLoop={handleToggleLoop}
          onNext={handleNext}
          onPrev={handlePrev}
          onSeek={handleSeek}
          onVolumeChange={handleVolumeChange}
          onToggleMute={handleToggleMute}
        />

        {/* Public Chat Jump Button / Option */}
        {isPublicChatEnabled && (
          <div className="absolute bottom-2 sm:bottom-2.5 inset-x-0 z-20 flex justify-center pointer-events-auto">
            <button
              onClick={() => {
                const chatEl = document.getElementById('public-chat-section');
                if (chatEl) {
                  chatEl.scrollIntoView({ behavior: 'smooth' });
                }
              }}
              className="group inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/40 hover:bg-black/60 border border-white/25 hover:border-amber-400/50 text-xs sm:text-sm font-medium text-white/90 hover:text-white backdrop-blur-xl shadow-[0_4px_20px_rgba(0,0,0,0.5)] transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
              aria-label="Public Chat"
            >
              <MessageCircle className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
              <span>Public Chat</span>
              <ChevronDown className="w-3.5 h-3.5 text-white/70 animate-bounce" />
            </button>
          </div>
        )}
      </section>

      {/* Hidden YouTube Audio Engine (outside of Hero so it persists across renders & scrolls) */}
      <YouTubeEmbed
        ref={ytPlayerRef}
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        volume={volume}
        isMuted={isMuted}
        onTimeUpdate={(curr, dur) => {
          setCurrentTime(curr);
          if (dur > 0 && Math.abs(dur - duration) > 1) {
            setDuration(dur);
          }
        }}
        onTrackEnd={handleTrackEnd}
      />

      {/* Public Chat Section with InfinityFree MySQL Integration */}
      {isPublicChatEnabled && <PublicChat />}
    </div>
  );
}

export default App;
