 # 个人作品集网站 — 搭建方案总览
 
 本文档记录个人作品集网站的完整搭建方案，体现用户需求、设计目标、技术选型以及最终实现效果。可作为后续同类项目的参考资料。
 
 ---
 
 ## 一、设计目标与效果要求
 
 | 维度 | 需求描述 |
 |------|----------|
 | 整体风格 | 极简风，干净留白，不堆砌元素 |
 | 背景质感 | 胶片噪点肌理（动态颗粒感，非纯色平铺），呼吸动画 |
 | 色系参考 | Lu1 专辑《Blue》—— 冷静、深邃、有呼吸感的蓝调氛围 |
 | 中文排版 | 使用本地已安装的衬线体 |
 | 英文排版 | 本地衬线体用于主要标题，无衬线体用于 UI 标签 |
 | 作品集展示 | 胶片底片边框（穿孔效果），卡片自动轮换，点击可全屏查看，弹窗有开合动画 |
 | 专辑展示 | 椭圆轨道循环滚动，悬停暂停并显示专辑名/歌手名 |
 | 歌单浏览 | 水平滚动专辑列表，点击展开完整曲目，可跳转 Spotify 收听 |
 | 动效期望 | 顺滑不卡顿，有交互反馈（悬停/点击/展开），不在滚动时造成性能负担 |
 | 部署方式 | 部署至公网，使用 Vercel 平台 |
 | 源码管理 | Git + GitHub 托管 |
 
 ---
 
 ## 二、技术栈
 
 | 层 | 选用技术 | 选型理由 |
 |------|----------|----------|
 | 框架 | Next.js 15 | React 生态，SSG 静态导出，Vercel 原生适配 |
 | 语言 | TypeScript | 全量类型安全 |
 | 样式 | Tailwind CSS v4 + CSS 自定义属性 | 快速布局，配合 `@theme` 定义设计 token |
 | 主流动画 | motion (framer-motion v11) | 声明式 API，适合滚动入场/弹窗/展开等常见场景 |
 | 复杂动画 | GSAP v3 (gsap) | 时间线控制能力强，适合卡片轮换等序列动画 |
 | 噪点背景 | ogl (WebGL2) | GLSL 着色器实现，性能优于 Canvas，支持实时参数调节和呼吸动效 |
 | 轨道动效 | CSS `offset-path` + motion `useTransform` | 纯 CSS 路径动画轻量高效，配合 motion 响应式更新 `offsetDistance` |
 | 字体加载 | `next/font/local` | 加载本地字体文件，零外部请求，离线可用 |
 | 包管理 | pnpm | 快速、节省磁盘 |
 | 部署 | Vercel CLI | 一行命令部署，自动 HTTPS 和 CDN |
 
 ---
 
 ## 三、设计语言系统
 
 ### 配色方案
 
 最终采用 **纯白底色（#ffffff）+ 稀疏黑色噪点**，保持页面干净的同时通过噪点承载胶片肌理感。
 
 灵感来源 Lu1《Blue》的冷静蓝调，将蓝色压缩为点缀色（强调色 hover、渐变高光），不喧宾夺主。
 
 ### 字体系统
 
 | 角色 | 字体 | 变量名 |
 |------|------|--------|
 | 中文衬线体 | 方正小标宋简体 | `--font-fzxiaobiaosong` |
 | 英文衬线体 | BonaNova Regular / Bold | `--font-bona-nova` |
 | 英文无衬线体 | Satoshi Light / Medium / Bold | `--font-satoshi` |
 
 所有字体通过 `next/font/local` 加载，每套字体独立 CSS 变量，可在组件中按需使用。
 
 ### 视觉关键词
 
 - 极简：大量留白，克制排版，单色为主
 - 胶片质感：卡片底片穿孔边框、背景颗粒噪点
 - 呼吸感：噪点强度随时间正弦波动
 - 交互细节：悬停显示信息、点击展开详情、滚动平滑
 
 ---
 
 ## 四、组件架构与交互效果
 
 ### 4.1 背景 - Grainient（噪点肌理）
 
 **实现方式**：WebGL2 全屏着色器
 
 - 使用 ogl 库渲染一个全屏 Triangle mesh，片元着色器生成伪随机噪点
 - 噪点有可调节参数：密度(density)、强度(amount)、缩放(scale)、动画速度(speed)
 - 噪点强度叠加 `sin(time)` 呼吸效果，视觉上像胶片颗粒在微动
 - `pointer-events: none`，不干扰页面交互
 - 通过 `IntersectionObserver` + `visibilitychange` 控制渲染启停，避免不可见时浪费性能
 
 ### 4.2 首屏 - Hero
 
 - 居中展示姓名（英文衬线大字，带蓝调渐变）、英文 tagline、中文 tagline
 - 滚动渐隐效果：结合 `useScroll` + `useTransform` 实现
 - 底部滚动指示器：向下箭头动画
 - 全部元素依次淡入（stagger delay）
 
 ### 4.3 导航 - Navbar
 
 - 固定顶部，滚动后背景模糊过渡
 - 顶部精细滚动进度条（spring 弹性动画）
 - 右侧三个锚点链接：About / Work / Contact
 
 ### 4.4 简介 - About
 
 - 英文引言（斜体）+ 中文简介
 - 时间线列表：年份 + 职位 + 公司 + 描述
 - 每行间隔细线分隔，滚入渐显
 
 ### 4.5 项目 - Work
 
 - 纵向项目列表，每行标题 + 标签 + 年份 + 箭头
 - 悬停时左侧 padding 微移动 + 背景渐变光晕
 - 箭头悬停旋转 90° 弹簧动画
 
 ### 4.6 作品集 - PortfolioGallery + CardSwap
 
 **布局**：左文字说明 + 右卡片轮换，两列网格
 
 **CardSwap 卡片轮换**（GSAP 实现）：
 - 卡片斜向等距排列（类似松散的扑克牌堆叠）
 - 每隔 5 秒触发一次时间线：最前卡片向下掉落 → 后续卡片依次前移 → 掉落卡片回到队列末尾
 - 悬停时暂停轮换，点击可手动触发切换 + 打开弹窗
 - 卡片尺寸适配手机竖版图片比例（280 × 480）
 
 **胶片底片边框**（CSS 实现）：
 - 使用 `repeating-linear-gradient` 模拟胶片穿孔（sprocket holes）
 - 叠加 `outline + border + box-shadow` 实现多层边框层次
 
 **弹窗（drawer animation）**：
 - 点击卡片 → 全屏半透明背景（`backdrop-filter: blur`）
 - 弹窗以 `scale(0.85) + y上升 + opacity` 方式入场，退出时反向缩小下落
 - 左右箭头可切换浏览，点击背景或按 Escape 关闭
 
 ### 4.7 最近收听 - Listening + OrbitImages
 
 **轨道循环**（CSS offset-path + motion）：
 - 专辑封面沿扁平椭圆路径循环旋转（35 秒一圈）
 - 使用 CSS `offset-path: path()` 定义路径，motion `useTransform` 逐帧更新 `offsetDistance`
 - 初始填充位置均匀分布（`fill=true`），非串联追逐
 
 **交互**：
 - 悬停任意封面 → 整个轨道暂停 → 中央浮出卡片显示专辑名 + 歌手
 - 离开 → 恢复正常循环
 
 ### 4.8 专辑曲目 - CircularGallery
 
 **专辑列表**：
 - 水平可横向滚动的一排专辑芯片（小封面 + 名称）
 - 点击专辑 → 下方展开曲目列表（`AnimatePresence` 高度动画过渡）
 - 曲目列表显示全部曲目，编号 01-10+
 - 有 Spotify URL 的专辑显示绿色"Listen on Spotify"按钮
 
 ### 4.9 联系 - Contact
 
 - 居中显示邮箱（大字修饰）、社交链接（GitHub/Twitter/LinkedIn/Instagram）
 - 底部署名"Next.js / Motion / Tailwind"
 - 邮箱和社交链接悬停变蓝色
 
 ### 4.10 平滑滚动 - SmoothScroll
 
 - 包裹全部页面内容，劫持 `a[href^="#"]` 锚点点击，使用 `scrollTo({ behavior: 'smooth' })` 实现段间平滑跳转
 - 考虑了 Navbar 高度偏移（`-80px`）
 
 ---
 
 ## 五、动画引擎分工
 
 | 动画类型 | 引擎 | 原因 |
 |----------|------|------|
 | 滚动入场（whileInView） | motion | 声明式，一句配置完成 |
 | 弹窗/展开/折叠 | motion | AnimatePresence + 状态驱动 |
 | 悬停反馈 | motion | whileHover / onMouseEnter |
 | 背景噪点呼吸 | GLSL (ogl) | 不可用 JS 引擎替代 |
 | 轨道循环 | CSS offset-path + motion | 轻量纯 CSS 路径 + motion 控制 offset |
 | 卡片轮换时间线 | GSAP | 需要精确控制序列/delay/easing 链条 |
 
 **性能优化措施**：
 - 移除 Lenis，改用原生 `scroll-behavior: smooth`
 - 噪点使用 `IntersectionObserver` 监控可见性，不可见时停止渲染
 - 使用 `will-change: transform` 和 `force3D: true` 启用 GPU 加速
 - GSAP timeline 复用，避免频繁创建/销毁
 
 ---
 
 ## 六、数据管理
 
 所有展示内容集中在 `lib/data.ts` 一个文件中，组件只读取数据，不包含硬编码内容。
 
 | 数据块 | 内容说明 |
 |--------|----------|
 | `profile` | 姓名(中/英)、标语(中/英)、简介、邮箱、社交链接 |
 | `portfolioImages` | 作品集图片路径 + 标题 + 分类 |
 | `recentAlbums` | 近期专辑：封面路径、名称、歌手、Spotify URL、曲目列表 |
 | `extraAlbums` | 额外专辑（与 recentAlbums 合并得到 30 张） |
 | `works` | 项目列表：标题、副标题、年份、描述、标签、链接 |
 | `timeline` | 时间线条目：年份、职位、公司、描述 |
 
 **静态资源**：
 - 专辑封面 → `public/images/albums/`
 - 作品集图片 → `public/images/portfolio/`
 - 字体文件 → `fonts/`
 
 ---
 
 ## 七、使用到的 Skills 与工具
 
 | 工具 | 用途 |
 |------|------|
 | find-skills | 发现可用的 Codex skills |
 | frontend-design skill | 前端设计规范与美学指导 |
 | visualize skill | 交互组件方案构思 |
 | in-app browser（插件） | 本地开发实时预览 |
 | playwright skill | 浏览器自动化测试与截图 |
 | React Bits MCP Registry | 参考组件源码（Noise / CardSwap / Grainient / OrbitImages） |
 | GitHub CLI | 仓库创建、代码推送 |
 | Vercel CLI | 部署上线 |
 
 **React Bits 配置**（`.agents/mcp.json`）：
 ```json
 {
   "registries": {
     "@react-bits": "https://reactbits.dev/r/{name}.json"
   }
 }
 ```
 
 ---
 
 ## 八、关键决策与演进记录
 
 | 阶段 | 初始方案 | 最终方案 | 原因 |
 |------|----------|----------|------|
 | 背景噪点 | Canvas 2D Noise 组件 | GLSL 着色器 (ogl) | 性能更好，支持呼吸动效，参数可控 |
 | 平滑滚动 | Lenis 库 | 原生 `scroll-behavior: smooth` + 自定义锚点 | Lenis 导致滚动卡顿，移除后大幅提升帧率 |
 | 作品集弹窗尺寸 | 全屏显示图片 | 抽屉式开合 + 限制最大尺寸 | 用户反馈全屏"太大了"，改为适中尺寸 + 动效 |
 | 作品集导航 | 无 | 左右箭头切换 | 用户需要能浏览前后图片 |
 | 专辑展示 | 3D carousel | CSS offset-path 椭圆轨道 | 3D 方案复杂且难控制，CSS 方案轻量稳定 |
 | 整体色系 | 初版配色接近蓝色 | 纯白背景 + 稀疏黑色噪点 | 极简调性 + 噪点作为肌理而非装饰 |
 
 ---
 
 ## 九、项目结构
 
 ```text
 .
 ├── app/
 │   ├── page.tsx              # 主页面，串联所有 section
 │   ├── layout.tsx            # 根布局，字体加载 + SmoothScroll
 │   └── globals.css           # 全局样式 + Tailwind @theme token
 ├── components/
 │   ├── Navbar.tsx            # 固定导航 + 滚动进度条
 │   ├── Hero.tsx              # 首屏
 │   ├── About.tsx             # 简介 + 时间线
 │   ├── Work.tsx              # 项目列表
 │   ├── PortfolioGallery.tsx  # 作品集弹窗 + 导航
 │   ├── CardSwap.tsx          # GSAP 卡片轮换引擎
 │   ├── CardSwap.css          # 胶片边框样式
 │   ├── Listening.tsx         # 椭圆轨道专辑展示
 │   ├── OrbitImages.tsx       # CSS offset-path 轨道组件
 │   ├── OrbitImages.css       # 轨道容器样式
 │   ├── CircularGallery.tsx   # 专辑曲目浏览 + Spotify
 │   ├── CircularGallery.css   # 曲目列表样式
 │   ├── Grainient.tsx         # GLSL 噪点背景
 │   ├── Grainient.css         # 噪点容器样式
 │   ├── Contact.tsx           # 联系信息
 │   └── SmoothScroll.tsx      # 原生平滑滚动
 ├── lib/
 │   └── data.ts               # 所有内容数据
 ├── fonts/                    # 本地字体文件
 ├── public/images/
 │   ├── albums/               # 专辑封面
 │   └── portfolio/            # 作品集图片
 ├── .agents/mcp.json          # React Bits registry
 ├── next.config.ts
 ├── postcss.config.mjs
 ├── package.json
 ├── vercel.json               # Vercel 部署配置
 └── tsconfig.json
 ```
 
 ---
 
 ## 十、后续可扩展方向
 
 - 接入 Spotify API / 网易云 API，自动拉取听歌记录
 - 接入 CMS（Contentful / Sanity）管理作品和文案
 - 暗色模式切换，适配用户偏好
 - 国际化（中英文切换，目前文案已准备双语数据）
 - 图片懒加载 + 低质量占位图（LQIP）渐进加载
 - 将 React Bits 组件从内联源码替换为 npm 包依赖
 - 接入统计（Plausible / Google Analytics）了解访问情况
 - PWA 支持：manifest + service worker 离线缓存
 
 ---
 
 *最后更新: 2026-07-17*
 *本文档记录的是设计方案与效果目标，不包含具体的项目路径和部署地址。*
