"""
나라 깃발 굽기 — 문양 실루엣(제미나이 4×4 격자) + 나라 두 빛(art.ts FACTION_ART color · color2) → public/realm/icon/nflag-<나라>.png
(형 10-26: "제미나이로 국기들을 새로 만들어야 할 거 같음 · 색이 다 어두운색이라 구분을 할 수가 없음 · 이미지가 문자만큼 작아도 다 구분 가능하게")

  py -I tools/bake-flags.py cut <격자 png> <이름 16개를 쉼표로>   — 칸마다 잘라 assets_src/realm/glyph/<이름>.png (흰 실루엣 + 알파)
  py -I tools/bake-flags.py bake                                    — 나라마다 깃발을 굽는다 (art.ts 를 읽는다)

깃발 꼴: 제비꼬리 깃발 한 폭 — 바탕은 큰 빛, 깃대 쪽 굵은 띠와 둘레 테는 둘째 빛, 문양은 바탕 위에서 잘 읽히는 빛(흰·먹)으로 크게.
문자만큼 작게(16~20px) 줄여도 두 빛과 문양 덩어리가 남게 — 무늬·결·그림자 없이 납작하게. 겉에 얇은 먹 테.
나라 빛이 바뀌면 bake 만 다시 돌린다. 새 나라는 art.ts 에 emblem·color·color2 를 적고 GLYPH_OF 에 문양 이름을 잇는다.
"""
import io
import os
import re
import sys
from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
GLYPH = os.path.join(ROOT, 'assets_src', 'realm', 'glyph')
OUT = os.path.join(ROOT, 'public', 'realm', 'icon')

# art.ts 의 emblem 이름 → 문양 실루엣 이름 (대개 같다 · 비슷한 꼴은 다른 문양으로 갈랐다)
GLYPH_OF = {
    'maga': 'horsehead', 'uga': 'oxhead', 'jeoga': 'boarhead', 'bukokjeo': 'wolf', 'bullae': 'ponytree',
    'tamna': 'volcano', 'usan': 'sealion', 'horsearcher': 'horsearcher', 'sodo-bird': 'sotdae',
}


def cut(sheet: str, names: list) -> None:
    im = Image.open(sheet).convert('L')
    w, h = im.size
    # 오른쪽 아래 ✦ (제미나이 표식) — 하얗게 지운다
    ImageDraw.Draw(im).rectangle((int(w * 0.955), int(h * 0.955), w, h), fill=255)
    cw, ch = w / 4, h / 4
    os.makedirs(GLYPH, exist_ok=True)
    for i, name in enumerate(names):
        if name in ('', '-'):
            continue
        x, y = i % 4, i // 4
        cell = im.crop((int(x * cw), int(y * ch), int((x + 1) * cw), int((y + 1) * ch)))
        a = cell.point(lambda v: 255 if v < 110 else (0 if v > 200 else int((200 - v) * 255 / 90)))
        box = a.getbbox()
        if box is None:
            print('빈 칸', name)
            continue
        a = a.crop(box)
        s = max(a.size)
        sq = Image.new('L', (s, s), 0)
        sq.paste(a, ((s - a.size[0]) // 2, (s - a.size[1]) // 2))
        g = Image.new('RGBA', (s, s), (255, 255, 255, 0))
        g.putalpha(sq)
        g.save(os.path.join(GLYPH, f'{name}.png'))
        print('ok', name, s)


def hexrgb(c: str):
    c = c.lstrip('#')
    return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))


def lum(c) -> float:
    def ch(v):
        v /= 255
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = c
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)


def contrast(a, b) -> float:
    la, lb = sorted((lum(a), lum(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def nations():
    s = io.open(os.path.join(ROOT, 'src', 'realm', 'data', 'art.ts'), encoding='utf-8').read()
    body = s[s.index('export const FACTION_ART'):]
    body = body[:body.index('\n}')]
    for m in re.finditer(r"['\"]?([\w-]+)['\"]?:\s*\{\s*emblem:\s*'emblem-([\w-]+)',\s*color:\s*'(#[0-9a-fA-F]{6})',\s*color2:\s*'(#[0-9a-fA-F]{6})'", body):
        yield m.group(1), m.group(2), m.group(3), m.group(4)


def bake() -> None:
    S = 384  # 크게 그려 줄인다
    INK_D, INK_L = (28, 20, 10), (255, 250, 240)
    for nid, emb, c1, c2 in nations():
        gname = GLYPH_OF.get(emb, emb)
        gp = os.path.join(GLYPH, f'{gname}.png')
        if not os.path.exists(gp):
            print('문양 없음', nid, gname)
            continue
        k1, k2 = hexrgb(c1), hexrgb(c2)
        ink = INK_D if contrast(k1, INK_D) >= contrast(k1, INK_L) else INK_L
        # 깃발 꼴 — 위는 반듯, 아래는 제비꼬리
        x0, x1, y0, y1, notch = S * 0.14, S * 0.86, S * 0.06, S * 0.96, S * 0.16
        shape = [(x0, y0), (x1, y0), (x1, y1), ((x0 + x1) / 2, y1 - notch), (x0, y1)]
        im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        d.polygon(shape, fill=(16, 12, 8, 255))  # 먹 테 (겉)
        inner = [(x0 + 10, y0 + 10), (x1 - 10, y0 + 10), (x1 - 10, y1 - 14), ((x0 + x1) / 2, y1 - notch - 10), (x0 + 10, y1 - 14)]
        d.polygon(inner, fill=k2 + (255,))  # 둘째 빛 테
        band = S * 0.06
        body = [(x0 + 10 + band, y0 + 10 + band * 0.7), (x1 - 10 - band * 0.7, y0 + 10 + band * 0.7), (x1 - 10 - band * 0.7, y1 - 14 - band * 0.9),
                ((x0 + x1) / 2, y1 - notch - 10 - band * 0.9), (x0 + 10 + band, y1 - 14 - band * 0.9)]
        d.polygon(body, fill=k1 + (255,))  # 큰 빛 바탕
        # 깃대 쪽 굵은 띠 (둘째 빛) — 작게 줄여도 두 빛이 보이게
        d.rectangle((x0 + 10, y0 + 10, x0 + 10 + band * 1.6, y1 - 14), fill=k2 + (255,))
        # 문양 — 바탕 가운데(띠 오른쪽)에 크게
        g = Image.open(gp).convert('RGBA')
        gs = int(S * 0.5)
        g = g.resize((gs, gs), Image.LANCZOS)
        a = g.split()[3]
        cx = int((x0 + 10 + band * 1.6 + x1 - 10) / 2)
        cy = int(S * 0.44)
        fill = Image.new('RGBA', (gs, gs), ink + (255,))
        # 문양 둘레에 바탕과 반대 빛의 얇은 테 — 비슷한 빛 바탕에서도 덩어리가 선다
        halo = a.filter(ImageFilter.MaxFilter(5))
        rim = Image.new('RGBA', (gs, gs), (k1 if ink == INK_L else k1) + (0,))
        im.alpha_composite(Image.composite(Image.new('RGBA', (gs, gs), (0, 0, 0, 90 if ink == INK_L else 0)), rim, halo), (cx - gs // 2, cy - gs // 2))
        im.alpha_composite(Image.composite(fill, Image.new('RGBA', (gs, gs), (0, 0, 0, 0)), a), (cx - gs // 2, cy - gs // 2))
        # 깃대 쪽만 남기고 바깥은 잘라 낸 꼴 그대로 — 96 으로 줄인다
        out = im.resize((96, 96), Image.LANCZOS)
        out.save(os.path.join(OUT, f'nflag-{nid}.png'))
        print('ok', nid, gname, c1, c2)


if __name__ == '__main__':
    if sys.argv[1] == 'cut':
        cut(sys.argv[2], sys.argv[3].split(','))
    elif sys.argv[1] == 'bake':
        bake()
