/**
 * 열전 장수 서기 칸 (형 11-23 「기본 idle 은 서 있는 자세 2컷으로 텀 길게 · 가끔 큰 숨 · 개성 있게」 · 「idle 을 코드로 짜서 몸이 잘린다」) — 화면만 · 칸 고르기만.
 * 판 상태에 아무것도 쓰지 않는다. 시계는 쉬기 시작한 뒤의 초(판 위 · hero-motion.ts) 또는 메뉴 시각(초상). 난수 없이 띠 이름과 시각으로만 정한다.
 * 계획이 없는 띠는 예전 그대로(HAEBI_ANIM.idle 을 idleTime 초마다 · 판 시각). 수치는 HAEBI_IDLE.
 */
import { HAEBI_ANIM as A, HAEBI_IDLE as I } from '../tune/params.ts'

/** 띠 하나의 서기 계획 — cells 띠 칸 수 · base 서기 칸들(hold 초씩) · blink 눈 감는 칸 · breath 큰 숨 칸들 · quirk 버릇 칸들(quirkTimes 칸마다 초 · 없으면 HAEBI_IDLE.quirkStep) · fall 쓰러지는 칸 차례(raid/ko.ts · 없으면 18 → 19) */
export interface IdlePlan { cells: number; base: readonly number[]; hold: number; blink?: number; breath?: readonly number[]; quirk?: readonly number[]; quirkTimes?: readonly number[]; fall?: readonly number[] }
export type IdleEventKind = 'blink' | 'breath' | 'quirk'
export interface IdleEvent { kind: IdleEventKind; at: number; end: number }

const PLANS: Readonly<Record<string, IdlePlan>> = I.plans
/** 띠 칸 수 기본값 (열전 정규 띠) */
export const STRIP_CELLS = 20
/** 계획이 없는 띠 — 예전 서기 그대로 */
export const DEFAULT_IDLE: IdlePlan = { cells: STRIP_CELLS, base: A.idle, hold: A.idleTime }

/**
 * 덧 띠 — 본 띠(gen-X.png · 칸 0~19)는 늘 20칸 그대로 두고, 20 칸부터는 곁 그림 gen-X-x.png 에 잇는다 (같은 칸 크기·발 줄 · 칸 n 은 덧 띠의 n − 20 째).
 * 본편 전장·장수 고리처럼 20칸을 가정하는 곳은 본 띠만 읽어 그대로다 (11-23)
 */
export const isCompanion = (path: string) => /-x\.png$/.test(path)
/** 그림 길 → 그 띠의 덧 띠 길 (2배 _hd 판도 보통 덧 띠를 쓴다 · 그리는 키가 같아 섞여도 크기가 맞다) */
export const companionOf = (path: string) => path.replace(/(?:_hd)?(?:-x)?\.png$/, '-x.png')
/** 그림 길(anim-px/gen-beom.png · _hd 판 · 덧 띠 -x 포함) → 띠 이름(beom) */
export function spriteName(path: string) { const m = /gen-([^/]+?)(?:_hd)?(?:-x)?\.png$/.exec(path); return m ? m[1]! : '' }
/** 그 띠의 서기 계획 (없으면 null — 예전 서기) */
export const idlePlan = (path: string): IdlePlan | null => PLANS[spriteName(path)] ?? null
/** 그림 한 장의 칸 수 — 본 띠는 늘 20 · 덧 띠는 계획 cells − 20 (칸 폭 = 그림 폭 ÷ 이것) */
export const stripCells = (path: string) => isCompanion(path) ? Math.max(1, (idlePlan(path)?.cells ?? STRIP_CELLS) - STRIP_CELLS) : STRIP_CELLS
/** 계획이 덧 띠 칸(20 부터)을 쓰나 */
export const usesCompanion = (plan: IdlePlan | null) => !!plan && plan.cells > STRIP_CELLS
/**
 * 지금 그릴 수 있는 계획 — 덧 띠가 아직 없거나 못 받았으면(ready = false) 20 칸 넘는 칸을 쓰는 일을 뺀다:
 * 쓰러짐은 18 → 19 · 버릇은 없음 (빈 칸을 그리지 않는다)
 */
export function usablePlan(plan: IdlePlan, ready: boolean): IdlePlan {
  if (ready || !usesCompanion(plan)) return plan
  const ok = (c: readonly number[] | undefined): c is readonly number[] => c !== undefined && c.every(n => n < STRIP_CELLS)
  const { fall, quirk, breath, blink, ...rest } = plan
  return { ...rest, cells: STRIP_CELLS, ...(ok(fall) ? { fall } : {}), ...(ok(quirk) ? { quirk } : {}), ...(ok(breath) ? { breath } : {}), ...(blink !== undefined && blink < STRIP_CELLS ? { blink } : {}) }
}

/** 띠 이름 → 정수 씨앗 (FNV-1a) — 장수마다 깜빡임·숨이 어긋나게 */
export function idleSeed(name: string) { let h = 2166136261; for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 16777619); return h >>> 0 }
/** 씨앗·차례·번호 → [0, 1) (정수 섞기 · 난수 아님) */
function unit(seed: number, cycle: number, k: number) {
  let a = (seed ^ Math.imul(cycle + 1, 0x9e3779b1) ^ Math.imul(k + 1, 0x85ebca6b)) >>> 0
  a = Math.imul(a ^ a >>> 16, 0x45d9f3b); a = Math.imul(a ^ a >>> 16, 0x45d9f3b); a ^= a >>> 16
  return (a >>> 0) / 4294967296
}
const span = (r: readonly number[], u: number) => r[0]! + (r[1]! - r[0]!) * u
/** 버릇 칸 i 의 초 */
const quirkTime = (plan: IdlePlan, i: number) => plan.quirkTimes?.[i] ?? I.quirkStep
const lengthOf = (plan: IdlePlan, kind: IdleEventKind) => kind === 'blink' ? I.blinkTime : kind === 'breath' ? I.breathTime : (plan.quirk ?? []).reduce((n, _, i) => n + quirkTime(plan, i), 0)
const everyOf = (kind: IdleEventKind) => kind === 'blink' ? I.blinkEvery : kind === 'breath' ? I.breathEvery : I.quirkEvery

const cache = new Map<string, readonly IdleEvent[]>()
/**
 * 한 차례(cycle 초) 안의 일들 — 셋이 저마다 다음 때를 들고, 가장 이른 것부터 앞 일이 끝나고 gap 초 뒤에 놓는다(겹치지 않는다).
 * 첫 때도 every 사이에서 고르니 쉬기 시작하자마자 버릇이 튀지 않는다. 차례 끝을 넘는 일은 놓지 않는다
 */
export function idleEvents(plan: IdlePlan, seed: number, cycle: number): readonly IdleEvent[] {
  const key = `${seed}:${cycle}:${plan.blink ?? ''}:${plan.breath?.length ?? 0}:${plan.quirk?.length ?? 0}`, had = cache.get(key)
  if (had) return had
  const kinds = (['blink', 'breath', 'quirk'] as const).filter(k => k === 'blink' ? plan.blink !== undefined : k === 'breath' ? !!plan.breath?.length : !!plan.quirk?.length)
  const due = new Map<IdleEventKind, number>(kinds.map((k, i) => [k, span(everyOf(k), unit(seed, cycle, i))]))
  const out: IdleEvent[] = []
  let free = 0, n = kinds.length
  while (due.size) {
    let kind: IdleEventKind | null = null, at = Infinity
    for (const [k, t] of due) if (t < at) { at = t; kind = k }
    const start = Math.max(at, free), end = start + lengthOf(plan, kind!)
    if (end > I.cycle) break
    out.push({ kind: kind!, at: start, end })
    free = end + I.gap; due.set(kind!, start + span(everyOf(kind!), unit(seed, cycle, n++)))
  }
  if (cache.size > 64) cache.clear()
  cache.set(key, out)
  return out
}
/** 지금 하고 있는 일 (없으면 null) */
export function idleEventAt(plan: IdlePlan, seed: number, tau: number): { e: IdleEvent; age: number } | null {
  if (!(tau >= 0)) return null
  const cycle = Math.floor(tau / I.cycle), local = tau - cycle * I.cycle
  for (const e of idleEvents(plan, seed, cycle)) { if (local < e.at) break; if (local < e.end) return { e, age: local - e.at } }
  return null
}
/**
 * 쉬기 시작한 뒤 tau 초의 칸 — 일(깜빡임·큰 숨·버릇)이 있으면 그 칸 · 없으면 base 를 hold 초씩.
 * calm(움직임 줄이기)이면 base 만
 */
export function planFrame(plan: IdlePlan, seed: number, tau: number, calm = false): number {
  const t = Math.max(0, tau)
  if (!calm) {
    const now = idleEventAt(plan, seed, t)
    if (now) {
      const { e, age } = now
      if (e.kind === 'blink') return plan.blink!
      if (e.kind === 'breath') return plan.breath![Math.min(plan.breath!.length - 1, Math.floor(age / (I.breathTime / plan.breath!.length)))]!
      let left = age
      for (let i = 0; i < plan.quirk!.length; i++) { left -= quirkTime(plan, i); if (left < 0) return plan.quirk![i]! }
      return plan.quirk![plan.quirk!.length - 1]!
    }
  }
  return plan.base[Math.floor(t / plan.hold) % plan.base.length]!
}
