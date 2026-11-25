# -*- coding: utf-8 -*-
"""영웅 대시 자세 한 칸 안내 인형 + 묶음 장면 (11-25 · A2 카드 · 형 「대시하는 자세만 한 장씩 한번에 뽑기」).
pose-rig.py 를 고치지 않고 불러다 쓴다(다른 일꾼이 고치는 중 — 기존 인형 출력은 그대로).
  py -3 -X utf8 -I tools/sprite-kit/dash-rig.py grid <열쇠:무기,열쇠:무기,...> <열> <나갈.png>
    칸마다 [그 장수의 서기 칸(본 띠 칸 0) | 대시 인형] 을 한 칸으로 · 칸 사이 굵은 경계 + 번호 · 자홍 바탕
  py -3 -X utf8 -I tools/sprite-kit/dash-rig.py one <무기> <나갈.png>   인형 한 칸만(검사용)
무기 = bow · pole2(창·작살·노·도끼·망치) · dagger · sword · staff · whip · none
대시 = 뛰어드는 자세: 두 발이 땅에서 떨어진 공중 · 앞다리 무릎 높이 굽힘 · 뒷다리 뒤로 · 윗몸 앞으로 크게 숙임 · 무기는 몸 줄과 나란히."""
import importlib.util, json, sys
from PIL import Image, ImageChops, ImageDraw

ROOT = 'D:/flutter/arrow_game_one/'
spec = importlib.util.spec_from_file_location('pr', ROOT + 'tools/sprite-kit/pose-rig.py')
pr = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pr)

# 11-25 저녁 형 「대시는 앞발을 딛는 자세가 아니라 드래곤볼 날아가는 자세 — 앞다리가 더 들리고 무릎이 더 굽혀져 뛰어드는 듯」
# = 뛰어드는 자세: 두 발이 다 땅에서 떨어진 공중 · 앞다리(가까운 쪽)는 무릎을 높이 들어 깊게 굽힘 · 뒷다리는 뒤로 길게 · 윗몸은 앞으로 크게 숙여 머리가 가장 앞
BASE = dict(pelvis=(8, 30), bend=58, lean=6, near_foot=(14, 58, 20), far_foot=(-38, 54, -30))


def pose(kind):
    b = dict(BASE)
    # 무기는 몸 줄(어깨 -> 머리 방향)과 나란히: 칸 폭을 덜 먹는다
    if kind == 'pole2':      # 두 손 긴 자루를 몸 아래에 나란히 낮게 앞으로 겨눔
        h = dict(near_hand=(16, 86), far_hand=(44, 94))
    elif kind == 'bow':      # 활은 먼 손에 쥐고 몸 아래로 붙임
        h = dict(near_hand=(-4, 90), far_hand=(40, 92))
    elif kind in ('sword', 'dagger'):   # 날을 뒤로 눕힌 채
        h = dict(near_hand=(-2, 88), far_hand=(40, 94))
    elif kind == 'staff':
        h = dict(near_hand=(22, 88), far_hand=(-4, 84))
    elif kind == 'whip':
        h = dict(near_hand=(0, 88), far_hand=(40, 94))
    else:
        h = dict(near_hand=(-2, 88), far_hand=(40, 94))
    return pr._ik(b['pelvis'], h['near_hand'], h['far_hand'], bend=b['bend'], lean=b['lean'], near_foot=b['near_foot'], far_foot=b['far_foot'])


def rig(kind):
    pr.big_canvas()
    pr.PROP['kind'] = {'dagger': 'sword', 'none': None}.get(kind, kind)
    pr.BLADE['len'] = 24 if kind == 'dagger' else pr.BLADE['len']
    ps = pose(kind)
    if kind in ('sword', 'dagger'):
        ps['blade'] = -165
    if kind == 'staff':
        ps['blade'] = 10
    if kind == 'whip':
        ps['whip'] = [(200, 26), (215, 26), (230, 26)]
    return pr.figure(None, True, ps)


def stand(key):
    im = Image.open(ROOT + f'public/realm/anim-px/gen-{key}.png').convert('RGBA')
    m = json.load(open(ROOT + 'public/realm/anim-px/manifest.json'))[f'gen-{key}']
    cw, ch = m['cell']
    c = im.crop((0, 0, cw, ch))
    return c.resize((cw * 2, ch * 2), Image.NEAREST)


def grid(items, cols, out):
    rows = (len(items) + cols - 1) // cols
    W, H = 1920, 1280
    cw, chh = W // cols, H // rows
    o = Image.new('RGB', (W, H), (255, 0, 255))
    d = ImageDraw.Draw(o)
    recs = []
    for i, (key, kind) in enumerate(items):
        x0, y0 = (i % cols) * cw, (i // cols) * chh
        s = stand(key)                      # 게임 화소 2배
        s = s.crop(s.getchannel('A').getbbox())
        r = rig(kind)                       # 게임 화소 4배 -> 같은 배율(2배)로 줄여 키를 맞춘다
        r = r.resize((r.size[0] // 2, r.size[1] // 2), Image.LANCZOS)
        bb = ImageChops.difference(r.convert('RGB'), Image.new('RGB', r.size, (255, 0, 255))).getbbox()
        r = r.crop(bb)
        f = min((chh - 40) / max(s.size[1], r.size[1]), (cw / 2 - 12) / max(s.size[0], r.size[0]))
        s2 = s.resize((round(s.size[0] * f), round(s.size[1] * f)), Image.LANCZOS)
        r2 = r.resize((round(r.size[0] * f), round(r.size[1] * f)), Image.LANCZOS)
        base = y0 + chh - 14
        o.paste(s2, (x0 + 6 + (cw // 2 - 12 - s2.size[0]) // 2, base - s2.size[1]), s2)
        o.paste(r2, (x0 + cw // 2 + 6 + (cw // 2 - 12 - r2.size[0]) // 2, base - r2.size[1]))
        d.rectangle([x0, y0, x0 + cw - 1, y0 + chh - 1], outline=(0, 0, 0), width=6)
        d.text((x0 + 14, y0 + 10), str(i + 1), fill=(0, 0, 0))
        recs.append(dict(n=i + 1, key=key, kind=kind, x=x0, y=y0, w=cw, h=chh, scale=round(f, 3)))
    json.dump(dict(kind='dash-grid', cols=cols, cells=recs), open(out.replace('.png', '.roots.json'), 'w'), ensure_ascii=False)
    o.save(out)
    print(out, o.size, len(items))


if __name__ == '__main__':
    if sys.argv[1] == 'one':
        rig(sys.argv[2]).save(sys.argv[3])
    elif sys.argv[1] == 'grid':
        grid([tuple(t.split(':')) for t in sys.argv[2].split(',')], int(sys.argv[3]), sys.argv[4])
