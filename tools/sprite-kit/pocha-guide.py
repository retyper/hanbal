# -*- coding: utf-8 -*-
"""포차 부품 견본 장면 (11-23 형 「포차는 부품마다 에셋 만들어 입혀야」).
장수와 같은 길: 회색 도식(크기·자리·각도 = 뼈대) + 승인 띠(결)를 한 장면에 놓고 「도식을 옆 사람과 같은 도트 결의 나무·쇠·밧줄로 그려라」.
부품을 따로 받으면 코드가 조립한다 → 팔이 축에서 돌고 · 주머니가 매달려 흔들리고 · 바퀴가 구르고 · 무너질 때 부품이 흩어지고 · 다시 설 때 모인다.
칸 배치(1920×1280 · 칸 640 · 게임 화소의 4배):
  [소서노(결·크기)] [① 받침 틀]        [② 던지는 팔 + 줄 주머니]
  [다 맞춘 모습]     [③ 바퀴 + 균형추]  [④ 바위 + 부러진 널 둘]
  py -3 -I tools/sprite-kit/pocha-guide.py  → D:/에셋창고/STD/scene-pocha-parts.png
"""
from PIL import Image, ImageDraw, ImageFont

Z = 4; C = 640; G = (150, 150, 150); D = (95, 95, 95); L = (190, 190, 190)
# 게임 화소 치수 (키 137 장수 곁에 서는 포차 · 받침 폭 104 · 축 높이 66 · 팔 96)
BASE_W, BASE_H, AXLE_H, LEG = 104, 10, 66, 34
ARM, ARM_T, PIVOT = 96, 7, .30
WHEEL_R, WEIGHT, ROCK = 15, 24, 13


def z(v): return int(round(v * Z))


def frame(d, cx, by):
    d.rectangle([cx - z(BASE_W / 2), by - z(BASE_H), cx + z(BASE_W / 2), by], fill=G, outline=D, width=3)
    for s in (-1, 1): d.line([(cx + s * z(LEG), by - z(BASE_H)), (cx, by - z(AXLE_H))], fill=G, width=z(6))
    d.line([(cx - z(LEG * .55), by - z(AXLE_H * .45)), (cx + z(LEG * .55), by - z(AXLE_H * .45))], fill=D, width=z(4))   # 가로 버팀
    d.ellipse([cx - z(5), by - z(AXLE_H) - z(5), cx + z(5), by - z(AXLE_H) + z(5)], fill=D)                                # 축받이
    for s in (-1, 1): d.ellipse([cx + s * z(BASE_W * .34) - z(3), by - z(5) - z(3), cx + s * z(BASE_W * .34) + z(3), by - z(5) + z(3)], fill=D)   # 바퀴 축


def arm(d, x0, cy):
    x1 = x0 + z(ARM)
    d.polygon([(x0, cy - z(ARM_T * .75)), (x1, cy - z(ARM_T * .4)), (x1, cy + z(ARM_T * .4)), (x0, cy + z(ARM_T * .75))], fill=G, outline=D)
    px = x0 + z(ARM * PIVOT); d.ellipse([px - z(3), cy - z(3), px + z(3), cy + z(3)], fill=(30, 30, 30))   # 축 구멍
    d.rectangle([x1 - z(4), cy - z(5), x1, cy + z(5)], fill=D)                                              # 끝 쇠고리


def pouch(d, cx, top):
    d.line([(cx - z(7), top), (cx - z(9), top + z(22))], fill=D, width=3); d.line([(cx + z(7), top), (cx + z(9), top + z(22))], fill=D, width=3)
    d.chord([cx - z(11), top + z(12), cx + z(11), top + z(34)], 0, 180, fill=G, outline=D, width=3)


def wheel(d, cx, cy):
    r = z(WHEEL_R); d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=G, outline=D, width=4); d.ellipse([cx - r + z(4), cy - r + z(4), cx + r - z(4), cy + r - z(4)], fill=L, outline=D, width=2)
    for a in range(4):
        import math
        dx, dy = math.cos(a * math.pi / 4) * (r - z(3)), math.sin(a * math.pi / 4) * (r - z(3)); d.line([(cx - dx, cy - dy), (cx + dx, cy + dy)], fill=G, width=z(3))
    d.ellipse([cx - z(4), cy - z(4), cx + z(4), cy + z(4)], fill=D)


def weight(d, cx, top):
    d.ellipse([cx - z(4), top, cx + z(4), top + z(8)], outline=D, width=4)
    d.rectangle([cx - z(WEIGHT / 2), top + z(7), cx + z(WEIGHT / 2), top + z(7 + WEIGHT)], fill=G, outline=D, width=3)
    for i in range(3): d.ellipse([cx - z(9) + i * z(6), top + z(3), cx - z(1) + i * z(6), top + z(11)], fill=L, outline=D)   # 상자에 담긴 돌


def rock(d, cx, cy):
    r = z(ROCK); d.polygon([(cx - r, cy + r * .3), (cx - r * .7, cy - r * .7), (cx + r * .1, cy - r), (cx + r * .9, cy - r * .4), (cx + r, cy + r * .5), (cx + r * .2, cy + r), (cx - r * .6, cy + r * .9)], fill=G, outline=D)


def plank(d, x, y, w, ang):
    im = Image.new('RGBA', (z(w) + 20, z(8) + 20), (0, 0, 0, 0)); dd = ImageDraw.Draw(im)
    dd.polygon([(10, 10), (z(w) - 8, 10), (z(w) + 6, 10 + z(3)), (z(w) - 10, 10 + z(7)), (10, 10 + z(7))], fill=G, outline=D)
    return im.rotate(ang, expand=True, resample=Image.BICUBIC), (x, y)


def main():
    global Z
    o = Image.new('RGB', (C * 3, C * 2), (255, 0, 255)); d = ImageDraw.Draw(o)
    ref = Image.open('public/realm/anim-px/gen-soseono.png').convert('RGBA'); fw = ref.size[0] // 20; ref = ref.crop((0, 0, fw, ref.size[1])); ref = ref.crop(ref.getchannel('A').getbbox())
    ref = ref.resize((ref.size[0] * Z, ref.size[1] * Z), Image.NEAREST)
    if ref.size[0] > C - 20: ref = ref.crop(((ref.size[0] - C + 20) // 2, 0, (ref.size[0] + C - 20) // 2, ref.size[1]))
    o.paste(ref, ((C - ref.size[0]) // 2, C - 40 - ref.size[1]), ref)
    # 다 맞춘 모습 (왼쪽 아래) — 조금 작게(3배)
    Z0 = Z; Z = 3; cx, by = C // 2, C + C - 60
    frame(d, cx, by - z(WHEEL_R * .6));
    for s in (-1, 1): wheel(d, cx + s * z(BASE_W * .34), by - z(WHEEL_R))
    import math
    ang = -2.3; px, py = cx, by - z(WHEEL_R * .6) - z(AXLE_H); L1, L2 = z(ARM * (1 - PIVOT)), z(ARM * PIVOT)
    ex, ey = px + math.cos(ang) * L1, py + math.sin(ang) * L1; sx, sy = px - math.cos(ang) * L2, py - math.sin(ang) * L2
    d.line([(sx, sy), (ex, ey)], fill=G, width=z(6)); d.ellipse([px - z(3), py - z(3), px + z(3), py + z(3)], fill=(30, 30, 30))
    pouch(d, int(ex), int(ey)); weight(d, int(sx), int(sy)); Z = Z0
    # ① 받침 틀
    frame(d, C + C // 2, C - 150)
    # ② 팔(가로) + 줄 주머니
    arm(d, C * 2 + (C - z(ARM)) // 2, 210); pouch(d, C * 2 + C // 2, 330)
    # ③ 바퀴 + 균형추
    wheel(d, C + 200, C + 330); weight(d, C + 450, C + 240)
    # ④ 바위 + 부러진 널 둘
    rock(d, C * 2 + 180, C + 300)
    for (w, a, x, y) in ((34, 12, C * 2 + 330, C + 200), (26, -20, C * 2 + 360, C + 380)):
        im, pos = plank(d, x, y, w, a); o.paste(im, pos, im)
    o.save('D:/에셋창고/STD/scene-pocha-parts.png'); print(o.size)


if __name__ == '__main__':
    main()
