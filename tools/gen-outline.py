"""
장수 싸움 띠(public/realm/anim2/gen-*.png)에 군사 띠처럼 짙은 테두리를 두르고 살짝 또렷하게 한다.
형 11-09: "장수 전투 그림이 흐림 (군사는 또렷)" — 군사 띠는 굵은 검은 윤곽·센 대비, 장수 띠는 가는 선·옅은 색이라 작게 보면 뭉개졌다.

  py -3 -X utf8 tools/gen-outline.py [파일…]      (없으면 gen-*.png 모두)
옛 그림은 assets_src/realm/retired/anim2-outline/ 에 남긴다 (메모리: 옛 그림 보관). 이미 두른 띠는 다시 두르지 않는다(표: 같은 폴더의 .done).
"""
import os
import sys
import glob
import shutil
from PIL import Image, ImageFilter, ImageChops

SRC = 'public/realm/anim2'
KEEP = 'assets_src/realm/retired/anim2-outline'
OUTLINE = (24, 18, 14)


def outline(im: Image.Image) -> Image.Image:
    im = im.convert('RGBA')
    r, g, b, a = im.split()
    # 살짝 또렷하게 — 색만 (알파는 그대로)
    rgb = Image.merge('RGB', (r, g, b)).filter(ImageFilter.UnsharpMask(radius=1.2, percent=70, threshold=2))
    solid = a.point(lambda v: 255 if v >= 110 else 0)
    ring = ImageChops.subtract(solid.filter(ImageFilter.MaxFilter(3)), solid)  # 몸 바깥 1px
    out = Image.merge('RGBA', (*rgb.split(), a))
    line = Image.new('RGBA', im.size, OUTLINE + (0,))
    line.putalpha(ring.point(lambda v: 225 if v else 0))
    # 테두리를 몸 밑에 깐다 (가장자리 반투명 픽셀은 몸 색이 위에)
    return Image.alpha_composite(line, out)


def main() -> None:
    files = sys.argv[1:] or sorted(glob.glob(f'{SRC}/gen-*.png'))
    os.makedirs(KEEP, exist_ok=True)
    done_path = f'{KEEP}/.done'
    done = set(open(done_path, encoding='utf-8').read().split()) if os.path.exists(done_path) else set()
    n = 0
    for f in files:
        name = os.path.basename(f)
        if name in done:
            continue
        if not os.path.exists(f'{KEEP}/{name}'):
            shutil.copy2(f, f'{KEEP}/{name}')
        outline(Image.open(f)).save(f, optimize=True)
        done.add(name)
        n += 1
    open(done_path, 'w', encoding='utf-8').write('\n'.join(sorted(done)) + '\n')
    print(f'테두리 두름 {n}장 · 옛 그림 {KEEP}')


if __name__ == '__main__':
    main()
