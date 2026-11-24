# -*- coding: utf-8 -*-
"""형에게 보낼 검수 GIF — **게임에 들어간 띠 그대로** 모든 동작을 한 줄로 잇는다 (11-24 형 「아직 컨펌 안 된 다른 동작들 gif 도 줘봐」).
  py -3 -X utf8 -I tools/sprite-kit/review-gif.py <장수 이름 …>      (이름 = anim-harness.py HEROES 의 열쇠)
서기 → 걷기 두 바퀴 → 서기 → 개성 동작 → 서기 → 공격 → 서기 → 맞음 → 쓰러짐(가운데 두 칸이 있으면) → 누움
나오는 것(tools/out/review/): <한글 이름>.gif · <한글 이름>-frames.png (GIF 의 칸을 그대로 늘어놓은 판 · 보내기 전에 이것을 본다)
칸 규격이 다른 띠(본 띠 208×160 · 넓은 동작 칸 240·264×224)는 뿌리와 발 줄을 맞춰 한 판(폭 264 · 높이 224)에 놓는다.
"""
import importlib.util
import os
import sys
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('harness', HERE + '/anim-harness.py')
H = importlib.util.module_from_spec(spec)
spec.loader.exec_module(H)
OUT = os.path.dirname(os.path.dirname(HERE)) + '/tools/out/review'
W, HT, ROOT, FOOT = 264, 224, 92, 216   # 판 하나: 가장 넓은 동작 칸에 맞춘다


def place(c, root, foot):
    o = Image.new('RGBA', (W, HT), (0, 0, 0, 0))
    o.alpha_composite(c, (ROOT - root, FOOT - foot))
    return o


def frames(key):
    h = H.HEROES[key]
    main = Image.open(f'{H.GAME}/{h["strip"]}.png').convert('RGBA')
    m = [place(main.crop((i * H.CW, 0, (i + 1) * H.CW, H.CH)), H.ROOT_X, H.FOOT_Y) for i in range(main.size[0] // H.CW)]
    xp = f'{H.GAME}/{h["strip"]}-x.png'
    x = []
    if os.path.exists(xp):
        e = Image.open(xp).convert('RGBA')
        if e.size[1] == H.CH:   # 옛 규격 덧띠(본 띠와 같은 칸)
            x = [place(e.crop((i * H.CW, 0, (i + 1) * H.CW, H.CH)), H.ROOT_X, H.FOOT_Y) for i in range(e.size[0] // H.CW)]
        else:
            cw = h.get('actw', 240)
            x = [place(e.crop((i * cw, 0, (i + 1) * cw, e.size[1])), 92, 216) for i in range(e.size[0] // cw)]
    st = m[0]
    seq = [('서기', st, 700)] + [('걷기', m[i], 110) for i in range(4, 12)] * 2 + [('서기', st, 500)]
    if len(x) - (8 if h.get('atk8') else 0) >= 6:   # 덧띠 = 쓰러짐 2 + 개성 4 (+ 공격 8)
        seq += [('개성', c, t) for c, t in zip(x[2:6], (300, 320, 400, 280))] + [('서기', st, 500)]
    if h.get('atk8') and len(x) >= 8:
        seq += [('공격', c, t) for c, t in zip(x[-8:], (90, 80, 110, 50, 150, 70, 80, 120))]
    else:
        seq += [('공격', m[i], t) for i, t in zip(range(12, 18), (110, 110, 90, 150, 110, 140))]
    seq += [('서기', st, 600), ('맞음', m[18], 300)]
    if len(x) >= 2:
        seq += [('쓰러짐', x[0], 160), ('쓰러짐', x[1], 160)]
    seq += [('누움', m[19], 1200)]
    return seq


def main(keys):
    os.makedirs(OUT, exist_ok=True)
    for key in keys:
        name = key
        for line in open(HERE + '/anim-harness.py', encoding='utf-8'):
            if line.strip().startswith(f"'{key}': dict(") and '# ' in line:
                name = line.split('# ', 1)[1].split('(')[0].split('·')[0].strip() or key
                break
        seq = frames(key)
        fr = [H.on_bg(c, 2) for _, c, _ in seq]
        fr[0].save(f'{OUT}/{name}.gif', save_all=True, append_images=fr[1:], duration=[t for *_, t in seq], loop=0)
        # GIF 에 든 칸 그대로(걷기는 한 바퀴만 · 같은 서기 칸은 처음 하나만) — 보내기 전에 본다
        uniq, seen = [], set()
        for k, (tag, c, _) in enumerate(seq):
            if tag == '서기' and '서기' in seen or (tag == '걷기' and k > 8):
                continue
            seen.add(tag)
            uniq.append((tag, c))
        cols = 14
        rows = (len(uniq) + cols - 1) // cols
        sheet = Image.new('RGB', (cols * W, rows * HT), (40, 40, 40))
        d = ImageDraw.Draw(sheet)
        for k, (tag, c) in enumerate(uniq):
            x0, y0 = (k % cols) * W, (k // cols) * HT
            sheet.paste(H.on_bg(c, 1), (x0, y0))
            d.line([(x0 + ROOT, y0 + FOOT - 20), (x0 + ROOT, y0 + FOOT + 6)], fill=(0, 255, 255))
            d.text((x0 + 4, y0 + 4), str(k), fill=(255, 255, 255))
        sheet.save(f'{OUT}/{name}-frames.png')
        print(name, len(seq), '칸', f'{OUT}/{name}.gif')


if __name__ == '__main__':
    main(sys.argv[1:])
