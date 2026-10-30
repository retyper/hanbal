/**
 * 외교 추천 — 이번 계절 손볼 만한 이웃 (형 10-31: "어떤 계절엔 상황에 따라서 외교 추천도 띄워야함").
 * 셋 가운데 하나씩, 나라마다 가장 급한 것 하나 (순수 함수 · 굴림 없음):
 *   chance — 이웃이 다른 나라와 싸우는 중이고 우리보다 약하다 → 칠 때다
 *   strong — 국경이 맞닿은 이웃이 우리보다 세다 → 화친·동맹
 *   met    — 국경이 맞닿았는데 아직 아무 사이도 아니다 → 화친을 청하거나 선물
 * 힘은 우리 정보로 본다 (powerRange 가운데 — 정보의 계약). 화면은 처음 생긴 계절에 알리고(key 로 견준다) 외교 판 맨 위에 띠로 둔다.
 */
import { P } from '../tune/params.ts'
import { knows } from './discovery.ts'
import { nationPower, powerRange, relationOf } from './diplomacy.ts'
import { borders } from './stance.ts'
import type { Realm } from './types.ts'

export interface DiploTip {
  readonly key: string
  readonly kind: 'chance' | 'strong' | 'met'
  readonly to: string
  /** chance 일 때 — 그 이웃과 싸우는 나라 */
  readonly foe?: string
}

const alive = (r: Realm, f: string): boolean => Object.values(r.nodes).some((n) => n.owner === f)

export function diploTips(r: Realm, me: string): DiploTip[] {
  const R = P.realm
  const mine = nationPower(r, me)
  const out: DiploTip[] = []
  const others = Object.keys(r.factions).sort().filter((f) => f !== me && alive(r, f) && knows(r, me, f) && borders(r, me, f))
  for (const f of others) {
    const state = relationOf(r, me, f).state
    if (state === 'truce' || state === 'ally') continue
    const [lo, hi] = powerRange(r, me, f)
    const seen = (lo + hi) / 2
    const foe = Object.keys(r.factions).sort().find((x) => x !== me && x !== f && alive(r, x) && knows(r, me, x) && relationOf(r, f, x).state === 'war')
    if (foe !== undefined && seen < mine * R.adviseWeakMul) out.push({ key: `chance:${f}:${foe}`, kind: 'chance', to: f, foe })
    else if (state !== 'war' && seen > mine * R.adviseStrongMul) out.push({ key: `strong:${f}`, kind: 'strong', to: f })
    else if (state === 'neutral') out.push({ key: `met:${f}`, kind: 'met', to: f })
  }
  return out
}
