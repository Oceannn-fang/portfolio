# 国内可达性实测：Vercel 直连 vs Vercel + Cloudflare

日期：2026-10-19　状态：**已完成实测取证**；账号侧配置需用户执行（我无账号权限）

---

## 一、先纠正一个此前的测量误差

本机系统代理是 **`127.0.0.1:7890`**（Clash 类）。`Invoke-WebRequest` 走系统代理，
`curl.exe` 不走（除非设环境变量）。

因此**此前 `portfolio-perf` 报告里"线上 316–547 KB/s、单张 18 秒"是走代理的数字**，
不代表无代理的国内访客。文件体积的结论不受影响（体积与线路无关）。

**无代理直连的真实情况：根本进不去。** 见下。

---

## 二、实测结论

### 1. `*.vercel.app` 在国内 DNS 被污染

`oceanfolio.vercel.app` 在四个解析器上的 A 记录（应为 Vercel 的 76.76.21.x/66.33.60.x）：

| 解析器 | 返回 |
|---|---|
| 阿里 223.5.5.5 | 31.13.70.13（Facebook 段） |
| DNSPod 119.29.29.29 | 157.240.17.36（Facebook 段） |
| 114.114.114.114 | 31.13.80.54（Facebook 段） |
| Google 8.8.8.8 | 31.13.87.34（Facebook 段） |
| 本机默认 | 108.160.169.185、216.239.32.105 …（Dropbox / Google DNS 段） |

而 `cname.vercel-dns.com` 与 `cloudflare.com` 解析**正常**（76.76.21.98/123、66.33.60.35；104.16.132.229）。

### 2. 封锁方式：**SNI 关键字（`vercel.app`），不是 IP 段**

同一个 Vercel anycast IP，只换 SNI（curl `--resolve`，不走代理）：

| IP | SNI | 结果 |
|---|---|---|
| 76.76.21.21 | `oceanfolio.vercel.app` | **Recv failure: Connection was reset**（0.23s） |
| 76.76.21.21 | `vercel.com` | **200**（appconnect 0.68s） |
| 76.76.21.21 | `nextjs.org` | **200**（appconnect 0.66s） |
| 76.76.21.21 | `cloudflare.com`（对照） | TLS 到达服务器后因证书不匹配失败 → **IP 未被封** |
| 66.33.60.67 | `oceanfolio.vercel.app` | RST |
| 66.33.60.67 | `vercel.com` | **200**（appconnect 0.67s） |

**推论：只要 SNI 里不含 `vercel.app`（即绑自定义域名），国内可直连 Vercel。**

### 3. 直连速度（无代理，成功建连时）

| 目标 | 响应体 | 总耗时 | 折算吞吐 |
|---|---|---|---|
| `vercel.com` × 76.76.21.21 | 624 KB | 14.4 s | **≈43 KB/s** |
| `nextjs.org` × 76.76.21.21 | 224 KB | 2.17 s | **≈103 KB/s** |

对照：走本机代理时是 316–547 KB/s。**"能进"和"快"是两件事。**

### 4. Cloudflare 边缘：可达但 IP 段差异极大

| 目标 IP | SNI | 结果 |
|---|---|---|
| 104.16.132.229 | cloudflare.com | 301，appconnect **6.15 s** |
| 104.17.209.9 | cloudflare.com | 301，appconnect **0.55 s** |
| 172.67.0.1 | cloudflare.com | 超时（20s） |
| 108.162.193.128 / 172.64.33.128 / 173.245.59.128 | medium.com | **RST（0.07s）** |
| 1.1.1.1 | one.one.one.one | 超时 |

说明：CF 的 104.16.x / 104.17.x 实测可用，而 108.162.x / 172.64.x / 173.245.x 段被 RST；
握手耗时在 0.55s–6.15s 之间大幅波动 —— 这正是国内"Cloudflare 优选 IP"存在的原因。
（medium.com 那组也可能因该域名本身被封，故此组仅作旁证。）

---

## 三、推荐路径

### 方案 1（推荐，已实测可行）：自定义域名直连 Vercel

1. Vercel 项目 `oceanfolio` → Settings → Domains → Add 你的域名；按面板提示取值。
2. 腾讯云 DNSPod 加记录：
   - 根域：`A` → `76.76.21.21`（或面板给定值）；
   - 子域/或统一：`CNAME` → `cname.vercel-dns.com`。
3. 等 Vercel 自动签发证书（通常几分钟）。
4. 环境变量：`NEXT_PUBLIC_SITE_URL=https://新域名`（canonical/OG）。
   Spotify 若要重新授权，需在 Spotify 后台补 `https://新域名/api/auth/spotify/callback`。
5. 验收：用 `measure-cn-reachability.ps1`（把域名换成你自己的）跑一遍，确认 `http_code=200` 且 appconnect 有值。

### 方案 2（可选，收益有限）：再加 Cloudflare

只在"Vercel IP 段哪天也被封"或需要边缘缓存/防护时才值得加：

1. 域名 NS 改到 Cloudflare（注意：改 NS 后腾讯云 DNSPod 的解析不再生效）。
2. 先 **DNS only（灰云）** 加 `CNAME → cname.vercel-dns.com`，让 Vercel 完成域名验证；通过后再开橙云。
3. SSL/TLS 设为 **Full (strict)**（务必不要 Flexible，否则重定向环）；开启 Always Use HTTPS。
4. 若国内不稳定，需要挑可用 IP 段（实测 104.16.x / 104.17.x 可用）。
5. 真实访客 IP 在 `CF-Connecting-IP`。
6. CF 免费版无中国节点（中国网络需企业版 + ICP 备案）。

### 方案 3（真正"快"）：备案 + 国内节点

域名备案后走腾讯云 EdgeOne/CDN 国内节点，源站仍可放 Vercel。
这是唯一能同时保证"稳、快"的路，代价是备案主体与时间。无备案则只能吃海外节点。

---

## 四、必须说清的两点

1. **没有任何配置能"保证"国内长期可访问** —— 封锁策略会变。上述方案 1 是当前实测可行的最小改动。
2. 我**没有你的 Vercel / Cloudflare / 腾讯云账号权限**，无法代配；配好后我立刻按第五节复测。

---

## 五、验收脚本

| 文件 | 用途 |
|---|---|
| `measure-cn-reachability.ps1` | 多解析器 DNS 对比 + `curl --resolve` 指定 IP 测 TLS/HTTP（改造 `$names` 即可测你自己的域名） |
| `test-sni-vs-ip.ps1` | 判定"SNI 关键字封锁 vs IP 段封锁"的方法脚本 |
| `reachability.txt` / `sni-vs-ip.txt` | 本轮原始输出 |

> 注意：本机 PowerShell 是 **5.1**，含中文的 .ps1 必须带 **UTF-8 BOM**，否则中文被按 ANSI 读、脚本解析报错。
> 本轮两个脚本已补 BOM。
