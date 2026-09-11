/**
 * 갑옷 세 벌 (2026-09-10, 형: "방어구는 고를 수도, 더 강화시킬 수도 없잖아") — 배선 검사.
 * 장만 → 입기 → 담금질 → 판에서 겹쳐 입기가 한 줄로 이어지는지, 세이브가 옛 사람의 두정갑을 지키는지.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

const store = new Map<string, string>()
;(globalThis as Record<string, unknown>)['localStorage'] = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size },
}

const { defaultSave, loadSave, SCHEMA_VERSION } = await import('../src/game/save.ts')
const {
  armorCapOf, armorCostOf, armorForgeBlocked, armorKindOf, armorLevel, armorOwned, armorPerOf,
  armorUnlockBlocked, armorUnlockCost, buyArmorForge, buyArmorKind, equipArmor,
} = await import('../src/game/armor.ts')
const { armorPer, armorCap, buyDefense, defenseCost } = await import('../src/game/defense.ts')
const { forgeCost } = await import('../src/game/forge.ts')
const { P } = await import('../src/tune/params.ts')

const KEY = 'hanbal.save.v1'

describe('갑옷 세 벌', () => {
  it('새 세이브는 가죽갑 하나뿐이고, 가죽갑은 두정갑의 armorLightMul 배다', () => {
    const d = defaultSave(0)
    assert.equal(armorKindOf(d), 'leather')
    assert.equal(armorOwned(d, 'brigandine'), false)
    assert.equal(armorPerOf(d), Math.floor(P.defense.armorPer * P.defense.armorLightMul))
    assert.equal(armorCapOf(d), Math.floor(P.defense.armorMax * P.defense.armorLightMul))
    assert.equal(armorCostOf(d), Math.floor(P.defense.armorCost * P.defense.armorLightMul))
    // defense.ts 는 입은 벌을 본다.
    assert.equal(armorPer(d), armorPerOf(d))
    assert.equal(armorCap(d), armorCapOf(d))
    assert.equal(defenseCost('armor', undefined, d), armorCostOf(d))
  })

  it('장만 — 훈련치가 모자라면 못 사고, 사면 곧바로 입는다. 찰갑은 두정갑보다 크고 비싸다', () => {
    const d = defaultSave(0)
    assert.match(armorUnlockBlocked(d, 'brigandine'), /\d+ 필요/)
    assert.equal(buyArmorKind(d, 'brigandine'), false)
    d.training = armorUnlockCost('brigandine') + armorUnlockCost('lamellar')
    assert.equal(buyArmorKind(d, 'brigandine'), true)
    assert.equal(armorKindOf(d), 'brigandine')
    assert.equal(armorPerOf(d), Math.floor(P.defense.armorPer))
    assert.equal(buyArmorKind(d, 'lamellar'), true)
    assert.equal(d.training, 0)
    assert.equal(armorKindOf(d), 'lamellar')
    assert.ok(armorPerOf(d, 'lamellar') > armorPerOf(d, 'brigandine'))
    assert.ok(armorCostOf(d, 'lamellar') > armorCostOf(d, 'brigandine'))
    assert.equal(armorUnlockBlocked(d, 'lamellar'), '이미 있다')
    // 입기는 가진 벌만. 가죽으로 돌아갈 수도 있다.
    assert.equal(equipArmor(d, 'leather'), true)
    assert.equal(armorKindOf(d), 'leather')
  })

  it('담금질 — 단마다 방어량·상한이 armorForgePer 만큼 오르고, 값은 활 개조와 같은 곡선이다', () => {
    const d = defaultSave(0)
    assert.match(armorForgeBlocked(d), /\d+ 필요/)
    d.training = forgeCost(0) + forgeCost(1)
    const base = armorPerOf(d)
    assert.equal(buyArmorForge(d), true)
    assert.equal(armorLevel(d, 'leather'), 1)
    assert.equal(armorPerOf(d), Math.floor(P.defense.armorPer * P.defense.armorLightMul * (1 + P.defense.armorForgePer)))
    assert.ok(armorPerOf(d) > base)
    assert.equal(buyArmorForge(d), true)
    assert.equal(d.training, 0)
    assert.equal(armorLevel(d, 'leather'), 2)
    // 담금질은 벌마다 따로다 — 가죽을 담갔다고 두정갑이 오르지 않는다.
    assert.equal(armorLevel(d, 'brigandine'), 0)
  })

  it('판 도중에 사는 갑옷은 입은 벌 한 벌이다 — 값도 상한도 그 벌의 것', () => {
    const d = defaultSave(0)
    d.training = 999
    const st = { playing: true, shield: 0, shieldMax: 0, armor: 0, armorMax: 0, arrowsBought: 0 }
    assert.equal(buyDefense(d, 'armor', st), true)
    assert.equal(d.runArmor, armorPerOf(d))
    assert.equal(d.training, 999 - armorCostOf(d))
    // 상한까지 겹쳐 입는다.
    for (let i = 0; i < 10; i++) buyDefense(d, 'armor', st)
    assert.equal(d.runArmor, armorCapOf(d))
  })

  it('세이브 v15 — 옛 세이브는 두정갑을 가진 채 입은 채로 올라온다 (가죽으로 얇아지지 않는다)', () => {
    assert.ok(SCHEMA_VERSION >= 15)
    store.set(KEY, JSON.stringify({ v: 14, training: 7 }))
    const a = loadSave()
    assert.equal(a.v, SCHEMA_VERSION)
    assert.equal(armorKindOf(a), 'brigandine')
    assert.equal(armorOwned(a, 'brigandine'), true)
    assert.equal(a.training, 7)
    // 최신 세이브: 가진 벌이 아닌 값을 들고 있으면 가죽갑으로 읽는다. 담금질은 정화되어 남는다.
    store.set(KEY, JSON.stringify({ v: SCHEMA_VERSION, armorKind: 'lamellar', armorOwned: [], armorForge: { leather: 2 } }))
    const b = loadSave()
    assert.equal(armorKindOf(b), 'leather')
    assert.equal(armorLevel(b, 'leather'), 2)
  })
})
