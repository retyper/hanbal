# -*- coding: utf-8 -*-
"""mkquad.py <itch-walk.gif> — 2×2 참고 시트 다섯 장 (11-12 형: 「한 번에 만들 프레임 수를 줄여야 · 3개씩 · 남는 칸은 공격·피격」)
한 장 = 3컷 + 우하단 자홍 네모(워터마크 자리). 걷기 마네킹은 CC0 itch.io 「8 frame walk」(늘씬하게 · 7등신), 동작은 지백호 원본에서 덩어리째.
  q1 1:1  걷기 1 2 3    q2 1:1  걷기 4 5 6    q3 1:1  걷기 7 8 · 서기
  q4 16:9 준비 · 당김 · 찌름                   q5 16:9 맞음 · 누움 · 숨 들이쉰 서기
→ tools/sprite-kit/quad/ref-q1.png … ref-q5.png"""
import sys
import numpy as np
from PIL import Image, ImageSequence, ImageDraw
from scipy import ndimage

GIF = sys.argv[1]
OUT = 'tools/sprite-kit/quad/'
GREEN, MAG = (0, 255, 0, 255), (255, 0, 255, 255)

# ── 걷기 마네킹 8컷 (늘씬 · 머리 1/7) ──
fr = [np.array(f.convert('RGB')).astype(int) for f in ImageSequence.Iterator(Image.open(GIF))]
bg = fr[0][75, 435]
mk = []
for a in fr:
    c = a[70:250, 430:560].copy()
    ink = np.abs(c - bg).sum(axis=2) > 40
    ink[150:, :] = False
    gr = (c[..., 1] > c[..., 0] + 25) & (c[..., 1] > c[..., 2] + 10) & ink
    c[gr] = (95, 95, 100)
    head = ink & (c[..., 2] > c[..., 0] + 60) & (c[..., 2] > 150) & (np.arange(c.shape[0])[:, None] < 40)
    ys, xs = np.nonzero(head)
    hb = np.zeros_like(ink); hb[max(0, ys.min() - 3):ys.max() + 2, max(0, xs.min() - 3):xs.max() + 4] = True
    mk.append((c, ink, hb & ink, (ys.mean(), xs.mean())))
mtop = min(np.nonzero(i[1].any(axis=1))[0].min() for i in mk)
mfoot = max(np.nonzero(i[1].any(axis=1))[0].max() for i in mk)

def mannequin(i, H):
    """i 번째 컷을 키 H 로 (RGBA Image)"""
    c, ink, head, (hy, hx) = mk[i]
    body = ink & ~head
    rgba = np.dstack([c, body * 255]).astype(np.uint8)[mtop:mfoot + 1]
    xs = np.nonzero(ink[mtop:mfoot + 1].any(axis=0))[0]; x0, x1 = xs.min(), xs.max() + 1
    k = H / (mfoot - mtop + 1); SX = 0.62
    im = Image.fromarray(rgba[:, x0:x1])
    big = im.resize((im.width * 8, im.height * 8), Image.NEAREST).resize((max(1, round(im.width * k * SX)), round(im.height * k)), Image.LANCZOS)
    pad = int(H * 0.08)
    out = Image.new('RGBA', (big.width + 2 * pad, big.height + pad), (0, 0, 0, 0))
    out.alpha_composite(big, (pad, pad))
    d = H / 7
    hcx = pad + (hx - x0) * k * SX; hcy = pad + (hy - mtop) * k + d * 0.12
    ImageDraw.Draw(out).ellipse((hcx - d * 0.36, hcy - d * 0.45, hcx + d * 0.36, hcy + d * 0.45), fill=(80, 140, 200, 255))
    a = np.array(out); ys, xs = np.nonzero(a[..., 3] > 40)
    return Image.fromarray(a[ys.min():ys.max() + 1, xs.min():xs.max() + 1])

# ── 지백호 동작 (원본 4×2: 1 서기 2 당김 3 찌름 6 맞음 8 누움) ──
G = 'assets_src/realm/gemini/generals2/'
src = np.array(Image.open(G + 'jibaekho-act-key.png').convert('RGBA'))
h, w = src.shape[:2]
lab, n = ndimage.label(src[..., 3] > 40, structure=np.ones((3, 3)))
own = {}
for i, sl in enumerate(ndimage.find_objects(lab), 1):
    m = lab[sl] == i
    if m.sum() < 80: continue
    ys, xs = np.nonzero(m)
    own.setdefault(min(3, int((xs.mean() + sl[1].start) // (w / 4))) + 4 * min(1, int((ys.mean() + sl[0].start) // (h / 2))), []).append(i)

def jb(c):
    m = ndimage.binary_fill_holes(np.isin(lab, own[c - 1]))
    ys, xs = np.nonzero(m)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    rgba = src[y0:y1, x0:x1].copy(); rgba[~m[y0:y1, x0:x1], 3] = 0
    return Image.fromarray(rgba)
STAND_H = jb(1).height  # 지백호 서기 키 = 배율 기준

def sheet(W, H, cells, out, left):
    """cells: [(Image, '서기 키 대비 배율 기준 키', 왼쪽 정렬?)] 세 개 · 우하단 자홍"""
    CW, CH = W // 2, H // 2
    s = Image.new('RGBA', (W, H), GREEN)
    target = CH * 0.80
    for j, (im, ref_h, lft) in enumerate(cells):
        k = target / ref_h
        im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
        if im.width > CW * 0.94:
            kk = CW * 0.94 / im.width; im = im.resize((round(im.width * kk), round(im.height * kk)), Image.LANCZOS)
        r, c = divmod(j, 2)
        ox = int(c * CW + (CW * 0.05 if lft else (CW - im.width) / 2)); oy = int(r * CH + CH * 0.95 - im.height)
        s.alpha_composite(im, (ox, oy))
    a = np.array(s); p = 0.05
    a[int(CH + CH * p):int(2 * CH - CH * p * 0.5), int(CW + CW * p):int(2 * CW - CW * p * 0.5)] = MAG
    Image.fromarray(a[..., :3]).save(OUT + out)
    print(out, W, H)

M = lambda i: (mannequin(i, 400), 400, False)
J = lambda c, lft=True: (jb(c), STAND_H, lft)
sheet(1024, 1024, [M(0), M(1), M(2)], 'ref-q1.png', False)
sheet(1024, 1024, [M(3), M(4), M(5)], 'ref-q2.png', False)
sheet(1024, 1024, [M(6), M(7), J(1, False)], 'ref-q3.png', False)
sheet(1376, 768, [J(1), J(2), J(3)], 'ref-q4.png', True)
sheet(1376, 768, [J(6), J(8, False), J(1)], 'ref-q5.png', True)
