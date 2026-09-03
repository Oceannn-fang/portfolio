import {
  joinArtists,
  jsonOk,
  pickLargestImage,
  spotifyFetch,
  toErrorResponse,
  upstreamError,
  type RecentlyPlayedResponse,
} from '@/lib/spotify';

export const dynamic = 'force-dynamic';

/**
 * GET /api/spotify/recently-played
 * 代理 Spotify /v1/me/player/recently-played，裁剪成前端需要的最小字段集。
 * 响应：{ tracks: [{ id, name, artist, album: { id, name, imageUrl }, playedAt }] }
 */
export async function GET(): Promise<Response> {
  try {
    const response = await spotifyFetch('/v1/me/player/recently-played?limit=20');

    // 用户没有任何播放历史时 Spotify 返回 204 No Content，属于正常空态
    if (response.status === 204) {
      return jsonOk({ tracks: [] });
    }

    if (!response.ok) {
      return upstreamError(response.status);
    }

    const data = (await response.json()) as RecentlyPlayedResponse;

    const tracks = (data.items ?? []).map((item) => ({
      id: item.track.id,
      name: item.track.name,
      artist: joinArtists(item.track.artists),
      album: {
        id: item.track.album?.id ?? '',
        name: item.track.album?.name ?? '',
        imageUrl: pickLargestImage(item.track.album?.images),
      },
      playedAt: item.played_at,
    }));

    return jsonOk({ tracks });
  } catch (error) {
    return toErrorResponse(error);
  }
}
