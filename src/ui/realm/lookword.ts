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

/** 확률 — 「25~40%」 · 「30%」 */
export function pctText(x: readonly [number, number]): string {
  return x[0] === x[1] ? `${x[0]}%` : `${x[0]}~${x[1]}%`
}
