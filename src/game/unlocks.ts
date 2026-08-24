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
 *    실측 달성 판수(캠페인 중앙값)는 2·6·9·12·13·19·20·20·20·26·27·30·38·40 으로 촘촘히 깔려 있다.
 *
 * 그리고 `check` 하나만 두지 않고 `at`/`goal`을 같이 들고 있는 이유:
 * 잠긴 칸에 **"12 / 20"** 이 보이는 것과 조건 문구만 보이는 것은 전혀 다른 물건이다.
 * 전자는 다음 판을 켜게 하고 후자는 그냥 벽이다. 화면(ui/collection.ts)이 이 두 값을 쓴다.
 */
import type { ArrowKindId } from './arrows.ts'
import type { BowKindId } from './bows.ts'

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
  /** 누적 정중앙 명중 수 (명중도 ≥ P.hit.bullseyeAcc) */
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

/**
 * 진행도를 만들어내는 데 필요한 것만. `SaveData`가 이걸 만족한다.
 * 세이브 전체를 받지 않는 이유: 그러면 unlocks가 save를 import하게 되고,
 * 밸런스 도구처럼 localStorage가 없는 곳에서 이 함수를 못 쓰게 된다.
 */
export interface ProgressSource {
  stars: Record<string, number>
  bestChain: number
  bullseyes: number
  totalHits: number
  perfectRuns: number
}

/**
 * 세이브 → 진행도. **stagesCleared·totalStars는 저장하지 않고 별 지도에서 뽑는다** —
 * 두 벌로 저장하면 반드시 어긋나고, 어긋난 쪽이 해금을 열거나 막는다.
 * (별은 판당 최고값만 남고 줄지 않으므로 이 두 값도 단조 증가한다.)
 */
export function progressOf(d: ProgressSource): Progress {
  let cleared = 0
  let stars = 0
  for (const id in d.stars) {
    const n = d.stars[id] ?? 0
    if (n <= 0) continue
    cleared++
    stars += n
  }
  return {
    stagesCleared: cleared,
    totalStars: stars,
    bestChain: d.bestChain,
    bullseyes: d.bullseyes,
    totalHits: d.totalHits,
    perfectRuns: d.perfectRuns,
  }
}

// ─────────────────────────── 해금 정의 ───────────────────────────

/** 잠긴 칸의 분류 꼬리표. 이름은 가려도 **무엇의 자리인지**는 알려준다 — 그게 궁금증의 절반이다. */
export type UnlockKind = 'arrow' | 'title' | 'bow'

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
  /** 이 해금이 여는 활 (docs/BOWS.md). */
  grantsBow?: BowKindId
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

/** 활 id의 주인은 `game/bows.ts`다 — 아래 네 줄은 참조일 뿐이다. */
const B_GAKGUNG: BowKindId = 'gakgung'
const B_RECURVE: BowKindId = 'recurve'
const B_LONGBOW: BowKindId = 'longbow'
const B_COMPOUND: BowKindId = 'compound'

// ── 조건 문턱 ────────────────────────────────────────────────────
//
// 손맛 상수가 아니라 **진행 곡선**이라 params.ts(m/s/rad만 담는다)에 넣지 않았다.
// 옮기게 되면 progression 그룹 옆이 자리다.
// TODO(params): src/tune/params.ts → P.unlock.*  (밸런스 시뮬로 달성 판수를 재보고 나서)

/**
 * 활 문턱 (docs/BOWS.md 3장). 화살과 다른 지표에 걸어 두 수집이 따로 전진하게 한다.
 * 각궁을 6판에 이르게 주는 이유: "활도 모으는 것"임을 첫 챕터 안에 알려야
 * 잠긴 활 세 자루가 궁금증이 된다 (VS의 잠긴 칸 원리 — 이 파일 머리말).
 */
const G_GAKGUNG_STAGES = 6
const G_RECURVE_HITS = 45
const G_LONGBOW_STARS = 45
const G_COMPOUND_STAGES = 35

/** 첫 해금. 2판이면 "이 게임에 열 게 있다"는 걸 알기에 충분히 이르다. */
const G_BURST_STAGES = 2
/** 무손실 2판. 실측 중앙값 13판째 — 앞 판은 초보가 한두 발 흘린다. */
const G_ONESHOT_PERFECT = 2
/** 별 12개. 실측 중앙값 6판째. */
const G_FIRSTSTAR_STARS = 12
/** 4연쇄는 과녁 4개짜리 판(1-9)에서 처음 가능하다 */
const G_CHAIN_BEST = 4
/** 12판 클리어 = 챕터 2 중반 */
const G_SPLIT_STAGES = 12
/**
 * 정중앙 3회. **실측 중앙값 20판째** (`npm run balance` 캠페인 표).
 *
 * 5회로 잡았던 원안은 "명중의 14%가 정중앙"이라는 가정에서 나왔다. 실제로는 판당 0.29회다
 * (P.hit.bullseyeAcc 0.78 = 과녁 넓이의 4.8%). 문턱이 0.90이던 시절엔 0.086회라
 * 5회가 38판째, 12회는 120판을 돌려도 안 열렸다 — 그래서 문턱과 조건을 같이 고쳤다.
 */
const G_HAWK_BULLS = 3
/** 6연쇄는 과녁 6개짜리 판(2-9·2-10)에서 처음 가능하다 */
const G_AVALANCHE_BEST = 6
/** 누적 명중 60. 실측 중앙값 20판째. */
const G_HOMING_HITS = 60
/** 20판 클리어. 실측 중앙값 20판째(재도전이 거의 없다는 뜻). */
const G_PIERCE_STAGES = 20
/** 누적 명중 80. 실측 중앙값 26판째. */
const G_HUNDRED_HITS = 80
/** 별 60개. 실측 중앙값 27판째. */
const G_WIND_STARS = 60
/**
 * 무거운 살은 **30판 클리어**로 옮겼다.
 *
 * 원안(정중앙 12회)은 캠페인 실측에서 120판을 돌려도 아무도 못 열었다 (40판 안 달성 0.0%).
 * 칭호가 늦는 건 괜찮지만 **화살이 안 열리는 건 안 된다** — 열리지 않는 화살은 드래프트에
 * 영원히 안 나오고, 그러면 그 화살은 존재하지 않는 것과 같다.
 */
const G_HEAVY_STAGES = 30
/** 무손실 15판. 실측 중앙값 38판째 (40판 안 달성 78%). 마지막 칭호 직전 자리다. */
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

/** def()의 활판. 시그니처를 합치면 grants/grantsBow 를 헷갈려 넘기는 실수가 타입을 통과한다. */
function defBow(
  id: string, label: string, hint: string, at: Read, goal: number, grantsBow: BowKindId,
): UnlockDef {
  return { ...def(id, label, 'bow', hint, at, goal), grantsBow }
}

/**
 * 해금 목록. **순서 = 예상 달성 순서**다. 화면이 이 순서를 그대로 쓰므로
 * 목록을 위에서 아래로 훑으면 "지금 어디쯤 왔는지"가 그대로 읽힌다.
 *
 * 아래 "열린 판"은 추정이 아니라 `npm run balance` 캠페인 표의 **실측 중앙값**이다.
 *
 * | # | 열리는 것 | 조건 | 열린 판 |
 * |---|---|---|---|
 * | 1 | 폭발 살 | 2판 클리어 | 2판 |
 * | 2 | 칭호 한 발 | 무손실 2판 | 13판 |
 * | 3 | 칭호 첫 별 | 별 12 | 6판 |
 * | 4 | 사슬 살 | 4연쇄 | 9판 |
 * | 5 | 분열 살 | 12판 클리어 | 12판 |
 * | 6 | 칭호 매의 눈 | 정중앙 3 | 20판 |
 * | 7 | 칭호 보로로록 | 6연쇄 | 19판 |
 * | 8 | 유도 살 | 누적 명중 60 | 20판 |
 * | 9 | 관통 살 | 20판 클리어 | 20판 |
 * | 10 | 칭호 백발 | 누적 명중 80 | 26판 |
 * | 11 | 칭호 바람 읽는 자 | 별 60 | 27판 |
 * | 12 | 무거운 살 | 30판 클리어 | 30판 |
 * | 13 | 칭호 흠 없는 활 | 무손실 15판 | 38판 |
 * | 14 | 칭호 마흔 발 | 40판 클리어 | 40판 |
 *
 * 활 4자루(각궁 6판 · 리커브 ~15판 · 장궁 ~21판 · 컴파운드 35판)가 사이에 끼어 있다.
 * 문턱은 추정이다 — 다음 `npm run balance` 캠페인 실측으로 갱신할 것.
 *
 * 이름은 `game/arrows.ts`의 `ArrowKind.name`을 따른다 ('살'로 통일 · A8).
 */
export const UNLOCKS: readonly UnlockDef[] = [
  def('arrow.burst', '화전', 'arrow', `${G_BURST_STAGES}판 클리어`, P_STAGES, G_BURST_STAGES, A_BURST),
  def('title.oneshot', '한 발', 'title', `무손실로 ${G_ONESHOT_PERFECT}판 클리어`, P_PERFECT, G_ONESHOT_PERFECT),
  def('title.firststar', '첫 별', 'title', `별 ${G_FIRSTSTAR_STARS}개 모으기`, P_STARS, G_FIRSTSTAR_STARS),
  defBow('bow.gakgung', '각궁', `${G_GAKGUNG_STAGES}판 클리어`, P_STAGES, G_GAKGUNG_STAGES, B_GAKGUNG),
  def('arrow.chain', '명적', 'arrow', `한 판에서 ${G_CHAIN_BEST}연쇄`, P_CHAIN, G_CHAIN_BEST, A_CHAIN),
  def('arrow.split', '세전', 'arrow', `${G_SPLIT_STAGES}판 클리어`, P_STAGES, G_SPLIT_STAGES, A_SPLIT),
  defBow('bow.recurve', '리커브', `누적 명중 ${G_RECURVE_HITS}회`, P_HITS, G_RECURVE_HITS, B_RECURVE),
  def('title.hawk', '매의 눈', 'title', `정중앙 ${G_HAWK_BULLS}회`, P_BULLS, G_HAWK_BULLS),
  def('title.avalanche', '보로로록', 'title', `한 판에서 ${G_AVALANCHE_BEST}연쇄`, P_CHAIN, G_AVALANCHE_BEST),
  def('arrow.homing', '신전', 'arrow', `누적 명중 ${G_HOMING_HITS}회`, P_HITS, G_HOMING_HITS, A_HOMING),
  def('arrow.pierce', '애기살', 'arrow', `${G_PIERCE_STAGES}판 클리어`, P_STAGES, G_PIERCE_STAGES, A_PIERCE),
  defBow('bow.longbow', '장궁', `별 ${G_LONGBOW_STARS}개 모으기`, P_STARS, G_LONGBOW_STARS, B_LONGBOW),
  def('title.hundred', '백발', 'title', `누적 명중 ${G_HUNDRED_HITS}회`, P_HITS, G_HUNDRED_HITS),
  def('title.wind', '바람 읽는 자', 'title', `별 ${G_WIND_STARS}개 모으기`, P_STARS, G_WIND_STARS),
  def('arrow.heavy', '육량전', 'arrow', `${G_HEAVY_STAGES}판 클리어`, P_STAGES, G_HEAVY_STAGES, A_HEAVY),
  defBow('bow.compound', '컴파운드', `${G_COMPOUND_STAGES}판 클리어`, P_STAGES, G_COMPOUND_STAGES, B_COMPOUND),
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

/** 열린 활 목록. 연습궁은 해금이 아니라 시작 장비라 여기 안 나온다. */
export function unlockedBows(unlocked: readonly string[]): BowKindId[] {
  const out: BowKindId[] = []
  for (let i = 0; i < UNLOCKS.length; i++) {
    const d = UNLOCKS[i]
    if (d === undefined || d.grantsBow === undefined) continue
    if (unlocked.includes(d.id)) out.push(d.grantsBow)
  }
  return out
}

/** 이 활을 여는 해금. 없으면 처음부터 드는 활(연습궁)이다. */
export function unlockOfBow(bow: BowKindId): UnlockDef | undefined {
  for (let i = 0; i < UNLOCKS.length; i++) {
    const d = UNLOCKS[i]
    if (d !== undefined && d.grantsBow === bow) return d
  }
  return undefined
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
