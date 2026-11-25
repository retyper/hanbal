# -*- coding: utf-8 -*-
"""남장수 굽기 (11-25 · 시험 판 뒤 코디네이터 「자글자글 · 남빛이 검갈색으로 죽음 · 칼날 나무색」).
bake-scene.py 의 game() 은 면적 평균 → 또렷하게 → 32색 중간값 나누기라, 큰 덩이 색(남빛)이 금장 색에 먹히고 점무늬가 잡음이 된다.
여기서는: 면적 평균 → 이웃 중앙값으로 잔 점을 면으로 묶음(윤곽 1px 은 지킴) → Lab 공간 k-평균으로 팔레트(큰 덩이 색 + 밝은 곳 따로) → 외딴 화소 정리.
  py -3 -I tools/sprite-kit/bake-male.py <받은 장면에서 자른 사람.png> <나갈.png> <게임 키 배율> [색 수=48] [중앙값 섞기=.3] [남길 밝기 차=90]
  재기: py -3 -I tools/sprite-kit/bake-male.py noise <띠 또는 서기.png|칸수> ...
"""
import sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage
from scipy.cluster.vq import kmeans2


def lab(rgb):
    c = rgb.astype(np.float64) / 255; c = np.where(c > .04045, ((c + .055) / 1.055) ** 2.4, c / 12.92)
    M = np.array([[.4124, .3576, .1805], [.2126, .7152, .0722], [.0193, .1192, .9505]]); xyz = c @ M.T / np.array([.95047, 1, 1.08883])
    f = np.where(xyz > .008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def noise(rgba):
    """잡음 지표: ① 이웃 화소와 색이 크게 다른 쌍의 비율(RGB 합 차 > 90) ② 3×3 중앙값과 크게 다른 화소 비율(외딴 점)"""
    a = np.asarray(rgba.convert('RGBA')).astype(np.int16); op = a[..., 3] > 200; rgb = a[..., :3]
    dx = np.abs(rgb[:, 1:] - rgb[:, :-1]).sum(-1); ox = op[:, 1:] & op[:, :-1]
    dy = np.abs(rgb[1:] - rgb[:-1]).sum(-1); oy = op[1:] & op[:-1]
    hard = (np.concatenate([(dx > 90)[ox], (dy > 90)[oy]])).mean()
    med = np.stack([ndimage.median_filter(rgb[..., k], size=3) for k in range(3)], -1)
    spot = (np.abs(rgb - med).sum(-1) > 60)[op].mean()
    return hard, spot


def bake(im, scale, colors=48, med=True, mix=.3, keep_t=90):
    size = (max(1, round(im.size[0] * scale)), max(1, round(im.size[1] * scale)))
    a = np.asarray(im.convert('RGBA')).astype(np.float32); al = a[..., 3:4] / 255
    rgb = np.asarray(Image.fromarray((a[..., :3] * al).astype(np.uint8)).resize(size, Image.BOX)).astype(np.float32)
    A = np.asarray(Image.fromarray(a[..., 3].astype(np.uint8)).resize(size, Image.BOX)).astype(np.float32)
    rgb = np.where(A[..., None] > 5, rgb / np.maximum(A[..., None] / 255, .02), 0).clip(0, 255).astype(np.uint8)
    alpha = A > 110
    # 가장자리 한 겹은 바탕 번짐이 섞이므로 안쪽 색으로 채운다
    inner = ndimage.binary_erosion(alpha, iterations=1)
    idx = ndimage.distance_transform_edt(~inner, return_distances=False, return_indices=True)
    rgb = np.where(alpha[..., None], rgb[idx[0], idx[1]] if True else rgb, 0).astype(np.uint8)
    if med:   # 잔 점을 면으로: 3×3 중앙값 (밝기 차가 큰 1px 선은 남기도록 원본과 섞는다)
        m = np.stack([ndimage.median_filter(rgb[..., k], size=3) for k in range(3)], -1)
        diff = np.abs(rgb.astype(int) - m.astype(int)).sum(-1)
        keep = diff > keep_t   # 아주 어두운 윤곽·밝은 반짝임(눈·금 반사)은 남김
        mixed = (rgb.astype(float) * (1 - mix) + m.astype(float) * mix)
        rgb = np.where(keep[..., None], rgb, mixed).round().astype(np.uint8)
    # Lab k-평균 팔레트: 큰 덩이 색 + 밝은 곳(칼날·금 반사) 따로
    px = rgb[alpha]; L = lab(px); rng = np.random.RandomState(7)
    k1 = colors - 6
    c1, _ = kmeans2(L, L[rng.choice(len(L), k1, replace=False)], minit='matrix', iter=12)
    bright = L[:, 0] > np.percentile(L[:, 0], 92)
    c2, _ = kmeans2(L[bright], L[bright][rng.choice(bright.sum(), 6, replace=False)], minit='matrix', iter=12)
    cent = np.vstack([c1, c2]); cent = cent[~np.isnan(cent).any(1)]
    d = ((L[:, None, :] - cent[None]) ** 2).sum(-1); lab_idx = d.argmin(1)
    # 팔레트 색 = 그 덩이 화소의 평균 RGB
    pal = np.array([px[lab_idx == j].mean(0) if (lab_idx == j).any() else [0, 0, 0] for j in range(len(cent))])
    out = np.zeros_like(rgb); out[alpha] = pal[lab_idx].round().astype(np.uint8)
    return Image.fromarray(np.dstack([out, (alpha * 255).astype(np.uint8)]))


if __name__ == '__main__':
    if sys.argv[1] == 'noise':
        for p in sys.argv[2:]:
            im = Image.open(p).convert('RGBA'); print(p.split('/')[-1], 'hard %.3f spot %.3f' % noise(im))
    else:
        im = Image.open(sys.argv[1]).convert('RGBA'); g = bake(im, float(sys.argv[3]), int(sys.argv[4]) if len(sys.argv) > 4 else 48, True, float(sys.argv[5]) if len(sys.argv) > 5 else .3, int(sys.argv[6]) if len(sys.argv) > 6 else 90); g.save(sys.argv[2]); print(sys.argv[2], g.size, 'hard %.3f spot %.3f' % noise(g))
