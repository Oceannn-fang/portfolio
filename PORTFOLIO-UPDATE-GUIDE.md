# 作品集更新指南（PORTFOLIO-UPDATE-GUIDE）

> 一条命令把 OneDrive 存档文件夹里的新作品 PNG 接入作品集全链路：原图拷贝 → 缩略图生成 → 注册表置顶插入。

## 使用场景

你刚在 Photoshop 完成一张新作品，导出/存放后想让它们出现在网站的三个位置：

1. **作品集总览**（DriftWall 漂移墙 tile，用 240×428 缩略图）
2. **单图模式**（viewer 内点开条目，加载 1080×1920 原图）
3. **精选浮层**（TiltedCard 大图浮层）

## 前置条件

| 项目 | 要求 |
|------|------|
| 存放位置 | `C:\Users\86185\OneDrive\图片\存档`（可用 `--src` 指向其它目录） |
| 尺寸规范 | 1080×1920 竖屏长图（其它比例也能跑，缩略图按 cover 裁剪，但显示效果以规范为准） |
| 格式 | PNG（PSD 需先导出同名 PNG，脚本会列出未导出的 PSD 提醒你） |
| 命名 | 支持空格 / `&` / 撇号（’）/ 中日韩文字；**建议文件名里带几个英文词**（见下方 FAQ 的 id 规则） |
| 环境 | Node 18+、系统 ffmpeg（PATH 或 WinGet Links；缺失时脚本会给出安装指引） |

## 三步标准流程

### 1) 运行更新管线（建议先 `--dry-run` 看一眼）

```powershell
node scripts/update-portfolio.mjs --dry-run   # 预览将要 copy/thumb/insert 的内容，零写入
node scripts/update-portfolio.mjs             # 实际执行
```

脚本会自动完成：

- 扫描源目录 PNG，与 `lib/portfolio-images.ts` 已注册条目做差集（已注册的一律跳过）
- 原图 Copy 到 `public/images/portfolio/<原文件名>`
- ffmpeg 生成 `public/images/portfolio-thumbs/<id>.webp`（240×428，与 #42 管线参数一致）
- **置顶插入**注册条目到 `portfolioWorks` 数组开头（date 默认取文件修改时间的 `YYYY-MM-DD`）

重复运行是**幂等**的：已注册文件全部跳过；没有新作品时输出「无新作品，0 改动」且不碰任何文件。

### 2) 本地验证

```powershell
npx tsc --noEmit        # 类型检查零错误
npx next dev            # 本地起服务，验证三处展示
```

在浏览器里确认：总览 tile 出现新缩略图 → hover 行条目打开 viewer 单图正常 → 点击打开 TiltedCard 浮层正常。（也可以直接让 AI 助手执行验证。）

### 3) 构建与上线

```powershell
npx next build          # 生产构建通过
git add -A
git commit -m "portfolio: add <作品名>"
git push                # 推送后 Vercel 自动部署
```

## 常见问题

### PSD 没被接入？

脚本只处理 PNG。有 PSD 但**没有同名 PNG** 时会列入「psd 待导出」清单——先从 Photoshop 导出同名 PNG（如 `晚餐見.psd` → `晚餐見.png`）再重跑。同名 PSD+PNG 只取 PNG。

### 特殊文件名（撇号 / `&` / 中文）怎么处理？

- 文件名匹配前做了 **Unicode NFC 规范化**，`’`（U+2019 撇号）等码点差异不会导致重复接入或漏接。
- 原图**保持原文件名**拷贝（与现有 35 条惯例一致，如 `Life & space.png`、`There’s Something Here for Us Both.png`）；注册表写入时对含 ASCII 撇号/反斜杠的字符串自动改用双引号字面量，保证 TS 合法。
- 目标位置已存在同名文件时（同名不同码点的极端情况）脚本会**报错并中止该项**，不会覆盖。

### id（slug）是什么规则？

归纳自现有 35 条数据：

- 文件名**含英文词** → 自动生成：小写 + 连字符 + 去撇号。例：`Life & space` → `life-and-space`、`There’s Something Here for Us Both` → `theres-something-here-for-us-both`。
- **纯中日韩文件名** → 现有惯例是**人工语义英译**（`晚餐見`→`dinner-view`、`一顆灰塵`→`a-speck-of-dust`、`明明`→`mingming`），脚本无法自动翻译，此时回退占位 id `work-<日期>` 并在报告中**黄色警告**。建议二选一：
  - 接入后人工把注册表里的 `id` 与 `thumb` 文件名改成语义英译（如 #62 用户拍板 Concorde/Mercei 的先例）；
  - 或者导出时就把文件名起成带英文词的名字（最省事）。

### 标题（title）规则？

- 英文 → Title Case（虚词 a/an/the/and/or/for/of/in/on/at/to/from/by/with/it 小写，首词大写，如 `Wish it Was Easy`）。
- 中日韩 → 文件名原样。注意现有惯例会把简体标题**转繁体**（`过期`→`過期`），需要的话接入后人工微调一行即可。

### date 为什么和文件修改时间一样？

脚本默认取源文件的 mtime `YYYY-MM-DD`（与现有数据核对一致，如 `Life & space.png` 的 mtime 2026-09-22 → `date: '2026-09-22'`）。需要指定时加参数：`--date 2026-09-30`。

### 缩略图规格？

240×428 WebP（质量 80），ffmpeg `scale=240:428:force_original_aspect_ratio=increase + crop`（cover 语义，与页面 `object-fit: cover` 视觉一致）。单张约 8-30 KB。

## 附注：让 AI 助手代办

也可以直接对 AI 助手说「把存档里的新作品更新到作品集」，助手会：跑本脚本（先 dry-run）→ `tsc`/`next build` → commit + push 部署 Vercel → CDP 验证三处展示并截图。

---

*管线脚本：`scripts/update-portfolio.mjs`（#88）。缩略图参数与 `scripts/generate-portfolio-thumbs.mjs`（#42）保持一致。*
