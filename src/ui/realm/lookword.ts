/**
 * 깃발 짐작의 숫자를 화면 말로 (형 10-26: "어느정도가 +- 범위이고 어느정도가 확률인지" · docs/realm/ODDS.md 「싸움 합 깃발」).
 * 폭은 늘 바깥으로 둥글린다 — 보인 폭이 엔진이 셈한 폭(tactics.lookRound)을 품는다.
 *  - 잃을 군사: warLookMenStep 단위 (백 명을 넘으면 10, 천 명을 넘으면 100 — 앞 두 자리만)
 *  - 사기: 처음 사기를 100 으로 한 점
 *  - 확률: warLookPctStep 단위 · 0%·100% 는 참일 때만
 * 엔진이 셈한 폭이 한 값이면(퇴각처럼 굴림이 없으면) 그 값 하나만.
 */
import type { Look } from '../../realm/types.ts'
import { P } from '../../tune/params.ts'

export interface LookNums {
  /** 우리·적이 잃을 사람 [적게, 많이] */
  readonly us: readonly [number, number]
  readonly foe: readonly [number, number]
  /** 사기의 바뀜 [나쁠 때, 좋을 때] — 점 */
  readonly usMor: readonly [number, number]
  readonly foeMor: readonly [number, number]
  /** 사로잡을 확률 [아래, 위] — % */
  readonly cap?: readonly [number, number]
}

/** 엔진의 셈에서 묻어나는 아주 작은 찌꺼기는 0 으로 */
const snap = (x: number): number => (Math.abs(x) < 1e-6 ? 0 : x)
const one = (x: readonly [number, number], tight: number): number | null => (x[1] - x[0] < tight ? (x[0] + x[1]) / 2 : null)

function menRange(x: readonly [number, number]): [number, number] {
  const lo = snap(x[0])
  const hi = snap(x[1])
  const v = one([lo, hi], 0.5)
  if (v !== null) return [Math.round(v), Math.round(v)]
  const step = Math.max(P.realm.warLookMenStep, 10 ** (Math.floor(Math.log10(Math.max(1, hi))) - 1))
  return [Math.floor(lo / step) * step, Math.ceil(hi / step) * step]
}

function morRange(x: readonly [number, number]): [number, number] {
  const lo = snap(x[0])
  const hi = snap(x[1])
  const v = one([lo, hi], 0.5)
  if (v !== null) return [Math.round(v), Math.round(v)]
  return [Math.floor(lo), Math.ceil(hi)]
}

function pctRange(x: readonly [number, number]): [number, number] {
  const st = P.realm.warLookPctStep
  // 참이 아닌데 0%·100% 로 보이지 않게 — 맨 끝 칸 안쪽으로
  const inner = (p: number, v: number): number => (p <= 0 ? 0 : p >= 1 ? 100 : Math.round(Math.min(1 - st, Math.max(st, v)) * 100))
  const v = one(x, 0.005)
  if (v !== null) return [inner(v, Math.round(v / st) * st), inner(v, Math.round(v / st) * st)]
  return [inner(x[0], Math.floor(x[0] / st) * st), inner(x[1], Math.ceil(x[1] / st) * st)]
}

export function lookNums(lk: Look): LookNums {
  return {
    us: menRange(lk.us), foe: menRange(lk.foe), usMor: morRange(lk.usMor), foeMor: morRange(lk.foeMor),
    ...(lk.capture !== undefined ? { cap: pctRange(lk.capture) } : {}),
  }
}

/**
 * 짐작 표의 한 줄 — 플레이어에게 [가장 나쁠 때, 가장 좋을 때] 와 그 좋고 나쁨 (형 10-26: "왼쪽 게 최악 오른쪽 게 최선(유저 입장) ·
 * 나쁜 경우면 붉은색이 진해지고 좋은 경우는 녹색이 진해지게 · 0 은 회색"). good: 이 값이 플레이어에게 좋은가 · k: 짙기 0~1
 */
export interface LookCell { readonly v: number; readonly good: boolean | null; readonly k: number }
const cell = (v: number, goodIfPositive: boolean, ref: number): LookCell => ({
  v, good: v === 0 ? null : (v > 0) === goodIfPositive, k: v === 0 ? 0 : Math.min(1, Math.log10(1 + Math.abs(v)) / Math.log10(1 + ref)),
})
/** 우리·적의 군사 바뀜 · 사기 바뀜 — 각 [최악, 최선] (플레이어 쪽에서) */
export function lookCells(n: LookNums): { usMen: [LookCell, LookCell]; foeMen: [LookCell, LookCell]; usMor: [LookCell, LookCell]; foeMor: [LookCell, LookCell] } {
  const M = P.realm.warLookColorMen
  const S = P.realm.warLookColorMor
  return {
    // 우리가 잃는 군사 — 많이 잃을 때가 최악
    usMen: [cell(-n.us[1], true, M), cell(-n.us[0], true, M)],
    // 적이 잃는 군사 — 적게 잃을 때가 최악 (적이 잃는 건 우리에게 좋다)
    foeMen: [cell(-n.foe[0], false, M), cell(-n.foe[1], false, M)],
    // 우리 사기 — 낮을 때가 최악
    usMor: [cell(n.usMor[0], true, S), cell(n.usMor[1], true, S)],
    // 적 사기 — 오를 때가 최악 (적 사기가 오르는 건 우리에게 나쁘다)
    foeMor: [cell(n.foeMor[1], false, S), cell(n.foeMor[0], false, S)],
  }
}
/** 표의 숫자 한 칸 — 「−100」 · 「+16」 · 「0」 */
export const signed = (v: number): string => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0')
/** 붉은빛·녹빛 — 짙기 k 만큼 옅은 빛에서 짙은 빛으로 (0 은 회색) */
export function cellColor(c: LookCell): string {
  if (c.good === null) return '#9a948a'
  const [a, b] = c.good ? [[184, 200, 172], [74, 230, 96]] : [[214, 180, 170], [255, 66, 48]]
  const t = 0.25 + 0.75 * c.k
  const m = a.map((x, i) => Math.round(x + (b[i]! - x) * t))
  return `rgb(${m[0]}, ${m[1]}, ${m[2]})`
}

/** 잃을 사람 — 「−40~−70명」 · 「0명」 */
export function menText(x: readonly [number, number]): string {
  const t = (v: number): string => (v === 0 ? '0' : `−${v}`)
  return x[0] === x[1] ? `${t(x[0])}명` : `${t(x[0])}~${t(x[1])}명`
}

/** 사기 — 「−8~−3」 · 「+2」 */
export function morText(x: readonly [number, number]): string {
  const t = (v: number): string => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0')
  return x[0] === x[1] ? t(x[0]) : `${t(x[0])}~${t(x[1])}`
}

/** 한 확률 — 굴린 판 가운데 그리된 몫 (무너질 몫 · warLookPctStep 단위). 굴려 본 판이라 다 그랬어도 100% 라 하지 않는다 (ODDS: 「확실」은 참일 때만) */
export function oneChance(p: number): number {
  const st = P.realm.warLookPctStep
  if (p <= 0) return 0
  return Math.round(Math.min(1 - st, Math.max(st, Math.round(p / st) * st)) * 100)
}

/** 확률 — 「25~40%」 · 「30%」 */
export function pctText(x: readonly [number, number]): string {
  return x[0] === x[1] ? `${x[0]}%` : `${x[0]}~${x[1]}%`
}
