export type FilmFrame = {
  id: string;
  index: number;
  /** 灯箱大图：web 衍生图（长边 2000px / q82），单张 0.15-0.47MB */
  src: string;
  thumb: string;
  title: string;
};

export type FilmRoll = {
  id: string;
  rollNumber: number;
  title: string;
  shotDate: string;
  film?: string;
  format: '35mm' | '120';
  iso?: number;
  type: 'color' | 'bw';
  camera?: string;
  location?: string;
  note?: string;
  frames: FilmFrame[];
};

const scannedFrameNumbers = [
  ...Array.from({ length: 6 }, (_, index) => String(index + 1).padStart(6, "0")),
  ...Array.from({ length: 34 }, (_, index) => String(index + 41).padStart(6, "0")),
];

const scannedFrames: FilmFrame[] = scannedFrameNumbers.map((number, index) => ({
  id: `roll-017-frame-${number}`,
  index: index + 1,
  // 大图走 web 衍生图（长边 2000 / q82），由 scripts/_film-web-20261015/make-sample.py 生成；
  // 原始扫描件仍在 /images/film/roll-017/<number>.jpg（4556x3047、单张 7-20MB），不再由页面加载
  src: `/images/film/roll-017/web/${number}.jpg`,
  thumb: `/images/film/roll-017/thumbs/${number}.webp`,
  title: `Frame ${String(index + 1).padStart(2, "0")}`,
}));

const rawFilmRolls: FilmRoll[] = [
  {
    id: "roll-017",
    rollNumber: 17,
    title: "September 30, 2026",
    shotDate: "2026-09-30",
    format: "35mm",
    type: "color",
    frames: scannedFrames,
  },
];

export const filmRolls = [...rawFilmRolls].sort((a, b) => b.shotDate.localeCompare(a.shotDate));

export const findFilmRoll = (id: string) => filmRolls.find((roll) => roll.id === id);









