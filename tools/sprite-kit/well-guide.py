# -*- coding: utf-8 -*-
"""우물 부품 견본 장면 (11-25 형 「우물은 왜 에셋 안 만들고 있지」). 포차(pocha-guide.py)와 같은 길:
회색 도식(크기·자리 = 뼈대) + 승인 띠(결)를 한 장면에 놓고 「도식을 옆 사람과 같은 도트 결의 돌·나무·짚으로 그려라」.
부품을 따로 받으면 코드가 조립한다 (물이 쿨타임만큼 차오르고 · 두레박이 오르내리고 · 줄이 출렁인다).
칸 배치(1920×1280 · 칸 640 · 게임 화소의 4배):
  [소서노(결·크기)]      [① 돌 둘레 뒤 반쪽 + 앞 반쪽]   [② 물 가득 + 빈 바닥]
  [다 맞춘 모습 도식]    [③ 나무 기둥 + 짚 지붕 + 도르래 들보]  [④ 도르래 바퀴 + 두레박]
  py -3 -I tools/sprite-kit/well-guide.py  → D:/에셋창고/STD/scene-well-parts.png
"""
import math
from PIL import Image, ImageDraw

Z = 4; C = 640; G = (150, 150, 150); D = (95, 95, 95); L = (190, 190, 190); BG = (255, 0, 255)
# 게임 화소 치수 (키 137 장수 곁에 서는 우물: 둘레 바깥 반지름 32 · 입구 25 · 벽 높이 18)
RX, RY, IRX, IRY, WALL = 32, 16, 25, 12.5, 18
POST_W, POST_H, ROOF_W, ROOF_H, BEAM_W, BEAM_H = 8, 50, 104, 26, 72, 8
PUL_R, BUCKET_W, BUCKET_H = 11, 18, 20


def z(v): return int(round(v * Z))


def arc_pts(cx, cy, rx, ry, a0, a1, n=48):
    return [(cx + math.cos(math.radians(a0 + (a1 - a0) * i / n)) * rx, cy + math.sin(math.radians(a0 + (a1 - a0) * i / n)) * ry) for i in range(n + 1)]


def rim_back(d, cx, cy):
    """cx, cy = 둘레 위 타원의 가운데. 뒤 반쪽 = 바깥 윗반 호와 입구 윗반 호 사이의 돌 띠"""
    pts = [(x * Z + cx, y * Z + cy) for x, y in arc_pts(0, 0, RX, RY, 180, 360)] + [(x * Z + cx, y * Z + cy) for x, y in arc_pts(0, 0, IRX, IRY, 360, 180)]
    d.polygon(pts, fill=G, outline=D)


def rim_front(d, cx, cy):
    """앞 반쪽 = 입구 아랫반 호 위쪽 돌 띠 + 그 아래 벽 (바닥 호까지). 입구 안쪽(가운데)은 비어 있다"""
    top = [(x * Z + cx, y * Z + cy) for x, y in arc_pts(0, 0, IRX, IRY, 180, 0)]       # 입구 아랫반 (왼 → 오)
    pts = [(cx - z(RX), cy), (cx - z(IRX), cy)] + top + [(cx + z(IRX), cy), (cx + z(RX), cy)] + \
          [(x * Z + cx, y * Z + cy) for x, y in arc_pts(0, WALL, RX, RY, 0, 180)]
    d.polygon(pts, fill=G, outline=D)
    d.line([(x * Z + cx, y * Z + cy) for x, y in arc_pts(0, 0, RX, RY, 0, 180)], fill=D, width=3)    # 둘레 윗면과 벽 사이 줄


def water(d, cx, cy, fill):
    d.ellipse([cx - z(IRX), cy - z(IRY), cx + z(IRX), cy + z(IRY)], fill=fill, outline=D, width=3)


def post(d, cx, by):
    d.rectangle([cx - z(POST_W / 2), by - z(POST_H), cx + z(POST_W / 2), by], fill=G, outline=D, width=3)


def roof(d, cx, by):
    d.polygon([(cx - z(ROOF_W / 2), by), (cx - z(ROOF_W * .3), by - z(ROOF_H)), (cx + z(ROOF_W * .3), by - z(ROOF_H)), (cx + z(ROOF_W / 2), by)], fill=G, outline=D)
    d.line([(cx - z(ROOF_W * .3), by - z(ROOF_H)), (cx + z(ROOF_W * .3), by - z(ROOF_H))], fill=D, width=4)


def beam(d, cx, cy):
    d.rectangle([cx - z(BEAM_W / 2), cy - z(BEAM_H / 2), cx + z(BEAM_W / 2), cy + z(BEAM_H / 2)], fill=G, outline=D, width=3)
    for s in (-1, 1): d.rectangle([cx + s * z(BEAM_W / 2) - z(2), cy - z(BEAM_H / 2) - 4, cx + s * z(BEAM_W / 2) + z(2), cy + z(BEAM_H / 2) + 4], fill=D)   # 끝 쇠 테


def pulley(d, cx, cy):
    r = z(PUL_R); d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=G, outline=D, width=4); d.ellipse([cx - r + z(3), cy - r + z(3), cx + r - z(3), cy + r - z(3)], outline=D, width=3)
    for a in range(3):
        dx, dy = math.cos(a * math.pi / 3) * (r - z(2)), math.sin(a * math.pi / 3) * (r - z(2)); d.line([(cx - dx, cy - dy), (cx + dx, cy + dy)], fill=D, width=z(1.6))
    d.ellipse([cx - z(2.5), cy - z(2.5), cx + z(2.5), cy + z(2.5)], fill=(30, 30, 30))


def bucket(d, cx, top):
    d.ellipse([cx - z(3), top, cx + z(3), top + z(5)], outline=D, width=4)                                        # 줄 고리
    d.polygon([(cx - z(BUCKET_W / 2), top + z(5)), (cx + z(BUCKET_W / 2), top + z(5)), (cx + z(BUCKET_W / 2 - 1.5), top + z(5 + BUCKET_H)), (cx - z(BUCKET_W / 2 - 1.5), top + z(5 + BUCKET_H))], fill=G, outline=D)
    for k in (.35, .7): d.line([(cx - z(BUCKET_W / 2 - k), top + z(5 + BUCKET_H * k)), (cx + z(BUCKET_W / 2 - k), top + z(5 + BUCKET_H * k))], fill=D, width=4)   # 쇠 테


def main():
    global Z
    o = Image.new('RGB', (C * 3, C * 2), BG); d = ImageDraw.Draw(o)
    ref = Image.open('public/realm/anim-px/gen-soseono.png').convert('RGBA'); fw = ref.size[0] // 20; ref = ref.crop((0, 0, fw, ref.size[1])); ref = ref.crop(ref.getchannel('A').getbbox())
    ref = ref.resize((ref.size[0] * Z, ref.size[1] * Z), Image.NEAREST)
    if ref.size[0] > C - 20: ref = ref.crop(((ref.size[0] - C + 20) // 2, 0, (ref.size[0] + C - 20) // 2, ref.size[1]))
    o.paste(ref, ((C - ref.size[0]) // 2, C - 40 - ref.size[1]), ref)
    # 다 맞춘 모습 (왼쪽 아래) — 3배
    Z0 = Z; Z = 3; cx, cy = C // 2, C + C - 120
    post(d, cx - z(RX), cy - z(2)); post(d, cx + z(RX), cy - z(2))
    rim_back(d, cx, cy - z(WALL)); water(d, cx, cy - z(WALL), (120, 120, 120)); rim_front(d, cx, cy - z(WALL))
    beam(d, cx, cy - z(WALL + 44)); pulley(d, cx, cy - z(WALL + 36)); roof(d, cx, cy - z(WALL + 40)); bucket(d, cx - z(PUL_R - 1), cy - z(WALL + 30))
    Z = Z0
    # ① 둘레 뒤 반쪽 + 앞 반쪽
    rim_back(d, C + C // 2, 200); rim_front(d, C + C // 2, 420)
    # ② 물 가득 + 빈 바닥 (둘 다 입구 크기 타원)
    water(d, C * 2 + C // 2, 190, (120, 120, 120)); water(d, C * 2 + C // 2, 440, (70, 70, 70))
    # ③ 기둥 + 지붕 + 들보
    post(d, C + 130, C + 300); roof(d, C + 380, C + 250); beam(d, C + 330, C + 430)
    # ④ 도르래 바퀴 + 두레박
    pulley(d, C * 2 + 170, C + 190); bucket(d, C * 2 + 440, C + 120)
    o.save('D:/에셋창고/STD/scene-well-parts.png'); print(o.size)


if __name__ == '__main__':
    main()
