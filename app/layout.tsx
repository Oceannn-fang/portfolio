import type { Metadata, Viewport } from "next";
import "./globals.css";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3100";
const pageTitle = "Works, Notes, and Unfinished."; // #73：hero 标题同步 SEO/og/twitter title（description 不含旧名，不动）

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: pageTitle,
  description: "Product Designer",
  // #71 SEO：单页站点，canonical 固定指向根路径；相对 URL 由 metadataBase
  // （NEXT_PUBLIC_SITE_URL，线上为 https://oceanfolio.vercel.app）解析为绝对地址
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: pageTitle,
    description: "Product Designer",
    type: "website",
    url: siteUrl,
    videos: [{ url: `${siteUrl}/social.mp4`, type: "video/mp4" }],
    images: [{ url: `${siteUrl}/social.jpg` }],
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description: "Product Designer",
    images: [`${siteUrl}/social.jpg`],
  },
};

export const viewport: Viewport = {
  themeColor: "rgb(16, 34, 128)",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-US">
      <body className="gk3-page">{children}</body>
    </html>
  );
}
