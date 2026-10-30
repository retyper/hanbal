# -*- coding: utf-8 -*-
"""지도 기호 실루엣 시험 (형 10-30: "실루엣만으로도 구분 가능하게 만들어야 함 · 다 이미지 실루엣이 원형이라서 고을 같기도 하고").

길 기호(public/realm/icon/route-*.png)와 지도 위 고을 그림(settle-* · capital-*)의 알파를 지도에 보이는 크기로 줄여
검은 그림자로만 본다. 그리고 셋을 잰다.
  - 원형도 4πA/P²: 겉둘레(구멍은 메움) 기준. 원 = 1, 정사각 = 0.785, 정삼각 = 0.60.
    둥근 땅 위 디오라마(고을 그림)는 가운데가 0.86 이다 → 길 기호는 ROUND_MAX(0.70, 정사각보다 덜 둥근 것) 아래여야 한다.
  - 겹침 IoU: 덩어리를 테두리 상자로 자르고 긴 변을 N 칸에 맞춰(비율은 그대로) 가운데 놓은 뒤 겹친 넓이 / 합친 넓이.
    고을 그림 어느 하나와도, 다른 길 기호와도 IOU_MAX 를 넘으면 안 된다.
  - 낱장 판: 가장 작은 크기에서 모두를 검은 그림자로 늘어놓은 그림 한 장 (눈으로 본다).

크기는 폰 지도에서 잰 값(10-30, tools/phone-shot.ts · 360/412 폭): 멀리 볼 때 길 기호 18~22px · 고을 40~59px,
가까이(＋두 번) 길 기호 41px · 고을 74px. 세 쌍 모두에서 통과해야 한다.

  py -I tools/silhouette-test.py [낱장 판 png 경로] [길 기호 px 고을 px — 한 쌍만 볼 때]
나가는 값: 실패가 있으면 1.
"""
import glob, math, os, sys
sys.stdout.reconfigure(encoding="utf-8")
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ICON = os.path.join(R, 'public', 'realm', 'icon')
SHEET = sys.argv[1] if len(sys.argv) > 1 else os.path.join(R, 'tools', 'out', 'silhouettes.png')
SIZES = [(int(sys.argv[2]), int(sys.argv[3]))] if len(sys.argv) > 3 else [(18, 40), (22, 48), (41, 74)]
N = 64          # 겹침을 재는 판의 칸 수
UP = 8          # 둘레를 잴 때 키우는 배수 (작은 그림의 계단 둘레를 고르게)
ROUND_MAX = 0.70
IOU_MAX = 0.60

# 지도에 고을로 나오는 그림 — src/realm/data/art.ts 의 KIND_ICON · SETTLED_ICON · NODE_ICON · capitalIcon (settle-* 는 다 넣는다: 더 엄하게)
towns = sorted(glob.glob(os.path.join(ICON, 'settle-*.png')) + glob.glob(os.path.join(ICON, 'capital-*.png')))
# ROUTE_DIR — 다른 폴더의 길 기호를 잴 때 (예: 갈아 끼우기 전 옛 판)
roads = sorted(glob.glob(os.path.join(os.environ.get('ROUTE_DIR', ICON), 'route-*.png')))


def mask_at(path, px):
    """지도 크기(긴 변 px)로 줄인 알파 → 0..1"""
    a = np.asarray(Image.open(path).convert('RGBA'))[..., 3]
    ys, xs = np.nonzero(a > 40)
    a = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    h, w = a.shape
    s = px / max(h, w)
    small = Image.fromarray(a).resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)
    return np.asarray(small).astype(np.float32) / 255


def filled(m):
    """눈에 보이는 그림자 — 반 넘게 찬 칸, 겉둘레 안쪽 구멍은 메운다"""
    b = (m > 0.5).astype(np.uint8)
    cs, _ = cv2.findContours(b, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    out = np.zeros_like(b)
    cv2.drawContours(out, cs, -1, 1, thickness=cv2.FILLED)
    return out


def roundness(m):
    big = cv2.resize(m, (m.shape[1] * UP, m.shape[0] * UP), interpolation=cv2.INTER_LINEAR)
    b = (big > 0.5).astype(np.uint8)
    cs, _ = cv2.findContours(b, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    cs = [c for c in cs if cv2.contourArea(c) > (UP * UP) * 2]
    if not cs:
        return 0.0
    A = sum(cv2.contourArea(c) for c in cs)
    P = sum(cv2.arcLength(cv2.approxPolyDP(c, UP * 0.35, True), True) for c in cs)
    return 4 * math.pi * A / (P * P)


def norm(m):
    f = filled(m)
    ys, xs = np.nonzero(f)
    f = f[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    h, w = f.shape
    s = N / max(h, w)
    nh, nw = max(1, round(h * s)), max(1, round(w * s))
    r = cv2.resize(f.astype(np.float32), (nw, nh), interpolation=cv2.INTER_LINEAR) > 0.5
    out = np.zeros((N, N), bool)
    y0, x0 = (N - nh) // 2, (N - nw) // 2
    out[y0:y0 + nh, x0:x0 + nw] = r
    return out


def iou(a, b):
    return float((a & b).sum()) / max(1, float((a | b).sum()))


def shape(kind, px):
    """잣대 — 그린 원·정사각·정삼각으로 원형도 셈이 맞는지 본다"""
    im = Image.new('L', (200, 200), 0)
    d = ImageDraw.Draw(im)
    if kind == 'circle': d.ellipse((10, 10, 190, 190), fill=255)
    if kind == 'square': d.rectangle((10, 10, 190, 190), fill=255)
    if kind == 'triangle': d.polygon([(100, 10), (190, 166), (10, 166)], fill=255)
    a = np.asarray(im.resize((px, px), Image.LANCZOS)).astype(np.float32) / 255
    return roundness(a)


name = lambda p: os.path.splitext(os.path.basename(p))[0]
worst = {}   # 길 기호마다 세 크기 가운데 가장 나쁜 값
first = None
for sign_px, town_px in SIZES:
    T = {name(p): mask_at(p, town_px) for p in towns}
    Rd = {name(p): mask_at(p, sign_px) for p in roads}
    TN = {k: norm(v) for k, v in T.items()}
    RN = {k: norm(v) for k, v in Rd.items()}
    tr = [roundness(m) for m in T.values()]
    print(f'── 길 기호 {sign_px}px · 고을 {town_px}px ── 잣대 원 {shape("circle", sign_px):.2f} · 정사각 {shape("square", sign_px):.2f} · 정삼각 {shape("triangle", sign_px):.2f}'
          f' · 고을 {len(T)}장 원형도 {min(tr):.2f}~{max(tr):.2f} (가운데 {sorted(tr)[len(tr) // 2]:.2f})')
    rows = []
    for k, m in Rd.items():
        c = roundness(m)
        bt = max(((iou(RN[k], v), t) for t, v in TN.items()))
        br = max(((iou(RN[k], v), t) for t, v in RN.items() if t != k))
        rows.append((k, c, bt, br))
        w = worst.setdefault(k, [0.0, (0.0, ''), (0.0, '')])
        w[0] = max(w[0], c)
        w[1] = max(w[1], bt)
        w[2] = max(w[2], br)
    if first is None:
        first = (Rd, T, rows, sign_px, town_px)

print(f'\n기준: 길 기호 원형도 < {ROUND_MAX} · 고을/다른 길 기호와 IoU < {IOU_MAX} (세 크기 가운데 가장 나쁜 값)\n')
fails = 0
for k, (c, bt, br) in worst.items():
    bad = []
    if c >= ROUND_MAX: bad.append('둥글다')
    if bt[0] >= IOU_MAX: bad.append('고을과 닮음')
    if br[0] >= IOU_MAX: bad.append('길 기호끼리 닮음')
    fails += len(bad) > 0
    worst[k].append(bad)
    print(f'{"✗" if bad else "✓"} {k[6:]:15s} 원형도 {c:.2f}  고을 IoU {bt[0]:.2f} ({bt[1]})  길 IoU {br[0]:.2f} ({br[1][6:]})  {" · ".join(bad)}')
W = list(worst.values())
print(f'\n{len(W) - fails}/{len(W)} 통과 · 원형도 평균 {np.mean([w[0] for w in W]):.2f} · 고을 IoU 최대 {max(w[1][0] for w in W):.2f} · 길 IoU 최대 {max(w[2][0] for w in W):.2f}')

# 낱장 판 — 첫(가장 작은) 크기. 위: 길 기호(×3 · 글은 원형도/고을 IoU), 아래: 고을 그림
Rd, T, rows, sign_px, town_px = first
Z = 3
cell = town_px * Z + 16
cols = 9
items = [(k, m, f'{r[1]:.2f}/{r[2][0]:.2f}', bool(worst[k][3])) for (k, m), r in zip(Rd.items(), rows)] + [(k, m, f'{roundness(m):.2f}', False) for k, m in T.items()]
nrow_r = math.ceil(len(Rd) / cols)
nrow_t = math.ceil(len(T) / cols)
sheet = Image.new('RGB', (cols * cell, (nrow_r + nrow_t) * (cell + 14) + 30), 'white')
d = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype('malgun.ttf', 12)
except OSError:
    font = ImageFont.load_default()
for i, (k, m, txt, bad) in enumerate(items):
    isroad = i < len(Rd)
    j = i if isroad else i - len(Rd)
    row = j // cols + (0 if isroad else nrow_r)
    x0, y0 = (j % cols) * cell, row * (cell + 14) + (0 if isroad else 30)
    b = filled(m)
    im = Image.fromarray(((1 - b) * 255).astype(np.uint8)).resize((b.shape[1] * Z, b.shape[0] * Z), Image.NEAREST)
    sheet.paste(im, (x0 + (cell - im.width) // 2, y0 + (cell - im.height) // 2))
    d.text((x0 + 4, y0 + cell - 2), f'{k.split("-", 1)[1][:12]} {txt}', fill='red' if bad else 'black', font=font)
d.text((4, nrow_r * (cell + 14) + 8), f'▲ 길 기호 @{sign_px}px (원형도/고을 IoU) · ▼ 고을 그림 @{town_px}px (원형도)', fill='blue', font=font)
os.makedirs(os.path.dirname(SHEET), exist_ok=True)
sheet.save(SHEET)
print('낱장 판:', SHEET)
sys.exit(1 if fails else 0)
