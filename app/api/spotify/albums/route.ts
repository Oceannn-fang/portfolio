import { gzipJson } from '../../_lib/compress';
import {
  joinArtists,
  pickLargestImage,
  spotifyFetch,
  toErrorResponse,
  upstreamError,
  type SavedAlbumsResponse,
} from '@/lib/spotify';

/** 定时拉取策略：每小时后台重新生成，减少实时请求带来的卡顿 */
export const revalidate = 3600;

/** 收藏专辑变动很少，浏览器私有缓存 1 小时；private 避免被共享缓存转发 */
const CACHE_CONTROL = 'private, max-age=3600, stale-while-revalidate=86400';

/**
 * GET /api/spotify/albums
 * 代理 Spotify /v1/me/albums，返回当前账号「收藏的专辑」。
 * 响应：{ albums: [{ id, name, artist, imageUrl, releaseDate, totalTracks }] }
 */
export async function GET(request: Request): Promise<Response> {
  try {
    // limit=48：能被 3 和 4 整除，网格不会出现空缺行
    const response = await spotifyFetch('/v1/me/albums?limit=48');

    if (!response.ok) {
      return upstreamError(response.status);
    }

    const data = (await response.json()) as SavedAlbumsResponse;

    const albums = (data.items ?? []).map((item) => ({
      id: item.album.id,
      name: item.album.name,
      artist: joinArtists(item.album.artists),
      imageUrl: pickLargestImage(item.album.images),
      releaseDate: item.album.release_date ?? '',
      totalTracks: item.album.total_tracks ?? 0,
    }));

    // gzip 压缩输出（尊重 Accept-Encoding），与 private 缓存头共存
    return gzipJson(request, { albums }, { 'Cache-Control': CACHE_CONTROL });
  } catch (error) {
    return toErrorResponse(error);
  }
}
