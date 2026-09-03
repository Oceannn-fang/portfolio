'use client';

import './AlbumShowcase.css';

// 专辑封面文件列表（位于 public/music-cover-3d/album_covers/）
const albums = [
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

/**
 * 精选推荐 — viewer 面板内的轻量 2D 弧形专辑循环
 * 纯 CSS 动画（上下两行横向滚动），不使用 iframe / Three.js，避免卡顿。
 * 完整 3D 版本仅在全屏浮层点击时加载（见 Gk3Clone.tsx 的 showcase-overlay）。
 */
export default function AlbumShowcase() {
  const topAlbums = albums.slice(0, 15);
  const bottomAlbums = albums.slice(15);

  return (
    <div className="as-root">
      {/* 上行：向左滚动 */}
      <div className="as-lane as-lane-top">
        <div className="as-track">
          {[...topAlbums, ...topAlbums].map((file, i) => (
            <img
              key={i}
              src={`/music-cover-3d/album_covers/${file}`}
              className="as-cover"
              alt=""
              loading="lazy"
            />
          ))}
        </div>
      </div>
      {/* 下行：向右滚动 */}
      <div className="as-lane as-lane-bottom">
        <div className="as-track as-track-reverse">
          {[...bottomAlbums, ...bottomAlbums].map((file, i) => (
            <img
              key={i}
              src={`/music-cover-3d/album_covers/${file}`}
              className="as-cover"
              alt=""
              loading="lazy"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
