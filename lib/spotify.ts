import { promises as fs } from 'node:fs';
import nodePath from 'node:path';

/**
 * Spotify 服务端工具模块
 *
 * 职责：
 * 1. Token 持久化（lib/spotify-token.json），文件缺失或损坏时返回 null
 * 2. access_token 的自动续期（refresh_token 轮换 + 并发去重）
 * 3. Serverless 回退：只读文件系统（如 Vercel）上 token 文件不可用时，
 *    用环境变量 SPOTIFY_REFRESH_TOKEN 走 refresh_token grant 换取 access_token，
 *    让所有访客都能看到站主的 Spotify 数据（无需每个访客各自 OAuth）
 * 4. 带 Bearer 认证的 Spotify Web API GET 请求封装
 * 5. 统一的 JSON 错误响应，供各 route.ts 直接返回
 *
 * 仅可在服务端（Node.js runtime）使用，禁止被客户端组件引入。
 */

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

/** Spotify Token 接口地址 */
const TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token';

/** Spotify Web API 基础地址 */
const API_BASE = 'https://api.spotify.com';

/** Token 持久化文件：项目根目录下的 lib/spotify-token.json（已加入 .gitignore） */
const TOKEN_FILE_PATH = nodePath.join(process.cwd(), 'lib', 'spotify-token.json');

/** 过期缓冲：提前 60 秒判定为过期，避免请求在途中 token 失效 */
const EXPIRY_BUFFER_MS = 60 * 1000;

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------

/** 持久化到磁盘的 token 结构 */
export interface SpotifyToken {
  /** 访问令牌 */
  access_token: string;
  /** 刷新令牌，Spotify 会在刷新时轮换，需要一并保存 */
  refresh_token?: string;
  /** 令牌类型，通常为 Bearer */
  token_type?: string;
  /** 已授权的 scope，空格分隔 */
  scope?: string;
  /** 过期时间点（Unix 毫秒时间戳），由 expires_in 换算而来 */
  expires_at: number;
}

/** Spotify 图片资源 */
export interface SpotifyImage {
  url: string;
  height: number | null;
  width: number | null;
}

/** Spotify 精简艺术家对象 */
export interface SpotifyArtist {
  id: string;
  name: string;
}

/** Spotify 专辑对象（不同接口返回的字段丰俭不一，故多为可选） */
export interface SpotifyAlbum {
  id: string;
  name: string;
  images?: SpotifyImage[];
  artists?: SpotifyArtist[];
  release_date?: string;
  total_tracks?: number;
}

/** Spotify 曲目对象 */
export interface SpotifyTrack {
  id: string;
  name: string;
  artists?: SpotifyArtist[];
  album?: SpotifyAlbum;
  duration_ms?: number;
  track_number?: number;
  preview_url?: string | null;
}

/** GET /v1/me/player/recently-played 原始响应 */
export interface RecentlyPlayedResponse {
  items: Array<{ track: SpotifyTrack; played_at: string }>;
}

/** GET /v1/me/albums 原始响应 */
export interface SavedAlbumsResponse {
  items: Array<{ added_at: string; album: SpotifyAlbum }>;
}

/** GET /v1/albums/{id}/tracks 原始响应 */
export interface AlbumTracksResponse {
  items: SpotifyTrack[];
}

// ---------------------------------------------------------------------------
// 错误处理
// ---------------------------------------------------------------------------

/**
 * Spotify 相关错误，自带 HTTP 状态码，路由捕获后可直接转成 JSON 响应。
 * - 401：未授权 / 授权已失效，前端应引导用户重新走 OAuth
 * - 500：环境变量或凭据配置错误
 * - 502：Spotify 上游接口异常
 */
export class SpotifyError extends Error {
  readonly status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = 'SpotifyError';
    this.status = status;
  }
}

/** 构造统一的 JSON 错误响应：{ error: 'message' } + 状态码 */
export function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

/**
 * 构造统一的 JSON 成功响应。
 * @param data 响应体
 * @param cacheControl 缓存策略，默认不缓存以保证播放状态实时
 */
export function jsonOk(data: unknown, cacheControl = 'no-store'): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': cacheControl,
    },
  });
}

/** 把 Spotify Web API 的非 2xx 状态码转成对外的 JSON 错误响应 */
export function upstreamError(status: number): Response {
  if (status === 401 || status === 403) {
    return jsonError('Spotify 授权已失效或权限不足，请重新访问 /api/auth/spotify 完成登录', 401);
  }
  if (status === 404) {
    return jsonError('Spotify 资源不存在', 404);
  }
  if (status === 429) {
    return jsonError('Spotify 接口触发限流，请稍后重试', 429);
  }
  return jsonError(`Spotify 接口调用失败（HTTP ${status}）`, 502);
}

/** 把任意异常归一化为 JSON 错误响应，供 route.ts 的 catch 分支复用 */
export function toErrorResponse(error: unknown): Response {
  if (error instanceof SpotifyError) {
    return jsonError(error.message, error.status);
  }
  console.error('[spotify] 未预期的错误：', error);
  return jsonError('服务器内部错误', 500);
}

// ---------------------------------------------------------------------------
// 环境变量
// ---------------------------------------------------------------------------

/** 读取并校验 Client 凭据 */
function getCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new SpotifyError(
      '缺少环境变量 SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET，请检查 .env.local',
      500
    );
  }

  // 拦截 .env.local 里的占位符，给出比 Spotify 的 invalid_client 更明确的提示
  if (clientId === 'your_client_id_here' || clientSecret === 'your_client_secret_here') {
    throw new SpotifyError(
      'Spotify 凭据仍为占位符，请在 .env.local 中填入真实的 Client ID 与 Client Secret',
      500
    );
  }

  return { clientId, clientSecret };
}

/** 读取并校验 Client ID（跳转授权页只需 ID，不需要 Secret） */
export function getClientId(): string {
  return getCredentials().clientId;
}

/** 读取并校验 OAuth 回调地址 */
export function getRedirectUri(): string {
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI;
  if (!redirectUri) {
    throw new SpotifyError('缺少环境变量 SPOTIFY_REDIRECT_URI，请检查 .env.local', 500);
  }
  return redirectUri;
}

// ---------------------------------------------------------------------------
// Token 持久化
// ---------------------------------------------------------------------------

/**
 * 内存兜底缓存。
 * Serverless 等只读文件系统上写盘会失败，此时至少在单次进程生命周期内保住 token。
 */
let memoryToken: SpotifyToken | null = null;

/** token 文件的绝对路径，便于调试与测试 */
export function getTokenFilePath(): string {
  return TOKEN_FILE_PATH;
}

/** 判断 token 是否已过期（含 60 秒缓冲） */
function isExpired(token: SpotifyToken): boolean {
  return Date.now() + EXPIRY_BUFFER_MS >= token.expires_at;
}

/**
 * 读取持久化的 token。
 * 文件不存在、JSON 损坏或字段缺失时返回 null（首次运行即为此情况）。
 */
export async function readToken(): Promise<SpotifyToken | null> {
  try {
    const raw = await fs.readFile(TOKEN_FILE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<SpotifyToken>;

    // 字段校验：结构不合法一律当作「没有 token」，避免带着脏数据去打接口
    if (typeof parsed?.access_token !== 'string' || typeof parsed?.expires_at !== 'number') {
      console.warn('[spotify] token 文件结构不合法，已忽略');
      return memoryToken;
    }

    const token = parsed as SpotifyToken;
    memoryToken = token;
    return token;
  } catch {
    // ENOENT（未授权过）/ 解析失败 / 无读取权限，统一回退到内存缓存
    return memoryToken;
  }
}

/**
 * 保存 token：先写内存再落盘。
 * 落盘失败不会抛错，只记录告警，保证只读文件系统下授权流程依然可用。
 */
export async function saveToken(token: SpotifyToken): Promise<void> {
  memoryToken = token;
  try {
    await fs.mkdir(nodePath.dirname(TOKEN_FILE_PATH), { recursive: true });
    await fs.writeFile(TOKEN_FILE_PATH, JSON.stringify(token, null, 2), 'utf-8');
  } catch (error) {
    console.warn('[spotify] token 写入文件失败，已退化为进程内存缓存：', error);
  }
}

// ---------------------------------------------------------------------------
// Token 接口调用
// ---------------------------------------------------------------------------

/** 构造 HTTP Basic 认证头 */
function basicAuthHeader(clientId: string, clientSecret: string): string {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
}

/** 把 Spotify token 接口的 error 码映射成合适的 HTTP 状态码 */
function mapTokenErrorStatus(errorCode: unknown): number {
  if (errorCode === 'invalid_client') return 500; // 凭据配置错误
  if (errorCode === 'invalid_grant') return 401; // code / refresh_token 已失效，需重新授权
  return 502; // 其余一律视为上游异常
}

/** 向 Spotify token 接口发起表单 POST，返回解析后的 JSON */
async function postTokenEndpoint(body: URLSearchParams): Promise<Record<string, unknown>> {
  const { clientId, clientSecret } = getCredentials();

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(clientId, clientSecret),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
    cache: 'no-store',
  });

  const text = await response.text();

  let data: Record<string, unknown>;
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    throw new SpotifyError(`Spotify token 接口返回了非 JSON 内容（HTTP ${response.status}）`, 502);
  }

  if (!response.ok) {
    const code = typeof data.error === 'string' ? data.error : `HTTP ${response.status}`;
    const description = typeof data.error_description === 'string' ? ` - ${data.error_description}` : '';
    throw new SpotifyError(`Spotify token 接口调用失败：${code}${description}`, mapTokenErrorStatus(data.error));
  }

  return data;
}

/** 把 token 接口的响应体归一化为 SpotifyToken 并落盘 */
async function persistTokenResponse(
  data: Record<string, unknown>,
  fallbackRefreshToken: string
): Promise<SpotifyToken> {
  const accessToken = data.access_token;
  const expiresIn = data.expires_in;

  if (typeof accessToken !== 'string' || typeof expiresIn !== 'number') {
    throw new SpotifyError('Spotify token 响应缺少 access_token / expires_in 字段', 502);
  }

  const token: SpotifyToken = {
    access_token: accessToken,
    // Spotify 只在轮换时才下发新的 refresh_token，缺失时沿用旧值
    refresh_token: typeof data.refresh_token === 'string' ? data.refresh_token : fallbackRefreshToken,
    token_type: typeof data.token_type === 'string' ? data.token_type : 'Bearer',
    scope: typeof data.scope === 'string' ? data.scope : undefined,
    expires_at: Date.now() + expiresIn * 1000,
  };

  await saveToken(token);
  return token;
}

/**
 * 用 refresh_token 换取新的 access_token，并持久化结果。
 * @param refreshToken 刷新令牌
 */
export async function refreshAccessToken(refreshToken: string): Promise<SpotifyToken> {
  const data = await postTokenEndpoint(
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    })
  );

  return persistTokenResponse(data, refreshToken);
}

/**
 * Authorization Code Flow：用授权码换取 token，并持久化到 lib/spotify-token.json。
 * @param code Spotify 回调时带回的授权码
 */
export async function exchangeCodeForToken(code: string): Promise<SpotifyToken> {
  const data = await postTokenEndpoint(
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: getRedirectUri(),
    })
  );

  const token = await persistTokenResponse(data, '');

  if (!token.refresh_token) {
    // 没有 refresh_token 就无法长期续期，提前暴露问题而不是等到接口 401
    throw new SpotifyError('Spotify 未返回 refresh_token，无法维持长期授权', 502);
  }

  return token;
}

/**
 * 刷新去重：同一时刻只允许一个刷新请求在途。
 * Spotify 会轮换 refresh_token，并发刷新会让彼此手中的 token 相互作废。
 */
let refreshing: Promise<string | null> | null = null;

/**
 * 获取可用的 access_token：未过期直接返回，已过期则自动刷新。
 * 文件 token 不可用（serverless 只读文件系统 / 从未在本地授权）时，
 * 回退到环境变量 SPOTIFY_REFRESH_TOKEN，见 getAccessTokenFromEnv。
 * @param forceRefresh 强制刷新（用于上游返回 401 后的重试）
 * @returns 有效的 access_token；从未授权或无法续期时返回 null
 */
export async function getAccessToken(forceRefresh = false): Promise<string | null> {
  const token = await readToken();
  if (!token) {
    return getAccessTokenFromEnv(forceRefresh);
  }

  if (!forceRefresh && !isExpired(token)) {
    return token.access_token;
  }

  if (!token.refresh_token) {
    // 没有 refresh_token 就无法续期，尝试 env 回退，仍不可用则等同未授权
    return getAccessTokenFromEnv(forceRefresh);
  }

  if (!refreshing) {
    refreshing = refreshAccessToken(token.refresh_token)
      .then((next) => next.access_token)
      .catch((error) => {
        console.error('[spotify] 刷新 access_token 失败：', error);
        return null;
      })
      .finally(() => {
        refreshing = null;
      });
  }

  return refreshing;
}

// ---------------------------------------------------------------------------
// Serverless 环境变量回退（SPOTIFY_REFRESH_TOKEN）
// ---------------------------------------------------------------------------

/**
 * env 回退模式下的模块级 access_token 缓存。
 * 未过期直接复用，避免每个请求都触发 refresh（降低 refresh token 轮换压力，
 * 也减少 Spotify token 接口的调用次数）。
 */
let envTokenCache: { accessToken: string; expiresAt: number } | null = null;

/** env 回退的刷新去重：与文件路径的 refreshing 同理，同一时刻只允许一个在途请求 */
let envRefreshing: Promise<string | null> | null = null;

/** 判断 token 文件是否存在（serverless bundle 里没有该文件，本地开发通常有） */
async function tokenFileExists(): Promise<boolean> {
  try {
    await fs.access(TOKEN_FILE_PATH);
    return true;
  } catch {
    return false;
  }
}

/**
 * 用环境变量里的 refresh token 换取 access_token（不经过 saveToken 写盘）。
 *
 * ⚠️ 运维注意（refresh token 轮换）：
 * Spotify 刷新时可能返回新的 refresh_token（旧值随即作废）。Serverless 文件系统
 * 只读，新值无法持久化——一旦轮换发生，下次 cold start 用 env 里的旧值刷新会得到
 * invalid_grant，线上 Spotify 模块将全部 401。因此这里检测到轮换时只 console.warn
 * 提示更新 Vercel 环境变量，不影响当前请求（本次拿到的 access_token 仍然有效）。
 * 看到告警后应尽快：在 Vercel 项目设置中把 SPOTIFY_REFRESH_TOKEN 更新为新值并重新部署。
 *
 * @param refreshToken 来自 process.env.SPOTIFY_REFRESH_TOKEN 的刷新令牌
 */
async function refreshViaEnvToken(refreshToken: string): Promise<string | null> {
  const data = await postTokenEndpoint(
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    })
  );

  const accessToken = data.access_token;
  const expiresIn = data.expires_in;

  if (typeof accessToken !== 'string' || typeof expiresIn !== 'number') {
    throw new SpotifyError('Spotify token 响应缺少 access_token / expires_in 字段', 502);
  }

  // 轮换检测：只告警、不中断（详见上方 JSDoc 的运维注意）
  if (typeof data.refresh_token === 'string' && data.refresh_token !== refreshToken) {
    console.warn(
      '[spotify] refresh token 已轮换：Spotify 下发了新的 refresh_token，但 serverless 环境无法持久化。' +
        '请尽快把 Vercel 环境变量 SPOTIFY_REFRESH_TOKEN 更新为新值并重新部署，' +
        '否则下次 cold start 后线上 Spotify 数据将返回 401。'
    );
  }

  envTokenCache = { accessToken, expiresAt: Date.now() + expiresIn * 1000 };
  return accessToken;
}

/**
 * 环境变量回退入口：
 * - 仅当文件 token 不可用（文件不存在或没有 refresh_token）时才会被调用；
 *   本地开发（存在 spotify-token.json）路径完全不受影响。
 * - 未配置 SPOTIFY_REFRESH_TOKEN 时返回 null（由 spotifyFetch 转成明确的 401 未授权），
 *   不抛未捕获异常。
 * - 凭据缺失（CLIENT_ID/SECRET）时仍按配置错误抛 500，与文件路径行为一致。
 */
async function getAccessTokenFromEnv(forceRefresh = false): Promise<string | null> {
  const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;
  if (!refreshToken) {
    // 本地文件不存在 + env 未配置：这是正常的「未授权」状态，前端会展示登录引导
    console.warn(
      '[spotify] 无可用 token：token 文件不存在且未配置环境变量 SPOTIFY_REFRESH_TOKEN（serverless 环境需要配置后者）'
    );
    return null;
  }

  if (!forceRefresh && envTokenCache && Date.now() + EXPIRY_BUFFER_MS < envTokenCache.expiresAt) {
    return envTokenCache.accessToken;
  }

  if (!envRefreshing) {
    envRefreshing = refreshViaEnvToken(refreshToken)
      .catch((error) => {
        console.error('[spotify] 通过 SPOTIFY_REFRESH_TOKEN 换取 access_token 失败：', error);
        return null;
      })
      .finally(() => {
        envRefreshing = null;
      });
  }

  return envRefreshing;
}

/**
 * 诊断辅助：报告当前 token 来源与可用性（不含任何密钥值）。
 * 供排障脚本 / 健康检查使用。
 */
export async function getTokenStatus(): Promise<{
  fileExists: boolean;
  envRefreshTokenSet: boolean;
  envCacheValid: boolean;
}> {
  const [fileExists] = await Promise.all([tokenFileExists()]);
  return {
    fileExists,
    envRefreshTokenSet: Boolean(process.env.SPOTIFY_REFRESH_TOKEN),
    envCacheValid: Boolean(
      envTokenCache && Date.now() + EXPIRY_BUFFER_MS < envTokenCache.expiresAt
    ),
  };
}

// ---------------------------------------------------------------------------
// Web API 请求封装
// ---------------------------------------------------------------------------

/**
 * 服务端内存缓存（1 小时过期）
 * 避免频繁调用 Spotify API，减少网络往返带来的卡顿。
 * 缓存键为请求 URL，值为响应体文本 + 状态码 + 过期时间。
 */
const apiCache = new Map<string, { body: string; status: number; expiresAt: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 小时

/** 定期清理过期缓存条目，避免内存泄漏（每 30 分钟执行一次） */
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of apiCache) {
    if (now >= entry.expiresAt) apiCache.delete(key);
  }
}, 30 * 60 * 1000);

/**
 * 带 Bearer 认证的 Spotify Web API GET 请求封装，内置服务端内存缓存。
 *
 * @param path 以 /v1 开头的相对路径（如 /v1/me/albums?limit=20），也接受完整 URL
 * @returns 上游原始 Response，由调用方决定如何解析
 * @throws SpotifyError(401) 当本地没有可用 token 时
 */
export async function spotifyFetch(path: string): Promise<Response> {
  const url = /^https?:\/\//.test(path) ? path : `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;

  // 1. 检查内存缓存是否有效，有效则直接返回缓存数据
  const cached = apiCache.get(url);
  if (cached && Date.now() < cached.expiresAt) {
    return new Response(cached.body, {
      status: cached.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 2. 缓存无效或不存在，调用 Spotify API
  const token = await getAccessToken();

  if (!token) {
    throw new SpotifyError('Spotify 未授权或授权已过期，请先访问 /api/auth/spotify 完成登录', 401);
  }

  const send = (accessToken: string) =>
    fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

  let response = await send(token);

  // 上游 401 说明 token 在 Spotify 侧已失效（例如用户撤销授权），强制刷新后重试一次
  if (response.status === 401) {
    const retryToken = await getAccessToken(true);
    if (retryToken && retryToken !== token) {
      response = await send(retryToken);
    }
  }

  // 3. 成功响应存入缓存，避免后续重复请求
  if (response.ok || response.status === 204) {
    const body = await response.clone().text();
    apiCache.set(url, { body, status: response.status, expiresAt: Date.now() + CACHE_TTL });
  }

  return response;
}

// ---------------------------------------------------------------------------
// 数据整形辅助
// ---------------------------------------------------------------------------

/** 从图片数组中挑出尺寸最大的一张，取不到时返回 null */
export function pickLargestImage(images?: SpotifyImage[]): string | null {
  if (!images || images.length === 0) return null;

  let best = images[0];
  for (const image of images) {
    const bestArea = (best.width ?? 0) * (best.height ?? 0);
    const area = (image.width ?? 0) * (image.height ?? 0);
    if (area > bestArea) best = image;
  }

  return best?.url ?? null;
}

/**
 * 按目标边长挑选最合适的图片变体（#71 封面缩图）。
 * Spotify images 数组通常含 640/300/64 三档：列表缩略图、网格卡片用 300 足够，
 * 比恒选 640 原图省 ~60% 传输量（i.scdn.co 封面占首屏总传输的一半）。
 * 策略：选「不小于 target 的最小变体」（保清晰）；全都小于 target 时退而取最大一张。
 * @param images Spotify 图片数组
 * @param target 展示位目标边长（px，建议按 2x DPR 估算）
 */
export function pickImage(images: SpotifyImage[] | undefined, target: number): string | null {
  if (!images || images.length === 0) return null;

  const sized = images.filter((img) => typeof img.width === 'number' && img.width > 0);
  if (sized.length === 0) return images[0]?.url ?? null;

  const suitable = sized.filter((img) => (img.width as number) >= target);
  const pool = suitable.length > 0 ? suitable : sized;
  return pool.reduce((best, img) => ((img.width as number) < (best.width as number) ? img : best)).url ?? null;
}

/** 把艺术家数组拼接成展示用字符串 */
export function joinArtists(artists?: SpotifyArtist[]): string {
  if (!artists || artists.length === 0) return '';
  return artists
    .map((artist) => artist?.name)
    .filter((name): name is string => Boolean(name))
    .join(', ');
}
