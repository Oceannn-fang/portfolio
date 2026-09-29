import * as THREE from 'three';

// #54 探针：iframe 侧 longtask 全程记录（含 init 期——此前由父页面在 ready 后
// 注入，会漏掉 init 期的主线程占用）。供 CDP 验证脚本读取，量化 three.js init
// （shader 编译 + 30 张纹理 GPU 上传）在共享渲染进程主线程上的真实成本。
window.__lt = [];
try {
  new PerformanceObserver(function (list) {
    for (let i = 0; i < list.getEntries().length; i++) {
      window.__lt.push(Math.round(list.getEntries()[i].duration));
    }
  }).observe({ entryTypes: ["longtask"] });
} catch (e) {}

const albums = [
  { artist: "Frank Ocean", title: "Blonde", file: "album_covers_webp/01_frank_ocean_blonde.webp" },
  { artist: "Lu1", title: "blue", file: "album_covers_webp/02_lu1_blue.webp" },
  { artist: "Black Country, New Road", title: "Ants From Up There", file: "album_covers_webp/03_black_country_new_road_ants_from_up_there.webp" },
  { artist: "Radiohead", title: "In Rainbows", file: "album_covers_webp/04_radiohead_in_rainbows.webp" },
  { artist: "孙盛希", title: "出没地带", file: "album_covers_webp/05_sun_shengxi_chu_mo_di_dai.webp" },
  { artist: "张醒婵", title: "No, no", file: "album_covers_webp/06_zhang_xingchan_no_no.webp" },
  { artist: "Cornelius", title: "Fantasma", file: "album_covers_webp/07_cornelius_fantasma.webp" },
  { artist: "NewJeans", title: "Supernatural", file: "album_covers_webp/08_newjeans_supernatural.webp" },
  { artist: "tomcbumpz", title: "comfortable silence", file: "album_covers_webp/09_tomcbumpz_comfortable_silence.webp" },
  { artist: "Sweet Trip", title: "Velocity : Design : Comfort.", file: "album_covers_webp/10_sweet_trip_velocity_design_comfort.webp" },
  { artist: "椎名林檎", title: "胜诉的新宿舞娘", file: "album_covers_webp/11_shiina_ringos_shouso_strip.webp" },
  { artist: "Portishead", title: "Roseland NYC Live", file: "album_covers_webp/12_portishead_roseland_nyc_live.webp" },
  { artist: "魏如萱", title: "优雅的刺猬", file: "album_covers_webp/13_waa_wei_you_ya_de_ci_wei.webp" },
  { artist: "toe", title: "the book about my idle plot on a vague anxiety.", file: "album_covers_webp/14_toe_the_book_about_my_idle_plot_on_a_vague_anxiety.webp" },
  { artist: "Sampha", title: "Lahai", file: "album_covers_webp/15_sampha_lahai.webp" },
  { artist: "Tyler, The Creator", title: "IGOR", file: "album_covers_webp/16_tyler_the_creator_igor.webp" },
  { artist: "Stereolab", title: "Dots And Loops", file: "album_covers_webp/17_stereolab_dots_and_loops.webp" },
  { artist: "Aphex Twin", title: "Richard D. James Album", file: "album_covers_webp/18_aphex_twin_richard_d_james_album.webp" },
  { artist: "Oh, Yoko", title: "I Love You...", file: "album_covers_webp/19_oh_yoko_i_love_you.webp" },
  { artist: "砂原良徳", title: "The Sound Of '70s", file: "album_covers_webp/20_sunahara_yoshinori_the_sound_of_70s.webp" },
  { artist: "ACO", title: "absolute ego", file: "album_covers_webp/21_aco_absolute_ego.webp" },
  { artist: "Fred again..", title: "Ten Days", file: "album_covers_webp/22_fred_again_ten_days.webp" },
  { artist: "caroline", title: "caroline 2", file: "album_covers_webp/23_caroline_caroline_2.webp" },
  { artist: "Fayzz", title: "Days Gone", file: "album_covers_webp/24_fayzz_days_gone.webp" },
  { artist: "The Strokes", title: "Is This It", file: "album_covers_webp/25_the_strokes_is_this_it.webp" },
  { artist: "表情银行", title: "嘿！岛", file: "album_covers_webp/26_biao_qing_yin_hang_hei_dao.webp" },
  { artist: "Lu1", title: "午夜列车上的告别", file: "album_covers_webp/27_lu1_wu_ye_lie_che_shang_de_gao_bie.webp" },
  { artist: "Frank Ocean", title: "channel ORANGE", file: "album_covers_webp/28_frank_ocean_channel_orange.webp" },
  { artist: "陈绮贞", title: "吉他手", file: "album_covers_webp/29_cheer_chen_ji_ta_shou.webp" },
  { artist: "ciacia", title: "她的。发光摇摆", file: "album_covers_webp/30_ciacia_ta_de_fa_guang_yao_bai.webp" },
];

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const topLayer = document.querySelector(".arc-layer-top");
const bottomLayer = document.querySelector(".arc-layer-bottom");
const focus = document.querySelector(".focus");
const focusCover = document.querySelector(".focus-cover");
const focusImage = document.querySelector(".focus-cover-image");
const playButton = document.querySelector(".play-button");
const playLabel = document.querySelector(".play-label");
const previewAudio = document.querySelector(".preview-audio");
previewAudio.volume = 0.92;
window.previewAudio = previewAudio;
// #91 专辑信息面板 DOM；#92：panel 移入 .focus（封面左侧），标题/艺术家改为
// .ap-line 内层（外层 h2/p 负责裁切，内层供 marquee 撑宽）
const albumPanel = document.querySelector(".album-panel");
const albumPanelTitle = document.querySelector(".album-panel-title");
const albumPanelArtist = document.querySelector(".album-panel-artist");
const albumPanelTitleLine = albumPanelTitle?.querySelector(".ap-line") || null;
const albumPanelArtistLine = albumPanelArtist?.querySelector(".ap-line") || null;
const albumPanelTracks = document.querySelector(".album-panel-tracks");
const albumPanelNow = document.querySelector(".album-panel-now");
const albumPanelNowTrack = document.querySelector(".album-panel-now-track");

// #92 长名悬浮滚动预览（marquee）：复用 MusicModule 的模式 —— 事件委托到面板根
// 节点，hover 时测量 scrollWidth > clientWidth 才对真正溢出的行加 .ap-marquee
// 触发 CSS 动画，mouseout 移除；不溢出的行保持单行省略不动
const AP_MARQUEE_SEL = ".album-panel-title .ap-line, .album-panel-artist .ap-line, .album-panel-tracks .track-name";
if (albumPanel) {
  albumPanel.addEventListener("mouseover", (event) => {
    const el = event.target.closest?.(AP_MARQUEE_SEL);
    if (el && el.scrollWidth > el.clientWidth) el.classList.add("ap-marquee");
  });
  albumPanel.addEventListener("mouseout", (event) => {
    const el = event.target.closest?.(AP_MARQUEE_SEL);
    if (el) el.classList.remove("ap-marquee");
  });
}

let scene, camera, renderer;
let cdMeshes = new Map();
let focusMesh = null;
let selectedAlbum = albums[0];
let lastTime = performance.now();
// #53 init 前移信号：父页面（Gk3Clone）以 1×1 iframe 预载（非 0×0 —— 0×0 时合成器
// 不调度 BeginFrame，首帧 render 连同 shader 编译 + 30 张纹理 GPU 上传会被推迟到
// 用户点击瞬间，实测停帧 6.4s）。1×1 时守卫放行，空闲期逐帧完成 init；
// 全部 mesh（30 卡片 + focus）就绪后的首帧渲染完成时向父页面发 arc-vinyl:ready，
// 父页面收到后收回 0×0 零开销待命。__arcVinylReady 供 CDP 验证探针读取。
let sceneReadyCount = 0;
let readySent = false;
// focus mesh 分帧构建代际号：防止上一轮未执行的构建任务在新一轮 setFocusAlbum
// 后入场景（focusMesh 异步赋值前的 dispose 无法覆盖队列中的旧任务）
let focusBuildToken = 0;
let previewPlaying = false;
let previewTransitioning = false;
let audioFadeFrame = 0;
let audioFadeToken = 0;
let previewSession = 0;
let selectionTransitionId = 0;
let activeSelectionFlight = null;
// #91 面板状态：曲目列表缓存（file → tracks[]）/ 渲染代际（快速切专辑防串）/
// 正在播放曲目名（空 = 未播放；切专辑/停止/结束/失败时清空）
const albumTracksCache = new Map();
let panelSession = 0;
let nowPlayingTrack = "";

const PREVIEW_VOLUME = 0.92;
const DUCKED_VOLUME = 0.12;
const PREVIEW_DUCK_MS = 460;
const PREVIEW_FADE_IN_MS = 820;
const FOCUS_SWAP_DELAY_MS = 820;
const CARD_STACK_MIN_Z = 0.16;
const CARD_STACK_RANGE_Z = 4.3;
const FOCUS_STACK_Z = 4.9;
const HOVER_Y_SHIFT = 10;
const CASE_DEPTH_RATIO = 0.155;
const FOCUS_INTERACTION_RANGE = 1.65;
const IDLE_DRIFT_CHANGE_MIN_MS = 1350;
const IDLE_DRIFT_CHANGE_RANGE_MS = 2300;

const lanes = [
  {
    name: "top",
    el: topLayer,
    albums: albums.slice(0, 18),
    direction: 1,
    offset: 0.03,
    speed: 0.000018,
    targetSpeed: 0.000018,
    normalSpeed: 0.000018,
    hoverSpeed: 0.0000038,
    slowUntil: 0,
    cards: [],
  },
  {
    name: "bottom",
    el: bottomLayer,
    albums: albums.slice(12, 30),
    direction: -1,
    offset: 0.72,
    speed: 0.000015,
    targetSpeed: 0.000015,
    normalSpeed: 0.000015,
    hoverSpeed: 0.000003,
    slowUntil: 0,
    cards: [],
  },
];

const pointer = {
  targetX: 0, targetY: 0, x: 0, y: 0,
  targetScale: 1, scale: 1,
  shineX: 50, shineY: 42,
  clientX: -9999, clientY: -9999,
  inFocusRange: false,
  targetTiltX: 0, targetTiltY: 0, targetTiltRx: 0, targetTiltRy: 0, targetRoll: 0,
  tiltX: 0, tiltY: 0, tiltRx: 0, tiltRy: 0, roll: 0,
};

const idleMotion = {
  phase: Math.random() * Math.PI * 2,
  nextChangeAt: 0,
  x: 0, y: 0, tiltRx: 0, tiltRy: 0, roll: 0,
  targetX: 0, targetY: 0, targetTiltRx: 0, targetTiltRy: 0, targetRoll: 0,
};

function initThreeJS() {
  const canvas = document.getElementById('three-canvas');
  
  scene = new THREE.Scene();
  
  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 0, 10);
  
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  
  const ambient = new THREE.AmbientLight(0xffffff, 0.8);
  scene.add(ambient);
  
  const key = new THREE.DirectionalLight(0xfff5e6, 1.2);
  key.position.set(5, 5, 5);
  scene.add(key);
  
  const fill = new THREE.DirectionalLight(0xb0c4de, 0.4);
  fill.position.set(-3, 2, 3);
  scene.add(fill);
  
  // #93 项3：resize 合并到下一帧（0×0↔全屏切换可能连续派发多次 resize 事件，
  // 避免同帧重复 updateProjectionMatrix + framebuffer 重分配）。
  // #94 回归修复：setSize 必须保持默认第三参（同步内联 style）。预载期初始
  // init 发生在 1×1 iframe，setSize(1,1) 会写入 style 1px——内联样式覆盖
  // 100% 规则；#93 曾改 false 只更新位图，全屏后 style 永远停在 1px，
  // 整个 three 视觉主体（卡片墙+中央封面）不可见（用户实测“不能正常显示”）。
  let resizeRaf = 0;
  window.addEventListener('resize', () => {
    if (resizeRaf) return;
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = 0;
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  });
}

function extractColors(image) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const s = 64;
  canvas.width = s;
  canvas.height = s;
  ctx.drawImage(image, 0, 0, s, s);

  const imageData = ctx.getImageData(0, 0, s, s).data;
  const band = 12;
  const primary = dominantColor(imageData, s, 0, 0, s, s);
  const left = normalizeDisplayColor(dominantColor(imageData, s, 0, 0, s / 2, s));
  const right = normalizeDisplayColor(dominantColor(imageData, s, s / 2, 0, s / 2, s));
  const top = dominantColor(imageData, s, 0, 0, s, band);
  const bottom = dominantColor(imageData, s, 0, s - band, s, band);
  const topBottom = normalizeDisplayColor(mixColors(top, bottom, 0.5));
  const complement = normalizeDisplayColor(rotateHue(primary, 180));
  const rare = rareAccentColor(imageData, s, primary);
  const edgeAccent = normalizeDisplayColor(mixColors(rare, complement, 0.42));
  const edgeAccentAlt = normalizeDisplayColor(mixColors(edgeAccent, adjustColor(complement, 0.78, 22), 0.32));
  const brightness = getBrightness(primary);

  const dark = brightness > 128
    ? adjustColor(primary, 0.25)
    : adjustColor(primary, 0.4);
  const light = brightness > 128
    ? adjustColor(primary, 0.85)
    : adjustColor(primary, 1.4, 40);

  return {
    primary,
    sideLeft: left,
    sideRight: right,
    sideTopBottom: topBottom,
    edgeAccent,
    edgeAccentAlt,
    dark, light,
    textColor: getReadableTextColor(primary),
    brightness,
  };
}

function collectColorBuckets(data, size, x0, y0, width, height) {
  const buckets = new Map();
  const startX = Math.max(0, Math.floor(x0));
  const startY = Math.max(0, Math.floor(y0));
  const endX = Math.min(size, Math.ceil(x0 + width));
  const endY = Math.min(size, Math.ceil(y0 + height));

  for (let y = startY; y < endY; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      const offset = (y * size + x) * 4;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const saturation = max === 0 ? 0 : (max - min) / max;
      const brightness = getBrightness({ r, g, b });
      const weight = 1 + saturation * 2.4 + (brightness > 28 && brightness < 238 ? 0.8 : 0);
      const key = `${Math.round(r / 24)},${Math.round(g / 24)},${Math.round(b / 24)}`;
      const bucket = buckets.get(key) || { r: 0, g: 0, b: 0, weight: 0, count: 0 };

      bucket.r += r * weight;
      bucket.g += g * weight;
      bucket.b += b * weight;
      bucket.weight += weight;
      bucket.count += 1;
      buckets.set(key, bucket);
    }
  }

  return Array.from(buckets.values()).map((bucket) => {
    const color = {
      r: clampChannel(bucket.r / bucket.weight),
      g: clampChannel(bucket.g / bucket.weight),
      b: clampChannel(bucket.b / bucket.weight),
    };
    const max = Math.max(color.r, color.g, color.b);
    const min = Math.min(color.r, color.g, color.b);
    return {
      ...color,
      weight: bucket.weight,
      count: bucket.count,
      saturation: max === 0 ? 0 : (max - min) / max,
      brightness: getBrightness(color),
    };
  });
}

function dominantColor(data, size, x0, y0, width, height) {
  const buckets = collectColorBuckets(data, size, x0, y0, width, height);
  const winner = buckets.reduce((best, bucket) => (
    !best || bucket.weight > best.weight ? bucket : best
  ), null);
  return winner || { r: 128, g: 128, b: 128 };
}

function clampChannel(value) {
  return Math.min(255, Math.max(0, Math.round(value)));
}

function getBrightness(color) {
  return (color.r * 299 + color.g * 587 + color.b * 114) / 1000;
}

function adjustColor(color, scale, offset = 0) {
  return {
    r: clampChannel(color.r * scale + offset),
    g: clampChannel(color.g * scale + offset),
    b: clampChannel(color.b * scale + offset),
  };
}

function mixColors(a, b, weight = 0.5) {
  return {
    r: clampChannel(a.r * (1 - weight) + b.r * weight),
    g: clampChannel(a.g * (1 - weight) + b.g * weight),
    b: clampChannel(a.b * (1 - weight) + b.b * weight),
  };
}

function colorDistance(a, b) {
  return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
}

function rgbToHsl(color) {
  const r = color.r / 255;
  const g = color.g / 255;
  const b = color.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    if (max === g) h = (b - r) / d + 2;
    if (max === b) h = (r - g) / d + 4;
    h /= 6;
  }

  return { h, s, l };
}

function hslToRgb({ h, s, l }) {
  const hueToRgb = (p, q, t) => {
    let nextT = t;
    if (nextT < 0) nextT += 1;
    if (nextT > 1) nextT -= 1;
    if (nextT < 1 / 6) return p + (q - p) * 6 * nextT;
    if (nextT < 1 / 2) return q;
    if (nextT < 2 / 3) return p + (q - p) * (2 / 3 - nextT) * 6;
    return p;
  };

  if (s === 0) {
    const channel = clampChannel(l * 255);
    return { r: channel, g: channel, b: channel };
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: clampChannel(hueToRgb(p, q, h + 1 / 3) * 255),
    g: clampChannel(hueToRgb(p, q, h) * 255),
    b: clampChannel(hueToRgb(p, q, h - 1 / 3) * 255),
  };
}

function rotateHue(color, degrees) {
  const hsl = rgbToHsl(color);
  hsl.h = (hsl.h + degrees / 360) % 1;
  hsl.s = Math.min(0.72, Math.max(0.34, hsl.s * 0.88 + 0.18));
  hsl.l = Math.min(0.68, Math.max(0.36, hsl.l * 0.92 + 0.06));
  return hslToRgb(hsl);
}

function rareAccentColor(data, size, primary) {
  const complement = rotateHue(primary, 180);
  const buckets = collectColorBuckets(data, size, 0, 0, size, size);
  const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0) || 1;
  const candidates = buckets
    .filter((bucket) => bucket.count >= 4 && bucket.saturation > 0.18 && bucket.brightness > 36 && bucket.brightness < 230)
    .map((bucket) => {
      const color = { r: bucket.r, g: bucket.g, b: bucket.b };
      const frequency = bucket.count / total;
      const contrast = Math.min(1, colorDistance(color, primary) / 220);
      const complementAffinity = 1 - Math.min(1, colorDistance(color, complement) / 255);
      return {
        ...color,
        score: bucket.saturation * 1.9 + contrast * 1.25 + complementAffinity * 0.9 + (1 - frequency) * 0.45,
      };
    })
    .sort((a, b) => b.score - a.score);

  if (!candidates.length) return complement;
  return normalizeDisplayColor(mixColors(candidates[0], complement, 0.28));
}

function normalizeDisplayColor(color) {
  const brightness = getBrightness(color);
  if (brightness < 48) return adjustColor(color, 1.45, 18);
  if (brightness > 218) return adjustColor(color, 0.82, -6);
  return color;
}

function getReadableTextColor(color) {
  return getBrightness(color) > 142 ? '#151515' : '#f6f1e8';
}

function colorToRgb(color) {
  return `rgb(${color.r | 0},${color.g | 0},${color.b | 0})`;
}

function createReadableCanvasTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(renderer?.capabilities?.getMaxAnisotropy?.() || 1, 8);
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

function getAlbumCode(album) {
  const index = albums.indexOf(album);
  return `ARC-${String(index + 1).padStart(2, "0")}`;
}

function fitCanvasText(ctx, text, maxWidth, tail = "...") {
  let nextText = text;
  while (ctx.measureText(nextText).width > maxWidth && nextText.length > tail.length + 3) {
    nextText = `${nextText.slice(0, -tail.length - 1)}${tail}`;
  }
  return nextText;
}

function createSpineTexture(album, colors, side) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 2048;
  const ctx = canvas.getContext('2d');

  const sideColor = side === "right" ? colors.sideRight : colors.sideLeft;
  ctx.fillStyle = colorToRgb(sideColor);
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(-Math.PI / 2);

  ctx.fillStyle = getReadableTextColor(sideColor);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.font = '900 112px -apple-system, BlinkMacSystemFont, sans-serif';
  const maxW = canvas.height * 0.85;
  const title = fitCanvasText(ctx, album.title, maxW);
  ctx.fillText(title, 0, -58);

  ctx.font = '700 68px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.globalAlpha = 0.9;
  const artist = fitCanvasText(ctx, album.artist, maxW * 0.94);
  ctx.fillText(artist, 0, 54);

  ctx.restore();

  return createReadableCanvasTexture(canvas);
}

function createBackTexture(colors) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  const { dark, light } = colors;
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, `rgb(${(light.r + dark.r) / 2 | 0},${(light.g + dark.g) / 2 | 0},${(light.b + dark.b) / 2 | 0})`);
  grad.addColorStop(1, `rgb(${dark.r | 0},${dark.g | 0},${dark.b | 0})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  return createReadableCanvasTexture(canvas);
}

function createEdgeTexture(album, colors, side) {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 384;
  const ctx = canvas.getContext('2d');
  const base = side === "top" ? colors.edgeAccent : colors.edgeAccentAlt;
  const secondary = side === "top" ? colors.edgeAccentAlt : colors.edgeAccent;
  const textColor = getReadableTextColor(base);
  const code = getAlbumCode(album);

  const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  grad.addColorStop(0, colorToRgb(base));
  grad.addColorStop(1, colorToRgb(mixColors(base, secondary, 0.58)));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.globalAlpha = 0.24;
  ctx.fillStyle = textColor;
  ctx.font = '900 236px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText(code.replace("ARC-", ""), canvas.width - 64, canvas.height / 2 + 2);

  ctx.globalAlpha = 0.95;
  ctx.fillStyle = textColor;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = '900 168px -apple-system, BlinkMacSystemFont, sans-serif';
  const lead = side === "top"
    ? `${code}  ${album.title}`
    : album.artist;
  ctx.fillText(fitCanvasText(ctx, lead.toUpperCase(), canvas.width - 260), 56, canvas.height / 2 + 8);

  return createReadableCanvasTexture(canvas);
}

function createCDCase(album, coverImage, size, suppliedColors = null) {
  const colors = suppliedColors || extractColors(coverImage);

  const coverTex = new THREE.Texture(coverImage);
  coverTex.colorSpace = THREE.SRGBColorSpace;
  coverTex.needsUpdate = true;

  const depth = size * CASE_DEPTH_RATIO;
  const leftSpineTex = createSpineTexture(album, colors, "left");
  const rightSpineTex = createSpineTexture(album, colors, "right");
  const topEdgeTex = createEdgeTexture(album, colors, "top");
  const bottomEdgeTex = createEdgeTexture(album, colors, "bottom");
  const backTex = createBackTexture(colors);

  const coverMat = new THREE.MeshBasicMaterial({
    map: coverTex,
    toneMapped: false,
  });

  const leftSpineMat = new THREE.MeshBasicMaterial({
    map: leftSpineTex,
    toneMapped: false,
  });

  const rightSpineMat = new THREE.MeshBasicMaterial({
    map: rightSpineTex,
    toneMapped: false,
  });

  const backMat = new THREE.MeshPhysicalMaterial({
    map: backTex,
    roughness: 0.5,
    metalness: 0.05,
    clearcoat: 0.3,
    clearcoatRoughness: 0.4,
  });

  const topEdgeMat = new THREE.MeshBasicMaterial({
    map: topEdgeTex,
    toneMapped: false,
  });

  const bottomEdgeMat = new THREE.MeshBasicMaterial({
    map: bottomEdgeTex,
    toneMapped: false,
  });

  const geo = new THREE.BoxGeometry(size, size, depth);
  const materials = [rightSpineMat, leftSpineMat, topEdgeMat, bottomEdgeMat, coverMat, backMat];

  const mesh = new THREE.Mesh(geo, materials);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.ownsResources = true;
  return mesh;
}

function disposeCDCase(mesh) {
  if (!mesh) return;
  scene.remove(mesh);
  // clone() 与源 mesh 共享 geometry/material，只有自建资源的盒子才能释放
  if (!mesh.userData.ownsResources) return;
  mesh.userData.ownsResources = false;

  if (mesh.geometry) mesh.geometry.dispose();
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  materials.forEach((material) => {
    if (!material) return;
    if (material.map) material.map.dispose();
    material.dispose();
  });
}

function screenToWorld(x, y, targetZ = 0) {
  const ndcX = (x / window.innerWidth) * 2 - 1;
  const ndcY = -(y / window.innerHeight) * 2 + 1;
  
  const vector = new THREE.Vector3(ndcX, ndcY, 0.5);
  vector.unproject(camera);
  
  const dir = vector.sub(camera.position).normalize();
  const distance = (targetZ - camera.position.z) / dir.z;
  const pos = camera.position.clone().add(dir.multiplyScalar(distance));
  
  return pos;
}

function worldUnitsPerPixelAtZ(targetZ = 0) {
  const fov = camera.fov * (Math.PI / 180);
  const cameraDistance = Math.abs(camera.position.z - targetZ);
  const visibleHeight = 2 * Math.tan(fov / 2) * cameraDistance;
  return visibleHeight / window.innerHeight;
}

function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function getLaneStackProgress(lane, screenT) {
  return lane.name === "top" ? screenT : 1 - screenT;
}

function isSameAlbum(first, second) {
  return first?.file === second?.file;
}

// #54 init 分帧调度器：mesh 创建（Canvas2D 颜色提取 / WebGL 几何 + 纹理上传）
// 原本随 30 张 img 的 load 事件同帧集中执行，实测形成 244ms 宿主 longtask
// （same-origin iframe 与宿主共享渲染进程主线程）→ init 窗口宿主 rAF 跌到
// 13fps/400ms 停帧。改为每帧最多执行 1 个子任务，把 init 摊到多帧，
// 保持宿主帧间隔 <50ms（无停帧感）。
const meshBuildQueue = [];
let meshBuildScheduled = false;
// #94 冷开渐进：priority 任务（focus 中央封面 mesh）插队到队首——真实首访
// 常在 init 完成前点击（1×1 预载被打断），打开后每帧 drain 1 任务，
// focus 优先构建让中央封面最先出现，30 张卡片随后逐帧浮现（渐进加载）。
function scheduleMeshBuild(task, priority) {
  if (priority) meshBuildQueue.unshift(task);
  else meshBuildQueue.push(task);
  if (meshBuildScheduled) return;
  meshBuildScheduled = true;
  requestAnimationFrame(function drain() {
    meshBuildScheduled = false;
    const next = meshBuildQueue.shift();
    if (!next) return;
    next();
    if (meshBuildQueue.length > 0) {
      meshBuildScheduled = true;
      requestAnimationFrame(drain);
    }
  });
}

function createCard(album, index, lane) {
  const button = document.createElement("button");
  button.className = "album-card";
  button.type = "button";
  button.setAttribute("aria-label", `${album.title} by ${album.artist}`);
  button.style.setProperty("--scale-size", String(0.98 + ((index * 7) % 5) / 100));

  const inner = document.createElement("span");
  inner.className = "album-card-inner";

  const image = document.createElement("img");
  image.src = album.file;
  image.alt = `${album.title} album cover`;
  image.loading = "eager";
  image.decoding = "async";

  const face = document.createElement("span");
  face.className = "album-box-face";
  face.appendChild(image);

  inner.append(face);
  button.appendChild(inner);

  const card = {
    el: button,
    image,
    album,
    base: index / lane.albums.length,
    lift: (((index * 37) % 21) - 10) * 0.18,
    tilt: ((index * 43) % 18) - 9,
    hover: 0,
    mesh: null,
  };

  // 单次加载共享：DOM 封面 img 加载完成后直接用于颜色提取与 three.js 纹理，
  // 不再 new Image() 二次拉取（此前每张封面在 iframe 内产生 2 次请求）。
  const token = Symbol(album.file);
  card.loadToken = token;
  // 分帧：颜色提取（Canvas2D 像素读取）与 mesh 构建（geometry + 纹理上传）拆到
  // 相邻两帧执行，单帧 init 开销 <10ms，避免同帧叠加成 >50ms 主线程长任务
  const attachMesh = () => {
    if (card.loadToken !== token) return;
    scheduleMeshBuild(() => {
      if (card.loadToken !== token) return;
      card.colors = extractColors(image);
    });
    scheduleMeshBuild(() => {
      if (card.loadToken !== token) return;
      card.mesh = createCDCase(album, image, 1, card.colors);
      scene.add(card.mesh);
      sceneReadyCount++;
    });
  };
  if (image.complete && image.naturalWidth) {
    attachMesh();
  } else {
    image.addEventListener("load", attachMesh, { once: true });
  }

  button.addEventListener("pointerenter", () => { card.pointerHover = true; });
  button.addEventListener("pointerleave", () => { card.pointerHover = false; });
  button.addEventListener("click", () => {
    if (isSameAlbum(card.album, selectedAlbum)) return;
    lane.slowUntil = performance.now() + 1200;
    selectAlbum(card.album, image, card);
  });

  lane.el.appendChild(button);
  return card;
}

function mountLanes() {
  lanes.forEach((lane) => {
    lane.cards = lane.albums.map((album, index) => createCard(album, index, lane));
  });
}

function setFocusAlbum(album, { transitionPreview = false, coverImage = null, colors = null } = {}) {
  const albumChanged = selectedAlbum !== album;
  const shouldTransitionPreview = albumChanged && previewPlaying && transitionPreview;
  selectedAlbum = album;
  focusImage.src = album.file;
  focusImage.alt = `${album.title} album cover`;
  updatePreviewMeta();
  renderAlbumPanel(album);

  const myFocusToken = ++focusBuildToken;
  if (focusMesh) {
    disposeCDCase(focusMesh);
    focusMesh = null;
  }

  // 分帧：与卡片 mesh 同一调度器，颜色提取与 mesh 构建拆到相邻两帧；
  // #94 priority：中央封面是打开瞬间的视觉锚点，插队优先构建
  const buildFocusMesh = (imgEl) => {
    scheduleMeshBuild(() => {
      if (myFocusToken !== focusBuildToken) return;
      const extracted = colors || extractColors(imgEl);
      scheduleMeshBuild(() => {
        if (myFocusToken !== focusBuildToken) return;
        focusMesh = createCDCase(album, imgEl, 1, extracted);
        scene.add(focusMesh);
        sceneReadyCount++;
      }, true);
    }, true);
  };

  if (coverImage?.complete && coverImage.naturalWidth) {
    buildFocusMesh(coverImage);
  } else {
    const imgEl = new Image();
    imgEl.crossOrigin = 'anonymous';
    imgEl.onload = () => buildFocusMesh(imgEl);
    imgEl.src = album.file;
  }

  if (shouldTransitionPreview) {
    playCurrentPreview({ fromTransition: true });
  }
}

function getCurrentPreview() {
  const bundled = window.ALBUM_PREVIEWS?.[selectedAlbum.file] || null;
  if (bundled?.previewUrl) return bundled;
  // #92 修 Unavailable 误报：旧逻辑只认 ALBUM_PREVIEWS，导致面板已列出可播曲目
  // （iTunes search/lookup 拉取）但 play-button 仍显示 Unavailable。现回退到面板
  // 曲目缓存：列表中存在任一 previewUrl 即视为可播（无任何试听才 Unavailable）
  const fetched = albumTracksCache.get(selectedAlbum.file);
  const fromList = Array.isArray(fetched) ? fetched.find((track) => track?.previewUrl) : null;
  return fromList || null;
}

// #91：缺失试听的 8 张专辑的 iTunes Search 提示词（probe 实测命中配置）。
// album 词可用 iTunes 原名（与 script.js 本地名可不同），country 按专辑指定：
// 椎名林檎→JP、ciacia→TW，其余默认 US。砂原良徳 The Sound Of '70s 实测 iTunes 无货
// （上游返回空曲目 → 面板显示 No track list available，专辑名/艺术家照常显示）。
const ITUNES_HINTS = {
  "album_covers_webp/01_frank_ocean_blonde.webp": { artist: "Frank Ocean", album: "Blonde", country: "US" },
  "album_covers_webp/11_shiina_ringos_shouso_strip.webp": { artist: "椎名林檎", album: "勝訴ストリップ", country: "JP" },
  "album_covers_webp/16_tyler_the_creator_igor.webp": { artist: "Tyler, The Creator", album: "IGOR", country: "US" },
  "album_covers_webp/20_sunahara_yoshinori_the_sound_of_70s.webp": { artist: "砂原良徳", album: "The Sound Of '70s", country: "JP" },
  "album_covers_webp/22_fred_again_ten_days.webp": { artist: "Fred again..", album: "Ten Days", country: "US" },
  "album_covers_webp/27_lu1_wu_ye_lie_che_shang_de_gao_bie.webp": { artist: "Lu1", album: "Farewell on A Midnight Train", country: "US" },
  "album_covers_webp/28_frank_ocean_channel_orange.webp": { artist: "Frank Ocean", album: "channel ORANGE", country: "US" },
  "album_covers_webp/30_ciacia_ta_de_fa_guang_yao_bai.webp": { artist: "ciacia", album: "她的。發光搖擺", country: "TW" },
};

// 有本地试听的 22 张：从 ALBUM_PREVIEWS.trackViewUrl 提取专辑集合 id
// （music.apple.com/us/album/<slug>/<collectionId>?i=<trackId>），走 lookup 模式
function getCollectionId(album) {
  const preview = window.ALBUM_PREVIEWS?.[album.file];
  if (!preview?.trackViewUrl) return "";
  try {
    const segments = new URL(preview.trackViewUrl).pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1];
    return /^\d+$/.test(last) ? last : "";
  } catch (e) {
    return "";
  }
}

// 曲目列表获取：collectionId lookup 优先，无则按 hint 走 search。
// 返回：tracks 数组（可为空 = 上游确认无货）或 null（无数据源/请求失败）。
// 空数组与失败都缓存，避免同一专辑反复打上游。
async function fetchAlbumTracks(album) {
  if (albumTracksCache.has(album.file)) return albumTracksCache.get(album.file);
  const collectionId = getCollectionId(album);
  const hint = ITUNES_HINTS[album.file];
  let url = "";
  if (collectionId) {
    url = `/api/itunes?collectionId=${collectionId}`;
  } else if (hint) {
    url = `/api/itunes?artist=${encodeURIComponent(hint.artist)}&album=${encodeURIComponent(hint.album)}&country=${hint.country}`;
  }
  if (!url) return null;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`itunes ${response.status}`);
  const data = await response.json();
  const tracks = Array.isArray(data?.tracks) ? data.tracks : [];
  albumTracksCache.set(album.file, tracks);
  return tracks;
}

// 正在播放展开区（#92b）：有曲目 → 面板底部展开（is-open），停止/ended/切专辑重置 → 收起；
// 文本与列表 track-active 高亮同步
function setNowPlaying(trackName) {
  nowPlayingTrack = trackName || "";
  if (albumPanelNowTrack) {
    albumPanelNowTrack.textContent = nowPlayingTrack;
    // #93 项1：胶囊与按钮区同宽，长曲名省略时给原生 tooltip 兜底
    albumPanelNowTrack.title = nowPlayingTrack;
  }
  if (albumPanelNow) albumPanelNow.classList.toggle("is-open", !!nowPlayingTrack);
  if (albumPanelTracks) {
    for (const li of albumPanelTracks.children) {
      const name = li.querySelector(".track-name")?.textContent;
      li.classList.toggle("track-active", !!nowPlayingTrack && name === nowPlayingTrack);
    }
  }
}

// #91 面板渲染：专辑名/艺术家同步（本地数据，始终可用），曲目列表异步补全。
// panelSession 代际防串：快速连点两张专辑时，慢响应不得覆盖新选中专辑的面板。
// #92：标题/艺术家写入 .ap-line 并同步 data-text（marquee ::after 用），换专辑时
// 移除残留的 marquee 类；曲目落地后刷一次 updatePreviewMeta（修 Unavailable 误报）。
function renderAlbumPanel(album) {
  const session = ++panelSession;
  nowPlayingTrack = "";
  if (albumPanelNow) albumPanelNow.classList.remove("is-open");
  if (albumPanelTitleLine) {
    albumPanelTitleLine.textContent = album.title;
    albumPanelTitleLine.dataset.text = album.title;
    albumPanelTitleLine.classList.remove("ap-marquee");
  }
  if (albumPanelArtistLine) {
    albumPanelArtistLine.textContent = album.artist;
    albumPanelArtistLine.dataset.text = album.artist;
    albumPanelArtistLine.classList.remove("ap-marquee");
  }
  if (!albumPanelTracks) return;
  albumPanelTracks.replaceChildren();
  const loading = document.createElement("li");
  loading.className = "track-state";
  loading.textContent = "Loading tracks…";
  albumPanelTracks.appendChild(loading);

  fetchAlbumTracks(album).then((tracks) => {
    if (session !== panelSession) return;
    albumPanelTracks.replaceChildren();
    if (!tracks || tracks.length === 0) {
      const state = document.createElement("li");
      state.className = "track-state";
      state.textContent = tracks ? "No track list available" : "Track list unavailable";
      albumPanelTracks.appendChild(state);
      updatePreviewMeta();
      return;
    }
    for (const track of tracks) {
      const li = document.createElement("li");
      const no = document.createElement("span");
      no.className = "track-no";
      no.textContent = track.trackNumber || "";
      const name = document.createElement("span");
      name.className = "track-name";
      name.textContent = track.trackName;
      name.dataset.text = track.trackName;
      li.append(no, name);
      if (track.previewUrl) {
        // 有试听：可点播放；再次点击同一首则停止
        li.classList.add("track-playable");
        li.addEventListener("click", () => {
          if (previewPlaying && nowPlayingTrack === track.trackName) {
            stopPreview();
            return;
          }
          playCurrentPreview({ override: { previewUrl: track.previewUrl, trackName: track.trackName } });
        });
      } else {
        // 无试听：列表照常展示，禁用播放态（悬停 title 说明）
        li.classList.add("track-muted");
        li.title = "No preview available";
      }
      albumPanelTracks.appendChild(li);
    }
    // #92 曲目落地（含拉到的 previewUrl）后刷新播放按钮可用性：
    // 无本地试听的专辑此刻从 Unavailable 翻转为 Play preview
    updatePreviewMeta();
  }).catch(() => {
    if (session !== panelSession) return;
    albumPanelTracks.replaceChildren();
    const state = document.createElement("li");
    state.className = "track-state";
    state.textContent = "Track list unavailable";
    albumPanelTracks.appendChild(state);
  });
}

function easeInOutCubic(progress) {
  return progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;
}

function fadePreviewVolume(targetVolume, duration = 520) {
  const token = ++audioFadeToken;
  const initialVolume = previewAudio.volume;
  const start = performance.now();

  if (audioFadeFrame) cancelAnimationFrame(audioFadeFrame);

  return new Promise((resolve) => {
    function step(now) {
      if (token !== audioFadeToken) { resolve(false); return; }
      const progress = Math.min(1, (now - start) / duration);
      const eased = easeInOutCubic(progress);
      // #91 验证发现：浮点极限下表达式可产生 -4.17e-7 这类越界微值，
      // Chrome 对 volume 赋值越界抛 IndexSizeError（未捕获→console 报错），钳到 [0,1]
      previewAudio.volume = Math.min(1, Math.max(0, initialVolume + (targetVolume - initialVolume) * eased));
      if (progress < 1) { audioFadeFrame = requestAnimationFrame(step); return; }
      resolve(true);
    }
    audioFadeFrame = requestAnimationFrame(step);
  });
}

function setPreviewTransitioning(nextTransitioning) {
  previewTransitioning = nextTransitioning;
  playButton.classList.toggle("is-transitioning", previewTransitioning);
}

function duckPreviewForSelection() {
  if (!previewPlaying || previewAudio.paused) return false;
  setPreviewTransitioning(true);
  setPreviewPlaying(true, "Switching preview");
  fadePreviewVolume(DUCKED_VOLUME, PREVIEW_DUCK_MS);
  return true;
}

function setPreviewPlaying(nextPlaying, label = nextPlaying ? "Pause preview" : "Play preview") {
  previewPlaying = nextPlaying;
  playButton.classList.toggle("is-playing", previewPlaying);
  playButton.setAttribute("aria-pressed", String(previewPlaying));
  playLabel.textContent = label;
}

function updatePreviewMeta() {
  const preview = getCurrentPreview();
  const hasPreview = Boolean(preview?.previewUrl);
  playButton.disabled = !hasPreview;
  if (!previewPlaying) {
    playLabel.textContent = hasPreview ? "Play preview" : "Unavailable";
    playButton.setAttribute("aria-pressed", "false");
    playButton.classList.remove("is-playing");
  }
}

function stopPreview() {
  previewSession += 1;
  audioFadeToken += 1;
  setPreviewTransitioning(false);
  previewAudio.pause();
  previewAudio.currentTime = 0;
  previewAudio.volume = PREVIEW_VOLUME;
  setPreviewPlaying(false);
  updatePreviewMeta();
  setNowPlaying("");
}

async function playCurrentPreview({ fromTransition = false, override = null } = {}) {
  // #91：override 为曲目列表点击的逐曲播放（previewUrl + trackName），
  // 无 override 时保持原有行为（播放专辑默认试听曲）
  const preview = override || getCurrentPreview();
  if (!preview?.previewUrl) { setPreviewTransitioning(false); updatePreviewMeta(); return; }

  const session = ++previewSession;
  if (previewAudio.src !== preview.previewUrl) previewAudio.src = preview.previewUrl;

  setPreviewTransitioning(fromTransition);
  setPreviewPlaying(true, fromTransition ? "Fading in" : "Loading preview");
  // 目标曲目立即上屏（加载/淡入期间即显示，失败时收敛清空）
  setNowPlaying(preview.trackName || "");

  try {
    previewAudio.currentTime = 0;
    previewAudio.volume = fromTransition ? Math.min(previewAudio.volume, DUCKED_VOLUME) : 0;
    await previewAudio.play();
    setPreviewPlaying(true, fromTransition ? "Fading in" : "Pause preview");
    const fadeCompleted = await fadePreviewVolume(PREVIEW_VOLUME, fromTransition ? PREVIEW_FADE_IN_MS : 620);
    if (session === previewSession && fadeCompleted) {
      setPreviewTransitioning(false);
      setPreviewPlaying(true);
    }
  } catch (error) {
    if (session !== previewSession) return;
    previewAudio.volume = PREVIEW_VOLUME;
    setPreviewTransitioning(false);
    setPreviewPlaying(false, "Try again");
    playButton.classList.remove("is-playing");
    setNowPlaying("");
  }
}

playButton.addEventListener("click", () => {
  if (previewPlaying) { stopPreview(); return; }
  playCurrentPreview();
});

// Gk3Clone 持久化 iframe 常驻 DOM：浮层关闭时 iframe 仅切回 0x0 隐藏不卸载，
// 外层通过 postMessage 通知停掉预览音频，避免音频在隐藏 iframe 内继续播放。
window.addEventListener("message", (event) => {
  if (event.data === "arc-vinyl:pause-preview") stopPreview();
});

previewAudio.addEventListener("ended", () => {
  previewSession += 1;
  setPreviewTransitioning(false);
  previewAudio.volume = PREVIEW_VOLUME;
  setPreviewPlaying(false);
  updatePreviewMeta();
  setNowPlaying("");
});

previewAudio.addEventListener("error", () => {
  previewSession += 1;
  setPreviewTransitioning(false);
  setPreviewPlaying(false, "Preview unavailable");
  playButton.classList.remove("is-playing");
  setNowPlaying("");
});

function selectAlbum(album, sourceImage, card) {
  if (isSameAlbum(album, selectedAlbum)) return;
  const shouldTransitionPreview = selectedAlbum !== album && duckPreviewForSelection();
  const transitionId = ++selectionTransitionId;

  const from = sourceImage.getBoundingClientRect();
  const to = focusImage.getBoundingClientRect();

  if (prefersReducedMotion || from.width === 0 || to.width === 0) {
    setFocusAlbum(album, {
      transitionPreview: shouldTransitionPreview,
      colors: card?.colors || null,
    });
    return;
  }

  focus.classList.add("is-swapping");
  startSelectionFlight({
    album,
    sourceImage,
    card,
    from,
    to,
    transitionId,
    shouldTransitionPreview,
  });
}

function disposeSelectionFlight() {
  if (!activeSelectionFlight) return;
  if (activeSelectionFlight.mesh) disposeCDCase(activeSelectionFlight.mesh);
  if (activeSelectionFlight.sourceMesh && activeSelectionFlight.restoreSourceMesh) {
    activeSelectionFlight.sourceMesh.visible = true;
  }
  activeSelectionFlight = null;
}

function startSelectionFlight({
  album,
  sourceImage,
  card,
  from,
  to,
  transitionId,
  shouldTransitionPreview,
}) {
  disposeSelectionFlight();
  if (focusMesh) focusMesh.visible = false;

  const sourceMesh = card?.mesh || null;
  const mesh = sourceMesh
    ? sourceMesh.clone()
    : createCDCase(album, sourceImage, 1, card?.colors || null);
  // clone() 会连 userData 一并复制，必须显式改回：飞行盒子的资源归源卡片所有
  mesh.userData.ownsResources = !sourceMesh;
  const sourceCenter = {
    x: from.left + from.width / 2,
    y: from.top + from.height / 2,
  };
  const targetCenter = {
    x: to.left + to.width / 2,
    y: to.top + to.height / 2,
  };
  const fromZ = card?.currentStackZ || CARD_STACK_MIN_Z + CARD_STACK_RANGE_Z * 0.5;
  const targetYaw = sourceCenter.x < window.innerWidth / 2 ? 18 : -18;
  const targetPitch = sourceCenter.y < window.innerHeight / 2 ? -6 : 6;

  if (sourceMesh) {
    mesh.position.copy(sourceMesh.position);
    mesh.rotation.copy(sourceMesh.rotation);
    mesh.scale.copy(sourceMesh.scale);
    sourceMesh.visible = false;
  } else {
    mesh.position.copy(screenToWorld(sourceCenter.x, sourceCenter.y, fromZ));
    mesh.rotation.set(
      THREE.MathUtils.degToRad(card?.currentCasePitch || 0),
      THREE.MathUtils.degToRad(card?.currentCaseYaw || targetYaw),
      THREE.MathUtils.degToRad(card?.currentRotation || 0)
    );
    mesh.scale.setScalar(from.width * worldUnitsPerPixelAtZ(fromZ));
  }

  mesh.renderOrder = 3000;
  scene.add(mesh);

  activeSelectionFlight = {
    album,
    sourceImage,
    colors: card?.colors || null,
    sourceMesh,
    mesh,
    restoreSourceMesh: true,
    startTime: performance.now(),
    duration: 1040,
    transitionId,
    shouldTransitionPreview,
    sourceCenter,
    targetCenter,
    startWidth: from.width,
    targetWidth: to.width,
    startZ: fromZ,
    liftZ: FOCUS_STACK_Z + 0.9,
    targetZ: FOCUS_STACK_Z,
    startRotation: {
      x: mesh.rotation.x,
      y: mesh.rotation.y,
      z: mesh.rotation.z,
    },
    targetRotation: {
      x: THREE.MathUtils.degToRad(targetPitch),
      y: THREE.MathUtils.degToRad(targetYaw),
      z: 0,
    },
    targetTilt: {
      x: targetPitch,
      y: targetYaw,
    },
  };
}

function updateSelectionFlight(time) {
  if (!activeSelectionFlight) return;

  const flight = activeSelectionFlight;
  const raw = Math.min(1, (time - flight.startTime) / flight.duration);
  const eased = easeInOutCubic(raw);
  const arc = Math.sin(Math.PI * raw);
  const centerX = lerp(flight.sourceCenter.x, flight.targetCenter.x, eased);
  const centerY = lerp(flight.sourceCenter.y, flight.targetCenter.y, eased) - arc * 54;
  const z = lerp(flight.startZ, flight.targetZ, eased) + arc * (flight.liftZ - flight.targetZ);
  const pixelWidth = lerp(flight.startWidth, flight.targetWidth, eased);

  flight.mesh.position.copy(screenToWorld(centerX, centerY, z));
  flight.mesh.scale.setScalar(pixelWidth * worldUnitsPerPixelAtZ(z));
  flight.mesh.rotation.x = lerp(flight.startRotation.x, flight.targetRotation.x, eased);
  flight.mesh.rotation.y = lerp(flight.startRotation.y, flight.targetRotation.y, eased);
  flight.mesh.rotation.z = lerp(flight.startRotation.z, flight.targetRotation.z, eased);

  if (raw < 1) return;

  if (flight.transitionId === selectionTransitionId) {
    pointer.tiltRx = flight.targetTilt.x;
    pointer.targetTiltRx = flight.targetTilt.x;
    pointer.tiltRy = flight.targetTilt.y;
    pointer.targetTiltRy = flight.targetTilt.y;
    selectedAlbum = flight.album;
    focusImage.src = flight.album.file;
    focusImage.alt = `${flight.album.title} album cover`;
    updatePreviewMeta();
    renderAlbumPanel(flight.album);
    if (focusMesh) disposeCDCase(focusMesh);
    focusMesh = flight.mesh;
    focusMesh.visible = true;
    focusMesh.renderOrder = 2000;
    flight.mesh = null;
    if (flight.shouldTransitionPreview) {
      playCurrentPreview({ fromTransition: true });
    }
    focus.classList.remove("is-swapping");
  }

  disposeSelectionFlight();
}

function positionCard(card, lane, width, height) {
  const isMobile = width < 700;
  const isNarrow = width < 860;
  const travelPad = isMobile ? Math.max(96, width * 0.14) : Math.max(160, width * 0.12);
  const baseCoverSize = isMobile ? Math.min(150, Math.max(104, width * 0.31)) : Math.min(240, Math.max(128, width * 0.16));
  const slotWidth = baseCoverSize * 0.86;
  const visibleTrack = width + travelPad * 2;
  const virtualTrack = Math.max(visibleTrack, lane.cards.length * slotWidth);
  let t = card.base + lane.offset * lane.direction;
  t = ((t % 1) + 1) % 1;

  const x = -travelPad + t * virtualTrack;
  const screenT = Math.min(1, Math.max(0, (x + travelPad) / visibleTrack));
  const arc = Math.sin(Math.PI * screenT);
  const curveDirection = lane.name === "top" ? 1 : -1;
  const baseY = lane.name === "top"
    ? height * (isNarrow ? -0.1 : -0.15)
    : height * (isNarrow ? 1.1 : 1.15);
  const amplitude = height * (isNarrow ? 0.28 : 0.28);
  const y = baseY + curveDirection * arc * amplitude + card.lift;

  const dy = curveDirection * amplitude * Math.PI * Math.cos(Math.PI * screenT);
  const dx = visibleTrack;
  const tangent = (Math.atan2(dy, dx) * 180) / Math.PI;
  const rotation = tangent + card.tilt;
  card.hover += ((card.isPointed ? 1 : 0) - card.hover) * 0.16;
  const scale = 1;
  const lift = card.hover * (lane.name === "top" ? HOVER_Y_SHIFT : -HOVER_Y_SHIFT);
  const caseYaw = (0.5 - screenT) * 28;
  const casePitch = (lane.name === "top" ? -1 : 1) * (1.2 + arc * 2.1);
  const stackProgress = getLaneStackProgress(lane, screenT);
  const stackZ = CARD_STACK_MIN_Z + stackProgress * CARD_STACK_RANGE_Z;

  card.currentRotation = rotation;
  card.currentCasePitch = casePitch;
  card.currentCaseYaw = caseYaw;
  card.currentStackZ = stackZ;
  card.el.classList.toggle("is-hovered", card.hover > 0.35);
  card.el.style.zIndex = String(20 + Math.round(stackProgress * 120));
  card.el.style.transform = `translate3d(${x}px, ${y + lift}px, 0) translate(-50%, -50%) rotate(${rotation}deg) scale(${scale})`;

  if (card.mesh) {
    const centerX = x;
    const centerY = y + lift;
    const worldPos = screenToWorld(centerX, centerY, stackZ);
    card.mesh.position.copy(worldPos);
    card.mesh.renderOrder = Math.round(stackProgress * 1000);
    
    card.mesh.rotation.z = THREE.MathUtils.degToRad(rotation);
    card.mesh.rotation.x = THREE.MathUtils.degToRad(casePitch);
    card.mesh.rotation.y = THREE.MathUtils.degToRad(caseYaw);
    
    const worldPerPixel = worldUnitsPerPixelAtZ(stackZ);
    const worldScale = baseCoverSize * worldPerPixel * scale;
    card.mesh.scale.setScalar(worldScale);
  }
}

function updateFocus() {
  pointer.x += (pointer.targetX - pointer.x) * 0.06;
  pointer.y += (pointer.targetY - pointer.y) * 0.06;
  pointer.scale += (pointer.targetScale - pointer.scale) * 0.08;
  pointer.tiltX += (pointer.targetTiltX - pointer.tiltX) * 0.12;
  pointer.tiltY += (pointer.targetTiltY - pointer.tiltY) * 0.12;
  pointer.tiltRx += (pointer.targetTiltRx - pointer.tiltRx) * 0.12;
  pointer.tiltRy += (pointer.targetTiltRy - pointer.tiltRy) * 0.12;
  pointer.roll += (pointer.targetRoll - pointer.roll) * 0.1;

  if (focusMesh) {
    const focusRect = focus.getBoundingClientRect();
    const centerX = focusRect.left + focusRect.width / 2;
    const centerY = focusRect.top + focusRect.height / 2;
    const worldPos = screenToWorld(centerX + pointer.x, centerY + pointer.y, FOCUS_STACK_Z);
    focusMesh.position.copy(worldPos);
    focusMesh.renderOrder = 2000;
    focusMesh.rotation.x = THREE.MathUtils.degToRad(pointer.tiltRx);
    focusMesh.rotation.y = THREE.MathUtils.degToRad(pointer.tiltRy);
    focusMesh.rotation.z = THREE.MathUtils.degToRad(pointer.roll);
    
    const worldPerPixel = worldUnitsPerPixelAtZ(FOCUS_STACK_Z);
    const focusSize = focusRect.width;
    focusMesh.scale.setScalar(focusSize * worldPerPixel * pointer.scale);
  }
}

function updatePassiveFocusTargets(time) {
  if (prefersReducedMotion) return;

  if (pointer.inFocusRange) {
    pointer.targetScale = 1;
    pointer.targetRoll = 0;
    return;
  }

  if (time >= idleMotion.nextChangeAt) {
    idleMotion.targetX = randomBetween(-6.5, 6.5);
    idleMotion.targetY = randomBetween(-5.2, 5.2);
    idleMotion.targetTiltRx = randomBetween(-1.8, 1.8);
    idleMotion.targetTiltRy = randomBetween(-2.2, 2.2);
    idleMotion.targetRoll = randomBetween(-0.5, 0.5);
    idleMotion.nextChangeAt = time + randomBetween(IDLE_DRIFT_CHANGE_MIN_MS, IDLE_DRIFT_CHANGE_MIN_MS + IDLE_DRIFT_CHANGE_RANGE_MS);
  }

  idleMotion.x += (idleMotion.targetX - idleMotion.x) * 0.016;
  idleMotion.y += (idleMotion.targetY - idleMotion.y) * 0.016;
  idleMotion.tiltRx += (idleMotion.targetTiltRx - idleMotion.tiltRx) * 0.018;
  idleMotion.tiltRy += (idleMotion.targetTiltRy - idleMotion.tiltRy) * 0.018;
  idleMotion.roll += (idleMotion.targetRoll - idleMotion.roll) * 0.02;

  const breath = Math.sin(idleMotion.phase + time * 0.00125);
  const secondaryBreath = Math.sin(idleMotion.phase * 0.41 + time * 0.00082);
  const driftX = idleMotion.x + Math.sin(idleMotion.phase + time * 0.00092) * 1.7;
  const driftY = idleMotion.y + Math.cos(idleMotion.phase * 0.7 + time * 0.00076) * 1.25 - breath * 1.1;

  pointer.targetX = driftX;
  pointer.targetY = driftY;
  pointer.targetScale = 1 + breath * 0.012 + secondaryBreath * 0.0035;
  pointer.targetTiltX = driftX * 0.55;
  pointer.targetTiltY = driftY * 0.55;
  pointer.targetTiltRx = idleMotion.tiltRx + breath * 1.1;
  pointer.targetTiltRy = idleMotion.tiltRy + secondaryBreath * 1.45;
  pointer.targetRoll = idleMotion.roll + Math.sin(idleMotion.phase * 1.7 + time * 0.00064) * 0.22;
  pointer.shineX = 50 + driftX * 3.1 + Math.sin(time * 0.00072) * 2.1;
  pointer.shineY = 42 + driftY * 2.8 + Math.cos(time * 0.00067) * 1.8;
}

function tick(time) {
  const delta = Math.min(42, time - lastTime);
  lastTime = time;
  const width = window.innerWidth;
  const height = window.innerHeight;
  // 0 尺寸守卫：本页被 Gk3Clone 以 0x0 隐藏 iframe 预加载，此时渲染与
  // positionCard 全部无意义却照常消耗 CPU，实测（trace）挤占主线程造成
  // 1~1.8s 停帧 ×6。跳过渲染与卡片定位但续 rAF；
  // iframe 以正常尺寸展示（浮层内实例）时自动恢复完整循环。
  if (width === 0 || height === 0) {
    requestAnimationFrame(tick);
    return;
  }
  const pointedCard = document.elementFromPoint(pointer.clientX, pointer.clientY)?.closest?.(".album-card");

  lanes.forEach((lane) => {
    const laneIsPointed = lane.cards.some((card) => {
      card.isPointed = card.pointerHover || card.el === pointedCard;
      return card.isPointed;
    });

    lane.targetSpeed = laneIsPointed || time < lane.slowUntil ? lane.hoverSpeed : lane.normalSpeed;

    if (!prefersReducedMotion) {
      lane.speed += (lane.targetSpeed - lane.speed) * 0.055;
      lane.offset = (lane.offset + lane.speed * delta) % 1;
    }

    lane.cards.forEach((card) => positionCard(card, lane, width, height));
  });

  updatePassiveFocusTargets(time);
  updateSelectionFlight(time);
  updateFocus();

  renderer.render(scene, camera);
  // #53 init 完成信号：全部 mesh（albums.length 张卡片 + 1 focus）就绪且已经过
  // 至少一次真实渲染（shader 编译与纹理上传在此发生）→ 通知父页面收回 0×0
  if (!readySent && sceneReadyCount >= albums.length + 1) {
    readySent = true;
    window.__arcVinylReady = true;
    try { window.parent.postMessage("arc-vinyl:ready", "*"); } catch (e) { /* 无 parent / 跨域时忽略 */ }
  }
  requestAnimationFrame(tick);
}

window.addEventListener("pointermove", (event) => {
  const focusRect = focus.getBoundingClientRect();
  const centerX = focusRect.left + focusRect.width / 2;
  const centerY = focusRect.top + focusRect.height / 2;
  const rawLocalX = (event.clientX - centerX) / (focusRect.width / 2);
  const rawLocalY = (event.clientY - centerY) / (focusRect.height / 2);
  const localX = Math.min(1, Math.max(-1, rawLocalX));
  const localY = Math.min(1, Math.max(-1, rawLocalY));

  pointer.clientX = event.clientX;
  pointer.clientY = event.clientY;
  pointer.inFocusRange = Math.abs(rawLocalX) <= FOCUS_INTERACTION_RANGE && Math.abs(rawLocalY) <= FOCUS_INTERACTION_RANGE;

  if (!pointer.inFocusRange) return;

  pointer.targetX = localX * 6;
  pointer.targetY = localY * 5;
  pointer.targetScale = 1;
  pointer.targetRoll = 0;
  pointer.targetTiltX = localX * 16;
  pointer.targetTiltY = localY * 14;
  pointer.targetTiltRx = localY * -24;
  pointer.targetTiltRy = localX * 42;
  pointer.shineX = 50 + localX * 30;
  pointer.shineY = 42 + localY * 24;
});

window.addEventListener("pointerleave", () => {
  pointer.clientX = -9999;
  pointer.clientY = -9999;
  pointer.inFocusRange = false;
});

window.addEventListener("keydown", (event) => {
  if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
  const currentIndex = albums.indexOf(selectedAlbum);
  const nextIndex = event.key === "ArrowRight"
    ? (currentIndex + 1) % albums.length
    : (currentIndex - 1 + albums.length) % albums.length;
  const shouldTransitionPreview = duckPreviewForSelection();
  setFocusAlbum(albums[nextIndex], { transitionPreview: shouldTransitionPreview });
});

initThreeJS();
mountLanes();
setFocusAlbum(selectedAlbum);

// #93 项3：首开卡顿预热。CDP trace 量化定位：首次全屏展开 resize→稳定 2.2s、
// 主线程几乎空闲而整体帧率掉到 ~20fps —— 瓶颈在光栅化/解码管线：0×0/1×1 隐藏期
// 卡片 DOM 不在视口内，浏览器不解码封面位图，首次全屏时 30 张 webp 集中解码 +
// 30 个卡片层首次光栅化。decode() 在空闲预载期强制解码进 image cache
// （fire-and-forget），与 mesh init 分帧调度同属 1×1 空闲期，不与用户交互抢主线程。
if ("decode" in HTMLImageElement.prototype) {
  for (const img of document.querySelectorAll(".album-card img")) {
    try { img.decode().catch(() => {}); } catch (e) { /* 解码预热失败不影响主流程 */ }
  }
}

requestAnimationFrame(tick);
