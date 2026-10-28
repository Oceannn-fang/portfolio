# Portfolio 项目协作规则（Qoder → Codex）

本文件只适用于 `E:\portfolio`。用户级规则、当前消息和更具体的项目规则优先。

## 项目定位

这是 Fang 的个人作品集网站：以 gk3.website 为参考的单页深色交互体验，结合视觉作品、Spotify/网易云音乐、3D/弧形专辑展示和移动端手机边框 viewer。它不是普通后台或模板站；修改应优先保护整体艺术方向、排版节奏和交互体验。

## 技术架构

- Next.js 15 App Router、React 19、TypeScript、pnpm。
- 主入口：`app/page.tsx` → `components/Gk3Clone.tsx`。
- 主样式：`components/Gk3Clone.css`；音乐、歌单、精选专辑和作品集模块分别使用自己的 CSS 前缀。
- 数据：`lib/data.ts`、`lib/content.ts`、`lib/portfolio-images.ts`。
- 主要模块：`MusicModule`、`PlaylistModule`、`AlbumShowcase`、`PortfolioModule`、`DriftWall`、`TiltedCard`、`LoadingScreen`、`FontPicker`。
- API：Spotify OAuth/最近播放/专辑/曲目，网易云歌单，iTunes 相关接口。服务端 token 和 `.env.local` 不读取、不提交、不暴露。
- `.firecrawl` 是参考证据目录；不要把它当应用入口，也不要删除。

## 当前视觉与交互基线

- 参考 gk3.website 的左右分栏：viewer/media panel + 右侧编辑式作品列表。
- 深色高对比、巨大排版、细线分隔、低饱和/可控色彩旋转、动态噪点和克制但明确的 hover/click 动效。
- 作品集 viewer 有总览 DriftWall、单图模式和 TiltedCard 浮层；音乐/歌单/精选专辑是独立 viewer 模式。
- 桌面和窄屏是两套布局：桌面 viewer 多为约 34% 宽，窄屏 viewer 转右侧并使用 `phone-frame-2.png`；手机边框必须保持 1304:2866 比例、内容面板与屏幕圆角裁切链一致。
- 修改视觉时先区分“当前生产实现”和旧的搭建方案文档，不能把已废弃的白底/旧组件架构直接恢复。

## 用户意图识别

- “把存档里的新作品更新到作品集”：使用 `scripts/update-portfolio.mjs`，先 dry-run，再执行；验证原图、缩略图、注册表置顶插入、总览 tile、viewer 单图、TiltedCard 三处展示。目标文件已存在时不覆盖。
- “修复手机边框/窄屏/viewer”：先检查 frame 比例、`inset`、圆角、`overflow`、`::after` 层级和 CSS 特异性，再在桌面 1440×900 与窄屏 900×1000 做截图/像素验证。
- “调整标题/字体/文案”：优先改 `lib/data.ts` 或 `lib/content.ts` 的数据源；不要在多个组件复制同一文案。中文作品名、英文 Title Case、作品图和注册 id 需保持联动。
- “增加音乐/专辑/歌单”：先确定是 Spotify、网易云还是本地精选专辑；保持 viewer 模式边界、服务端 API 隔离、缓存策略和未授权降级。
- “优化性能”：优先检查图片体积、缩略图、预加载、缓存、WebGL 可见性和首屏门控；改动后用 `tsc --noEmit`、`next build` 和浏览器控制台/截图验证。
- “看起来不对/再细一点/还是不对”：不要只随机微调 CSS；先定位具体区域、断点和证据，比较截图与基线，再提出最小修复。
- “部署/上线”：先完成本地类型检查、生产构建和关键交互验证，再询问或确认 commit/push 等外部状态变更。

## 工程约定

- 2 空格缩进、分号、TypeScript、函数组件和 Hooks；修改时跟随目标文件既有引号风格。
- 独立模块使用前缀类名；服务端 `lib/spotify.ts` 不得进入客户端组件。
- Next.js 15 动态路由的 `params` 是 Promise，必须 `await params`；外部 id 先正则校验。
- 作品更新脚本应幂等；默认缩略图 240×428 WebP，原图保持原文件名。
- 不使用浏览器 Inspect Element 直接改项目文件；优先项目代码、Playwright/CDP 截图和可复现脚本。

## 验收标准

每次 portfolio 修改至少说明：改动文件、验证命令、验证视口、截图/控制台结果、是否触及外部服务或部署。视觉问题以截图和几何数据为证据，不以“看起来应该可以”作为完成标准。

## 参考文档

- `README.md`：当前架构、viewer 尺寸、API 和缓存。
- `DESIGN.md`：gk3 视觉参考和设计 token。
- `PORTFOLIO-UPDATE-GUIDE.md`：新增作品标准管线。
- `PORTFOLIO-BUILD-SUMMARY.md`：早期整体设计方案，涉及当前实现时需与 README 和源码交叉核对。