# Filmer（App Store 胶片摄影数据库）界面逆向 → 胶片带索引网格实现

日期：2026-10-19　承接：`scripts/_film-web-20261015/`（胶片档案）、`filmer-ui-reverse_20261016_v1/`（本任务）

---

## 一、目标与边界（先说清楚能做什么、不能做什么）

用户要求：「用 REA 逆向分析 filmer 的前端效果，然后实现这套（用于作品集的胶卷功能）」。

| 项 | 结论 |
|---|---|
| Filmer 是什么 | App Store 上架 iOS App（胶片摄影数据库），**不是网站** |
| REA 能逆向什么 | 本地产物（二进制 / 网页 / 包）。**iOS App 的上架包拿不到**，所以 App 的前端代码无法反 |
| 实际可得的证据 | ① App Store 元数据 + 13 张界面截图（全分辨率）；② 官网 `filmer.yuzeren.com` 的品牌 token |
| 官网的 REA 价值 | 官网是**纯静态**（23,190 字节，**0 个 `<script>`**），无 bundle 可分析；只有 1 段内联 CSS |
| 因此本任务的「逆向」= | 从界面截图逐屏读出 UI 结构与动效规范 + 官网品牌 token，再在既有设计语言里复刻 |

> 若用户日后提供 IPA / 本地 `.app`，才谈得上用 REA 往代码层反（`inspect_asset_catalog`、`decode_interface_builder`、`inspect_macho` 等）。

---

## 二、目标定位

`web_search` 在本会话不可用（未配 API key），改用 iTunes Search API 定位：

```
https://itunes.apple.com/search?term=filmer&entity=software&limit=25&country=cn
```

中/美区均命中第 1 名即目标：

| 字段 | 值 |
|---|---|
| trackId | 6758050284 |
| 名称 | Filmer |
| 开发者 | 则人 俞 |
| 分类 | 摄影与录像 / 工具 |
| 版本 | 1.1.10（2026-10-10） |
| 最低系统 | iOS 16.0 |
| 官网 | http://filmer.yuzeren.com/ |
| 截图 | iPhone 10 张 + iPad 3 张 |

官方描述确认它就是**按卷管理的胶片数据库**：胶卷型录、参数记录（光圈/快门/焦距/地点/EXIF）、按卷归档、一键生成冲扫单据、百度网盘/WebDAV 导入；PRO 提供 WebDAV / 统计分析 / 自定义主题。
1.1.10 更新日志里直接写了本次要复刻的东西：「胶卷详情页支持以原始比例网格查看」「支持缩小到 4 列、5 列」。

---

## 三、截图全分辨率获取（关键技巧）

iTunes API 返回的 `screenshotUrls` 只有 **222×480** 缩略图，不足以读 UI。mzstatic 的图片 URL 形如：

```
.../1.png/320x480bb.jpg
```

把尺寸段改写为 `1290x2796bb.jpg` 即可取回原图：

| 改写后 | 实际返回 |
|---|---|
| `1290x2796bb.jpg` | **1284×2778**（389KB） |
| `1179x2556bb.jpg` | 1179×2551 |

（`.../source` 返回 404。）已下载 iPhone 10 张 + iPad 3 张至 `appstore-shots-large/`，并拼成 `contact-sheet.jpg` 一屏看全 13 个界面。

---

## 四、从截图读出的界面清单（13 屏）

| 界面 | 看出的结构 |
|---|---|
| iphone-01 | 胶卷列表：分栏切换（胶卷/相机）+ 每行 = 封面缩略图 + 标题 + 参数行（画幅·工艺·日期）+ 张数徽标 + **右侧迷你胶片条** |
| iphone-02 | 胶卷型录卡：色带 + 曝光张数（36）+ 品牌型号 + 规格（制造商/对比度/工艺/是否停产） |
| iphone-03 | 相机型录卡：相机图 + 规格 |
| iphone-04 | 确认信息表单（相机型号/胶卷型号/画幅/尺寸/开始时间） |
| iphone-05 | 冲扫参数表单（店铺/日期/品牌型号/感光度/画幅尺寸/冲扫工艺） |
| iphone-06 | 云盘导入（百度网盘 / Google Drive / WebDAV） |
| iphone-07 | 冲扫店铺列表（官方冲扫 + 联系客服 + 定位城市） |
| **iphone-08** | **胶卷详情页（本次复刻目标）**：黑色 FILMER 标题带 + **一行行齿孔胶片带**，照片嵌在带内、6 列铺满，页脚 X / 分享 / 更多 |
| iphone-09 | 打开新卷（我的常用卷列表 + 色卡缩略） |
| iphone-10 | 选择相机（相机卡横滑） |
| ipad-01 | 大屏胶卷详情：更密列数的照片网格 + 参数行 |
| ipad-02/03 | 大屏下的模态表单（打开新卷 / 选择相机）以居中卡片呈现 |

**招牌效果 = 齿孔胶片带（film strip with sprockets）+ 可切列数的索引网格。**

---

## 五、官网品牌 token（内联 CSS 实测）

| 项 | 值 |
|---|---|
| 文档 | 23,190 字节，`<title>Filmer - 你的胶片摄影数据库</title>` |
| 脚本 | **0 个 `<script>`**（纯静态，无 bundle） |
| 样式 | 1 段内联 `<style>`，15,514 字符 |
| 主要颜色 | `#1a1a1a`（近黑正文）、`#ffffff`、`#4a4a4a`、`#f8f9fc`（浅底）、`#1a1a2e`、`#2d2d2d`、`#666`、`#e5e7eb`、`#f5f5f5` |
| 字体 | `-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Arial, sans-serif` |
| 动效强度 | 1 个 `@keyframes`、7 处 `transition`、2 处 `backdrop-filter`、3 处 `blur`、15 处 `border-radius` |
| 齿孔/颗粒 | **0 处**（`sprocket` / `perforat` / `grain` 均未出现）→ 齿孔胶片带是 App 独有，官网没有可抄的实现 |

官网风格是「苹果式浅色极简」，与作品集现有的深色编辑风不同 → 因此**只取效果与结构，不取配色**。

---

## 六、实现（改动文件与设计取舍）

### 文件

| 文件 | 改动 |
|---|---|
| `components/FilmArchiveModule.tsx` | `FrameGrid` 改造：新增列数状态与持久化、按列数切分胶片带、胶片带索引带 + 列数控件；灯箱逻辑原样保留 |
| `components/FilmArchiveModule.css` | 替换原 `.far-grid` / `.far-grid-frame` 规则为 `.far-strip*` 一套（齿孔用纯 CSS 渐变，不引入任何素材）；窄屏媒体查询同步 |

（这两个文件在仓库中目前是**未跟踪**状态 —— 上一轮胶片档案整体尚未提交。）

### 行为

1. **胶片带索引**：默认 4 列，每带一行，40 帧 → 10 条带；条带为深色片基（`#141412`），上下各一排齿孔（`radial-gradient` 圆孔，16px 间距，带宽 8px）。
2. **列数切换 3/4/5/6**：对应 Filmer 的「缩小到 4 列、5 列」；选择写入 `localStorage`（键 `far-strip-columns`），刷新后恢复。
3. **灯箱不变**：点帧开灯箱，← → 切换、Esc 关闭、相邻帧预加载，均照旧。

### 取舍（明确摆出来）

- **保留作品集既有设计语言**：`#0b0b09` / `#f4efe2`、发丝线边框、Arial 大写字距、克制动效 —— 不照搬 Filmer 的苹果浅色皮肤（项目规则要求优先保护既有艺术方向）。
- **没有做「原始比例网格」**：胶片带要求行内等高，原始比例与逐行胶片带在视觉上互斥。Filmer 是两套索引样式，本次先实现胶片带这一套。
- 未搬运 Filmer 的任何素材、图标或商标；`ROLL INDEX` 字样为自制。

---

## 七、验证

### 命令

```powershell
cd E:\portfolio
npx tsc --noEmit --tsBuildInfoFile "E:\portfolio\filmer-ui-reverse_20261016_v1\tsc-filmer.tsbuildinfo"   # exit 0
npx next build                                                                                          # exit 0
npx next start -p 3211
# 另开：Chrome --remote-debugging-port=9333
node filmer-ui-reverse_20261016_v1\measure-strip-grid.cjs 9333 http://127.0.0.1:3211 E:\portfolio\filmer-ui-reverse_20261016_v1\measure-strip-grid.json
```

### 实测数字（`measure-strip-grid.json`，总体 PASS）

| 步骤 | 条带 | 帧 | 列 | 单帧 | 齿孔 |
|---|---|---|---|---|---|
| 初次进入（无偏好，1440×900） | 10 | 40 | 4 | 313×208（比例 1.500） | `radial-gradient(... 2.2px ...)`，高 8px |
| 点击 6 列 | 7 | 40 | 6 | 207×138 | 命中 |
| 刷新后（偏好恢复） | 7 | 40 | 6 | 207×138 | 命中（`localStorage` = "6"） |
| 窄屏 900×1000（6 列） | 7 | 40 | 6 | 126×84 | 命中 |
| 点击 3 列 | 14 | 40 | 3 | 418×279 | 命中 |
| 灯箱 | 打开 ✓ / Esc 关闭 ✓ | | | | |

截图（1440×900，REA provider-owned 浏览器，`capability: controlled-replay`）：
`shots/rea-01-settle.png`（4 列默认态）、`shots/rea-03-after-density.png`（6 列态）。

### 一次假阴性的根因（记录以免重犯）

首轮实测报 `columns: 3 / 单帧 31px / 齿孔 none / 点 6 无反应`，全部为假：

- 脚本**没有固定视口**，量到的是窗口实际极窄的布局（单帧 31px）；
- 同一 Chrome 实例上 `Page.captureScreenshot` 会超时（本次环境已知问题），故截图改用 REA provider 浏览器。

修正：测量脚本先 `Emulation.setDeviceMetricsOverride(1440×900)`，测量与断言随即全部通过。

---

## 八、后续可选（未做，先不擅自扩）

- 「原始比例网格」作为第二套索引样式（Filmer 的两套样式之一）；
- 每帧参数（光圈/快门/焦距）—— 需要数据源，`lib/film-rolls.ts` 目前只有 `title`；
- 胶卷型录卡（色带 + 曝光张数）与冲扫单据导出。

---

## 九、局限

- App 前端代码不可得，本实现依据的是**界面截图**（营销图与模拟器截图混排），非像素级还原；
- 截图中的密集网格（ipad-01）列数与间距为目测量取，未做像素测量；
- 齿孔形状用圆孔近似 Filmer 的圆角矩形齿孔。
