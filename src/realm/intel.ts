/**
 * 정보의 계약 — 보이는 범위는 언제나 참값을 품는다 (docs/realm/SYSTEMS.md §2-2 · §2-3 · VISION §2-1)
 *
 * 범위가 계약을 지키는 근거는 "그렇게 그렸다"가 아니라 **"규칙상 그 밖으로 못 나간다"** 다:
 *   - 관측 때의 참값은 관측의 흐림 s 안에 있다 (u 로 가운데를 비틀어 범위의 중앙도 믿을 수 없게)
 *   - 그 뒤의 변화는 계절당 상한(늘어남 +20% · 줄어듦 −5%) 안에 있다 — 그 상한은 규칙이 지킨다
 * 소문 표식이 붙은 정보만 예외다 (여기서는 다루지 않는다 — 소문은 범위가 아니라 표식이다).
 */
import { P } from '../tune/params.ts'
import { winChance, type UnitKind } from './battle.ts'
import type { Realm } from './types.ts'

/** 정보의 출처마다 흐림 s (§2-2). 척후는 0 — 제 눈으로 봤다. */
export type Source = 'scout' | 'spy' | 'captive' | 'merchant'

export function sourceBlur(src: Source): number {
  switch (src) {
    case 'scout': return 0
    case 'spy': return 0.1
    case 'captive': return 0.2
    case 'merchant': return 0.3
  }
}

/** 관측 하나 — 그때 본 값과, 범위의 가운데를 비트는 u (관측마다 고정, 0..1). */
export interface Sighting {
  readonly f0: number
  readonly src: Source
  readonly u: number
}

/**
 * 관측을 남긴다 — 그때의 참값 F 를 들고 다니되 화면에는 범위만 나간다.
 * 범위 [F·(1−s·u), F·(1+s·(1−u))] 는 참값을 품지만 u 때문에 가운데가 참값이 아니다.
 */
export function sight(trueF: number, src: Source, u: number): Sighting {
  return { f0: trueF, src, u: Math.min(1, Math.max(0, u)) }
}

/**
 * 보이는 범위 [lo, hi] — a 계절 낡은 관측. a ≥ intelBlindAge 면 null ("모름").
 *   [ F₀·(1 − s·u)·(1 − lossMax)^a ,  F₀·(1 + s·(1−u))·(1 + growMax)^a ]
 * 폭은 입력마다가 아니라 F 하나에 한 번만 건다 (검산: 따로 넓히면 a=2 에서 54pp 가 된다).
 */
export function visibleRange(s: Sighting, age: number): readonly [number, number] | null {
  const R = P.realm
  if (age >= R.intelBlindAge) return null
  const blur = sourceBlur(s.src)
  const a = Math.max(0, age)
  const lo = s.f0 * (1 - blur * s.u) * Math.pow(1 - R.intelLossMax, a)
  const hi = s.f0 * (1 + blur * (1 - s.u)) * Math.pow(1 + R.intelGrowMax, a)
  return [lo, hi]
}

/**
 * 규칙이 지키는 쪽 — 보지 않은 사이 참 F 가 한 계절에 움직일 수 있는 한계로 자른다.
 * realm 의 계절 처리(모병·소모)는 이 함수를 지나야 한다. 싸움은 예외지만 싸움 소식은 퍼진다 (§2-2).
 */
export function clampUnseenChange(prevF: number, nextF: number): number {
  const R = P.realm
  return Math.min(prevF * (1 + R.intelGrowMax), Math.max(prevF * (1 - R.intelLossMax), nextF))
}

/** 경계(기습의 덧셈 값)는 비율이 아니라 절대 폭 ±intelAlertWiden·a 로 넓힌다. */
export function alertRange(seen: number, age: number): readonly [number, number] | null {
  const R = P.realm
  if (age >= R.intelBlindAge) return null
  const w = R.intelAlertWiden * Math.max(0, age)
  return [Math.max(0, seen - w), Math.min(R.alertMax, seen + w)]
}

/**
 * 승률도 범위로 보인다 (§2-3) — 모르는 입력의 범위를 끝에서 끝까지 넣는다.
 * 승률은 적 F 에 대해 줄어들기만 하므로 적의 상한이 우리 승률의 하한이 된다.
 * 모든 입력을 알면(범위 폭 0) 한 숫자가 된다 — 범위가 좁혀지는 것 자체가 정찰의 보상이다.
 */
export function winRange(fa: number, foe: readonly [number, number]): readonly [number, number] {
  return [winChance(fa, foe[1]), winChance(fa, foe[0])]
}

/**
 * 본 병종의 몫 — 정찰·첩자가 그 고을에서 본 구성 (형: "정찰하면 '궁수가 많다' 같은 구성이 보이게").
 * 몫은 P.realm.seenMixStep 눈금이고 사람 수는 없다. 본 적 없거나 낡아 모르게 됐으면(intelBlindAge) null. age 는 본 지 몇 계절.
 */
export function seenMix(r: Realm, viewer: string, node: string): { mix: Partial<Record<UnitKind, number>>; age: number } | null {
  const k = r.intel[viewer]?.[node]?.force
  if (k?.mix === undefined) return null
  const age = r.season - k.season
  if (age >= P.realm.intelBlindAge) return null
  return { mix: k.mix, age }
}
