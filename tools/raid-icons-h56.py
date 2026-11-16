"""열전 돌팔매·갈래 끝 아이콘 (release-jobs H56~H61 · 11-17) 을 열전 그림으로 굽는다.
  H56 돌팔매 → raid/power-sling.png · H57 물수제비 → raid/power-skip.png
  H58 (3×1) → raid/boulder.png · daze.png · stonefall.png (조합 둘 + 비기 「돌벼락」 문양)
  H59 (3×2) → raid/cap-axe-a … cap-spear-b · H60 (3×2) → raid/cap-sword-a … cap-magic-b
  H61 (3×2) → raid/cap-sling-a · cap-sling-b · node-counter · node-hone · node-drill (6번 칸은 빈 칸)
원본: D:/에셋창고/haebi-pack-v1-H5x.png 를 assets_src/realm/raid/ 로 **복사**만 한다 (없을 때만 · --refresh 면 덮어씀 · 에셋창고는 손대지 않는다).
아직 안 온 묶음은 건너뛴다. 구운 뒤 src/raid/icon-ready.ts (있는 그림 이름 목록)를 다시 쓴다 — power-ui.ts 가 그걸 보고 빌린 그림 대신 전용 그림을 쓴다.
크기·여백은 raid-kit-art.py 와 같다 (능력·조합 96px · 여백 3).  다시 굽기: py -3 -I tools/raid-icons-h56.py [--refresh]"""
import shutil
import sys
from pathlib import Path

import numpy as np
from PIL import Image

root = Path(__file__).resolve().parent.parent
store = Path('D:/에셋창고')
src, out = root / 'assets_src/realm/raid', root / 'public/realm/raid'
ready_ts = root / 'src/raid/icon-ready.ts'
refresh = '--refresh' in sys.argv

SHEETS = {
    'H56': (1, 1, ['power-sling']),
    'H57': (1, 1, ['power-skip']),
    'H58': (3, 1, ['boulder', 'daze', 'stonefall']),
    'H59': (3, 2, ['cap-axe-a', 'cap-axe-b', 'cap-bow-a', 'cap-bow-b', 'cap-spear-a', 'cap-spear-b']),
    'H60': (3, 2, ['cap-sword-a', 'cap-sword-b', 'cap-dagger-a', 'cap-dagger-b', 'cap-magic-a', 'cap-magic-b']),
    'H61': (3, 2, ['cap-sling-a', 'cap-sling-b', 'node-counter', 'node-hone', 'node-drill', None]),
    'H61b': (1, 1, ['node-counter']),   # 11-17 H61 의 되받아치기가 햇살 꼴이라 다시 — 있으면 덮는다
}
ALL = list(dict.fromkeys(n for _, _, names in SHEETS.values() for n in names if n))


def fit(im, size, pad):
    """알파 둘레로 잘라 size 네모 가운데에 (raid-kit-art.py 와 같은 틀)"""
    box = im.getchannel('A').point(lambda v: 255 if v > 10 else 0).getbbox()
    im = im.crop(box); im.thumbnail((size - pad * 2, size - pad * 2), Image.Resampling.LANCZOS)
    tile = Image.new('RGBA', (size, size)); tile.alpha_composite(im, ((size - im.width) // 2, (size - im.height) // 2)); return tile


def cell_ok(cell, name):
    """칸 테두리에 그림이 걸쳐 있으면(옆 칸으로 넘침 · 잘림) 멈춘다 · 빈 칸이면 멈춘다"""
    a = np.array(cell.getchannel('A'))
    if a.max() <= 10:
        raise SystemExit(f'{name}: 빈 칸')
    edge = max(a[0].max(), a[-1].max(), a[:, 0].max(), a[:, -1].max())
    if edge > 40:
        raise SystemExit(f'{name}: 칸 가장자리에 그림이 걸침 (알파 {edge}) · 칸 나누기를 손봐야 한다')


done = []
for sid, (cols, rows, names) in SHEETS.items():
    file = f'haebi-pack-v1-{sid}.png'
    if (store / file).exists() and (refresh or not (src / file).exists()):
        shutil.copy2(store / file, src / file)
        print('복사', file)
    if not (src / file).exists():
        print('건너뜀 (아직 안 옴)', sid)
        continue
    im = Image.open(src / file).convert('RGBA')
    w, h = im.width // cols, im.height // rows
    for i, name in enumerate(names):
        cell = im.crop((i % cols * w, i // cols * h, (i % cols + 1) * w, (i // cols + 1) * h))
        if name is None:
            continue
        cell_ok(cell, name)
        tile = fit(cell, 96, 3)
        tile.save(out / f'{name}.png', optimize=True)
        done.append(name)
        print(sid, name, (out / f'{name}.png').stat().st_size)

have = [n for n in ALL if (out / f'{n}.png').exists()]
body = ''.join(f"  '{n}',\n" for n in have)
with open(ready_ts, 'w', encoding='utf-8', newline='\n') as f:
    f.write('// tools/raid-icons-h56.py 가 쓴다 · 손으로 고치지 말 것. public/realm/raid/<이름>.png 로 구워 둔 전용 아이콘(H56~H61).\n'
            '// power-ui.ts 는 여기 있는 것만 전용 그림으로 쓰고, 없는 것은 빌린 그림(빛깔)로 둔다.\n'
            f'export const ICON_READY: ReadonlySet<string> = new Set([\n{body}])\n')
print('icon-ready', len(have), '/', len(ALL))
