# 作品集更新：接入新作品《一夜情》（2026-10-28）

日期：2026-10-28　状态：**已接入并验证通过**（未提交、未部署）

---

## 一、问题：更新了吗？

**没有。** 本轮开始时注册表仍是 37 条，新作品未入站。

管线 `scripts/update-portfolio.mjs --dry-run` 报告「发现 2 张新作品」，但核实后**只有 1 张是真的新作品**。

---

## 二、两张候选的核实结果

### ① `I did it, I did that.png` —— **不是新作品，是同一张图的改名副本**

| 对比项 | 已注册 `I did this, I did that.png` | 存档 `I did it, I did that.png` |
|---|---|---|
| 大小 | 4,233,850 bytes | 4,233,850 bytes |
| mtime | 2026-08-25 18:29 | 2026-08-25 18:29 |
| SHA256 | 一致 | 一致 |
| 像素差异（Pillow `ImageChops.difference`） | —— | **bbox 为空 = 零差异** |

**字节完全相同**，只是文件名把 `this` 改成了 `it`。
若直接跑管线全量执行，会插入一条内容重复的条目，作品集里同一张图出现两次。

**用户决定：跳过，不插入。**（存档里该文件**未删除**，保持原样。）

### ② `一夜情.png` —— 真新作品

1080×1920、3.00MB、2026-10-13。用户拍板：**id 就用 `一夜情`**（不改成英文语义 id）。

> 与项目既有惯例（`晚餐見→dinner-view`）不同，这是用户明确选择。功能上无影响：
> `id` 只用于 React 内部状态与 `portfolioWorks.find()`，不参与路由。
> 代价：URL 会被百分号编码（`%E4%B8%80%E5%A4%9C%E6%83%85.webp`），分享/调试时不好看。

---

## 三、为什么没跑管线，而是手工接入

管线没有「跳过指定文件」的开关，全量执行必然把那张重复图一起插进去；
而删文件需要用户确认（红线）。所以本轮改为**只接新作品、不碰重复图**：

| 步骤 | 做法 |
|---|---|
| 原图 | `shutil.copy2` 复制到 `public/images/portfolio/一夜情.png`（保留字节） |
| 缩略图 | Pillow 240×428 WebP q80（scale-to-cover + 居中裁切，与既有 thumb 同规格） |
| WebP 衍生图 | 1080×1920 q82 method 6，保留 ICC（方案 A 同一档） |
| 注册表 | 手工置顶插入一行（与管线输出格式完全一致） |

脚本：`add-work-yiyewing.py`

---

## 四、改动文件

| 文件 | 改动 |
|---|---|
| `public/images/portfolio/一夜情.png` | **新增** 原图 3,000,362 bytes |
| `public/images/portfolio-thumbs/一夜情.webp` | **新增** 缩略图 5,964 bytes（240×428） |
| `public/images/portfolio/web/一夜情.webp` | **新增** 衍生图 92,922 bytes（1080×1920，占原图 **3.1%**） |
| `lib/portfolio-images.ts` | 数组首行插入 1 条：`{ id: '一夜情', title: '一夜情', …, date: '2026-10-13' }` |

注册表条目数：**37 → 38**。

---

## 五、验证

### 命令

```powershell
cd E:\portfolio
node scripts/update-portfolio.mjs --dry-run        # 差集核对
python portfolio-update_20261028_v1\add-work-yiyewing.py .
npx tsc --noEmit --tsBuildInfoFile portfolio-update_20261028_v1\tsc-update.tsbuildinfo   # exit 0
npx next build                                                              # exit 0
npx next start -p 3211
node portfolio-update_20261028_v1\verify-new-work.cjs 9333 http://127.0.0.1:3211 portfolio-update_20261028_v1\verify-new-work.json
```

### 断言（6/6 PASS，1440×900，CDP 固定视口）

| 断言 | 结果 |
|---|---|
| works 列表第一条是「一夜情」 | ✅ `first: "一夜情"` |
| DriftWall 含该作品缩略图 | ✅ 38 个图块，首个即 `一夜情.webp` |
| 单图用 `web/一夜情.webp` | ✅ |
| 单图已解码 1080×1920 | ✅ `complete=true, 1080×1920` |
| 大图浮层用 `.webp` | ✅ |
| **未请求 `一夜情.png` 原图** | ✅（该作品 4 次请求全为 `.webp`，`.png` 零请求） |

### 截图

`shots/rea-04-decode-settle.png` —— 大图浮层完整渲染（暖橙虚化背景＋白色歌词卡片，9:16 无裁切）。
缩略图裁切另见 `public/images/portfolio-thumbs/一夜情.webp`（240×428，主体未丢）。

---

## 六、测量过程中踩的两个坑（脚本已修）

1. **DriftWall 随 viewer 挂载**：未 hover 时 `portfolio-thumbs` 图片数为 0，
   断言必须在 hover 之后量，否则误判「新作品没上图块」。
2. **点击坐标失效**：hover 会改变行高/布局，用 hover 前的坐标点击会落空（浮层打不开）。
   修正为「hover → sleep → 重新量坐标 → 按下」。
3. **百分号编码坑**：中文 id 的 URL 是 `%E4%B8%80...`，
   资源过滤若直接 `includes('一夜情')` 会永远为空，导致「未请求 PNG」变成**空样子断言**。
   已改为先 `decodeURIComponent` 再匹配——否则这条 PASS 是假的。

---

## 七、遗留 / 需要你决定

1. **存档里那张重复图会一直被报为「新作品」**：管线按 `image` 的文件名 basename 去重，
   `I did this, I did that.png` ≠ `I did it, I did that.png`，所以**每次 dry-run 都会提议插入它**。
   要么把存档里那份改名/移走，要么以后每次手动跳过。要不要我把存档那份改名加上 `.bak`？
2. **未提交、未推送、未部署**：本地已生效，线上还是旧的 37 条。
3. `scripts/update-portfolio.mjs` 仍不生成 `imageWeb`（上次记录的后续项），
   所以**下次走管线接入的作品会自动缺少衍生图、回退到原图**（慢）。本轮是手工补的。

---

## 八、本任务产物

| 文件 | 用途 |
|---|---|
| `README.md` | 本报告 |
| `add-work-yiyewing.py` | 单件作品接入（原图 + 缩略图 + 衍生图） |
| `verify-new-work.cjs` | 展示路径验证（6 条断言） |
| `debug-overlay.cjs` | 排查浮层打不开 / DriftWall 挂载时机的调试脚本 |
| `verify-new-work.json` | 断言与请求记录原始数据 |
| `shots/rea-04-decode-settle.png` | 浮层渲染截图 |
| `tsc-update.tsbuildinfo`、`prod-server.log` | 类型检查/构建记录 |

---

## 九、排序更正（同日二次调整）

初次接入时我把《一夜情》按 `date` 排序放在了**最顶**。用户更正：

1. **最新作品是《應該》**，不是《一夜情》；
2. **《一夜情》应排在《晚餐見》之前**。

### 结果

已把《一夜情》从数组首位移到 `dinner-view` 之前（`date` 字段仍保留存档真实 mtime `2026-10-13`，
并加行内注释说明这是**人工指定位置**，避免后来人按日期"纠正"回去）。

浏览器实测渲染顺序（1440×900，`ul.work li` 的 innerText）：

```
 1. 應該            ← 最新，第一位
 2. 我連快樂都不敢了
 3. life & space
 4. there's something here for us both
 5. wish it was easy
 6. i did this, i did that
 7. 一夜情          ← 紧邻在晚餐見之前
 8. 晚餐見
 9. 一百種生活
10. conveni
```

断言 4/4 PASS（见 `verify-order.json`）；`tsc --noEmit` 0、`next build` 0。

> 踩坑记录：第一版断言把期望文案写成 `I Did This, I Did That`，而 UI 渲染为小写
> `i did this, i did that`，导致误报 FAIL。已改为大小写不敏感匹配。

### 遗留：`date` 与排序不自洽

`date: '2026-10-13'` 现在排在 `2026-08-25` 之后、`2026-07-24` 之前，**违反了文件头
「按修改时间倒序」的约定**。需要用户提供该作品的真实创作日期，才能同时满足排序与数据自洽。

---

## 十、用小红书主页交叉核对（2026-10-28）

用户提供主页链接 `https://xhslink.cn/o/6zy3VtWkEnl`，短链解析为
`https://www.xiaohongshu.com/user/profile/5c52e66b000000001a027f4b`（用户名「靛藍.」）。

### 抓取方式与限制

- `web_fetch` 只能拿到页面骨架（笔记列表是客户端渲染）。
- 用**临时配置的 Chrome**（`chrome-xhs-read-v1`，不碰用户主配置）通过 CDP 读取，
  拿到 **30 条**笔记标题。
- 想继续滚动加载更多时失败：该 Chrome(124) 的 `Input` 域（mouseWheel/截图）会超时；
  且主页是**虚拟化网格**，滚出视口的节点被卸载，节点数不会增长；匿名重复访问还被限流到 10 条。
  **因此下面只覆盖前 30 条，不是全量。**

### 结论 1：排序正确 ✅

前 8 位与注册表**逐一吻合**：

```
 1. 應該          2. 我連快樂都不敢了    3. Life & space
 4. There's Something Here for Us Both   5. Wish It Was Easy
 6. I did this, I did that               7. 一夜情  ← 在晚餐見之前
 8. 晚餐見
```

这独立印证了「最新是《應該》、《一夜情》在《晚餐見》之前」的排序是对的。

### 结论 2：命名差异（需用户决定）

| # | 小红书 | 注册表 | 性质 |
|---|---|---|---|
| 9 | `100種生活` | `一百種生活` | **实质差异**：数字 vs 汉字 |
| 19 | `Typewrite Leeson` | `Typewrite Lesson` | 小红书疑似笔误（Leeson/Lesson） |
| 20 | `Hair Cut-Re-Make` | `Hair Cut Re Make` | 连字符写法 |
| 3/5/6/10/21/24 | `Life & space` / `Wish It Was Easy` / `I did this, I did that` / `conveni` / `braincells` / `just stand there` | 同名 Title Case | **样式差异**：注册表按 #62 约定统一 Title Case |

> **用户决定（2026-10-28）：一律沿用注册表命名**，不向小红书对齐。
> 因此《一百種生活》《Typewrite Lesson》《Hair Cut Re Make》及所有 Title Case 条目**保持原样，无改动**。

### 结论 3：5 件作品在注册表里完全没有

| # | 标题 |
|---|---|
| 17 | `Parsec` |
| 18 | `發達年會` |
| 22 | `Fayzz` |
| 23 | `Outlast` |
| 28 | `小奔走繽紛樂園` |

这 5 件**既不在注册表，也不在存档 PNG 里**（存档 38 张 PNG 已全部对应注册表条目）。
推测是更早期的作品、原图未归档。**要接入需先有源文件**，目前无图可接。

### 结论 4：注册表有 15 件未出现在前 30 条笔记中

`Racing Mount Pleasant`、`Piano`、`25歲永不停下`、`Be`、`臺階`、`Mercei`、`月光 Moonlight`、
`Concorde`、`Pictures of Us`、`Driveslow Intro`、`一顆灰塵`、`Tide`、`Orange Moon`
（外加上面表里的 `一百種生活`、`Typewrite Lesson` 两条只是命名差异）

可能是小红书第 2 页内容，也可能这些作品没发小红书。**未验证，不下结论。**

### 本节的产物

| 文件 | 说明 |
|---|---|
| `read-xhs-profile.cjs` | 首版抓取（拿到 30 条，成功） |
| `read-xhs-all.cjs` | 滚动加载版（受虚拟化与 Input 超时限制，失败） |
| `xhs-profile.json` | 30 条笔记原始数据 |
| `xhs-profile-full.json` | 滚动版结果（仅 10 条，记录失败原因） |


