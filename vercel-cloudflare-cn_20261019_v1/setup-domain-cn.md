# 手把手：Cloudflare 托管 DNS + 绑自定义域名，让国内能直接打开

日期：2026-10-19（按用户要求：**不用腾讯云 DNSPod，DNS 放 Cloudflare**）
适用：Vercel 项目 `oceanfolio` + 自有域名 + **Cloudflare 管 DNS**

> 原理（已实测）：`*.vercel.app` 在国内既被 **DNS 污染**，`vercel.app` 这个 **SNI 又被 RST**；
> 同一个 Vercel IP 换成 `vercel.com` / `nextjs.org` 这类 SNI 就是 **200**。
> 所以**换成自己的域名即可直连**；Cloudflare 在这里的角色，**推荐只做 DNS（灰云）**。

---

## 核心决策：灰云还是橙云？

| | 灰云（DNS only） | 橙云（Proxied） |
|---|---|---|
| 链路 | 访客 → Vercel（SNI=你的域名） | 访客 → Cloudflare → Vercel |
| 国内实测 | **握手快、可用**（Vercel IP 直连 200，appconnect 0.66s） | **只有 13/22 个 CF 段可用**，TLS 完成 0.18–1.9s，取决于命中哪个段 |
| 风险 | Vercel IP 段哪天被封就没辙 | CF 有 41% 的段在国内 TCP 直接不通（实测：104.19/104.22/104.23/172.64/172.67/173.245/190.93/197.234） |
| 额外好处 | 极简、少一跳 | 隐藏源站 IP、可做边缘缓存/WAF |

**建议：先用灰云落地（能进且更快）；橙云作为"Vercel 被封时的备胎"，或需要边缘缓存时再开。**

---

## 第 0 步：前置

1. **域名实名认证**：域名在哪家注册就在哪家认证（腾讯云注册的域名**必须**在腾讯云完成实名，否则域名会被
   `serverHold`，**解析根本不生效** —— 这与 DNS 放哪家无关）。控制台 → 域名注册 → 我的域名 → 状态应为「正常」。
2. 记下域名的**注册商管理入口**（要改 NS 的地方）。
3. ICP 备案**不需要**（源站在 Vercel 海外）；只有以后要走国内 CDN/节点才需要。

---

## 第 1 步：把域名接入 Cloudflare

1. https://dash.cloudflare.com → **Add a site** → 输入域名 → 选 **Free** 计划。
2. Cloudflare 会扫描现有解析并给出**两个 NS 地址**（形如 `xxx.ns.cloudflare.com`）。
3. 回**域名注册商**处把 DNS 服务器改成这两个：
   - 腾讯云：域名注册 → 我的域名 → 该域名 → **修改 DNS 服务器** → 填 Cloudflare 的两个 NS。
   - ⚠️ 改 NS 后**腾讯云 DNSPod 的解析全部失效**（Cloudflare 变成权威 DNS）。
4. 等 Cloudflare 显示域名状态 **Active**（通常几分钟到 24 小时，取决于 NS 缓存）。

---

## 第 2 步：Cloudflare DNS 里加记录（先灰云）

Cloudflare → 你的域名 → **DNS → Records** → Add record：

| Type | Name | Content | Proxy status |
|---|---|---|---|
| **CNAME** | `@` | `cname.vercel-dns.com` | **DNS only（灰云）** |
| **CNAME** | `www` | `cname.vercel-dns.com` | **DNS only（灰云）** |

说明：
- **Cloudflare 根域支持 CNAME 且会自动「拉平」**（flatten 成 A 记录）——这是它比 DNSPod 省事的地方。
- 如果 Vercel 面板给出的是具体的 A 值（如 `76.76.21.21`），也可以改成 `A @ → 76.76.21.21`，**以面板为准**。
- 灰云时 Cloudflare 只做 DNS，TLS/HTTPS 完全由 Vercel 负责，SSL/TLS 那一页的设置此时不影响访问。
- 删掉 Cloudflare 扫描进来的**旧记录**（指向别处的 A/CNAME），避免冲突。

---

## 第 3 步：Vercel 加域名

1. Vercel → 项目 **oceanfolio** → **Settings → Domains** → 输入域名 → **Add**；`www` 也加，并把 `www` 设为
   **Redirect to 根域**。
2. 等状态变成 **Valid Configuration** + **SSL Certificate 已签发**。
3. 若一直 Invalid：按 Vercel 面板给出的**确切记录值**回到 Cloudflare 改（面板有时给的是 A 值或要求加 TXT）。

---

## 第 4 步：环境变量 + 重新部署

Vercel → Settings → Environment Variables：`NEXT_PUBLIC_SITE_URL = https://你的域名`
→ Deployments → 最新部署 **Redeploy**（环境变量要重新部署才生效）。

Spotify：**收听数据不需要重新授权**（token 在服务端、与域名无关）；只有将来要重新授权时，
才在 Spotify 后台把 `https://你的域名/api/auth/spotify/callback` 加进 Redirect URIs。

---

## 第 5 步：验收（两条都要过）

1. 本机脚本（强制不走代理，等于真实访客路径）：

```powershell
powershell -ExecutionPolicy Bypass -File "E:\portfolio\vercel-cloudflare-cn_20261019_v1\verify-domain.ps1" -Domain 你的域名
```

合格：DNS 解析到 **76.76.21.x / 66.33.60.x**；直连 **`http_code=200` 且 `ssl_verify=0`**；`http://` 能 308 跳 `https://`。

2. **手机蜂窝网络**：关 Wi-Fi、**不开任何代理/VPN**，4G/5G 打开 `https://你的域名`。

---

## 第 6 步（可选）：改橙云

1. 先在灰云状态完成 Vercel 验证与证书签发（**不要一上来就开橙云**，否则 Vercel 的 DNS 校验看不到自己的 IP）。
   若 Vercel 面板给了 **TXT 校验值**，按面板加 TXT 后可以直接开橙云。
2. Cloudflare → DNS → 把两条记录的云朵点成 **Proxied（橙云）**。
3. **SSL/TLS → Overview 设为 Full (strict)**（**千万不要 Flexible**，Vercel 强制 HTTPS，会形成重定向环）。
4. 打开 **Always Use HTTPS**。
5. 缓存：CF 默认会缓存静态扩展名（图片/CSS/JS）。要更激进可加 Cache Rule 对 `/images/*`、`/_next/static/*`
   设长缓存（HTML 不建议缓存）。
6. 真实访客 IP 在 **`CF-Connecting-IP`** 头里（Vercel 侧若用到 IP 需注意）。
7. ⚠️ **CF 免费版没有中国节点**（中国网络要企业版 + ICP 备案）。橙云后若国内变慢或不通，
   先回第 7 步看是不是命中了不可用段。

---

## 第 7 步：橙云在国内的 IP 段实测（本轮数据）

方法：统一用 `SNI=cloudflare.com` 直连各 CF anycast IP（`probe-cf-ips.ps1`，可重跑）。

**可用（13 个，TLS 完成耗时由快到慢）**

| IP | TLS 完成 |
|---|---|
| 108.162.192.1 | 0.18 s |
| 162.159.0.1 | 0.18 s |
| 172.66.0.1 | 0.51 s |
| 104.17.209.9 | 0.57 s |
| 104.18.0.1 | 0.57 s |
| 104.20.0.1 / 104.27.0.1 | 0.64 s |
| 188.114.96.1 | 0.67 s |
| 104.24.0.1 | 0.68 s |
| 104.25.0.1 | 0.91 s |
| 104.21.0.1 | 1.47 s |
| 162.159.140.1 | 1.56 s |
| 104.26.0.1 | 1.86 s |
| 104.16.132.229 | 波动大（3–6 s，本次 6s 超时） |

**TCP 直接不通（9 个，占 41%）**
`104.19.0.1`、`104.22.0.1`、`104.23.0.1`、`172.64.0.1`、`172.67.0.1`、`173.245.48.1`、`190.93.240.1`、`197.234.240.1`

**注意**：NS 在 Cloudflare 时，解析返回哪个 anycast IP 由 Cloudflare 决定，**你无法直接选段**。
所以橙云的国内表现有"看运气"成分 —— 这也是为什么灰云更稳。

---

## 排查表

| 症状 | 原因 | 处理 |
|---|---|---|
| 域名 serverHold / 解析不生效 | 注册商处未实名认证 | 先完成实名 |
| Cloudflare 一直 Pending | NS 还没生效 | 确认注册商处 NS 已改对；等缓存过期 |
| 直连 000 且 0.x 秒失败 | DNS 解析到的不是 Vercel IP | 检查 CF 记录是否与 Vercel 面板一致；确认是灰云 |
| 直连超时 | 命中了不可用 IP | 灰云应解析到 76.76.21.x；橙云见第 7 步 |
| Vercel 一直 Invalid Configuration | 记录不一致 / 橙云挡了校验 | 先灰云；或按面板加 TXT |
| 橙云后浏览器报重定向次数过多 | SSL 模式是 Flexible | 改 Full (strict) |
| 能开但很慢 | 直连 Vercel 海外节点 | 见下 |

---

## 要更快（成本最高）

直连 Vercel 实测吞吐 **43–103 KB/s**（代理路径 316–547 KB/s）。真正快只有：
**域名备案 + 国内节点（腾讯云 EdgeOne/CDN 或阿里云 CDN）回源 Vercel**。
好消息：作品集图片已做 WebP 优化（单张 3.34MB → 273KB），100 KB/s 下从「打不开」变为「几秒出图」。
