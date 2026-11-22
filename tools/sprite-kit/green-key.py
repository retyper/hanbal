"""크로마키 초록(#00FF00) 바탕 빼기 — 열전 장식 다시 그림(Codex 85 · 형 11-23 「누끼가 덜 따졌다 · 크로마키 배경으로」).
초록 기운(g − max(r,b))으로 투명도를 정하고(부드러운 가장자리), 가장자리 초록 번짐을 걷는다(despill). 그림 상자로 자른 뒤
옛 파일과 같은 크기 판에 발밑(아래 가운데)을 맞춰 넣는다.
  py -3 -I tools/sprite-kit/green-key.py <원본.png> <나갈.webp> [옛 파일(크기 견본)] [--check 미리보기.jpg]
"""
import sys
import numpy as np
from PIL import Image

LO, HI = 40, 110   # 초록 기운이 LO 아래면 불투명 · HI 위면 완전 투명


def key(img):
    a = np.asarray(img.convert('RGB')).astype(np.int16)
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    green = g - np.maximum(r, b)
    alpha = np.clip((HI - green.astype(np.float32)) * 255 / (HI - LO), 0, 255).astype(np.uint8)   # int16 로 곱하면 넘친다(11-23 뒤집힘)
    # despill: 남는 화소의 초록을 r·b 의 큰 쪽까지만
    g2 = np.where(green > 0, np.maximum(r, b), g)
    out = np.dstack([r, g2, b, alpha]).astype(np.uint8)
    return Image.fromarray(out)


def main():
    args = [x for x in sys.argv[1:] if not x.startswith('--')]
    src, dst = args[0], args[1]
    im = key(Image.open(src))
    bb = im.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox()
    im = im.crop(bb)
    if len(args) > 2:
        ref = Image.open(args[2]); W, H = ref.size
        k = min(W / im.size[0], H / im.size[1])
        im = im.resize((max(1, round(im.size[0] * k)), max(1, round(im.size[1] * k))), Image.LANCZOS)
        canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0)); canvas.alpha_composite(im, ((W - im.size[0]) // 2, H - im.size[1])); im = canvas
    im.save(dst, quality=92, method=6)
    if '--check' in sys.argv:
        p = sys.argv[sys.argv.index('--check') + 1]
        bg = Image.new('RGBA', im.size, (235, 235, 220, 255)); bg.alpha_composite(im); bg.convert('RGB').save(p, quality=88)
    print(dst, im.size)


if __name__ == '__main__':
    main()
