# -*- coding: utf-8 -*-
"""몸에서 떨어진 작은 화소 조각 지우기 (11-25 쇠비 걷기 뒷발 둘레 검은 조각 · 형 「화소 흠은 코드로 직접」).

칸마다 불투명 화소(알파 > 40)를 8방향으로 이어 덩어리로 나누고, 가장 큰 덩어리(몸)에서 떨어진
작은 덩어리(화소 수 < 문턱)만 투명으로 만든다. 몸에 붙은 것은 건드리지 않는다.
  py -3 -X utf8 -I tools/sprite-kit/speck-clean.py <띠.png> <칸 폭> <문턱> [칸 번호 …]   (칸을 안 주면 전부 · 제자리 저장)
  --dry 를 붙이면 지울 덩어리만 찍고 저장하지 않는다.
  --four 는 대각선으로만 닿은 것도 떨어진 것으로 본다(대각 한 화소로 치마 끝에 걸린 조각) · y=<최소> 는 그 줄 아래 조각만(머리카락 끝을 안 건드리게).
"""
import sys
from PIL import Image


def comps(px, x0, w, h, four=False):
    seen, out = set(), []
    for y in range(h):
        for x in range(x0, x0 + w):
            if (x, y) in seen or px[x, y][3] <= 40:
                continue
            st, cur = [(x, y)], []
            seen.add((x, y))
            while st:
                cx, cy = st.pop()
                cur.append((cx, cy))
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        if four and dx and dy:
                            continue
                        nx, ny = cx + dx, cy + dy
                        if x0 <= nx < x0 + w and 0 <= ny < h and (nx, ny) not in seen and px[nx, ny][3] > 40:
                            seen.add((nx, ny))
                            st.append((nx, ny))
            out.append(cur)
    return out


def main(a):
    dry, four = '--dry' in a, '--four' in a
    ymin = next((int(v[2:]) for v in a if v.startswith('y=')), 0)
    a = [v for v in a if v not in ('--dry', '--four') and not v.startswith('y=')]
    path, cw, th = a[0], int(a[1]), int(a[2])
    im = Image.open(path).convert('RGBA')
    px = im.load()
    n = im.width // cw
    cells = [int(v) for v in a[3:]] or range(n)
    total = 0
    for c in cells:
        cs = sorted(comps(px, c * cw, cw, im.height, four), key=len, reverse=True)
        for k in cs[1:]:
            if len(k) < th and min(p[1] for p in k) >= ymin:
                xs, ys = [p[0] - c * cw for p in k], [p[1] for p in k]
                print(f'칸 {c}: 조각 {len(k)}화소 x {min(xs)}~{max(xs)} y {min(ys)}~{max(ys)}')
                total += len(k)
                if not dry:
                    for p in k:
                        px[p] = (0, 0, 0, 0)
    if not dry:
        im.save(path)
    print(f'지운 화소 {total}' + (' (시험 · 저장 안 함)' if dry else ''))


if __name__ == '__main__':
    main(sys.argv[1:])
