"""비기 컷인의 윗몸 그림 굽기 — 비기 전신(남색 판)에서 머리~허리를 잘라 판을 빼고(투명) 아래·옆을 부드럽게 지운다.

  py -3 -I tools/skill-cut-bake.py            → public/realm/skill-body/{,aw1/,aw2/}cut/<id>.webp 전부 (있는 것은 건너뜀)
  py -3 -I tools/skill-cut-bake.py --force    → 다시 굽기
  py -3 -I tools/skill-cut-bake.py --sheet N  → tools/out/skill-cut/sheet-*.jpg (무작위 N 장을 불 바탕 위에 · 눈 검사용)
  py -3 -I tools/skill-cut-bake.py --only <id>[,<id>]   → 그 id 만

자르는 상자: 몸통(가장 큰 덩어리) 아래쪽 가운데 x 를 잡고, 그 둘레 좁은 기둥에서 위에서부터 처음 넓어지는 줄 = 머리 끝.
머리 크기 = (발 - 머리 끝) × HEAD · 상자 = 머리 끝 위 TOP 머리 · 높이 TALL 머리 · 너비 = 높이 × ASPECT.
나쁜 것은 tools/skill-cut-override.json 에 { "<폴더>/<id>": { "dx": 0.05, "dy": -0.03, "s": 1.1 } } (비율 · 상자 높이 기준) 로 밀거나,
{ "head": [x, y, 크기] } (머리 가운데 x · 머리 끝 y · 머리 크기 — 그림 너비·높이에 대한 비율) 로 머리를 손으로 짚는다. 폴더는 '' · 'aw1/' · 'aw2/'.
"""
import glob, json, os, random, sys
import numpy as np
import cv2
from PIL import Image, ImageDraw

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BODY = os.path.join(root, 'public/realm/skill-body')
OVR = os.path.join(root, 'tools/skill-cut-override.json')
OUTW, OUTH = 440, 500          # 구운 그림 크기 (너비/높이 = ASPECT)
ASPECT = OUTW / OUTH
HEAD = 0.135                   # 머리 크기 / 몸 높이
TOP = 0.42                     # 머리 끝 위 여유 (머리 단위)
TALL = 3.5                     # 상자 높이 (머리 단위) — 허리께까지
KEY_LO, KEY_HI = 16, 36        # 판 색과의 거리 — 이 아래는 투명, 이 위는 불투명


def sources():
    for sub in ('', 'aw1/', 'aw2/'):
        for f in sorted(glob.glob(os.path.join(BODY, sub + '*.jpg'))):
            yield sub, os.path.basename(f)[:-4], f



HC = cv2.data.haarcascades
_CS = None
def cascades():
    global _CS
    if _CS is None:
        _CS = [cv2.CascadeClassifier(HC + n) for n in ('haarcascade_frontalface_alt2.xml', 'haarcascade_frontalface_default.xml', 'haarcascade_profileface.xml')]
    return _CS

def faces(a, y_max):
    """얼굴 틀(OpenCV Haar: 앞얼굴 둘 · 옆얼굴 좌우) — 그림이라 잘 틀리니 무리 지어 몇 틀이 짚었는지(kinds)도 준다"""
    z = 0.6
    g = cv2.equalizeHist(cv2.cvtColor(a, cv2.COLOR_RGB2GRAY))
    g = cv2.resize(g[:y_max], None, fx=z, fy=z, interpolation=cv2.INTER_AREA)
    w = g.shape[1]
    out = []
    for k, c in enumerate(cascades()):
        for flip in ((False, True) if k == 2 else (False,)):
            img = cv2.flip(g, 1) if flip else g
            for (x, y, ww, hh) in c.detectMultiScale(img, 1.08, 4, minSize=(27, 27), maxSize=(144, 144)):
                if flip: x = w - x - ww
                out.append((k, (x + ww / 2) / z, (y + hh / 2) / z, ww / z))
    # 무리 짓기 — 가운데가 서로 얼굴 크기의 절반 안이면 한 무리
    groups = []
    for f in out:
        for gp in groups:
            g0 = gp[0]
            if abs(f[1] - g0[1]) < 0.5 * g0[3] and abs(f[2] - g0[2]) < 0.5 * g0[3]:
                gp.append(f); break
        else:
            groups.append([f])
    res = []
    for gp in groups:
        kinds = len(set(f[0] for f in gp))
        res.append(dict(x=float(np.mean([f[1] for f in gp])), y=float(np.mean([f[2] for f in gp])), s=float(np.median([f[3] for f in gp])), kinds=kinds, n=len(gp)))
    return res

def analyse(a):
    """a: H×W×3 uint8 → (머리·상자 정보, 알파 H×W)"""
    h, w, _ = a.shape
    ai = a.astype(np.int16)
    border = np.concatenate([ai[:6].reshape(-1, 3), ai[-6:].reshape(-1, 3), ai[:, :6].reshape(-1, 3), ai[:, -6:].reshape(-1, 3)])
    plate = np.median(border, axis=0)
    dist = np.abs(ai - plate).sum(axis=2).astype(np.float32)
    near = (dist < KEY_HI).astype(np.uint8)
    n, lab = cv2.connectedComponents(near, connectivity=4)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(edge)) & (near > 0)
    ramp = np.clip((dist - KEY_LO) / (KEY_HI - KEY_LO), 0, 1)
    alpha = np.ones((h, w), np.float32)
    alpha[bg] = ramp[bg]
    alpha[(dist < KEY_LO * 0.7) & ~bg] = 0
    alpha = cv2.GaussianBlur(alpha, (3, 3), 0)
    fg = (alpha > 0.5).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(fg, connectivity=8)
    areas = st[1:, cv2.CC_STAT_AREA]
    keep = [i + 1 for i, ar in enumerate(areas) if ar >= 0.05 * areas.max()]
    body = np.isin(lab, keep)
    ys, xs = np.nonzero(body)
    t, b = int(ys.min()), int(ys.max())
    fh = b - t
    mid = body[int(t + fh * 0.35):int(t + fh * 0.6)]
    cx = float(np.median(np.nonzero(mid)[1]))
    # 머리 — 굵게 깎아도 남는 위쪽 덩어리들 (가는 무기·팔·머리칼은 사라진다) 가운데, 몸통 위에 가깝고 높은 것 · 얼굴 틀이 짚으면 더 믿는다
    k = max(9, int(h * 0.045)) | 1
    er = cv2.erode(body.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
    lim = int(t + fh * 0.5)
    er[lim:] = 0
    fs = [f for f in faces(a, lim) if t - 10 <= f['y'] <= t + fh * 0.45 and body[min(h - 1, int(f['y'])), min(w - 1, int(f['x']))]]
    n2, lab2, st2, _ = cv2.connectedComponentsWithStats(er, connectivity=8)
    cands = []
    for i in range(1, n2):
        if st2[i, cv2.CC_STAT_AREA] < k * k * 0.3: continue
        cy0 = st2[i, cv2.CC_STAT_TOP]
        ys2, xs2 = np.nonzero(lab2[cy0:cy0 + k] == i)
        x = float(np.mean(xs2))
        top = max(t, cy0 - k // 2 - int(h * 0.01))
        bonus, face = 0.0, None
        for f in fs:
            if abs(f['x'] - x) < 1.6 * f['s'] and top - f['s'] < f['y'] < top + 2.6 * f['s']:
                if bonus < f['kinds'] + 0.5:
                    bonus, face = f['kinds'] + 0.5, f
        cost = (top - t) + 2.0 * abs(x - cx) - bonus * 0.06 * h
        cands.append((cost, top, x, face))
    # 얼굴 틀 둘 넘게 짚었는데 깎은 덩어리와 안 맞으면 그 얼굴도 후보
    for f in fs:
        if f['kinds'] >= 2:
            top = f['y'] - 0.85 * f['s']
            cands.append(((top - t) + 2.0 * abs(f['x'] - cx) - (f['kinds'] + 0.5) * 0.06 * h, top, f['x'], f))
    src = 'erode'
    if cands:
        cost, head_top, hx, face = min(cands, key=lambda c: c[0])
    else:
        head_top, hx, face = t, cx, None
    hs = (b - head_top) * HEAD
    if face is not None:
        hx = face['x']
        ftop = face['y'] - 0.85 * face['s']
        # 덩어리 끝이 얼굴보다 한참 위면(쳐든 무기·소품) 얼굴로 · 조금 위면(상투·관) 그대로
        head_top = head_top if head_top >= ftop - 0.6 * face['s'] else ftop - 0.2 * face['s']
        hs = float(np.clip(1.3 * face['s'], 0.85 * hs, 1.25 * hs))
        src = 'face%d' % face['kinds']
    x_mid = 0.72 * hx + 0.28 * cx
    ch = TALL * hs
    cw = ch * ASPECT
    return dict(x0=x_mid - cw / 2, y0=head_top - TOP * hs, cw=cw, ch=ch, head=head_top, hx=hx, cx=cx, src=src), alpha


def bake(a, box, alpha, ov):
    h, w, _ = a.shape
    if 'head' in ov:
        # 손으로 짚은 머리 — [머리 가운데 x, 머리 끝 y, 머리 크기] (그림 너비·높이에 대한 비율)
        fx, fy, fs = ov['head']
        hs = fs * h
        ch = TALL * hs
        box = dict(box, x0=fx * w - ch * ASPECT / 2, y0=fy * h - TOP * hs, cw=ch * ASPECT, ch=ch, head=fy * h, hx=fx * w, src='hand')
    s = ov.get('s', 1.0)
    ch, cw = box['ch'] * s, box['cw'] * s
    x0 = box['x0'] + (box['cw'] - cw) / 2 + ov.get('dx', 0) * box['ch']
    y0 = box['y0'] + ov.get('dy', 0) * box['ch']
    rgba = np.dstack([a, (alpha * 255).astype(np.uint8)])
    im = Image.fromarray(rgba)
    crop = im.crop((round(x0), round(y0), round(x0 + cw), round(y0 + ch))).resize((OUTW, OUTH), Image.Resampling.LANCZOS)
    c = np.asarray(crop).astype(np.float32)
    # 아래 30% 와 양옆 9% 를 부드럽게 지운다 (잘린 금이 안 보이게) · 위는 3%
    yy = np.linspace(0, 1, OUTH)[:, None]
    xx = np.linspace(0, 1, OUTW)[None, :]
    fade = np.clip((1 - yy) / 0.30, 0, 1) * np.clip(yy / 0.03, 0, 1)
    fade = fade * np.clip(xx / 0.09, 0, 1) * np.clip((1 - xx) / 0.09, 0, 1)
    fade = fade ** 1.4
    c[..., 3] *= fade
    return Image.fromarray(c.clip(0, 255).astype(np.uint8))


def review():
    """구운 그림 전부를 바탕 위에 — tools/out/skill-cut/review-NN.jpg (60 장씩)"""
    out = os.path.join(root, 'tools/out/skill-cut'); os.makedirs(out, exist_ok=True)
    bg = Image.open(os.path.join(root, 'public/realm/fx/skill/bg/war.webp')).convert('RGBA')
    fs = [(sub, id_) for sub, id_, _ in sources() if os.path.exists(os.path.join(BODY, sub + 'cut', id_ + '.webp'))]
    cols, cw, chh, per = 10, 176, 214, 60
    for k in range(0, len(fs), per):
        ch = fs[k:k + per]
        rows = (len(ch) + cols - 1) // cols
        sh = Image.new('RGBA', (cols * cw, rows * chh), (30, 30, 30, 255))
        dr = ImageDraw.Draw(sh)
        for i, (sub, id_) in enumerate(ch):
            x, y = (i % cols) * cw, (i // cols) * chh
            tile = bg.crop((200 + (i % 5) * 220, 60, 200 + (i % 5) * 220 + 440, 560)).resize((176, 200))
            tile.alpha_composite(Image.open(os.path.join(BODY, sub + 'cut', id_ + '.webp')).convert('RGBA').resize((176, 200)))
            sh.paste(tile, (x, y))
            dr.text((x + 2, y + 201), f'{k + i}:{sub}{id_[:22]}', fill=(255, 255, 255))
        sh.convert('RGB').save(os.path.join(out, f'review-{k // per:02d}.jpg'), quality=80)
    print('review', len(fs))


def main():
    args = sys.argv[1:]
    force = '--force' in args
    only = None
    if '--only' in args: only = set(args[args.index('--only') + 1].split(','))
    sheet_n = int(args[args.index('--sheet') + 1]) if '--sheet' in args else 0
    if '--review' in args:
        review(); return
    ovr = json.load(open(OVR, encoding='utf-8')) if os.path.exists(OVR) else {}
    todo = [x for x in sources() if only is None or x[1] in only or x[0] + x[1] in only]
    if sheet_n:
        random.seed(int(os.environ.get('SEED', '7')))
        todo = random.sample(todo, min(sheet_n, len(todo)))
    made = []
    for sub, id_, f in todo:
        dst = os.path.join(BODY, sub + 'cut', id_ + '.webp')
        if not force and not sheet_n and os.path.exists(dst): continue
        a = np.asarray(Image.open(f).convert('RGB'))
        box, alpha = analyse(a)
        im = bake(a, box, alpha, ovr.get(sub + id_, {}))
        made.append((sub, id_, im, a, box))
        if not sheet_n:
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            im.save(dst, quality=84, method=6, alpha_quality=90)
    if sheet_n:
        bg = Image.open(os.path.join(root, 'public/realm/fx/skill/bg/fire.webp')).convert('RGBA')
        out = os.path.join(root, 'tools/out/skill-cut'); os.makedirs(out, exist_ok=True)
        cols, cw, chh = 8, 220, 270
        per = 40
        for k in range(0, len(made), per):
            ch = made[k:k + per]
            rows = (len(ch) + cols - 1) // cols
            sh = Image.new('RGBA', (cols * cw, rows * chh), (30, 30, 30, 255))
            dr = ImageDraw.Draw(sh)
            for i, (sub, id_, im, a, box) in enumerate(ch):
                x, y = (i % cols) * cw, (i // cols) * chh
                tile = bg.crop((300 + (i % 5) * 200, 50, 300 + (i % 5) * 200 + 440, 550)).resize((220, 250))
                tile.alpha_composite(im.resize((220, 250)))
                sh.paste(tile, (x, y))
                dr.text((x + 2, y + 252), f'{sub}{id_} {box["src"]}', fill=(255, 255, 255))
            sh.convert('RGB').save(os.path.join(out, f'sheet-{k // per:02d}.jpg'), quality=82)
            # 상자 판 — 전신 위에 자른 상자(초록)·머리 끝(빨강)
            bx = Image.new('RGB', (cols * 160, rows * 252), (30, 30, 30))
            d2 = ImageDraw.Draw(bx)
            for i, (sub, id_, im, a, box) in enumerate(ch):
                f = Image.fromarray(a).copy(); d = ImageDraw.Draw(f)
                d.rectangle([box['x0'], box['y0'], box['x0'] + box['cw'], box['y0'] + box['ch']], outline=(0, 255, 0), width=7)
                d.line([box['hx'] - 40, box['head'], box['hx'] + 40, box['head']], fill=(255, 0, 0), width=7)
                bx.paste(f.resize((160, 240)), ((i % cols) * 160, (i // cols) * 252))
                d2.text(((i % cols) * 160 + 2, (i // cols) * 252 + 240), f'{id_[:24]}', fill=(255, 255, 255))
            bx.save(os.path.join(out, f'boxes-{k // per:02d}.jpg'), quality=80)
        print('sheet', len(made))
    else:
        print('baked', len(made))


main()
