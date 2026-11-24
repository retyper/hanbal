# -*- coding: utf-8 -*-
"""벌린 입이 콧수염처럼 읽히는 칸 고치기 (11-25 웅천 곰 내려찍기 · 도끼 묶음 검수 「입 벌린 칸 얼굴이 콧수염 난 남자처럼 읽힘」).

작은 칸에서 검게 벌린 입과 그 위 짙은 윗입술 그늘이 한 덩어리 가로 띠가 되면 콧수염으로 읽힌다.
열마다 위에서부터: 처음 만나는 짙은 화소(윗입술 그늘) → 살 그늘색, 그 아래 짙은 화소 둘 → 짙은 붉은색(입 속). 그 아래는 손대지 않는다(턱 그늘이 핏자국처럼 되지 않게).
다시 굽거나 strip install 하면 사라지니 그 뒤에 다시 돌린다:
  py -3 -X utf8 -I tools/sprite-kit/mouth-fix.py <띠 열쇠>      예: gom  (public/realm/anim-px/gen-<열쇠>-x.png)
"""
import sys
from PIL import Image

# 열쇠 → [(넓은 칸 번호, x0, x1, y0, y1)] (칸 안 좌표 · 칸 폭 240)
FIX = {
    'gom': [(10, 124, 137, 150, 158), (11, 126, 140, 158, 167)],
}
LIP, MOUTH = (206, 142, 112, 255), (96, 34, 36, 255)


def lum(p):
    return p[0] * .3 + p[1] * .59 + p[2] * .11


def main(key):
    path = f'D:/flutter/arrow_game_one/public/realm/anim-px/gen-{key}-x.png'
    im = Image.open(path).convert('RGBA')
    px, cw, n = im.load(), 240, 0
    for c, x0, x1, y0, y1 in FIX[key]:
        for x in range(x0, x1):
            k = 0
            for y in range(y0, y1):
                p = px[c * cw + x, y]
                if p[3] < 200:
                    continue
                if lum(p) < 95:
                    if k == 0:
                        px[c * cw + x, y] = LIP
                    elif k <= 2:
                        px[c * cw + x, y] = MOUTH
                    k += 1
                    n += 1
                elif k > 0:
                    break
    im.save(path)
    print(f'{key}: 바뀐 화소 {n}')


if __name__ == '__main__':
    for key in sys.argv[1:]:
        main(key)
