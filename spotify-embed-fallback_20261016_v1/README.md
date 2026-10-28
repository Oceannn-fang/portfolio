# Spotify Embed 国内降级链路：缺陷取证 → 修复 → 端到端复验

日期：2026-10-16　承接：`scripts/_film-web-20261015/`（国内可达性治理）

> ## ⚠️ 状态更新（2026-10-16 晚）：本方案已按用户决定**整体回退**
>
> 用户要求「还原回去，就只用 spotify 播放器就好」。已执行：
>
> - `components/MusicModule.tsx`、`components/MusicModule.css` **回退到 HEAD**（`git hash-object` 与 `HEAD` 逐字节一致：`3d0e1917…` / `02b0a0f3…`），降级面板、探测逻辑、网易云入口全部移除，恢复为纯官方 Spotify Embed。
> - 回退后重建并复验：播放器 iframe 展开即挂载（15ms）→ 8 秒后仍挂载 → 降级面板不存在（3 条断言全 PASS）；构建产物中探测 URL、网易云链接、降级文案均为 0 处，CSS 仅剩 `.mm-embed`。
>
> 因此**下文记录的是"缺陷取证与修复验证"的历史过程，不是当前线上行为**。当前行为：只渲染官方 Spotify 播放器；国内网络下该 iframe 仍会空白（`open.spotify.com` 被墙），这是用户已知并接受的取舍。
>
> 若日后要重新启用降级：本文件的第四节给出了完整实现，`scripts/_film-web-20261015/verify-spotify-fallback-v2.cjs` 可直接复用验证（须先起 `next start`）。

---

## 一、结论

| # | 结论 | 证据 |
|---|---|---|
| 1 | 上一轮写入的降级实现在**真实国内链路下永不触发**（展开后 8 秒仍是空白播放器） | 真实浏览器，`ASSERT-fallback-appears` 超时失败 |
| 2 | 根因：定时器只在 iframe `onError` 里启动，而静默挂起时 `onLoad`/`onError` 都不触发 | 同一基线 + 代码复核 |
| 3 | 改为「展开即主动探测 Embed 同域可达性」后，**降级延迟实测 6492ms**，9/9 断言通过 | 真实浏览器 + 真实不可达网络 |
| 4 | 「可达 → 保留官方播放器」分支未被误伤 | 浏览器内夹具，可达目标返回 true |
| 5 | 类型检查与生产构建均通过，构建产物确含新逻辑 | `tsc --noEmit` exit 0；`next build` exit 0；chunk 内含探测 URL |

---

## 二、环境事实（取证前提）

本机处于**与目标环境等价**的网络条件，因此「真实不可达」是实测而非模拟：

| 目标 | TCP 443 | 说明 |
|---|---|---|
| `open.spotify.com` | **否** | Embed 与探测目标同域 |
| `api.spotify.com` | 是 | `/api/spotify/recently-played` 返回 200（最新收听为当日 07:11） |
| `accounts.spotify.com` | 是 | token 续期正常 |
| `music.163.com` | 是 | 降级入口可用 |

---

## 三、基线缺陷（未改动代码 × 真实不可达网络）

`capture_browser_scenario` `ev_e2fdf201845580b933d991fe2ba6c8c6682db14686992284b0e5f04801d7d1c3`：

| 步骤 | 结果 |
|---|---|
| 悬停 `li[data-viewer="music"]` | 通过，渲染 **20 首真实曲目** |
| 点击第 1 首展开 | 通过 |
| `.mm-embed iframe` attached | 通过（**26ms**） |
| 等待 8000ms（超过 6000ms 阈值） | 通过 |
| `.mm-embed-fallback` attached（3000ms） | ❌ **超时未出现** |

> 更早一次运行 `ev_60b33617a611e9b5f58a13189a8572131ab2a9828e9f58b395e11606db18ce16`
> 因 Playwright 严格模式命中 20 个 `.mm-track-item` 而中止；改用 `>> nth=0` 后复现稳定。

### 根因

```
iframe onError → 启动 6s 定时器 → setEmbedFailed       ← 唯一启动条件
iframe onLoad  → 清除定时器
```

DNS 污染 / TCP 黑洞造成的失败是**请求静默挂起**：既不 commit 成功文档也不报错，两个事件都不触发，定时器从未启动。
代码注释已写明「两个事件都不触发，只能靠超时判定」，但实现把超时判定挂在了 `onError` 上 —— 假设与实现自相矛盾，而当时的验证脚本只覆盖「CDP 阻断」（会触发 `onError`）这一条路径，等于用被测假设当验证前提。

---

## 四、修复

判据从「iframe 事件」改为「主动探测 Embed 同域是否可达」：

```ts
const EMBED_TIMEOUT_MS = 6000;
const EMBED_PROBE_URL = 'https://open.spotify.com/favicon.ico';

async function probeEmbedReachable(timeoutMs: number): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await fetch(EMBED_PROBE_URL, { mode: 'no-cors', cache: 'no-store', signal: controller.signal });
    return true;
  } catch {
    return false; // 网络错误，或被 abort（超时）
  } finally {
    clearTimeout(timer);
  }
}

// 展开曲目时探测；不可达或时限内未确认可达 → embedFailed[id] → 渲染网易云搜索入口
useEffect(() => {
  if (!expandedId || embedFailed[expandedId]) return;
  const trackId = expandedId;
  let cancelled = false;
  probeEmbedReachable(EMBED_TIMEOUT_MS).then((reachable) => {
    if (!cancelled && !reachable) setEmbedFailed((prev) => ({ ...prev, [trackId]: true }));
  });
  return () => { cancelled = true; };
}, [expandedId, embedFailed]);
```

为什么不用 `onLoad` 当成功信号：① 静默挂起时不触发（已实测）；② 浏览器自渲染错误页**可能**触发 `onLoad`，会把打不开的播放器误判为可用；③ `no-cors` 探测对 4xx/5xx 也算可达，语义更贴近真实诉求。
代价：每次展开多发一个对本域极小静态资源的请求（该域名本来就会被 iframe 请求）。
同时移除 `embedTimersRef` 与 `handleEmbedStatus`（已无用途），净减约 20 行。

---

## 五、端到端复验（修复后，真实站点）

前置：`npx next build` exit 0（路由表与既有 README 一致：6 个 `ƒ` + `/film` 静态 + `/film/[rollId]` SSG）。
客户端 chunk `/_next/static/chunks/app/page-6f0ef64f8390b1cc.js` 内含 `open.spotify.com/favicon.ico`，确认页面已带新逻辑。

`verify-spotify-fallback-v2.cjs` mode=**real**（无任何网络拦截，真实不可达）：**9/9 PASS**

| 断言 | 结果 |
|---|---|
| 点击后 embed 容器已挂载 | PASS |
| 降级延迟符合该失败模式（5–9s） | PASS，**实测 6492ms** |
| 最终降级为网易云入口 | PASS |
| 降级后 iframe 已卸载 | PASS |
| 降级面板高度与 embed 对齐（152±4px） | PASS，实测 **154px** |
| 降级含网易云搜索链接 | PASS（`music.163.com/#/search/m/?s=…`） |
| 降级含 Spotify 直链 | PASS（`open.spotify.com/track/52MmSaZatihx118mTayXY2`） |
| 控制台无 error | PASS（0 条） |
| 静默挂起期间未提前降级 | PASS（t+1507ms 时 iframe 仍在、降级面板未出现） |

过程数据：t+1507ms `iframe=true / fallback=false` → t+9023ms `iframe=false / fallback=true`；`iframe removed` 事件于页面时间 15022ms；网络侧共 15 条 spotify/scdn 请求，`i.scdn.co` 封面 200，两条 `net::ERR_ABORTED`（被替换的 iframe 与超时探测请求）。

截图（本机实测可得）：`verified/v2-real-t1500ms.jpg`（降级前，iframe 在位）、`verified/v2-real-t9000ms.jpg`（降级后，网易云入口在位）。

### 高度 154px 而非 152px 的原因

`.mm-embed-fallback { height: 152px; border: 1px solid … }`，元素为 content-box，故 `getBoundingClientRect().height = 152 + 2×1 = 154`；iframe 为 `height="152"` 且无边框。两者相差 2px 边框，无可见跳动，**属度量口径差异而非布局缺陷**，因此未为 2px 改动既有样式。

---

## 六、模拟模式（block / hang）不可用，未采信

`Network.setBlockedURLs` 阻断与 `Fetch.enable` 暂停两种模拟方式在本应用上**不可用**：

| 现象 | 数据 |
|---|---|
| 阻断模式首轮 | 展开未发生（`expandedOpen=false` —— 同一行、同一命中元素在 real 模式正常） |
| 阻断模式复跑 | `Runtime.evaluate` 20s 超时，渲染进程无响应 |
| 网络事件 | 70 条 spotify/scdn 请求失败且 `errorText` 为空 |

该应用音乐面板会并发拉取大量 `i.scdn.co` 封面，阻断后请求风暴把渲染进程拖死，点击事件无法落地。**故这两种模式的失败不能推断降级逻辑**；降级逻辑的「快速失败」分支（请求被拒 → 探测立即返回 false）只经第四节代码路径推演与第五节探测原语佐证，**未单独实测**。

---

## 七、探测原语双分支验证（真实浏览器夹具）

证据 `ev_766bdf0c2234bc87d76df12a94a0926c49cd5876d4d5bf2db7d7a9c497b2478d`，夹具 `probe-fixture.cjs`：

| 目标 | 期望 | 实测 |
|---|---|---|
| `https://open.spotify.com/favicon.ico` | false | **false** |
| `http://127.0.0.1:3398/local-ok.txt`（等价「Spotify 可用」） | true | **true** |
| `http://127.0.0.1:3399/hang`（接受连接、永不响应） | false（AbortController） | **false** |

`data-ms="6009"` —— 并行执行整轮 6009ms，超时判定确实在约 6 秒触发；可达分支毫秒级返回，不会误伤。

---

## 八、本会话沙箱限制（过程记录）

| 限制 | 现象 | 规避 |
|---|---|---|
| shell 只能写「本会话新建的路径」 | 已存在路径（`.next/`、`app/`、`components/`、`public/`、`tsconfig.tsbuildinfo`）一律 `EPERM` | 证据与脚本落在新建的任务目录；文件编辑走带版本保护的工具 |
| `next build` / `next dev` | `spawn EPERM`（需派生子进程） | 策略解除后直接构建成功 |
| Chrome 直启（CDP 插桩） | crashpad `OpenProcess: 拒绝访问` → 自终止 | 改用 REA Playwright；策略解除后直启可用 |
| REA `capture_process_scenario` | Windows PTY 不受支持 | —— |
| `Page.captureScreenshot` | 曾永久不返回 | 给所有 CDP 命令加超时；截图失败降级为说明字符串 |

---

## 九、改动文件

| 文件 | 改动 |
|---|---|
| `components/MusicModule.tsx` | 新增 `probeEmbedReachable` + 探测 effect；移除 `embedTimersRef` / `handleEmbedStatus` / iframe 的 `onLoad`·`onError`；降级 UI 沿用上一轮成果 |
| `components/MusicModule.css` | 无改动（本次未改任何样式） |
| `next.config.ts` | 临时改动已还原，`git hash-object` 与 `HEAD` 逐字节一致（`ae9b56c1…`） |

任务目录（本次新增）：

| 文件 | 用途 |
|---|---|
| `README.md` | 本报告 |
| `verified/verify-spotify-fallback-v2.json` | 端到端复验原始数据（含三模式） |
| `verified/v2-real-*.jpg` | 降级前后截图 |
| `verified-block-retry/…` | 模拟模式失效的复现记录 |
| `probe-fixture.cjs` | 探测原语双分支夹具 |
| `cdp-attach-probe.cjs` | CDP 卡点诊断（定位到 `Page.captureScreenshot`） |
| `prod-server-after-fix.log` / `tsc-verify.tsbuildinfo` | 构建与类型检查记录 |
| `scripts/_film-web-20261015/verify-spotify-fallback-v2.cjs` | 三模式插桩验证脚本（含命令超时与模式化断言） |

---

## 十、复现命令

```powershell
cd E:\portfolio
npx tsc --noEmit                                   # 类型检查
npx next build                                     # 生产构建
npx next start -p 3211                             # 起服务（另开窗口）

# 端到端复验（真实不可达网络下）
node scripts\_film-web-20261015\verify-spotify-fallback-v2.cjs 9222 http://127.0.0.1:3211 .\spotify-embed-fallback_20261016_v1\verified real

# 探测原语双分支
node spotify-embed-fallback_20261016_v1\probe-fixture.cjs   # 另开窗口
# 再用 REA/Playwright 打开 http://127.0.0.1:3398/ 并等 #probe-result[data-status="done"]
```

---

## 十一、回退方式

删除 `components/MusicModule.tsx` 中的 `probeEmbedReachable` 与探测 effect、恢复 iframe 的 `onLoad`/`onError`，即回到上一轮行为 —— 注意那等于回到「国内永不降级」的缺陷状态。
