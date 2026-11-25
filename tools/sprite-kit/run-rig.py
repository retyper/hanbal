# -*- coding: utf-8 -*-
"""창병(spear) 달리기 안내 인형 + 장면 (11-25 · A1 카드 · 새 칸은 덧띠 spear-x.png 로).
pose-rig.py 를 고치지 않고 불러다 쓴다. 병사 띠 칸은 본 띠(public/realm/anim-px/spear.png · 칸 438x128 · 서기 0~3) 그대로.
  py -3 -X utf8 -I tools/sprite-kit/run-rig.py run a|b|hold <나갈.png>   달리기 앞 네 칸(a) · 뒤 네 칸(b = 다리 맞바꿈)(2x2): 땅 닿음 · 딛고 모음 · 뜸(뒷발 차고 앞무릎 듦) · 뜸(두 발 모임)
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

# 방진 버팀(RB1): 무릎을 낮추고 두 발을 벌려 땅에 박은 채 창끝을 앞 위로 세워 받침 (두 칸: 받침 · 더 낮춰 버팀)
BRACE = {
    11: dict(pelvis=(2, -16), near_foot=(-14, 0), far_foot=(18, 0), hands=((-4, 34), (32, 58)), bend=24),
    12: dict(pelvis=(0, -20), near_foot=(-16, 0), far_foot=(20, 0), hands=((-6, 32), (34, 60)), bend=30),
}

# 병종별 덧: shield(방패 몸 앞) · pike(긴 창 앞 아래로 박음) — 같은 인형에 손 자리와 쥔 물건만 다르다 (11-25 밤 · 형 「창병만 보임」)
KIND = dict(
    spear=dict(strip='spear', cw=438, prop='pole2'),
    shield=dict(strip='shield', cw=254, prop='none', run_hands=((18, 50), (30, 56)), run_bend=24),
    pike=dict(strip='pike', cw=380, prop='pole2'),
)
BRACE.update({
    21: dict(pelvis=(2, -17), near_foot=(-12, 0), far_foot=(18, 0), hands=((14, 40), (26, 46)), bend=26),   # 방패 벽: 무릎 낮춤 · 두 팔을 앞 아래로(방패를 땅에 붙여 세움)
    22: dict(pelvis=(0, -23), near_foot=(-14, 0), far_foot=(20, 0), hands=((14, 34), (26, 40)), bend=34),   # 부딪힘을 받는 순간 더 낮춤
    31: dict(pelvis=(2, -16), near_foot=(-14, 0), far_foot=(20, 0), hands=((6, 56), (36, 34)), bend=24),    # 긴 창을 앞 아래로 비스듬히 박아 받침(창끝이 땅쪽)
    32: dict(pelvis=(0, -20), near_foot=(-16, 0), far_foot=(22, 0), hands=((6, 52), (38, 28)), bend=30),
})
CUR = dict(KIND['spear'])


def cell(n, swap=False):
    pr.big_canvas()
    pr.PROP['kind'] = None if CUR['prop'] == 'none' else CUR['prop']
    p = dict(RUN.get(n) or BRACE[n])
    if swap:   # 뒤 반 주기: 가까운 발과 먼 발의 자리를 맞바꾼다 (다리 교대)
        p['near_foot'], p['far_foot'] = p['far_foot'], p['near_foot']
    hands, bend = p.get('hands', CUR.get('run_hands', ((4, 56), (32, 66)))), p.get('bend', CUR.get('run_bend', 20))
    ps = pr._ik(p['pelvis'], hands[0], hands[1], bend=bend, lean=3, near_foot=p['near_foot'], far_foot=p['far_foot'])
    im = pr.figure(None, True, ps)                     # 960x832 (게임 화소 4배)
    k = 0.5 * 126 / 137                                # 게임 화소 2배 · 병사 키에 맞춤
    im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    o = Image.new('RGB', (CWD, CH_), (255, 0, 255))
    # 인형의 뿌리(칸 x=92*4 · 발바닥 줄 y=200*4)를 칸 안 RX, GY 에
    o.paste(im, (RX - round(92 * 4 * k), GY - round(200 * 4 * k)))
    return o


def ref(i):
    im = Image.open(ROOT + 'public/realm/anim-px/' + CUR['strip'] + '.png').convert('RGBA').crop((i * CUR['cw'], 0, (i + 1) * CUR['cw'], 128))
    im = im.crop(im.getchannel('A').getbbox())
    k = min(2.0, (LW - 12) / im.width)
    return im.resize((round(im.width * k), round(im.height * k)), Image.NEAREST)


def scene(group, out):
    o = Image.new('RGB', (W_, H_), (255, 0, 255))
    for j, i in enumerate((0, 5)):
        r = ref(i)
        o.paste(r, ((LW - r.width) // 2, j * CH_ + CH_ - 40 - r.height), r)
    rec = []
    cells = {'hold': (11, 12), 'shold': (21, 22), 'phold': (31, 32)}.get(group, (1, 2, 3, 4))
    for k, n in enumerate(cells):
        x0, y0 = LW + (k % 2) * CWD, (k // 2) * CH_
        o.paste(cell(n, group == 'b'), (x0, y0))
        rec.append(dict(x=x0, y=y0, w=CWD, h=CH_, root=x0 + RX, ground=y0 + GY))
    json.dump(dict(kind='run4', cells=rec), open(out.replace('.png', '.roots.json'), 'w'))
    o.save(out)
    print(out, o.size)


if __name__ == '__main__' and sys.argv[1] == 'run':
    if len(sys.argv) > 4:
        CUR.update(KIND[sys.argv[4]])   # run a|b|shold|phold <나갈.png> [spear|shield|pike]
    scene(sys.argv[2], sys.argv[3])
