/**
 * 고을 맡기의 득 — 이 장수를 이 고을에 앉히면 무엇이 얼마나 달라지나 (형 11-04: "장수를 마을 배치시킬 때
 * 어느 마을을 보내야 뭐가 좋은지 선택지에서 다 보여야 함").
 *
 * 판을 고치지 않는다 — 장수 자리만 바꾼 얕은 사본 둘(앉힌 판 · 비운 판)에 실제 셈(nodeHarvest·militiaMen·growMul·alertFloor)을
 * 그대로 돌려 그 차이를 낸다. 그래서 화면의 숫자와 다음 달의 숫자가 어긋나지 않는다.
 */
import { P } from '../tune/params.ts'
import { militiaMen, nodeHarvest, nodeYield } from './economy.ts'
import { alertFloor, growMul, hasTrait, postHero } from './heroes.ts'
import { neighbors } from './season.ts'
import type { Hero, Realm } from './types.ts'

export interface PostGain {
  /** 다음 가을걷이 곡식 차이 */
  readonly grain: number
  /** 가호가 느는 빠르기 차이 (%) */
  readonly grow: number
  /** 장정 차이 (명) */
  readonly militia: number
  /** 경계 바닥 차이 (%) */
  readonly alert: number
  /** 달마다 쇠 (대장장이 · 덩이쇠 묶음) */
  readonly iron: number
  /** 이 고을에서 뽑는 군사가 철검을 든다 */
  readonly ironhand: boolean
  /** 남의 땅과 맞닿은 고을 */
  readonly front: boolean
  /** 지금 맡은 다른 장수 (자리를 내준다) */
  readonly replaces: string | null
  /** 견주기 점수 — 추천 표시에만 */
  readonly score: number
}

/** `node` 를 맡은 장수만 바꾼 얕은 사본 — who 가 null 이면 비운다 */
function withHolder(r: Realm, node: string, who: Hero | null): Realm {
  const heroes: Realm['heroes'] = { ...r.heroes }
  for (const h of Object.values(r.heroes)) if (h.post === node && h.id !== who?.id) heroes[h.id] = { ...h, post: null }
  if (who !== null) {
    const { awayUntil: _away, ...rest } = who
    heroes[who.id] = { ...rest, post: node, at: node }
  }
  return { ...r, heroes }
}

export function postGain(r: Realm, hero: string, node: string): PostGain {
  const x = r.heroes[hero]
  const n = r.nodes[node]
  const holder = postHero(r, node)
  if (x === undefined || n === undefined) return { grain: 0, grow: 0, militia: 0, alert: 0, iron: 0, ironhand: false, front: false, replaces: null, score: 0 }
  const base = withHolder(r, node, null)
  const on = withHolder(r, node, x)
  const grain = nodeHarvest(on, node) - nodeHarvest(base, node)
  const gb = growMul(base, node)
  const grow = gb > 0 ? Math.round((growMul(on, node) / gb - 1) * 100) : 0
  const militia = militiaMen(on, node) - militiaMen(base, node)
  const alert = Math.round((alertFloor(on, node) - alertFloor(base, node)) * 100)
  const iron = (hasTrait(x, 'smith') ? P.realm.traitSmith : 0) + ((nodeYield(on, node).iron ?? 0) - (nodeYield(base, node).iron ?? 0))
  const front = neighbors(r, node).some((id) => { const o = r.nodes[id]?.owner; return o !== null && o !== undefined && o !== n.owner })
  const ironhand = hasTrait(x, 'ironhand')
  // 점수 — 곡식 한 섬 = 1 · 장정 둘 = 1 · 쇠 = 곡식 셋 (달마다라 열둘) · 맞닿은 고을의 장정·경계는 곱절
  const f = front ? 2 : 1
  const score = grain + (militia / 2) * f + iron * 3 * 12 + alert * f + grow * n.hh * 0.02 + (ironhand ? 20 * f : 0)
  return { grain, grow, militia, alert, iron, ironhand, front, replaces: holder !== null && holder.id !== hero ? holder.id : null, score }
}
