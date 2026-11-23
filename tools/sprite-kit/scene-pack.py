# -*- coding: utf-8 -*-
"""장수 한 명의 동작 장면을 한꺼번에 (11-24 · 같은 명령 줄을 장수마다 손으로 치던 것).
서기가 합격한 뒤: 서기를 동작 키(138)로 다시 굽고, 걷기 여덟 칸 · 공격 · 쓰러짐 · 개성 동작 장면을 만든다. 나온 장면을 Codex 에게 차례로 준다.
  py -3 -X utf8 -I tools/sprite-kit/scene-pack.py <이름> pole2 <걸음 결: plain|proud|sway|heavy|prowl|bouncy> <쓰러짐 판: e|e2> [가슴=M] [서기 장면의 몇째 사람=3]
    pole2 = 두 손 긴 자루(창·작살·도끼): 걷기(pole2) · 찌르기 여덟 칸(thrust a·b) · 개성 동작(retie = 자루를 세워 짚고 머리를 만짐)
  py … scene-pack.py <이름> bow <걸음 결> <쓰러짐 판> [가슴]      활: 걷기(bow) · 활 쏘기 네 칸 · 개성 동작(hairflip)
"""
import subprocess
import sys

HERE = 'D:/flutter/arrow_game_one/tools/sprite-kit/'
S = 'D:/에셋창고/STD/'


def run(script, *a):
    r = subprocess.run([sys.executable, '-X', 'utf8', '-I', HERE + script, *a], capture_output=True, text=True, encoding='utf-8', timeout=240, cwd='D:/flutter/arrow_game_one')
    if r.returncode != 0:
        print(r.stdout[-400:], r.stderr[-800:])
        raise SystemExit(script + ' 실패')
    return r.stdout.strip().split('\n')[-1][:140]


def main(name, kind, style, fall, bust='M', idx='3'):
    print(run('bake-scene.py', 'stand', f'{S}out-{name}-stand.png', name, idx, 'h=138'))
    st = f'{S}px/{name}-stand.png'
    made = []
    prop = 'pole2' if kind == 'pole2' else 'bow'
    run('pose-rig.py', 'walk', style, bust, prop)
    run('style-scene.py', 'motion8', st, f'{S}rig-f-walk-{style}-{bust}-{prop}-a.png', f'{S}rig-f-walk-{style}-{bust}-{prop}-b.png', f'{S}scene-{name}-walk8.png')
    made.append(f'scene-{name}-walk8.png')
    if kind == 'pole2':
        run('pose-rig.py', 'attack', 'thrust', bust)
        for h in 'ab':
            run('style-scene.py', 'attack4', st, f'{S}rig-f-atk-thrust-{bust}-{h}.png', f'{S}scene-{name}-thrust-{h}.png')
            made.append(f'scene-{name}-thrust-{h}.png')
        run('pose-rig.py', 'quirk', 'retie', bust)
        run('style-scene.py', 'motion', st, f'{S}rig-f-quirk-retie-{bust}.png', f'{S}scene-{name}-quirk.png', 'rig')
    else:
        run('pose-rig.py', 'bow', bust)
        run('style-scene.py', 'motion', st, f'{S}rig-f-bow-{bust}.png', f'{S}scene-{name}-bow.png', 'rig')
        made.append(f'scene-{name}-bow.png')
        run('pose-rig.py', 'quirk', 'hairflip', bust, 'bow')
        run('style-scene.py', 'motion', st, f'{S}rig-f-quirk-hairflip-{bust}.png', f'{S}scene-{name}-quirk.png', 'rig')
    made.append(f'scene-{name}-quirk.png')
    print(run('style-scene.py', 'fall', st, f'{S}motion-f-down-{fall}.png', f'{S}scene-{name}-fall-{fall}.png'))
    made.append(f'scene-{name}-fall-{fall}.png')
    print('만든 장면:', ' · '.join(made))


if __name__ == '__main__':
    main(*sys.argv[1:])
