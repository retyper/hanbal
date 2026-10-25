"""
나라 깃발 자르기 — 제미나이 4×4 깃발 격자(순록 초록 #00FF00 바탕) → public/realm/icon/nflag-<나라>.png (96×96)
(형 10-26: "고래나 돼지나 다 명확히 중앙색이 다 구분되어야 · 빨간 돼지 파란 고래 이런 식으로 · 시뻘겋거나 새파래도 됨")

  py -I tools/cut-flags.py <격자 png> <나라 id 16개를 쉼표로 · 빈 칸은 ->

옛 깃발(icon/emblem-*.png)과 **같은 틀**에 놓는다 — 깃발 몸의 높이·가운데를 옛 것에 맞춘다(싸움판 장수 줄이 흔들리지 않게 · 형 10-26).
"""
import os
import sys
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'public', 'realm', 'icon')
REF = os.path.join(OUT, 'emblem-antler.png')  # 옛 깃발 하나 — 틀의 잣대


def key_green(im: Image.Image) -> Image.Image:
    a = np.asarray(im.convert('RGB')).astype(np.int32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    # 초록이 붉음·푸름보다 얼마나 센가 — 바탕은 크게, 천·문양은 작게
    gx = g - np.maximum(r, b)
    alpha = np.clip(255 - (gx - 40) * 4, 0, 255).astype(np.uint8)
    # 가장자리의 초록 번짐을 걷는다
    spill = np.where(gx > 0, np.minimum(g, np.maximum(r, b) + 10), g)
    rgb = np.dstack([r, spill, b]).clip(0, 255).astype(np.uint8)
    return Image.fromarray(np.dstack([rgb, alpha]), 'RGBA')


def frame_of_ref():
    ref = Image.open(REF).convert('RGBA')
    box = ref.split()[3].point(lambda v: 255 if v > 40 else 0).getbbox()
    return ref.size, box


def main(sheet: str, ids: list) -> None:
    im = key_green(Image.open(sheet))
    # 오른쪽 아래 ✦ — 지운다
    a = np.asarray(im).copy()
    h, w = a.shape[:2]
    a[int(h * 0.955):, int(w * 0.955):, 3] = 0
    im = Image.fromarray(a, 'RGBA')
    (S, _), box = frame_of_ref()
    bw, bh = box[2] - box[0], box[3] - box[1]
    cx, cy = (box[0] + box[2]) / 2, (box[1] + box[3]) / 2
    cw, ch = w // 4, h // 4
    for i, nid in enumerate(ids):
        if nid in ('', '-'):
            continue
        cell = im.crop(((i % 4) * cw, (i // 4) * ch, (i % 4 + 1) * cw, (i // 4 + 1) * ch))
        bb = cell.split()[3].point(lambda v: 255 if v > 40 else 0).getbbox()
        if bb is None:
            print('빈 칸', nid)
            continue
        cell = cell.crop(bb)
        # 옛 깃발 몸과 같은 높이 · 같은 가운데
        k = bh / cell.size[1]
        nw, nh = max(1, round(cell.size[0] * k)), bh
        if nw > S:
            k = S / cell.size[0]
            nw, nh = S, max(1, round(cell.size[1] * k))
        cell = cell.resize((nw, nh), Image.LANCZOS)
        out = Image.new('RGBA', (S, S), (0, 0, 0, 0))
        out.alpha_composite(cell, (round(cx - nw / 2), round(cy - nh / 2)))
        out.save(os.path.join(OUT, f'nflag-{nid}.png'))
        print('ok', nid, nw, nh)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2].split(','))
