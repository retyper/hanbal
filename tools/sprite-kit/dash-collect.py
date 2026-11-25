# -*- coding: utf-8 -*-
"""Codex 가 돌려준 대시 판(4x3)에서 ○ 칸만 장수별 한 칸 그림으로 모은다 (A2 · 공개 폴더에는 안 넣는다).
  py -3 -X utf8 -I tools/sprite-kit/dash-collect.py <out-dash-N.png> <scene-dash-N.roots.json> <○ 칸 번호들 예: 1,2,3,5> [나갈 폴더 = tools/out/a2/cells]
판 = 장면의 0.8배(1536x1024) · 칸마다 [서기 | 대시] 쌍 · 대시만 누끼(자홍 키) → 게임 화소(÷(1.6×칸 배율)) → 덧띠 규격 xGeom {h 224 · root 92 · foot 216} 의 한 칸(폭 240)에 놓는다.
놓는 법: 인형의 가장 낮은 발끝이 땅선(216) 위 FLOAT px · 가로는 잉크 가운데가 뿌리(92)+SHIFT.  자홍 번짐(보라) 가장자리는 어둡게 눌러 둔다."""
import json, sys
import numpy as np
from PIL import Image
S = 0.8; CW, CH, ROOT, FOOT = 240, 224, 92, 216
FLOAT, SHIFT = 50, 6


def key(rgb):
    a = np.array(rgb).astype(int)
    d = np.sqrt((a[..., 0] - 255) ** 2 + a[..., 1] ** 2 + (a[..., 2] - 255) ** 2)
    al = np.clip((d - 60) / 60, 0, 1)
    out = np.dstack([a, al * 255]).astype(np.uint8)
    out[..., 3] = np.where(out[..., 3] < 100, 0, out[..., 3])
    r, g, b = [out[..., i].astype(int) for i in range(3)]
    f = (out[..., 3] > 0) & (b > g + 12) & (r > g + 12)
    for c, m in enumerate((.55, .55, .45)):
        out[..., c] = np.where(f, (out[..., c] * m).astype(np.uint8), out[..., c])
    return out


def main(png, roots, ok, outdir):
    im = Image.open(png).convert('RGB')
    cells = json.load(open(roots, encoding='utf-8'))['cells']
    import os
    os.makedirs(outdir, exist_ok=True)
    for n in ok:
        c = cells[n - 1]
        x0, y0, w, h = [round(c[k] * S) for k in ('x', 'y', 'w', 'h')]
        a = key(im.crop((x0 + w // 2, y0, x0 + w, y0 + h)))
        img = Image.fromarray(a, 'RGBA')
        bb = img.getchannel('A').getbbox()
        img = img.crop(bb)
        k = 1 / (1.6 * c['scale'])
        img = img.resize((max(1, round(img.width * k)), max(1, round(img.height * k))), Image.LANCZOS)
        cell = Image.new('RGBA', (CW, CH))
        left = ROOT + SHIFT - img.width // 2
        top = FOOT - FLOAT - img.height
        cell.alpha_composite(img, (max(0, left), max(0, top)))
        name = c['key'] if c['key'].startswith(('base-', 'l-')) else c['key']
        cell.save(f'{outdir}/gen-{name}-dash.png')
        print(n, name, img.size, 'left', left, 'top', top)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], [int(v) for v in sys.argv[3].split(',')], sys.argv[4] if len(sys.argv) > 4 else 'tools/out/a2/cells')
