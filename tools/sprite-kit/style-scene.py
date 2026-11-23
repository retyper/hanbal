# -*- coding: utf-8 -*-
"""그림 결 장면 (11-23 형 「초기 소서노·감실에서 멀어진다 · 싸구려 만화책 그림체」).
승인된 띠(소서노·감실·진하)를 화소 그대로 5배로 키워 자홍 바탕에 세우고, 그 사이 빈자리에 기본 몸(kit)을 같은 키로 세운다.
그림 도구에는 「가운데 대머리 몸만 옆 장수들과 똑같은 도트 결로 그려라 · 옆 장수는 손대지 마라」 → 자세·비율·크기·결을 한 장이 다 말한다.
받은 그림은 Claude 가 가운데 사람만 코드로 자른다(다시 그리게 하지 않는다).
  py -3 -I tools/sprite-kit/style-scene.py <kit 몸.png> <나갈.png> [남자면 m]
"""
import sys
from PIL import Image

PX = 'public/realm/anim-px'; Z = 5; N = 137


def cell0(n):
    im = Image.open(f'{PX}/gen-{n}.png').convert('RGBA'); fw = im.size[0] // 20; c = im.crop((0, 0, fw, im.size[1])); return c.crop(c.getchannel('A').getbbox())


def main(body, out, male=False):
    refs = [cell0(n) for n in (('soseono', 'gamsil') if not male else ('gamsil', 'base-g-40-anya-adan'))] + [cell0('jinha' if not male else 'base-g-38-chopal-palmae')]
    b = Image.open(body).convert('RGBA'); b = b.crop(b.getchannel('A').getbbox()); h = round(N * Z * (142 / 137 if male else 1))
    # 기본 몸은 대머리 → 머리카락 몫만큼 낮다: 옆 장수 키의 92%
    b = b.resize((round(b.size[0] * h * .92 / b.size[1]), round(h * .92)), Image.LANCZOS)
    big = [r.resize((r.size[0] * Z, r.size[1] * Z), Image.NEAREST) for r in refs]
    order = [big[0], big[1], b, big[2]]; gap = 60; slot = max(b.size[0], 520)
    W = sum(i.size[0] for i in order) - b.size[0] + slot + gap * 5; H = max(i.size[1] for i in order) + 160
    o = Image.new('RGB', (W, H), (255, 0, 255)); x = gap
    for im in order:
        w = slot if im is b else im.size[0]
        o.paste(im, (x + (w - im.size[0]) // 2, H - 60 - im.size[1]), im); x += w + gap
    o.save(out); print(out, o.size)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], len(sys.argv) > 3 and sys.argv[3] == 'm')
