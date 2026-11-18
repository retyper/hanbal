# -*- coding: utf-8 -*-
"""각성 걷기 판(SPA-<who>-walk)의 참조 그림 · 비각성 걷기 여덟 칸 4x2 한 장 (11-18).

왜: 챗지피티가 새로 그린 각성 걷기 판이 거의 다 「네 칸 반걸음을 두 번 되풀이」 했다(1번·5번 칸이 같은 다리가 앞 → 늘 같은 다리만 나가 절뚝임).
   → 걷기도 동작 판처럼 「옷만 갈아입히는 편집」 으로: 다리가 제대로 번갈아 나가는 비각성 걷기 여덟 칸을 IMAGE 1 로 주고 옷만 바꾸게 한다.

어디서: public/realm/anim-px/gen-<who>.png (본편 띠 20칸 · 칸 번호 0부터 · 0~3 서기 · 4~11 걷기 여덟 칸 · bake-full20.py 의 walk8 cells=range(4,12))
어디로: assets_src/realm/sprite-prop/walkref-<who>.png (4열 x 2행 · 칸 사이 여백 · 투명 바탕 · 칸 1~4 윗줄, 5~8 아랫줄 · 같은 발 줄)
누구:  tools/remake-jobs.mjs 의 SPA 블록과 같은 고름 (weapon-audit 줄 중 초상 · 비각성 띠 · 각성 초상이 있고 각성 띠는 아직 없는 장수 · dalbit 뺌)

  py -3 -I tools/sprite-kit/aw1-walkref.py [--keys a,b] [--scale 3]
걷기 칸 i 와 i+4 가 같은 그림(옛 4칸 걷기를 두 번 늘어놓은 띠 · 11-18 스무 명)이면 「4칸 걸음」 으로 알린다 · 그 장수는 1↔3 이 반대 다리다
(곰·알영을 눈으로 확인: 1번은 앞다리가 몸 앞쪽, 3번은 뒷다리가 앞쪽으로 겹침). 8칸 걸음은 이랑·고목·호진·해달을 눈으로 확인: 1번과 5번이 겹치는 다리가 반대.
각 판 목록은 tools/sprite-kit/walkref.json (who → 8 | 4 · 저장소에 남는다 · 그림은 assets_src 라 git 밖, 이 스크립트로 다시 만든다).
"""
import argparse, json, sys
from pathlib import Path
import numpy as np
from PIL import Image

for _s in (sys.stdout, sys.stderr): _s.reconfigure(encoding='utf-8', errors='replace')
sys.dont_write_bytecode = True
KIT = Path(__file__).resolve().parent
ROOT = KIT.parents[1]
PX = ROOT / 'public/realm/anim-px'
OUT = ROOT / 'assets_src/realm/sprite-prop'
WALK = range(4, 12)     # 본편 띠의 걷기 여덟 칸 (0부터)
GAP = 24                # 칸 사이 여백 (확대 전 px)
INDEX = KIT / 'walkref.json'   # who → 걸음 칸 수(8 = 1↔5 반대 다리 · 4 = 네 칸 걸음을 두 번 · 1↔3 반대) · tools/remake-jobs.mjs 가 문안에 쓴다


def targets():
    rows = json.loads((KIT / 'weapon-audit-20261116.json').read_text('utf-8')); rows = rows if isinstance(rows, list) else rows.get('rows', [])
    seen, out = set(), []
    for r in rows:
        k = r['key']
        if not r.get('portrait') or k.startswith('aw1-') or k in seen or k == 'dalbit': continue
        if not (PX / f'gen-{k}.png').exists() or not (ROOT / f'public/realm/awaken-hd/{r["portrait"]}.jpg').exists(): continue
        if (PX / f'gen-aw1-{k}.png').exists(): continue
        seen.add(k); out.append(k)
    return out


def walk_cells(who):
    im = Image.open(PX / f'gen-{who}.png').convert('RGBA'); cw = im.width // 20
    return [im.crop((i * cw, 0, (i + 1) * cw, im.height)) for i in WALK]


def make(who, scale):
    cs = walk_cells(who)
    # 여덟 칸이 함께 쓰는 틀(가로·세로 합집합)로 자른다 → 발 줄과 몸 자리가 칸끼리 그대로
    boxes = [c.getbbox() for c in cs]
    x0, y0 = min(b[0] for b in boxes), min(b[1] for b in boxes); x1, y1 = max(b[2] for b in boxes), max(b[3] for b in boxes)
    w, h = x1 - x0, y1 - y0
    sheet = Image.new('RGBA', (4 * w + 5 * GAP, 2 * h + 3 * GAP), (0, 0, 0, 0))
    for n, c in enumerate(cs):
        sheet.alpha_composite(c.crop((x0, y0, x1, y1)), (GAP + (n % 4) * (w + GAP), GAP + (n // 4) * (h + GAP)))
    if scale != 1: sheet = sheet.resize((sheet.width * scale, sheet.height * scale), Image.Resampling.NEAREST)
    same = [i for i in range(4) if np.array_equal(np.array(cs[i]), np.array(cs[i + 4]))]
    return sheet, same


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--keys'); ap.add_argument('--scale', type=int, default=3); a = ap.parse_args()
    keys = a.keys.split(',') if a.keys else targets(); OUT.mkdir(parents=True, exist_ok=True); four = []
    book = json.loads(INDEX.read_text('utf-8')) if INDEX.exists() else {}
    for who in keys:
        sheet, same = make(who, a.scale)
        sheet.save(OUT / f'walkref-{who}.png', optimize=True)
        if len(same) == 4: four.append(who)
        book[who] = 4 if len(same) == 4 else 8
    INDEX.write_bytes((json.dumps(dict(sorted(book.items())), ensure_ascii=False, indent=1) + '\n').encode('utf-8'))
    print(f'walkref {len(keys)}장 → {OUT.relative_to(ROOT).as_posix()}/walkref-<who>.png')
    if four: print(f'4칸 걸음(걷기 i 와 i+4 가 같은 그림) {len(four)}명: ' + ', '.join(four))


if __name__ == '__main__':
    main()
