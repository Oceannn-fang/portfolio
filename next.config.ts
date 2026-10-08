import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  // 本地 dev 隐藏左下角 Next.js Dev Tools 指示器（生产构建本就无此按钮）
  devIndicators: false,
};

export default nextConfig;
