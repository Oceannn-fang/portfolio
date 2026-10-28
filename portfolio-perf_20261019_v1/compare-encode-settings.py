# -*- coding: utf-8 -*-
"""
编码参数对比：在"画质可接受"的前提下找最小体积档位

背景：WebP q82 实测中位 PSNR 仅 35.3dB、34/37 张低于 40dB，最差 23.2dB，
对作品集偏高（胶片颗粒被平滑）。本脚本用最差代表样本比较：
  WebP q82 / q88 / q92 / q95、AVIF q60 / q70 / q80
输出每档的 PSNR 与体积，并给出按均值外推的全量体积，用于定档。

用法：python compare-encode-settings.py <repoRoot> [样本id...]
"""
import io
import math
import os
import re
import sys

import numpy as np
from PIL import Image

root = sys.argv[1] if len(sys.argv) > 1 else r"E:\portfolio"
sample_ids = sys.argv[2:] or ["vienna", "pictures-of-us", "hair-cut-re-make", "heal-me-good", "orange-moon"]

registry = os.path.join(root, "lib", "portfolio-images.ts")
public_dir = os.path.join(root, "public")
with open(registry, encoding="utf-8") as f:
    text = f.read()
entries = {m[0]: m[1] for m in re.findall(r"\{ id: '([^']+)',[^\n]*?image: '([^']+)'", text)}


def psnr(a, b):
    mse = float(np.mean((a - b) ** 2))
    return float("inf") if mse == 0 else 10 * math.log10((255.0 ** 2) / mse)


def encode(rgb, fmt, **kw):
    buf = io.BytesIO()
    try:
        rgb.save(buf, format=fmt, **kw)
    except Exception as e:  # 例如该 Pillow 不支持 AVIF 编码
        return None, str(e)
    return buf.getvalue(), None


settings = [
    ("WebP q82", "WEBP", dict(quality=82, method=6)),
    ("WebP q88", "WEBP", dict(quality=88, method=6)),
    ("WebP q92", "WEBP", dict(quality=92, method=6)),
    ("WebP q95", "WEBP", dict(quality=95, method=6)),
    ("AVIF q60", "AVIF", dict(quality=60)),
    ("AVIF q70", "AVIF", dict(quality=70)),
    ("AVIF q80", "AVIF", dict(quality=80)),
]

base = {}
for wid in sample_ids:
    path = os.path.join(public_dir, entries[wid].lstrip("/").replace("/", os.sep))
    with Image.open(path) as im:
        arr = np.asarray(im.convert("RGB"), dtype=np.uint8)
    base[wid] = (arr, os.path.getsize(path))

print(f"样本: {', '.join(sample_ids)}")
print(f"样本 PNG 合计: {sum(v[1] for v in base.values())/1024/1024:.1f} MB")
print()
header = f"{'档位':<10}" + "".join(f"{w[:12]:>14}" for w in sample_ids) + f"{'PNG合计%':>10}"
print(header)
for label, fmt, kw in settings:
    cells = []
    total = 0
    ok = True
    for wid in sample_ids:
        arr, _ = base[wid]
        data, err = encode(Image.fromarray(arr), fmt, **kw)
        if data is None:
            cells.append(f"{'不支持':>14}")
            ok = False
            continue
        with Image.open(io.BytesIO(data)) as rt:
            dec = np.asarray(rt.convert("RGB"), dtype=np.uint8)
        total += len(data)
        cells.append(f"{psnr(arr.astype(np.float64), dec.astype(np.float64)):>6.1f}dB{len(data)/1024:>6.0f}K")
    png_total = sum(v[1] for v in base.values())
    pct = f"{total/png_total*100:>9.1f}%" if ok else f"{'—':>10}"
    print(f"{label:<10}" + "".join(cells) + pct)

print()
print("说明：每格为 PSNR / 该档体积；末列是按样本合计外推的相对 PNG 体积。")
