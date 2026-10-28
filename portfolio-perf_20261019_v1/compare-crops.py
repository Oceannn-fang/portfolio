# -*- coding: utf-8 -*-
"""
1:1 裁切比对：PNG 原图 vs WebP 衍生图（判断 q82 是否真的可见劣化）

PSNR 在颗粒丰富的照片上偏悲观；而 q82→q95 体积涨 70% 但 PSNR 几乎不动，
说明误差主要来自色度重采样等"与质量无关"的固定差异。所以这里：
  1. 分解误差：亮度(Y) PSNR / 色度(Cb,Cr) 平均绝对误差 / 逐通道 MAE
  2. 生成 1:1 三联图：左=PNG、中=WebP q82、右=差异×8（同一区域）
  3. 无损往返（lossless WebP）作为对照，确认管线本身不失真

用法：python compare-crops.py <repoRoot> <workId> [quality]
"""
import io
import math
import os
import re
import sys

import numpy as np
from PIL import Image, ImageDraw

root = sys.argv[1] if len(sys.argv) > 1 else r"E:\portfolio"
work_id = sys.argv[2] if len(sys.argv) > 2 else "vienna"
quality = int(sys.argv[3]) if len(sys.argv) > 3 else 82

registry = os.path.join(root, "lib", "portfolio-images.ts")
public_dir = os.path.join(root, "public")
with open(registry, encoding="utf-8") as f:
    text = f.read()
m = re.search(r"\{ id: '" + re.escape(work_id) + r"',[^\n]*?image: '([^']+)'", text)
png_path = os.path.join(public_dir, m.group(1).lstrip("/").replace("/", os.sep))
web_path = os.path.join(public_dir, "images", "portfolio", "web", f"{work_id}.webp")

png = Image.open(png_path).convert("RGB")
web = Image.open(web_path).convert("RGB")
a = np.asarray(png, dtype=np.float64)
b = np.asarray(web, dtype=np.float64)

print(f"作品: {work_id}  尺寸: {png.size}")
print(f"PNG  : {os.path.getsize(png_path)/1024:.0f} KB")
print(f"WebP : {os.path.getsize(web_path)/1024:.0f} KB  ({os.path.getsize(web_path)/os.path.getsize(png_path)*100:.1f}%)")

# 逐通道
for i, ch in enumerate("RGB"):
    print(f"  {ch} 通道 MAE: {np.mean(np.abs(a[:,:,i]-b[:,:,i])):.2f}/255")
# 亮度/色度
ya = np.asarray(png.convert("YCbCr"), dtype=np.float64)
yb = np.asarray(web.convert("YCbCr"), dtype=np.float64)
mse_y = float(np.mean((ya[:, :, 0] - yb[:, :, 0]) ** 2))
psnr_y = float("inf") if mse_y == 0 else 10 * math.log10(255.0 ** 2 / mse_y)
print(f"  亮度 Y PSNR : {psnr_y:.2f} dB")
print(f"  色度 Cb MAE : {np.mean(np.abs(ya[:,:,1]-yb[:,:,1])):.2f}/255")
print(f"  色度 Cr MAE : {np.mean(np.abs(ya[:,:,2]-yb[:,:,2])):.2f}/255")

# 无损往返对照
buf = io.BytesIO()
png.save(buf, format="WEBP", lossless=True, method=6)
with Image.open(io.BytesIO(buf.getvalue())) as rt:
    l = np.asarray(rt.convert("RGB"), dtype=np.float64)
mse_l = float(np.mean((a - l) ** 2))
print(f"  无损 WebP 往返 PSNR: {'inf' if mse_l == 0 else f'{10*math.log10(255.0**2/mse_l):.2f}'} dB  （确认管线本身无失真）")

# 1:1 三联图（取画面中心偏上、细节较多的区域）
w, h = png.size
cw, chh = 420, 420
cx = int(w * 0.5 - cw / 2)
cy = int(h * 0.35 - chh / 2)
box = (cx, cy, cx + cw, cy + chh)
png_c = png.crop(box)
web_c = web.crop(box)
diff = np.abs(np.asarray(png_c, dtype=np.int16) - np.asarray(web_c, dtype=np.int16)).astype(np.uint8)
diff_img = Image.fromarray(np.clip(diff.astype(np.int16) * 8, 0, 255).astype(np.uint8))

pad = 12
label_h = 26
canvas = Image.new("RGB", (cw * 3 + pad * 4, chh + label_h + pad * 2), (18, 18, 20))
d = ImageDraw.Draw(canvas)
for i, (img, label) in enumerate([(png_c, "PNG original"), (web_c, f"WebP q{quality}"), (diff_img, "diff x8")]):
    x = pad + i * (cw + pad)
    canvas.paste(img, (x, pad + label_h))
    d.text((x + 2, pad + 6), label, fill=(240, 235, 225))
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), f"crop-{work_id}-q{quality}.png")
canvas.save(out)
print(f"\n1:1 比对图: {out}")
