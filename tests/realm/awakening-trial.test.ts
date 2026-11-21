import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { startTutorial } from '../../src/realm/data/regions/tutorial.ts'
import { battleGrowth, ascendNeed, awardAwakening } from '../../src/realm/heroes.ts'
import { completeTrial, trialBlock } from '../../src/realm/awakening-trial.ts'
import { setParam, P } from '../../src/tune/params.ts'
import type { Realm, ReportLine } from '../../src/realm/types.ts'

function setup(ready = true) {
  const r = startTutorial(777), h = r.heroes['tut-haebi']!
  h.faction = r.player; h.status = 'free'; h.at = 'tut-wirye-cap'
  for (const a of Object.values(r.armies)) if (a.hero === h.id) a.hero = null
  const lines: ReportLine[] = []
  if (ready) for (let i = 0; i < ascendNeed(h); i++) battleGrowth(r, [h.id], [], [], lines)
  return { r, h, lines }
}
describe('해비의 본편 각성 시련', () => {
  it('공훈은 시련을 열고 자동 각성하지 않는다. 열린 시련은 연패해도 유지된다', () => {
    const { r, h, lines } = setup(false)
    assert.ok(trialBlock(r, h.id))
    battleGrowth(r, [h.id], [], [], lines, false)
    assert.equal(h.trialReady, undefined)
    for (let i = 0; i < ascendNeed(h); i++) battleGrowth(r, [h.id], [], [], lines)
    assert.equal(h.trialReady, true); assert.equal(h.ascended, undefined)
    assert.equal(trialBlock(r, h.id), null)
    for (let i = 0; i < 5; i++) battleGrowth(r, [], [h.id], [], lines)
    assert.equal(trialBlock(r, h.id), null)
    assert.ok(!lines.some(l => l.kind === 'ascend'))
  })
  it('완료는 본편 시간을 유지하고 보상은 한 번만, 저장 원본은 성공 전 변경하지 않는다', () => {
    const { r, h } = setup(), before = JSON.stringify(r)
    const reward = completeTrial(r, h.id)!
    assert.equal(JSON.stringify(r), before)
    assert.equal(reward.next.season, r.season)
    assert.deepEqual(reward.next.stock, r.stock); assert.deepEqual(reward.next.armies, r.armies)
    const awake = reward.next.heroes[h.id]!
    assert.equal(awake.ascended, true); assert.equal(awake.trialCleared, true)
    for (const stat of ['mu', 'tong', 'ryak', 'chi', 'deok'] as const) assert.equal(awake[stat], h[stat] + P.realm.ascendBonus)
    const loaded = JSON.parse(JSON.stringify(reward.next)) as Realm
    assert.equal(completeTrial(loaded, h.id), null)
    for (let i = 0; i < 5; i++) battleGrowth(loaded, [], [h.id], [], [])
    assert.equal(loaded.heroes[h.id]!.ascended, true)
    assert.equal(loaded.heroes[h.id]!.trialCleared, true)
    assert.equal(loaded.heroes[h.id]!.flames, 0)
    assert.equal(loaded.heroes[h.id]!.chi, awake.chi)
  })
  it('기존 각성 저장은 시련을 치러도 능력치 보상을 중복 지급하지 않는다', () => {
    const { r, h } = setup(); awardAwakening(h, [])
    const reward = completeTrial(r, h.id)!
    assert.equal(reward.next.heroes[h.id]!.mu, h.mu)
    assert.equal(reward.next.heroes[h.id]!.ascents, h.ascents)
    assert.equal(reward.lines.length, 0)
  })
  it('적·포로·부상·원정·진군·끝난 캠페인·공훈 부족은 막는다', () => {
    const checks: Array<(r: Realm) => void> = [
      r => { r.heroes['tut-haebi']!.faction = 'michuhol' },
      r => { r.heroes['tut-haebi']!.status = 'captive' },
      r => { r.heroes['tut-haebi']!.woundedUntil = r.season + 2 },
      r => { r.heroes['tut-haebi']!.awayUntil = r.season + 2 },
      r => { const a = Object.values(r.armies)[0]!; a.hero = 'tut-haebi'; a.march = { from: a.at!, to: 'tut-galdae', edge: Object.keys(r.edges)[0]!, left: 1, ambush: false } },
      r => { r.outcome = { kind: 'win', season: r.season } },
      r => { delete r.heroes['tut-haebi']!.trialReady; delete r.heroes['tut-haebi']!.flames },
    ]
    for (const change of checks) { const { r, h } = setup(); change(r); assert.ok(trialBlock(r, h.id)); assert.equal(completeTrial(r, h.id), null) }
    assert.ok(trialBlock(setup().r, 'tut-onjo'))
  })
})

// Explicit rollback coverage; 56-A product default stays off in awakening-persistence.test.ts.
setParam('realm.legacyAwakeningOpen', 1)
