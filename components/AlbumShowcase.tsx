'use client';

import { useRef, useEffect, useCallback } from 'react';
import './AlbumShowcase.css';

interface Props {
  onOpenOverlay?: () => void;
}

// 专辑封面文件列表（位于 public/music-cover-3d/album_covers/）
const albumFiles = [
  '01_the_beatles_abbey_road_2019_mix.jpg',
  '02_pink_floyd_the_dark_side_of_the_moon.jpg',
  '03_nirvana_nevermind.jpg',
  '04_michael_jackson_thriller.jpg',
  '05_fleetwood_mac_rumours.jpg',
  '06_david_bowie_the_rise_and_fall_of_ziggy_stardust_and_the_spiders_from_mars_2012_remaster.jpg',
  '07_the_velvet_underground_and_nico_the_velvet_underground_and_nico_45th_anniversary_edition.jpg',
  '08_radiohead_ok_computer.jpg',
  '09_prince_and_the_revolution_purple_rain.jpg',
  '10_kanye_west_my_beautiful_dark_twisted_fantasy.jpg',
  '11_kendrick_lamar_good_kid_m_a_a_d_city.jpg',
  '12_lauryn_hill_the_miseducation_of_lauryn_hill.jpg',
  '13_miles_davis_kind_of_blue.jpg',
  '14_john_coltrane_a_love_supreme.jpg',
  '15_daft_punk_discovery.jpg',
  '16_beyonc_lemonade.jpg',
  '17_taylor_swift_1989.jpg',
  '18_billie_eilish_when_we_all_fall_asleep_where_do_we_go.jpg',
  '19_amy_winehouse_back_to_black.jpg',
  '20_adele_21.jpg',
  '21_arctic_monkeys_am.jpg',
  '22_the_strokes_is_this_it.jpg',
  '23_the_clash_london_calling_expanded_edition.jpg',
  '24_joy_division_unknown_pleasures_2019_digital_master.jpg',
  '25_metallica_master_of_puppets_expanded_edition.jpg',
  '26_ac_dc_back_in_black.jpg',
  '27_bob_dylan_highway_61_revisited.jpg',
  '28_joni_mitchell_blue.jpg',
  '29_marvin_gaye_what_s_going_on.jpg',
  '30_stevie_wonder_songs_in_the_key_of_life.jpg',
];

// 上行取前 15，下行取后 15
const topAlbums = albumFiles.slice(0, 15);
const bottomAlbums = albumFiles.slice(15);

/**
 * 精选推荐 — viewer 面板内的 2D 弧形专辑循环
 * 使用 requestAnimationFrame + ref 直接操作 DOM style，避免 React re-render。
 * 弧形效果复刻原版 music-cover-3d 的 sin 曲线 Y 偏移。
 */
export default function AlbumShowcase({ onOpenOverlay }: Props) {
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
    if (!container) return;

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
  }, []);

  return (
    <div className="as-root" ref={containerRef}>
      {/* 上行封面 */}
      {topAlbums.map((file, i) => (
        <img
          key={`t-${file}`}
          ref={setCoverRef(i)}
          src={`/music-cover-3d/album_covers/${file}`}
          className="as-cover"
          alt=""
          loading="lazy"
        />
      ))}
      {/* 下行封面 */}
      {bottomAlbums.map((file, i) => (
        <img
          key={`b-${file}`}
          ref={setCoverRef(topAlbums.length + i)}
          src={`/music-cover-3d/album_covers/${file}`}
          className="as-cover"
          alt=""
          loading="lazy"
        />
      ))}
      {/* 中央按钮 */}
      <button className="as-cta" onClick={onOpenOverlay} type="button">
        点击进入交互
      </button>
    </div>
  );
}
