"""열전 스테이지 배경(H02 여울 · H03 목책)과 피해 숫자 글꼴(H32)을 게임 그림으로 굽는다 (형 11-16 · 다이센카식 스테이지).
원본: assets_src/realm/raid/haebi-pack-v1-H??.png (Downloads·에셋창고는 읽지 않는다) · 다시 굽기: py -3 -I tools/raid-stage-art.py
- 배경: 지금 숲 배경(forest.webp)과 같은 크기 · 같은 webp 품질
- 숫자: 위 줄 보통 · 아래 줄 급소/쓰러뜨림 · 칸마다 알파 상자로 잘라 같은 높이(48px)로, 가운데 맞춰 10칸×2줄 한 장
"""
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

root = Path(__file__).resolve().parent.parent
src, out = root / 'assets_src/realm/raid', root / 'public/realm/raid'
forest = Image.open(out / 'forest.webp')
for sid, name in (('H02', 'ford'), ('H03', 'palisade')):
    im = Image.open(src / f'haebi-pack-v1-{sid}.png').convert('RGB')
    W, H = forest.size
    k = max(W / im.width, H / im.height)
    im = im.resize((round(im.width * k), round(im.height * k)), Image.Resampling.LANCZOS)
    x, y = (im.width - W) // 2, (im.height - H) // 2
    im.crop((x, y, x + W, y + H)).save(out / f'{name}.webp', quality=82, method=6)
    print(name, (W, H), (out / f'{name}.webp').stat().st_size)

# 숫자: 덩어리를 찾아 줄(위·아래)과 차례(왼→오)로 0~9
a = np.array(Image.open(src / 'haebi-pack-v1-H32.png').convert('RGBA'))
lab, n = ndimage.label(a[..., 3] > 40, structure=np.ones((3, 3)))
boxes = []
for i, sl in enumerate(ndimage.find_objects(lab), 1):
    if sl is None:
        continue
    area = int((lab[sl] == i).sum())
    if area < 400:
        continue
    boxes.append((sl[0].start, sl[0].stop, sl[1].start, sl[1].stop))
mid = a.shape[0] / 2
rows = [sorted([b for b in boxes if (b[0] + b[1]) / 2 < mid], key=lambda b: b[2]), sorted([b for b in boxes if (b[0] + b[1]) / 2 >= mid], key=lambda b: b[2])]
# 불꽃 장식 같은 작은 조각은 가장 가까운 숫자에 붙인다
def merge(row):
    row = sorted(row, key=lambda b: b[2]); big = sorted(row, key=lambda b: -(b[1] - b[0]) * (b[3] - b[2]))[:10]
    big = sorted(big, key=lambda b: b[2]); out = [list(b) for b in big]
    for b in row:
        if tuple(b) in [tuple(x) for x in big]:
            continue
        cx = (b[2] + b[3]) / 2; j = min(range(len(out)), key=lambda j: abs((out[j][2] + out[j][3]) / 2 - cx))
        o = out[j]; out[j] = [min(o[0], b[0]), max(o[1], b[1]), min(o[2], b[2]), max(o[3], b[3])]
    return out
rows = [merge(r) for r in rows]
assert all(len(r) == 10 for r in rows), [len(r) for r in rows]
CH, CW = 48, 40
sheet = Image.new('RGBA', (CW * 10, CH * 2))
for r, row in enumerate(rows):
    for c, (y0, y1, x0, x1) in enumerate(row):
        g = Image.fromarray(a[y0:y1, x0:x1])
        k = min((CH - 2) / g.height, (CW - 2) / g.width)
        g = g.resize((max(1, round(g.width * k)), max(1, round(g.height * k))), Image.Resampling.LANCZOS)
        sheet.alpha_composite(g, (c * CW + (CW - g.width) // 2, r * CH + (CH - g.height) // 2))
sheet.save(out / 'digits.png', optimize=True)
print('digits', sheet.size, (out / 'digits.png').stat().st_size)

# 결과 창 배경 (H43 승리 · H44 패배) — 숲 배경과 같은 크기
for sid, name in (('H43', 'result-win'), ('H44', 'result-lose')):
    p = src / f'haebi-pack-v1-{sid}.png'
    if not p.exists():
        continue
    im = Image.open(p).convert('RGB'); W, H = forest.size
    k = max(W / im.width, H / im.height)
    im = im.resize((round(im.width * k), round(im.height * k)), Image.Resampling.LANCZOS)
    x, y = (im.width - W) // 2, (im.height - H) // 2
    im.crop((x, y, x + W, y + H)).save(out / f'{name}.webp', quality=80, method=6)
    print(name, (out / f'{name}.webp').stat().st_size)
