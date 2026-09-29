// YouTube Search & Playlist Metadata Utility for Chhathi Maiya Music Player
// Adapted with resilient multi-tier fallbacks (Backend API, NoEmbed, Piped, Invidious & CORS Proxies)

export interface YouTubeTrack {
  id: string;
  youtubeId: string;
  title: string;
  titleEn?: string;
  artist: string;
  duration: number;
  durationFormatted: string;
  coverUrl: string;
  youtubeMusicUrl?: string;
}

export interface PlaylistFetchResult {
  title: string;
  playlistId: string;
  tracks: YouTubeTrack[];
}

// Clean HTML entities & strange characters
export function cleanTitle(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

// Format seconds into "M:SS" or "H:MM:SS"
export function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return '3:30';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Parse "5:20" or "1:15:30" or 320 to number of seconds
export function parseDuration(val: string | number): number {
  if (typeof val === 'number') return val;
  if (!val) return 210;
  const parts = val.toString().trim().split(':').map(Number);
  if (parts.some(isNaN)) return 210;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 210;
}

// Extract YouTube Video ID
export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (/^[a-zA-Z0-9_\-]{11}$/.test(trimmed)) return trimmed;

  const patterns = [
    /[?&]v=([^&#]+)/,
    /youtu\.be\/([^?#]+)/,
    /youtube\.com\/embed\/([^?#]+)/,
    /youtube\.com\/shorts\/([^?#]+)/,
    /music\.youtube\.com\/watch\?v=([^&#]+)/
  ];
  for (const p of patterns) {
    const m = trimmed.match(p);
    if (m && m[1]) return m[1];
  }
  return null;
}

// Extract YouTube Playlist ID
export function extractYouTubePlaylistId(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  const m = trimmed.match(/[?&]list=([^&#]+)/) || trimmed.match(/playlist\?list=([^&#]+)/);
  if (m && m[1]) return m[1];
  if (/^(?:PL|UU|FL|RD)[a-zA-Z0-9_\-]+$/.test(trimmed)) return trimmed;
  return null;
}

// Helper to fetch with timeout
async function fetchWithTimeout(url: string, timeoutMs = 5000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

// Fetch single video metadata using noembed + oembed
export async function fetchVideoMetadata(videoIdOrUrl: string): Promise<YouTubeTrack> {
  const videoId = extractYouTubeId(videoIdOrUrl) || videoIdOrUrl.trim();
  if (!videoId) throw new Error('Invalid YouTube video URL or ID.');

  const defaultTrack: YouTubeTrack = {
    id: videoId,
    youtubeId: videoId,
    title: 'छठ पूजा गीत',
    titleEn: 'Chhath Puja Song',
    artist: 'Chhathi Maiya Bhakti',
    duration: 330,
    durationFormatted: '5:30',
    coverUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    youtubeMusicUrl: `https://music.youtube.com/watch?v=${videoId}`
  };

  // 1. Try NoEmbed (CORS-friendly, no API key needed)
  try {
    const res = await fetchWithTimeout(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`, 4000);
    if (res.ok) {
      const data = await res.json();
      if (data && data.title) {
        return {
          ...defaultTrack,
          title: cleanTitle(data.title),
          titleEn: cleanTitle(data.title),
          artist: cleanTitle(data.author_name || 'Chhathi Maiya Bhakti'),
          coverUrl: data.thumbnail_url || defaultTrack.coverUrl
        };
      }
    }
  } catch {}

  // 2. Try Backend PHP fetch_video_meta
  try {
    const res = await fetchWithTimeout(`./api/admin.php?action=fetch_video_meta&v=${encodeURIComponent(videoId)}`, 4000);
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.track) {
        return data.track;
      }
    }
  } catch {}

  return defaultTrack;
}

// Search YouTube videos
export async function searchYouTubeVideos(query: string, adminToken = ''): Promise<YouTubeTrack[]> {
  const q = query.trim();
  if (!q) return [];

  // 1. Try Backend PHP YouTube Search (fastest & no CORS issues)
  try {
    const url = `./api/admin.php?action=search_youtube&q=${encodeURIComponent(q)}${adminToken ? `&token=${encodeURIComponent(adminToken)}` : ''}`;
    const res = await fetchWithTimeout(url, 5000);
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.results) && data.results.length > 0) {
        return data.results.map((r: any) => ({
          id: r.videoId,
          youtubeId: r.videoId,
          title: cleanTitle(r.title),
          titleEn: cleanTitle(r.title),
          artist: cleanTitle(r.author || 'Chhath Bhakti'),
          duration: parseDuration(r.duration),
          durationFormatted: typeof r.duration === 'string' && r.duration.includes(':') ? r.duration : formatDuration(parseDuration(r.duration)),
          coverUrl: `https://i.ytimg.com/vi/${r.videoId}/hqdefault.jpg`,
          youtubeMusicUrl: `https://music.youtube.com/watch?v=${r.videoId}`
        }));
      }
    }
  } catch {}

  // 2. Client-side Piped Search Fallback
  const pipedInstances = [
    'https://pipedapi.tokhmi.xyz',
    'https://pipedapi.adminforge.de',
    'https://piped-api.lunar.icu'
  ];

  for (const inst of pipedInstances) {
    try {
      const res = await fetchWithTimeout(`${inst}/search?q=${encodeURIComponent(q)}&filter=all`, 4000);
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.items)) {
          const valid = data.items
            .filter((item: any) => item.type === 'stream' || item.url?.includes('watch?v=') || item.id)
            .slice(0, 30)
            .map((item: any) => {
              const vId = item.url?.includes('?v=')
                ? item.url.split('?v=')[1].split('&')[0]
                : (item.id || item.url?.split('/').pop() || '');
              if (!vId) return null;
              const dur = Number(item.duration || 210);
              return {
                id: vId,
                youtubeId: vId,
                title: cleanTitle(item.title || 'Chhathi Maiya Geet'),
                titleEn: cleanTitle(item.title || 'Chhathi Maiya Geet'),
                artist: cleanTitle(item.uploaderName || item.uploader || 'Chhath Singer'),
                duration: dur,
                durationFormatted: formatDuration(dur),
                coverUrl: `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`,
                youtubeMusicUrl: `https://music.youtube.com/watch?v=${vId}`
              };
            })
            .filter(Boolean) as YouTubeTrack[];

          if (valid.length > 0) return valid;
        }
      }
    } catch {}
  }

  // 3. CORS Proxy Scrape Fallback
  try {
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`)}`;
    const res = await fetchWithTimeout(proxyUrl, 5000);
    if (res.ok) {
      const json = await res.json();
      const html = json.contents || '';
      const vMatch = html.matchAll(/href="\/watch\?v=([a-zA-Z0-9_\-]{11})"/g);
      const seen = new Set<string>();
      const tracks: YouTubeTrack[] = [];
      for (const m of vMatch) {
        const vId = m[1];
        if (!seen.has(vId) && seen.size < 20) {
          seen.add(vId);
          tracks.push({
            id: vId,
            youtubeId: vId,
            title: `छठ पूजा गीत [${vId}]`,
            titleEn: `Chhath Song [${vId}]`,
            artist: 'YouTube Bhakti',
            duration: 330,
            durationFormatted: '5:30',
            coverUrl: `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`,
            youtubeMusicUrl: `https://music.youtube.com/watch?v=${vId}`
          });
        }
      }
      if (tracks.length > 0) return tracks;
    }
  } catch {}

  return [];
}

// Fetch YouTube Playlist tracks
export async function fetchPlaylistTracks(playlistIdOrUrl: string, adminToken = ''): Promise<PlaylistFetchResult> {
  const playlistId = extractYouTubePlaylistId(playlistIdOrUrl) || playlistIdOrUrl.trim();
  if (!playlistId) throw new Error('Invalid YouTube playlist URL or ID.');

  // 1. Try Backend PHP Playlist fetch
  try {
    const url = `./api/admin.php?action=fetch_playlist&list=${encodeURIComponent(playlistId)}${adminToken ? `&token=${encodeURIComponent(adminToken)}` : ''}`;
    const res = await fetchWithTimeout(url, 8000);
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.tracks) && data.tracks.length > 0) {
        return {
          title: cleanTitle(data.title || 'Chhath Puja Playlist'),
          playlistId,
          tracks: data.tracks.map((t: any) => ({
            id: t.videoId || t.id,
            youtubeId: t.videoId || t.id,
            title: cleanTitle(t.title),
            titleEn: cleanTitle(t.title),
            artist: cleanTitle(t.author || t.artist || 'Chhath Singer'),
            duration: parseDuration(t.duration),
            durationFormatted: typeof t.duration === 'string' && t.duration.includes(':') ? t.duration : formatDuration(parseDuration(t.duration)),
            coverUrl: `https://i.ytimg.com/vi/${t.videoId || t.id}/hqdefault.jpg`,
            youtubeMusicUrl: `https://music.youtube.com/watch?v=${t.videoId || t.id}`
          }))
        };
      }
    }
  } catch {}

  // 2. Client-side Piped Playlist Fallback
  const pipedInstances = [
    'https://pipedapi.tokhmi.xyz',
    'https://pipedapi.adminforge.de',
    'https://piped-api.lunar.icu'
  ];

  for (const inst of pipedInstances) {
    try {
      const res = await fetchWithTimeout(`${inst}/playlists/${encodeURIComponent(playlistId)}`, 5000);
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.relatedStreams) && data.relatedStreams.length > 0) {
          const tracks = data.relatedStreams.map((v: any) => {
            const vId = v.url?.includes('?v=')
              ? v.url.split('?v=')[1].split('&')[0]
              : (v.id || v.url?.split('/').pop() || '');
            if (!vId) return null;
            const dur = Number(v.duration || 210);
            return {
              id: vId,
              youtubeId: vId,
              title: cleanTitle(v.title || 'Chhath Song'),
              titleEn: cleanTitle(v.title || 'Chhath Song'),
              artist: cleanTitle(v.uploaderName || v.uploader || 'Chhath Singer'),
              duration: dur,
              durationFormatted: formatDuration(dur),
              coverUrl: `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`,
              youtubeMusicUrl: `https://music.youtube.com/watch?v=${vId}`
            };
          }).filter(Boolean) as YouTubeTrack[];

          if (tracks.length > 0) {
            return {
              title: cleanTitle(data.name || 'YouTube Playlist'),
              playlistId,
              tracks
            };
          }
        }
      }
    } catch {}
  }

  throw new Error('Could not fetch playlist. Please verify the playlist is public and contains active songs.');
}
