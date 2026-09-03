import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getClientId, getRedirectUri, toErrorResponse } from '@/lib/spotify';

export const dynamic = 'force-dynamic';

/** Spotify 授权页地址 */
const AUTHORIZE_ENDPOINT = 'https://accounts.spotify.com/authorize';

/** 存放 state 的 httpOnly cookie 名称，用于回调时校验 CSRF */
const STATE_COOKIE = 'spotify_oauth_state';

/** state 有效期：10 分钟，超时后回调将拒绝该次授权 */
const STATE_MAX_AGE = 60 * 10;

/**
 * 申请的权限范围：
 * - user-read-recently-played：最近播放
 * - user-library-read：收藏的专辑 / 曲目
 * - user-read-currently-playing：当前正在播放
 */
const SCOPES = ['user-read-recently-played', 'user-library-read', 'user-read-currently-playing'].join(' ');

/**
 * GET /api/auth/spotify
 * 生成一次性 state 并 302 重定向到 Spotify 授权页。
 * 支持 ?force=1 强制弹出授权对话框（用于补充 scope 或切换账号）。
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const clientId = getClientId();
    const redirectUri = getRedirectUri();

    // 每次授权都生成全新的随机 state，写入 httpOnly cookie 供回调比对
    const state = randomBytes(16).toString('hex');

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: SCOPES,
      state,
      show_dialog: new URL(request.url).searchParams.get('force') === '1' ? 'true' : 'false',
    });

    const response = NextResponse.redirect(`${AUTHORIZE_ENDPOINT}?${params.toString()}`, 302);

    response.cookies.set(STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: STATE_MAX_AGE,
    });

    return response;
  } catch (error) {
    return toErrorResponse(error);
  }
}
