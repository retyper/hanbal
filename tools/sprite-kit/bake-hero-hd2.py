"""확대 고해상도 2배 띠 (53-A 넓히기 · Codex 75 · 형 「열전에서 확대했을 때 내 캐릭은 해상도 괜찮게」).

지금 띠 public/realm/anim-px/gen-<띠이름>.png 와 **같은 칸 순서 · 같은 발 줄 · 정확히 2배 기하**의 판을 고해상도 원본에서 굽는다 → gen-<띠이름>_hd.png
  칸 0~3 서기 = 보충 판(codex75 hdx_<띠이름>.png · 3×2) 1~4 · 4~11 걷기 = 걷기 8칸 판(codex71 > 68 > 67) 1~8 ·
  12~17 공격 = 공격 8칸 판(codex73 > 71 > 70 > 67) 2~7 · 18 맞음 = 보충 5 · 19 쓰러짐 = 보충 6
맞추는 법 (띠를 만든 셈 그대로 × 2 — 확대해도 자리·크기가 띠와 같다):
  기준 = 띠 서기 칸 0 의 몸 키 ref_h · 가운데 cx · 발 줄 foot (walk8-intake.idle_ref).
  걷기: 배율 = 2·ref_h ÷ 걷기 판 키 가운데값 · 칸마다 몸 상자 가운데를 2·cx 에, 바닥을 2·foot 에 (walk8-intake.place 와 같음).
  공격: 배율 = 2·ref_h ÷ 공격 판 1번 칸 키 · 줄마다 서기 칸(1·8)의 발 가운데와 바닥선을 (2·cx, 2·foot) 에 (attack8-intake.build 와 같음).
  보충: 배율 = 2·ref_h ÷ 보충 판 1번 칸 키 · 줄마다 서기 칸(1·4)의 발 가운데와 바닥선을 (2·cx, 2·foot) 에 — 숨쉬기 넷이 떨리지 않고 맞음의 젖힘·쓰러짐 자리가 화가 그대로.
원본 픽셀은 줄이기만 한다(30% 넘게 늘려야 하면 그 장수는 건너뜀 · 160 띠는 쓰지 않음). 판 가로는 4096 안으로 접는다(열 수 = 4096 ÷ 칸 가로).
  py -3 -I tools/sprite-kit/bake-hero-hd2.py <띠이름> [...]           → 미리보기만 (D:/에셋창고/codex75/check/hd-<띠이름>.jpg)
  py -3 -I tools/sprite-kit/bake-hero-hd2.py --write <띠이름> [...]   → gen-<띠이름>_hd.png + src/raid/hero-hd.ts 등록 + tools/sprite-kit/hero-hd2.json
"""
import importlib.util
import json
import os
import re
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
def _load(name, file):
    spec = importlib.util.spec_from_file_location(name, os.path.join(HERE, file)); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m
W8 = _load('walk8_intake', 'walk8-intake.py')
A8 = _load('attack8_intake', 'attack8-intake.py')

ROOT = W8.ROOT
PX = os.path.join(ROOT, 'public/realm/anim-px')
STORE = 'D:/에셋창고'
WALK_SRC = ('codex76', 'codex71', 'codex68', 'codex67')   # 76 = 확대 전용 걷기(띠 걷기가 옛 길이라 고해상도 판이 없던 장수)
ATTACK_SRC = ('codex73', 'codex71', 'codex70', 'codex67')
HDX_SRC = ('codex78', 'codex75')   # 78 = 나머지 224장 (11-22 형 「다 시켜」)
ATLAS_MAX = 4096
SCALE, CELL_H = 2, 320
UPSCALE_MAX = 1.3    # Codex 고해상도 판(칸 ~440px)은 2배 띠와 거의 같은 크기라 15% 안 늘림은 흐림이 거의 보이지 않는다(각성 소서노 1.16 · 진하 1.21 · 아라 1.26 처럼 공격·걷기 판 인물이 작은 장수가 있다 · 배율은 hero-hd2.json 에 남아 나중에 큰 원본을 다시 받을 장수를 고를 수 있다) · 160 띠를 2배로 늘리는 것과 다르다(그건 금지)
REGISTRY = os.path.join(HERE, 'hero-hd2.json')
HD_TS = os.path.join(ROOT, 'src/raid/hero-hd.ts')


def find(prefix, key, folders):
    for f in folders:
        p = os.path.join(STORE, f, f'{prefix}_{key}.png')
        if os.path.exists(p) and os.path.getsize(p) > 0:
            return p
    raise SystemExit(f'{key}: {prefix} 원본 없음 ({", ".join(folders)})')


def keyed(path):
    img = Image.open(path).convert('RGBA')
    return img if W8.has_alpha(img) else W8.key_out(img)


def grid(img, cols, rows):
    w, h = img.size; cw, ch = w // cols, h // rows
    return [np.asarray(img.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch))).copy() for r in range(rows) for c in range(cols)]


def put(canvas_cell, arr, scale, ox, oy):
    """arr(칸 좌표) 를 scale 로 줄여 (ox, oy) 에 놓는다 · 칸 밖으로 나간 px 수를 돌려준다."""
    im = Image.fromarray(arr)
    if scale > UPSCALE_MAX:
        raise SystemExit(f'배율 {scale:.3f} > {UPSCALE_MAX} · 원본이 작아 크게 늘려야 한다(금지)')
    nw, nh = max(1, round(im.size[0] * scale)), max(1, round(im.size[1] * scale))
    g = im.resize((nw, nh), Image.LANCZOS)
    a = np.asarray(g)[:, :, 3] > 64
    ys, xs = np.nonzero(a)
    lost = 0
    if len(xs):
        W, H = canvas_cell.size
        lo, hi, top, bot = xs.min() + ox, xs.max() + ox, ys.min() + oy, ys.max() + oy
        lost = max(0, -lo) + max(0, hi - (W - 1)) + max(0, -top) + max(0, bot - (H - 1))
    canvas_cell.paste(g, (ox, oy), g)
    return lost


WALK_FALLBACK_MAX = 1.45   # 옛 걷기 원본(prop 판 · 인물 ~235px)은 2배 띠보다 작다 · 띠 걷기와 같은 그림이라 확대·축소 때 걸음이 그대로고, 160 띠를 2배로 늘린 것보다 훨씬 또렷하다
FULL20 = None


def report_walk(key, strip, frames, lost, fw, foot):
    """repairs/20261113/<key>-report.json 의 걷기 판에서 띠 걷기 칸(4~11)을 만든 셈(bake-full20: 몸 덩어리 가로 무게중심을 칸 가운데 · 바닥 156)을 2배로.
    배율은 칸마다 (띠 칸 몸 상자 키 ÷ 원본 조각 몸 상자 키) 의 가운데값 × 2 · 띠 2배와 몸 상자가 3px 넘게 어긋나면 멈춘다."""
    global FULL20
    if FULL20 is None:
        FULL20 = _load('bake_full20', 'bake-full20.py')
    rp = os.path.join(HERE, 'repairs/20261113', f'{key}-report.json')
    if not os.path.exists(rp):
        raise SystemExit(f'{key}: walk8 원본도 보고서도 없음')
    rep = json.load(open(rp, encoding='utf-8'))
    walk_src = [p for p in rep.get('sources', {}) if 'walk' in os.path.basename(p)]
    if len(walk_src) != 1:
        raise SystemExit(f'{key}: 보고서에 걷기 판이 하나가 아님 {walk_src}')
    wpath = os.path.join(ROOT, walk_src[0])
    im, labels, pieces = FULL20.figures(wpath, 4, 2)
    if set(pieces) != set(range(8)):
        raise SystemExit(f'{key}: 걷기 판 사람 수 {sorted(pieces)}')
    from scipy import ndimage
    a = np.array(im)
    raw = []
    for i in range(8):
        mask = np.isin(labels, pieces[i]); ys, xs = np.nonzero(mask)
        box = [int(xs.min()), int(ys.min()), int(xs.max() + 1), int(ys.max() + 1)]
        rgba = a.copy(); rgba[~ndimage.binary_dilation(mask, iterations=2), 3] = 0
        raw.append((rgba[box[1]:box[3], box[0]:box[2]], box, float(xs.mean()), int(ys.max() - ys.min() + 1)))
    poses = [rep['frames'][c]['walkPose'] - 1 for c in range(4, 12)]
    base = np.asarray(strip)
    ratios = []
    for c, p in zip(range(4, 12), poses):
        al = base[:, c * fw:(c + 1) * fw, 3] > 64
        ys = np.nonzero(al.any(1))[0]
        ratios.append((ys[-1] - ys[0] + 1) / raw[p][3])
    s = SCALE * float(np.median(ratios))
    if s > WALK_FALLBACK_MAX:
        raise SystemExit(f'{key}: 옛 걷기 원본 배율 {s:.3f} > {WALK_FALLBACK_MAX}')
    W = frames[0].size[0]
    for c, p in zip(range(4, 12), poses):
        arr, box, mx, _ = raw[p]
        im2 = Image.fromarray(arr)
        g = im2.resize((max(1, round(im2.size[0] * s)), max(1, round(im2.size[1] * s))), Image.LANCZOS)
        # 띠: x = 칸 가운데 − (무게중심 − 상자 왼끝)·배율 · y = 156 − 키 (bake-full20) → 2배
        x = round(W / 2 - (mx - box[0]) * s); y = SCALE * foot - g.size[1] if foot == 156 else round(SCALE * 156 - g.size[1])
        cell = frames[c]; cell.paste(g, (x, y), g)
        hb = np.nonzero(np.asarray(cell)[:, :, 3] > 64); bb = np.nonzero(base[:, c * fw:(c + 1) * fw, 3] > 64)
        delta = [int(hb[1].min()) - 2 * int(bb[1].min()), int(hb[0].min()) - 2 * int(bb[0].min()), int(hb[1].max()) - 2 * int(bb[1].max()), int(hb[0].max()) - 2 * int(bb[0].max())]
        if max(abs(v) for v in delta) > 6:
            raise SystemExit(f'{key}: 걷기 칸 {c} 이 띠 2배와 {delta} px 어긋남')
        lost[c] = 0
    return round(s, 4), os.path.relpath(wpath, ROOT).replace('\\', '/')


def build(key):
    base_p = os.path.join(PX, f'gen-{key}.png')
    strip = Image.open(base_p).convert('RGBA')
    fw, h, ref_h, foot, cx = W8.idle_ref(strip)
    if h != 160:
        raise SystemExit(f'{key}: 띠 칸 높이 {h} (160 이 아님)')
    cw, ch = fw * SCALE, CELL_H
    frames = [Image.new('RGBA', (cw, ch), (0, 0, 0, 0)) for _ in range(20)]
    lost = {}
    src = {}

    # 걷기 4~11 (walk8-intake.place × 2) · Codex 걷기 판이 없으면 띠 걷기를 구운 옛 원본(repairs 보고서의 걷기 판)을 같은 셈 × 2 로
    try:
        wp = find('walk8', key, WALK_SRC)
    except SystemExit:
        wp = None
    if wp is not None:
        src['walk'] = wp
        wc = W8.cells_of(keyed(wp), 4, 2)
        ws = SCALE * ref_h / float(np.median([f.size[1] for f in wc]))
        for i, f in enumerate(wc):
            arr = np.asarray(f)
            nw, nh = max(1, round(f.size[0] * ws)), max(1, round(f.size[1] * ws))
            lost[4 + i] = put(frames[4 + i], arr, ws, round(SCALE * cx - nw / 2), round(SCALE * foot - nh))
    else:
        ws, src['walk'] = report_walk(key, strip, frames, lost, fw, foot)

    # 공격 12~17 (attack8-intake.build × 2 · 판 2~7)
    ap = find('attack8', key, ATTACK_SRC); src['attack'] = ap
    acells = A8.sheet_cells(keyed(ap))
    afeet = [A8.foot_of(c) for c in acells]
    abase = [float(np.median([afeet[i][0] for i in range(r * 4, r * 4 + 4)])) for r in range(2)]
    aanchor = [afeet[0][1], afeet[7][1]]
    as_ = SCALE * ref_h / afeet[0][2]
    for cell_no, f in zip(range(12, 18), range(2, 8)):
        row = (f - 1) // 4
        lost[cell_no] = put(frames[cell_no], acells[f - 1], as_, round(SCALE * cx - aanchor[row] * as_), round(SCALE * foot - abase[row] * as_))

    # 보충 0~3 · 18 · 19 (서기 칸 1·4 를 줄마다 기준으로)
    hp = find('hdx', key, HDX_SRC); src['hdx'] = hp
    hcells = grid(keyed(hp), 3, 2)
    for i, c in enumerate(hcells):
        if (c[:, :, 3] > 64).sum() < 200:
            raise SystemExit(f'{key}: 보충 판 {i + 1}번 칸이 비었다')
    hfeet = [A8.foot_of(c) for c in hcells]
    hs = SCALE * ref_h / hfeet[0][2]
    rows = [(0, (0, 1, 2)), (3, (3, 4, 5))]   # 줄의 서기 칸 · 그 줄 칸들
    place = {0: 0, 1: 1, 2: 2, 3: 3, 4: 18, 5: 19}  # 보충 칸(0부터) → 띠 칸
    for idle_i, members in rows:
        ay, ax = hfeet[idle_i][0], hfeet[idle_i][1]
        for m in members:
            lost[place[m]] = put(frames[place[m]], hcells[m], hs, round(SCALE * cx - ax * hs), round(SCALE * foot - ay * hs))

    cols = max(1, min(20, ATLAS_MAX // cw))
    rows_n = -(-20 // cols)
    atlas = Image.new('RGBA', (cw * cols, ch * rows_n), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        atlas.paste(f, ((i % cols) * cw, (i // cols) * ch))
    meta = {'cell': [cw, ch], 'cols': cols, 'feet': SCALE * foot, 'scale': {'walk': round(ws, 4), 'attack': round(as_, 4), 'hdx': round(hs, 4)},
            'sources': {k: os.path.relpath(v, STORE).replace('\\', '/') for k, v in src.items()}}
    return strip, atlas, frames, meta, lost


def preview(key, strip, frames):
    """위 = 띠(2배로 키운 것 · 맞춤 확인용) · 아래 = 새 2배 판 · 칸 0 4 8 12 13 14 15 17 18 19"""
    pick = [0, 1, 4, 8, 12, 13, 14, 15, 17, 18, 19]
    fw = strip.size[0] // 20
    cw, ch = frames[0].size
    out = Image.new('RGBA', (cw * len(pick), ch * 2 + 8), (28, 33, 41, 255))
    for j, k in enumerate(pick):
        c = strip.crop((k * fw, 0, (k + 1) * fw, 160)).resize((cw, ch), Image.NEAREST)
        out.alpha_composite(c, (j * cw, 0))
        out.alpha_composite(frames[k], (j * cw, ch + 8))
    os.makedirs(os.path.join(STORE, 'codex75', 'check'), exist_ok=True)
    p = os.path.join(STORE, 'codex75', 'check', f'hd-{key}.jpg')
    s = min(1.0, 2400 / out.size[0])
    out.convert('RGB').resize((int(out.size[0] * s), int(out.size[1] * s))).save(p, quality=88)
    return p


def register(key, meta):
    reg = json.load(open(REGISTRY, encoding='utf-8')) if os.path.exists(REGISTRY) else {}
    reg[key] = meta
    with open(REGISTRY, 'w', encoding='utf-8', newline='') as f:
        f.write(json.dumps(reg, ensure_ascii=False, indent=1, sort_keys=True) + '\n')
    ts = open(HD_TS, encoding='utf-8').read()
    base, hd = f'anim-px/gen-{key}.png', f'anim-px/gen-{key}_hd.png'
    line_map = f"  '{base}': '{hd}',"
    line_sheet = f"  '{hd}': {{ cell: [{meta['cell'][0]}, {meta['cell'][1]}], cols: {meta['cols']} }},"
    ts = re.sub(rf"\n  '{re.escape(base)}': '[^']+',", '', ts)
    ts = re.sub(rf"\n  '{re.escape(hd)}': \{{[^}}]*\}},", '', ts)
    ts = ts.replace("export const HERO_HD: Readonly<Record<string, string>> = {\n", "export const HERO_HD: Readonly<Record<string, string>> = {\n" + line_map + '\n', 1)
    ts = ts.replace("export const HERO_HD_SHEETS: Readonly<Record<string, { cell: readonly [number, number]; cols: number }>> = {\n",
                    "export const HERO_HD_SHEETS: Readonly<Record<string, { cell: readonly [number, number]; cols: number }>> = {\n" + line_sheet + '\n', 1)
    if line_map not in ts or line_sheet not in ts:
        raise SystemExit('hero-hd.ts 에 못 넣음 (틀이 바뀌었나)')
    with open(HD_TS, 'w', encoding='utf-8', newline='\n') as f:
        f.write(ts)


def main():
    args = sys.argv[1:]
    write = '--write' in args
    keys = [a for a in args if not a.startswith('--')]
    if not keys:
        raise SystemExit(__doc__)
    for key in keys:
        try:
            strip, atlas, frames, meta, lost = build(key)
        except SystemExit as e:
            print(f'{key}: 건너뜀 · {e}'); continue
        pv = preview(key, strip, frames)
        bad = {k: v for k, v in lost.items() if v}
        if write:
            dst = os.path.join(PX, f'gen-{key}_hd.png')
            atlas.save(dst, optimize=True)
            meta['bytes'] = os.path.getsize(dst)
            import hashlib
            meta['sha256'] = hashlib.sha256(open(dst, 'rb').read()).hexdigest()
            register(key, meta)
        print(f"{key}: 칸 {meta['cell']} · 열 {meta['cols']} · 배율 걷기 {meta['scale']['walk']} 공격 {meta['scale']['attack']} 보충 {meta['scale']['hdx']}"
              + f" · 칸 밖 {bad or '없음'}" + (' · 씀' if write else '') + f' · {pv}')


if __name__ == '__main__':
    main()
