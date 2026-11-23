# -*- coding: utf-8 -*-
"""걷는 칸의 머리를 한 장으로 묶는다 (11-23 형 「달빛은 걷는 게 이상한데 · 머리가 커졌다 작아졌다 하고 시선도 이상하고」).
그림 도구는 여덟 칸의 얼굴을 칸마다 새로 그린다 → 눈을 떴다 감았다 하고 시선·머리 모양이 칸마다 달라진다.
잘 만든 도트 걷기는 머리가 「같은 화소」이고 몸의 높낮이만큼 오르내릴 뿐이다. → 기준 칸의 머리 상자를 나머지 칸에 옮겨 붙인다.
  머리 자리 맞춤: 가로 = 머리 윗부분 화소의 가운데 · 세로 = 얼굴 살빛(머리 위 46줄 안)의 가운데 (머리카락 끝은 칸마다 흔들려 믿을 수 없다)
  py -3 -I tools/sprite-kit/head-lock.py <이름> <기준 칸: walk-a-3 처럼> <꼬리표 ...>      예) dalbit walk-a-3 walk-a walk-b
  상자: 머리 꼭대기 위 4줄 ~ 턱 아래(얼굴 가운데 + CHIN) · 가로는 얼굴 가운데에서 LEFT/RIGHT
  face 를 주면 얼굴 안쪽만 묶는다(윤곽은 그대로 — 머리 곁으로 물건이 지나가는 장수) · 아래 box 로 윗몸을 통째로 묶는 것은 떠다녀 보여 쓰지 않는다(11-24)
  box=왼,오,위,아래 를 주면 상자를 바꾼다 — 머리 곁으로 물건이 지나가는 장수(어깨에 멘 메)는 머리 상자가 물건을 네모나게 자른다
    (11-24 형 「머리에 포스터 붙이고 다니는 것 같아」) → 머리 + 물건 + 어깨를 통째로 묶는다(걷는 윗몸은 한 그림이다): 예) box=42,32,30,30
"""
import sys
import numpy as np
from PIL import Image

PXD = 'D:/에셋창고/STD/px'
LEFT, RIGHT, UP, CHIN = 26, 22, 30, 15   # 얼굴 가운데에서 왼쪽·오른쪽·위·아래로 (게임 화소)


def anchor(im):
    a = np.asarray(im).astype(np.int16)
    m = a[..., 3] > 0
    ys = np.nonzero(m.any(1))[0]
    top = ys.min()
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    skin = m & (r > 170) & (r - b > 40) & (g > 110)
    band = np.zeros_like(skin)
    band[top:top + 46] = skin[top:top + 46]
    sy, sx = np.nonzero(band)
    return int(round(np.median(sx))), int(round(np.median(sy)))


def lock(name, ref, tags):
    rim = Image.open(f'{PXD}/{name}-{ref}.png').convert('RGBA')
    rx, ry = anchor(rim)
    box = (rx - LEFT, ry - UP, rx + RIGHT, ry + CHIN)
    head = rim.crop(box)
    for tag in tags:
        for i in (1, 2, 3, 4):
            p = f'{PXD}/{name}-{tag}-{i}.png'
            im = Image.open(p).convert('RGBA')
            if f'{tag}-{i}' == ref:
                continue
            x, y = anchor(im)
            a = np.asarray(im).copy()
            x0, y0 = x - LEFT, y - UP
            a[max(0, y0):y0 + head.size[1], max(0, x0):x0 + head.size[0]] = 0     # 그 칸의 머리 상자를 지우고
            out = Image.fromarray(a)
            out.alpha_composite(head, (x0, y0))                                    # 기준 머리를 얹는다
            out.save(p)
            print(f'{tag}-{i}: 머리 자리 ({x},{y}) ← 기준 ({rx},{ry})')


def face_lock(name, ref, tags, half=(9, 11, 9, 10)):
    """얼굴만 묶는다 (11-24 형 「상체에 포스터 붙인 듯이 떠다닌다」 — 메가 잘리는 것을 막겠다고 윗몸을 통째로 굳혀 붙였더니 종이처럼 떠다녔다).
    머리 곁으로 물건이 지나가는 장수: 윤곽(머리카락·물건·어깨·팔)은 받은 그림 그대로 두고, **얼굴 안쪽(눈·코·입)** 작은 상자만 기준 칸 것으로 바꾼다 → 표정·시선만 같아진다.
    자리는 살빛 가운데가 아니라 **머리 둘레의 밝기 무늬를 기준 칸에 겹쳐**(±4px) 찾는다 — 그 칸의 머리가 있는 바로 그 자리에 얹힌다(떠다니지 않는다).
    상자가 그 칸의 얼굴 살 밖으로 나가는 화소는 건드리지 않는다(윤곽을 바꾸지 않는다)."""
    L, Rr, U, D = half
    rim = Image.open(f'{PXD}/{name}-{ref}.png').convert('RGBA')
    rx, ry = anchor(rim)
    ra = np.asarray(rim).astype(np.int16)
    gray = lambda a: (a[..., 0] * 3 + a[..., 1] * 6 + a[..., 2]) // 10 * (a[..., 3] > 0)
    win = (slice(ry - 26, ry + 16), slice(rx - 24, rx + 22))   # 머리 둘레(겹쳐 볼 창)
    rg = gray(ra)[win]
    patch = ra[ry - U:ry + D, rx - L:rx + Rr].copy()
    for tag in tags:
        for i in (1, 2, 3, 4):
            if f'{tag}-{i}' == ref:
                continue
            p = f'{PXD}/{name}-{tag}-{i}.png'
            a = np.asarray(Image.open(p).convert('RGBA')).astype(np.int16)
            g = gray(a)
            best, at = None, (0, 0)
            for dy in range(-4, 5):
                for dx in range(-4, 5):
                    w = g[win[0].start + dy:win[0].stop + dy, win[1].start + dx:win[1].stop + dx]
                    c = int(np.abs(w - rg).sum())
                    if best is None or c < best:
                        best, at = c, (dx, dy)
            dx, dy = at
            y0, x0 = ry - U + dy, rx - L + dx
            tgt = a[y0:y0 + U + D, x0:x0 + L + Rr]
            skin = lambda q: (q[..., 3] > 0) & (q[..., 0] > 150) & (q[..., 0] - q[..., 2] > 30)
            # 두 칸 모두 얼굴 안쪽인 화소만(살이거나 살에 둘러싸인 눈·입): 상자 안에서 그 칸의 불투명 화소 ∩ 기준 칸의 불투명 화소
            ok = (tgt[..., 3] > 0) & (patch[..., 3] > 0)
            n_skin = int((skin(tgt) & skin(patch)).sum())
            if n_skin < ok.sum() * .35:
                print(f'{tag}-{i}: 얼굴이 안 맞는다(살 겹침 {n_skin}/{int(ok.sum())}) — 건드리지 않음')
                continue
            tgt[ok] = patch[ok]
            Image.fromarray(a.astype(np.uint8)).save(p)
            print(f'{tag}-{i}: 얼굴 자리 밀림 ({dx:+d},{dy:+d}) · 바꾼 화소 {int(ok.sum())}')


if __name__ == '__main__':
    args = sys.argv[3:]
    for a in [a for a in args if a.startswith('box=')]:
        LEFT, RIGHT, UP, CHIN = [int(v) for v in a[4:].split(',')]
    rest = [a for a in args if not a.startswith('box=') and a != 'face']
    if 'face' in args:
        face_lock(sys.argv[1], sys.argv[2], rest)
    else:
        lock(sys.argv[1], sys.argv[2], rest)
