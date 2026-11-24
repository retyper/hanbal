# -*- coding: utf-8 -*-
"""게임 띠의 화소 몇 개를 고쳐 놓는다 — 다시 굽거나 strip install 한 뒤 다시 돌릴 수 있게 목록으로 둔다 (11-25).
  py -3 -X utf8 tools/sprite-kit/pixel-fix.py <띠 열쇠 …>   예: base-w-14-feast-spy
pixel-fix.json: {열쇠: {"color":[r,g,b] 또는 null(투명), "pixels":[[칸, x, y], …]}}  (x · y 는 그 칸 안 좌표)
public/realm/anim-px/gen-<열쇠>.png 에 적용하고, -x.png 는 같은 자리에 살색 화소가 있을 때만 같은 색으로 칠한다.
이미 칠해진 화소는 건드리지 않는다(여러 번 돌려도 같다).
"""
import io, json, os, sys
from PIL import Image
R = 'D:/flutter/arrow_game_one/'
cfg = json.load(io.open(R + 'tools/sprite-kit/pixel-fix.json', encoding='utf-8'))
for key in sys.argv[1:]:
    c = cfg[key]; col = c['color']; cw = None
    for suf, only_skin in (('', False), ('-x', True)):
        p = f'{R}public/realm/anim-px/gen-{key}{suf}.png'
        im = Image.open(p).convert('RGBA'); px = im.load()
        cw = cw or im.width // 20
        n = 0
        for cell, x, y in c['pixels']:
            X = cell * cw + x
            r, g, b, a = px[X, y]
            skin = a > 128 and r > 170 and g > 120 and b > 90 and r > b + 25
            if only_skin and not skin: continue
            if not only_skin and not skin: continue
            px[X, y] = (col[0], col[1], col[2], 255) if col else (0, 0, 0, 0)
            n += 1
        im.save(p)
        print(f'{key}{suf}: {n}/{len(c["pixels"])} 화소')
