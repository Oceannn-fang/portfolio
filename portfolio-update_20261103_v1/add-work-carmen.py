# -*- coding: utf-8 -*-
"""
单件作品接入：Carmen（2026-11-01）

为什么不跑 update-portfolio.mjs 全量执行：
dry-run 会同时插入 `I did it, I did that.png`，而那张与已注册的
`I did this, I did that.png` **字节完全相同**（上一轮已用 SHA256 与像素差验证），
插进去会造成重复作品。管线没有"跳过指定文件"的开关，故只接新作品。

本脚本只做素材三件事（不动注册表）：
  1. 原图复制 public/images/portfolio/carmen.png（保留字节）
  2. 缩略图 240×428 WebP q80（scale-to-cover + 居中裁切）
  3. 单图/浮层用 WebP 衍生图 1080×1920 q82 method 6（保留 ICC）

用法：python add-work-carmen.py <repoRoot>
"""
import hashlib
import os
import shutil
import sys

from PIL import Image

ROOT = sys.argv[1] if len(sys.argv) > 1 else r"E:\portfolio"
SRC_DIR = r"C:\Users\86185\OneDrive\图片\存档"

WORK_ID = "carmen"
SRC = os.path.join(SRC_DIR, "carmen.png")
DUP_SRC = os.path.join(SRC_DIR, "I did it, I did that.png")
DUP_ALREADY = os.path.join(ROOT, "public", "images", "portfolio", "I did this, I did that.png")

DEST_PNG = os.path.join(ROOT, "public", "images", "portfolio", f"{WORK_ID}.png")
DEST_THUMB = os.path.join(ROOT, "public", "images", "portfolio-thumbs", f"{WORK_ID}.webp")
DEST_WEB = os.path.join(ROOT, "public", "images", "portfolio", "web", f"{WORK_ID}.webp")

THUMB_W, THUMB_H, THUMB_Q = 240, 428, 80
WEB_Q, WEB_METHOD = 82, 6


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


if not os.path.exists(SRC):
    raise SystemExit(f"源文件不存在: {SRC}")
if os.path.exists(DEST_PNG):
    raise SystemExit(f"目标已存在，拒绝覆盖: {DEST_PNG}")

# 复核重复项仍是同一张（防止这次其实换了图）
if os.path.exists(DUP_SRC) and os.path.exists(DUP_ALREADY):
    same = sha256(DUP_SRC) == sha256(DUP_ALREADY)
    print(f"重复项复核: I did it / I did this 内容相同 = {same}")
    if not same:
        print("  ⚠ 内容已不同，需人工重新判断是否为新作品")

# 1. 原图复制
shutil.copy2(SRC, DEST_PNG)
src_bytes = os.path.getsize(DEST_PNG)

with Image.open(SRC) as im:
    icc = im.info.get("icc_profile")
    rgb = im.convert("RGB")
    w, h = rgb.size

    # 2. 缩略图
    scale = max(THUMB_W / w, THUMB_H / h)
    nw, nh = max(THUMB_W, round(w * scale)), max(THUMB_H, round(h * scale))
    resized = rgb.resize((nw, nh), Image.LANCZOS)
    left, top = (nw - THUMB_W) // 2, (nh - THUMB_H) // 2
    thumb = resized.crop((left, top, left + THUMB_W, top + THUMB_H))
    os.makedirs(os.path.dirname(DEST_THUMB), exist_ok=True)
    thumb.save(DEST_THUMB, format="WEBP", quality=THUMB_Q, method=6)

    # 3. 衍生图
    os.makedirs(os.path.dirname(DEST_WEB), exist_ok=True)
    rgb.save(DEST_WEB, format="WEBP", quality=WEB_Q, method=WEB_METHOD, icc_profile=icc)

print(f"作品 id      : {WORK_ID}")
print(f"原图尺寸     : {w}x{h}")
print(f"原图         : {src_bytes/1024/1024:.2f} MB")
print(f"缩略图       : {os.path.getsize(DEST_THUMB)/1024:.0f} KB  ({THUMB_W}x{THUMB_H})")
print(f"WebP 衍生图  : {os.path.getsize(DEST_WEB)/1024:.0f} KB  ({w}x{h})")
print(f"衍生图占原图 : {os.path.getsize(DEST_WEB)/src_bytes*100:.1f}%")
