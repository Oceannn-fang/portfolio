# -*- coding: utf-8 -*-
"""
胶片原图 → web 尺寸衍生图 样本生成（只读原图，只写新文件）

背景：public/images/film/roll-017/*.jpg 单张 10-20MB、4556x3047，
灯箱直接引用原图，跨境/移动网络下等于每张下载 15MB+。
本脚本按长边限幅 + JPEG 质量重编码，输出到独立的 web/ 子目录，
原图完全不改动（可随时回退 / 需要原图时仍有据可查）。
"""
import os
import sys
import time
from PIL import Image, ImageOps

SRC_DIR = r"E:\portfolio\public\images\film\roll-017"
OUT_DIR = r"E:\portfolio\public\images\film\roll-017\web"
MAX_SIDE = 2000
QUALITY = 82


def convert(src_path: str, out_path: str) -> dict:
    t0 = time.time()
    with Image.open(src_path) as im:
        im = ImageOps.exif_transpose(im)  # 保留拍摄方向，避免衍生图方向翻转
        w, h = im.size
        scale = min(1.0, MAX_SIDE / max(w, h))
        if scale < 1.0:
            im = im.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
        if im.mode != "RGB":
            im = im.convert("RGB")
        tmp = out_path + ".tmp"
        im.save(tmp, "JPEG", quality=QUALITY, optimize=True, progressive=True)
        os.replace(tmp, out_path)
        out_w, out_h = im.size
    return {
        "src_bytes": os.path.getsize(src_path),
        "out_bytes": os.path.getsize(out_path),
        "src_size": (w, h),
        "out_size": (out_w, out_h),
        "seconds": round(time.time() - t0, 2),
    }


def main() -> int:
    targets = sys.argv[1:]
    if not targets:
        names = sorted(f for f in os.listdir(SRC_DIR) if f.lower().endswith(".jpg"))
        targets = names[:1]
    os.makedirs(OUT_DIR, exist_ok=True)
    total_in = total_out = 0
    for name in targets:
        src_path = os.path.join(SRC_DIR, name)
        out_path = os.path.join(OUT_DIR, name)
        if not os.path.isfile(src_path):
            print(f"[skip] 不存在: {name}")
            continue
        r = convert(src_path, out_path)
        total_in += r["src_bytes"]
        total_out += r["out_bytes"]
        print(
            "{:<12} {:>7.2f}MB -> {:>6.2f}MB  ({:>4}x{:<4} -> {:>4}x{:<4})  压缩 {:.1f}x  用时 {}s".format(
                name,
                r["src_bytes"] / 1048576,
                r["out_bytes"] / 1048576,
                r["src_size"][0], r["src_size"][1],
                r["out_size"][0], r["out_size"][1],
                r["src_bytes"] / max(1, r["out_bytes"]),
                r["seconds"],
            )
        )
    if total_in:
        print(
            "\n合计: {:.1f}MB -> {:.1f}MB  (省 {:.1f}%)".format(
                total_in / 1048576, total_out / 1048576,
                100 * (1 - total_out / total_in),
            )
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
