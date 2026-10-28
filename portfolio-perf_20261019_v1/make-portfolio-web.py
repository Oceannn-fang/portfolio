# -*- coding: utf-8 -*-
"""
作品集原图 → WebP 衍生图（方案 A）

背景：public/images/portfolio/*.png 是 1080×1920 的无损 PNG，单张平均 3.25MB
（最大 5.67MB），49 张合计 159.2MB；线上从国内直连 Vercel 实测吞吐 316-547KB/s，
单张要 9-18 秒。同尺寸转 WebP q82 后平均 259KB（约 PNG 的 7.8%）。

本脚本只做一件事：为注册表 lib/portfolio-images.ts 里**每个作品的 id** 生成
    public/images/portfolio/web/<id>.webp
（用 id 而不是原文件名，顺带把中文/空格/弯引号的原始文件名换成纯 ASCII URL）

- 尺寸保持 1080×1920 原样（2× 屏展示够用，作品图不做降采样）
- 质量 q82 / method 6（与胶片档案 web 衍生图同一档）
- 保留 ICC profile（若有），避免色偏
- 幂等：重复运行输出一致；每次打印前后体积

用法：python make-portfolio-web.py <repoRoot>
"""
import io
import os
import re
import sys

from PIL import Image

root = sys.argv[1] if len(sys.argv) > 1 else r"E:\portfolio"
registry = os.path.join(root, "lib", "portfolio-images.ts")
public_dir = os.path.join(root, "public")
out_dir = os.path.join(public_dir, "images", "portfolio", "web")

QUALITY = 82
METHOD = 6

with open(registry, encoding="utf-8") as f:
    text = f.read()

# 注册条目形如：{ id: 'should', title: '應該', image: '/images/portfolio/應該.png', ... }
entries = re.findall(r"\{ id: '([^']+)',[^\n]*?image: '([^']+)'", text)
if not entries:
    raise SystemExit("未能从注册表解析出条目，锚点异常")

os.makedirs(out_dir, exist_ok=True)

total_src = 0
total_dst = 0
rows = []
missing = []

for work_id, image_path in entries:
    src = os.path.join(public_dir, image_path.lstrip("/").replace("/", os.sep))
    if not os.path.exists(src):
        missing.append((work_id, image_path))
        continue
    dst = os.path.join(out_dir, f"{work_id}.webp")
    src_bytes = os.path.getsize(src)

    with Image.open(src) as im:
        icc = im.info.get("icc_profile")
        rgb = im.convert("RGB")
        buf = io.BytesIO()
        rgb.save(buf, format="WEBP", quality=QUALITY, method=METHOD, icc_profile=icc)
    data = buf.getvalue()

    with open(dst, "wb") as f:
        f.write(data)

    total_src += src_bytes
    total_dst += len(data)
    rows.append((work_id, src_bytes, len(data)))

rows.sort(key=lambda r: r[1], reverse=True)

print(f"{'id':<32}{'PNG':>10}{'WebP':>9}{'比例':>8}")
for work_id, s, d in rows[:6]:
    print(f"{work_id:<32}{s/1024:>9.0f}K{d/1024:>8.0f}K{d/s*100:>7.1f}%")
print("  ...")
print()
print(f"条目数            : {len(entries)}")
print(f"已生成            : {len(rows)}  ({os.path.relpath(out_dir, root)})")
print(f"PNG 合计          : {total_src/1024/1024:8.1f} MB")
print(f"WebP 合计         : {total_dst/1024/1024:8.1f} MB  ({total_dst/total_src*100:.1f}%)")
print(f"单张平均          : {total_src/len(rows)/1024/1024:.2f} MB -> {total_dst/len(rows)/1024:.0f} KB")
if missing:
    print()
    print("!! 注册表引用了但磁盘上不存在的原图:")
    for work_id, p in missing:
        print(f"   {work_id}: {p}")
    sys.exit(2)
