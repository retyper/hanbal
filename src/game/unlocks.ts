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
  /** 누적 보스 처치 수 (10판마다 하나 — docs/RUN.md 3장) */
  bossKills: number
  /**
   * 최고 도달 판 (1-based, 여정을 넘어 줄지 않는다 — docs/RUN.md).
   *
   * 활 해금이 예전엔 bossKills(누적 처치 수)를 봤는데, 그건 **판을 갈아넣게 만드는**
   * 신호였다 — 1-10 보스만 계속 잡고 죽어 새 여정으로 돌아가면 실제로는 10판 밖을
   * 못 나갔는데도 숫자만 쌓였다 (형: "1-10보스 10번잡으면 좋은 무기 생기는게 말이
   * 되냐"). bestRunStage는 **한 여정 안에서 실제로 얼마나 깊이 갔는가**의 최댓값이라
   * 반복으로는 절대 안 늘어난다.
   */
  bestRunStage: number
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
    bossKills: 0,
    bestRunStage: 0,
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
  bossKills: number
  bestRunStage: number
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
    bossKills: d.bossKills,
    bestRunStage: d.bestRunStage,
  }
}

// ─────────────────────────── 해금 정의 ───────────────────────────

/** 잠긴 칸의 분류 꼬리표. 이름은 가려도 **무엇의 자리인지**는 알려준다 — 그게 궁금증의 절반이다. */
/**
 * 'arrow'는 2026-08-24에 빠졌다 — 특수살은 해금이 아니라 **보급받는 재고**가 됐다
 * (docs/RUN.md · 형: "처음부터 다 해금이면 안 되고, 무제한으로 쓰면 안 될 것 같다").
 * 어떤 살이 보급 풀에 들어오는가는 보스 마디 깊이가 정한다 (game/supply.ts).
 */
export type UnlockKind = 'title' | 'bow'

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
  /** 이 해금이 여는 활 (docs/BOWS.md). */
  grantsBow?: BowKindId
}

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
 * 활 문턱 — **최고 도달 판** (2026-08-26 재잠금, 이전엔 보스 처치 수였다).
 *
 * 보스 처치 수(bossKills)는 여정을 넘어 쌓이는 값이라 **여정 사이의 반복으로 늘릴 수
 * 있었다** — 1-10 보스만 계속 잡고 곧장 죽어 새 여정으로 돌아가면, 실제로는 10판
 * 밖을 한 번도 못 나갔는데도 숫자만 쌓여 결국 컴파운드가 열렸다
 * (형: "1-10보스 10번잡으면 좋은 무기 생기는게 말이 되냐 · 스테이지 몇을 깨야
 * 되게끔 만들어야지"). bestRunStage(한 여정 안에서 실제로 도달한 최댓값, 여정을
 * 넘어 줄지 않는다)로 바꿨다 — 반복 재도전으로는 절대 못 늘린다, 더 멀리 가야만 는다.
 * 값 자체(10·30·60·100)는 그대로 뒀다 — "보스 N번째 마디"와 정확히 같은 자리다.
 */
const G_GAKGUNG_STAGE = 10
const G_LONGBOW_STAGE = 30
const G_RECURVE_STAGE = 60
const G_COMPOUND_STAGE = 100

/** 무손실 2판. 실측 중앙값 13판째 — 앞 판은 초보가 한두 발 흘린다. */
const G_ONESHOT_PERFECT = 2
/** 별 12개. 실측 중앙값 6판째. */
const G_FIRSTSTAR_STARS = 12
/** 4연쇄는 과녁 4개짜리 판(1-9)에서 처음 가능하다 */
/** 12판 클리어 = 챕터 2 중반 */
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
/** 20판 클리어. 실측 중앙값 20판째(재도전이 거의 없다는 뜻). */
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
const P_DEPTH: Read = (p) => p.bestRunStage

function def(
  id: string,
  label: string,
  kind: UnlockKind,
  hint: string,
  at: Read,
  goal: number,
): UnlockDef {
  return {
    id,
    label,
    kind,
    hint,
    at,
    goal,
    check: (p: Progress): boolean => at(p) >= goal,
  }
}

/** def()의 활판. 시그니처를 합치면 grants/grantsBow 를 헷갈려 넘기는 실수가 타입을 통과한다. */
function defBow(
  id: string, label: string, hint: string, at: Read, goal: number, grantsBow: BowKindId,
): UnlockDef {
  return { ...def(id, label, 'bow', hint, at, goal), grantsBow }
}

/**
 * 해금 목록. **순서 = 예상 달성 순서**다. 화면이 이 순서를 그대로 쓴다.
 *
 * 화살 6종은 2026-08-24에 이 목록에서 빠졌다 — 특수살은 보스 보급으로 받는 **재고**다
 * (docs/RUN.md). 남은 것은 칭호(기록의 이름표)와 활(보스 처치로 여는 장비)뿐이다.
 * 문턱 실측치는 여정 구조 밸런스 시뮬이 생기면 갱신한다.
 */
/**
 * 칭호 이름 (2026-08-26, 형의 지적: "칭호는 얻어도 뭐 장착하거나 그런거 전혀없고 재미도
 * 없는 칭호야. The Return of the Bowmaster나 헬름협곡의 신궁이나 뭐 그런거 많잖아.").
 *
 * '한 발'·'첫 별'처럼 조건을 그대로 옮긴 서술어 대신, 국궁의 말(관중·몰기·백발백중)을 빌린
 * **칭호다운 칭호**로 바꿨다. id는 세이브에 남는 영구 키라 절대 안 건드린다 — label만 간다.
 */
export const UNLOCKS: readonly UnlockDef[] = [
  def('title.oneshot', '첫 무결', 'title', `무손실로 ${G_ONESHOT_PERFECT}판 클리어`, P_PERFECT, G_ONESHOT_PERFECT),
  def('title.firststar', '별을 쏘아올린 자', 'title', `별 ${G_FIRSTSTAR_STARS}개 모으기`, P_STARS, G_FIRSTSTAR_STARS),
  defBow('bow.gakgung', '각궁', `${G_GAKGUNG_STAGE}판 도달`, P_DEPTH, G_GAKGUNG_STAGE, B_GAKGUNG),
  defBow('bow.longbow', '장궁', `${G_LONGBOW_STAGE}판 도달`, P_DEPTH, G_LONGBOW_STAGE, B_LONGBOW),
  def('title.hawk', '매눈의 궁수', 'title', `정중앙 ${G_HAWK_BULLS}회`, P_BULLS, G_HAWK_BULLS),
  def('title.avalanche', '우박의 손', 'title', `한 판에서 ${G_AVALANCHE_BEST}콤보`, P_CHAIN, G_AVALANCHE_BEST),
  defBow('bow.recurve', '리커브', `${G_RECURVE_STAGE}판 도달`, P_DEPTH, G_RECURVE_STAGE, B_RECURVE),
  def('title.hundred', '백중(百中)의 손', 'title', `누적 명중 ${G_HUNDRED_HITS}회`, P_HITS, G_HUNDRED_HITS),
  def('title.wind', '바람을 읽는 궁수', 'title', `별 ${G_WIND_STARS}개 모으기`, P_STARS, G_WIND_STARS),
  defBow('bow.compound', '컴파운드', `${G_COMPOUND_STAGE}판 도달`, P_DEPTH, G_COMPOUND_STAGE, B_COMPOUND),
  def('title.flawless', '완궁(完弓)', 'title', `무손실로 ${G_FLAWLESS_PERFECT}판 클리어`, P_PERFECT, G_FLAWLESS_PERFECT),
  def('title.forty', '마흔 고비를 넘은 자', 'title', `${G_FORTY_STAGES}판 클리어`, P_STAGES, G_FORTY_STAGES),
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
