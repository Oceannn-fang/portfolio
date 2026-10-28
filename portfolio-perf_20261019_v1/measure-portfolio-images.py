# -*- coding: utf-8 -*-
"""
作品集原图的体积构成测量（只读，不写入 public/）

目的：把「线上图片慢」从「感觉」变成「数字」，并量化修复收益：
  1. public/images/portfolio/*.png 的实际像素尺寸与字节数
  2. 同尺寸转 WebP（q82）后的大小 —— 判断问题是否只在编码格式，而非分辨率
  3. 长边压到 1600 后再转 WebP 的大小 —— 判断分辨率还能再省多少
  4. 全量合计：现状 vs 转码后

用法：python measure-portfolio-images.py <repoRoot>
"""
import io
import os
import sys

from PIL import Image

root = sys.argv[1] if len(sys.argv) > 1 else r"E:\portfolio"
src_dir = os.path.join(root, "public", "images", "portfolio")

rows = []
total_png = 0
total_webp_same = 0
total_webp_1600 = 0

for name in sorted(os.listdir(src_dir)):
    if not name.lower().endswith(".png"):
        continue
    path = os.path.join(src_dir, name)
    png_bytes = os.path.getsize(path)
    total_png += png_bytes
    with Image.open(path) as im:
        w, h = im.size
        rgb = im.convert("RGB")

        buf = io.BytesIO()
        rgb.save(buf, format="WEBP", quality=82, method=6)
        webp_same = buf.tell()
        total_webp_same += webp_same

        long_edge = max(w, h)
        if long_edge > 1600:
            scale = 1600 / long_edge
            small = rgb.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
        else:
            small = rgb
        buf2 = io.BytesIO()
        small.save(buf2, format="WEBP", quality=82, method=6)
        webp_1600 = buf2.tell()
        total_webp_1600 += webp_1600

    rows.append((name, w, h, png_bytes, webp_same, webp_1600))

rows.sort(key=lambda r: r[3], reverse=True)

print("== 体积最大的 8 张 ==")
print(f"{'文件':<34}{'尺寸':>12}{'PNG':>10}{'WebP同尺寸':>12}{'WebP≤1600':>11}")
for name, w, h, png, same, small in rows[:8]:
    label = name if len(name) <= 32 else name[:31] + "…"
    print(f"{label:<34}{f'{w}x{h}':>12}{png/1024:>9.0f}K{same/1024:>11.0f}K{small/1024:>10.0f}K")

n = len(rows)
print()
print(f"文件数              : {n}")
print(f"PNG 合计            : {total_png/1024/1024:8.1f} MB")
print(f"WebP q82 同尺寸合计 : {total_webp_same/1024/1024:8.1f} MB  ({total_webp_same/total_png*100:5.1f}% of PNG)")
print(f"WebP q82 ≤1600 合计 : {total_webp_1600/1024/1024:8.1f} MB  ({total_webp_1600/total_png*100:5.1f}% of PNG)")
print()
print(f"单张平均 PNG        : {total_png/n/1024/1024:8.2f} MB")
print(f"单张平均 WebP 同尺寸: {total_webp_same/n/1024:8.0f} KB")
