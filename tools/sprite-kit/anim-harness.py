# -*- coding: utf-8 -*-
"""전투 그림 하네스 — 받은 그림 한 장에서 게임 띠까지, 한 줄로 · 끝은 늘 숫자 판정 (11-23 형 「하네스로 제대로 만들어서 shared config 에도」).
낱낱의 도구(bake-scene · walk-anchor · head-lock · strip-build · anim-check)를 차례대로 부른다. 손으로 차례를 외워 치지 않는다 — 빠뜨린 걸음이 흔들림이 됐다.
규칙·까닭은 docs/realm/production/ART-SKELETON.md (§11 몸의 뿌리 · §12 참고 게임에서 본 것), 공용 판은 codex-shared-config/skills/sprite-anim-harness.

  py -3 -X utf8 -I tools/sprite-kit/anim-harness.py walk  <장수> [머리 기준 칸=walk-a-3]
      STD/out-<장수>-walk8.png + STD/scene-<장수>-walk8.png(.roots.json) → 뿌리 맞춰 굽기 → 윗몸 한자리 → 머리 고정 → 확대판·다리 확대·GIF
  py -3 -X utf8 -I tools/sprite-kit/anim-harness.py attack <장수>
      넓은 칸 공격 두 판(STD/out-<장수>-<꼬리표>-a/b.png · scene-… .roots.json) → 뿌리 맞춰 굽기 → 여덟 칸 확대판·GIF  (act 장수만)
  py -3 -X utf8 -I tools/sprite-kit/anim-harness.py strip <장수> [install]
      띠를 짓고(서기·걷기·공격·쓰러짐 + 덧띠) anim-check 로 판정. 합격이고 install 을 주면 public/realm/anim-px 에 넣는다(불합격이면 안 넣는다)
  py -3 -X utf8 -I tools/sprite-kit/anim-harness.py check <장수|all>
      지금 게임에 들어 있는 띠를 다시 판정
장수 표(HEROES): 띠 파일 이름 · 공격 꼬리표 · 덧띠에 여덟 칸 공격이 있는가.
"""
import os
import subprocess
import sys
import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
STD = 'D:/에셋창고/STD'
PX = STD + '/px'
OUT = ROOT + '/tools/out/lineup'
TRY = ROOT + '/tools/out/strip/try'
GAME = ROOT + '/public/realm/anim-px'
CW, CH, ROOT_X, FOOT_Y = 208, 160, 104, 155
ACT = dict(cw=240, ch=224, root=92, foot=216)   # bake-scene.py ACT 와 같은 값


def use(h):
    """장수의 동작 칸 폭(actw · 기본 240) — 낮게 깊이 찌르는 새 창 인형은 뿌리 앞으로 160px 까지 나가 240 칸(앞 148)에 안 들어간다 → 그 장수만 288"""
    ACT['cw'] = h.get('actw', 240)
    return h

BG = (96, 104, 72)

HEROES = {
    'beom': dict(hit=True, strip='gen-beom', atk='claw', atk8=True),
    'maehwa': dict(hit=True, strip='gen-maehwa', atk='bow', atk8=False),
    'dalbit': dict(hit=True, strip='gen-base-w-31-dabeol-dalbit', atk='bow', atk8=False),
    'archer': dict(hit=True, strip='gen-base-w-13-young-archer', atk='bow', atk8=False),   # 앳된 궁수
    'pirate': dict(hit=True, strip='gen-base-w-10-pirate-captain', atk='thrust', src='thrust2', actw=264, atk8=True, act=True, legacy=(('a', 2), ('a', 3), ('b', 3), ('b', 4))),   # 해적 두목(작살) · 끝까지 찌른 칸은 좁은 칸에 안 들어가 당기는 칸으로
    'diver': dict(hit=True, strip='gen-base-w-17-mahan-pearl-diver', atk='thrust', src='thrust2', actw=264, atk8=True, act=True, legacy=(('a', 2), ('a', 3), ('b', 3), ('b', 4))),   # 해녀(작살) · 11-24 새 찌르기 인형으로 b 까지 받음(예전엔 b 가 거절돼 앞 판만 썼다)
    'huntress': dict(hit=True, strip='gen-base-w-06-buyeo-huntress', atk='thrust', src='thrust2', actw=264, atk8=True, act=True, legacy=(('a', 2), ('a', 3), ('b', 3), ('b', 4))),   # 부여 사냥꾼(창)
    'dallae': dict(hit=True, strip='gen-base-w-64-miri-dallae', atk='thrust', src='thrust2', actw=264, atk8=True, act=True, legacy=(('a', 2), ('a', 3), ('b', 3), ('b', 4))),   # 미리 군주 달래(창)
    'ara': dict(hit=True, atkk=1.05, strip='gen-ara', atk='slash', atk8=True, act=True, legacy=(('a', 1), ('a', 3), ('b', 2), ('b', 4))),   # 가야 검사 아라(한 손 칼) · 좁은 칸: 머리 위로 곧게 세운 a2 는 위가, 끝까지 벤 b1 은 앞이 넘친다
    'dtiger': dict(hit=True, strip='gen-base-w-22-dongye-tiger-huntress', atk='thrust', src='thrust2', actw=264, atk8=True, act=True, legacy=(('a', 2), ('a', 3), ('b', 3), ('b', 4))),   # 동예 범 사냥꾼(창)
    'noeul': dict(hit=True, strip='gen-noeul', atk='bow', atk8=False),   # 사로 노을(활)
    'sagong': dict(hit=True, strip='gen-sagong', atk='thrust', src='thrust2', actw=264, atk8=True, act=True, legacy=(('a', 2), ('a', 3), ('b', 3), ('b', 4))),   # 사물 사공(두 손 노 · 찌르기)
    'songbi': dict(strip='gen-songbi', atk='bow', atk8=False),   # 비류나 송비(활)
    'sinneoul': dict(hit=True, strip='gen-sinneoul', atk='thrust', src='thrust2', actw=264, atk8=True, act=True, legacy=(('a', 2), ('a', 3), ('b', 3), ('b', 4))),   # 신지 너울(두 손 갈고리 장대 · 가슴 XL)
    'heo': dict(hit=True, strip='gen-heo', atk='thrust', src='thrust2', actw=264, atk8=True, act=True, legacy=(('a', 2), ('a', 3), ('b', 3), ('b', 4))),   # 가락 허황옥(금빛 창 · 가슴 L)
    'mwarrior': dict(hit=True, strip='gen-base-w-08-mahan-warrior', atk='thrust', src='thrust2', actw=264, atk8=True, act=True, legacy=(('a', 2), ('a', 3), ('b', 3), ('b', 4))),   # 마한 전사(창 · 우람한 뼈대)
    'whaleq': dict(hit=True, strip='gen-base-w-23-usisan-whale-queen', atk='thrust', src='thrust2', actw=264, atk8=True, act=True, legacy=(('a', 2), ('a', 3), ('b', 3), ('b', 4))),   # 우시산 고래 여왕(미늘 작살 · 우람한 뼈대)
    'tomboy': dict(hit=True, strip='gen-base-w-26-iseo-tomboy-general', atk='thrust', atk8=True, act=True, legacy=(('a', 2), ('a', 3), ('b', 3), ('b', 4))),   # 이서 말괄량이 장군(창 · 우람한 뼈대)
    'beol': dict(hit=True, strip='gen-base-w-72-eumjeup-beol', atk='slash', atk8=True, act=True, legacy=(('a', 1), ('a', 3), ('b', 2), ('b', 4))),   # 음즙 벌(한 손 칼 · 우람한 뼈대) · 좁은 칸은 아라처럼 덜 뻗은 칸
    'tneoul': dict(hit=True, strip='gen-tneoul', atk='thrust', src='thrust2', actw=264, atk8=True, act=True, legacy=(('a', 2), ('a', 3), ('b', 3), ('b', 4)), lock='face'),   # 탐라 너울(두 손 나무 노 · 가슴 L) · 머리 상자 묶기는 b-2 에서 얼굴 자리를 잘못 잡아 머리가 둘이 됐다(11-24) → 얼굴 안쪽만
    'baetsa': dict(hit=True, strip='gen-base-w-76-gampyeong-baetsagong', atk='thrust', src='thrust2', actw=264, atk8=True, act=True, legacy=(('a', 2), ('a', 3), ('b', 3), ('a', 1)), cells8=[('a', 1), ('a', 2), ('a', 3), ('a', 4), ('b', 1), ('b', 2), ('b', 3), ('a', 1)]),   # 감평 뱃사공(두 손 나무 노 · 가슴 XL) · 찌르기 b 칸4 가 서기보다 14% 크게 그려져(키 158 · 다시 그리기 한 번 씀) 끝 칸을 a1 로
    'odi': dict(hit=True, strip='gen-odi', atk='thrust', src='thrust2', actw=264, atk8=True, act=True, legacy=(('a', 2), ('a', 3), ('b', 3), ('b', 4))),   # 조문 오디(창 · 가슴 XL)
    'deulme': dict(hit=True, strip='gen-base-w-34-chopal-deulme', atk='thrust', src='thrust2', actw=264, atk8=True, act=True, legacy=(('a', 2), ('a', 3), ('b', 3), ('b', 4))),   # 초팔 들메(창 · 우람한 뼈대 · 가슴 L)
    'dana': dict(hit=True, strip='gen-base-w-102-garak-dana', atk='bow', atk8=False),   # 가락 다나(활 · 가슴 XL)
    'maena': dict(hit=True, strip='gen-base-w-36-baekje-maena', atk='bow', atk8=False),   # 백제 매나(활 · 가슴 L)
    'galmae': dict(strip='gen-base-w-39-gosaburi-galmae', atk='bow', atk8=False),   # 가오사부리 갈매(활 · 가슴 XL) · 일곱째 묶음 = 그림 API 만으로
    'beodeul': dict(strip='gen-base-w-41-hwanna-beodeul', atk='bow', atk8=False),   # 환나 버들(활 · 가슴 L) · API
    'solmae': dict(strip='gen-base-w-79-yangmaek-solmae', atk='bow', atk8=False),   # 양맥 솔매(활 · 가슴 M) · API
    'dalli': dict(strip='gen-dalli', atk='bow', atk8=False),   # 마가 달리(활 · 우람한 뼈대) · API
    'danbi': dict(strip='gen-danbi', atk='bow', atk8=False),   # 사로 단비(활 · 가는 뼈대 → M 장면) · API
    'sogeum': dict(hit=True, strip='gen-base-w-56-dongokjeo-sogeum', atk='slash', atk8=True, act=True, legacy=(('a', 1), ('a', 3), ('b', 2), ('b', 4))),   # 동옥저 소금 상인(단검 · 가슴 XL) · 좁은 칸은 아라처럼 덜 뻗은 칸
    'budeul': dict(hit=True, strip='gen-budeul', atk='slash', atk8=True, act=True, legacy=(('a', 1), ('a', 3), ('b', 2), ('b', 4))),   # 골벌 부들(단검 · 가슴 L)
    'gabi': dict(hit=True, strip='gen-base-w-53-hwanna-gabi', atk='slash', atk8=True, act=True, legacy=(('a', 1), ('a', 3), ('b', 2), ('b', 4))),   # 환나 가비(단검 · 가슴 L)
    'saltw': dict(hit=True, strip='gen-base-w-18-jinhan-salt-widow', atk='slash', atk8=True, act=True, legacy=(('a', 1), ('a', 3), ('b', 2), ('b', 4))),   # 진한 소금 과부(단검 · 가슴 XL)
    'beombal': dict(hit=True, strip='gen-beombal', atk='slash', atk8=True, act=True, legacy=(('a', 1), ('a', 3), ('b', 2), ('b', 4))),   # 맥 범발(단검 · 가슴 M)
    'irang': dict(hit=True, strip='gen-irang', atk='slash', atk8=True, act=True, legacy=(('b', 3), ('b', 1), ('b', 2), ('b', 4)), cells8=[('b', 4), ('b', 3), ('b', 3), ('b', 1), ('b', 1), ('b', 2), ('b', 3), ('b', 4)]),   # 조문 이랑(단검 · 가슴 M) · 내려베기 a 판은 그림 도구가 거절 → b 판 넷으로 여덟 칸(거둠 칸을 당김으로 · 찌르는 칸 넷째)
    'sogeumbi': dict(hit=True, strip='gen-sogeumbi', atk='slash', atk8=True, act=True, legacy=(('a', 1), ('a', 3), ('b', 2), ('b', 4))),   # 옥저 소금비(한 손 칼 · 가슴 M)
    'baram': dict(strip='gen-baram', atk='stab', atk8=True, act=True, legacy=(('a', 2), ('a', 3), ('b', 1), ('b', 2)), cells8=[('a', 1), ('a', 2), ('a', 3), ('a', 4), ('b', 1), ('b', 2), ('a', 1), ('b', 4)]),   # 고사부리 바람(단검 · 가슴 M) · 11-24 새 단검 인형 찌르기(stab · 타격 a4) · 좁은 칸은 뿌리 앞 104 까지라 a4(108) 대신 버팀 b1(98) · b3 이 팔을 다시 뻗어 두 번 찌르듯 보여(독립 검수) 일곱째 칸은 낮은 겨눔 a1 · b1 머리칼의 자홍 점 여섯은 이웃 색으로 메움(px)
    'byeol': dict(hit=True, strip='gen-byeol', atk='slash', atk8=True, act=True, legacy=(('a', 1), ('a', 3), ('b', 2), ('b', 4))),   # 벽진 별(한 손 칼 · 가슴 M · 달군 칼날은 불빛 없이) · 11-24 G4(내려베기 a)만 받음 · G5(b) 거절 → 보류
    'maru': dict(hit=True, strip='gen-base-w-46-geonma-maru', atk='thrust', src='thrust2', actw=264, refoot=True, atk8=True, act=True, legacy=(('a', 2), ('a', 3), ('b', 3), ('b', 4)), cells8=[('a', 1), ('a', 2), ('a', 3), ('a', 4), ('a', 4), ('a', 4), ('b', 3), ('b', 4)]),   # 건마 마루(짧은 창 · 가슴 M) · 여섯째 묶음 · refoot: 찌르기 b 가 인형보다 넓게 뻗어 통째 겹침이 -42px 밀려 b3·b4 의 발을 잘못 잡았다(bake-scene attack4)
    'mudeung': dict(hit=True, strip='gen-base-w-48-mujin-mudeung', atk='thrust', src='thrust2', actw=264, refoot=True, atk8=True, act=True, legacy=(('a', 2), ('a', 3), ('b', 3), ('a', 1)), cells8=[('a', 1), ('a', 2), ('a', 3), ('a', 4), ('a', 4), ('a', 4), ('a', 3), ('a', 1)]),   # 무진 무등(깃털 단 창 · 우람한 뼈대 · 나이 든 얼굴) · 여섯째 묶음 · 찌르기 b 칸4 가 서기보다 9% 크게 그려져(키 150 · 다시 그리기 한 번 씀) 끝 칸을 a1 로(뱃사공과 같은 길)
    'yneoul': dict(hit=True, strip='gen-base-w-71-yeonna-neoul', atk='thrust', src='thrust2', actw=264, refoot=True, atk8=True, act=True, legacy=(('a', 2), ('a', 3), ('b', 3), ('b', 4))),   # 연나 너울(창 · 가슴 M) · 여섯째 묶음
    'gangchi': dict(pending=True, hit=True, strip='gen-base-w-80-usan-gangchi', atk='thrust', src='thrust2', actw=264, refoot=True, atk8=True, act=True, legacy=(('a', 2), ('a', 3), ('b', 3), ('b', 4))),   # 우산 강치(미늘창 · 가슴 M) · 여섯째 묶음
    'byeolbit': dict(pending=True, hit=True, strip='gen-base-w-81-byeokjin-byeolbit', atk='thrust', src='thrust2', actw=264, refoot=True, atk8=True, act=True, legacy=(('a', 2), ('a', 3), ('b', 3), ('b', 4))),   # 벽진 별빛(창 · 비늘 갑옷 · 가슴 M) · 여섯째 묶음
    'haebi': dict(hit=True, strip='gen-haebi', atk='chop', atk8=True, act=True),   # act = 공격 여덟 칸이 넓은 동작 칸(240×224 · 뿌리 92 · 발 줄 216)
    'areum': dict(hit=True, strip='gen-areum', atk='slam', atk8=True, act=True, lock='none'),   # 받은 그림 그대로(얼굴을 떠다 붙이지 않는다 — 11-24: 뭉친 얼굴이 여덟 칸에 퍼졌다) · 옛 lock='face': 메가 머리 뒤로 지나간다 — 머리 상자는 메를 자르고(「포스터」), 윗몸을 통째로 묶으면 떠다닌다(11-24 형) → 얼굴 안쪽만 묶는다
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
    # 머리 덮어씌우기는 기본으로 끈다 (11-24 형 「portrait 부분을 따로 잘라서 걸을 때 붙여 넣은 거임? 포스터 얼굴에 붙이고 걸어다니는 거 같잖아」 · 범·벌·해녀
    #   · 매나는 상자 금에서 어깨·가슴이 잘렸다). 기준 칸의 머리 상자를 다른 칸에 얹으면 머리가 몸과 따로 논다. 받은 그림 그대로 두고, 흔들림은 anim-check 숫자로 본다.
    lk = HEROES[name].get('lock', 'none')
    if lk != 'none':   # 'face' · 상자 = 형이 따로 허락한 장수만
        run('head-lock.py', name, ref, 'walk-a', 'walk-b', *(['face'] if lk == 'face' else [f'box={lk}'] if lk else []), show=(lk == 'face'))
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


def cells8(h):
    """공격 여덟 칸의 출처(판, 칸) — 기본은 a1~a4 · b1~b4. 뒤 판(b)을 못 받은 장수는 HEROES 의 cells8 로 앞 판만으로 짠다
    (11-24: 해녀 찌르기 b 를 그림 도구가 거절 — 우회하지 않고, 넘어오는 칸 a4 를 타격·버팀으로 쓰고 a3·a1 로 거둔다)."""
    return h.get('cells8', [(t, i) for t in 'ab' for i in (1, 2, 3, 4)])


def attack(name):
    """넓은 칸 공격 두 판(STD/out-<장수>-<꼬리표>-a/b.png + scene-…)을 굽고 여덟 칸을 뿌리 선과 함께 늘어놓는다"""
    h = use(HEROES[name])
    for half in sorted({t for t, _ in cells8(h)}):
        src = h.get('src', h['atk'])   # 다시 그린 판(예: thrust2)은 src 로 가리킨다 — 굽는 이름은 그대로
        run('bake-scene.py', 'attack4', f'{STD}/out-{name}-{src}-{half}.png', name, f'{h["atk"]}8-{half}', f'{STD}/scene-{name}-{src}-{half}.png', f'cw={ACT["cw"]}', f'k={h.get("atkk", 1.0)}', *(['refoot'] if h.get('refoot') else []))
    ims = [Image.open(f'{PX}/{name}-{h["atk"]}8-{t}-{i}.png').convert('RGBA') for t, i in cells8(h)]
    z = 3
    row = Image.new('RGB', (ACT['cw'] * z * 4, ACT['ch'] * z * 2), BG)
    d = ImageDraw.Draw(row)
    for k, im in enumerate(ims):
        x0, y0 = (k % 4) * ACT['cw'] * z, (k // 4) * ACT['ch'] * z
        row.paste(on_bg(im, z), (x0, y0))
        d.line([(x0 + ACT['root'] * z, y0 + ACT['foot'] * z - 30), (x0 + ACT['root'] * z, y0 + ACT['foot'] * z + 16)], fill=(0, 255, 255), width=2)
        d.rectangle([x0, y0, x0 + ACT['cw'] * z - 1, y0 + ACT['ch'] * z - 1], outline=(70, 76, 54))
    row.save(f'{OUT}/chk-{name}-{h["atk"]}8.png')
    f = [on_bg(i, 3) for i in ims]
    f[0].save(f'{OUT}/{name}-3-{h["atk"]}8.gif', save_all=True, append_images=f[1:], duration=[90, 80, 110, 50, 150, 70, 80, 120], loop=0)
    print(f'눈으로 볼 것(앞발이 여덟 칸 같은 자리인가 · 두 손이 자루를 쥐었나 · 무기가 하나인가): {OUT}/chk-{name}-{h["atk"]}8.png · {name}-3-{h["atk"]}8.gif')


def quirk(name):
    """개성 동작 네 칸(STD/out-<장수>-quirk.png + scene-<장수>-quirk.png · 인형 2×2) 굽기 → 서기 옆에 늘어놓는다"""
    run('bake-scene.py', 'motion', f'{STD}/out-{name}-quirk.png', name, 'quirk', f'{STD}/scene-{name}-quirk.png')
    st = Image.open(f'{PX}/{name}-stand-game.png').convert('RGBA')
    ims = [Image.open(f'{PX}/{name}-quirk-{i}.png').convert('RGBA') for i in (1, 2, 3, 4)]
    z = 3
    row = Image.new('RGB', (CW * z * 5, CH * z), BG)
    sc = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
    sc.alpha_composite(st, ((CW - st.size[0]) // 2, FOOT_Y - st.size[1]))
    for k, im in enumerate([sc] + ims):
        row.paste(on_bg(im, z), (k * CW * z, 0))
    row.save(f'{OUT}/chk-{name}-quirk.png')
    print(f'눈으로 볼 것(첫 칸이 서기 / 발이 네 칸 같은 자리 / 물건이 하나): {OUT}/chk-{name}-quirk.png')


def act_cells(name):
    """넓은 칸 공격 여덟 칸 → 본 띠용 좁은 칸 넷(<꼬리표>-1..4 = 준비2 · 넘어옴 · 내림 · 거둠) — 뿌리·발 줄을 맞춰 잘라 낸다. 본편 전장처럼 20칸만 읽는 곳이 쓴다"""
    h = use(HEROES[name])
    # 본 띠의 좁은 칸(208)은 뿌리 앞으로 104px 까지만 담는다 — 멀리 찌르는 칸은 잘린다(해적 두목 작살 119px) → 장수마다 좁은 칸에 들어가는 칸을 고른다(legacy)
    src = [f'{PX}/{name}-{h["atk"]}8-{t}-{i}.png' for t, i in h.get('legacy', (('a', 2), ('a', 4), ('b', 1), ('b', 4)))]
    for k, sp in enumerate(src):
        im = Image.open(sp).convert('RGBA')
        o = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
        o.alpha_composite(im, (ROOT_X - ACT['root'], FOOT_Y - ACT['foot']))   # 넘치는 곳(머리 위로 든 무기)은 잘린다 — anim-check 가 알린다
        o.save(f'{PX}/{name}-{h["atk"]}-{k + 1}.png')


def to_act(c):
    o = Image.new('RGBA', (ACT['cw'], ACT['ch']), (0, 0, 0, 0))
    o.alpha_composite(c, (ACT['root'] - ROOT_X, ACT['foot'] - FOOT_Y))
    return o


def groups(h, ncell):
    g = ['stand:stand:0-3', 'walk:walk:4-11', 'attack:attack:12-17']
    if ncell >= 26:
        g.append('quirk:misc:22-25')
    if h['atk8'] and ncell >= 34:
        g.append('attack8:attack:26-33')
    if h.get('hit'):
        g.append(f'hit:attack:{ncell - 4}-{ncell - 1}')
    return g


def check(name, main=None, extra=None, grp=None):
    h = use(HEROES[name])
    main = main or f'{GAME}/{h["strip"]}.png'
    extra = extra or f'{GAME}/{h["strip"]}-x.png'
    if not os.path.exists(main):
        print(f'{name}: 띠가 아직 없다 ({main})')
        return None
    n = Image.open(main).size[0] // CW + (Image.open(extra).size[0] // (ACT['cw'] if h.get('act') else CW) if os.path.exists(extra) else 0)
    xg = [f'xcw={ACT["cw"]}', f'xch={ACT["ch"]}', f'xroot={ACT["root"]}', f'xfoot={ACT["foot"]}'] if h.get('act') else []
    if h.get('act') and grp is None and os.path.exists(extra):   # 게임에 든 띠를 다시 볼 때: 덧띠 = 쓰러짐 2 (+ 개성 4) + 공격 8
        nx = Image.open(extra).size[0] // ACT['cw']
        hx = 4 if h.get('hit') else 0   # 맞음·일어남 네 칸이 공격 뒤에 붙은 장수(11-24)
        nx -= hx
        grp = (['hit:attack:%d-%d' % (20 + nx, 20 + nx + 3)] if hx else []) + ['stand:stand:0-3', 'walk:walk:4-11', 'attack:attack:12-17'] + (['quirk:misc:22-25'] if nx >= 14 else []) + [f'attack8:attack:{20 + nx - 8}-{20 + nx - 1}']
    args = [main] + ([f'x={extra}'] + xg if os.path.exists(extra) else []) + (grp or groups(h, n)) + [f'out={OUT}/chk-{h["strip"]}']
    return run('anim-check.py', *args).returncode == 0


def strip(name, install=False):
    h = use(HEROES[name])
    os.makedirs(TRY, exist_ok=True)
    ext = f'{TRY}/{h["strip"]}-ext.png'
    if h.get('act'):
        return strip_act(name, install)
    run('strip-build.py', name, h['atk'], ext, 'align', 'ext')
    e = Image.open(ext)
    main, extra = f'{TRY}/{h["strip"]}.png', f'{TRY}/{h["strip"]}-x.png'
    e.crop((0, 0, CW * 20, CH)).save(main)
    if h.get('hit'):   # 맞음·일어남 네 칸을 덧띠 끝에 (본 띠와 같은 208×160 칸 · bake-scene motion … hit)
        e2 = Image.new('RGBA', (e.size[0] + CW * 4, CH), (0, 0, 0, 0))
        e2.alpha_composite(e.convert('RGBA'), (0, 0))
        for i in (1, 2, 3, 4):
            e2.alpha_composite(Image.open(f'{PX}/{name}-hit-{i}.png').convert('RGBA'), (e.size[0] + (i - 1) * CW, 0))
        e = e2
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


def _upper(im):
    a = np.asarray(im)[..., 3] > 40
    ys = np.nonzero(a.any(1))[0]
    h = ys.max() - ys.min() + 1
    u = np.zeros_like(a)
    u[ys.min() + int(h * .04):ys.min() + int(h * .45)] = a[ys.min() + int(h * .04):ys.min() + int(h * .45)]
    return u


def _reg(a, r, reach=30):
    """a 가 r 에서 가로로 얼마나 밀렸나(세로 ±8 도 함께 본다)"""
    best, at = None, 0
    for dy in range(-8, 9):
        ry = np.roll(r, dy, axis=0)
        for dx in range(-reach, reach + 1):
            c = int((a ^ np.roll(ry, dx, axis=1)).sum())
            if best is None or c < best or (c == best and abs(dx) < abs(at)):
                best, at = c, dx
    return at


def _shift(im, d):
    o = Image.new('RGBA', im.size, (0, 0, 0, 0))
    o.alpha_composite(im, (d, 0))
    return o


def _room(im):
    """그림이 칸 안에서 왼쪽·오른쪽으로 더 갈 수 있는 화소(가장자리 2px 는 남긴다)"""
    a = np.asarray(im)[..., 3] > 40
    xs = np.nonzero(a.any(0))[0]
    return int(xs.min()) - 2, im.size[0] - 3 - int(xs.max())


def strip_act(name, install=False):
    """넓은 동작 칸 장수: 본 띠(208×160 · 20칸) + 덧띠(240×224 · 쓰러짐 2 [+ 개성 4] + 공격 8)"""
    import shutil
    h = use(HEROES[name])
    act_cells(name)
    ext = f'{TRY}/{h["strip"]}-ext.png'
    run('strip-build.py', name, h['atk'], ext, 'align', 'rooted', 'ext')
    e = Image.open(ext).convert('RGBA')
    main, extra = f'{TRY}/{h["strip"]}.png', f'{TRY}/{h["strip"]}-x.png'
    e.crop((0, 0, CW * 20, CH)).save(main)
    # 쓰러짐 2 (+ 개성 4) 만 — strip-build 는 개성 동작이 있으면 여덟 칸 공격도 좁은 칸에 붙여 내는데(잘린 그림), 넓은 칸 장수는 그것을 쓰지 않는다.
    #   11-24: 이것을 안 걸러 덧띠에 잘린 공격 8칸이 끼어 들어갔고, 그 칸으로 이어 보기 GIF 를 만들어 형에게 보냈다(공격이 바닥 밑으로 꺼진 그림).
    n_old = 2 + (4 if os.path.exists(f'{PX}/{name}-quirk-1.png') else 0)
    old = [e.crop((i * CW, 0, (i + 1) * CW, CH)) for i in range(20, 20 + n_old)]
    xs = [to_act(c) for c in old] + [Image.open(f'{PX}/{name}-{h["atk"]}8-{t}-{i}.png').convert('RGBA') for t, i in cells8(h)]
    A8 = slice(len(old), len(old) + 8)   # 공격 여덟 칸 자리 (뒤에 맞음 네 칸이 붙을 수 있어 「마지막 8칸」으로 세지 않는다)
    if h.get('hit'):   # 맞음 둘(움츠림 · 젖혀짐) + 일어남 둘(한 무릎 · 넓게 섬) — bake-scene motion <out-…-hit> <이름> hit <scene-…-hit>
        def _fit(c):   # 넓은 칸은 뿌리(92)가 본 칸(104)보다 왼쪽이라 뒤로 많이 빠진 칸(한 무릎)은 왼쪽 12px 이 잘린다 — 그만큼만 오른쪽으로
            x0 = int(np.nonzero((np.asarray(c)[..., 3] > 40).any(0))[0].min())
            need = (ROOT_X - ACT['root']) + 2 - x0
            return _shift(c, need) if need > 0 else c
        xs += [to_act(_fit(Image.open(f'{PX}/{name}-hit-{i}.png').convert('RGBA'))) for i in (1, 2, 3, 4)]
    # 공격 묶음을 서기에 잇는다 (11-24): 공격 여덟 칸은 앞발 끝으로, 서기·걷기는 윗몸으로 맞춰서, 그림의 보폭이 인형보다 넓은 장수는
    #   서기 → 공격 첫 칸 · 공격 끝 칸 → 서기에서 몸이 9~16px 옆으로 튀었다(해비 15 · 사냥꾼 16 · 해녀 15). 여덟 칸을 **같은 만큼** 옮겨
    #   끝 칸(거둔 자세)의 윗몸을 서기에 맞춘다 — 여덟 칸 사이의 앞발 고정은 그대로다. 좁은 칸 공격(12~17)도 같은 만큼.
    st_act = to_act(e.crop((0, 0, CW, CH)))
    d = -_reg(_upper(xs[A8][-1]), _upper(st_act))   # 공격 끝 칸 — xs[-1] 은 맞음 칸이 붙으면 넓게 선 칸이 된다(11-24 이랑: 끝 칸 윗몸 -18px)
    narrow = [e.crop((i * CW, 0, (i + 1) * CW, CH)) for i in range(12, 18)]
    lo = max(-min(_room(c)[0] for c in xs[A8] + narrow), -40)
    hi = min(min(_room(c)[1] for c in xs[A8] + narrow), 40)
    d = max(lo, min(hi, d))
    if abs(d) >= 2:
        xs[A8] = [_shift(c, d) for c in xs[A8]]
        m2 = Image.open(main).convert('RGBA')
        for k, c in enumerate(narrow):
            m2.paste(_shift(c, d), ((12 + k) * CW, 0))
        m2.save(main)
        e.paste(m2, (0, 0))
        print(f'공격 묶음을 서기에 이음: 여덟 칸 {d:+d}px')
    xstrip = Image.new('RGBA', (ACT['cw'] * len(xs), ACT['ch']), (0, 0, 0, 0))
    for i, c in enumerate(xs):
        xstrip.alpha_composite(c, (i * ACT['cw'], 0))
    xstrip.save(extra)
    a0 = 20 + len(old)
    grp = ['stand:stand:0-3', 'walk:walk:4-11', 'attack:attack:12-17'] + (['quirk:misc:22-25'] if len(old) >= 6 else []) + [f'attack8:attack:{a0}-{a0 + 7}'] + ([f'hit:attack:{a0 + 8}-{a0 + 11}'] if h.get('hit') else [])
    ok = check(name, main, extra, grp)
    cells = [e.crop((i * CW, 0, (i + 1) * CW, CH)) for i in range(20)]
    st = to_act(cells[0])
    seq = [(st, 700)] + [(to_act(cells[i]), 110) for i in range(4, 12)] * 2 + [(st, 600)]
    if n_old >= 6:
        seq += [(c, t) for c, t in zip(xs[2:6], (300, 320, 400, 280))] + [(st, 600)]
    seq += [(c, t) for c, t in zip(xs[A8], [90, 80, 110, 50, 150, 70, 80, 120])] + [(st, 800)]
    if h.get('hit'):
        hc = xs[len(old) + 8:]
        seq += [(hc[0], 140), (st, 500), (hc[0], 90), (hc[1], 260), (hc[2], 600), (hc[3], 350), (st, 700)]
    fr = [on_bg(c, 3) for c, _ in seq]
    fr[0].save(f'{OUT}/{h["strip"]}-flow.gif', save_all=True, append_images=fr[1:], duration=[t for _, t in seq], loop=0)
    # 낱칸 판: GIF 에 들어간 칸을 차례대로(걷기는 한 바퀴만) · 뿌리 선·바닥 줄 — 보내기 전에 이것을 본다
    uniq = [seq[0]] + seq[1:9] + seq[17:]
    z, cols = 2, 8
    rows = (len(uniq) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * ACT['cw'] * z, rows * ACT['ch'] * z), (40, 40, 40))
    d = ImageDraw.Draw(sheet)
    for k, (c, _) in enumerate(uniq):
        x0, y0 = (k % cols) * ACT['cw'] * z, (k // cols) * ACT['ch'] * z
        sheet.paste(on_bg(c, z), (x0, y0))
        d.line([(x0 + ACT['root'] * z, y0), (x0 + ACT['root'] * z, y0 + ACT['ch'] * z)], fill=(0, 255, 255), width=1)
        d.line([(x0, y0 + ACT['foot'] * z), (x0 + ACT['cw'] * z, y0 + ACT['foot'] * z)], fill=(0, 200, 200), width=1)
    sheet.save(f'{OUT}/chk-{h["strip"]}-flowframes.png')
    print(f'이어 보기: {OUT}/{h["strip"]}-flow.gif · 낱칸 판(보내기 전에 본다): {OUT}/chk-{h["strip"]}-flowframes.png')
    print(f"params.ts 계획: cells: {20 + len(xs)}, fall: [18, 20, 21, 19], attack cells: [{', '.join(str(a0 + i) for i in range(8))}], xGeom: {{ h: {ACT['ch']}, root: {ACT['root']}, foot: {ACT['foot']} }}")
    if install:
        if not ok:
            raise SystemExit('불합격 — 게임에 넣지 않았다')
        shutil.copyfile(main, f'{GAME}/{h["strip"]}.png')
        shutil.copyfile(extra, f'{GAME}/{h["strip"]}-x.png')
        print('게임에 넣음:', f'{GAME}/{h["strip"]}.png · -x.png  (SPRITE_PX 를 다시 재야 한다: node tools/sprite-kit/headgear.mjs · 계획에 xGeom)')


if __name__ == '__main__':
    a = sys.argv[1:]
    if not a or a[0] not in ('walk', 'strip', 'check', 'attack', 'quirk'):
        raise SystemExit(__doc__)
    if a[0] == 'attack':
        attack(a[1])
    elif a[0] == 'quirk':
        quirk(a[1])
    elif a[0] == 'walk':
        walk(a[1], a[2] if len(a) > 2 else 'walk-a-3')
    elif a[0] == 'strip':
        strip(a[1], 'install' in a[2:])
    else:
        bad = [n for n in ([k for k, v in HEROES.items() if not v.get('pending')] if a[1] == 'all' else [a[1]]) if check(n) is False]   # pending = 줄만 있고 아직 게임에 안 넣은 장수(게임엔 옛 띠) — all 에서 뺀다
        raise SystemExit(1 if bad else 0)
