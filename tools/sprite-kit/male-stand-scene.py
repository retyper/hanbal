# -*- coding: utf-8 -*-
"""남장수 서기 장면 (11-25 · 남장수 띠 다시 그리기 시험 판).
승인된 남자 기준 띠 셋(g-40 안야 · g-38 초팔 · g-20 사물)을 화소 그대로 5배로 세우고, 가운데 빈자리에 남자 기본 몸(kit/m-*.png · 대머리 · 머리뼈 31)을 같은 키 규칙으로 세운다.
style-scene.py(여자 기준 장면)의 남자판: 여자 장면에는 소서노·감실이 서 있어 남자 비율 기준이 되지 못한다.
  py -3 -I tools/sprite-kit/male-stand-scene.py <m-standard|m-lean|m-muscular|m-heavy> <나갈.png>
"""
import sys
from PIL import Image

PX = 'public/realm/anim-px'; Z = 5; N = 138
KIT = 'D:/에셋창고/STD/kit'
REFS = ('base-g-40-anya-adan', 'base-g-38-chopal-palmae', 'base-g-20-samul-sea-lord')


def cell0(n):
    im = Image.open(f'{PX}/gen-{n}.png').convert('RGBA'); fw = im.size[0] // 20; c = im.crop((0, 0, fw, im.size[1])); return c.crop(c.getchannel('A').getbbox())


def main(kind, out):
    refs = [cell0(n) for n in REFS]
    b = Image.open(f'{KIT}/{kind}.png').convert('RGBA'); b = b.crop(b.getchannel('A').getbbox())
    h = round(N * Z * .92)   # 대머리 기본 몸 = 옆 장수 키의 92% (머리카락·관 몫)
    b = b.resize((round(b.size[0] * h / b.size[1]), h), Image.LANCZOS)
    big = [r.resize((r.size[0] * Z, r.size[1] * Z), Image.NEAREST) for r in refs]
    order = [big[0], b, big[1], big[2]]; gap = 60; slot = max(b.size[0], 520)
    W = sum(i.size[0] for i in order) - b.size[0] + slot + gap * 5; H = max(i.size[1] for i in order) + 160
    o = Image.new('RGB', (W, H), (255, 0, 255)); x = gap
    for im in order:
        w = slot if im is b else im.size[0]
        o.paste(im, (x + (w - im.size[0]) // 2, H - 60 - im.size[1]), im); x += w + gap
    o.save(out); print(out, o.size, 'ref heights', [r.size[1] // Z for r in refs], 'body', h // Z)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
