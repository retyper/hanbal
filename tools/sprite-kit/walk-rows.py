# -*- coding: utf-8 -*-
"""걷기 앞 절반(칸 4~7)과 뒤 절반(칸 8~11)의 윗몸이 같은지 재고, 어긋나면 앞 절반을 두 번 쓰게 고친다
(11-25 살해 달래: 다리 교대가 아니라 **뒤 절반의 윗몸이 달라** 걸을 때 윗몸이 튄다 · 11-24 갠내와 같은 흠).

두 다리가 같은 색·같은 옷이면 옆모습 걷기의 앞 절반과 뒤 절반은 윤곽이 같다(다른 것은 다리 겹침 차례와 팔 흔듦뿐).
그림 도구가 뒤 절반의 윗몸을 다르게 그려 오면(허리띠·몸 각도·손 자리) 그것이 게임에서 가장 눈에 띄는 흠이다.
  py -3 -X utf8 -I tools/sprite-kit/walk-rows.py <띠 열쇠 …>            재기만(칸 i 와 i+4 의 윗몸 어긋남 %)
  py -3 -X utf8 -I tools/sprite-kit/walk-rows.py --fix <띠 열쇠 …>      뒤 절반(8~11)을 앞 절반(4~7)으로 덮는다(제자리 저장)
띠 = public/realm/anim-px/gen-<열쇠>.png · 칸 폭은 manifest.json 에서 읽는다. 윗몸 = 발 줄(feet)에서 몸 키의 42% 위쪽.
어긋남 % = 윗몸 구역에서 한쪽만 불투명하거나 색 차이가 큰(채널 합 90 넘는) 화소 ÷ 두 칸 윗몸 불투명 화소의 합집합.
다시 굽거나 `strip install` 하면 사라지니 그 뒤에 다시 돌린다.
"""
import json
import sys
from PIL import Image

ROOT = 'D:/flutter/arrow_game_one/public/realm/anim-px/'


def upper_diff(im, cw, a, b, feet, body):
    px = im.load()
    y1 = feet - int(body * .42)      # 이 줄 위가 윗몸
    y0 = max(0, feet - body - 12)
    uni = dif = 0
    for y in range(y0, y1):
        for x in range(cw):
            p, q = px[a * cw + x, y], px[b * cw + x, y]
            op, oq = p[3] > 120, q[3] > 120
            if not (op or oq):
                continue
            uni += 1
            if op != oq or abs(p[0] - q[0]) + abs(p[1] - q[1]) + abs(p[2] - q[2]) > 90:
                dif += 1
    return 100 * dif / max(1, uni)


def main(argv):
    fix = '--fix' in argv
    keys = [a for a in argv if not a.startswith('--')]
    man = json.load(open(ROOT + 'manifest.json', encoding='utf-8'))
    for k in keys:
        m = man.get('gen-' + k)
        if not m:
            print(k, '· manifest 에 없음')
            continue
        cw, ch = m['cell']
        path = f'{ROOT}gen-{k}.png'
        im = Image.open(path).convert('RGBA')
        d = [upper_diff(im, cw, 4 + i, 8 + i, m['feet'], m['bodyPx']) for i in range(4)]
        # 견줄 값: 앞 절반 안에서 이웃 칸끼리의 윗몸 차이(걸으며 자연히 흔들리는 몫)
        base = [upper_diff(im, cw, 4 + i, 5 + i, m['feet'], m['bodyPx']) for i in range(3)]
        print(f"{k}: 앞↔뒤 윗몸 어긋남 {' '.join(f'{v:.0f}%' for v in d)} (가운데 {sorted(d)[1]:.0f}~{sorted(d)[2]:.0f}) · 앞 절반 이웃 칸끼리 {' '.join(f'{v:.0f}%' for v in base)}")
        if fix:
            for i in range(4):
                cell = im.crop(((4 + i) * cw, 0, (5 + i) * cw, ch))
                im.paste(cell, ((8 + i) * cw, 0))
            im.save(path)
            print(f'  → {k}: 칸 8~11 을 칸 4~7 로 덮음')


if __name__ == '__main__':
    main(sys.argv[1:])
