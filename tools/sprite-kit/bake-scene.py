# -*- coding: utf-8 -*-
"""장면에서 받은 그림 굽기 (11-23 · ART-SKELETON 양산 방식).
그림 도구는 장면을 다른 크기로 다시 내보내고 양옆 견본도 다시 그린다 → 우리 사람만 코드로 자르고, 게임 크기로 굽는다.
굽기 = 면적 평균(BOX)으로 줄임 → 살짝 또렷하게(unsharp 1px 90%) → 반투명 끊기 → 32색.
  서기:  py -3 -I tools/sprite-kit/bake-scene.py stand <받은 장면.png> <이름> [왼쪽부터 몇째=3] [키=137]
         → STD/px/<이름>-stand.png(원본 크기 · 투명 · 다음 장면의 「누구인가」 견본) + STD/px/<이름>-stand-game.png
         키는 장면 첫째 사람(승인 띠 · 원래 키를 안다)과의 비로 정한다.
  동작:  py -3 -I tools/sprite-kit/bake-scene.py motion <받은 장면.png> <이름> <꼬리표: walk-a 등> [원래 장면.png]
         → STD/px/<이름>-<꼬리표>-1..4.png (게임 크기 · 칸 208×160 · 발바닥 줄 155) · 원래 장면을 주면 자세 겹침 숫자도 낸다
"""
import os, sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

PXD = 'D:/에셋창고/STD/px'; N = 137; Z = 4; CELL_W = 208; CELL = 160; FOOT = 155; LEG_MAX = 14   # 띠 규격: 칸 208×160 · 발바닥 줄 155 (gen-*.png 20칸 띠와 같다)


def key(im):
    a = np.asarray(im.convert('RGB')).astype(np.int16); k = np.minimum(a[..., 0], a[..., 2]) - a[..., 1]
    al = np.clip((90 - k.astype(np.float32)) * 255 / 50, 0, 255).astype(np.uint8)
    rgb = a.copy(); g = a[..., 1]; m = np.maximum(g, (a[..., 0] + a[..., 2]) // 2 - 20)   # 가장자리 자홍 번짐 걷기
    rgb[..., 0] = np.where(k > 0, np.minimum(a[..., 0], m + 30), a[..., 0]); rgb[..., 2] = np.where(k > 0, np.minimum(a[..., 2], m + 30), a[..., 2])
    return np.dstack([rgb.astype(np.uint8), al])


def blobs(rgba):
    solid = rgba[..., 3] > 60; lab, n = ndimage.label(ndimage.binary_closing(solid, iterations=2))
    sizes = ndimage.sum(solid, lab, range(1, n + 1)); out = []
    for i in [j + 1 for j in range(n) if sizes[j] > sizes.max() * .3]:
        ys, xs = np.nonzero(lab == i); y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        c = rgba[y0:y1, x0:x1].copy(); c[..., 3] = np.where(lab[y0:y1, x0:x1] == i, c[..., 3], 0); out.append((x0, Image.fromarray(c)))
    return [f for _, f in sorted(out, key=lambda t: t[0])]


def game(im, scale, colors=32):
    """면적 평균으로 줄이고(알파 곱) 또렷하게 → 32색"""
    size = (max(1, round(im.size[0] * scale)), max(1, round(im.size[1] * scale)))
    a = np.asarray(im).astype(np.float32); al = a[..., 3:4] / 255
    rgb = np.asarray(Image.fromarray((a[..., :3] * al).astype(np.uint8)).resize(size, Image.BOX)).astype(np.float32)
    A = np.asarray(Image.fromarray(a[..., 3].astype(np.uint8)).resize(size, Image.BOX)).astype(np.float32)
    rgb = np.where(A[..., None] > 5, rgb / np.maximum(A[..., None] / 255, .02), 0).clip(0, 255)
    s = Image.fromarray(np.dstack([rgb, A]).astype(np.uint8)).filter(ImageFilter.UnsharpMask(radius=1, percent=90, threshold=2))
    b = np.asarray(s); alpha = np.where(b[..., 3] > 110, 255, 0).astype(np.uint8)
    q = Image.fromarray(b[..., :3].copy()).quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    return Image.fromarray(np.dstack([np.asarray(q), alpha]))


def stand(path, name, idx=3, height=N):
    figs = blobs(key(Image.open(path))); me = figs[idx - 1]
    ref = Image.open('public/realm/anim-px/gen-soseono.png').convert('RGBA'); fw = ref.size[0] // 20; ref = ref.crop((0, 0, fw, ref.size[1])); refh = ref.crop(ref.getchannel('A').getbbox()).size[1]
    scale = refh / figs[0].size[1]   # 첫째 사람 = 승인 띠 소서노(원래 키를 안다)
    os.makedirs(PXD, exist_ok=True); me.save(f'{PXD}/{name}-stand.png'); g = game(me, scale); g.save(f'{PXD}/{name}-stand-game.png')
    print(f'{name}: 사람 {len(figs)}명 중 {idx}째 · 원본 {me.size} → 게임 {g.size} (소서노 {refh}px 기준)')


def motion(path, name, tag, scene=None, zoom=Z, rows=False):
    out = Image.open(path).convert('RGB'); W, H = out.size; cw, ch = W / 3, H / 2; scale = 1 / zoom * (640 / cw)   # zoom = 장면을 만든 배(기본 4 · z3 장면은 3)
    src = None
    if scene: src = Image.open(scene).convert('RGB'); sw, sh = src.size[0] / 3, src.size[1] / 2
    # 사람을 칸 금으로 자르지 않는다 (11-23 형 「쓰러짐 마지막 프레임은 머리카락이 잘렸고 그 잘린 게 발밑에 가 있다」 — 누운 사람의 머리카락이
    # 칸 금을 넘어가 옆 칸으로 잘려 들어갔다). 그림 전체에서 덩어리를 찾아, 한가운데가 그 칸에 든 가장 큰 덩어리를 통째로 쓴다.
    full = key(out); solid = full[..., 3] > 60
    lab, nlab = ndimage.label(ndimage.binary_closing(solid, iterations=3))
    blobs = []
    for bi in range(1, nlab + 1):
        ys_b, xs_b = np.nonzero((lab == bi) & solid)
        if len(xs_b) > 400: blobs.append((bi, len(xs_b), (xs_b.min() + xs_b.max()) / 2, (ys_b.min() + ys_b.max()) / 2, xs_b.min(), xs_b.max() + 1, ys_b.min(), ys_b.max() + 1))
    # rows: 서 있는 자세만 든 판(서기 숨쉬기)은 줄마다 가운데 키를 왼쪽 위 서기 그림에 맞춘다 — 그림 도구가 아랫줄을 5~6% 크게 그린다(11-23)
    row_k = {0: 1.0, 1: 1.0}
    if rows:
        ident = [b for b in blobs if b[2] < cw and b[3] < ch]
        ref_h = (max(ident, key=lambda b: b[1])[7] - max(ident, key=lambda b: b[1])[6]) if ident else None
        for jj in range(2):
            hs = []
            for ii in range(2):
                m_ = [b for b in blobs if cw * (1 + ii) <= b[2] < cw * (2 + ii) and ch * jj <= b[3] < ch * (jj + 1)]
                if m_:
                    bb = max(m_, key=lambda b: b[1])
                    hs.append(bb[7] - bb[6])
            if ref_h and hs:
                row_k[jj] = ref_h * 1.005 / float(np.median(hs))
            print(f'줄{jj + 1} 크기 맞춤 x{row_k[jj]:.3f}')
    for n, (j, i) in enumerate(((0, 0), (0, 1), (1, 0), (1, 1))):
        gx0, gy0 = round(cw * (1 + i)), round(ch * j)
        c = key(out.crop((gx0, gy0, round(cw * (2 + i)), round(ch * (j + 1))))); m = c[..., 3] > 60   # 판정(자세 겹침)은 칸 그대로
        mine = [b for b in blobs if cw * (1 + i) <= b[2] < cw * (2 + i) and ch * j <= b[3] < ch * (j + 1)]
        if not mine: print(f'칸{n + 1}: 사람을 못 찾음'); continue
        bi, _, bcx, _, bx0, bx1, by0, by1 = max(mine, key=lambda b: b[1])
        whole = full[by0:by1, bx0:bx1].copy(); whole[..., 3] = np.where(lab[by0:by1, bx0:bx1] == bi, whole[..., 3], 0)
        g = game(Image.fromarray(whole), scale * row_k[j]); gm = np.asarray(g)[..., 3] > 0; ys, xs = np.nonzero(gm)
        cell = Image.new('RGBA', (CELL_W, CELL), (0, 0, 0, 0)); g2 = g.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
        off = (bcx - (gx0 + cw / 2)) * scale * row_k[j]                                   # 칸 한가운데에서 벗어난 만큼(게임 화소) — 칸 안의 가로 자리를 지킨다
        ox = round(CELL_W / 2 + off - g2.size[0] / 2)
        if bx0 < gx0 - 2 or bx1 > gx0 + cw + 2: print(f'  칸{n + 1}: 사람이 칸 금을 넘어가 있음(통째로 살림)')
        if g2.size[0] > CELL_W: print(f'  칸{n + 1}: 폭 {g2.size[0]} > 칸 {CELL_W} — 줄여 넣음'); g2 = g2.resize((CELL_W, round(g2.size[1] * CELL_W / g2.size[0])), Image.BOX)
        cell.alpha_composite(g2, (max(0, min(CELL_W - g2.size[0], ox)), FOOT - g2.size[1])); cell.save(f'{PXD}/{name}-{tag}-{n + 1}.png')
        msg = f'칸{n + 1} 게임 키 {g2.size[1]}'
        # 앞다리·뒷다리 밝기 (11-23 형 「다른 쪽 다리를 딛는 게 없어」 → 「한쪽 다리가 걸을 때만 스타킹 신은 것처럼」)
        #   ※ 판정 아님 · 귀띔만: 살빛 가르기가 망토 털·가죽 신발 색을 못 걸러 낸다(11-23 Codex 지적 · 살빛을 맞춘 판도 +20~+47). 스타킹처럼 보이는지는 눈으로 본다.
        #   먼 다리는 살빛 그대로에 아주 옅은 그늘만: 차이가 LEG_MAX 를 넘으면 스타킹처럼 보인다. 부호는 어느 다리가 앞인지의 귀띔(A 는 + · B 는 −)일 뿐 — 다리가 겹친 칸은 재지 않는다.
        ys_, xs_ = np.nonzero(m); top_, bot_ = ys_.min(), ys_.max(); leg = np.zeros_like(m); leg[int(bot_ - (bot_ - top_) * .30):] = True
        rr, gg2, bb = c[..., 0].astype(np.int16), c[..., 1].astype(np.int16), c[..., 2].astype(np.int16)
        skin = m & leg & (rr > 70) & (rr - bb > 22) & (rr > gg2 + 8) & (gg2 > bb)
        if skin.sum() > 200:
            sx = np.nonzero(skin)[1]; spread = (sx.max() - sx.min()) / (bot_ - top_)
            if spread > .30:
                mid = (sx.min() + sx.max()) / 2; lum_ = rr * .299 + gg2 * .587 + bb * .114; cols = np.arange(m.shape[1])[None, :]
                fr, bk = skin & (cols > mid), skin & (cols <= mid)
                if fr.sum() > 60 and bk.sum() > 60:
                    dl = lum_[fr].mean() - lum_[bk].mean(); msg += f"  앞다리−뒷다리 밝기 {dl:+.0f}{' (귀띔: 차이 큼 · 눈으로 확인)' if abs(dl) > LEG_MAX else ''}"
            else: msg += '  (다리가 겹친 칸 · 밝기는 눈으로)'
        if src is not None:
            b = key(src.crop((round(sw * (1 + i)), round(sh * j), round(sw * (2 + i)), round(sh * (j + 1))))); bm = np.asarray(Image.fromarray(b[..., 3]).resize((c.shape[1], c.shape[0]))) > 100
            def feet(mm):
                yy = np.nonzero(mm.any(1))[0]; bot = yy.max(); band = mm[int(bot - (bot - yy.min()) * .06):bot + 1]; xx = np.nonzero(band.any(0))[0]; return xx.min(), xx.max(), bot
            fa, fb = feet(bm), feet(m); k = 640 / c.shape[1]
            dx = max(abs(fa[0] - fb[0]), abs(fa[1] - fb[1])) * k; cover = (bm & m).sum() / bm.sum(); good = cover >= .93 and dx <= 16 and abs(fa[2] - fb[2]) * k <= 6
            msg += f"  {'합격' if good else '불합격'}  덮임 {cover:.2f} · 발 자리 차 {dx:.0f}/640 · 발바닥 높이 차 {abs(fa[2] - fb[2]) * k:.0f}"
        print(msg)


ROOT_X = 104   # 칸(폭 208) 안에서 몸의 뿌리가 서는 자리 — 모든 동작·모든 칸이 같다


def register(art, rig, reach=45, band=.20):
    """그림 덩어리(art)가 인형(rig)에서 가로로 얼마나 밀려 그려졌나.
    다리·발만 본다(바닥에서 인형 키의 band 몫): 망토·머리카락은 뒤로 길게 날려 몸 전체 겹침을 한쪽으로 끈다(처음에 그렇게 재서 -33px 이 나왔다).
    두 실루엣의 바닥 줄을 맞춘 뒤, 그 띠에서 서로 다른 화소(XOR)가 가장 적은 밀림을 고른다."""
    ay, ry = np.nonzero(art.any(1))[0], np.nonzero(rig.any(1))[0]
    if len(ay) == 0 or len(ry) == 0:
        return 0
    h = int((ry.max() - ry.min() + 1) * band)
    a = art[ay.max() - h + 1:ay.max() + 1]
    r = rig[ry.max() - h + 1:ry.max() + 1]
    cost = np.array([int((a ^ np.roll(r, dx, axis=1)).sum()) for dx in range(-reach, reach + 1)])
    ok = np.nonzero(cost <= cost.min() * 1.02 + 2)[0]
    return int(round(float(np.median(ok)))) - reach


def motion8(path, name, tags=('walk-a', 'walk-b'), norm=True, scene=None):
    """걷기 여덟 칸 장면(5x2 칸 · 왼쪽 줄은 견본) -> <이름>-walk-a-1..4 · <이름>-walk-b-1..4 (사람은 덩어리째 · 칸 금으로 자르지 않는다)
      py -3 -I tools/sprite-kit/bake-scene.py motion8 <받은 장면.png> <이름>"""
    out = Image.open(path).convert('RGB')
    W, H = out.size
    cw, ch = W / 5, H / 2
    scale = 1 / 3 * (384 / cw)
    full = key(out)
    solid = full[..., 3] > 60
    lab, nlab = ndimage.label(ndimage.binary_closing(solid, iterations=3))
    blobs = []
    for bi in range(1, nlab + 1):
        ys_b, xs_b = np.nonzero((lab == bi) & solid)
        if len(xs_b) > 300:
            blobs.append((bi, len(xs_b), (xs_b.min() + xs_b.max()) / 2, (ys_b.min() + ys_b.max()) / 2, xs_b.min(), xs_b.max() + 1, ys_b.min(), ys_b.max() + 1))
    # 줄마다 크기가 달리 그려질 수 있다(11-23: 아랫줄이 5% 컸다) -> 줄의 가운데 키를 왼쪽 위 서기 그림의 키에 맞춘다
    ident = [b for b in blobs if b[2] < cw and b[3] < ch]
    ref_h = max(ident, key=lambda b: b[1])[7] - max(ident, key=lambda b: b[1])[6] if ident else None
    row_k = {}
    for j in range(2):
        hs = []
        for k in range(4):
            gx = cw * (1 + k)
            m_ = [b for b in blobs if gx <= b[2] < gx + cw and ch * j <= b[3] < ch * (j + 1)]
            if m_:
                bb = max(m_, key=lambda b: b[1])
                hs.append(bb[7] - bb[6])
        row_k[j] = (ref_h * 1.015 / float(np.median(hs))) if (ref_h and hs and norm) else 1.0   # 공격처럼 칸마다 키가 다른 판은 norm=False
        print(f'줄{j + 1} 크기 맞춤 x{row_k[j]:.3f}')
    roots = None
    if scene:
        import json, os
        side = scene.replace('.png', '.roots.json')
        if os.path.exists(side):
            roots = json.load(open(side))['roots']
            sc_img = Image.open(scene).convert('RGB')
            kx = W / sc_img.size[0]
            rigmask = np.asarray(Image.fromarray((key(sc_img)[..., 3] > 60).astype(np.uint8) * 255).resize((W, H), Image.NEAREST)) > 127
    for j, tag in enumerate(tags):
        for k in range(4):
            gx0 = cw * (1 + k)
            mine = [b for b in blobs if gx0 <= b[2] < gx0 + cw and ch * j <= b[3] < ch * (j + 1)]
            if not mine:
                print(f'{tag} 칸{k + 1}: 사람을 못 찾음')
                continue
            bi, _, bcx, _, bx0, bx1, by0, by1 = max(mine, key=lambda b: b[1])
            whole = full[by0:by1, bx0:bx1].copy()
            whole[..., 3] = np.where(lab[by0:by1, bx0:bx1] == bi, whole[..., 3], 0)
            g = game(Image.fromarray(whole), scale * row_k[j])
            gm = np.asarray(g)[..., 3] > 0
            ys, xs = np.nonzero(gm)
            g2 = g.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
            cell = Image.new('RGBA', (CELL_W, CELL), (0, 0, 0, 0))
            ox = round(CELL_W / 2 + (bcx - (gx0 + cw / 2)) * scale * row_k[j] - g2.size[0] / 2)
            note = ''
            if roots is not None:   # 뿌리 맞춤: 인형과 겹쳐 밀림을 재고, 뿌리를 ROOT_X 에
                y0c, y1c = int(ch * j), int(ch * (j + 1))
                x0c, x1c = max(0, int(gx0 - cw * .25)), min(W, int(gx0 + cw * 1.25))
                art = (lab[y0c:y1c, x0c:x1c] == bi)
                rg = rigmask[y0c:y1c, x0c:x1c].copy()
                rg[:, :max(0, int(gx0) - x0c)] = False
                rg[:, int(gx0 + cw) - x0c:] = False
                dx = register(art, rg)
                root_art = roots[j * 4 + k] * kx + dx
                ox = round(ROOT_X - (root_art - bx0) * scale * row_k[j])
                note = f' · 그림이 인형에서 {dx:+d}px 밀림 → 뿌리 맞춤'
                if ox < 0 or ox + g2.size[0] > CELL_W:
                    note += ' ← 칸 밖으로 나감!'
            cell.alpha_composite(g2, (max(0, min(CELL_W - g2.size[0], ox)), FOOT - g2.size[1]))
            cell.save(f'{PXD}/{name}-{tag}-{k + 1}.png')
            print(f'{tag} 칸{k + 1} 게임 키 {g2.size[1]} 폭 {g2.size[0]}{note}')


def fall(path, name, scene, tag='down', k4=1.0, flip4=False):
    """쓰러짐 장면(style-scene.py fall 배치) 굽기 -> <이름>-down-1..4. 구역 안의 덩어리를 전부 모은다(떨어진 두건·머리카락 조각도 버리지 않는다).
    누운 칸은 옆 칸이 없어 잘릴 수 없다. 구역 금에 8px 안으로 닿으면 알린다.
      py -3 -I tools/sprite-kit/bake-scene.py fall <받은 장면.png> <이름> <보낸 장면.png>"""
    out = Image.open(path).convert('RGB')
    W, H = out.size
    k = W / 1920
    scale = 1 / (3 * k)
    full = key(out)
    solid = full[..., 3] > 60
    lab, nlab = ndimage.label(solid)
    # 윗줄 세 구역의 금은 보낸 장면에서 읽는다: 세 자세 사이 틈의 한가운데
    sc_ = key(Image.open(scene).convert('RGB'))
    cols = (sc_[:640, 384:, 3] > 60).any(0)
    runs = []
    start = None
    for xi, v in enumerate(list(cols) + [False]):
        if v and start is None:
            start = xi
        elif not v and start is not None:
            if xi - start > 40:
                runs.append((start + 384, xi + 384))
            start = None
    assert len(runs) == 3, f'윗줄 자세가 셋이 아니다: {runs}'
    cut1, cut2 = (runs[0][1] + runs[1][0]) / 2, (runs[1][1] + runs[2][0]) / 2
    regions = [(384, 0, cut1, 640), (cut1, 0, cut2, 640), (cut2, 0, 1920, 640), (384, 640, 1920, 1280)]
    for n, (x0, y0, x1, y1) in enumerate(regions):
        x0, y0, x1, y1 = [round(v * k) for v in (x0, y0, x1, y1)]
        ids = []
        for bi in range(1, nlab + 1):
            ys_b, xs_b = np.nonzero(lab == bi)
            if len(xs_b) < 40:
                continue
            cx_b, cy_b = (xs_b.min() + xs_b.max()) / 2, (ys_b.min() + ys_b.max()) / 2
            if x0 <= cx_b < x1 and y0 <= cy_b < y1:
                ids.append(bi)
        if not ids:
            print(f'칸{n + 1}: 사람을 못 찾음')
            continue
        m = np.isin(lab, ids)
        ys, xs = np.nonzero(m)
        bx0, bx1, by0, by1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        gap = min(bx0 - x0, x1 - bx1, by0 - y0)
        whole = full[by0:by1, bx0:bx1].copy()
        whole[..., 3] = np.where(m[by0:by1, bx0:bx1], whole[..., 3], 0)
        g = game(Image.fromarray(whole), scale * (k4 if n == 3 else 1.0))   # k4: 누운 칸만의 배율(견본의 누운 사람이 작게 들어갔을 때)
        gm = np.asarray(g)[..., 3] > 0
        gy, gx = np.nonzero(gm)
        g2 = g.crop((gx.min(), gy.min(), gx.max() + 1, gy.max() + 1))
        note = ''
        if g2.size[0] > CELL_W:
            note = f' · 폭 {g2.size[0]} > 칸 {CELL_W} (줄여 넣음)'
            g2 = g2.resize((CELL_W, round(g2.size[1] * CELL_W / g2.size[0])), Image.BOX)
        if n == 3 and flip4:   # 누운 칸 좌우 뒤집기 (11-23 형 「눕는 방향 x축 180도 돌려야」 — 셋째 칸과 다리 방향이 이어지게)
            g2 = g2.transpose(Image.FLIP_LEFT_RIGHT)
        cell = Image.new('RGBA', (CELL_W, CELL), (0, 0, 0, 0))
        cell.alpha_composite(g2, ((CELL_W - g2.size[0]) // 2, FOOT - g2.size[1]))
        cell.save(f'{PXD}/{name}-{tag}-{n + 1}.png')
        print(f"칸{n + 1} 게임 키 {g2.size[1]} 폭 {g2.size[0]} · 덩어리 {len(ids)} · 구역 금까지 {gap}px{' ← 금에 닿음!' if gap < 8 else ''}{note}")


if __name__ == '__main__':
    if sys.argv[1] == 'fall':
        nums = [a for a in sys.argv[5:] if a != 'flip4']
        fall(sys.argv[2], sys.argv[3], sys.argv[4], k4=float(nums[0]) if nums else 1.0, flip4='flip4' in sys.argv[5:])
        sys.exit()
    if sys.argv[1] == 'motion8':   # motion8 <받은 장면> <이름> [꼬리표A 꼬리표B = 공격 판: 키 맞춤 없이]
        # motion8 <받은 장면> <이름> [꼬리표A 꼬리표B] [scene=<보낸 장면.png> — 뿌리 곁파일이 있으면 뿌리 맞춤]
        sc_arg = next((a[6:] for a in sys.argv[4:] if a.startswith('scene=')), None)
        rest = [a for a in sys.argv[4:] if not a.startswith('scene=')]
        if len(rest) >= 2:
            motion8(sys.argv[2], sys.argv[3], (rest[0], rest[1]), norm=False, scene=sc_arg)
        else:
            motion8(sys.argv[2], sys.argv[3], scene=sc_arg)
        sys.exit()
    if sys.argv[1] == 'stand': stand(sys.argv[2], sys.argv[3], int(sys.argv[4]) if len(sys.argv) > 4 else 3)
    else:
        rest = [a for a in sys.argv[5:] if a not in ('z3', 'rows')]
        motion(sys.argv[2], sys.argv[3], sys.argv[4], rest[0] if rest else None, 3 if 'z3' in sys.argv[5:] else Z, 'rows' in sys.argv[5:])
