# 性能复检与优化实施（第二轮）

日期：2026-11-05　状态：**已实施并本地验证；未提交、未部署**

---

## 一、本轮做了什么

| # | 项 | 结论 | 状态 |
|---|---|---|---|
| 1 | `public/` 静态资源零缓存 | 回访每次都重下 740KB 作品图 / 756KB 专辑封面 | ✅ 已改 |
| 2 | 噪点层吃掉一半空闲帧预算 | 4× CPU 限速下 35.1fps → 48.9fps | ✅ 已改 |
| 3 | 部署体积 854MB | 已跟踪 public 从 316MB → **82.6MB** | ✅ 已改 |
| 4 | 网易云接口冷路径 4.63s | 分批串行 → 并发 | ✅ 已改 |
| 5 | 作品单图 1080 宽显示在 490px | 建议**放弃**，见第五节 | ❌ 不做 |
| 6 | 调试页对公网开放 | `/cardstack-preview`、`/driftwall-test` 返回 200 | ✅ 已改 |

---

## 二、改动文件

| 文件 | 改动 |
|---|---|
| `next.config.ts` | 新增 `headers()`：`/images/**` 7 天 + SWR；`/gk3-assets/**`、`/music-cover-3d/**`、`/fonts/**` 1 年 immutable。新增两条 redirect 关掉调试页 |
| `components/Noise.tsx` | 逐帧重算 → 6 槽环形帧缓存；密度量化 10 分档；刷新间隔 `[2,5]` → `[6,10]` 帧 |
| `app/api/netease/playlist/route.ts` | `song/detail` 分批由串行 `for await` 改为 `Promise.all` 并发，合并顺序不变 |
| `public/images/portfolio/*.png` → `assets-src/images/portfolio/` | 51 个原图移出 public（175MB），git mv 保留历史 |
| `public/images/albums/` → `assets-src/images/albums/` | 17 张专辑原图移出 public（66MB），对应组件（Listening/CircularGallery）已确认未被任何页面引用 |
| `scripts/update-portfolio.mjs` | 原图默认落 `assets-src/`；新增 ffmpeg 生成 `web/<slug>.webp`（宽 1080 q82）并写入 `imageWeb`；`--public-dir` 保留为 `--originals-dir` 的旧名 |
| `scripts/generate-portfolio-thumbs.mjs` | 数据源改 `assets-src/`；修掉解析正则——原正则要求 `image` 紧邻 `date`，上一轮加 `imageWeb` 后已匹配不到任何条目（0/39） |
| `lib/portfolio-images.ts` | 字段注释更新：`image` 现为溯源路径，不再可访问 |

---

## 三、验证数据

### 3.1 缓存头（`next start` 实测）

| 资源 | 改前 | 改后 |
|---|---|---|
| `/images/portfolio/web/vienna.webp` | `public, max-age=0, must-revalidate` | `public, max-age=604800, stale-while-revalidate=86400` |
| `/gk3-assets/img/phone-frame-2.png` | 同上 | `public, max-age=31536000, immutable` |
| `/music-cover-3d/album_covers_webp/*.webp` | 同上 | `public, max-age=31536000, immutable` |

`/images/**` 故意不给 `immutable`：`scripts/update-portfolio.mjs` 会覆盖同名衍生图（新作品沿用 id），
标 immutable 会让用户一年看不到更新。

### 3.2 重定向

```
/cardstack-preview   307 -> /
/driftwall-test      307 -> /
/film                307 -> /      （原有）
```

### 3.3 噪点层帧率（Playwright + 真 Chromium，1440×900，同机同条件 A/B）

| 场景 | 改前 | 改后 | 变化 |
|---|---|---|---|
| 1× CPU 空闲 | 59.9 fps / 0 掉帧 | 59.9 fps / 0 掉帧 | 不变 |
| **4× CPU 空闲** | **35.1 fps** / p95 66.7ms / 32% 帧 >32ms | **48.9 fps** / p95 50.1ms / 9.8% 帧 >32ms | **+39% fps，掉帧率 32%→9.8%** |

改前 4× 数据是在同一台机器、同一 headless Chromium、同一视口下重建旧版 `Noise.tsx` 测得的
（`shot-baseline-*`、`shot-new-*` 两套截图来自这两次构建）。

### 3.4 噪点画质未被改变

canvas 像素统计（1024×640，opacity 0.0392）：

| 指标 | 改前 | 改后 |
|---|---|---|
| 不透明像素占比（=密度） | 0.300 → 0.613 连续 | 0.300 / 0.401 / 0.501 / 0.601（10 分档） |
| 灰度均值 | 127.4 | 127.6–127.7 |
| 灰度范围 | 0–255 | 0–255 |

密度仍是亮度驱动的 30–70 区间，只是落成 10 分档；4% 不透明度下相邻档位不可分。
1×1 与 cell 分支的随机算法原样保留，只是把结果缓存下来复用。

### 3.5 网易云接口

| 指标 | 改前 | 改后 |
|---|---|---|
| 本地 `/api/netease/playlist` | ~0.9s | **0.32s / 0.36s** |
| 线上冷路径（部署版，代理实测） | 4.63s TTFB | 待部署后复测 |
| 数据完整性 | — | 666 首全在，首曲 `Abobo / 李丁丁MIA AIM`，封面字段正常 |

### 3.6 布局无回归

| 视口 | docHeight | 横向溢出 | 噪点 canvas | WebGL canvas |
|---|---|---|---|---|
| 1440×900 | 2988 | 无 | 1024×640 | 1440×900 |
| 390×844 | 2604 | 无 | 390×844 | 390×844 |

`shot-baseline-1440x900.png` 与 `shot-new-1440x900.png` 逐项对照：排版、字号、分隔线、
留白完全一致，差异仅为随机占位文案与 WebGL 背景的动画相位。

### 3.7 部署体积（第 3 条）

| 项 | 改前 | 改后 |
|---|---|---|
| 已跟踪 `public/` 合计（= 部署包携带的静态资源） | **316 MB** | **82.6 MB** |
| `public/images/portfolio` | 175 MB（51 张 PNG 原图） | 10.2 MB（web + thumbs） |
| `public/images/albums` | 66 MB | 0（已移出） |
| `public/images/film` | 15 MB | 15 MB（保留，随时可恢复胶片） |

说明：
- 磁盘上 `public/` 仍显示 625MB，是因为 `public/images/film` 里有 541MB **未跟踪**的胶片原始扫描件
  （`.gitignore` 已排除），它们从来就不在部署包里。判断部署体积要看 `git ls-files public`，不是 `du`。
- 原图用 `git mv` 移到 `assets-src/`，历史保留、可随时 `git mv` 回去。
- 移出前已确认：`lib/data.ts` 的专辑图只被 `Listening`/`CircularGallery`/`About`/`Hero`/`Contact`
  引用，这 5 个组件在全项目中**没有任何 import**（早期独立组件，未接入页面）。

### 3.8 移走原图后的管线验证

新作品管线端到端跑通（fixture：1 张测试图 + 隔离的注册表/目录）：

```
copy  存档/Test Work.png -> assets-src/images/portfolio/Test Work.png
web   ffmpeg 宽 1080 webp q82 -> public/images/portfolio/web/test-work.webp   (261.2 KB)
thumb ffmpeg 240x428 webp q80 -> public/images/portfolio-thumbs/test-work.webp (4.4 KB)
insert { id: 'test-work', ..., imageWeb: '/images/portfolio/web/test-work.webp', ... }
```

资源可用性（`verify-assets.cjs`，真 Chromium 加载首页）：

| 路径 | 状态 |
|---|---|
| `/images/portfolio/web/carmen.webp` | 200（244,602 B） |
| `/images/portfolio/web/vienna.webp` | 200（740,866 B） |
| `/images/portfolio-thumbs/carmen.webp` | 200（4,450 B） |
| `/music-cover-3d/album_covers_webp/01_*.webp` | 200（11,220 B） |
| `/gk3-assets/img/phone-frame-2.png` | 200（84,913 B） |
| `/images/portfolio/carmen.png`（原图，已移走） | 404（符合预期） |

39 条注册条目的 `imageWeb` + `thumb` 文件全部存在（缺失 0 个）。

### 3.9 交互路径端到端（移走原图后真正跑一遍）

`verify-interactions.cjs` 用真 Chromium 依次走 hover / click，记录图片解码尺寸与失败请求：

| 路径 | 结果 |
|---|---|
| hover works 行 → 左侧 viewer 单图 | `/images/portfolio/web/carmen.webp`，`naturalWidth×Height = 1080×1920`，`complete=true`，显示 245×668 |
| 点击作品名 → TiltedCard 大图浮层 | 同上 WebP，显示 446×792 |
| hover listening 行 → MusicModule | `#musicViewer` 已挂载 |
| hover arc vinyl 行 → AlbumShowcase | 封面 `480×480` 正常解码（3 张抽样） |
| **失败请求 / 控制台报错** | **0 / 0** |

截图：`shot-viewer-portfolio.png`（viewer 单图）、`shot-overlay-portfolio.png`（浮层）、
`shot-viewer-music.png`、`shot-viewer-showcase.png`。

---

## 四、验证命令

```powershell
cd E:\portfolio
npx tsc --noEmit                     # exit 0
npx next build                       # exit 0，First Load JS shared 102 kB
npx next start -p 3212
curl -I http://127.0.0.1:3212/images/portfolio/web/vienna.webp
curl -o /dev/null -w "%{http_code} %{redirect_url}" http://127.0.0.1:3212/cardstack-preview
node portfolio-perf_20261105_v1\measure-noise.cjs http://127.0.0.1:3212/ new
node portfolio-perf_20261105_v1\shots.cjs http://127.0.0.1:3212/ new
node portfolio-perf_20261105_v1\verify-assets.cjs http://127.0.0.1:3212/
node portfolio-perf_20261105_v1\verify-interactions.cjs http://127.0.0.1:3212/
node scripts\update-portfolio.mjs --dry-run      # 管线不回归
node --check scripts\update-portfolio.mjs
node --check scripts\generate-portfolio-thumbs.mjs
```

---

## 五、为什么不做第 5 条（540 宽衍生图）

原判断是「1080 宽图显示在 490px，浪费带宽」。复核后建议放弃：

- 桌面 viewer 约 490 CSS px，但 2× DPR 屏幕需要 980 设备像素 → `srcset` 仍会选 1080w；
- 移动端 viewer 接近全宽 390 CSS px，2× DPR 需要 780 设备像素 → 同样选 1080w；
- 只有在 1× DPR 桌面屏上才会选 540w，而这类屏幕正快速消失。

即：**绝大多数访客拿不到收益，却要多维护 39 张衍生图**。真要降体积应该走 AVIF
（`portfolio-perf_20261019_v1/README.md` 实测可再降约 37%），而不是降分辨率。

---

## 六、未做 / 待你拍板

1. **线上复核**：本轮只在本地 `next start` 验证。Vercel 上的 `headers()` 生效需部署后复测；
   当前 `oceanfolio.vercel.app` 直连被 DNS 污染（解析到 Facebook 段），系统代理 7890 也已失效，
   所以无法在本地对线上做最终确认。
2. **国内可达性**：结构性阻塞，前端无解，需自定义域名 + Cloudflare 或换托管。
3. **仓库体积未降**：`git mv` 保留了历史，仓库 pack 仍是 909MB（只影响 clone/构建拉取，不影响部署包）。
   要真正缩小需要重写历史，风险大，建议不做。
4. **`public/images/film`（15MB 已跟踪）**：胶片模块已下线但素材按原计划保留，未动。
   如果确认不再恢复胶片，可以照同样方式移出，再省 15MB。

---

## 七、本任务产物

| 文件 | 用途 |
|---|---|
| `README.md` | 本报告 |
| `measure-noise.cjs` | 帧率 + 噪点像素统计（Playwright 真 Chromium，含 4× CPU 限速） |
| `shots.cjs` | 双视口截图 + 几何指标 |
| `verify-assets.cjs` | 首页资源可用性校验（收集 4xx/5xx，探测展示路径与原图 404） |
| `verify-interactions.cjs` | 交互路径端到端校验（hover/click 开 viewer 与浮层，验图片解码与失败请求） |
| `shot-viewer-*.png` / `shot-overlay-portfolio.png` | 各 viewer 与浮层的实际渲染截图 |
| `shot-live.cjs` | 线上同视口截图脚本（本轮因代理失效未跑通） |
| `shot-baseline-*.png` / `shot-new-*.png` | 改动前 / 后对照截图 |
| `Noise.new.tsx.txt` | 改动后 `Noise.tsx` 的备份（做 A/B 时用于还原，勿放回 `components/`） |
| `pipeline-test/` | 新作品管线端到端测试的隔离目录（fixture 输入 / 输出 / 注册表副本） |
