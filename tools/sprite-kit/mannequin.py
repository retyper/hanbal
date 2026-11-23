# -*- coding: utf-8 -*-
"""비율 인형 · 색 견본표 (형 11-23 「베이스라인을 뼈대나 인형같이 · 소서노 자체가 머리카락이나 옷이 풍성해서 그림체·크기·색감이 전부 오해된다」).
머리카락·옷 없는 회색 인형에 관절 높이 눈금을 박는다 → 그림 주문의 「비율」 견본. 그림 결·색은 따로 견본표 한 장.
잰 값: 소서노·감실·진하 정수리~발 135~137 · 정수리~턱 35~39 (기준서 §5) · 다리(가랑이~발) 키의 0.30(옷 짧은 아룸).
  py -3 -I tools/sprite-kit/mannequin.py → D:/에셋창고/STD/mannequin-f.png · mannequin-m.png · mannequin-guide.png · style-swatch.png
"""
import os
from PIL import Image, ImageDraw, ImageFont

OUT = 'D:/에셋창고/STD'
S = 4          # 4배로 그리고 줄인다 (부드러운 가장자리)
CELL = (208, 160)
FEET = 155     # 칸 안 발바닥 줄 (지금 띠와 같음)

# 관절 높이 (정수리에서 px · 키 137 기준) — 여자 기준 · 남자는 키 142 · 어깨·허리 넓게
F = dict(height=137, head=37, neck=40, shoulder=44, chest=60, waist=72, hip=86, crotch=96, knee=117, ankle=132,
         shoulder_w=34, chest_w=28, waist_w=20, hip_w=30, thigh=11, calf=8, arm=7)
M = dict(height=142, head=37, neck=40, shoulder=45, chest=63, waist=76, hip=89, crotch=99, knee=121, ankle=137,
         shoulder_w=42, chest_w=36, waist_w=27, hip_w=32, thigh=13, calf=10, arm=9)

CLAY, CLAY_D, LINE, GUIDE = (176, 168, 160, 255), (138, 130, 124, 255), (60, 38, 30, 255), (200, 60, 60, 255)


def doll(P, female=True):
    W, H = CELL[0] * S, CELL[1] * S
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    top = (FEET - P['height']) * S; cx = W // 2
    y = lambda v: top + v * S
    def limb(x0, y0, x1, y1, w):
        d.line([(x0, y0), (x1, y1)], fill=CLAY, width=int(w * S)); d.ellipse([x1 - w * S / 2, y1 - w * S / 2, x1 + w * S / 2, y1 + w * S / 2], fill=CLAY)
    # 다리 (두 발로 디디고 어깨너비보다 조금 좁게 벌림 · 오른쪽을 보는 3/4 라 앞다리가 조금 앞)
    for side, dx in ((-1, -9), (1, 9)):
        hx = cx + side * 7 * S
        limb(hx, y(P['crotch'] - 4), cx + dx * S, y(P['knee']), P['thigh'])
        limb(cx + dx * S, y(P['knee']), cx + (dx + side * 2) * S, y(P['ankle']), P['calf'])
        fx = cx + (dx + side * 2) * S
        d.rounded_rectangle([fx - 5 * S, y(P['ankle']) - 2 * S, fx + 9 * S, y(P['height'])], radius=3 * S, fill=CLAY_D)
    # 몸통 (어깨 → 가슴 → 허리 → 엉덩이)
    pts = [(-P['shoulder_w'] / 2, P['shoulder']), (-P['chest_w'] / 2, P['chest']), (-P['waist_w'] / 2, P['waist']), (-P['hip_w'] / 2, P['hip']), (-P['hip_w'] / 2 + 3, P['crotch']),
           (P['hip_w'] / 2 - 3, P['crotch']), (P['hip_w'] / 2, P['hip']), (P['waist_w'] / 2, P['waist']), (P['chest_w'] / 2, P['chest']), (P['shoulder_w'] / 2, P['shoulder'])]
    d.polygon([(cx + px * S, y(py)) for px, py in pts], fill=CLAY)
    if female:
        b = P.get('bust', 6)
        for side in (-1, 1): d.ellipse([cx + side * 8 * S - b * S, y(P['chest'] - 4 - b), cx + side * 8 * S + b * S, y(P['chest'] - 4 + b * .8)], fill=CLAY_D)
    # 팔 (몸 곁에 살짝 벌려 내림 · 손목은 엉덩이 높이)
    for side in (-1, 1):
        sx = cx + side * (P['shoulder_w'] / 2 - 2) * S
        ex, ey = sx + side * 6 * S, y(P['waist'] - 2)
        limb(sx, y(P['shoulder'] + 2), ex, ey, P['arm'])
        limb(ex, ey, ex + side * 4 * S, y(P['hip'] + 4), P['arm'] - 1)
    # 목 · 머리 (머리 = 정수리~턱 · 머리카락 없음 · 얼굴은 오른쪽을 본다)
    d.rectangle([cx - 5 * S, y(P['head'] - 3), cx + 5 * S, y(P['neck'] + 4)], fill=CLAY_D)
    hw = P['head'] * .78
    d.ellipse([cx - hw / 2 * S, y(0), cx + hw / 2 * S, y(P['head'])], fill=CLAY)
    d.ellipse([cx + 3 * S, y(P['head'] * .5), cx + 7 * S, y(P['head'] * .5 + 3)], fill=LINE)   # 눈 한 점 (보는 쪽)
    im = im.resize(CELL, Image.LANCZOS)
    # 바깥 윤곽 1px (기준 밤색)
    a = im.getchannel('A'); edge = Image.new('RGBA', CELL, (0, 0, 0, 0)); ed = edge.load(); al = a.load()
    for yy in range(1, CELL[1] - 1):
        for xx in range(1, CELL[0] - 1):
            if al[xx, yy] < 60 and max(al[xx + 1, yy], al[xx - 1, yy], al[xx, yy + 1], al[xx, yy - 1]) >= 128: ed[xx, yy] = LINE
    edge.alpha_composite(im); return edge


def guide(f, m):
    sc = 3; W = CELL[0] * 2 * sc + 260; Hh = CELL[1] * sc + 40
    g = Image.new('RGBA', (W, Hh), (236, 232, 222, 255)); d = ImageDraw.Draw(g)
    try: font = ImageFont.truetype('C:/Windows/Fonts/malgun.ttf', 15)
    except Exception: font = ImageFont.load_default()
    for i, (doll_im, P, name) in enumerate(((f, F, '여자 · 키 137 · 머리 37 (3.7머리)'), (m, M, '남자 · 키 142 · 머리 37 (3.8머리)'))):
        x0 = 230 + i * CELL[0] * sc
        g.alpha_composite(doll_im.resize((CELL[0] * sc, CELL[1] * sc), Image.NEAREST), (x0, 20))
        top = 20 + (FEET - P['height']) * sc
        for key, label in (('head', '턱'), ('shoulder', '어깨'), ('waist', '허리'), ('crotch', '가랑이'), ('knee', '무릎'), ('height', '발바닥')):
            yy = top + P[key] * sc; d.line([(x0 + 20, yy), (x0 + CELL[0] * sc - 20, yy)], fill=GUIDE, width=1)
            if i == 0: d.text((10, yy - 9), f'{label}  ({P[key]}px)', fill=(120, 30, 30), font=font)
        d.line([(x0 + 20, top), (x0 + CELL[0] * sc - 20, top)], fill=GUIDE, width=2)
        d.text((x0 + 30, Hh - 22), name, fill=(40, 30, 20), font=font)
    d.text((10, top - 18), '정수리 (머리카락·관 빼고)', fill=(120, 30, 30), font=font)
    return g


def swatch():
    """그림 결 견본표 — 윤곽 · 피부 · 명암 단계 · 채도 (소서노에서 잰 값 · 기준서 §2)"""
    sw = Image.new('RGBA', (720, 300), (236, 232, 222, 255)); d = ImageDraw.Draw(sw)
    try: font = ImageFont.truetype('C:/Windows/Fonts/malgun.ttf', 15)
    except Exception: font = ImageFont.load_default()
    rows = [('바깥 윤곽 (검정 아님 · 1px · 그늘 쪽만 2px)', ['#38241C', '#3C261E', '#43291F']),
            ('피부 4단 (그늘 → 바탕 → 밝음 → 반짝)', ['#C88A6E', '#E8B090', '#F8C8A8', '#FDE6D4']),
            ('붉은 옷 4단 (채도 높게)', ['#4A1418', '#7A1F24', '#A8343A', '#D8625A']),
            ('금장 4단 + 1px 반사', ['#5A3A12', '#9A6A22', '#D4A23C', '#FFF0B0']),
            ('찬 옷도 같은 결 (남빛 4단)', ['#1C2238', '#2E3A5E', '#46598A', '#7E93C2'])]
    for i, (label, cols) in enumerate(rows):
        yy = 14 + i * 56; d.text((12, yy + 14), label, fill=(40, 30, 20), font=font)
        for j, c in enumerate(cols): d.rectangle([380 + j * 82, yy, 452 + j * 82, yy + 44], fill=c, outline=(60, 38, 30))
    return sw


def main():
    os.makedirs(OUT, exist_ok=True)
    f, m = doll(F, True), doll(M, False)
    f.save(f'{OUT}/mannequin-f.png'); m.save(f'{OUT}/mannequin-m.png')
    guide(f, m).save(f'{OUT}/mannequin-guide.png'); swatch().save(f'{OUT}/style-swatch.png')
    print('ok', OUT)


if __name__ == '__main__':
    main()


# ── 체형 (11-23 형 「여자 체형별로 나눠야 · 가냘픈 · 허벅지 튼실한 · 가슴 큰 · 다양하잖아」) ──
# 키·머리·관절 높이는 같고 폭만 다르다 (그래서 머리 크기·얼굴 결은 모든 장수가 같다)
BODY_TYPES = {
    'f-slender':  ('여 · 가냘픈',  F, dict(shoulder_w=30, chest_w=24, waist_w=17, hip_w=26, thigh=9,  calf=7,  arm=6, bust=4)),
    'f-standard': ('여 · 표준',    F, dict(bust=6)),
    'f-glamour':  ('여 · 글래머',  F, dict(shoulder_w=33, chest_w=30, waist_w=18, hip_w=34, thigh=12, calf=8,  arm=7, bust=9)),
    'f-athletic': ('여 · 탄탄한',  F, dict(shoulder_w=35, chest_w=29, waist_w=21, hip_w=33, thigh=14, calf=10, arm=8, bust=6)),
    'f-sturdy':   ('여 · 우람한',  F, dict(shoulder_w=39, chest_w=33, waist_w=25, hip_w=34, thigh=14, calf=10, arm=10, bust=7)),
    'm-lean':     ('남 · 마른',    M, dict(shoulder_w=36, chest_w=30, waist_w=23, hip_w=28, thigh=11, calf=8,  arm=7)),
    'm-standard': ('남 · 표준',    M, dict()),
    'm-muscular': ('남 · 근육질',  M, dict(shoulder_w=50, chest_w=44, waist_w=30, hip_w=34, thigh=15, calf=12, arm=12)),
    'm-heavy':    ('남 · 육중한',  M, dict(shoulder_w=48, chest_w=46, waist_w=44, hip_w=40, thigh=16, calf=12, arm=12, belly=12)),
}


def doll_type(base, over, female):
    P = dict(base); P.update(over)
    im = doll(P, female)
    if P.get('belly'):  # 배가 나온 육중한 몸 — 허리 둘레를 더 부풀린 판을 덧그린다
        big = dict(P); big['waist_w'] = P['waist_w'] + P['belly']; big['chest_w'] = P['chest_w'] + P['belly'] // 2
        im = doll(big, female)
    return im


def types_sheet():
    sc = 2; n = len(BODY_TYPES); W = CELL[0] * sc * n; Hh = CELL[1] * sc + 40
    g = Image.new('RGBA', (W, Hh), (236, 232, 222, 255)); d = ImageDraw.Draw(g)
    try: font = ImageFont.truetype('C:/Windows/Fonts/malgun.ttf', 14)
    except Exception: font = ImageFont.load_default()
    for i, (key, (label, base, over)) in enumerate(BODY_TYPES.items()):
        im = doll_type(base, over, key.startswith('f'))
        im.save(f'{OUT}/mannequin-{key}.png')
        g.alpha_composite(im.resize((CELL[0] * sc, CELL[1] * sc), Image.NEAREST), (i * CELL[0] * sc, 10))
        P = dict(base); P.update(over)
        d.text((i * CELL[0] * sc + 30, Hh - 26), f"{label}  어깨{P['shoulder_w']} 허리{P['waist_w']} 골반{P['hip_w']} 허벅지{P['thigh']}", fill=(40, 30, 20), font=font)
    g.save(f'{OUT}/body-types.png')


if __name__ == '__main__' and os.environ.get('TYPES') == '1':
    os.makedirs(OUT, exist_ok=True); types_sheet(); print('types ok')
