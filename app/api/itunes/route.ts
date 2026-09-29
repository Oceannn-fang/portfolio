import { NextResponse } from 'next/server';
import { gzipJson } from '../_lib/compress';

// #91：iTunes Search/Lookup API 不带 CORS 头，浏览器直接 fetch 会被拦截。
// 本路由作为同源服务端代理，供 public/music-cover-3d/（Gk3Clone showcase 行
// iframe 内的同源静态页）以相对路径 /api/itunes?... 获取专辑完整曲目列表：
//   GET /api/itunes?collectionId=<id>            → lookup 模式（专辑集合 id，最准）
//   GET /api/itunes?artist=<a>&album=<b>&country=<CC> → search 模式（无 collectionId 的专辑兜底）
// 返回精简 JSON：collectionId/collectionName/artistName + tracks[]
// （trackId/trackName/artistName/collectionName/previewUrl/trackNumber）
// 实测注：iTunes Search 的 entity=album 相关度极差（IGOR/Blonde 等在售专辑搜不到），
// 必须用 entity=song + "artist album" 组合词 + artistName 过滤 + 按 collectionId
// 分组取最大组的策略（probe 实测 8 张缺失专辑 7 张命中）；country 需按专辑指定
// （椎名林檎→JP、ciacia→TW，默认 US）。

// iTunes 专辑曲目列表基本不变，缓存可以很长：
// 浏览器 1h + 边缘 24h + SWR 7d（同 netease 路由 #76 的分层策略，过期后由 SWR 兜底）
const CACHE_CONTROL = 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800';

type ItunesTrack = {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName: string;
  previewUrl: string;
  trackNumber: number;
};

type ItunesPayload = {
  collectionId: number | null;
  collectionName: string;
  artistName: string;
  tracks: ItunesTrack[];
};

// 进程内内存缓存（单实例 dev/自托管下有效；多实例部署退化为 s-maxage 边缘缓存）。
// TTL 6h：远小于边缘缓存周期，仅在 s-maxage 未命中（冷实例/部署后首访）时挡住上游突发
const MEM_TTL_MS = 6 * 60 * 60 * 1000;
const MEM_MAX_ENTRIES = 120;
const memCache = new Map<string, { at: number; payload: ItunesPayload }>();

const UPSTREAM_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

function memGet(key: string): ItunesPayload | null {
  const hit = memCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > MEM_TTL_MS) {
    memCache.delete(key);
    return null;
  }
  return hit.payload;
}

function memSet(key: string, payload: ItunesPayload) {
  // 简单防泄漏：超上限时按插入序淘汰最旧
  if (memCache.size >= MEM_MAX_ENTRIES) {
    const oldest = memCache.keys().next().value;
    if (oldest !== undefined) memCache.delete(oldest);
  }
  memCache.set(key, { at: Date.now(), payload });
}

// 上游 results 里除曲目外可能混 collection/artist 条目；只保留曲目并精简字段
function pickTracks(results: any[]): ItunesTrack[] {
  return results
    .filter((r) => r && r.wrapperType === 'track' && r.trackName)
    .map((r) => ({
      trackId: Number(r.trackId) || 0,
      trackName: String(r.trackName),
      artistName: String(r.artistName ?? ''),
      collectionName: String(r.collectionName ?? ''),
      previewUrl: String(r.previewUrl ?? ''),
      trackNumber: Number(r.trackNumber) || 0,
    }))
    .sort((a, b) => a.trackNumber - b.trackNumber);
}

// search 模式按相关度返回的 results 可能混入多张专辑（同名/合集/单曲版/混入他人）；
// 先按 artistName 归一化包含过滤，再按 collectionId 分组取曲目最多的一组，
// 保证返回同一张专辑的连续曲目列表（专辑名本身不参与过滤：script.js 的简体/英文
// 与 iTunes 的繁体/日文原名存在拼写差异，album 词只贡献给上游相关度）
function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[\s.'’·。、,\-()（）]/g, '');
}

function pickDominantCollection(results: any[], artistNeedle: string): { tracks: ItunesTrack[]; collectionId: number | null; collectionName: string; artistName: string } {
  const tracks = pickTracks(results);
  const filtered = artistNeedle
    ? tracks.filter((t) => normalizeName(t.artistName).includes(artistNeedle))
    : tracks;
  if (filtered.length === 0) {
    return { tracks: [], collectionId: null, collectionName: '', artistName: '' };
  }

  const groups = new Map<number, { tracks: ItunesTrack[]; collectionName: string; artistName: string }>();
  for (const t of filtered) {
    const raw = results.find((r) => r?.wrapperType === 'track' && Number(r?.trackId) === t.trackId);
    const cid = Number(raw?.collectionId) || 0;
    const group = groups.get(cid) || { tracks: [], collectionName: t.collectionName, artistName: t.artistName };
    group.tracks.push(t);
    groups.set(cid, group);
  }

  let best = { cid: 0, group: groups.get(0) };
  for (const [cid, group] of groups) {
    if (!best.group || group.tracks.length > best.group.tracks.length) best = { cid, group };
  }
  const winner = best.group!;
  return {
    tracks: winner.tracks,
    collectionId: best.cid || null,
    collectionName: winner.collectionName,
    artistName: winner.artistName,
  };
}

async function fetchUpstreamJson(url: string): Promise<any> {
  const response = await fetch(url, { headers: UPSTREAM_HEADERS, cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`upstream ${response.status}`);
  }
  return response.json();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const collectionId = searchParams.get('collectionId')?.trim() ?? '';
  const artist = searchParams.get('artist')?.trim() ?? '';
  const album = searchParams.get('album')?.trim() ?? '';
  const term = searchParams.get('term')?.trim() ?? '';
  const country = (searchParams.get('country')?.trim() || 'US').toUpperCase();

  if (!collectionId && !artist && !album && !term) {
    return NextResponse.json({ error: 'collectionId or artist/album required' }, { status: 400 });
  }
  if (collectionId && !/^\d{1,16}$/.test(collectionId)) {
    return NextResponse.json({ error: 'invalid collectionId' }, { status: 400 });
  }
  if (!/^[A-Z]{2}$/.test(country)) {
    return NextResponse.json({ error: 'invalid country' }, { status: 400 });
  }
  if (artist.length > 60 || album.length > 120 || term.length > 120) {
    return NextResponse.json({ error: 'invalid query' }, { status: 400 });
  }

  const cacheKey = collectionId
    ? `lookup:${collectionId}`
    : `search:${[artist, album, term].join('|').toLowerCase()}@${country}`;
  const cached = memGet(cacheKey);
  if (cached) {
    return gzipJson(request, cached, { 'Cache-Control': CACHE_CONTROL, 'X-Itunes-Cache': 'memory' });
  }

  try {
    let payload: ItunesPayload;

    if (collectionId) {
      // lookup 模式：id 即专辑集合，entity=song 展开整张曲目（limit 200 覆盖超长专辑）
      const data = await fetchUpstreamJson(
        `https://itunes.apple.com/lookup?id=${collectionId}&entity=song&limit=200`
      );
      const results: any[] = Array.isArray(data?.results) ? data.results : [];
      const tracks = pickTracks(results);
      const first = results.find((r) => r?.wrapperType === 'track');
      payload = {
        collectionId: Number(collectionId),
        collectionName: String(first?.collectionName ?? ''),
        artistName: String(first?.artistName ?? ''),
        tracks,
      };
    } else {
      // search 模式：term 兜底（缺失试听的专辑没有本地 collectionId 可用）
      const q = [artist, album, term].filter(Boolean).join(' ');
      const data = await fetchUpstreamJson(
        `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=song&limit=50&country=${country}`
      );
      const results: any[] = Array.isArray(data?.results) ? data.results : [];
      const artistNeedle = artist ? normalizeName(artist) : '';
      const dominant = pickDominantCollection(results, artistNeedle);
      payload = {
        collectionId: dominant.collectionId,
        collectionName: dominant.collectionName,
        artistName: dominant.artistName,
        tracks: dominant.tracks,
      };
    }

    memSet(cacheKey, payload);
    return gzipJson(request, payload, { 'Cache-Control': CACHE_CONTROL, 'X-Itunes-Cache': 'miss' });
  } catch {
    return NextResponse.json({ error: 'upstream error' }, { status: 502 });
  }
}
