/**
 * 맹주의 길 — 진왕 (docs/realm/VICTORY.md §1. 『삼국지』 동이전: 진왕이 목지국에서 삼한을 거느렸다 · 변진 열두 나라도 진왕에 속했다).
 *
 *   살아 있는(땅 있는) 아는 나라를 **모두** 속국(조공국)으로 만든다 (형 10-30 — 예전엔 절반 넘게 · 동맹은 반 나라로 셌다)
 *   (그 가운데 속국이 하나는. 형 10-27: "맹주로 깨는 건 동맹만 맺으면 되니까 이상한데… 속국으로까지 만들어야") → 그 상태가
 *   suzerainSeasons(네 계절) **내리** 이어지면 맹주가 된다. 끊기면 시계가 처음부터.
 *   모든 길은 남도 걷는다 — AI 나라가 다 이루면 우리가 진다. 4분의 3을 넘기면 소문이 온다.
 *
 * 조공하는 사이(Relation.vassal) — 조공을 바치기로 한 나라는 tributeSeasons 동안 그 나라의 조공국이다 (diplomacy 가 단다).
 */
import { P } from '../tune/params.ts'
import { relationOf } from './diplomacy.ts'
import { knows } from './discovery.ts'
import type { Realm, ReportLine } from './types.ts'

const alive = (r: Realm, f: string): boolean => Object.values(r.nodes).some((n) => n.owner === f)

/** `vassal` 이 `lord` 에게 조공하는 사이인가 (기한 안) */
export function isVassal(r: Realm, vassal: string, lord: string): boolean {
  const v = relationOf(r, vassal, lord).vassal
  return v !== undefined && v.lord === lord && v.until >= r.season
}

/**
 * 맹약의 셈 — `f` 와 손잡은(동맹·조공국) 나라 · 셈에 드는 나라(살아 있는 아는 나라) · 이기려면 필요한 수(절반 넘게).
 * 배우는 판은 셈하지 않는다 (나라가 둘뿐).
 */
export interface Pact { have: string[]; vassals: number; allies: number; score: number; pool: number; need: number }
export function pactOf(r: Realm, f: string): Pact {
  if (r.region === 'tutorial') return { have: [], vassals: 0, allies: 0, score: 0, pool: 0, need: Infinity }
  const pool = Object.keys(r.factions).sort().filter((x) => x !== f && alive(r, x) && knows(r, f, x))
  const have = pool.filter((x) => relationOf(r, f, x).state === 'ally' || isVassal(r, x, f))
  const vassals = pool.filter((x) => isVassal(r, x, f)).length
  const allies = have.length - vassals
  // 아는 나라를 모두 속국으로 (형 10-30: "맹주도 속국 동맹이 아니라 다 속국으로") — 동맹은 셈에 안 든다
  return { have, vassals, allies, score: vassals, pool: pool.length, need: pool.length }
}

/** 지금 맹주의 셈을 채웠나 (그리고 셈할 나라가 있나) */
// 동맹만으로는 진왕이 아니다 — 바치는 나라(조공국)가 suzerainMinVassals 는 있어야 (진왕은 받드는 나라가 있었다)
const holds = (p: Pact): boolean =>
  p.pool >= P.realm.suzerainMinPool && p.score >= p.need && p.vassals >= P.realm.suzerainMinVassals

/**
 * 9 — 나라마다 맹약 시계를 센다 (r.suzerain). 끊기면 0. 소문·우리 맹약의 해를 보고에 남긴다.
 * 맹주가 됐는지는 suzerainEnd 가 본다.
 */
export function stepSuzerain(r: Realm, lines: ReportLine[]): void {
  if (r.region === 'tutorial') return
  const R = P.realm
  const book = (r.suzerain ??= {})
  for (const f of Object.keys(r.factions).sort()) {
    if (!alive(r, f)) {
      delete book[f]
      continue
    }
    const p = pactOf(r, f)
    const prev = book[f] ?? { streak: 0, have: 0 }
    const streak = holds(p) ? prev.streak + 1 : 0
    book[f] = { streak, have: p.score }
    const near = p.pool >= R.suzerainMinPool && p.score >= Math.ceil(p.need * R.suzerainRumorShare)
    const wasNear = p.pool >= R.suzerainMinPool && prev.have >= Math.ceil(p.need * R.suzerainRumorShare)
    // 소문은 처음 가까워졌을 때와 시계가 가는 동안만 (계절마다 같은 말을 되풀이하지 않게)
    if (streak > 0 || (near && !wasNear)) lines.push({ kind: 'suzerain', faction: f, have: p.score, need: p.need, streak })
  }
  // 조공 기한이 끝난 사이는 걷는다
  for (const rel of Object.values(r.relations ?? {})) if (rel.vassal !== undefined && rel.vassal.until < r.season) delete rel.vassal
}

/** 맹주가 났나 — 우리면 이김, 남이면 짐. 둘이 같은 계절이면 우리가 먼저 (판은 우리 눈으로 끝난다) */
export function suzerainEnd(r: Realm): { kind: 'win' | 'lose'; by: string } | null {
  const me = r.player
  const book = r.suzerain ?? {}
  const need = P.realm.suzerainSeasons
  if (me !== undefined && (book[me]?.streak ?? 0) >= need) return { kind: 'win', by: me }
  for (const f of Object.keys(book).sort()) if (f !== me && book[f]!.streak >= need) return { kind: 'lose', by: f }
  return null
}
