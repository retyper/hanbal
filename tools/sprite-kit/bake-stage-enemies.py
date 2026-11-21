"""열전 스테이지마다 새 적(51-2 · Codex 67) — 한 줄 20칸 원본을 게임 20칸 띠로 굽는다.
원본: assets_src/realm/raid/codex67/enemy_<스테이지>_<이름>.png (약 2172x724 · 한 줄 20사람 · 오른쪽을 봄)
원본 칸 차례: 대기 0~3 · 걷기 4~11 · 공격 12~17 · 맞음 18 · 쓰러짐 19
게임 칸 차례(옛 bandit-* 띠와 같음): 12·13 준비 · 14 때림(근접은 맞힌 뒤 14 · 창돌격꾼은 돌진 내내 14) · 15 따라감 · 16·17 마무리
  · 궁수는 13 겨눔 · 14 당김 · 16 놓음(haebi-view.ts archerFrame). 그래서 그림마다 ORDER 로 원본 칸을 게임 칸에 옮긴다(픽셀은 그대로).
규칙(bake-elite-strips.py 와 같음): 늘리거나 고쳐 그리지 않음 · 배율 1(원본 픽셀 그대로) · 발을 같은 바닥선에 ·
  가로는 발 가운데, 걷기 칸(4~11)은 엉덩이 가운데, 쓰러짐은 몸 가운데.
  사람 나누기: 원본 사람 간격이 칸 폭(폭/20)과 조금씩 어긋나 칸으로 자르면 두 사람이 한 칸에 들어간다(여울 삿대 · 여울·설원 화살비).
  그래서 큰 덩어리 20개를 사람으로 보고 x 차례로 번호를 매기고, 떨어진 조각(칼날 · 깃)은 x 로 겹치는 사람에게 붙인다.
칸 높이 144 · 발 줄 140 (옛 띠의 128 · 124 와 같은 바닥 여백 몫 · 머리 위로 든 무기까지 안 잘리게).
화면 키는 그만큼 HAEBI_STAGES.<스테이지>.art 의 scale 로 맞춘다 — 대기 몸 키(칸 0~3 평균)가 같은 종류 옛 띠와 같게(이 도구가 셈해 찍는다).
py -3 -I tools/sprite-kit/bake-stage-enemies.py [--only forest,ford] [--sheet <jpg>] [--inspect <폴더>]
"""
import argparse, json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'assets_src/realm/raid/codex67'
OUT = ROOT / 'public/realm/anim-px'
CELLS, CELL_H, FEET, ALPHA, MIN_BLOB, PAD = 20, 144, 140, 24, 30, 4
WALK = range(4, 12)
FOOT_BAND, HIP = .12, (.45, .65)
OLD_H, OLD_FEET = 128, 124
IDENT = list(range(20))


def act(*attack, hit=18, dead=19):
    """대기·걷기 0~11 은 원본 그대로 · 게임 칸 12~17 에 놓을 원본 공격 칸 여섯 · 맞음 · 쓰러짐"""
    return [*range(12), *attack, hit, dead]


# 그림마다: 원본 스테이지·이름 · 맡는 적 종류(판 셈은 그대로 · 그림만) · 게임 칸 → 원본 사람 (11-22 Claude 가 칸 그림을 보고 정함)
PICTURES = {
    # 숲 가죽갑옷 도적(굽은 칼) → 몽둥이 산적: 원본 12 웅크림 · 13 칼 당김 · 14·15 머리 위로 듦 · 16 낮게 벰(때림) · 17 섬
    'enemy-forest-leather': ('forest', 'leather', 'club', act(12, 14, 16, 15, 17, 13)),
    # 덩굴 방패 도적 → 방패병: 12 섬 · 13 칼 뒤로 · 14 웅크림 · 15 앞으로 찌름(때림) · 16·17 돌아옴
    'enemy-forest-vine-shield': ('forest', 'vine-shield', 'shield', act(14, 13, 15, 16, 17, 12)),
    # 숲 화살비 궁수 (11-22 Codex 75 REVIEW20 · 깃 달린 초록 두건) → 궁수: 원본 12 화살 먹임 · 13 당기기 시작(겨눔) · 14 끝까지 당김(당김) ·
    # 15 놓은 뒤 팔 뻗음 → 게임 16(놓음) · 16 움찔 → 맞음 18 · 17 활 내림 · 18 섬 → 안 쓰는 게임 15 · 19 쓰러짐
    'enemy-forest-barrage-archer': ('forest', 'barrage-archer', 'archer', act(12, 13, 14, 18, 15, 17, hit=16, dead=19)),
    # 삿대 든 여울 도적 → 창돌격꾼: 12 섬 · 13 웅크림(겨눔) · 14 삿대 듦 · 15 내지름 · 16 깊게 내지름(돌진) · 17 돌아옴
    'enemy-ford-pole': ('ford', 'pole', 'runner', act(13, 14, 16, 15, 17, 12)),
    # 그물 든 습격자 → 광전사: 12 웅크림 · 13 섬 · 14 그물 듦 · 15 그물 던짐(때림) · 16 낮게 · 17 섬
    'enemy-ford-net': ('ford', 'net', 'berserker', act(12, 14, 15, 16, 17, 13)),
    # 물가 화살비 궁수(사람 21) → 궁수: 12 섬 · 13 어깨 너머 화살 뽑음(당김) · 14 섬(겨눔) · 16 팔을 내뻗음(놓음) · 19 맞음 · 20 쓰러짐
    'enemy-ford-barrage-archer': ('ford', 'barrage-archer', 'archer', act(12, 14, 13, 15, 16, 17, hit=19, dead=20)),
    # 목책 수비 창병(사람 21) → 창돌격꾼: 12 웅크림(겨눔) · 15 내지름 · 16 깊게 내지름(돌진) · 19 맞음 · 20 쓰러짐
    'enemy-palisade-spear': ('palisade', 'spear', 'runner', act(12, 13, 16, 15, 17, 18, hit=19, dead=20)),
    # 나무 방패 수비병 → 방패병: 12 웅크림 · 13 칼 당김 · 14·15 칼 듦 · 16 내려 벰(때림) · 17 섬
    'enemy-palisade-wood-shield': ('palisade', 'wood-shield', 'shield', act(12, 15, 16, 14, 17, 13)),
    # 높은 관모의 화살비 사수 → 궁수: 13 섬(겨눔) · 14 가슴에서 화살 먹임(당김) · 16 팔을 내뻗음(놓음) — 원본 차례 그대로
    'enemy-palisade-barrage-marksman': ('palisade', 'barrage-marksman', 'archer', IDENT),
    # 털가죽 도끼 사냥꾼 → 광전사: 12 섬 · 13·14 도끼 듦 · 15 뒤로 젖힘 · 16 내려찍음(때림) · 17 섬
    'enemy-snow-fur-axe': ('snow', 'fur-axe', 'berserker', act(12, 14, 16, 15, 17, 13)),
    # 눈덮인 방패 추격자 → 창돌격꾼: 12 방패 뒤 웅크림(겨눔) · 13·14 칼 듦 · 15 칼이 둘로 겹친 칸(안 쓰는 15 에) · 16 방패 뒤에서 찌름(돌진) · 17 섬
    'enemy-snow-shield-pursuer': ('snow', 'shield-pursuer', 'runner', act(12, 14, 16, 15, 17, 13)),
    # 설원 화살비 사냥꾼(사람 21) → 궁수: 13 섬(겨눔) · 14 어깨 너머 화살 뽑음(당김) · 16 팔을 내뻗음(놓음) · 19 맞음 · 20 쓰러짐
    'enemy-snow-barrage-hunter': ('snow', 'barrage-hunter', 'archer', act(12, 13, 14, 15, 16, 17, hit=19, dead=20)),
    # 그을린 갑옷 수비병 → 철갑: 12 섬 · 13·14 칼 듦 · 15 휘두름(칼날이 떨어져 그려짐 · 안 쓰는 15 에) · 16 낮게 벰(때림) · 17 섬
    'enemy-fortress-scorched-guard': ('fortress', 'scorched-guard', 'iron', act(12, 14, 16, 15, 17, 13)),
    # 잿빛 도끼 반란병 → 광전사: 12 웅크림 · 13·14 도끼 듦 · 15 뒤로 젖힘 · 16 낮게 찍음(때림) · 17 섬
    'enemy-fortress-ash-axe': ('fortress', 'ash-axe', 'berserker', act(12, 14, 16, 15, 17, 13)),
    # 산성 화살비 사수 → 궁수: 13 섬(겨눔) · 14 가슴에서 화살 먹임(당김) · 15 팔을 내뻗음 → 놓음 칸 16 으로
    'enemy-fortress-barrage-marksman': ('fortress', 'barrage-marksman', 'archer', act(12, 13, 14, 16, 15, 17)),
}


def people(path):
    """원본 한 줄을 사람 20으로 나눈다 → [(rgba 조각, 칸 안 가로 기준, 키)] · 원본 차례"""
    a = np.array(Image.open(path).convert('RGBA'))
    a[a[..., 3] < ALPHA] = 0
    H, W = a.shape[:2]
    labels, n = ndimage.label(a[..., 3] > 0, structure=np.ones((3, 3)))
    objs = ndimage.find_objects(labels)
    area = ndimage.sum(np.ones(labels.shape), labels, range(1, n + 1))
    keep = [i for i in range(n) if area[i] >= MIN_BLOB]
    big = sorted(keep, key=lambda i: -area[i])
    # 사람 수 = 넓이가 처음으로 3배 넘게 떨어지기 앞까지 (원본에 사람이 21인 띠가 있다 · 남는 사람은 ORDER 가 안 쓴다)
    count = next((j for j in range(CELLS, len(big)) if area[big[j]] * 3 < area[big[j - 1]]), len(big))
    if count < CELLS:
        raise ValueError(f'{path.name}: 사람이 {count}뿐이다')
    core = sorted(big[:count], key=lambda i: objs[i][1].start + objs[i][1].stop)
    owner = np.full(n + 1, -1)
    for k, i in enumerate(core):
        owner[i + 1] = k
    pieces = []
    for i in big[count:]:
        sx = objs[i][1]
        # x 로 가장 많이 겹치는 사람 · 안 겹치면 가운데가 가장 가까운 사람
        best = max(range(count), key=lambda k: (min(sx.stop, objs[core[k]][1].stop) - max(sx.start, objs[core[k]][1].start),
                                                 -abs((sx.start + sx.stop) - (objs[core[k]][1].start + objs[core[k]][1].stop))))
        owner[i + 1] = best
        pieces.append((int(area[i]), best))
    out = []
    for k in range(count):
        m = owner[labels] == k
        rgba = a.copy(); rgba[~m] = 0
        ys, xs = np.nonzero(rgba[..., 3] > 0)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        if x0 < 1 or y0 < 1 or x1 > W - 1 or y1 > H - 1:
            raise ValueError(f'{path.name} 사람 {k} 이 원본 가장자리에 닿았다')
        sub = rgba[y0:y1, x0:x1]
        sy, sx = np.nonzero(sub[..., 3] > 64)
        top, bot = sy.min(), sy.max() + 1   # 키·발은 진한 픽셀로 잰다 (옅은 테두리는 따라온다)
        h = bot - top
        # 가로 기준 셋 — 어느 것을 쓸지는 게임 칸이 정한다(anchor): 발 가운데 · 엉덩이 가운데 · 몸 가운데
        band = (sy >= top + h * HIP[0]) & (sy <= top + h * HIP[1])
        out.append(dict(img=sub, feet=float(sx[sy > bot - 1 - h * FOOT_BAND].mean()), hip=float(sx[band].mean()),
                        mid=(sx.min() + sx.max() + 1) / 2, bot=int(bot), h=int(h)))
    return out, pieces


def anchor(slot, p):
    """쓰러짐(19)은 누운 몸 가운데 · 걷기(4~11)는 엉덩이 가운데(보폭 때문에 몸이 흔들리지 않게) · 대기·공격·맞음은 발 가운데"""
    return p['mid'] if slot == CELLS - 1 else p['hip'] if slot in WALK else p['feet']


def old_body(kind):
    """같은 종류 옛 띠의 대기 몸 키(칸 0~3 평균 · 진한 픽셀) · 화면 키(HAEBI_MOBS.height 는 도구 밖이라 몫만)"""
    im = np.array(Image.open(OUT / f'bandit-{kind}.png').convert('RGBA'))[..., 3]
    cw = im.shape[1] // CELLS
    hs = []
    for k in range(4):
        ys = np.nonzero((im[:, k * cw:(k + 1) * cw] > 64).any(1))[0]
        hs.append(ys.max() + 1 - ys.min())
    return float(np.mean(hs))


def bake(name, sheet_rows):
    stage, src_name, kind, order = PICTURES[name]
    src = SRC / f'enemy_{stage}_{src_name}.png'
    if not src.exists():
        print(f'{name}: 원본 없음 ({src.name}) · 건너뜀')
        return None
    ps, pieces = people(src)
    if len(order) != CELLS or max(order) >= len(ps):
        raise ValueError(f'{name}: ORDER 가 20칸이 아니거나 없는 사람을 가리킨다 (사람 {len(ps)})')
    fs = [ps[i] for i in order]
    half = max(max(anchor(k, p), p['img'].shape[1] - anchor(k, p)) for k, p in enumerate(fs))
    cw = int(np.ceil(half * 2 + PAD)); cw += cw % 2
    strip = Image.new('RGBA', (cw * CELLS, CELL_H), (0, 0, 0, 0))
    for k, p in enumerate(fs):
        img = p['img']; x = int(round(k * cw + cw / 2 - anchor(k, p))); y = FEET - p['bot']
        if y < 1 or y + img.shape[0] > CELL_H:
            raise ValueError(f'{name} 칸 {k}: 위아래가 칸을 넘는다 (y {y} · 높이 {img.shape[0]})')
        strip.alpha_composite(Image.fromarray(img), (x, y))
    al = np.array(strip)[..., 3]
    for k in range(CELLS):
        if al[:, k * cw].any() or al[:, (k + 1) * cw - 1].any():
            raise ValueError(f'{name} 칸 {k} 가장자리에 그림이 닿았다')
    dst = OUT / f'{name}.png'
    strip.save(dst, optimize=True)
    idle = float(np.mean([f['h'] for f in fs[:4]]))
    old = old_body(kind)
    # 화면 키 = HAEBI_MOBS[kind].height × scale · 옛 띠(칸 128)와 대기 몸이 같게
    scale = old / OLD_H / (idle / CELL_H)
    row = {'name': name, 'kind': kind, 'size': strip.size, 'cell': [cw, CELL_H], 'feet': FEET, 'tallest': max(f['h'] for f in fs),
           'idle': round(idle, 1), 'oldIdle': round(old, 1), 'scale': round(scale, 3), 'pieces': pieces, 'kb': dst.stat().st_size // 1024}
    print(json.dumps(row, ensure_ascii=False))
    sheet_rows.append((name, strip, cw))
    return row


def inspect(name, folder):
    """원본 차례 그대로 사람 20을 2배로 (칸 번호 · 키) — ORDER 를 정할 때 본다"""
    stage, src_name, kind, _ = PICTURES[name]
    src = SRC / f'enemy_{stage}_{src_name}.png'
    if not src.exists():
        return
    ps, pieces = people(src)
    Z, cols = 2, 11
    mw = max(p['img'].shape[1] for p in ps); mh = max(p['img'].shape[0] for p in ps)
    cw, ch = (mw + 8) * Z, (mh + 24) * Z
    sheet = Image.new('RGB', (cw * cols, ch * 2), (92, 110, 80)); d = ImageDraw.Draw(sheet)
    for k, p in enumerate(ps):
        img = p['img']; im = Image.fromarray(img).resize((img.shape[1] * Z, img.shape[0] * Z), Image.NEAREST)
        cx, cy = (k % cols) * cw, (k // cols) * ch
        sheet.paste(im, (cx + (cw - im.width) // 2, cy + ch - 4 - im.height), im)
        d.text((cx + 4, cy + 2), f'{k} h{p["h"]}', fill=(255, 255, 0))
        d.rectangle([cx, cy, cx + cw - 1, cy + ch - 1], outline=(50, 60, 40))
    sheet.save(Path(folder) / f'src-{name}.png')
    print(name, kind, 'people', len(ps), 'pieces', pieces)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', default='')
    ap.add_argument('--sheet', default='')
    ap.add_argument('--inspect', default='')
    a = ap.parse_args()
    only = [s for s in a.only.split(',') if s]
    names = [n for n in PICTURES if not only or PICTURES[n][0] in only or n in only]
    if a.inspect:
        for n in names:
            inspect(n, a.inspect)
        return
    rows, made = [], []
    for n in names:
        r = bake(n, rows)
        if r:
            made.append(r)
    if a.sheet and rows:
        Wd = max(r.size[0] for _, r, _ in rows) // 2
        sheet = Image.new('RGB', (Wd, (CELL_H // 2 + 16) * len(rows)), (70, 90, 60)); d = ImageDraw.Draw(sheet)
        for i, (n, r, cw) in enumerate(rows):
            y = i * (CELL_H // 2 + 16)
            g = r.resize((r.size[0] // 2, CELL_H // 2), Image.Resampling.LANCZOS)
            d.text((2, y), n, fill=(255, 255, 0))
            sheet.paste(g, (0, y + 14), g)
            d.line([(0, y + 14 + FEET // 2), (Wd, y + 14 + FEET // 2)], fill=(255, 0, 0))
            for k in range(CELLS + 1):
                d.line([(k * cw // 2, y + 14), (k * cw // 2, y + 14 + CELL_H // 2)], fill=(40, 60, 40))
        sheet.save(a.sheet, quality=90)
        print('sheet', a.sheet, sheet.size)


if __name__ == '__main__':
    main()
