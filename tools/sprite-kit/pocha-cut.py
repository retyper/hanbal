# -*- coding: utf-8 -*-
"""포차 부품 자르기 + 조립 미리 보기 (11-23 형 「포차는 부품마다」 · 「돌이 바닥에서 시작해 던져져야 하는 원리 아님?」).
받은 장면(out-pocha-parts.png)에서 부품을 코드로 자르고(도식의 자리로 어느 부품인지 안다), 축 자리를 도식 치수로 적어 둔다.
조립 = 균형추 투석기의 원리대로: 장전(팔 끝이 뒤쪽 바닥 · 주머니에 돌 · 균형추는 앞 위) → 균형추가 떨어지며 팔이 위로 넘어감
→ 꼭대기를 지나며 돌이 떠남 → 팔을 다시 끌어내려 장전.
  py -3 -I tools/sprite-kit/pocha-cut.py
  → public/realm/raid/pocha/<부품>.png (게임 화소의 2배) + pocha.json(축 자리) + tools/out/lineup/pocha-poses.png · pocha.gif
"""
import json
import math
import os
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

SRC = 'D:/에셋창고/STD/out-pocha-parts.png'
OUT = 'public/realm/raid/pocha'
GUIDE_W = 1920
Z = 4
HD = 2
# 도식(pocha-guide.py)에서의 부품 한가운데 어림(1920 좌표) + 축(같은 좌표)
PARTS = {
    'frame': dict(at=(960, 360), pivots=dict(axle=(960, 226), wheelL=(818.6, 470), wheelR=(1101.4, 470), foot=(960, 490))),
    'arm': dict(at=(1600, 210), pivots=dict(axle=(1523.2, 210), tip=(1788, 210), tail=(1412, 210))),
    'pouch': dict(at=(1600, 400), pivots=dict(hang=(1600, 330), seat=(1600, 440))),
    'wheel': dict(at=(840, 970), pivots=dict(hub=(840, 970))),
    'weight': dict(at=(1090, 945), pivots=dict(hang=(1090, 884))),
    'rock': dict(at=(1460, 940), pivots=dict(c=(1460, 940))),
    'plankA': dict(at=(1690, 880), pivots=dict()),
    'plankB': dict(at=(1700, 1060), pivots=dict()),
}
BG = (96, 104, 72)


def key(im):
    a = np.asarray(im.convert('RGB')).astype(np.int16)
    k = np.minimum(a[..., 0], a[..., 2]) - a[..., 1]
    al = np.clip((90 - k.astype(np.float32)) * 255 / 50, 0, 255).astype(np.uint8)
    rgb = a.copy()
    m = np.maximum(a[..., 1], (a[..., 0] + a[..., 2]) // 2 - 20)
    rgb[..., 0] = np.where(k > 0, np.minimum(a[..., 0], m + 30), a[..., 0])
    rgb[..., 2] = np.where(k > 0, np.minimum(a[..., 2], m + 30), a[..., 2])
    return np.dstack([rgb.astype(np.uint8), al])


def shrink(im, k):
    size = (max(1, round(im.size[0] * k)), max(1, round(im.size[1] * k)))
    a = np.asarray(im).astype(np.float32)
    al = a[..., 3:4] / 255
    rgb = np.asarray(Image.fromarray((a[..., :3] * al).astype(np.uint8)).resize(size, Image.BOX)).astype(np.float32)
    A = np.asarray(Image.fromarray(a[..., 3].astype(np.uint8)).resize(size, Image.BOX)).astype(np.float32)
    rgb = np.where(A[..., None] > 5, rgb / np.maximum(A[..., None] / 255, .02), 0).clip(0, 255)
    g = Image.fromarray(np.dstack([rgb, np.where(A > 110, 255, 0)]).astype(np.uint8))
    return g.filter(ImageFilter.UnsharpMask(radius=1, percent=60, threshold=2))


def cut():
    src = Image.open(SRC)
    s = src.size[0] / GUIDE_W
    rgba = key(src)
    solid = rgba[..., 3] > 60
    lab, n = ndimage.label(ndimage.binary_dilation(solid, iterations=4))
    boxes = []
    for i in range(1, n + 1):
        ys, xs = np.nonzero((lab == i) & solid)
        if len(xs) >= 60:
            boxes.append((i, xs.min(), xs.max() + 1, ys.min(), ys.max() + 1))
    out, meta = {}, {}
    k = HD / (Z * s)   # 받은 화소 → 게임 화소의 2배
    for name, p in PARTS.items():
        cx, cy = p['at'][0] * s, p['at'][1] * s
        d, i, x0, x1, y0, y1 = min((math.hypot((b[1] + b[2]) / 2 - cx, (b[3] + b[4]) / 2 - cy), *b) for b in boxes)
        c = rgba[y0:y1, x0:x1].copy()
        c[..., 3] = np.where(lab[y0:y1, x0:x1] == i, c[..., 3], 0)
        g = shrink(Image.fromarray(c), k)
        out[name] = g
        meta[name] = dict(size=list(g.size), miss=round(d / s))
        for pn, (px, py) in p['pivots'].items():
            meta[name][pn] = [round((px * s - x0) * k, 1), round((py * s - y0) * k, 1)]
    return out, meta


def assemble(parts, meta, arm_deg, rock=True, flying=None):
    """발밑 한가운데가 (cx, ground) 인 캔버스에 조립. arm_deg = 팔 끝(주머니 쪽)이 가리키는 각 (0 = 오른쪽 · 화면 위쪽이 +)."""
    W, H, cx, ground = 560, 440, 250, 420
    o = Image.new('RGBA', (W, H), (0, 0, 0, 0))

    def put(name, at, pivot, deg=0.0):
        im = parts[name]
        px, py = meta[name][pivot]
        if deg:
            pad = max(im.size)   # 돌려도 잘리지 않게 넉넉한 정사각 판
            big = Image.new('RGBA', (im.size[0] + pad * 2, im.size[1] + pad * 2), (0, 0, 0, 0))
            big.paste(im, (pad, pad))
            px += pad
            py += pad
            im = big.rotate(deg, center=(px, py), resample=Image.BICUBIC)
        o.alpha_composite(im, (round(at[0] - px), round(at[1] - py)))

    fm = meta['frame']
    wheel_r = meta['wheel']['size'][1] / 2
    foot = (cx, ground - wheel_r * .9)
    ax = (foot[0] + fm['axle'][0] - fm['foot'][0], foot[1] + fm['axle'][1] - fm['foot'][1])
    am = meta['arm']
    l_tip = am['tip'][0] - am['axle'][0]
    l_tail = am['axle'][0] - am['tail'][0]
    r = math.radians(arm_deg)
    tip = (ax[0] + math.cos(r) * l_tip, ax[1] - math.sin(r) * l_tip)
    tail = (ax[0] - math.cos(r) * l_tail, ax[1] + math.sin(r) * l_tail)
    put('weight', tail, 'hang')          # 균형추는 늘 아래로 매달린다
    put('frame', foot, 'foot')
    put('arm', ax, 'axle', arm_deg)
    put('pouch', tip, 'hang')            # 줄 주머니도 늘 아래로 매달린다
    if rock:
        pm = meta['pouch']
        put('rock', (tip[0] + pm['seat'][0] - pm['hang'][0], tip[1] + pm['seat'][1] - pm['hang'][1] - 6), 'c')
    for side in ('wheelL', 'wheelR'):
        put('wheel', (foot[0] + fm[side][0] - fm['foot'][0], foot[1] + fm[side][1] - fm['foot'][1]), 'hub')
    if flying:
        put('rock', flying, 'c')
    return o, tip


def main():
    os.makedirs(OUT, exist_ok=True)
    parts, meta = cut()
    for n, im in parts.items():
        im.save(f'{OUT}/{n}.png')
    with open(f'{OUT}/pocha.json', 'w', encoding='utf-8') as f:
        json.dump(dict(hd=HD, parts=meta), f, ensure_ascii=False, indent=1)
    for n, m in meta.items():
        print(n, m)
    ref = Image.open('public/realm/anim-px/gen-soseono.png').convert('RGBA')
    fw = ref.size[0] // 20
    ref = ref.crop((0, 0, fw, ref.size[1]))
    ref = ref.crop(ref.getchannel('A').getbbox())
    ref = ref.resize((ref.size[0] * HD, ref.size[1] * HD), Image.NEAREST)
    # 장전(팔 끝이 뒤쪽 바닥) → 올라감 → 꼭대기 → 놓음(돌이 떠남) → 다 넘어감
    _, tip0 = assemble(parts, meta, 75, False)
    poses = [(-150, True, None), (175, True, None), (115, True, None), (75, False, (tip0[0] + 50, tip0[1] - 26)), (35, False, (tip0[0] + 170, tip0[1] - 44))]
    frames = []
    for deg, rock, fly in poses:
        im, _ = assemble(parts, meta, deg, rock, fly)
        bg = Image.new('RGB', (im.size[0] + ref.size[0] + 20, im.size[1]), BG)
        bg.paste(ref, (10, 420 - ref.size[1]), ref)
        bg.paste(im, (ref.size[0] + 20, 0), im)
        frames.append(bg)
    row = Image.new('RGB', (sum(f.size[0] for f in frames), frames[0].size[1]), BG)
    x = 0
    for f in frames:
        row.paste(f, (x, 0))
        x += f.size[0]
    row.save('tools/out/lineup/pocha-poses.png')
    seq = [frames[0]] * 7 + frames[1:] + [frames[4]] * 5
    seq[0].save('tools/out/lineup/pocha.gif', save_all=True, append_images=seq[1:], duration=90, loop=0)
    print('ok', row.size)


if __name__ == '__main__':
    main()
