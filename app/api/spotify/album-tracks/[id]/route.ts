import {
  jsonError,
  jsonOk,
  spotifyFetch,
  toErrorResponse,
  upstreamError,
  type AlbumTracksResponse,
} from '@/lib/spotify';

export const dynamic = 'force-dynamic';

/**
 * Spotify 资源 ID 为 base62 字符串。
 * 严格校验可避免把任意路径片段拼进上游 URL（路径穿越 / 参数注入）。
 */
const SPOTIFY_ID_PATTERN = /^[A-Za-z0-9]{1,64}$/;

/** 专辑曲目表几乎不会变化，允许浏览器私有缓存 1 小时 */
const CACHE_CONTROL = 'private, max-age=3600, stale-while-revalidate=86400';

/**
 * GET /api/spotify/album-tracks/[id]
 * 代理 Spotify /v1/albums/{id}/tracks，返回指定专辑的曲目列表。
 * 响应：{ tracks: [{ id, name, durationMs, trackNumber, previewUrl }] }
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    // Next.js 15 中动态路由参数为 Promise，必须先 await
    const { id } = await params;

    if (!SPOTIFY_ID_PATTERN.test(id)) {
      return jsonError('非法的专辑 ID', 400);
    }

    const response = await spotifyFetch(`/v1/albums/${encodeURIComponent(id)}/tracks?limit=50`);

    if (!response.ok) {
      return upstreamError(response.status);
    }

    const data = (await response.json()) as AlbumTracksResponse;

    const tracks = (data.items ?? []).map((track) => ({
      id: track.id,
      name: track.name,
      durationMs: track.duration_ms ?? 0,
      trackNumber: track.track_number ?? 0,
      // 非 Premium 区域或部分厂牌会返回 null，前端需做空值兜底
      previewUrl: track.preview_url ?? null,
    }));

    return jsonOk({ tracks }, CACHE_CONTROL);
  } catch (error) {
    return toErrorResponse(error);
  }
}
