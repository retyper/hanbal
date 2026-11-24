# -*- coding: utf-8 -*-
"""맞음·일어남 네 칸(hit) 일감 만들기 — 장수마다 장면(서기 + 인형 2×2)을 만들고 tools/gpt-image.mjs 가 읽을 일감 JSON 을 쓴다 (11-24).
  py -3 -X utf8 -I tools/sprite-kit/hit-jobs.py <장수 …> [out=tools/out/api/hit-jobs.json]
  그다음: node tools/gpt-image.mjs tools/out/api/hit-jobs.json 6  →  STD/out-<장수>-hit.png
  굽기: bake-scene.py motion STD/out-<장수>-hit.png <장수> hit STD/scene-<장수>-hit.png → px/<장수>-hit-1..4 · 하네스 HEROES hit=True → strip install → wire-hero … hit
무기 종류(하네스 atk): thrust·chop·slam = 두 손 긴 자루(hit_pole2) · slash = 한 손 칼·단검(hit_sword) · bow = 활(hit_bow) · claw = 맨손(hit_none)
인형 가슴은 그 장수의 다른 인형과 같게(BUST · 모르면 M). 문안은 해적 두목 H1(Codex · 형 「아주 좋아」)과 해비 API 판을 본뜬다.
"""
import importlib.util
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
S = 'D:/에셋창고/STD'
spec = importlib.util.spec_from_file_location('harness', HERE + '/anim-harness.py')
H = importlib.util.module_from_spec(spec)
spec.loader.exec_module(H)

BUST = dict(gaennae='L', galmae='XL', beodeul='L', heo='L', deulme='L', tneoul='L', budeul='L', gabi='L', baetsa='XL', odi='XL', sinneoul='XL', dana='XL', sogeum='XL', saltw='XL')
KIND = dict(thrust='pole2', chop='pole2', slam='pole2', slash='sword', stab='sword', bow='bow', claw='none')

WEAPON = {
    'pole2': ('The brown stick with a grey square only MARKS where her weapon is: draw her real two-handed weapon exactly as in the top-left reference '
              '(same shaft, same head or blade with the same shape and size) - never draw a grey square or a plain block; the weapon head sits where the grey square is; '
              'the near hand (light grey arm) holds the end of the shaft, the far hand (blue arm) holds near the head; the weapon must not extend past the grey square.',
              'her weapon pulled tight to her body', 'her weapon head lifted', 'her weapon planted upright with the end of the shaft on the ground and the head up, far hand gripping the shaft for support',
              'both hands aiming her weapon'),
    'sword': ('The grey bar only MARKS her blade: draw her real sword or dagger exactly as in the top-left reference (same hilt, same blade length and shape), held in the near hand (light grey arm). '
              'The far hand (blue arm) is empty. Never draw a plain grey bar.',
              'her blade pulled in close', 'her blade arm flung back', 'the point of her blade resting on the ground as a support',
              'her blade raised forward in guard'),
    'bow': ('The brown curve with a white string is her bow: draw her real bow exactly as in the top-left reference, held in the far hand (blue arm). No arrow is nocked. Keep her quiver as in the reference.',
            'her bow pulled in close', 'her bow lifted high', 'her bow held upright beside her as a support',
            'her bow held forward, ready'),
    'none': ('She is bare-handed: draw her hands as in the top-left reference (no weapon). Ignore any props on the mannequins.',
             'arms pulled in to guard', 'arms flung', 'one hand on the ground', 'hands raised in a fighting guard'),
}


def prompt(kind):
    w, p1, p2, p3, p4 = WEAPON[kind]
    return ('This is a sprite-sheet layout for a 2D pixel-art game. The top-left figure is the finished character (pixel art). '
            'The four grey jointed mannequins on the right are pose guides. Redraw ALL FOUR mannequins as this exact character, in exactly the same pixel-art style, '
            'colors, outfit, hair, face, head size and body proportions as the top-left figure (same height, same chest and shoulder width, the body turned three-quarters '
            'toward the viewer like the reference, not in profile), each standing exactly where its mannequin stands and in exactly the mannequin\'s pose '
            '(do not straighten or re-pose them). ' + w + ' '
            f'Panel 1 (top left of the 2x2): the instant she is hit - hunched forward, {p1}, eyes squeezed shut, teeth gritted, hair swinging forward. '
            f'Panel 2 (top right): hit hard and knocked back - upper body and head thrown far back, near foot pushed back a step, {p2}, mouth open in a grunt, hair and cloth flying forward. '
            f'Panel 3 (bottom left): getting up - near knee on the ground, {p3}, near hand on her knee, head raised glaring forward. '
            f'Panel 4 (bottom right): back in stance - legs wide, {p4}, a determined look (no blood). '
            'The clothes stay exactly as in the reference (opaque, nothing see-through). '
            'Face rules: bright even skin, clear simple eyes and mouth, no eye shadows, no blush. No shadows, no effects, no text. '
            'Keep the flat magenta background. Edges must be clean against the magenta, with no purple fringe.')


def run(*a):
    r = subprocess.run([sys.executable, '-X', 'utf8', '-I', *a], capture_output=True, text=True, encoding='utf-8', cwd=ROOT, timeout=240)
    if r.returncode:
        raise SystemExit(f'{a[0]} 실패: {r.stderr[-300:]}')


def main(argv):
    out = next((a[4:] for a in argv if a.startswith('out=')), 'tools/out/api/hit-jobs.json')
    names = [a for a in argv if not a.startswith('out=')]
    jobs = []
    for n in names:
        kind = KIND[H.HEROES[n]['atk']]
        bust = BUST.get(n, 'M')
        rig = f'{S}/rig-f-quirk-hit_{kind}-{bust}.png'
        if not os.path.exists(rig):
            run(HERE + '/pose-rig.py', 'quirk', f'hit_{kind}', bust)
        scene = f'{S}/scene-{n}-hit.png'
        run(HERE + '/style-scene.py', 'motion', f'{S}/px/{n}-stand.png', rig, scene, 'rig')
        jobs.append(dict(out=f'{S}/out-{n}-hit.png', images=[scene], prompt=prompt(kind), model='gpt-image-2'))
        print(n, kind, bust, scene)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    json.dump(jobs, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('일감', len(jobs), '→', out)


if __name__ == '__main__':
    main(sys.argv[1:])
