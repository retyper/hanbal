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


def motion(path, name, tag, scene=None):
    out = Image.open(path).convert('RGB'); W, H = out.size; cw, ch = W / 3, H / 2; scale = 1 / Z * (640 / cw)
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
    for n, (j, i) in enumerate(((0, 0), (0, 1), (1, 0), (1, 1))):
        gx0, gy0 = round(cw * (1 + i)), round(ch * j)
        c = key(out.crop((gx0, gy0, round(cw * (2 + i)), round(ch * (j + 1))))); m = c[..., 3] > 60   # 판정(자세 겹침)은 칸 그대로
        mine = [b for b in blobs if cw * (1 + i) <= b[2] < cw * (2 + i) and ch * j <= b[3] < ch * (j + 1)]
        if not mine: print(f'칸{n + 1}: 사람을 못 찾음'); continue
        bi, _, bcx, _, bx0, bx1, by0, by1 = max(mine, key=lambda b: b[1])
        whole = full[by0:by1, bx0:bx1].copy(); whole[..., 3] = np.where(lab[by0:by1, bx0:bx1] == bi, whole[..., 3], 0)
        g = game(Image.fromarray(whole), scale); gm = np.asarray(g)[..., 3] > 0; ys, xs = np.nonzero(gm)
        cell = Image.new('RGBA', (CELL_W, CELL), (0, 0, 0, 0)); g2 = g.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
        off = (bcx - (gx0 + cw / 2)) * scale                                   # 칸 한가운데에서 벗어난 만큼(게임 화소) — 칸 안의 가로 자리를 지킨다
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


def motion8(path, name):
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
    for j, tag in enumerate(('walk-a', 'walk-b')):
        for k in range(4):
            gx0 = cw * (1 + k)
            mine = [b for b in blobs if gx0 <= b[2] < gx0 + cw and ch * j <= b[3] < ch * (j + 1)]
            if not mine:
                print(f'{tag} 칸{k + 1}: 사람을 못 찾음')
                continue
            bi, _, bcx, _, bx0, bx1, by0, by1 = max(mine, key=lambda b: b[1])
            whole = full[by0:by1, bx0:bx1].copy()
            whole[..., 3] = np.where(lab[by0:by1, bx0:bx1] == bi, whole[..., 3], 0)
            g = game(Image.fromarray(whole), scale)
            gm = np.asarray(g)[..., 3] > 0
            ys, xs = np.nonzero(gm)
            g2 = g.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
            cell = Image.new('RGBA', (CELL_W, CELL), (0, 0, 0, 0))
            ox = round(CELL_W / 2 + (bcx - (gx0 + cw / 2)) * scale - g2.size[0] / 2)
            cell.alpha_composite(g2, (max(0, min(CELL_W - g2.size[0], ox)), FOOT - g2.size[1]))
            cell.save(f'{PXD}/{name}-{tag}-{k + 1}.png')
            print(f'{tag} 칸{k + 1} 게임 키 {g2.size[1]} 폭 {g2.size[0]}')


if __name__ == '__main__':
    if sys.argv[1] == 'motion8':
        motion8(sys.argv[2], sys.argv[3])
        sys.exit()
    if sys.argv[1] == 'stand': stand(sys.argv[2], sys.argv[3], int(sys.argv[4]) if len(sys.argv) > 4 else 3)
    else: motion(sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5] if len(sys.argv) > 5 else None)
