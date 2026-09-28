import { NextResponse } from 'next/server';
import { gzipJson } from '../../_lib/compress';

// 1 小时缓存
export const revalidate = 3600;

const PLAYLIST_ID = '17995395884';

const UPSTREAM_HEADERS = {
  // 网易云接口要求 Referer，否则返回 403
  'Referer': 'https://music.163.com/',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

// 网易云 CDN 有时返回 http:// 封面，HTTPS 部署下会被浏览器当作混合内容阻止，统一升级为 https://
const toHttps = (url?: string) => (url ? url.replace(/^http:\/\//, 'https://') : '');

/**
 * 曲目封面统一改走网易云缩略参数（服务器端缩放输出 JPEG）。
 * 全尺寸外链图单张可达数 MB、30 张合计 26MB+，而页面里只显示为 40-80px 缩略图；
 * ?param=350y350 后单张仅约 15-30KB，且支持已有 ?param 的 URL（取 ? 前主体重写）。
 */
const toThumb = (url?: string) => {
  const httpsUrl = toHttps(url);
  if (!httpsUrl) return '';
  return `${httpsUrl.split('?')[0]}?param=350y350`;
};

export async function GET(request: Request) {
  try {
    // v6 接口支持 n 参数指定返回曲目数上限，拉取全部曲目
    const response = await fetch(
      `https://music.163.com/api/v6/playlist/detail?id=${PLAYLIST_ID}&n=1000`,
      { headers: UPSTREAM_HEADERS }
    );

    if (!response.ok) {
      return NextResponse.json({ error: 'upstream error' }, { status: 502 });
    }

    const data = await response.json();
    // v6 返回的歌单在 playlist 字段，旧接口在 result 字段，做兼容
    const playlist = data.playlist || data.result;

    const rawTracks: any[] = playlist.tracks || [];

    // v6/v3 接口的 tracks 只返回前 10 首完整曲目（n 参数实测无效），
    // 完整 id 列表在 trackIds 中，需额外调用 song/detail 补全其余曲目
    const allIds: number[] = (playlist.trackIds || []).map((t: any) => t.id);
    const detailed = new Map<number, any>();
    for (const t of rawTracks) {
      if (t.id && t.name) detailed.set(t.id, t);
    }
    const missingIds = allIds.filter((id) => !detailed.has(id));

    if (missingIds.length > 0) {
      // song/detail 单次实测最多返回约 200 首，按 200 分批请求
      const BATCH_SIZE = 200;
      for (let i = 0; i < missingIds.length; i += BATCH_SIZE) {
        const batch = missingIds.slice(i, i + BATCH_SIZE);
        const detailResponse = await fetch(
          `https://music.163.com/api/song/detail?ids=[${batch.join(',')}]`,
          { headers: UPSTREAM_HEADERS }
        ).catch(() => null);
        if (!detailResponse?.ok) continue;
        const detailData = await detailResponse.json().catch(() => null);
        for (const song of detailData?.songs || []) {
          if (song.id && song.name) detailed.set(song.id, song);
        }
      }
    }

    // 精简返回数据（兼容新旧字段名：artists/ar、album/al、duration/dt），
    // 按 trackIds 顺序输出全部曲目
    const tracks = (allIds.length > 0 ? allIds.map((id) => detailed.get(id)) : rawTracks)
      .filter((t: any) => t && t.name)
      .map((t: any) => ({
        id: t.id,
        name: t.name,
        artists: (t.artists || t.ar || []).map((a: any) => a.name).join(' / '),
        album: t.album?.name || t.al?.name || '',
        cover: toThumb(t.album?.picUrl || t.al?.picUrl || ''),
        duration: t.duration || t.dt || 0,
      }));

    // gzip 压缩输出（尊重 Accept-Encoding），与缓存头共存。
    // #76 CDN 缓存分层：s-maxage=60 + SWR=300 作用于 Vercel 边缘缓存——
    // 绝大多数访客命中边缘，lambda 冷启动只影响缓存过期后的那个请求
    // （冷启动 5.5-7.3s 不再直接打到访客）；max-age=3600 保持浏览器私有缓存不变。
    // 注意 SWR 是单一指令，浏览器与 CDN 共用 300s 的 stale 窗口；
    // 与 export const revalidate = 3600 不冲突：显式 Cache-Control 优先于段配置
    return gzipJson(
      request,
      {
        name: playlist.name,
        coverImgUrl: toHttps(playlist.coverImgUrl),
        description: playlist.description,
        trackCount: playlist.trackCount,
        tracks,
      },
      {
        'Cache-Control': 'public, max-age=3600, s-maxage=60, stale-while-revalidate=300',
      }
    );
  } catch (error) {
    return NextResponse.json({ error: 'fetch failed' }, { status: 500 });
  }
}
