import { useState, useEffect } from 'react';

// Generates or retrieves a unique persistent client ID for this browser tab
function getClientId(): string {
  let id = sessionStorage.getItem('chhathi_client_id');
  if (!id) {
    id = 'c_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
    sessionStorage.setItem('chhathi_client_id', id);
  }
  return id;
}

export function useOnlineCounter(): number {
  const [onlineCount, setOnlineCount] = useState<number>(1);

  useEffect(() => {
    const clientId = getClientId();
    const CHANNEL_NAME = 'chhathi_maiya_presence_channel';
    const STORAGE_KEY = 'chhathi_active_tabs_map';

    let isCancelled = false;
    let broadcastChannel: BroadcastChannel | null = null;

    // Helper for local browser fallback when PHP backend is unavailable (e.g. localhost)
    const updateLocalTabs = (): number => {
      try {
        const now = Date.now();
        const stored = localStorage.getItem(STORAGE_KEY);
        let tabMap: Record<string, number> = stored ? JSON.parse(stored) : {};

        tabMap[clientId] = now;

        // Clean tabs older than 3.5s
        const activeTabs: Record<string, number> = {};
        for (const [id, time] of Object.entries(tabMap)) {
          if (now - time < 3500) {
            activeTabs[id] = time;
          }
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(activeTabs));
        return Math.max(1, Object.keys(activeTabs).length);
      } catch {
        return 1;
      }
    };

    // Setup local BroadcastChannel
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
        broadcastChannel.onmessage = (event) => {
          if (event.data?.type === 'HEARTBEAT' || event.data?.type === 'TAB_CLOSED') {
            const count = updateLocalTabs();
            setOnlineCount((prev) => (event.data?.remoteOnline ? event.data.remoteOnline : count));
          }
        };
      }
    } catch {
      // ignore
    }

    // Ping server API (works automatically on InfinityFree / PHP hosting)
    const pingServer = async () => {
      try {
        // Attempt relative path to api/online.php
        const response = await fetch(`./api/online.php?id=${encodeURIComponent(clientId)}&t=${Date.now()}`, {
          cache: 'no-store'
        });

        if (response.ok) {
          const data = await response.json();
          if (data && typeof data.online === 'number' && !isCancelled) {
            const serverCount = Math.max(1, data.online);
            setOnlineCount(serverCount);
            // Broadcast server count to sibling tabs
            try {
              broadcastChannel?.postMessage({
                type: 'HEARTBEAT',
                clientId,
                remoteOnline: serverCount
              });
            } catch {
              // ignore
            }
            return true;
          }
        }
      } catch {
        // Fall through to local fallback
      }

      // If server is not responding (e.g. running on Vite dev server without PHP)
      if (!isCancelled) {
        const localCount = updateLocalTabs();
        setOnlineCount(localCount);
        try {
          broadcastChannel?.postMessage({
            type: 'HEARTBEAT',
            clientId
          });
        } catch {
          // ignore
        }
      }
      return false;
    };

    // Initial ping
    pingServer();

    // Ping every 4 seconds to maintain active presence
    const intervalId = setInterval(pingServer, 4000);

    // Leave beacon on page unload
    const handleUnload = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const tabMap: Record<string, number> = JSON.parse(stored);
          delete tabMap[clientId];
          localStorage.setItem(STORAGE_KEY, JSON.stringify(tabMap));
        }
        broadcastChannel?.postMessage({ type: 'TAB_CLOSED', clientId });

        // Send beacon to PHP backend
        if (navigator.sendBeacon) {
          navigator.sendBeacon(`./api/online.php?action=leave&id=${encodeURIComponent(clientId)}`);
        }
      } catch {
        // ignore
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);

    return () => {
      isCancelled = true;
      clearInterval(intervalId);
      handleUnload();
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
      broadcastChannel?.close();
    };
  }, []);

  return onlineCount;
}
