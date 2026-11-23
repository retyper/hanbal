"""숨 쉬는 서기 칸 굽기 (형 11-23 · 검수: 258 띠 중 100 이 서기 네 칸이 사실상 같은 그림 — 기준 소서노도).
칸 0 을 바탕으로 칸 1·2 의 **윗몸(엉덩이 위)만 1·2px 아래로 내려앉힌다**(엉덩이 줄에서 한 줄씩 겹쳐 눌림 · 발·다리는 그대로).
게임은 0,1,2,1 차례로 0.65초씩 → 들숨(0) · 반(1) · 날숨(2). 칸 3 은 1 과 같게.
  py -3 -I tools/sprite-kit/idle-breath.py --gif <띠,띠> <나갈.gif>    → 시험 움짤(지금 · 숨 넣은 판 나란히)
  py -3 -I tools/sprite-kit/idle-breath.py --write <띠 ...>            → 기본 띠에 굽기
"""
import sys
import numpy as np
from PIL import Image

PX = 'public/realm/anim-px'
HIP, DROP = .52, (0, 1, 2, 1)   # 엉덩이 = 몸 위에서 52% · 칸마다 내려앉는 px


def breathe(cell, d):
    if d == 0: return cell
    a = np.asarray(cell).copy(); al = a[:, :, 3] > 40
    ys = np.nonzero(al.any(1))[0]; top, bot = ys.min(), ys.max()
    hip = int(top + (bot - top) * HIP)
    up = a[:hip].copy()
    out = a.copy(); out[:hip] = 0
    out[d:hip + d] = np.where(up[:, :, 3:4] > 0, up, out[d:hip + d])   # 윗몸을 d px 아래로 · 엉덩이 줄 위에 얹음
    return Image.fromarray(out)


def cells_of(name):
    im = Image.open(f'{PX}/gen-{name}.png').convert('RGBA'); fw = im.size[0] // 20
    return im, fw, [im.crop((i * fw, 0, (i + 1) * fw, im.size[1])) for i in range(4)]


def gif(names, out, scale=2):
    frames = []
    seq = [0, 1, 2, 1]
    rows = []
    for n in names:
        im, fw, cs = cells_of(n)
        rows.append((cs, [breathe(cs[0], DROP[i]) for i in range(4)]))
    fw, h = rows[0][0][0].size
    for k in range(8):
        i = seq[k % 4]
        f = Image.new('RGBA', (2 * fw * len(rows), h), (214, 206, 186, 255))
        for j, (old, new) in enumerate(rows):
            f.alpha_composite(old[i], (2 * j * fw, 0)); f.alpha_composite(new[i], ((2 * j + 1) * fw, 0))
        frames.append(f.convert('RGB').resize((f.size[0] * scale, h * scale), Image.NEAREST))
    frames[0].save(out, save_all=True, append_images=frames[1:], duration=650, loop=0)


def write(name):
    im, fw, cs = cells_of(name)
    for i in (1, 2, 3): im.paste(breathe(cs[0], DROP[i]), (i * fw, 0))
    im.save(f'{PX}/gen-{name}.png', optimize=True); print(name, '씀')


if __name__ == '__main__':
    if sys.argv[1] == '--gif': gif(sys.argv[2].split(','), sys.argv[3])
    else: [write(n) for n in sys.argv[2:]]
