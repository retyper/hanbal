# -*- coding: utf-8 -*-
"""전투 장수 띠 등신 검사 (형 11-16: 「등신비율 베이스라인 확실히 수치로」 · 번예 갈매 얼굴이 너무 큼).

public/realm/anim-px/manifest.json 의 장수 띠(kind general)마다 첫 칸(서 있기)에서
  몸 키 H = 발바닥 줄 - 그림 맨 위 (머리 장식 포함) · 얼굴 = 위쪽 45% 안 가장 큰 살빛 덩어리
  등신 = (발바닥 - 얼굴 위끝) / 얼굴 높이 × (얼굴→머리 1.15 보정은 하지 않고 얼굴 기준 그대로)
기준 장수(형이 맞다고 본 이: 소서노 · 감실 · 쇠비)의 중앙값과 견주어 머리가 큰 쪽을 표시한다.
  py -3 -I tools/sprite-kit/head-ratio.py [--sheet out.jpg] [--json out.json]
"""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
PX = ROOT / 'public/realm/anim-px'
BASE = ['gen-soseono', 'gen-gamsil', 'gen-soebi']
arg = lambda n: sys.argv[sys.argv.index(n) + 1] if n in sys.argv else None


def head_band(key, cw, feet):
    """머리 띠 폭 — 몸 키의 위 8~20% 줄에서, 머리 가운데 기둥이 든 실루엣 이은 칸 폭의 중앙값.
    큰 머리(이등신 꼴)는 이 폭이 넓다. 살빛 찾기는 도트 팔레트에서 금장·머리띠를 잘못 잡아 버렸다."""
    im = np.array(Image.open(PX / f'{key}.png').convert('RGBA'))[:, :cw]
    a = im[..., 3] > 40
    ys = np.where(a.any(1))[0]
    if len(ys) == 0:
        return None
    top, bot = int(ys[0]), int(min(feet, ys[-1]))
    H = bot - top
    # 머리 가운데: 위 4~12% 줄의 실루엣 가운데 (가는 깃털·창끝은 굵기로 거른다)
    band0, band1 = top + int(H * .04), top + int(H * .12)
    cols = a[band0:band1].sum(0)
    xs = np.where(cols >= max(2, cols.max() * .5))[0]
    if len(xs) == 0:
        return None
    cx = int(np.median(xs))
    w = []
    for y in range(top + int(H * .08), top + int(H * .20) + 1):
        row = a[y]
        if not row[cx]:
            near = np.where(row[max(0, cx - 6):cx + 7])[0]
            if len(near) == 0:
                continue
            c = max(0, cx - 6) + int(near[0])
        else:
            c = cx
        l = c
        while l > 0 and row[l - 1]:
            l -= 1
        r = c
        while r < len(row) - 1 and row[r + 1]:
            r += 1
        w.append(r - l + 1)
    if not w:
        return None
    hw = float(np.median(w))
    return {'key': key, 'body': int(H), 'headW': round(hw, 1), 'heads': round(H / hw, 2)}


def measure(key, cw, feet):
    im = np.array(Image.open(PX / f'{key}.png').convert('RGBA'))[:, :cw]
    a = im[..., 3] > 40
    ys = np.where(a.any(1))[0]
    if len(ys) == 0:
        return None
    top, bot = int(ys[0]), int(min(feet, ys[-1]))
    rgb = im[..., :3].astype(np.float32)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    y = .299 * r + .587 * g + .114 * b
    cr = (r - y) * .713 + 128
    cb = (b - y) * .564 + 128
    skin = a & (cr > 136) & (cr < 175) & (cb > 85) & (cb < 128) & (y > 70)
    lim = top + int((bot - top) * .45)
    skin[lim:] = False
    lab, n = ndimage.label(skin)
    if n == 0:
        return {'key': key, 'top': top, 'feet': bot, 'face': None}
    sizes = ndimage.sum(skin, lab, range(1, n + 1))
    # 얼굴 = 위쪽에서 충분히 큰 덩어리 중 가장 위 (어깨·팔 살빛보다 위)
    best = None
    for i in np.argsort(-sizes)[:4]:
        if sizes[i] < max(12, sizes.max() * .3):
            continue
        sl = ndimage.find_objects(lab == i + 1)[0]
        if best is None or sl[0].start < best[0].start:
            best = sl
    fy0, fy1 = best[0].start, best[0].stop
    fx0, fx1 = best[1].start, best[1].stop
    fh = fy1 - fy0
    return {'key': key, 'top': top, 'feet': bot, 'face': [int(fx0), int(fy0), int(fx1), int(fy1)],
            'faceH': int(fh), 'faceW': int(fx1 - fx0), 'body': int(bot - top),
            'heads': round((bot - fy0) / fh, 2) if fh else None,
            'faceShare': round(fh / (bot - top), 3)}


man = json.loads((PX / 'manifest.json').read_text(encoding='utf-8'))
rows = []
for k, v in sorted(man.items()):
    if v.get('kind') != 'general' or not (PX / f'{k}.png').exists():
        continue
    m = head_band(k, v["cell"][0], v["feet"])
    if m:
        rows.append(m)
base = [r['heads'] for r in rows if r['key'] in BASE and r.get('heads')]
ref = float(np.median(base)) if base else None
for r in rows:
    r['vsBase'] = round(r['heads'] / ref, 3) if r.get('heads') and ref else None
rows.sort(key=lambda r: (r['vsBase'] is None, r['vsBase'] or 0))
print('기준', BASE, '등신(얼굴 기준) 중앙값', ref, '· 장수 띠', len(rows))
for r in rows:
    print(f"{r['key']:48s} 등신 {r.get('heads')}  기준비 {r['vsBase']}  얼굴 {r.get('headW')}px / 몸 {r.get('body')}px")
if arg('--json'):
    Path(arg('--json')).write_text(json.dumps({'base': BASE, 'ref': ref, 'rows': rows}, ensure_ascii=False, indent=1), encoding='utf-8')
if arg('--sheet'):
    pick = [r for r in rows if r['key'] in BASE] + rows
    seen, cells = set(), []
    for r in pick:
        if r['key'] in seen:
            continue
        seen.add(r['key']); cells.append(r)
    cw = 110; H = 190; cols = 16
    sh = Image.new('RGB', (cols * cw, ((len(cells) + cols - 1) // cols) * H), (60, 62, 70)); d = ImageDraw.Draw(sh)
    for i, r in enumerate(cells):
        v = man[r['key']]; im = Image.open(PX / f"{r['key']}.png").convert('RGBA').crop((0, 0, v['cell'][0], v['cell'][1]))
        if r.get('face'):
            dd = ImageDraw.Draw(im); dd.rectangle(r['face'], outline=(0, 255, 0, 255))
        im.thumbnail((cw - 4, H - 24))
        x, y = (i % cols) * cw, (i // cols) * H
        sh.paste(im, (x + 2, y + 2), im)
        col = (120, 255, 120) if r['key'] in BASE else ((255, 110, 110) if (r['vsBase'] or 9) < .88 else (230, 230, 230))
        d.text((x + 2, y + H - 22), f"{r['key'][4:18]}", fill=col); d.text((x + 2, y + H - 11), f"{r.get('heads')} {r['vsBase']}", fill=col)
    sh.save(arg('--sheet'), quality=88)
