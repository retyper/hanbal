"""전투 그림 색 맞춤 (기준서 §0-3 · 형 11-23 「크기도 분위기도 비율도 따로 논다」 · r/aigamedev 「색은 스크립트로 맞춘다」).
띠 하나의 채도·따뜻함·밝기를 기준(소서노 서기 칸)에 가깝게 당기고, 검정에 가까운 바깥 윤곽을 기준의 짙은 밤색으로 바꾼다.
비율(머리 크기)·저해상 도트 결은 못 고친다 — 그건 다시 그린다.
  py -3 -I tools/sprite-kit/color-match.py <띠.png> <나갈.png> [--pull .7]   (pull = 기준까지 얼마나 당길지 0~1)
  py -3 -I tools/sprite-kit/color-match.py --sheet 이름,이름,... <나갈.jpg>   → 소서노 | 전 | 후 비교 시트
"""
import sys
import numpy as np
from PIL import Image, ImageDraw

REF = 'public/realm/anim-px/gen-soseono.png'
OUTLINE = np.array([60, 38, 30], float)   # 기준 바깥 윤곽 평균(§5 · #3C261E)
CLAMP_S, CLAMP_V, CLAMP_W = (.75, 1.6), (.88, 1.18), .08


def cell0(a):
    return a[:, :a.shape[1] // 20]


def stats(a):
    rgb = a[:, :, :3].astype(float) / 255; m = a[:, :, 3] > 200
    px = rgb[m]
    mx, mn = px.max(1), px.min(1)
    return {'s': float(np.mean((mx - mn) / np.maximum(mx, 1e-3))), 'v': float(mx.mean()), 'w': float((px[:, 0] - px[:, 2]).mean())}


def rgb_to_hsv(x):
    r, g, b = x[..., 0], x[..., 1], x[..., 2]; mx = x.max(-1); mn = x.min(-1); d = mx - mn
    h = np.zeros_like(mx)
    m = d > 1e-6
    rm = m & (mx == r); gm = m & (mx == g) & ~rm; bm = m & ~rm & ~gm
    h[rm] = ((g - b)[rm] / d[rm]) % 6; h[gm] = (b - r)[gm] / d[gm] + 2; h[bm] = (r - g)[bm] / d[bm] + 4
    return np.stack([h / 6, np.where(mx > 0, d / np.maximum(mx, 1e-6), 0), mx], -1)


def hsv_to_rgb(x):
    h, s, v = x[..., 0] * 6, x[..., 1], x[..., 2]; i = np.floor(h).astype(int) % 6; f = h - np.floor(h)
    p, q, t = v * (1 - s), v * (1 - s * f), v * (1 - s * (1 - f))
    out = np.zeros(x.shape)
    for k, (a, b, c) in enumerate([(v, t, p), (q, v, p), (p, v, t), (p, q, v), (t, p, v), (v, p, q)]):
        m = i == k; out[..., 0][m], out[..., 1][m], out[..., 2][m] = a[m], b[m], c[m]
    return out


def match(img, pull=.7):
    a = np.asarray(img.convert('RGBA')).copy()
    ref, cur = stats(cell0(np.asarray(Image.open(REF).convert('RGBA')))), stats(cell0(a))
    ks = np.clip(1 + pull * (ref['s'] / max(cur['s'], 1e-3) - 1), *CLAMP_S)
    kv = np.clip(1 + pull * (ref['v'] / max(cur['v'], 1e-3) - 1), *CLAMP_V)
    dw = np.clip(pull * (ref['w'] - cur['w']), -CLAMP_W, CLAMP_W)
    rgb = a[:, :, :3].astype(float) / 255
    hsv = rgb_to_hsv(rgb); hsv[..., 1] = np.clip(hsv[..., 1] * ks, 0, 1); hsv[..., 2] = np.clip(hsv[..., 2] * kv, 0, 1)
    rgb = hsv_to_rgb(hsv); rgb[..., 0] = np.clip(rgb[..., 0] + dw / 2, 0, 1); rgb[..., 2] = np.clip(rgb[..., 2] - dw / 2, 0, 1)
    # 바깥 윤곽: 투명과 맞닿은 어두운 화소를 기준 밤색 쪽으로
    al = a[:, :, 3] > 40
    edge = al & ~(np.roll(al, 1, 0) & np.roll(al, -1, 0) & np.roll(al, 1, 1) & np.roll(al, -1, 1))
    dark = rgb.max(-1) < .26
    sel = edge & dark
    rgb[sel] = rgb[sel] * .3 + (OUTLINE / 255) * .7
    a[:, :, :3] = np.clip(rgb * 255 + .5, 0, 255).astype(np.uint8)
    return Image.fromarray(a), {'채도배': round(float(ks), 2), '밝기배': round(float(kv), 2), '따뜻함+': round(float(dw), 3), '전': cur, '기준': ref}


def sheet(names, out):
    H = 170; tiles = []
    ref = Image.open(REF).convert('RGBA'); fw = ref.size[0] // 20; tiles.append(('soseono', ref.crop((0, 0, fw, ref.size[1])), None))
    for n in names:
        im = Image.open(f'public/realm/anim-px/gen-{n}.png').convert('RGBA'); fw = im.size[0] // 20
        aft, info = match(im)
        tiles.append((n + ' 전', im.crop((0, 0, fw, im.size[1])), None)); tiles.append((n + ' 후', aft.crop((0, 0, fw, im.size[1])), info))
    cols = 7; W = 150
    rows = (len(tiles) + cols - 1) // cols
    o = Image.new('RGB', (cols * W, rows * (H + 30)), (214, 206, 186)); d = ImageDraw.Draw(o)
    for i, (label, c, info) in enumerate(tiles):
        bb = c.getchannel('A').getbbox(); c = c.crop(bb); k = H / c.size[1]; c = c.resize((max(1, round(c.size[0] * k)), H), Image.LANCZOS)
        if c.size[0] > W: x0 = (c.size[0] - W) // 2; c = c.crop((x0, 0, x0 + W, H))
        x, y = (i % cols) * W, (i // cols) * (H + 30)
        o.paste(c, (x + (W - c.size[0]) // 2, y), c); d.text((x + 3, y + H + 2), label, fill=(0, 0, 0))
        if info: d.text((x + 3, y + H + 15), f"S×{info['채도배']} V×{info['밝기배']}", fill=(60, 40, 30))
    o.save(out, quality=90)


if __name__ == '__main__':
    if sys.argv[1] == '--sheet':
        sheet(sys.argv[2].split(','), sys.argv[3])
    else:
        pull = float(sys.argv[sys.argv.index('--pull') + 1]) if '--pull' in sys.argv else .7
        img, info = match(Image.open(sys.argv[1]), pull); img.save(sys.argv[2]); print(info)
