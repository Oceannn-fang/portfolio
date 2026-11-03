import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  // 本地 dev 隐藏左下角 Next.js Dev Tools 指示器（生产构建本就无此按钮）
  devIndicators: false,
  // 胶片档案暂不上线（2026-11-03 用户要求：只上作品集）：
  // 首页入口已摘除，这里把 /film 路由一并挡掉，避免被直接输 URL 访问。
  // 相关文件（app/film、components/FilmArchiveModule、lib/film-rolls、public/images/film）
  // 仍保留在仓库中，需要重新上线时删掉本段 redirects 并恢复首屏入口行即可。
  async redirects() {
    return [
      { source: "/film", destination: "/", permanent: false },
      { source: "/film/:path*", destination: "/", permanent: false },
    ];
  },
};

export default nextConfig;
