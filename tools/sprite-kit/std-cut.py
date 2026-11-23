# -*- coding: utf-8 -*-
"""기준 표에서 한 명씩 그대로 잘라 기준 묶음(STD/kit)을 만든다 (11-23).
그림 도구에 「떼어 달라」고 하면 다시 그리며 비율이 흐른다 → 코드로 화소 그대로 자른다(바탕만 투명).
  py -3 -I tools/sprite-kit/std-cut.py   → D:/에셋창고/STD/kit/<이름>.png + kit-sheet.png(이름표 붙인 한 장)
"""
import importlib.util, os
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage

STD = 'D:/에셋창고/STD'; KIT = f'{STD}/kit'
SHEETS = [
    ('axis-f-frame.png', [('f-standard', '여 · 표준 뼈대'), ('f-slender', '여 · 가냘픈'), ('f-sturdy', '여 · 우람한')]),
    ('axis-f-bust.png',  [('f-bust-S', '가슴 작은'), ('f-bust-M', '가슴 보통'), ('f-bust-L', '가슴 큰'), ('f-bust-XL', '가슴 아주 큰')]),
    ('axis-m-frame.png', [('m-standard', '남 · 표준'), ('m-lean', '남 · 마른'), ('m-muscular', '남 · 근육질'), ('m-heavy', '남 · 육중한')]),
]


def cut(path):
    a = np.asarray(Image.open(path).convert('RGB')).astype(np.int16); r, g, b = a[..., 0], a[..., 1], a[..., 2]
    k = np.minimum(r, b) - g
    alpha = np.clip((90 - k.astype(np.float32)) * 255 / 50, 0, 255).astype(np.uint8)
    rgb = a.copy(); m = np.maximum(g, (r + b) // 2 - 20)   # 가장자리 자홍 번짐 걷기
    rgb[..., 0] = np.where(k > 0, np.minimum(r, m + 30), r); rgb[..., 2] = np.where(k > 0, np.minimum(b, m + 30), b)
    solid = alpha > 60; lab, n = ndimage.label(ndimage.binary_closing(solid, iterations=2))
    sizes = ndimage.sum(solid, lab, range(1, n + 1)); big = [i + 1 for i in range(n) if sizes[i] > sizes.max() * .3]
    out = []
    for i in big:
        ys, xs = np.nonzero(lab == i); y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        c = np.dstack([rgb[y0:y1, x0:x1].astype(np.uint8), np.where(lab[y0:y1, x0:x1] == i, alpha[y0:y1, x0:x1], 0)])
        out.append((x0, Image.fromarray(c)))
    return [im for _, im in sorted(out, key=lambda t: t[0])]


def main():
    os.makedirs(KIT, exist_ok=True)
    spec = importlib.util.spec_from_file_location('bm', os.path.join(os.path.dirname(__file__), 'body-measure.py')); bm = importlib.util.module_from_spec(spec); spec.loader.exec_module(bm)
    try: font = ImageFont.truetype('C:/Windows/Fonts/malgun.ttf', 16)
    except Exception: font = ImageFont.load_default()
    tiles = []
    for sheet, names in SHEETS:
        figs = cut(f'{STD}/{sheet}')
        assert len(figs) == len(names), (sheet, len(figs))
        for im, (key, label) in zip(figs, names):
            im.save(f'{KIT}/{key}.png')
            d = bm.measure(np.asarray(im)[..., 3] > 60)
            tiles.append((im, label, f"머리 {d['머리']:.0f} 어깨 {d['어깨']:.0f} 허리 {d['허리']:.0f} 골반 {d['골반']:.0f}"))
    faces = cut(f'{STD}/face-types-group.png')
    names = ['face-f-soft', 'face-f-sharp', 'face-f-cute', 'face-f-mature', 'face-m-gentle', 'face-m-sharp', 'face-m-rugged', 'face-m-old']
    assert len(faces) == 8, len(faces)
    for im, n in zip(faces, names):
        if n != 'face-f-mature': im.save(f'{KIT}/{n}.png')   # 11-23 형 「마귀할멈 같은 얼굴」 폐기 · 여자 얼굴형은 글로만
    H = 330; W = 190
    o = Image.new('RGB', (W * len(tiles), H + 52), (236, 232, 222)); dr = ImageDraw.Draw(o)
    for i, (im, label, nums) in enumerate(tiles):
        t = im.resize((max(1, round(im.size[0] * H / im.size[1])), H), Image.LANCZOS)
        o.paste(t, (i * W + (W - t.size[0]) // 2, 4), t)
        dr.text((i * W + 8, H + 8), label, fill=(40, 30, 20), font=font); dr.text((i * W + 8, H + 30), nums, fill=(120, 60, 40), font=ImageFont.truetype('C:/Windows/Fonts/malgun.ttf', 11))
    o.save(f'{STD}/kit-sheet.png'); print(len(tiles), '명 + 얼굴', len(faces), '→', KIT)


if __name__ == '__main__':
    main()
