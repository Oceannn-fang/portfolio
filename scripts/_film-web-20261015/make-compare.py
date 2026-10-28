# -*- coding: utf-8 -*-
"""
原图 vs 衍生图 100% 像素对照取证

从同一坐标裁取同样大小的区域（不缩放），上下拼接输出一张对比图，
用于判断 2000px / q82 的衍生图是否有可见的画质损失。
"""
import os
from PIL import Image, ImageDraw

SRC = r"E:\portfolio\public\images\film\roll-017"
WEB = os.path.join(SRC, "web")
OUT = r"E:\portfolio\scripts\_film-web-20261015\compare-000043.jpg"

CROP = 900          # 裁剪边长（像素，1:1 不缩放）
NAME = "000043.jpg"  # 这张含大量细节，最适合看压缩损失


def crop_at(im: Image.Image, box_w: int) -> Image.Image:
    """取画面中央偏上区域：胶片扫描件细节通常集中在中间。"""
    w, h = im.size
    left = (w - box_w) // 2
    top = int(h * 0.30)
    return im.crop((left, top, left + box_w, top + box_w))


def main() -> int:
    with Image.open(os.path.join(SRC, NAME)) as raw:
        src = raw.convert("RGB")
    with Image.open(os.path.join(WEB, NAME)) as wraw:
        web = wraw.convert("RGB")

    # 衍生图是等比缩放过的，同样的画面区域要按比例换算坐标
    ratio = web.size[0] / src.size[0]
    src_crop = crop_at(src, CROP)
    web_crop = crop_at(web, max(1, round(CROP * ratio)))
    if web_crop.size != (CROP, CROP):
        web_crop = web_crop.resize((CROP, CROP), Image.LANCZOS)

    label_h = 34
    canvas = Image.new("RGB", (CROP, CROP * 2 + label_h * 2), (16, 16, 16))
    draw = ImageDraw.Draw(canvas)
    draw.text((10, 10), f"ORIGINAL {NAME}  {src.size[0]}x{src.size[1]}  1:1 crop", fill=(240, 240, 240))
    canvas.paste(src_crop, (0, label_h))
    draw.text((10, label_h + CROP + 10),
              f"WEB DERIVATIVE  2000px q82  ratio={ratio:.4f}", fill=(240, 240, 240))
    canvas.paste(web_crop, (0, label_h * 2 + CROP))
    canvas.save(OUT, "JPEG", quality=92)
    print(f"对比图已输出: {OUT}")
    print(f"  上=原图 1:1 裁切 {CROP}px / 下=衍生图换算后同区域放大到 {CROP}px")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
