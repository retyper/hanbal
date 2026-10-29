# -*- coding: utf-8 -*-
"""
병사 동작 그림 둘째 판 — 동작마다 따로 받은 띠를 20칸 한 줄로 묶는다 (형 10-29: "병사 에셋 움직임 자연스럽게 · 창끝이 길게 앞으로").

  py -I tools/anim-pack.py <병종> [더 많은 병종 …]

읽는 것: assets_src/realm/anim-try/<병종>-idle.png · -walk.png · -attack.png (높이 160 · 칸 수는 4 · 8 · 6, 적으면 칸을 되풀이해 채운다)
         public/realm/anim/<병종>.png 의 8번째 칸(쓰러짐 — 옛 띠에서 그대로 · 움찔은 새 서기 칸)
쓰는 것: public/realm/anim2/<병종>.png — 칸 20개: 서기 0~3 · 걷기 4~11 · 공격 12~17 · 움찔 18 · 쓰러짐 19 (높이 160)
         그리고 한 칸의 가로세로 비를 찍는다 → src/realm/data/art.ts SOL_ANIM2

맞춤: 동작마다 첫 칸의 머리(위쪽 18% 잉크의 무게중심)를 칸 가운데에 — 같은 동작 안의 움직임(찌를 때 앞으로 나가는 것)은 그대로 둔다.
칸 폭은 모든 칸에서 머리 가운데로부터 가장 먼 잉크까지의 두 배 (창이 다 뻗어도 들어간다).
"""
import os
import sys
import numpy as np
from PIL import Image

R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
H = 160
LAYOUT = [('idle', 4), ('walk', 8), ('attack', 6)]
# 칸 갈아 끼우기 — 그 칸에 제미나이 별표가 흐리게 남은 것 등 (병종 → {버릴 칸: 대신 쓸 칸})
SWAP = {'shield': {17: 18}}


def frames_of(path, n):
    im = Image.open(path).convert('RGBA')
    if im.height != H:
        im = im.resize((round(im.width * H / im.height), H), Image.LANCZOS)
    w = im.width // n
    return [im.crop((i * w, 0, (i + 1) * w, H)) for i in range(n)]


def guess_n(path, want):
    """띠의 칸 수 — 기대한 수로 나누어떨어지면 그것, 아니면 4"""
    im = Image.open(path)
    for n in (want, 8, 6, 4):
        if im.width % n == 0 and im.width // n >= 60:
            return n
    return want


def head_x(fr):
    a = np.asarray(fr)[..., 3] > 40
    ys, xs = np.nonzero(a)
    if len(ys) == 0:
        return fr.width / 2
    top = ys.min()
    band = a[top: top + max(4, int((ys.max() - top) * 0.18)) + 1]
    bys, bxs = np.nonzero(band)
    return float(bxs.mean()) if len(bxs) else float(xs.mean())


def ink_x(fr):
    a = np.asarray(fr)[..., 3] > 40
    xs = np.nonzero(a.any(axis=0))[0]
    return (int(xs.min()), int(xs.max())) if len(xs) else (0, fr.width - 1)


def pack(kind):
    src = os.path.join(R, 'assets_src', 'realm', 'anim-try')
    cells = []  # (frame, anchor x)
    for act, want in LAYOUT:
        p = os.path.join(src, f'{kind}-{act}.png')
        n = guess_n(p, want)
        fs = frames_of(p, n)
        ax = head_x(fs[0])
        seq = [fs[i * n // want] for i in range(want)] if n != want else fs
        cells += [(f, ax) for f in seq]
    # 움찔 — 새 서기 칸을 빌린다 (옛 띠의 움찔 칸은 다른 사람이 그려져 있었다) · 쓰러짐 — 옛 띠의 마지막 칸
    cells.append(cells[1])
    old = Image.open(os.path.join(R, 'public', 'realm', 'anim', f'{kind}.png')).convert('RGBA')
    ow = old.width // 8
    f = old.crop((7 * ow, 0, 8 * ow, old.height))
    if f.height != H:
        f = f.resize((round(f.width * H / f.height), H), Image.LANCZOS)
    cells.append((f, f.width / 2))
    for bad, good in SWAP.get(kind, {}).items():
        cells[bad] = cells[good]
    half = 0
    for f, ax in cells:
        l, r = ink_x(f)
        half = max(half, ax - l, r - ax)
    cw = int(np.ceil(half * 2 + 8))
    out = Image.new('RGBA', (cw * len(cells), H), (0, 0, 0, 0))
    for i, (f, ax) in enumerate(cells):
        out.alpha_composite(f, (int(round(i * cw + cw / 2 - ax)), 0))
    os.makedirs(os.path.join(R, 'public', 'realm', 'anim2'), exist_ok=True)
    dst = os.path.join(R, 'public', 'realm', 'anim2', f'{kind}.png')
    out.save(dst, optimize=True)
    print(f'{kind}: {len(cells)}칸 · 칸 {cw}×{H} · 비 {cw / H:.3f} · {os.path.getsize(dst)} 바이트')


if __name__ == '__main__':
    for k in sys.argv[1:]:
        pack(k)
