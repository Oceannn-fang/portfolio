# Portfolio 改动说明（2026-09-30）

> 记录两个部分：一、线上已上线的改动（全部已部署并验证）；二、本地已完成、待你验收后上线的改动。
> 线上地址：https://oceanfolio.vercel.app

---

## 一、线上已上线（生产环境当前状态）

### 1. 文案与视觉小改（commit `6654f0e`）
- hero 副标语 "and Unfinished." 与主标间距收紧至 9px（墨迹实测无重叠）
- playlist 行文案 "my picks" → **"doofus picks"**（两处，保持小写风格）

### 2. arc vinyl 专辑信息面板全链路（commit `4bdb937`）
- 点击专辑显示：专辑名 / 艺术家 / 完整曲目列表 / Now playing（播放时在按钮下方展开，停止/播完/切专辑自动收起）
- 面板布局（桌面）：曲目列表居左、与中央封面严格等高可滚动；播放按钮居右原位；长名 hover 滚动预览（marquee）
- 新增 `/api/itunes` 服务端代理：解决 iTunes 无 CORS；8 张原本无试听数据的专辑有 7 张在线拉到曲目（唯一无货：砂原良徳《The Sound Of '70s》，显示曲目不可用）；带内存缓存 6h + 边缘缓存 s-maxage=86400
- 无试听曲目显示禁用态；修复 play-button 误报 Unavailable
- 入场性能：冷首开到画面稳定 ~2.2s → ~0.26s（约 8 倍），封面渐进浮现
- 修复：canvas 被钉在 1px 导致 3D 场景不可见的显示回归；音量浮点越界旧报错

### 3. MusicModule 专辑详情视图（commit `1af0032`）
- recent albums 点卡片 → 详情视图（返回键 + 封面 + 专辑名/艺术家贴左 + 曲目列表占满可滚），替换旧"向下展开显示不全"
- 返回按钮纵向缩小、移至详情头右侧；返回后网格滚动位置精确恢复
- tab 英文化：recently played / recent albums（小写，字重 600）

### 4. 首屏与时间戳（commit `ab9feb4` + `9ff384e`）
- **移除首屏启动动画遮罩**：首次加载直接展示页面（首帧 ~0.8s 即见 hero），后台预热不受影响；LoadingScreen 文件保留备用但不再挂载
- recently played 播放时间戳英文化（just now / x min ago / x hr ago / x days ago）

> 说明：线上左下角看不到 "N" 按钮——那是 Next.js 开发调试工具指示器，仅在本地 dev 模式出现，生产构建自动消失。

---

## 二、本地已完成、待上线（尚未 commit，仅 arc vinyl 移动端三连）

**改动文件**（3 个）：`public/music-cover-3d/index.html`、`script.js`、`styles.css`（资源版本已 bump 至 `album-panel-7`）
**验证状态**：61/61 断言全绿（390×844 / 375×667 / 1280×600 横屏 / 1440×900 桌面回归），console 零错误；截图在 `e:\portfolio\scripts\task99~101_*.png`
**桌面布局零改动**（列表左/按钮右/等高全部不回归，且桌面↔移动动态切换正常）

### #99 播放按钮集成 + 封面缩小
- 移动端播放按钮从屏幕右下（会被裁切）集成进曲目面板底部通栏（触区 ~300×50）
- Now playing 胶囊随按钮进面板，展开时在按钮上方
- 中央专辑缩小避免面板遮挡

### #100 曲目列表只露 4 行
- 移动端曲目列表固定高度约 4 行，其余下滑浏览
- 面板高度随内容自适应

### #101 面板屏幕正中 + 整体再缩
- 面板改为视口正中的居中卡片（水平垂直精确居中），封面缩小悬于面板上方 24px，零重叠
- 曲目行高缩至 24px、播放按钮 50→44px
- **附带修复**：3D 中央封面的定位锚点没跟上布局变化（此前"面板压住封面"压的其实是它），已修正——三档视口目检封面完整清晰

---

## 三、当前待办

> 2026-10-08 更新：两项待办已全部完成，详见第五节上线记录。

1. ~~**移动端三连上线**~~ → 已 commit `526a6ba` + push，Vercel 生产部署 Ready
2. ~~可选：本地 dev 隐藏左下角 "N" 调试钮~~ → 已在 `next.config.ts` 加 `devIndicators: false`

## 四、相关文档与工具

- 作品更新流程：`e:\portfolio\PORTFOLIO-UPDATE-GUIDE.md`（脚本 `scripts/update-portfolio.mjs`，先 `--dry-run`）
- 验证截图存档：`e:\portfolio\scripts\`（taskNN_*.png）

---

## 五、上线记录（2026-10-08）

**提交**：`526a6ba` `feat(arc-vinyl): 移动端三连上线 - 播放按钮集成面板/曲目限4行/面板居中再缩 (#99 #100 #101)`
**含改动**：`public/music-cover-3d/{index.html,script.js,styles.css}`（`album-panel-7`）+ `next.config.ts`（`devIndicators: false`）+ `.gitignore`（排除 `scripts/.chrome-tmp*/` Chrome 调试临时档案）
**部署**：push 触发 Vercel 自动构建 → `oceanfolio-8d4hprj4g-oceannn-fangs-projects.vercel.app` 状态 ● Ready，生产域名 https://oceanfolio.vercel.app

**上线后线上复检（chrome-devtools 单实例）**

| 项 | 视口 | 结果 |
|---|---|---|
| 资源版本 | — | 线上 `index.html` 两处均为 `v=album-panel-7`；`styles.css` 含 #101 的 `max-height: 95px` 规则 |
| 面板居中 | 390×844 | panel 340×217，中心偏差 dx/dy = 0/0（精确居中） |
| 曲目限 4 行 | 390×844 | tracks 高 95px、行高 24px、共 10 行可滚 |
| 按钮集成 | 390×844 | play-button 位于面板内，310×44，距面板底 11px |
| 封面避让 | 390×844 | 封面 179px，底边距面板顶 24px，零重叠 |
| Now playing | 390×844 | 播放后在按钮上方展开（高 37px，文本 "15 Step"），面板自适应至 254px 仍在视口内 |
| 桌面回归 | 1440×900 | 面板与 `.focus` 严格等高（396px）、列表居左、按钮仍在右侧 `.focus-copy` |
| Console | 两端 | 零错误零警告 |

截图：`scripts/task102_prod_mobile_390.png`、`scripts/task102_prod_desktop_1440.png`
本地门禁：`npx tsc --noEmit` 零错误、`npx next build` 通过（Spotify 路由的 DYNAMIC_SERVER_USAGE 为既有预期的动态路由提示，非报错）

**devIndicators 验证（本地 dev，端口 3007）**：`nextjs-portal` 元素仍会被框架注入（承载其他 dev 能力），但其 shadow DOM 内 33 个子元素全部零尺寸，左下角不再可见“N”按钮；截图 `scripts/task102_dev_no_indicator.png`
