"""Codex 걷기 8칸 판(4×2 · 민무늬 바탕)을 장수 띠의 걷기 칸 4~11 에 넣는다.

  py -3 -I tools/sprite-kit/walk8-intake.py <띠이름> [...]          → 미리보기만 (D:/에셋창고/codex67/check/)
  py -3 -I tools/sprite-kit/walk8-intake.py --write <띠이름> [...]  → public/realm/anim2 · anim-px 의 gen-<띠이름>.png 를 고쳐 씀

판: D:/에셋창고/codex67/walk8_<띠이름>.png (칸 순서 = 윗줄 왼→오, 아랫줄 왼→오)
배율과 발 높이는 그 띠의 서기 칸 0 에 맞춘다(키 = 서기 칸 키, 발끝 = 서기 칸 발끝, 가운데 = 서기 칸 가운데).
옛 판은 git 기록에 남는다 → 커밋 뒤 py -I tools/retire-history.py 로 assets_src/realm/retired 에 꺼내 둔다.
"""
import os
import sys
from collections import deque

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = 'D:/에셋창고/codex67'
CHECK = os.path.join(SRC, 'check')
FOLDERS = ('public/realm/anim-px',)   # anim2 는 옛 옷인 띠가 있어(감실 등) 열전이 쓰는 anim-px 에만 넣는다
TOL = 30          # 바탕 색과 이만큼 안쪽이면 바탕 (채널 최대 차)
MIN_AREA = 60     # 이보다 작은 덩어리는 티끌로 버림


def key_out(img):
    """가장자리에서 이어진 바탕만 투명으로 (머리카락 같은 몸 안 어두운 곳은 남김)."""
    a = np.asarray(img.convert('RGB')).astype(np.int16)
    h, w, _ = a.shape
    corners = np.concatenate([a[:8, :8].reshape(-1, 3), a[:8, -8:].reshape(-1, 3), a[-8:, :8].reshape(-1, 3), a[-8:, -8:].reshape(-1, 3)])
    bg = np.median(corners, axis=0)
    near = np.abs(a - bg).max(axis=2) <= TOL
    seen = np.zeros((h, w), bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if near[y, x] and not seen[y, x]:
                seen[y, x] = True; q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if near[y, x] and not seen[y, x]:
                seen[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and near[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True; q.append((ny, nx))
    rgba = np.dstack([a.astype(np.uint8), np.where(seen, 0, 255).astype(np.uint8)])
    return Image.fromarray(rgba)


def bbox(alpha, min_area=MIN_AREA):
    """알파 덩어리 가운데 큰 것들만 모아 상자 (티끌 무시)."""
    m = alpha > 0
    ys, xs = np.nonzero(m)
    if len(ys) == 0:
        return None
    # 줄·칸 투영으로 티끌 걸러 내기: 행·열 합이 너무 작은 가장자리는 깎는다
    rows = m.sum(axis=1); cols = m.sum(axis=0)
    r = np.nonzero(rows >= 2)[0]; c = np.nonzero(cols >= 2)[0]
    if len(r) == 0 or len(c) == 0 or m.sum() < min_area:
        return None
    return int(c[0]), int(r[0]), int(c[-1]) + 1, int(r[-1]) + 1


def cells_of(sheet, cols=4, rows=2):
    """칸 순서는 윗줄 왼→오부터 · 앞에서 8칸만 (3×3 판의 9번 빈칸은 버림)."""
    w, h = sheet.size
    cw, ch = w // cols, h // rows
    out = []
    for row in range(rows):
        for col in range(cols):
            if len(out) == 8:
                return out
            cell = sheet.crop((col * cw, row * ch, (col + 1) * cw, (row + 1) * ch))
            b = bbox(np.asarray(cell)[:, :, 3])
            if b is None:
                raise SystemExit(f'빈 칸: {row},{col}')
            out.append(cell.crop(b))
    return out


def has_alpha(img):
    return img.mode == 'RGBA' and np.asarray(img)[:, :, 3].min() < 250


def idle_ref(strip):
    w, h = strip.size
    fw = w // 20
    cell = strip.crop((0, 0, fw, h))
    b = bbox(np.asarray(cell)[:, :, 3])
    if b is None:
        raise SystemExit('서기 칸 0 이 비었다')
    x0, y0, x1, y1 = b
    return fw, h, y1 - y0, y1, (x0 + x1) / 2


def place(strip, frames, resample):
    fw, h, ref_h, foot, cx = idle_ref(strip)
    scale = ref_h / float(np.median([f.size[1] for f in frames]))
    out = strip.copy()
    clear = Image.new('RGBA', (fw * 8, h), (0, 0, 0, 0))
    out.paste(clear, (fw * 4, 0))
    for i, f in enumerate(frames):
        nw, nh = max(1, round(f.size[0] * scale)), max(1, round(f.size[1] * scale))
        g = f.resize((nw, nh), resample)
        x = fw * (4 + i) + round(cx - nw / 2)
        y = round(foot - nh)
        # 칸 밖으로 넘치는 쪽은 잘라 다른 칸을 침범하지 않게
        cell = Image.new('RGBA', (fw, h), (0, 0, 0, 0))
        cell.paste(g, (round(cx - nw / 2), y), g)   # paste 는 칸 밖을 알아서 자른다
        out.paste(cell, (fw * (4 + i), 0))
    return out, scale


def preview(key, strips):
    """서기 0 · 걷기 4~11 을 위아래(anim2 · anim-px)로 · 체크 무늬 바탕."""
    rows = []
    for s in strips:
        fw = s.size[0] // 20
        pick = [0] + list(range(4, 12))
        row = Image.new('RGBA', (fw * len(pick), s.size[1]), (52, 58, 70, 255))
        for j, c in enumerate(pick):
            row.alpha_composite(s.crop((c * fw, 0, (c + 1) * fw, s.size[1])), (j * fw, 0))
        rows.append(row)
    W = max(r.size[0] for r in rows); H = sum(r.size[1] for r in rows)
    im = Image.new('RGBA', (W, H), (30, 30, 30, 255)); y = 0
    for r in rows:
        im.alpha_composite(r, (0, y)); y += r.size[1]
    os.makedirs(CHECK, exist_ok=True)
    im.convert('RGB').save(os.path.join(CHECK, f'walk8-{key}.jpg'), quality=88)


def main():
    # --sheet <판 경로> --grid 3x3 : 다른 이름·다른 판 꼴 한 장 (예: 매화 각성 3×3 투명 판 → gen-aw1-maehwa)
    args = sys.argv[1:]
    write = '--write' in args
    sheet = args[args.index('--sheet') + 1] if '--sheet' in args else None
    grid = args[args.index('--grid') + 1] if '--grid' in args else '4x2'
    skip = {sheet, grid}
    keys = [a for a in args if not a.startswith('--') and a not in skip]
    if not keys:
        raise SystemExit(__doc__)
    cols, rows = (int(n) for n in grid.split('x'))
    for key in keys:
        src = sheet or os.path.join(SRC, f'walk8_{key}.png')
        if not os.path.exists(src) or os.path.getsize(src) == 0:
            print(f'없음: {src}'); continue
        img = Image.open(src).convert('RGBA')
        frames = cells_of(img if has_alpha(img) else key_out(img), cols, rows)
        made = []
        for folder in FOLDERS:
            p = os.path.join(ROOT, folder, f'gen-{key}.png')
            if not os.path.exists(p):
                print(f'  띠 없음: {p}'); continue
            strip = Image.open(p).convert('RGBA')
            # anim2 는 매끈한 원본 · anim-px 는 도트 규격이라 가장 가까운 점으로
            resample = Image.LANCZOS if folder.endswith('anim2') else Image.BOX
            new, scale = place(strip, frames, resample)
            made.append(new)
            if write:
                new.save(p, optimize=True)
            print(f'  {folder}/gen-{key}.png 배율 {scale:.3f}' + (' 씀' if write else ''))
        if made:
            preview(key, made)
    print(f'미리보기: {CHECK}')


if __name__ == '__main__':
    main()
