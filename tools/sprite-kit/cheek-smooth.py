# -*- coding: utf-8 -*-
"""게임 띠의 앞볼 윤곽을 매끈하게 — 볼을 깎지 않고 윤곽선을 볼 **바깥**에 둔다 (11-25 형 「너무 홀쭉하게 들어갔는데 · 니가 직접 고치는 게 낫지 않아? 코드로」).

앞 보정(pixel-fix.py)은 배경에 닿은 볼 살색 화소를 윤곽색으로 덮어 볼이 한 화소씩 안으로 들어갔다(홀쭉).
여기서는 줄(y)마다 얼굴 앞 윤곽의 바깥 x 를 잰다:
  윤곽이 있는 줄 = 가장 오른쪽 불투명 화소 · 살이 배경에 드러난 줄 = 가장 오른쪽 살 화소 + 1 (거기에 윤곽을 새로 둘 자리)
위아래 한 줄씩과 견준 가운데 값으로 매끈하게 고르고(한 줄만 튀어나온 혹·한 줄만 들어간 홈이 사라진다),
줄마다 그 x 에 윤곽색 한 화소 · 그 안쪽 빈 곳은 옆 살색으로 채움 · 그 바깥은 투명. 볼 살은 깎지 않는다.

  py -3 -X utf8 -I tools/sprite-kit/cheek-smooth.py <띠.png> <나갈.png> <칸 폭> <칸,y0,y1,xmin> [<칸,y0,y1,xmin> …]
  xmin 은 칸 안 x(이보다 왼쪽은 보지 않는다 · 뒤통수 머리카락을 건드리지 않게).
"""
import sys
from PIL import Image

LINE = (11, 7, 10, 255)


def skin(p):
    r, g, b, a = p
    return a > 200 and r > 170 and g > 120 and r - b > 25


def smooth(im, cw, cell, y0, y1, xmin):
    px = im.load()
    left, right = cell * cw + xmin, cell * cw + cw - 1
    rows = {}
    for y in range(y0, y1 + 1):
        xs = [x for x in range(left, right + 1) if px[x, y][3] > 200]
        if not xs:
            continue
        e = max(xs)
        rows[y] = (e + 1, True) if skin(px[e, y]) else (e, False)   # (윤곽이 설 x, 살이 드러났나)
    ys = sorted(rows)
    changed = 0
    for i, y in enumerate(ys):
        near = [rows[ys[j]][0] for j in (i - 1, i, i + 1) if 0 <= j < len(ys) and abs(ys[j] - y) == abs(j - i)]
        t = sorted(near)[len(near) // 2]
        e = max(x for x in range(left, right + 1) if px[x, y][3] > 200)
        sk = next((px[x, y] for x in range(min(e, t - 1), left - 1, -1) if skin(px[x, y])), None)
        before = [px[x, y] for x in range(left, right + 1)]
        for x in range(t + 1, right + 1):
            px[x, y] = (0, 0, 0, 0)
        for x in range(e + 1, t):   # 홈 메우기: 윤곽 안쪽 빈 곳을 살로
            if sk:
                px[x, y] = sk
        if rows[y][1] or t != rows[y][0]:
            px[t, y] = LINE
        changed += sum(1 for x, b in zip(range(left, right + 1), before) if px[x, y] != b)
    return changed


def main(a):
    im = Image.open(a[0]).convert('RGBA')
    cw = int(a[2])
    for spec in a[3:]:
        c, y0, y1, xmin = (int(v) for v in spec.split(','))
        print(f'칸 {c} y {y0}~{y1}: 바뀐 화소 {smooth(im, cw, c, y0, y1, xmin)}')
    im.save(a[1])


if __name__ == '__main__':
    main(sys.argv[1:])
