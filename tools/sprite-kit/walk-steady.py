"""걷기 칸 무게중심 바로잡기 (형 11-22 「프레임마다 인물의 무게중심이 흔들린다 · 테일즈위버처럼 자연스럽게」).

까닭: walk8-intake.place · bake-hero-hd2 가 걷기 칸마다 **그림 상자의 가운데**를 서기 칸 가운데에 맞췄다.
다리가 앞으로 뻗거나 무기가 나가면 상자가 한쪽으로 넓어져 → 몸통이 칸마다 옆으로 밀린다 (11-22 잰 값: 258 띠 중 77 띠가 한 칸에 머리가 몸 키 3% 넘게 뜀).
고침: 걷기 칸(4~11)마다 **윗몸(머리~어깨 · 위 45%)**이 서기 칸 0 의 윗몸과 가장 잘 겹치는 가로 이동량을 찾아 그만큼 민다. 발 줄·세로는 그대로.
기본 띠(gen-<띠>.png)와 2배 띠(gen-<띠>_hd.png · hero-hd2.json 칸 표)를 같은 셈으로 따로 맞춘다.

  py -3 -I tools/sprite-kit/walk-steady.py <띠 ...> | --all          → 재기만 (전·후 한 칸 최대 머리 이동 %)
  py -3 -I tools/sprite-kit/walk-steady.py --write <띠 ...> | --all  → 고쳐 쓴다
"""
import glob
import hashlib
import json
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
PX = os.path.join(ROOT, 'public/realm/anim-px')
REG = os.path.join(HERE, 'hero-hd2.json')
UPPER = 0.45     # 윗몸 = 몸 위 45% (머리 · 어깨 · 가슴)
SKIP_TOP = 0.04  # 맨 위 4% 는 뺀다 (깃털 · 상투 끝이 흔들린다)
MAX_SHIFT = 0.12  # 몸 키의 12% 넘게는 밀지 않는다 (그 이상이면 다른 문제)
WALK = range(4, 12)


def alpha(cell):
    return np.asarray(cell)[:, :, 3].astype(np.float32) / 255.0


def body_box(a):
    ys, xs = np.nonzero(a > 0.25)
    return (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1) if len(ys) else None


def upper_mask(a, top, bh):
    m = np.zeros_like(a)
    y0, y1 = int(top + bh * SKIP_TOP), int(top + bh * UPPER)
    m[y0:y1] = a[y0:y1]
    return m


def best_dx(ref, a, top, bh):
    """ref(서기 윗몸)와 a(걷기 윗몸)가 가장 많이 겹치는 가로 이동 · 넘침 없이 · 동률이면 0 에 가까운 쪽"""
    r = upper_mask(ref, top, bh)
    m = upper_mask(a, top, bh)
    lim = max(1, int(bh * MAX_SHIFT))
    best, bd = -1.0, 0
    for dx in range(-lim, lim + 1):
        s = np.roll(m, dx, axis=1)
        if dx > 0:
            s[:, :dx] = 0
        elif dx < 0:
            s[:, dx:] = 0
        sc = float(np.minimum(s, r).sum()) - 1e-3 * abs(dx)
        if sc > best:
            best, bd = sc, dx
    return bd


def shift_cell(cell, dx):
    if dx == 0:
        return cell, 0
    a = np.asarray(cell)
    out = np.zeros_like(a)
    if dx > 0:
        out[:, dx:] = a[:, :-dx]
        lost = int((a[:, -dx:, 3] > 25).sum())
    else:
        out[:, :dx] = a[:, -dx:]
        lost = int((a[:, :-dx, 3] > 25).sum())
    return Image.fromarray(out), lost


def head_jump(cells):
    """한 칸 사이 머리(위 30%) 가로 이동 최대 · 몸 키 대비 %"""
    a0 = alpha(cells[0]); b = body_box(a0)
    bh = b[3] - b[1]
    xs = []
    for i in WALK:
        a = alpha(cells[i]); bb = body_box(a)
        if bb is None:
            return 0.0
        cut = bb[1] + (bb[3] - bb[1]) * 0.3
        ys, x = np.nonzero(a > 0.25)
        xs.append(x[ys <= cut].mean())
    d = np.abs(np.diff(xs + [xs[0]]))
    return 100 * d.max() / bh


def fix_cells(cells):
    ref = alpha(cells[0]); b = body_box(ref)
    top, bh = b[1], b[3] - b[1]
    out = list(cells)
    lost_all = 0
    for i in WALK:
        dx = best_dx(ref, alpha(cells[i]), top, bh)
        out[i], lost = shift_cell(cells[i], dx)
        lost_all += lost
    return out, lost_all


def strip_cells(img):
    fw = img.size[0] // 20
    return [img.crop((i * fw, 0, (i + 1) * fw, img.size[1])) for i in range(20)], fw


def atlas_cells(img, cw, ch, cols):
    return [img.crop(((i % cols) * cw, (i // cols) * ch, (i % cols + 1) * cw, (i // cols + 1) * ch)) for i in range(20)]


def run(key, write, reg):
    p = os.path.join(PX, f'gen-{key}.png')
    img = Image.open(p).convert('RGBA')
    cells, fw = strip_cells(img)
    before = head_jump(cells)
    fixed, lost = fix_cells(cells)
    after = head_jump(fixed)
    note = ''
    if write and after < before:
        out = img.copy()
        for i in WALK:
            out.paste(fixed[i], (i * fw, 0))
        out.save(p, optimize=True)
        note = ' 씀'
    hd = reg.get(key)
    hp = os.path.join(PX, f'gen-{key}_hd.png')
    if hd and os.path.exists(hp):
        (cw, ch), cols = hd['cell'], hd['cols']
        himg = Image.open(hp).convert('RGBA')
        hc = atlas_cells(himg, cw, ch, cols)
        hb = head_jump(hc)
        hf, hl = fix_cells(hc)
        ha = head_jump(hf)
        if write and ha < hb:
            out = himg.copy()
            for i in WALK:
                out.paste(hf[i], ((i % cols) * cw, (i // cols) * ch))
            out.save(hp, optimize=True)
            hd['sha256'] = hashlib.sha256(open(hp, 'rb').read()).hexdigest()   # tests/raid-hd 가 sha 로 판을 잠근다
            hd['bytes'] = os.path.getsize(hp)
        note += f' · hd {hb:.1f}→{ha:.1f}%' + (f' (잘림 {hl}px)' if hl else '')
    print(f'{key}: {before:.1f}→{after:.1f}%' + (f' (잘림 {lost}px)' if lost else '') + note)
    return before, after


def main():
    args = sys.argv[1:]
    write = '--write' in args
    keys = [a for a in args if not a.startswith('--')]
    if '--all' in args:
        keys = sorted(os.path.basename(p)[4:-4] for p in glob.glob(os.path.join(PX, 'gen-*.png'))
                      if not p.endswith('_hd.png') and Image.open(p).size[0] % 20 == 0)
    if not keys:
        raise SystemExit(__doc__)
    reg = json.load(open(REG, encoding='utf-8'))
    res = [run(k, write, reg) for k in keys]
    if write:
        with open(REG, 'w', encoding='utf-8', newline='\n') as f:
            json.dump(reg, f, ensure_ascii=False, indent=1); f.write('\n')
    b = [r[0] for r in res]; a = [r[1] for r in res]
    print(f'띠 {len(res)} · 3% 넘는 띠 {sum(x > 3 for x in b)} → {sum(x > 3 for x in a)} · 가운데값 {np.median(b):.1f} → {np.median(a):.1f}%')


if __name__ == '__main__':
    main()
