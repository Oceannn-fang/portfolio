/**
 * 作品集图片数据
 * 对应 public/images/portfolio/ 下的作品图（使用中文/日文/韩文原文件名，
 * 不含旧的拼音重名版本）。按修改时间倒序排列（最新在前）。
 * #62：英文标题统一标准 Title Case（虚词 it/was/a/the/of/for/in/on 小写）；
 * 用户拍板 be→Be、自行人→Mercei、Ant From Up There→Concorde（画面单曲名），id 同步联动。
 */

export interface PortfolioWork {
  id: string;
  title: string;
  /** 原图路径，如 /images/portfolio/xxx.png（1080×1920 无损 PNG，单张 3-6MB；仅作兜底，勿直接用于展示） */
  image: string;
  /**
   * 单图模式与放大浮层用的 WebP 衍生图（1080×1920 q82，单张约 270KB）。
   * 生成：portfolio-perf_20261019_v1/make-portfolio-web.py；缺失时回退 image（旧条目/新接入未转码时仍可显示）
   */
  imageWeb?: string;
  /** 缩略图路径，如 /images/portfolio-thumbs/xxx.webp（DriftWall tile 使用，240×428） */
  thumb: string;
  /** ISO 日期 */
  date: string;
}

export const portfolioWorks: PortfolioWork[] = [
  { id: 'carmen', title: 'Carmen', image: '/images/portfolio/carmen.png', imageWeb: '/images/portfolio/web/carmen.webp', thumb: '/images/portfolio-thumbs/carmen.webp', date: '2026-11-01' },
  { id: 'should', title: '應該', image: '/images/portfolio/應該.png', imageWeb: '/images/portfolio/web/should.webp', thumb: '/images/portfolio-thumbs/should.webp', date: '2026-10-11' },
  { id: 'i-dont-dare-to-be-happy', title: '我連快樂都不敢了', image: '/images/portfolio/我連快樂都不敢了.png', imageWeb: '/images/portfolio/web/i-dont-dare-to-be-happy.webp', thumb: '/images/portfolio-thumbs/i-dont-dare-to-be-happy.webp', date: '2026-10-08' },
  { id: 'life-and-space', title: 'Life & Space', image: '/images/portfolio/Life & space.png', imageWeb: '/images/portfolio/web/life-and-space.webp', thumb: '/images/portfolio-thumbs/life-and-space.webp', date: '2026-09-22' },
  { id: 'theres-something-here-for-us-both', title: 'There’s Something Here for Us Both', image: '/images/portfolio/There’s Something Here for Us Both.png', imageWeb: '/images/portfolio/web/theres-something-here-for-us-both.webp', thumb: '/images/portfolio-thumbs/theres-something-here-for-us-both.webp', date: '2026-09-18' },
  { id: 'wish-it-was-easy', title: 'Wish it Was Easy', image: '/images/portfolio/wish it was easy.png', imageWeb: '/images/portfolio/web/wish-it-was-easy.webp', thumb: '/images/portfolio-thumbs/wish-it-was-easy.webp', date: '2026-09-09' },
  { id: 'i-did-this-i-did-that', title: 'I Did This, I Did That', image: '/images/portfolio/I did this, I did that.png', imageWeb: '/images/portfolio/web/i-did-this-i-did-that.webp', thumb: '/images/portfolio-thumbs/i-did-this-i-did-that.webp', date: '2026-08-25' },
  // 一夜情：date 是存档文件的 mtime（2026-10-13），但作品实际早于此；按用户指定人工排在晚餐見之前
  { id: '一夜情', title: '一夜情', image: '/images/portfolio/一夜情.png', imageWeb: '/images/portfolio/web/一夜情.webp', thumb: '/images/portfolio-thumbs/一夜情.webp', date: '2026-10-13' },
  { id: 'dinner-view', title: '晚餐見', image: '/images/portfolio/晚餐見.png', imageWeb: '/images/portfolio/web/dinner-view.webp', thumb: '/images/portfolio-thumbs/dinner-view.webp', date: '2026-07-24' },
  { id: 'a-hundred-lives', title: '一百種生活', image: '/images/portfolio/一百種生活.png', imageWeb: '/images/portfolio/web/a-hundred-lives.webp', thumb: '/images/portfolio-thumbs/a-hundred-lives.webp', date: '2026-06-15' },
  { id: 'conveni', title: 'Conveni', image: '/images/portfolio/conveni.png', imageWeb: '/images/portfolio/web/conveni.webp', thumb: '/images/portfolio-thumbs/conveni.webp', date: '2026-06-12' },
  { id: 'expired', title: '過期', image: '/images/portfolio/过期.png', imageWeb: '/images/portfolio/web/expired.webp', thumb: '/images/portfolio-thumbs/expired.webp', date: '2026-06-01' },
  { id: 'flower-blooming-in-joy', title: '悦びに咲く花', image: '/images/portfolio/悦びに咲く花.png', imageWeb: '/images/portfolio/web/flower-blooming-in-joy.webp', thumb: '/images/portfolio-thumbs/flower-blooming-in-joy.webp', date: '2026-05-26' },
  { id: 'burn-dance-extinguish', title: '燒起來、舞蹈、澆滅', image: '/images/portfolio/烧起来、舞蹈、浇灭.png', imageWeb: '/images/portfolio/web/burn-dance-extinguish.webp', thumb: '/images/portfolio-thumbs/burn-dance-extinguish.webp', date: '2026-04-30' },
  { id: 'taurus', title: 'Taurus', image: '/images/portfolio/Taurus.png', imageWeb: '/images/portfolio/web/taurus.webp', thumb: '/images/portfolio-thumbs/taurus.webp', date: '2026-03-29' },
  { id: 'past-days-remain', title: '지난 날은 영원히 혼수로 남아', image: '/images/portfolio/지난 날은 영원히 혼수로 남아.png', imageWeb: '/images/portfolio/web/past-days-remain.webp', thumb: '/images/portfolio-thumbs/past-days-remain.webp', date: '2026-03-15' },
  { id: 'illegal', title: 'Illegal', image: '/images/portfolio/Illegal.png', imageWeb: '/images/portfolio/web/illegal.webp', thumb: '/images/portfolio-thumbs/illegal.webp', date: '2026-03-09' },
  { id: 'typewrite-lesson', title: 'Typewrite Lesson', image: '/images/portfolio/Typewrite Lesson.png', imageWeb: '/images/portfolio/web/typewrite-lesson.webp', thumb: '/images/portfolio-thumbs/typewrite-lesson.webp', date: '2026-01-17' },
  { id: 'hair-cut-re-make', title: 'Hair Cut Re Make', image: '/images/portfolio/hair cut re make.png', imageWeb: '/images/portfolio/web/hair-cut-re-make.webp', thumb: '/images/portfolio-thumbs/hair-cut-re-make.webp', date: '2025-12-29' },
  { id: 'braincells', title: 'Braincells', image: '/images/portfolio/braincells.png', imageWeb: '/images/portfolio/web/braincells.webp', thumb: '/images/portfolio-thumbs/braincells.webp', date: '2025-12-14' },
  { id: 'racing-mount-pleasant', title: 'Racing Mount Pleasant', image: '/images/portfolio/Racing Mount Pleasant.png', imageWeb: '/images/portfolio/web/racing-mount-pleasant.webp', thumb: '/images/portfolio-thumbs/racing-mount-pleasant.webp', date: '2025-11-01' },
  { id: 'just-stand-there', title: 'Just Stand There', image: '/images/portfolio/just stand there.png', imageWeb: '/images/portfolio/web/just-stand-there.webp', thumb: '/images/portfolio-thumbs/just-stand-there.webp', date: '2025-10-18' },
  { id: 'minuet', title: '小步舞曲', image: '/images/portfolio/小步舞曲.png', imageWeb: '/images/portfolio/web/minuet.webp', thumb: '/images/portfolio-thumbs/minuet.webp', date: '2025-10-12' },
  { id: 'mingming', title: '明明', image: '/images/portfolio/明明.png', imageWeb: '/images/portfolio/web/mingming.webp', thumb: '/images/portfolio-thumbs/mingming.webp', date: '2025-10-08' },
  { id: 'vienna', title: 'Vienna', image: '/images/portfolio/Vienna.png', imageWeb: '/images/portfolio/web/vienna.webp', thumb: '/images/portfolio-thumbs/vienna.webp', date: '2025-09-10' },
  { id: 'when-i-get-home', title: 'When I Get Home', image: '/images/portfolio/when i get home.png', imageWeb: '/images/portfolio/web/when-i-get-home.webp', thumb: '/images/portfolio-thumbs/when-i-get-home.webp', date: '2025-07-26' },
  { id: 'heal-me-good', title: 'Heal Me Good', image: '/images/portfolio/heal me good.png', imageWeb: '/images/portfolio/web/heal-me-good.webp', thumb: '/images/portfolio-thumbs/heal-me-good.webp', date: '2025-07-03' },
  { id: 'piano', title: 'Piano', image: '/images/portfolio/piano.png', imageWeb: '/images/portfolio/web/piano.webp', thumb: '/images/portfolio-thumbs/piano.webp', date: '2025-06-22' },
  { id: '25-never-stop', title: '25歲永不停下', image: '/images/portfolio/25歲永不停下.png', imageWeb: '/images/portfolio/web/25-never-stop.webp', thumb: '/images/portfolio-thumbs/25-never-stop.webp', date: '2025-06-22' },
  { id: 'be', title: 'Be', image: '/images/portfolio/be.png', imageWeb: '/images/portfolio/web/be.webp', thumb: '/images/portfolio-thumbs/be.webp', date: '2025-05-29' },
  { id: 'stairs', title: '臺階', image: '/images/portfolio/台阶.png', imageWeb: '/images/portfolio/web/stairs.webp', thumb: '/images/portfolio-thumbs/stairs.webp', date: '2025-05-25' },
  { id: 'mercei', title: 'Mercei', image: '/images/portfolio/自行人.png', imageWeb: '/images/portfolio/web/mercei.webp', thumb: '/images/portfolio-thumbs/pedestrian.webp', date: '2025-05-25' },
  { id: 'moonlight', title: '月光 Moonlight', image: '/images/portfolio/月光 moonlight.png', imageWeb: '/images/portfolio/web/moonlight.webp', thumb: '/images/portfolio-thumbs/moonlight.webp', date: '2025-05-25' },
  { id: 'concorde', title: 'Concorde', image: '/images/portfolio/Ant From Up There.png', imageWeb: '/images/portfolio/web/concorde.webp', thumb: '/images/portfolio-thumbs/ant-from-up-there.webp', date: '2025-05-25' },
  { id: 'pictures-of-us', title: 'Pictures of Us', image: '/images/portfolio/pictures of us.png', imageWeb: '/images/portfolio/web/pictures-of-us.webp', thumb: '/images/portfolio-thumbs/pictures-of-us.webp', date: '2025-05-25' },
  { id: 'driveslow-intro', title: 'Driveslow Intro', image: '/images/portfolio/driveslow intro.png', imageWeb: '/images/portfolio/web/driveslow-intro.webp', thumb: '/images/portfolio-thumbs/driveslow-intro.webp', date: '2025-05-25' },
  { id: 'a-speck-of-dust', title: '一顆灰塵', image: '/images/portfolio/一顆灰塵.png', imageWeb: '/images/portfolio/web/a-speck-of-dust.webp', thumb: '/images/portfolio-thumbs/a-speck-of-dust.webp', date: '2025-05-24' },
  { id: 'tide', title: 'Tide', image: '/images/portfolio/tide.png', imageWeb: '/images/portfolio/web/tide.webp', thumb: '/images/portfolio-thumbs/tide.webp', date: '2025-05-24' },
  { id: 'orange-moon', title: 'Orange Moon', image: '/images/portfolio/orange moon.png', imageWeb: '/images/portfolio/web/orange-moon.webp', thumb: '/images/portfolio-thumbs/orange-moon.webp', date: '2025-03-02' },
];
