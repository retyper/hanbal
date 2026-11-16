"""열전 적 단계 그림(H30·H31·H33~H38, 챗지피티 3x3 아홉 자세)을 20칸 띠로 굽는다 (형 11-16: 적 단계업).
bake-bandit-archer.py 와 같은 규칙: 늘리거나 고쳐 그리지 않음 · 한 배율 · 발을 같은 바닥선에 ·
가로는 발 가운데, 달리기 칸(2~4)은 엉덩이 가운데 (보폭 때문에 몸이 흔들리지 않게).
덩어리마다 가운데가 놓인 칸의 것으로 (칸을 넘은 창끝·떨어진 팔매 줄 조각도 남게).
원본: assets_src/realm/raid/haebi-pack-v1-H??.png (Downloads·에셋창고는 읽지 않는다)
11-16 H45~H53: 설원·산성 적 넷(범·곰은 짐승이라 몸 키를 낮게 · 맥족 투창·횃불 방화꾼) + 스테이지 두목 둘(160px · 대두목과 같은 칸 차례)
py -3 -I tools/sprite-kit/bake-raid-enemies.py [--contact <png>] [--only H50,H51]
"""
import argparse, json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'assets_src/realm/raid'
OUT = ROOT / 'public/realm/anim-px'
# 칸 차례: 대기 4 · 걷기 8 · 공격 6 · 맞음 1 · 쓰러짐 1 (bandit-club 과 같은 20칸)
ORDER = [0]*4 + [1, 3, 2, 3, 1, 3, 2, 3] + [4, 4, 5, 5, 6, 6] + [7, 8]
ENEMIES = {'H31': 'bandit-runner', 'H33': 'bandit-slinger', 'H30': 'bandit-shield', 'H34': 'bandit-dog',
           'H35': 'bandit-berserker', 'H36': 'bandit-firearcher', 'H37': 'bandit-iron', 'H38': 'bandit-shaman'}
HEIGHT, BODY, BASE_PAD, FOOT_BAND, HIP = 128, 112, 4, .12, (.45, .65)
WALK = {1, 2, 3}
# 11-16 H50~H53 (설원 고개 · 불타는 산성) — 짐승은 서 있는 몸 키(BODY)를 사람보다 낮게: 범은 몸 길이가 사람 키쯤, 곰은 일어서면 사람보다 큼
NEW = {'H50': ('beast-tiger', 66), 'H51': ('beast-bear', 84), 'H52': ('snow-hunter', BODY), 'H53': ('torch-raider', BODY)}
# 스테이지 두목 (H45 여울 물두령 · H46 목책 배신 성장) — bake-bandit-warlord.py 와 같은 160px · 같은 칸 차례 (13 = 내려찍기 준비)
BOSS_ORDER = [0]*4 + [1, 3, 2, 3, 1, 3, 2, 3] + [0, 4, 5, 5, 6, 0, 7, 8]
BOSSES = {'H45': 'boss-ford', 'H46': 'boss-palisade', 'H54': 'boss-snow', 'H55': 'boss-fortress'}  # 11-16 저녁 H54 설원 설산 우두머리(쇠도리깨) · H55 산성 반란 장군(달군 망치)


def figures(path):
    """덩어리마다 가운데가 놓인 칸으로 나눈다 (칸을 넘어간 창끝도 제 사람에게 · 가는 줄 조각도 남김)"""
    a = np.array(Image.open(path).convert('RGBA'))
    H, W = a.shape[:2]
    a[a[..., 3] < 24, 3] = 0
    labels, n = ndimage.label(a[..., 3] > 0, structure=np.ones((3, 3)))
    owner = np.zeros(n+1, int) - 1
    for lab, reg in enumerate(ndimage.find_objects(labels), 1):
        if reg is None:
            continue
        ys, xs = np.nonzero(labels[reg] == lab)
        if len(ys) < 30:
            continue
        cy, cx = ys.mean()+reg[0].start, xs.mean()+reg[1].start
        owner[lab] = min(2, int(cy/(H/3)))*3 + min(2, int(cx/(W/3)))
    out = []
    for k in range(9):
        keep = owner[labels] == k
        if keep.sum() < 800:
            raise ValueError(f'{path.name} 칸 {k+1} 이 비었다')
        rgba = a.copy(); rgba[~keep, 3] = 0
        m = rgba[..., 3] > 64
        ys, xs = np.nonzero(m)
        y0, y1, x0, x1 = ys.min(), ys.max()+1, xs.min(), xs.max()+1
        if x0 < 1 or y0 < 1 or x1 > W-1 or y1 > H-1:
            raise ValueError(f'{path.name} 칸 {k+1} 이 그림 가장자리에 닿았다')
        h = y1-y0
        fx = float(xs[ys > y1-1-h*FOOT_BAND].mean())
        if k in WALK:
            fx = float(xs[(ys >= y0+h*HIP[0]) & (ys <= y0+h*HIP[1])].mean())
        out.append((Image.fromarray(rgba).crop((x0, y0, x1, y1)), (x0, y0, x1, y1), fx))
    return out


def bake(src_id, name, contact=None, body=BODY, height=HEIGHT, order=ORDER):
    parts = figures(SRC / f'haebi-pack-v1-{src_id}.png')
    scale = min(body/parts[0][0].height, (height-BASE_PAD*2)/max(p[0].height for p in parts))
    half = max(max(fx-b[0], b[2]-fx)*scale for _, b, fx in parts)
    width = int(np.ceil((half*2+12)/8)*8)
    sheet = Image.new('RGBA', (width*20, height))
    for k, i in enumerate(order):
        im, box, fx = parts[i]
        im = im.resize((max(1, round(im.width*scale)), max(1, round(im.height*scale))), Image.Resampling.LANCZOS)
        x = round(width/2-(fx-box[0])*scale); y = height-BASE_PAD-im.height
        if x < 1 or x+im.width > width-1 or y < 1:
            raise ValueError(f'{name} 칸 {k} 이 잘린다')
        sheet.alpha_composite(im, (k*width+x, y))
    # 칸 가장자리는 늘 투명해야 한다 (옆 칸이 번져 보이지 않게)
    al = np.array(sheet)[..., 3]
    for k in range(20):
        if al[:, k*width].any() or al[:, (k+1)*width-1].any():
            raise ValueError(f'{name} 칸 {k} 가장자리에 그림이 닿았다')
    sheet.save(OUT / f'{name}.png', optimize=True)
    if contact is not None:
        g = sheet.resize((sheet.width//2, height//2), Image.Resampling.NEAREST)
        contact.append((name, g, width//2))
    return {'name': name, 'size': sheet.size, 'cell': width, 'scale': round(scale, 4), 'feet': height-BASE_PAD}


def jobs():
    for sid, name in ENEMIES.items():
        yield sid, name, {}
    for sid, (name, body) in NEW.items():
        yield sid, name, {'body': body}
    for sid, name in BOSSES.items():
        yield sid, name, {'body': 140, 'height': 160, 'order': BOSS_ORDER}


if __name__ == '__main__':
    p = argparse.ArgumentParser(); p.add_argument('--contact', type=Path); p.add_argument('--only', default='')
    a = p.parse_args()
    only = {x for x in a.only.split(',') if x}
    rows = [] if a.contact else None
    for sid, name, kw in jobs():
        if only and sid not in only:
            continue
        print(json.dumps(bake(sid, name, rows, **kw), ensure_ascii=False))
    if rows:
        RH = max(g.height for _, g, _ in rows) + 12
        W = max(g.width for _, g, _ in rows)
        c = Image.new('RGB', (W, RH*len(rows)), '#3c4a3c'); d = ImageDraw.Draw(c)
        for k, (name, g, cw) in enumerate(rows):
            c.paste(g, (0, k*RH+10), g); d.text((2, k*RH), name, fill='white')
            d.line([0, k*RH+10+g.height-2, W, k*RH+10+g.height-2], fill='#ff4040')
            for j in range(21):
                d.line([j*cw, k*RH+10, j*cw, k*RH+10+g.height], fill='#ffd400')
        c.save(a.contact)
