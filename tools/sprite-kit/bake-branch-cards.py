"""갈래 카드 테두리 셋(51-1 · Codex 67) — 1024x1536 원본을 border-image 테두리 + 늘리지 않는 장식 조각으로 나눈다.
원본: assets_src/realm/raid/card-frames-51/branch-card-{sword,wave,tempo}-51.png (가운데 빈 RGBA · D:/에셋창고/codex67 에서 그대로 복사)
갈래: a 주 무기 = sword(금 · 환두 고리) · b 보조 = wave(청록 · 물보라) · c 버팀 = tempo(보라 · 화살 깃 셋) (power-ui.ts BRANCH_COLOR 와 같은 빛)
나누는 법 (그려 고치지 않음 · 픽셀은 원본 그대로 줄이기만):
  - 가운데 장식(crest 위 · base 아래 · 칼 테두리 좌우 가운데 띠 band)은 원본 사각형을 그대로 잘라 따로 굽는다 —
    카드 크기가 바뀌어도 늘어나지 않게 CSS 가 제 크기로 겹쳐 그린다(card-skins.css ::after).
  - 테두리(frame)는 그 장식이 있던 가운데 열(위·아래 장식 폭)과 가운데 줄(좌우 띠 높이)을 통째로 빼고 양쪽을 맞붙인다.
    원본이 좌우 대칭이라 맞붙는 두 열의 테 줄이 같은 자리에 있다 → 메울 그림 없이 테 줄이 이어진다.
    border-image 는 모서리를 그대로 두고 그 사이 테 줄만 늘리고, 겹친 장식 조각이 가운데를 제 모양으로 덮는다.
  - 테두리는 불투명 픽셀 둘레로 잘라 낸다 · 칸 값(slice · 원본 px)과 조각 자리(at)는 json 으로 찍어 CSS 가 쓴다.
배율 SCALE(.375 = 옛 384x576 과 같은 몫)로 줄여 WebP(q90 · method 6 · exact) 로 public/realm/raid/ 에 쓴다.
py -3 -I tools/sprite-kit/bake-branch-cards.py [--json docs/realm/production/CLAUDE51-CARD-FRAMES.json] [--sheet <png>]
"""
import argparse, hashlib, json
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'assets_src/realm/raid/card-frames-51'
OUT = ROOT / 'public/realm/raid'
SCALE, PAD, ALPHA = .375, 3, 8
# 원본 px — cols: 빼는 가운데 열 [x0, x1) (위·아래 장식이 다 들어가는 폭) · rows: 빼는 가운데 줄 [y0, y1) (좌우 띠) ·
# crest·base: 그 열 안의 위·아래 장식 줄 [y0, y1) · band: 좌우 띠 열 [x0, x1) 두 쌍 · slice: 자른 테두리의 모서리 칸 (위 오른 아래 왼)
BRANCHES = {
    'a': {'src': 'sword', 'cols': (250, 776), 'crest': (4, 292), 'base': (1374, 1480), 'rows': (736, 870), 'band': ((52, 150), (874, 972)),
          'slice': (292, 128, 236, 128)},
    # 11-22 Codex 74: 물결을 일월오봉도 결(둥근 흰 물마루 · 위 물방울 셋)로 다시 그림 — 우키요에 「큰 파도」처럼 보이던 51 판 대신
    'b': {'src': 'wave', 'file': 'branch-card-wave-74.png', 'archive': 'D:/에셋창고/codex74/branch-card-wave-74.png',
          'cols': (255, 770), 'crest': (4, 218), 'base': (1380, 1510), 'slice': (140, 140, 160, 140)},
    'c': {'src': 'tempo', 'cols': (330, 694), 'crest': (4, 222), 'base': (1432, 1508), 'slice': (290, 190, 240, 190)},
}


def save(rgba, name):
    im = Image.fromarray(rgba).resize((max(1, round(rgba.shape[1] * SCALE)), max(1, round(rgba.shape[0] * SCALE))), Image.Resampling.LANCZOS)
    dst = OUT / name
    im.save(dst, 'WEBP', quality=90, method=6, exact=True)
    return {'path': str(dst.relative_to(ROOT)).replace('\\', '/'), 'size': list(im.size)}


def bake(letter):
    cfg = BRANCHES[letter]
    src = SRC / cfg.get('file', f'branch-card-{cfg["src"]}-51.png')
    a = np.array(Image.open(src).convert('RGBA'))
    a[a[..., 3] < ALPHA] = 0
    H, W = a.shape[:2]
    c0, c1 = cfg['cols']
    row = {'branch': letter, 'source': str(src.relative_to(ROOT)).replace('\\', '/'), 'sourceSha256': hashlib.sha256(src.read_bytes()).hexdigest(),
           'archive': cfg.get('archive', f'D:/에셋창고/codex67/branch-card-{cfg["src"]}-51.png'), 'nativeSize': [W, H], 'scale': SCALE, 'pieces': {}}
    # 테두리: 가운데 열·줄을 빼고 맞붙임 (남는 칸 차례 그대로)
    keep_x = np.r_[0:c0, c1:W]
    keep_y = np.r_[0:H] if 'rows' not in cfg else np.r_[0:cfg['rows'][0], cfg['rows'][1]:H]
    frame = a[np.ix_(keep_y, keep_x)]
    ys, xs = np.nonzero(frame[..., 3] > 0)
    fx0, fy0, fx1, fy1 = max(0, xs.min() - PAD), max(0, ys.min() - PAD), min(frame.shape[1], xs.max() + 1 + PAD), min(frame.shape[0], ys.max() + 1 + PAD)
    frame = frame[fy0:fy1, fx0:fx1]
    st, sr, sb, sl = cfg['slice']
    if st + sb >= frame.shape[0] or sl + sr >= frame.shape[1]:
        raise ValueError(f'{letter}: 모서리 칸이 테두리보다 크다')
    # 모서리 칸 경계(가로·세로 선)가 지나는 곳은 늘어나도 되는 테 줄이어야 한다 — 경계 선 위 불투명 덩어리 수를 찍어 사람이 본다
    row['frame'] = {**save(frame, f'ui-card-branch-{letter}.webp'), 'native': [int(frame.shape[1]), int(frame.shape[0])], 'slice': [st, sr, sb, sl],
                    'runtimeSlice': [round(v * SCALE) for v in (st, sr, sb, sl)],
                    # 원본 좌표 → 테두리 상자 좌표: 원본 (x, y) 는 x<c0 이면 x - (c0 쪽 잘린 폭) ... 장식 조각 자리 셈에 쓴다
                    'origin': [int(fx0), int(fy0)]}
    # 원본 y → 테두리 상자 y (가운데 줄을 뺐으면 그 아래는 그만큼 위로)
    def fy(y):
        if 'rows' in cfg and y >= cfg['rows'][1]:
            y -= cfg['rows'][1] - cfg['rows'][0]
        return int(y - fy0)
    pieces = {'crest': (c0, cfg['crest'][0], c1, cfg['crest'][1]), 'base': (c0, cfg['base'][0], c1, cfg['base'][1])}
    if 'band' in cfg:
        r0, r1 = cfg['rows']
        pieces['band-l'] = (cfg['band'][0][0], r0, cfg['band'][0][1], r1)
        pieces['band-r'] = (cfg['band'][1][0], r0, cfg['band'][1][1], r1)
    for key, (x0, y0, x1, y1) in pieces.items():
        p = save(a[y0:y1, x0:x1].copy(), f'ui-card-branch-{letter}-{key}.webp')
        # 자리 (원본 px · 테두리 상자 기준): 위 장식은 위에서 · 아래 장식은 아래에서 · 좌우 띠는 왼·오른 끝에서 (가로 가운데는 CSS 가 50%)
        if key == 'crest':
            p['top'] = fy(y0)
        elif key == 'base':
            p['bottom'] = int(frame.shape[0] - fy(y1))
        else:
            # 좌우 띠: 세로 가운데 맞춤 · 가로는 왼 띠는 테두리 왼끝에서, 오른 띠는 오른끝에서 (가운데 열을 뺀 만큼 오른쪽 좌표가 당겨진다)
            p['side'] = int(x0 - fx0) if key == 'band-l' else int(frame.shape[1] - (x1 - (c1 - c0) - fx0))
        p['native'] = [x1 - x0, y1 - y0]
        row['pieces'][key] = p
    return row, frame


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--sheet', default=''); ap.add_argument('--json', default='')
    a = ap.parse_args()
    rows, frames = [], []
    for letter in BRANCHES:
        r, f = bake(letter); rows.append(r); frames.append(f)
    for r in rows:
        for item in [r['frame'], *r['pieces'].values()]:
            data = (ROOT / item['path']).read_bytes()
            item['bytes'] = len(data); item['sha256'] = hashlib.sha256(data).hexdigest()
    doc = {'task': 'Claude 51-1 branch card frames (Codex 67 sources · tools/sprite-kit/bake-branch-cards.py)', 'supersedes': 'docs/realm/production/CODEX50-CARD-FRAMES.json (50-6 · same file names a/b/c)',
           'css': 'src/raid/card-skins.css (slice · native sizes are checked by tests/raid-card-skins.test.ts)', 'scale': SCALE,
           'runtimeBytes': sum(i['bytes'] for r in rows for i in [r['frame'], *r['pieces'].values()]), 'items': rows}
    print(json.dumps(doc, ensure_ascii=False, indent=1))
    if a.json:
        with open(a.json, 'w', encoding='utf-8', newline='\n') as fh:   # 줄끝 LF (윈도에서도)
            fh.write(json.dumps(doc, ensure_ascii=False, indent=1) + '\n')
    if a.sheet:
        Wd = sum(f.shape[1] for f in frames) // 2 + 40; Hd = max(f.shape[0] for f in frames) // 2 + 20
        sheet = Image.new('RGBA', (Wd, Hd), (60, 70, 60, 255)); x = 10
        for f in frames:
            im = Image.fromarray(f); im = im.resize((im.width // 2, im.height // 2), Image.Resampling.LANCZOS)
            sheet.alpha_composite(im, (x, 10)); x += im.width + 10
        sheet.convert('RGB').save(a.sheet)


if __name__ == '__main__':
    main()
