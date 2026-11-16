"""해비 열전 UI 조각 굽기 (형 11-15 · 챗지피티 H21~H24) — 늘이지 않게 끝은 고정, 가운데만 반복할 수 있게 자른다.
원본: assets_src/realm/raid/haebi-pack-v1-H2x.png → public/realm/raid/ui/*.png · 숫자는 ui/kit.json
게이지는 안쪽 홈을 투명하게 뚫어 채움 색이 그 밑에서 보이게 한다.  다시 굽기: py -3 -I tools/raid-ui-kit.py"""
import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets_src/realm/raid'
OUT = ROOT / 'public/realm/raid/ui'
OUT.mkdir(parents=True, exist_ok=True)
SCALE = .5   # 화면에서는 많아야 원본의 반 크기로 보인다
kit = {}


def load(n):
    return Image.open(SRC / f'haebi-pack-v1-{n}.png').convert('RGBA')


def dark_run(values, limit):
    """가장 긴 '어두운' 구간 [시작, 끝)"""
    best, start = (0, 0), None
    for i, v in enumerate(list(values) + [999]):
        if v < limit and start is None:
            start = i
        elif v >= limit and start is not None:
            if i - start > best[1] - best[0]:
                best = (start, i)
            start = None
    return best


def save(name, im, **meta):
    w, h = round(im.width * SCALE), round(im.height * SCALE)
    im.resize((w, h), Image.LANCZOS).save(OUT / f'{name}.png', optimize=True)
    kit[name] = {'size': [w, h], **{k: (round(v * SCALE) if isinstance(v, (int, float)) else [round(x * SCALE) for x in v]) for k, v in meta.items()}}


def feather(im, px):
    """잘린 가장자리의 은은한 빛이 칼로 자른 듯 끊기지 않게 가장자리 px 만큼 알파를 0으로 줄인다"""
    a = np.array(im).astype(float)
    h, w = a.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    d = np.minimum(np.minimum(xx, w - 1 - xx), np.minimum(yy, h - 1 - yy))
    a[..., 3] *= np.clip(d / px, 0, 1)
    return Image.fromarray(a.astype(np.uint8))


def gauge(name, im, box, row=None, clear=None):
    """막대: 양 끝 마개(slice) + 안쪽 홈(window)을 찾아 투명하게 뚫는다"""
    piece = im.crop(box)
    if clear:
        piece.paste((0, 0, 0, 0), clear)
    a = np.array(piece).astype(int)
    lum = np.where(a[..., 3] > 200, a[..., :3].mean(axis=2), 999)  # 투명한 곳은 어두운 홈이 아니다
    cy, cx = (row if row is not None else a.shape[0] // 2), a.shape[1] // 2
    x0, x1 = dark_run(lum[cy], 45)
    y0, y1 = dark_run(lum[:, cx], 45)
    a[y0 + 1:y1 - 1, x0 + 1:x1 - 1, 3] = 0
    save(name, Image.fromarray(a.astype(np.uint8)), window=[x0 + 1, y0 + 1, x1 - 1, y1 - 1], slice=x0 + 1)


h21 = load('H21')
gauge('bar-hp', h21, (68, 102, 1468, 238))
gauge('bar-xp', h21, (105, 318, 1430, 396))
gauge('bar-boss', h21, (38, 490, 1498, 836), row=116, clear=(400, 300, 1060, 346))  # 술 장식 때문에 가운데 줄을 짚고, 아래 이름판 윗변은 지운다
save('plaque', h21.crop((452, 802, 1083, 926)))

h22 = load('H22')
save('btn', h22.crop((12, 165, 760, 426)), slice=115)
save('btn-primary', h22.crop((779, 165, 1526, 426)), slice=115)
for name, x0 in (('ic-evade', 41), ('ic-pause', 345), ('ic-full', 646), ('ic-reroll', 939), ('ic-close', 1237)):
    framed = h22.crop((x0 - 4, 566, x0 + 276, 842))
    save(name, framed)                                   # 테두리 있는 네모 단추째
    save(name + '-glyph', framed.crop((62, 62, 218, 218)))  # 안쪽 그림만 (단추 글자 옆)

h23 = load('H23')
for name, box in (('mark-slam', (21, 11, 720, 533)), ('mark-ring', (733, 31, 1333, 507)), ('mark-arrow', (1340, 460, 1486, 718)),
                  ('mark-move', (40, 726, 306, 958)), ('mark-hero', (345, 738, 846, 962)), ('mark-target', (874, 706, 1502, 990))):
    save(name, feather(h23.crop(box), 18))

h24 = load('H24')
save('banner', h24.crop((28, 69, 1508, 278)), slice=230)
for name, x0 in (('badge-bronze', 75), ('badge-iron', 557), ('badge-red', 1038)):
    save(name, h24.crop((x0, 336, x0 + 424, 532)), slice=70)
save('ribbon', h24.crop((23, 568, 1515, 968)), slice=300)

(OUT / 'kit.json').write_text(json.dumps(kit, indent=1), encoding='utf-8')
for k, v in kit.items():
    print(k, v)
