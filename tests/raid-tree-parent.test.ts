import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHaebi, KITS, POWERS, BRANCHES, branchNodes, nodeAt, nodeParent, nodeOpen, choose, stepHaebi, xpNeeded, type Kit, type Power } from '../src/raid/haebi.ts'
import { HAEBI_RUN as C, HAEBI_TREE as T } from '../src/tune/params.ts'

const kits = Object.keys(KITS) as Kit[]
const parents = (kit: Kit): Partial<Record<Power, Power>> => ({
  reach: KITS[kit].primary, ember: KITS[kit].primary, hone: 'reach', capA: 'hone',
  echo: KITS[kit].secondary, thunder: KITS[kit].secondary, drill: 'echo', capB: 'drill',
  breath: 'tough', nimble: 'tempo', stout: 'tough', capC: 'stout',
})

test('52 every non-root power requires its one real parent at rank one alongside its branch gate', () => {
  for (const kit of kits) for (const [child, parent] of Object.entries(parents(kit)) as [Power, Power][]) {
    assert.equal(nodeParent(kit, child), parent)
    const s = createHaebi(52, 'stage', kit)
    for (const p of Object.keys(s.ranks) as Power[]) s.ranks[p] = POWERS[p].max
    s.ranks[parent] = 0
    assert.equal(nodeOpen(s, child), false, `${kit}/${child}: other maxed powers cannot replace ${parent}`)
    s.ranks[parent] = 1
    assert.equal(nodeOpen(s, child), true, `${kit}/${child}: one ${parent} is sufficient once the branch gate is met`)
    s.ranks[parent] = 0; s.ranks[child] = 0; s.offers = [child]; s.xp = xpNeeded(s)
    assert.equal(choose(s, child), false, `${kit}/${child}: choosing cannot bypass its parent`)
  }
})

test('52 every partial tree has an eligible unfinished node: earlier capacity meets each gate and parents are earlier', () => {
  for (const kit of kits) for (const branch of BRANCHES) {
    const rows = branchNodes(kit)[branch]
    for (let tier = 0; tier < rows.length; tier++) {
      const earlier = rows.slice(0, tier).flat(), capacity = earlier.reduce((n, p) => n + POWERS[p].max, 0)
      assert.ok(capacity >= T.tiers[tier]!, `${kit}/${branch}/${tier}: a full earlier prefix can open the first unfinished tier`)
      for (const child of rows[tier]!) {
        const parent = nodeParent(kit, child)
        if (parent) assert.ok(earlier.includes(parent), `${kit}/${child}: parent is earlier, so the first unfinished tier cannot lose its prerequisite`)
        else assert.equal(tier, 0)
        assert.equal(nodeAt(kit, child)!.branch, branch)
      }
    }
  }
})

test('52 legal first, last, cycling and parent-focused choices never leave a level without cards', () => {
  let picks = 0
  for (const kit of kits) for (const seed of [7, 11]) for (const route of [0, 1, 2, 3]) {
    const s = createHaebi(seed, 'stage', kit)
    s.spawn = s.nextElite = s.nextBarrage = 1e9
    while (s.level < C.maxLevel) {
      s.xp = xpNeeded(s); stepHaebi(s, { x: 0, y: 0 }, 1 / 60)
      assert.ok(s.offers.length, `${kit}/${seed}/${route}/level${s.level}: no dead end`)
      const focus = Object.values(parents(kit))
      const at = route === 0 ? 0 : route === 1 ? s.offers.length - 1 : route === 2 ? picks % s.offers.length : Math.max(0, s.offers.findIndex(p => focus.includes(p as Power)))
      assert.equal(choose(s, s.offers[at]!), true)
      picks++
    }
  }
  assert.equal(picks, kits.length * 2 * 4 * (C.maxLevel - 1))
})
