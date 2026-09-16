# Portfolio

个人作品集网站（Fang），基于 gk3.website 克隆的单页深色交互体验，集成 Spotify 实时收听数据与 3D 专辑展示。

## 技术栈

- **框架**：Next.js 15（App Router）/ React 19 / TypeScript
- **动画**：GSAP、motion（Framer Motion）、Lenis（平滑滚动）
- **图形**：ogl（WebGL），Gk3Clone 内部另用原生 WebGL shader
- **样式**：Tailwind CSS 4（PostCSS）+ 组件级原生 CSS 文件
- **包管理**：pnpm（`packageManager` 已锁定版本）

## 项目结构

```
app/
  page.tsx                  # 入口，唯一渲染 <Gk3Clone />
  layout.tsx / globals.css  # 全局布局与样式
  api/
    auth/spotify/route.ts           # OAuth 授权跳转（生成 state + cookie）
    auth/spotify/callback/route.ts  # OAuth 回调（state 校验 + token 交换）
    spotify/recently-played/route.ts
    spotify/albums/route.ts
    spotify/album-tracks/[id]/route.ts   # Next.js 15：params 为 Promise，需 await
components/
  Gk3Clone.tsx / .css       # 核心组件（~900 行），整站 UI
  MusicModule.tsx / .css    # Spotify 音乐面板（mm- 前缀类名）
  AlbumShowcase.tsx / .css  # 精选推荐 iframe 容器（as- 前缀类名）
  Noise.tsx / noisePhase.ts # 噪点覆盖层与共享相位
  Hero/About/Work/...       # 早期独立组件，当前未接入页面
lib/
  data.ts                   # 静态数据：profile / portfolioImages / recentAlbums / works 等
  spotify.ts                # Spotify 服务端工具（仅 Node runtime，禁止客户端引入）
  spotify-token.json        # 运行时 token（已 gitignore，勿提交）
public/
  gk3-assets/               # GK3 原版视频/图片/字体资源
  music-cover-3d/           # 独立静态 3D 专辑页（被 AlbumShowcase iframe 嵌入）
  images/albums/、images/portfolio/  # 专辑封面与作品图（PNG，体积较大）
  images/portfolio-thumbs/           # 作品缩略图（240×428 WebP，DriftWall tile 用；由 scripts/generate-portfolio-thumbs.mjs 生成）
```

## 核心架构

### Gk3Clone 组件

页面唯一渲染组件（`app/page.tsx` → `<Gk3Clone />`），复刻 gk3.website 的行列表 + Viewer 交互。

**Viewer 系统**：
- `type ViewerMode = "phone" | "video" | "social" | "pin" | "music" | "showcase"`
- 触发：行内 `<li>` 的 `onMouseEnter` 调用 `prepViewer()`（触屏设备 `hover: none` 跳过）；`work-wrapper` 的 `onMouseLeave` 延迟 150ms 关闭（`endViewerTimerRef`），music/showcase 面板自身 `onMouseEnter` 可取消关闭定时器
- 滚动超过 200px 自动关闭 viewer
- viewer 内容按 `viewerClass` 条件渲染：`music` → `<MusicModule />`，`showcase` → `<AlbumShowcase />`

**Rows 数组**（当前 5 行，定义于组件文件顶部 `const rows: Row[]`）：
| id | 内容 | viewer |
|---|---|---|
| `music` | listening / spotify → "recently played" | `music` |
| `showcase` | 精选推荐 arc vinyl → "enter the archive" | `showcase` |
| `elsewhere` | 社交链接（Instagram/Threads/LinkedIn/Unsplash/Substack） | `social` |
| `bar` | 分隔条（`bar: true`，无 items） | — |
| `legal` | 页脚法律信息（`legal: true`） | — |

**颜色旋转引擎**：`setInterval` 15fps 执行 `setGradient()`，对基准色（深蓝 `[4,9,46]` / 靛蓝 `[16,34,128]` / 绯红前景 `[220,20,60]`）做 HSL 色相往返旋转（±12°，步进 0.45°/帧），写入 CSS 变量 `--fg-color` / `--bg-color` / `--panel-color` / `--scrim` 等，并同步 `<meta theme-color>` 与动态生成的 SVG favicon；亮度还驱动噪点相位（`setSharedNoisePhase`）。

**WebGL 背景**：canvas 上的全屏 fragment shader（原生 WebGL，非 ogl），`requestAnimationFrame` 循环渲染。

### 音乐模块 (MusicModule)

**Spotify OAuth 流程**（Authorization Code Flow）：
1. 前端引导用户访问 `/api/auth/spotify`（支持 `?force=1` 强制重新授权）
2. 路由生成随机 state 写入 cookie，302 跳转 Spotify 授权页；scope：`user-read-recently-played`、`user-library-read`、`user-read-currently-playing`
3. 回调 `/api/auth/spotify/callback` 校验 state，调用 `exchangeCodeForToken()` 换取 token，持久化到 `lib/spotify-token.json`
4. `lib/spotify.ts` 的 `getAccessToken()` 自动续期：提前 60s 判定过期，refresh_token 轮换 + 模块级 in-flight Promise 并发去重；只读文件系统下降级为内存缓存

**API 路由**：
- `GET /api/spotify/recently-played` — 最近播放曲目
- `GET /api/spotify/albums` — 收藏专辑
- `GET /api/spotify/album-tracks/[id]` — 专辑曲目（路径参数，正则校验防注入）
- 未授权统一返回 401 JSON，前端降级为「连接 Spotify」授权按钮（绿色 #1DB954）

**三层缓存（均 1 小时过期）**：
1. 服务端内存缓存：`lib/spotify.ts` 中 `apiCache`（Map，键为请求 URL），每 30 分钟清理过期条目
2. HTTP 缓存头：路由响应的 `Cache-Control`
3. 客户端模块级缓存：`MusicModule.tsx` 顶部的 `cachedTracks` / `cachedAlbums` / `cachedAuthed` + `cacheTimestamp`，viewer 重复打开时跳过 loading 直接渲染

**数据源**：组件内 fetch 上述三个 API；播放使用 Spotify 官方 Embed iframe（lazy loading）。接口数据类型见 `MusicModule.tsx` 顶部的 `Track` / `Album` / `AlbumTrack` 定义。

### 精选推荐 (AlbumShowcase)

极简组件：在 viewer 面板中 iframe 嵌入 `/music-cover-3d/index.html`（原版弧形黑胶动画）。iframe 独立视口使其中的 `position: fixed` 与 window 尺寸引用自动适配。静态资源完整位于 `public/music-cover-3d/`（index.html / script.js / styles.css / album_covers/）。

## Viewer 尺寸规格

以下参数均以 `components/Gk3Clone.css` 为准，断点判定使用 `@media (max-aspect-ratio: 16/12)`（窄屏时 viewer 从左侧移到右侧）。

### 桌面端（viewer 在左侧）

| Viewer | 宽度 | 高度 | 定位 |
|--------|------|------|------|
| `music` | 34% | 65vh | `top: 50%`, `translateY(-50%)` |
| `showcase` | 34% | 65vh | `top: 50%`, `translateY(-50%)` |
| `playlist` | 34% | 65vh | `top: 50%`, `translateY(-50%)` |
| `portfolio`（单图 `.pom-frame-mode`） | 34% | 66vh | `top: 50%`, `translateY(-50%)` |

**桌面端边框样式**（内容面板 `#musicViewer` / `#showcaseViewer` / `#playlistViewer`，`inset: 0 10%` 即左右各留 10%，实际占 80% 宽度）：

```css
border-radius: 12px;
border: 1px solid rgba(244, 239, 226, 0.1);
box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5);
```

桌面端默认**不**使用手机边框素材：`#viewer.music/showcase/playlist/portfolio #videoFrame:after { background-image: none; }`。

例外：portfolio 单图模式通过 `#videoFrame:has(.pom-frame-mode):after` 单独恢复边框图（特异性更高），桌面 + 窄屏均显示，详见下方「手机边框适配规范」。

### 窄屏（`@media (max-aspect-ratio: 16/12)`，viewer 在右侧）

| 参数 | 值 | 说明 |
|------|-----|------|
| viewer `width` | `100%` | 占满可用宽度 |
| viewer `height` / `max-height` | `70vh` | 三个 viewer 统一高度 |
| viewer `top` | `15vh` | 垂直居中，`(100vh - 70vh) / 2` |
| `#videoFrame` `width` | `calc(70vh * 1304 / 2866)` | 按手机边框素材比例约束，防止内容横向溢出 |
| `#videoFrame` `margin` | `0 24px 0 auto` | 右侧对齐（viewer 从右滑入）并留出边距 |
| 内容面板 `inset` | `5% 5%` | 上下左右留给 bezel |
| 内容面板 `border-radius` | portfolio `12.8% / 6%`；其余 `12% / 5%` | portfolio 由 `.pom-frame-mode` 统一规则提供（特异性更高，两端一致）；匹配手机屏幕圆角 |
| `#videoFrame` `border-radius` | `12% / 5%` | 与面板协调，构成裁切链 |
| `#videoFrame` `overflow` | `hidden` | 最终裁切防线 |
| 内容面板 `overflow` | `hidden` | 面板级裁切 |
| 内容面板 `border` / `box-shadow` | `none` | 去掉桌面端普通边框样式 |
| `#musicViewer` `padding-top` | `5%` | 顶部 tab 避开刘海（showcase / playlist 无顶部 tab，不受影响） |

### 手机边框素材

- **文件**：`public/gk3-assets/img/phone-frame-2.png`
- **比例**：1304 : 2866
- **生效范围**：music/showcase/playlist 仅窄屏显示（桌面端用普通圆角边框）；portfolio 单图模式（`.pom-frame-mode`）桌面 + 窄屏均显示，总览模式（DriftWall，面板 `inset: 0`）不显示
- **叠加方式**：`#videoFrame::after` 伪元素，`background: url(...) center / contain no-repeat`，`inset: 0`（因 videoFrame 已开启 `overflow: hidden`，外扩 `inset: -2%` 会被裁掉），`pointer-events: none`（仅作装饰，不拦截交互），`z-index: 100`

### 背景色（窄屏不透明，避免透出页面背景）

| Viewer | 背景色 | 备注 |
|--------|--------|------|
| `music` / `playlist` | `#0b0b09` | 纯黑，同时关闭 `backdrop-filter` |
| `showcase` | `#f4f1e9` | 暖纸色，与 AlbumShowcase 背景一致 |
| `portfolio` | `#0b0b09` | 纯色，两端一致 |

## 手机边框适配规范（phone-frame-2.png）

### 素材几何（逐像素实测）

| 项目 | 值（素材 px） | 占素材比 |
|------|--------------|----------|
| 画布 | 1304 × 2866 | 宽高比 0.4550 |
| bezel 外轮廓 | top y≈116 / bottom y≈2750 / 左右 x≈10、1293 | top 4.05% / bottom 95.95% / 左右 ~0.8% |
| 屏幕透明区 | 左右 x≈72、1232 / 底 y≈2688 | 左右 5.52% / 底 6.21% |
| 刘海 | x≈340~964 / 底 y≈272 | x∈[26.1%, 73.9%] / 底 9.49% |
| 刘海两侧屏幕顶边 | y≈184 | 6.42% |
| 屏幕区圆角 | R≈128 | ≈9.8% 宽 / 4.5% 高 |
| bezel 外弧圆角 | R≈140，弧心 (150,256) (1154,256) (150,2610) (1154,2610) | — |

- 刘海两侧 y<184 的顶部带素材透明：这是沉浸式状态栏区，内容延伸显示属设计意图（刘海图层 z-index 100 叠在上面）。
- 四角存在「屏幕圆角弧与 bezel 图案之间的月牙透明缝隙」：内容面板若为直角，照片会从此漏出，面板必须用匹配的椭圆圆角遮住（见下）。

### portfolio viewer 单图模式尺寸规则（`.pom-frame-mode`）

| 断面 | 规则 |
|------|------|
| 桌面 viewer | `#viewer.portfolio`：宽 34% / 高 66vh（85% 缩小，原 78vh）/ `top: 50%; translateY(-50%)` |
| 桌面 frame | `#videoFrame:has(.pom-frame-mode)`：宽 `calc(66vh * 1304 / 2866)`、`margin: 0 auto` 居中 |
| 窄屏 viewer | 断点 `max-aspect-ratio: 16/12`：高 70vh / `top: 15vh` |
| 窄屏 frame | 宽 `calc(70vh * 1304 / 2866)`、`margin: 0 24px 0 auto` 右对齐 |
| 内容面板 | `#portfolioViewer.pom-frame-mode`：`inset: 5% 5%`、`border-radius: 12.8% / 6%`、`overflow: hidden`、无边框无阴影，两端统一（特异性高于窄屏统一规则的 `12%/5%`，无需另设覆盖） |
| 面板背景 | 纯色 `#0b0b09`，不透页面渐变背景 |
| 边框图 | `#videoFrame:after`：`inset: 0` + `contain` + `z-index: 100` + `pointer-events: none` |

**面板圆角 12.8% / 6% 的换算方法**（素材更新时需重算）：面板尺寸 = frame × 0.9（`inset: 5% 5%`），即 1173.6 × 2579.4 素材 px。圆角椭圆（a≈150、b≈155 素材 px）必须同时满足：

1. 椭圆弧整体落在 bezel 外弧（R≈140）之内——不进四角月牙透明缝（防漏出）；
2. 椭圆弧覆盖屏幕圆角弧（R≈128）——屏幕区内无缝隙。

宁可略大不可露出直角。水平半径 % = a / 面板宽，垂直半径 % = b / 面板高。

### 三层裁切链（`overflow: hidden`）

1. `.pom-root` / `.pom-single`：图片裁切层，作品图以超出尺寸 + 负偏移实现裁剪（见下方图片裁剪规范）；
2. `#portfolioViewer.pom-frame-mode`：面板层裁切 + `12.8% / 6%` 椭圆圆角；
3. `#videoFrame`：`overflow: hidden` + `border-radius: 12% / 5%`，物理边界最终防线。

### 后续新内容适配指南

新增 viewer / 内容类型需要贴合手机边框时：

1. **frame 宽高比**：frame 宽必须 `calc(<高度基准> × 1304 / 2866)`，不得偏离素材比例，否则 `::after` 的 contain 缩放会使边框与内容错位；
2. **面板 inset**：`5% 5%` 起步（对应素材 bezel 内缘安全边：左右 65px / 上下 143px）；
3. **面板圆角**：按上文换算方法求椭圆半径（覆盖屏幕弧、不越 bezel 弧，宁大勿小），写 `border-radius: a% / b%`（相对面板自身尺寸）；
4. **刘海安全区**：刘海 x∈[26.1%, 73.9%]、底 9.49%；顶部 tab 类内容 `padding-top ≥ 5%`（music 的做法）；正文延伸到刘海下方是允许的；
5. **图片裁剪规范**：单图 cover 填充当前实现为 `.pom-single-img`：`width: 100.5587%`、`height: 125%`、`left: -0.2793%`、`top: -12.5%` + 容器 `overflow: hidden`——效果为上下各裁原图约 10%、左右各约 3px，铺满屏幕区（含沉浸带）且不露黑边；
6. **验证流程**：CDP 实测（桌面 1440×900 + 窄屏 900×1000，单浏览器实例）：截图像素断言四角角区（屏幕弧外、素材 alpha=0 且 5×5 邻域全透明的点）中灰色照片像素占比 ≤2%，另验刘海暗像素、上下空隙、frame 比例。

## 模块组件对应关系

| 行标题 | ViewerMode | 组件 | API |
|--------|-----------|------|-----|
| recently played | `music` | `components/MusicModule.tsx` | `/api/spotify/recently-played`、`/api/spotify/albums` |
| arc vinyl | `showcase` | `components/AlbumShowcase.tsx` | 本地静态资源（`public/music-cover-3d/`） |
| playlist | `playlist` | `components/PlaylistModule.tsx` | `/api/netease/playlist` |

## 缓存策略

| 数据源 | 缓存层次 |
|--------|---------|
| Spotify | 三层缓存：Next.js ISR 1h + 服务端内存 `Map` 1h（`lib/spotify.ts` 的 `apiCache`）+ 客户端模块级缓存 1h（`MusicModule.tsx`） |
| 网易云歌单 | Next.js `revalidate` 1h + 客户端模块级缓存 1h（`PlaylistModule.tsx`） |

**预加载**：页面加载 2s 后调用 `warmMusicCache()` / `warmPlaylistCache()`，在用户 hover 触发 viewer 前提前写入客户端模块级缓存，避免首次打开出现 loading 态。

## 加载动画（LoadingScreen）

| 场景 | 行为 |
|------|------|
| 首次访问（无 `localStorage.gk3-visited` 且缓存无效） | 显示加载动画，并行预加载 3 个数据源，完成后淡出过渡到主页 |
| 再次访问（有缓存或已标记访问过） | 跳过动画，恢复上次滚动位置（`localStorage.gk3-scroll`） |
| 超时保底 | 最多等 8s，超时直接跳过 |

**组件**：`components/LoadingScreen.tsx` + `LoadingScreen.css`

**视觉**：深色背景 + 黑胶旋转环 + 极细进度线 + Ellograph 字体呼吸动效，淡出 0.75s。

## 开发环境

### 启动

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm build      # 生产构建
pnpm start      # 生产启动
```

### 环境变量

`.env.local`（已 gitignore，勿提交真实值）：

| Key | 用途 |
|---|---|
| `SPOTIFY_CLIENT_ID` | Spotify 应用 Client ID |
| `SPOTIFY_CLIENT_SECRET` | Spotify 应用 Client Secret |
| `SPOTIFY_REDIRECT_URI` | OAuth 回调地址，须与 Spotify 后台一致（如 `http://localhost:3000/api/auth/spotify/callback`） |

### Spotify 授权（首次配置）

1. 在 [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) 创建应用，Redirect URI 填 `http://localhost:3000/api/auth/spotify/callback`
2. 将 Client ID / Secret / Redirect URI 写入 `.env.local`
3. 启动 dev server，浏览器访问 `/api/auth/spotify` 完成授权
4. token 自动写入 `lib/spotify-token.json`（gitignore），后续自动续期，无需重复授权

## 当前状态

**已完成**：
- Gk3Clone 主体（行列表、Viewer、颜色旋转、WebGL 背景、噪点层）
- Spotify OAuth 全链路 + 三个数据 API + MusicModule（最近收听/专辑推荐双 Tab、Embed 播放）
- AlbumShowcase（music-cover-3d iframe 嵌入）

**已知问题 / 待优化**：
- `components/` 下 Hero/About/Work/Contact/Listening/Navbar/PortfolioGallery/SmoothScroll/CardSwap/CircularGallery/Grainient/ThreeDCardStack 等早期组件未接入页面
- `lib/data.ts` 中 profile/socials 仍为占位内容，elsewhere 行链接仍指向 GK3 原站
- `public/images/` 下 PNG 总体积超 100MB，影响加载性能
- WebGL 渲染循环无页面不可见（visibilitychange）暂停机制
- `.music` viewer 容器背景透明，内容会透出后方页面元素
- 根目录残留大量 `screen_*.png` 验证截图

## 开发约定

- **代码风格**：2 空格缩进、单引号（Gk3Clone.tsx 历史上用双引号，改动时跟随所在文件）、语句带分号
- **组件命名**：PascalCase 文件名 + default export（`MusicModule.tsx`）；Gk3Clone 为具名导出 `export function Gk3Clone()`
- **CSS 类名前缀**：独立功能模块使用统一前缀避免与宿主冲突——MusicModule 用 `mm-`，AlbumShowcase 用 `as-`；根元素需显式 `pointer-events: auto`
- **服务端隔离**：`lib/spotify.ts` 仅限 Node runtime 的 route.ts 引入，禁止进入客户端组件
- **Next.js 15 动态路由**：`params` 类型为 Promise，必须 `const { id } = await params;`，且对外部传入 ID 做正则校验后再拼接上游 URL

**扩展新 viewer 行的方法**（以新增 `gallery` 为例）：
1. `ViewerMode` 联合类型中加入 `"gallery"`
2. `rows` 数组新增条目：`{ id: "gallery", title: ..., items: [{ text: "...", viewer: "gallery", rowId: "gallery" }] }`
3. 组件 JSX 中仿照 music 分支添加条件渲染：`{viewing && viewerClass === "gallery" && (<div id="galleryViewer" onMouseEnter={cancelEndViewerTimer} onMouseLeave={...}><YourModule /></div>)}`
4. `Gk3Clone.css` 中为新 viewer 容器补充定位/尺寸样式（可参考 `.music` 模式：隐藏视频框、绝对定位）
5. 新模块组件使用自己的类名前缀（如 `gm-`）
