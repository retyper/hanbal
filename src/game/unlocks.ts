/**
 * 해금 — 잠긴 칸을 보여준다 (docs/HOOK.md ★2)
 *
 * Vampire Survivors의 해금 목록이 강력한 이유는 항목을 잘 줘서가 아니라
 * **잠긴 칸을 대놓고 보여주기 때문**이다. 뭔지 모르는 칸이 눈에 보이면 열고 싶어진다.
 * 그래서 이 파일의 진짜 산출물은 "열린 목록"이 아니라 **아직 안 열린 목록**이다.
 *
 * 조건 설계 규칙 두 가지 — 둘 다 GDD 1장 제약에서 나온다.
 *
 * 1. **갈아넣게 만들지 않는다** (C3). 조건은 전부 "판을 계속 깨다 보면 저절로 지나가는 값"이다.
 *    별도의 그라인드 구간을 만들면 공부를 잡아먹는다. 접속·연속 플레이·시간 조건은 없다 (GDD 9장).
 * 2. **항상 2~3개가 손에 닿는 거리에 있다.** 잠긴 칸이 너무 멀면 궁금증이 아니라 체념이 된다.
 *    아래 목록은 예상 달성 판수가 2·6·7·9·12·13·19·19·24·27·28·33·40 으로 촘촘히 깔려 있다.
 *
 * 그리고 `check` 하나만 두지 않고 `at`/`goal`을 같이 들고 있는 이유:
 * 잠긴 칸에 **"12 / 20"** 이 보이는 것과 조건 문구만 보이는 것은 전혀 다른 물건이다.
 * 전자는 다음 판을 켜게 하고 후자는 그냥 벽이다. 화면(ui/collection.ts)이 이 두 값을 쓴다.
 */
import type { ArrowKindId } from './arrows.ts'

// ─────────────────────────── 진행도 ───────────────────────────

/**
 * 해금 조건이 읽는 누적 기록. 세이브에서 만들어 넘긴다.
 *
 * 전부 **단조 증가**하는 값만 둔다. 줄어드는 값이 조건에 끼면 해금이 도로 잠기는 것처럼
 * 보이거나(실제로 잠그지는 않지만) 진행 막대가 뒤로 간다 — "성장은 되돌아가지 않는다"(GDD 4장)에 어긋난다.
 */
export interface Progress {
  /** 서로 다른 판을 몇 개 깼는가 (같은 판 재도전은 세지 않는다) */
  stagesCleared: number
  /** 모든 판의 별 합 (판당 0~3) */
  totalStars: number
  /** 한 판에서 이어간 최고 연쇄 수 (연속 명중이 끊기지 않은 최댓값) */
  bestChain: number
  /** 누적 정중앙 명중 수 (명중도 ≥ BULLSEYE_ACC) */
  bullseyes: number
  /** 누적 명중 수 */
  totalHits: number
  /** 누적 무손실 클리어 판수 (★★★을 받은 횟수) */
  perfectRuns: number
}

/** 아직 아무것도 안 한 사람. 세이브가 없을 때의 기준점. */
export function emptyProgress(): Progress {
  return {
    stagesCleared: 0,
    totalStars: 0,
    bestChain: 0,
    bullseyes: 0,
    totalHits: 0,
    perfectRuns: 0,
  }
}

// ─────────────────────────── 해금 정의 ───────────────────────────

/** 잠긴 칸의 분류 꼬리표. 이름은 가려도 **무엇의 자리인지**는 알려준다 — 그게 궁금증의 절반이다. */
export type UnlockKind = 'arrow' | 'title'

export interface UnlockDef {
  /** 세이브에 남는 영구 id. 절대 바꾸지 않는다 (바꾸면 남의 세이브에서 해금이 사라진다). */
  id: string
  /** 열렸을 때 보이는 한글 이름 */
  label: string
  /** 조건 설명 (한글). **잠겨 있어도 보인다.** */
  hint: string
  kind: UnlockKind
  /** 조건의 현재 값. 진행 막대용. */
  at(p: Progress): number
  /** 조건의 목표 값 */
  goal: number
  /** 달성 여부. at/goal과 항상 같은 답을 낸다. */
  check(p: Progress): boolean
  /** 이 해금이 여는 화살. 칭호에는 없다. */
  grants?: ArrowKindId
}

/**
 * 화살 id의 주인은 `game/arrows.ts`다 — 여기 적힌 여섯 줄은 참조일 뿐이다.
 * 이름이 어긋나면 타입이 먼저 잡아준다(그게 이 상수들이 한 줄씩 따로 있는 이유다).
 */
const A_PIERCE: ArrowKindId = 'pierce'
const A_BURST: ArrowKindId = 'burst'
const A_CHAIN: ArrowKindId = 'chain'
const A_SPLIT: ArrowKindId = 'split'
const A_HOMING: ArrowKindId = 'homing'
const A_HEAVY: ArrowKindId = 'heavy'

// ── 조건 문턱 ────────────────────────────────────────────────────
//
// 손맛 상수가 아니라 **진행 곡선**이라 params.ts(m/s/rad만 담는다)에 넣지 않았다.
// 옮기게 되면 progression 그룹 옆이 자리다.
// TODO(params): src/tune/params.ts → P.unlock.*  (밸런스 시뮬로 달성 판수를 재보고 나서)

/** 첫 해금. 2판이면 "이 게임에 열 게 있다"는 걸 알기에 충분히 이르다. */
const G_BURST_STAGES = 2
/** 무손실 2판 ≈ 5판째 */
const G_ONESHOT_PERFECT = 2
/** 별 12개 ≈ 6판 (판당 평균 2.2개 가정) */
const G_FIRSTSTAR_STARS = 12
/** 4연쇄는 과녁 4개짜리 판(1-9)에서 처음 가능하다 */
const G_CHAIN_BEST = 4
/** 12판 클리어 = 챕터 2 중반 */
const G_SPLIT_STAGES = 12
/** 정중앙 5회 ≈ 13판째 (명중의 14%가 정중앙이라 가정 — 가장 불확실한 추정) */
const G_HAWK_BULLS = 5
/** 6연쇄는 과녁 6개짜리 판(2-9·2-10)에서 처음 가능하다 */
const G_AVALANCHE_BEST = 6
/** 누적 명중 60 ≈ 19판째 (판당 과녁 수 합계 기준) */
const G_HOMING_HITS = 60
/** 20판 클리어. arrows.ts의 관통 살 unlockHint와 같은 조건이다. */
const G_PIERCE_STAGES = 20
/** 누적 명중 80 ≈ 24판째 */
const G_HUNDRED_HITS = 80
/** 별 60개 ≈ 27판째 */
const G_WIND_STARS = 60
/** 정중앙 12회 ≈ 28판째 */
const G_HEAVY_BULLS = 12
/** 무손실 15판 ≈ 33판째 */
const G_FLAWLESS_PERFECT = 15
/** 마지막 칸. 40판 전부. */
const G_FORTY_STAGES = 40

type Read = (p: Progress) => number

const P_STAGES: Read = (p) => p.stagesCleared
const P_STARS: Read = (p) => p.totalStars
const P_CHAIN: Read = (p) => p.bestChain
const P_BULLS: Read = (p) => p.bullseyes
const P_HITS: Read = (p) => p.totalHits
const P_PERFECT: Read = (p) => p.perfectRuns

function def(
  id: string,
  label: string,
  kind: UnlockKind,
  hint: string,
  at: Read,
  goal: number,
  grants?: ArrowKindId,
): UnlockDef {
  const base = {
    id,
    label,
    kind,
    hint,
    at,
    goal,
    check: (p: Progress): boolean => at(p) >= goal,
  }
  // exactOptionalPropertyTypes — grants는 있을 때만 붙인다.
  return grants === undefined ? base : { ...base, grants }
}

/**
 * 해금 목록. **순서 = 예상 달성 순서**다. 화면이 이 순서를 그대로 쓰므로
 * 목록을 위에서 아래로 훑으면 "지금 어디쯤 왔는지"가 그대로 읽힌다.
 *
 * | # | 열리는 것 | 조건 | 예상 |
 * |---|---|---|---|
 * | 1 | 폭발 살 | 2판 클리어 | 2판 |
 * | 2 | 칭호 한 발 | 무손실 2판 | 5판 |
 * | 3 | 칭호 첫 별 | 별 12 | 6판 |
 * | 4 | 사슬 살 | 4연쇄 | 9판 |
 * | 5 | 분열 살 | 12판 클리어 | 12판 |
 * | 6 | 칭호 매의 눈 | 정중앙 5 | 13판 |
 * | 7 | 칭호 보로로록 | 6연쇄 | 19판 |
 * | 8 | 유도 살 | 누적 명중 60 | 19판 |
 * | 9 | 관통 살 | 20판 클리어 | 20판 |
 * | 10 | 칭호 백발 | 누적 명중 80 | 24판 |
 * | 11 | 칭호 바람 읽는 자 | 별 60 | 27판 |
 * | 12 | 무거운 살 | 정중앙 12 | 28판 |
 * | 13 | 칭호 흠 없는 활 | 무손실 15판 | 33판 |
 * | 14 | 칭호 마흔 발 | 40판 클리어 | 40판 |
 *
 * 이름은 `game/arrows.ts`의 `ArrowKind.name`을 따른다 ('살'로 통일 · A8).
 */
export const UNLOCKS: readonly UnlockDef[] = [
  def('arrow.burst', '폭발 살', 'arrow', `${G_BURST_STAGES}판 클리어`, P_STAGES, G_BURST_STAGES, A_BURST),
  def('title.oneshot', '한 발', 'title', `무손실로 ${G_ONESHOT_PERFECT}판 클리어`, P_PERFECT, G_ONESHOT_PERFECT),
  def('title.firststar', '첫 별', 'title', `별 ${G_FIRSTSTAR_STARS}개 모으기`, P_STARS, G_FIRSTSTAR_STARS),
  def('arrow.chain', '사슬 살', 'arrow', `한 판에서 ${G_CHAIN_BEST}연쇄`, P_CHAIN, G_CHAIN_BEST, A_CHAIN),
  def('arrow.split', '분열 살', 'arrow', `${G_SPLIT_STAGES}판 클리어`, P_STAGES, G_SPLIT_STAGES, A_SPLIT),
  def('title.hawk', '매의 눈', 'title', `정중앙 ${G_HAWK_BULLS}회`, P_BULLS, G_HAWK_BULLS),
  def('title.avalanche', '보로로록', 'title', `한 판에서 ${G_AVALANCHE_BEST}연쇄`, P_CHAIN, G_AVALANCHE_BEST),
  def('arrow.homing', '유도 살', 'arrow', `누적 명중 ${G_HOMING_HITS}회`, P_HITS, G_HOMING_HITS, A_HOMING),
  def('arrow.pierce', '관통 살', 'arrow', `${G_PIERCE_STAGES}판 클리어`, P_STAGES, G_PIERCE_STAGES, A_PIERCE),
  def('title.hundred', '백발', 'title', `누적 명중 ${G_HUNDRED_HITS}회`, P_HITS, G_HUNDRED_HITS),
  def('title.wind', '바람 읽는 자', 'title', `별 ${G_WIND_STARS}개 모으기`, P_STARS, G_WIND_STARS),
  def('arrow.heavy', '무거운 살', 'arrow', `정중앙 ${G_HEAVY_BULLS}회`, P_BULLS, G_HEAVY_BULLS, A_HEAVY),
  def('title.flawless', '흠 없는 활', 'title', `무손실로 ${G_FLAWLESS_PERFECT}판 클리어`, P_PERFECT, G_FLAWLESS_PERFECT),
  def('title.forty', '마흔 발', 'title', `${G_FORTY_STAGES}판 클리어`, P_STAGES, G_FORTY_STAGES),
]

// ─────────────────────────── 조회 ───────────────────────────

export function unlockById(id: string): UnlockDef | undefined {
  for (let i = 0; i < UNLOCKS.length; i++) {
    const d = UNLOCKS[i]
    if (d !== undefined && d.id === id) return d
  }
  return undefined
}

/**
 * 새로 열린 것만 돌려준다. 판이 끝날 때 한 번 부른다.
 *
 * **이미 열린 것을 되돌리지 않는다.** 조건이 나중에 바뀌어(튜닝) 지금 기록으로는 못 여는
 * 항목이 생겨도, 가진 걸 뺏지 않는다 — 세이브를 깨뜨리지 않는다는 A4의 정신이다.
 * 그래서 반환값은 "지금 조건을 만족하는 전부"가 아니라 **차집합**이다.
 */
export function evaluateUnlocks(p: Progress, already: readonly string[]): string[] {
  const out: string[] = []
  for (let i = 0; i < UNLOCKS.length; i++) {
    const d = UNLOCKS[i]
    if (d === undefined) continue
    if (already.includes(d.id)) continue
    if (d.check(p)) out.push(d.id)
  }
  return out
}

/** 열려 있는 화살 종류. 드래프트가 후보를 고를 때 쓴다. */
export function unlockedArrows(unlocked: readonly string[]): ArrowKindId[] {
  const out: ArrowKindId[] = []
  for (let i = 0; i < UNLOCKS.length; i++) {
    const d = UNLOCKS[i]
    if (d === undefined || d.grants === undefined) continue
    if (unlocked.includes(d.id)) out.push(d.grants)
  }
  return out
}

/** 이 화살을 여는 해금. 없으면 처음부터 쓸 수 있는 화살(basic)이다. */
export function unlockOfArrow(arrow: ArrowKindId): UnlockDef | undefined {
  for (let i = 0; i < UNLOCKS.length; i++) {
    const d = UNLOCKS[i]
    if (d !== undefined && d.grants === arrow) return d
  }
  return undefined
}

/**
 * 화살 하나의 해금 조건 문구. **조건의 주인은 이 파일이다** —
 * `arrows.ts`의 `unlockHint`는 조건을 판정하지 않으므로, 문턱을 여기서 튜닝하면
 * 그쪽 문구가 조용히 거짓말이 된다. 드래프트·수집 화면은 이 함수를 쓴다.
 */
export function unlockHintFor(arrow: ArrowKindId): string {
  return unlockOfArrow(arrow)?.hint ?? ''
}

/**
 * 지금 달고 있는 칭호. 목록 뒤쪽일수록 어려운 조건이라 **가장 나중 것**이 현재 칭호다.
 * 없으면 빈 문자열 — 화면이 "아직 칭호가 없다"를 그린다.
 */
export function currentTitle(unlocked: readonly string[]): string {
  let title = ''
  for (let i = 0; i < UNLOCKS.length; i++) {
    const d = UNLOCKS[i]
    if (d === undefined || d.kind !== 'title') continue
    if (unlocked.includes(d.id)) title = d.label
  }
  return title
}

/**
 * 아직 잠긴 것 중 **가장 가까운 것부터** n개. 화면 위쪽에 이걸 올려두면
 * "다음에 뭐가 열리는가"가 스크롤 없이 보인다.
 * 남은 양의 절대값이 아니라 **달성률**로 재는 이유: 목표가 40인 조건과 3인 조건을
 * 남은 개수로 비교하면 언제나 작은 목표가 이긴다.
 */
export function nearestLocked(p: Progress, unlocked: readonly string[], n: number): UnlockDef[] {
  const rest: UnlockDef[] = []
  for (let i = 0; i < UNLOCKS.length; i++) {
    const d = UNLOCKS[i]
    if (d === undefined || unlocked.includes(d.id)) continue
    rest.push(d)
  }
  rest.sort((a, b) => ratio(b, p) - ratio(a, p))
  return rest.slice(0, n > 0 ? Math.floor(n) : 0)
}

/** 달성률 0..1. 진행 막대와 정렬이 같은 값을 본다. */
export function ratio(d: UnlockDef, p: Progress): number {
  if (d.goal <= 0) return 1
  const v = d.at(p) / d.goal
  return v < 0 ? 0 : v > 1 ? 1 : v
}
