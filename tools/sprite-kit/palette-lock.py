# -*- coding: utf-8 -*-
"""색 묶기 (형 11-23 「지나치게 오버퀄리티 돼서 너무 많은 색을 쓰기도 하고 잘 그리지도 못했어」).
승인된 그림(소서노 띠 · 색 견본표)에서 마스터 팔레트(기본 40색)를 뽑아 두고, 받는 그림을 게임 크기로 줄인 뒤 그 색으로만 다시 칠한다.
→ 그림마다 색이 제멋대로인 것 · 탁하게 물든 것 · 줄였을 때 뭉개지는 잔색이 한 번에 정리되고, 장수끼리 색감이 맞는다.
  py -3 -I tools/sprite-kit/palette-lock.py build [색 수=40]                 → D:/에셋창고/STD/master-palette.png
  py -3 -I tools/sprite-kit/palette-lock.py apply <그림.png> <나갈.png> [키 px=137]   (공통 팔레트 · 자홍·초록 바탕은 빼고)
  py -3 -I tools/sprite-kit/palette-lock.py own <그림.png> <나갈.png> [키 px=137] [색 수=32]   (그림 제 색에서 n 색 · 이쪽이 기본)
"""
import sys
import numpy as np
from PIL import Image

STD = 'D:/에셋창고/STD'
# 여러 색 옷의 승인 장수(빨강·주황 범무늬·노랑·초록·남빛·흰 털·잿빛) + 견본표 — 한 색 무리로만 뽑으면 범 줄무늬가 분홍이 된다(11-23)
SOURCES = [f'public/realm/anim-px/gen-{n}.png' for n in ('soseono', 'gamsil', 'jinha', 'maehwa', 'aw1-gamsil', 'base-w-22-dongye-tiger-huntress', 'bakdal',
           'aw1-base-w-06-buyeo-huntress', 'base-w-83-gyeonji-beodeul', 'base-w-56-dongokjeo-sogeum', 'base-w-18-jinhan-salt-widow', 'base-g-40-anya-adan',
           'base-g-38-chopal-palmae', 'base-g-20-samul-sea-lord', 'aw1-base-w-72-eumjeup-beol', 'base-w-31-dabeol-dalbit')] + [f'{STD}/style-swatch.png']


def build(n=40):
    px = []
    for p in SOURCES:
        a = np.asarray(Image.open(p).convert('RGBA'))
        m = a[..., 3] > 200 if p.endswith('.png') and 'swatch' not in p else np.ones(a.shape[:2], bool)
        px.append(a[..., :3][m])
    px = np.concatenate(px).astype(np.float32)
    # 많이 쓴 갈색에 묻혀 드문 색(주황·초록)이 빠지지 않게: 빛깔(hue) 칸마다 같은 몫으로 뽑는다
    mx, mn = px.max(1), px.min(1); sat = (mx - mn) / np.maximum(mx, 1)
    hue = np.round(np.arctan2(np.sqrt(3) * (px[:, 1] - px[:, 2]), 2 * px[:, 0] - px[:, 1] - px[:, 2]) / (np.pi / 6)).astype(int) % 12
    bucket = np.where(sat < .18, 12, hue)
    rng = np.random.default_rng(7)
    pick = np.concatenate([rng.choice(np.nonzero(bucket == b)[0], min(5000, (bucket == b).sum()), replace=False) for b in range(13) if (bucket == b).sum()])
    px = px[pick]
    c = px[rng.choice(len(px), n, replace=False)]
    for _ in range(25):   # k-평균
        d = ((px[:, None, :] - c[None]) ** 2).sum(-1); lab = d.argmin(1)
        for k in range(n):
            sel = px[lab == k]
            if len(sel): c[k] = sel.mean(0)
    c = c[np.argsort(c.sum(1))].round().astype(np.uint8)
    Image.fromarray(c.reshape(1, n, 3)).resize((n * 16, 16), Image.NEAREST).save(f'{STD}/master-palette.png')
    np.save(f'{STD}/master-palette.npy', c); print('palette', n)


def key_out(img):
    a = np.asarray(img.convert('RGB')).astype(np.int16); r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mk, gk = np.minimum(r, b) - g, g - np.maximum(r, b); k = mk if mk.mean() > gk.mean() else gk
    al = np.clip((90 - k.astype(np.float32)) * 255 / 50, 0, 255).astype(np.uint8)
    im = Image.fromarray(np.dstack([a.astype(np.uint8), al])); bb = Image.fromarray(al).point(lambda v: 255 if v > 60 else 0).getbbox()
    return im.crop(bb)


def apply_own(src, out, height=137, n=32):
    """그림마다 자기 색에서 n 색만 남긴다 (공통 팔레트는 진한 빨강·주황이 평균에 묻혀 빠졌다 · 11-23) · 게임 크기로 먼저 줄이고 반투명은 끊는다"""
    im = key_out(Image.open(src))
    k = height / im.size[1]; im = im.resize((max(1, round(im.size[0] * k)), height), Image.LANCZOS)
    a = np.asarray(im); alpha = np.where(a[..., 3] > 110, 255, 0).astype(np.uint8)
    rgb = Image.fromarray(a[..., :3].copy())
    q = rgb.quantize(colors=n, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    Image.fromarray(np.dstack([np.asarray(q), alpha])).save(out); print(out, im.size, '색', n)


def apply(src, out, height=137):
    pal = np.load(f'{STD}/master-palette.npy').astype(np.float32)
    im = key_out(Image.open(src))
    k = height / im.size[1]; im = im.resize((max(1, round(im.size[0] * k)), height), Image.LANCZOS)   # 게임 크기로 먼저
    a = np.asarray(im).astype(np.float32); rgb = a[..., :3].reshape(-1, 3)
    idx = ((rgb[:, None, :] - pal[None]) ** 2).sum(-1).argmin(1)
    q = pal[idx].reshape(a.shape[0], a.shape[1], 3)
    alpha = np.where(a[..., 3] > 110, 255, 0)   # 반투명 가장자리도 딱 끊는다 (도트 결)
    Image.fromarray(np.dstack([q, alpha]).astype(np.uint8)).save(out)
    used = len(np.unique(idx[alpha.reshape(-1) > 0])); print(out, im.size, '색', used)


if __name__ == '__main__':
    if sys.argv[1] == 'build': build(int(sys.argv[2]) if len(sys.argv) > 2 else 40)
    elif sys.argv[1] == 'own': apply_own(sys.argv[2], sys.argv[3], int(sys.argv[4]) if len(sys.argv) > 4 else 137, int(sys.argv[5]) if len(sys.argv) > 5 else 32)
    else: apply(sys.argv[2], sys.argv[3], int(sys.argv[4]) if len(sys.argv) > 4 else 137)
