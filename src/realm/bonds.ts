/**
 * 인연 막대 — 판을 넘어 장수마다 쌓이는 몫의 셈 (docs/realm/BONDS.md §2).
 *
 * 순수한 셈만 한다 (판 상태만 읽는다 · A1). 쌓인 것을 이 기기에 두는 일은 ui/realm/bonds.ts 가 한다.
 * 숫자는 전부 P.realm.meta* 에 있다.
 */
import { P } from '../tune/params.ts'
import { DEX_CAUGHT, DEX_MET, DEX_SERVED } from './dex.ts'
import { TRAIT } from './data/traits.ts'
import { isRuler } from './heroes.ts'
import type { Hero, Realm } from './types.ts'

/** 이번 판에서 장수마다 쌓은 몫 — 한 판 한 사람 상한까지. 배우는 판·군주·쓰러진 이는 없다 */
export function runDeeds(r: Realm, me: string): Record<string, number> {
  const R = P.realm
  const out: Record<string, number> = {}
  if (r.region === 'tutorial') return out
  const ended = r.outcome !== null && r.outcome !== undefined && r.season > R.metaEndSeasons
  for (const id of Object.keys(r.heroes).sort()) {
    const h = r.heroes[id]!
    if (h.status === 'dead' || isRuler(r, id) || id.endsWith('-ruler')) continue
    const ours = h.faction === me
    const caught = h.status === 'captive' && h.captor === me
    if (!ours && !caught) continue
    let n = 0
    if (ours) {
      n += Math.floor((h.served ?? 0) / 4) * R.metaSeasons
      n += Object.values(h.grown ?? {}).reduce((s, g) => s + (g ?? 0), 0) * R.metaGrow
      const b = h.bond ?? 0
      n += b >= 100 ? R.metaBondSworn : b >= R.bondTrust ? R.metaBondTrust : b >= 30 ? R.metaBondWarm : 0
      if (h.born !== undefined && h.born !== me) n += R.metaCaptive // 사로잡아 우리 사람이 된 적장
      if (ended && r.outcome !== null && r.outcome !== undefined) n += r.outcome.kind === 'win' ? R.metaEndWin : R.metaEndLose
    } else {
      n += R.metaCaptive // 옥에 갇힌 적장
    }
    if (n > 0) out[id] = Math.min(R.metaRunCap, n)
  }
  return out
}

/** 도감 칸을 처음 켠 몫 (was → now) — 한 번만 붙는다 */
export function dexDeed(was: number, now: number): number {
  const R = P.realm
  const on = (b: number): boolean => (now & b) !== 0 && (was & b) === 0
  return (on(DEX_MET) ? R.metaDexMet : 0) + (on(DEX_CAUGHT) ? R.metaDexCaught : 0) + (on(DEX_SERVED) ? R.metaDexServed : 0)
}

/** 인연 단 문턱 — 1~5단 */
export function bondThresholds(): readonly number[] {
  const R = P.realm
  return [R.metaTier1, R.metaTier2, R.metaTier3, R.metaTier4, R.metaTier5]
}

/** 쌓은 몫 → 단 (0~5) */
export function bondTierOf(total: number): 0 | 1 | 2 | 3 | 4 | 5 {
  let t = 0
  for (const x of bondThresholds()) if (total >= x) t++
  return t as 0 | 1 | 2 | 3 | 4 | 5
}

export interface BondTierInfo {
  /** 단 이름 — 0단은 아직 사이라 부를 것이 없다 */
  readonly name: string
  /** 이 단이 열어 주는 것 (한 줄) */
  readonly reward: string
}

/**
 * 단 이름과 보상 — 2단 정 더함 · 3단 기억한 재주 · 5단 덤 동행은 applyBonds 가 판을 열 때 붙인다.
 * TODO(BONDS §6): 1단 판 시작 동행 고르기 · 4단 사사품 (화면·설계가 더 필요하다)
 */
export const BOND_TIERS: readonly BondTierInfo[] = [
  { name: '', reward: '' },
  { name: '이름 아는 사이', reward: '명부에 오름' },
  { name: '정든 사이', reward: '시작 정 더함' },
  { name: '믿는 사이', reward: '기억한 재주' },
  { name: '굳은 사이', reward: '사사품' },
  { name: '한마음', reward: '덤 동행' },
]

/** 다음 단까지 얼마나 찼나 (0~1) — 5단은 1 */
export function bondFill(total: number): number {
  const t = bondTierOf(total)
  if (t >= 5) return 1
  const th = bondThresholds()
  const lo = t === 0 ? 0 : th[t - 1]!
  const hi = th[t]!
  return Math.max(0, Math.min(1, (total - lo) / (hi - lo)))
}

/** 숫자 없이 말로 — 다음 단까지 얼마나 남았나 */
export function bondWord(total: number): string {
  if (bondTierOf(total) >= 5) return '한마음이다'
  const f = bondFill(total)
  return f >= 0.85 ? '조금 남았다' : f >= 0.6 ? '거의 다 왔다' : f >= 0.3 ? '절반쯤 왔다' : '이제 막 쌓는다'
}

/** 판 밖에서 기억하는 한 사람 몫 — 쌓은 몫과 지난 판에 눈뜬 재주 (ui/realm/bonds.ts 의 저장과 같은 모양) */
export interface BondMemory {
  readonly p: number
  readonly keep?: string
}

/**
 * 새 판을 열 때 인연의 단 효과를 판 상태에 한 번 넣는다 (BONDS §2 · §6 4단계). 동행을 들이고 난 뒤에 부른다.
 *  - 2단 이상: 우리 장수의 시작 정 + metaStartBond
 *  - 3단 이상: 지난 판에 눈뜬 재주(keep) 하나를 처음부터 가진다 (재주는 셋까지)
 *  - 5단: 아직 판에 없는 한마음 장수가 떠돌이로 우리 도읍에 찾아온다 (metaBonusMax 명 · 값 없이 들인다)
 * 판 상태에만 쓰고 시계·난수는 쓰지 않는다 — 판 저장본에 결과가 남아 다시 돌려도 같다. 고친 장수 id 를 돌려준다.
 */
export function applyBonds(r: Realm, mem: Readonly<Record<string, BondMemory>>, bodyOf: (id: string) => Hero | undefined): string[] {
  if (r.region === 'tutorial') return []
  const R = P.realm
  const me = r.player
  const touched: string[] = []
  for (const id of Object.keys(r.heroes).sort()) {
    const h = r.heroes[id]!
    const m = mem[id]
    if (m === undefined || h.faction !== me || h.status === 'dead' || isRuler(r, id) || id.endsWith('-ruler')) continue
    const t = bondTierOf(m.p)
    if (t >= 2 && R.metaStartBond > 0) {
      h.bond = Math.min(100, (h.bond ?? R.bondStart) + R.metaStartBond)
      touched.push(id)
    }
    if (t >= 3 && m.keep !== undefined && TRAIT[m.keep] !== undefined) {
      const traits = h.traits ?? []
      if (!traits.includes(m.keep) && traits.length < 3) {
        ;(h as { traits: readonly string[] }).traits = [...traits, m.keep]
        if (!touched.includes(id)) touched.push(id)
      }
    }
  }
  const cap = r.factions[me]?.capital ?? null
  if (cap !== null && R.metaBonusMax > 0) {
    const have = new Set((r.wanderers ?? []).map((w) => w.hero.id))
    const cands = Object.entries(mem)
      .filter(([id, m]) => bondTierOf(m.p) >= 5 && r.heroes[id] === undefined && !have.has(id) && !id.endsWith('-ruler'))
      .sort((a, b) => b[1].p - a[1].p || (a[0] < b[0] ? -1 : 1))
    let n = 0
    for (const [id] of cands) {
      if (n >= R.metaBonusMax) break
      const body = bodyOf(id)
      if (body === undefined) continue
      ;(r.wanderers ??= []).push({ hero: structuredClone(body), node: cap, until: r.season + R.metaBonusStay, price: 0 })
      touched.push(id)
      n++
    }
  }
  return touched
}
