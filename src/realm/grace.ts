/**
 * 판 처음의 유예 — 남의 나라가 언제부터 우리 땅을 치나 (ai.ts 의 spared 가 묻고, 길 위에서 닿을 때 season.ts 도 묻는다).
 * 판정(season)과 생각(ai)이 같은 값을 보도록 따로 뺐다 — 둘 다 이 파일만 부른다 (고리를 만들지 않으려고).
 */
import { P } from '../tune/params.ts'
import { seasonIdx } from './calendar.ts'
import type { Realm } from './types.ts'

/** 2장 동부여의 추격 — 이 계절에 대소의 군대가 주몽을 쫓고 있나 */
export function pursuing(r: Realm, faction: string): boolean {
  return r.scenario?.id === 'jumong' && faction === 'buyeo' && seasonIdx(r) < P.realm.pursuitSeasons
}

/** 판의 초반 유예 (계절) — 1:1 판과 1장은 짧게 (긴급 위원회 11-04 · 긴 판은 그대로) */
export function graceOf(r: Realm): number {
  const R = P.realm
  return r.scenario?.id === 'mahan' ? R.aiGraceMahan : r.region === 'byeonhan-mini' ? R.aiGraceDuel : R.aiGrace
}

/**
 * 새내기 유예 (FIRST-HOUR-20261122 TOP 1) — 초반 유예가 짧은 판(1장 마한 · 1:1 판)의 첫 aiFreshGrace 계절(첫 해)엔
 * 우리가 개척으로 새로 연 마을에 우리 군대가 없으면 치지 않는다. 첫 진짜 판의 첫 패배가 30판 중 29판에서 같은 「손쓸 수 없는 패배」였다
 * (새로 연 마을을 적 주력이 친다 · 장정 스물 남짓 · 적 승률 1.00). 처음부터 쥔 고을 · 차지한 고을은 예전대로 (군대를 빼면 노려진다 — 예고가 알린다).
 * 먼저 쳐도 풀리지 않는다(판 처음의 배울 시간) · 2장 동부여의 추격은 그대로 · 초반 유예가 더 긴 판(자유판의 aiGrace)은 상관없다.
 * 길 위에서도 묻는다 — 떠날 땐 우리 군대가 있었는데 닿을 때 비었으면 들어가지 않고 돌아선다 (season.resolveMarches)
 */
export function freshSpared(r: Realm, faction: string, to: string): boolean {
  const R = P.realm
  if (seasonIdx(r) >= R.aiFreshGrace || graceOf(r) >= R.aiFreshGrace || pursuing(r, faction)) return false
  const n = r.nodes[to]
  const owner = n?.owner ?? null
  if (n === undefined || owner === null || owner === faction || r.factions[owner]?.mind !== 'player' || n.foundedBy !== owner) return false
  return !Object.values(r.armies).some((a) => a.faction === owner && a.march === null && a.at === to)
}
