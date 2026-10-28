# GitHub Pages（github.io）能否替代 Vercel：实测与结论

日期：2026-10-19　背景：用户问「如果改成放到 github 上，用 github.io 呢？」

---

## 一、线路：github.io 在国内**可达且比 Vercel 快**

### DNS 未被污染

`github.io` / `pages.github.com` / `jekyllrb.com` 在阿里 223.5.5.5、DNSPod 119.29.29.29、114 上
**一致返回 GitHub Pages 官方 anycast 段** `185.199.108–111.153` —— 没有出现污染。

（对比 `*.vercel.app`：四个解析器返回四个不同的假 IP，全是 Facebook/Dropbox 段。）

### 直连握手正常

| 目标 | HTTP | TCP | TLS 完成 |
|---|---|---|---|
| pages.github.com | 200 | 0.105 s | **0.237 s** |
| jekyllrb.com | 200 | 0.101 s | **0.238 s** |

### 吞吐对比（同一连接复用，扣掉首次 TLS 握手）

| 目标 | 请求数 | 总字节 | 纯传输 | 吞吐 | 抖动 σ |
|---|---|---|---|---|---|
| **github.io**（jekyllrb.com） | 18 | 253 KB | 2.14 s | **118 KB/s** | **0.07 s** |
| **Vercel**（nextjs.org） | 18 | 7444 KB | 135.61 s | **55 KB/s** | **5.99 s** |

**github.io 吞吐约为 Vercel 直连的 2.1 倍，抖动只有其 1/85（0.07s vs 5.99s）。**

### 但 raw.githubusercontent.com 被单独阻断

`raw.githubusercontent.com` 直连 **15 秒超时**（TCP 都连不上）。
影响：若用 raw 直链做图片/资源引用会挂；CI 里拉取也会受阻。正式站点不依赖它则无碍。

---

## 二、致命问题：GitHub Pages 跑不了你的站

| 你的站需要 | GitHub Pages 能否 |
|---|---|
| 8 个服务端 API 路由（Spotify OAuth/最近播放/专辑、网易云、iTunes） | ❌ 只托管静态文件，无 Node 运行时 |
| `SPOTIFY_CLIENT_SECRET` / `SPOTIFY_REFRESH_TOKEN` 服务端密钥 | ❌ 没有服务端，密钥只能暴露给前端 |
| Next.js 服务端渲染（无 `output: 'export'`） | ❌ 需改成静态导出，功能受损 |
| `public/` 846.9 MB 素材 | ⚠️ 站点 1 GB 软上限、单文件 100 MB 硬上限（当前无超限单文件） |
| 每月流量 | ⚠️ 100 GB/月 软上限；846MB 素材 + 作品集浏览，容易触顶 |

**GitHub Pages 只能部署"纯静态导出版"。** 那版会丢掉音乐/歌单/专辑等所有动态功能，
首页的音乐模块会变成空壳。

---

## 三、结论与建议

**单看"国内能进、还更快"：github.io 确实优于 Vercel 直连（118 vs 55 KB/s，且稳定得多）。**
**但作为你的主站托管：不行**，因为它是纯静态。

### 可行的三种组合

| 方案 | 做法 | 评价 |
|---|---|---|
| **A. 保持 Vercel + 自定义域名** | 绑自己的域名（SNI 不含 vercel.app 即通），Cloudflare 只做 DNS（灰云） | 功能零损失；速度仍是 Vercel 直连水平 |
| **B. 拆分：静态走 GH Pages，API 留 Vercel** | 前端静态导出到 `username.github.io`，8 个 API 仍留 Vercel，跨域调用 | 快，但要处理跨域/CORS、OAuth 回调域名、两套部署；工作量中等 |
| **C. 静态站整体迁 GH Pages** | 放弃音乐/歌单等动态功能 | 不推荐，功能残缺 |

**B 是"既快又保住功能"的路线**，代价是架构变复杂：跨域、cookie、OAuth 回调都要重新配。

---

## 四、本任务产物

| 文件 | 用途 |
|---|---|
| `measure-github-io.ps1` | github.io 系列 DNS + 直连 + 吞吐实测（含 raw.githubusercontent.com） |
| `compare-gh-vs-vercel.py` | 同尺寸连接复用吞吐对比（github.io vs Vercel），输出抖动 |
| `github-io.txt` / `gh-vs-vercel.txt` | 原始输出 |

> 测量口径：全部 `--noproxy '*'`，即**不走本机代理**，代表真实国内访客路径。
> 本机系统代理为 `127.0.0.1:7890`，`Invoke-WebRequest` 会走代理，`curl.exe` 不会 —— 注意区分。
