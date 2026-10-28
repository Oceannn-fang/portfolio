# 胶片大图体积治理 + 国内可达性根因取证

日期：2026-10-15
起因：线上站点需 VPN 才能访问，目标是在国内可直连。

## 一、根因取证（实测，非推测）

### 1. 域名 DNS 污染（决定性问题）

`oceanfolio.vercel.app` 在多个国内解析器上返回**互不相同且不属于 Vercel** 的 IP：

| 解析器 | 返回 IP | 实际归属 |
|---|---|---|
| 223.5.5.5（阿里） | 128.242.245.180 | Verizon/美国 |
| 119.29.29.29（腾讯） | 31.13.94.37 | Facebook |
| 114.114.114.114 | 199.59.148.8 | Twitter |
| 180.76.76.76（百度） | 199.16.158.9 | Twitter |
| 本地 8.8.8.8 | 162.125.2.6 | Dropbox |

对照组 `github.io` 返回正确的 `185.199.108-111.153`，证明测量方法有效。
答案互相矛盾 + 指向无关网段 = 典型的 DNS 污染，**不是 Vercel 配置问题**。

### 2. Vercel 的 IP 本身在国内可达

| 探测 | 结果 | 含义 |
|---|---|---|
| `cname.vercel-dns.com` → 76.76.21.241，直连 TCP 443 | 通 | anycast IP 未被封 |
| 对 76.76.21.241 发真实 HTTPS（SNI=vercel.com） | `200` | TLS 握手可完成 |
| 直连 `oceanfolio.vercel.app` | `000`（无响应） | **只有该域名被污染** |
| 直连 `music.163.com` | `200` / 0.49s | 证明未走代理，测的是真实国内链路 |

结论：**绑定自定义域名绕过 `*.vercel.app` 污染在技术上成立**，无需换机房。
但跨境总耗时 9.3s / 12.0s，属"能通但很慢"。

> 说明：本机全程运行 Clash Verge（verge-mihomo，混合端口 7897）且开启 TUN/fake-ip，
> 所有域名默认解析到 `198.18.x.x`。以上结论均在关闭 TUN 后测得。

## 二、真正的体验瓶颈：静态资源 823.6MB

`public/` 实测 **823.6MB / 653 文件**：

| 类型 | 数量 | 体积 |
|---|---|---|
| .jpg | 111 | 555.7MB |
| .png | 70 | 224.8MB |
| .woff2 | 339 | 12.4MB |

胶片原图单张 7–20MB（4556×3047）。而灯箱直接引用原图
（`components/FilmArchiveModule.tsx` 的 `activeFrame.src`），还有邻帧预载
（`image.src = frame.src`）——浏览一卷 40 帧即需下载 **540MB**。

## 三、本次改动

只做一处外科手术式改动：把**灯箱大图**指向 web 衍生图，UI 代码零改动。

| 文件 | 改动 |
|---|---|
| `public/images/film/roll-017/web/*.jpg` | 新增 40 张衍生图（长边 2000 / q82 / progressive），13.5MB |
| `lib/film-rolls.ts` | `src` 由 `/images/film/roll-017/NNNNNN.jpg` 改为 `/images/film/roll-017/web/NNNNNN.jpg`；原图路径写入注释 |
| `README.md` | `public/` 目录说明补一行 web 大图约定 |
| `scripts/_film-web-20261015/make-sample.py` | 生成脚本（只读原图，只写新文件） |
| `scripts/_film-web-20261015/make-compare.py` | 像素级对照取证脚本 |

**原图未做任何改动、未删除、未移动**，仍可随时回退（改回 `src` 模板即可）。

### 收益

| 指标 | 改前 | 改后 | 变化 |
|---|---|---|---|
| 灯箱单张 | 7–20MB | 0.15–0.47MB | 约 32–69× |
| 浏览一卷 40 帧 | 540MB | 13.5MB | **省 97.5%** |
| 网格缩略图 | 不变 | 不变 | — |

### 画质取证

`compare-000043.jpg`：同一区域，上=原图 1:1，下=衍生图按比例换算后放大到同尺寸
（**最坏情况**，放大倍数 2.3×，且选的是颗粒最密集的树叶区）。
结论：胶片颗粒保留、无块状伪影/色带，仅轻微软化，可接受。

## 四、验证记录

| 项 | 命令 | 结果 |
|---|---|---|
| 类型检查 | `npx tsc --noEmit` | 退出码 0，无输出 |
| 生产构建 | `pnpm build` | 成功，路由表与改前一致（6 个 `ƒ` 动态 + 静态页） |
| 页面输出 | `curl http://127.0.0.1:3211/film/roll-017` | web 衍生图引用 40 处、原图直引 **0** 处、缩略图 80 处 |
| 资源可达 | `curl /images/film/roll-017/web/000043.jpg` | `200` / 488197B / 0.013s |
| 真实交互 | CDP 打开灯箱 | `src=/images/film/roll-017/web/000001.jpg`，naturalSize 2000×1338，complete |
| 邻帧预载 | CDP 网络日志 | 打开第 1 帧时预载 web/000074、web/000002 |
| 首页 viewer | CDP hover film 行 | 3 张缩略图 + `+37` + OPEN ROLL 正常 |
| 控制台 | CDP 日志 | **0 error**（仅 12 条既有 CSS preload 警告，与本次改动无关） |

验证视口：CDP 单实例，1440×900。
截图：`evidence-grid.png`、`evidence-lightbox.jpg`、`evidence-home-viewer.jpg`。

## 五、未完成 / 需要人工决策的部分

1. **域名层**（决定性，我无法代做）：需购买域名并绑定到 Vercel；
   或迁移到境内节点（需 ICP 备案）。二者都必须由用户操作 DNS/备案。
2. **Spotify 内嵌播放器**（`components/MusicModule.tsx`）：`open.spotify.com/embed`
   在国内被墙，浏览器端必然空白。曾于 2026-10-16 实现并验证过「展开即探测同域可达性，
   6 秒内不可达则降级为网易云搜索入口」（实测降级延迟 6492ms），但**用户决定整体回退，
   当前只保留官方 Spotify 播放器**（文件已还原到 HEAD）。取证与实现记录见
   `spotify-embed-fallback_20261016_v1/README.md`（含"若要重新启用"的完整方案）。
3. `public/` 仍有 823.6MB 原图随部署上传，托管平台对部署体积若有上限需另作处理
   （删除不在允许范围内，应改为交付端决策）。

## 六、回退方式

`lib/film-rolls.ts` 中把
`src: \`/images/film/roll-017/web/${number}.jpg\``
改回
`src: \`/images/film/roll-017/${number}.jpg\``
即恢复原行为；衍生图目录留着不影响。
