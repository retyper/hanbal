/**
 * 성장 (GDD 4장)
 *
 * 이 파일의 진짜 일은 숫자를 올리는 게 아니라 **"뭐가 늘었는지 사람 말로 번역하는 것"**이다.
 * 레벨 3이 레벨 2보다 좋다는 건 아무도 못 느낀다. "시위를 72%까지 당길 수 있다"가
 * "이제 끝까지 당겨진다"로 바뀌는 건 느낀다. statSummary가 그 번역기다.
 *
 * 물리 계수는 반드시 sim/bow.ts의 effectiveStats()에서 가져온다. 여기서 다시 정의하면
 * 성장 화면이 거짓말을 하게 된다 — 화면과 실제 활이 어긋나는 게 최악이다.
 */
import { clamp01, diminish } from '../core/math.ts'
import { effectiveStats } from '../sim/bow.ts'
import type { StageDef, Stats } from '../sim/types.ts'
import { P } from '../tune/params.ts'
import type { SaveData } from './save.ts'
import { writeSave } from './save.ts'

export type StatKey = keyof Stats

export const STAT_KEYS: readonly StatKey[] = ['str', 'steady', 'stamina', 'focus']

const LABEL: Record<StatKey, string> = {
  str: '근력',
  steady: '정확',
  stamina: '지구력',
  focus: '집중',
}

export interface RunResult {
  cleared: boolean
  score: number
  accuracy: number
  arrowsUsed: number
  /** 이 판의 명중 수. 누적 기록(해금 조건)의 분자다. */
  hits: number
}

// ─────────────────────────── 성장 비용 ───────────────────────────
//
// 후반이 비싸야 한다 (GDD 4장). 정수 레벨에서 **엄격히 증가**하는 형태로 잡았다 —
// 값이 두 레벨 연속 같으면 "올려도 그대로네"로 읽힌다.

/**
 * `level` → `level+1` 로 올리는 데 드는 훈련치.
 * 기본값에서 0→1은 2, 13→14는 25. 진짜 만작(STR 14)까지 누적 167.
 */
export function trainingCost(level: number): number {
  const l = level > 0 ? Math.floor(level) : 0
  const div = P.progression.costQuadDiv
  const quad = div > 0 ? Math.floor((l * l) / div) : 0
  return Math.max(1, Math.floor(P.progression.costBase + P.progression.costLin * l + quad))
}

/** n레벨을 한 번에 올릴 때의 총 비용. */
export function trainingCostTotal(level: number, amount: number): number {
  const n = amount > 0 ? Math.floor(amount) : 0
  let sum = 0
  for (let i = 0; i < n; i++) sum += trainingCost(level + i)
  return sum
}

// ─────────────────────────── 판 보상 ───────────────────────────
//
// 실패해도 0을 주지 않는다. "손해 본 판"이 있으면 아무 때나 못 끊는다 (C2).

/**
 * 가장 낮은 스탯. 첫 클리어 보너스가 여기로 간다.
 * 순서 고정이라 동점에서도 결정론적이다 — 같은 세이브면 같은 결과.
 */
function weakest(stats: Stats): StatKey {
  let best: StatKey = 'str'
  let bestLv = Number.POSITIVE_INFINITY
  for (let i = 0; i < STAT_KEYS.length; i++) {
    const k = STAT_KEYS[i]
    if (k === undefined) continue
    const lv = stats[k]
    if (lv < bestLv) {
      bestLv = lv
      best = k
    }
  }
  return best
}

/**
 * 판이 끝났다. 훈련치를 주고, 화살을 소모하고, 기록을 남기고 저장한다.
 *
 * 화살은 **판 진입이 아니라 실제로 쏜 만큼** 소모한다. 진입 과금이면
 * 판을 켜놓고 자리를 뜬 사람이 손해를 본다 — C2 위반이다.
 *
 * `leveled`: 이번 판으로 **저절로** 오른 스탯. 첫 클리어 때 가장 약한 곳이 하나 오른다.
 * GDD 2장 "어느 날 갑자기 는다" — 훈련치를 모으는 것과 별개로, 판을 깨면 몸이 는다.
 */
export function awardRun(
  d: SaveData,
  stage: StageDef,
  r: RunResult,
  /**
   * 판 채점 결과 (game/rewards.ts). 주면 훈련치는 **여기서 다시 계산하지 않고** 그 값을 쓴다.
   * 두 곳이 각자 훈련치를 만들면 한 판에 두 번 지급된다 — 배선의 가장 흔한 사고다.
   */
  reward?: { training: number },
): { training: number; leveled: StatKey[] } {
  const leveled: StatKey[] = []

  const used = r.arrowsUsed > 0 ? Math.floor(r.arrowsUsed) : 0
  const acc = clamp01(r.accuracy)
  const score = r.score > 0 ? Math.floor(r.score) : 0
  const hits = r.hits > 0 ? Math.floor(r.hits) : 0

  d.totalShots += used
  // 실제 명중 수를 센다. 정확도에서 역산하면 관통·분열로 한 발이 여럿을 맞힌 판에서 어긋난다.
  d.totalHits += hits
  d.arrows = d.arrows > used ? d.arrows - used : 0

  // 첫 클리어인가. **점수로 판정하지 않는다** — 클리어 조건이 "과녁 전멸"로 바뀌면서
  // 점수와 클리어가 갈라졌다 (sim/world.ts evaluateEnd). 별을 한 번도 못 받았으면 처음이다.
  const firstClear = r.cleared && (d.stars[stage.id] ?? 0) <= 0
  const best = d.bestScore[stage.id] ?? 0
  if (score > best) d.bestScore[stage.id] = score

  let t: number
  if (reward !== undefined) {
    t = reward.training
  } else {
    t = r.cleared ? P.progression.trainClear : P.progression.trainFail
    t += acc * P.progression.trainAccuracy
  }
  if (firstClear) t += P.progression.trainFirstClear
  // 오프라인 축적을 끈 사람은 판에서 전부 벌어야 한다 (GDD 5장 등가 보상).
  if (!d.offlineEnabled) t *= P.offline.optOutBonus

  const training = t > 0 ? Math.floor(t) : 0
  d.training += training

  if (firstClear) {
    const key = weakest(d.stats)
    d.stats[key] += 1
    leveled.push(key)
  }

  writeSave(d)
  return { training, leveled }
}

/**
 * 이 판에 지급할 화살.
 *
 * 화살은 **잠금장치가 아니라 여유분**이다. 보유분이 넉넉하면 스테이지가 정한 만큼 온전히 쏘고,
 * 바닥나면 최소 보장(P.progression.minArrows)만 들고 빠듯하게 쏜다.
 * "화살이 없어서 아무것도 못 하는" 상태는 만들지 않는다 — 그건 GDD 9장이 금지한 에너지 게이트고,
 * 공부하다 3분 쉬러 온 사람에게 "내일 오세요"라고 말하는 구조다 (C2·C4).
 *
 * 소모는 여기서 하지 않는다. awardRun이 **실제로 쏜 만큼**만 뺀다.
 */
export function grantArrows(d: SaveData, stage: StageDef): number {
  // 바닥은 스테이지 **상대값**이어야 한다. 상수 3발이면 3명중을 요구하는 판(1-9·1-10)에서
  // 병목이 아니라 벽이 된다 — 한 발 명중률 30%로 3발 3명중은 약 3%다.
  // 여기서 빠듯함은 여벌(화살 - 요구 명중)이 줄어드는 것으로 표현되지, 요구가 불가능해지는 것으로는 아니다.
  const min = Math.max(
    1,
    Math.floor(P.progression.minArrows),
    stage.arrows - Math.floor(P.progression.spareCut),
  )
  const have = d.arrows > 0 ? Math.floor(d.arrows) : 0
  const want = have > min ? have : min
  return want < stage.arrows ? want : stage.arrows
}

/**
 * 훈련치를 써서 스탯을 올린다. `amount`는 **올릴 레벨 수**다 (훈련치 양이 아니다).
 * 모자라면 아무것도 하지 않고 false. 부분 지불은 없다 — 눌렀는데 절반만 오르면 못 읽는다.
 */
export function spendTraining(d: SaveData, key: StatKey, amount: number): boolean {
  const n = amount > 0 ? Math.floor(amount) : 0
  if (n <= 0) return false
  const from = d.stats[key]
  if (typeof from !== 'number' || !Number.isFinite(from)) return false

  const cost = trainingCostTotal(from, n)
  if (d.training < cost) return false

  d.training -= cost
  d.stats[key] = from + n
  writeSave(d)
  return true
}

// ─────────────────────── 물리 → 사람 말 번역 ───────────────────────

/**
 * **빨간 바까지** 버티는 시간(s). 붕괴까지가 아니다.
 *
 * 붕괴(staminaMax / drain)로 재면 안 되는 이유: 새 모델에서 붕괴는 아무도 겪지 않는 변두리
 * 사건이고, 플레이어가 실제로 쓰는 예산은 경계선까지의 시간뿐이다. 그 아래 구간은 이미
 * 빗나가는 구간이라 "버틴다"고 부를 수 없다. 붕괴 기준으로 말하면 화면이 예산을 2.5배로
 * 부풀려 말하게 된다 — 훈련치를 어디 쓸지 고를 때 보는 유일한 숫자가 거짓이 된다.
 *
 * bow.ts의 소모식과 같은 식이다: drain = drawDrain × draw^drainByDraw (평상호흡 기준).
 */
function safeSeconds(maxDraw: number, staminaMax: number): number {
  const drain = P.stamina.drawDrain * Math.pow(maxDraw, P.stamina.drainByDraw)
  return drain > 0
    ? staminaMax * (1 - P.stamina.steadyZone) / drain
    : Number.POSITIVE_INFINITY
}

/** 만작에서의 화살 초속. ballistics.ts의 spawnArrow와 같은 식. */
function fullDrawSpeed(maxDraw: number, speedMul: number): number {
  const t = Math.pow(maxDraw, P.bow.drawCurve)
  return (P.bow.minSpeed + (P.bow.maxSpeed - P.bow.minSpeed) * t) * speedMul
}

/**
 * 릴리즈 산포 감소율. bow.ts의 dScatterMul과 같은 식이다.
 * DerivedStats에 없어서 여기서 다시 푼다 — 계약(types.ts)에 scatterMul이 생기면 이 함수는 지운다.
 */
function scatterCut(focus: number): number {
  const e = diminish(focus > 0 ? focus : 0, P.growth.diminishAt, P.growth.diminishRate)
  return 1 - 1 / (1 + e * P.growth.focusToScatter)
}

const pct = (v: number): number => Math.round(v * 100)

/**
 * 이 위면 "끝까지 당겨진다"로 말한다. 부동소수점 오차 여유일 뿐 손맛 노브가 아니라 여기 둔다
 * (params.ts는 m/s/rad만 담기로 한 규약).
 */
const FULL_DRAW_EPS = 0.995

/**
 * 스탯 하나가 지금 몸으로 뭘 해주는지 한 문장으로. **숫자 나열 금지.**
 * 성장 화면은 이 문장의 '전 → 후'를 나란히 보여준다.
 */
export function effectOf(stats: Stats, key: StatKey): string {
  const ds = effectiveStats(stats)
  switch (key) {
    case 'str':
      // 성장의 가장 큰 체감 지점. 초보는 시위가 끝까지 당겨지지 않는다 (GDD 2장).
      return ds.maxDraw >= FULL_DRAW_EPS
        ? `이제 끝까지 당겨진다 · 화살 ${Math.round(fullDrawSpeed(ds.maxDraw, ds.speedMul))}m/s`
        : `시위를 ${pct(ds.maxDraw)}%까지 당길 수 있다`
    case 'stamina': {
      const s = safeSeconds(ds.maxDraw, ds.staminaMax)
      return Number.isFinite(s) ? `빨간 바까지 ${s.toFixed(1)}초 버틴다` : '빨간 바를 넘지 않는다'
    }
    case 'steady': {
      const cut = pct(1 - ds.tremorMul)
      // 떨림은 빨간 바를 넘긴 뒤에만 생긴다. "만작에 닿으면"은 옛 모델의 말이다.
      return cut <= 0 ? '빨간 바를 넘으면 손이 그대로 떨린다' : `빨간 바 아래에서 떨림 ${cut}% 감소`
    }
    case 'focus': {
      const cut = pct(scatterCut(stats.focus))
      return cut <= 0 ? '놓는 손이 아직 거칠다' : `놓는 순간 오차 ${cut}% 감소`
    }
  }
}

export function statLabel(key: StatKey): string {
  return LABEL[key]
}

export function statSummary(
  stats: Stats,
): Array<{ key: StatKey; label: string; level: number; effect: string }> {
  const out: Array<{ key: StatKey; label: string; level: number; effect: string }> = []
  for (let i = 0; i < STAT_KEYS.length; i++) {
    const k = STAT_KEYS[i]
    if (k === undefined) continue
    out.push({ key: k, label: LABEL[k], level: stats[k], effect: effectOf(stats, k) })
  }
  return out
}

/** 한 레벨 올렸을 때의 문장. 성장 화면의 '→ 이후' 칸. 실제 스탯은 건드리지 않는다. */
export function effectAfterLevel(stats: Stats, key: StatKey): string {
  // UI 전용 경로다. 핫 루프가 아니므로 임시 객체를 만들어도 A5에 걸리지 않는다.
  const next: Stats = { str: stats.str, steady: stats.steady, stamina: stats.stamina, focus: stats.focus }
  next[key] += 1
  return effectOf(next, key)
}

/** 지금 훈련치로 올릴 수 있는 스탯이 하나라도 있는가. HUD의 작은 점이 이걸 본다. */
export function canGrow(d: SaveData): boolean {
  for (let i = 0; i < STAT_KEYS.length; i++) {
    const k = STAT_KEYS[i]
    if (k === undefined) continue
    if (d.training >= trainingCost(d.stats[k])) return true
  }
  return false
}
