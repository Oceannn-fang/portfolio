'use client';

import { useRef, useEffect, useCallback } from 'react';
import './AlbumShowcase.css';

interface Props {
  onOpenOverlay?: () => void;
  /** 加载动画未结束时置 true：不渲染封面（零请求零解码）且不启动 rAF，动画在 loadingDone 后再起跑 */
  paused?: boolean;
}

// 专辑封面文件列表（480×480 WebP，位于 public/music-cover-3d/album_covers_webp/，
// 与 script.js albums[].file、album_previews.js key 三方共用同一 URL，
// warm 预解码后 JSX img / iframe 内 three.js 纹理命中同一 HTTP 缓存）
const albumFiles = [
  '01_frank_ocean_blonde.webp',
  '02_lu1_blue.webp',
  '03_black_country_new_road_ants_from_up_there.webp',
  '04_radiohead_in_rainbows.webp',
  '05_sun_shengxi_chu_mo_di_dai.webp',
  '06_zhang_xingchan_no_no.webp',
  '07_cornelius_fantasma.webp',
  '08_newjeans_supernatural.webp',
  '09_tomcbumpz_comfortable_silence.webp',
  '10_sweet_trip_velocity_design_comfort.webp',
  '11_shiina_ringos_shouso_strip.webp',
  '12_portishead_roseland_nyc_live.webp',
  '13_waa_wei_you_ya_de_ci_wei.webp',
  '14_toe_the_book_about_my_idle_plot_on_a_vague_anxiety.webp',
  '15_sampha_lahai.webp',
  '16_tyler_the_creator_igor.webp',
  '17_stereolab_dots_and_loops.webp',
  '18_aphex_twin_richard_d_james_album.webp',
  '19_oh_yoko_i_love_you.webp',
  '20_sunahara_yoshinori_the_sound_of_70s.webp',
  '21_aco_absolute_ego.webp',
  '22_fred_again_ten_days.webp',
  '23_caroline_caroline_2.webp',
  '24_fayzz_days_gone.webp',
  '25_the_strokes_is_this_it.webp',
  '26_biao_qing_yin_hang_hei_dao.webp',
  '27_lu1_wu_ye_lie_che_shang_de_gao_bie.webp',
  '28_frank_ocean_channel_orange.webp',
  '29_cheer_chen_ji_ta_shou.webp',
  '30_ciacia_ta_de_fa_guang_yao_bai.webp',
];

// 上行取前 15，下行取后 15
const topAlbums = albumFiles.slice(0, 15);
const bottomAlbums = albumFiles.slice(15);

// 已预解码的封面集合（模块级，viewer 反复开关/多次访问会话内只解一次）
const warmedCovers = new Set<string>();
let warmingCovers = false;

/**
 * 空闲预解码专辑封面：由 Gk3Clone 在 loadingDone 后调用。
 * viewer 挂载时 30 张封面同帧解码是加载动画结束后 hover arc vinyl 卡顿的主因
 * （trace 实测 decode 19-23 次 / 195-307ms），提前用 img.decode() 把解码摊到空闲期。
 * 串行 + 间隔执行，避免预解码自身形成长任务。
 */
export function warmAlbumCovers() {
  if (warmingCovers) return;
  const pending = albumFiles.filter((file) => !warmedCovers.has(file));
  if (pending.length === 0) return;
  warmingCovers = true;
  const decodeNext = (index: number) => {
    if (index >= pending.length) {
      warmingCovers = false;
      return;
    }
    const file = pending[index];
    const img = new Image();
    img.src = `/music-cover-3d/album_covers_webp/${file}`;
    img.decode()
      .then(() => {
        warmedCovers.add(file);
      })
      .catch(() => {
        // 解码失败（网络/加载错误）不重试，viewer 挂载时由浏览器正常加载
      })
      .finally(() => {
        setTimeout(() => decodeNext(index + 1), 50);
      });
  };
  decodeNext(0);
}

/**
 * 精选推荐 — viewer 面板内的 2D 弧形专辑循环
 * 使用 requestAnimationFrame + ref 直接操作 DOM style，避免 React re-render。
 * 弧形效果复刻原版 music-cover-3d 的 sin 曲线 Y 偏移。
 */
export default function AlbumShowcase({ onOpenOverlay, paused = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const coverRefs = useRef<(HTMLImageElement | null)[]>([]);
  const rafRef = useRef(0);
  const offsetRef = useRef(0);
  const lastTimeRef = useRef(0);

  // 设置 ref 回调
  const setCoverRef = useCallback((index: number) => (el: HTMLImageElement | null) => {
    coverRefs.current[index] = el;
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    // 加载动画期间降级：不启动 rAF（面板壳可显示，动画 loadingDone 后再起跑）
    if (!container || paused) return;

    // 与原版一致的参数（封面尺寸调回原版 72，需与 CSS .as-cover 尺寸一致）
    const coverSize = 72;
    const slotWidth = coverSize * 0.9;
    const topCount = topAlbums.length;
    const bottomCount = bottomAlbums.length;
    // 速度：每毫秒归一化偏移量，与原版一致（top 0.000018 / bottom 0.000015）
    const topSpeed = 0.000018;
    const bottomSpeed = 0.000015;

    // 与原版一致的 per-card 随机抖动，避免排列过于整齐
    const liftOf = (index: number) => (((index * 37) % 21) - 10) * 0.18;
    const tiltOf = (index: number) => ((index * 43) % 18) - 9;

    const tick = (time: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = time;
      const delta = Math.min(time - lastTimeRef.current, 50); // 限制最大帧间隔
      lastTimeRef.current = time;

      offsetRef.current += delta;

      const width = container.clientWidth;
      const height = container.clientHeight;
      if (width === 0 || height === 0) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const travelPad = Math.max(80, width * 0.1);
      const visibleTrack = width + travelPad * 2;
      const amplitude = height * 0.26;

      // 上行：baseY 在顶部之上，弧形向下弯曲（与原版一致）
      const topBaseY = height * -0.12;
      // 下行：baseY 在底部之下，弧形向上弯曲
      const bottomBaseY = height * 1.12;

      const topOffset = (offsetRef.current * topSpeed) % 1;
      const bottomOffset = (offsetRef.current * bottomSpeed) % 1;

      // 更新上行封面位置
      for (let i = 0; i < topCount; i++) {
        const el = coverRefs.current[i];
        if (!el) continue;

        const base = i / topCount;
        let t = base - topOffset; // 上行向左滚动
        t = ((t % 1) + 1) % 1;

        const virtualTrack = Math.max(visibleTrack, topCount * slotWidth);
        const x = -travelPad + t * virtualTrack;
        const screenT = Math.min(1, Math.max(0, (x + travelPad) / visibleTrack));
        const arc = Math.sin(Math.PI * screenT);
        const y = topBaseY + arc * amplitude + liftOf(i);

        // 边缘淡出
        const fadeZone = coverSize * 1.5;
        const edgeDist = Math.min(x + travelPad, visibleTrack - (x + travelPad));
        const opacity = Math.max(0, Math.min(1, edgeDist / fadeZone));

        // 中间稍大
        const centerDist = Math.abs(screenT - 0.5) * 2;
        const scale = 1 - centerDist * 0.2;

        el.style.transform = `translate(${x - coverSize / 2}px, ${y - coverSize / 2}px) scale(${scale}) rotate(${tiltOf(i)}deg)`;
        el.style.opacity = String(opacity);
      }

      // 更新下行封面位置（方向相反）
      for (let i = 0; i < bottomCount; i++) {
        const el = coverRefs.current[topCount + i];
        if (!el) continue;

        const base = i / bottomCount;
        let t = base + bottomOffset; // 下行向右滚动（与上行反向）
        t = ((t % 1) + 1) % 1;

        const virtualTrack = Math.max(visibleTrack, bottomCount * slotWidth);
        const x = -travelPad + t * virtualTrack;
        const screenT = Math.min(1, Math.max(0, (x + travelPad) / visibleTrack));
        const arc = Math.sin(Math.PI * screenT);
        const y = bottomBaseY - arc * amplitude + liftOf(topCount + i);

        // 边缘淡出
        const fadeZone = coverSize * 1.5;
        const edgeDist = Math.min(x + travelPad, visibleTrack - (x + travelPad));
        const opacity = Math.max(0, Math.min(1, edgeDist / fadeZone));

        // 中间稍大
        const centerDist = Math.abs(screenT - 0.5) * 2;
        const scale = 1 - centerDist * 0.2;

        el.style.transform = `translate(${x - coverSize / 2}px, ${y - coverSize / 2}px) scale(${scale}) rotate(${tiltOf(topCount + i)}deg)`;
        el.style.opacity = String(opacity);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRef.current);
      lastTimeRef.current = 0;
    };
  }, [paused]);

  return (
    <div className="as-root" ref={containerRef}>
      {/* 上行封面（加载动画期间不渲染，零请求零解码） */}
      {!paused && topAlbums.map((file, i) => (
        <img
          key={`t-${file}`}
          ref={setCoverRef(i)}
          src={`/music-cover-3d/album_covers_webp/${file}`}
          className="as-cover"
          alt=""
          loading="lazy"
          decoding="async"
        />
      ))}
      {/* 下行封面（方向相反） */}
      {!paused && bottomAlbums.map((file, i) => (
        <img
          key={`b-${file}`}
          ref={setCoverRef(topAlbums.length + i)}
          src={`/music-cover-3d/album_covers_webp/${file}`}
          className="as-cover"
          alt=""
          loading="lazy"
          decoding="async"
        />
      ))}
      {/* 中央按钮 */}
      <button className="as-cta" onClick={onOpenOverlay} type="button">
        点击进入交互
      </button>
    </div>
  );
}
