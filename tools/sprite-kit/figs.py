# -*- coding: utf-8 -*-
"""figs.py — 칸이 아니라 「사람」으로 자른다 (11-12: 제미나이가 2×2 대신 4×2·칸 하나에 둘·칸 나눔선·손 밖에 뜬 칼을 그려 칸 자르기가 안 맞는다)

  py -3 -X utf8 tools/sprite-kit/figs.py list <key> [r1 r3 r4]
      장마다 키 빼기(clean.py) → 칸 나눔선 걷기 → 사람 덩어리 찾기(작은 조각은 가까우면 붙이고 멀면 버림) → 줄·왼쪽 순으로 번호
      → D:/tmp-node/figs-<key>.jpg 에 번호 붙인 판 · 사람 그림은 assets_src/realm/gemini/generals2/figs/<key>/<장>-<번호>.png
  WALK=r1:1,2,3,4,1,2,3,4 STAND=r4:2 INHALE=r4:3 READY=r3:1 WIND=r3:2 THRUST=r3:3 FOLLOW=r4:4 HIT=r3:4 DOWN=r4:1 \\
  py -3 -X utf8 tools/sprite-kit/figs.py make <key> [out.png]
      고른 번호로 띠 20칸 (서기·들숨·서기·들숨 · 걷기 8 · 준비·당김·공격·공격·공격 뒤·준비 · 맞음 · 누움)
      장마다 배율은 그 장의 기준 키(걷기 장은 걷기 키 가운데값 · 나머지는 STAND/READY 처럼 선 사람)로 맞춘다 → 제일 큰 컷이 위 3px 안 · 발 바닥 · 몸통 가운데."""
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

G = 'assets_src/realm/gemini/generals2/'
PY = [sys.executable, '-X', 'utf8']
mode, key = sys.argv[1], sys.argv[2]
FD = G + f'figs/{key}/'
H = 160
TOP = 3


def figures(sheet):
    src = G + f'{key}-{sheet}.png'
    kp = G + f'{key}-{sheet}-key.png'
    subprocess.run(PY + ['tools/sprite-kit/clean.py', src, kp], check=True, capture_output=True)
    a = np.array(Image.open(kp).convert('RGBA'))
    m = a[..., 3] > 40
    h, w = m.shape
    # 칸 나눔선: 그림 폭·높이의 60% 넘게 이어진 가는 줄·열 (사람은 그렇게 길지 않다)
    def thin(flags, maxw=5):  # 길게 이어진 줄 가운데 두께 5px 이하만 선 (사람이 빽빽이 선 줄은 두껍다)
        lab1, k1 = ndimage.label(flags)
        keep = np.zeros_like(flags)
        for q in range(1, k1 + 1):
            idx = np.nonzero(lab1 == q)[0]
            if len(idx) <= maxw:
                keep[idx] = True
        return keep
    rows = thin(m.mean(axis=1) > 0.6)
    cols = thin(m.mean(axis=0) > 0.6)
    a[rows, :, 3] = 0
    a[:, cols, 3] = 0
    m = a[..., 3] > 40
    lab, n = ndimage.label(m, structure=np.ones((3, 3)))
    if n == 0:
        return []
    sl = ndimage.find_objects(lab)
    area = ndimage.sum(m, lab, range(1, n + 1))
    # 우하단 귀(워터마크 ✦ 자리)의 작은 조각은 버린다 — 키 빼기에 남은 별 찌꺼기가 사람에 붙어 들어왔다 (11-12 단비)
    for q in range(n):
        if area[q] < area.max() * 0.01 and sl[q][1].start > w * 0.78 and sl[q][0].start > h * 0.72:
            area[q] = 0
            a[lab == q + 1, 3] = 0
    # 가까운 덩어리끼리 묶는다(한 사람이 키 빼기로 몇 조각으로 갈린 것 · 창끝) — 틈이 그림 크기의 1.2% 안
    par = list(range(n))

    def f(x):
        while par[x] != x:
            par[x] = par[par[x]]
            x = par[x]
        return x
    near = max(h, w) * 0.012
    ids = [i for i in range(n) if area[i] >= 30]
    for ii, i in enumerate(ids):
        for k in ids[ii + 1:]:
            gap = max(sl[k][1].start - sl[i][1].stop, sl[i][1].start - sl[k][1].stop, sl[k][0].start - sl[i][0].stop, sl[i][0].start - sl[k][0].stop, 0)
            if gap <= near:
                par[f(i)] = f(k)
    cl = {}
    for i in ids:
        cl.setdefault(f(i), []).append(i)
    tot = {r: sum(area[i] for i in mem) for r, mem in cl.items()}
    biggest = max(tot.values())
    groups = {r: mem for r, mem in cl.items() if tot[r] >= biggest * 0.25}  # 사람만 · 떨어져 뜬 칼·티끌은 버린다
    out = []
    for j, mem in groups.items():
        mk = np.isin(lab, [x + 1 for x in mem])
        ys, xs = np.nonzero(mk)
        crop = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1].copy()
        crop[~mk[ys.min():ys.max() + 1, xs.min():xs.max() + 1], 3] = 0
        out.append(((ys.min() + ys.max()) / 2, (xs.min() + xs.max()) / 2, ys.max(), Image.fromarray(crop)))
    # 칼끝이 옆 사람에 닿아 둘셋이 한 덩어리로 붙은 것 — 한 사람 너비·높이의 1.6배를 넘으면 잉크가 가장 옅은 골짜기에서 가른다
    mh = float(np.median([t[3].height for t in out]))  # 한 사람 키 = 덩어리 키의 가운데값 (붙은 덩어리는 소수)
    stand = [t for t in out if mh * 0.7 <= t[3].height <= mh * 1.3]
    mw = float(np.median([t[3].width for t in stand])) if stand else 1e9
    ma = float(np.median([(np.array(t[3])[..., 3] > 40).sum() for t in stand])) if stand else 0  # 한 사람 잉크 넓이

    def cuts(prof, k, unit):
        res, last = [], 0
        for q in range(1, k):
            c0 = int(q * len(prof) / k)
            lo, hi = max(last + 1, c0 - int(unit * 0.3)), min(len(prof) - 1, c0 + int(unit * 0.3))
            res.append(lo + int(np.argmin(prof[lo:hi + 1])) if hi > lo else c0)
            last = res[-1]
        return [0] + res + [len(prof)]

    def split(t):
        cy, cx_, bot, im = t
        arr = np.array(im)
        al = arr[..., 3] > 40
        x0 = cx_ - im.width / 2
        y0 = cy - im.height / 2
        if im.height > mh * 1.6:
            k = round(im.height / mh)
            ys = cuts(al.sum(axis=1).astype(float), k, mh)
            parts = []
            for a_, b_ in zip(ys, ys[1:]):
                sub_ = Image.fromarray(arr[a_:b_])
                parts += split((y0 + (a_ + b_) / 2, cx_, y0 + b_, sub_))
            return parts
        if im.width > mw * 1.6 and im.height >= mh * 0.7:
            k = round(im.width / mw)
            xs = cuts(al.sum(axis=0).astype(float), k, mw)
            # 쪼갠 조각마다 사람 몸만큼의 잉크가 있어야 진짜 둘 — 길게 뻗은 칼·창 한 사람(찌르기)은 그대로 둔다
            if all(al[:, a_:b_].sum() >= ma * 0.35 for a_, b_ in zip(xs, xs[1:])):
                return [(cy, x0 + (a_ + b_) / 2, bot, Image.fromarray(arr[:, a_:b_])) for a_, b_ in zip(xs, xs[1:])]
        return [t]

    def tight(t):
        cy, cx_, bot, im = t
        arr = np.array(im)
        ys, xs = np.nonzero(arr[..., 3] > 40)
        return (cy, cx_, bot, Image.fromarray(arr[ys.min():ys.max() + 1, xs.min():xs.max() + 1])) if len(ys) else None
    out = [u for t in out for v in split(t) for u in [tight(v)] if u is not None]
    # 줄 나누기: 발(맨 아래) 높이로 묶는다
    out.sort(key=lambda t: t[2])
    rows_, cur = [], []
    for t in out:
        if cur and t[2] - cur[-1][2] > h * 0.2:
            rows_.append(cur); cur = []
        cur.append(t)
    if cur:
        rows_.append(cur)
    res = []
    for r in rows_:
        res += [t[3] for t in sorted(r, key=lambda t: t[1])]
    return res


def ink_h(im):
    al = np.array(im)[..., 3] > 40
    ys = np.nonzero(al.any(axis=1))[0]
    return ys.max() - ys.min() + 1


if mode == 'list':
    sheets = sys.argv[3:] or ['r1', 'r3', 'r4']
    os.makedirs(FD, exist_ok=True)
    for old in os.listdir(FD):  # 이 장수의 지난 번호 판만 비운다
        if old.endswith('.png'):
            os.remove(FD + old)
    tiles = []
    for s_ in sheets:
        if not os.path.exists(G + f'{key}-{s_}.png'):
            continue
        for i, f in enumerate(figures(s_), 1):
            f.save(FD + f'{s_}-{i}.png')
            t = f.copy(); t.thumbnail((150, 150))
            tile = Image.new('RGB', (160, 180), (50, 50, 50))
            tile.paste(t, ((160 - t.width) // 2, 175 - t.height), t)
            ImageDraw.Draw(tile).text((4, 2), f'{s_}:{i}', fill=(255, 255, 0))
            tiles.append(tile)
        print(s_, len([x for x in os.listdir(FD) if x.startswith(s_ + '-')]), '명')
    cols = 8
    sheet = Image.new('RGB', (160 * cols, 180 * ((len(tiles) + cols - 1) // cols)), (20, 20, 20))
    for i, t in enumerate(tiles):
        sheet.paste(t, ((i % cols) * 160, (i // cols) * 180))
    sheet.save(f'D:/tmp-node/figs-{key}.jpg')
    print(f'D:/tmp-node/figs-{key}.jpg')
    sys.exit(0)

# make
out = sys.argv[3] if len(sys.argv) > 3 else f'public/realm/anim2/gen-{key}.png'
if out.startswith('public/') and os.path.exists(out):
    os.makedirs('assets_src/realm/retired/anim2-quad', exist_ok=True)
    Image.open(out).save(f'assets_src/realm/retired/anim2-quad/gen-{key}.png')  # 옛 띠 보관 (메모리 keep-retired-art)
load = lambda ref: Image.open(FD + ref.replace(':', '-') + '.png')
env = lambda k: os.environ[k]
walk_refs = env('WALK').split(':')
wsheet, widx = walk_refs[0], walk_refs[1].split(',')
W = [load(f'{wsheet}:{i}') for i in widx]
wh = float(np.median([ink_h(x) for x in W]))
roles = {r: env(r) for r in ('STAND', 'INHALE', 'READY', 'WIND', 'THRUST', 'FOLLOW', 'HIT', 'DOWN')}
# 장마다 기준 키: 그 장에 STAND 나 READY(선 사람)가 있으면 그것 · 걷기 장은 걷기 가운데값
base = {wsheet: wh}
for r in ('STAND', 'READY'):
    sh = roles[r].split(':')[0]
    base.setdefault(sh, ink_h(load(roles[r])))
for r, v in roles.items():
    sh = v.split(':')[0]
    if sh not in base:
        sys.exit(f'멈춤: {sh} 장에 선 사람 기준이 없다 (STAND·READY 중 하나를 그 장에서)')
sc = {sh: wh / v for sh, v in base.items()}
pick = lambda v: (load(v), sc[v.split(':')[0]])
R = {r: pick(v) for r, v in roles.items()}
order = [R['STAND'], R['INHALE'], R['STAND'], R['INHALE']] + [(x, 1.0) for x in W] + [R['READY'], R['WIND'], R['THRUST'], R['THRUST'], R['FOLLOW'], R['READY'], R['HIT'], R['DOWN']]
order = [im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS) for im, k in order]
fit = min(1.0, (H - TOP) / max(ink_h(c) for c in order))
order = [c.resize((max(1, round(c.width * fit)), max(1, round(c.height * fit))), Image.LANCZOS) for c in order]


def cx(im):
    al = np.array(im)[..., 3].astype(float)
    return (al.sum(axis=0) * np.arange(al.shape[1])).sum() / max(1, al.sum())


half = max(max(cx(c), c.width - cx(c)) for c in order)
CW = int(np.ceil(half * 2)) + 4
strip = Image.new('RGBA', (CW * 20, H), (0, 0, 0, 0))
for i, c in enumerate(order):
    al = np.array(c)[..., 3] > 40
    bottom = np.nonzero(al.any(axis=1))[0].max()
    strip.alpha_composite(c, (int(round(i * CW + CW / 2 - cx(c))), H - 1 - bottom))
strip.save(out)
print(out, '칸', CW, '· 장 배율', {k: round(v, 3) for k, v in sc.items()}, '· 전체', round(fit, 3))
