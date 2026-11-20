import { test } from 'node:test'
import assert from 'node:assert/strict'
import { treeSvg } from '../src/raid/power-ui.ts'
import { createHaebi, KITS, kitCombos, BRANCHES, branchNodes, POWERS, type Kit } from '../src/raid/haebi.ts'
import { treeModel } from '../src/raid/tree-model.ts'
import { HAEBI_TREE as T } from '../src/tune/params.ts'

/** Read rendered attributes, never TypeScript source, so a broken renderer fails. */
const tags = (html: string) => [...html.matchAll(/<\w+\b([^>]+)>/g)].map(tag => Object.fromEntries([...tag[1]!.matchAll(/([\w-]+)="([^"]*)"/g)].map(a => [a[1]!, a[2]!])) )

test('all seven trees expose twenty information nodes and exact power prerequisites', () => {
  for (const kit of Object.keys(KITS) as Kit[]) {
    const s = createHaebi(7, 'stage', kit), before = structuredClone(s), html = treeSvg(s), rendered = tags(html)
    const nodes = rendered.filter(t => t['data-node'] || t['data-combo'] || t['data-ult'])
    assert.equal(nodes.length, 20, kit)
    assert.ok(nodes.every(t => t['role'] === 'button' && t['tabindex'] === '0'), `${kit}: every information node is keyboard reachable`)
    for (const c of kitCombos(kit)) for (const [power, need] of Object.entries(c.needs)) {
      const requirement = rendered.find(t => t['data-kind'] === 'power' && t['data-from'] === power && t['data-to'] === c.id)
      assert.ok(requirement, `${kit}/${power} → ${c.id}`)
      assert.equal(Number(requirement['data-need']), need)
      assert.equal(Number(requirement['data-have']), s.ranks[power as keyof typeof s.ranks])
    }
    assert.deepEqual(s, before, `${kit}: rendering is read only`)
  }
})

test('only real offers glow, including earned powers and a ready combo', () => {
  const s = createHaebi(7)
  const offered = () => tags(treeSvg(s)).filter(t => t['class']?.split(' ').includes('is-offered')).map(t => t['data-node'] ?? t['data-combo'])
  assert.deepEqual(offered(), [], 'pause with no cards has no selectable node')
  s.ranks.axe = 4; s.ranks.gale = 3
  assert.deepEqual(offered(), [], 'ready prerequisites do not mean the combo is offered')
  s.offers = ['axe', 'gale', 'cyclone']
  assert.deepEqual(offered().sort(), [...s.offers].sort(), 'owned power and combo offers glow too')
})

test('all branch thresholds use the whole branch sum, with no mandatory preceding power', () => {
  for (const kit of Object.keys(KITS) as Kit[]) for (const branch of BRANCHES) for (const threshold of [3, 7, 12] as const) {
    for (const points of [threshold - 1, threshold]) {
      const s = createHaebi(7, 'stage', kit)
      for (const p of Object.keys(s.ranks) as (keyof typeof s.ranks)[]) s.ranks[p] = 0
      // Spend only on earlier unlocked rows, respecting every power's real maximum.
      let rest = points
      for (const p of branchNodes(kit)[branch].slice(0, T.tiers.indexOf(threshold)).flat()) {
        s.ranks[p] = Math.min(rest, POWERS[p].max); rest -= s.ranks[p]
      }
      assert.equal(rest, 0)
      const b = treeModel(s).branches.find(b => b.id === branch)!
      assert.equal(b.points, points)
      for (const n of b.tiers[T.tiers.indexOf(threshold)]!) {
        assert.equal(n.open, points >= threshold, `${kit}/${branch}/${n.id}: ${points}/${threshold}`)
        assert.deepEqual(n.requirements, [{ kind: 'branch', from: branch, have: points, need: threshold, met: points >= threshold }])
      }
    }
  }
  const s = createHaebi(7); s.ranks.axe = 7
  assert.equal(s.ranks.reach, 0); assert.equal(s.ranks.ember, 0)
  assert.equal(treeModel(s).branches[0]!.tiers[2]![0]!.open, true)
})

test('every combo checks every exact rank, and final combo rank automatically strengthens the ultimate', () => {
  for (const kit of Object.keys(KITS) as Kit[]) for (const c of kitCombos(kit)) {
    const s = createHaebi(7, 'stage', kit)
    for (const [p, rank] of Object.entries(c.needs)) s.ranks[p as keyof typeof s.ranks] = rank
    assert.equal(treeModel(s).combos.find(n => n.id === c.id)!.open, true)
    for (const [p, rank] of Object.entries(c.needs)) {
      s.ranks[p as keyof typeof s.ranks] = rank - 1
      const n = treeModel(s).combos.find(n => n.id === c.id)!
      assert.equal(n.open, false, `${kit}/${c.id}: ${p} cannot be one rank short`)
      assert.equal(n.requirements.find(r => r.from === p)!.met, false)
      s.ranks[p as keyof typeof s.ranks] = rank
    }
    s.combos = [c.id]
    for (const rank of [1, 2, 3]) {
      s.comboRanks[c.id] = rank
      const n = treeModel(s).ult
      assert.equal(n.open, rank === T.max); assert.equal(n.offered, false)
      assert.equal(n.requirements[0]!.have, rank)
      assert.equal(n.requirements[0]!.need, T.max)
    }
  }
})
