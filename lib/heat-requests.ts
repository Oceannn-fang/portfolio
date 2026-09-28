/**
 * 共享请求层（模块级单例）：同一页面会话内每个数据源只发起一次网络请求。
 *
 * 背景：LoadingScreen 与 Gk3Clone 的 warmMusicCache/warmPlaylistCache 是两条独立
 * fetch 路径，并行发起时浏览器 HTTP 缓存尚未写入，同一 112KB JSON 会被真实下载两次。
 * 本层用 get-or-start 单例 Promise 消除重复：
 * - in-flight 期间所有调用方复用同一个 Promise（去重并发）
 * - 完成后一段时间内（TTL）后续调用直接复用已 resolve 的结果
 * - TTL 过期后重新 get-or-start，此时 HTTP 缓存（max-age=3600）通常已兜底
 * - 请求失败不缓存，下次调用自动重试
 *
 * 仅在浏览器端使用（模块状态存于页面会话内存，刷新即重置）。
 */

/** resolve 结果复用时长；与 PlaylistModule 的 10 分钟刷新节奏对齐 */
const TTL_MS = 10 * 60 * 1000;

interface HeatEntry {
  promise: Promise<unknown>;
  createdAt: number;
}

const entries = new Map<string, HeatEntry>();

function heatJson(key: string, url: string): Promise<unknown> {
  const now = Date.now();
  const hit = entries.get(key);
  if (hit && now - hit.createdAt < TTL_MS) {
    return hit.promise;
  }

  const promise = fetch(url).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  });
  entries.set(key, { promise, createdAt: now });

  // 失败时移除条目，避免把 reject 状态缓存住（下次调用可重试）
  promise.catch(() => {
    const current = entries.get(key);
    if (current && current.promise === promise) entries.delete(key);
  });

  return promise;
}

/** 网易云精选歌单：/api/netease/playlist（约 112KB JSON，1h HTTP 缓存） */
export function getNeteasePlaylist<T = unknown>(): Promise<T> {
  return heatJson('netease-playlist', '/api/netease/playlist') as Promise<T>;
}

/** Spotify 最近播放：/api/spotify/recently-played */
export function getSpotifyRecentlyPlayed<T = unknown>(): Promise<T> {
  return heatJson('spotify-recently-played', '/api/spotify/recently-played') as Promise<T>;
}

/** Spotify 收藏专辑：/api/spotify/albums */
export function getSpotifyAlbums<T = unknown>(): Promise<T> {
  return heatJson('spotify-albums', '/api/spotify/albums') as Promise<T>;
}
