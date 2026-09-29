import React, { useState, useRef, useEffect } from 'react';
import { Settings } from 'lucide-react';
import { useTime } from '../hooks/useTime';
import { useOnlineCounter } from '../hooks/useOnlineCounter';
import { USER_PLAYLIST_URL } from '../data/tracks';

interface HeaderProps {
  isMotionEnabled: boolean;
  onToggleMotion: () => void;
  isPublicChatEnabled: boolean;
  onTogglePublicChat: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isMotionEnabled,
  onToggleMotion,
  isPublicChatEnabled,
  onTogglePublicChat
}) => {
  const { timeStr } = useTime();
  const onlineCount = useOnlineCounter();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsMenuRef = useRef<HTMLDivElement>(null);

  // Close settings popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(e.target as Node)) {
        setIsSettingsOpen(false);
      }
    };

    if (isSettingsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSettingsOpen]);

  return (
    <header className="pointer-events-none">
      {/* Top Left: Current Local Time (e.g. 8:42 am) */}
      <div className="pointer-events-auto absolute left-5 top-5 z-20 text-sm font-medium tabular-nums text-white drop-shadow-[0_1px_6px_rgba(0,0,0,0.5)] select-none">
        {timeStr || '8:42 am'}
      </div>

      {/* Top Center: Live Active User Indicator (🟢 1 online) */}
      <div
        className="pointer-events-auto absolute left-1/2 top-5 z-20 -translate-x-1/2 inline-flex items-center gap-2 rounded-full py-1.5 pl-3 pr-4 text-sm font-medium text-white drop-shadow-[0_1px_6px_rgba(0,0,0,0.5)] select-none"
        aria-live="polite"
      >
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.9)]" />
        </span>
        <span className="tabular-nums">{onlineCount}</span>
        <span className="text-white/70">online</span>
      </div>

      {/* Top Right: Settings Icon Only + Clean YouTube Music Link */}
      <div className="pointer-events-auto absolute right-5 top-5 z-20 flex items-center gap-2 select-none">
        {/* Settings Option right before YT Music link - Icon Only */}
        <div className="relative">
          <button
            onClick={() => setIsSettingsOpen((prev) => !prev)}
            className={`group/btn grid h-9 w-9 place-items-center rounded-full transition cursor-pointer active:scale-95 drop-shadow-[0_1px_6px_rgba(0,0,0,0.5)] ${
              isSettingsOpen || !isMotionEnabled
                ? 'bg-white/20 text-white border border-white/30'
                : 'text-white/80 hover:text-white hover:bg-white/10'
            }`}
            title="Settings"
            aria-label="Settings"
          >
            <Settings className="w-4 h-4 transition-transform duration-300 group-hover/btn:rotate-45" />
          </button>

          {/* Clean Settings Popover: Shake/Motion & Public Chat toggles */}
          {isSettingsOpen && (
            <div
              ref={settingsMenuRef}
              className="absolute top-11 right-0 w-56 rounded-xl bg-black/85 backdrop-blur-2xl border border-white/20 p-3.5 shadow-[0_12px_32px_rgba(0,0,0,0.85)] z-50 text-white select-none animate-in fade-in zoom-in-95 duration-150 flex flex-col gap-3"
            >
              {/* Shake/Motion Option */}
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-white/90">
                  Shake/Motion
                </span>

                <button
                  onClick={onToggleMotion}
                  role="switch"
                  aria-checked={isMotionEnabled}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    isMotionEnabled ? 'bg-amber-400' : 'bg-white/20'
                  }`}
                  title={isMotionEnabled ? "Turn off" : "Turn on"}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                      isMotionEnabled ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="h-px bg-white/10 w-full" />

              {/* Public Chat Option */}
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-white/90">
                  Public Chat
                </span>

                <button
                  onClick={onTogglePublicChat}
                  role="switch"
                  aria-checked={isPublicChatEnabled}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    isPublicChatEnabled ? 'bg-amber-400' : 'bg-white/20'
                  }`}
                  title={isPublicChatEnabled ? "Turn off" : "Turn on"}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                      isPublicChatEnabled ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* YouTube Music Link matching saloon.wtf */}
        <a
          href={USER_PLAYLIST_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="group/pill flex items-center gap-2 rounded-full text-sm font-medium text-white p-2.5 sm:py-2 sm:pl-3 sm:pr-3.5 drop-shadow-[0_1px_6px_rgba(0,0,0,0.5)] transition hover:opacity-80 active:scale-95"
          aria-label="Open on YouTube Music"
        >
          {/* YouTube Music Icon */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white" aria-hidden="true">
            <path d="M12 0C5.376 0 0 5.376 0 12s5.376 12 12 12 12-5.376 12-12S18.624 0 12 0zm0 19.104c-3.924 0-7.104-3.18-7.104-7.104S8.076 4.896 12 4.896s7.104 3.18 7.104 7.104-3.18 7.104-7.104 7.104zm0-13.332c-3.432 0-6.228 2.796-6.228 6.228S8.568 18.228 12 18.228s6.228-2.796 6.228-6.228S15.432 5.772 12 5.772zM9.684 15.54V8.46L15.816 12l-6.132 3.54z" />
          </svg>
          <span className="hidden sm:inline">YT Music</span>
          <span className="hidden sm:inline-flex">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="-rotate-45 opacity-50 transition group-hover/pill:opacity-90"
            >
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </span>
        </a>
      </div>
    </header>
  );
};
