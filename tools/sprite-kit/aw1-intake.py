# -*- coding: utf-8 -*-
"""1차 각성 전투 띠 받아 넣기 (11-18 · tools/remake-jobs.mjs 묶음 'remake-sprite-aw' · SPA-<who>-act/walk). 절차 요약은 AW1-INTAKE.md.

챗지피티(Codex)가 준 두 장 (D:/에셋창고 뿌리나 Codex-*-candidates/ (어느 묶음이든) · 읽기만 · 이름 끝 -숫자12자리는 원본 사본이라 안 본다):
  sprite_aw1_<who>_act.png   4x5 스무 자세 (서기 · 걷기 · 공격 · 막기 · 비틀 · 맞음 · 누움 · 칸 차례가 장수마다 조금씩 다르다)
  sprite_aw1_<who>_walk.png  4x2 걷기 여덟 칸
<who> = 비각성 띠 열쇠(nonawakened-20261113/queue.json 의 key · 띠 gen-<who>). 넣는 이름은 기존 열 명과 같은 aw1-<who>.

길 (prop-intake.py 와 같은 틀 · 굽기는 bake-full20.py · 등록은 awakened-20261114/queue.json → repairs/20261113 → sprite-normalize):
  py -3 -I tools/sprite-kit/aw1-intake.py stage [--only who[,who]] [--force]      새 짝을 찾아 숫자 검사 + 시험 굽기 + 검수 그림
        고쳐 다시(--only 한 명):  --attack a,b,c,d,e,f (띠 12~17 칸에 넣을 원본 자세 번호 0~19) · --hit n · --dead n · --guard n[,n] · --stagger n[,n]
                    --top-base y · --top-aw y · --chin-base y · --chin-aw y (detail.png 머리 자의 줄 번호 · 머리 찾기가 틀렸을 때) · --walk-scale 1.03 (걷기 판 배율 곱)
  (tools/out/aw1-intake/<who>/detail.png 을 눈으로 본다)
  py -3 -I tools/sprite-kit/aw1-intake.py review <who> accept --note "..."   |   review <who> reject --reason "one English line for the redraw prompt"
  py -3 -I tools/sprite-kit/aw1-intake.py install                              받아들인 것만 넣는다 → sprite-normalize · heights · walk-cycle-table
  py -3 -I tools/sprite-kit/aw1-intake.py sheet [--status installed|staged|accepted|rejected|all] [--keys a,b] [--out 경로.jpg]
        여러 명 한 장: 비각성 서기 | 각성 서기 | 각성 걷기 1·5 | 각성 공격 맞닿음 | 각성 초상 (D:/tmp-node/aw1/sheet-NN.jpg)
  py -3 -I tools/sprite-kit/aw1-intake.py list                                 지금 상태 (짝 기다림 · 검수 대기 · 반려 까닭)
  py -3 -I tools/sprite-kit/aw1-intake.py measure --who <who> --act <png> [--walk <png>]
        저장 전에 스스로 재기(Codex). 영수증·저장소 파일은 안 건드린다(임시 폴더에서만 굽는다). 출력은 영어·숫자 한 줄씩:
        who= · cells_act= · cells_walk= · head_x=(같은 키에서 머리 높이 비 · 못 재면 ?) · walk_vs_act=(같은 몸 크기에서 걷기 머리/동작 머리 · 비각성 띠의 같은 비에 견줌) · walk_legs=(걷기 다리 검사) · reason= · VERDICT PASS|HOLD|FAIL
        금: head_x 1.06 이하 PASS · 1.12 이하 HOLD · 넘으면 FAIL / walk_vs_act 가 1 에서 10% 넘게 벗어나면 FAIL / 칸 수(20 · 8)·투명 바탕·칸 잘림 FAIL
        걷기 다리 검사(11-18): 각성 걷기 여덟 칸이 비각성 걷기(walkref)의 같은 칸을 반대 다리 칸보다 닮아야 한다(여덟 중 6 이상 · 가운데 차 .03 이상) · 아니면 FAIL (1·5 같은 다리 반걸음 되풀이 · 새로 그림). stage 도 같은 검사로 걷기 판만 자동 반려
        종료 코드 PASS 0 · HOLD/FAIL 1 · 쓰는 법이 틀리면(모르는 who · 없는 파일) VERDICT ERROR 2
다시 그린 판: sprite_aw1_<who>_act_v2.png · _walk_v2.png (v3 …). 가장 높은 판을 쓰고 같은 판끼리만 짝짓는다(동작 v2 + 걷기 v1 은 짝이 아니다 → 기다림).
  예외: `review <who> reject --walk-only --reason ...` 로 「동작 판은 통과 · 걷기 판만 다시」 라고 적힌 장수는 그 동작 판 + 더 높은 걷기 판을 짝짓는다.
영수증: tools/sprite-kit/aw1-intake-20261118.json

머리·키 재기: 살색으로 얼굴을 찾는 길은 이 그림체에서 못 믿는다(털·금·맨살이 다 살색). 그래서 비각성 서기 칸의 머리(몸 위 36%)를
  본으로 떠 각성 서기 칸에서 배율을 바꿔 가며 찾는다(cv2.matchTemplate). 거기서 「머리 배율」 과 「머리 위끝 자리」 가 나온다.
  head = 같은 키로 놓았을 때 각성 머리 높이 / 비각성 머리 높이 (1.00 이 같은 등신 · 1.05 넘으면 경고 · 1.06 넘으면 accept 가 막힌다)
키 맞추기: 게임 본편은 띠의 bodyPx 가 같은 화면 키가 되게 키우고(art.ts genArtOf), 열전은 160칸을 그대로 그린다(raid/haebi-view.ts sprite).
  그래서 각성 띠는 「머리 위끝(머리 장식 뺀 자리)~발」 픽셀이 비각성 띠와 같게 굽고(job.idlePx), bodyPx 는 비각성 띠의 값(headgear.json 으로
  머리 장식을 뺀 값)을 그대로 쓴다(job.bodyPx). → 각성 머리 장식이 더 커도 정수리·발은 같은 자리에 온다.
  비각성 띠의 headgear.json 값을 바꾸면 그 장수는 stage --force → review → install 을 다시 한다.
"""
import argparse, hashlib, importlib.util, json, re, shutil, subprocess, sys
from pathlib import Path
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage

for _s in (sys.stdout, sys.stderr): _s.reconfigure(encoding='utf-8', errors='replace')   # 콘솔이 cp949 여도 한글·기호가 깨지지 않게
sys.dont_write_bytecode = True               # measure 는 저장소에 아무것도 남기지 않는다 (__pycache__ 도)
KIT = Path(__file__).resolve().parent
ROOT = KIT.parents[1]
NA = KIT / 'nonawakened-20261113'
AW = KIT / 'awakened-20261114'
SRC = AW / 'intake-20261118'                 # 받은 그림 사본 (원본 자리 D:/에셋창고 는 그대로)
RECEIPT = KIT / 'aw1-intake-20261118.json'
OUT = ROOT / 'tools/out/aw1-intake'
RETIRE = ROOT / 'assets_src/realm/retired/aw1-20261118'
PX = ROOT / 'public/realm/anim-px'
REPAIRS = KIT / 'repairs/20261113'
SHEETS = Path('D:/tmp-node/aw1')
INBOX = 'D:/에셋창고'
TODAY = '2026-11-18'
HEAD_WARN, TALL_WARN = 1.05, 0.05            # 머리 5% 넘게 큼 · 키 5% 넘게 다름 → 경고
HEAD_OK = 1.06                               # 이보다 크면 accept 가 막힌다 (--override 로만)
HEAD_HOLD, WALK_OFF = 1.12, .10              # 11-18 첫 묶음의 금: 머리 1.06~1.12 보류 · 넘으면 반려 / 걷기 판 등신 차 10% 넘으면 걷기 판 반려
WALK_HEAD = .985                             # 걷기 칸 머리 / 서기 칸 머리 (기존 각성 띠 열 벌의 중앙값 · 11-18 부터는 비각성 띠에서 잰 값 base_walk_ratio 를 먼저 쓴다)
PAD, FRAC = 3, .36                           # 머리 본: 몸 위 36% · 둘레 3px

spec = importlib.util.spec_from_file_location('full20', KIT / 'bake-full20.py')
bk = importlib.util.module_from_spec(spec); spec.loader.exec_module(bk)


def sha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def rel(p): return Path(p).resolve().relative_to(ROOT).as_posix()
def load(p, d): return json.loads(Path(p).read_text('utf-8')) if Path(p).exists() else d
def save(p, v, ascii_=False): Path(p).write_bytes((json.dumps(v, ensure_ascii=ascii_, indent=2) + '\n').encode('utf-8'))
def font(n=14):
    try: return ImageFont.truetype('C:/Windows/Fonts/malgun.ttf', n)
    except OSError: return ImageFont.load_default()


def receipt():
    return load(RECEIPT, None) or {
        'date': TODAY,
        'why': '형 11-18 「챗지피티 쉬는 중 · 할 일 넘겨줘」 + 설계 연구: 각성 전투 띠가 열 명뿐 → SPA-<who>-act/walk 201명 · 이 영수증이 받은 그림·숫자 검사·눈 검수·설치 기록',
        'method': 'aw1-intake.py · bake-full20.py (동작 4x5 + 걷기 4x2 → 띠 20칸) · 머리 본 맞추기로 머리 위끝~발 픽셀을 비각성 띠와 같게(idlePx) · bodyPx = 비각성 띠 값 · 공격 칸은 원본 자세를 골라 띠 12~17 에 · head = 같은 키에서 머리 높이 비',
        'heroes': {}}


def inbox(root, rc=None):
    """who → dict(act · walk(없으면 None) · actV · walkV · pair · wait). 뿌리(정식 자리)가 먼저, 그다음 후보 폴더 중 가장 새것.
    판 = 이름 끝 _v2 · _v3 … (없으면 1). 가장 높은 판을 쓰고 같은 판끼리만 짝짓는다.
    예외: 영수증에 「동작 판은 통과 · 걷기 판만 다시」(review reject --walk-only → actOk)로 적힌 장수는 그 동작 판 + 더 높은 걷기 판"""
    root = Path(root); found = {}
    for rank, d in enumerate([root] + sorted(root.glob('Codex-*-candidates'))):
        for p in d.glob('sprite_aw1_*.png'):
            m = re.fullmatch(r'sprite_aw1_(.+)_(act|walk)(?:_v(\d+))?\.png', p.name)
            if not m: continue
            who, kind, v = m.group(1), m.group(2), int(m.group(3) or 1); key = (0 if rank == 0 else 1, -p.stat().st_mtime)
            cur = found.setdefault(who, {}).setdefault(kind, {}).get(v)
            if cur is None or key < cur[0]: found[who][kind][v] = (key, p)
    out = {}
    for who, d in sorted(found.items()):
        va, vw = max(d.get('act', {}), default=None), max(d.get('walk', {}), default=None)
        f = dict(act=d['act'][va][1] if va else None, walk=d['walk'][vw][1] if vw else None, actV=va, walkV=vw, pair=False, wait=None)
        ok = (rc or {}).get('heroes', {}).get(who, {}).get('actOk') or {}
        if va is None: f['wait'] = 'act'
        elif vw is None: f['wait'] = 'walk'
        elif va == vw: f['pair'] = True
        elif vw > va and ok.get('version', 1) == va and ok.get('sha256') == sha(f['act']): f['pair'] = True
        # 11-19: 동작 판을 같은 이름(v1)으로 새로 받고 걷기 판은 v2 로 온 경우(mdallae · sincheongan) — 걷기 판이 동작 판보다 뒤에 만들어졌으면 이 동작 판에 맞춘 걷기다
        elif vw > va and Path(f['walk']).stat().st_mtime > Path(f['act']).stat().st_mtime and (rc or {}).get('heroes', {}).get(who, {}).get('status') != 'installed': f['pair'] = True
        else: f['wait'] = 'walk' if va > vw else 'act'
        out[who] = f
    return out


# ---------- 재기 ----------
def cells(path):
    im = Image.open(path).convert('RGBA'); cw = im.width // 20
    return [im.crop((i * cw, 0, (i + 1) * cw, im.height)) for i in range(20)], cw


def body_top(im, k=7):
    """가는 창 자루·깃털을 깎은 몸 덩어리(가장 큰 것)의 위끝 · 발바닥 · 가운데 x"""
    a = np.array(im)[..., 3] > 64
    o = ndimage.binary_opening(a, structure=np.ones((k, k)))
    lab, n = ndimage.label(o)
    if n == 0: return None
    big = 1 + int(np.argmax(ndimage.sum(o, lab, range(1, n + 1))))
    ys, xs = np.nonzero(lab == big)
    return int(ys.min()), int(np.where(a.any(1))[0][-1]), int(np.median(xs))


def gray(im):
    bg = Image.new('RGBA', im.size, (128, 128, 128, 255)); bg.alpha_composite(im); return np.asarray(bg.convert('L'), dtype=np.float32)


def head_tpl(cell, top=None):
    """머리 쪽 그림(머리 위끝에서 몸 키의 36%) → (회색 그림, 그림 안에서 머리 위끝 줄)"""
    t0, feet, _ = body_top(cell); top = t0 if top is None else int(round(top)); H = feet - top
    a = np.array(cell)[..., 3] > 64; y0, y1 = max(0, top - PAD), top + int(H * FRAC)
    xs = np.nonzero(a[y0:y1].any(0))[0]
    return gray(cell.crop((max(0, int(xs.min()) - PAD), y0, min(cell.width, int(xs.max()) + PAD + 1), y1))), top - y0


def head_match(tpl_cell, tgt_cell, lo=.7, hi=1.6, step=.01, top=None):
    """tpl 칸의 머리를 tgt 칸에서 찾는다 → s(tgt 머리 / tpl 머리) · ncc(닮은 정도) · top(tpl 머리 위끝이 tgt 에서 놓인 줄) · box
    tgt 는 몸 위 62% 안에서만 찾는다 (허리춤 털가죽·방패 같은 것에 머리 본이 붙지 않게)"""
    g, off = head_tpl(tpl_cell, top); bt = body_top(tgt_cell)
    if not bt: return None
    tg = gray(tgt_cell)[:bt[0] + int((bt[1] - bt[0]) * .62)]; best = None
    for s in np.arange(lo, hi + 1e-6, step):
        w, h = max(8, round(g.shape[1] * s)), max(8, round(g.shape[0] * s))
        if h >= tg.shape[0] or w >= tg.shape[1]: continue
        r = cv2.matchTemplate(tg, cv2.resize(g, (w, h), interpolation=cv2.INTER_AREA if s < 1 else cv2.INTER_LINEAR), cv2.TM_CCOEFF_NORMED)
        _, v, _, loc = cv2.minMaxLoc(r)
        if best is None or v > best['ncc']: best = dict(ncc=float(v), s=float(s), top=loc[1] + off * float(s), box=[int(loc[0]), int(loc[1]), int(w), int(h)])
    return best


def proportion(bcells, acells, man_, raw):
    """서기 네 칸에서 비각성↔각성 머리를 서로 찾아: 머리 위끝 자리 · 키(머리 위끝~발) · head(같은 키에서 머리 높이 비)"""
    med = lambda xs: float(np.median(xs)); rows = []
    for i in range(4):
        tb, fb, _ = body_top(bcells[i]); ta, fa, _ = body_top(acells[i])
        if 'baseTop' in man_: tb = man_['baseTop']
        f = head_match(bcells[i], acells[i], top=tb)
        at = fa - man_['awTopFrac'] * raw if 'awTopFrac' in man_ else f['top']
        r = head_match(acells[i], bcells[i], top=at)          # 거꾸로: 각성 머리(머리 장식 뺀 자리부터)를 비각성에서
        rows.append(dict(tb=tb, fb=fb, ta=ta, fa=fa, at=at, s=f['s'], ncc=f['ncc'], box=f['box'],
                         pf=f['s'] * (fb - tb) / (fa - at), pr=(1 / r['s']) * (fb - r['top']) / (fa - at), ncc2=r['ncc']))
    pf, pr_, ncc, ncc2 = med([x['pf'] for x in rows]), med([x['pr'] for x in rows]), med([x['ncc'] for x in rows]), med([x['ncc2'] for x in rows])
    gear = med([x['at'] - x['ta'] for x in rows])      # 각성 머리 위로 솟은 것(관·깃털·든 무기) px
    sure = ncc >= .45 and ncc2 >= .4 and abs(pf / pr_ - 1) <= .1
    by = 'manual' if 'baseTop' in man_ and 'awTopFrac' in man_ else 'head' if sure else 'top'
    if by == 'top':
        for x in rows: x['at'] = x['ta']
    out = dict(by=by, Hb=med([x['fb'] - x['tb'] for x in rows]), Ha=med([x['fa'] - x['at'] for x in rows]),
               baseTop=med([x['tb'] for x in rows]), baseFeet=med([x['fb'] for x in rows]), awTop=med([x['at'] for x in rows]), awBodyTop=med([x['ta'] for x in rows]), awFeet=med([x['fa'] for x in rows]),
               headScale=round(med([x['s'] for x in rows]), 3), ncc=round(ncc, 2), ncc2=round(ncc2, 2), headFwd=round(pf, 3), headRev=round(pr_, 3), gear=round(gear, 1), box=rows[0]['box'])
    out['head'] = round(float(np.sqrt(pf * pr_)), 3) if sure else None
    return out


def cut_parts(path, cols, rows):
    """bake-full20 의 cut 과 같은 조각 (원본 해상도) · 걷기 배율·공격 자세 찾기에 쓴다"""
    im, labels, pieces = bk.figures(path, cols, rows); a = np.array(im); n = cols * rows
    if set(pieces) != set(range(n)): raise ValueError(f'expected {n} figures, found a figure in only these cells: {sorted(pieces)}')
    got = []
    for i in range(n):
        mask = np.isin(labels, pieces[i]); ys, xs = np.nonzero(mask)
        got.append(Image.fromarray(np.dstack([a[..., :3], (mask * 255).astype('uint8')])).crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)))
    return got


def sheet_stats(path):
    """판 한 장: 투명 바탕 비율 · 반투명 번짐(오라·빛·그림자 낌새) · 밝은 무채색 가장자리(흰 바탕·체크무늬 찌꺼기)"""
    a = np.array(Image.open(path).convert('RGBA')).astype(int); al = a[..., 3]
    solid = al > 200; edge = solid & ~ndimage.binary_erosion(solid, iterations=3)
    mx, mn = a[..., :3].max(-1), a[..., :3].min(-1)
    return dict(clear=round(float((al < 8).mean()), 3), halo=round(float(((al >= 24) & (al <= 200)).sum() / max(1, solid.sum())), 3),
                residue=round(float((edge & (mn > 200) & (mx - mn < 14)).sum() / max(1, edge.sum())), 4))


def pose_stats(parts):
    """동작 판 자세마다: 앞으로 뻗은 거리(몸 가운데~오른쪽 끝) · 키 · 폭 (서기 키를 1 로)"""
    unit = parts[0].height / 138; h0 = float(np.median([bk.core_height(p, unit) for p in parts[:4]]))
    out = []
    for p in parts:
        m = np.array(p)[..., 3] > 64
        o = ndimage.binary_opening(m, structure=np.ones((2 * max(1, round(bk.THIN * unit / 2)) + 1,) * 2))
        cx = float(np.nonzero(o if o.any() else m)[1].mean())
        out.append(dict(reach=round((p.width - cx) / h0, 3), h=round(p.height / h0, 3), w=round(p.width / h0, 3)))
    return out, h0


def guess_attack(st):
    """맞닿음 자세 = 8~16 가운데 처음으로 크게 뻗은 서 있는 자세 → 띠 12~17 = [서기, 앞 자세(당김), 맞닿음, 뻗음, 거둠, 서기]"""
    r0 = float(np.median([s['reach'] for s in st[:4]])); cand = [i for i in range(8, 17) if st[i]['h'] > .55]
    if not cand: return [0, 12, 13, 14, 15, 0]
    mx = max(st[i]['reach'] for i in cand)
    if mx <= r0: return [0, 12, 13, 14, 15, 0]
    c = next(i for i in cand if st[i]['reach'] >= r0 + .8 * (mx - r0))
    back = c + 3 if c + 3 <= 17 and st[c + 3]['h'] > .93 and st[c + 3]['reach'] < r0 + .3 * (mx - r0) else 0
    return [0, c - 1, c, min(17, c + 1), min(17, c + 2), back]


def lower(cell, frac=.4):
    a = np.array(cell); m = a[..., 3] > 64; ys = np.where(m.any(1))[0]
    y0 = int(ys[-1] - (ys[-1] - ys[0]) * frac); return a[y0:ys[-1] + 1], m[y0:ys[-1] + 1]


def walk_stats(ws):
    """걷기 여덟 칸: 1·5 아랫몸이 얼마나 다른가 · 앞뒤 다리 밝기가 뒤집히는가 · 발 벌림(닿음 칸 > 지나감 칸) · 거의 같은 이웃 칸 수"""
    def diff(i, j):
        A, B = lower(ws[i]), lower(ws[j]); h = min(A[0].shape[0], B[0].shape[0]); w = min(A[0].shape[1], B[0].shape[1])
        a, ma, b, mb = A[0][-h:, :w], A[1][-h:, :w], B[0][-h:, :w], B[1][-h:, :w]
        both = ma & mb; uni = ma | mb
        col = float(np.abs(a[..., :3].astype(int) - b[..., :3].astype(int)).mean(-1)[both].mean() / 255) if both.any() else 1.0
        return round(col, 3), round(float(both.sum() / max(1, uni.sum())), 3)
    def shade(i):
        a, m = lower(ws[i], .28); cx = int(np.nonzero(m)[1].mean()); l = (a[..., :3].astype(float) @ np.array([.299, .587, .114]))
        R, L = m.copy(), m.copy(); R[:, :cx] = False; L[:, cx:] = False
        return (float(l[R].mean()) if R.any() else 0) - (float(l[L].mean()) if L.any() else 0)
    def spread(i):
        _, m = lower(ws[i], .12); xs = np.nonzero(m)[1]; return int(xs.max() - xs.min() + 1)
    d15, iou15 = diff(0, 4)
    near = [diff(i, (i + 1) % 8) for i in range(8)]
    return dict(legDiff15=d15, legIou15=iou15, legShadeFlip=round((shade(0) - shade(4)) / 255, 3),
                stride=round((spread(0) + spread(4)) / max(1, spread(2) + spread(6)), 2),
                still=sum(1 for c, u in near if c < .035 and u > .93))


LEG_OWN, LEG_MARGIN, LEG_FRAME = 6, .03, .02   # 걷기 다리 검사 금: 여덟 칸 중 6칸 이상(칸마다 차 .02 넘게) · 가운데 차 .03 이상 (11-18 · 시험값: 비각성 걷기 색만 바꾼 판 .19~.35 · 새로 그린 판 -.03~.03)


def leg_feat(c, y0, y1):
    a = np.array(c).astype(float); m = a[..., 3] > 64
    L = (a[..., :3] @ np.array([.299, .587, .114])) * m
    return m[y0:y1].astype(float), np.hypot(ndimage.sobel(L, 1), ndimage.sobel(L, 0))[y0:y1]


def leg_sim(A, B, sx=5, sy=2):
    """아랫몸 윤곽(가림 순서·겹친 선) 닮음: 덩어리 ncc 와 테두리 ncc 의 반반 · 조금씩 밀어 가장 닮은 값 (옷 빛깔이 바뀌어도 선은 남는다)"""
    def ncc(a, b):
        a = a - a.mean(); b = b - b.mean(); d = np.sqrt((a * a).sum() * (b * b).sum()); return float((a * b).sum() / d) if d else 0.
    best = -9.
    for dy in range(-sy, sy + 1):
        for dx in range(-sx, sx + 1):
            best = max(best, .5 * ncc(A[0], np.roll(np.roll(B[0], dx, 1), dy, 0)) + .5 * ncc(A[1], np.roll(np.roll(B[1], dx, 1), dy, 0)))
    return best


def walk_legs(acells, bcells):
    """각성 걷기 여덟 칸(띠 4~11)이 비각성 걷기(walkref · 같은 띠 4~11)의 「같은 칸」 을 「반대 다리 칸」 보다 더 닮았는가.
    걷기 판은 비각성 걷기를 옷만 갈아입히는 편집이라 다리 자리가 같아야 한다. 반걸음 네 칸을 두 번 되풀이한 판(1·5 같은 다리)은
    뒤 네 칸이 반대 다리 칸을 닮아 여덟 칸 중 넷만 맞는다. 비각성 걷기가 네 칸 걸음을 두 번 늘어놓은 띠면 반대 다리 칸은 +2 (1↔3)."""
    ref, aw = bcells[4:12], acells[4:12]
    k = 2 if all(np.array_equal(np.array(ref[i]), np.array(ref[i + 4])) for i in range(4)) else 4
    hgt = lambda cs: float(np.median([c.getbbox()[3] - c.getbbox()[1] for c in cs]))
    z = hgt(ref) / hgt(aw)
    if abs(z - 1) > .01:   # 키를 비각성 걷기에 맞춘다 (발 줄·칸 가운데 고정)
        def grow(c):
            s = c.resize((round(c.width * z), round(c.height * z)), Image.Resampling.LANCZOS); o = Image.new('RGBA', c.size, (0, 0, 0, 0))
            o.alpha_composite(s.crop((max(0, (s.width - c.width) // 2), max(0, s.height - c.height), max(0, (s.width - c.width) // 2) + min(s.width, c.width), s.height)),
                              (max(0, (c.width - s.width) // 2), max(0, c.height - s.height)))
            return o
        aw = [grow(c) for c in aw]
    W = min(ref[0].width, aw[0].width)
    def fit(c):   # 칸 가운데를 맞춰 같은 폭으로 (굽는 틀이 몸 가운데를 칸 가운데에 둔다)
        x = (c.width - W) // 2; return c.crop((x, 0, x + W, c.height))
    ref, aw = [fit(c) for c in ref], [fit(c) for c in aw]
    m = np.zeros((ref[0].height, W), bool)
    for c in ref: m |= np.array(c)[..., 3] > 64
    ys = np.where(m.any(1))[0]; y0, y1 = int(ys[-1] - (ys[-1] - ys[0]) * .5), min(m.shape[0], int(ys[-1]) + 3)
    A, F = [leg_feat(c, y0, y1) for c in aw], [leg_feat(c, y0, y1) for c in ref]
    marg = [leg_sim(A[j], F[j]) - leg_sim(A[j], F[(j + k) % 8]) for j in range(8)]
    n, med = sum(1 for x in marg if x > LEG_FRAME), float(np.median(marg))
    ok = n >= LEG_OWN and med >= LEG_MARGIN
    why = None
    if not ok:
        detail_ = f'only {n} of 8 walk frames follow their own frame of the normal-form walk better than the opposite-leg frame, median margin {med:.3f}'
        why = (f'walk frames 1 and 5 have the same leg forward (half cycle repeated); redo as a redress edit of the normal-form walk ({detail_})' if k == 4 else
               f'walk legs do not alternate like the 4-frame normal-form walk (frames 1 and 3 have opposite legs forward, 5-8 repeat 1-4); redo as a redress edit of the normal-form walk ({detail_})')
    return dict(ok=ok, opposite=k, own=n, margin=round(med, 3), margins=[round(x, 3) for x in marg], reason=why)


def colour_gap(a, b):
    """서기 칸 빛깔 차이 (0 같음 ~ 1) · 옷이 한눈에 달라졌는가의 낌새"""
    def hist(im):
        x = np.array(im.convert('RGBA')); m = x[..., 3] > 64; q = (x[..., :3][m] // 32).astype(int)
        return np.bincount(q[:, 0] * 64 + q[:, 1] * 8 + q[:, 2], minlength=512) / max(1, m.sum())
    return round(float(np.abs(hist(a) - hist(b)).sum() / 2), 3)


# ---------- 그림 ----------
BG = (24, 26, 30, 255)
def hstack(ims, gap=6, bg=BG):
    W = sum(i.width for i in ims) + gap * (len(ims) - 1); H = max(i.height for i in ims)
    o = Image.new('RGBA', (W, H), bg); x = 0
    for i in ims: o.alpha_composite(i.convert('RGBA'), (x, 0)); x += i.width + gap
    return o


def vstack(ims, gap=6, bg=BG):
    W = max(i.width for i in ims); H = sum(i.height for i in ims) + gap * (len(ims) - 1)
    o = Image.new('RGBA', (W, H), bg); y = 0
    for i in ims: o.alpha_composite(i.convert('RGBA'), (0, y)); y += i.height + gap
    return o


def text_bar(t, w, n=14, col=(255, 255, 255, 255)):
    o = Image.new('RGBA', (max(w, 10), n + 8), BG); ImageDraw.Draw(o).text((4, 2), t, fill=col, font=font(n)); return o


def tile_row(cs, labels, z, xr=None, bg=(58, 66, 78, 255)):
    """칸 여럿을 같은 가로 범위(xr)로 잘라 확대 z 로 나란히 · 발 줄"""
    x0, x1 = xr or (0, cs[0].width); ts = []
    for c, lb in zip(cs, labels):
        t = Image.new('RGBA', (x1 - x0, c.height), bg); t.alpha_composite(c.crop((x0, 0, x1, c.height)))
        t = t.resize((round(t.width * z), round(t.height * z)), Image.Resampling.NEAREST if float(z).is_integer() else Image.Resampling.BICUBIC)
        d = ImageDraw.Draw(t); d.line([(0, 156 * z), (t.width, 156 * z)], fill=(255, 210, 90, 110)); d.text((3, 2), lb, fill=(255, 255, 0, 255), font=font(12)); ts.append(t)
    return hstack(ts, 2)


def game_pair(bcell, acell, z, grow, labels=('BASE', 'AW1'), pad=8):
    """비각성 | 각성 서기 칸을 게임이 그리는 크기 비로 (각성 칸은 grow = 비각성 bodyPx / 각성 bodyPx 배) · 발 줄을 맞춘다 → (그림, 비각성 칸 y 오프셋, 각성 x 오프셋)"""
    tb = tile_row([bcell], [labels[0]], z, xrange_of([bcell], pad)); ta = tile_row([acell], [labels[1]], z * grow, xrange_of([acell], pad))
    ground = round(156 * z * max(1, grow)); H = ground + round(4 * z * max(1, grow))
    o = Image.new('RGBA', (tb.width + ta.width, H), (58, 66, 78, 255))
    yb, ya = ground - round(156 * z), ground - round(156 * z * grow)
    o.alpha_composite(tb, (0, yb)); o.alpha_composite(ta, (tb.width, ya))
    return o, yb, tb.width, ya


def xrange_of(cs, pad=4):
    xs0, xs1 = [], []
    for c in cs:
        bb = c.getbbox()
        if bb: xs0.append(bb[0]); xs1.append(bb[2])
    return max(0, min(xs0) - pad), min(cs[0].width, max(xs1) + pad)


def head_ruler(cell, marks, label, zoom=5, cx=None):
    """머리 쪽 확대 + 줄 번호 자(칸 위에서 y). marks = [(줄, 빛깔)] · 틀리면 그 줄 번호를 --top-*/--chin-* 로 적는다"""
    top, feet, bx = body_top(cell); cx = bx if cx is None else cx
    y0, y1 = max(0, top - 8), min(cell.height, top + int((feet - top) * .5)); x0, x1 = max(0, cx - 36), min(cell.width, cx + 36)
    c = cell.crop((x0, y0, x1, y1)); bg = Image.new('RGBA', c.size, (44, 48, 58, 255)); bg.alpha_composite(c)
    big = bg.resize((c.width * zoom, c.height * zoom), Image.Resampling.NEAREST)
    o = Image.new('RGBA', (big.width + 34, big.height + 18), BG); o.alpha_composite(big, (34, 18)); d = ImageDraw.Draw(o)
    d.text((2, 1), label, fill=(255, 255, 0, 255), font=font(12))
    for y in range(y0, y1):
        yy = 18 + (y - y0) * zoom
        d.line([(28 if y % 5 else 22, yy), (34, yy)], fill=(190, 190, 190, 255))
        if y % 5 == 0: d.text((1, yy - 6), str(y), fill=(220, 220, 220, 255), font=font(10))
    for y, col in marks:
        if y is None: continue
        yy = 18 + (y - y0) * zoom
        d.line([(34, yy), (34 + 16, yy)], fill=col, width=2); d.line([(o.width - 16, yy), (o.width, yy)], fill=col, width=2)
    return o


# ---------- stage ----------
def base_job(who):
    return next((j for j in load(NA / 'queue.json', []) if j['key'] == who), None)


def sibling_key(who):
    """같은 초상에 열쇠가 둘인 장수(옛 시험 띠 dalbit ↔ 본편 띠 base-w-31-dabeol-dalbit): 게임이 실제로 쓰는 열쇠(전투 띠 줄에 있는 것)를 찾는다"""
    rows = load(KIT / 'weapon-audit-20261116.json', []); rows = rows if isinstance(rows, list) else rows.get('rows', [])
    port = next((r.get('portrait') for r in rows if r.get('key') == who), None)
    return next((j['key'] for j in load(NA / 'queue.json', []) if port and j.get('bust') == port and j['key'] != who), None)


def swing_sets():
    """비각성 띠가 battle-strikes.ts 에서 어느 휘두름 묶음인가 (각성 띠도 같은 묶음으로)"""
    t = (ROOT / 'src/ui/realm/battle-strikes.ts').read_text('utf-8'); g = (ROOT / 'src/realm/data/duelGenerated.ts').read_text('utf-8')
    arr = lambda name: set(json.loads(re.search(name + r'[^=]*= (\[[^\]]*\])', g).group(1)))
    line = lambda name: set(re.findall(r"'gen-([^']+)'", re.search(r'const ' + name + r' = .*', t).group(0)))
    heavy = (arr('GENERATED_HEAVY_KEYS') | line('HEAVY_SWINGS')) - line('NOT_HEAVY')
    return heavy, arr('GENERATED_BLADE_KEYS') | line('BLADE_SWINGS')


def make_job(who, h, base, act=None, walk=None, **extra):
    """bake-full20 에 넘길 줄. act/walk 를 주면 그 자리(measure 의 임시 폴더) · walk=False 면 걷기 판 없이"""
    att = h['attack']; hit, dead = h.get('hit', 18), h.get('dead', 19)
    over = {str(12 + i): p for i, p in enumerate(att) if p != 12 + i}
    if hit != 18: over['18'] = hit
    if dead != 19: over['19'] = dead
    atlas = dict(idle=[0, 1, 2, 3], attack=att, windup=[att[0], att[1]], guard=h.get('guard') or [att[1]], stagger=h.get('stagger') or [hit], hit=hit, dead=dead)
    heavy, blade = swing_sets()
    weapon = 'bow' if base['weapon'] == 'bow' else 'heavy' if who in heavy else 'sword' if who in blade else base['weapon']
    return dict(key='aw1-' + who, baseKey=who, bust=base['bust'], heroIds=base['heroIds'], weapon=weapon, baseWeapon=base['weapon'],
                masterOverride=str(act) if act else rel(SRC / f'aw1-{who}-act.png'), sheetOrder='strip',
                **({} if walk is False else {'walkSheet': str(walk) if walk else rel(SRC / f'aw1-{who}-walk.png')}),
                mainSourceOverrides=over, atlasOverrides=atlas, **extra)


def walk_fit(parts, wparts, h0):
    """걷기 판 처음 배율: 키(가장 선 칸 ≈ 서기 키)와 넓이 두 재기의 가운데 → (키 재기, 넓이 재기, 가운데)"""
    unit_w = float(np.median([p.height for p in wparts])) / 138
    f_h = h0 / float(np.percentile([bk.core_height(p, unit_w) for p in wparts], 75))
    area = lambda p: float((np.array(p)[..., 3] > 64).sum())
    f_a = float(np.sqrt(np.median([area(p) for p in parts[:4]]) / np.median([area(p) for p in wparts])))
    return f_h, f_a, float(np.sqrt(f_h * f_a))


def base_walk_ratio(bcells):
    """비각성 띠 안에서 걷기 칸 머리 / 서기 칸 머리 (11-18: 걷기 판은 비각성 걷기를 옷만 갈아입히는 편집이라 이 관계를 그대로 따른다 ·
    비각성 띠마다 0.75~1.1 로 다르다(이랑 0.75 · 단비 1.10) · 못 재면 기존 각성 띠 열 벌의 중앙값 WALK_HEAD)"""
    tb = body_top(bcells[0])[0]
    ms = [m for m in (head_match(bcells[0], bcells[4 + i], .6, 1.5, top=tb) for i in range(8)) if m and m['ncc'] >= .5]
    return float(np.median([m['s'] for m in ms])) if len(ms) >= 4 else WALK_HEAD


def fit_loop(bake, S, bcells, man_, has_walk=True):
    """굽기(138) → 머리 위끝~발을 비각성 띠에 맞춰 다시 → 걷기 판: 몸 크기로 맞춘 배율에서 걷기 칸 머리가 서기 칸 머리의 몇 배인가(두 판의 등신 차)를
    재고(비각성 띠의 같은 비 base_walk_ratio 에 견줘) 차이는 머리·몸에 반씩 나눠 다시. S = {idle_px, wf} 를 고친다 → (rep, 띠 칸들, 머리·키, 걷기 머리 비)"""
    for turn in range(4):
        rep, acells = bake(); pr = proportion(bcells, acells, man_, rep['bodyPxRaw'])
        if abs(pr['Hb'] - pr['Ha']) <= .7 or turn == 3: break
        S['idle_px'] *= pr['Hb'] / pr['Ha']
    walk_head = None
    if has_walk:
        ms = [m for m in (head_match(acells[0], acells[4 + i], .6, 1.5, top=pr['awTop']) for i in range(8)) if m and m['ncc'] >= .5]
        walk_head = float(np.median([m['s'] for m in ms])) / base_walk_ratio(bcells) if len(ms) >= 4 else None
        if walk_head is not None and abs(walk_head - 1) > .015: S['wf'] *= walk_head ** -.5; rep, acells = bake()
    return rep, acells, pr, walk_head


TWEAKS = ('attack', 'hit', 'dead', 'guard', 'stagger', 'chin_base', 'chin_aw', 'top_base', 'top_aw', 'walk_scale')


def stage(args):
    rc = receipt(); man = load(PX / 'manifest.json', {}); awq = load(AW / 'queue.json', [])
    only = set(args.only.split(',')) if args.only else None
    tweak = any(getattr(args, k) is not None for k in TWEAKS)
    if tweak and (not only or len(only) != 1): sys.exit('고쳐 다시 굽기(--attack · --top-* …)는 --only <한 명> 과 함께')
    SRC.mkdir(parents=True, exist_ok=True); OUT.mkdir(parents=True, exist_ok=True)
    for who, f in inbox(args.inbox, rc).items():
        if only and who not in only: continue
        h = rc['heroes'].get(who, {})
        if not f['pair']:   # 한쪽이 아직 없거나, 판이 서로 다르다(동작 v2 + 걷기 v1 …)
            note = f"act v{f['actV']} · walk v{f['walkV']} → waiting for {f['wait']}"
            if h.get('status') not in ('installed', 'accepted', 'staged'):
                h.update(status='waiting-' + f['wait'], **{k: str(f[k]).replace('\\', '/') for k in ('act', 'walk') if f[k]})
            h['pending'] = note; rc['heroes'][who] = h
            print('짝 없음', who, f"(동작 판 v{f['actV']} · 걷기 판 v{f['walkV']} · {'걷기' if f['wait'] == 'walk' else '동작'} 판을 기다림)"); continue
        h.pop('pending', None)
        sa, sw = sha(f['act']), sha(f['walk'])
        same = h.get('actSha256') == sa and h.get('walkSha256') == sw
        if same and h.get('status') in ('installed', 'staged', 'accepted', 'rejected') and not args.force and not tweak:
            print('건너뜀', who, h['status']); continue
        if same and h.get('status') == 'installed' and not args.force: print('건너뜀', who, '이미 넣음 (다시 굽으려면 --force)'); continue
        same_act = h.get('actSha256') == sa   # 동작 판이 그대로면(걷기 판만 새로 옴) 고른 자세·머리 줄·「동작 판 통과」 표시는 남긴다
        keep = {k: h[k] for k in ('attack', 'attackBy', 'hit', 'dead', 'guard', 'stagger', 'manual', 'actOk') if k in h} if same_act else {}
        if same and 'walkScale' in h: keep['walkScale'] = h['walkScale']
        prev = h.get('fit', {}) if same_act else {}
        h = dict(status='staged', act=str(f['act']).replace('\\', '/'), walk=str(f['walk']).replace('\\', '/'), actSha256=sa, walkSha256=sw, actVersion=f['actV'], walkVersion=f['walkV'], **keep)
        rc['heroes'][who] = h
        def reject(reason): h.update(status='rejected', reason=reason, rejectedBy='auto'); print('반려(자동)', who, reason)
        base = base_job(who)
        if not base or f'gen-{who}' not in man or not (PX / f'gen-{who}.png').exists():
            sib = sibling_key(who)   # 각성 띠는 게임이 그 장수에게 쓰는 열쇠(GEN_OWN) 하나에만 붙는다 · 기존 열 명과 같다
            reject(f'not a battle-strip key: in game this portrait fights with gen-{sib}, so only sprite_aw1_{sib}_act/_walk is used; skip the job for {who}' if sib else 'unknown key: no non-awakened strip gen-' + who); continue
        old = next((j for j in awq if j['key'] == 'aw1-' + who), None)
        if old and old.get('status') == 'installed' and 'aw1Intake20261118' not in old: reject('already has a reviewed awakened strip (awakened-20261114)'); continue
        ca, cw_ = SRC / f'aw1-{who}-act.png', SRC / f'aw1-{who}-walk.png'
        shutil.copy2(f['act'], ca); shutil.copy2(f['walk'], cw_)
        d = OUT / who; d.mkdir(parents=True, exist_ok=True)
        # 1) 판 숫자 검사
        sa_, sw_ = sheet_stats(ca), sheet_stats(cw_)
        auto = dict(act=sa_, walk=sw_); h['auto'] = auto
        bad = [n for n, s in (('action', sa_), ('walk', sw_)) if s['clear'] < .3]
        if bad: reject(f'{" and ".join(bad)} sheet background is not transparent (alpha-zero area {min(sa_["clear"], sw_["clear"]):.0%}); export with a true transparent background'); continue
        try:
            parts, wparts = cut_parts(ca, 4, 5), cut_parts(cw_, 4, 2)
        except ValueError as e:
            reject(f'figure count: {e} (need exactly 20 separate figures in 4x5 and 8 in 4x2, none touching another cell)'); continue
        st, h0 = pose_stats(parts)
        # 2) 자세 고르기 · 걷기 배율 (처음 값: 키와 넓이 두 재기의 가운데 · 뒤에서 머리 크기로 바로잡는다)
        if args.attack: h['attack'] = [int(x) for x in args.attack.split(',')]; h['attackBy'] = 'review'
        elif 'attack' not in h: h['attack'] = guess_attack(st); h['attackBy'] = 'auto'
        assert len(h['attack']) == 6 and all(0 <= p < 20 for p in h['attack']), '--attack 는 0~19 여섯 개'
        for k in ('hit', 'dead'):
            if getattr(args, k) is not None: h[k] = getattr(args, k)
        for k in ('guard', 'stagger'):
            if getattr(args, k): h[k] = [int(x) for x in getattr(args, k).split(',')]
        if args.walk_scale is not None: h['walkScale'] = args.walk_scale
        f_h, f_a, wf0 = walk_fit(parts, wparts, h0); S = dict(idle_px=138.0, wf=wf0)
        # 3) 굽기: 138 로 한 번 → 머리 위끝~발을 비각성 띠에 맞춰 다시 → 걷기 칸 머리 크기를 서기에 맞춰 다시
        bman = man[f'gen-{who}']; bcells, _ = cells(PX / f'gen-{who}.png')
        man_ = dict(h.get('manual', {}))
        for k, v in (('baseChin', args.chin_base), ('baseTop', args.top_base)):
            if v is not None: man_[k] = v
        for k, v in (('awChinFrac', args.chin_aw), ('awTopFrac', args.top_aw)):   # 각성 줄 번호는 지난 굽기 그림 기준 → 발에서 잰 높이 / 서기 칸 그림 키
            if v is not None:
                assert prev.get('awFeet') is not None, '--chin-aw/--top-aw 는 한 번 stage 한 뒤에 (detail.png 의 자를 보고)'
                man_[k] = (prev['awFeet'] - v) / prev['awRaw']
        body_px, err, pr = bman['bodyPx'], None, None
        def bake():
            rep = bk.bake(d / 'cand', 'aw1-' + who, job=make_job(who, h, base, idlePx=round(S['idle_px'], 2), walkFactor=round(S['wf'], 4), bodyPx=body_px))
            return rep, cells(d / 'cand' / f'gen-aw1-{who}.png')[0]
        try:
            rep, acells, pr, walk_head = fit_loop(bake, S, bcells, man_)
            if 'walkScale' in h: S['wf'] *= h['walkScale']; rep, acells = bake()
            pr = proportion(bcells, acells, man_, rep['bodyPxRaw'])
            if abs(pr['Hb'] - pr['Ha']) > .7 and round(bman['bodyPx'] * pr['Ha'] / pr['Hb']) != body_px:   # 칸 높이에 걸려 다 못 맞췄으면 본편 몸 키 값으로라도 맞춘다
                body_px = round(bman['bodyPx'] * pr['Ha'] / pr['Hb']); rep, acells = bake()
        except Exception as e:
            err = str(e)
        if err:
            reject(f'auto check: {err} (every figure and its weapon must sit fully inside its own cell with a clear gap; all 20 + 8 cells filled)'); continue
        if man_: h['manual'] = man_
        idle_px, wf = S['idle_px'], S['wf']
        raw = rep['bodyPxRaw']; k_fit = idle_px / 138
        chin_b = man_.get('baseChin'); chin_a = pr['awFeet'] - man_['awChinFrac'] * raw if 'awChinFrac' in man_ else None
        head_manual = round(((chin_a - pr['awTop']) / pr['Ha']) / ((chin_b - pr['baseTop']) / pr['Hb']), 3) if chin_b is not None and chin_a is not None else None
        fit = dict(by=pr['by'], idlePx=round(idle_px, 2), k=round(k_fit, 3), bodyPx=body_px, awRaw=raw, awFeet=pr['awFeet'],
                   head=head_manual if head_manual is not None else pr['head'], headBy='chin rows (review)' if head_manual is not None else 'head match',
                   headFwd=pr['headFwd'], headRev=pr['headRev'], headScale=pr['headScale'], ncc=[pr['ncc'], pr['ncc2']], gear=pr['gear'],
                   base=dict(top=pr['baseTop'], chin=chin_b, feet=pr['baseFeet']), aw=dict(top=round(pr['awTop'], 1), bodyTop=pr['awBodyTop'], chin=chin_a, feet=pr['awFeet']),
                   left=round(pr['Hb'] - pr['Ha'], 2), box=pr['box'])
        h['fit'] = fit
        auto['walkFit'] = dict(byHeight=round(f_h, 4), byArea=round(f_a, 4), used=round(wf, 4), walkHead=round(walk_head, 3) if walk_head else None)   # walkHead = 같은 몸 크기에서 걷기 판 머리 / 동작 판 머리
        ws = walk_stats(acells[4:12]); auto['walkCheck'] = ws
        legs = walk_legs(acells, bcells); auto['walkLegs'] = {k: v for k, v in legs.items() if k != 'reason'}
        duel, _ = cells(d / 'cand' / f'duel-aw1-{who}.png')
        ph = {}
        for p in sorted(set([0, 1, 2, 3] + h['attack'] + [h.get('hit', 18)])):
            m = head_match(acells[0], duel[p], .8, 1.25, top=pr['awTop'])
            if m and m['ncc'] >= .6: ph[p] = round(m['s'], 2)
        auto['poseHead'] = ph
        auto['colourGap'] = colour_gap(bcells[0], acells[0])
        auto.update(cell=rep['cell'], contact=rep['contact'], poses=st)
        warn = []
        if pr['by'] == 'top': warn.append(f'머리 찾기 불확실(닮음 {pr["ncc"]}/{pr["ncc2"]} · 두 방향 {pr["headFwd"]}/{pr["headRev"]}) → 몸 위끝으로 맞춤 · detail.png E 를 보고 --top-base/--top-aw (+ --chin-base/--chin-aw)')
        if fit['head'] is not None and fit['head'] > HEAD_WARN: warn.append(f'머리가 큼 ×{fit["head"]} (같은 키에서 머리 높이 · 5% 넘음)')
        if fit['head'] is not None and fit['head'] < 2 - HEAD_WARN: warn.append(f'머리가 작음 ×{fit["head"]}')
        if abs(k_fit - 1) > TALL_WARN: warn.append(f'칸 크기(138) 그대로면 키가 ×{round(1 / k_fit, 3)} 였다 → 맞춰 구움 (머리 장식·든 무기 높이 차)')
        if pr['gear'] >= 4: warn.append(f'각성 머리 위로 {pr["gear"]}px 솟음(관·깃털·든 무기) · 키에서 뺌')
        if abs(fit['left']) > 1.5: warn.append(f'칸(160)에 다 못 담아 그림은 {fit["left"]}px 작게 구움 → 화면에서 몸 키 값(bodyPx {body_px})으로 키워 맞춘다')
        if sa_['residue'] > .03 or sw_['residue'] > .03: warn.append(f'흰 찌꺼기 낌새 {sa_["residue"]}/{sw_["residue"]}')
        if sa_['halo'] > .2 or sw_['halo'] > .2: warn.append(f'반투명 번짐 많음 {sa_["halo"]}/{sw_["halo"]} (오라·빛·그림자?)')
        if walk_head is None: warn.append('걷기 칸 머리 크기를 못 쟀다 · 걷기 칸을 눈으로 (--walk-scale)')
        elif abs(walk_head - 1) > .06: warn.append(f'걷기 판 등신이 동작 판과 다름: 같은 몸 크기에서 걷기 머리 ×{walk_head:.2f} (반씩 나눠 구움 · 10% 넘으면 걷기 판을 다시 받는다)')
        odd = {p: s for p, s in ph.items() if abs(s - 1) > .08}
        if odd: warn.append(f'자세마다 머리 크기가 다름 {odd}')
        if ws['legDiff15'] < .06 and abs(ws['legShadeFlip']) < .02: warn.append('걷기 1·5 다리가 같은 쪽으로 보임')
        if ws['still'] >= 3: warn.append(f'걷기 칸이 거의 같은 그림 {ws["still"]}쌍 (미끄러짐)')
        if ws['stride'] < 1.08: warn.append(f'걷기 발 벌림 약함 ×{ws["stride"]}')
        if auto['colourGap'] < .25: warn.append(f'옷 빛깔이 비각성과 비슷 {auto["colourGap"]}')
        if st[19]['w'] < st[19]['h'] * 1.2: warn.append('20번 칸이 누운 꼴이 아님')
        if h.get('attackBy') == 'auto': warn.append(f'공격 칸 자동 고름 {h["attack"]} · detail.png A/B 에서 당김·맞닿음·뻗음 차례를 볼 것')
        h['warn'] = warn
        detail(who, h, base, bcells, acells, duel, d)
        if not legs['ok']:   # 11-18 걷기 다리 검사: 비각성 걷기 칸을 따라가지 않으면(반걸음 되풀이 · 새로 그림) 걷기 판만 자동 반려
            reject(legs['reason'])
            if fit['head'] is not None and fit['head'] <= HEAD_OK:   # 동작 판은 머리가 금 안 → 이 동작 판 + 더 높은 걷기 판을 짝지어 받는다 (눈 검수는 그때)
                h['actOk'] = dict(sha256=sa, version=f['actV'], date=TODAY, by='auto: walk legs only')
            continue
        print('검수 대기', who, f"head×{fit['head']} ({pr['headFwd']}/{pr['headRev']} ncc {pr['ncc']}/{pr['ncc2']}) k={fit['k']} gear={pr['gear']} walkHead={auto['walkFit']['walkHead']} attack={h['attack']}({h['attackBy']})")
        for w in warn: print('   ※', w)
    save(RECEIPT, rc)


def detail(who, h, base, bcells, acells, duel, d):
    """장수 한 명 검수 그림 (tools/out/aw1-intake/<who>/detail.png)"""
    fit = h['fit']; xr_a = xrange_of(acells + duel); xr_b = xrange_of(bcells)
    z = min(2.0, 1980 / (10 * (xr_a[1] - xr_a[0] + 2)))
    if z > 1.45: z = 1.5 if z < 2 else 2.0
    att = h['attack']; bow = base['weapon'] == 'bow'
    src = {**{12 + i: p for i, p in enumerate(att)}, 18: h.get('hit', 18), 19: h.get('dead', 19)}
    names = {12: 'ready', 13: 'windup', 14: 'draw' if bow else 'CONTACT', 15: 'RELEASE' if bow else 'follow', 16: 'recover', 17: 'ready', 18: 'hit', 19: 'dead'}
    rows = [text_bar(f'{who} · {h["status"]} · 무기 {base["weapon"]} · head×{fit["head"]} k={fit["k"]} · ' + ' / '.join(h.get('warn', [])), 1980, 13, (255, 220, 120, 255)),
            text_bar('A. 비각성 띠 12~19 (지금 게임) · 아래 B 가 같은 차례여야 한다', 1000),
            tile_row(bcells[12:20], [f'{i} {names[i]}' for i in range(12, 20)], z, xr_b),
            text_bar('B. 각성 띠 12~19 (넣을 것 · 「<-n」 = 원본 자세 번호)', 1000),
            tile_row(acells[12:20], [f'{i} {names[i]} <-{src[i]}' for i in range(12, 20)], z, xr_a),
            text_bar('C. 각성 원본 스무 자세 (번호 0~19 · --attack 에 쓰는 번호) · 옷·무기가 스무 칸 내내 같은가', 1000),
            tile_row(duel[:10], [f'pose {i}' for i in range(10)], z, xr_a), tile_row(duel[10:], [f'pose {i}' for i in range(10, 20)], z, xr_a),
            text_bar('D. 각성 걷기 여덟 칸 (띠 4~11 · 1·5 다리 반대 · 발 줄) + 서기', 1000),
            tile_row(acells[4:12] + [acells[0]], [f'walk {i + 1}' for i in range(8)] + ['idle'], z, xr_a)]
    zz = 3; grow = load(PX / 'manifest.json', {})[f'gen-{who}']['bodyPx'] / fit['bodyPx']; xa = xrange_of([acells[0]], 8)
    pair, yb, ax, ya = game_pair(bcells[0], acells[0], zz, grow); dr = ImageDraw.Draw(pair)
    W, G, R = (255, 255, 255, 220), (120, 220, 255, 230), (255, 90, 90, 230)
    dr.line([(0, yb + fit['base']['top'] * zz), (pair.width, yb + fit['base']['top'] * zz)], fill=W)
    if fit['base']['chin'] is not None: dr.line([(0, yb + (fit['base']['chin'] + 1) * zz), (pair.width, yb + (fit['base']['chin'] + 1) * zz)], fill=R)
    bx = fit['box']; g = zz * grow   # 비각성 머리 본이 각성에서 놓인 자리 (하늘색 틀)
    dr.rectangle([ax + (bx[0] - xa[0]) * g, ya + bx[1] * g, ax + (bx[0] + bx[2] - xa[0]) * g, ya + (bx[1] + bx[3]) * g], outline=G)
    heads = [head_ruler(bcells[0], [(fit['base']['top'], W), (fit['base']['chin'] + 1 if fit['base']['chin'] is not None else None, R)], 'BASE idle (흰=머리 위끝)'),
             head_ruler(acells[0], [(fit['aw']['top'], W), (fit['aw']['chin'] + 1 if fit['aw']['chin'] is not None else None, R)], 'AW1 idle (흰=맞춘 머리 위끝)', cx=bx[0] + bx[2] // 2),
             head_ruler(acells[7], [(fit['aw']['top'], W)], 'AW1 walk4')]
    last = [pair] + heads
    port = ROOT / f'public/realm/awaken-hd/{base["bust"]}.jpg'
    if port.exists():
        p = Image.open(port).convert('RGBA'); p.thumbnail((400, pair.height)); last.append(p)
    rows += [text_bar('E. 게임이 그리는 크기로 나란히 (흰 줄 = 비각성 머리 위끝 · 하늘색 틀 = 비각성 머리가 각성에서 맞은 자리) · 머리 자 (줄 번호 → --top-base/--top-aw/--chin-base/--chin-aw) · 각성 초상', 1900), hstack(last, 14)]
    vstack(rows, 3).convert('RGB').save(d / 'detail.png')


# ---------- review ----------
def review(args):
    rc = receipt(); h = rc['heroes'].get(args.key)
    assert h, f'stage 안 된 key: {args.key}'
    if args.decision == 'accept':
        assert h['status'] in ('staged', 'accepted', 'rejected') and h.get('rejectedBy') != 'auto' and (OUT / args.key / 'cand' / f'gen-aw1-{args.key}.png').exists(), f"지금 {h['status']} (자동 반려는 못 뒤집는다)"
        head = h['fit']['head']
        if (head is None or head > HEAD_OK) and not args.override:
            sys.exit(f'{args.key}: head×{head} · 머리 비가 {HEAD_OK} 를 넘거나 못 쟀다 → reject 하거나, 눈으로 같다고 본 까닭을 --override "..." 로 적을 것')
        if h.get('attackBy') == 'auto' and not args.attack_ok: sys.exit(f'{args.key}: 공격 칸이 자동 고름 {h["attack"]} · detail.png A/B 를 보고 맞으면 --attack-ok, 틀리면 stage --only {args.key} --attack ...')
        h.pop('reason', None); h.pop('rejectedBy', None)
        h.update(status='accepted', review=dict(note=args.note or '', date=TODAY, **({'override': args.override} if args.override else {})))
    else:
        assert args.reason, '반려는 --reason "한 줄 영어" (다시 그릴 문안에 쓴다)'
        h.update(status='rejected', reason=args.reason, rejectedBy='review', review=dict(note=args.note or '', date=TODAY))
        # --walk-only: 동작 판은 통과 · 걷기 판만 다시 → 이 동작 판 + 더 높은 걷기 판(_walk_v2 …)을 짝지어 받는다 (inbox)
        if args.walk_only: h['actOk'] = dict(sha256=h['actSha256'], version=h.get('actVersion', 1), date=TODAY)
        else: h.pop('actOk', None)
    save(RECEIPT, rc); print(args.key, h['status'])


# ---------- install ----------
def write_ts(queue, reports):
    """awakened-20261114/install.py 와 같은 표 (줄끝 LF)"""
    ins = [j for j in queue if j['status'] == 'installed']
    maps = {
        'AWAKENED_BY_BASE': ({j['baseKey']: j['key'] for j in ins}, 'Readonly<Record<string,string>>'),
        'AWAKENED_ANIM': ({j['key']: dict(ar=reports[j['key']]['cell'][0] / 160, body=reports[j['key']]['bodyPx'] / 160, **({'bow': True} if j['weapon'] == 'bow' else {})) for j in ins}, 'Readonly<Record<string,{ar:number;body:number;bow?:true}>>'),
        'AWAKENED_ATLASES': ({j['key']: reports[j['key']]['duelAtlas'] for j in ins}, ''),
        'AWAKENED_CONTACT': ({'gen-' + j['key']: reports[j['key']]['contact'] for j in ins}, 'Readonly<Record<string,[number,number,number]>>'),
        'AWAKENED_HEAVY': ([j['key'] for j in ins if j['weapon'] == 'heavy'], ''),
        'AWAKENED_BLADE': ([j['key'] for j in ins if j['weapon'] in ['sword', 'sickle']], ''),
    }
    text = '/** Reviewed first-awakening battle sprites. Generated by awakened-20261114/install.py · aw1-intake.py. */\n'
    for name, (value, typ) in maps.items(): text += 'export const ' + name + (': ' + typ if typ else '') + ' = ' + json.dumps(value) + '\n'
    (ROOT / 'src/realm/data/awakenedSpritesGenerated.ts').write_bytes(text.encode('utf-8'))


def install(args):
    rc = receipt(); done = []
    for who, h in rc['heroes'].items():
        if h.get('status') != 'accepted': continue
        key = 'aw1-' + who; base = base_job(who)
        ca, cw_ = SRC / f'{key}-act.png', SRC / f'{key}-walk.png'
        assert sha(ca) == h['actSha256'] and sha(cw_) == h['walkSha256'], f'{who}: 검수한 뒤 사본이 바뀜 · 다시 stage'
        fit = h['fit']
        job = make_job(who, h, base, idlePx=fit['idlePx'], walkFactor=h['auto']['walkFit']['used'], bodyPx=fit['bodyPx'])
        job.update(status='accepted', review='accepted', proportionReviewed=True, generationCalls=2, portrait=str(ROOT / 'public/realm/awaken-hd' / f"{base['bust']}.jpg"),
                   aw1Intake20261118=dict(actSha256=h['actSha256'], walkSha256=h['walkSha256'], source=h['act'], walkSource=h['walk']),
                   reviewNotes=f"{TODAY} aw1-intake: all20 + walk8 reviewed against gen-{who} at game scale (head-top-to-feet matched, k={fit['k']}, head x{fit['head']}); attack cells 12-17 = source poses {h['attack']}. {h.get('review', {}).get('note', '')}".strip())
        queue = load(AW / 'queue.json', []); old = next((j for j in queue if j['key'] == key), None)
        arch = RETIRE / who
        if old is not None:
            if 'aw1Intake20261118' not in old: job['beforeIntake20261118'] = old
            elif 'beforeIntake20261118' in old: job['beforeIntake20261118'] = old['beforeIntake20261118']
            queue[queue.index(old)] = job
        else: queue.append(job)
        for p in [REPAIRS / f'gen-{key}.png', REPAIRS / f'duel-{key}.png', REPAIRS / f'{key}-report.json', PX / f'gen-{key}.png', ROOT / f'public/realm/duel/sprites/gen-{key}.png']:
            if p.exists() and not (arch / rel(p)).exists(): (arch / rel(p)).parent.mkdir(parents=True, exist_ok=True); shutil.copy2(p, arch / rel(p))
        save(AW / 'queue.json', queue)
        bk.HERE = AW
        report = bk.bake(AW / 'candidates', key)     # 줄에 적힌 그대로 다시 굽는다 (repair-pilot.py 'awakened20-master' 와 같은 길)
        for name in [f'gen-{key}.png', f'duel-{key}.png']:
            assert (AW / 'candidates' / name).read_bytes() == (OUT / who / 'cand' / name).read_bytes(), f'{who}: 검수한 그림과 다시 구운 그림이 다름'
        for name in [f'gen-{key}.png', f'duel-{key}.png', f'{key}-report.json']: shutil.copy2(AW / 'candidates' / name, REPAIRS / name)
        reports = load(REPAIRS / 'repair-report.json', {}); reports[key] = report; save(REPAIRS / 'repair-report.json', reports, True)
        specs = load(KIT / 'repair-pilot.json', {}); specs[key] = {'pipeline': 'awakened20-master'}; save(KIT / 'repair-pilot.json', specs, True)
        job.update(status='installed', report=rel(AW / 'candidates' / f'{key}-report.json')); save(AW / 'queue.json', queue)
        write_ts(queue, reports)
        h.update(status='installed', installed=TODAY, key=key); save(RECEIPT, rc); done.append(who)
        print('넣음', key, report['cell'], 'bodyPx', report['bodyPx'], '(그림 키', report.get('bodyPxRaw'), ')')
    if done:
        subprocess.run(['node', 'tools/sprite-normalize.mjs', *[f'gen-aw1-{k}' for k in done]], cwd=ROOT, check=True)
        subprocess.run(['node', 'tools/sprite-kit/heights.mjs'], cwd=ROOT, check=True)
        subprocess.run([sys.executable, '-I', 'tools/walk-cycle-table.py'], cwd=ROOT, check=True)
        man = load(PX / 'manifest.json', {})
        for who in done:   # 넣은 뒤 확인: 화면 몸 키 값이 검수 때 값과 같은가 (headgear.json 에 gen-aw1 줄이 끼어들면 달라진다)
            a, want = man[f'gen-aw1-{who}'], rc['heroes'][who]['fit']['bodyPx']
            print(f'  {who}: bodyPx 비각성 {man[f"gen-{who}"]["bodyPx"]} · 각성 {a["bodyPx"]}', '' if a['bodyPx'] == want else f'  ※ 검수 값 {want} 과 다름 · headgear.json 에 gen-aw1-{who} 줄이 있는지 볼 것')
    print('넣음', done or '없음')


# ---------- sheet ----------
def sheet(args):
    rc = receipt(); SHEETS.mkdir(parents=True, exist_ok=True); man = load(PX / 'manifest.json', {})
    keys = args.keys.split(',') if args.keys else [w for w, h in rc['heroes'].items() if (args.status == 'all' and h.get('status') in ('staged', 'accepted', 'installed', 'rejected')) or h.get('status') == args.status]
    rows = []
    for who in keys:
        h = rc['heroes'].get(who, {}); base = base_job(who)
        strip = PX / f'gen-aw1-{who}.png' if h.get('status') == 'installed' else OUT / who / 'cand' / f'gen-aw1-{who}.png'
        if not strip.exists() or not base or 'fit' not in h: continue
        bcells, _ = cells(PX / f'gen-{who}.png'); acells, _ = cells(strip); z = 2
        fit = h['fit']; cc = 15 if base['weapon'] == 'bow' else 14
        grow = man[f'gen-{who}']['bodyPx'] / fit['bodyPx']   # 게임이 그리는 크기: 각성 칸은 몸 키 값 비만큼 커진다
        pair, yb, _, _ = game_pair(bcells[0], acells[0], z, grow, ('비각성', '각성'))
        ImageDraw.Draw(pair).line([(0, yb + fit['base']['top'] * z), (pair.width, yb + fit['base']['top'] * z)], fill=(255, 255, 255, 190))
        tiles = [pair, tile_row([acells[4], acells[8]], ['걷기 1', '걷기 5'], z * grow, xrange_of([acells[4], acells[8]], 6)), tile_row([acells[cc]], ['공격 맞닿음' if cc == 14 else '활 놓음'], z * grow, xrange_of([acells[cc]], 6))]
        port = ROOT / f'public/realm/awaken-hd/{base["bust"]}.jpg'
        if port.exists():
            p = Image.open(port).convert('RGBA'); p.thumbnail((260, 320)); tiles.append(p)
        lab = Image.new('RGBA', (250, pair.height), BG); d = ImageDraw.Draw(lab)
        st = h.get('status'); d.text((6, 6), who[-24:], fill=(255, 255, 0, 255), font=font(16))
        d.text((6, 30), {'installed': '넣음', 'accepted': '통과(넣기 전)', 'staged': '검수 대기(보류)', 'rejected': '반려'}.get(st, ''), fill=(255, 140, 140, 255) if st == 'rejected' else (160, 255, 160, 255), font=font(14))
        lines = [f'무기 {base["weapon"]}', f'초상 {base["bust"]}'[:38], f'머리 ×{fit.get("head")} (같은 키에서)', f'몸 맞춤 ×{fit.get("k")} · 머리 장식 {fit.get("gear")}px']
        more = ([('반려: ' + h['reason'])] if h.get('reason') else []) + h.get('warn', [])
        for t in more:
            while t: lines.append(t[:30]); t = t[30:]
        for n, t in enumerate(lines[:(pair.height - 60) // 18]): d.text((6, 56 + n * 18), t, fill=(215, 215, 215, 255), font=font(12))
        rows.append(hstack([lab] + tiles, 10))
    if not rows: print('그릴 장수 없음'); return
    per = args.per; outs = []
    for n in range(0, len(rows), per):
        p = Path(args.out) if args.out and len(rows) <= per else SHEETS / f'sheet-{n // per + 1:02d}.jpg'
        img = vstack([text_bar('1차 각성 전투 띠 · 비각성 | 각성 (게임이 그리는 크기 · 흰 줄 = 비각성 머리 위끝) | 각성 걷기 1·5 | 공격 | 각성 초상', 1500, 15)] + rows[n:n + per], 8)
        img.convert('RGB').save(p, quality=92); outs.append(str(p))
    print('\n'.join(outs))


def measure(args):
    """저장 전에 스스로 재기 (Codex). 영수증·저장소 파일은 건드리지 않고 임시 폴더에서만 굽는다. 출력은 영어·숫자만 (코드 페이지 깨짐 방지)"""
    import tempfile
    who = args.who; print('who=' + who)
    def end(v, why=None, code=None):
        if why: print('reason=' + why)
        print('VERDICT ' + v); sys.stdout.flush(); sys.exit(code if code is not None else 0 if v == 'PASS' else 1)
    man = load(PX / 'manifest.json', {}); base = base_job(who)
    if not base or f'gen-{who}' not in man or not (PX / f'gen-{who}.png').exists(): end('ERROR', f'unknown who: no normal-form strip gen-{who}', 2)
    act = Path(args.act); walk = Path(args.walk) if args.walk else None
    for q in (act, walk):
        if q is not None and not q.is_file(): end('ERROR', 'file not found: ' + q.name.encode('ascii', 'replace').decode(), 2)
    tmp = Path(tempfile.mkdtemp(prefix='aw1-measure-', dir='D:/tmp-node' if Path('D:/tmp-node').is_dir() else None)); root0 = bk.ROOT
    try:
        bk.ROOT = tmp    # bake-full20 은 원본 자리를 ROOT 아래로만 받는다 → 임시 폴더를 뿌리로
        ca = tmp / 'act.png'; shutil.copy2(act, ca); cw_ = None
        if walk: cw_ = tmp / 'walk.png'; shutil.copy2(walk, cw_)
        count = lambda path, cols, rows: len(bk.figures(path, cols, rows)[2])
        na = count(ca, 4, 5); nw = count(cw_, 4, 2) if cw_ else None
        print(f'cells_act={na}')
        if cw_: print(f'cells_walk={nw}')
        if na != 20: end('FAIL', f'action sheet: found a figure in {na} of 20 cells (need exactly 20 separate figures in 4x5, none touching another cell)')
        if cw_ and nw != 8: end('FAIL', f'walk sheet: found a figure in {nw} of 8 cells (need exactly 8 separate figures in 4x2, none touching another cell)')
        for name, q in (('action', ca), ('walk', cw_)):
            if q is not None and sheet_stats(q)['clear'] < .3: end('FAIL', f'{name} sheet background is not transparent; export with a true transparent background')
        try:
            parts = cut_parts(ca, 4, 5); st, h0 = pose_stats(parts); h = dict(attack=guess_attack(st))
            S = dict(idle_px=138.0, wf=walk_fit(parts, cut_parts(cw_, 4, 2), h0)[2] if cw_ else None)
            bcells, _ = cells(PX / f'gen-{who}.png')
            def bake():
                rep = bk.bake(tmp / 'cand', 'aw1-' + who, job=make_job(who, h, base, act=ca, walk=cw_ or False, idlePx=round(S['idle_px'], 2), bodyPx=man[f'gen-{who}']['bodyPx'],
                                                                     **({'walkFactor': round(S['wf'], 4)} if cw_ else {})))
                return rep, cells(tmp / 'cand' / f'gen-aw1-{who}.png')[0]
            rep, acells, pr, walk_head = fit_loop(bake, S, bcells, {}, has_walk=bool(cw_))
            pr = proportion(bcells, acells, {}, rep['bodyPxRaw'])
        except Exception as e:
            end('FAIL', 'cannot bake: ' + str(e).encode('ascii', 'replace').decode() + ' (every figure and its weapon must sit fully inside its own cell with a clear gap)')
        head = pr['head']
        print('head_x=' + ('?' if head is None else f'{head:.2f}'))
        print(f"head_detail=fwd {pr['headFwd']:.3f} rev {pr['headRev']:.3f} ncc {pr['ncc']:.2f}/{pr['ncc2']:.2f} headgear_px {pr['gear']:.1f}")
        if cw_: print('walk_vs_act=' + ('?' if walk_head is None else f'{walk_head:.2f}'))
        fail, hold = [], []
        if head is None: hold.append('head size could not be measured reliably (low similarity to the normal-form head); needs a visual check')
        elif head > HEAD_HOLD: fail.append(f'head {round((head - 1) * 100)}% too large for the body compared with gen-{who} (limit {round((HEAD_OK - 1) * 100)}%); keep the head-to-body ratio of the normal-form strip')
        elif head > HEAD_OK: hold.append(f'head {round((head - 1) * 100)}% larger than gen-{who} (pass limit {round((HEAD_OK - 1) * 100)}%)')
        if cw_:
            if walk_head is None: hold.append('walk sheet head size could not be measured; needs a visual check')
            elif abs(walk_head - 1) > WALK_OFF: fail.append(f'walk sheet proportions differ from the action sheet: at equal body size the walk head is x{walk_head:.2f} (limit 10%)')
            legs = walk_legs(acells, bcells)
            print(f"walk_legs=own {legs['own']}/8 margin {legs['margin']:.3f} opposite_frame +{legs['opposite']} (pass: own >= {LEG_OWN} and margin >= {LEG_MARGIN})")
            if not legs['ok']: fail.append(legs['reason'])
        end('FAIL' if fail else 'HOLD' if hold else 'PASS', '; '.join(fail or hold) or None)
    finally:
        bk.ROOT = root0; shutil.rmtree(tmp, ignore_errors=True)


def listing(_):
    rc = receipt(); by = {}
    for w, h in rc['heroes'].items(): by.setdefault(h.get('status'), []).append(w)
    for s, ws in by.items():
        print(f'[{s}] {len(ws)}: ' + ', '.join(ws))
        for w in ws:
            h = rc['heroes'][w]
            if s == 'rejected': print(f'   {w}: ({h.get("rejectedBy")}) {h.get("reason")}')
            if s == 'staged': print(f'   {w}: head×{h.get("fit", {}).get("head")} · ' + ' / '.join(h.get('warn', [])))


ap = argparse.ArgumentParser(); sp = ap.add_subparsers(dest='cmd')
s = sp.add_parser('stage'); s.add_argument('--inbox', default=INBOX); s.add_argument('--force', action='store_true'); s.add_argument('--only')
s.add_argument('--attack'); s.add_argument('--hit', type=int); s.add_argument('--dead', type=int); s.add_argument('--guard'); s.add_argument('--stagger')
s.add_argument('--chin-base', type=float); s.add_argument('--chin-aw', type=float); s.add_argument('--top-base', type=float); s.add_argument('--top-aw', type=float); s.add_argument('--walk-scale', type=float)
s.set_defaults(fn=stage)
s = sp.add_parser('review'); s.add_argument('key'); s.add_argument('decision', choices=['accept', 'reject']); s.add_argument('--note'); s.add_argument('--reason')
s.add_argument('--walk-only', action='store_true', help='반려: 동작 판은 통과 · 걷기 판만 다시 (그 동작 판 + _walk_v2 를 짝지어 받는다)')
s.add_argument('--attack-ok', action='store_true', help='자동으로 고른 공격 칸을 눈으로 확인했다'); s.add_argument('--override', help='머리 비가 한도를 넘거나 못 쟀지만 눈으로 같다고 본 까닭'); s.set_defaults(fn=review)
s = sp.add_parser('install'); s.set_defaults(fn=install)
s = sp.add_parser('sheet'); s.add_argument('--status', default='all'); s.add_argument('--keys'); s.add_argument('--out'); s.add_argument('--per', type=int, default=4); s.set_defaults(fn=sheet)
s = sp.add_parser('list'); s.set_defaults(fn=listing)
s = sp.add_parser('measure'); s.add_argument('--who', required=True); s.add_argument('--act', required=True); s.add_argument('--walk'); s.set_defaults(fn=measure)
if __name__ == '__main__':
    a = ap.parse_args()
    (a.fn if a.cmd else lambda _: ap.print_help())(a)
