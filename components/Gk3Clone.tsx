"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import "./Gk3Clone.css";
import Noise from "./Noise";
import { setSharedNoisePhase } from "./noisePhase";
import MusicModule, { warmMusicCache, isMusicCacheValid } from "./MusicModule";
import AlbumShowcase, { warmAlbumCovers } from "./AlbumShowcase";
import PlaylistModule, { warmPlaylistCache, isPlaylistCacheValid } from "./PlaylistModule";
import PortfolioModule from "./PortfolioModule";
import TiltedCard from "./TiltedCard";
import { portfolioWorks } from "../lib/portfolio-images";
import LoadingScreen from "./LoadingScreen";

type ViewerMode = "phone" | "video" | "social" | "pin" | "music" | "showcase" | "playlist" | "portfolio";

type WorkItem = {
  text: React.ReactNode;
  href?: string;
  target?: "_new" | "_blank";
  viewer?: ViewerMode;
  media?: string;
  rowId: string;
  /** portfolio 行条目对应的作品 ID，选中后 viewer 展示单张全图 */
  workId?: string;
};

type Row = {
  id: string;
  title?: React.ReactNode;
  h3?: React.ReactNode;
  solo?: boolean;
  items?: WorkItem[];
  bar?: boolean;
  legal?: boolean;
  component?: React.ReactNode;
};

const placeholders = [
  "placeholder.jpg",
  "blank page",
  "i'll find something to put here",
  "what's on your mind?",
  "what's happening?",
  "this space intentionally left blank",
  "spacer.gif",
  "blank page",
  "i'll find something to put here",
  "what's on your mind?",
  "what's happening?",
  "this space intentionally left blank",
  "for placement only",
  "lorem ipsum",
  "stare into the void",
  "behold the latent space",
  "mystery spot",
];

// #77：社媒三项 label 英文化（rednote / tiktok / weChat official account），label 需与 elsewhere items 的 text 完全一致以匹配 viewer 图标索引
const socialItems = ["rednote", "tiktok", "weChat official account"];
const socialSvgStrings = [
  '<path fill-rule="evenodd" clip-rule="evenodd" d="M46 30h54a16 16 0 0 1 16 16v54a16 16 0 0 1-16 16H46a16 16 0 0 1-16-16V46a16 16 0 0 1 16-16zm0 9a7 7 0 0 0-7 7v54a7 7 0 0 0 7 7h54a7 7 0 0 0 7-7V46a7 7 0 0 0-7-7z" fill="var(--fg-color)"/><path d="M60 54h26v54l-13-10-13 10z" fill="var(--fg-color)"/>',
  '<ellipse cx="60" cy="102" rx="20" ry="16" fill="var(--fg-color)"/><rect x="74" y="34" width="11" height="70" rx="2" fill="var(--fg-color)"/><path d="M85 34c14 4 24 12 30 24 0-18-12-30-30-34z" fill="var(--fg-color)"/>',
  '<path d="M56 32c-21 0-38 15-38 33 0 11 6 20 16 26l-5 16 18-9c3 1 6 1 9 1 21 0 38-15 38-33S77 32 56 32z" fill="var(--fg-color)"/><path d="M126 82c0-15-15-27-33-27s-33 12-33 27 15 27 33 27c3 0 6 0 9-1l15 7-4-12c8-6 13-13 13-21z" fill="var(--fg-color)"/>'
];

const rows: Row[] = [
  {
    id: "music",
    title: <>listening</>,
    items: [
      {
        text: "recently played",
        viewer: "music" as ViewerMode,
        rowId: "music",
      },
    ],
  },
  {
    id: "showcase",
    title: (
      <>
        <i>enter the archive</i>arc vinyl
      </>
    ),
    items: [
      {
        text: "enter the archive",
        viewer: "showcase" as ViewerMode,
        rowId: "showcase",
      },
    ],
  },
  {
    id: "playlist",
    title: (
      <>
        <i>doofus picks</i>playlist
      </>
    ),
    items: [
      {
        text: "doofus picks",
        viewer: "playlist" as ViewerMode,
        rowId: "playlist",
      },
    ],
  },
  {
    id: "portfolio",
    title: <>works</>,
    // 只取最新 10 个作品，避免列表过长
    items: portfolioWorks.slice(0, 10).map((work) => ({
      text: work.title,
      viewer: "portfolio" as ViewerMode,
      rowId: "portfolio",
      workId: work.id,
    })),
  },
  {
    id: "elsewhere",
    title: (
      <>
        <i>find me</i>elsewhere
      </>
    ),
    solo: true,
    items: [
      {
        text: "rednote",
        href: "https://xhslink.cn/o/6nYCOPZksMd",
        viewer: "social",
        rowId: "elsewhere",
      },
      {
        text: "tiktok",
        href: "https://v.douyin.com/J-XHqpOWdZg/",
        viewer: "social",
        rowId: "elsewhere",
      },
      {
        // 公众号无对外分享链接，指向搜狗微信搜索账号「丨靛藍丨」（中文已 URL 编码）；#77 label 英文化，账号名不再出现在 label
        text: "weChat official account",
        href: "https://weixin.sogou.com/weixin?type=1&s_from=input&query=%E4%B8%A8%E9%9D%9B%E8%97%8D%E4%B8%A8",
        viewer: "social",
        rowId: "elsewhere",
      },
    ],
  },
  {
    id: "bar",
    title: null,
    bar: true,
    items: [],
  },
  /* #85：末尾 legal 散文区行对象已删（两段 note 含 cat Bean's 小红书 链接）；版权行在上方 bar 行独立保留 */
];

const mediaNames = Array.from(
  new Set(
    rows.flatMap((row) =>
      (row.items ?? []).map((item) => item.media).filter((media): media is string => Boolean(media))
    )
  )
);

function rgbToHsl(r: number, g: number, b: number) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return [h * 360, s, l];
}

function hslToRgb(h: number, s: number, l: number) {
  const hue = ((h % 360) + 360) % 360 / 360;
  let r: number;
  let g: number;
  let b: number;
  if (s === 0) {
    r = l;
    g = l;
    b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, hue + 1 / 3);
    g = hue2rgb(p, q, hue);
    b = hue2rgb(p, q, hue - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function hue2rgb(p: number, q: number, t: number) {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

function rotateRgb(rgb: [number, number, number], degrees: number): [number, number, number] {
  const [h, s, l] = rgbToHsl(rgb[0], rgb[1], rgb[2]);
  return hslToRgb(h + degrees, s, l) as [number, number, number];
}

function adjustLightness(rgb: [number, number, number], delta: number): [number, number, number] {
  const [h, s, l] = rgbToHsl(rgb[0], rgb[1], rgb[2]);
  return hslToRgb(h, s, Math.min(1, Math.max(0, l + delta))) as [number, number, number];
}

export function Gk3Clone() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoFrameRef = useRef<HTMLDivElement>(null);
  const clearVideoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mediaCacheRef = useRef<Record<string, { video: string; poster: string }>>({});
  const flipRef = useRef(1);
  // 延迟关闭 viewer，避免 music 面板与行重叠导致立即触发 mouseleave
  const endViewerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [viewing, setViewing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [viewerClass, setViewerClass] = useState<ViewerMode>("phone");
  const [activeRow, setActiveRow] = useState<string | null>(null);
  const [socialIndex, setSocialIndex] = useState(0);
  const [placeholder, setPlaceholder] = useState("lorem ipsum");
  const [activeItem, setActiveItem] = useState<string | null>(null);
  const [currentMedia, setCurrentMedia] = useState<string | null>(null);
  const [mediaCacheVersion, setMediaCacheVersion] = useState(0);
  // 精选推荐全屏浮层状态
  const [showcaseOpen, setShowcaseOpen] = useState(false);
  // 作品集 viewer 当前选中的作品 ID（null 表示显示 DriftWall 总览）
  const [selectedPortfolioWork, setSelectedPortfolioWork] = useState<string | null>(null);
  // 作品大图浮层（TiltedCard）：点击单图打开；打开时 viewer 的 mouseleave 关闭计时全部跳过
  const [portfolioOverlayId, setPortfolioOverlayId] = useState<string | null>(null);
  // #53/#54 init 前移：预载 iframe 先以 1×1 挂载 —— 0×0 时合成器不调度 BeginFrame，
  // script.js 首帧 render（shader 编译 + 30 张纹理 GPU 上传）被推迟到用户点击
  // 瞬间（实测停帧 6.4s）；1×1 放行零尺寸守卫，收到 arc-vinyl:ready（或 12s
  // 超时兜底）后收回 0×0 零开销待命，打开时纯样式切换
  const [iframeMountReady, setIframeMountReady] = useState(false);
  const [arcInitDone, setArcInitDone] = useState(false);
  // 持久化浮层 iframe 引用：关闭时向 iframe 内 postMessage 停掉预览音频
  const showcaseIframeRef = useRef<HTMLIFrameElement>(null);
  // ── 加载动画状态 ──
  const [showLoading, setShowLoading] = useState(false);
  const [loadingDone, setLoadingDone] = useState(false);
  // loadingDone 的 ref 镜像：供 rAF/interval 闭包读取，避免重建动画循环
  const loadingDoneRef = useRef(false);

  useEffect(() => {
    loadingDoneRef.current = loadingDone;
  }, [loadingDone]);

  // 浮层关闭（含 Esc）：iframe 常驻不卸载，通知内部停掉预览音频，
  // 避免音频在 0×0 隐藏 iframe 里继续播放。首次渲染（ref 初值 false）不发消息。
  const showcaseOpenPrevRef = useRef(false);
  useEffect(() => {
    if (showcaseOpenPrevRef.current && !showcaseOpen) {
      showcaseIframeRef.current?.contentWindow?.postMessage("arc-vinyl:pause-preview", "*");
    }
    showcaseOpenPrevRef.current = showcaseOpen;
  }, [showcaseOpen]);

  // #54 预载挂载回撤到真正空闲（双路径）：init 不再与用户 hover 期的 2D 弧形
  // 动画抢主线程（#53 的 hover 后 1.5s 错峰实测导致 hover 期宿主 fps 27/
  // maxDelta 600ms/longtask 115ms）。① 首访（有 LoadingScreen）：覆盖期内即挂
  // 1×1——首帧 shader 编译的大停帧藏进 LoadingScreen；② 回访（跳过
  // LoadingScreen）：loadingDone 后 requestIdleCallback 自动挂载（2s 兜底）。
  // script.js 侧配合分帧（每帧最多 1 个 mesh 子任务，实测压平 244ms longtask）。
  // 封面已 480×480 WebP（691KB/30 张），提前挂载成本极低且不在首屏关键路径；
  // ready 收 0×0、12s 兜底、直接点开全屏兜底保持不变
  useEffect(() => {
    if (iframeMountReady) return;
    if (showLoading) {
      setIframeMountReady(true);
      return;
    }
    if (!loadingDone) return;
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(() => setIframeMountReady(true), { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }
    const t = window.setTimeout(() => setIframeMountReady(true), 300);
    return () => window.clearTimeout(t);
  }, [showLoading, loadingDone, iframeMountReady]);

  // #53 init 完成监听：script.js 在空闲期完成全部 mesh 首帧渲染后 postMessage
  // arc-vinyl:ready → 收回 0×0；12s 未收到（WebGL 不可用等）超时兜底收回 0×0，
  // 打开浮层时若 init 未完成则全屏等待（现状行为，不阻塞用户）
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.data === "arc-vinyl:ready") setArcInitDone(true);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);
  useEffect(() => {
    if (!iframeMountReady || arcInitDone) return;
    const t = setTimeout(() => setArcInitDone(true), 12000);
    return () => clearTimeout(t);
  }, [iframeMountReady, arcInitDone]);

  // ── 判断是否需要显示加载动画 ──
  useEffect(() => {
    const hasVisited = localStorage.getItem('gk3-visited');
    const cacheReady = isMusicCacheValid() && isPlaylistCacheValid();

    if (!cacheReady && !hasVisited) {
      // 首次访问且无缓存 → 显示加载动画
      setShowLoading(true);
    } else {
      // 缓存有效或已访问过 → 跳过动画，直接显示
      setLoadingDone(true);
      // 恢复上次滚动位置
      const lastScroll = localStorage.getItem('gk3-scroll');
      if (lastScroll) {
        requestAnimationFrame(() => {
          window.scrollTo(0, parseInt(lastScroll, 10));
        });
      }
    }
  }, []);
  // 加载完成回调：隐藏动画、标记已访问、恢复滚动位置
  const handleLoaded = useCallback(() => {
    setShowLoading(false);
    setLoadingDone(true);
    localStorage.setItem('gk3-visited', '1');
    const lastScroll = localStorage.getItem('gk3-scroll');
    if (lastScroll) {
      requestAnimationFrame(() => {
        window.scrollTo(0, parseInt(lastScroll, 10));
      });
    }
  }, []);

  // 预加载音乐数据：loadingDone 后拉取写入模块级缓存，hover 打开 viewer 时秒开。
  // 两个 warm 均不重复下载：warmPlaylistCache 内部走 lib/heat-requests 共享请求层
  // （与 LoadingScreen 复用同一 Promise）；warmMusicCache 的 spotify 请求在
  // LoadingScreen 阶段已由共享层发出，此时命中浏览器 HTTP 缓存（max-age=3600）。
  useEffect(() => {
    if (!loadingDone) return;
    const preload = () => {
      warmMusicCache();
      warmPlaylistCache();
      // 空闲预解码 30 张专辑封面：加载动画结束瞬间 hover arc vinyl 时
      // 30 张封面同帧解码是卡顿主因（trace 实测 decode 195-307ms），提前摊到空闲期
      warmAlbumCovers();
    };
    // 加载动画刚完成时 HTTP 缓存已热，短延迟即可；跳过动画时同样快速预热
    const timer = setTimeout(preload, 300);
    return () => clearTimeout(timer);
  }, [loadingDone]);

  // 记录滚动位置（节流：每 500ms 最多写一次 localStorage）
  useEffect(() => {
    if (!loadingDone) return;
    let ticking = false;
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      setTimeout(() => {
        localStorage.setItem('gk3-scroll', String(window.scrollY));
        ticking = false;
      }, 500);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadingDone]);

  useEffect(() => {
    document.body.classList.add("gk3-page");
    setPlaceholder(placeholders[Math.floor(Math.random() * placeholders.length)]);
    const updateScrollState = () => {
      document.documentElement.dataset.scroll = String(window.scrollY > 1200);
    };
    updateScrollState();
    window.addEventListener("scroll", updateScrollState, { passive: true });
    return () => {
      window.removeEventListener("scroll", updateScrollState);
      document.body.classList.remove("gk3-page", "viewing", "expanded", "cursor", "link");
      if (endViewerTimerRef.current) clearTimeout(endViewerTimerRef.current);
    };
  }, []);

  // Esc 键关闭精选推荐浮层 / 作品大图浮层
  useEffect(() => {
    if (!showcaseOpen && !portfolioOverlayId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowcaseOpen(false);
        setPortfolioOverlayId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showcaseOpen, portfolioOverlayId]);

  useEffect(() => {
    let disposed = false;
    const cache = mediaCacheRef.current;

    const load = async () => {
      await Promise.all(
        mediaNames.map(async (media) => {
          const name = media.replace(/\.mp4$/i, "");
          if (disposed || cache[name]) return;
          const videoUrl = await fetch(`/gk3-assets/video/${name}.mp4`)
            .then((response) => (response.ok ? response.blob() : null))
            .then((blob) => (blob ? URL.createObjectURL(blob) : null))
            .catch(() => null);
          const posterUrl = await fetch(`/gk3-assets/img/${name}.jpg`)
            .then((response) => (response.ok ? response.blob() : null))
            .then((blob) => (blob ? URL.createObjectURL(blob) : null))
            .catch(() => null);

          if (disposed) {
            if (videoUrl) URL.revokeObjectURL(videoUrl);
            if (posterUrl) URL.revokeObjectURL(posterUrl);
            return;
          }

          cache[name] = {
            video: videoUrl ?? `/gk3-assets/video/${name}.mp4`,
            poster: posterUrl ?? `/gk3-assets/img/${name}.jpg`,
          };
        })
      );
      if (!disposed) setMediaCacheVersion((version) => version + 1);
    };

    load();
    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle("viewing", viewing);
    if (!viewing) {
      document.body.classList.remove("expanded", "link");
      setExpanded(false);
    }
  }, [viewing]);

  useEffect(() => {
    document.body.classList.toggle("expanded", expanded);
  }, [expanded]);

  useEffect(() => {
    const video = videoRef.current;
    const videoFrame = videoFrameRef.current;
    if (!video) return;
    if (viewing && currentMedia && viewerClass !== "social" && viewerClass !== "pin" && viewerClass !== "music" && viewerClass !== "showcase" && viewerClass !== "playlist" && viewerClass !== "portfolio") {
      if (clearVideoTimerRef.current) {
        clearTimeout(clearVideoTimerRef.current);
        clearVideoTimerRef.current = null;
      }
      const mediaName = currentMedia.replace(/\.mp4$/i, "");
      const cached = mediaCacheRef.current[mediaName];
      video.style.display = "block";
      video.src = cached?.video ?? `/gk3-assets/video/${mediaName}.mp4`;
      video.poster = cached?.poster ?? `/gk3-assets/img/${mediaName}.jpg`;
      video.load();
      const floating = window.matchMedia("(max-aspect-ratio: 16/12)").matches;
      if (floating && viewerClass === "phone" && videoFrame) {
        videoFrame.style.flexBasis = `${video.getBoundingClientRect().width + 100}px`;
      } else if (videoFrame) {
        videoFrame.removeAttribute("style");
      }
    } else {
      video.style.display = "none";
      if (videoFrame) videoFrame.removeAttribute("style");
      video.pause();
      if (clearVideoTimerRef.current) clearTimeout(clearVideoTimerRef.current);
      clearVideoTimerRef.current = setTimeout(() => {
        video.removeAttribute("src");
        video.removeAttribute("poster");
        video.load();
        clearVideoTimerRef.current = null;
      }, 500);
    }
    return () => {
      if (clearVideoTimerRef.current) clearTimeout(clearVideoTimerRef.current);
    };
  }, [viewing, currentMedia, viewerClass, mediaCacheVersion]);

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      if (!pointerRef.current) return;
      pointerRef.current.style.transform = `translate(${event.clientX}px, ${event.clientY}px) scale(${flipRef.current})`;
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const baseSaturated: [number, number, number] = [4, 9, 46];
    const baseIndigo: [number, number, number] = [16, 34, 128];
    const accentCrimson: [number, number, number] = [220, 20, 60];
    let latestDark: [number, number, number] = [...baseSaturated];
    let latestLight: [number, number, number] = [...baseIndigo];
    let colorDelta = 0;
    let colorDirection = 1;
    let faviconTick = 0;

    const syncThemeColor = (color: [number, number, number]) => {
      let themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
      if (!themeColor) {
        themeColor = document.createElement("meta");
        themeColor.name = "theme-color";
        document.head.appendChild(themeColor);
      }
      themeColor.content = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
    };

    const setFavicon = (circle: [number, number, number], letter: [number, number, number]) => {
      let favicon = document.querySelector<HTMLLinkElement>('head > link[rel="icon"]');
      if (!favicon) {
        favicon = document.createElement("link");
        favicon.rel = "icon";
        document.head.appendChild(favicon);
      }
      const svg = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="8" cy="8" r="8" fill="rgb(${circle[0]}, ${circle[1]}, ${circle[2]})"/><text x="8" y="11.3" text-anchor="middle" font-family="Arial, sans-serif" font-size="8.5" font-weight="bold" fill="rgb(${letter[0]}, ${letter[1]}, ${letter[2]})">F</text></svg>`;
      favicon.href = `data:image/svg+xml;base64,${window.btoa(svg)}`;
      document.querySelectorAll('head > link[rel="icon"]').forEach((other) => {
        if (other !== favicon) other.remove();
      });
    };

    const setGradient = () => {
      const newDark = rotateRgb(baseSaturated, colorDelta);
      const newLight = rotateRgb(baseIndigo, colorDelta);
      const fgColor = accentCrimson;
      const bgColor = newLight;
      const panelColor = adjustLightness(newDark, -0.06);
      latestDark = newDark;
      latestLight = newLight;
      const luminance = latestLight[0] * 0.299 + latestLight[1] * 0.587 + latestLight[2] * 0.114;
      setSharedNoisePhase((luminance - 29) / (52.2 - 29));

      root.style.setProperty("--fg-rgb", `${fgColor[0]}, ${fgColor[1]}, ${fgColor[2]}`);
      root.style.setProperty("--bg-rgb", `${bgColor[0]}, ${bgColor[1]}, ${bgColor[2]}`);
      root.style.setProperty("--fg-color", `rgb(${fgColor[0]}, ${fgColor[1]}, ${fgColor[2]})`);
      root.style.setProperty("--bg-color", `rgb(${bgColor[0]}, ${bgColor[1]}, ${bgColor[2]})`);
      root.style.setProperty("--panel-color", `rgb(${panelColor[0]}, ${panelColor[1]}, ${panelColor[2]})`);
      root.style.setProperty("--scrim", "rgba(16, 34, 128, 0.34)");
      syncThemeColor(bgColor);
      // favicon 每次重建（btoa + head 内替换）开销重复且肉眼不可察：
      // 首次立即创建，之后每 5 次主题色更新重建一次（10fps 下约 0.5s）
      faviconTick += 1;
      if (faviconTick % 5 === 1) {
        setFavicon(bgColor, fgColor);
      }

      colorDelta += 0.675 * colorDirection;
      if (colorDelta > 12) {
        colorDelta = 12;
        colorDirection = -1;
      }
      if (colorDelta < -12) {
        colorDelta = -12;
        colorDirection = 1;
      }
    };

    setGradient();
    const gradientTimer = window.setInterval(() => {
      // LoadingScreen 不透明覆盖期间主题色/背景不可见：跳过 CSS 变量更新与 favicon 重建
      if (!loadingDoneRef.current) return;
      setGradient();
      // 10fps 更新（原 15fps）：慢速漂移动画肉眼无差异；colorDelta 步长同比例
      // 放大（0.45 * 15 == 0.675 * 10），保持每秒颜色变化率不变，视觉节奏一致
    }, 1000 / 10);

    const canvas = canvasRef.current;
    let gl: WebGLRenderingContext | null = null;
    let program: WebGLProgram | null = null;
    let raf = 0;
    let running = false;
    let seed = window.matchMedia("(max-width: 850px)").matches ? 10 : Math.random() * 100;
    // 加载动画期间被 LoadingScreen 不透明覆盖：跳过绘制但保活 rAF，
    // loadingDone 置真后下一帧自动恢复（ref 动态读取，无需重建循环）
    const visible = () => loadingDoneRef.current && document.visibilityState === "visible";

    const compileShader = (type: number, source: string) => {
      if (!gl) return null;
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    if (canvas) {
      gl = canvas.getContext("webgl", { antialias: false });
      if (gl) {
        const vs = `
          attribute vec2 a_position;
          void main() {
            gl_Position = vec4(a_position, 0.0, 1.0);
          }
        `;
        const fs = `
          precision highp float;
          uniform vec2 iResolution;
          uniform float iTime;
          uniform vec3 extcolor1;
          uniform vec3 extcolor2;
          uniform vec3 uCapColor;

          mat2 rotate2d(float angle){
            return mat2(cos(angle),-sin(angle),
                        sin(angle),cos(angle));
          }

          float gradientNoise(in vec2 uv)
          {
            const vec3 magic = vec3(0.06711056, 0.00583715, 52.9829189);
            return fract(magic.z * fract(dot(uv, magic.xy)));
          }

          float variation(vec2 v1, vec2 v2, float strength, float speed) {
            return sin(
                dot(normalize(v1), normalize(v2)) * strength + iTime * speed
            ) / 100.0;
          }

          vec3 paintCircle (vec2 uv, vec2 center, float rad, float width) {
              vec2 diff = center-uv;
              float len = length(diff);

              len += variation(diff, vec2(0.0, 1.0), 5.0, 1.0);
              len -= variation(diff, vec2(1.0, 0.0), 5.0, 1.0);

              float circle = smoothstep(rad-width, rad, len) - smoothstep(rad, rad+width, len);
              return vec3(circle);
          }

          void main() {
            vec2 uv = gl_FragCoord.xy / iResolution.xy;
            uv.x *= 1.5;
            uv.x -= 0.25;

            vec3 color;
            vec3 color2;
            float radius = 0.5;
            vec2 center = vec2(0.5);
            vec2 v = rotate2d(iTime * 0.1) * uv;
            vec2 v3 = rotate2d(iTime * 0.3) * uv;
            vec2 v5 = rotate2d(iTime * 0.5) * uv;

            color = paintCircle(uv * v5, center * v3, 1.0 * v.x, 1.5);
            color2 = paintCircle(uv * v3, vec2(0.2) * v, 1.0 * v3.x, 1.3);

            color *= vec3(v5.x, v5.x, v5.x);
            v = rotate2d(iTime * -0.3) * uv;
            color2 *= vec3(v.y, v.y, v.y);
            vec3 finalColor = color + color2;

            float grayscaleValue = clamp(dot(finalColor.rgb, vec3(0.299, 0.587, 0.114)), 0.0, 0.95);
            vec3 preComp = mix(extcolor2, extcolor1, grayscaleValue);
            preComp += (1.0/255.0) * gradientNoise(gl_FragCoord.xy) - (0.5/255.0);

            vec3 noiseCap = uCapColor;
            float capLum = dot(noiseCap, vec3(0.299, 0.587, 0.114));
            float preLum = dot(preComp, vec3(0.299, 0.587, 0.114));
            if (preLum > capLum) {
              preComp *= capLum / preLum;
            }
            preComp = min(preComp, noiseCap);

            gl_FragColor = vec4(preComp, 1.0);
          }
        `;
        const vShader = compileShader(gl.VERTEX_SHADER, vs);
        const fShader = compileShader(gl.FRAGMENT_SHADER, fs);
        program = gl.createProgram();
        if (program && vShader && fShader) {
          gl.attachShader(program, vShader);
          gl.attachShader(program, fShader);
          gl.linkProgram(program);
          gl.useProgram(program);

          const buffer = gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
          gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
          const positionLoc = gl.getAttribLocation(program, "a_position");
          gl.enableVertexAttribArray(positionLoc);
          gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);
        }
      }
    }

    let bgFrame = 0;
    const render = (time: number) => {
      if (!canvas || !gl || !program) return;
      // 保活：不可见（LoadingScreen 覆盖/标签页隐藏）时只续 rAF 不绘制，
      // 避免 running=false 后循环死亡、恢复瞬间（scroll/resize 触发 start）
      // 首帧整屏重绘造成明显卡顿尖刺（trace 实测恢复后 fps 崩到 25.7）
      if (!visible()) {
        raf = requestAnimationFrame(render);
        return;
      }
      // 背景为慢速渐变动画：每 2 帧绘制一次（约 30fps），逐帧视觉无差异，
      // 全屏 fragment shader 的 GPU/合成开销减半
      bgFrame += 1;
      if (bgFrame % 2 !== 1) {
        raf = requestAnimationFrame(render);
        return;
      }
      const dpr = Math.min(window.devicePixelRatio || 1, 1);
      const width = Math.floor(canvas.clientWidth * dpr);
      const height = Math.floor(canvas.clientHeight * dpr);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(gl.getUniformLocation(program, "iResolution"), canvas.width, canvas.height);
      gl.uniform1f(gl.getUniformLocation(program, "iTime"), time * 0.001 + seed);
      gl.uniform3f(
        gl.getUniformLocation(program, "extcolor1"),
        latestLight[0] / 255,
        latestLight[1] / 255,
        latestLight[2] / 255
      );
      gl.uniform3f(
        gl.getUniformLocation(program, "extcolor2"),
        latestDark[0] / 255,
        latestDark[1] / 255,
        latestDark[2] / 255
      );
      gl.uniform3f(
        gl.getUniformLocation(program, "uCapColor"),
        latestLight[0] / 255,
        latestLight[1] / 255,
        latestLight[2] / 255
      );
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(render);
    };

    const start = () => {
      if (!running) {
        running = true;
        raf = requestAnimationFrame(render);
      }
    };

    start();
    window.addEventListener("scroll", start, { passive: true });
    window.addEventListener("resize", start);

    return () => {
      window.clearInterval(gradientTimer);
      window.removeEventListener("scroll", start);
      window.removeEventListener("resize", start);
      cancelAnimationFrame(raf);
    };
  }, []);

  const cancelEndViewerTimer = () => {
    if (endViewerTimerRef.current) {
      clearTimeout(endViewerTimerRef.current);
      endViewerTimerRef.current = null;
    }
  };

  const prepViewer = (rowId: string, item: WorkItem, index: number) => {
    cancelEndViewerTimer();
    // #54：预载 iframe 已在 LoadingScreen 后空闲期自动挂载（幂等常驻），
    // 浮层打开仅样式切换，关闭切回 0×0 隐藏（#51 常驻化）
    setViewerClass(item.viewer ?? "phone");
    setActiveRow(rowId);
    setViewing(true);
    // portfolio 行：选中条目对应的作品，viewer 展示单张全图
    setSelectedPortfolioWork(item.workId ?? null);
    setPlaceholder(placeholders[Math.floor(Math.random() * placeholders.length)]);
    setActiveItem(`${rowId}-${index}`);
    setCurrentMedia(item.media ?? null);
    setSocialIndex(
      Math.max(0, socialItems.findIndex((label) => label.toLowerCase() === String(item.text ?? "").toLowerCase()))
    );
    flipRef.current = item.href
      ? 1
      : window.matchMedia("(max-aspect-ratio: 16/12)").matches
        ? 1
        : -1;
    document.body.classList.add("cursor");
    document.body.classList.toggle("link", Boolean(item.href));
  };

  // portfolio 行：hover 行标题（h2）时打开 DriftWall 总览（不选中任何作品）
  const prepPortfolioOverview = () => {
    cancelEndViewerTimer();
    setViewerClass("portfolio");
    setActiveRow("portfolio");
    setViewing(true);
    setSelectedPortfolioWork(null);
    setPlaceholder(placeholders[Math.floor(Math.random() * placeholders.length)]);
    setActiveItem(null);
    setCurrentMedia(null);
    if (!window.matchMedia("(max-aspect-ratio: 16/12)").matches) {
      flipRef.current = -1;
    }
    document.body.classList.add("cursor");
    document.body.classList.remove("link");
  };

  const endViewer = () => {
    cancelEndViewerTimer();
    setViewing(false);
    setActiveRow(null);
    setActiveItem(null);
    setCurrentMedia(null);
    setSelectedPortfolioWork(null);
    setPlaceholder(placeholders[Math.floor(Math.random() * placeholders.length)]);
    document.body.classList.remove("cursor", "link", "expanded");
    setExpanded(false);
    if (videoRef.current) {
      videoRef.current.pause();
    }
  };

  const toggleExpanded = () => {
    if (viewing) setExpanded((current) => !current);
  };

  useEffect(() => {
    if (!viewing) return;
    const openedAt = window.scrollY;
    const onScroll = () => {
      if (Math.abs(window.scrollY - openedAt) > 200) endViewer();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [viewing]);

  const renderRow = (row: Row) => {
    if (row.component) {
      return (
        <div className="row rich-row" key={row.id}>
          {row.title ? <h2>{row.title}</h2> : null}
          {row.h3 ? <h3>{row.h3}</h3> : null}
          {row.component}
        </div>
      );
    }
    if (row.bar) {
      return (
        <div className="row bar" key={row.id}>
          {/* #77：删除原作者 GK3 徽标 SVG（bar 行左侧红色椭圆 logo，纯图形无法被文本 grep 发现）；版权信息保留 */}
          <span className="copyright">
            <em>&copy;</em>2026{/* #77：删除原作者署名（c/o George Kedenburg III）及悬空逗号 */}
          </span>
        </div>
      );
    }

    /* #85：末尾 legal 散文区已删（rows 数据中 legal 行对象同步移除）；版权行在 bar 行独立保留 */

    return (
      <div
        className={`row${activeRow === row.id && viewing ? " active" : ""}`}
        key={row.id}
      >
        {row.title ? (
          row.id === "portfolio" ? (
            // portfolio 行：hover 标题打开 DriftWall 总览，移出后延迟关闭（与条目/viewer 面板共用计时器）
            <h2
              onMouseEnter={() => {
                if (!window.matchMedia("(hover: none) and (pointer: coarse)").matches) {
                  prepPortfolioOverview();
                }
              }}
              onMouseLeave={() => {
                if (!window.matchMedia("(hover: none) and (pointer: coarse)").matches) {
                  cancelEndViewerTimer();
                  endViewerTimerRef.current = setTimeout(endViewer, 150);
                }
              }}
            >
              {row.title}
            </h2>
          ) : (
            <h2 className={row.solo ? "solo" : undefined}>{row.title}</h2>
          )
        ) : null}
        {row.h3 ? <h3>{row.h3}</h3> : null}
        <div className="work-wrapper" onMouseLeave={() => { if (portfolioOverlayId) return; if (!window.matchMedia("(hover: none) and (pointer: coarse)").matches) { cancelEndViewerTimer(); endViewerTimerRef.current = setTimeout(endViewer, 150); } }}>
          <ul className={row.id === "elsewhere" ? undefined : "work"}>
            {(row.items ?? []).map((item, index) => (
              <li
                key={`${row.id}-${index}`}
                className={activeRow === row.id && activeItem === `${row.id}-${index}` ? "active" : ""}
                data-viewer={item.viewer}
                data-media={item.media}
                onMouseEnter={() => {
                  if (item.viewer && !window.matchMedia("(hover: none) and (pointer: coarse)").matches) {
                    prepViewer(row.id, item, index);
                  }
                }}
                onClick={() => {
                  // showcase 行：桌面端点击打开全屏浮层。showcaseOpen=true 直接
                  // 满足渲染条件；iframe 万一未预载（idle 回调被极端阻塞）时
                  // 立即以全屏态挂载（回退路径，init 全屏进行，不阻塞）
                  if (row.id === 'showcase') {
                    setShowcaseOpen(true);
                    return;
                  }
                  // portfolio 行：点击名称直接打开 TiltedCard 大图浮层（不依赖 viewer 是否已开）。
                  // 先取消挂起的关闭计时，避免浮层打开后 endViewer 触发关掉 viewer、
                  // 破坏“关闭浮层后恢复原状”；viewer 未开时点名称，关闭浮层后仍是无 viewer 状态。
                  if (row.id === 'portfolio' && item.workId) {
                    cancelEndViewerTimer();
                    setPortfolioOverlayId(item.workId);
                    return;
                  }
                  if (item.viewer && !item.href && window.matchMedia("(hover: none) and (pointer: coarse)").matches) {
                    prepViewer(row.id, item, index);
                  }
                }}
              >
                {item.href ? (
                  <a href={item.href} target={item.target ?? "_blank"} rel="noopener noreferrer">
                    {item.text}
                  </a>
                ) : (
                  item.text
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  };

  return (
    <>
      {showLoading && <LoadingScreen onLoaded={handleLoaded} />}
      <div id="pointer" ref={pointerRef} />
      <div id="main">
        <div id="hero">
          <div id="hero-inner">
            <h1>Works, Notes,<br /><span className="hero-sub">and Unfinished.</span></h1> {/* #80：第二行包 span.hero-sub 按比例缩至主标 1/4（17.5px，样式见 Gk3Clone.css），<br/> 保留强制断行；layout.tsx pageTitle 由 Felix 同步，不碰 */}
          </div>
        </div>
        {rows.map(renderRow)}
      </div>
      <div id="viewerHit" onClick={toggleExpanded}>
        <span>&times;</span>
      </div>
      <div id="viewer" className={viewerClass}>
        <h4>{placeholder}</h4>
        <div id="videoFrame" ref={videoFrameRef}>
          <div id="videoWrapper">
            <svg viewBox="0 0 19.5 9" className="ratio" aria-hidden="true" />
            <video
              ref={videoRef}
              muted
              playsInline
              loop
              onLoadedMetadata={(event) => {
                const video = event.currentTarget;
                video.muted = true;
                if (viewing && currentMedia && viewerClass !== "social" && viewerClass !== "pin") {
                  video.play().catch(() => {});
                }
              }}
              onError={(event) => {
                const video = event.currentTarget;
                const currentSrc = video.getAttribute("src");
                if (currentSrc && currentSrc !== "/gk3-assets/video/404.mp4") {
                  video.src = "/gk3-assets/video/404.mp4";
                  video.load();
                }
              }}
            />
            <div id="social-icons">
              <div id="social-track" style={{ "--social-index": socialIndex } as React.CSSProperties}>
                {socialSvgStrings.map((svg, index) => (
                  <svg
                    key={socialItems[index]}
                    width="146"
                    height="146"
                    viewBox="0 0 146 146"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-label={socialItems[index]}
                    dangerouslySetInnerHTML={{ __html: svg }}
                  />
                ))}
              </div>
            </div>
          </div>
          {viewing && viewerClass === "music" && (
            <div id="musicViewer" onMouseEnter={cancelEndViewerTimer} onMouseLeave={() => { cancelEndViewerTimer(); endViewerTimerRef.current = setTimeout(endViewer, 150); }}>
              <MusicModule />
            </div>
          )}
          {viewing && viewerClass === "showcase" && (
            <div
              id="showcaseViewer"
              onMouseEnter={cancelEndViewerTimer}
              onMouseLeave={() => { cancelEndViewerTimer(); endViewerTimerRef.current = setTimeout(endViewer, 150); }}
            >
              <AlbumShowcase paused={!loadingDone} onOpenOverlay={() => setShowcaseOpen(true)} />
            </div>
          )}
          {viewing && viewerClass === "playlist" && (
            <div
              id="playlistViewer"
              onMouseEnter={cancelEndViewerTimer}
              onMouseLeave={() => { cancelEndViewerTimer(); endViewerTimerRef.current = setTimeout(endViewer, 150); }}
            >
              <PlaylistModule />
            </div>
          )}
          {viewing && viewerClass === "portfolio" && (
            <div
              id="portfolioViewer"
              className={selectedPortfolioWork ? 'pom-frame-mode' : ''}
              onMouseEnter={cancelEndViewerTimer}
              onMouseLeave={() => { if (portfolioOverlayId) return; cancelEndViewerTimer(); endViewerTimerRef.current = setTimeout(endViewer, 150); }}
            >
              <PortfolioModule selectedWork={selectedPortfolioWork} onOpenOverlay={setPortfolioOverlayId} />
            </div>
          )}
        </div>
      </div>
      <canvas id="c" ref={canvasRef} />
      <Noise
        patternSize={100}
        patternScaleX={1}
        patternScaleY={1}
        patternRefreshInterval={4}
        patternAlpha={10}
        patternDensity={50}
        // LoadingScreen 覆盖期间噪点不可见：完全停用重绘循环
        paused={!loadingDone}
      />
      {/* ── 3D 浮层：单一 iframe 常驻化（#51）+ init 前移（#53/#54）──
          #54：LoadingScreen 消失后 requestIdleCallback 自动挂载（2s 兜底），
          init 不再与用户 hover 期的 2D 弧形动画抢主线程（same-origin iframe
          与宿主共享渲染进程主线程，基线实测 hover 期宿主 fps 27/停帧 600ms）；
          预载期先 1×1（fixed/opacity:0/pointer-events:none/z-index:-1，不产生
          滚动条不遮挡）：0×0 时合成器不调度 BeginFrame，script.js 首帧 render
          （shader 编译 + 30 张纹理上传）被推迟到点击瞬间（实测停帧 6.4s）；
          1×1 放行空闲期完成 init，收到 arc-vinyl:ready 后收回 0×0（12s 超时兜底）。
          打开浮层仅切换样式（fixed inset 0 全屏），关闭切回 0×0 隐藏，永不卸载重挂；
          未预载时直接点击“点击进入交互”→ 立即以全屏态挂载（init 全屏进行，不阻塞）。 */}
      {(iframeMountReady || showcaseOpen) && (
        <div
          className="showcase-overlay"
          aria-hidden={!showcaseOpen}
          style={
            showcaseOpen
              ? undefined
              : { visibility: arcInitDone ? "hidden" : "visible", background: "transparent", pointerEvents: "none" }
          }
        >
          <iframe
            ref={showcaseIframeRef}
            src="/music-cover-3d/index.html"
            className="showcase-iframe"
            title="Arc Vinyl Archive"
            allow="autoplay"
            style={
              showcaseOpen
                ? undefined
                : arcInitDone
                  ? // ready/超时后：收回 0×0，script.js 零尺寸守卫接管，零渲染开销
                    { width: 0, height: 0, opacity: 0, visibility: "hidden", pointerEvents: "none" }
                  : // init 期：1×1 非零尺寸让合成器调度 BeginFrame，空闲期完成 init；
                    // visibility 不可为 hidden（会暂停 BeginFrame），opacity:0 已不可见
                    { position: "fixed", left: 0, top: 0, width: 1, height: 1, opacity: 0, pointerEvents: "none", zIndex: -1, border: "none", visibility: "visible" }
            }
          />
          {showcaseOpen && (
            <button className="showcase-close" onClick={() => setShowcaseOpen(false)}>
              ×
            </button>
          )}
        </div>
      )}
      {/* 作品大图浮层：TiltedCard 展示原图（点击遮罩空白/×/ESC 关闭，viewer 保持原状）。
          卡片尺寸锁 9:16（原图 1080×1920）：高 min(88vh, 142.2222vw)、宽 min(49.5vh, 80vw)，
          两表达式在任意视口下数学一致（88vh→49.5vh×16/9，142.2222vw→80vw），窄屏不溢出。 */}
      {portfolioOverlayId && (
        <div className="pom-overlay" onClick={() => setPortfolioOverlayId(null)}>
          <button
            className="pom-overlay-close"
            aria-label="关闭大图浮层"
            onClick={() => setPortfolioOverlayId(null)}
          >
            ×
          </button>
          {(() => {
            const overlayWork = portfolioWorks.find((w) => w.id === portfolioOverlayId);
            if (!overlayWork) return null;
            return (
              <div className="pom-overlay-card" onClick={(e) => e.stopPropagation()}>
                <TiltedCard
                  imageSrc={overlayWork.image}
                  altText={overlayWork.title}
                  captionText={overlayWork.title}
                  containerHeight="min(88vh, 142.2222vw)"
                  containerWidth="min(49.5vh, 80vw)"
                  imageHeight="100%"
                  imageWidth="100%"
                  rotateAmplitude={10}
                  scaleOnHover={1.04}
                  showMobileWarning={false}
                  showTooltip
                />
              </div>
            );
          })()}
        </div>
      )}
    </>
  );
}






