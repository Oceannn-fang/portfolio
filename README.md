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
