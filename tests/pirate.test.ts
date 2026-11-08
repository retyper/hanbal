/**
 * 바다도적 막기 (docs/realm/SNIPE.md §0-9) — 물결 표 · 판의 규칙 · 나라로 가는 값
 *
 *  - 같은 시드 = 같은 물결 (A1) · 세기가 칼잡이 수를 흔든다
 *  - 아무도 안 쏘면 첫 물결에 목책이 다 부서진다 (held 0)
 *  - 다 막으면 물결 셋 · 70초 안팎
 *  - 막은 물결이 많을수록 덜 잃는다 · 미리 본 수 = 실제로 걸린 수
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { P } from '../src/tune/params.ts'
import { archerStr, bakeWaves, palisadeLives, swordCount, WAVE_COUNT } from '../src/pirate/waves.ts'
import { createPirate, stepPirate, type PirateRun } from '../src/pirate/sim.ts'
import type { InputFrame } from '../src/sim/types.ts'
import { byeonhanMini } from '../src/realm/data/regions/byeonhan-mini.ts'
import { cardPreview, pirateLossMul, pirateMission, resolveCard } from '../src/realm/events.ts'
import type { Card, Realm, ReportLine } from '../src/realm/types.ts'

const idle: InputFrame = { aimX: 10, aimY: 2, drawing: false, steady: false, parry: false }

/** 판 끝까지 돌린다 — perfect 면 스텝마다 적을 다 쓰러뜨린 셈 친다 (막는 손) */
function run(seed: number, perfect: boolean, maxSec = 300): PirateRun {
  const p = createPirate({ seed, sev: 2, mu: 5, watch: 0 })
  const n = Math.round(maxSec / p.w.dt)
  for (let i = 0; i < n && p.result === null; i++) {
    stepPirate(p, idle)
    if (perfect) for (let j = 0; j < p.w.targets.length; j++) {
      const r = p.role[j]
      if (r === 'sword' || r === 'captain' || r === 'archer') p.w.targets[j]!.alive = false
    }
  }
  return p
}

describe('바다도적 막기 — 물결 표', () => {
  it('같은 시드면 같은 물결 · 다른 시드면 다르다', () => {
    assert.deepEqual(bakeWaves(7, 2), bakeWaves(7, 2))
    assert.notDeepEqual(bakeWaves(7, 2), bakeWaves(8, 2))
  })
  it('물결 셋 · 칼잡이 수는 표대로 · 둘째부터 배 궁수 · 셋째에 두목 하나 · 궤짝은 물결마다', () => {
    const ws = bakeWaves(3, 2)
    assert.equal(ws.length, WAVE_COUNT)
    ws.forEach((w, k) => {
      const of = (what: string): number => w.spawns.filter((s) => s.what === what).length
      assert.equal(of('sword'), swordCount(k, 2))
      assert.equal(of('archer'), k === 0 ? 0 : k === 1 ? P.pirate.archers2 : P.pirate.archers3)
      assert.equal(of('captain'), k === 2 ? 1 : 0)
      assert.equal(of('barrel'), P.pirate.barrels)
      for (let i = 1; i < w.spawns.length; i++) assert.ok(w.spawns[i]!.at >= w.spawns[i - 1]!.at)
    })
  })
  it('큰 무리는 칼잡이가 많고 작은 무리는 적다', () => {
    for (let k = 0; k < 3; k++) assert.ok(swordCount(k, 1) < swordCount(k, 2) && swordCount(k, 2) < swordCount(k, 3))
  })
  it('포구 장수의 무예가 근력을 · 경계가 목책을 올린다', () => {
    assert.equal(archerStr(0), P.pirate.stat)
    assert.ok(archerStr(9) > archerStr(5))
    assert.equal(palisadeLives(0), P.pirate.lives)
    assert.equal(palisadeLives(1), P.pirate.lives + 1)
  })
})

describe('바다도적 막기 — 판', () => {
  it('아무도 안 쏘면 첫 물결에 목책이 다 부서진다', () => {
    const p = run(11, false)
    assert.deepEqual(p.result, { won: false, held: 0 })
    assert.equal(p.lives, 0)
    assert.ok(p.brokeAt.every((t) => t >= 0))
  })
  it('같은 시드 · 같은 손이면 같은 판 (A1)', () => {
    const a = run(21, false)
    const b = run(21, false)
    assert.equal(a.w.tick, b.w.tick)
    assert.deepEqual(a.brokeAt, b.brokeAt)
  })
  it('다 막으면 물결 셋을 넘기고 이긴다 · 쓰러뜨리는 데 드는 틈 없이도 45~110초', () => {
    const p = run(5, true)
    assert.deepEqual(p.result, { won: true, held: 3 })
    const sec = p.w.tick * p.w.dt
    assert.ok(sec > 45 && sec < 110, `${sec}`)
  })
  it('화살은 끝이 없다 · 적 화살은 목숨이 아니다', () => {
    const p = createPirate({ seed: 2, sev: 2, mu: 5, watch: 0 })
    for (let i = 0; i < 600; i++) stepPirate(p, idle)
    assert.equal(p.w.status, 'playing')
    assert.ok(p.w.arrowsLeft > 50)
  })
})

describe('바다도적 막기 — 나라로 가는 값', () => {
  type CardLine = Extract<ReportLine, { kind: 'card' }>
  const port = (r: Realm): string => Object.values(r.nodes).filter((n) => n.owner === r.player && n.kind !== 'sodo').sort((a, b) => (a.id < b.id ? -1 : 1))[0]!.id
  function play(seed: number, pick: 0 | 1 | 2, held?: number): { pv: NonNullable<ReturnType<typeof cardPreview>>; line: CardLine } {
    const r = byeonhanMini(seed)
    r.stock[r.player]!.grain = 500
    r.stock[r.player]!.iron = 40
    const c: Card = { kind: 'pirates', season: r.season, node: port(r) }
    r.card = c
    const pv = cardPreview(r, c, pick, undefined, held)!
    const out: ReportLine[] = []
    resolveCard(r, [{ kind: 'card', faction: r.player, pick, ...(held !== undefined ? { held } : {}) }], out)
    return { pv, line: out.find((l): l is CardLine => l.kind === 'card')! }
  }
  it('쏘기 전에는 굴림이 없다 · 다 막으면 · 첫 물결에 지면 둘 다 보인다', () => {
    const { pv } = play(4, 1)
    assert.equal(pv.hand, true)
    assert.equal(pv.chance, undefined)
    assert.ok((pv.win?.iron ?? 0) >= Math.round(P.realm.cardPirateIron))
    assert.ok((pv.lose?.grain ?? 0) < 0)
  })
  it('다 막으면 미리 본 쇠를 그대로 빼앗는다', () => {
    const { pv, line } = play(4, 1, 3)
    assert.equal(line.good, true)
    assert.equal(line.held, 3)
    assert.equal(line.iron, pv.sure.iron)
    assert.equal(line.grain, undefined)
  })
  it('오래 버틸수록 덜 잃는다 · 미리 본 수 = 걸린 수', () => {
    const lost = [0, 1, 2].map((h) => {
      const { pv, line } = play(4, 1, h)
      assert.equal(line.good, false)
      assert.equal(line.held, h)
      assert.equal(line.grain, pv.sure.grain)
      return -(line.grain ?? 0)
    })
    assert.ok(lost[0]! > lost[1]! && lost[1]! > lost[2]! && lost[2]! > 0, lost.join(' '))
    assert.ok(pirateLossMul(0) === 1 && pirateLossMul(2) < pirateLossMul(1))
  })
  it('맞선다를 골랐는데 쏘지 않았으면 장수에게 맡긴다 (굴림)', () => {
    const a = play(9, 1)
    const b = play(9, 2)
    assert.equal(a.line.pick, 2)
    assert.deepEqual(a.line, b.line)
  })
  it('판에 넘길 것 — 같은 계절·포구면 같은 시드', () => {
    const r = byeonhanMini(6)
    const c: Card = { kind: 'pirates', season: r.season, node: port(r) }
    assert.deepEqual(pirateMission(r, c), pirateMission(r, c))
    assert.equal(pirateMission(r, c).sev, 2)
  })
})

describe('바다도적 막기 — 궤짝', () => {
  it('궤짝을 맞히면 그 살로 바뀌고, specialSec 뒤에 유엽전으로 돌아온다', async () => {
    const { spawnArrow } = await import('../src/sim/ballistics.ts')
    const p = createPirate({ seed: 3, sev: 2, mu: 5, watch: 0 })
    // 첫 궤짝이 뜰 때까지
    let id = -1
    for (let i = 0; i < 60 * 120 && id < 0; i++) {
      stepPirate(p, idle)
      id = p.role.indexOf('barrel')
    }
    assert.ok(id >= 0)
    const want = p.barrelArrow[id]!
    const a = spawnArrow(p.w, 0, 1)!
    const t = p.w.targets[id]!
    t.x = a.x + 1
    t.baseY = a.y
    t.y = a.y
    let armed = false
    for (let i = 0; i < 30 && !armed; i++) {
      stepPirate(p, idle)
      armed = p.events.some((e) => e.t === 'arm')
    }
    assert.ok(armed)
    assert.equal(p.special, want)
    assert.equal(p.w.arrowKind, want)
    for (let i = 0; i < Math.ceil((P.pirate.specialSec + 0.1) / p.w.dt); i++) {
      stepPirate(p, idle)
      for (let j = 0; j < p.w.targets.length; j++) if (p.role[j] === 'sword' || p.role[j] === 'captain' || p.role[j] === 'archer') p.w.targets[j]!.alive = false
    }
    assert.equal(p.result, null)
    assert.equal(p.w.arrowKind, 'basic')
    assert.equal(p.special, 'basic')
  })
})
