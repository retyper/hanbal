"""refit20.py <name> [<name> …] — 머리가 칸 위에 잘린 장수 띠를 원본 걷기·동작 띠에서 다시 합친다 (11-12 · 형: 「독무덤 머리막 잘려 있다」).
compose20.py 가 옛날엔 칸보다 큰 컷의 위를 잘랐다. 지금 compose20 은 제일 큰 컷이 들어가게 전체 배율을 줄인다.
옛 띠(public/realm/anim2/gen-<name>.png)의 공격·맞음·쓰러짐 컷이 동작 띠의 몇 번 칸이었는지 되짚어(알파 겹침) 같은 차례로 다시 만들고,
초록 테 걷기(tools/defringe-green.py) · 1px 테두리(tools/gen-outline.py) 를 다시 두르고, art.ts 의 ar·body 와 battle-strikes 의 맞는 점을 고친다 (주석은 그대로).
  py -3 -X utf8 tools/sprite-kit/refit20.py dokmudeom biryu …
  py -3 -X utf8 tools/sprite-kit/refit20.py --dry dokmudeom     (차례만 보고 안 쓴다)
"""
import re
import subprocess
import sys

import numpy as np
from PIL import Image

G = 'assets_src/realm/gemini/generals2/'
S = 'tools/sprite-kit/'
H = 160
PY = [sys.executable, '-X', 'utf8']
dry = '--dry' in sys.argv
names = [a for a in sys.argv[1:] if not a.startswith('--')]


def cells(im, n):
    w = im.width // n
    return [im.crop((i * w, 0, (i + 1) * w, im.height)) for i in range(n)]


def alpha(c):
    return np.array(c)[..., 3] > 40


def bbox_h(c):
    a = alpha(c)
    ys = np.where(a.any(axis=1))[0]
    return (ys.max() - ys.min() + 1) if len(ys) else 0


def render_old(c, cw):
    """옛 compose20 처럼: 그림 높이로 발을 바닥에, 가로 가운데, 칸보다 크면 위를 자름"""
    out = Image.new('RGBA', (cw, H), (0, 0, 0, 0))
    x = (cw - c.width) // 2
    y = H - c.height
    out.alpha_composite(c, (max(0, x), max(0, y)), (max(0, -x), max(0, -y)))
    return alpha(out)


def iou(a, b):
    i = np.logical_and(a, b).sum()
    u = np.logical_or(a, b).sum()
    return i / u if u else 0.0


def infer_amap(name):
    R = Image.open(G + f'{name}-walk-strip.png').convert('RGBA')
    A = Image.open(G + f'{name}-act-strip.png').convert('RGBA')
    E = Image.open(f'public/realm/anim2/gen-{name}.png').convert('RGBA')
    rc, ac, ec = cells(R, 8), cells(A, 8), cells(E, 20)
    run_h = float(np.median([bbox_h(c) for c in rc]))
    k = run_h / max(1, bbox_h(ac[0]))
    ac = [c.resize((max(1, round(c.width * k)), max(1, round(c.height * k))), Image.Resampling.LANCZOS) for c in ac]
    cw = E.width // 20
    cands = [render_old(c, cw) for c in ac]
    amap, scores = [], []
    for i in range(12, 20):
        e = alpha(ec[i])
        best = max(range(8), key=lambda j: iou(e, cands[j]))
        amap.append(best + 1)
        scores.append(round(iou(e, cands[best]), 2))
    return amap, scores


def head_touch(path):
    im = Image.open(path).convert('RGBA')
    a = np.array(im)[..., 3] > 40
    cw = im.width // 20
    return sum(1 for c in range(20) if a[0, c * cw:(c + 1) * cw].any())


for name in names:
    amap, scores = infer_amap(name)
    default = [1, 2, 3, 3, 4, 5, 6, 8]
    tag = '' if amap == default else ' (기본과 다름)'
    print(name, '동작 차례', ','.join(map(str, amap)), '겹침', scores, tag)
    if min(scores) < 0.5:
        print('  !! 겹침이 낮아 차례를 못 믿겠다 — 건너뜀')
        continue
    if dry:
        continue
    out = f'public/realm/anim2/gen-{name}.png'
    before = head_touch(out)
    r = subprocess.run(PY + [S + 'compose20.py', G + f'{name}-walk-strip.png', G + f'{name}-act-strip.png', out, ','.join(map(str, amap))], check=True, capture_output=True, text=True)
    print('  ', r.stdout.strip())
    im = Image.open(out)
    cw = im.width // 20
    a = np.array(im.crop((0, 0, cw, H)))[..., 3]
    ys = np.where(a.max(axis=1) > 40)[0]
    body = (ys.max() - ys.min() + 1) / H
    p = 'src/realm/data/art.ts'
    s = open(p, encoding='utf-8').read()
    m = re.search(rf"^  {re.escape(name)}: \{{ ar: [^/]+/ 160, body: [0-9.]+", s, re.M)
    if m is None:
        raise SystemExit('art.ts 에 자리줄이 없다: ' + name)
    s = s[:m.start()] + f"  {name}: {{ ar: {cw} / 160, body: {body:.3f}" + s[m.end():]
    open(p, 'w', encoding='utf-8', newline='\n').write(s)
    # 맞는 점: 14번(휘두름) 컷의 맨 오른쪽 잉크
    f = 14
    c = np.array(im.crop((f * cw, 0, (f + 1) * cw, H)))[..., 3] > 60
    xs = np.where(c.any(axis=0))[0]
    xr = xs.max()
    yr = int(np.where(c[:, xr])[0].mean())
    bp = 'src/ui/realm/battle-strikes.ts'
    b = open(bp, encoding='utf-8').read()
    key = f"'gen-{name}': ["
    i = b.find(key)
    if i >= 0:
        j = b.find(']', i)
        b = b[:i] + f"'gen-{name}': [{f}, {xr / cw:.2f}, {yr / H:.2f}" + b[j:]
        open(bp, 'w', encoding='utf-8', newline='\n').write(b)
    # 초록 테 · 1px 테두리 (register-realm.sh 와 같은 차례)
    done = 'assets_src/realm/retired/anim2-outline/.done'
    try:
        lines = open(done, encoding='utf-8').read().split('\n')
        open(done, 'w', encoding='utf-8', newline='\n').write('\n'.join(l for l in lines if l != f'gen-{name}.png'))
    except FileNotFoundError:
        pass
    subprocess.run(PY + ['tools/defringe-green.py', out], capture_output=True)
    subprocess.run(PY + ['tools/gen-outline.py', out], check=True, capture_output=True)
    print(f'   머리 닿은 컷 {before} -> {head_touch(out)} · body {body:.3f} · 칸 {cw} · 맞는 점 {xr / cw:.2f},{yr / H:.2f}')
