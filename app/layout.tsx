import type { Metadata, Viewport } from "next";
import "./globals.css";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3100";
const pageTitle = "George Kedenburg III";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: pageTitle,
  description: "Product Designer",
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
  themeColor: "rgb(19, 69, 250)",
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
