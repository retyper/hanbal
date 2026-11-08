/**
 * 나라의 그릇 (위원회 11-08 · docs/realm/council/1108) — 판이 뒤로 갈수록 우리 살림은 수십 배로 불어나는데(가을걷이 33배 · 집 16배)
 * 상단의 주문·물건 값 같은 「값」은 그대로라 후반엔 의미가 없었다 (형 11-08: "초반에는 까다로운데 후반 가니까 내가 너무 압도").
 * 늘어나야 하는 값은 모두 이 눈금 하나를 쓴다 — 그 나라 고을의 집 수로 잰다 (판 상태만 읽는다 · 결정론).
 *
 *   realmScale = clamp((집 / scaleRefHH) ^ scaleExp, 1, scaleMax)   (영남 이서 쉬움 봇 판: s8 1.0 · s40 3.4 · s99 10.2)
 */
import { P } from '../tune/params.ts'
import type { Realm } from './types.ts'

/** 그 나라 고을의 집 수 */
export function hhOf(r: Realm, faction: string): number {
  let hh = 0
  for (const n of Object.values(r.nodes)) if (n.owner === faction) hh += n.hh
  return hh
}

/** 나라의 그릇 — 1(처음) 에서 scaleMax 까지 */
export function realmScale(r: Realm, faction: string): number {
  const R = P.realm
  const x = Math.pow(Math.max(0, hhOf(r, faction)) / Math.max(1, R.scaleRefHH), R.scaleExp)
  return Math.max(1, Math.min(R.scaleMax, x))
}

/**
 * 재물이 부르는 위협 (림월드 이야기꾼처럼 · 형 11-08: "쉬운 난이도 빼고는 좀 조정 · 재산에 따른 난이도 조절은 림월드 참고") —
 * 플레이어 나라의 그릇을 log2 로 (처음 0 · 그릇 3.4 에 1.8 · 10 에 3.3). 쉬움(촌장)은 늘 0 — 쉬움은 이야기를 따라가는 판이라 그대로 둔다.
 * 재해·도적이 잦고 세지며(events) · 이웃이 우리 고을을 더 노리고(ai.focus) · 살림으로 앞서도 「앞서가는 나라」가 된다(stance)
 */
export function wealthThreat(r: Realm): number {
  if ((r.tier ?? 1) < 1 || r.region === 'tutorial' || r.factions[r.player] === undefined) return 0
  return Math.log2(realmScale(r, r.player))
}
