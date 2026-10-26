"""
성공·실패 도장 그림 굽기 — 인주 결(얼룩·빈 자리·번진 테두리)을 살린 낙관 한 장씩
(형 10-26: "성공 실패 도장도 이미지화해서 만들어야 할 듯")

  py -I tools/bake-stamps.py   → public/realm/fx/stamp-ok.png · stamp-fail.png
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from scipy import ndimage

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'public', 'realm', 'fx')
FONT = 'C:/Windows/Fonts/NanumMyeongjoExtraBold.ttf'
W, H = 720, 380
SS = 2  # 크게 그려 줄인다


def noise(shape, scale, seed):
    rng = np.random.default_rng(seed)
    n = rng.random((shape[0] // scale + 2, shape[1] // scale + 2))
    n = ndimage.zoom(n, scale, order=3)[: shape[0], : shape[1]]
    return (n - n.min()) / (n.max() - n.min() + 1e-9)


def stamp(text, ink, seed, tilt, out, cut, worn):
    """cut — 음각(붉은 판에 글자가 하얗게 빠진다) · 아니면 양각(테와 글자가 붉다). worn — 닳은 정도 0..1"""
    w, h = W * SS, H * SS
    m = Image.new('L', (w, h), 0)
    d = ImageDraw.Draw(m)
    pad = 22 * SS
    f = ImageFont.truetype(FONT, 230 * SS)
    bb = d.textbbox((0, 0), text, font=f, stroke_width=4 * SS)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    at = ((w - tw) / 2 - bb[0], (h - th) / 2 - bb[1] - 4 * SS)
    if cut:
        d.rounded_rectangle([pad, pad, w - pad, h - pad], radius=30 * SS, fill=255)
        d.rounded_rectangle([pad + 22 * SS, pad + 22 * SS, w - pad - 22 * SS, h - pad - 22 * SS], radius=14 * SS, outline=0, width=5 * SS)
        d.text(at, text, font=f, fill=0, stroke_width=4 * SS, stroke_fill=0)
    else:
        d.rounded_rectangle([pad, pad, w - pad, h - pad], radius=30 * SS, outline=255, width=24 * SS)
        d.rounded_rectangle([pad + 38 * SS, pad + 38 * SS, w - pad - 38 * SS, h - pad - 38 * SS], radius=14 * SS, outline=255, width=6 * SS)
        d.text(at, text, font=f, fill=255, stroke_width=4 * SS, stroke_fill=255)
    a = np.asarray(m).astype(np.float32) / 255
    # 가장자리를 거칠게 — 낮은 결의 잡음으로 밀고 당긴다
    dx = (noise((h, w), 10 * SS, seed) - 0.5) * 3.5 * SS
    dy = (noise((h, w), 10 * SS, seed + 1) - 0.5) * 3.5 * SS
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    a = ndimage.map_coordinates(a, [yy + dy, xx + dx], order=1)
    a = ndimage.gaussian_filter(a, 1.2 * SS)
    # 인주가 덜 묻은 자리 — 큰 얼룩 + 잔 티
    big = noise((h, w), 120 * SS, seed + 2)
    fine = noise((h, w), 4 * SS, seed + 3)
    a = a * np.clip(1.0 - worn * (1 - big) * 1.1, 0.55, 1.0)
    a = np.where(fine < 0.08 + 0.1 * worn, a * 0.1, a)
    a = np.clip((a - 0.28) * 2.4, 0, 1)
    # 결 — 짙고 옅은 인주
    tone = 0.82 + 0.18 * noise((h, w), 40 * SS, seed + 4)
    rgb = np.zeros((h, w, 3), np.float32)
    for i in range(3):
        rgb[..., i] = ink[i] * tone
    img = Image.fromarray(np.dstack([rgb, a * 255 * 0.96]).clip(0, 255).astype(np.uint8))
    img = img.rotate(tilt, resample=Image.BICUBIC, expand=True)
    img = img.crop(img.getbbox()).resize((round(img.width / SS), round(img.height / SS)), Image.LANCZOS)
    img.save(os.path.join(OUT, out))
    print('ok', out, img.size)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    stamp('성공', (214, 40, 28), 7, 0, 'stamp-ok.png', True, 0.35)
    stamp('실패', (150, 26, 20), 11, 0, 'stamp-fail.png', False, 0.75)
