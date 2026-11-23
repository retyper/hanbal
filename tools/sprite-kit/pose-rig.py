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
    # 11-23 밤: 보폭을 넓혔다. 옛 승인 띠(소서노·감실)는 발 벌림이 가장 넓을 때 82~86px 인데 새 걷기는 62~64px 로 얌전했다.
    #   딛는 칸은 다리가 벌어져 몸이 4~5px 낮아지고 지나가는 칸은 가장 높다(걸음의 오르내림 · 새 걷기는 0.6~1.1px 뿐이었다).
    'pass':    dict(sw=(26, -52), st=(0, 0), drop=0, sw_toe=-30, st_toe=0),      # 지나감: 선 다리는 곧게 · 흔드는 다리는 무릎을 굽혀 몸 아래를 지난다 (몸이 가장 높다)
    'reach':   dict(sw=(44, 6), st=(-20, -28), drop=1.5, sw_toe=16, st_toe=-22),   # 뻗음: 흔드는 다리가 앞으로 · 선 다리는 뒤꿈치가 들린다
    'contact': dict(sw=(35, 24), st=(-31, -48), drop=3, sw_toe=14, st_toe=-34),   # 딛음: 앞발 뒤꿈치가 닿고 뒷발은 발끝으로 (몸이 낮다)
    'down':    dict(sw=(25, 8), st=(-31, -64), drop=4, sw_toe=0, st_toe=-42),     # 내려앉음: 앞다리에 무게 · 뒷발이 떨어진다 (몸이 가장 낮다)
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
# 몸매: 인형이 납작하면 그림 도구가 그 납작함까지 따라 그린다 -> 가슴·엉덩이를 장수 표(hero-types.tsv 의 bust)대로 인형에 그려 준다
BUST = {'S': 5, 'M': 7.5, 'L': 10.5, 'XL': 13.5}
SHAPE = dict(bust='M')


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
    return wr


# 소품 (11-23 형 「매화 활을 제대로 잡고 있지도 않은데」): 빈손 자세에 활을 얹게 하면 제대로 못 쥔다 -> 인형이 활을 쥐고 있다.
#   활은 먼 쪽 손(활 잡는 손)에 세로로 서고, 시위는 양 끝을 잇거나 당기는 손(가까운 쪽)까지 온다.
PROP = dict(kind=None)
WOOD, STRING = (150, 105, 60), (240, 240, 240)


def wrist(sh, up_a, fore_a):
    el = pt(sh[0], sh[1], up_a, UPPER * Z)
    return pt(el[0], el[1], fore_a, FORE * Z)


def bow_points(hand):
    L = 30 * Z
    top, bot = (hand[0] - 4 * Z, hand[1] - L), (hand[0] - 4 * Z, hand[1] + L)
    return top, bot, [top, (hand[0] + 3 * Z, hand[1] - L * .5), (hand[0] + 5 * Z, hand[1]), (hand[0] + 3 * Z, hand[1] + L * .5), bot]


def bow_stick(d, hand):
    top, bot, pts = bow_points(hand)
    d.line(pts, fill=LINE, width=int(3.2 * Z) + 6, joint='curve')
    d.line(pts, fill=WOOD, width=int(3.2 * Z), joint='curve')


def bow_string(d, hand, pull=None):
    top, bot, _ = bow_points(hand)
    d.line([top, pull, bot] if pull else [top, bot], fill=LINE, width=7)
    d.line([top, pull, bot] if pull else [top, bot], fill=STRING, width=3)


def figure(phase, swing_near, pose=None):
    """한 칸. swing_near = 지금 앞으로 나가는(흔드는) 다리가 가까운 쪽인가"""
    P0 = HALF[phase or 'pass']; S = STYLE
    P = dict(sw=(P0['sw'][0] * S['stride'], P0['sw'][1] * (S['lift'] if phase == 'pass' else S['stride'])), st=(P0['st'][0] * S['stride'], P0['st'][1] * S['stride']),
             drop=P0['drop'] * S['bob'], sw_toe=P0['sw_toe'], st_toe=P0['st_toe'])
    im = Image.new('RGB', (CELL, CELL), (255, 0, 255))
    d = ImageDraw.Draw(im)
    cx = CELL / 2
    near = dict(th=P['sw'][0], sh=P['sw'][1], toe=P['sw_toe']) if swing_near else dict(th=P['st'][0], sh=P['st'][1], toe=P['st_toe'])
    far = dict(th=P['st'][0], sh=P['st'][1], toe=P['st_toe']) if swing_near else dict(th=P['sw'][0], sh=P['sw'][1], toe=P['sw_toe'])
    if pose is not None:   # 걷기가 아닌 자세(활 쏘기 등): 다리·팔 각도를 그대로 받는다
        near, far = dict(pose['near_leg']), dict(pose['far_leg'])
    # 골반 높이: 두 발 가운데 더 낮은 쪽이 땅(칸 바닥 위 50px)에 닿게
    hip_y = 0.0
    low = max(leg(d, (cx, hip_y), near['th'], near['sh'], near['toe'], NEAR, False), leg(d, (cx, hip_y), far['th'], far['sh'], far['toe'], FAR, False))
    hip_y = (CELL - 50) - low + ((P['drop'] - P0['drop']) * Z if pose is None else 0)
    if pose is None:
        cx += S['hip'] * Z * (1 if swing_near else -1) * (1 if phase in ('contact', 'down') else -.5)   # 골반 흔듦
    hip_n, hip_f = (cx - 2 * Z, hip_y + 1 * Z), (cx + 3 * Z, hip_y - 1 * Z)       # 3/4 각도: 먼 쪽 골반·어깨가 조금 앞·위
    sh_y = hip_y - TORSO * Z
    lean = (S['lean'] if pose is None else pose.get('lean', 0)) * Z             # 걷는 몸은 앞으로 기운다(결마다 다르게)
    sh_n, sh_f = (cx - 3 * Z + lean, sh_y + 1 * Z), (cx + 5 * Z + lean, sh_y - 1 * Z)
    # 팔은 같은 쪽 다리와 반대로
    # 팔 흔듦 (11-23 형 「어깨가 일부 컷에서 삐걱거림 · 팔도 제대로」): 예전에는 팔을 같은 쪽 넓적다리 각도에 묶어, 여덟 칸 가운데 한 칸에서
    #   팔이 맨 앞(+23도)에서 맨 뒤(-23도)로 튀었다. → 한 바퀴에 한 번 고르게 오가는 물결로: 같은 쪽 다리가 가장 앞(딛음)일 때 팔은 가장 뒤.
    kk = ('pass', 'reach', 'contact', 'down').index(phase or 'pass') + (0 if swing_near else 4)
    sw = math.cos(2 * math.pi * (kk - 2) / 8)          # +1 = 가까운 다리가 가장 앞
    A = 26 * S['arm']
    an, af = -A * sw, A * sw
    arm_n = (an, an + S['elbow'] + 16 * max(0.0, an / max(A, 1)))   # 앞으로 나갈수록 팔꿈치가 더 굽는다
    arm_f = (af, af + S['elbow'] + 16 * max(0.0, af / max(A, 1)))
    if pose is None:   # 어깨는 팔을 따라 아주 조금 돈다(가까운 팔이 앞이면 가까운 어깨도 앞으로 1.5px)
        tw = -1.5 * Z * sw
        sh_n, sh_f = (sh_n[0] + tw, sh_n[1]), (sh_f[0] - tw, sh_f[1])
    if pose is not None:
        arm_n, arm_f = pose['near_arm'], pose['far_arm']
    elif PROP['kind'] == 'bow':
        arm_f = (22, 58)   # 활 든 팔은 걸을 때 흔들지 않는다 — 활이 늘 몸 앞에 보이게(뒤로 가면 몸에 가려 칸마다 생겼다 사라진다)
    # 먼 쪽부터: (활대) · 먼 팔 · 먼 다리 → 몸통 · 머리 → 가까운 다리 · 가까운 팔 → (시위)
    hand_f = wrist(sh_f, arm_f[0], arm_f[1])
    pulled = pose is not None and bool(pose.get('pull'))
    if PROP['kind'] == 'bow':
        bow_stick(d, hand_f)
        if not pulled:
            bow_string(d, hand_f)   # 당기지 않은 시위는 활과 함께 몸 뒤에
    arm(d, sh_f, arm_f[0], arm_f[1], FAR)
    leg(d, hip_f, far['th'], far['sh'], far['toe'], FAR)
    d.polygon([(sh_n[0] - 9 * Z, sh_y), (sh_f[0] + 6 * Z, sh_y - 2 * Z), (hip_f[0] + 8 * Z, hip_y + 5 * Z), (hip_n[0] - 9 * Z, hip_y + 6 * Z)], fill=BODY, outline=LINE)
    d.ellipse([cx - 10 * Z, hip_y - 10 * Z, cx + 11 * Z, hip_y + 6 * Z], fill=BODY, outline=LINE, width=4)            # 골반 (11-23 형 「허리가 길어 보인다」: 골반 덩어리가 엉덩관절 아래 12 까지 내려가 가랑이가 낮게 읽혔다 → 6 까지만)
    d.ellipse([cx - 13 * Z, hip_y - 11 * Z, cx + 6 * Z, hip_y + 7 * Z], fill=BODY, outline=LINE, width=4)   # 엉덩이(뒤로 둥글게)
    b = BUST[SHAPE['bust']] * Z   # 가슴: 몸통 앞으로 도드라진다 (먼 쪽 먼저 · 가까운 쪽이 덮는다)
    bx, by = cx + lean + 5 * Z, sh_y + 13 * Z
    d.ellipse([bx + 3 * Z - b * .9, by - 1 * Z - b * .9, bx + 3 * Z + b * .9, by - 1 * Z + b * .9], fill=(150, 150, 150), outline=LINE, width=3)
    d.ellipse([bx - b, by - b, bx + b, by + b], fill=(185, 185, 185), outline=LINE, width=3)
    neck_x = cx + lean + 1 * Z
    d.rectangle([neck_x - 3.5 * Z, sh_y - NECK * Z - 4, neck_x + 3.5 * Z, sh_y + 4], fill=BODY, outline=LINE, width=3)
    hc = (neck_x + 2 * Z, sh_y - NECK * Z - HEAD_R * Z + 2 * Z)
    d.ellipse([hc[0] - HEAD_R * Z, hc[1] - HEAD_R * Z, hc[0] + HEAD_R * Z, hc[1] + HEAD_R * Z], fill=NEAR, outline=LINE, width=4)
    d.ellipse([hc[0] + 7 * Z, hc[1] - 2 * Z, hc[0] + 10 * Z, hc[1] + 2 * Z], fill=LINE)                                 # 눈(오른쪽을 본다)
    d.polygon([(hc[0] + HEAD_R * Z - 2, hc[1] + 1 * Z), (hc[0] + HEAD_R * Z + 3 * Z, hc[1] + 4 * Z), (hc[0] + HEAD_R * Z - 2, hc[1] + 6 * Z)], fill=NEAR, outline=LINE)   # 코
    leg(d, hip_n, near['th'], near['sh'], near['toe'], NEAR)
    hand_n = arm(d, sh_n, arm_n[0], arm_n[1], NEAR)
    if PROP['kind'] == 'bow' and pulled:
        bow_string(d, hand_f, hand_n)   # 당긴 시위만 몸 앞으로 지나간다
    return im


def sheet(swing_near):
    o = Image.new('RGB', (CELL * 2, CELL * 2), (255, 0, 255))
    for k, ph in enumerate(('contact', 'down', 'pass', 'reach')):
        o.paste(figure(ph, swing_near), ((k % 2) * CELL, (k // 2) * CELL))
    return o


# 활 쏘기 네 칸: 메김 -> 당김 -> 놓음 -> 내림. 다리는 선 채(먼 쪽 발이 앞), 활은 먼 쪽 손, 시위는 가까운 쪽 손.
BOW_STANCE = dict(near_leg=dict(th=-14, sh=-14, toe=0), far_leg=dict(th=14, sh=4, toe=0))
BOW_POSES = [
    dict(near_arm=(25, 75), far_arm=(45, 62), lean=1),                 # 1 화살을 메겨 활을 비스듬히 내려 듦
    dict(near_arm=(-150, 60), far_arm=(90, 90), lean=-1, pull=True),   # 2 활을 들어 시위를 뺨까지 당김(팔꿈치는 어깨 뒤 위로)
    dict(near_arm=(-120, -100), far_arm=(90, 90), lean=0),             # 3 놓음: 당기던 손이 뒤로 펴짐
    dict(near_arm=(-8, 22), far_arm=(34, 48), lean=1),                 # 4 활을 내림
]


def bow_sheet():
    o = Image.new('RGB', (CELL * 2, CELL * 2), (255, 0, 255))
    for k, ps in enumerate(BOW_POSES):
        o.paste(figure(None, True, dict(BOW_STANCE, **ps)), ((k % 2) * CELL, (k // 2) * CELL))
    return o


# 개성 동작(서기 가끔) — 발은 네 칸 같은 자리. 그림 도구가 그린 자세 판은 머리가 작아지고(5등신) 손이 바뀌었다(11-23) -> 인형으로.
STAND = dict(near_leg=dict(th=-6, sh=-6, toe=0), far_leg=dict(th=7, sh=7, toe=0))
QUIRKS = {
    # 범 「손톱 살피기」: 가까운 쪽 손을 얼굴 앞으로 들어 봄 -> 입가로 가져가 훅 붊 -> 손을 앞으로 털며 턱을 듦 -> 팔을 내림. 먼 쪽 손은 허리에.
    'claw': [
        dict(near_arm=(70, 150), far_arm=(-18, 62), lean=0),
        dict(near_arm=(75, 170), far_arm=(-18, 62), lean=1),
        dict(near_arm=(105, 75), far_arm=(-18, 62), lean=-1),
        dict(near_arm=(40, 55), far_arm=(-10, 40), lean=0),
    ],
    # 매화 「깃털 매만지기」: 가까운 손을 머리 위 깃털로 올림 -> 깃털을 쓸어 세움 -> 손을 뺨 옆으로 내리며 윙크 -> 팔을 내림. 먼 쪽 손은 활을 쥔 채.
    'feather': [
        dict(near_arm=(120, 185), far_arm=(22, 58), lean=0),
        dict(near_arm=(135, 195), far_arm=(22, 58), lean=0),
        dict(near_arm=(85, 165), far_arm=(22, 58), lean=1),
        dict(near_arm=(35, 50), far_arm=(22, 58), lean=0),
    ],
    # 달빛 「머리카락 넘기기」: 가까운 손을 귀 옆으로 -> 머리카락을 뒤로 쓸어 넘김(팔꿈치가 높이 들림) -> 손이 목덜미를 타고 내려옴 -> 팔을 내림.
    'hairflip': [
        dict(near_arm=(95, 180), far_arm=(22, 58), lean=0),
        dict(near_arm=(150, 215), far_arm=(22, 58), lean=-1),
        dict(near_arm=(110, 235), far_arm=(22, 58), lean=-1),
        dict(near_arm=(30, 45), far_arm=(22, 58), lean=0),
    ],
}


def quirk_sheet(kind):
    o = Image.new('RGB', (CELL * 2, CELL * 2), (255, 0, 255))
    for k, ps in enumerate(QUIRKS[kind]):
        o.paste(figure(None, True, dict(STAND, **ps)), ((k % 2) * CELL, (k // 2) * CELL))
    return o


# 공격 여덟 칸 (11-23 조사: 잘 만든 2D 액션은 한 타에 9~11칸 · 우리는 4칸을 6자리에 늘렸다)
#   준비 2 · 휘두름 3(가운데 = 타격 칸 · 때리는 손을 과장) · 지나감 2 · 거둠 1. 때리는 팔은 가까운 쪽.
def _p(nl, fl, na, fa, lean):
    return dict(near_leg=dict(th=nl[0], sh=nl[1], toe=nl[2] if len(nl) > 2 else 0), far_leg=dict(th=fl[0], sh=fl[1], toe=fl[2] if len(fl) > 2 else 0),
                near_arm=na, far_arm=fa, lean=lean)


ATTACKS = {
    # 범 「할퀴기」: 웅크려 팔을 뒤로 뺌 -> 더 깊이 -> 뛰어들며 팔이 머리 위로 -> [타격] 앞으로 쭉 내리침 -> 팔이 아래로 지나감 -> 뒤로 흘러감 -> 몸을 세움 -> 서기
    'claw': [
        _p((10, -16), (20, -4), (-55, -15), (35, 85), -2),
        _p((18, -28), (28, -12), (-115, -70), (55, 105), -5),
        _p((-14, -36, -20), (40, 12), (150, 125), (-15, 45), 6),
        _p((-34, -46, -30), (50, 2), (98, 86), (-35, 20), 12),
        _p((-34, -46, -30), (50, 2), (45, 25), (-30, 30), 14),
        _p((-28, -40, -24), (44, 4), (-12, -30), (-10, 45), 10),
        _p((-15, -24, -10), (30, 2), (-22, 12), (5, 45), 5),
        _p((-6, -6), (7, 7), (10, 35), (-10, 40), 0),
    ],
}


def attack_sheets(kind):
    out = []
    for half in (0, 1):
        o = Image.new('RGB', (CELL * 2, CELL * 2), (255, 0, 255))
        for k in range(4):
            o.paste(figure(None, True, ATTACKS[kind][half * 4 + k]), ((k % 2) * CELL, (k // 2) * CELL))
        out.append(o)
    return out


def main():
    import sys
    order = [(True, 'pass'), (True, 'reach'), (True, 'contact'), (True, 'down'), (False, 'pass'), (False, 'reach'), (False, 'contact'), (False, 'down')]
    if len(sys.argv) > 1 and sys.argv[1] == 'attack':  # py pose-rig.py attack <이름> <가슴> -> rig-f-atk-<이름>-<가슴>-a/b.png (앞 넷 · 뒤 넷)
        SHAPE['bust'] = sys.argv[3]
        a, b = attack_sheets(sys.argv[2])
        a.save(f'{STD}/rig-f-atk-{sys.argv[2]}-{sys.argv[3]}-a.png')
        b.save(f'{STD}/rig-f-atk-{sys.argv[2]}-{sys.argv[3]}-b.png')
        print('attack', sys.argv[2], sys.argv[3])
        return
    if len(sys.argv) > 1 and sys.argv[1] == 'quirk':  # py pose-rig.py quirk <이름> <가슴> -> rig-f-quirk-<이름>-<가슴>.png
        SHAPE['bust'] = sys.argv[3]
        if 'bow' in sys.argv[4:]:
            PROP['kind'] = 'bow'   # 먼 쪽 손에 활을 쥔 채
        quirk_sheet(sys.argv[2]).save(f'{STD}/rig-f-quirk-{sys.argv[2]}-{sys.argv[3]}.png')
        print('quirk', sys.argv[2], sys.argv[3])
        return
    if len(sys.argv) > 1 and sys.argv[1] == 'bow':    # py pose-rig.py bow <가슴> -> rig-f-bow-<가슴>.png (활 쏘기 네 칸)
        SHAPE['bust'] = sys.argv[2]
        PROP['kind'] = 'bow'
        bow_sheet().save(f'{STD}/rig-f-bow-{sys.argv[2]}.png')
        print('bow', sys.argv[2])
        return
    if len(sys.argv) > 1 and sys.argv[1] == 'walk':   # py pose-rig.py walk <걸음 결> <가슴 S|M|L|XL> [bow = 먼 쪽 손에 활을 쥐고 걷는다]
        key, bust = sys.argv[2], sys.argv[3]
        if len(sys.argv) > 4 and sys.argv[4] == 'bow':
            PROP['kind'] = 'bow'
        STYLE.clear()
        STYLE.update(STYLES[key])
        SHAPE['bust'] = bust
        tag = f"{key}-{bust}{'-bow' if PROP['kind'] == 'bow' else ''}"
        sheet(True).save(f'{STD}/rig-f-walk-{tag}-a.png')
        sheet(False).save(f'{STD}/rig-f-walk-{tag}-b.png')
        print('walk', key, bust)
        return
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
