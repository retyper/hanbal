# -*- coding: utf-8 -*-
"""finish-quad.py <key> — 네 칸 판(<key>-r1..r4.png · 원본)을 게임 장수 띠로 넣는다 (11-12 형: 「만들어진 거 아주 좋다 · 제미나이로 계속」)
  1 clean.py 로 키 빼기 · 2 칸 경계 검사(걸치면 멈춤) · 3 compose-quad LAYOUT=r → public/realm/anim2/gen-<key>.png
  4 초록 테 걷기 · 1px 테두리 · 5 머리·벽 닿음 검사 · 6 art.ts GEN_ANIM ar/body · battle-strikes 맞는 점(14번 칸 맨 오른쪽 잉크)
  · art.ts 에 자리줄이 없으면 GEN_OWN 은 손대지 않고 알린다(새 장수는 register-realm.sh 로 먼저 자리를 만든다).
  py -3 -X utf8 tools/sprite-kit/finish-quad.py soseono"""
import os
import re
import subprocess
import sys

import numpy as np
from PIL import Image

key = sys.argv[1]
G = 'assets_src/realm/gemini/generals2/'
K = 'tools/sprite-kit/'
PY = [sys.executable, '-X', 'utf8']
out = f'public/realm/anim2/gen-{key}.png'
H = 160


def run(args, env=None):
    r = subprocess.run(args, capture_output=True, text=True, env=env)
    if r.returncode != 0:
        sys.exit(f'멈춤: {" ".join(args)}\n{r.stdout}{r.stderr}')
    return r.stdout.strip()


for n in range(1, 5):
    src = G + f'{key}-r{n}.png'
    if n == 2 and not os.path.exists(src):
        print('  r2 없음 — 걷기 첫째 장을 두 번 쓴다 (11-12: 둘째 장은 늘 첫째 장을 베꼈다)')
        continue
    if not os.path.exists(src) or os.path.getsize(src) == 0:
        sys.exit(f'멈춤: {src} 없음')
    run(PY + [K + 'clean.py', src, G + f'{key}-r{n}-key.png'])
    r = subprocess.run(PY + [K + 'check-strip.py', G + f'{key}-r{n}-key.png', '2', '2'], capture_output=True, text=True)
    print(r.stdout.strip())
    if r.returncode != 0:
        if n >= 3:
            sys.exit('멈춤: 동작 장 칸 경계에 무기가 걸쳤다 — 다시 굽는다')
        print('  (걷기 장 · 창끝이 칸 끝에 닿은 정도면 띠에서 표가 안 난다 — 넣고 넘어감)')
# 걷기 둘째 장이 첫째 장을 베꼈으면(형 11-12 아령·소서노) 첫째 장을 두 번 쓴다 — 옆모습 걷기의 뒤 반은 다리만 바뀐 같은 윤곽이라 표가 덜 난다
a1 = np.asarray(Image.open(G + f'{key}-r1-key.png').convert('L').resize((128, 128)), float)
a2 = np.asarray(Image.open(G + f'{key}-r2-key.png').convert('L').resize((128, 128)), float) if os.path.exists(G + f'{key}-r2.png') else a1
if os.path.exists(G + f'{key}-r2.png') and np.abs(a1 - a2).mean() < 6:
    print('  걷기 둘째 장 = 첫째 장 베낌 (차이', round(float(np.abs(a1 - a2).mean()), 1), ')')
os.makedirs('assets_src/realm/retired/anim2-quad', exist_ok=True)
if os.path.exists(out):
    Image.open(out).save(f'assets_src/realm/retired/anim2-quad/gen-{key}.png')  # 옛 띠 보관 (메모리 keep-retired-art)
print(run(PY + [K + 'compose-quad.py', key, out], env={**os.environ, 'LAYOUT': 'r'}))
done = 'assets_src/realm/retired/anim2-outline/.done'
if os.path.exists(done):
    lines = open(done, encoding='utf-8').read().split('\n')
    open(done, 'w', encoding='utf-8', newline='\n').write('\n'.join(x for x in lines if x != f'gen-{key}.png'))
subprocess.run(PY + ['tools/defringe-green.py', out], capture_output=True)
run(PY + ['tools/gen-outline.py', out])
print(run(PY + [K + 'check-strip.py', out, '20']))

im = Image.open(out)
cw = im.width // 20
a = np.array(im.crop((0, 0, cw, H)))[..., 3]
ys = np.where(a.max(axis=1) > 40)[0]
body = (ys.max() - ys.min() + 1) / H
p = 'src/realm/data/art.ts'
s = open(p, encoding='utf-8').read()
m = re.search(rf"^  {re.escape(key)}: \{{ ar: [^/]+/ 160, body: [0-9.]+", s, re.M)
if m is None:
    sys.exit(f'멈춤: art.ts GEN_ANIM 에 {key} 자리줄이 없다 (새 장수면 register-realm.sh 로 먼저)')
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
