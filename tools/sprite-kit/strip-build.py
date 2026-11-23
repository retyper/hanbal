# -*- coding: utf-8 -*-
"""뼈대 방식으로 구운 칸들을 20칸 띠로 묶는다 (11-23 · ART-SKELETON 양산 방식의 마지막 걸음).
띠 규격(옛 gen-*.png 와 같다): 칸 208×160 · 발바닥 줄 155 · 서기 0~3 · 걷기 4~11 · 공격 12~17 · 맞음 18 · 쓰러짐 19.
  서기 = 그린 서기 판 네 칸(없으면 서 있는 한 장을 네 번 · 코드로 몸을 밀지 않는다)
  걷기 = A3 A4 A1 A2 B3 B4 B1 B2 (지나감 → 뻗음 → 딛음 → 내려앉음 · 반대 다리로 한 번 더)
  공격 = 네 칸을 여섯 자리에: 1 1 2 3 3 4 (준비 둘 · 뻗음 · 지나감 둘 · 되돌아옴)
  맞음 = 쓰러짐 판 칸1 · 쓰러짐 = 쓰러짐 판 칸4
  py -3 -I tools/sprite-kit/strip-build.py <이름> <공격 꼬리표: claw 등> <나갈 png>
"""
import sys
import numpy as np
from PIL import Image

PXD = 'D:/에셋창고/STD/px'; CW, CH, FOOT, CX = 208, 160, 155, 104; HIP = .52


def place(im):
    c = Image.new('RGBA', (CW, CH), (0, 0, 0, 0)); im = im.crop(im.getchannel('A').getbbox())
    c.alpha_composite(im, (CX - im.size[0] // 2, FOOT - im.size[1])); return c


def breathe(cell, d):
    if d == 0: return cell
    a = np.asarray(cell).copy(); ys = np.nonzero((a[..., 3] > 40).any(1))[0]; top, bot = ys.min(), ys.max(); hip = int(top + (bot - top) * HIP)
    up = a[:hip].copy(); out = a.copy(); out[:hip] = 0
    out[d:hip + d] = np.where(up[..., 3:4] > 0, up, out[d:hip + d]); return Image.fromarray(out)


def main(name, atk, out):
    cell = lambda tag, i: Image.open(f'{PXD}/{name}-{tag}-{i}.png').convert('RGBA')
    stand = place(Image.open(f'{PXD}/{name}-stand-game.png').convert('RGBA'))
    # 서기: 코드로 윗몸을 밀지 않는다 (11-23 형 「idle 누가 코드로 짜랬냐 · 몸이 막 잘리잖아」). 그린 서기 판(<이름>-idle-1..4)이 있으면 그것, 없으면 네 칸 모두 같은 그림.
    import os
    # 그린 서기 판의 칸: 1 바로 섬 · 2 들이쉼 · 3 한 다리에 무게(발 자리가 달라 숨쉬기에는 안 쓴다) · 4 내쉼 → 띠에는 들이쉼 · 바로 · 내쉼 · 바로
    def feet_fixed(im):
        # 서기 칸은 발이 한자리에: 발바닥 띠의 가운데를 칸 한가운데(CX)에 맞춘다 (칸마다 5px 씩 어긋나 있었다 · 11-23)
        a = np.asarray(im)[..., 3] > 0
        ys, xs = np.nonzero(a)
        fx = np.nonzero(a[ys.max() - 6:ys.max() + 1])[1]
        d = int(round(CX - (fx.min() + fx.max()) / 2))
        o = Image.new('RGBA', im.size, (0, 0, 0, 0))
        o.alpha_composite(im.crop((max(0, -d), 0, im.size[0] - max(0, d), im.size[1])), (max(0, d), 0))
        return o
    # 형 11-23: 「숨쉬는 거는 너무 등산하는 숨쉬기 · 기본 idle 은 서 있는 자세 2컷으로 텀 길게 · 가끔씩 큰 숨」
    # 게임은 서기 칸을 0·1·2·1 차례로 같은 박자로 돌린다 -> 0·1 = 바로 선 그림, 2 = 눈을 감은 칸(느린 깜빡임), 3 = 큰 숨(들이쉼 · 서기 틀이 바뀌면 가끔만 쓴다)
    frames = [feet_fixed(cell('idle', i)) for i in (1, 1, 4, 2)] if os.path.exists(f'{PXD}/{name}-idle-1.png') else [stand] * 4
    frames += [cell('walk-a', i) for i in (3, 4, 1, 2)] + [cell('walk-b', i) for i in (3, 4, 1, 2)]
    frames += [cell(atk, i) for i in (1, 1, 2, 3, 3, 4)]
    frames += [cell('down', 1), cell('down', 4)]
    # 덧칸 (형 11-23: 쓰러짐을 KO 처럼 오래·느리게·당겨서 · 서기에 개성 동작): 20·21 = 쓰러지는 가운데 두 칸(주저앉음 · 손 짚고 눕는 중) · 22~25 = 개성 동작 네 칸
    #   넷째 값에 ext 를 주면 붙인다. 게임이 20칸 넘는 띠를 읽게 된 뒤에만 넣는다.
    if 'ext' in sys.argv[4:]:
        frames += [cell('down', 2), cell('down', 3)]
        if os.path.exists(f'{PXD}/{name}-quirk-1.png'):
            frames += [feet_fixed(cell('quirk', i)) for i in (1, 2, 3, 4)]
        # 26~33 = 여덟 칸 공격(준비 2 · 휘두름 3 · 지나감 2 · 거둠 1 · 타격 칸 = 넷째) — 개성 동작 네 칸이 있어야 번호가 맞는다
        if os.path.exists(f'{PXD}/{name}-{atk}8-a-1.png') and os.path.exists(f'{PXD}/{name}-quirk-1.png'):
            frames += [cell(atk + '8-a', i) for i in (1, 2, 3, 4)] + [cell(atk + '8-b', i) for i in (1, 2, 3, 4)]
    # align: 서기·공격 칸의 머리 가로 자리를 걷기 칸에 맞춘다 (활처럼 한쪽으로 뻗은 물건을 든 장수는 테두리 가운데와 몸 가운데가 다르다)
    if 'align' in sys.argv[4:]:
        def head_x(im):
            a = np.asarray(im)[..., 3] > 0
            ys = np.nonzero(a.any(1))[0]
            return float(np.nonzero(a[ys.min() + 10:ys.min() + 40])[1].mean())
        def shift(im, d):
            o = Image.new('RGBA', im.size, (0, 0, 0, 0))
            o.alpha_composite(im.crop((max(0, -d), 0, im.size[0] - max(0, d), im.size[1])), (max(0, d), 0))
            return o
        hw = float(np.median([head_x(f) for f in frames[4:12]]))
        # 서기는 머리 평균이 아니라 윗몸(위 4~45%)을 걷기 칸에 겹쳐 맞춘다 — 머리카락·깃털이 한쪽으로 길면 평균이 끌려간다 (anim-check 가 범에서 9.5px 어긋남을 잡았다 · 11-23)
        def upper(im):
            a = np.asarray(im)[..., 3] > 40
            ys = np.nonzero(a.any(1))[0]
            h = ys.max() - ys.min() + 1
            u = np.zeros_like(a)
            u[ys.min() + int(h * .04):ys.min() + int(h * .45)] = a[ys.min() + int(h * .04):ys.min() + int(h * .45)]
            return u
        def reg(a, r, reach=20):
            # 가로·세로를 함께 본다(anim-check 와 같은 셈) — 가로만 보면 서기와 걷기의 키가 1~2px 다를 때 엉뚱한 자리에 맞는다(궁수: 2px 로 맞췄는데 검사는 6.5px 어긋남 · 11-24)
            best, at = None, 0
            for dy in range(-7, 8):
                ry = np.roll(r, dy, axis=0)
                for dx in range(-reach, reach + 1):
                    c = int((a ^ np.roll(ry, dx, axis=1)).sum())
                    if best is None or c < best or (c == best and abs(dx) < abs(at)):
                        best, at = c, dx
            return at
        su = upper(frames[0])
        ds = [reg(upper(f), su) for f in frames[4:12]]
        d0 = int(round((max(ds) + min(ds)) / 2))
        d1 = 0 if 'rooted' in sys.argv[4:] else int(round(hw - head_x(frames[12])))   # rooted: 공격 칸은 뿌리에 맞춰 구운 것(attack4) — 다시 밀면 뿌리가 깨진다
        frames[0:4] = [shift(f, d0) for f in frames[0:4]]
        frames[12:18] = [shift(f, d1) for f in frames[12:18]]
        if len(frames) >= 26:   # 개성 동작 네 칸(22~25)도 서기에서 이어진다 → 첫 칸의 윗몸을 (옮긴 뒤의) 서기에 맞춘다
            dq = reg(upper(frames[0]), upper(frames[22]))
            frames[22:26] = [shift(f, dq) for f in frames[22:26]]
            print('개성 동작 맞춤', dq)
        print('머리 맞춤: 서기', d0, '공격', d1)
    strip = Image.new('RGBA', (CW * len(frames), CH), (0, 0, 0, 0))
    for i, f in enumerate(frames): strip.alpha_composite(f, (i * CW, 0))
    strip.save(out); print(out, strip.size)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], sys.argv[3])
