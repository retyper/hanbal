import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createField, groupKinds, stepField } from '../../src/field/sim.ts'
import { plainSetup } from '../../src/field/scenario.ts'
import { KIND_BEATS, KIND_GRP, UNIT_KINDS, type LiveSetup, type UnitKind } from '../../src/field/types.ts'
import { U } from './kit.ts'

test('병종 상성 표는 본편 battle.ts 의 BEATS 와 같다 (배 빼고)', () => {
  const src = fs.readFileSync(path.resolve(import.meta.dirname, '../../src/realm/battle.ts'), 'utf8')
  const block = /const BEATS[^{]*\{([\s\S]*?)\n\}/.exec(src)![1]!
  const real: Record<string, string[]> = {}
  for (const m of block.matchAll(/^\s*(\w+): \[([^\]]*)\]/gm)) real[m[1]!] = [...m[2]!.matchAll(/'(\w+)'/g)].map(x => x[1]!)
  // 장정(militia)은 실험실의 병종이라 본편 표에 없다 — 상성 없음 (아무도 이기지 않고 아무에게도 지지 않는다)
  for (const k of UNIT_KINDS) if (k !== 'militia') assert.deepEqual([...KIND_BEATS[k]], real[k]!.filter(x => x !== 'boat'), k)
  assert.deepEqual([...KIND_BEATS.militia], [])
  for (const k of UNIT_KINDS) assert.ok(!KIND_BEATS[k].includes('militia'), k)
})

test('무리를 병종으로 가른다 — 기본(앞줄 방패·창 반반 · 활 4분의 3 활) · 줄 자리(방패 가운데 · 창 옆 · 긴 창 끝) · 사람 수가 맞는다', () => {
  const s = createField(plainSetup(1, 1200))
  const front = s.squads.filter(q => q.side === 0 && q.grp === 'front')
  assert.deepEqual(front.map(q => q.kind), ['spear', 'shield', 'shield', 'spear'])
  assert.deepEqual(s.squads.filter(q => q.side === 0 && q.grp === 'bows').map(q => q.kind).sort(), ['bow', 'bow', 'bow', 'crossbow'])
  for (const q of s.squads) assert.equal(KIND_GRP[q.kind as UnitKind], q.grp)
  const side = { ...plainSetup(1, 1200).sides[0], men: { front: 800, bows: 200, horse: 200 }, kinds: { shield: 400, spear: 200, pike: 200, bow: 200, horse: 200 } }
  const parts = groupKinds(side, 'front', 4)
  assert.deepEqual(parts.map(p => p.kind), ['spear', 'shield', 'shield', 'pike'])
  assert.equal(parts.reduce((a, p) => a + p.men, 0), 800)
  // 8분의 1 이하 병종은 가장 큰 병종에 붙는다
  const tiny = groupKinds({ ...side, kinds: { shield: 750, pike: 50, bow: 200, horse: 200 } }, 'front', 4)
  assert.deepEqual(tiny.map(p => p.kind), ['shield', 'shield', 'shield', 'shield'])
  assert.equal(tiny.reduce((a, p) => a + p.men, 0), 800)
})

test('방패는 화살을 덜 맞는다 (활 → 창보다 counterDown/counterUp 몫) · 같은 상성이 칼날에도', () => {
  const loss = (kind: UnitKind): number => {
    const base = plainSetup(1, 1200)
    const setup: LiveSetup = { ...base, sides: [{ ...base.sides[0], kinds: { shield: 300, bow: 300, horse: 300 } }, { ...base.sides[1], men: { front: 600, bows: 300, horse: 300 }, kinds: { [kind]: 600, bow: 300, horse: 300 } }] }
    const s = createField(setup)
    const bow = s.squads.find(q => q.side === 0 && q.grp === 'bows')!, t = s.squads.find(q => q.side === 1 && q.kind === kind)!
    s.squads = [bow, t]; s.squads.forEach((q, i) => { q.id = i; q.lock = -1; q.target = -1 }); s.heroes = []
    Object.assign(bow, { u: U(50), v: U(20), manual: 1, goal: null })
    Object.assign(t, { u: U(60), v: U(20), manual: 1, goal: null, stance: 2 })
    const hp0 = t.hp
    for (let i = 0; i < 100 && s.end === null; i++) stepField(s)
    return hp0 - t.hp
  }
  const sh = loss('shield'), sp = loss('spear')
  assert.ok(sh > 0 && sh * 10 <= sp * 7, `방패 ${sh} · 창 ${sp}`)
})
