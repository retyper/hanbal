"""열전 넓은 맵의 바닥 — 지금 스테이지 그림(가장자리에 나무·바위가 그려진 닫힌 마당)의 가운데 땅을 잘라 이어 깔리는 한 장으로 만든다.
(docs/realm/RAID-REWARD-MAP-20261122.md 4-2 「바닥」 · 새 그림 없이 되는 첫 판 · Codex 80 바닥이 통과하면 그것으로 바꾼다)

  py -3 -I tools/sprite-kit/ground-tile.py [--out D:/에셋창고/claude-map] [--only forest,ford]
  py -3 -I tools/sprite-kit/ground-tile.py --check <그림.png>     Codex 가 준 바닥이 이어 깔리는지 숫자로 (이음매 ÷ 보통 이웃 차이 · 1.6 아래면 통과)

법: ① 가운데 땅을 자른다(스테이지마다 자리 · 물길·성벽을 피함) ② 큰 밝기 얼룩을 편다(그대로 깔면 얼룩이 바둑판으로 보인다)
    ③ 오른쪽·아래 끝 띠를 왼쪽·위 끝에 겹쳐 섞는다 → 끝과 끝이 이어진다 ④ 3×3 으로 깔아 이음매를 잰다.
"""
import argparse
import os
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'public/realm/raid')
# 자를 자리(그림 크기의 몫: 왼 · 위 · 오른 · 아래) — 가장자리 장식과 물길을 피한 맨땅
CROP = {
    'forest': (.22, .22, .78, .80),
    'ford': (.30, .30, .72, .70),      # 물길이 두 귀퉁이를 지난다 → 가운데 자갈밭만
    'palisade': (.12, .15, .82, .85),
    'snow': (.22, .28, .76, .82),
    'fortress': (.22, .26, .80, .82),
}
BLEND, FLAT, PASS = 120, 90, 1.6


def flatten(a):
    """큰 밝기 얼룩을 편다 — 흐린 판을 빼고 전체 평균을 더한다(잔무늬는 그대로)."""
    im = Image.fromarray(a.astype('uint8'))
    low = np.asarray(im.filter(ImageFilter.GaussianBlur(FLAT))).astype(float)
    return np.clip(a - low + low.reshape(-1, 3).mean(axis=0), 0, 255)


def wrap(a, m, axis):
    a = np.swapaxes(a, 0, axis) if axis else a
    n = a.shape[0]; r = np.linspace(0, 1, m).reshape(-1, 1, 1)
    out = a[: n - m].copy()
    out[:m] = a[:m] * r + a[n - m:] * (1 - r)   # 0 줄 = 잘려 나간 끝(오른쪽 끝의 다음 줄) → 끝과 끝이 이어진다
    return np.swapaxes(out, 0, axis) if axis else out


def seam(a):
    """이음매 차이 ÷ 보통 이웃 줄 차이 (가로·세로 중 큰 쪽)."""
    a = a.astype(float)
    def one(x):
        inner = np.abs(np.diff(x, axis=0)).mean()
        return np.abs(x[0] - x[-1]).mean() / max(inner, 1e-6)
    return max(one(a), one(np.swapaxes(a, 0, 1)))


def make(stage):
    im = Image.open(os.path.join(SRC, f'{stage}.webp')).convert('RGB'); W, H = im.size
    l, t, r, b = CROP[stage]
    a = np.asarray(im.crop((int(W * l), int(H * t), int(W * r), int(H * b)))).astype(float)
    a = flatten(a)
    a = wrap(wrap(a, BLEND, 0), BLEND, 1)
    return np.clip(a, 0, 255).astype('uint8')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default='D:/에셋창고/claude-map')
    ap.add_argument('--only', default='')
    ap.add_argument('--check', default='')
    a = ap.parse_args()
    if a.check:
        s = seam(np.asarray(Image.open(a.check).convert('RGB')))
        print(f'{os.path.basename(a.check)}: seam {s:.2f} ' + ('PASS' if s < PASS else 'FAIL'))
        return
    os.makedirs(a.out, exist_ok=True)
    for stage in [s for s in a.only.split(',') if s] or list(CROP):
        t = make(stage); h, w = t.shape[:2]
        Image.fromarray(t).save(os.path.join(a.out, f'ground-{stage}.png'))
        tiled = np.tile(t, (3, 3, 1))
        Image.fromarray(tiled).resize((w * 3 // 3, h * 3 // 3)).save(os.path.join(a.out, f'ground-{stage}-3x3.jpg'), quality=85)
        s = seam(t)
        print(f'{stage}: {w}x{h} seam {s:.2f} ' + ('PASS' if s < PASS else 'FAIL'))


if __name__ == '__main__':
    main()
