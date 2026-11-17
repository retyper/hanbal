# -*- coding: utf-8 -*-
"""전투 띠 얼굴 크기·무기 다시 받은 것 넣기 (11-17 · tools/remake-jobs.mjs 묶음 'remake-sprite' · SP-<who>-act/walk).

챗지피티가 준 두 장(D:/에셋창고 · 복사만 하고 옮기거나 지우지 않는다):
  sprite_prop_<who>_act.png   4x5 20자세 (지금 띠와 같은 칸 차례: 서기3 · 걷기6 · 달려듦 · 당김 · 맞닿음 · 뻗음 · 거둠 · 막기2 · 비틀2 · 맞음 · 누움)
  sprite_prop_<who>_walk.png  4x2 걷기 8컷 (오른발 닿음 · 내려앉음 · 지나감 · 솟음 · 왼발 닿음 · …)
<who> = nonawakened-20261113/queue.json 의 key (띠 이름은 gen-<key>).

길 (11-14 비율 교정과 같은 굽는 틀 bake-full20.py · 걷기 판이 있으면 본편 띠 걷기 4~11칸을 새 8컷으로):
  py -3 -I tools/sprite-kit/prop-intake.py stage            새로 온 짝을 찾아 시험 굽기 + 검수 그림 (tools/out/sprite-prop-intake/<key>/)
  (그림을 눈으로 본다: before-after · face · legs)
  py -3 -I tools/sprite-kit/prop-intake.py review <key> accept --chin-old 40 --chin-new 32 [--weapon sword] [--note ...]
  py -3 -I tools/sprite-kit/prop-intake.py review <key> reject --reason "..."
  py -3 -I tools/sprite-kit/prop-intake.py install          받아들인 것만 넣는다 (옛 띠는 assets_src/realm/retired/prop-20261117/<key>/) → sprite-normalize
  py -3 -I tools/sprite-kit/prop-intake.py index            검수 목록 index.html 다시
이미 넣은 것(같은 sha256)은 건너뛴다. 받은 그림이 바뀌면(다시 받음) 다시 stage 한다.
영수증: tools/sprite-kit/prop-intake-20261117.json
무기를 바로잡은 장수(weapon-audit 'sprite≠art')는 review 때 --weapon 으로 새 무기 묶음을 적어야 넣는다.
  넣은 뒤 battle-strikes.ts 의 HEAVY_SWINGS/BLADE_SWINGS 같은 표와 art.ts 설명은 손으로 맞춘다(설치가 알려 준다).
"""
import argparse, hashlib, importlib.util, json, shutil, subprocess, sys, html
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

KIT = Path(__file__).resolve().parent
ROOT = KIT.parents[1]
NA = KIT / 'nonawakened-20261113'
QUEUE = NA / 'queue.json'
RECEIPT = KIT / 'prop-intake-20261117.json'
OUT = ROOT / 'tools/out/sprite-prop-intake'
RETIRE = ROOT / 'assets_src/realm/retired/prop-20261117'
PX = ROOT / 'public/realm/anim-px'
TAG = 'prop20261117'
BASE = ['gen-soseono', 'gen-gamsil', 'gen-soebi', 'gen-onjo']  # 형이 맞다고 본 얼굴 크기 (head-audit-20261116.json)

spec = importlib.util.spec_from_file_location('full20', KIT / 'bake-full20.py')
bk = importlib.util.module_from_spec(spec); spec.loader.exec_module(bk)


def sha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def rel(p): return Path(p).resolve().relative_to(ROOT).as_posix()
def load(p, d): return json.loads(Path(p).read_text('utf-8')) if Path(p).exists() else d
def save(p, v): Path(p).write_bytes((json.dumps(v, ensure_ascii=False, indent=2) + '\n').encode('utf-8'))


def receipt():
    r = load(RECEIPT, None)
    return r or {'date': '2026-11-17', 'why': '형 11-16 「번예 갈매 얼굴이 너무 큼 · 이동 프레임 자연스럽게」 → 챗지피티 SP-<who>-act/walk 다시 · 이 영수증이 받은 그림·검수·설치 기록',
                 'method': 'bake-full20.py (동작 4x5 그대로 · 걷기 4x2 8컷은 본편 띠 4~11칸) · 얼굴 = 턱 자리를 몸 키(머리카락 위~발바닥, 가는 장식 뺌) % 로 눈 판정, head-audit-20261116 과 같은 법',
                 'heroes': {}}


def weapon_fix():
    w = load(KIT / 'weapon-audit-20261116.json', [])
    rows = w if isinstance(w, list) else w.get('rows', [])
    return {r['key']: r for r in rows}


def pairs(inbox):
    for act in sorted(Path(inbox).glob('sprite_prop_*_act.png')):
        who = act.name[len('sprite_prop_'):-len('_act.png')]
        yield who, act, act.with_name(f'sprite_prop_{who}_walk.png')


# ---------- 재기 ----------
def cell0(path, cw, i=0):
    im = Image.open(path).convert('RGBA'); return im.crop((i * cw, 0, (i + 1) * cw, im.height))


def core_box(im):
    """가는 창 자루·깃털을 깎은 몸 덩어리(가장 큰 것)의 위끝·발바닥"""
    a = np.array(im)[..., 3] > 40
    o = ndimage.binary_opening(a, structure=np.ones((5, 5)))
    lab, n = ndimage.label(o)
    if n == 0: return None
    big = 1 + int(np.argmax(ndimage.sum(o, lab, range(1, n + 1))))
    ys, xs = np.nonzero(lab == big)
    feet = int(np.where(a.any(1))[0][-1])
    return int(ys.min()), feet, int(np.median(xs))


def head_band(im):
    """head-ratio.py 와 같은 자동 등신(머리 띠 폭) — 눈 판정을 거드는 숫자"""
    a = np.array(im)[..., 3] > 40
    cb = core_box(im)
    if not cb: return None
    top, bot, _ = cb; H = bot - top
    cols = a[top + int(H * .04):top + int(H * .12)].sum(0)
    xs = np.where(cols >= max(2, cols.max() * .5))[0]
    if not len(xs): return None
    cx = int(np.median(xs)); w = []
    for y in range(top + int(H * .08), top + int(H * .20) + 1):
        row = a[y]; c = cx
        if not row[cx]:
            near = np.where(row[max(0, cx - 6):cx + 7])[0]
            if not len(near): continue
            c = max(0, cx - 6) + int(near[0])
        l = c
        while l > 0 and row[l - 1]: l -= 1
        r = c
        while r < len(row) - 1 and row[r + 1]: r += 1
        w.append(r - l + 1)
    return round(H / float(np.median(w)), 2) if w else None


def ruler_crop(im, label, zoom=4, share=.5):
    """머리 쪽(몸 키 위 share)을 확대 + 몸 키 1% 눈금 (위끝=0%) · 30·31·33·35·40% 는 색 줄"""
    top, feet, cx = core_box(im); H = feet - top
    half = int(H * .32)
    box = (max(0, cx - half), max(0, top - 6), min(im.width, cx + half), top + int(H * share))
    c = im.crop(box); bg = Image.new('RGBA', c.size, (40, 44, 52, 255)); bg.alpha_composite(c)
    big = bg.resize((c.width * zoom, c.height * zoom), Image.Resampling.NEAREST)
    d = ImageDraw.Draw(big)
    for p in range(0, int(share * 100)):
        y = ((top + H * p / 100) - box[1]) * zoom
        if p in (31, 33): col, ln = (90, 255, 120, 255), big.width
        elif p in (35, 40): col, ln = (255, 110, 110, 255), big.width
        elif p % 5 == 0: col, ln = (220, 220, 220, 200), 40
        else: col, ln = (160, 160, 160, 160), 14
        d.line([(0, y), (ln, y)], fill=col, width=1)
        if p % 5 == 0 or p in (31, 33): d.text((ln - 30 if ln > 40 else 42, y - 11), f'{p}', fill=col)
    out = Image.new('RGBA', (big.width, big.height + 18), (24, 26, 30, 255)); out.alpha_composite(big, (0, 18))
    ImageDraw.Draw(out).text((4, 3), label, fill=(255, 255, 255, 255))
    return out


def hstack(ims, gap=10, bg=(24, 26, 30, 255)):
    W = sum(i.width for i in ims) + gap * (len(ims) - 1); H = max(i.height for i in ims)
    o = Image.new('RGBA', (W, H), bg); x = 0
    for i in ims: o.alpha_composite(i, (x, 0)); x += i.width + gap
    return o


def vstack(ims, gap=10, bg=(24, 26, 30, 255)):
    W = max(i.width for i in ims); H = sum(i.height for i in ims) + gap * (len(ims) - 1)
    o = Image.new('RGBA', (W, H), bg); y = 0
    for i in ims: o.alpha_composite(i, (0, y)); y += i.height + gap
    return o


def strip_rows(path, cw, label, zoom=2, per=10, cells=None):
    im = Image.open(path).convert('RGBA'); n = im.width // cw
    rows = []
    for r0 in range(0, n, per):
        tiles = []
        for i in range(r0, min(n, r0 + per)):
            t = Image.new('RGBA', (cw, im.height), (52, 60, 70, 255)); t.alpha_composite(im.crop((i * cw, 0, (i + 1) * cw, im.height)))
            t = t.resize((cw * zoom, im.height * zoom), Image.Resampling.NEAREST)
            d = ImageDraw.Draw(t); d.line([(0, 156 * zoom), (t.width, 156 * zoom)], fill=(255, 210, 90, 120))
            d.text((4, 4), str(i), fill=(255, 255, 255, 255))
            if cells and i in cells: d.text((4, 16), cells[i], fill=(255, 220, 120, 255))
            tiles.append(t)
        rows.append(hstack(tiles, 2))
    head = Image.new('RGBA', (rows[0].width, 22), (24, 26, 30, 255)); ImageDraw.Draw(head).text((4, 4), label, fill=(255, 255, 255, 255))
    return vstack([head] + rows, 2)


def residue(path):
    """체크무늬·흰 바탕 찌꺼기: 사람 덩어리 가장자리 3px 띠 안 밝은 무채색 불투명 비율"""
    a = np.array(Image.open(path).convert('RGBA')).astype(int)
    m = a[..., 3] > 200
    edge = m & ~ndimage.binary_erosion(m, iterations=3)
    rgb = a[..., :3]; mx, mn = rgb.max(-1), rgb.min(-1)
    light = edge & (mn > 200) & (mx - mn < 14)
    return round(float(light.sum()) / max(1, edge.sum()), 4)


def legs_sheet(gen, cw, label):
    """걷기 8칸(4~11) 아랫몸 45% 확대 · 1↔5 다리 교대를 눈으로"""
    im = Image.open(gen).convert('RGBA'); tiles = []
    for k, i in enumerate(range(4, 12)):
        c = im.crop((i * cw, 70, (i + 1) * cw, 160)); t = Image.new('RGBA', c.size, (52, 60, 70, 255)); t.alpha_composite(c)
        t = t.resize((c.width * 3, c.height * 3), Image.Resampling.NEAREST)
        ImageDraw.Draw(t).text((4, 4), f'walk {k + 1}', fill=(255, 230, 120, 255)); tiles.append(t)
    head = Image.new('RGBA', (10, 20), (24, 26, 30, 255))
    s = hstack(tiles, 4); h = Image.new('RGBA', (s.width, 22), (24, 26, 30, 255)); ImageDraw.Draw(h).text((4, 4), label, fill=(255, 255, 255, 255))
    return vstack([h, s], 2)


def lineup(old, ocw, gen, cw, who, man, z=2):
    """같은 몸 키(160 칸)로 기준 셋 + 옛 + 새 서기 + 새 걷기1 전신 — 머리·얼굴 크기를 한눈에"""
    def fig(im, label):
        _, _, cx = core_box(im)
        c = im.crop((max(0, cx - 50), 10, min(im.width, cx + 60), 160)); bg = Image.new('RGBA', c.size, (120, 130, 140, 255)); bg.alpha_composite(c)
        b = bg.resize((c.width * z, c.height * z), Image.Resampling.NEAREST); o = Image.new('RGBA', (b.width, b.height + 14), (24, 26, 30, 255)); o.alpha_composite(b, (0, 14))
        ImageDraw.Draw(o).text((2, 1), label, fill=(255, 255, 0, 255)); return o
    base = [fig(cell0(PX / f'{b}.png', man[b]['cell'][0]), 'BASE ' + b[4:]) for b in ('gen-soseono', 'gen-gamsil', 'gen-onjo') if b in man]
    return hstack(base + [fig(cell0(old, ocw), 'OLD ' + who[-16:]), fig(cell0(gen, cw), 'NEW idle'), fig(cell0(gen, cw, 4), 'NEW walk1')], 4)


def walk_pairs(gen, cw, who):
    """걷기 1·3·5·7 아랫몸 크게 — 1↔5 앞다리가 바뀌는지(밝은 쪽 다리), 3↔7 드는 다리가 바뀌는지"""
    im = Image.open(gen).convert('RGBA'); tiles = []
    for i in (4, 6, 8, 10):
        c = im.crop((i * cw + cw // 2 - 60, 100, i * cw + cw // 2 + 65, 157)); t = Image.new('RGBA', c.size, (130, 140, 150, 255)); t.alpha_composite(c)
        tiles.append(t.resize((c.width * 3, c.height * 3), Image.Resampling.NEAREST))
    s = hstack(tiles, 4); h = Image.new('RGBA', (s.width, 18), (24, 26, 30, 255)); ImageDraw.Draw(h).text((4, 3), f'{who}  walk 1 / 3 / 5 / 7', fill=(255, 255, 0, 255))
    return vstack([h, s], 0)


# ---------- stage ----------
def stage(args):
    q = load(QUEUE, []); rc = receipt(); wf = weapon_fix(); man = load(PX / 'manifest.json', {})
    OUT.mkdir(parents=True, exist_ok=True)
    for who, act, walk in pairs(args.inbox):
        if args.only and who != args.only: continue
        h = rc['heroes'].get(who, {})
        if not walk.exists():
            print('짝 없음(걷기 아직)', who); h.update(status='waiting-walk', act=str(act)); rc['heroes'][who] = h; continue
        sa, sw = sha(act), sha(walk)
        if h.get('status') in ('installed', 'staged', 'accepted', 'rejected') and h.get('actSha256') == sa and h.get('walkSha256') == sw and not args.force:
            print('건너뜀', who, h['status']); continue
        job = next((j for j in q if j['key'] == who), None)
        order = rc['heroes'].get(who, {}).get('order', 'strip')
        h = dict(status='staged', order=order, act=str(act).replace('\\', '/'), walk=str(walk).replace('\\', '/'), actSha256=sa, walkSha256=sw)
        if not job:
            h.update(status='rejected', reason='queue.json 에 없는 key (본편 full20 장수만 이 길로 넣는다)'); rc['heroes'][who] = h; print('거절', who, h['reason']); continue
        w = wf.get(who, {})
        if 'sprite≠art' in (w.get('mismatch') or []): h['weaponFix'] = dict(sprite=w.get('spriteWeapon'), art=w.get('artWeapon'), artKit=w.get('artKit'))
        h['portrait'] = w.get('portrait') or job.get('portrait')
        # 저장소 쪽 사본 (원본 자리 D:/에셋창고 는 그대로)
        ca, cw_ = NA / f'{who}-{TAG}.png', NA / f'{who}-{TAG}-walk.png'
        shutil.copy2(act, ca); shutil.copy2(walk, cw_)
        d = OUT / who; d.mkdir(parents=True, exist_ok=True)
        trial = {k: v for k, v in job.items() if k not in ('reviewedPosePatch', 'mainSourceOverrides', 'atlasOverrides', 'excludedMasterPoses')}
        trial.update(masterOverride=rel(ca), walkSheet=rel(cw_), sheetOrder=h.get('order', 'strip'))
        try:
            rep = bk.bake(d / 'cand', who, job=trial)
        except Exception as e:  # 20/8 사람 못 찾음 · 칸 가장자리 잘림 등
            h.update(status='rejected', reason=f'자동 검사: {e}'); rc['heroes'][who] = h; print('거절', who, e); continue
        gen = d / 'cand' / f'gen-{who}.png'; cw = rep['cell'][0]
        old = PX / f'gen-{who}.png'; ocw = man[f'gen-{who}']['cell'][0]
        h['auto'] = dict(cell=rep['cell'], walkScale=rep['walk8']['scale'], contact=rep['contact'],
                         headsOld=head_band(cell0(old, ocw)), headsNew=head_band(cell0(gen, cw)), headsNewWalk=head_band(cell0(gen, cw, 4)),
                         residueAct=residue(ca), residueWalk=residue(cw_))
        # 검수 그림
        names = {0: 'idle', 3: '', 4: 'walk1', 8: 'walk5', 12: 'atk', 18: 'hit', 19: 'dead'}
        ba = vstack([strip_rows(old, ocw, f'BEFORE  {who}  (지금 띠 gen-{who}.png)', cells=names), strip_rows(gen, cw, f'AFTER  {who}  (새 띠 · 걷기 4~11 = 새 걷기 8컷)', cells=names)], 16)
        port = ROOT / f'public/realm/bust-hd/{h["portrait"]}.jpg'
        if port.exists():
            p = Image.open(port).convert('RGBA'); p.thumbnail((360, ba.height)); ba = hstack([ba, p], 16)
        ba.convert('RGB').save(d / 'before-after.png')
        faces = [ruler_crop(cell0(old, ocw), 'OLD idle'), ruler_crop(cell0(gen, cw), 'NEW idle'), ruler_crop(cell0(gen, cw, 4), 'NEW walk1')]
        for b in BASE[:2]:
            if (PX / f'{b}.png').exists(): faces.append(ruler_crop(cell0(PX / f'{b}.png', man[b]['cell'][0]), f'BASE {b[4:]}'))
        hstack(faces, 12).convert('RGB').save(d / 'face.png')
        legs_sheet(gen, cw, f'{who} 새 걷기 8컷 (1·5 다리 반대 · 발 줄 같은지)').convert('RGB').save(d / 'legs.png')
        lineup(old, ocw, gen, cw, who, man).convert('RGB').save(d / 'lineup.png')
        walk_pairs(gen, cw, who).convert('RGB').save(d / 'walk1357.png')
        rc['heroes'][who] = h; print('검수 대기', who, h['auto'])
    save(RECEIPT, rc); index(None)


# ---------- review ----------
def review(args):
    rc = receipt(); h = rc['heroes'].get(args.key)
    assert h, f'stage 안 된 key: {args.key}'
    if args.decision == 'accept':
        # 거절했던 것도 형이 「그래도 넣자」 하면 accept 로 뒤집는다 (자동 검사 거절은 cand 가 없어 못 뒤집음)
        assert h['status'] in ('staged', 'accepted', 'rejected') and (OUT / args.key / 'cand' / f'gen-{args.key}.png').exists(), f"지금 {h['status']}"
        if h.get('weaponFix') and not args.weapon: sys.exit('무기 바로잡은 장수 — --weapon <bow|spear|sword|dagger|axe|staff ...> 로 새 무기를 적을 것')
        h.pop('reason', None)
        h.update(status='accepted', review=dict(chinOld=args.chin_old, chinNew=args.chin_new, note=args.note or '', **({'weapon': args.weapon} if args.weapon else {})))
    else:
        h.update(status='rejected', reason=args.reason or '눈 검수에서 거절', review=dict(chinOld=args.chin_old, chinNew=args.chin_new, note=args.note or ''))
    save(RECEIPT, rc); index(None); print(args.key, h['status'])


# ---------- install ----------
def install(args):
    rc = receipt(); q = load(QUEUE, []); done = []
    for who, h in rc['heroes'].items():
        if h.get('status') != 'accepted': continue
        ca, cw_ = NA / f'{who}-{TAG}.png', NA / f'{who}-{TAG}-walk.png'
        assert sha(ca) == h['actSha256'] and sha(cw_) == h['walkSha256'], f'{who}: 검수한 뒤 사본이 바뀜 — 다시 stage'
        arch = RETIRE / who
        for p in [NA / f'{who}-master.png', QUEUE, PX / f'gen-{who}.png', ROOT / f'public/realm/duel/sprites/gen-{who}.png',
                  KIT / f'repairs/20261113/gen-{who}.png', KIT / f'repairs/20261113/duel-{who}.png', KIT / f'repairs/20261113/{who}-report.json']:
            if p.exists():
                dst = arch / rel(p)
                if not dst.exists(): dst.parent.mkdir(parents=True, exist_ok=True); shutil.copy2(p, dst)
        shutil.copy2(ca, NA / f'{who}-master.png')
        q = load(QUEUE, []); j = next(j for j in q if j['key'] == who)
        for f in ['reviewedPosePatch', 'mainSourceOverrides', 'atlasOverrides', 'excludedMasterPoses', 'masterOverride']:
            if f in j: j['beforeProp_' + f] = j.pop(f)
        if h['review'].get('weapon'):
            j['beforeProp_weapon'] = j.get('weapon'); j['weapon'] = h['review']['weapon']
        j.update(walkSheet=rel(cw_), sheetOrder=h.get('order', 'strip'), proportionReviewed=True, review='accepted',
                 propIntake20261117=dict(actSha256=h['actSha256'], walkSha256=h['walkSha256'], source=h['act'], walkSource=h['walk']))
        j['reviewNotes'] = j.get('reviewNotes', '') + f" 2026-11-17 face-size remake (SP-{who}): all20 + walk8 reviewed, chin {h['review'].get('chinOld')}%→{h['review'].get('chinNew')}%; walk cells 4-11 = new 8-frame walk."
        save(QUEUE, q)
        r = subprocess.run([sys.executable, '-I', str(NA / 'install.py'), who], cwd=ROOT, capture_output=True, text=True, encoding='utf-8')
        if r.returncode:
            print(r.stderr); sys.exit(f'{who}: install.py 실패 — 옛 판은 {rel(arch)} 에 있다')
        print(r.stdout.strip())
        h.update(status='installed', archive=rel(arch), installed='2026-11-17'); save(RECEIPT, rc); done.append(who)
        if h.get('weaponFix'):
            print(f'  ※ {who} 무기 바뀜 {h["weaponFix"]} → battle-strikes.ts HEAVY_SWINGS/BLADE_SWINGS · art.ts 설명을 손으로 맞출 것')
    if done:
        subprocess.run(['node', 'tools/sprite-normalize.mjs', *[f'gen-{k}' for k in done]], cwd=ROOT, check=True)
    index(None); print('넣음', done or '없음')


# ---------- index ----------
def index(_):
    rc = receipt(); OUT.mkdir(parents=True, exist_ok=True)
    rows = []
    for who, h in sorted(rc['heroes'].items()):
        a = h.get('auto', {}); rv = h.get('review', {})
        imgs = ''.join(f'<a href="{who}/{n}.png"><img src="{who}/{n}.png" loading="lazy"></a>' for n in ['lineup', 'face', 'walk1357', 'legs', 'before-after'] if (OUT / who / f'{n}.png').exists())
        rows.append(f"<section class='{h.get('status')}'><h2>{html.escape(who)} <small>{h.get('status')}</small></h2>"
                    f"<p>턱 {rv.get('chinOld', '?')}% → {rv.get('chinNew', '?')}% · 자동 등신(머리 띠) {a.get('headsOld')} → {a.get('headsNew')} (걷기 {a.get('headsNewWalk')}) · 걷기 배율 {a.get('walkScale')} · 찌꺼기 {a.get('residueAct')}/{a.get('residueWalk')}"
                    f"{' · 무기 ' + html.escape(str(h['weaponFix'])) if h.get('weaponFix') else ''}{' · <b>' + html.escape(h.get('reason', '')) + '</b>' if h.get('reason') else ''}{' · ' + html.escape(rv.get('note', '')) if rv.get('note') else ''}</p>{imgs}</section>")
    (OUT / 'index.html').write_bytes(('<!doctype html><meta charset="utf-8"><title>전투 띠 얼굴 크기 검수</title><style>body{background:#181a1e;color:#ddd;font:14px sans-serif;margin:16px}img{max-width:100%;display:block;margin:6px 0;border:1px solid #333}section{border-top:2px solid #444;padding:8px 0}.installed h2{color:#8f8}.rejected h2{color:#f88}.accepted h2{color:#ff8}small{font-weight:normal;color:#aaa}</style>'
                                      '<h1>전투 띠 얼굴 크기 다시 (11-17)</h1><p>기준: 턱이 몸 키 31~33% (소서노 31 · 감실 32 · 쇠비 33). face 그림의 초록 줄 = 31·33%, 빨강 = 35·40% (이 자의 위끝 = 머리카락·투구 위, 가는 깃털·창끝 뺌 · 같은 자로 잰 기준: 소서노 28.5 · 감실 30 · 쇠비 31 · 온조 30).</p>'
                                      + ''.join(f'<a href="{p.name}"><img src="{p.name}" loading="lazy"></a>' for p in sorted(OUT.glob('overview-*.png'))) + ''.join(rows)).encode('utf-8'))


ap = argparse.ArgumentParser(); sp = ap.add_subparsers(dest='cmd')
s = sp.add_parser('stage'); s.add_argument('--inbox', default='D:/에셋창고'); s.add_argument('--force', action='store_true'); s.add_argument('--only', help='이 장수만'); s.set_defaults(fn=stage)
s = sp.add_parser('review'); s.add_argument('key'); s.add_argument('decision', choices=['accept', 'reject'])
s.add_argument('--chin-old', type=float); s.add_argument('--chin-new', type=float); s.add_argument('--weapon'); s.add_argument('--note'); s.add_argument('--reason'); s.set_defaults(fn=review)
s = sp.add_parser('install'); s.set_defaults(fn=install)
s = sp.add_parser('index'); s.set_defaults(fn=index)
a = ap.parse_args()
(a.fn if a.cmd else lambda _: stage(ap.parse_args(['stage'])))(a)
