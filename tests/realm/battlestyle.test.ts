/**
 * 맡긴 싸움의 지휘 버릇 (tactics.BattleStyle · 형 10-24: "자동전투는 장수 특성에 따라 효과 나오게")
 *
 *  - 신중한 장수는 상대 앞줄의 맞수를 더 자주 골라 같은 판에서 더 자주 이긴다 (많은 판 · 이김에서 짐을 뺀 몫 —
 *    해시계 뒤로 해질녘에 진을 쳐 비기는 판이 생겨, 이김만 세면 몇 판 차이로 흔들린다)
 *  - 일편단심은 물러서지 않는다 — 밀려도 물러나기로 끝나지 않는다
 *  - 명궁은 활을 앞세운다 — 앞줄이 길을 트는 합이 늘어난다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { fightRounds, type BattleStyle, type Side } from '../../src/realm/tactics.ts'

const side = (F: number, style?: BattleStyle): Side => ({
  F, mix: { spear: 40, bow: 30, shield: 30 }, morale: 1, hero: { id: 'h', mu: 5, ryak: 5, coward: false, ...(style !== undefined ? { style } : {}) },
  hungry: false, specials: [], water: false, player: false, seen: true,
})
const won = (o: string): boolean => o === 'win' || o === 'rout'
const N = 300

describe('맡긴 싸움의 지휘 버릇', () => {
  it('신중한 장수가 더 자주 이긴다', () => {
    let plain = 0
    let careful = 0
    const net = (o: string): number => (won(o) ? 1 : o === 'lose' || o === 'routed' ? -1 : 0)
    for (let s = 0; s < N; s++) {
      plain += net(fightRounds(side(100), side(100), `c${s}`, s, 0).outcome)
      careful += net(fightRounds(side(100, 'careful'), side(100), `c${s}`, s, 0).outcome)
    }
    assert.ok(careful > plain, `신중 ${careful} · 보통 ${plain} (이김 − 짐)`)
  })

  it('일편단심은 물러나지 않는다', () => {
    for (let s = 0; s < N; s++) {
      const r = fightRounds(side(60, 'steadfast'), side(140), `s${s}`, s, 0)
      assert.ok(!r.rounds.some((x) => x.oa?.lead === 'retreat'), `판 ${s}`)
    }
  })

  it('명궁은 활을 앞세운다', () => {
    const opens = (style?: BattleStyle): number => {
      let n = 0
      for (let s = 0; s < N; s++) n += fightRounds(side(100, style), side(100), `a${s}`, s, 0).rounds.filter((x) => x.oa?.front === 'open').length
      return n
    }
    assert.ok(opens('archer') > opens() * 1.2, `${opens('archer')} vs ${opens()}`)
  })
})
