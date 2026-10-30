# -*- coding: utf-8 -*-
"""
장수 동작 그림 — 제미나이 시트 두 장(초록 #00FF00 바탕)을 병사와 같은 20칸 띠로 묶는다 (형 10-30: "전투할 때 장수 유닛도 추가해 줘").

  py -I tools/general-pack.py <이름> <시트 A.png> <A 사람 수> <걷기 8> <서기 4> <시트 B.png> <B 사람 수> <공격 6> <맞음> <쓰러짐>
  예) py -I tools/general-pack.py g-sword a.png 12 1,2,3,4,5,6,7,8 9,10,11,12 b.png 10 1,2,3,4,6,7 9 10

  시트 A (주문 A · docs/realm/GENERAL-SPRITES.md): 걷기 여덟과 서기 넷 · 시트 B (주문 B): 공격 여섯 · 맞음 · 쓰러짐.
  제미나이가 칸 수·차례를 시킨 대로 안 지킬 때가 많아, 몇 번째 사람(줄 위→아래, 줄 안 왼→오른, 1부터)을 쓸지 손으로 준다.

쓰는 것: public/realm/anim2/gen-<이름>.png — 칸 20개: 서기 0~3 · 걷기 4~11 · 공격 12~17 · 움찔 18 · 쓰러짐 19 (높이 160)
         그리고 한 칸의 가로세로 비와 몸 높이 비(서기 키 / 띠 높이)를 찍는다 → src/realm/data/art.ts GEN_ANIM

맞춤: 두 시트의 크기를 서기(A 9~12)와 공격 첫 칸(B 1 · 칼을 낮게 든 자세)의 키로 맞춘다.
걷기·서기는 칸마다 머리(위쪽 18% 잉크의 무게중심)를 칸 가운데에. 공격·맞음은 뒷발 뒤꿈치를 한 자리에 두고 첫 칸의 머리를 가운데에
(찌를 때 앞으로 나가는 것이 남는다). 쓰러짐은 잉크 가운데. 모든 칸은 발을 맨 아래 줄에.
떼어 내기는 tools/anim-cells.py 의 덩어리 모드(칸 줄이 있든 없든 된다).
"""
import os
import sys
import json
import subprocess
import tempfile
import numpy as np
from PIL import Image

R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
H = 160


def cut(sheet, n, tmp, head):
    subprocess.run([sys.executable, '-I', os.path.join(R, 'tools', 'anim-cells.py'), sheet, tmp, head, '0', str(n)], check=True, stdout=subprocess.DEVNULL)
    boxes = json.load(open(os.path.join(tmp, f'{head}-boxes.json')))
    if len(boxes) != n:
        raise SystemExit(f'{sheet}: 조각 {len(boxes)}개 (바란 것 {n})')
    for b in boxes:
        b['im'] = Image.open(os.path.join(tmp, b['file'])).convert('RGBA')
    return boxes


def head_x(im):
    a = np.asarray(im)[..., 3] > 40
    ys, xs = np.nonzero(a)
    top = ys.min()
    band = a[top: top + max(4, int((ys.max() - top) * 0.18)) + 1]
    return float(np.nonzero(band)[1].mean())


def body_x(im):
    """말 탄 장수 — 말 몸통(40~70% 높이 잉크)의 가운데. 치켜든 칼·깃털이 머리보다 높아 머리 기준이 흔들린다"""
    a = np.asarray(im)[..., 3] > 80
    return float(np.nonzero(a[int(a.shape[0] * 0.4):int(a.shape[0] * 0.7)])[1].mean())


def foot_x(im):
    """뒷발 뒤꿈치 — 맨 아래 10% 줄의 가장 왼쪽 잉크 (공격: 몸과 칼이 앞으로 나가도 뒷발은 남는다)"""
    a = np.asarray(im)[..., 3] > 80
    return float(np.nonzero(a[int(a.shape[0] * 0.9):])[1].min())


def nums(s):
    return [int(x) - 1 for x in s.split(',')]


def pack(name, sa, na, walk, idle, sb, nb, atk, hit, fall):
    tmp = tempfile.mkdtemp()
    A = cut(sa, na, tmp, 'a')
    B = cut(sb, nb, tmp, 'b')
    hA = float(np.median([A[i]['h'] for i in idle]))
    g = B[atk[0]]
    sB = hA / g['h']
    hx = body_x if name.startswith('mount') else head_x
    frames = [(A[i]['im'], hx(A[i]['im'])) for i in idle + walk]
    bs = [B[i]['im'].resize((max(1, round(B[i]['w'] * sB)), max(1, round(B[i]['h'] * sB))), Image.LANCZOS) for i in range(nb)]
    off = hx(bs[atk[0]]) - foot_x(bs[atk[0]])
    frames += [(bs[i], foot_x(bs[i]) + off) for i in atk + [hit]]
    frames.append((bs[fall], bs[fall].width / 2))
    if len(frames) != 20:
        raise SystemExit(f'칸 {len(frames)}개 (20 이어야)')
    top = max(f.height for f, _ in frames)
    k = H / top
    cells = []
    for f, ax in frames:
        f2 = f.resize((max(1, round(f.width * k)), max(1, round(f.height * k))), Image.LANCZOS)
        cells.append((f2, ax * k))
    half = max(max(ax, f.width - ax) for f, ax in cells)
    cw = int(np.ceil(half * 2 + 8))
    out = Image.new('RGBA', (cw * 20, H), (0, 0, 0, 0))
    for i, (f, ax) in enumerate(cells):
        out.alpha_composite(f, (int(round(i * cw + cw / 2 - ax)), H - f.height))
    dst = os.path.join(R, 'public', 'realm', 'anim2', f'gen-{name}.png')
    out.save(dst, optimize=True)
    body = hA * k / H
    print(f'gen-{name}: 칸 {cw}x{H} · 비 {cw}/{H} · 몸 {body:.3f} · {os.path.getsize(dst)} 바이트')


if __name__ == '__main__':
    a = sys.argv[1:]
    if len(a) != 10:
        raise SystemExit(__doc__)
    pack(a[0], a[1], int(a[2]), nums(a[3]), nums(a[4]), a[5], int(a[6]), nums(a[7]), int(a[8]) - 1, int(a[9]) - 1)
