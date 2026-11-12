# -*- coding: utf-8 -*-
"""idle-breath.py [gen-*.png …] — 장수 띠의 서 있기 4칸(0~3)을 숨쉬기로 (11-12 형: 「군사들은 idle 이 조금 있는데 장수들은 한 프레임밖에 없는지 얼어 있음」)
0번 칸(서기)을 바탕으로 · 발·다리는 그대로 두고 허리 위만 아래를 붙인 채 세로로 살짝 늘린다 → 상체가 1~2px 오르내린다.
  칸 0 = 그대로 · 1 = 들숨 반 · 2 = 들숨 끝 · 3 = 날숨 반  (battlefield.ts spidle 2.6s steps(4) 가 돈다)
형 11-09: 통째로 위아래 들썩이면 둥실 떠 보였다 → 발은 절대 안 움직인다.
없으면 public/realm/anim2/gen-*.png 전부 · 옛 띠는 assets_src/realm/retired/anim2-breath/ 에 처음 한 번만 남긴다.
  py -3 -X utf8 tools/sprite-kit/idle-breath.py [--dry] [파일…]"""
import glob
import os
import sys

import numpy as np
from PIL import Image

LIFT = [0.0, 0.010, 0.020, 0.010]  # 허리 위 높이에 곱하는 늘림 (160px 띠에서 상체 80px → 0.8·1.6px)
HIP = 0.52  # 잉크 키에서 위로부터 이만큼이 상체 (허리)
TOP = 2  # 머리 위 여유가 이보다 적으면 늘림을 줄인다
KEEP = 'assets_src/realm/retired/anim2-breath/'

dry = '--dry' in sys.argv
files = [a for a in sys.argv[1:] if not a.startswith('--')] or sorted(glob.glob('public/realm/anim2/gen-*.png'))
os.makedirs(KEEP, exist_ok=True)
done = 0
for f in files:
    f = f.replace('\\', '/')
    im = Image.open(f).convert('RGBA')
    cw = im.width // 20
    H = im.height
    base = im.crop((0, 0, cw, H))
    a = np.array(base)[..., 3] > 40
    ys = np.nonzero(a.any(axis=1))[0]
    if len(ys) == 0:
        print('빈 칸', f)
        continue
    top, bot = ys.min(), ys.max()
    hip = top + int((bot - top + 1) * HIP)
    upper = base.crop((0, 0, cw, hip))
    if not dry:
        bk = KEEP + os.path.basename(f)
        if not os.path.exists(bk):
            im.save(bk)
    out = im.copy()
    for k, lift in enumerate(LIFT):
        cell = base.copy()
        if lift > 0:
            rise = min(round((hip - top) * lift + 0.49), max(0, top - TOP))
            if rise > 0:
                tall = upper.resize((cw, hip - top + rise), Image.LANCZOS, box=(0, top, cw, hip))  # 머리~허리를 rise px 만큼 늘림
                cell = Image.new('RGBA', (cw, H), (0, 0, 0, 0))
                cell.alpha_composite(base.crop((0, hip, cw, H)), (0, hip))
                cell.alpha_composite(tall, (0, top - rise))
        out.paste(cell, (k * cw, 0))
    if not dry:
        out.save(f)
    done += 1
print('숨쉬기 넣음' if not dry else '(시험)', done, '장')
