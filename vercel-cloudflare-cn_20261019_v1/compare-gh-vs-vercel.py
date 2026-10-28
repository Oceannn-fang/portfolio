# -*- coding: utf-8 -*-
"""
GitHub Pages vs Vercel：同尺寸文件的下载耗时对比（国内直连，不走代理）

上一版 PowerShell 版被 curl 的多行 -w 输出打乱，这里改用 Python 精确解析：
  - 同一 URL 重复抓 N 次，curl 在一条连接上复用（只有第一次有 appconnect）
  - 累加 size_download / time_total，扣掉首次 TLS 握手，得到纯传输吞吐
  - 同时报告每次耗时，用标准差反映线路抖动

用法：python compare-gh-vs-vercel.py
"""
import re
import statistics
import subprocess
import sys

CURL = "curl.exe"

# 同一站点抓同一批页面 N 轮，让连接复用
TARGETS = {
    "github.io (jekyllrb.com)": [
        "https://jekyllrb.com/",
        "https://jekyllrb.com/docs/",
        "https://jekyllrb.com/docs/installation/",
        "https://jekyllrb.com/docs/usage/",
        "https://jekyllrb.com/docs/configuration/",
        "https://jekyllrb.com/docs/liquid/",
    ],
    "Vercel (nextjs.org)": [
        "https://nextjs.org/",
        "https://nextjs.org/docs",
        "https://nextjs.org/learn",
        "https://nextjs.org/showcase",
        "https://nextjs.org/blog",
        "https://nextjs.org/team",
    ],
}

FMT = "%{size_download}|%{time_total}|%{time_connect}|%{time_appconnect}"


def measure(urls, rounds=3):
    """返回 (总字节, 纯传输秒, 每次耗时列表, 首次appconnect)"""
    seq = urls * rounds
    cmd = [CURL, "-sS", "--max-time", "90", "--noproxy", "*"]
    for u in seq:
        cmd += ["-o", "NUL", u]
    cmd += ["-w", FMT + "\n"]
    proc = subprocess.run(cmd, capture_output=True, text=True, errors="replace")
    lines = [l for l in proc.stdout.splitlines() if l.count("|") == 3]
    total_bytes = 0
    total_time = 0.0
    times = []
    first_app = 0.0
    for i, line in enumerate(lines):
        parts = line.split("|")
        try:
            b = float(parts[0]); t = float(parts[1]); app = float(parts[3])
        except ValueError:
            continue
        total_bytes += b
        total_time += t
        times.append(t)
        if i == 0:
            first_app = app
    return total_bytes, total_time, times, first_app, len(lines)


print(f"{'目标':<28}{'请求数':>6}{'总字节':>11}{'总耗时':>9}{'纯传输':>9}{'吞吐':>12}{'抖动(σ)':>10}")
print("-" * 86)

for label, urls in TARGETS.items():
    b, t, times, app, n = measure(urls, rounds=3)
    xfer = max(t - app, 0.001)
    kbps = b / 1024 / xfer
    sd = statistics.pstdev(times) if len(times) > 1 else 0
    print(f"{label:<28}{n:>6}{b/1024:>10.0f}K{t:>8.2f}s{xfer:>8.2f}s{kbps:>10.0f}KB/s{sd:>9.2f}s")

print()
print("说明：吞吐 = 总字节 ÷ (总耗时 − 首次TLS握手)；抖动 = 单次耗时标准差。")
print("      同一连接复用，避免小文件被握手耗时主导。")
