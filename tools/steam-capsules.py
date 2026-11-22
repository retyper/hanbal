"""스팀 상점 그림 굽기 (docs/realm/STEAM-STORE.md §4 · Codex 84 · 출시 작전 LAUNCH-PLAN §6).
대표 그림 셋(생포 순간 가로 · 쇠비 세로 · 넓은 풍경)에 로고를 얹어 스팀 규격으로 자른다. 한국어 로고판(ko)과 영어 로고판(en)을 따로.
  py -3 -I tools/steam-capsules.py   → assets_src/realm/steam/out/<이름>-<ko|en>.png + 한 장 견본 contact.jpg
"""
import os
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets_src/realm/steam')
OUT = os.path.join(SRC, 'out')
CAP = os.path.join(SRC, 'key-capture-fixed.png')           # 하늘 이음매 고친 판
VER = 'D:/에셋창고/codex84/key-vertical.png'
WIDE = 'D:/에셋창고/codex84/key-wide.png'
LOGO = {'ko': os.path.join(ROOT, 'public/realm/logo/title.png'), 'en': os.path.join(ROOT, 'public/realm/logo/title-en.png')}


def cover(img, w, h, fx=.5, fy=.5):
    """비율을 지키며 꽉 채워 자른다 (fx·fy = 남길 가운데 자리)"""
    k = max(w / img.size[0], h / img.size[1])
    im = img.resize((round(img.size[0] * k), round(img.size[1] * k)), Image.LANCZOS)
    x = round((im.size[0] - w) * fx); y = round((im.size[1] - h) * fy)
    return im.crop((x, y, x + w, y + h))


def logo(lang, width):
    im = Image.open(LOGO[lang]).convert('RGBA'); im = im.crop(im.getbbox())
    return im.resize((width, round(im.size[1] * width / im.size[0])), Image.LANCZOS)


def shade(base, box, alpha=110, blur=40):
    """로고 뒤 어둠 한 겹 (글자가 하늘에서 떠 보이게)"""
    s = Image.new('RGBA', base.size, (0, 0, 0, 0)); ImageDraw.Draw(s).ellipse(box, fill=(0, 0, 0, alpha))
    base.alpha_composite(s.filter(ImageFilter.GaussianBlur(blur)))


def place(base, lg, cx, cy):
    base.alpha_composite(lg, (round(cx - lg.size[0] / 2), round(cy - lg.size[1] / 2)))


def main():
    os.makedirs(OUT, exist_ok=True)
    cap = Image.open(CAP).convert('RGBA'); ver = Image.open(VER).convert('RGBA'); wide = Image.open(WIDE).convert('RGBA')
    made = []
    for lang in ('ko', 'en'):
        # 헤더 920×430 · 인물은 오른쪽 · 로고는 왼쪽 하늘
        h = cover(cap, 920, 430, .55, .45); lg = logo(lang, 380); shade(h, (20, 60, 440, 300)); place(h, lg, 230, 175)
        # 메인 1232×706
        m = cover(cap, 1232, 706, .5, .4); lg = logo(lang, 500); shade(m, (30, 70, 600, 380)); place(m, lg, 310, 220)
        # 작은 캡슐 462×174 · 로고만 크게 (작아도 읽히게)
        sm = cover(cap, 462, 174, .3, .25); lg = logo(lang, 400); shade(sm, (-20, -30, 482, 204), 150, 20); place(sm, lg, 231, 87)
        # 세로 748×896 · 쇠비 · 로고는 위 하늘
        v = cover(ver, 748, 896, .5, .55); lg = logo(lang, 560); shade(v, (60, 10, 690, 240)); place(v, lg, 374, 120)
        for name, im in (('header', h), ('main', m), ('small', sm), ('vertical', v)):
            p = os.path.join(OUT, f'{name}-{lang}.png'); im.convert('RGB').save(p); made.append(p)
    # 라이브러리 히어로 3840×1240 (글자 없음) · 라이브러리 로고 1280×720 투명
    hero = cover(wide, 3840, 1240, .5, .5); hero.convert('RGB').save(os.path.join(OUT, 'library-hero.png')); made.append('library-hero')
    for lang in ('ko', 'en'):
        L = Image.new('RGBA', (1280, 720), (0, 0, 0, 0)); place(L, logo(lang, 1100), 640, 360); L.save(os.path.join(OUT, f'library-logo-{lang}.png'))
    # 견본
    sheet = Image.new('RGB', (1900, 1000), (30, 30, 30)); x = 10
    for n in ('header-en', 'main-en', 'small-en'):
        im = Image.open(os.path.join(OUT, f'{n}.png')); im.thumbnail((620, 360)); sheet.paste(im, (x, 10)); x += im.size[0] + 10
    im = Image.open(os.path.join(OUT, 'vertical-ko.png')); im.thumbnail((400, 480)); sheet.paste(im, (10, 400))
    im = Image.open(os.path.join(OUT, 'header-ko.png')); im.thumbnail((620, 300)); sheet.paste(im, (430, 400))
    im = Image.open(os.path.join(OUT, 'library-hero.png')); im.thumbnail((1400, 300)); sheet.paste(im, (430, 700))
    sheet.save(os.path.join(OUT, 'contact.jpg'), quality=85)
    print(len(made), 'files →', OUT)


if __name__ == '__main__':
    main()
