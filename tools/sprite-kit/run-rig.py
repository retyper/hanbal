# -*- coding: utf-8 -*-
"""창병(spear) 달리기 안내 인형 + 장면 (11-25 · A1 카드 · 새 칸은 덧띠 spear-x.png 로).
pose-rig.py 를 고치지 않고 불러다 쓴다. 병사 띠 칸은 본 띠(public/realm/anim-px/spear.png · 칸 438x128 · 서기 0~3) 그대로.
  py -3 -X utf8 -I tools/sprite-kit/run-rig.py run a <나갈.png>   달리기 앞 네 칸(2x2): 땅 닿음 · 딛고 모음 · 뜸(뒷발 차고 앞무릎 듦) · 뜸(두 발 모임)
장면 = 1920x1280 자홍 · 왼쪽 줄 384 = [본 띠 서기 / 본 띠 걷기 한 칸] 2배 · 오른쪽 2x2 인형 칸(768x640) · 곁파일 .roots.json.  병사 키 126 · 인형 키 137 → 0.92 배로 줄여 같은 키."""
import importlib.util, json, sys
import numpy as np
from PIL import Image, ImageDraw

ROOT = 'D:/flutter/arrow_game_one/'
spec = importlib.util.spec_from_file_location('pr', ROOT + 'tools/sprite-kit/pose-rig.py')
pr = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pr)
CWD, CH_, LW, W_, H_ = 768, 640, 384, 1920, 1280
RX, GY = 300, 585

# 달리기: 몸 앞 숙임 · 두 손 창을 앞으로 낮게(pole2) · 발은 손·발 자리(게임 화소 · 뿌리 원점 · 앞 +x · 위 +y)
RUN = {
    1: dict(pelvis=(8, -2), near_foot=(26, 0), far_foot=(-30, 12, -25)),                 # 가까운 발이 앞에 닿음 · 먼 발 뒤로 차올림
    2: dict(pelvis=(6, -7), near_foot=(4, 0), far_foot=(12, 24, 10)),                    # 딛고 모음(몸이 가장 낮음) · 먼 무릎이 올라옴
    3: dict(pelvis=(8, 14), near_foot=(-30, 24, -25), far_foot=(30, 28, 10)),             # 뜸: 가까운 발이 뒤로 차고 먼 발은 앞으로 뻗음
    4: dict(pelvis=(8, 18), near_foot=(-12, 36, -10), far_foot=(24, 20, 5)),             # 뜸: 두 발이 몸 아래로 모임
}


def cell(n):
    pr.big_canvas()
    pr.PROP['kind'] = 'pole2'
    p = RUN[n]
    ps = pr._ik(p['pelvis'], (4, 56), (32, 66), bend=20, lean=3, near_foot=p['near_foot'], far_foot=p['far_foot'])
    im = pr.figure(None, True, ps)                     # 960x832 (게임 화소 4배)
    k = 0.5 * 126 / 137                                # 게임 화소 2배 · 병사 키에 맞춤
    im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    o = Image.new('RGB', (CWD, CH_), (255, 0, 255))
    # 인형의 뿌리(칸 x=92*4 · 발바닥 줄 y=200*4)를 칸 안 RX, GY 에
    o.paste(im, (RX - round(92 * 4 * k), GY - round(200 * 4 * k)))
    return o


def ref(i):
    im = Image.open(ROOT + 'public/realm/anim-px/spear.png').convert('RGBA').crop((i * 438, 0, (i + 1) * 438, 128))
    im = im.crop(im.getchannel('A').getbbox())
    k = min(2.0, (LW - 12) / im.width)
    return im.resize((round(im.width * k), round(im.height * k)), Image.NEAREST)


def scene(group, out):
    o = Image.new('RGB', (W_, H_), (255, 0, 255))
    for j, i in enumerate((0, 5)):
        r = ref(i)
        o.paste(r, ((LW - r.width) // 2, j * CH_ + CH_ - 40 - r.height), r)
    rec = []
    for k, n in enumerate((1, 2, 3, 4)):
        x0, y0 = LW + (k % 2) * CWD, (k // 2) * CH_
        o.paste(cell(n), (x0, y0))
        rec.append(dict(x=x0, y=y0, w=CWD, h=CH_, root=x0 + RX, ground=y0 + GY))
    json.dump(dict(kind='run4', cells=rec), open(out.replace('.png', '.roots.json'), 'w'))
    o.save(out)
    print(out, o.size)


if __name__ == '__main__' and sys.argv[1] == 'run':
    scene(sys.argv[2], sys.argv[3])
