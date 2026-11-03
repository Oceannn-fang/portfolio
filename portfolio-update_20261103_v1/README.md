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
2. **未推送、未部署**：线上仍是旧版本。
3. `scripts/update-portfolio.mjs` 仍不生成 `imageWeb`，走管线接入的作品会自动缺衍生图、回退原图（慢）。

---

## 七、本任务产物

| 文件 | 用途 |
|---|---|
| `README.md` | 本报告 |
| `add-work-carmen.py` | 单件作品接入（原图 + 缩略图 + 衍生图，含重复项复核） |
| `verify-new-work.cjs` | 展示路径验证（7 条断言，含空断言自检） |
| `verify-new-work.json` | 断言与请求记录 |
| `shots/rea-04-decode-settle.png` | 浮层渲染截图 |
| `tsc.tsbuildinfo`、`prod-server.log` | 类型检查/构建记录 |
