import type { Metadata } from "next";
import localFont from "next/font/local";
import { SmoothScroll } from "@/components/SmoothScroll";
import "./globals.css";

const fzXiaoBiaoSong = localFont({
  src: "../fonts/方正小标宋简体.ttf",
  variable: "--font-fzxiaobiaosong",
  display: "swap",
});

const bonaNova = localFont({
  src: [
    { path: "../fonts/BonaNova-Regular.ttf", weight: "400" },
    { path: "../fonts/BonaNova-Bold.ttf", weight: "700" },
  ],
  variable: "--font-bona-nova",
  display: "swap",
});

const satoshi = localFont({
  src: [
    { path: "../fonts/Satoshi-Light.otf", weight: "300" },
    { path: "../fonts/Satoshi-Medium.otf", weight: "500" },
    { path: "../fonts/Satoshi-Bold.otf", weight: "700" },
  ],
  variable: "--font-satoshi",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Portfolio",
  description: "Personal website",
  openGraph: {
    title: "Portfolio",
    description: "Personal website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="zh-CN"
      className={`${fzXiaoBiaoSong.variable} ${bonaNova.variable} ${satoshi.variable}`}
    >
      <body>
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  );
}
