# -*- coding: utf-8 -*-
"""전투 그림 하네스 — 받은 그림 한 장에서 게임 띠까지, 한 줄로 · 끝은 늘 숫자 판정 (11-23 형 「하네스로 제대로 만들어서 shared config 에도」).
낱낱의 도구(bake-scene · walk-anchor · head-lock · strip-build · anim-check)를 차례대로 부른다. 손으로 차례를 외워 치지 않는다 — 빠뜨린 걸음이 흔들림이 됐다.
규칙·까닭은 docs/realm/production/ART-SKELETON.md (§11 몸의 뿌리 · §12 참고 게임에서 본 것), 공용 판은 codex-shared-config/skills/sprite-anim-harness.

  py -3 -X utf8 -I tools/sprite-kit/anim-harness.py walk  <장수> [머리 기준 칸=walk-a-3]
      STD/out-<장수>-walk8.png + STD/scene-<장수>-walk8.png(.roots.json) → 뿌리 맞춰 굽기 → 윗몸 한자리 → 머리 고정 → 확대판·다리 확대·GIF
  py -3 -X utf8 -I tools/sprite-kit/anim-harness.py strip <장수> [install]
      띠를 짓고(서기·걷기·공격·쓰러짐 + 덧띠) anim-check 로 판정. 합격이고 install 을 주면 public/realm/anim-px 에 넣는다(불합격이면 안 넣는다)
  py -3 -X utf8 -I tools/sprite-kit/anim-harness.py check <장수|all>
      지금 게임에 들어 있는 띠를 다시 판정
장수 표(HEROES): 띠 파일 이름 · 공격 꼬리표 · 덧띠에 여덟 칸 공격이 있는가.
"""
import os
import subprocess
import sys
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
STD = 'D:/에셋창고/STD'
PX = STD + '/px'
OUT = ROOT + '/tools/out/lineup'
TRY = ROOT + '/tools/out/strip/try'
GAME = ROOT + '/public/realm/anim-px'
CW, CH, ROOT_X = 208, 160, 104
BG = (96, 104, 72)

HEROES = {
    'beom': dict(strip='gen-beom', atk='claw', atk8=True),
    'maehwa': dict(strip='gen-maehwa', atk='bow', atk8=False),
    'dalbit': dict(strip='gen-base-w-31-dabeol-dalbit', atk='bow', atk8=False),
    'haebi': dict(strip='gen-haebi', atk='axe', atk8=False),      # 걷기만 있음 — 공격·쓰러짐이 오면 strip
    'areum': dict(strip='gen-areum', atk='hammer', atk8=False),   # 〃
}


def run(script, *args, show=True):
    r = subprocess.run([sys.executable, '-X', 'utf8', '-I', f'{HERE}/{script}', *args], capture_output=True, text=True, encoding='utf-8', timeout=240)
    if show and r.stdout.strip():
        print(r.stdout.rstrip())
    if r.returncode not in (0, 1) or (r.returncode == 1 and script != 'anim-check.py'):
        print(r.stderr[-1500:])
        raise SystemExit(f'{script} 실패')
    return r


def on_bg(c, z):
    bg = Image.new('RGB', c.size, BG)
    bg.paste(c, (0, 0), c)
    return bg.resize((c.size[0] * z, c.size[1] * z), Image.NEAREST)


def walk(name, ref='walk-a-3'):
    sheet, scene = f'{STD}/out-{name}-walk8.png', f'{STD}/scene-{name}-walk8.png'
    if not os.path.exists(scene.replace('.png', '.roots.json')):
        raise SystemExit(f'{scene} 의 뿌리 곁파일(.roots.json)이 없다 — style-scene.py motion8 로 장면을 다시 만든다(그림은 같고 곁파일만 생긴다)')
    run('bake-scene.py', 'motion8', sheet, name, f'scene={scene}')
    run('walk-anchor.py', name)
    run('head-lock.py', name, ref, 'walk-a', 'walk-b', show=False)
    ims = [Image.open(f'{PX}/{name}-walk-{t}-{i}.png').convert('RGBA') for t in 'ab' for i in (3, 4, 1, 2)]
    z, x0, x1 = 4, 40, 170
    row = Image.new('RGB', ((x1 - x0) * z * 8, CH * z), BG)
    legs = Image.new('RGB', ((x1 - x0) * z * 4, 78 * z * 2), BG)
    d = ImageDraw.Draw(row)
    for k, im in enumerate(ims):
        c = on_bg(im.crop((x0, 0, x1, CH)), z)
        row.paste(c, (k * (x1 - x0) * z, 0))
        x = k * (x1 - x0) * z + (ROOT_X - x0) * z
        d.line([(x, CH * z - 40), (x, CH * z - 2)], fill=(0, 255, 255), width=2)
        legs.paste(c.crop((0, 80 * z, c.size[0], 158 * z)), ((k % 4) * (x1 - x0) * z, (k // 4) * 78 * z))   # 윗줄 = 앞 반, 아랫줄 = 뒤 반: 같은 열끼리 다리가 반대여야 한다
    row.save(f'{OUT}/chk-{name}-walk-zoom.png')
    legs.save(f'{OUT}/chk-{name}-legs.png')
    f = [on_bg(i, 3) for i in ims]
    f[0].save(f'{OUT}/{name}-2-walk.gif', save_all=True, append_images=f[1:], duration=110, loop=0)
    print(f'눈으로 볼 것(다리가 번갈아 나가나 · 손이 무기를 쥐었나 · 얼굴): {OUT}/chk-{name}-legs.png · chk-{name}-walk-zoom.png · {name}-2-walk.gif')


def groups(h, ncell):
    g = ['stand:stand:0-3', 'walk:walk:4-11', 'attack:attack:12-17']
    if ncell >= 26:
        g.append('quirk:misc:22-25')
    if h['atk8'] and ncell >= 34:
        g.append('attack8:attack:26-33')
    return g


def check(name, main=None, extra=None):
    h = HEROES[name]
    main = main or f'{GAME}/{h["strip"]}.png'
    extra = extra or f'{GAME}/{h["strip"]}-x.png'
    if not os.path.exists(main):
        print(f'{name}: 띠가 아직 없다 ({main})')
        return None
    n = Image.open(main).size[0] // CW + (Image.open(extra).size[0] // CW if os.path.exists(extra) else 0)
    args = [main] + ([f'x={extra}'] if os.path.exists(extra) else []) + groups(h, n) + [f'out={OUT}/chk-{h["strip"]}']
    return run('anim-check.py', *args).returncode == 0


def strip(name, install=False):
    h = HEROES[name]
    os.makedirs(TRY, exist_ok=True)
    ext = f'{TRY}/{h["strip"]}-ext.png'
    run('strip-build.py', name, h['atk'], ext, 'align', 'ext')
    e = Image.open(ext)
    main, extra = f'{TRY}/{h["strip"]}.png', f'{TRY}/{h["strip"]}-x.png'
    e.crop((0, 0, CW * 20, CH)).save(main)
    if e.size[0] > CW * 20:
        e.crop((CW * 20, 0, e.size[0], CH)).save(extra)
    ok = check(name, main, extra if e.size[0] > CW * 20 else None)
    cells = [e.crop((i * CW, 0, (i + 1) * CW, CH)) for i in range(e.size[0] // CW)]
    atk = list(range(26, 34)) if h['atk8'] and len(cells) >= 34 else [12, 13, 14, 15, 16, 17]
    seq = [(0, 600)] + [(i, 110) for i in range(4, 12)] * 2 + [(0, 500)] + ([(i, 300) for i in (22, 23, 24, 25)] + [(0, 400)] if len(cells) >= 26 else []) + [(i, 90) for i in atk] + [(0, 700)]
    f = [on_bg(cells[i], 3) for i, _ in seq]
    f[0].save(f'{OUT}/{h["strip"]}-flow.gif', save_all=True, append_images=f[1:], duration=[t for _, t in seq], loop=0)
    print(f'이어 보기: {OUT}/{h["strip"]}-flow.gif')
    if install:
        if not ok:
            raise SystemExit('불합격 — 게임에 넣지 않았다')
        import shutil
        shutil.copyfile(main, f'{GAME}/{h["strip"]}.png')
        if e.size[0] > CW * 20:
            shutil.copyfile(extra, f'{GAME}/{h["strip"]}-x.png')
        print('게임에 넣음:', f'{GAME}/{h["strip"]}.png')


if __name__ == '__main__':
    a = sys.argv[1:]
    if not a or a[0] not in ('walk', 'strip', 'check'):
        raise SystemExit(__doc__)
    if a[0] == 'walk':
        walk(a[1], a[2] if len(a) > 2 else 'walk-a-3')
    elif a[0] == 'strip':
        strip(a[1], 'install' in a[2:])
    else:
        bad = [n for n in (HEROES if a[1] == 'all' else [a[1]]) if check(n) is False]
        raise SystemExit(1 if bad else 0)
