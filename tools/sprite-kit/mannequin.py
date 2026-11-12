# -*- coding: utf-8 -*-
"""mannequin.py — 걸음 교본대로 관절 각도를 넣어 그리는 색 마네킹 (11-12 형: 「걸음 프레임이 똑바르지 못하면 성의 없어 보인다 · 정확하게 필요한 프레임 똑바로」
· 「우아하고 고고한 캐릭터는 걷기, 활달하고 튼튼한 캐릭터는 달리기」)

견본 그림(CC0 산책)은 보폭이 작고 달리기가 없었다 → 각도를 직접 넣는다. 옆모습 · 오른쪽으로 · 7등신.
앞다리(보는 사람 쪽) 보라 · 뒷다리 파랑 · 앞팔 빨강 · 뒷팔 주황 · 몸통 회색 · 머리 파랑. 발은 늘 땅줄에(달리기 공중 칸만 뜬다).
  걷기 8: 1 닿음(앞다리 앞) 2 내려앉음 3 지나감 4 솟음 5~8 = 다리만 바꿔 되풀이
  달리기 8: 1 디딤 2 눌림 3 박참 4 공중 5~8 = 다리만 바꿔 되풀이
  py -3 -X utf8 tools/sprite-kit/mannequin.py      → tools/sprite-kit/quad/ref-walk4.png · ref-run4.png (1:1 2×2 · 1~4 칸 · 4번 칸 왼쪽)
                                                     · D:/tmp-node/mannequin-walk.gif · mannequin-run.gif (8컷 돌려 보기)"""
import math

from PIL import Image, ImageDraw

GREEN = (0, 255, 0)
NEAR_LEG, FAR_LEG = (138, 63, 176), (60, 95, 176)
NEAR_ARM, FAR_ARM = (200, 50, 50), (225, 140, 50)
TORSO, HEAD = (95, 95, 100), (80, 140, 200)

# 키 7 머리 · 머리 단위 길이
THIGH, SHIN, FOOT = 1.75, 1.6, 0.55
UARM, FARM = 1.3, 1.15
HIP_UP = 3.5          # 땅에서 엉덩이까지 (다리 곧을 때)
SHOULDER_UP = 2.25     # 엉덩이에서 어깨까지
HEAD_D = 0.92

# (넓적다리 각 θ: 앞으로 + · 무릎 굽힘 φ) — 앞다리 기준 8컷 · 뒷다리는 4컷 밀어서
WALK = [(26, 4), (16, 18), (0, 6), (-14, 6), (-22, 12), (-12, 48), (16, 68), (30, 22)]
RUN = [(24, 16), (6, 42), (-26, 10), (-34, 58), (-8, 112), (26, 100), (46, 62), (36, 24)]
GAIT = {
    'walk': dict(legs=WALK, lean=3, arm=22, elbow=(14, 26), hover=[0] * 8),
    'run': dict(legs=RUN, lean=12, arm=38, elbow=(88, 96), hover=[0, 0, 0, 0.22, 0, 0, 0, 0.22]),
}


def rad(d):
    return math.radians(d)


def leg(hip, th, ph, u):
    """엉덩이 → 무릎 → 발목 → 발끝 (화면 좌표 · 아래가 +y)"""
    kx, ky = hip[0] + THIGH * u * math.sin(rad(th)), hip[1] + THIGH * u * math.cos(rad(th))
    sa = th - ph
    ax, ay = kx + SHIN * u * math.sin(rad(sa)), ky + SHIN * u * math.cos(rad(sa))
    # 발은 늘 앞(오른쪽)을 본다 · 정강이에 직각 · 뒤에 남은 다리(넓적다리가 뒤)는 발끝을 아래로 꺾어 발끝으로 선다
    b = rad(sa) - rad(min(45.0, max(0.0, -th * 1.4)))
    tx, ty = ax + FOOT * u * math.cos(b), ay - FOOT * u * math.sin(b)
    return (kx, ky), (ax, ay), (tx, ty)


def pose(gait, i, u):
    g = GAIT[gait]
    near = g['legs'][i % 8]
    far = g['legs'][(i + 4) % 8]
    hip = (0.0, 0.0)
    nl = leg(hip, *near, u)
    fl = leg(hip, *far, u)
    low = max(nl[1][1], nl[2][1], fl[1][1], fl[2][1])  # 가장 낮은 발이 땅
    lean = rad(g['lean'])
    sh = (hip[0] + SHOULDER_UP * u * math.sin(lean), hip[1] - SHOULDER_UP * u * math.cos(lean))
    head = (sh[0] + 0.25 * u * math.sin(lean), sh[1] - (0.2 + HEAD_D / 2) * u)
    # 팔: 앞팔은 앞다리와 반대로 흔든다
    sw = -g['arm'] * math.cos(2 * math.pi * i / 8)
    arms = []
    for k, s in ((0, sw), (1, -sw)):
        e = g['elbow'][0] + (g['elbow'][1] - g['elbow'][0]) * (0.5 + 0.5 * math.sin(2 * math.pi * i / 8 + k * math.pi))
        ex, ey = sh[0] + UARM * u * math.sin(rad(s)), sh[1] + UARM * u * math.cos(rad(s))
        fa = s + e
        hx, hy = ex + FARM * u * math.sin(rad(fa)), ey + FARM * u * math.cos(rad(fa))
        arms.append(((ex, ey), (hx, hy)))
    return dict(hip=hip, near=nl, far=fl, sh=sh, head=head, arms=arms, low=low, hover=g['hover'][i % 8] * u)


def draw(gait, i, W, H, figh, x_center, ground):
    u = figh / 7.0
    p = pose(gait, i, u)
    oy = ground - p['low'] - p['hover']
    ox = x_center
    T = lambda pt: (ox + pt[0], oy + pt[1])
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    def limb(pts, col, w):
        pts = [T(q) for q in pts]
        d.line(pts, fill=col, width=int(w), joint='curve')
        for q in pts:
            r = w / 2
            d.ellipse((q[0] - r, q[1] - r, q[0] + r, q[1] + r), fill=col)
    # 뒤 → 앞 차례
    limb([p['sh'], *p['arms'][1]], FAR_ARM, 0.2 * u)
    limb([p['hip'], *p['far']], FAR_LEG, 0.3 * u)
    tw = 0.7 * u
    hx, hy = T(p['hip'])
    sx, sy = T(p['sh'])
    d.polygon([(hx - tw * 0.45, hy), (hx + tw * 0.45, hy), (sx + tw * 0.5, sy), (sx - tw * 0.5, sy)], fill=TORSO)
    hc = T(p['head'])
    r = HEAD_D * u / 2
    d.ellipse((hc[0] - r * 0.85, hc[1] - r, hc[0] + r * 0.85, hc[1] + r), fill=HEAD)
    limb([p['hip'], *p['near']], NEAR_LEG, 0.32 * u)
    limb([p['sh'], *p['arms'][0]], NEAR_ARM, 0.2 * u)
    return img


def sheet(gait, out):
    W = H = 1024
    CW = CH = 512
    s = Image.new('RGBA', (W, H), GREEN + (255,))
    for j in range(4):
        r, c = divmod(j, 2)
        x = c * CW + (CW * 0.36 if j == 3 else CW * 0.5)  # 4번 칸은 왼쪽 (우하단 귀 = 워터마크 자리)
        fig = draw(gait, j, CW, CH, CH * 0.78, x - c * CW, CH * 0.94)
        s.alpha_composite(fig, (c * CW, r * CH))
    s.convert('RGB').save(out)


def gif(gait, out):
    fr = []
    for i in range(8):
        f = Image.new('RGBA', (300, 300), (60, 70, 55, 255))
        f.alpha_composite(draw(gait, i, 300, 300, 240, 150, 285))
        fr.append(f.convert('RGB'))
    fr[0].save(out, save_all=True, append_images=fr[1:], duration=110 if gait == 'run' else 140, loop=0)


if __name__ == '__main__':
    for g in ('walk', 'run'):
        sheet(g, f'tools/sprite-kit/quad/ref-{g}4.png')
        gif(g, f'D:/tmp-node/mannequin-{g}.gif')
        strip = Image.new('RGB', (8 * 200, 260), (60, 70, 55))
        for i in range(8):
            strip.paste(draw(g, i, 200, 260, 220, 100, 250), (i * 200, 0), draw(g, i, 200, 260, 220, 100, 250))
        strip.save(f'D:/tmp-node/mannequin-{g}-strip.png')
    print('ok')
