"""열전 넷째·다섯째 스테이지 그림 (11-16 · H47 설원 고개 · H48 불타는 산성 · H49 휘장 둘)을 게임 그림으로 굽는다.
raid-stage-art.py · raid-kit-art.py 와 같은 규칙 (그쪽을 다시 돌리면 옛 그림까지 다시 구워지니 따로 둔다).
원본: assets_src/realm/raid/haebi-pack-v1-H47~H49.png (Downloads·에셋창고는 읽지 않는다 · 복사해 둔 것만)
적·두목 띠(H45·H46·H50~H53)는 py -3 -I tools/sprite-kit/bake-raid-enemies.py --only H45,H46,H50,H51,H52,H53
다시 굽기: py -3 -I tools/raid-stage45-art.py
"""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent.parent
src, out = root / 'assets_src/realm/raid', root / 'public/realm/raid'
W, H = Image.open(out / 'forest.webp').size
for sid, name in (('H47', 'snow'), ('H48', 'fortress')):
    im = Image.open(src / f'haebi-pack-v1-{sid}.png').convert('RGB')
    k = max(W / im.width, H / im.height)
    im = im.resize((round(im.width * k), round(im.height * k)), Image.Resampling.LANCZOS)
    x, y = (im.width - W) // 2, (im.height - H) // 2
    im.crop((x, y, x + W, y + H)).save(out / f'{name}.webp', quality=82, method=6)
    print(name, (W, H), (out / f'{name}.webp').stat().st_size)


def fit(im, size, pad):
    box = im.getchannel('A').point(lambda v: 255 if v > 10 else 0).getbbox()
    im = im.crop(box); im.thumbnail((size - pad * 2, size - pad * 2), Image.Resampling.LANCZOS)
    tile = Image.new('RGBA', (size, size)); tile.alpha_composite(im, ((size - im.width) // 2, (size - im.height) // 2)); return tile


h49 = Image.open(src / 'haebi-pack-v1-H49.png').convert('RGBA'); half = h49.width // 2
for i, name in enumerate(('snow', 'fortress')):
    t = fit(h49.crop((i * half, 0, (i + 1) * half, h49.height)), 128, 2)
    a = t.getchannel('A')
    assert a.getbbox() and not any(a.getpixel((x, y)) for x in (0, 127) for y in range(128)), name
    t.save(out / f'emblem-{name}.png', optimize=True)
    print('emblem', name, (out / f'emblem-{name}.png').stat().st_size)
