# -*- coding: utf-8 -*-
"""걷기 뼈대를 코드로 그린다 (11-23 형 「걷기는 마네킹에서부터 잘못된 것 아닌지 확인해 봐 · 오른쪽 다리로만 걷고 있다」).
그림 도구가 그린 대머리 걷기 판 B 는 A 와 같은 그림에 다리 색만 바꿔 칠한 것이었다(앞으로 나간 다리가 늘 몸 앞쪽 다리).
→ 관절 각도로 인형을 직접 그린다. 어느 다리가 앞인지 · 어느 팔다리가 몸 뒤에 가려지는지를 코드가 정한다.
  가까운 쪽 팔다리 = 밝은 회색 · 몸통 위에 그린다 / 먼 쪽 팔다리 = 파랑 · 몸통 뒤에 그린다.
  한 바퀴 여덟 칸: 가까운 다리가 [지나감 → 뻗음 → 딛음 → 내려앉음] · 먼 다리가 같은 넷.
판 규격은 옛 자세 판과 같다(2×2 · 자홍 바탕): A = 칸1 딛음 · 칸2 내려앉음 · 칸3 지나감 · 칸4 뻗음 (가까운 다리) / B = 같은 넷 (먼 다리).
  py -3 -I tools/sprite-kit/pose-rig.py   → D:/에셋창고/STD/rig-f-walk-a.png · rig-f-walk-b.png · rig-f-walk8.png(한 줄 미리 보기)
"""
import math
from PIL import Image, ImageDraw

STD = 'D:/에셋창고/STD'
Z = 4                    # 게임 화소의 배
CELL = 627               # 옛 자세 판의 칸 크기(1254 ÷ 2)
# 길이(게임 화소 · 키 137 · 머리뼈 32 = kit 표준 여자)
HEAD_R, NECK, TORSO, THIGH, SHIN, FOOT_H, FOOT_L = 15.5, 5, 46, 23, 23, 5, 11
UPPER, FORE, HAND = 19, 17, 5
NEAR, FAR, BODY, LINE = (205, 205, 205), (70, 120, 235), (165, 165, 165), (60, 60, 60)

# 한 걸음 반(다리 하나가 앞으로 나가는 넷): (흔드는 다리 넓적다리 · 정강이, 딛고 선 다리 넓적다리 · 정강이, 골반 내려앉음)
# 각도는 곧게 선 것에서 앞(오른쪽)으로 기운 도 · 정강이는 땅에 대한 각
HALF = {
    'pass':    dict(sw=(26, -52), st=(0, 0), drop=0, sw_toe=-30, st_toe=0),      # 지나감: 선 다리는 곧게 · 흔드는 다리는 무릎을 굽혀 몸 아래를 지난다
    'reach':   dict(sw=(38, 8), st=(-16, -24), drop=1.5, sw_toe=16, st_toe=-20),  # 뻗음: 흔드는 다리가 앞으로 · 선 다리는 뒤꿈치가 들린다
    'contact': dict(sw=(28, 20), st=(-24, -40), drop=3, sw_toe=14, st_toe=-32),   # 딛음: 앞발 뒤꿈치가 닿고 뒷발은 발끝으로
    'down':    dict(sw=(20, 4), st=(-26, -58), drop=4, sw_toe=0, st_toe=-40),     # 내려앉음: 앞다리에 무게 · 뒷발이 떨어진다
}


# 걸음 결 (11-23 형 「하나의 가이드 이미지만 가지고 만들면 모든 캐릭터가 다 똑같아지니까 독창성 0」) — 같은 뼈대에 숫자만 달리한다
#   stride 보폭 배 · lift 지나갈 때 무릎 들림 배 · arm 팔 흔듦 배 · lean 앞으로 기운 px · bob 내려앉음 배 · elbow 팔꿈치 굽힘 도 · hip 골반 흔듦 px
STYLES = {
    'plain':  dict(label='보통',       stride=1.0,  lift=1.0, arm=1.0, lean=3,  bob=1.0, elbow=22, hip=0),
    'proud':  dict(label='당당한',     stride=1.25, lift=1.1, arm=1.5, lean=1,  bob=.8,  elbow=12, hip=0),     # 큰 보폭 · 팔을 크게 · 가슴을 편다 (장수 · 여왕)
    'sway':   dict(label='사뿐한',     stride=.8,   lift=.7,  arm=.6,  lean=2,  bob=.6,  elbow=40, hip=3),     # 좁은 보폭 · 골반이 흔들리고 손을 살짝 든다 (무희 · 요염한)
    'heavy':  dict(label='육중한',     stride=.9,   lift=.6,  arm=.8,  lean=6,  bob=1.6, elbow=30, hip=0),     # 무겁게 내려앉는다 (우람한 · 육중한)
    'prowl':  dict(label='살금살금',   stride=1.1,  lift=1.4, arm=.5,  lean=10, bob=1.3, elbow=70, hip=0),     # 몸을 숙이고 무릎을 높이 (자객 · 사냥꾼 · 범)
    'bouncy': dict(label='통통 튀는',  stride=.95,  lift=1.5, arm=1.3, lean=2,  bob=.4,  elbow=55, hip=1),     # 발랄하게 (앳된 · 쾌활한)
}
STYLE = dict(STYLES['plain'])


def pt(x, y, ang, ln):
    r = math.radians(ang)
    return x + math.sin(r) * ln, y + math.cos(r) * ln


def limb(d, a, b, w, fill):
    d.line([a, b], fill=LINE, width=int(w * Z) + 6)
    for p in (a, b):
        d.ellipse([p[0] - w * Z / 2 - 3, p[1] - w * Z / 2 - 3, p[0] + w * Z / 2 + 3, p[1] + w * Z / 2 + 3], fill=LINE)
    d.line([a, b], fill=fill, width=int(w * Z))
    for p in (a, b):
        d.ellipse([p[0] - w * Z / 2, p[1] - w * Z / 2, p[0] + w * Z / 2, p[1] + w * Z / 2], fill=fill)


def leg(d, hip, thigh_a, shin_a, toe_a, fill, draw=True):
    knee = pt(hip[0], hip[1], thigh_a, THIGH * Z)
    ankle = pt(knee[0], knee[1], shin_a, SHIN * Z)
    r = math.radians(toe_a)
    toe = (ankle[0] + math.cos(r) * FOOT_L * Z, ankle[1] + FOOT_H * Z * .5 - math.sin(r) * FOOT_L * Z)
    heel = (ankle[0] - math.cos(r) * 3 * Z, ankle[1] + FOOT_H * Z * .5 + math.sin(r) * 3 * Z)
    if draw:
        limb(d, hip, knee, 11.5, fill)
        limb(d, knee, ankle, 8.5, fill)
        limb(d, heel, toe, FOOT_H, fill)
    return max(toe[1], heel[1]) + FOOT_H * Z / 2 + 3


def arm(d, sh, up_a, fore_a, fill):
    el = pt(sh[0], sh[1], up_a, UPPER * Z)
    wr = pt(el[0], el[1], fore_a, FORE * Z)
    limb(d, sh, el, 6.5, fill)
    limb(d, el, wr, 5.5, fill)
    d.ellipse([wr[0] - HAND * Z, wr[1] - HAND * Z, wr[0] + HAND * Z, wr[1] + HAND * Z], fill=fill, outline=LINE, width=3)


def figure(phase, swing_near):
    """한 칸. swing_near = 지금 앞으로 나가는(흔드는) 다리가 가까운 쪽인가"""
    P0 = HALF[phase]; S = STYLE
    P = dict(sw=(P0['sw'][0] * S['stride'], P0['sw'][1] * (S['lift'] if phase == 'pass' else S['stride'])), st=(P0['st'][0] * S['stride'], P0['st'][1] * S['stride']),
             drop=P0['drop'] * S['bob'], sw_toe=P0['sw_toe'], st_toe=P0['st_toe'])
    im = Image.new('RGB', (CELL, CELL), (255, 0, 255))
    d = ImageDraw.Draw(im)
    cx = CELL / 2
    near = dict(th=P['sw'][0], sh=P['sw'][1], toe=P['sw_toe']) if swing_near else dict(th=P['st'][0], sh=P['st'][1], toe=P['st_toe'])
    far = dict(th=P['st'][0], sh=P['st'][1], toe=P['st_toe']) if swing_near else dict(th=P['sw'][0], sh=P['sw'][1], toe=P['sw_toe'])
    # 골반 높이: 두 발 가운데 더 낮은 쪽이 땅(칸 바닥 위 50px)에 닿게
    hip_y = 0.0
    low = max(leg(d, (cx, hip_y), near['th'], near['sh'], near['toe'], NEAR, False), leg(d, (cx, hip_y), far['th'], far['sh'], far['toe'], FAR, False))
    hip_y = (CELL - 50) - low + (P['drop'] - P0['drop']) * Z
    cx += S['hip'] * Z * (1 if swing_near else -1) * (1 if phase in ('contact', 'down') else -.5)   # 골반 흔듦
    hip_n, hip_f = (cx - 2 * Z, hip_y + 1 * Z), (cx + 3 * Z, hip_y - 1 * Z)       # 3/4 각도: 먼 쪽 골반·어깨가 조금 앞·위
    sh_y = hip_y - TORSO * Z
    lean = S['lean'] * Z                                                        # 걷는 몸은 앞으로 기운다(결마다 다르게)
    sh_n, sh_f = (cx - 3 * Z + lean, sh_y + 1 * Z), (cx + 5 * Z + lean, sh_y - 1 * Z)
    # 팔은 같은 쪽 다리와 반대로
    arm_n = (-near['th'] * .9 * S['arm'], -near['th'] * .9 * S['arm'] + S['elbow'])
    arm_f = (-far['th'] * .9 * S['arm'], -far['th'] * .9 * S['arm'] + S['elbow'])
    # 먼 쪽부터: 먼 팔 · 먼 다리 → 몸통 · 머리 → 가까운 다리 · 가까운 팔
    arm(d, sh_f, arm_f[0], arm_f[1], FAR)
    leg(d, hip_f, far['th'], far['sh'], far['toe'], FAR)
    d.polygon([(sh_n[0] - 9 * Z, sh_y), (sh_f[0] + 6 * Z, sh_y - 2 * Z), (hip_f[0] + 8 * Z, hip_y + 5 * Z), (hip_n[0] - 9 * Z, hip_y + 6 * Z)], fill=BODY, outline=LINE)
    d.ellipse([cx - 10 * Z, hip_y - 6 * Z, cx + 11 * Z, hip_y + 12 * Z], fill=BODY, outline=LINE, width=4)            # 골반
    d.ellipse([cx + lean - 1 * Z, sh_y - 2 * Z, cx + lean + 13 * Z, sh_y + 14 * Z], fill=(150, 150, 150), outline=LINE, width=3)   # 가슴(앞을 알린다)
    neck_x = cx + lean + 1 * Z
    d.rectangle([neck_x - 3.5 * Z, sh_y - NECK * Z - 4, neck_x + 3.5 * Z, sh_y + 4], fill=BODY, outline=LINE, width=3)
    hc = (neck_x + 2 * Z, sh_y - NECK * Z - HEAD_R * Z + 2 * Z)
    d.ellipse([hc[0] - HEAD_R * Z, hc[1] - HEAD_R * Z, hc[0] + HEAD_R * Z, hc[1] + HEAD_R * Z], fill=NEAR, outline=LINE, width=4)
    d.ellipse([hc[0] + 7 * Z, hc[1] - 2 * Z, hc[0] + 10 * Z, hc[1] + 2 * Z], fill=LINE)                                 # 눈(오른쪽을 본다)
    d.polygon([(hc[0] + HEAD_R * Z - 2, hc[1] + 1 * Z), (hc[0] + HEAD_R * Z + 3 * Z, hc[1] + 4 * Z), (hc[0] + HEAD_R * Z - 2, hc[1] + 6 * Z)], fill=NEAR, outline=LINE)   # 코
    leg(d, hip_n, near['th'], near['sh'], near['toe'], NEAR)
    arm(d, sh_n, arm_n[0], arm_n[1], NEAR)
    return im


def sheet(swing_near):
    o = Image.new('RGB', (CELL * 2, CELL * 2), (255, 0, 255))
    for k, ph in enumerate(('contact', 'down', 'pass', 'reach')):
        o.paste(figure(ph, swing_near), ((k % 2) * CELL, (k // 2) * CELL))
    return o


def main():
    import sys
    order = [(True, 'pass'), (True, 'reach'), (True, 'contact'), (True, 'down'), (False, 'pass'), (False, 'reach'), (False, 'contact'), (False, 'down')]
    if len(sys.argv) > 1 and sys.argv[1] == 'styles':   # 걸음 결마다 판 둘 + 한눈에 보는 표
        rows = []
        for key, st in STYLES.items():
            STYLE.clear(); STYLE.update(st)
            sheet(True).save(f'{STD}/rig-f-walk-{key}-a.png'); sheet(False).save(f'{STD}/rig-f-walk-{key}-b.png')
            fr = [figure(ph, sn) for sn, ph in order]
            small = [f.resize((CELL // 2, CELL // 2), Image.LANCZOS) for f in fr]
            small[0].save(f'tools/out/lineup/rig-walk-{key}.gif', save_all=True, append_images=small[1:], duration=110, loop=0)
            row = Image.new('RGB', ((CELL // 3) * 8, CELL // 3), (255, 0, 255))
            for i, f in enumerate(fr): row.paste(f.resize((CELL // 3, CELL // 3), Image.LANCZOS), (i * (CELL // 3), 0))
            rows.append(row)
        o = Image.new('RGB', (rows[0].size[0], rows[0].size[1] * len(rows)), (255, 0, 255))
        for i, r in enumerate(rows): o.paste(r, (0, i * r.size[1]))
        o.save('tools/out/lineup/rig-walk-styles.png'); print('styles', list(STYLES)); return
    a, b = sheet(True), sheet(False)
    a.save(f'{STD}/rig-f-walk-a.png')
    b.save(f'{STD}/rig-f-walk-b.png')
    frames = [figure(ph, sn) for sn, ph in order]
    row = Image.new('RGB', (CELL * 8, CELL), (255, 0, 255))
    for i, f in enumerate(frames):
        row.paste(f, (i * CELL, 0))
    row.save(f'{STD}/rig-f-walk8.png')
    small = [f.resize((CELL // 2, CELL // 2), Image.LANCZOS) for f in frames]
    small[0].save('tools/out/lineup/rig-walk.gif', save_all=True, append_images=small[1:], duration=110, loop=0)
    print('ok')


if __name__ == '__main__':
    main()
