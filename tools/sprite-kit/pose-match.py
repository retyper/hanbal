# -*- coding: utf-8 -*-
"""자세 겹침 재기 (11-23 · ART-SKELETON §5 동작 뼈대).
기본 몸의 동작 판(2×2 네 칸)과 그 판에 옷을 입힌 판을 칸마다 겹쳐, 자세가 지켜졌는지 숫자로 본다.
옷·머리카락은 몸 밖으로 부풀 뿐이므로 「기본 몸 실루엣이 입힌 실루엣 안에 얼마나 들어가는가(덮임)」를 잰다.
  덮임   = 기본 몸 화소 중 입힌 그림에 덮인 몫 (발바닥 가운데·발 높이를 맞춘 뒤 · 키는 137 로)
  발 벌림 = 맨 아래 6% 줄에서 두 발 사이 거리 (기본 ↔ 입힌 차이 · 137 눈금)
  키 차   = 칸 안에서 사람 키의 비 (입힌 ÷ 기본 · 머리카락·관 때문에 1.0~1.12 가 정상)
합격선: 덮임 ≥ COVER_MIN · 발 벌림 차 ≤ FEET_TOL
한계(11-23 재 봄): 큰 망토는 몸을 다 덮어서, 팔을 든 범 1차도 덮임 0.99 로 나온다 → **덮임은 「몸이 밖으로 삐져나오지 않았나」만 본다.**
  걸음(발 벌림·발 높이)은 숫자로 믿을 수 있고, 팔·윗몸 자세는 겹친 그림을 눈으로 본다.
  py -3 -I tools/sprite-kit/pose-match.py <기본 판.png> <입힌 판.png> [가로 칸=2] [세로 칸=2]
"""
import sys
import numpy as np
from PIL import Image

COVER_MIN = .90
FEET_TOL = 4.0
N = 137


def mask(img):
    a = np.asarray(img.convert('RGB')).astype(np.int16); r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mk, gk = np.minimum(r, b) - g, g - np.maximum(r, b); k = mk if mk.mean() > gk.mean() else gk
    return k < 60


def cells(path, cols, rows):
    im = Image.open(path); W, H = im.size; out = []
    for j in range(rows):
        for i in range(cols):
            m = mask(im.crop((i * W // cols, j * H // rows, (i + 1) * W // cols, (j + 1) * H // rows)))
            ys, xs = np.nonzero(m)
            out.append((m[ys.min():ys.max() + 1, xs.min():xs.max() + 1], (xs.min() + xs.max()) / 2 / (W / cols), ys.max() / (H / rows)))
    return out


def feet(m):
    H = m.shape[0]; band = m[int(H * .94):]; xs = np.nonzero(band.any(0))[0]
    if len(xs) == 0: return 0, 0, 0
    return xs.min(), xs.max(), (xs.min() + xs.max()) / 2


def norm(m, body_h=None):
    """키(또는 주어진 몸 키)를 137 로 맞춘 불리언 판"""
    h = body_h or m.shape[0]; k = N / h
    im = Image.fromarray((m * 255).astype(np.uint8)).resize((max(1, round(m.shape[1] * k)), max(1, round(m.shape[0] * k))), Image.BILINEAR)
    return np.asarray(im) > 127


def compare(base, dressed):
    b = norm(base)
    best = None
    # 입힌 쪽은 머리카락·관으로 키가 늘어난다 → 몸 키를 모른다. 100~114% 를 훑어 가장 잘 덮이는 값을 고른다.
    for pct in range(100, 115, 2):
        d = norm(dressed, dressed.shape[0] / (pct / 100))
        bf, df = feet(b), feet(d)
        canvas = np.zeros((max(b.shape[0], d.shape[0]) + 4, b.shape[1] + d.shape[1] + 8), bool); cx = canvas.shape[1] // 2; by = canvas.shape[0] - 2
        def put(m, f):
            c = np.zeros_like(canvas); x0 = int(round(cx - f[2])); y0 = by - m.shape[0]
            c[y0:y0 + m.shape[0], x0:x0 + m.shape[1]] = m; return c
        B, D = put(b, bf), put(d, df)
        cover = (B & D).sum() / B.sum()
        if best is None or cover > best[0]: best = (cover, pct, (bf[1] - bf[0]), (df[1] - df[0]))
    return best


if __name__ == '__main__':
    cols = int(sys.argv[3]) if len(sys.argv) > 3 else 2; rows = int(sys.argv[4]) if len(sys.argv) > 4 else 2
    A, B = cells(sys.argv[1], cols, rows), cells(sys.argv[2], cols, rows); ok = 0
    for i, ((bm, bx, by), (dm, dx, dy)) in enumerate(zip(A, B)):
        cover, pct, bw, dw = compare(bm, dm); good = cover >= COVER_MIN and abs(bw - dw) <= FEET_TOL; ok += good
        print(f"칸{i + 1} {'합격' if good else '불합격'}  덮임 {cover:.2f}  키 {pct}%  발 벌림 {bw}→{dw}  칸 안 자리 x {bx:.2f}→{dx:.2f} 발 높이 {by:.2f}→{dy:.2f}")
    print(f"{ok}/{len(A)} 합격 (덮임 ≥ {COVER_MIN} · 발 벌림 차 ≤ {FEET_TOL})")
