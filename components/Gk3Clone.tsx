"use client";

import { useEffect, useRef, useState } from "react";
import "./Gk3Clone.css";

type ViewerMode = "phone" | "video" | "social" | "pin";

type WorkItem = {
  text: React.ReactNode;
  href?: string;
  target?: "_new" | "_blank";
  viewer?: ViewerMode;
  media?: string;
  rowId: string;
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

const socialItems = ["Instagram", "Threads", "LinkedIn", "Unsplash", "Substack"];
const socialSvgStrings = [
  '<path d="M73.0167 33.0313C62.1455 33.0313 60.7782 33.0813 56.5098 33.2647C52.258 33.4647 49.3401 34.148 46.8058 35.1314C44.1358 36.1366 41.7174 37.7122 39.7195 39.7482C37.6827 41.7453 36.1065 44.1627 35.1009 46.8317C34.1005 49.3651 33.4335 52.2818 33.2334 56.5319C33.05 60.7987 33 62.1654 33 73.0323C33 83.8659 33.05 85.2493 33.2334 89.4994C33.4335 93.7662 34.1171 96.6663 35.1009 99.2163C36.1065 101.885 37.6827 104.303 39.7195 106.3C41.7174 108.336 44.1358 109.911 46.8058 110.917C49.3401 111.9 52.258 112.583 56.5098 112.767C60.7782 112.967 62.1455 113 73.0167 113C83.8545 113 85.2384 112.967 89.4902 112.767C93.7587 112.567 96.6599 111.9 99.2109 110.917C101.881 109.911 104.299 108.336 106.297 106.3C108.334 104.303 109.91 101.885 110.916 99.2163C111.9 96.6663 112.583 93.7662 112.767 89.4994C112.967 85.2493 113 83.8826 113 73.0157C113 62.1654 112.967 60.7987 112.767 56.5319C112.566 52.2818 111.9 49.3651 110.916 46.8317C109.91 44.1627 108.334 41.7453 106.297 39.7482C104.299 37.7122 101.881 36.1366 99.2109 35.1314C96.6599 34.1314 93.7587 33.4647 89.4902 33.2647C84.0024 33.0275 78.509 32.9497 73.0167 33.0313V33.0313ZM73.0167 40.2315C83.6878 40.2315 84.955 40.2815 89.1734 40.4649C93.075 40.6482 95.1759 41.2982 96.5932 41.8482C98.4606 42.5649 99.7945 43.4316 101.195 44.8483C102.525 46.133 103.551 47.6991 104.196 49.4317C104.73 50.8484 105.397 52.9652 105.564 56.8653C105.764 61.082 105.797 62.3487 105.797 73.0323C105.797 83.6993 105.764 84.966 105.564 89.1827C105.397 93.0828 104.73 95.1829 104.196 96.5996C103.553 98.3382 102.527 99.9102 101.195 101.2C99.9051 102.531 98.3324 103.557 96.5932 104.2C95.1926 104.733 93.075 105.4 89.1734 105.566C84.955 105.766 83.6711 105.8 73 105.8C62.3289 105.8 61.0617 105.766 56.8266 105.566C52.9416 105.4 50.8241 104.733 49.4068 104.2C47.6676 103.557 46.0949 102.531 44.8049 101.2C43.4727 99.9102 42.447 98.3382 41.8037 96.5996C41.2701 95.1996 40.6198 93.0828 40.4364 89.1827C40.2015 83.7971 40.1237 78.4058 40.203 73.0157C40.203 62.3487 40.253 61.082 40.4364 56.8486C40.6198 52.9652 41.2701 50.8484 41.8203 49.4317C42.4637 47.6932 43.4894 46.1211 44.8216 44.8316C46.1068 43.502 47.6735 42.4769 49.4068 41.8316C50.8241 41.2982 52.9416 40.6482 56.8433 40.4649C61.0617 40.2815 62.3289 40.2315 73.0167 40.2315ZM73.0167 52.4818C67.5686 52.4818 62.3437 54.6452 58.4914 58.496C54.639 62.3469 52.4748 67.5698 52.4748 73.0157C52.4748 78.4616 54.639 83.6844 58.4914 87.5353C62.3437 91.3861 67.5686 93.5495 73.0167 93.5495C78.4647 93.5495 83.6896 91.3861 87.542 87.5353C91.3943 83.6844 93.5586 78.4616 93.5586 73.0157C93.5586 67.5698 91.3943 62.3469 87.542 58.496C83.6896 54.6452 78.4647 52.4818 73.0167 52.4818V52.4818ZM73.0167 86.366C69.479 86.366 66.0862 84.9612 63.5847 82.4607C61.0831 79.9601 59.6778 76.5686 59.6778 73.0323C59.6778 69.496 61.0831 66.1046 63.5847 63.604C66.0862 61.1035 69.479 59.6987 73.0167 59.6987C76.5544 59.6987 79.9472 61.1035 82.4487 63.604C84.9502 66.1046 86.3556 69.496 86.3556 73.0323C86.3556 76.5686 84.9502 79.9601 82.4487 82.4607C79.9472 84.9612 76.5544 86.366 73.0167 86.366ZM99.1609 51.6985C99.1609 50.4254 98.655 49.2045 97.7544 48.3043C96.8539 47.4041 95.6325 46.8983 94.3589 46.8983C93.0853 46.8983 91.8639 47.4041 90.9634 48.3043C90.0628 49.2045 89.5569 50.4254 89.5569 51.6985C89.5569 52.9715 90.0628 54.1925 90.9634 55.0927C91.8639 55.9929 93.0853 56.4986 94.3589 56.4986C95.6325 56.4986 96.8539 55.9929 97.7544 55.0927C98.655 54.1925 99.1609 52.9715 99.1609 51.6985V51.6985Z" fill="var(--fg-color)"/>',
  '<path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.308-.883-2.359-.89h-.029c-.844 0-1.992.232-2.721 1.32L7.734 7.847c.98-1.454 2.568-2.256 4.478-2.256h.044c3.194.02 5.097 1.975 5.287 5.388.108.046.216.094.321.142 1.49.7 2.58 1.761 3.154 3.07.797 1.82.871 4.79-1.548 7.158-1.85 1.81-4.094 2.628-7.277 2.65Zm1.003-11.69c-.242 0-.487.007-.739.021-1.836.103-2.98.946-2.916 2.143.067 1.256 1.452 1.839 2.784 1.767 1.224-.065 2.818-.543 3.086-3.71a10.5 10.5 0 0 0-2.215-.221z" transform="translate(33 33) scale(3.333)" fill="var(--fg-color)"/>',
  '<path d="M100.28 448H7.4V148.9h92.88zM53.79 108.1C24.09 108.1 0 83.5 0 53.8a53.79 53.79 0 0 1 107.58 0c0 29.7-24.1 54.3-53.79 54.3zM447.9 448h-92.68V302.4c0-34.7-.7-79.2-48.29-79.2-48.29 0-55.69 37.7-55.69 76.7V448h-92.78V148.9h89.08v40.8h1.3c12.4-23.5 42.69-48.3 87.88-48.3 94 0 111.28 61.9 111.28 142.3V448z" transform="translate(38 33) scale(0.156)" fill="var(--fg-color)"/>',
  '<path d="M60.625 57.562V39H85.375V57.562H60.625ZM85.375 67.875H106V105H40V67.875H60.625V86.438H85.375V67.875Z" fill="var(--fg-color)"/>',
  '<path fill-rule="evenodd" clip-rule="evenodd" d="M44 40H102.667V47.333H44V40ZM102.667 54.667H44V62H102.667V54.667ZM44 69.333V106L73.3308 89.625L102.667 106V69.333H44Z" fill="var(--fg-color)"/>'
];

const rows: Row[] = [
  {
    id: "hp",
    title: (
      <>
        director of ai software design at{" "}
        <a href="https://www.hp-iq.com/" target="_new">
          hp&nbsp;iq
        </a>
      </>
    ),
    h3: <>2025 {"\u2192"} 202<span className="cursor">{"\u9618"}</span></>,
    items: [
      {
        text: "[redacted]",
        viewer: "phone",
        media: "404.mp4",
        rowId: "hp",
      },
    ],
  },
  {
    id: "humane",
    title: <>humane</>,
    h3: <>2022 {"\u2192"} 2025</>,
    items: [
      {
        text: "ai pin",
        href: "https://www.red-dot.org/project/ai-pin-72306",
        target: "_new",
        viewer: "pin",
        media: "404.mp4",
        rowId: "humane",
      },
    ],
  },
  {
    id: "wavform",
    title: (
      <a href="https://wav.fm/" target="_new">
        wavform
      </a>
    ),
    h3: <>2021 {"\u2192"} 202<span className="cursor">{"\u9618"}</span></>,
    items: [
      {
        text: "tracklist",
        href: "https://wav.fm/",
        target: "_new",
        viewer: "phone",
        media: "404.mp4",
        rowId: "wavform",
      },
    ],
  },
  {
    id: "instagram",
    title: <>instagram</>,
    h3: <>2018 {"\u2192"} 2022</>,
    items: [
      { text: "camera", viewer: "phone", media: "refresh.mp4", rowId: "instagram" },
      { text: "type", viewer: "phone", media: "ig-text.mp4", rowId: "instagram" },
      { text: "10th birthday", viewer: "phone", media: "birthday.mp4", rowId: "instagram" },
      { text: "creation tools", viewer: "phone", media: "tools.mp4", rowId: "instagram" },
      { text: "ar platform", viewer: "phone", media: "ar-platform.mp4", rowId: "instagram" },
    ],
  },
  {
    id: "facebook",
    title: <>facebook video</>,
    h3: <>2016 {"\u2192"} 2018</>,
    items: [
      { text: "live", viewer: "phone", media: "live.mp4", rowId: "facebook" },
      {
        text: <>watch party, mentions,&nbsp;etc.</>,
        viewer: "phone",
        media: "404.mp4",
        rowId: "facebook",
      },
    ],
  },
  {
    id: "parse",
    title: <>parse</>,
    h3: <>2014 {"\u2192"} 2016</>,
    items: [
      {
        text: <>product &amp; brand</>,
        href: "https://www.youtube.com/watch?v=89xIe8FbR2g",
        target: "_new",
        viewer: "video",
        media: "parse.mp4",
        rowId: "parse",
      },
    ],
  },
  {
    id: "speaking",
    title: (
      <>
        <i>occasional</i>speaking
      </>
    ),
    solo: true,
    items: [
      {
        text: <>chasing quality (loupe&nbsp;2019)</>,
        href: "https://www.youtube.com/watch?v=rqOBnaKC5-A",
        target: "_new",
        viewer: "video",
        media: "loupe.mp4",
        rowId: "speaking",
      },
      {
        text: <>designing at facebook (F8&nbsp;2016)</>,
        viewer: "video",
        media: "f8.mp4",
        rowId: "speaking",
      },
    ],
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
        text: "Instagram",
        href: "https://www.instagram.com/gk3",
        viewer: "social",
        rowId: "elsewhere",
      },
      {
        text: "Threads",
        href: "https://www.threads.com/@gk3",
        viewer: "social",
        rowId: "elsewhere",
      },
      {
        text: "LinkedIn",
        href: "https://linkedin.com/in/gk3",
        viewer: "social",
        rowId: "elsewhere",
      },
      {
        text: "Unsplash",
        href: "https://www.unsplash.com/gk3",
        viewer: "social",
        rowId: "elsewhere",
      },
      {
        text: "Substack",
        href: "http://gk3.fyi/",
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
  {
    id: "legal",
    title: null,
    legal: true,
    items: [],
  },
];

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
  const flipRef = useRef(1);
  const [viewing, setViewing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [viewerClass, setViewerClass] = useState<ViewerMode>("phone");
  const [activeRow, setActiveRow] = useState<string | null>(null);
  const [socialIndex, setSocialIndex] = useState(0);
  const [placeholder, setPlaceholder] = useState("lorem ipsum");
  const [activeItem, setActiveItem] = useState<React.ReactNode | null>(null);
  const [currentMedia, setCurrentMedia] = useState<string | null>(null);

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
    if (viewing && currentMedia && viewerClass !== "social" && viewerClass !== "pin") {
      if (clearVideoTimerRef.current) {
        clearTimeout(clearVideoTimerRef.current);
        clearVideoTimerRef.current = null;
      }
      const mediaName = currentMedia.replace(/\.mp4$/i, "");
      video.style.display = "block";
      video.src = `/gk3-assets/video/${mediaName}.mp4`;
      video.poster = `/gk3-assets/img/${mediaName}.jpg`;
      video.load();
      video.play().catch(() => {});
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
  }, [viewing, currentMedia, viewerClass]);

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
    const baseSaturated: [number, number, number] = [9, 42, 130];
    const basePastel: [number, number, number] = [52, 150, 255];
    const accentCrimson: [number, number, number] = [220, 20, 60];
    let latestDark: [number, number, number] = [...baseSaturated];
    let latestLight: [number, number, number] = [...basePastel];
    let colorDelta = 0;
    let colorDirection = 1;

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
      const svg = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="8" cy="8" r="8" fill="rgb(${circle[0]}, ${circle[1]}, ${circle[2]})"/><path d="M12.5 9.78547C12.4905 8.6081 11.1992 7.97193 9.39511 7.81052L11.56 6.81354C11.7404 6.72809 11.7878 6.60465 11.7878 6.41475V5.33232C11.7878 5.12343 11.6644 5 11.4555 5H4.22034C4.01145 5 3.88801 5.12343 3.88801 5.33232V6.04445C3.88801 6.25334 4.01145 6.37677 4.22034 6.37677H9.61349L7.14479 7.50668C6.98338 7.57314 6.90742 7.71557 6.90742 7.89597V8.65557C6.90742 8.86446 7.03085 8.9879 7.24924 8.9879C9.2147 8.9879 10.6864 9.3582 10.6959 9.7285C10.7054 9.96588 10.0977 10.2317 8.13227 10.2317C6.07186 10.2317 4.99892 9.84244 4.35327 9.65254C4.16337 9.60507 3.96397 9.62406 3.907 9.76648L3.56518 10.4311C3.47973 10.64 3.45124 10.7445 3.65064 10.8869C4.06842 11.1717 5.6161 11.7225 8.2652 11.7225C10.544 11.7225 12.5095 11.3237 12.5 9.78547Z" fill="rgb(${letter[0]}, ${letter[1]}, ${letter[2]})"/></svg>`;
      favicon.href = `data:image/svg+xml;base64,${window.btoa(svg)}`;
      document.querySelectorAll('head > link[rel="icon"]').forEach((other) => {
        if (other !== favicon) other.remove();
      });
    };

    const setGradient = () => {
      const newDark = rotateRgb(baseSaturated, colorDelta);
      const newLight = rotateRgb(basePastel, colorDelta);
      const fgColor = accentCrimson;
      const bgColor = newDark;
      const panelColor = adjustLightness(newDark, -0.06);
      latestDark = newDark;
      latestLight = newLight;

      root.style.setProperty("--fg-rgb", `${fgColor[0]}, ${fgColor[1]}, ${fgColor[2]}`);
      root.style.setProperty("--bg-rgb", `${bgColor[0]}, ${bgColor[1]}, ${bgColor[2]}`);
      root.style.setProperty("--fg-color", `rgb(${fgColor[0]}, ${fgColor[1]}, ${fgColor[2]})`);
      root.style.setProperty("--bg-color", `rgb(${bgColor[0]}, ${bgColor[1]}, ${bgColor[2]})`);
      root.style.setProperty("--panel-color", `rgb(${panelColor[0]}, ${panelColor[1]}, ${panelColor[2]})`);
      root.style.setProperty("--scrim", "rgba(30, 144, 255, 0.12)");
      syncThemeColor(bgColor);
      setFavicon(bgColor, fgColor);

      colorDelta += 0.45 * colorDirection;
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
    const gradientTimer = window.setInterval(setGradient, 1000 / 15);

    const canvas = canvasRef.current;
    let gl: WebGLRenderingContext | null = null;
    let program: WebGLProgram | null = null;
    let raf = 0;
    let running = false;
    let seed = window.matchMedia("(max-width: 850px)").matches ? 10 : Math.random() * 100;
    const visible = () => !(window.scrollY > (canvas?.height ?? 0) && window.matchMedia("(max-width: 850px)").matches);

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

            float grain = gradientNoise(gl_FragCoord.xy + fract(iTime)) - 0.5;
            preComp += grain * 0.04;

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

    const render = (time: number) => {
      if (!canvas || !gl || !program) return;
      if (!visible()) {
        running = false;
        return;
      }
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
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

  const prepViewer = (rowId: string, item: WorkItem) => {
    setViewerClass(item.viewer ?? "phone");
    setActiveRow(rowId);
    setViewing(true);
    setPlaceholder(placeholders[Math.floor(Math.random() * placeholders.length)]);
    setActiveItem(item.text);
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

  const endViewer = () => {
    setViewing(false);
    setActiveRow(null);
    setActiveItem(null);
    setCurrentMedia(null);
    setViewerClass("phone");
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
      return <div className="row rich-row" key={row.id}>{row.component}</div>;
    }
    if (row.bar) {
      return (
        <div className="row bar" key={row.id}>
          <svg width="70" height="24" viewBox="0 0 70 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="70" height="24" rx="12"></rect>
            <path d="M24.83 11.338H19.135C18.761 11.338 18.54 11.559 18.54 11.933V13.633C18.54 14.007 18.761 14.228 19.135 14.228H22.195C22.297 14.228 22.365 14.296 22.365 14.398V14.959C21.345 15.163 19.968 15.299 17.741 15.35C12.59 15.486 11.264 14.262 11.264 12.154C11.264 10.046 12.59 8.958 17.741 8.958C21.005 8.958 22.484 9.281 23.606 9.672C23.946 9.791 24.269 9.859 24.439 9.57L25.238 8.142C25.442 7.785 25.442 7.598 25.085 7.343C24.371 6.833 22.11 6 17.52 6C11.077 6 8 7.649 8 12.154C8 16.659 11.077 18.308 17.52 18.308C22.144 18.308 24.405 17.475 25.119 16.965C25.306 16.812 25.425 16.676 25.425 16.557V11.933C25.425 11.559 25.204 11.338 24.83 11.338Z"></path>
            <path d="M43.9194 17.407L35.8614 11.202L43.6304 6.901C44.1574 6.629 44.0554 6.204 43.4604 6.204H39.7714C39.4994 6.204 39.2274 6.238 38.9724 6.374L30.7614 10.862V6.799C30.7614 6.425 30.5234 6.204 30.1664 6.204H28.2114C27.8374 6.204 27.6164 6.425 27.6164 6.799V17.509C27.6164 17.883 27.8374 18.104 28.2114 18.104H30.1664C30.5234 18.104 30.7614 17.883 30.7614 17.509V14.041L33.2774 12.647L40.0604 17.866C40.2814 18.002 40.5024 18.104 40.7914 18.104H43.6814C44.2424 18.104 44.3784 17.747 43.9194 17.407Z"></path>
            <path d="M61.7798 14.772C61.7628 12.664 59.4508 11.525 56.2208 11.236L60.0968 9.451C60.4198 9.298 60.5048 9.077 60.5048 8.737V6.799C60.5048 6.425 60.2838 6.204 59.9098 6.204H46.9558C46.5818 6.204 46.3608 6.425 46.3608 6.799V8.074C46.3608 8.448 46.5818 8.669 46.9558 8.669H56.6118L52.1918 10.692C51.9028 10.811 51.7668 11.066 51.7668 11.389V12.749C51.7668 13.123 51.9878 13.344 52.3788 13.344C55.8978 13.344 58.5328 14.007 58.5498 14.67C58.5668 15.095 57.4788 15.571 53.9598 15.571C50.2708 15.571 48.3498 14.874 47.1938 14.534C46.8538 14.449 46.4968 14.483 46.3948 14.738L45.7828 15.928C45.6298 16.302 45.5788 16.489 45.9358 16.744C46.6838 17.254 49.4548 18.24 54.1978 18.24C58.2778 18.24 61.7968 17.526 61.7798 14.772Z"></path>
          </svg>
          <span className="copyright">
            <em>&copy;</em>2026<span className="comma">,</span>
            c/o&nbsp;George&nbsp;Kedenburg&nbsp;III
          </span>
        </div>
      );
    }

    if (row.legal) {
      return (
        <div className="row legal" key={row.id}>
          <span>
            Hello! I'd like to personally thank you for stopping by my little corner of the internet. Whether you were
            here for business or for pleasure, I hope you enjoyed your stay. I thought it would look cool if I had some
            fine print here at the bottom of the page, but traditionally fine print like this is used for boring terms
            and conditions&nbsp;&mdash;&nbsp;of which I have none.
          </span>
          <span>
            So instead, I'm just using this space to write you, my visitor, a little note. I hope you're having a great
            day! If you aren't, you can{" "}
            <a href="https://instagram.com/24_beans" target="_blank">
              click here
            </a>{" "}
            to visit my cat Bean's instagram. He always cheers me up, so maybe he will do the same for you? Okay, I'm
            running out of space, so I'll just leave you with one last thought: be a good person. The world has enough
            jerks.
          </span>
        </div>
      );
    }

    return (
      <div
        className={`row${activeRow === row.id && viewing ? " active" : ""}`}
        key={row.id}
      >
        {row.title ? <h2 className={row.solo ? "solo" : undefined}>{row.title}</h2> : null}
        {row.h3 ? <h3>{row.h3}</h3> : null}
        <div className="work-wrapper" onMouseLeave={() => { if (!window.matchMedia("(hover: none) and (pointer: coarse)").matches) endViewer(); }}>
          <ul className={row.id === "elsewhere" ? undefined : "work"}>
            {(row.items ?? []).map((item, index) => (
              <li
                key={`${row.id}-${index}`}
                className={activeRow === row.id && activeItem === item.text ? "active" : ""}
                data-viewer={item.viewer}
                data-media={item.media}
                onMouseEnter={() => {
                  if (item.viewer && !window.matchMedia("(hover: none) and (pointer: coarse)").matches) {
                    prepViewer(row.id, item);
                  }
                }}
                onClick={() => {
                  if (item.viewer && !item.href && window.matchMedia("(hover: none) and (pointer: coarse)").matches) {
                    prepViewer(row.id, item);
                  }
                }}
              >
                {item.href ? (
                  <a href={item.href} target={item.target ?? "_blank"}>
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
      <div id="pointer" ref={pointerRef} />
      <div id="main">
        <div id="hero">
          <div id="hero-inner">
            <h1>George Kedenburg&nbsp;III</h1>
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
              onError={(event) => {
                const video = event.currentTarget;
                const currentSrc = video.getAttribute("src");
                if (currentSrc && currentSrc !== "/gk3-assets/video/404.mp4") {
                  video.src = "/gk3-assets/video/404.mp4";
                  video.load();
                  video.play().catch(() => {});
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
        </div>
      </div>
      <canvas id="c" ref={canvasRef} />
    </>
  );
}






