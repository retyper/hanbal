# -*- coding: utf-8 -*-
"""말 탄 병사(horse) 질주 안내 인형 + 장면 (11-25 · A1 카드 · 새 칸은 덧띠 horse-x.png 로).
기존 pose-rig.py 에는 말 인형이 없어 따로 둔다(다른 일꾼이 pose-rig 를 고치는 중 · 충돌 방지).
  py -3 -X utf8 -I tools/sprite-kit/horse-rig.py gallop a  <나갈 scene.png>   질주 네 칸(2x2 · 윗줄 = 1·2 · 아랫줄 = 3·4)
  py -3 -X utf8 -I tools/sprite-kit/horse-rig.py gallop b  <나갈 scene.png>   질주 뒤 네 칸(5~8)
장면 = 1920x1280 자홍 · 왼쪽 줄 384 = [본 띠 서기 칸 / 본 띠 창 겨눈 칸] · 오른쪽 2x2 = 인형 칸(768x640) · 칸마다 뿌리·바닥은 곁파일(.roots.json).
말은 오른쪽을 본다. 가까운 다리 = 잿빛 · 먼 다리 = 파랑. 각도 0 = 아래로 곧게 · 양수 = 앞(오른쪽)."""
import json, math, sys
from PIL import Image, ImageDraw

ROOT = 'D:/flutter/arrow_game_one/'
Z = 2                     # 게임 화소 1 = 그림 2 (왼쪽 본 띠 칸과 같은 배율)
CWD, CH_, LW, W_, H_ = 768, 640, 384, 1920, 1280
RX, GY = 300, 560         # 칸 안 뿌리 x · 바닥 y (그림 화소)
LINE = (40, 40, 40)
NEAR, FAR, BODY, ROD, SPEAR = (200, 200, 200), (70, 120, 235), (165, 165, 165), (130, 95, 50), (120, 80, 40)


def pt(x, y, ang, ln):
    r = math.radians(ang)
    return x + math.sin(r) * ln, y + math.cos(r) * ln


def limb(d, a, b, w, fill):
    for col, ww in ((LINE, w * Z + 6), (fill, w * Z)):
        d.line([a, b], fill=col, width=int(ww))
        for p in (a, b):
            d.ellipse([p[0] - ww / 2, p[1] - ww / 2, p[0] + ww / 2, p[1] + ww / 2], fill=col)


def leg(d, hip, a1, a2, a3, fore, fill):
    """말 다리: 윗다리 · 아랫다리(무릎·뒷무릎) · 발굽. 길이는 게임 화소 × Z"""
    l1, l2, l3 = (20, 22, 7) if fore else (24, 24, 7)
    k = pt(hip[0], hip[1], a1, l1 * Z)
    h = pt(k[0], k[1], a2, l2 * Z)
    f = pt(h[0], h[1], a3, l3 * Z)
    limb(d, hip, k, 7, fill)
    limb(d, k, h, 5, fill)
    limb(d, h, f, 7, fill)


# 한 칸 = (몸 들림, 몸 기울기, 가까운 앞다리, 먼 앞다리, 가까운 뒷다리, 먼 뒷다리, 기수 숙임, 창 기울기)
# 다리 = (윗다리 각, 아랫다리 각, 발굽 각) · 각 0 = 아래 · +앞
GALLOP = {
    # 한 박: 뒷다리 앞으로 내딛어 땅 · 앞다리 접어 듦
    1: (0, -2, (40, -20, -45), (28, -35, -60), (28, 5, 10), (14, -10, 0), 28, -2),
    2: (2, -4, (60, 30, 15), (50, 20, 10), (-5, -10, -5), (-20, -35, -20), 32, -2),
    # 뻗음(공중): 앞다리 앞으로 · 뒷다리 뒤로 쭉 — 몸이 길게 낮게 뻗음
    3: (16, -8, (82, 78, 70), (74, 70, 62), (-80, -84, -75), (-72, -78, -70), 38, -3),
    # 모임(공중): 네 발이 배 아래로 모임 · 등이 굽음
    4: (14, 6, (20, -50, -75), (12, -55, -80), (10, -55, -80), (2, -60, -85), 30, -2),
    # 두 박: 앞다리 먼저 땅 · 뒷다리 밀어냄
    5: (0, 2, (35, 15, 5), (22, 0, -5), (-30, -55, -40), (-15, -45, -30), 30, -2),
    6: (4, -3, (55, 35, 20), (42, 28, 15), (-50, -70, -50), (-35, -60, -45), 34, -2),
    7: (14, -7, (80, 76, 68), (72, 68, 60), (-78, -82, -72), (-70, -76, -68), 38, -3),
    8: (12, 5, (24, -45, -70), (14, -52, -76), (14, -50, -76), (4, -58, -82), 30, -2),
}


def cell(n):
    lift, tilt, nf, ff, nh, fh, lean, spear_a = GALLOP[n]
    im = Image.new('RGB', (CWD, CH_), (255, 0, 255))
    d = ImageDraw.Draw(im)
    gy = GY - lift * Z
    cx, cy = RX, gy - 62 * Z                         # 몸 가운데
    hipx, hipy = pt(cx, cy, 90 - tilt, -26 * Z)      # 엉덩이
    shx, shy = pt(cx, cy, 90 - tilt, 26 * Z)         # 어깨
    # 가까운 쪽이 위로 오게: 먼 다리 → 몸 → 가까운 다리
    leg(d, (hipx, hipy), *fh, False, FAR)
    leg(d, (shx, shy), *ff, True, FAR)
    d.ellipse([cx - 40 * Z, cy - 15 * Z, cx + 40 * Z, cy + 15 * Z], fill=BODY, outline=LINE, width=6)
    # 목 · 머리 · 꼬리
    nk = pt(shx, shy, 60, -4 * Z)
    nk = (shx + 8 * Z, shy - 14 * Z)
    hd = (nk[0] + 18 * Z, nk[1] - 6 * Z + (lean - 30) * 0.2 * Z)
    limb(d, (shx, shy - 6 * Z), nk, 13, BODY)
    limb(d, nk, hd, 11, BODY)
    d.ellipse([hd[0] + 4 * Z, hd[1] - 5 * Z, hd[0] + 18 * Z, hd[1] + 5 * Z], fill=BODY, outline=LINE, width=5)
    tl = (hipx - 18 * Z, hipy + (6 if lift > 8 else 14) * Z)
    limb(d, (hipx - 4 * Z, hipy - 6 * Z), tl, 6, ROD)
    leg(d, (hipx, hipy), *nh, False, NEAR)
    leg(d, (shx, shy), *nf, True, NEAR)
    # 기수 (몸통 · 머리 · 팔 · 창) — 앉은 자리 = 몸 가운데 위
    seat = (cx - 2 * Z, cy - 14 * Z)
    top = pt(seat[0], seat[1], 180 + lean, 28 * Z)     # 앞으로 숙인 몸통 (각 180 = 위)
    top = (seat[0] + math.sin(math.radians(lean)) * 28 * Z, seat[1] - math.cos(math.radians(lean)) * 28 * Z)
    limb(d, seat, top, 12, BODY)
    d.ellipse([top[0] - 7 * Z + 3 * Z, top[1] - 12 * Z, top[0] + 7 * Z + 3 * Z, top[1] + 2 * Z], fill=NEAR, outline=LINE, width=5)
    grip = (top[0] + 14 * Z, top[1] + 8 * Z)           # 창을 낮게 겨눈 손
    limb(d, (top[0], top[1] + 4 * Z), grip, 5, FAR)
    limb(d, (top[0], top[1] + 4 * Z), (grip[0] - 2 * Z, grip[1] + 2 * Z), 5, NEAR)
    tail = (grip[0] - 38 * Z, grip[1] - math.tan(math.radians(spear_a)) * -38 * Z)
    tip = (grip[0] + 70 * Z, grip[1] + math.tan(math.radians(spear_a)) * 70 * Z)
    d.line([tail, tip], fill=LINE, width=int(3.4 * Z) + 4)
    d.line([tail, tip], fill=SPEAR, width=int(3.4 * Z))
    # 창 끝 (삼각)
    ux, uy = tip[0] - tail[0], tip[1] - tail[1]
    ln = math.hypot(ux, uy)
    ux, uy = ux / ln, uy / ln
    d.polygon([(tip[0], tip[1]), (tip[0] - ux * 14 * Z - uy * 4 * Z, tip[1] - uy * 14 * Z + ux * 4 * Z), (tip[0] - ux * 14 * Z + uy * 4 * Z, tip[1] - uy * 14 * Z - ux * 4 * Z)], fill=(210, 210, 215), outline=LINE)
    return im


def refcell(i):
    im = Image.open(ROOT + 'public/realm/anim-px/horse.png').convert('RGBA')
    c = im.crop((i * 186, 0, (i + 1) * 186, 128))
    return c.resize((186 * 2, 128 * 2), Image.NEAREST)


def scene(group, out):
    cells = {'a': (1, 2, 3, 4), 'b': (5, 6, 7, 8)}[group]
    o = Image.new('RGB', (W_, H_), (255, 0, 255))
    for j, i in enumerate((0, 16)):          # 서기 · 창 겨눈 칸 (본 띠)
        r = refcell(i)
        o.paste(r, ((LW - r.size[0]) // 2, j * CH_ + CH_ - 40 - r.size[1]), r)
    rec = []
    for k, n in enumerate(cells):
        x0, y0 = LW + (k % 2) * CWD, (k // 2) * CH_
        o.paste(cell(n), (x0, y0))
        rec.append(dict(x=x0, y=y0, w=CWD, h=CH_, root=x0 + RX, ground=y0 + GY))
    json.dump(dict(kind='gallop4', z=Z, cells=rec), open(out.replace('.png', '.roots.json'), 'w'))
    o.save(out)
    print(out, o.size)


if __name__ == '__main__' and sys.argv[1] == 'gallop':
    scene(sys.argv[2], sys.argv[3])
