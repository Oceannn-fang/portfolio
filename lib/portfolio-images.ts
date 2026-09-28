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
  /** 图片路径，如 /images/portfolio/xxx.png（单图模式使用原图） */
  image: string;
  /** 缩略图路径，如 /images/portfolio-thumbs/xxx.webp（DriftWall tile 使用，240×428） */
  thumb: string;
  /** ISO 日期 */
  date: string;
}

export const portfolioWorks: PortfolioWork[] = [
  { id: 'theres-something-here-for-us-both', title: 'There’s Something Here for Us Both', image: '/images/portfolio/There’s Something Here for Us Both.png', thumb: '/images/portfolio-thumbs/theres-something-here-for-us-both.webp', date: '2026-09-18' },
  { id: 'wish-it-was-easy', title: 'Wish it Was Easy', image: '/images/portfolio/wish it was easy.png', thumb: '/images/portfolio-thumbs/wish-it-was-easy.webp', date: '2026-09-09' },
  { id: 'i-did-this-i-did-that', title: 'I Did This, I Did That', image: '/images/portfolio/I did this, I did that.png', thumb: '/images/portfolio-thumbs/i-did-this-i-did-that.webp', date: '2026-08-25' },
  { id: 'dinner-view', title: '晚餐見', image: '/images/portfolio/晚餐見.png', thumb: '/images/portfolio-thumbs/dinner-view.webp', date: '2026-07-24' },
  { id: 'a-hundred-lives', title: '一百種生活', image: '/images/portfolio/一百種生活.png', thumb: '/images/portfolio-thumbs/a-hundred-lives.webp', date: '2026-06-15' },
  { id: 'conveni', title: 'Conveni', image: '/images/portfolio/conveni.png', thumb: '/images/portfolio-thumbs/conveni.webp', date: '2026-06-12' },
  { id: 'expired', title: '過期', image: '/images/portfolio/过期.png', thumb: '/images/portfolio-thumbs/expired.webp', date: '2026-06-01' },
  { id: 'flower-blooming-in-joy', title: '悦びに咲く花', image: '/images/portfolio/悦びに咲く花.png', thumb: '/images/portfolio-thumbs/flower-blooming-in-joy.webp', date: '2026-05-26' },
  { id: 'burn-dance-extinguish', title: '燒起來、舞蹈、澆滅', image: '/images/portfolio/烧起来、舞蹈、浇灭.png', thumb: '/images/portfolio-thumbs/burn-dance-extinguish.webp', date: '2026-04-30' },
  { id: 'taurus', title: 'Taurus', image: '/images/portfolio/Taurus.png', thumb: '/images/portfolio-thumbs/taurus.webp', date: '2026-03-29' },
  { id: 'past-days-remain', title: '지난 날은 영원히 혼수로 남아', image: '/images/portfolio/지난 날은 영원히 혼수로 남아.png', thumb: '/images/portfolio-thumbs/past-days-remain.webp', date: '2026-03-15' },
  { id: 'illegal', title: 'Illegal', image: '/images/portfolio/Illegal.png', thumb: '/images/portfolio-thumbs/illegal.webp', date: '2026-03-09' },
  { id: 'typewrite-lesson', title: 'Typewrite Lesson', image: '/images/portfolio/Typewrite Lesson.png', thumb: '/images/portfolio-thumbs/typewrite-lesson.webp', date: '2026-01-17' },
  { id: 'hair-cut-re-make', title: 'Hair Cut Re Make', image: '/images/portfolio/hair cut re make.png', thumb: '/images/portfolio-thumbs/hair-cut-re-make.webp', date: '2025-12-29' },
  { id: 'braincells', title: 'Braincells', image: '/images/portfolio/braincells.png', thumb: '/images/portfolio-thumbs/braincells.webp', date: '2025-12-14' },
  { id: 'racing-mount-pleasant', title: 'Racing Mount Pleasant', image: '/images/portfolio/Racing Mount Pleasant.png', thumb: '/images/portfolio-thumbs/racing-mount-pleasant.webp', date: '2025-11-01' },
  { id: 'just-stand-there', title: 'Just Stand There', image: '/images/portfolio/just stand there.png', thumb: '/images/portfolio-thumbs/just-stand-there.webp', date: '2025-10-18' },
  { id: 'minuet', title: '小步舞曲', image: '/images/portfolio/小步舞曲.png', thumb: '/images/portfolio-thumbs/minuet.webp', date: '2025-10-12' },
  { id: 'mingming', title: '明明', image: '/images/portfolio/明明.png', thumb: '/images/portfolio-thumbs/mingming.webp', date: '2025-10-08' },
  { id: 'vienna', title: 'Vienna', image: '/images/portfolio/Vienna.png', thumb: '/images/portfolio-thumbs/vienna.webp', date: '2025-09-10' },
  { id: 'when-i-get-home', title: 'When I Get Home', image: '/images/portfolio/when i get home.png', thumb: '/images/portfolio-thumbs/when-i-get-home.webp', date: '2025-07-26' },
  { id: 'heal-me-good', title: 'Heal Me Good', image: '/images/portfolio/heal me good.png', thumb: '/images/portfolio-thumbs/heal-me-good.webp', date: '2025-07-03' },
  { id: 'piano', title: 'Piano', image: '/images/portfolio/piano.png', thumb: '/images/portfolio-thumbs/piano.webp', date: '2025-06-22' },
  { id: '25-never-stop', title: '25歲永不停下', image: '/images/portfolio/25歲永不停下.png', thumb: '/images/portfolio-thumbs/25-never-stop.webp', date: '2025-06-22' },
  { id: 'be', title: 'Be', image: '/images/portfolio/be.png', thumb: '/images/portfolio-thumbs/be.webp', date: '2025-05-29' },
  { id: 'stairs', title: '臺階', image: '/images/portfolio/台阶.png', thumb: '/images/portfolio-thumbs/stairs.webp', date: '2025-05-25' },
  { id: 'mercei', title: 'Mercei', image: '/images/portfolio/自行人.png', thumb: '/images/portfolio-thumbs/pedestrian.webp', date: '2025-05-25' },
  { id: 'moonlight', title: '月光 Moonlight', image: '/images/portfolio/月光 moonlight.png', thumb: '/images/portfolio-thumbs/moonlight.webp', date: '2025-05-25' },
  { id: 'concorde', title: 'Concorde', image: '/images/portfolio/Ant From Up There.png', thumb: '/images/portfolio-thumbs/ant-from-up-there.webp', date: '2025-05-25' },
  { id: 'pictures-of-us', title: 'Pictures of Us', image: '/images/portfolio/pictures of us.png', thumb: '/images/portfolio-thumbs/pictures-of-us.webp', date: '2025-05-25' },
  { id: 'driveslow-intro', title: 'Driveslow Intro', image: '/images/portfolio/driveslow intro.png', thumb: '/images/portfolio-thumbs/driveslow-intro.webp', date: '2025-05-25' },
  { id: 'a-speck-of-dust', title: '一顆灰塵', image: '/images/portfolio/一顆灰塵.png', thumb: '/images/portfolio-thumbs/a-speck-of-dust.webp', date: '2025-05-24' },
  { id: 'tide', title: 'Tide', image: '/images/portfolio/tide.png', thumb: '/images/portfolio-thumbs/tide.webp', date: '2025-05-24' },
  { id: 'orange-moon', title: 'Orange Moon', image: '/images/portfolio/orange moon.png', thumb: '/images/portfolio-thumbs/orange-moon.webp', date: '2025-03-02' },
];
