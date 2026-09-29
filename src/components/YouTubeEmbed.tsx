import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Track } from '../data/tracks';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export interface YouTubePlayerHandle {
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => void;
  setVolume: (volume: number) => void;
}

interface YouTubeEmbedProps {
  currentTrack: Track;
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  onTimeUpdate: (currentTime: number, duration: number) => void;
  onTrackEnd: () => void;
}

export const YouTubeEmbed = forwardRef<YouTubePlayerHandle, YouTubeEmbedProps>(({
  currentTrack,
  isPlaying,
  volume,
  isMuted,
  onTimeUpdate,
  onTrackEnd,
}, ref) => {
  const playerRef = useRef<any>(null);
  const containerId = useRef(`yt-player-embed`);
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);

  useImperativeHandle(ref, () => ({
    play: () => {
      try {
        playerRef.current?.playVideo();
      } catch (e) {
        console.warn(e);
      }
    },
    pause: () => {
      try {
        playerRef.current?.pauseVideo();
      } catch (e) {
        console.warn(e);
      }
    },
    seekTo: (seconds: number) => {
      try {
        playerRef.current?.seekTo(seconds, true);
      } catch (e) {
        console.warn(e);
      }
    },
    setVolume: (vol: number) => {
      try {
        playerRef.current?.setVolume(vol);
      } catch (e) {
        console.warn(e);
      }
    }
  }));

  // Initialize YouTube IFrame API
  useEffect(() => {
    let isCancelled = false;

    const initPlayer = () => {
      if (!window.YT || !window.YT.Player) return;

      new window.YT.Player(containerId.current, {
        height: '100',
        width: '100',
        videoId: currentTrack.youtubeId,
        playerVars: {
          autoplay: 1,
          playsinline: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          origin: window.location.origin
        },
        events: {
          onReady: (event: any) => {
            if (isCancelled) return;
            playerRef.current = event.target;
            if (isMuted) {
              event.target.mute();
            } else {
              event.target.unMute();
              event.target.setVolume(volume);
            }
            if (isPlaying) {
              event.target.playVideo();
            }
          },
          onStateChange: (event: any) => {
            // YT.PlayerState.ENDED === 0
            if (event.data === 0) {
              onTrackEnd();
            }
          }
        }
      });
    };

    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

      window.onYouTubeIframeAPIReady = () => {
        initPlayer();
      };
    } else if (window.YT.Player) {
      initPlayer();
    }

    return () => {
      isCancelled = true;
      try {
        playerRef.current?.destroy();
      } catch {
        // ignore
      }
    };
  }, []);

  // Update track when currentTrack changes
  useEffect(() => {
    if (playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
      playerRef.current.loadVideoById(currentTrack.youtubeId);
      if (!isPlaying) {
        playerRef.current.pauseVideo();
      }
    }
  }, [currentTrack.youtubeId]);

  // Sync play/pause state
  useEffect(() => {
    if (!playerRef.current) return;
    try {
      if (isPlaying) {
        playerRef.current.playVideo();
      } else {
        playerRef.current.pauseVideo();
      }
    } catch {
      // ignore
    }
  }, [isPlaying]);

  // Sync volume & mute
  useEffect(() => {
    if (!playerRef.current) return;
    try {
      if (isMuted) {
        playerRef.current.mute();
      } else {
        playerRef.current.unMute();
        playerRef.current.setVolume(volume);
      }
    } catch {
      // ignore
    }
  }, [volume, isMuted]);

  // Progress polling interval
  useEffect(() => {
    if (isPlaying) {
      progressTimerRef.current = setInterval(() => {
        if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
          const current = playerRef.current.getCurrentTime() || 0;
          const dur = playerRef.current.getDuration() || currentTrack.duration;
          onTimeUpdate(current, dur);
        }
      }, 300);
    } else if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
    }

    return () => {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
      }
    };
  }, [isPlaying, currentTrack.duration, onTimeUpdate]);

  return (
    <div className="absolute -top-[9999px] -left-[9999px] pointer-events-none opacity-0 overflow-hidden w-1 h-1">
      <div id={containerId.current} />
    </div>
  );
});
