# -*- coding: utf-8 -*-
"""새 전투 띠를 게임에 잇기 — 그림을 넣은 뒤(anim-harness.py strip <장수> install) 코드 쪽 네 곳을 맞춘다 (11-24 · 같은 일을 세 번째 손으로 해서 묶음).
  py -3 -X utf8 -I tools/sprite-kit/wire-hero.py <띠 열쇠: haebi · base-w-13-young-archer …> [quirk=.28,.3,.42,.25] [atk8 hit=4 times=.09,.08,.11,.05,.15,.07,.08,.12] [act] [actw=264]
하는 일
  1. public/realm/anim-px/manifest.json: gen-<열쇠> 의 칸(208×160) · 발 줄 · 몸 키를 **그림에서 재서** 적는다(서기 칸 0 의 맨 위·맨 아래 불투명 줄).
     → 그 뒤 node tools/sprite-kit/headgear.mjs 를 돌려 src/realm/data/spritePx.ts 를 다시 쓴다(이 스크립트가 부른다).
  2. src/tune/params.ts HAEBI_IDLE.plans: 계획 한 줄(덧띠 칸 수는 그림에서 센다 · 쓰러짐 18→20→21→19 · 개성 동작 22~25 · atk8 이면 공격 여덟 칸 · act 면 xGeom).
  3. src/raid/hero-hd.ts HERO_HD: 옛 2배 그림 연결을 뺀다(칸 표 HERO_HD_SHEETS 와 각성 띠는 그대로 — 시험이 표를 요구한다).
  4. src/duel/view.ts PX_DUEL: 겨루기도 새 도트 띠를 쓰게.
끝나면: npm run typecheck · npm test → 커밋. 화면 확인은 따로(넓은 칸은 tools/out/cellshot.html 방식).
"""
import io
import json
import re
import subprocess
import sys
import numpy as np
from PIL import Image

ROOT = 'D:/flutter/arrow_game_one/'
ACT = dict(cw=240, ch=224, root=92, foot=216)


def main(argv):
    key = argv[0]
    act = 'act' in argv
    opt = {a.split('=')[0]: a.split('=')[1] for a in argv[1:] if '=' in a}
    strip = f'{ROOT}public/realm/anim-px/gen-{key}.png'
    im = Image.open(strip).convert('RGBA')
    assert im.size == (208 * 20, 160), f'본 띠가 20칸 × 208×160 이 아니다: {im.size}'
    a = np.asarray(im.crop((0, 0, 208, 160)))[..., 3] > 40
    ys = np.nonzero(a.any(1))[0]
    feet, body = int(ys.max()), int(ys.max() - ys.min() + 1)
    xim = Image.open(strip.replace('.png', '-x.png'))
    xcells = xim.size[0] // (int(opt.get('actw', ACT['cw'])) if act else 208)   # actw=264: 동작 칸을 넓힌 장수(anim-harness HEROES actw)
    cells = 20 + xcells

    # 1. manifest
    p = ROOT + 'public/realm/anim-px/manifest.json'
    s = io.open(p, encoding='utf-8').read()
    m = re.search(r'"gen-%s":\{[^}]*\}' % re.escape(key), s)
    assert m, f'manifest 에 gen-{key} 가 없다'
    old = json.loads(m.group(0).split(':', 1)[1])
    new = dict(old, cell=[208, 160], feet=feet, bodyPx=body, cells=20)
    s = s.replace(m.group(0), '"gen-%s":%s' % (key, json.dumps(new, separators=(',', ':'), ensure_ascii=False)), 1)
    io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
    print(f'manifest gen-{key}: {old} → {new}')

    # 2. params.ts
    p = ROOT + 'src/tune/params.ts'
    s = io.open(p, encoding='utf-8').read()
    i = s.index('  plans: {')
    j = s.index('\n  },\n} as const', i)
    block = s[i:j]
    name = key if re.fullmatch(r'[a-z0-9]+', key) else f"'{key}'"
    has_quirk = xcells >= 6
    parts = [f'cells: {cells}', 'base: [0, 1]', 'hold: 2.4', 'fall: [18, 20, 21, 19]']
    if has_quirk:
        parts += ['quirk: [22, 23, 24, 25]', 'quirkTimes: [%s]' % ', '.join(opt.get('quirk', '.28,.3,.42,.25').split(','))]
    hit = 'hit' in argv   # 덧띠 끝에 맞음 둘 + 일어남 둘 (anim-harness HEROES hit=True)
    if 'atk8' in argv:
        a0 = cells - 8 - (4 if hit else 0)
        parts.append('attack: { cells: [%s], times: [%s], hit: %s }' % (', '.join(str(a0 + k) for k in range(8)), ', '.join(opt.get('times', '.09,.08,.11,.05,.15,.07,.08,.12').split(',')), opt.get('hit', '4')))
    if hit:
        parts += ['hurt: [%d, %d]' % (cells - 4, cells - 3), 'rise: [%d, %d]' % (cells - 2, cells - 1)]
    if act:
        parts.append('xGeom: { h: %d, root: %d, foot: %d }' % (ACT['ch'], ACT['root'], ACT['foot']))
    line = f'    {name}: {{ {", ".join(parts)} }},'
    if re.search(r'^\s*%s: \{' % re.escape(name), block, re.M):
        block2 = re.sub(r'^\s*%s: \{.*?\},\n(?=\s*(?:[a-z\'"]|$))' % re.escape(name), line + '\n', block + '\n', count=1, flags=re.M | re.S).rstrip('\n')
        print('계획 바꿈:', line.strip())
    else:
        block2 = block + '\n' + line
        print('계획 넣음:', line.strip())
    s = s[:i] + block2 + s[j:]
    io.open(p, 'w', encoding='utf-8', newline='\n').write(s)

    # 3. hero-hd.ts
    p = ROOT + 'src/raid/hero-hd.ts'
    s = io.open(p, encoding='utf-8').read()
    pat = r"^\s*'anim-px/gen-%s\.png': 'anim-px/gen-%s_hd\.png',\n" % (re.escape(key), re.escape(key))
    s2, n = re.subn(pat, '', s, flags=re.M)
    if n:
        io.open(p, 'w', encoding='utf-8', newline='\n').write(s2)
    print('옛 2배 그림 연결:', '뺌' if n else '없음(그대로)')

    # 4. duel PX_DUEL
    p = ROOT + 'src/duel/view.ts'
    s = io.open(p, encoding='utf-8').read()
    m = re.search(r"const PX_DUEL: ReadonlySet<string> = new Set\(\[(.*?)\]\)", s)
    assert m, 'PX_DUEL 을 못 찾음'
    if f"'{key}'" not in m.group(1):
        s = s.replace(m.group(0), m.group(0).replace(m.group(1), m.group(1) + f", '{key}'"), 1)
        io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
        print('겨루기 PX_DUEL 에 넣음')
    else:
        print('겨루기 PX_DUEL: 이미 있음')

    r = subprocess.run(['node', 'tools/sprite-kit/headgear.mjs'], cwd=ROOT, capture_output=True, text=True, encoding='utf-8')
    print('headgear:', (r.stdout or r.stderr).strip().split('\n')[-1][:120])


if __name__ == '__main__':
    main(sys.argv[1:])
