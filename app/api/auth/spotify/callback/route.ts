import { NextResponse, type NextRequest } from 'next/server';
import { exchangeCodeForToken, jsonError, toErrorResponse } from '@/lib/spotify';

export const dynamic = 'force-dynamic';

/** 与授权发起路由共用的 state cookie 名称 */
const STATE_COOKIE = 'spotify_oauth_state';

/**
 * GET /api/auth/spotify/callback
 * Spotify 授权回调：校验 state → 用 code 换 token → 持久化 → 重定向回首页。
 */
export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url);

  /** 统一构造跳回站内的 302 响应，并顺手清掉一次性的 state cookie */
  const redirectHome = (query?: string): Response => {
    const response = NextResponse.redirect(new URL(query ? `/?${query}` : '/', request.url), 302);
    response.cookies.delete(STATE_COOKIE);
    return response;
  };

  try {
    // 用户在授权页点了「取消」，Spotify 会带 error 参数回来，属于正常流程分支
    const denial = searchParams.get('error');
    if (denial) {
      return redirectHome(`spotify=denied&reason=${encodeURIComponent(denial)}`);
    }

    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const storedState = request.cookies.get(STATE_COOKIE)?.value;

    if (!code) {
      return jsonError('回调缺少 code 参数，授权未完成', 400);
    }

    // state 必须与发起授权时写入 cookie 的值完全一致，否则视为 CSRF 或过期会话
    if (!state || !storedState || state !== storedState) {
      return jsonError('state 校验失败：授权会话已过期或被篡改，请重新发起授权', 400);
    }

    // Authorization Code Flow：POST https://accounts.spotify.com/api/token
    // 成功后 token 会被写入 lib/spotify-token.json
    await exchangeCodeForToken(code);

    return redirectHome();
  } catch (error) {
    return toErrorResponse(error);
  }
}
