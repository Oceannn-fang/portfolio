# 线上 works（作品集）图片加载慢：诊断 + 方案 A 实施

日期：2026-10-19　状态：**已实施并验证**（未提交、未部署）

---

## 一、结论

**原因**：作品集单图与大图浮层加载的是 1080×1920 **无损 PNG 原图**（单张 3–6MB），且全站未启用任何图片优化（未用 `next/image`）；国内直连 Vercel 实测吞吐仅 316–547 KB/s → 单张 9–18 秒。

**修复（方案 A）**：为 37 个注册作品生成同尺寸 WebP q82 衍生图，单图与浮层改用衍生图。

| 指标 | 修复前 | 修复后 |
|---|---|---|
| 单张平均 | 3.34 MB | **273 KB**（8.0%） |
| 37 张合计 | 123.5 MB | **9.9 MB** |
| 单张加载（按实测 316 KB/s 折算） | 9–18 s | **约 0.9 s** |
| 展示请求的 PNG | 有 | **0 次** |

---

## 二、诊断证据

### 线上实测（本机在国内，与用户网络一致）

| 资源 | 大小 | 耗时 | 吞吐 |
|---|---|---|---|
| `portfolio-thumbs/vienna.webp`（总览） | 7 KB | 0.12 s | — |
| `portfolio/Vienna.png`（单图/浮层） | 5,711 KB | **18.05 s** | 316 KB/s |
| `portfolio/braincells.png` | 4,866 KB | **8.90 s** | 547 KB/s |

### 代码路径

| 位置 | 内容 |
|---|---|
| `PortfolioModule.tsx`（原 122 行） | 单图 `<img src={work.image}>` = PNG 原图 |
| `PortfolioModule.tsx`（原 49-50 行） | 进单图前 `new Image()` 预加载同一张原图 |
| `Gk3Clone.tsx`（原 1166 行） | 浮层 `TiltedCard imageSrc={overlayWork.image}` = 同一张原图 |
| DriftWall | 用 `thumb`（240×428 WebP）→ 总览本来就不慢 |

全项目 `next/image` 仅命中 `next-env.d.ts` 的类型引用；`next.config.ts` 无 `images` 配置。

### 次要因素

线上静态资源 `Cache-Control: public, max-age=0, must-revalidate`（实测），不享受 `/_next/static` 的 immutable 长缓存。

---

## 三、实施（改动文件）

| 文件 | 改动 |
|---|---|
| `public/images/portfolio/web/*.webp` | **新增 37 个** WebP 衍生图（1080×1920 q82 method 6，保留 ICC），合计 9.9 MB |
| `lib/portfolio-images.ts` | 接口新增可选字段 `imageWeb?: string`；37 个条目补上该字段；更新字段注释 |
| `components/PortfolioModule.tsx` | 单图 `src={work.imageWeb ?? work.image}`；预加载同源改为 `imageWeb`；更新顶部性能注释 |
| `components/Gk3Clone.tsx` | 浮层 `imageSrc={overlayWork.imageWeb ?? overlayWork.image}` |

**为什么是可选 + 回退**：`scripts/update-portfolio.mjs:244` 的 `insertLine` 只写 `image/thumb/date`，
若把 `imageWeb` 设为必填，以后新增作品会直接类型报错。可选 + 回退保证管线不断，新作品在未转码前仍可显示（走原图）。

**命名**：用注册表 `id`（如 `should.webp`）而非原文件名 → 顺带把中文/空格/弯引号的原始 URL 换成纯 ASCII。

---

## 四、验证

### 断言（`verify-portfolio-web.cjs`，5/5 PASS）

| 断言 | 结果 |
|---|---|
| 单图使用 `.webp` | ✅ `/images/portfolio/web/should.webp` |
| 单图已解码 | ✅ `complete=true`，`naturalWidth=1080`×`1920` |
| 浮层使用 `.webp` | ✅ |
| **未请求任何 PNG 原图** | ✅（`pngRequests = 0`） |
| 确有 webp 请求 | ✅ 1 次，`transferSize = 72,520` 字节（71 KB） |

对照：同一张 `應該.png` 原图 3,547 KB → 衍生图 71 KB（**2.0%**）。

### 命令

```powershell
cd E:\portfolio
python portfolio-perf_20261019_v1\make-portfolio-web.py .          # 生成衍生图（幂等）
node portfolio-perf_20261019_v1\add-image-web-field.cjs lib\portfolio-images.ts
npx tsc --noEmit --tsBuildInfoFile portfolio-perf_20261019_v1\tsc-perf.tsbuildinfo   # exit 0
npx next build                                                      # exit 0
npx next start -p 3211
node portfolio-perf_20261019_v1\verify-portfolio-web.cjs 9333 http://127.0.0.1:3211 portfolio-perf_20261019_v1\verify-portfolio-web.json
```

### 截图（1440×900）

- `shots/rea-04-decode-settle.png` — 大图浮层完整渲染（WebP 路径端到端可用）
- `crop-vienna-q82.png` — PNG / WebP q82 / 差异×8 的 1:1 三联比对

---

## 五、画质核验（关键：PSNR 在这个题材上会误报）

首轮 PSNR 结果看着很糟：中位 35.3 dB、34/37 张低于 40 dB、最差 `vienna` 仅 **23.2 dB**。
但进一步取证表明**这不是可见劣化**：

| 证据 | 数值 | 含义 |
|---|---|---|
| 无损 WebP 往返 PSNR | **inf dB** | 管线本身无失真，误差全部来自有损编码 |
| `vienna` 亮度(Y) PSNR | **36.95 dB** | 亮度通道正常，23 dB 是被色度拉低的 |
| 通道 MAE | R 10.35 / G 7.33 / B 18.74（/255） | 误差集中在色度与颗粒 |
| q82 → q95 | PSNR 23.2 → **23.5 dB**，体积 724K → 1245K（+70%） | 误差与"质量档"几乎无关 → 是重采样/颗粒重整化的固定底盘，不是压缩强度不足 |
| 1:1 裁切比对（`crop-vienna-q82.png`） | 色彩、颗粒、文字锐度**肉眼无差异** | 像素级误差在感知上不可见 |

**结论：保留 q82。** 提高档位只增加 28%–70% 体积，感知收益接近于零。
（AVIF q60 可再降到约 63% 体积，属可选后续，本轮未采用。）

---

## 六、未做 / 后续（需要你拍板）

1. **`vercel.json` 长缓存（原方案 C）**：给 `/images/**` 加 `max-age=604800, stale-while-revalidate`；本轮只做了 A。
2. **`scripts/update-portfolio.mjs`**：新增作品的管线目前只生成缩略图，不会生成 `imageWeb` 衍生图 →
   以后新作品会走原图回退（慢）。建议给管线补一步衍生图生成。
3. **`app/driftwall-test/page.tsx:13`**：把 `w.image`（原图）塞进 DriftWall 图块，属于同类问题（37×3.3MB），
   但不在 works 展示路径上，本轮按"只碰必须碰的"未改动。
4. **49 张 PNG 原图仍留在 `public/`**（159.2 MB）：会整体进部署包；若确认衍生图已覆盖全部展示场景，
   可考虑移出以减小部署体积。
5. 未提交、未推送、未部署 → **线上仍是旧的 PNG 路径**，需要 commit + push 才会生效。

---

## 七、本任务产物

| 文件 | 用途 |
|---|---|
| `README.md` | 本报告 |
| `make-portfolio-web.py` | 衍生图生成器（幂等，可重复运行） |
| `add-image-web-field.cjs` | 注册表补 `imageWeb` 字段（幂等，支持 `--check`） |
| `verify-portfolio-web.cjs` | 展示路径实测（5 条断言） |
| `measure-portfolio-images.py` / `png-vs-webp.txt` | 体积构成测量 |
| `measure-webp-quality.py` / `webp-quality.txt` | 全量 PSNR 测量 |
| `compare-encode-settings.py` / `encode-settings.txt` | 编码档位对比（WebP q82-95、AVIF q60-80） |
| `compare-crops.py` / `crop-vienna-q82.png` | 1:1 画质比对图 |
| `verify-portfolio-web.json` | 断言与传输数据原始记录 |
| `prod-server.log`、`tsc-perf.tsbuildinfo` | 构建/类型检查记录 |

---

## 八、测量口径修正（2026-10-19 补记）

本机系统代理为 `127.0.0.1:7890`（Clash 类）。`Invoke-WebRequest` 会走系统代理，`curl.exe` 不会。
第二节的"线上实测 316–547 KB/s / 单张 18 秒"**是走代理的数字**，不代表无代理的国内访客 ——
无代理直连的实际结论见 `vercel-cloudflare-cn_20261019_v1/`：`*.vercel.app` 在国内 DNS 被污染、
且 `vercel.app` 这个 SNI 会被 RST，直连根本进不去。

**体积类结论不受影响**（文件大小与线路无关）：PNG 3.34MB → WebP 273KB、以及"展示路径零 PNG 请求"的断言仍然成立。

