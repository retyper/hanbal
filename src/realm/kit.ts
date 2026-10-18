/**
 * 병종마다 무장 (형: "쇠칼을 들려뽑는다? 이게 좀 말이안됨. 창병 궁수 방패병 다르지 않나... 무장해서 뽑으면 그 수도 파악이 되어야" — 2026-10-18)
 *
 * 군대의 `kit` 는 병종 → 단계 → 사람 수다. **불변식: 병종마다 단계의 합 = mix[병종].** 여기 함수들이 mix 와 kit 를 함께 바꿔 그것을 지킨다.
 *   단계: 돌·나무(stone) → 청동(bronze) → 쇠날(ironTip) → 온 쇠(iron) · 고리칼(ringSword)은 정예. 가죽(leather)은 청동 단계로 친다.
 *   kit 가 없는 군대(옛 저장 · 판 처음)는 equip 하나로 다 든 것으로 본다 (kitOf).
 *   나눌 때·잃을 때는 단계마다 **같은 비율**로 덜어 낸다 — 둥글림은 큰 나머지 순, 같으면 좋은 단계 먼저 (결정론).
 *   `a.equip` 은 옛 화면을 위한 값이다 — 가장 많은 사람이 든 단계 (syncEquip). 판정은 kit 를 쓴다.
 * 순수 함수 · 굴림 없음.
 */
import type { Equip, Kit, UnitKind } from './battle.ts'
import type { Army } from './types.ts'

/** 쓰는 단계 — 낮은 것부터 */
export const TIERS: readonly Equip[] = ['stone', 'bronze', 'ironTip', 'iron', 'ringSword']

/** 단계로 — 가죽은 청동 단계 */
export function tierOf(e: Equip): Equip {
  return e === 'leather' ? 'bronze' : e
}

const rank = (e: Equip): number => TIERS.indexOf(tierOf(e))

/** 다음 단계 — 돌 → 청동 → 쇠날 → 온 쇠. 온 쇠·고리칼 위는 없다 */
export function nextTier(e: Equip): Equip | null {
  switch (tierOf(e)) {
    case 'stone': return 'bronze'
    case 'bronze': return 'ironTip'
    case 'ironTip': return 'iron'
    default: return null
  }
}

type Men = Partial<Record<UnitKind, number>>
interface Kitted { mix: Men; equip: Equip; kit?: Kit }

/** 단계별 수를 total 로 맞춘다 — 비율대로, 큰 나머지 순 (같으면 좋은 단계 먼저) */
function spread(tiers: Partial<Record<Equip, number>>, total: number): Partial<Record<Equip, number>> {
  const have = (Object.entries(tiers) as Array<[Equip, number]>).filter(([, n]) => n > 0)
  const sum = have.reduce((s, [, n]) => s + n, 0)
  const out: Partial<Record<Equip, number>> = {}
  if (total <= 0 || sum <= 0) return out
  const parts = have.map(([e, n]) => ({ e, exact: (n * total) / sum }))
  let left = total
  for (const p of parts) {
    const f = Math.floor(p.exact)
    if (f > 0) out[p.e] = f
    left -= f
  }
  const order = parts.slice().sort((x, y) => (y.exact - Math.floor(y.exact)) - (x.exact - Math.floor(x.exact)) || rank(y.e) - rank(x.e))
  for (let i = 0; left > 0; i = (i + 1) % order.length, left--) out[order[i]!.e] = (out[order[i]!.e] ?? 0) + 1
  return out
}

/**
 * 군대의 무장 — 깨끗한 사본. kit 가 없거나 병종의 합이 mix 와 어긋나면 맞춘다 (없으면 equip 하나로, 어긋나면 비율대로).
 * 가죽은 청동으로 옮긴다.
 */
export function kitOf(a: Kitted): Kit {
  const out: Kit = {}
  for (const [k, n] of Object.entries(a.mix) as Array<[UnitKind, number]>) {
    if (!(n > 0)) continue
    const src: Partial<Record<Equip, number>> = {}
    for (const [e, m] of Object.entries(a.kit?.[k] ?? {}) as Array<[Equip, number]>) if (m > 0) src[tierOf(e)] = (src[tierOf(e)] ?? 0) + m
    const sum = Object.values(src).reduce((s, v) => s + (v ?? 0), 0)
    out[k] = sum === 0 ? { [tierOf(a.equip)]: n } : sum === n ? src : spread(src, n)
  }
  return out
}

/** 가장 많은 사람이 든 단계 (같으면 좋은 쪽). 사람이 없으면 equip 그대로 */
function commonTier(kit: Kit, fallback: Equip): Equip {
  const by: Partial<Record<Equip, number>> = {}
  for (const t of Object.values(kit)) for (const [e, m] of Object.entries(t ?? {}) as Array<[Equip, number]>) by[e] = (by[e] ?? 0) + m
  let best: Equip | null = null
  for (const e of TIERS) if ((by[e] ?? 0) > 0 && (best === null || (by[e] ?? 0) >= (by[best] ?? 0))) best = e
  return best ?? fallback
}

/** kit 를 mix 에 맞추고 equip(옛 화면 값)을 다시 셈한다 — mix 를 바꾼 뒤에 부른다 */
export function syncKit(a: Army): void {
  a.kit = kitOf(a)
  a.equip = commonTier(a.kit, a.equip)
}

/** 사람을 더한다 — 그 병종에 그 단계로 */
export function addMen(a: Army, kind: UnitKind, n: number, tier: Equip): void {
  if (!(n > 0)) return
  const kit = kitOf(a)
  const t = (kit[kind] ??= {})
  t[tierOf(tier)] = (t[tierOf(tier)] ?? 0) + n
  a.mix[kind] = (a.mix[kind] ?? 0) + n
  a.kit = kit
  a.equip = commonTier(kit, a.equip)
}

/**
 * 사람을 덜어 낸다 — 병종마다 `take[병종]` 명을, 그 병종의 단계마다 같은 비율로. 덜어 낸 몫(mix·kit)을 돌려준다.
 * 모자라면 있는 만큼만. 나누기(split)가 쓴다.
 */
export function takeMen(a: Army, take: Men): { mix: Men; kit: Kit } {
  const kit = kitOf(a)
  const out: { mix: Men; kit: Kit } = { mix: {}, kit: {} }
  for (const [k, want] of Object.entries(take) as Array<[UnitKind, number]>) {
    const have = a.mix[k] ?? 0
    const t = Math.min(have, Math.max(0, want))
    if (t <= 0) continue
    const gone = spread(kit[k] ?? {}, t)
    const rest: Partial<Record<Equip, number>> = {}
    for (const [e, m] of Object.entries(kit[k] ?? {}) as Array<[Equip, number]>) {
      const r = m - (gone[e] ?? 0)
      if (r > 0) rest[e] = r
    }
    out.mix[k] = t
    out.kit[k] = gone
    a.mix[k] = have - t
    if (a.mix[k] === 0) {
      delete a.mix[k]
      delete kit[k]
    } else kit[k] = rest
  }
  a.kit = kit
  a.equip = commonTier(kit, a.equip)
  return out
}

/** 덜어 낸 몫(또는 다른 군대 전부)을 더한다 — 모으기(merge)·나누기의 새 무리 */
export function giveMen(b: Army, part: { mix: Men; kit: Kit }): void {
  const kit = kitOf(b)
  for (const [k, n] of Object.entries(part.mix) as Array<[UnitKind, number]>) {
    if (!(n > 0)) continue
    b.mix[k] = (b.mix[k] ?? 0) + n
    const t = (kit[k] ??= {})
    const src = part.kit[k] ?? {}
    const sum = Object.values(src).reduce((s, v) => s + (v ?? 0), 0)
    const add = sum === n ? src : spread(sum > 0 ? src : { [tierOf(b.equip)]: n }, n)
    for (const [e, m] of Object.entries(add) as Array<[Equip, number]>) t[e] = (t[e] ?? 0) + m
  }
  b.kit = kit
  b.equip = commonTier(kit, b.equip)
}

/** 잃는다 — 병종마다 round(n × keep) 명이 남고, 단계마다 같은 비율로 (싸움의 손실) */
export function scaleMen(a: Army, keep: number): void {
  const kit = kitOf(a)
  for (const k of Object.keys(a.mix) as UnitKind[]) {
    const n = Math.round((a.mix[k] ?? 0) * keep)
    a.mix[k] = n
    kit[k] = spread(kit[k] ?? {}, n)
  }
  a.kit = kit
  a.equip = commonTier(kit, a.equip)
}

/** 그 병종 가운데 가장 낮은 무장 — 사람이 없으면 null */
export function lowestTier(a: Kitted, kind: UnitKind): Equip | null {
  const t = kitOf(a)[kind] ?? {}
  for (const e of TIERS) if ((t[e] ?? 0) > 0) return e
  return null
}

/**
 * 무장 올리기 — "이 병종 가운데 가장 낮은 무장을 한 단계". 그 단계의 사람 전부가 다음 단계로 간다.
 * 올린 것 { from, to, n } 을 돌려준다. 올릴 것이 없으면 null.
 */
export function upgradeKind(a: Army, kind: UnitKind): { from: Equip; to: Equip; n: number } | null {
  const from = lowestTier(a, kind)
  const to = from !== null ? nextTier(from) : null
  if (from === null || to === null) return null
  const kit = kitOf(a)
  const t = kit[kind]!
  const n = t[from] ?? 0
  delete t[from]
  t[to] = (t[to] ?? 0) + n
  a.kit = kit
  a.equip = commonTier(kit, a.equip)
  return { from, to, n }
}

/** 화면용 — 병종마다 단계별 사람 수, 낮은 단계부터. 사람이 없는 병종은 빠진다 */
export function kitLines(a: Kitted): Partial<Record<UnitKind, Array<{ tier: Equip; n: number }>>> {
  const out: Partial<Record<UnitKind, Array<{ tier: Equip; n: number }>>> = {}
  for (const [k, t] of Object.entries(kitOf(a)) as Array<[UnitKind, Partial<Record<Equip, number>>]>) {
    const rows = TIERS.filter((e) => (t[e] ?? 0) > 0).map((e) => ({ tier: e, n: t[e]! }))
    if (rows.length > 0) out[k] = rows
  }
  return out
}
