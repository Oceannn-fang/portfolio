import { gzipSync } from 'node:zlib';

/**
 * API 路由专用 gzip 压缩响应 helper。
 *
 * 背景：Next.js 自托管（next start）下不会对 App Router 的 API 响应做压缩，
 * 静态资源有 gzip 而数据接口（netease/playlist 约 112KB、spotify 各接口）裸传。
 * 本 helper 在路由内用 node:zlib 同步压缩 JSON 响应体：
 * - 客户端 Accept-Encoding 支持 gzip 且响应体 >= 1KB 时输出 Content-Encoding: gzip
 * - 不支持 gzip 的客户端（含显式 gzip;q=0）返回原文
 * - 无论压缩与否都带 Vary: Accept-Encoding，保证中间缓存按请求头正确区分变体
 * - 与 Cache-Control 等缓存头完全共存（由 extraHeaders 透传）
 */

/** 小于该阈值的响应不压缩（压缩开销大于收益） */
const MIN_COMPRESS_BYTES = 1024;

/** 解析 Accept-Encoding，判断客户端是否接受 gzip（尊重 q=0 显式拒绝） */
function acceptsGzip(request: Request): boolean {
  const acceptEncoding = (request.headers.get('accept-encoding') ?? '').toLowerCase();
  if (!acceptEncoding) return false;
  for (const part of acceptEncoding.split(',')) {
    const segment = part.trim();
    if (!/^gzip\b/.test(segment)) continue;
    const q = /;q=([\d.]+)/.exec(segment);
    return !q || parseFloat(q[1]) > 0;
  }
  return false;
}

/**
 * 构造可按需 gzip 压缩的 JSON 成功响应。
 * @param request 路由收到的原始 Request（用于读取 Accept-Encoding）
 * @param data 要序列化的响应数据
 * @param extraHeaders 额外响应头（如 Cache-Control），与压缩头共存
 */
export function gzipJson(
  request: Request,
  data: unknown,
  extraHeaders: Record<string, string> = {}
): Response {
  const body = Buffer.from(JSON.stringify(data), 'utf8');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8',
    'Vary': 'Accept-Encoding',
    ...extraHeaders,
  };

  if (body.length >= MIN_COMPRESS_BYTES && acceptsGzip(request)) {
    return new Response(gzipSync(body), {
      status: 200,
      headers: { ...headers, 'Content-Encoding': 'gzip' },
    });
  }

  return new Response(body, { status: 200, headers });
}
