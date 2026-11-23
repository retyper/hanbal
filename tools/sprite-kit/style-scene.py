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


if __name__ == '__main__' and sys.argv[1] != 'motion':
    main(sys.argv[1], sys.argv[2], len(sys.argv) > 3 and sys.argv[3] == 'm')


def motion_scene(identity, pose_sheet, out, style_ref='soseono', Z=4, CELL=640):
    """동작 판용 장면(3×2 · 칸 640): 왼쪽 줄 = [그 장수의 합격한 서기 그림(누구인가 + 결)] · [승인 띠(결)] · 오른쪽 2×2 = 대머리 자세 네 칸.
    자세 칸은 머리뼈 크기가 서기 그림과 맞게 줄인다(머리뼈 = 대머리 서기 키의 32/137 · 대머리 서기 키 = 장수 키의 92%).
      py -3 -I tools/sprite-kit/style-scene.py motion <합격한 서기.png(투명)> <자세 판.png> <나갈.png>"""
    import numpy as np
    o = Image.new('RGB', (CELL * 3, CELL * 2), (255, 0, 255)); H = N * Z
    idn = Image.open(identity).convert('RGBA'); idn = idn.crop(idn.getchannel('A').getbbox()); idn = idn.resize((round(idn.size[0] * H / idn.size[1]), H), Image.LANCZOS)
    ref = cell0(style_ref); ref = ref.resize((ref.size[0] * Z, ref.size[1] * Z), Image.NEAREST)
    for j, im in enumerate((idn, ref)):
        if im.size[0] > CELL - 20: im = im.crop(((im.size[0] - CELL + 20) // 2, 0, (im.size[0] + CELL - 20) // 2, im.size[1]))
        o.paste(im, ((CELL - im.size[0]) // 2, j * CELL + CELL - 40 - im.size[1]), im)
    sh = Image.open(pose_sheet).convert('RGB'); W, Hs = sh.size
    for j in range(2):
        for i in range(2):
            c = sh.crop((i * W // 2, j * Hs // 2, (i + 1) * W // 2, (j + 1) * Hs // 2)); a = np.asarray(c).astype(np.int16)
            k = np.minimum(a[..., 0], a[..., 2]) - a[..., 1]; al = np.clip((90 - k.astype(np.float32)) * 255 / 50, 0, 255).astype(np.uint8); ys, xs = np.nonzero(al > 60)
            fig = Image.fromarray(np.dstack([a.astype(np.uint8), al])).crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
            m = np.asarray(fig)[..., 3] > 60; h = m.shape[0]; wid = m.sum(1); lo, hi = int(h * .12), int(h * .38); skull = lo + int(np.argmin(wid[lo:hi]))
            s = (H * .92 * 32 / 137) / skull; fig = fig.resize((round(fig.size[0] * s), round(fig.size[1] * s)), Image.LANCZOS)
            cx = (xs.min() + xs.max()) / 2 / (W / 2)   # 칸 안의 가로 자리는 지킨다
            o.paste(fig, (CELL * (1 + i) + round(cx * CELL - fig.size[0] / 2), j * CELL + CELL - 40 - fig.size[1]), fig)
    o.save(out); print(out, o.size)


if __name__ == '__main__' and sys.argv[1] == 'motion':
    motion_scene(sys.argv[2], sys.argv[3], sys.argv[4])
