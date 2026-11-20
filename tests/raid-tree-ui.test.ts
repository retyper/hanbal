import { test } from 'node:test'
import assert from 'node:assert/strict'
import { treeSvg, treeInfo } from '../src/raid/power-ui.ts'
import { createHaebi, KITS, kitCombos, kitPowers, nodeParent, nodeOpen, type Kit } from '../src/raid/haebi.ts'
import { treeModel } from '../src/raid/tree-model.ts'
import { HAEBI_TREE as T } from '../src/tune/params.ts'

/** Read rendered attributes, never TypeScript source, so a broken renderer fails. */
const tags = (html: string) => [...html.matchAll(/<\w+\b([^>]+)>/g)].map(tag => Object.fromEntries([...tag[1]!.matchAll(/([\w-]+)="([^"]*)"/g)].map(a => [a[1]!, a[2]!])) )

test('52 branch-only explanation appears only after its parent is satisfied', () => {
  const s = createHaebi(7), element = (power: string) => ({ getAttribute: (key: string) => key === 'data-node' ? power : null }) as unknown as Element
  assert.doesNotMatch(treeInfo(s, element('hone')), /번 더 고르면 열립니다/, 'a missing parent cannot be replaced by more branch choices')
  assert.match(treeInfo(s, element('reach')), /이 갈래를 2번 더 고르면 열립니다/)
  s.ranks.reach = 1
  assert.match(treeInfo(s, element('hone')), /이 갈래를 5번 더 고르면 열립니다/)
  s.ranks.axe = 6
  assert.doesNotMatch(treeInfo(s, element('hone')), /번 더 고르면 열립니다/, 'no gate explanation after both requirements are met')
})

test('all seven trees expose twenty information nodes and exact power prerequisites', () => {
  for (const kit of Object.keys(KITS) as Kit[]) {
    const s = createHaebi(7, 'stage', kit), before = structuredClone(s), html = treeSvg(s), rendered = tags(html)
    const nodes = rendered.filter(t => t['data-node'] || t['data-combo'] || t['data-ult'])
    assert.equal(nodes.length, 20, kit)
    assert.ok(nodes.every(t => t['role'] === 'button' && t['tabindex'] === '0'), `${kit}: every information node is keyboard reachable`)
    assert.equal(rendered.filter(t => t['src']).length, 20, `${kit}: only one picture per real node`)
    assert.equal(rendered.filter(t => t['class']?.split(' ').includes('tree-edge')).length, 21, `${kit}: actual parent links, including three alternatives to the ultimate`)
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

test('52 the rendered graph has the exact simulation parent, four roots and no cycle', () => {
  for (const kit of Object.keys(KITS) as Kit[]) {
    const s = createHaebi(7, 'stage', kit), model = treeModel(s)
    assert.equal(model.nodes.filter(n => n.kind === 'power' && !n.requirements.length).length, 4)
    for (const p of kitPowers(kit)) {
      const n = model.nodes.find(n => n.id === p)!, parent = nodeParent(kit, p)
      assert.equal(n.open, nodeOpen(s, p))
      assert.deepEqual(n.requirements, parent ? [{ kind: 'power', from: parent, have: s.ranks[parent], need: 1, met: s.ranks[parent] >= 1 }] : [])
      const visited = new Set<string>([p]); let at = parent
      while (at) { assert.ok(!visited.has(at), `${kit}/${p}: cycle`); visited.add(at); at = nodeParent(kit, at) }
    }
  }
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
      assert.equal(n.requirements.find(r => r.from === c.id)!.have, rank)
      assert.ok(n.requirements.every(r => r.need === T.max))
    }
  }
})
