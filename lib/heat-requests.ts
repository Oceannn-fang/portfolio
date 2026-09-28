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

/**
 * get-or-start 单例核心：同一 key 在 TTL 内只发一次真实请求。
 * @param parse true 时解析 JSON（非 2xx 抛错）；false 时直接返回原始 Response，
 *              由调用方自行处理状态码（如 MusicModule 需要区分 401 未授权）
 */
function heatRequest(key: string, url: string, parse: boolean): Promise<unknown> {
  const now = Date.now();
  const hit = entries.get(key);
  if (hit && now - hit.createdAt < TTL_MS) {
    return hit.promise;
  }

  const promise = fetch(url).then((res) => {
    if (parse) {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    }
    // Response 体只能消费一次：clone 给调用方，缓存里留原件供后续复用
    return res.clone();
  });
  entries.set(key, { promise, createdAt: now });

  // 失败时移除条目，避免把 reject 状态缓存住（下次调用可重试）
  promise.catch(() => {
    const current = entries.get(key);
    if (current && current.promise === promise) entries.delete(key);
  });

  return promise;
}

function heatJson(key: string, url: string): Promise<unknown> {
  return heatRequest(key, url, true);
}

/**
 * 原始 Response 变体：与 heatJson 共享同一去重条目（同 key 同 URL），
 * 供需要自行判断状态码的调用方（如 warmMusicCache 的 401 处理）使用。
 * 注意：非 2xx 不会抛错也不会被剔除缓存（Response 本身是 fulfilled），
 * TTL 内重复调用拿到的是同一响应的 clone。
 */
export function heatResponse(key: string, url: string): Promise<Response> {
  return heatRequest(key, url, false) as Promise<Response>;
}

/** 网易云精选歌单：/api/netease/playlist（约 112KB JSON，1h HTTP 缓存） */
export function getNeteasePlaylist<T = unknown>(): Promise<T> {
  return heatJson('netease-playlist', '/api/netease/playlist') as Promise<T>;
}

/** Spotify 最近播放：/api/spotify/recently-played（基于 raw 变体派生，与共享条目同模式） */
export async function getSpotifyRecentlyPlayed<T = unknown>(): Promise<T> {
  const res = await getSpotifyRecentlyPlayedRaw();
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

/** Spotify 收藏专辑：/api/spotify/albums（基于 raw 变体派生，与共享条目同模式） */
export async function getSpotifyAlbums<T = unknown>(): Promise<T> {
  const res = await getSpotifyAlbumsRaw();
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

/** Spotify 最近播放（原始 Response，供 warmMusicCache 判断 401） */
export function getSpotifyRecentlyPlayedRaw(): Promise<Response> {
  return heatResponse('spotify-recently-played', '/api/spotify/recently-played');
}

/** Spotify 收藏专辑（原始 Response，供 warmMusicCache 判断 401） */
export function getSpotifyAlbumsRaw(): Promise<Response> {
  return heatResponse('spotify-albums', '/api/spotify/albums');
}
