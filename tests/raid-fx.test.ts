// 열전 그리기의 말 (11-18 형 플립: 「적 공격 이펙트랑 내 공격 이펙트가 헷갈림 · 투지 오라랑 각성 오라도 필요」)
//   붉은 것 = 적이 나를 때릴 자리 · 금빛·하늘빛 = 내 것 · 오라는 낱낱 입자(시계와 번호로만 셈) · 폰을 느리게 하는 것은 쓰지 않는다
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HAEBI_RUN as C, HAEBI_MOBS as M, HAEBI_FX as K, FX_AURA as P, HAEBI_ULT as U, HAEBI_CHAMPION as CH } from '../src/tune/params.ts'
import { createHaebi, stepHaebi, spawnMob, gaugeNeed, type HaebiRun, type Kit, type Missile, type Mob } from '../src/raid/haebi.ts'
import { drawField, imagePaths } from '../src/raid/haebi-view.ts'
import { AURA_ART, auraCount, auraSparks, auraWisps, drawAura, drawAuraBurst, drawAuraGround, setAuraDensity, type AuraAt, type AuraKind, type Mote } from '../src/raid/fx-aura.ts'

const TAU = Math.PI * 2
/** 그림 대신 쓰는 것 — 길마다 다른 물건이라 무엇을 찍었는지 알 수 있다 */
const images = new Map(imagePaths.map(p => [p, { width: 5120, height: 256, path: p } as unknown as HTMLImageElement]))
const img = (p: string) => images.get(p)!
/** 가짜 붓 — 칠한 빛 · 찍은 그림(그때 짙기) · 그린 원을 적는다. save/restore 는 진짜처럼 되돌린다 */
function fakeCtx() {
  const log = { styles: new Set<string>(), banned: [] as string[], images: [] as { img: unknown; alpha: number }[], arcs: [] as { x: number; y: number; r: number; span: number }[] }
  const state: Record<string, unknown> = { globalAlpha: 1, globalCompositeOperation: 'source-over', imageSmoothingEnabled: true, fillStyle: '#000000', strokeStyle: '#000000', lineWidth: 1 }
  const stack: Record<string, unknown>[] = []
  const api: Record<string, unknown> = {
    canvas: { width: C.width, height: C.height },
    save() { stack.push({ ...state }) },
    restore() { const s = stack.pop(); if (s) Object.assign(state, s) },
    drawImage(image: unknown) { log.images.push({ img: image, alpha: state['globalAlpha'] as number }) },
    arc(x: number, y: number, r: number, a0: number, a1: number) { log.arcs.push({ x, y, r, span: a1 - a0 }) },
    createRadialGradient() { return { addColorStop() {} } },
  }
  const ctx = new Proxy(api, {
    get: (t, k) => k in t ? t[k as string] : k in state ? state[k as string] : () => {},
    set: (_t, k, v) => {
      if (k === 'filter' || k === 'shadowBlur') log.banned.push(String(k))
      if ((k === 'fillStyle' || k === 'strokeStyle') && typeof v === 'string') log.styles.add(v)
      state[k as string] = v; return true
    },
  }) as unknown as CanvasRenderingContext2D
  return { ctx, log, clear() { log.styles.clear(); log.images.length = 0; log.arcs.length = 0 } }
}
/** 붉은 빛인가 — 빛깔이 붉은 쪽(±14°)이고 짙고 밝다 (검붉은 받침 · 주황·금빛 · 옅은 살구빛은 아니다) */
function red(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  if (!d || max < .55 || d / max < .55 || max !== r) return false
  const hue = (60 * ((g - b) / d) + 360) % 360
  return hue <= 14 || hue >= 346
}
/** 적이 저절로 나오지 않는 판 */
function field(kit: Kit, opts: { awaken?: boolean } = {}) {
  const s = createHaebi(7, 'stage', kit, opts); s.spawn = 1e9; s.nextElite = 1e9; s.nextBarrage = 1e9; s.maxHp = s.hp = 1e6; s.messageTime = 0
  return s
}
function place(s: HaebiRun, kind: Mob['kind'], dx: number, dy: number, o: Partial<Mob> = {}) {
  spawnMob(s, kind === 'dog' ? 'club' : kind); const e = s.enemies[s.enemies.length - 1]!
  Object.assign(e, { kind, x: s.x + dx, y: s.y + dy, hp: 1e6, max: 1e6, cd: 99, ...o })
  return e
}
const shot = (kind: Missile['kind'], x: number, y: number, life: number, o: Partial<Missile> = {}): Missile => ({ x, y, vx: 0, vy: 0, life, kind, damage: 1, radius: 12, hit: [], angle: 0, tx: x, ty: y, ...o })
const at = (o: Partial<AuraAt> = {}): AuraAt => ({ x: 500, y: 400, t: 3.21, height: 94, ...o })
const motes = (kind: AuraKind, a: AuraAt, what: 'back' | 'front' | 'sparks') => {
  const out: Mote[] = []
  if (what === 'sparks') auraSparks(kind, a, m => out.push({ ...m })); else auraWisps(kind, a, what === 'front', m => out.push({ ...m }))
  return out
}

test('오라 입자: 시계와 번호로만 셈한다 (같은 시각 = 같은 그림 · Math.random 없음) · 수는 FX_AURA 가 상한', () => {
  const real = Math.random
  Math.random = () => { throw new Error('오라가 Math.random 을 불렀다') }
  try {
    for (const kind of ['grit', 'awake'] as const) {
      const p = P[kind]
      for (const what of ['back', 'front', 'sparks'] as const) {
        const a = motes(kind, at(), what), b = motes(kind, at(), what)
        assert.deepEqual(a, b, `${kind} ${what} 같은 시각`)
        assert.equal(a.length, what === 'sparks' ? p.sparks : p[what], `${kind} ${what} 수`)
        assert.notDeepEqual(a, motes(kind, at({ t: 3.4 }), what), `${kind} ${what} 시간이 가면 움직인다`)
        for (const m of a) {
          for (const v of [m.x, m.y, m.w, m.h, m.a]) assert.ok(Number.isFinite(v), `${kind} ${what} 값`)
          assert.ok(m.a <= 1 && m.w > 0 && m.h > 0, `${kind} ${what} 짙기·크기`)
          assert.ok(m.y <= 400 + 1e-9, `${kind} ${what} 발밑 아래로는 안 내려간다`)
        }
      }
    }
  } finally { Math.random = real }
})

test('각성 오라는 투지보다 한눈에 크다 (가닥이 더 많고 · 더 굵고 · 더 높이 솟는다) · 각성에만 무기 묶음 빛이 섞인다', () => {
  assert.ok(P.awake.back + P.awake.front > P.grit.back + P.grit.front)
  assert.ok(P.awake.w > P.grit.w && P.awake.h > P.grit.h && P.awake.rise > P.grit.rise && P.awake.sparks > P.grit.sparks)
  // 여러 시각에 걸쳐 가장 높이 오른 가닥
  const top = (kind: AuraKind) => { let y = 400; for (let i = 0; i < 40; i++) for (const m of motes(kind, at({ t: i * .13 }), 'back')) y = Math.min(y, m.y - m.h); return 400 - y }
  assert.ok(top('awake') > top('grit') * 1.3, `각성 ${top('awake').toFixed(0)} · 투지 ${top('grit').toFixed(0)}`)
  assert.ok(top('awake') > 94 * 1.4, '각성 가닥은 머리 위로 솟는다')
  const tints = ['#123456', '#654321'], mixed = motes('awake', at({ tints }), 'back').filter(m => m.c >= 3)
  assert.ok(mixed.length >= 2 && mixed.length <= P.awake.back / 2, '무기 묶음 빛은 살짝만')
  assert.equal(motes('grit', at({ tints }), 'back').filter(m => m.c >= 3).length, 0)
  assert.equal(motes('awake', at(), 'back').filter(m => m.c >= 3).length, 0, '섞을 빛이 없으면 오라 빛만')
})

test('오라 입자 수를 줄이는 손잡이: 장면 몫 · 전체 손잡이 · 줄여도 조금은 남는다', () => {
  assert.equal(auraCount(14), 14)
  assert.equal(auraCount(14, .5), 7)
  assert.equal(auraCount(14, .01), P.minCount)
  assert.equal(auraCount(14, 0), 0)
  assert.equal(auraCount(0, 1), 0)
  assert.equal(motes('awake', at({ density: .5 }), 'back').length, Math.round(P.awake.back * .5))
  setAuraDensity(.5)
  try { assert.equal(motes('awake', at(), 'sparks').length, Math.round(P.awake.sparks * .5)) } finally { setAuraDensity(1) }
  assert.equal(motes('awake', at(), 'sparks').length, P.awake.sparks)
})

test('오라 그리기: 가닥·불티를 낱낱이 찍는다 · 판 밖이면 건너뛴다 · 붓 상태를 돌려놓는다 · filter·shadowBlur 없음', () => {
  const art = { flame: img(AURA_ART.flame), ember: img(AURA_ART.ember), ring: img(AURA_ART.ring) }
  for (const kind of ['grit', 'awake'] as const) {
    const p = P[kind], { ctx, log } = fakeCtx(), a = at({ art })
    ctx.globalAlpha = .5; ctx.globalCompositeOperation = 'source-over'
    drawAuraGround(ctx, kind, a); drawAura(ctx, kind, false, a); drawAura(ctx, kind, true, a)
    const count = (im: unknown) => log.images.filter(d => d.img === im).length
    assert.equal(count(art.flame), p.back + p.front, `${kind} 불꽃 가닥은 하나씩`)
    assert.ok(count(art.ember) > 0 && count(art.ember) <= p.sparks, `${kind} 불티는 하나씩 (꺼진 것은 안 그린다)`)
    assert.equal(count(art.ring), 2, `${kind} 발밑 고리 둘 (늘 있는 것 · 맥박)`)
    assert.equal(ctx.globalAlpha, .5); assert.equal(ctx.globalCompositeOperation, 'source-over')
    assert.ok(log.images.every(d => d.alpha >= 0 && d.alpha <= .5 + 1e-9), '그리는 쪽 짙기를 넘지 않는다')
    // 켜진 순간 한 번: 고리 · 불티 · (각성) 솟구치는 가닥 — 끝나면 아무것도 안 그린다
    log.images.length = 0; drawAuraBurst(ctx, kind, a, p.burst.life * .3)
    assert.equal(count(art.ring), p.burst.rings); assert.equal(count(art.ember), p.burst.sparks); assert.equal(count(art.flame), p.burst.pillars)
    log.images.length = 0; drawAuraBurst(ctx, kind, a, p.burst.life + .01); drawAuraBurst(ctx, kind, a, -.1)
    assert.equal(log.images.length, 0)
    // 판 밖
    const far = at({ art, x: -900, view: { w: C.width, h: C.height } })
    drawAuraGround(ctx, kind, far); drawAura(ctx, kind, false, far); drawAura(ctx, kind, true, far); drawAuraBurst(ctx, kind, far, .1)
    assert.equal(log.images.length, 0, `${kind} 판 밖은 안 그린다`)
    assert.deepEqual(log.banned, [])
  }
  // 그림이 없어도 깨지지 않는다 (선·점으로 대신)
  const { ctx } = fakeCtx()
  for (const kind of ['grit', 'awake'] as const) { drawAuraGround(ctx, kind, at()); drawAura(ctx, kind, false, at()); drawAura(ctx, kind, true, at()); drawAuraBurst(ctx, kind, at(), .1) }
})

test('적이 나를 때릴 자리: 돌·불 던지기 · 일제 사격 · 내려찍기가 모두 같은 붉은 테 · 맞는 범위 그대로의 원 · 고리는 가운데로 줄어든다', () => {
  const s = field('axe'), { ctx, log, clear } = fakeCtx()
  const boss = place(s, 'elite', -260, -40, { wind: CH.slamWind * .5, aimX: s.x - 220, aimY: s.y + 30 })
  boss.champion!.mode = 'tell'; boss.pattern = 'slam'
  s.shots.push(shot('stone', s.x + 150, s.y, M.lobDelay * .5, { radius: M.lobRadius }))
  s.shots.push(shot('stone', s.x + 150, s.y + 200, M.lobDelay * .5, { radius: M.lobRadius, gen: 1 }))
  s.shots.push(shot('barrage', s.x - 100, s.y - 220, C.barrageDelay * .5))
  drawField(ctx, images, s, null)
  assert.ok(log.styles.has(K.foe.rim) && red(K.foe.rim) && red(K.foe.fill), '붉은 테 · 붉은 바닥')
  const spots = [[boss.aimX, boss.aimY, CH.slamRadius], [s.x + 150, s.y, M.lobRadius], [s.x + 150, s.y + 200, M.lobRadius], [s.x - 100, s.y - 220, C.barrageRadius]] as const
  const slam = log.images.filter(d => d.img === img('raid/ui/mark-slam.png'))
  assert.equal(slam.length, spots.length, '자리마다 같은 용암 테 그림 하나')
  for (const [x, y, r] of spots) {
    const rings = log.arcs.filter(a => a.x === x && a.y === y)
    assert.ok(rings.some(a => a.r === r && Math.abs(a.span - TAU) < 1e-9), `맞는 범위 그대로의 원 (${r})`)
    assert.ok(rings.some(a => Math.abs(a.r - r * .5) < 1e-6), '남은 시간만큼 줄어든 고리 (반쯤 남았으면 반지름의 반)')
  }
  // 시간이 가면 고리가 가운데로 줄어든다
  const inner = () => Math.min(...log.arcs.filter(a => a.x === s.x + 150 && a.y === s.y).map(a => a.r))
  const before = inner()
  clear(); s.shots[0]!.life = M.lobDelay * .2; drawField(ctx, images, s, null)
  assert.ok(inner() < before)
  assert.deepEqual(log.banned, [])
})

test('내 발밑 표식은 적의 표식 아래 · 맞을 자리 안에 서면 옅게 물러난다 (예전엔 금빛 표식이 돌 떨어질 자리를 덮었다)', () => {
  const s = field('axe'), { ctx, log, clear } = fakeCtx()
  const mine = () => log.images.findIndex(d => d.img === img('raid/ui/mark-hero.png')), foe = () => log.images.findIndex(d => d.img === img('raid/ui/mark-slam.png'))
  drawField(ctx, images, s, null)
  assert.equal(log.images[mine()]!.alpha, K.own.heroMark); assert.equal(foe(), -1)
  for (const danger of [shot('stone', s.x, s.y, M.lobDelay * .6, { radius: M.lobRadius }), shot('barrage', s.x + 10, s.y, 1), shot('flame', s.x, s.y + 20, 2, { radius: M.flameRadius })]) {
    clear(); s.shots = [danger]; drawField(ctx, images, s, null)
    assert.equal(log.images[mine()]!.alpha, K.own.heroMarkDim, danger.kind)
    if (danger.kind !== 'flame') assert.ok(mine() < foe(), `${danger.kind}: 내 표식 먼저(아래) → 적의 표식`)
  }
  // 옆에 떨어지는 것은 내 표식을 건드리지 않는다
  clear(); s.shots = [shot('stone', s.x + 200, s.y, 1, { radius: M.lobRadius })]; drawField(ctx, images, s, null)
  assert.equal(log.images[mine()]!.alpha, K.own.heroMark)
  assert.ok(K.own.heroMarkDim < K.own.heroMark)
})

test('타는 불바닥: 불 둘레에 붉은 테 · 줄지어 겹치면 한 덩이의 겉 테만 긋는다', () => {
  const s = field('axe'), { ctx, log, clear } = fakeCtx(), r = M.flameRadius
  const rims = () => log.arcs.filter(a => a.r === r && Math.abs(a.span - TAU) > 1e-6)
  s.shots = [shot('flame', 200, 200, 2, { radius: r }), shot('flame', 600, 200, 2, { radius: r })]
  drawField(ctx, images, s, null)
  assert.ok(log.styles.has(K.foe.rim)); assert.equal(rims().length, 0, '떨어져 있으면 원 그대로')
  assert.equal(log.images.filter(d => d.img === img('raid/fire-strip.png')).length, 2)
  clear(); s.shots = [shot('flame', 200, 200, 2, { radius: r }), shot('flame', 200 + r, 200, 2, { radius: r }), shot('flame', 200 + r * 2, 200, 2, { radius: r })]
  drawField(ctx, images, s, null)
  const cut = rims()
  assert.ok(cut.length >= 3, '겹친 원은 덮인 호를 뺀다')
  // 겉 테의 호를 다 더하면 원 셋의 둘레보다 짧다 (가운데 원은 양쪽이 덮인다)
  const sum = (x: number) => cut.filter(a => a.x === x).reduce((n, a) => n + a.span, 0)
  assert.ok(sum(200 + r) < sum(200) && sum(200) < TAU && sum(200) > Math.PI)
  // 꼭 같은 자리의 불 둘은 테 하나
  clear(); s.shots = [shot('flame', 300, 300, 2, { radius: r }), shot('flame', 300, 300, 2, { radius: r })]
  drawField(ctx, images, s, null)
  assert.equal(log.arcs.filter(a => a.x === 300 && a.y === 300 && a.r === r).length, 2 + 1, '바닥 칠하기 둘 + 테 하나')
})

/** 내 것만 있는 판을 걸어가며 그린다 — 칠한 빛을 모두 모은다 */
function ownColors(kit: Kit, awaken: boolean) {
  const s = field(kit, { awaken }), { ctx, log } = fakeCtx()
  s.level = U.unlockLevel   // 비기(i === 300)도 그려 보게 · 비기는 첫 레벨업에서 열린다 (11-19)
  Object.assign(s.ranks, { ember: 3, thunder: 2, echo: 2, reach: 1 }); s.ranks[kit === 'bow' ? 'rain' : kit === 'magic' ? 'soul' : 'gale'] = 4
  for (let i = 0; i < 8; i++) place(s, 'iron', Math.cos(i) * (90 + i * 22), Math.sin(i * 1.7) * (70 + i * 14))
  s.gauge = gaugeNeed(s)
  const forms = new Set<string>()
  let rains = 0, blasts = 0
  for (let i = 0; i < 120 * 4; i++) {
    stepHaebi(s, { x: 0, y: 0, wake: i === 60, skill: i === 300 }, 1 / 120)
    for (const e of s.enemies) e.cd = 99
    forms.add(s.form); rains += s.shots.filter(b => b.kind === 'rain').length; blasts += s.fx.filter(f => f.kind === 'blast').length
    if (i % 2) drawField(ctx, images, s, null)
  }
  assert.equal(s.hurt, 0); assert.ok(blasts > 0, `${kit} 내 터짐이 있었다`)
  return { log, forms, rains }
}
test('내 것에는 붉은빛이 없다: 화살비 자리 · 내 투사체 꼬리 · 내 터짐 · 영웅의 투지 · 각성 오라 · 비기', () => {
  for (const [kit, awaken] of [['bow', false], ['bow', true], ['magic', false], ['axe', true]] as const) {
    const { log, forms, rains } = ownColors(kit, awaken)
    assert.ok(forms.has(awaken ? 'awake' : 'grit'), `${kit} ${awaken ? '각성' : '투지'}을 켰다`)
    if (kit === 'bow') { assert.ok(rains > 0, '화살비가 떴다'); assert.ok(log.styles.has(K.own.rim), '화살비 자리는 금빛 테') }
    if (!awaken) assert.ok(log.styles.has(K.own.grit), '투지를 켠 순간의 고리는 하늘빛')
    const reds = [...log.styles].filter(red)
    assert.deepEqual(reds, [], `${kit} ${awaken ? '각성' : '투지'}`)
    assert.ok(!log.images.some(d => d.img === img('raid/ui/mark-slam.png')), '적의 표식 그림은 안 쓴다')
    assert.deepEqual(log.banned, [])
  }
  for (const c of [K.own.rim, K.own.mote, K.own.grit, ...P.grit.colors, ...P.awake.colors]) assert.ok(!red(c), c)
})

test('터짐은 누구 것인지 갈린다: 적의 돌·불이 떨어진 자리에는 붉은 테가 번지고 · 불 단지만 불바닥을 남긴다', () => {
  const s = field('axe'), { ctx, log, clear } = fakeCtx()
  for (const k of Object.keys(s.cool) as (keyof HaebiRun['cool'])[]) s.cool[k] = 99
  s.shots.push(shot('stone', s.x + 300, s.y, .1, { radius: M.lobRadius }), shot('stone', s.x - 300, s.y, .1, { radius: M.lobRadius, gen: 1 }))
  drawField(ctx, images, s, null)
  for (let i = 0; i < 20; i++) { stepHaebi(s, { x: 0, y: 0 }, 1 / 120); for (const k of Object.keys(s.cool) as (keyof HaebiRun['cool'])[]) s.cool[k] = 99; drawField(ctx, images, s, null) }
  assert.equal(s.fx.filter(f => f.kind === 'blast').length, 2); assert.equal(s.shots.filter(b => b.kind === 'flame').length, 1)
  clear(); drawField(ctx, images, s, null)
  const shock = (x: number) => log.arcs.some(a => a.x === x && a.y === s.y && a.r !== M.flameRadius && a.r > M.lobRadius && a.r <= M.lobRadius * (1 + K.foe.shock))
  assert.ok(shock(s.x + 300) && shock(s.x - 300), '떨어진 자리마다 붉은 테가 번진다')
  assert.ok(log.styles.has(K.foe.rim))
  assert.ok(log.images.some(d => d.img === img('raid/impact-strip.png')), '돌은 흙먼지')
  assert.ok(log.images.some(d => d.img === img('raid/fire-strip.png')), '불 단지는 불')
})
