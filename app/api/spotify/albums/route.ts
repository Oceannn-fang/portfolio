import {
  joinArtists,
  jsonOk,
  pickLargestImage,
  spotifyFetch,
  toErrorResponse,
  upstreamError,
  type SavedAlbumsResponse,
} from '@/lib/spotify';

export const dynamic = 'force-dynamic';

/** 收藏专辑变动很少，允许浏览器私有缓存 5 分钟；private 避免被共享缓存转发 */
const CACHE_CONTROL = 'private, max-age=300, stale-while-revalidate=600';

/**
 * GET /api/spotify/albums
 * 代理 Spotify /v1/me/albums，返回当前账号「收藏的专辑」。
 * 响应：{ albums: [{ id, name, artist, imageUrl, releaseDate, totalTracks }] }
 */
export async function GET(): Promise<Response> {
  try {
    const response = await spotifyFetch('/v1/me/albums?limit=20');

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

    return jsonOk({ albums }, CACHE_CONTROL);
  } catch (error) {
    return toErrorResponse(error);
  }
}
