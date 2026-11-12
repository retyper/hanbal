# -*- coding: utf-8 -*-
"""hand-patch.py — 손가락만 고친다 (11-12 소서노 · 11-13 형: 한라 종 쥔 손 맨 위 검지 · 웅녀 · 독무덤)
통째로 다시 굽지 않는다: 손 둘레만 잘라(키워서) 제미나이에 「그 손가락만 고쳐」 편집 → 받은 그림을 원래 크기로 줄여 손 둘레만 부드럽게 덮는다.
  crop  <그림> x0 y0 x1 y1 <out.png>                     잘라 3배로 키운다 (제미나이가 손을 크게 보게)
  paste <그림> <고친.png> x0 y0 x1 y1 <out.jpg> [가장자리=0.14]  고친 것을 원래 칸 크기로 줄여, 가장자리를 칸 폭의 14% 로 흐리게 섞어 덮는다
  view  <그림> <고친그림> x0 y0 x1 y1 <out.png>           고치기 전·후 손을 나란히 (검수 · 손가락 세기)
옛 그림은 assets_src/realm/retired/hand-patch/ 에 남긴다 (메모리 keep-retired-art)."""
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

cmd = sys.argv[1]
if cmd == 'crop':
    src, x0, y0, x1, y1, out = sys.argv[2], *map(int, sys.argv[3:7]), sys.argv[7]
    im = Image.open(src).convert('RGB').crop((x0, y0, x1, y1))
    im.resize((im.width * 3, im.height * 3), Image.LANCZOS).save(out)
    print(out, im.size, '→ x3')
elif cmd == 'paste':
    src, fixed, x0, y0, x1, y1, out = sys.argv[2], sys.argv[3], *map(int, sys.argv[4:8]), sys.argv[8]
    fe = float(sys.argv[9]) if len(sys.argv) > 9 else 0.14
    base = Image.open(src).convert('RGB')
    keep = 'assets_src/realm/retired/hand-patch/'
    os.makedirs(keep, exist_ok=True)
    bk = keep + os.path.basename(src)
    if not os.path.exists(bk):
        base.save(bk, quality=95)
    w, h = x1 - x0, y1 - y0
    patch = Image.open(fixed).convert('RGB').resize((w, h), Image.LANCZOS)
    m = np.zeros((h, w), np.float32)
    e = max(2, int(min(w, h) * fe))
    m[e:h - e, e:w - e] = 1
    mask = Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(e / 2))
    base.paste(patch, (x0, y0), mask)
    base.save(out, quality=92)
    print(out, '덮음', (x0, y0, x1, y1), '가장자리', e)
elif cmd == 'view':
    a, b = Image.open(sys.argv[2]).convert('RGB'), Image.open(sys.argv[3]).convert('RGB')
    x0, y0, x1, y1 = map(int, sys.argv[4:8])
    ca, cb = a.crop((x0, y0, x1, y1)), b.crop((x0, y0, x1, y1))
    k = 360 / max(ca.size)
    ca, cb = ca.resize((round(ca.width * k), round(ca.height * k))), cb.resize((round(cb.width * k), round(cb.height * k)))
    s = Image.new('RGB', (ca.width * 2 + 10, ca.height), (20, 20, 20))
    s.paste(ca, (0, 0)); s.paste(cb, (ca.width + 10, 0)); s.save(sys.argv[8])
    print(sys.argv[8])
