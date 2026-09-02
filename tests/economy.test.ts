/**
 * 훈련치를 쓰는 곳 (2026-09-02, 형: "돈 쓸 곳을 좀 더 많이 마련해봐야 해. 돈을 벌고 싶어지도록").
 *
 * 다섯 소비처의 계약:
 *  ① 대장간 — 활마다 따로, 단마다 비싸지고, 상한이 있고, 효과는 bowMods 배수로만 들어간다.
 *  ② 부적 — 하나만, 여정 한 번, 효과는 game 레이어의 순수 함수다 (sim은 모른다).
 *  ③ 화살 한 발 — 살수록 비싸지고 판당 상한이 있다.
 *  ④ 금관 사수 — **머리로** 눕혀야 bounty 사건이 난다. 몸통으로 눕히면 없다. 채점에 현상금이 붙는다.
 *  ⑤ 살 가게 — 깊은 마디의 살이 비싸고, 유엽전은 팔지 않는다.
 * 그리고 세이브 v13이 이 전부를 빈손으로 올린다.
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
const { bowMods } = await import('../src/game/bows.ts')
const { FORGE_PARTS, buyForge, canForge, forgeBlocked, forgeCost, forgeLevel, forgeLevels, forgeMax, forgeMul } =
  await import('../src/game/forge.ts')
const {
  CHARMS, applyCharmToStage, buyCharm, charmArrowBonus, charmBossHpMul, charmCost, charmStartArmor, charmStartHp,
  charmTrainMul, runCharmOf,
} = await import('../src/game/charms.ts')
const { arrowBuyMax, buyDefense, defenseBlocked, defenseCost, armorPer } = await import('../src/game/defense.ts')
const { shopPrice, supplyCycleOf } = await import('../src/game/supply.ts')
const { gradeRun } = await import('../src/game/rewards.ts')
const { getStage, BOSS_EVERY, CAMPAIGN } = await import('../src/game/stages.ts')
const { createWorld, step } = await import('../src/sim/world.ts')
const { makeRng } = await import('../src/core/rng.ts')
const { P } = await import('../src/tune/params.ts')
type InputFrame = import('../src/sim/types.ts').InputFrame
type StageDef = import('../src/sim/types.ts').StageDef
type Stats = import('../src/sim/types.ts').Stats
type DefenseState = import('../src/game/defense.ts').DefenseState

const KEY = 'hanbal.save.v1'
const STATE = (over: Partial<DefenseState> = {}): DefenseState => ({
  playing: true, shield: 0, shieldMax: 0, armor: 0, armorMax: 0, arrowsBought: 0, ...over,
})

describe('대장간 — 활 개조', () => {
  it('단마다 비싸지고 상한에서 멈춘다', () => {
    const d = defaultSave(0)
    d.training = 1000
    let last = 0
    for (let lv = 0; lv < forgeMax(); lv++) {
      const c = forgeCost(lv)
      assert.ok(c > last, `${lv}단 값 ${c} > ${last}`)
      last = c
      assert.equal(forgeBlocked(d, 'gakgung', 'limb'), '')
      assert.ok(buyForge(d, 'gakgung', 'limb'))
      assert.equal(forgeLevel(d, 'gakgung', 'limb'), lv + 1)
    }
    assert.equal(forgeBlocked(d, 'gakgung', 'limb'), '더 갈 데가 없다')
    assert.equal(buyForge(d, 'gakgung', 'limb'), false)
    assert.equal(d.training, 1000 - (forgeCost(0) + forgeCost(1) + forgeCost(2)))
  })

  it('개조는 그 활의 것이다 — 다른 활에는 따라가지 않는다', () => {
    const d = defaultSave(0)
    d.training = 100
    buyForge(d, 'gakgung', 'string')
    assert.equal(forgeLevel(d, 'gakgung', 'string'), 1)
    assert.equal(forgeLevel(d, 'practice', 'string'), 0)
    assert.deepEqual(forgeLevels(d, 'practice'), { string: 0, limb: 0, grip: 0 })
  })

  it('훈련치가 모자라면 아무것도 안 깎인다', () => {
    const d = defaultSave(0)
    d.training = forgeCost(0) - 1
    assert.match(forgeBlocked(d, 'practice', 'grip'), /훈련치/)
    assert.equal(buyForge(d, 'practice', 'grip'), false)
    assert.equal(d.training, forgeCost(0) - 1)
    assert.equal(canForge(d, 'practice'), false)
  })

  it('효과는 bowMods 배수로만 들어간다 — 시위는 당김, 활채는 초속, 줌통은 떨림', () => {
    const base = bowMods('practice', 'basic', 0)
    const m = bowMods('practice', 'basic', 0, { string: 2, limb: 3, grip: 1 })
    assert.ok(m.drawTimeMul < base.drawTimeMul)
    assert.ok(m.speedMul > base.speedMul)
    assert.ok(m.tremorMul < base.tremorMul)
    assert.ok(Math.abs(m.speedMul - forgeMul('limb', 3)) < 1e-12)
    // 손대지 않은 채널은 그대로다.
    assert.equal(m.windMul, base.windMul)
    assert.equal(m.holdDrainMul, base.holdDrainMul)
    assert.equal(FORGE_PARTS.length, 3)
  })
})

describe('부적 — 여정 한 번', () => {
  it('넷의 값이 전부 양수이고, 산 것만 지닌다', () => {
    const d = defaultSave(0)
    d.training = 100
    for (const c of CHARMS) assert.ok(charmCost(c.id) > 0)
    assert.ok(buyCharm(d, 'quiver'))
    assert.equal(runCharmOf(d), 'quiver')
    assert.equal(d.training, 100 - charmCost('quiver'))
    // 빈손으로 떠나기
    assert.equal(buyCharm(d, ''), false)
    assert.equal(runCharmOf(d), '')
    // 모자라면 못 산다 — 훈련치도 그대로
    d.training = charmCost('ghost') - 1
    assert.equal(buyCharm(d, 'ghost'), false)
    assert.equal(runCharmOf(d), '')
    assert.equal(d.training, charmCost('ghost') - 1)
  })

  it('효과는 서로 다른 축이다 — 화살·갑옷·훈련치/체력·보스', () => {
    assert.equal(charmArrowBonus('quiver'), 1)
    assert.equal(charmArrowBonus('iron'), 0)
    assert.equal(charmStartArmor('iron'), armorPer())
    assert.equal(charmStartArmor('gold'), 0)
    assert.ok(charmTrainMul('gold') > 1)
    assert.ok(charmStartHp('gold') < charmStartHp(''))
    assert.equal(charmStartHp('quiver'), Math.floor(P.enemy.hpMax))
    assert.ok(charmBossHpMul('ghost') < 1)
    assert.equal(charmBossHpMul(''), 1)
  })

  it('파귀 부적은 보스 체력만 깎고, 보스가 없는 판은 그대로 돌려준다', () => {
    const boss = getStage(BOSS_EVERY - 1)
    const eased = applyCharmToStage(boss, 'ghost')
    assert.notEqual(eased, boss)
    for (let i = 0; i < boss.targets.length; i++) {
      const a = boss.targets[i]
      const b = eased.targets[i]
      if (a === undefined || b === undefined) continue
      if (a.kind === 'boss') assert.ok((b.hp ?? 0) < (a.hp ?? 0), '보스 체력이 줄었다')
      else assert.equal(b.hp, a.hp)
    }
    const plain = getStage(0)
    assert.equal(applyCharmToStage(plain, 'ghost'), plain)
    assert.equal(applyCharmToStage(boss, 'quiver'), boss)
  })
})

describe('화살 한 발 — 판 도중', () => {
  it('살수록 비싸지고 판당 상한에서 멈춘다', () => {
    const d = defaultSave(0)
    d.training = 1000
    const st = STATE()
    let last = -1
    for (let i = 0; i < arrowBuyMax(); i++) {
      const c = defenseCost('arrow', st)
      assert.ok(c > last, `${i}번째 값 ${c} > ${last}`)
      last = c
      assert.equal(defenseBlocked(d, 'arrow', st), '')
      assert.ok(buyDefense(d, 'arrow', st))
      st.arrowsBought++
    }
    assert.equal(defenseBlocked(d, 'arrow', st), '이 판에서는 더 못 산다')
    assert.equal(buyDefense(d, 'arrow', st), false)
  })

  it('판이 안 도는 동안에는 못 산다', () => {
    const d = defaultSave(0)
    d.training = 100
    assert.equal(defenseBlocked(d, 'arrow', STATE({ playing: false })), '판이 도는 중에만 산다')
  })
})

describe('금관 사수 — 현상금', () => {
  const STATS: Stats = { str: 14, steady: 8, stamina: 12, focus: 6 }

  /** 금관 사수 하나. 뒤의 먼 더미는 빈 판 즉시 클리어 방지용이다. */
  function arena(bounty: boolean): StageDef {
    return {
      id: 'bounty-test',
      seed: 7,
      arrows: 30,
      targetScore: 100,
      wind: 0,
      targets: [
        { kind: 'archer', x: 14, y: 1.4, r: 0.65, hp: 70, fireDelay: 99, look: 1, score: 100, bounty },
        { kind: 'static', x: 60, y: 12, r: 0.2, score: 0 },
      ],
    }
  }

  /** 겨눈 점을 향해 만작으로 한 발 쏘고 결과 사건을 모은다. */
  function shootAt(stage: StageDef, aimY: number): string[] {
    const w = createWorld(stage, STATS, 'basic')
    const seen: string[] = []
    const frame: InputFrame = { aimX: 14, aimY, drawing: true, steady: false }
    for (let i = 0; i < 40; i++) step(w, frame)
    frame.drawing = false
    for (let i = 0; i < 240; i++) {
      step(w, frame)
      for (const e of w.events) if (e !== undefined) seen.push(e.t)
      w.events.length = 0
    }
    return seen
  }

  it('머리를 맞혀 눕히면 bounty 사건이 난다', () => {
    const t = arena(true).targets[0]
    const headY = (t?.y ?? 0) + (t?.r ?? 0) * P.enemy.archerHeadUp
    const seen = shootAt(arena(true), headY)
    assert.ok(seen.includes('hit'), `맞았어야 한다: ${seen.join(',')}`)
    assert.ok(seen.includes('bounty'), `현상금: ${seen.join(',')}`)
  })

  it('금관이 없는 사수는 머리를 맞혀도 현상금이 없다', () => {
    const t = arena(false).targets[0]
    const headY = (t?.y ?? 0) + (t?.r ?? 0) * P.enemy.archerHeadUp
    const seen = shootAt(arena(false), headY)
    assert.ok(seen.includes('hit'))
    assert.ok(!seen.includes('bounty'))
  })

  it('몸통으로 맞히면 현상금이 없다 — 현상금은 처치가 아니라 조준의 값이다', () => {
    const t = arena(true).targets[0]
    const seen = shootAt(arena(true), (t?.y ?? 0) - (t?.r ?? 0) * 0.5)
    assert.ok(seen.includes('hit'), `맞았어야 한다: ${seen.join(',')}`)
    assert.ok(!seen.includes('bounty'))
  })

  it('채점에 현상금 위업이 붙고, 실패한 판에서도 가져간다', () => {
    const stage = getStage(0)
    const base = {
      cleared: false, score: 0, arrowsUsed: 3, arrowsGiven: 6, hits: 1, shots: 3, misses: 2,
      bestChain: 0, bullseyes: 0, bounties: 0,
    }
    const none = gradeRun(makeRng(1), stage, base)
    const one = gradeRun(makeRng(1), stage, { ...base, bounties: 1 })
    assert.ok(one.training > none.training)
    assert.ok(one.feats.some((f) => f.includes('현상금')))
  })

  it('금관은 12판부터, 창의 사수 중 하나에만, 판 번호가 시드다', () => {
    let seen = 0
    for (let i = BOSS_EVERY; i < CAMPAIGN; i++) {
      const s = getStage(i)
      const crowned = s.targets.filter((t) => t.bounty === true)
      assert.ok(crowned.length <= 1, `${i + 1}판 금관 ${crowned.length}`)
      if (i + 1 < P.enemy.bountyFrom) assert.equal(crowned.length, 0)
      for (const c of crowned) {
        assert.equal(c.kind, 'archer')
        assert.equal(c.look, 1)
        assert.notEqual(c.armored, true)
        assert.match(s.hint ?? '', /현상금/)
      }
      seen += crowned.length
      assert.deepEqual(getStage(i).targets, s.targets)
    }
    assert.ok(seen > 0, '캠페인에 금관 사수가 하나는 있어야 한다')
  })
})

describe('살 가게', () => {
  it('깊은 마디의 살이 비싸고 유엽전은 팔지 않는다', () => {
    assert.equal(shopPrice('basic'), 0)
    assert.equal(supplyCycleOf('burst'), 1)
    assert.equal(supplyCycleOf('pierce'), 2)
    assert.equal(supplyCycleOf('heavy'), 3)
    assert.equal(supplyCycleOf('homing'), 4)
    assert.ok(shopPrice('burst') < shopPrice('pierce'))
    assert.ok(shopPrice('pierce') < shopPrice('heavy'))
    assert.ok(shopPrice('heavy') < shopPrice('homing'))
  })
})

describe('세이브 v13', () => {
  it('새 세이브는 대장간·부적이 빈손이고, 옛 세이브도 빈손으로 올라온다', () => {
    assert.ok(SCHEMA_VERSION >= 13)
    const d = defaultSave(0)
    assert.deepEqual(d.forge, {})
    assert.equal(d.runCharm, '')
    store.set(KEY, JSON.stringify({ v: 12, training: 9 }))
    const a = loadSave()
    assert.equal(a.v, SCHEMA_VERSION)
    assert.deepEqual(a.forge, {})
    assert.equal(a.runCharm, '')
    assert.equal(a.training, 9)
    store.set(KEY, JSON.stringify({ v: SCHEMA_VERSION, forge: { 'gakgung.limb': 2 }, runCharm: 'iron' }))
    const b = loadSave()
    assert.equal(b.forge['gakgung.limb'], 2)
    assert.equal(b.runCharm, 'iron')
  })
})
