# -*- coding: utf-8 -*-
"""먼 쪽 다리의 짙은 칠을 옅은 그늘로 (11-23 형 「한쪽 다리가 스타킹 신은 것처럼」 ↔ 「아직도 한쪽 다리로 걸어 · 셔플 춤」).
그림 도구는 「먼 다리가 앞으로 나간 칸」을 그릴 때 그 다리를 짙은 갈색으로 칠하거나(스타킹), 살빛을 같게 하라고 하면
아예 가까운 다리를 앞으로 그려 버린다(같은 발만 딛는다). → 먼 다리가 제대로 앞에 나간 판(짙게 칠해진 판)을 받아,
코드로 그 짙은 살빛만 「옅은 그늘」까지 밝힌다. 살빛은 가까운 다리와 같아지고, 살짝 어두운 것으로 뒤쪽 다리임이 읽힌다.
  py -3 -I tools/sprite-kit/leg-relight.py <받은 장면.png> <나갈.png> [남길 그늘 몫=0.28]
건드리는 곳: 오른쪽 2×2 칸의 사람마다 아래 48% (다리) 의 짙은 살빛 화소만. 가죽 신발·치마·망토는 색으로 걸러 낸다.
"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage


def relight(path, out, keep=.28):
    im = Image.open(path).convert('RGB')
    a = np.asarray(im).astype(np.float32)
    H, W = a.shape[:2]
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    fig = (np.minimum(r, b) - g) < 60                      # 자홍 바탕이 아닌 곳
    lum = r * .299 + g * .587 + b * .114
    # 밝은 살빛(가까운 다리)과 짙은 살빛(먼 다리) — 망토(노랑 쪽 · 파랑이 낮다)·치마(붉다)·가죽(어둡다)은 비율로 뺀다
    rg, gb = r / np.maximum(g, 1), g / np.maximum(b, 1)
    skin_hi = fig & (lum > 165) & (rg > 1.12) & (rg < 1.45) & (gb > 1.10) & (gb < 1.55)
    skin_lo = fig & (lum > 88) & (lum <= 165) & (rg > 1.30) & (rg < 1.85) & (gb > 1.15) & (gb < 1.75) & (b > 55)
    res = a.copy()
    total = 0
    cw, ch = W / 3, H / 2
    for j in range(2):
        for i in range(2):
            x0, x1, y0, y1 = round(cw * (1 + i)), round(cw * (2 + i)), round(ch * j), round(ch * (j + 1))
            f = fig[y0:y1, x0:x1]
            ys = np.nonzero(f.any(1))[0]
            if len(ys) == 0:
                continue
            top, bot = ys.min(), ys.max()
            legs = np.zeros_like(f)
            legs[int(top + (bot - top) * .52):] = True
            hi = skin_hi[y0:y1, x0:x1] & legs
            lo = skin_lo[y0:y1, x0:x1] & legs
            # 짙은 살빛은 큰 덩어리(다리 한 짝)여야 한다 — 가까운 다리의 자연스러운 그늘 줄무늬는 작다
            lab, n = ndimage.label(ndimage.binary_closing(lo, iterations=2))
            if n == 0 or hi.sum() < 200:
                continue
            sizes = ndimage.sum(lo, lab, range(1, n + 1))
            big = np.isin(lab, [k + 1 for k in range(n) if sizes[k] > max(400, sizes.max() * .25)]) & lo
            if big.sum() < 400:
                continue
            cell = res[y0:y1, x0:x1]
            hi_mean = cell[hi].mean(0)
            lo_mean = cell[big].mean(0)
            target = hi_mean - (hi_mean - lo_mean) * keep      # 차이의 keep 몫만 남긴다
            gain = target / np.maximum(lo_mean, 1)
            soft = ndimage.gaussian_filter(big.astype(np.float32), 1.2)[..., None]   # 가장자리는 부드럽게
            cell[:] = cell * (1 - soft) + np.clip(cell * gain, 0, 255) * soft
            total += int(big.sum())
            print(f"칸{j * 2 + i + 1}: 짙은 살빛 {int(big.sum())}px · 밝기 {lum[y0:y1, x0:x1][big].mean():.0f} → {(cell[big] @ np.array([.299, .587, .114])).mean():.0f} (가까운 다리 {lum[y0:y1, x0:x1][hi].mean():.0f})")
    Image.fromarray(res.clip(0, 255).astype(np.uint8)).save(out)
    print(out, '고친 화소', total)


if __name__ == '__main__':
    relight(sys.argv[1], sys.argv[2], float(sys.argv[3]) if len(sys.argv) > 3 else .28)
