# -*- coding: utf-8 -*-
"""
单件作品接入：一夜情（2026-10-13）

为什么不用 update-portfolio.mjs 全量跑：dry-run 显示它会同时插入
「I did it, I did that.png」，而那张与已注册作品**字节完全相同**（SHA256 一致、
像素零差异），插进去会出现重复作品。因此这一步只接新作品，不碰重复图。

本脚本只做素材三件事（不动注册表）：
  1. 原图复制 public/images/portfolio/一夜情.png（保留字节）
  2. 缩略图 240×428 WebP q80（scale-to-cover + 居中裁切，与既有 thumb 同规格）
  3. 单图/浮层用 WebP 衍生图 1080×1920 q82（方案 A，约 270KB 量级）

用法：python add-work-yiyewing.py <repoRoot>
"""
import os
import shutil
import sys

from PIL import Image

ROOT = sys.argv[1] if len(sys.argv) > 1 else r"E:\portfolio"
SRC = r"C:\Users\86185\OneDrive\图片\存档\一夜情.png"

WORK_ID = "一夜情"
DEST_PNG = os.path.join(ROOT, "public", "images", "portfolio", f"{WORK_ID}.png")
DEST_THUMB = os.path.join(ROOT, "public", "images", "portfolio-thumbs", f"{WORK_ID}.webp")
DEST_WEB = os.path.join(ROOT, "public", "images", "portfolio", "web", f"{WORK_ID}.webp")

THUMB_W, THUMB_H, THUMB_Q = 240, 428, 80
WEB_Q, WEB_METHOD = 82, 6

if not os.path.exists(SRC):
    raise SystemExit(f"源文件不存在: {SRC}")

# 1. 原图复制（保留字节）
shutil.copy2(SRC, DEST_PNG)
src_bytes = os.path.getsize(DEST_PNG)

with Image.open(SRC) as im:
    icc = im.info.get("icc_profile")
    rgb = im.convert("RGB")
    w, h = rgb.size

    # 2. 缩略图：scale-to-cover + 居中裁切
    scale = max(THUMB_W / w, THUMB_H / h)
    nw, nh = max(THUMB_W, round(w * scale)), max(THUMB_H, round(h * scale))
    resized = rgb.resize((nw, nh), Image.LANCZOS)
    left = (nw - THUMB_W) // 2
    top = (nh - THUMB_H) // 2
    thumb = resized.crop((left, top, left + THUMB_W, top + THUMB_H))
    os.makedirs(os.path.dirname(DEST_THUMB), exist_ok=True)
    thumb.save(DEST_THUMB, format="WEBP", quality=THUMB_Q, method=6)

    # 3. 衍生图：保持原尺寸
    os.makedirs(os.path.dirname(DEST_WEB), exist_ok=True)
    rgb.save(DEST_WEB, format="WEBP", quality=WEB_Q, method=WEB_METHOD, icc_profile=icc)

print(f"作品 id      : {WORK_ID}")
print(f"原图尺寸     : {w}x{h}")
print(f"原图         : {DEST_PNG}  {src_bytes/1024/1024:.2f} MB")
print(f"缩略图       : {DEST_THUMB}  {os.path.getsize(DEST_THUMB)/1024:.0f} KB  ({THUMB_W}x{THUMB_H})")
print(f"WebP 衍生图  : {DEST_WEB}  {os.path.getsize(DEST_WEB)/1024:.0f} KB  ({w}x{h})")
print(f"衍生图占原图 : {os.path.getsize(DEST_WEB)/src_bytes*100:.1f}%")
