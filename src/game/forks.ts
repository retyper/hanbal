/**
 * 갈림길 2택 (docs/MEGAHIT.md §3) — 판이 끝나면 다음 판을 둘 중에 고른다.
 *
 * ── 2026-08-31: 통째로 다시 짰다 ────────────────────────────────────────
 * 형: **"바람골 밀집 고르는거 너무 별로야. 진짜 개노잼이야. 심지어 밀집으로 하면 과녁끼리
 * 어이없이 겹치거나 땅바닥에 쳐박혀서 맞힐수도 없는게 나오잖아."**
 *
 * 둘 다 맞다. 그리고 원인이 다르다.
 *
 * ① **개노잼의 원인은 '선택지가 둘'이 아니라 '언제나 같은 둘'이었다.** 판마다 결정을
 *    준다는 설계는 맞았는데(§3), 50판 내내 같은 카드 두 장이 뜨면 그건 결정이 아니라
 *    확인 버튼이다. 이제 **여섯 장의 패에서 매판 두 장**이 뽑히고, 직전 판과 같은 짝은
 *    나오지 않는다. 그리고 고른 것이 **판의 생김새를 바꾼다** — 숫자만 바꾸지 않는다.
 *
 * ② **밀집은 구조적으로 못 고친다.** 있는 과녁을 무작위 방향으로 복제하는 방식은
 *    "겹치면 다시 뽑기"를 아무리 붙여도 (a) 지면 아래, (b) 건물 밖에 뜬 창문 사수,
 *    (c) 다른 복제와의 겹침을 전부 못 막는다 — 시도 24번이 다 실패하면 조용히 포기하니
 *    "골랐는데 아무 일도 안 일어나는" 카드가 되기도 했다. **버렸다.**
 *    새로 놓는 것(보급·돌진)은 전부 **기존 과녁의 오른쪽 바깥**에, 지면에서 충분히 띄워
 *    놓는다 — 겹칠 자리가 애초에 없다. 나머지 넷은 아예 과녁을 새로 놓지 않는다.
 *
 * ★ 새 화면을 열지 않는다 (C1). '다음 판' 힌트가 있던 자리에 카드 둘이 대신 선다.
 * ★ 보스판에는 안 나온다. 보스는 이미 저작된 대결이고 처치 뒤엔 보급 3택이 따로 있다.
 * ★ 순수 함수만 있다 (A1) — 같은 (판 번호, 선택)이면 언제나 같은 판이 나온다.
 */
import { makeRng, seedFrom } from '../core/rng.ts'
import { P } from '../tune/params.ts'
import type { ArrowKindId } from './arrows.ts'
import { BOSS_EVERY } from './stages.ts'
import type { StageDef, TargetSpec } from '../sim/types.ts'

export type ForkId = 'fire' | 'bomb' | 'wind' | 'supply' | 'scout' | 'single'

export interface ForkOption {
  readonly id: ForkId
  readonly title: string
  /** 한자 뿌리. 활 이름(game/arrows.ts origin)과 같은 문법이다. */
  readonly origin: string
  readonly desc: string
  /**
   * 이 판 동안 **공짜로** 물리는 살. 재고를 쓰지 않는다 (game/loop.ts freeArrow).
   * 없으면 들고 있던 살 그대로다.
   */
  readonly arrow?: ArrowKindId
  /** 클리어했을 때의 훈련치 배수. 없으면 1 — 실패하면 어차피 안 준다. */
  readonly trainMul?: number
}

/**
 * 패 여섯 장. **위험/보상의 축이 서로 달라야 한다** (§3) — 그래서 다섯 축으로 갈랐다:
 *   화공 = 화력(공짜 화전) · 화약고 = 연쇄(판의 구조) · 바람골 = 조준 정확도 ·
 *   노다지 = 자원(화살) · 척후 = 시간 압박 · 단발 = 탄약 관리.
 * 같은 축의 카드가 둘 뜨면 그건 한 장이나 마찬가지라, 뽑기에서 그것까지 본다(pairFor).
 */
const FIRE: ForkOption = {
  id: 'fire', title: '화공', origin: '火攻',
  desc: '이 판의 살이 전부 화전이 된다 — 재고를 쓰지 않는다. 발치에 떨구면 나도 다친다.',
  arrow: 'burst',
}
const BOMB: ForkOption = {
  id: 'bomb', title: '화약고', origin: '火藥庫',
  desc: '과녁 몇에 화약이 실린다 — 하나를 터뜨리면 둘레가 같이 간다.',
}
const WIND: ForkOption = {
  id: 'wind', title: '바람골', origin: '風谷',
  desc: '골바람이 분다 — 겨냥이 밀린다. 깨면 훈련치를 더 준다.',
  trainMul: P.fork.windTrainMul,
}
const SUPPLY: ForkOption = {
  id: 'supply', title: '노다지', origin: '노다지',
  desc: '보급 과녁이 하나 선다 — 맞히면 화살이 돌아온다.',
}
const SCOUT: ForkOption = {
  id: 'scout', title: '척후', origin: '斥候',
  desc: '한 놈이 나를 향해 달려온다. 닿기 전에 끊어라 — 깨면 훈련치를 더 준다.',
  trainMul: P.fork.scoutTrainMul,
}
const SINGLE: ForkOption = {
  id: 'single', title: '단발', origin: '單發',
  desc: '화살을 적게 준다. 한 발도 못 버린다 — 깨면 훈련치를 크게 준다.',
  trainMul: P.fork.singleTrainMul,
}

/** 축 이름. 같은 축 둘이 한 짝으로 뜨면 선택이 아니라 중복이다. */
const AXIS: Record<ForkId, string> = {
  fire: '화력', bomb: '연쇄', wind: '조준', supply: '자원', scout: '압박', single: '탄약',
}

const POOL: readonly ForkOption[] = [FIRE, BOMB, WIND, SUPPLY, SCOUT, SINGLE]

/** 이 판에 이 카드를 낼 수 있는가. 낼 수 없는 카드는 뽑기에서 아예 빠진다. */
function fits(opt: ForkOption, stage: StageDef): boolean {
  if (opt.id === 'bomb') return killable(stage).length >= 2
  if (opt.id === 'single') return stage.arrows >= 5
  return true
}

/** 화약고를 실을 수 있는 과녁 — 보스·보급은 뺀다 (하나는 대결이고 하나는 상이다). */
function killable(stage: StageDef): readonly TargetSpec[] {
  return stage.targets.filter((t) => t.kind !== 'boss' && t.kind !== 'bonus')
}

/** 이 판 번호(1-based)에 갈림길을 보여줄 것인가. 보스판은 이미 저작된 대결이라 뺀다. */
export function hasFork(n: number): boolean {
  return n % BOSS_EVERY !== 0
}

/**
 * 이 판에 뜨는 카드 두 장. **(판 번호, 그 판의 배치)만으로 정해진다** — 같은 판을 다시 오면
 * 같은 두 장이다 (지도에서 되돌아왔을 때 카드가 바뀌면 그건 선택이 아니라 슬롯머신이다).
 *
 * 규칙 셋: 서로 다른 카드 · 같은 축이 아닌 카드 · **`avoid`와 같은 짝이 아닐 것**.
 * 셋째가 이 함수의 존재 이유다 — 같은 두 장이 이어지는 순간 "개노잼"이 시작된다.
 * avoid 는 **직전 판에 실제로 보여준 짝**의 열쇠다(forkPairKey). 여기서 n-1로 되짚지 않는
 * 이유: 낼 수 있는 카드는 판의 배치에 따라 다르므로, 직전 판을 다시 계산한 결과가 그때
 * 진짜로 보여준 것과 다를 수 있다. 무엇을 보여줬는지 아는 건 부르는 쪽(game/loop.ts)뿐이다.
 */
export function forkOptions(
  n: number, stage: StageDef, avoid = '',
): readonly [ForkOption, ForkOption] {
  const usable = POOL.filter((o) => fits(o, stage))
  // 패가 둘도 안 되면 뽑을 게 없다 — 바람골은 어떤 판에도 얹힌다(fits 항상 true).
  if (usable.length < 2) return [WIND, FIRE]

  let pair = pickPair(n, usable)
  // 직전과 같은 짝이면 시드를 밀어 다시 뽑는다. 결정론은 그대로다 (n·avoid에서만 나온다).
  for (let shift = 1; shift <= usable.length * 4 && forkPairKey(pair) === avoid; shift++) {
    pair = pickPair(n + shift * 977, usable)
  }
  return pair
}

/** 짝의 열쇠 — 순서를 안 따진다. loop가 '직전에 보여준 짝'을 이걸로 기억한다. */
export function forkPairKey(p: readonly [ForkOption, ForkOption]): string {
  return p[0].id < p[1].id ? `${p[0].id}|${p[1].id}` : `${p[1].id}|${p[0].id}`
}

function pickPair(n: number, usable: readonly ForkOption[]): [ForkOption, ForkOption] {
  const rng = makeRng(seedFrom(`hanbal.fork.pick.${n}`))
  const a = usable[rng.int(0, usable.length - 1)] ?? WIND
  // 둘째는 첫째와 다르고 축도 달라야 한다. 다 실패하면 그냥 다른 카드면 된다.
  const others = usable.filter((o) => o.id !== a.id)
  const fresh = others.filter((o) => AXIS[o.id] !== AXIS[a.id])
  const from = fresh.length > 0 ? fresh : others
  const b = from[rng.int(0, from.length - 1)] ?? FIRE
  return [a, b]
}

/** 훈련치 배수 (클리어했을 때만 game/loop.ts가 곱한다). */
export function forkTrainMul(opt: ForkOption | null): number {
  return opt?.trainMul ?? 1
}

/**
 * 이미 결정론적으로 구워진(getStage) 다음 판에 선택을 얹는다. **순수 함수** — 같은
 * 입력엔 항상 같은 판이 나온다 (A1). sim으로 넘어가기 전, game 레이어에서 한 번만 부른다.
 */
export function applyFork(stage: StageDef, opt: ForkOption, n: number): StageDef {
  switch (opt.id) {
    case 'wind': {
      const floor = P.fork.windFloor
      return stage.wind >= floor ? stage : { ...stage, wind: floor }
    }
    case 'bomb':
      return applyBomb(stage, n)
    case 'supply':
      return addOutside(stage, {
        kind: 'bonus', x: 0, y: P.fork.supplyY, r: P.fork.supplyR,
        give: Math.floor(P.fork.supplyGive), score: 50,
      }, P.fork.supplyGap)
    case 'scout':
      return addOutside(stage, {
        kind: 'charger', x: 0, y: P.fork.scoutY, r: P.fork.scoutR, score: 120,
      }, P.fork.scoutGap)
    case 'single': {
      const arrows = Math.max(Math.floor(P.fork.singleFloor), Math.round(stage.arrows * P.fork.singleKeep))
      return arrows >= stage.arrows ? stage : { ...stage, arrows }
    }
    default:
      return stage
  }
}

/**
 * 화약고 — 있는 과녁 **몇 개에 표시만 한다.** 자리를 옮기지도, 새로 놓지도 않는다.
 * 밀집이 죽은 이유가 여기 있다: 판의 배치는 이미 저작(또는 절차 생성)으로 균형이 잡혀 있고,
 * 거기에 손을 대는 순간 지면·건물·다른 과녁과의 관계가 전부 깨진다. 표시는 아무것도 안 깬다.
 */
function applyBomb(stage: StageDef, n: number): StageDef {
  const pool = killable(stage)
  if (pool.length < 2) return stage
  const rng = makeRng(seedFrom(`hanbal.fork.bomb.${n}`))
  const want = Math.max(1, Math.min(pool.length - 1, Math.round(pool.length * P.fork.bombShare)))
  // 어느 것에 실을지 고른다. 인덱스 집합으로 골라야 같은 과녁을 두 번 안 고른다.
  const idx = new Set<number>()
  for (let guard = 0; idx.size < want && guard < pool.length * 8; guard++) {
    idx.add(rng.int(0, pool.length - 1))
  }
  const chosen = new Set<TargetSpec>()
  let i = 0
  for (const t of pool) {
    if (idx.has(i)) chosen.add(t)
    i++
  }
  return { ...stage, targets: stage.targets.map((t) => (chosen.has(t) ? { ...t, bomb: true } : t)) }
}

/**
 * 새 과녁을 **판 바깥쪽(오른쪽)에** 놓는다.
 *
 * 이게 "겹치거나 땅에 박히는" 일을 없애는 방법이다 — 빈 자리를 찾아 헤매는 대신,
 * 애초에 아무도 없는 곳에 놓는다. 카메라는 스테이지의 모든 과녁이 들어오게 구도를 잡으므로
 * (render/camera.ts frame) 화면 밖으로 밀려날 걱정도 없다.
 * y는 인자로 받은 값을 쓰되 **반경 + 여유만큼은 반드시 지면 위**로 올린다.
 */
function addOutside(stage: StageDef, spec: TargetSpec, gap: number): StageDef {
  let maxX = 0
  for (const t of stage.targets) {
    const edge = t.x + (t.r ?? 0.3)
    if (edge > maxX) maxX = edge
  }
  const r = spec.r ?? 0.4
  const placed: TargetSpec = {
    ...spec,
    x: maxX + gap + r,
    y: Math.max(spec.y, r + P.fork.groundClear),
  }
  return { ...stage, targets: [...stage.targets, placed] }
}
