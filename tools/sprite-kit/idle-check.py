"""서기(idle) 칸 검사 (형 11-23 「살해 범은 idle 이 걷다 마는 것 같고 동작도 이상」).
띠마다 서기 칸 0~3 에서 잰다:
  보폭 = 발바닥 줄(맨 아래 6px)의 두 발 덩어리 사이 거리 ÷ 키 — 크면 걷다 멈춘 자세
  숨 = 칸 0 과 칸 1·2 의 윗몸(어깨~허리) 화소 차이 평균 — 너무 작으면 얼어 있음 · 크면 흔들림
  발 = 서기 칸끼리 발 자리 x 흔들림(px)
  py -3 -I tools/sprite-kit/idle-check.py [보폭 기준=.16] → 걸리는 띠만 · tools/out/lineup/idle-check.txt 전체
"""
import glob, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage

LIM = float(sys.argv[1]) if len(sys.argv) > 1 else .16
rows = []
for p in sorted(glob.glob('public/realm/anim-px/gen-*.png')):
    if p.endswith('_hd.png'): continue
    im = Image.open(p).convert('RGBA'); w, h = im.size
    if w % 20: continue
    fw = w // 20
    cells = [np.asarray(im.crop((i * fw, 0, (i + 1) * fw, h))) for i in range(4)]
    a0 = cells[0][:, :, 3] > 40
    ys, xs = np.nonzero(a0)
    if len(ys) < 50: continue
    top, bot = ys.min(), ys.max(); H = bot - top + 1
    sole = a0[bot - 5:bot + 1]
    lab, n = ndimage.label(sole.any(0)[None, :].repeat(2, 0))
    blobs = [np.nonzero(lab[0] == k)[0] for k in range(1, n + 1)]
    blobs = [b for b in blobs if len(b) >= 4]
    stride = (blobs[-1].mean() - blobs[0].mean()) / H if len(blobs) >= 2 else 0
    y0, y1 = top + int(H * .25), top + int(H * .55)
    up = [c[y0:y1, :, :].astype(float) for c in cells]
    breath = np.mean([np.abs(up[0] - up[k]).mean() for k in (1, 2)])
    feet = [np.nonzero((c[:, :, 3] > 40)[bot - 5:bot + 1].any(0))[0] for c in cells]
    sway = max(f.mean() for f in feet if len(f)) - min(f.mean() for f in feet if len(f))
    name = os.path.basename(p)[4:-4]
    rows.append((name, stride, breath, sway))
ref = {r[0]: r for r in rows}
with open('tools/out/lineup/idle-check.txt', 'w', encoding='utf-8') as f:
    for r in sorted(rows, key=lambda r: -r[1]): f.write(f'{r[0]:44} 보폭 {r[1]:.2f}  숨 {r[2]:5.2f}  발 {r[3]:4.1f}\n')
for k in ('soseono', 'gamsil', 'jinha', 'beom'):
    if k in ref: r = ref[k]; print(f'[기준·예] {k:12} 보폭 {r[1]:.2f} 숨 {r[2]:.2f} 발 {r[3]:.1f}')
wide = [r for r in rows if r[1] > LIM]; still = [r for r in rows if r[2] < 1.0]; shaky = [r for r in rows if r[3] > 3]
print(f'전체 {len(rows)} · 보폭>{LIM} {len(wide)} · 숨<1.0(얼어 있음) {len(still)} · 발 흔들림>3px {len(shaky)}')
