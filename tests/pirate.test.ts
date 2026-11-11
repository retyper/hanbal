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
import { createPirate, pickBoon, stepPirate, type PirateRun } from '../src/pirate/sim.ts'
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
      if (r === 'sword' || r === 'shield' || r === 'captain' || r === 'archer') p.w.targets[j]!.alive = false
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
      for (let j = 0; j < p.w.targets.length; j++) if (p.role[j] === 'sword' || p.role[j] === 'shield' || p.role[j] === 'captain' || p.role[j] === 'archer') p.w.targets[j]!.alive = false
    }
    assert.equal(p.result, null)
    assert.equal(p.w.arrowKind, 'basic')
    assert.equal(p.special, 'basic')
  })
})

describe('바다도적 막기 — 방패 · 고르기 · 산적', () => {
  async function shieldBed(): Promise<{ p: PirateRun; id: number }> {
    const p = createPirate({ seed: 3, sev: 2, mu: 5, watch: 0 })
    // 방패 든 도적 하나를 직접 세운다 (둘째 물결의 표를 이 한 명으로 바꿔서)
    p.wave = 1
    p.phase = 'fight'
    p.waveT = 0
    ;(p.waves[1] as { spawns: unknown[] }).spawns.splice(0, p.waves[1]!.spawns.length, { at: 0, what: 'shield', x: 10, speed: 0 })
    p.next = 0
    stepPirate(p, idle)
    const id = p.role.indexOf('shield')
    assert.ok(id >= 0)
    return { p, id }
  }
  /** 화살 하나를 방패 도적의 몸통(or 머리)에 맞춘다 */
  async function shoot(p: PirateRun, id: number, head: boolean): Promise<void> {
    const { spawnArrow } = await import('../src/sim/ballistics.ts')
    const a = spawnArrow(p.w, 0, 1)!
    const t = p.w.targets[id]!
    t.speed = 0
    // 목책 앞에서 맞는다 (목책을 넘으면 도적이 사라지므로) · 살이 나는 높이를 따라 머리(or 몸통) 줄에 세운다
    for (let i = 0; i < 40 && a.alive; i++) {
      t.x = Math.max(a.x + 0.6, P.pirate.palisadeX + 0.4)
      t.baseX = t.x
      t.y = head ? a.y - P.enemy.archerHeadUp * t.r : a.y
      t.baseY = t.y
      stepPirate(p, idle)
    }
  }
  it('방패 든 도적은 몸통 두 발을 튕기고, 방패가 깨진 뒤 몸통 한 발에 쓰러진다', async () => {
    const { p, id } = await shieldBed()
    assert.equal(P.pirate.shieldHits, 2)
    await shoot(p, id, false)
    assert.ok(p.w.targets[id]!.alive && p.w.targets[id]!.armored)
    await shoot(p, id, false)
    assert.ok(p.w.targets[id]!.alive)
    assert.equal(p.w.targets[id]!.armored, false)
    await shoot(p, id, false)
    assert.equal(p.w.targets[id]!.alive, false)
  })
  it('머리는 방패가 있어도 한 발', async () => {
    const { p, id } = await shieldBed()
    await shoot(p, id, true)
    assert.equal(p.w.targets[id]!.alive, false)
  })
  it('둘째 물결부터 방패 도적이 나온다', () => {
    const ws = bakeWaves(3, 2)
    const n = (k: number): number => ws[k]!.spawns.filter((s) => s.what === 'shield').length
    assert.equal(n(0), 0)
    assert.equal(n(1), P.pirate.shield2)
    assert.equal(n(2), P.pirate.shield3)
  })
  function toPick(seed: number): PirateRun {
    const p = createPirate({ seed, sev: 2, mu: 5, watch: 0 })
    let guard = 0
    while (p.phase !== 'pick' && guard++ < 60 * 100) {
      stepPirate(p, idle)
      for (let j = 0; j < p.w.targets.length; j++) {
        const r = p.role[j]
        if (r === 'sword' || r === 'shield' || r === 'captain' || r === 'archer') p.w.targets[j]!.alive = false
      }
    }
    return p
  }
  it('물결을 다 막으면 판이 멈추고 셋을 고른다 · 목책 고치기는 바탕 +1 까지', () => {
    const p = toPick(4)
    assert.equal(p.phase, 'pick')
    const tick = p.w.tick
    stepPirate(p, idle)
    assert.equal(p.w.tick, tick, '고르는 동안 판은 서 있다')
    assert.equal(p.lives, p.livesBase)
    pickBoon(p, 'repair')
    assert.equal(p.lives, p.livesBase + 1)
    assert.equal(p.livesMax, p.livesBase + 1)
    assert.deepEqual(p.picks, ['repair'])
    p.phase = 'pick'
    pickBoon(p, 'repair')
    assert.equal(p.lives, p.livesBase + 1)
  })
  it('안 고르면 시간이 다 되어 화전 한 물결로 간다', () => {
    const p = toPick(4)
    for (let i = 0; i < Math.ceil((P.pirate.pickSec + 0.1) / p.w.dt) && p.phase === 'pick'; i++) stepPirate(p, idle)
    assert.deepEqual(p.picks, ['fire'])
    for (let i = 0; i < Math.ceil((P.pirate.pause + P.pirate.specialSec + 1) / p.w.dt); i++) stepPirate(p, idle)
    assert.equal(p.w.arrowKind, 'burst')
  })
  it('산적 판: 궁수는 배 자리가 아니라 능선 위 땅에 선다', () => {
    const archers = bakeWaves(3, 2, 'bandit').flatMap((w) => w.spawns.filter((s) => s.what === 'archer'))
    assert.ok(archers.length > 0)
    for (const a of archers) assert.ok(a.x <= P.pirate.spawnX - P.pirate.ridgeX && a.x !== P.pirate.boatX)
    for (const a of bakeWaves(3, 2).flatMap((w) => w.spawns.filter((s) => s.what === 'archer'))) assert.ok(a.x >= P.pirate.boatX)
    const p = createPirate({ seed: 3, sev: 2, mu: 5, watch: 0, mode: 'bandit' })
    p.wave = 1
    p.phase = 'fight'
    p.waveT = 99
    p.next = 0
    stepPirate(p, idle)
    const i = p.role.indexOf('archer')
    assert.ok(i >= 0)
    assert.equal(p.w.targets[i]!.y, P.pirate.midY + P.pirate.archerUp)
    assert.ok(p.w.targets[i]!.x < P.pirate.boatX)
  })
  it('흠 없이 다 막으면 perfect', () => {
    const a = createPirate({ seed: 5, sev: 2, mu: 5, watch: 0 })
    let g = 0
    while (a.result === null && g++ < 60 * 400) {
      stepPirate(a, idle)
      if (a.phase === 'pick') pickBoon(a, 'draw')
      for (let j = 0; j < a.w.targets.length; j++) {
        const r = a.role[j]
        if (r === 'sword' || r === 'shield' || r === 'captain' || r === 'archer') a.w.targets[j]!.alive = false
      }
    }
    assert.equal(a.result?.won, true)
    assert.equal(a.perfect, true)
  })
})

describe('바다도적 막기 — 두목 보상', () => {
  it('흠 없이 막으면 쇠가 cardPiratePerfectMul 배수로 · 못 막았으면 소용없다', () => {
    const r = byeonhanMini(4)
    const n = Object.values(r.nodes).filter((x) => x.owner === r.player && x.kind !== 'sodo').sort((x, y) => (x.id < y.id ? -1 : 1))[0]!.id
    const c: Card = { kind: 'pirates', season: r.season, node: n }
    r.card = c
    const normal = cardPreview(r, c, 1, undefined, 3)!
    const grand = cardPreview(r, c, 1, undefined, 3, true)!
    const ratio = (grand.sure.iron ?? 0) / (normal.sure.iron ?? 1)
    assert.ok(Math.abs(ratio - P.realm.cardPiratePerfectMul / P.realm.cardPirateWinMul) < 0.1, `${ratio}`)
    assert.deepEqual(cardPreview(r, c, 1, undefined, 2, true)!.sure, cardPreview(r, c, 1, undefined, 2)!.sure)
    const out: ReportLine[] = []
    resolveCard(r, [{ kind: 'card', faction: r.player, pick: 1, held: 3, perfect: true }], out)
    const line = out.find((l): l is Extract<ReportLine, { kind: 'card' }> => l.kind === 'card')!
    assert.equal(line.perfect, true)
    assert.equal(line.iron, grand.sure.iron)
  })
})
