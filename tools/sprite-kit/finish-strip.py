# -*- coding: utf-8 -*-
"""finish-strip.py <key> — 새로 지은 public/realm/anim2/gen-<key>.png 마무리 (figs.py make 다음 · 11-12)
초록 테 걷기 · 1px 테두리 · 머리·벽 닿음 검사(걸리면 멈춤) · art.ts GEN_ANIM ar/body · battle-strikes 맞는 점(14번 칸 맨 오른쪽 잉크).
옛 띠는 figs.py make 가 쓰기 전에 assets_src/realm/retired/anim2-quad 에 남긴다 — 여기서는 손대지 않는다."""
import os
import re
import subprocess
import sys

import numpy as np
from PIL import Image

key = sys.argv[1]
PY = [sys.executable, '-X', 'utf8']
out = f'public/realm/anim2/gen-{key}.png'
H = 160
done = 'assets_src/realm/retired/anim2-outline/.done'
if os.path.exists(done):
    lines = open(done, encoding='utf-8').read().split('\n')
    open(done, 'w', encoding='utf-8', newline='\n').write('\n'.join(x for x in lines if x != f'gen-{key}.png'))
subprocess.run(PY + ['tools/sprite-kit/idle-breath.py', out], check=True, capture_output=True)  # 서 있기 4칸 숨쉬기 (11-12)
subprocess.run(PY + ['tools/defringe-green.py', out], capture_output=True)
subprocess.run(PY + ['tools/gen-outline.py', out], check=True, capture_output=True)
r = subprocess.run(PY + ['tools/sprite-kit/check-strip.py', out, '20'], capture_output=True, text=True)
print(r.stdout.strip())
if r.returncode != 0:
    sys.exit('멈춤: 머리·벽 닿은 칸')
im = Image.open(out)
cw = im.width // 20
a = np.array(im.crop((0, 0, cw, H)))[..., 3]
ys = np.where(a.max(axis=1) > 40)[0]
body = (ys.max() - ys.min() + 1) / H
p = 'src/realm/data/art.ts'
s = open(p, encoding='utf-8').read()
m = re.search(rf"^  {re.escape(key)}: \{{ ar: [^/]+/ 160, body: [0-9.]+", s, re.M)
if m is None:
    sys.exit(f'멈춤: art.ts GEN_ANIM 에 {key} 자리줄이 없다')
s = s[:m.start()] + f"  {key}: {{ ar: {cw} / 160, body: {body:.3f}" + s[m.end():]
open(p, 'w', encoding='utf-8', newline='\n').write(s)
f = 14
c = np.array(im.crop((f * cw, 0, (f + 1) * cw, H)))[..., 3] > 60
xs = np.where(c.any(axis=0))[0]
xr = xs.max()
yr = int(np.where(c[:, xr])[0].mean())
bp = 'src/ui/realm/battle-strikes.ts'
b = open(bp, encoding='utf-8').read()
i = b.find(f"'gen-{key}': [")
if i >= 0:
    j = b.find(']', i)
    b = b[:i] + f"'gen-{key}': [{f}, {xr / cw:.2f}, {yr / H:.2f}" + b[j:]
    open(bp, 'w', encoding='utf-8', newline='\n').write(b)
print(f'{key}: 칸 {cw} · body {body:.3f} · 맞는 점 {xr / cw:.2f},{yr / H:.2f}')
