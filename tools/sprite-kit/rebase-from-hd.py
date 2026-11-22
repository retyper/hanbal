"""2배 띠(gen-<띠이름>_hd.png)를 절반으로 줄여 기본 전투 띠(gen-<띠이름>.png · 칸 160)를 새로 만든다.
(형 11-22 79 판정 「4.5등신으로」 → Codex 83 이 몸을 다시 그렸다 · bake-hero-hd2.py 가 새 판으로 2배 띠를 굽고 → 이 도구가 기본 띠를 같은 그림으로)

  py -3 -I tools/sprite-kit/rebase-from-hd.py <띠이름> [...]           → 미리보기만 (D:/에셋창고/codex83/check/rebase-<띠이름>.jpg · 위 옛 띠 · 아래 새 띠)
  py -3 -I tools/sprite-kit/rebase-from-hd.py --write <띠이름> [...]   → public/realm/anim-px/gen-<띠이름>.png 를 새로 쓰고 manifest(칸 · 발 · 몸 키) · spritePx.ts 를 고친다

2배 띠의 칸 자리 표는 tools/sprite-kit/hero-hd2.json (cell · cols). 칸마다 BOX 로 정확히 절반 — 자리·발 줄이 2배 띠와 같은 기하다.
옛 띠는 git 기록에 남는다 → 커밋 뒤 py -I tools/retire-history.py 로 꺼내 둘 수 있다.
"""
import json
import os
import subprocess
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
PX = os.path.join(ROOT, 'public/realm/anim-px')
REG = os.path.join(HERE, 'hero-hd2.json')
CHECK = 'D:/에셋창고/codex83/check'


def cells_of_hd(key):
    reg = json.load(open(REG, encoding='utf-8'))
    meta = reg.get(key) or reg.get(f'gen-{key}')
    if meta is None:
        raise SystemExit(f'{key}: hero-hd2.json 에 없다 (bake-hero-hd2.py --write 먼저)')
    cw, ch = meta['cell']; cols = meta['cols']
    atlas = Image.open(os.path.join(PX, f'gen-{key}_hd.png')).convert('RGBA')
    return [atlas.crop(((i % cols) * cw, (i // cols) * ch, (i % cols + 1) * cw, (i // cols + 1) * ch)) for i in range(20)], cw, ch


def rebase(key):
    cells, cw, ch = cells_of_hd(key)
    fw, h = cw // 2, ch // 2
    out = Image.new('RGBA', (fw * 20, h), (0, 0, 0, 0))
    for i, c in enumerate(cells):
        out.paste(c.resize((fw, h), Image.BOX), (i * fw, 0))
    a = np.asarray(out.crop((0, 0, fw, h)))[:, :, 3] > 64
    ys = np.nonzero(a)[0]
    return out, fw, h, int(ys.max()) + 1, int(ys.max() - ys.min() + 1)


def preview(key, new):
    old_p = os.path.join(PX, f'gen-{key}.png')
    old = Image.open(old_p).convert('RGBA') if os.path.exists(old_p) else None
    rows = [r for r in (old, new) if r is not None]
    W = max(r.size[0] for r in rows); H = sum(r.size[1] + 6 for r in rows)
    im = Image.new('RGBA', (W, H), (40, 46, 56, 255)); y = 0
    for r in rows:
        im.alpha_composite(r, (0, y)); y += r.size[1] + 6
    os.makedirs(CHECK, exist_ok=True)
    p = os.path.join(CHECK, f'rebase-{key}.jpg')
    im.convert('RGB').save(p, quality=88)
    return p


def write(key, new, fw, h, feet, body):
    new.save(os.path.join(PX, f'gen-{key}.png'), optimize=True)
    man_p = os.path.join(PX, 'manifest.json')
    m = json.load(open(man_p, encoding='utf-8'))
    e = m.setdefault(f'gen-{key}', {'cells': 20, 'kind': 'general'})
    e['cell'] = [fw, h]; e['feet'] = feet; e['bodyPx'] = body; e.pop('bodyRaw', None); e.pop('colors', None)
    with open(man_p, 'w', encoding='utf-8', newline='') as f:
        f.write(json.dumps(m, ensure_ascii=False, separators=(',', ':')))
    # 머리 장식(관·깃털) 키를 다시 빼고 spritePx.ts 를 다시 쓴다
    subprocess.run(['node', os.path.join(HERE, 'headgear.mjs')], cwd=ROOT, check=True)


def main():
    args = sys.argv[1:]
    do = '--write' in args
    keys = [a for a in args if not a.startswith('--')]
    if not keys:
        raise SystemExit(__doc__)
    for key in keys:
        new, fw, h, feet, body = rebase(key)
        pv = preview(key, new)
        if do:
            write(key, new, fw, h, feet, body)
        print(f'{key}: 칸 {fw}x{h} · 발 {feet} · 몸 키 {body}' + (' · 씀' if do else '') + f' · {pv}')


if __name__ == '__main__':
    main()
