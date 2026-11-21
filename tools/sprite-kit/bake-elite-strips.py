"""열전 스테이지 정예 다섯(53-B · Codex 67) — 한 줄 20칸 원본을 게임 20칸 띠로 굽는다.
원본: assets_src/realm/raid/codex67/elite_<스테이지>.png (2172x724 · 한 줄에 20칸 · 오른쪽을 봄)
칸 차례(원본 그대로): 대기 0~3 · 걷기 4~11 · 공격 12~17(12 준비 · 13 들어 올림 · 14 내려침 · 15 따라감 · 16·17 마무리) · 맞음 18 · 쓰러짐 19
규칙(bake-raid-enemies.py 와 같음): 늘리거나 고쳐 그리지 않음 · 배율 1(원본 픽셀 그대로) · 발을 같은 바닥선에 ·
가로는 발 가운데, 걷기 칸(4~11)은 엉덩이 가운데 · 덩어리마다 가운데가 놓인 칸의 것으로.
칸 높이 144 · 발 줄 142 (무기를 머리 위로 든 칸까지 잘리지 않게 · 그만큼 화면 높이는 HAEBI_VIEW 의 eliteHeight 로 맞춤)
py -3 -I tools/sprite-kit/bake-elite-strips.py [--only ford,snow] [--sheet D:/에셋창고/codex67/check/elite-baked.jpg]
"""
import argparse
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'assets_src/realm/raid/codex67'
OUT = ROOT / 'public/realm/anim-px'
STAGES = ('forest', 'ford', 'palisade', 'snow', 'fortress')
CELLS, CELL_H, FEET, ALPHA, MIN_BLOB = 20, 144, 142, 24, 30
WALK = range(4, 12)
FOOT_BAND, HIP = .12, (.45, .65)


def frames(path):
    a = np.array(Image.open(path).convert('RGBA'))
    a[a[..., 3] < ALPHA, 3] = 0
    H, W = a.shape[:2]
    cw = W / CELLS
    labels, n = ndimage.label(a[..., 3] > 0, structure=np.ones((3, 3)))
    owner = np.full(n + 1, -1)
    for lab, reg in enumerate(ndimage.find_objects(labels), 1):
        if reg is None:
            continue
        ys, xs = np.nonzero(labels[reg] == lab)
        if len(ys) < MIN_BLOB:
            continue
        owner[lab] = min(CELLS - 1, int((xs.mean() + reg[1].start) // cw))
    out = []
    for k in range(CELLS):
        keep = owner[labels] == k
        if keep.sum() < 800:
            raise ValueError(f'{path.name} 칸 {k} 이 비었다')
        rgba = a.copy(); rgba[~keep] = 0
        ys, xs = np.nonzero(rgba[..., 3] > 64)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        if x0 < 1 or y0 < 1 or x1 > W - 1 or y1 > H - 1:
            raise ValueError(f'{path.name} 칸 {k} 이 원본 가장자리에 닿았다')
        h = y1 - y0
        if k == CELLS - 1:      # 쓰러짐: 누운 몸 가운데
            ax = (x0 + x1) / 2
        elif k in WALK:          # 걷기: 엉덩이 가운데 (보폭 때문에 몸이 흔들리지 않게)
            band = (ys >= y0 + h * HIP[0]) & (ys <= y0 + h * HIP[1])
            ax = float(xs[band].mean())
        else:                    # 대기·공격·맞음: 발 가운데
            ax = float(xs[ys > y1 - 1 - h * FOOT_BAND].mean())
        out.append((rgba[y0:y1, x0:x1], ax - x0, h))
    return out


def bake(stage, sheet_rows):
    src = SRC / f'elite_{stage}.png'
    fs = frames(src)
    half = max(max(ax, img.shape[1] - ax) for img, ax, _ in fs)
    cw = int(np.ceil(half * 2 + 4)); cw += cw % 2
    tall = max(h for _, _, h in fs)
    if tall > FEET:
        raise ValueError(f'{stage}: 가장 큰 칸 {tall}px 이 칸 높이를 넘는다')
    strip = Image.new('RGBA', (cw * CELLS, CELL_H), (0, 0, 0, 0))
    for k, (img, ax, h) in enumerate(fs):
        x = int(round(k * cw + cw / 2 - ax)); y = FEET - h
        strip.alpha_composite(Image.fromarray(img), (x, y))
    dst = OUT / f'elite-{stage}.png'
    strip.save(dst, optimize=True)
    print(f'{stage}: 칸 {cw}x{CELL_H} · 가장 큰 칸 {tall}px · 대기 몸 {fs[0][2]}px · {dst.relative_to(ROOT)} {dst.stat().st_size // 1024}KB')
    sheet_rows.append((stage, strip))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', default='')
    ap.add_argument('--sheet', default='')
    a = ap.parse_args()
    only = [s for s in a.only.split(',') if s] or STAGES
    rows = []
    for st in only:
        bake(st, rows)
    if a.sheet:
        W = max(r.size[0] for _, r in rows)
        sheet = Image.new('RGB', (W, (CELL_H + 16) * len(rows)), (70, 90, 60))
        d = ImageDraw.Draw(sheet)
        for i, (st, r) in enumerate(rows):
            y = i * (CELL_H + 16)
            d.text((2, y), st, fill=(255, 255, 0))
            sheet.paste(r, (0, y + 14), r)
            d.line([(0, y + 14 + FEET), (W, y + 14 + FEET)], fill=(255, 0, 0))
            cw = r.size[0] // CELLS
            for k in range(CELLS + 1):
                d.line([(k * cw, y + 14), (k * cw, y + 14 + CELL_H)], fill=(40, 60, 40))
        sheet.save(a.sheet, quality=90)
        print('sheet', a.sheet, sheet.size)


if __name__ == '__main__':
    main()
