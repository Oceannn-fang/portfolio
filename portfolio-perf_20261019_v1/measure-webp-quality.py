# -*- coding: utf-8 -*-
"""
WebP 衍生图的画质保真度测量（q82 是否可见劣化）

对每个作品：解码 PNG 原图与 WebP 衍生图 → 计算 PSNR 与平均绝对误差。
PSNR >= 40dB 通常视为肉眼不可辨；本脚本报告最小值/中位数，确认没有个别图被压坏。

用法：python measure-webp-quality.py <repoRoot>
"""
import math
import os
import re
import sys

import numpy as np
from PIL import Image

root = sys.argv[1] if len(sys.argv) > 1 else r"E:\portfolio"
registry = os.path.join(root, "lib", "portfolio-images.ts")
public_dir = os.path.join(root, "public")

with open(registry, encoding="utf-8") as f:
    text = f.read()

entries = re.findall(r"\{ id: '([^']+)',[^\n]*?image: '([^']+)'[^\n]*?imageWeb: '([^']+)'", text)
if not entries:
    raise SystemExit("未能解析出带 imageWeb 的条目")

rows = []
for work_id, png_path, web_path in entries:
    png = os.path.join(public_dir, png_path.lstrip("/").replace("/", os.sep))
    web = os.path.join(public_dir, web_path.lstrip("/").replace("/", os.sep))
    if not (os.path.exists(png) and os.path.exists(web)):
        continue
    with Image.open(png) as a, Image.open(web) as b:
        pa = np.asarray(a.convert("RGB"), dtype=np.float64)
        pb = np.asarray(b.convert("RGB"), dtype=np.float64)
    if pa.shape != pb.shape:
        rows.append((work_id, pa.shape, pb.shape, float("nan"), float("nan")))
        continue
    mse = float(np.mean((pa - pb) ** 2))
    psnr = float("inf") if mse == 0 else 10 * math.log10((255.0 ** 2) / mse)
    mae = float(np.mean(np.abs(pa - pb)))
    rows.append((work_id, pa.shape, pb.shape, psnr, mae))

valid = [r for r in rows if r[3] == r[3]]
valid.sort(key=lambda r: r[3])

print(f"{'id':<32}{'PSNR(dB)':>10}{'平均绝对误差':>14}")
for work_id, _, _, psnr, mae in valid[:6]:
    print(f"{work_id:<32}{psnr:>10.2f}{mae:>14.2f}")
print("  ...（按 PSNR 升序，上面是最差的 6 张）")
print()
psnrs = [r[3] for r in valid]
print(f"测量张数     : {len(valid)}")
print(f"PSNR 最小    : {min(psnrs):.2f} dB")
print(f"PSNR 中位数  : {sorted(psnrs)[len(psnrs)//2]:.2f} dB")
print(f"PSNR < 40dB  : {sum(1 for p in psnrs if p < 40)} 张")
print(f"尺寸不一致   : {sum(1 for r in rows if r[1] != r[2])} 张")
