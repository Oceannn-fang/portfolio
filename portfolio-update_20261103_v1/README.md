# 作品集更新：接入新作品《Carmen》（2026-11-03）

日期：2026-11-03　状态：**已接入并验证通过**（本地提交，未推送、未部署）

---

## 一、本轮新增

存档目录 `C:\Users\86185\OneDrive\图片\存档` 现有 39 张 PNG，`update-portfolio.mjs --dry-run`
报「发现 2 张新作品」，但核实后**只有 1 张是真的新作品**：

| 文件 | 判断 | 依据 |
|---|---|---|
| `carmen.png`（2026-11-01，1.6MB） | ✅ **真新作品** | 注册表无此条目，1080×1920 |
| `I did it, I did that.png` | ❌ **同一张图的改名副本** | 与已注册 `I did this, I did that.png` **SHA256 相同、字节完全一致**；本轮脚本再次复核确认 |

管线的去重是按 `image` 的文件名 basename，`this` ≠ `it`，所以每次 dry-run 都会把它当成新作品。
直接全量执行会插入重复条目——**这正是本轮不走管线、改手工接入的原因**。

---

## 二、做法

管线没有"跳过指定文件"开关，删文件又需要用户确认，因此只接新作品：

| 步骤 | 做法 | 产物 |
|---|---|---|
| 原图 | `shutil.copy2`（保留字节） | `public/images/portfolio/carmen.png` 1,716,137 B |
| 缩略图 | Pillow 240×428 WebP q80（scale-to-cover + 居中裁切） | `public/images/portfolio-thumbs/carmen.webp` 4,450 B |
| WebP 衍生图 | 1080×1920 q82 method 6，保留 ICC | `public/images/portfolio/web/carmen.webp` 244,602 B（占原图 **14.3%**） |
| 注册表 | 置顶插入 1 条（含 `imageWeb`） | `lib/portfolio-images.ts` |

脚本：`add-work-carmen.py`

> 衍生图占比比往轮高（14.3% vs 通常 8%）：这张原图本身只有 1.6MB（已高度压缩），
> 分母小，所以比例看起来大。绝对体积 239KB 仍在同一量级。

---

## 三、验证

```powershell
cd E:\portfolio
node scripts/update-portfolio.mjs --dry-run        # 差集核对
python portfolio-update_20261103_v1\add-work-carmen.py .
npx tsc --noEmit --tsBuildInfoFile portfolio-update_20261103_v1\tsc.tsbuildinfo   # exit 0
npx next build                                                                    # exit 0
npx next start -p 3211
node portfolio-update_20261103_v1\verify-new-work.cjs 9333 http://127.0.0.1:3211 Carmen carmen portfolio-update_20261103_v1\verify-new-work.json
```

### 断言（7/7 PASS，1440×900，CDP 固定视口）

| 断言 | 结果 |
|---|---|
| works 列表第一条是《Carmen》 | ✅ `first: "carmen"` |
| DriftWall 含该作品缩略图 | ✅ 首个即 `carmen.webp` |
| 单图用 `web/carmen.webp` | ✅ |
| 单图已解码 1080×1920 | ✅ `complete=true, 1080×1920` |
| 大图浮层用 `.webp` | ✅ |
| **未请求原图 `.png`** | ✅（该作品 2 次请求全为 `.webp`） |
| **确实发生了 .webp 请求**（防"空样子断言"自检） | ✅ 2 次 |

> 上一条自检是刻意加的：中文/特殊 id 的 URL 会被百分号编码，若资源过滤用错匹配方式，
> 「未请求 PNG」会变成永远为真的空断言。本轮同时验证了"确实有 webp 请求"才让结论成立。

### 截图

`shots/rea-04-decode-settle.png` —— 浮层完整渲染（黑卡片＋正文＋虚化背景，9:16 无裁切）。

---

## 四、踩坑记录

1. **列表文本是小写**：UI 渲染 `carmen`，而注册表标题是 `Carmen`。
   第一版断言用大小写敏感比较，误报 FAIL；改为小写比较后 7/7 通过。
2. **`Page.captureScreenshot` 在该 Chrome(124) 上超时**（本轮再次复现），
   改用 REA Playwright 场景截图后提取，稳定。

---

## 五、改动文件

| 文件 | 改动 |
|---|---|
| `lib/portfolio-images.ts` | 置顶插入 `carmen`，条目数 **38 → 39** |
| `public/images/portfolio/carmen.png` | 新增原图 |
| `public/images/portfolio-thumbs/carmen.webp` | 新增缩略图 |
| `public/images/portfolio/web/carmen.webp` | 新增衍生图 |

最终顺序（前 10，即 `slice(0,10)` 可见范围）：

```
 1. carmen      2026-11-01   ← 本轮新增
 2. should      2026-10-11
 3. i-dont-dare-to-be-happy   2026-10-08
 4. life-and-space            2026-09-22
 5. theres-something-here-for-us-both  2026-09-18
 6. wish-it-was-easy          2026-09-09
 7. i-did-this-i-did-that     2026-08-25
 8. 一夜情                    2026-10-13（人工定位，见上一轮说明）
 9. dinner-view               2026-07-24
10. a-hundred-lives           2026-06-15
```

---

## 六、遗留

1. **存档里那张重复图会一直被报为"新作品"**（到本轮已是第 2 次）。要么把存档那份改名/移走，
   要么每次手动跳过。需要用户决定。
2. `scripts/update-portfolio.mjs` 仍不生成 `imageWeb`，走管线接入的作品会自动缺衍生图、回退原图（慢）。

---

## 七、本任务产物

| 文件 | 用途 |
|---|---|
| `README.md` | 本报告 |
| `add-work-carmen.py` | 单件作品接入（原图 + 缩略图 + 衍生图，含重复项复核） |
| `verify-new-work.cjs` | 展示路径验证（7 条断言，含空断言自检） |
| `verify-new-work.json` | 断言与请求记录 |
| `verify-after-film-offline.json` | 摘除 film 入口后重跑的作品集验证 |
| `verify-deploy.ps1` | 线上验收脚本（307 重定向 / bundle 内容） |
| `deploy-verify.txt` | 线上验收原始输出 |
| `shots/rea-04-decode-settle.png` | 本地浮层渲染截图 |
| `shots/rea-05-decode-settle.png` | **线上**浮层渲染截图 |
| `tsc.tsbuildinfo`、`prod-server*.log` | 类型检查/构建记录 |

---

## 八、上线（2026-11-03）

### 8.1 问题：首次推送把 film 一起发了出去

用户只要求上线作品集。第一次推的是 master 上 4 个提交，其中含 film 模块，
结果 `/film` 返回 200（胶片档案真的上网了）。用户指出后修正。

### 8.2 修正方式：不删文件，只摘入口 + 重定向

`git revert` 会从磁盘删掉 `app/film/`、`FilmArchiveModule`、`film-rolls.ts` 和
80 个 film 图片文件——**删除文件是红线**，故改用非破坏性做法（提交 `a5d5946`）：

| 改动 | 内容 |
|---|---|
| `components/Gk3Clone.tsx` | 删掉 film 行（首屏入口）、`prepFilmArchive()`、film viewer 分支、2 个 import、`ViewerMode` 里的 `"film"`、`viewerClass !== "film"` 判断 |
| `next.config.ts` | 新增 `redirects()`：`/film` 与 `/film/:path*` → `/`（307） |

页面与素材**全部保留在仓库**，恢复只需删掉 `redirects` 并加回首屏行。
（遗留：`Gk3Clone.css` 里 film 专用样式成了死 CSS；按"无关死代码只提出不删"的规矩未动。）

### 8.3 上线验收（`verify-deploy.ps1`）

网络前提：本机直连 vercel.app 超时；**系统代理已被关闭**（`ProxyEnable=0`），
但 `127.0.0.1:7890` 的代理进程仍在跑 → 脚本用 `curl -x` 显式指定代理。

```
[17:25:23] 第1轮  首页=200  /film=0    /film/roll-017=0    chunks=8  carmen=False  film入口=False
[17:26:29] 第2轮  首页=0    /film=0    /film/roll-017=0    chunks=0  carmen=False  film入口=False
[17:27:04] 第3轮  首页=200  /film=307  /film/roll-017=307  chunks=8  carmen=True   film入口=False
✅ 上线验收通过：胶片已下线（307 重定向）、作品集含 carmen、首屏无 film 入口
```

线上实拍：`shots/rea-05-decode-settle.png`（`https://oceanfolio.vercel.app/` 的 Carmen 浮层）。

线上列表实测（Playwright 严格模式报错信息顺带给出的完整 10 条）：

```
Carmen / 應該 / 我連快樂都不敢了 / Life & Space / There's Something Here for Us Both
/ Wish it Was Easy / I Did This, I Did That / 一夜情 / 晚餐見 / 一百種生活
```

Carmen 第一、`一夜情` 在 `晚餐見` 之前——与上一轮小红书核对结果一致。

### 8.4 踩坑记录

1. **`$home` 是 PowerShell 只读自动变量**：脚本把首页响应存进 `$home`，赋值静默失败，
   导致 `chunks=0`、断言全部落空、**空转 27 轮**。改用 `$pageHome` 后一次通过。
2. **推送分支**：本地在 `codex/film-archive`，生产分支是 `master`（不是 main）。
   先 `--ff-only` 合并到 master 再推，否则只能产生 preview 部署。
3. **临时配置的 Chrome 会自己退出**，并发实例还会抢 9333 端口；必须按 `user-data-dir` 精确清理。
4. **REA 的 `wait_for` 遇多元素会触发 Playwright 严格模式报错**，选择器要带 `>> nth=0`。

---

## 九、收尾：清 film 死 CSS + 存档重复图改名（2026-11-03 追加）

### 9.1 清掉 film 残留样式

film 下线后，`Gk3Clone.css` 里 16 处 film 选择器成了死代码。难点在于**film 与 portfolio
共用同一组选择器**，不能整块删：

```css
/* 共有 4 处是这种"共享列表"形式 */
#viewer.portfolio #videoFrame:after,
#viewer.film #videoFrame:after { ... }      ← 只删 film 那一行和逗号
```

处理方式：4 处共享列表逐行摘掉 `#viewer.film` / `#filmViewer`，末尾 film 专属块
（`/* ── Film Archive preview viewer ── */` 起，含独立媒体查询）整块删除。

- 行数 **1613 → 1543**（-70）
- 花括号配平 222 / 222
- 残留检查：0 处 film

### 9.2 存档重复图改名

`C:\Users\86185\OneDrive\图片\存档\I did it, I did that.png` → 加 `.bak` 后缀
（4,233,850 bytes 不变，仍在原目录，只是不再被 `*.png` 扫描命中）。

改后 `--dry-run` 不再把它报为新作品。

> 副作用：脚本现在提示 `I did it, I did that.psd`（35.7MB）无同名 PNG、需先导出。
> 这是**提示不是插入**，未处理（PSD 是同一张图的源文件，是否也改名需用户另定）。

### 9.3 回归验证（`verify-css-regression.cjs`）

| 断言 | 桌面 1440×900 | 窄屏 900×1000 |
|---|---|---|
| 单图渲染且已解码 | ✅ 1080×1920 | ✅ 1080×1920 |
| 单图是 `web/carmen.webp` | ✅ | ✅ |
| viewer 有实际尺寸 | ✅ 484×594 | ✅ 883×700 |
| panel 样式生效（半径 12.8%/6%、overflow hidden） | ✅ | ✅ |
| 页面无 film 节点 | ✅ | ✅ |

5/5 PASS。

### 9.4 发现一个**既有**问题（不是本次改动引入）

窄屏 900×1000 下，hover 作品行后 `body.viewing` 已加上、`.viewing #viewer.portfolio`
选择器也确实匹配，但 `#viewer.portfolio` 仍保持 `transform: translateX(70vw)`、`opacity: 0`
—— **viewer 没有滑入**。

**A/B 对照证明这是既有问题**：把 CSS 暂存回 HEAD（`git stash`）重建后，
同样得到 `opacity:0 / translateX(630)`，与改动后完全一致。

原因方向：窄屏隐藏用的 `translateX(70vw)`（`#viewer.portfolio`，特异性 1-1-0）
本应被 `.viewing #viewer.portfolio`（1-2-0）覆盖，实测未覆盖——疑似还有更高优先级规则或
源码顺序问题。**本次未修**（超出"清死 CSS"范围），已记录待办。


