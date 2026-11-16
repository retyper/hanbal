"""H27(활·창·칼 능력 아이콘 여섯) · H28(투창·검기 투사체)를 열전 그림으로 굽는다 (형 11-15).
원본: assets_src/realm/raid/haebi-pack-v1-H27.png · H28.png (Downloads 는 읽지도 않는다) · 다시 굽기: py -3 -I tools/raid-kit-art.py"""
from pathlib import Path
from PIL import Image
root = Path(__file__).resolve().parent.parent
src, out = root / 'assets_src/realm/raid', root / 'public/realm/raid'
def fit(im, size, pad):
    box = im.getchannel('A').point(lambda v: 255 if v > 10 else 0).getbbox()
    im = im.crop(box); im.thumbnail((size - pad * 2, size - pad * 2), Image.Resampling.LANCZOS)
    tile = Image.new('RGBA', (size, size)); tile.alpha_composite(im, ((size - im.width) // 2, (size - im.height) // 2)); return tile
h27 = Image.open(src / 'haebi-pack-v1-H27.png').convert('RGBA')
names = ['bow', 'rain', 'spear', 'javelin', 'sword', 'wave']
for i, n in enumerate(names):
    w, h = h27.width // 3, h27.height // 2
    fit(h27.crop((i % 3 * w, i // 3 * h, (i % 3 + 1) * w, (i // 3 + 1) * h)), 96, 3).save(out / f'power-{n}.png', optimize=True)
h28 = Image.open(src / 'haebi-pack-v1-H28.png').convert('RGBA')
half = h28.width // 2
fit(h28.crop((0, 0, half, h28.height)), 160, 2).save(out / 'javelin.png', optimize=True)      # 오른쪽을 본다
fit(h28.crop((half, 0, h28.width, h28.height)), 128, 2).save(out / 'sword-wave.png', optimize=True)
h29p = src / 'haebi-pack-v1-H29.png'   # 조합 문양 (오면)
if h29p.exists():
    h29 = Image.open(h29p).convert('RGBA'); w, h = h29.width // 3, h29.height // 2
    for i, n in enumerate(['volley', 'meteor', 'grove', 'boomerang', 'tempest', 'splitwave']):
        fit(h29.crop((i % 3 * w, i // 3 * h, (i % 3 + 1) * w, (i // 3 + 1) * h)), 96, 3).save(out / f'{n}.png', optimize=True)
print('ok', [(p.name, p.stat().st_size) for p in sorted(out.glob('power-*.png'))], (out / 'javelin.png').stat().st_size, (out / 'sword-wave.png').stat().st_size)

# 11-16 다이센카식 열전: H39 단검·주술 능력·조합 · H40 비도·혼불·방울 파동 · H41 상점 열둘 · H42 휘장 셋
def grid(path, cols, rows):
    im = Image.open(src / path).convert('RGBA'); w, h = im.width // cols, im.height // rows
    return [im.crop((c * w, r * h, (c + 1) * w, (r + 1) * h)) for r in range(rows) for c in range(cols)]
if (src / 'haebi-pack-v1-H39.png').exists():
    for cell, n in zip(grid('haebi-pack-v1-H39.png', 4, 2), ['power-dagger', 'power-knife', 'power-bell', 'power-soul', 'shadowdance', 'venom', 'rite', 'soulstorm']):
        fit(cell, 96, 3).save(out / f'{n}.png', optimize=True)
if (src / 'haebi-pack-v1-H40.png').exists():
    knife, soul, ring = grid('haebi-pack-v1-H40.png', 3, 1)
    fit(knife, 96, 2).save(out / 'knife.png', optimize=True)          # 오른쪽을 본다
    fit(soul, 96, 2).save(out / 'soul.png', optimize=True)
    fit(ring, 160, 2).save(out / 'bell-ring.png', optimize=True)
if (src / 'haebi-pack-v1-H41.png').exists():
    for cell, n in zip(grid('haebi-pack-v1-H41.png', 4, 3), ['might', 'vigor', 'armor', 'regen', 'haste', 'swift', 'magnet', 'wisdom', 'revive', 'reroll', 'greed', 'luck']):
        fit(cell, 96, 3).save(out / f'shop-{n}.png', optimize=True)
if (src / 'haebi-pack-v1-H42.png').exists():
    for cell, n in zip(grid('haebi-pack-v1-H42.png', 3, 1), ['forest', 'ford', 'palisade']):
        fit(cell, 128, 2).save(out / f'emblem-{n}.png', optimize=True)
