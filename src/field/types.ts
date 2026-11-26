/**
 * 전장(field) 자료 꼴 — 정수만 (docs/realm/battle-study/22-design-code-reality.md §2 · 40-cards.md F1a)
 *
 * 좌표 (u, v) 는 정수 격자다: u = 우리 쪽에서 적 쪽으로 가는 길이 · v = 폭. 1칸 = P.field.unit 단위.
 * 그리기는 이 값을 읽기만 한다. 부동소수·삼각함수는 이 폴더의 sim 쪽 파일에 들이지 않는다 (tests/field/purity.test.ts).
 */

/** 본편 tactics.ts 의 Grp 와 같은 낱말 */
export type Grp = 'front' | 'bows' | 'horse'
export const GRPS: readonly Grp[] = ['front', 'bows', 'horse']

/** 본편 병종 (src/realm/battle.ts:12 UnitKind 에서 배를 뺀 여섯 · 전장의 대마다 하나) — 무리(grp)는 앞줄 = spear·pike·shield · 활 = bow·crossbow · 기병 = horse */
export type UnitKind = 'spear' | 'pike' | 'shield' | 'bow' | 'crossbow' | 'horse'
export const UNIT_KINDS: readonly UnitKind[] = ['spear', 'pike', 'shield', 'bow', 'crossbow', 'horse']
export const KIND_GRP: Readonly<Record<UnitKind, Grp>> = { spear: 'front', pike: 'front', shield: 'front', bow: 'bows', crossbow: 'bows', horse: 'horse' }
/** 본편 상성 표 (src/realm/battle.ts:69 BEATS 그대로 · 배 뺌) — 행이 이기는 병종 · 이기면 ×P.realm.counterUp · 지면 ×counterDown */
export const KIND_BEATS: Readonly<Record<UnitKind, readonly UnitKind[]>> = { spear: ['horse', 'shield'], bow: ['spear'], pike: ['horse'], shield: ['bow'], horse: ['bow'], crossbow: ['shield'] }

/** 입력의 g: 0 앞줄 · 1 활 · 2 기병 · 3 장수 · 4 아래 날개(시험판 ?mvp 만 · 그때 2 는 위 날개) */
export type InputGroup = 0 | 1 | 2 | 3 | 4
/** 입력의 op: 0 = 그 무리를 (u, v) 로 보냄(손으로 몰기) · 1 = 손을 떼고 임시 AI 에 맡김 (자세·비기 같은 갈래는 뒤 카드가 더한다) */
export const OP_MOVE = 0
export const OP_AUTO = 1
/**
 * 무리마다 제 명령 (C2 걸음 1.5 · 47 §1-B 16·18·19): u 의 뜻이 무리마다 다르다 —
 *   앞줄(g 0): 0 돌격 · 1 방진 · 2 길 트기 (세모 방진 > 돌격 > 길 트기 > 방진 · Squad.stance · 모양은 Squad.form)
 *   활(g 1):   0 화살비(겨눈 적 하나에 몰아 쏨 · OP_ATTACK 으로 찍은 적, 없으면 가장 가까운 앞줄) · 1 맞쏘기(적 활부터) · 2 불화살 · 3 높은 곳 (2·3 은 자리만 · 조건·효과는 뒤 카드)
 *   기병(g 2): 0 옆치기(겨눈 적의 옆·뒤로 돌아 들이침 · 도는 길은 FieldState.route) · 1 돌파(정면) · 2 추격(사기가 tacPursueMorale 아래인 적만) · 3 호위(장수 곁)
 * 활·기병의 명령은 Squad.cmd 에 남는다. 받을 수 없는 명령이면 버리지 않고 FieldState.grpWhy 에 까닭(WHY_*)을 남긴다
 */
export const OP_STANCE = 2
/** 물러남: 그 판을 바로 진 것으로 끝낸다 (g 는 아무거나) */
export const OP_RETREAT = 3
export const STANCE_CHARGE = 0
export const STANCE_HOLD = 1
export const STANCE_OPEN = 2
/** 기본 자세 (명령 없음 · 세모 상성에 안 낀다 · 세기 배수 1) — 돌격·방진 명령이 끝나면 이것으로 돌아간다 (길 트기는 남는다) */
export const STANCE_NONE = 3
/**
 * 적을 쳐라 (C2 · 50 조작 v2): g 0~3 (무리 셋 또는 장수) · u = 적 대 id · v = 0.
 * 앞줄·기병은 그 적에게 가서 맞붙고, 활은 그 적을 겨눈다 · 장수는 그 적에게 붙는다 · 그 적이 사라지면 알아서로 돌아간다
 */
export const OP_ATTACK = 4
/**
 * 장수 걷기: g 3 · u = 방향 번호 0~15 (HERO_DIR) · v = 1 가는 중 / 0 멈춤.
 * 바뀔 때만 보낸다 — 한 번 받으면 멈춤이 올 때까지 그쪽으로 계속 간다 (틱마다 입력이 쌓이지 않게)
 */
export const OP_HERO_DIR = 5
/** 내닫기: g 3 · u = 방향 번호 0~15 · -1 이면 장수가 보는 쪽 · v 는 안 본다 (기록에는 0) */
export const OP_DASH = 6
/** 비기 (Q 한 칸): g 3 · u, v = 겨눈 자리 (단위 · 겨눔이 없는 비기면 장수 자리를 보낸다) */
export const OP_SKILL = 7
/**
 * 찍는 큰 수 (51 §2 · C2 묶음 2): g 1 = 화살비 — 땅을 찍는다 (u, v 둘레의 적에게 몰아 쏜다 · 닿지 않으면 닿을 때까지 다가간다) ·
 * g 2 = 기병 옆치기 — 적 무리를 찍는다 (u, v 에 가장 가까운 적 대의 옆·뒤로 돌아 들이치고 flankStaySec 뒤 알아서 빠져 장수 곁으로)
 */
export const OP_AIM = 8
/** 전부 장수 곁으로 (F · g 는 아무거나) — 우리 무리 셋의 명령을 모두 풀고 기본 행동(장수 따라 진 맞춰 옴)으로 */
export const OP_RALLY = 9

/** 방향 번호의 수 */
export const HERO_DIRS = 16
/**
 * 16방위 (du, dv) · 천분율 정수 표 (삼각함수 없이) — 0 = 적 쪽(+u) · 번호가 하나 오를 때마다 +v 쪽으로 22.5° 돈다
 * (4 = +v · 8 = -u 우리 쪽 · 12 = -v). 화면은 스틱·WASD 의 (du, dv) 를 num.ts 의 nearestDir 로 가장 가까운 번호로 바꾼다
 */
export const HERO_DIR: readonly (readonly [number, number])[] = [
  [1000, 0], [924, 383], [707, 707], [383, 924], [0, 1000], [-383, 924], [-707, 707], [-924, 383],
  [-1000, 0], [-924, -383], [-707, -707], [-383, -924], [0, -1000], [383, -924], [707, -707], [924, -383],
]

/** 장수의 비기 (Q 한 칸 · 본편 heroArt 가 정한 것을 들판 연결 때 넘긴다 · 47 §1-B·C) — none 이면 비기 없음 */
export type HeroArt = 'shout' | 'stand' | 'snipe' | 'vanguard' | 'none'
export const HERO_ARTS: readonly HeroArt[] = ['shout', 'stand', 'snipe', 'vanguard', 'none']
/** 비기를 안 받은 장수의 비기 (시험장 기본 장수 · 50 C2) */
export const HERO_ART_DEFAULT: HeroArt = 'shout'

/**
 * 비기·내닫기를 못 쓴 까닭 (Hero.why · 화면이 「아직 못 씁니다」의 까닭을 띄운다) — 0 은 까닭 없음 (마지막에 쓴 것이 먹혔다)
 * 1 쿨타임 · 2 쓰러져 있음 · 3 겨눌 적장이 없음 · 4 겨눈 곳이 너무 멂 · 5 비기가 없음 · 6 내닫는 중
 */
export const WHY_NONE = 0
export const WHY_COOL = 1
export const WHY_DOWN = 2
export const WHY_NO_TARGET = 3
export const WHY_FAR = 4
export const WHY_NO_ART = 5
export const WHY_BUSY = 6
/** 7 추격할 흔들리는 적이 없음 · 8 아직 없는 명령(불화살·높은 곳 · 뒤 카드) · 9 산 대가 없음 */
export const WHY_NO_WAVERING = 7
export const WHY_NOT_YET = 8
export const WHY_NO_MEN = 9
/** 앞줄 모양 (Squad.form) — 0 알아서 · 1 돌격(쐐기) · 2 방진(촘촘한 네모 · 멈춤) · 3 길 트기(가운데가 벌어진 두 줄) */
export const FORM_AUTO = 0, FORM_CHARGE = 1, FORM_HOLD = 2, FORM_OPEN = 3
/** 활 명령 · 기병 명령 (Squad.cmd · -1 이면 알아서) */
export const CMD_VOLLEY = 0, CMD_COUNTER = 1, CMD_FIRE = 2, CMD_HEIGHT = 3
export const CMD_FLANK = 0, CMD_PUNCH = 1, CMD_PURSUE = 2, CMD_GUARD = 3
/**
 * 무리 명령 (Squad.order · 51 §2) — 0 기본 행동(명령 없음: 장수를 따라 진을 맞춰 오고 닿는 적과 알아서 맞붙는다) ·
 * 1 돌격(쐐기로 달려 들이침) · 2 방진(멈춰 촘촘한 네모 · 쫓지 않는다) · 3 화살비(찍은 자리) · 4 옆치기(도는 길 → 들이침 → 빠짐) ·
 * 5 따로 보냄(OP_MOVE · 그 자리에 선다) · 6 적을 쳐라(OP_ATTACK)
 */
export const ORD_NONE = 0, ORD_CHARGE = 1, ORD_HOLD = 2, ORD_VOLLEY = 3, ORD_FLANK = 4, ORD_MOVE = 5, ORD_ATTACK = 6
/** impact 사건의 how — 0 보통 · 1 상성이 맞음(돌격 덤·옆치기·기병이 활을 침) · 2 막힘(방진에 막힌 기병·돌격 — 친 쪽이 튕겨 난다) */
export const HIT_PLAIN = 0, HIT_GOOD = 1, HIT_BLOCKED = 2

export type EndWhy = 'morale' | 'men' | 'time' | 'retreat' | 'invalid'

export interface Point { u: number; v: number }

/** 대 = 몸. 무리마다 4개 이하로 고정하고 대당 사람 수가 바뀐다 (한 편 사람 수 p90 1,305 · 최대 2,097) */
export interface Squad {
  id: number
  side: 0 | 1
  grp: Grp
  /** 병종 (UnitKind · C2 병종 묶음부터 grp 이름이 아니라 진짜 병종 — 화면은 이것으로 병종별 띠를 그린다 · 무리를 가를 때는 grp 를 쓴다) */
  kind: string
  men: number
  menMax: number
  /** 이번 달 새로 뽑은 사람 수 (금빛으로 보인다) */
  fresh: number
  u: number
  v: number
  goal: Point | null
  /** 앞줄 자세 0 돌격 · 1 방진 · 2 길 트기 · 3 기본(STANCE_NONE · 세모에 안 낀다) (활·기병은 무시) */
  stance: 0 | 1 | 2 | 3
  /** 처음 사기 · 사기 = morale0 - 잃은 몫 - shock (누적에서 바로 셈하므로 정수 깎임이 쌓이지 않는다) */
  morale0: number
  /** 옆구리·장수 쓰러짐으로 누적된 사기 꺾임 (천분율) */
  shock: number
  /** 시작 자리 (지키는 편은 여기서 leashCells 안에서만 움직인다) */
  homeU: number
  homeV: number
  /** 맞물린 적 대의 id · 없으면 -1 (앞줄이 맞붙는 거리 안의 적 앞줄·기병과 맞물리면 지나쳐 걸을 수 없다 · 손으로 몰면 풀린다) */
  lock: number
  /** 잠든 남은 틱 (먹힌 기습 · 맞으면 0) */
  sleep: number
  /** 자다가 맞아 깬 뒤 첫 칼(edgeMulPermille)이 걸리는 남은 틱 (edgeSec) */
  daze: number
  /** 깎다 남은 피해 (천분의 일 명보다 작은 몫 · 틱마다 내리지 않고 들고 간다 — hz 를 바꿔도 같은 피해) */
  rem: number
  /** 목책 문이 서 있는 동안 덜 꺾인 사기 몫 — 문이 부서진 틱에 굳힌다 (부서지는 틱에 위안이 한꺼번에 사라지는 숨은 충격을 막는다) */
  held: number
  /** 옆구리를 맞은 틱 수 (사기는 이것에서 바로 셈해 hz 를 바꿔도 같다) */
  flank: number
  /** 손으로 몰고 있으면 1 (임시 AI 가 목표를 안 바꾼다) */
  manual: 0 | 1
  /** 지금 노리는 적 대의 id · 없으면 -1 */
  target: number
  /** 체력 · 천분의 일 명 단위 (men = hp 를 1000 으로 올림해서 나눈 것) */
  hp: number
  /** 0~1000 */
  morale: number
  /** 「적을 쳐라」로 받은 적 대 id · 없으면 -1 (그 적이 사라지면 -1 로 돌아가 알아서 · C2) */
  foe: number
  /** 장수 곁의 기운·큰 외침으로 덜 꺾인(되오른) 사기 몫의 누적 (백만분율 · 사기 = 처음 − 잃은 몫 − 충격 + 이것 ÷ 1000 — 틱마다 꺾이는 몫이 작아 천분율이면 내림에 사라진다) */
  calm: number
  /** 앞줄 모양 FORM_* (자세를 받기 전은 0 알아서 · 화면이 병사 줄을 세운다) */
  form: number
  /** 활·기병 명령 CMD_* · -1 알아서 */
  cmd: number
  /** 활: 지금 닿는 거리 (단위 · 높은 터 위면 늘어난 값) · 활이 아니면 0 */
  reach: number
  /** 지금 싸우는 상대 — 이번 틱에 친 적 대 id (없으면 맞물린 적) · 없으면 -1 · 손으로 몰았든 알아서든 같은 뜻 (target 은 가려는 적이라 손으로 몬 대는 -1 이다) */
  aim: number
  /** 무리 명령 ORD_* (같은 무리의 대는 같은 값) · 그 명령을 받은 틱 */
  order: number
  orderTick: number
  /** 화살비의 찍은 자리 · 옆치기의 겨눈 적 자리 (없으면 null) */
  orderAt: Point | null
  /** 돌격·옆치기: 달린 거리 (단위 · 도움닫기 · 맞붙으면 0) · 돌격 덤이 남은 틱 · 옆치기가 처음 닿은 틱(-1) */
  ran: number
  bonus: number
  hitTick: number
  /** 사기가 꺾여(무너짐 문턱 아래) 도망치는 중이면 1 — 치지 않고 제 진영 쪽으로 달리며, 지나가는 곁의 우리 대 사기를 깎는다 (도미노) */
  flee: 0 | 1
  /** 몸 (C2 묶음 3 · 화면은 이 네모 안에 병사를 줄 세운다) — 줄 방향(v) 폭 bw · 앞뒤(u) 깊이 bd (단위 · 1칸 = P.field.unit) · 네모의 가운데는 (u, v) */
  bw: number
  bd: number
  /** 향 — 방향 번호 0~15 (HERO_DIR · 처음은 편의 앞: 편 0 은 0 · 편 1 은 8) · 옆·뒤에서 맞는지는 이것으로 가른다 (몸 네모는 늘 편의 축에 맞춘다) */
  face: number
  /** 밀려난 거리의 누적 (단위 · 2칸 밀릴 때마다 사기가 꺾인다 · 읽기용이기도 하다) */
  pushed: number
  /** 달아났다가 장수 곁에서 다시 선 적이 있으면 1 (regroup · 대마다 판에 한 번) */
  regrouped: 0 | 1
  /** 상성에 진 첫 맞물림·첫 화살을 이미 맞았으면 1 (kindFirstShock 은 대마다 한 번) */
  countered: 0 | 1
  /** 돌격의 쾅에 밀려 남은 거리 (단위 · u·v) 와 남은 틱 — shoveTicks 틱에 나눠 대 모양째 옮긴다 (한 틱에 1칸 뛰면 화면에서 앞줄이 튀어 흩어져 보였다 · 3차) */
  shoveU: number
  shoveV: number
  shoveN: number
}

/** 장수 (C2: 플레이어가 직접 조종 · 입력이 없으면 임시 AI) */
export interface Hero {
  side: 0 | 1
  id: string
  u: number
  v: number
  goal: Point | null
  /** 붙어 있는 무리 (0~2) · 없으면 -1 */
  grp: number
  /** 손으로 몰고 있으면 1 (아니면 임시 AI 가 제 편 앞줄 곁을 따른다) */
  manual: 0 | 1
  /** 쓰러져 못 움직이는 남은 틱 */
  stun: number
  hp: number
  /** 깎다 남은 피해 (틱마다 내리지 않고 들고 간다) */
  rem: number
  /** 무예 · 통솔 (본편 능력치 1~10 의 10배 · 시험장 기본 50) — 무예는 자동 공격의 세기, 통솔은 곁의 기운 크기 */
  mu: number
  tong: number
  /** 걷는 방향 번호 0~15 (OP_HERO_DIR) · 안 걸으면 -1 */
  dir: number
  /** 보는 쪽 방향 번호 0~15 (마지막으로 움직인 쪽 · 처음은 적 쪽) — 내닫기 u = -1 이 이쪽 · 그림의 좌우 */
  face: number
  /** 「적을 쳐라」로 받은 적 대 id · 없으면 -1 */
  foe: number
  /** 이번 틱에 자동 공격으로 친 것 — 적 대 id · 적장은 -2 · 안 쳤으면 -1 (그림·소리용) */
  atk: number
  /** 내닫는 남은 틱 (0 이면 안 내닫는다 · 내닫는 동안은 안 맞는다) */
  dash: number
  /** 내닫는 방향 번호 */
  dashDir: number
  /** 내닫기 쿨타임 남은 틱 */
  dashCd: number
  /** 이 장수의 비기 (Q) */
  art: HeroArt
  /** 비기 쿨타임 남은 틱 (0 이면 쓸 수 있다) */
  artCd: number
  /** 비기 효과가 이어지는 남은 틱 (버텨라 · 선봉 내닫기) */
  artOn: number
  /** 마지막으로 못 쓴 까닭 (WHY_*) 과 그 틱 · 먹히면 WHY_NONE */
  why: number
  whyTick: number
  /** 이번 선봉 내닫기에 이미 맞은 적 대 id (한 번 내닫기에 대마다 한 번만 사기가 뚝) */
  hitIds: number[]
  /**
   * 투지 0~1000 (52 §6-2 · 1000 이면 찼다) — 제 편 사기가 적보다 낮을수록 빨리 찬다 · 찬 채로 비기를 쓰면 쿨타임이 돌고 있어도 한 번 더 쓴다(투지는 0 으로).
   * 화면은 찬 정도(÷ 1000)와 「찼다」(= 1000)를 읽는다
   */
  grit: number
  /** 투지로 한 번 더 쓴 횟수 (gritUses 에 닿으면 더 안 찬다 · 양쪽이 번갈아 차서 때를 다 쓰던 판) */
  gritN: number
  /** 걸어서 적 줄에 닿아 밀친 마지막 틱 (-1 없음 · heroBangCdSec 마다 한 번 · 3차-나) */
  bangTick: number
  /** 손으로 몰아 걸어 온 거리 (단위 · 1초 걸음까지만 쌓이고 멈추면 1초에 다 빠진다) — heroRunInCells 넘게 걸어 닿아야 밀침이 난다 (도움닫기 · 3차-나) */
  runIn: number
}

export interface FieldInput { tick: number; g: InputGroup; op: number; u: number; v: number }

/**
 * 사건 줄 (화면·소리가 읽는 읽기용 줄 · 셈에 되먹이지 않는다 · 재생에서도 같은 줄이 나온다)
 * heroDash 내닫기 · heroSkill 비기(art) · heroDown/heroUp 장수 쓰러짐/일어남 · impact 처음 맞물림(n = 붙은 사람 수) ·
 * rout 대의 사기가 꺾임(무너짐 문턱 아래로) · gateBreak 목책 문 부서짐(id = 조각 id) · volley 활이 쏨(n = 쏜 사람 수 · volleyEventSec 마다) ·
 * loss 이 틱에 누가 누구를 깎았나(id = 친 대 · 장수면 -1 · to = 맞은 대 · n = 실제로 줄어든 사람 수 · 0 이면 안 적음 · how = LOSS_*).
 * omen 적 큰 수 예고(pts = 올 길) · flankHit 옆치기가 먹힘(id = 친 기병 대 · to = 맞은 대) · artHit 비기에 맞은 적 대(to · n = 깎은 사기 천분율).
 * 사기 문턱: 처음 사기의 P.field.waverPermille(70%) 아래 = 흔들림 · P.realm.tacBreakMorale(55%) 아래 = 무너짐(rout · flee).
 * 줄은 끝없이 자라지 않는다: 마지막 eventKeepSec 초만 남긴다 (화면은 읽은 마지막 틱 뒤의 줄만 읽는다)
 */
export type FieldEventKind = 'heroDash' | 'heroSkill' | 'heroDown' | 'heroUp' | 'impact' | 'rout' | 'gateBreak' | 'volley' | 'loss' | 'omen' | 'flankHit' | 'artHit' | 'sideBreak' | 'stand' | 'regroup' | 'heroBash'
/**
 * (C2 판의 법칙 묶음 · 52 §6 · 검수 B5) sideBreak 편이 무너짐 — 편 사기(또는 사람)가 문턱 아래로 간 틱에 한 번 · id -1 · (u, v) = 그 편 산 대의 가운데 ·
 *   n = 1 사람 · 2 사기 · 그 뒤 P.field.sideBreakSec 동안 그 편의 남은 대가 모두 달아나고 나서 판이 끝난다 (end · winner 는 그때 선다).
 * stand 버팀 — 편 사기가 문턱 바로 위(standAbovePermille)로 내려온 순간 장수 곁(heroArtCells)의 대들 사기가 한 번 되오른다 (판마다 편에 한 번) ·
 *   id -1 · (u, v) = 장수 자리 · n = 되오른 대 수 · r = 범위(단위).
 * regroup 달아난 대가 제 장수 곁(regroupCells)에 와서 다시 선다 (대마다 판에 한 번) · id = 그 대 · n = 되오른 사기(천분율).
 * heroBash 장수가 걸어 들어가 적 줄에 닿아 밀침 (3차-나) — to = 밀린 적 대 id · (u, v) = 닿은 자리 · n = 밀린 방향 번호(HERO_DIR · 장수에서 그 대 쪽) · id -1 (같은 틱에 impact how 1 도 난다).
 * heroSkill 은 r = 비기가 닿는 범위(단위 · 닿은 대가 없어도 낸다 · 큰 외침은 (u, v) = 장수 자리).
 */
/** loss 사건의 종류 (FieldEvent.how) — 0 칼 · 1 화살 · 2 장수 · 3 비기 · 4 부딪힘 */
export const LOSS_BLADE = 0, LOSS_ARROW = 1, LOSS_HERO = 2, LOSS_ART = 3, LOSS_IMPACT = 4
export interface FieldEvent {
  tick: number
  kind: FieldEventKind
  /** 그 일을 겪은(한) 편 */
  side: 0 | 1
  /** 대 id (장수 사건은 -1 · gateBreak 는 조각 id) */
  id: number
  u: number
  v: number
  /** 세기 (사람 수 등 · 없으면 0) */
  n: number
  /** loss: 맞은 대 id · 종류 (LOSS_*) */
  to?: number
  how?: number
  /** heroSkill 의 비기 종류 */
  art?: HeroArt
  /** omen(적 큰 수 예고 · omenSec 전): 올 길의 점들 · id = 올 대 하나 */
  pts?: Point[]
  /** heroSkill · stand: 닿는 범위 (단위 · 반지름) */
  r?: number
}

/** 진 (52 §6-1 · 준비 화면에서 고른다) — 0 방패 벽(방패 가운데 · 버팀에 덤) · 1 창 쐐기(창 가운데 · 돌격에 덤) · 2 넓은 날개(기병이 더 바깥·앞 · 옆치기가 빨리 닿음) */
export const LINE_SHIELD = 0, LINE_WEDGE = 1, LINE_WINGS = 2
export const LINES = 3
/**
 * 편의 사기를 깎은 몫 — 까닭별 합 (검수 B5 · 결과 한 장의 「가장 큰 까닭」) · 단위는 천분율 × 사람
 * (÷ 그 편 처음 사람 수 = 편 사기에서 깎인 천분율 · 되오른 몫은 빼지 않은 깎인 몫만).
 * arrows 화살 · melee 맞붙음(정면 칼날 · 돌격의 쾅 · 방진에 막힘 · 목책·진영 무너짐) · flank 옆·뒤 맞음(옆치기 들이침 포함) ·
 * hero 적장(칼 · 휘두름 · 내닫기 · 비기 · 장수가 쓰러짐) · domino 곁의 대가 무너지고 달아남 · push 전선이 밀림
 */
export interface MoraleBy { arrows: number; melee: number; flank: number; hero: number; domino: number; push: number }
export type MoraleCause = keyof MoraleBy
export const MORALE_CAUSES: readonly MoraleCause[] = ['arrows', 'melee', 'flank', 'hero', 'domino', 'push']

export interface LiveSide {
  men: Readonly<Record<Grp, number>>
  /** 병종별 사람 수 (있으면 무리 안의 대를 이 비율로 가른다 · 무리별 합은 men[grp] 와 같아야 한다 · 없으면 앞줄 방패·창 반반 · 활 4분의 3 활 · 4분의 1 쇠뇌) */
  kinds?: Readonly<Partial<Record<UnitKind, number>>>
  /** 이번 달 새로 뽑은 사람 수 (무리별 · 없으면 0) */
  fresh?: Readonly<Partial<Record<Grp, number>>>
  F: number
  /** 0~1000 */
  morale: number
  /** 장수 — mu 무예 · tong 통솔(없으면 무예와 같다) · art 비기(없으면 HERO_ART_DEFAULT) · 능력치는 본편 1~10 의 10배 */
  hero: { id: string; mu: number; tong?: number; art?: HeroArt } | null
  player: boolean
  seen: boolean
  /** 진 LINE_* (52 §6-1) — 없으면 씨앗으로 셋 가운데 하나 (우리 편은 화면이 늘 넘긴다 · 안 고르면 0) · 병종(kinds)이 없으면 진이 병종을 정한다 */
  form?: 0 | 1 | 2
}

/** 바닥 종류 — 0 평지 · 1 얕은 물(느림) · 2 깊은 물(못 걸음) · 3 막힘(못 걸음) · 4 높은 터(위에 선 활이 세고, 올라오는 적은 느리다) */
export type Ground = 0 | 1 | 2 | 3 | 4
export const G_PLAIN = 0, G_SHALLOW = 1, G_DEEP = 2, G_BLOCK = 3, G_HIGH = 4

/** 진영 (칸 단위) — axis 0: 줄이 폭(v)으로 퍼지고 뒷줄은 u 쪽 뒤 · axis 1: 줄이 u 로 퍼지고 뒷줄은 v 쪽 뒤 (기습처럼 옆에서 시작) */
export interface Camp {
  u: number
  v: number
  face: 1 | -1
  spread: number
  axis: 0 | 1
  /** 참이면 그 편은 시작 자리에서 leashCells 밖으로는 안 나간다 (지키는 쪽) */
  hold: boolean
  /** 잠든 채 시작하는 시간 (초 · 맞으면 깬다) */
  asleep?: number
}

/**
 * 맵 조각 — 목책 마디와 문 (칸 단위 · 칸은 [u0, u1) × [v0, v1) 반열림).
 * 맵의 hp 는 치는 편(주인이 아닌 편) 사람 1,000명마다의 체력이고, 판을 만들 때 치는 편 사람 수를 곱한다 (F2c-1).
 * rem 은 판 사본에서만 쓰는 깎다 남은 몫이다 (맵을 지을 때는 없다).
 */
export interface Piece { id: number; kind: 'stake' | 'gate'; u0: number; v0: number; u1: number; v1: number; hp: number; owner: 0 | 1; rem?: number }

/** 맵의 규칙 이름 — 지어진 것만 (공성·수상은 mapFor 가 null) · hold 는 평지에서 한 편이 지키는 비교용 */
export type MapRule = 'meet' | 'cross' | 'stake' | 'ambush' | 'high' | 'hold'

/** 지도 — cells[cu * w + cv] 가 칸마다 바닥 종류 (u, w 는 칸 수). JSON 을 거치지 않는다(Uint8Array) */
export interface FieldMap {
  v: 1
  u: number
  w: number
  cells: Uint8Array
  camps: readonly [Camp, Camp]
  pieces: readonly Piece[]
  rule: MapRule
  /** 높은 터를 가진 편 · 없으면 -1 */
  highOwner: -1 | 0 | 1
}

export interface LiveSetup {
  v: 1
  key: string
  seed: number
  map: FieldMap
  sides: readonly [LiveSide, LiveSide]
  night: boolean
  /** 고르고 오른쪽 누름 시험판 (field.html?mvp) — 사람이 쥔 편은 장수를 안 따라 제자리를 지키고 · 기병이 적 활을 맨 뒤로 돌아 친다 · 없으면 옛 판 그대로 */
  mvp?: boolean
  /** 시험판에서 적이 큰 수(예고 옆치기 · 알아서 방진·돌격·큰 외침)를 쓰나 (실험실의 「적의 꾀」 · 없으면 안 씀) */
  mvpTricks?: boolean
}

export interface FieldLog {
  /** 버린 입력 수 (틀린 꼴 · 한 틱 입력 상한 inputPerTickMax 를 넘은 것) */
  dropped: number
  /** 받아들인 입력 (재생·기록용) */
  accepted: FieldInput[]
  /** 사건 줄 (읽기용 · 해시에 안 넣는다) */
  events: FieldEvent[]
}

export interface FieldState {
  tick: number
  seed: number
  map: FieldMap
  squads: Squad[]
  heroes: Hero[]
  /** 무리 기준 점 (깃발 · 진의 가운데) — [편 × 3 + 무리 줄(앞줄 0 · 활 1 · 기병 2)] */
  anchor: Point[]
  /** 기병 옆치기가 잡은 도는 길의 남은 점들 (같은 번호 · 없으면 빈 배열 · 화면이 점선으로 그린다) */
  route: Point[][]
  /** 우리 무리(앞줄·활·기병)가 마지막으로 못 받은 명령의 까닭 WHY_* 과 그 틱 (받으면 WHY_NONE) */
  grpWhy: [number, number, number]
  grpWhyTick: [number, number, number]
  /** 결과 통계 (편마다 · 끝 상자) — 먹힌 옆치기 수 · 비기로 깎은 적 사기 합(천분율 × 대) · 쓰러뜨린 적 사람 · 잃은 사람 */
  stats: { flankHits: [number, number]; artMorale: [number, number]; killed: [number, number]; lost: [number, number]; moraleBy: [MoraleBy, MoraleBy] }
  /** 편마다의 진 LINE_* (LiveSide.form · 없으면 씨앗) — 화면은 lineup[1] 로 적 진을 읽는다 */
  lineup: [number, number]
  /** 편이 무너진 틱 (sideBreak · -1 아직) · 무너진 까닭 1 사람 · 2 사기 (0 아직) — 무너진 뒤 sideBreakSec 에 끝난다 */
  breakTick: [number, number]
  breakWhy: [number, number]
  /** 버팀을 쓴 편 (stand · 판마다 한 번) */
  stood: [0 | 1, 0 | 1]
  /** 버팀이 선 틱 (-1 아직) — 이 틱부터 P.field.standSec 동안 그 편 장수 곁(heroArtCells)의 대가 덜 꺾인다 */
  standTick: [number, number]
  /** 칼 든 대(앞줄·기병)가 안 달아나고 마지막으로 있던 틱 — breakNoBladesSec 넘게 없으면 편이 무너진다 */
  bladeTick: [number, number]
  /** 적의 큰 수 (입력 없는 편의 옆치기 · 51 §7) — 그 편이 옆치기를 거는 틱 (-1 없음 · 판을 만들 때 씨앗으로 정한다) */
  planTick: [number, number]
  /** 적 AI 의 큰 수(예고 옆치기 · 알아서 방진·돌격 · 알아서 큰 외침)를 쓰는 편이면 1 — 사람이 쥔 편(LiveSide.player)은 0 (가만있는 사람이 공짜 큰 수를 받고 손대면 잃던 것 · 검수 E1) · 장수가 손으로 몰리는 동안도 안 쓴다
   *  (판을 만들 때 정한다 · 거울 판이 편과 함께 뒤집는다) */
  ai: [0 | 1, 0 | 1]
  /** 편마다 앞줄 대가 마지막으로 맞물린 틱 (-1 없음) — 맞물려 있으면 진의 기준점이 언다 (52 §1-3 · F 로 풀린다) */
  frontLockTick: [number, number]
  /** (C2 에서 명령 수 제한을 걷어냈다 · 늘 0 — 화면이 이 칸을 걷어내면 다음 카드에서 지운다) */
  used: [number, number, number, number]
  /** 진영이 무너진 편 (적이 진영 자리까지 들어오면 한 번 · 사기가 꺾인다) */
  broken: [0 | 1, 0 | 1]
  end: EndWhy | null
  /** 끝났을 때 이긴 편 · 0 우리 · 1 적 · -1 비김(또는 아직) */
  winner: -1 | 0 | 1
  log: FieldLog
  /** 고르고 오른쪽 누름 시험판이면 1 (LiveSetup.mvp · 없으면 옛 판) */
  mvp?: 0 | 1
  /** 시험판에서 적의 큰 수를 쓰면 1 (LiveSetup.mvpTricks) */
  tricks?: 0 | 1
}
