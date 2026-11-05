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
      // 开发期预览页，不该对公网开放（cardstack-preview 还会拉 fonts.googleapis.com）
      { source: "/cardstack-preview", destination: "/", permanent: false },
      { source: "/driftwall-test", destination: "/", permanent: false },
    ];
  },
  // public/ 下的静态资源默认响应头是 `public, max-age=0, must-revalidate`（实测），
  // 等于每次回访都重新验证/重下：作品单图 740KB、30 张专辑封面 756KB 都要再拉一遍。
  // 这里按目录给长缓存；/images/** 故意不给 immutable——update-portfolio 管线会覆盖同名
  // 衍生图（新作品沿用 id），标 immutable 会让用户一年看不到更新，7 天 + SWR 是安全上限。
  async headers() {
    return [
      {
        source: "/images/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=604800, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/gk3-assets/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/music-cover-3d/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/fonts/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
