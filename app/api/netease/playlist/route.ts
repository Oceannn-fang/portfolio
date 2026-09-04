import { NextResponse } from 'next/server';

// 1 小时缓存
export const revalidate = 3600;

const PLAYLIST_ID = '17995395884';

export async function GET() {
  try {
    const response = await fetch(
      `https://music.163.com/api/playlist/detail?id=${PLAYLIST_ID}`,
      {
        headers: {
          // 网易云接口要求 Referer，否则返回 403
          'Referer': 'https://music.163.com/',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      }
    );

    if (!response.ok) {
      return NextResponse.json({ error: 'upstream error' }, { status: 502 });
    }

    const data = await response.json();
    const playlist = data.result;

    // 网易云 CDN 有时返回 http:// 封面，HTTPS 部署下会被浏览器当作混合内容阻止，统一升级为 https://
    const toHttps = (url?: string) => (url ? url.replace(/^http:\/\//, 'https://') : '');

    // 精简返回数据（兼容新旧字段名：artists/ar、album/al、duration/dt）
    const tracks = (playlist.tracks || []).map((t: any) => ({
      id: t.id,
      name: t.name,
      artists: (t.artists || t.ar || []).map((a: any) => a.name).join(' / '),
      album: t.album?.name || t.al?.name || '',
      cover: toHttps(t.album?.picUrl || t.al?.picUrl || ''),
      duration: t.duration || t.dt || 0,
    }));

    return NextResponse.json(
      {
        name: playlist.name,
        coverImgUrl: toHttps(playlist.coverImgUrl),
        description: playlist.description,
        trackCount: playlist.trackCount,
        tracks,
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        },
      }
    );
  } catch (error) {
    return NextResponse.json({ error: 'fetch failed' }, { status: 500 });
  }
}
