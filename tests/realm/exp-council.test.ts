/**
 * 원정 간 장수와 군사회의 · 원정 창 (형 11-02, 1장 마한 · 백제 · 달 시계)
 *  - "자꾸 원정 나간 장수가 군사회의에 등장" — 원정 가 있는 이 · 이번 달 떠나기로 한 이는 회의(안건 · 군막의 둘)에 앉지 않는다
 *  - "을음 원정 보낸 것 같은데 소서노가 뜬금없이 원정 보내짐" — 보낸 장수의 창이 다음 장수로 넘어가지 않는다 (cmdpick.ts)
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { startRegion } from '../../src/realm/data/regions/index.ts'
import { approachMoves, movesOf } from '../../src/realm/estimate.ts'
import { onExpedition } from '../../src/realm/expedition.ts'
import { isAway } from '../../src/realm/heroes.ts'
import { advance } from '../../src/realm/season.ts'
import type { Realm } from '../../src/realm/types.ts'
import { cmdPickId } from '../../src/ui/realm/cmdpick.ts'
import { councilAgendas } from '../../src/ui/realm/council-agenda.ts'
import { adviseMarch } from '../../src/ui/realm/council-lines.ts'

const EUREUM = 'mh-eureum'
const CTX = { canLead: () => true, rationNow: 2, rationCost: () => 10, grain: 1000 }

/** 백제의 모든 출정 회의에서 말한 장수 · 군막에 앉은 장수 */
function speakers(r: Realm, leaving?: (id: string) => boolean): { council: Set<string>; advise: Set<string>; n: number } {
  const council = new Set<string>()
  const advise = new Set<string>()
  let n = 0
  for (const a of Object.values(r.armies).filter((x) => x.faction === r.player && x.march === null)) {
    for (const m of movesOf(r, r.player, a).filter((x) => x.hostile)) {
      const moves = approachMoves(r, r.player, a, m)
      const ags = councilAgendas(r, r.player, a, m, moves, leaving !== undefined ? { ...CTX, leaving } : CTX)
      n += ags.length
      for (const ag of ags) for (const v of ag.voices) if (v.hero !== null) council.add(v.hero.id)
      for (const x of adviseMarch(r, r.player, a, m.to, moves, leaving)) advise.add(x.hero.id)
    }
  }
  return { council, advise, n }
}

describe('원정 간 장수는 군사회의에 없다 (형 11-02)', () => {
  it('마한 · 백제 — 떠나기 전엔 을음이 회의에 앉는다 (시험이 헛돌지 않게)', () => {
    const r = startRegion('mahan', 1, 'baekje')
    const s = speakers(r)
    assert.ok(s.n > 0, '회의가 열리지 않는다')
    assert.ok(s.council.has(EUREUM) || s.advise.has(EUREUM), '을음이 처음부터 회의에 없다')
  })

  it('원정 가 있는 동안은 안건에도 군막에도 없다', () => {
    for (let seed = 1; seed <= 4; seed++) {
      const r0 = startRegion('mahan', seed, 'baekje')
      r0.stock.baekje!.grain = 5000
      let r = advance(r0, [{ kind: 'expedition', faction: 'baekje', hero: EUREUM, dest: 'hills', len: 1 }]).next
      assert.ok(onExpedition(r, EUREUM) !== undefined, '을음이 원정을 떠나지 못했다')
      // 다녀오는 동안 내내
      while (onExpedition(r, EUREUM) !== undefined) {
        assert.ok(isAway(r, EUREUM))
        const s = speakers(r)
        assert.ok(!s.council.has(EUREUM), `${seed} · ${r.season}: 원정 간 을음이 회의에서 말한다`)
        assert.ok(!s.advise.has(EUREUM), `${seed} · ${r.season}: 원정 간 을음이 군막에 앉았다`)
        r = advance(r, []).next
      }
      // 돌아오면 다시 앉는다
      assert.ok(!isAway(r, EUREUM))
    }
  })

  it('이번 달 원정을 고른 이도 회의에 앉지 않는다 (계획 판에는 아직 있다)', () => {
    const r = startRegion('mahan', 1, 'baekje')
    const s = speakers(r, (id) => id === EUREUM)
    assert.ok(!s.council.has(EUREUM) && !s.advise.has(EUREUM))
    assert.ok(s.n > 0, '을음 하나 빠졌다고 회의가 사라졌다')
  })
})

describe('원정 창 — 보낸 장수를 그대로 보인다 (형 11-02)', () => {
  it('을음을 보내면 창은 을음에 머문다 · 소서노로 넘어가지 않는다', () => {
    // 보내기 전: 을음이 가장 맞는 이로 맨 앞 (고른 적 없음 · cmdHero '')
    assert.equal(cmdPickId(['mh-eureum', 'mh-soseono', 'mh-ogan'], '', false), 'mh-eureum')
    // 보낸 뒤: 을음은 「원정 떠나는 중」이라 쉬는 이 목록에서 빠진다 — 창은 을음(보낸 이)에 머문다
    assert.equal(cmdPickId(['mh-soseono', 'mh-ogan'], 'mh-eureum', true), 'mh-eureum')
    // 취소하면 다시 쉬는 이 — 그대로 을음
    assert.equal(cmdPickId(['mh-eureum', 'mh-soseono', 'mh-ogan'], 'mh-eureum', false), 'mh-eureum')
    // 다른 일로 묶인 이를 골라 두었으면 맨 앞 쉬는 이
    assert.equal(cmdPickId(['mh-soseono', 'mh-ogan'], 'mh-eureum', false), 'mh-soseono')
    assert.equal(cmdPickId([], '', false), '')
  })
})
