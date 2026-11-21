"""Codex 공격 8칸 판(4×2 · 민무늬 바탕)을 장수 띠의 공격 칸 12~17 에 넣는다 (형 11-21 「공격이 매끄럽지 못하다 · 동작마다 만들어야 하나」 · 명령 67-4).

  py -3 -I tools/sprite-kit/attack8-intake.py <띠이름> [...]          → 미리보기만 (<판 폴더>/check/attack8-<띠이름>.jpg · 위 = 옛 칸 · 아래 = 새 칸)
  py -3 -I tools/sprite-kit/attack8-intake.py --write <띠이름> [...]  → public/realm/anim-px/gen-<띠이름>.png 의 12~17 을 고쳐 씀
  --src <판 폴더> (기본 D:/에셋창고/codex67) · --map 2,3,4,5,6,7 (판 칸 번호 1~8 → 띠 칸 12~17)
  --widen jinha=48,ara=16 : 그 띠의 20칸을 모두 그만큼 넓힌다(양쪽 반씩 · 몸은 그대로 가운데) → manifest.json·spritePx.ts 의 칸 가로도 고침(--write 때)

판: <판 폴더>/attack8_<띠이름>.png · 칸 차례 윗줄 왼→오, 아랫줄 왼→오:
  1 서기 · 2 준비 · 3 젖힘(가장 높이) · 4 휘두름(잔상) · 5 맞힘 · 6 따라감 · 7 거둠 · 8 서기
띠 칸 역할(params HAEBI_ANIM.roles): 12 준비 · 13 젖힘(활은 메김) · 14 휘두름(활은 당김) · 15 맞힘(활은 놓음) · 16·17 거둠.
서기와 거의 같은 1·8 은 빼고 2~7 을 그대로 넣는다(기본 --map).

맞추는 법(걷기 walk8-intake.py 와 다름 · 화가가 그린 앞으로 나감을 살린다):
  배율 = 띠 서기 칸 0 의 키 / 판 1번 칸(서기)의 키 · 한 장 안의 모든 칸은 같은 배율.
  세로: 판의 줄마다 바닥선(그 줄 칸들의 발끝 가운데값)을 띠의 발 줄에 · 가로: 줄마다 서기 칸(윗줄 1 · 아랫줄 8)의 발 가운데를 띠 서기 칸 발 가운데에.
  그래서 칸마다 몸을 가운데로 다시 놓지 않는다(내디딘 걸음·내뻗은 팔이 그대로 앞으로 나간다).
옛 판은 git 기록에 남는다 → 커밋 뒤 py -I tools/retire-history.py.
"""
import importlib.util
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location('walk8_intake', os.path.join(HERE, 'walk8-intake.py'))
W8 = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(W8)

ROOT = W8.ROOT
FOLDER = 'public/realm/anim-px'
CELLS = list(range(12, 18))
FOOT_BAND = .12
POCKET_TOL, POCKET_MIN = 6, 30   # 잔상 호와 몸 사이에 갇힌 바탕(가장자리와 안 이어져 key_out 이 못 지운 곳) — 바탕색과 거의 같은 평평한 덩어리만


def drop_pockets(rgba, bg):
    from scipy import ndimage
    a = rgba.astype(np.int16)
    flat = (np.abs(a[:, :, :3] - bg).max(axis=2) <= POCKET_TOL) & (rgba[:, :, 3] > 0)
    lab, n = ndimage.label(flat)
    if n:
        size = ndimage.sum(flat, lab, range(1, n + 1))
        kill = np.isin(lab, np.nonzero(size >= POCKET_MIN)[0] + 1)
        rgba = rgba.copy(); rgba[kill, 3] = 0
    return rgba


def foot_of(arr):
    """알파 배열에서 발끝 줄(가장 아래 몸 줄)과 발 가운데 x."""
    m = arr[:, :, 3] > 64
    ys, xs = np.nonzero(m)
    y1 = int(ys.max()); h = y1 - int(ys.min()) + 1
    band = ys > y1 - h * FOOT_BAND
    return y1, float(xs[band].mean()), h


def sheet_cells(img):
    w, h = img.size
    cw, ch = w // 4, h // 2
    return [np.asarray(img.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch))).copy() for r in range(2) for c in range(4)]


def widen(strip, extra):
    """20칸을 모두 extra 만큼 넓힌다 (양쪽 반씩 · 칸 안 그림은 그대로 가운데)."""
    fw, h = strip.size[0] // 20, strip.size[1]
    nw = fw + extra; out = Image.new('RGBA', (nw * 20, h), (0, 0, 0, 0))
    for k in range(20):
        out.paste(strip.crop((k * fw, 0, (k + 1) * fw, h)), (k * nw + extra // 2, 0))
    return out


def build(key, src_dir, mapping, extra=0):
    src = os.path.join(src_dir, f'attack8_{key}.png')
    if not os.path.exists(src) or os.path.getsize(src) == 0:
        raise SystemExit(f'없음: {src}')
    img = Image.open(src).convert('RGBA')
    if not W8.has_alpha(img):
        a = np.asarray(img.convert('RGB')).astype(np.int16)
        bg = np.median(np.concatenate([a[:8, :8].reshape(-1, 3), a[:8, -8:].reshape(-1, 3), a[-8:, :8].reshape(-1, 3), a[-8:, -8:].reshape(-1, 3)]), axis=0)
        img = Image.fromarray(drop_pockets(np.asarray(W8.key_out(img)), bg))
    cells = sheet_cells(img)
    for i, c in enumerate(cells):
        if (c[:, :, 3] > 64).sum() < 200:
            raise SystemExit(f'{key}: 판 {i + 1}번 칸이 비었다')
    # 줄마다 바닥선(발끝 가운데값)과 서기 칸 발 가운데
    feet = [foot_of(c) for c in cells]
    base = [float(np.median([feet[i][0] for i in range(r * 4, r * 4 + 4)])) for r in range(2)]
    anchor = [feet[0][1], feet[7][1]]
    strip_p = os.path.join(ROOT, FOLDER, f'gen-{key}.png')
    strip = Image.open(strip_p).convert('RGBA')
    if extra:
        strip = widen(strip, extra)
    fw, h, ref_h, foot, cx = W8.idle_ref(strip)
    scale = ref_h / feet[0][2]
    out = strip.copy()
    clipped = []
    for cell_no, f in zip(CELLS, mapping):
        arr = cells[f - 1]; row = (f - 1) // 4
        im = Image.fromarray(arr)
        nw, nh = max(1, round(im.size[0] * scale)), max(1, round(im.size[1] * scale))
        g = im.resize((nw, nh), Image.BOX)
        # 판 칸 좌표 → 띠 칸 좌표: 줄의 기준점(서기 발 가운데, 바닥선)을 띠의 (cx, foot) 에
        ox = round(cx - anchor[row] * scale); oy = round(foot - base[row] * scale)
        a = np.asarray(g)[:, :, 3] > 64
        ys, xs = np.nonzero(a)
        lo, hi, top, bot = xs.min() + ox, xs.max() + ox, ys.min() + oy, ys.max() + oy
        sides = {'왼': max(0, -lo), '오': max(0, hi - (fw - 1)), '위': max(0, -top), '아래': max(0, bot - (h - 1))}
        if any(sides.values()):
            clipped.append(f'{cell_no}:' + '/'.join(f'{k}{v}' for k, v in sides.items() if v))
        cell = Image.new('RGBA', (fw, h), (0, 0, 0, 0))
        cell.paste(g, (ox, oy), g)
        out.paste(cell, (fw * cell_no, 0))
    return strip, out, scale, clipped, strip_p


def preview(key, old, new, check_dir):
    fw = old.size[0] // 20; h = old.size[1]
    pick = [0] + CELLS
    im = Image.new('RGBA', (fw * len(pick), h * 2 + 6), (30, 30, 30, 255))
    for y, s in ((0, old), (h + 6, new)):
        row = Image.new('RGBA', (fw * len(pick), h), (52, 58, 70, 255))
        for j, c in enumerate(pick):
            row.alpha_composite(s.crop((c * fw, 0, (c + 1) * fw, h)), (j * fw, 0))
        im.alpha_composite(row, (0, y))
    os.makedirs(check_dir, exist_ok=True)
    p = os.path.join(check_dir, f'attack8-{key}.jpg')
    im.convert('RGB').save(p, quality=90)
    return p


def set_cell_width(name, width):
    """manifest.json 의 칸 가로를 고치고 spritePx.ts 를 다시 쓴다(tools/sprite-kit/headgear.mjs 의 spritePxTs · 머리 장식 보정은 건드리지 않음)."""
    import json, subprocess
    man = os.path.join(ROOT, FOLDER, 'manifest.json')
    m = json.load(open(man, encoding='utf-8'))
    m[name]['cell'][0] = width
    with open(man, 'w', encoding='utf-8', newline='') as f:
        f.write(json.dumps(m, ensure_ascii=False, separators=(',', ':')))
    js = os.path.join(HERE, 'write-spritepx.mjs')
    subprocess.run(['node', js], cwd=ROOT, check=True)


def main():
    args = sys.argv[1:]
    write = '--write' in args
    src_dir = args[args.index('--src') + 1] if '--src' in args else 'D:/에셋창고/codex67'
    mapping = [int(n) for n in (args[args.index('--map') + 1] if '--map' in args else '2,3,4,5,6,7').split(',')]
    if len(mapping) != 6 or not all(1 <= n <= 8 for n in mapping):
        raise SystemExit('--map 은 1~8 사이 여섯 개')
    wid = dict((kv.split('=')[0], int(kv.split('=')[1])) for kv in (args[args.index('--widen') + 1].split(',') if '--widen' in args else []))
    skip = {src_dir, ','.join(map(str, mapping)), args[args.index('--widen') + 1] if '--widen' in args else None}
    keys = [a for a in args if not a.startswith('--') and a not in skip]
    if not keys:
        raise SystemExit(__doc__)
    for key in keys:
        extra = wid.get(key, 0)
        if extra % 2:
            raise SystemExit('--widen 은 짝수')
        old, new, scale, clipped, p = build(key, src_dir, mapping, extra)
        pv = preview(key, old, new, os.path.join(src_dir, 'check'))  # build 가 돌려준 old 는 이미 넓힌 띠
        if write:
            new.save(p, optimize=True)
            if extra:
                set_cell_width(f'gen-{key}', new.size[0] // 20)
        print(f'{key}: 배율 {scale:.3f} · 칸 밖으로 잘린 곳 {", ".join(clipped) or "없음"}' + (' · 씀' if write else '') + f' · {pv}')


if __name__ == '__main__':
    main()
