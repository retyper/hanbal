/**
 * 각성 (형 10-31 · 11-04 · 11-15) — 우리 장수가 제 몫의 싸움을 이기면 불꽃이 한 칸 켜지고, 지거나 비기면 한 칸 꺼진다 (내리 이길 필요는 없다 · 순증).
 * 불꽃이 다 켜지면(문턱은 heroes.ascendNeed 가 셈한다) 각성 시련이 열리고, 시련을 넘으면 각성해 능력치가 모두 ascendBonus 오른다 (10 을 넘을 수 있다).
 * 남의 나라 장수는 각성하지 않는다. 시련 관문을 닫은 판(ascendTrialOpen 0 · 각성 v2)은 ascend-switch.test.ts 가 본다.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { ascendNeed, battleGrowth } from '../../src/realm/heroes.ts'
import { completeTrial } from '../../src/realm/awakening-trial.ts'
import { P, setParam } from '../../src/tune/params.ts'
import type { ReportLine } from '../../src/realm/types.ts'

// 이 파일은 시련 관문이 열린 규칙(ascendTrialOpen 1 · 지금 규칙)을 본다. 기본값을 0 으로 바꾼 뒤에도 되돌림 손잡이로 남는 길이라 여기서 못박아 둔다
setParam('realm.ascendTrialOpen', 1)

describe('각성 (시련 관문이 열린 규칙)', () => {
  const setup = () => {
    const r = byeonhanMini(1)
    const ours = Object.values(r.heroes).filter((h) => h.faction === r.player && h.status === 'free').sort((a, b) => (a.id < b.id ? -1 : 1))
    const theirs = Object.values(r.heroes).find((h) => h.faction !== r.player && h.status === 'free')!
    return { r, h: ours[ours.length - 1]!, foe: theirs }
  }

  it('불꽃이 다 켜지면 각성 시련이 열리고, 시련을 넘으면 각성해 능력치가 모두 오른다 · 남의 장수는 안 한다', () => {
    const { r, h, foe } = setup()
    const before = { mu: h.mu, tong: h.tong, ryak: h.ryak, chi: h.chi, deok: h.deok }
    const lines: ReportLine[] = []
    // 문턱은 코드가 셈한 값 — 처음 깨어날 때는 첫 칸이 켜진 채라 ascendWins 보다 firstAscendEase 만큼 덜 이긴다
    const need = ascendNeed(h)
    assert.equal(need, Math.round(P.realm.ascendWins) - Math.round(P.realm.firstAscendEase))
    for (let i = 0; i < need - 1; i++) battleGrowth(r, [h.id, foe.id], [], [], lines)
    assert.equal(r.heroes[h.id]!.trialReady, undefined, '한 칸 모자라면 시련은 아직 닫혀 있다')
    battleGrowth(r, [h.id, foe.id], [], [], lines)
    const now = r.heroes[h.id]!
    // 11-15 형: 각성은 시련으로 — 이기기만 해서는 열리기만 한다
    assert.equal(now.ascended, undefined)
    assert.equal(now.trialReady, true)
    assert.equal(now.flames, need)
    const done = completeTrial(r, h.id)!
    Object.assign(r, done.next); lines.push(...done.lines)
    const woke = r.heroes[h.id]!
    assert.equal(woke.ascended, true)
    assert.ok(lines.some((l) => l.kind === 'ascend' && l.hero === h.id))
    // 싸움에서 공이 쌓여 무예·통솔이 따로 오를 수 있다 — 적어도 각성 몫은 오른다
    for (const s of ['mu', 'tong', 'ryak', 'chi', 'deok'] as const) assert.ok(woke[s] >= before[s] + P.realm.ascendBonus, s)
    assert.notEqual(r.heroes[foe.id]!.ascended, true, '남의 나라 장수는 각성하지 않는다')
  })

  it('지거나 비기면 불꽃이 한 칸 꺼진다 (다 꺼지지 않는다)', () => {
    const { r, h } = setup()
    const lines: ReportLine[] = []
    battleGrowth(r, [h.id], [], [], lines)
    assert.equal(r.heroes[h.id]!.flames, 1)
    battleGrowth(r, [], [h.id], [], lines)
    assert.equal(r.heroes[h.id]!.flames, undefined, '한 칸뿐이던 불꽃은 지면 빈 칸이 된다')
    battleGrowth(r, [h.id], [], [], lines)
    battleGrowth(r, [], [], [h.id], lines)
    assert.equal(r.heroes[h.id]!.flames, undefined, '비겨도 한 칸 꺼진다')
    // 두 칸을 켠 뒤 지면 한 칸만 꺼진다 (예전 규칙은 다 꺼졌다 · 11-04 에 바뀜)
    battleGrowth(r, [h.id], [], [], lines)
    battleGrowth(r, [h.id], [], [], lines)
    assert.equal(r.heroes[h.id]!.flames, 2)
    battleGrowth(r, [], [h.id], [], lines)
    assert.equal(r.heroes[h.id]!.flames, 1, '진 싸움 하나에 한 칸')
    battleGrowth(r, [], [], [h.id], lines)
    assert.equal(r.heroes[h.id]!.flames, undefined)
    assert.notEqual(r.heroes[h.id]!.ascended, true)
  })

  it('내리 이길 필요는 없다 — 지면 한 칸만 꺼지고, 다시 이겨 문턱에 닿으면 다 켜진다 (순증)', () => {
    // 첫 칸 덤을 걷어 문턱을 불꽃 칸 수(ascendWins)와 같게 둔다 — 세 번을 내리 이기지 않고도 다 켜지는 것을 본다
    const R = P.realm as unknown as Record<string, number>
    const was = R['firstAscendEase']!
    R['firstAscendEase'] = 0
    try {
      const { r, h } = setup()
      const lines: ReportLine[] = []
      const need = ascendNeed(h)
      assert.equal(need, Math.round(P.realm.ascendWins))
      assert.ok(need >= 3, '이 시험은 문턱이 셋 이상일 때 뜻이 있다')
      const win = (): void => battleGrowth(r, [h.id], [], [], lines)
      const lose = (): void => battleGrowth(r, [], [h.id], [], lines)
      // 이김 (need − 1) 번 → 짐 → 이김 두 번: 가장 긴 연승은 need − 1 인데 순증은 need
      for (let i = 0; i < need - 1; i++) win()
      lose()
      assert.equal(r.heroes[h.id]!.flames, need - 2)
      assert.equal(r.heroes[h.id]!.trialReady, undefined)
      win()
      assert.equal(r.heroes[h.id]!.trialReady, undefined)
      win()
      assert.equal(r.heroes[h.id]!.flames, need)
      assert.equal(r.heroes[h.id]!.trialReady, true, '내리 이기지 않았어도 다 켜졌다')
    } finally { R['firstAscendEase'] = was }
  })

  it('제 몫이 아닌 싸움(fair 아님)을 이겨서는 불꽃이 안 켜진다', () => {
    const { r, h } = setup()
    battleGrowth(r, [h.id], [], [], [], false)
    assert.equal(r.heroes[h.id]!.flames, undefined)
  })
})

// Explicit rollback coverage; 56-A product default stays off in awakening-persistence.test.ts.
setParam('realm.legacyAwakeningOpen', 1)
