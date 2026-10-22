/**
 * 도읍 기호 (data/art.ts capKin · capitalIcon) — 군장이 있는 곳은 갈래마다 생김이 다르다
 *  - 판마다 모든 나라의 도읍이 도읍 기호를 받고, 그 그림 파일이 있다
 *  - 목책이 없는 도읍은 울 없는 군장 마을 (그림과 실제 방비가 어긋나지 않게)
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'

import { capKin, nodeIcon } from '../../src/realm/data/art.ts'
import { startRegion } from '../../src/realm/data/regions/index.ts'

describe('도읍 기호', () => {
  it('갈래', () => {
    assert.equal(capKin('m-baekje-cap'), 'mahan')
    assert.equal(capKin('y-saro-cap'), 'jinbyeon')
    assert.equal(capKin('guya-cap'), 'jinbyeon')
    assert.equal(capKin('g-gungnae-cap'), 'goguryeo')
    assert.equal(capKin('y-yangmaek-cap'), 'goguryeo')
    assert.equal(capKin('b-buyeo-cap'), 'buyeo')
    assert.equal(capKin('o-dong-cap'), 'dongye')
    assert.equal(capKin('t-tamna-cap'), 'dongye')
  })
  it('삼한과 북녘 판의 모든 도읍이 도읍 기호를 받고 그림이 있다 · 목책 없으면 울 없는 마을', () => {
    const r = startRegion('world', 1, 'saro')
    for (const f of Object.values(r.factions)) {
      const n = r.nodes[f.capital]!
      const ic = nodeIcon(n)
      assert.ok(ic.startsWith('capital-'), `${n.id} ${ic}`)
      assert.ok(existsSync(`public/realm/icon/${ic}.png`), ic)
      if (!n.tags.includes('palisade') && capKin(n.id) !== 'dongye') assert.equal(ic, 'capital-open', n.id)
    }
  })
})
