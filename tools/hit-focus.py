# -*- coding: utf-8 -*-
"""피격 그림마다 얼굴 가운데 자리 재기 (11-18 형: 「열전에서는 이미지가 전체가 나오지 않잖아 … 얼굴이 안 보일 수도 있는데」).

public/realm/hit/<bust|awaken|awaken2>/<id>.webp 의 얼굴 가운데를 찾아
  tools/sprite-kit/hit-focus.json          {열쇠: {fx, fy, src: 'haar'|'manual'|'none', conf, size, mt, h}}   (쌓아 두는 장부 · 증분 · mt 수정 시각 · h 그림 지문)
  src/ui/hit-focus.generated.ts            HIT_FOCUS = {열쇠: [가로 0~1, 세로 0~1]}                      (화면이 읽는 것 · 통째로 다시 쓴다)
에 적는다. 화면은 이 자리가 보이게 그림을 좌우(위아래)로 민다. 자료 없는 그림은 화면 쪽 기본 자리(가운데)다.

찾는 법: cv2 에 딸린 Haar (정면 alt2 · default · 옆얼굴 profileface 와 그 좌우 뒤집기)를 그림을 −45~45도로 돌려 가며 돌린다
(피격 그림은 고개가 꺾이고 화면이 10도쯤 기울어 있다). 후보를 자리로 묶고, 크기 · 위치(위쪽 70% 안) · 살빛 · 겹친 수로 하나를 고른다.
새 모델 파일을 받지 않는다 · 인터넷 안 씀.

손으로 바로잡은 값 tools/sprite-kit/hit-focus-manual.json {열쇠: [fx, fy]} 이 늘 이긴다 (null 이면 「자료 없음」으로 못 박는다).

  py -3 -I tools/hit-focus.py                       새 그림 · 바뀐 그림만 재고 두 파일을 다시 쓴다 (hit-intake.py 가 맨 끝에서 부른다)
  py -3 -I tools/hit-focus.py --all                 전부 다시 잰다 (630장에 20분쯤 · 한 장에 한 코어로 15초)
  py -3 -I tools/hit-focus.py --sheet <폴더>         검수 접촉 시트 (8×8 칸 · 번호 · 열쇠 끝 · 찾은 자리에 십자표)
  py -3 -I tools/hit-focus.py --faces <폴더> [열쇠|번호…]  찾은 자리 둘레만 오려 깐 시트 (10×7 칸 · 칸 한가운데가 얼굴이어야 한다)
  py -3 -I tools/hit-focus.py --grid <폴더> 열쇠|번호…  10×10 눈금을 얹은 큰 칸 (눈으로 자리 읽기 · --none 자료 없는 것 전부 · --manual 손값 전부)

검수 (11-18 · 627장): 접촉 시트와 얼굴 시트를 전부 눈으로 보고 Haar 가 틀린 열일곱 장(술잔 · 손 · 어깨 · 창날에 찍힘)을 손값으로 바로잡았다.
새 그림이 들어오면 「새로 잼」 줄에 뜬 것을 --faces 로 한 번 본다 (Haar 는 마흔 장에 한 장꼴로 얼굴 아닌 데를 짚는다).
"""
import argparse
import hashlib
import json
import math
import os
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
HIT = ROOT / 'public/realm/hit'
STORE = ROOT / 'tools/sprite-kit/hit-focus.json'
MANUAL = ROOT / 'tools/sprite-kit/hit-focus-manual.json'
TS = ROOT / 'src/ui/hit-focus.generated.ts'
FORMS = ('bust', 'awaken', 'awaken2')

WORK = 640                                   # 재는 크기 (긴 변 px)
ANGLES = (0, -10, 10, -20, 20, -30, 30, -45, 45)
FACE_MIN, FACE_MAX = 0.07, 0.50              # 얼굴 한 변 ÷ 그림 폭
MIN_CONF = 0.30                              # 이보다 낮으면 화면 자료에 넣지 않는다
TS_HEAD = ('// 자동 생성 — tools/hit-focus.py (손으로 고치지 말 것)\n'
           "// 피격 그림마다 얼굴 가운데 자리 [가로 0~1, 세로 0~1]. 열쇠는 HIT_ART 와 같은 꼴('bust/<id>' · 'awaken/<id>' · 'awaken2/<id>').\n"
           '// 없는 열쇠는 화면 쪽 기본 자리를 쓴다.\n')
TS_DECL = 'export const HIT_FOCUS: Readonly<Record<string, readonly [number, number]>> = '


# ── 그림 목록
def images():
    out = {}
    for form in FORMS:
        for p in sorted((HIT / form).glob('*.webp')):
            out[f'{form}/{p.stem}'] = p
    return dict(sorted(out.items()))


def stamp(p):
    return int(p.stat().st_mtime), hashlib.md5(p.read_bytes()).hexdigest()[:12]


# ── Haar
_CASC = None


def cascades():
    global _CASC
    if _CASC is None:
        d = cv2.data.haarcascades
        alt2 = cv2.CascadeClassifier(d + 'haarcascade_frontalface_alt2.xml')
        default = cv2.CascadeClassifier(d + 'haarcascade_frontalface_default.xml')
        prof = cv2.CascadeClassifier(d + 'haarcascade_profileface.xml')
        # (이름, 분류기, 무게, 좌우 뒤집기, 이웃 수 바닥)
        _CASC = [('alt2', alt2, 1.0, False, 2), ('default', default, 0.5, False, 4), ('profile', prof, 0.8, False, 3), ('profile', prof, 0.8, True, 3)]
    return _CASC


def skin_mask(rgb):
    """살빛 (YCrCb · 넉넉히) — 얼굴 후보를 갑옷 · 털 · 불빛과 가르는 데만 쓴다"""
    ycc = cv2.cvtColor(rgb, cv2.COLOR_RGB2YCrCb)
    y, cr, cb = ycc[..., 0], ycc[..., 1], ycc[..., 2]
    return ((y > 70) & (cr > 136) & (cr < 178) & (cb > 82) & (cb < 128)).astype(np.float32)


def detect(path):
    """얼굴 하나 → {fx, fy, size, conf, n} 또는 None"""
    rgb = np.array(Image.open(path).convert('RGB'))
    h0, w0 = rgb.shape[:2]
    k = WORK / max(h0, w0)
    rgb = cv2.resize(rgb, (round(w0 * k), round(h0 * k)), interpolation=cv2.INTER_AREA)
    H, W = rgb.shape[:2]
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    skin = skin_mask(rgb)
    mn, mx = int(FACE_MIN * W), int(FACE_MAX * W)
    cands = []   # (x, y, size, 무게, 각도, 이름)  — 0~1
    for a in ANGLES:
        M = cv2.getRotationMatrix2D((W / 2, H / 2), a, 1.0)
        c, s = abs(M[0, 0]), abs(M[0, 1])
        nW, nH = int(H * s + W * c), int(H * c + W * s)
        M[0, 2] += nW / 2 - W / 2
        M[1, 2] += nH / 2 - H / 2
        rot = cv2.equalizeHist(cv2.warpAffine(gray, M, (nW, nH), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE))
        inv = cv2.invertAffineTransform(M)
        flipped = None
        for name, casc, wt, flip, nb in cascades():
            img = rot
            if flip:
                if flipped is None:
                    flipped = cv2.flip(rot, 1)
                img = flipped
            rects, nums = casc.detectMultiScale2(img, scaleFactor=1.08, minNeighbors=nb, minSize=(mn, mn), maxSize=(mx, mx))
            for (x, y, w, h), n in zip(rects, nums):
                cx, cy = x + w / 2, y + h / 2
                if flip:
                    cx = nW - cx
                ox = inv[0, 0] * cx + inv[0, 1] * cy + inv[0, 2]
                oy = inv[1, 0] * cx + inv[1, 1] * cy + inv[1, 2]
                if not (0 <= ox < W and 0 <= oy < H):
                    continue
                cands.append((ox / W, oy / H, w / W, wt * min(int(n), 14), a, name))
    if not cands:
        return None
    # 자리로 묶기
    cands.sort(key=lambda q: -q[3])
    groups = []
    for q in cands:
        for g in groups:
            if math.hypot(q[0] - g['x'], q[1] - g['y']) < 0.40 * max(q[2], g['s']) and 0.5 < q[2] / g['s'] < 2.0:
                t = g['w'] + q[3]
                g['x'] = (g['x'] * g['w'] + q[0] * q[3]) / t
                g['y'] = (g['y'] * g['w'] + q[1] * q[3]) / t
                g['s'] = (g['s'] * g['w'] + q[2] * q[3]) / t
                g['w'] = t
                g['angles'].add(q[4]); g['names'].add(q[5]); g['n'] += 1
                break
        else:
            groups.append({'x': q[0], 'y': q[1], 's': q[2], 'w': q[3], 'angles': {q[4]}, 'names': {q[5]}, 'n': 1})
    for g in groups:
        # 위치 — 위쪽 70% 안 · 아래로 갈수록 덜 믿는다
        py = 1.0 if g['y'] <= 0.50 else (0.55 if g['y'] <= 0.70 else 0.12)
        # 크기 — 흔한 얼굴은 폭의 0.10~0.36
        ps = 1.0 if 0.10 <= g['s'] <= 0.36 else 0.5
        # 살빛 — 얼굴 안쪽 네모의 살빛 몫
        r = g['s'] * 0.30
        x0, x1 = int(max(0, (g['x'] - r) * W)), int(min(W, (g['x'] + r) * W))
        y0, y1 = int(max(0, (g['y'] - r) * H)), int(min(H, (g['y'] + r) * H))
        sk = float(skin[y0:y1, x0:x1].mean()) if x1 > x0 and y1 > y0 else 0.0
        pk = 0.25 + 0.75 * min(1.0, sk / 0.40)
        g['skin'] = sk
        g['score'] = g['w'] * (1 + 0.20 * (len(g['angles']) - 1)) * (1.25 if 'alt2' in g['names'] else 1.0) * py * ps * pk
    groups.sort(key=lambda g: -g['score'])
    best = groups[0]
    second = groups[1]['score'] if len(groups) > 1 else 0.0
    conf = (1 - math.exp(-best['score'] / 10.0)) * (1 - 0.6 * min(1.0, second / best['score']) ** 2)
    return {'fx': round(float(best['x']), 3), 'fy': round(float(best['y']), 3), 'size': round(float(best['s']), 3), 'conf': round(float(conf), 2), 'n': best['n'], 'skin': round(best['skin'], 2)}


def _work(item, single=True):
    key, path = item
    if single:
        cv2.setNumThreads(1)   # 일꾼마다 한 줄 — 일꾼 여럿 × cv2 줄 여럿이면 서로 밀린다
    try:
        return key, detect(path)
    except Exception as e:   # 한 장이 깨져도 나머지는 간다
        return key, {'err': str(e)}


# ── 장부
def load_json(p):
    if not p.exists():
        return {}
    return json.loads(p.read_text(encoding='utf-8'))


def save_store(store):
    lines = [f'  {json.dumps(k)}: {json.dumps(v, ensure_ascii=False, separators=(", ", ": "))}' for k, v in sorted(store.items())]
    STORE.write_bytes(('{\n' + ',\n'.join(lines) + '\n}\n').encode('utf-8'))


def measure(redo_all=False):
    imgs = images()
    manual = load_json(MANUAL)
    old = {} if redo_all else load_json(STORE)
    store, todo, stale = {}, [], []
    for key in manual:
        if key not in imgs:
            print('  손값 열쇠에 그림이 없다:', key)
    for key, p in imgs.items():
        e = old.get(key)
        if key in manual:
            v = manual[key]      # [fx, fy] · null 이면 「자료 없음」으로 못 박기
            mt, h = stamp(p)
            if e is not None and e.get('src') == 'manual' and e.get('h') not in (None, h):
                stale.append(key)      # 손값을 적은 뒤 그림이 바뀌었다 — 값은 그대로 두되 알린다
            store[key] = {'fx': None if v is None else round(float(v[0]), 2), 'fy': None if v is None else round(float(v[1]), 2), 'src': 'manual', 'conf': 1, 'mt': mt, 'h': h}
            continue
        if e is not None and e.get('src') in ('haar', 'none') and 'mt' in e:
            mt = int(p.stat().st_mtime)
            if e['mt'] == mt:
                store[key] = e
                continue
            mt, h = stamp(p)
            if e.get('h') == h:          # 시각만 바뀌고 그림은 그대로 (체크아웃 등)
                store[key] = {**e, 'mt': mt}
                continue
        todo.append((key, p))
    if todo:
        print(f'재는 중 {len(todo)}장 … (한 장에 한 코어로 15초쯤)', flush=True)
        workers = max(1, (os.cpu_count() or 2) - 2)

        def keep(key, r):
            mt, h = stamp(imgs[key])
            if r is None or 'err' in r:
                store[key] = {'fx': None, 'fy': None, 'src': 'none', 'conf': 0, 'mt': mt, 'h': h}
                if r is not None:
                    print('  못 읽음', key, r['err'])
            else:
                store[key] = {'fx': r['fx'], 'fy': r['fy'], 'src': 'haar', 'conf': r['conf'], 'size': r['size'], 'mt': mt, 'h': h}

        if len(todo) < 4 or workers == 1:      # 몇 장이면 일꾼 없이 (cv2 가 제 줄을 쓴다)
            for item in todo:
                keep(*_work(item, False))
        else:
            with ProcessPoolExecutor(max_workers=min(workers, len(todo))) as ex:
                for key, r in ex.map(_work, todo, chunksize=2):
                    keep(key, r)
    save_store(store)
    for key in stale:
        print(f'  ! 손값이 있는 그림이 바뀌었다: {key} — tools/sprite-kit/hit-focus-manual.json 의 자리를 다시 볼 것 (--faces <폴더> {key})')
    return store, [key for key, _ in todo]


def focus_of(store):
    """화면에 내보낼 것만 — 손값 · 믿을 만한 Haar"""
    out = {}
    for key, e in sorted(store.items()):
        if e['fx'] is not None and (e['src'] == 'manual' or (e['src'] == 'haar' and e['conf'] >= MIN_CONF)):
            out[key] = [round(min(1.0, max(0.0, e['fx'])), 2), round(min(1.0, max(0.0, e['fy'])), 2)]
    return out


def write_ts(focus):
    body = json.dumps(focus, ensure_ascii=False, separators=(',', ':'), sort_keys=True)
    TS.write_bytes((TS_HEAD + TS_DECL + body + '\n').encode('utf-8'))


def report(store, focus):
    n = len(store)
    haar = sum(1 for k in focus if store[k]['src'] == 'haar')
    man = sum(1 for k in focus if store[k]['src'] == 'manual')
    none = n - len(focus)
    off = sorted(((abs(v[0] - 0.5), k, v[0]) for k, v in focus.items() if abs(v[0] - 0.5) > 0.2), reverse=True)
    print(f'전체 {n} · Haar {haar} · 손 {man} · 자료 없음 {none} ({(none / n * 100 if n else 0):.1f}%) · 가로 0.2 넘게 벗어남 {len(off)}')
    for d, k, fx in off[:10]:
        print(f'  {k}  fx {fx:.2f}')


# ── 검수 시트
def font(size):
    for name in ('arialbd.ttf', 'arial.ttf', 'malgun.ttf'):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            pass
    return ImageFont.load_default()


SHORT = {'bust': 'b', 'awaken': 'a1', 'awaken2': 'a2'}


def cross(d, x, y, r, col):
    """얼굴을 가리지 않는 십자표 — 둘레 고리 + 바깥 눈금 넷 + 가운데 점"""
    for w, c in ((4, (0, 0, 0)), (2, col)):
        d.ellipse([x - r, y - r, x + r, y + r], outline=c, width=w)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            d.line([x + dx * r, y + dy * r, x + dx * (r + 7), y + dy * (r + 7)], fill=c, width=w)
    d.ellipse([x - 2, y - 2, x + 2, y + 2], fill=col, outline=(0, 0, 0))


def sheets(store, out, cols=8, rows=8, cell=192, bar=16):
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob('sheet-*.jpg'):
        old.unlink()
    imgs = images()
    keys = list(imgs)
    f = font(11)
    per = cols * rows
    index = []
    for s in range(0, len(keys), per):
        sheet = Image.new('RGB', (cols * cell, rows * (cell + bar)), (16, 18, 22))
        d = ImageDraw.Draw(sheet)
        for i, key in enumerate(keys[s:s + per]):
            n = s + i
            x0, y0 = (i % cols) * cell, (i // cols) * (cell + bar)
            sheet.paste(Image.open(imgs[key]).convert('RGB').resize((cell, cell), Image.LANCZOS), (x0, y0 + bar))
            e = store[key]
            form, pid = key.split('/')
            tag = f'{n} {SHORT[form]}/{pid[:17]}'
            if e['fx'] is None:
                col, tag = (255, 60, 60), tag + ' X'
            elif e['src'] == 'manual':
                col = (60, 220, 255)
            elif e['conf'] < MIN_CONF:
                col, tag = (255, 150, 40), tag + f' {e["conf"]:.2f}?'
            else:
                col, tag = (90, 255, 90), tag + f' {e["conf"]:.2f}'
            d.rectangle([x0, y0, x0 + cell - 1, y0 + bar - 1], fill=(0, 0, 0))
            d.text((x0 + 2, y0 + 1), tag, fill=col, font=f)
            if e['fx'] is not None:
                cross(d, x0 + e['fx'] * cell, y0 + bar + e['fy'] * cell, max(9, e.get('size', 0.16) * cell * 0.5), col)
            d.rectangle([x0, y0, x0 + cell - 1, y0 + bar + cell - 1], outline=(60, 60, 60))
            index.append(f'{n}\t{key}\t{e["src"]}\t{e["conf"]}\t{e["fx"]}\t{e["fy"]}')
        name = out / f'sheet-{s // per + 1:02d}.jpg'
        sheet.save(name, quality=88)
        print(name)
    (out / 'index.tsv').write_bytes(('\n'.join(index) + '\n').encode('utf-8'))


def faces(store, out, only=None, cols=10, rows=7, cell=152, bar=14, span=0.34):
    """찾은 자리 둘레만 오려 깐 시트 — 칸 한가운데에 얼굴이 없으면 틀린 것"""
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob('faces-*.jpg'):
        old.unlink()
    imgs = images()
    keys = list(imgs)
    picks = [k for k in (only or keys) if store[k]['fx'] is not None]
    f = font(10)
    per = cols * rows
    for s in range(0, len(picks), per):
        sheet = Image.new('RGB', (cols * cell, rows * (cell + bar)), (16, 18, 22))
        d = ImageDraw.Draw(sheet)
        for i, key in enumerate(picks[s:s + per]):
            e = store[key]
            x0, y0 = (i % cols) * cell, (i // cols) * (cell + bar)
            im = Image.open(imgs[key]).convert('RGB')
            W, H = im.size
            r = span * W / 2
            crop = im.crop((round(e['fx'] * W - r), round(e['fy'] * H - r), round(e['fx'] * W + r), round(e['fy'] * H + r)))   # 바깥은 검게
            sheet.paste(crop.resize((cell, cell), Image.LANCZOS), (x0, y0 + bar))
            form, pid = key.split('/')
            col = (60, 220, 255) if e['src'] == 'manual' else ((255, 150, 40) if e['conf'] < MIN_CONF else (90, 255, 90))
            d.rectangle([x0, y0, x0 + cell - 1, y0 + bar - 1], fill=(0, 0, 0))
            d.text((x0 + 2, y0 + 1), f'{keys.index(key)} {SHORT[form]}/{pid[:15]}', fill=col, font=f)
            cx, cy = x0 + cell / 2, y0 + bar + cell / 2
            d.ellipse([cx - 2, cy - 2, cx + 2, cy + 2], fill=col, outline=(0, 0, 0))
            d.rectangle([x0, y0, x0 + cell - 1, y0 + bar + cell - 1], outline=(60, 60, 60))
        name = out / f'faces-{s // per + 1:02d}.jpg'
        sheet.save(name, quality=88)
        print(name)


def grids(store, out, picks, cols=3, rows=2, cell=500, pad=22):
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob('grid-*.jpg'):
        old.unlink()
    imgs = images()
    keys = list(imgs)
    f, fb = font(13), font(16)
    per = cols * rows
    step = cell + pad
    for s in range(0, len(picks), per):
        sheet = Image.new('RGB', (cols * step, rows * (step + pad)), (16, 18, 22))
        d = ImageDraw.Draw(sheet)
        for i, key in enumerate(picks[s:s + per]):
            x0, y0 = (i % cols) * step + pad, (i // cols) * (step + pad) + pad * 2
            sheet.paste(Image.open(imgs[key]).convert('RGB').resize((cell, cell), Image.LANCZOS), (x0, y0))
            d.text((x0 - pad + 2, y0 - pad * 2 + 2), f'{keys.index(key)} {key}', fill=(255, 235, 120), font=fb)
            for t in range(11):
                g = t * cell / 10
                major = t % 5 == 0
                for w, c in ((3, (0, 0, 0)), (1, (255, 255, 0) if major else (0, 255, 255))):
                    d.line([x0 + g, y0, x0 + g, y0 + cell], fill=c, width=w)
                    d.line([x0, y0 + g, x0 + cell, y0 + g], fill=c, width=w)
                if t < 10:
                    d.text((x0 + g + 3, y0 - pad + 4), f'.{t}', fill=(255, 255, 255), font=f)
                    d.text((x0 - pad + 2, y0 + g + 3), f'.{t}', fill=(255, 255, 255), font=f)
            e = store[key]
            if e['fx'] is not None:
                cross(d, x0 + e['fx'] * cell, y0 + e['fy'] * cell, 5, (255, 60, 200))
        name = out / f'grid-{s // per + 1:02d}.jpg'
        sheet.save(name, quality=90)
        print(name, ' '.join(picks[s:s + per]))


def main():
    if not sys.stdout.isatty():      # 관에 물리면 UTF-8 로 (창에 바로 찍을 땐 파이썬이 알아서 한다)
        try:
            sys.stdout.reconfigure(encoding='utf-8')
        except Exception:
            pass
    ap = argparse.ArgumentParser()
    ap.add_argument('--all', action='store_true', help='전부 다시 잰다 (630장에 20분쯤)')
    ap.add_argument('--sheet', metavar='폴더', help='검수 접촉 시트')
    ap.add_argument('--faces', metavar='폴더', help='찾은 자리 둘레만 오려 깐 시트 (열쇠·번호를 주면 그것만)')
    ap.add_argument('--grid', metavar='폴더', help='10×10 눈금 큰 칸 (열쇠·번호)')
    ap.add_argument('--none', action='store_true', help='--grid 에 자료 없는 것을 다 더한다')
    ap.add_argument('--manual', action='store_true', help='--faces · --grid 에 손으로 적은 것을 다 더한다')
    ap.add_argument('picks', nargs='*')
    a = ap.parse_args()
    store, fresh = measure(a.all)
    focus = focus_of(store)
    write_ts(focus)
    report(store, focus)
    if 0 < len(fresh) <= 60:
        for k in fresh:
            e = store[k]
            print(f'  새로 잼 {k}  ' + ('못 찾음' if e['src'] == 'none' else f'[{e["fx"]:.2f}, {e["fy"]:.2f}] 믿음 {e["conf"]:.2f}' + ('' if e['conf'] >= MIN_CONF else ' (낮아서 뺌)')))
    if fresh:
        print('  새로 잰 자리는 눈으로 한 번: py -3 -I tools/hit-focus.py --faces D:/tmp-node/hit-focus ' + (' '.join(fresh) if len(fresh) <= 12 else '') + '  · 틀리면 tools/sprite-kit/hit-focus-manual.json 에 [fx, fy]')
    keys = list(images())
    picks = [keys[int(p)] if p.isdigit() else p for p in a.picks]
    bad = [p for p in picks if p not in store]
    if bad:
        print('  없는 열쇠:', ' '.join(bad))
    picks = [p for p in picks if p in store]
    if a.manual:
        picks += [k for k in keys if store[k]['src'] == 'manual' and store[k]['fx'] is not None and k not in picks]
    if a.sheet:
        sheets(store, a.sheet)
    if a.faces:
        faces(store, a.faces, picks or None)
    if a.grid:
        if a.none:
            picks += [k for k in keys if k not in focus and k not in picks]
        grids(store, a.grid, picks)


if __name__ == '__main__':
    main()
