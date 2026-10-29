"""
떼어 낸 동작 프레임들을 게임용 띠(높이 160 · 칸 너비 같게 · 발 밑선 하나)와 미리보기 GIF로 묶는다.

  py -I tools/anim-assemble.py <프레임 폴더 | boxes.json> <차례 "1,2,3"> <띠.png> <미리보기.gif> <기준> [원본 높이]

  프레임 폴더 = tools/cut-sprites.py 나 tools/anim-cells.py 가 쓴 *.png (이름 차례 = 1,2,3…)
  기준(가로를 무엇에 맞추나 — 캐릭터가 떨지 않게):
    helmet  머리 꼭대기 (걷기·숨쉬기)
    foot    맨 아래 10% 줄의 가장 왼쪽 = 뒷발 뒤꿈치 · 뒷발굽 · 배 고물 (공격 — 몸과 무기가 앞으로 나간다)
    center  가운데 띠(40~70% 높이)의 무게중심 (말 몸통 · 배 몸체)
    cell    칸 안 위치 그대로 (anim-cells 의 boxes.json 일 때만 뜻이 있다)
  모든 프레임은 바닥을 맞춘다(가장 낮은 발이 땅). 띠는 원본 공통 상자를 그대로 줄인다 — 프레임마다 따로 줄이지 않는다.
  미리보기 GIF 는 회색 바탕 · 높이 320 · 10fps.
"""
import os, sys, json, glob
import numpy as np
from PIL import Image

src, idx, out_png, out_gif, mode = sys.argv[1:6]
srcH = int(sys.argv[6]) if len(sys.argv) > 6 else 0
if os.path.isdir(src):
    d = src
    boxes = [{'file': os.path.basename(p), 'x': 0, 'y': 0} for p in sorted(glob.glob(os.path.join(src, '*.png')))]
else:
    d = os.path.dirname(src)
    boxes = json.load(open(src))
sel = [boxes[int(i) - 1] for i in idx.split(',')]
ims = [Image.open(os.path.join(d, b['file'])).convert('RGBA') for b in sel]
for b, im in zip(sel, ims):
    b['w'], b['h'] = im.width, im.height
mask = [np.asarray(im)[..., 3] > 80 for im in ims]


def anchor(m):
    if mode == 'helmet':
        ys = np.nonzero(m.any(1))[0]
        return np.nonzero(m[ys[0]:ys[0] + 40])[1].mean()
    if mode == 'foot':
        return np.nonzero(m[int(m.shape[0] * 0.9):])[1].min()
    if mode == 'center':
        return np.nonzero(m[int(m.shape[0] * 0.4):int(m.shape[0] * 0.7)])[1].mean()
    return 0.0


if mode == 'cell':
    lefts = [float(b['x']) for b in sel]
else:
    ax = [anchor(m) for m in mask]
    ref = float(np.median(ax))
    lefts = [ref - a for a in ax]
B = max(b['h'] for b in sel)
tops = [B - b['h'] for b in sel]
L = min(lefts)
R = max(l + im.width for l, im in zip(lefts, ims))
W, Hs = int(np.ceil(R - L)) + 4, B + 2
if srcH and srcH > Hs:
    Hs = srcH
frames = []
for im, l, t in zip(ims, lefts, tops):
    c = Image.new('RGBA', (W, Hs), (0, 0, 0, 0))
    c.alpha_composite(im, (int(round(l - L)) + 2, Hs - 2 - im.height))
    frames.append(c)


def scaled(h):
    w = max(1, round(W * h / Hs))
    return [f.resize((w, h), Image.LANCZOS) for f in frames]


st = scaled(160)
fw = st[0].width
strip = Image.new('RGBA', (fw * len(st), 160), (0, 0, 0, 0))
for i, f in enumerate(st):
    strip.alpha_composite(f, (i * fw, 0))
strip.save(out_png)
gf = []
for f in scaled(320):
    bg = Image.new('RGBA', f.size, (128, 128, 128, 255))
    bg.alpha_composite(f)
    gf.append(bg.convert('RGB').convert('P', palette=Image.ADAPTIVE, colors=255))
gf[0].save(out_gif, save_all=True, append_images=gf[1:], duration=100, loop=0, disposal=2)
# 앞끝(무기 끝) 위치 — 공격이 얼마나 뻗는지 잰다
a = np.asarray(strip)[..., 3] > 80
tips = [int(np.nonzero(a[:, i * fw:(i + 1) * fw].any(0))[0].max()) for i in range(len(st))]
print(out_png, strip.size, 'frame', fw, 'x160', 'front-x', tips)
