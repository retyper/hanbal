# -*- coding: utf-8 -*-
"""영상 → 낱칸 판 (검수용) — 고르게 N 장을 뽑아 한 장에 늘어놓는다. 칸마다 초를 적는다.
  py -3 -X utf8 tools/veo/frame-sheet.py <영상.mp4 …> [n=12] [out=tools/out/review/frames]   (imageio-ffmpeg 가 사용자 site-packages 에 있어 -I 없이)
"""
import os
import subprocess
import sys
import tempfile
import imageio_ffmpeg
from PIL import Image, ImageDraw

FF = imageio_ffmpeg.get_ffmpeg_exe()


def length(path):
    r = subprocess.run([FF, '-i', path], capture_output=True, text=True, encoding='utf-8', errors='ignore')
    for line in r.stderr.splitlines():
        if 'Duration:' in line:
            h, m, s = line.split('Duration:')[1].split(',')[0].strip().split(':')
            return int(h) * 3600 + int(m) * 60 + float(s)
    return 0.0


def sheet(path, n, out):
    d = length(path)
    tmp = tempfile.mkdtemp()
    ims = []
    for k in range(n):
        t = d * (k + .5) / n
        f = os.path.join(tmp, f'{k}.png')
        subprocess.run([FF, '-y', '-loglevel', 'error', '-ss', f'{t:.2f}', '-i', path, '-frames:v', '1', '-vf', 'scale=-2:360', f], check=True)
        ims.append((t, Image.open(f).convert('RGB')))
    w, h = ims[0][1].size
    cols = 6
    rows = (n + cols - 1) // cols
    o = Image.new('RGB', (cols * w, rows * h), (30, 30, 30))
    dr = ImageDraw.Draw(o)
    for k, (t, im) in enumerate(ims):
        x, y = (k % cols) * w, (k // cols) * h
        o.paste(im, (x, y))
        dr.rectangle([x, y, x + 46, y + 14], fill=(0, 0, 0))
        dr.text((x + 3, y + 2), f'{t:.1f}s', fill=(255, 255, 0))
    os.makedirs(out, exist_ok=True)
    p = os.path.join(out, os.path.splitext(os.path.basename(path))[0] + '.png')
    o.save(p)
    return p


if __name__ == '__main__':
    n = next((int(a[2:]) for a in sys.argv[1:] if a.startswith('n=')), 12)
    out = next((a[4:] for a in sys.argv[1:] if a.startswith('out=')), 'tools/out/review/frames')
    for v in [a for a in sys.argv[1:] if '=' not in a]:
        print(sheet(v, n, out))
