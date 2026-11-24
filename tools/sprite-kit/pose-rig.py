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


IRON = (120, 124, 130)


def pole(d, a, b, head_at_b=True, back=10, front=22):
    """긴 자루 무기: 두 점(a → b)을 지나는 막대 · b 쪽 끝에 머리(도끼날·망치)"""
    dx, dy = b[0] - a[0], b[1] - a[1]
    n = math.hypot(dx, dy) or 1.0
    ux, uy = dx / n, dy / n
    p0 = (a[0] - ux * back * Z, a[1] - uy * back * Z)
    p1 = (b[0] + ux * front * Z, b[1] + uy * front * Z)
    d.line([p0, p1], fill=LINE, width=int(3.4 * Z) + 6)
    d.line([p0, p1], fill=WOOD, width=int(3.4 * Z))
    h = p1 if head_at_b else p0
    px, py = -uy, ux
    w, l = 9 * Z, 8 * Z
    d.polygon([(h[0] + px * w - ux * l, h[1] + py * w - uy * l), (h[0] + px * w + ux * l, h[1] + py * w + uy * l),
               (h[0] - px * w * .5 + ux * l, h[1] - py * w * .5 + uy * l), (h[0] - px * w * .5 - ux * l, h[1] - py * w * .5 - uy * l)], fill=IRON, outline=LINE)


# 칸(인형 화소 = 게임 화소 × Z): 폭·높이 · 뿌리의 가로 자리 · 바닥 줄. 걷기·옛 자세는 기본값(정사각 칸 · 뿌리 한가운데).
#   공격처럼 멀리·높이 뻗는 동작은 big_canvas() 로 넓은 칸을 쓴다 (11-23 · ART-SKELETON §12: 참고 게임은 칸 폭 = 키의 1.7~2배 · 뿌리는 왼쪽 0.33~0.41).
CANVAS = dict(w=CELL, h=CELL, cx=CELL / 2, ground=CELL - 50)


def big_canvas(w=240, h=208, root=92, foot=200):
    """게임 화소로: 칸 w×h · 뿌리 x · 발바닥 줄 y"""
    CANVAS.update(w=w * Z, h=h * Z, cx=root * Z, ground=foot * Z)


def solve2(S, T, a, b, want):
    """두 마디(a·b)로 S 에서 T 까지: (첫 마디 각, 둘째 마디 각) — 각은 pt() 와 같은 뜻. want = fwd(가운데 관절이 앞으로 · 무릎) | down(아래로 · 팔꿈치) | up | back"""
    dx, dy = T[0] - S[0], T[1] - S[1]
    dist = max(abs(a - b) + 1e-3, min(a + b - 1e-3, math.hypot(dx, dy)))
    base = math.atan2(dx, dy)
    al = math.acos(max(-1.0, min(1.0, (a * a + dist * dist - b * b) / (2 * a * dist))))
    best = None
    for sg in (1, -1):
        u = base + sg * al
        ex, ey = S[0] + math.sin(u) * a, S[1] + math.cos(u) * a
        tx, ty = S[0] + math.sin(base) * dist, S[1] + math.cos(base) * dist
        v = math.atan2(tx - ex, ty - ey)
        score = dict(fwd=ex, back=-ex, down=ey, up=-ey)[want]
        if best is None or score > best[0]:
            best = (score, math.degrees(u), math.degrees(v))
    return best[1], best[2]


BLADE = dict(len=42)   # 한 손 칼날 길이(게임 화소) — 명령 줄에 short 를 주면 단검(24)


def blade(d, hand, deg, length=None):
    """한 손 칼: 손에서 deg 방향으로 칼날 · 반대쪽으로 짧은 자루 끝 · 손 앞에 가로 코등이"""
    length = length or BLADE['len']
    r = math.radians(deg)
    ux, uy = math.cos(r), -math.sin(r)
    tip = (hand[0] + ux * length * Z, hand[1] + uy * length * Z)
    pom = (hand[0] - ux * 5 * Z, hand[1] - uy * 5 * Z)
    g0 = (hand[0] + ux * 3 * Z, hand[1] + uy * 3 * Z)
    d.line([pom, tip], fill=LINE, width=int(4.2 * Z) + 6)
    d.line([pom, g0], fill=WOOD, width=int(3.2 * Z))
    d.line([g0, tip], fill=IRON, width=int(4.2 * Z))
    px, py = -uy, ux
    d.line([(g0[0] + px * 4.5 * Z, g0[1] + py * 4.5 * Z), (g0[0] - px * 4.5 * Z, g0[1] - py * 4.5 * Z)], fill=LINE, width=int(2.4 * Z) + 4)
    d.line([(g0[0] + px * 4.5 * Z, g0[1] + py * 4.5 * Z), (g0[0] - px * 4.5 * Z, g0[1] - py * 4.5 * Z)], fill=WOOD, width=int(2.4 * Z))


STAFF = dict(back=32, front=78)   # 방울 지팡이(한 손): 쥔 자리 뒤 32 · 앞 78 = 길이 110(키 137의 0.8)
BRONZE, RIBBON = (214, 170, 70), ((205, 60, 55), (70, 110, 200), (235, 200, 60))   # 방울 청동 · 오방색 띠(적·청·황)


def staff(d, hand, deg, back=None):
    """방울 지팡이: 손에서 deg 방향이 끝(방울이 달린 쪽) · 반대쪽이 밑동. 끝에 청동 방울 셋 + 오방색 띠 셋"""
    r = math.radians(deg)
    ux, uy = math.cos(r), -math.sin(r)
    tip = (hand[0] + ux * STAFF['front'] * Z, hand[1] + uy * STAFF['front'] * Z)
    bk = STAFF['back'] if back is None else back
    butt = (hand[0] - ux * bk * Z, hand[1] - uy * bk * Z)
    d.line([butt, tip], fill=LINE, width=int(3.2 * Z) + 6)
    d.line([butt, tip], fill=WOOD, width=int(3.2 * Z))
    px, py = -uy, ux
    for k, (off, col) in enumerate(zip((-1, 0, 1), RIBBON)):   # 띠: 끝에서 아래로 늘어진다
        a = (tip[0] - ux * 4 * Z + px * off * 2.5 * Z, tip[1] - uy * 4 * Z + py * off * 2.5 * Z)
        b = (a[0] - ux * 9 * Z + px * off * 2 * Z, a[1] - uy * 9 * Z + py * off * 2 * Z + 3 * Z)
        d.line([a, b], fill=LINE, width=int(2.2 * Z) + 4)
        d.line([a, b], fill=col, width=int(2.2 * Z))
    for k in (-1, 0, 1):   # 방울 셋(끝 가까이 가로로)
        c = (tip[0] + px * k * 4.2 * Z, tip[1] + py * k * 4.2 * Z)
        d.ellipse([c[0] - 3 * Z, c[1] - 3 * Z, c[0] + 3 * Z, c[1] + 3 * Z], fill=BRONZE, outline=LINE, width=3)


def fingers(d, hand, fore_a):
    """펴진 손바닥: 아래팔 방향으로 손가락 넷이 부채꼴로"""
    for k in (-1.5, -.5, .5, 1.5):
        e = pt(hand[0], hand[1], fore_a + k * 13, 14 * Z)
        d.line([hand, e], fill=LINE, width=int(2.4 * Z) + 4)
        d.line([hand, e], fill=FAR, width=int(2.4 * Z))


def figure(phase, swing_near, pose=None):
    """한 칸. swing_near = 지금 앞으로 나가는(흔드는) 다리가 가까운 쪽인가"""
    P0 = HALF[phase or 'pass']; S = STYLE
    P = dict(sw=(P0['sw'][0] * S['stride'], P0['sw'][1] * (S['lift'] if phase == 'pass' else S['stride'])), st=(P0['st'][0] * S['stride'], P0['st'][1] * S['stride']),
             drop=P0['drop'] * S['bob'], sw_toe=P0['sw_toe'], st_toe=P0['st_toe'])
    im = Image.new('RGB', (int(CANVAS['w']), int(CANVAS['h'])), (255, 0, 255))
    d = ImageDraw.Draw(im)
    cx = CANVAS['cx']
    near = dict(th=P['sw'][0], sh=P['sw'][1], toe=P['sw_toe']) if swing_near else dict(th=P['st'][0], sh=P['st'][1], toe=P['st_toe'])
    far = dict(th=P['st'][0], sh=P['st'][1], toe=P['st_toe']) if swing_near else dict(th=P['sw'][0], sh=P['sw'][1], toe=P['sw_toe'])
    if pose is not None:   # 걷기가 아닌 자세(활 쏘기 등): 다리·팔 각도를 그대로 받는다
        ik = pose.get('ik')
        if ik:   # 손·발 자리로 주는 자세(게임 화소 · 뿌리가 원점 · 앞 = +x · 위 = +y): 두 발은 바닥의 그 자리에 박히고 골반이 움직인다
            pv = ik.get('pelvis', (0, 0))
            cx += pv[0] * Z
            hip_ik = CANVAS['ground'] - (THIGH + SHIN + FOOT_H) * Z - 3 - pv[1] * Z

            def leg_ik(hip, foot):
                ank = (CANVAS['cx'] + foot[0] * Z, CANVAS['ground'] - foot[1] * Z - FOOT_H * Z - 3)
                th, sh_ = solve2(hip, ank, THIGH * Z, SHIN * Z, 'fwd')
                return dict(th=th, sh=sh_, toe=foot[2] if len(foot) > 2 else 0)
            near, far = leg_ik((cx - 2 * Z, hip_ik + 1 * Z), ik['near_foot']), leg_ik((cx + 3 * Z, hip_ik - 1 * Z), ik['far_foot'])
        else:
            near, far = dict(pose['near_leg']), dict(pose['far_leg'])
    # 골반 높이: 두 발 가운데 더 낮은 쪽이 땅(칸 바닥 위 50px)에 닿게
    hip_y = 0.0
    low = max(leg(d, (cx, hip_y), near['th'], near['sh'], near['toe'], NEAR, False), leg(d, (cx, hip_y), far['th'], far['sh'], far['toe'], FAR, False))
    hip_y = CANVAS['ground'] - low + ((P['drop'] - P0['drop']) * Z if pose is None else 0)
    if pose is not None and pose.get('ik'):
        hip_y = hip_ik
    if pose is None:
        cx += S['hip'] * Z * (1 if swing_near else -1) * (1 if phase in ('contact', 'down') else -.5)   # 골반 흔듦
    hip_n, hip_f = (cx - 2 * Z, hip_y + 1 * Z), (cx + 3 * Z, hip_y - 1 * Z)       # 3/4 각도: 먼 쪽 골반·어깨가 조금 앞·위
    bend = math.radians(pose.get('bend', 0)) if pose is not None else 0.0   # 윗몸을 앞으로 숙이는 각: 어깨가 앞으로 나가며 낮아진다
    sh_y = hip_y - TORSO * Z * math.cos(bend)
    lean = (S['lean'] if pose is None else pose.get('lean', 0)) * Z             # 걷는 몸은 앞으로 기운다(결마다 다르게)
    lean += TORSO * Z * math.sin(bend)
    sh_n, sh_f = (cx - 3 * Z + lean, sh_y + 1 * Z), (cx + 5 * Z + lean, sh_y - 1 * Z)
    # 팔은 같은 쪽 다리와 반대로
    # 팔 흔듦 (11-23 형 「어깨가 일부 컷에서 삐걱거림 · 팔도 제대로」): 예전에는 팔을 같은 쪽 넓적다리 각도에 묶어, 여덟 칸 가운데 한 칸에서
    #   팔이 맨 앞(+23도)에서 맨 뒤(-23도)로 튀었다. → 한 바퀴에 한 번 고르게 오가는 물결로: 같은 쪽 다리가 가장 앞(딛음)일 때 팔은 가장 뒤.
    kk = ('pass', 'reach', 'contact', 'down').index(phase or 'pass') + (0 if swing_near else 4)
    sw = math.cos(2 * math.pi * (kk - 2) / 8)          # +1 = 가까운 다리가 가장 앞
    # 11-23 밤 · 던파 여귀검사 걷기 칸을 브라우저로 직접 봄: 윗몸(머리·몸통)은 여덟 칸이 거의 같은 그림이고 팔은 엉덩이 곁에서 조금만 흔들린다.
    #   우리 인형은 팔을 ±26도로 크게 휘둘러 어색했다(형 「팔 흔들리는 것도 어색」) → ±11도 · 팔꿈치는 거의 편 채.
    A = 18 * S['arm']   # 11-24: 참고 게임에서 잰 손이 오가는 폭 = 키의 0.25 (±11도는 0.14 로 너무 좁았다 · ART-SKELETON §12)
    an, af = -A * sw, A * sw
    eb = min(S['elbow'], 14)
    arm_n = (an, an + eb + 6 * max(0.0, an / max(A, 1)))   # 팔꿈치는 조금만 굽는다
    arm_f = (af, af + eb + 6 * max(0.0, af / max(A, 1)))
    if pose is None:   # 어깨는 팔을 따라 아주 조금 돈다(가까운 팔이 앞이면 가까운 어깨도 앞으로 1.5px)
        tw = -0.5 * Z * sw   # 어깨는 거의 돌지 않는다(윗몸은 한 그림처럼)
        sh_n, sh_f = (sh_n[0] + tw, sh_n[1]), (sh_f[0] - tw, sh_f[1])
    if pose is not None and pose.get('ik'):
        ik = pose['ik']
        hand = lambda h: (CANVAS['cx'] + h[0] * Z, CANVAS['ground'] - h[1] * Z)
        arm_n = solve2(sh_n, hand(ik['near_hand']), UPPER * Z, FORE * Z, ik.get('near_elbow', 'down'))
        arm_f = solve2(sh_f, hand(ik['far_hand']), UPPER * Z, FORE * Z, ik.get('far_elbow', 'down'))
    elif pose is not None:
        arm_n, arm_f = pose['near_arm'], pose['far_arm']
    elif PROP['kind'] == 'pole2':    # 두 손으로 긴 자루를 몸 앞에 비스듬히 든 채 걷는다 — 두 팔 모두 고정(해비의 도끼)
        arm_n, arm_f = (12, 72), (48, 104)
    elif PROP['kind'] == 'shoulder':  # 가까운 손으로 자루를 어깨에 메고 걷는다 — 멘 팔은 고정, 먼 팔만 작게 흔든다(아룸의 망치)
        arm_n = (-34, 118)
    elif PROP['kind'] == 'sword' and BLADE['len'] >= 30:     # 가까운 손에 칼을 내려 쥐고 걷는다 — 칼 쥔 팔은 고정, 먼 팔만 흔든다(아라)
        arm_n = (4, 26)
    # 단검(BLADE 짧음)은 팔을 고정하지 않는다 — 11-24 형 「단검 애들은 걷기할 때 팔이 부자연스럽다」 · 참고: 던파 도적(로그) 걷기는 주먹을 허리 높이에 두고 두 팔을 적당히 흔든다
    elif PROP['kind'] == 'bow':
        arm_f = (22, 58)   # 활 든 팔은 걸을 때 흔들지 않는다 — 활이 늘 몸 앞에 보이게(뒤로 가면 몸에 가려 칸마다 생겼다 사라진다)
    # 먼 쪽부터: (활대) · 먼 팔 · 먼 다리 → 몸통 · 머리 → 가까운 다리 · 가까운 팔 → (시위)
    hand_f = wrist(sh_f, arm_f[0], arm_f[1])
    pulled = pose is not None and bool(pose.get('pull'))
    if PROP['kind'] == 'bow':
        bow_stick(d, hand_f)
        if not pulled:
            bow_string(d, hand_f)   # 당기지 않은 시위는 활과 함께 몸 뒤에
    if PROP['kind'] == 'pole1':   # 먼 손으로 세워 짚은 긴 자루: 자루 끝이 바닥에 닿고 쇠머리가 위
        pole(d, (hand_f[0] - 1 * Z, CANVAS['ground'] - 6 * Z), (hand_f[0] + 2 * Z, hand_f[1] - 20 * Z), back=0, front=14)
    arm(d, sh_f, arm_f[0], arm_f[1], FAR)
    leg(d, hip_f, far['th'], far['sh'], far['toe'], FAR)
    if PROP['kind'] == 'shoulder':   # 어깨에 멘 자루: 가까운 손(어깨 앞)에서 머리 뒤를 지나 먼 쪽 어깨 너머로 — 무기 머리는 서기 그림처럼 앞쪽(오른쪽) 위
        hn = wrist(sh_n, arm_n[0], arm_n[1])   # (11-23: 머리를 등 뒤로 그렸더니 서기 그림과 어긋나 망치 머리가 둘이 됐다)
        r28 = math.radians(24)
        pole(d, hn, (hn[0] + math.cos(r28) * 22 * Z, hn[1] - math.sin(r28) * 22 * Z), back=6, front=14)
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
    if PROP['kind'] == 'pole2':
        hn = wrist(sh_n, arm_n[0], arm_n[1])
        if pose is not None and pose.get('ik'):   # 자루 길이는 늘 같다(62) — 뒤 손이 앞 손 쪽으로 밀고 나가면 그만큼 자루가 앞 손을 지나 앞으로 나간다(찌르기)
            gap = math.hypot(hand_f[0] - hn[0], hand_f[1] - hn[1]) / Z
            pole(d, hn, hand_f, back=14, front=max(20, 62 - 14 - gap))
        else:
            pole(d, hn, hand_f, back=10, front=22)
        d.ellipse([hand_f[0] - HAND * Z, hand_f[1] - HAND * Z, hand_f[0] + HAND * Z, hand_f[1] + HAND * Z], fill=FAR, outline=LINE, width=3)   # 먼 손이 자루를 쥔 자리
    hand_n = arm(d, sh_n, arm_n[0], arm_n[1], NEAR)
    if PROP['kind'] == 'bow' and pulled:
        bow_string(d, hand_f, hand_n)   # 당긴 시위만 몸 앞으로 지나간다
    if PROP['kind'] == 'sword':
        blade(d, hand_n, (pose or {}).get('blade', -38))
        d.ellipse([hand_n[0] - HAND * Z, hand_n[1] - HAND * Z, hand_n[0] + HAND * Z, hand_n[1] + HAND * Z], fill=NEAR, outline=LINE, width=3)   # 칼자루를 쥔 손
    if PROP['kind'] == 'staff':   # 가까운 손이 방울 지팡이를 쥐고 · 먼 손은 손바닥을 편다 (주술 시전 · 무녀)
        if pose is not None and pose.get('palm', True):
            fingers(d, hand_f, arm_f[1])
            d.ellipse([hand_f[0] - HAND * 1.4 * Z, hand_f[1] - HAND * 1.4 * Z, hand_f[0] + HAND * 1.4 * Z, hand_f[1] + HAND * 1.4 * Z], fill=FAR, outline=LINE, width=3)
        staff(d, hand_n, (pose or {}).get('blade', 90), (pose or {}).get('sback'))
        d.ellipse([hand_n[0] - HAND * Z, hand_n[1] - HAND * Z, hand_n[0] + HAND * Z, hand_n[1] + HAND * Z], fill=NEAR, outline=LINE, width=3)
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


def _ik(pelvis, near_hand, far_hand, bend=0, lean=0, near_foot=(-18, 0), far_foot=(12, 0), **kw):
    return dict(ik=dict(pelvis=pelvis, near_hand=near_hand, far_hand=far_hand, near_foot=near_foot, far_foot=far_foot, **kw), bend=bend, lean=lean)


_S = dict(near_foot=(-7, 0), far_foot=(9, 0))   # 선 발
# 큰 무기를 든 장수의 개성 동작 — 칸마다 소품 쥐는 법이 다를 수 있다(prop). 발은 네 칸 같은 자리 · 움직이는 것은 가까운 쪽 팔 하나(참고 게임: 서기 변형은 팔 하나만).
IK_QUIRKS = {
    # 해비 「머리끈 고쳐 매기」: 도끼를 세워 짚으며 손을 뗌 -> 묶은 머리의 끈을 잡아 당겨 조임 -> 머리채를 뒤로 탁 넘김 -> 손을 자루로 되돌림
    'retie': [
        dict(_ik((0, 0), (4, 66), (16, 90), **_S), prop='pole2'),
        dict(_ik((0, 0), (-9, 124), (18, 84), near_elbow='back', **_S), prop='pole1'),
        dict(_ik((0, 0), (-17, 114), (18, 84), near_elbow='back', **_S), prop='pole1'),
        dict(_ik((0, 0), (2, 70), (16, 88), **_S), prop='pole2'),
    ],
}
# 아라 「칼날 살피기」(한 손 칼): 서기 -> 칼을 얼굴 앞에 곧게 세움 -> 먼 손가락으로 칼등을 쓸어 올림 -> 칼을 탁 털어 내림
IK_QUIRKS['inspect'] = [
    dict(_ik((0, 0), (6, 62), (10, 64), **_S), prop='sword', blade=-38),
    dict(_ik((0, 0), (16, 92), (10, 64), **_S), prop='sword', blade=86),
    dict(_ik((0, 0), (16, 94), (22, 112), **_S), prop='sword', blade=90),
    dict(_ik((0, 0), (10, 62), (10, 64), **_S), prop='sword', blade=-58),
]
# 맞음 두 칸 + 일어남 두 칸 (11-24 형 「죽는 거 말고 피격들도 한 컷씩 · 필수로 필요한 컷들은 최대한」) — 참고: 던파 여귀검사 맞음 2 · 일어남 2 (ART-SKELETON §12)
#   1 움츠림(맞은 순간): 윗몸이 앞으로 웅크리고 무기를 몸에 붙임 · 무릎 살짝
#   2 젖혀짐(크게 맞음): 머리가 뿌리보다 키의 0.2 뒤로 · 가까운 발이 뒤로 한 걸음 · 팔이 벌어짐
#   3 한 무릎 세워 앉음(일어나는 중): 자루를 바닥에 짚고(pole1) 가까운 무릎은 바닥 · 먼 발은 앞에
#   4 넓게 섬(자세를 다시 잡음): 다리를 넓게 · 무기를 겨눔
IK_QUIRKS['hit_pole2'] = [
    dict(_ik((-3, -8), (4, 64), (14, 74), bend=20, near_foot=(-10, 0), far_foot=(10, 0)), prop='pole2'),
    dict(_ik((3, -6), (-4, 70), (8, 102), bend=-42, near_foot=(-24, 0), far_foot=(8, 0)), prop='pole2'),
    dict(_ik((-4, -54), (8, 30), (24, 60), bend=12, near_foot=(-30, 0), far_foot=(18, 0)), prop='pole1'),
    dict(_ik((0, -12), (2, 64), (16, 82), bend=8, near_foot=(-24, 0), far_foot=(20, 0)), prop='pole2'),
]

# 같은 네 칸 — 한 손 칼·단검(가까운 손 · blade 각도) · 활(먼 손)
IK_QUIRKS['hit_sword'] = [
    dict(_ik((-3, -8), (8, 66), (14, 72), bend=20, near_foot=(-10, 0), far_foot=(10, 0)), prop='sword', blade=-60),
    dict(_ik((3, -6), (-14, 74), (14, 98), bend=-42, near_foot=(-24, 0), far_foot=(8, 0)), prop='sword', blade=-130),
    dict(_ik((-4, -54), (16, 34), (22, 44), bend=12, near_foot=(-30, 0), far_foot=(18, 0)), prop='sword', blade=-85),
    dict(_ik((0, -12), (14, 70), (16, 74), bend=8, near_foot=(-24, 0), far_foot=(20, 0)), prop='sword', blade=25),
]
# 한 손 방울 지팡이 맞음 네 칸 (hit_sword 를 본뜸 · 지팡이는 칼보다 길어 휘두르는 대신 몸에 붙임 / 젖혀질 땐 뒤로 쏠림)
IK_QUIRKS['hit_staff'] = [
    dict(_ik((-3, -8), (8, 66), (14, 72), bend=20, near_foot=(-10, 0), far_foot=(10, 0)), prop='staff', blade=70, palm=False),
    dict(_ik((3, -6), (-14, 74), (14, 98), bend=-42, near_foot=(-24, 0), far_foot=(8, 0)), prop='staff', blade=125),
    dict(_ik((-4, -54), (16, 34), (22, 44), bend=12, near_foot=(-30, 0), far_foot=(18, 0)), prop='staff', blade=84, palm=False),
    dict(_ik((0, -12), (14, 60), (16, 70), bend=8, near_foot=(-24, 0), far_foot=(20, 0)), prop='staff', blade=66),
]
IK_QUIRKS['hit_none'] = [dict({k: v for k, v in d.items() if k not in ('prop', 'blade')}) for d in IK_QUIRKS['hit_sword']]   # 맨손(범 할퀴기)
IK_QUIRKS['hit_bow'] = [
    dict(_ik((-3, -8), (6, 66), (14, 70), bend=20, near_foot=(-10, 0), far_foot=(10, 0)), prop='bow'),
    dict(_ik((3, -6), (-14, 74), (16, 98), bend=-42, near_foot=(-24, 0), far_foot=(8, 0)), prop='bow'),
    dict(_ik((-4, -54), (10, 32), (26, 52), bend=12, near_foot=(-30, 0), far_foot=(18, 0)), prop='bow'),
    dict(_ik((0, -12), (6, 66), (24, 72), bend=8, near_foot=(-24, 0), far_foot=(20, 0)), prop='bow'),
]

# 아룸 「메 고쳐 메기」(어깨에 멘 채 · shoulder): 메를 어깨에서 툭 들썩임 -> 도로 내려앉히며 먼 손을 허리에 -> 그대로 목을 한 번 꺾음 -> 서기
QUIRKS['reshoulder'] = [
    dict(near_arm=(-46, 130), far_arm=(10, 24), lean=0),
    dict(near_arm=(-28, 110), far_arm=(34, -50), lean=0),
    dict(near_arm=(-34, 118), far_arm=(34, -50), lean=0),
    dict(near_arm=(-34, 118), far_arm=(10, 24), lean=0),
]


def ik_quirk_sheet(kind):
    o = Image.new('RGB', (CELL * 2, CELL * 2), (255, 0, 255))
    for k, ps in enumerate(IK_QUIRKS[kind]):
        PROP['kind'] = ps.get('prop')
        o.paste(figure(None, True, ps), ((k % 2) * CELL, (k // 2) * CELL))
    return o


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


_W = dict(near_foot=(-20, 0), far_foot=(17, 0))    # 넓게 선 발
_L = dict(near_foot=(-28, 0, -18), far_foot=(12, 0))   # 뛰어든 발: 앞발은 그대로 박혀 있고 뒷발이 뒤로 뻗는다(참고 게임: 뒷다리가 키의 0.34 뒤로)
# 두 손 긴 자루(pole2): 가까운 손 = 자루 끝 · 먼 손 = 쇠머리 쪽. 앞발(먼 쪽 발)은 여덟 칸 같은 자리.
IK_ATTACKS = {
    # 해비 「뛰어들며 사선 내려찍기」(가볍고 빠르게): 뒤로 당김 -> 어깨 뒤로 올림 -> 등 뒤 높이(몸을 젖힘) -> [궤적] 머리 위 앞으로 -> [타격] 앞 아래로 찍음 -> 유지 -> 유지(당기기 시작) -> 거둠
    'chop': [
        _ik((-4, -4), (-12, 80), (8, 96), lean=-1),
        _ik((-7, -6), (-4, 104), (-16, 122), lean=-2),
        _ik((-9, -3), (-8, 118), (-24, 128), bend=-5),
        _ik((6, -9), (20, 106), (34, 120), bend=10, **_L),
        _ik((10, -15), (32, 60), (48, 48), bend=30, **_L),
        _ik((11, -17), (32, 57), (49, 44), bend=33, **_L),
        _ik((8, -12), (26, 70), (42, 64), bend=22, **_L),
        _ik((0, -1), (15, 77), (34, 91), lean=1),
    ],
    # 창·작살 「찌르기」 — 던파 마창사의 찌르기 칸을 직접 보고 맞춤 (11-24 형 「팔을 쭉 뻗어서 제대로 찌르는 컷이 없다 · 마네킹 제대로 만든 거 맞아?」 · ART-SKELETON §13)
    #   본 것: 준비 → 웅크려 당김(윗몸은 거의 곧게 · 키의 0.85) → **낮게 뛰어듦** → [타격] 윗몸이 수직에서 60~70도 눕고 머리가 키의 30% 내려가며 앞팔이 곧게 · 뒷다리는 뒤로 곧게 · 온몸의 가로 길이가 키의 1.4배
    #         → 버팀(윗몸이 35도쯤으로 일어나고 다리를 넓게 · 팔은 편 채) → 거둠.
    #   옛 인형: 타격 칸의 윗몸이 27~35도, 손이 가슴 앞에 접혀 있었다 — 「창을 수평으로 든 채 기운 사람」이었다.
    #   자루 길이는 늘 같다(62) — 뒤 손이 앞 손 바로 뒤까지 밀고 나가 자루가 앞 손을 지나 길게 나간다. 앞발은 여덟 칸 같은 자리.
    'thrust': [
        _ik((-4, -8), (-14, 74), (8, 84), lean=-1),
        _ik((-8, -14), (-28, 76), (-6, 82), bend=-4),
        _ik((-10, -16), (-34, 80), (-12, 84), bend=4),
        _ik((10, -22), (14, 62), (36, 64), bend=40, near_foot=(-33, 0, -18)),
        _ik((20, -26), (200, 55), (210, 55), bend=55, near_foot=(-27, 0, -25)),   # 뒷다리는 뒤로 곧게(발 자리를 다리 길이 밖에 둬서 편다)
        _ik((20, -24), (200, 58), (210, 58), bend=50, near_foot=(-27, 0, -25)),
        _ik((12, -14), (34, 74), (54, 78), bend=22, near_foot=(-26, 0, -12)),
        _ik((0, -1), (15, 77), (34, 91), lean=1),
    ],
    # 아라 「뛰어들며 내려베기」(한 손 칼 · sword): 칼을 뒤로 당김 -> 들어 올림 -> 어깨 뒤 끝까지 -> [궤적] 뛰어들며 머리 위 앞으로 -> [타격] 앞 아래로 끝까지 벰 -> 유지 -> 유지(거두기 시작) -> 거둠
    'slash': [
        dict(_ik((-4, -4), (-14, 84), (16, 78), lean=-1), blade=125),
        dict(_ik((-7, -6), (-10, 112), (16, 80), lean=-2), blade=105),
        dict(_ik((-9, -3), (-16, 122), (14, 82), bend=-5), blade=150),
        dict(_ik((6, -9), (30, 116), (-4, 78), bend=10, **_L), blade=58),
        dict(_ik((10, -14), (61, 70), (-8, 76), bend=26, **_L), blade=-20),
        dict(_ik((11, -16), (59, 60), (-8, 74), bend=30, **_L), blade=-38),
        dict(_ik((8, -11), (40, 64), (-2, 72), bend=16, **_L), blade=-46),
        dict(_ik((0, -1), (6, 62), (10, 64), lean=1), blade=-38),
    ],
    # 아룸 「머리 위 수직 내려찍기」(무겁게 · 넓게 선 채 · 두 발은 여덟 칸 같은 자리): 낮게 쥠 -> 들어 올림 -> 머리 위 끝까지(살짝 젖힘) -> [궤적] 앞 위에서 내려옴 -> [타격] 바닥을 찍음 -> 유지(더 깊이) -> 유지 -> 거둠
    'slam': [
        _ik((0, -8), (4, 60), (22, 66), bend=8, **_W),
        _ik((-3, -4), (4, 98), (16, 116), **_W),
        _ik((-6, 0), (-6, 122), (-12, 134), bend=-6, **_W),
        _ik((2, -6), (22, 110), (34, 122), bend=10, **_W),
        _ik((6, -9), (30, 56), (44, 44), bend=40, **_W),
        _ik((6, -11), (30, 52), (44, 39), bend=43, **_W),
        _ik((4, -8), (26, 64), (41, 54), bend=28, **_W),
        _ik((0, -3), (10, 74), (28, 84), bend=4, **_W),
    ],
}


# 단검 「낮게 뛰어들어 가슴 높이로 곧게 찌르기」 (11-24 · 던파 도적 로그 시트를 직접 보고: 다리를 넓고 낮게 · 앞팔을 가슴 높이에서 수평으로 곧게 · 뒷손은 가슴 앞으로 당김)
#   1 겨눔(낮게 · 단검을 가슴 앞에 · 칼끝 앞) 2 웅크리며 단검을 허리 옆으로 당김 3 내디딤 4 [타격] 앞팔을 곧게 뻗어 찌름(뒷손 가슴 앞) 5 버팀 6 당겨 거둠 7 겨눔 8 서기
IK_ATTACKS['stab'] = [
    dict(_ik((-2, -10), (14, 80), (22, 88), bend=8), blade=5),
    dict(_ik((-6, -16), (-12, 70), (20, 86), bend=4), blade=12),
    dict(_ik((6, -16), (20, 84), (10, 88), bend=18, **_L), blade=3),
    dict(_ik((14, -18), (150, 90), (30, 90), bend=26, **_L), blade=0),   # 뒷손은 가슴 앞(참고 칸) — 처음엔 (2,88)이라 어깨 뒤로 젖혀졌다(11-24 바람)
    dict(_ik((15, -18), (150, 88), (30, 88), bend=27, **_L), blade=-2),
    dict(_ik((8, -14), (34, 82), (14, 86), bend=16, **_L), blade=4),
    dict(_ik((0, -8), (16, 78), (20, 84), bend=6), blade=6),
    dict(_ik((0, -1), (6, 62), (10, 64), lean=1), blade=-38),
]
# 주술 「기운 모아 내지르기」 — 한 손 방울 지팡이(가까운 손) + 먼 손 손바닥 (11-24 · 본 것은 ART-SKELETON §14 · 던파 무녀·엘레멘탈마스터는 못 봄)
#   1 겨눔(지팡이는 몸 앞 옆에 세움) 2 지팡이를 머리 위로 들어 올림 3 [모음 · 머묾] 지팡이를 머리 위·뒤로 젖혀 들고 먼 손바닥을 가슴 앞에 폄 · 윗몸이 뒤로 젖힘
#   4 [내지름 · 맞는 순간] 머리 위에서 앞 아래로 호를 그려 내리침: 쥔 손이 어깨 높이 앞으로 나가 방울이 몸 앞 위쪽에서 멈춤(자루가 얼굴을 가로지르지 않음) · 손바닥은 그 아래 가슴 높이에서 앞으로 5 뻗은 채(손바닥이 더 나감) 6 거둠 7 겨눔 8 서기
#   발은 앞 일곱 칸 같은 자리(참고 게임: 시전은 하체가 안 움직임) · 내지를 때만 뒷발이 조금 뒤로
_C = dict(near_foot=(-18, 0), far_foot=(14, 0))
IK_ATTACKS['cast'] = [
    dict(_ik((-2, -8), (26, 64), (10, 74), bend=4, **_C), blade=80),
    dict(_ik((-5, -12), (14, 106), (28, 94), bend=-4, lean=-1, **_C), blade=94, sback=22),
    dict(_ik((-10, -15), (24, 122), (30, 108), bend=-16, lean=-2, **_C), blade=104, sback=22),
    dict(_ik((11, -16), (58, 84), (96, 96), bend=30, near_foot=(-21, 0, -10), far_foot=(14, 0)), blade=36, sback=12),
    dict(_ik((13, -17), (62, 80), (98, 94), bend=26, near_foot=(-21, 0, -10), far_foot=(14, 0)), blade=26, sback=12),
    dict(_ik((8, -12), (42, 86), (64, 92), bend=16, **_C), blade=64, sback=16),
    dict(_ik((0, -6), (26, 66), (18, 80), bend=4, **_C), blade=84),
    dict(_ik((0, -1), (28, 60), (10, 64), lean=1), blade=84),
]
IK_PROP = {'slash': 'sword', 'stab': 'sword', 'cast': 'staff'}   # 공격마다 쥔 물건(없으면 두 손 긴 자루)


def ik_attack_sheets(kind):
    """넓은 칸 2×2 판 둘(앞 넷 · 뒤 넷) + 한 줄 미리 보기"""
    big_canvas()
    PROP['kind'] = IK_PROP.get(kind, 'pole2')
    figs = [figure(None, True, ps) for ps in IK_ATTACKS[kind]]
    w, h = figs[0].size
    out = []
    for half in (0, 1):
        o = Image.new('RGB', (w * 2, h * 2), (255, 0, 255))
        for k in range(4):
            o.paste(figs[half * 4 + k], ((k % 2) * w, (k // 2) * h))
        out.append(o)
    row = Image.new('RGB', ((w // 4) * 8, h // 4), (255, 0, 255))
    for i, f in enumerate(figs):
        row.paste(f.resize((w // 4, h // 4), Image.LANCZOS), (i * (w // 4), 0))
    return out[0], out[1], row


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
    if 'short' in sys.argv:   # 단검: 한 손 칼 인형에 짧은 칼날
        BLADE['len'] = 24
        sys.argv.remove('short')
    order = [(True, 'pass'), (True, 'reach'), (True, 'contact'), (True, 'down'), (False, 'pass'), (False, 'reach'), (False, 'contact'), (False, 'down')]
    if len(sys.argv) > 1 and sys.argv[1] == 'attack' and sys.argv[2] in IK_ATTACKS:   # 넓은 칸 · 두 손 긴 자루: rig-f-atk-<이름>-<가슴>-a/b.png (2×2 · 칸 240×208) + tools/out/lineup/rig-atk-<이름>.png
        SHAPE['bust'] = sys.argv[3]
        a, b, row = ik_attack_sheets(sys.argv[2])
        a.save(f'{STD}/rig-f-atk-{sys.argv[2]}-{sys.argv[3]}-a.png')
        b.save(f'{STD}/rig-f-atk-{sys.argv[2]}-{sys.argv[3]}-b.png')
        row.save(f'tools/out/lineup/rig-atk-{sys.argv[2]}.png')
        print('attack(넓은 칸)', sys.argv[2], sys.argv[3], a.size)
        return
    if len(sys.argv) > 1 and sys.argv[1] == 'attack':  # py pose-rig.py attack <이름> <가슴> -> rig-f-atk-<이름>-<가슴>-a/b.png (앞 넷 · 뒤 넷)
        SHAPE['bust'] = sys.argv[3]
        a, b = attack_sheets(sys.argv[2])
        a.save(f'{STD}/rig-f-atk-{sys.argv[2]}-{sys.argv[3]}-a.png')
        b.save(f'{STD}/rig-f-atk-{sys.argv[2]}-{sys.argv[3]}-b.png')
        print('attack', sys.argv[2], sys.argv[3])
        return
    if len(sys.argv) > 1 and sys.argv[1] == 'quirk':  # py pose-rig.py quirk <이름> <가슴> -> rig-f-quirk-<이름>-<가슴>.png
        SHAPE['bust'] = sys.argv[3]
        if sys.argv[2] in IK_QUIRKS:
            ik_quirk_sheet(sys.argv[2]).save(f'{STD}/rig-f-quirk-{sys.argv[2]}-{sys.argv[3]}.png')
            print('quirk(손·발 자리)', sys.argv[2], sys.argv[3])
            return
        for kd in ('bow', 'shoulder'):
            if kd in sys.argv[4:]:
                PROP['kind'] = kd   # 먼 쪽 손에 활 · 어깨에 멘 자루
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
        if len(sys.argv) > 4 and sys.argv[4] in ('bow', 'pole2', 'shoulder', 'sword'):
            PROP['kind'] = sys.argv[4]
        STYLE.clear()
        STYLE.update(STYLES[key])
        SHAPE['bust'] = bust
        tag = f"{key}-{bust}{'-' + PROP['kind'] if PROP['kind'] else ''}"
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
