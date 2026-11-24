# -*- coding: utf-8 -*-
"""그림 API 가 자리를 바꿔 낸 판을 인형 자리로 다시 놓는다 (11-24 · gpt-image-2 맞음 판 29장 가운데 다수가 왼쪽 서기 줄을 빼고 네 사람을 그림 전체에 2×2 로 늘어놓았다).
  py -3 -X utf8 -I tools/sprite-kit/regrid-api.py <받은 판.png> <보낸 장면.png> [ref=<자리를 지킨 판>,<그 장면>]
하는 일
  1. 받은 판에서 사람 넷(큰 덩어리 넷)을 찾는다. 왼쪽 줄(서기 견본 자리)에 사람이 있으면 자리를 지킨 판이라 그대로 둔다.
  2. 위·아래 줄, 왼쪽·오른쪽 차례로 칸1~4 에 짝짓는다.
  3. 장면의 인형 네 칸(오른쪽 2×2)마다 인형의 덩어리 가운데·발바닥을 재서, 사람을 그 가운데·발바닥에 맞춰 놓는다.
  4. 크기: 자리를 지킨 판(ref · 기본 해비 맞음 판)의 「사람 키 ÷ 인형 키」 가운데 값과 같아지게 네 사람을 같은 배율로.
  원본은 <받은 판>-raw.png 로 남긴다(이미 있으면 그것에서 다시 만든다).
"""
import os
import shutil
import sys
import numpy as np
from PIL import Image
from scipy import ndimage


def mask(im):
    a = np.asarray(im.convert('RGB')).astype(int)
    mag = (a[..., 0] > 170) & (a[..., 2] > 170) & (a[..., 1] < 110)
    return ~mag


def blobs(m, n=4, min_px=400):
    lab, k = ndimage.label(ndimage.binary_closing(m, iterations=4))
    out = []
    for i in range(1, k + 1):
        ys, xs = np.nonzero(lab == i)
        if len(xs) > min_px:
            out.append(dict(id=i, n=len(xs), x0=xs.min(), x1=xs.max() + 1, y0=ys.min(), y1=ys.max() + 1, cx=(xs.min() + xs.max()) / 2, cy=(ys.min() + ys.max()) / 2))
    return lab, sorted(out, key=lambda b: -b['n'])


def rigs(scene, W, H):
    """장면 오른쪽 2×2 칸의 인형 덩어리(받은 판 좌표) — (가운데 x, 위, 바닥)"""
    sc = Image.open(scene).convert('RGB').resize((W, H), Image.NEAREST)
    m = mask(sc)
    cw, ch = W / 3, H / 2
    res = []
    for j, i in ((0, 0), (0, 1), (1, 0), (1, 1)):
        x0, y0 = round(cw * (1 + i)), round(ch * j)
        c = m[y0:round(ch * (j + 1)), x0:round(cw * (2 + i))]
        ys, xs = np.nonzero(c)
        res.append(((xs.min() + xs.max()) / 2 + x0, ys.min() + y0, ys.max() + y0))
    return res


def kept(bl, W, H):
    return sum(1 for b in bl[:6] if b['cx'] < W / 3) >= 1 and len([b for b in bl[:6] if b['cx'] >= W / 3]) >= 4


def ratio(out, scene):
    im = Image.open(out)
    W, H = im.size
    lab, bl = blobs(mask(im))
    rg = rigs(scene, W, H)
    cw, ch = W / 3, H / 2
    rs = []
    for n, (j, i) in enumerate(((0, 0), (0, 1), (1, 0), (1, 1))):
        mine = [b for b in bl if cw * (1 + i) <= b['cx'] < cw * (2 + i) and ch * j <= b['cy'] < ch * (j + 1)]
        if mine:
            b = mine[0]
            rs.append((b['y1'] - b['y0']) / (rg[n][2] - rg[n][1]))
    return float(np.median(rs))


def main(argv):
    out, scene = argv[0], argv[1]
    ref = next((a[4:].split(',') for a in argv[2:] if a.startswith('ref=')), ['D:/에셋창고/STD/out-haebi-hit.png', 'D:/에셋창고/STD/scene-haebi-hit.png'])
    raw = out.replace('.png', '-raw.png')
    src = Image.open(raw if os.path.exists(raw) else out).convert('RGB')
    W, H = src.size
    m = mask(src)
    lab, bl = blobs(m)
    if not os.path.exists(raw) and kept(bl, W, H):
        print('자리를 지킨 판 — 그대로', out)
        return
    figs = bl[:4]
    if len(figs) < 4:
        raise SystemExit(f'사람을 넷 못 찾음({len(figs)})')
    figs = sorted(figs, key=lambda b: b['cy'])
    figs = sorted(figs[:2], key=lambda b: b['cx']) + sorted(figs[2:], key=lambda b: b['cx'])
    rg = rigs(scene, W, H)
    want = ratio(*ref)
    have = float(np.median([(f['y1'] - f['y0']) / (r[2] - r[1]) for f, r in zip(figs, rg)]))
    k = want / have
    if not os.path.exists(raw):
        shutil.copyfile(out, raw)
    a = np.asarray(src.convert('RGBA')).copy()
    canvas = Image.new('RGBA', (W, H), (255, 0, 255, 255))
    for f, (rcx, rtop, rbot) in zip(figs, rg):
        piece = a[f['y0']:f['y1'], f['x0']:f['x1']].copy()
        piece[..., 3] = np.where(lab[f['y0']:f['y1'], f['x0']:f['x1']] == f['id'], 255, 0)
        p = Image.fromarray(piece)
        if abs(k - 1) > .01:
            p = p.resize((max(1, round(p.size[0] * k)), max(1, round(p.size[1] * k))), Image.LANCZOS)
        canvas.alpha_composite(p, (round(rcx - p.size[0] / 2), round(rbot - p.size[1])))
    canvas.convert('RGB').save(out)
    print(f'다시 놓음 {os.path.basename(out)} · 배율 {k:.3f} (기준 키÷인형 {want:.3f} · 받은 것 {have:.3f})')


if __name__ == '__main__':
    main(sys.argv[1:])
