// 열전 기술 나무 갈래 셋 (11-17 밤 형: 「다 찍을 정도로 레벨 올리는 건 의미 없지 않아? 몰빵하거나 여러 개를 찍거나」 · RAID-LINK §2)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HAEBI_TREE as T, HAEBI_RUN as C } from '../src/tune/params.ts'
import { createHaebi, stepHaebi, choose, reroll, xpNeeded, spawnMob, kitPowers, kitCombos, branchNodes, branchPoints, nodeAt, nodeOpen, mainBranch, treeTotal, nodeText, POWERS, BRANCHES, KITS, isCombo, type HaebiRun, type Kit, type Power } from '../src/raid/haebi.ts'
import { replay, botInput, botChoice } from '../src/raid/haebi-replay.ts'

const KIT_LIST = Object.keys(KITS) as Kit[]
const idle = { x: 0, y: 0 }
const DT = 1 / 120
/** 적이 안 나오는 판 */
function quiet(kit: Kit, seed = 7) { const s = createHaebi(seed, 'stage', kit); s.spawn = 1e9; s.nextElite = s.nextBarrage = 1e9; return s }
/** 레벨업 하나를 연다 */
function levelUp(s: HaebiRun) { s.xp = xpNeeded(s); stepHaebi(s, idle, DT) }
/** 장수 둘레에 멈춰 선(어지럼) 단단한 적 — 가까운 고리와 먼 고리 */
function ring(s: HaebiRun) {
  for (const [n, r] of [[10, 95], [14, 230]] as const) for (let i = 0; i < n; i++) {
    spawnMob(s, 'club'); const a = i * Math.PI * 2 / n + r / 100
    Object.assign(s.enemies[s.enemies.length - 1]!, { x: s.x + Math.cos(a) * r, y: s.y + Math.sin(a) * r * .8, hp: 1e7, max: 1e7, daze: 1e9 })
  }
}
/** 같은 판을 갈래 끝 하나만 달리해 몇 초 돌린 피해 */
function damageWith(kit: Kit, set: Partial<Record<Power, number>>, sec = 6) {
  const s = quiet(kit); s.level = C.maxLevel
  Object.assign(s.ranks, { [KITS[kit].secondary]: 4 }, set)
  ring(s)
  for (let i = 0; i < sec / DT; i++) stepHaebi(s, idle, DT)
  return s.damage
}

test('같은 씨앗·같은 길이면 같은 판 (몰빵·고르게)', () => {
  for (const route of ['deepA', 'deepB', 'deepC', 'spread'] as const) {
    const a = replay(5, 150, route, undefined, 'spear'), b = replay(5, 150, route, undefined, 'spear')
    assert.deepEqual(a, b, route)
  }
})

test('갈래 셋 × 네 층 · 조합은 늘 두 갈래(주 무기 · 보조)를 잇는다', () => {
  for (const kit of KIT_LIST) {
    const tree = branchNodes(kit)
    for (const b of BRANCHES) assert.equal(tree[b].length, T.tiers.length, `${kit} ${b}`)
    assert.equal(new Set(kitPowers(kit)).size, kitPowers(kit).length, '칸은 한 번씩')
    for (const p of kitPowers(kit)) assert.ok(nodeText(kit, p).name && nodeText(kit, p).desc, `${kit} ${p} 이름·설명`)
    for (const c of kitCombos(kit)) {
      const branches = new Set(Object.keys(c.needs).map(p => nodeAt(kit, p as Power)!.branch))
      assert.equal(branches.size, 2, `${kit} ${c.id} 두 갈래`)
    }
  }
})

test('다 못 찍는다 — 레벨 고름과 실제 무료 상자 고름을 합쳐도 나무 전체는 못 채운다', () => {
  const run = C.maxLevel - 1 + 1   // 고름 43 + 처음 주 무기 1
  for (const kit of KIT_LIST) {
    const total = treeTotal(kit)
    assert.ok(total >= 2 * run, `${kit} ${total} >= ${2 * run}`)
    assert.ok(total <= 2.6 * run, `${kit} ${total} — 너무 넓지도 않게`)
  }
  const s = createHaebi(3, 'stage', 'sword'), initial = kitPowers('sword').reduce((n, p) => n + s.ranks[p], 0)
  let levelChoices = 0, chestChoices = 0
  while (s.state === 'playing') {
    if (s.offers.length) {
      const free = s.choiceOrigin === 'chest'
      assert.equal(choose(s, botChoice(s, 'spread')), true)
      if (free) chestChoices++; else levelChoices++
    } else stepHaebi(s, botInput(s), DT)
  }
  const spent = kitPowers('sword').reduce((n, p) => n + s.ranks[p], 0) + Object.values(s.comboRanks).reduce((n, r) => n + (r ?? 0), 0)
  assert.ok(s.level <= C.maxLevel)
  assert.equal(initial, 1); assert.equal(levelChoices, s.level - 1); assert.ok(chestChoices > 0)
  assert.equal(spent, initial + levelChoices + chestChoices, `기본${initial}+레벨${levelChoices}+상자${chestChoices}=${spent}`)
  assert.ok(spent <= initial + C.maxLevel - 1 + chestChoices, `${spent}점은 실제 고름 상한 이내`)
  assert.ok(spent < treeTotal('sword'), `${spent}/${treeTotal('sword')} 점으로 전체 미완성`)
})

test('52 부모 1단으로 열린다 — 잠긴 칸은 카드로 안 나오고 골라도 안 된다', () => {
  for (const kit of KIT_LIST) {
    const s = quiet(kit), k = KITS[kit]
    assert.equal(branchPoints(s, 'a'), 1, '주 무기 첫 단계 1점')
    assert.ok(!nodeOpen(s, 'capA') && !nodeOpen(s, 'ember') && !nodeOpen(s, 'thunder'))
    s.offers = ['capA']; s.xp = xpNeeded(s); assert.equal(choose(s, 'capA'), false, '잠긴 갈래 끝')
    s.offers = ['thunder']; assert.equal(choose(s, 'thunder'), false, '잠긴 2층')
    s.ranks[k.primary] = 3; assert.ok(nodeOpen(s, 'ember') && nodeOpen(s, 'reach') && !nodeOpen(s, 'hone') && !nodeOpen(s, 'echo'), kit)
    s.ranks[k.primary] = 10; s.ranks.ember = 2; assert.ok(!nodeOpen(s, 'capA'), '갈래 합계 12여도 부모가 없으면 잠김')
    s.ranks.reach = 1; assert.ok(nodeOpen(s, 'hone')); s.ranks.hone = 1; assert.ok(nodeOpen(s, 'capA'), `${kit} 벼리기 1단이면 갈래 끝`)
    assert.ok(!nodeOpen(s, 'capB') && !nodeOpen(s, 'capC'), '다른 갈래는 그대로 잠김')
  }
  // 아무렇게나 골라 끝까지: 카드는 늘 열린 칸·끝 단계 아닌 칸
  for (const kit of KIT_LIST) {
    const s = quiet(kit, 11)
    for (let i = 0; i < C.maxLevel - 1; i++) {
      levelUp(s); if (!s.offers.length) break
      for (const o of s.offers) if (!isCombo(o)) { assert.ok(nodeOpen(s, o), `${kit} ${o} 열림`); assert.ok(s.ranks[o] < POWERS[o].max) }
      assert.ok(choose(s, s.offers[i % s.offers.length]!))
    }
  }
})

test('레벨업 카드는 찍은 갈래로 끌리고, 하나는 늘 다른 갈래 · 첫 고름은 갈래마다 하나', () => {
  const first = quiet('axe'); levelUp(first)
  assert.deepEqual(first.offers.map(p => nodeAt('axe', p as Power)!.branch), ['b', 'a', 'c'])
  const s = quiet('bow'); s.level = 20; s.rerolls = 1e6
  Object.assign(s.ranks, { bow: 8, echo: 3, ember: 2 })   // 주 무기 갈래 13점 · 나머지 0
  assert.equal(mainBranch(s), 'a')
  const count = { a: 0, b: 0, c: 0 }
  levelUp(s)
  for (let i = 0; i < 400; i++) {
    const cards = s.offers.filter(p => !isCombo(p)) as Power[]
    assert.ok(cards.some(p => nodeAt('bow', p)!.branch !== 'a'), String(s.offers))
    for (const p of cards) count[nodeAt('bow', p)!.branch]++
    assert.ok(reroll(s))
  }
  const share = count.a / (count.a + count.b + count.c)
  assert.ok(share > .45, `주 갈래 몫 ${share.toFixed(2)} (무게 없으면 칸 수 몫 ~${(4 / 12).toFixed(2)})`)
  assert.ok(count.b > 0 && count.c > 0)
})

test('갈래 끝 (주 무기 a · 보조 b) — 묶음마다 다른 꼴이 실제 피해를 더한다', () => {
  for (const kit of KIT_LIST) {
    const base = damageWith(kit, {})
    for (const cap of ['capA', 'capB'] as const) {
      if (kit === 'sling' && cap === 'capA') continue   // 땅울림은 멈춤 (아래 따로)
      const more = damageWith(kit, { [cap]: 1 }), most = damageWith(kit, { [cap]: 3 })
      assert.ok(more > base * 1.04, `${kit} ${cap} ${Math.round(base)} → ${Math.round(more)}`)
      assert.ok(most > more, `${kit} ${cap} 3단계가 더 세다 ${Math.round(more)} → ${Math.round(most)}`)
    }
  }
})

test('땅울림 (돌팔매 갈래 끝 a): 돌이 떨어진 둘레의 적이 멈춘다 · 두목은 버틴다', () => {
  const s = quiet('sling'); s.ranks.capA = 1
  spawnMob(s, 'club'); Object.assign(s.enemies[0]!, { x: s.x + 150, y: s.y, hp: 1e6, max: 1e6 })
  for (let i = 0; i < 120 && !s.enemies[0]!.daze; i++) stepHaebi(s, idle, DT)
  assert.ok(s.enemies[0]!.daze > 0)
  const t = quiet('sling'); t.ranks.capA = 3
  spawnMob(t, 'boss'); Object.assign(t.enemies[0]!, { x: t.x + 150, y: t.y, hp: 1e7, max: 1e7, cd: 99 })
  for (let i = 0; i < 120; i++) stepHaebi(t, idle, DT)
  assert.equal(t.enemies[0]!.daze, 0)
})

test('버팀 갈래 — 철벽·불굴·신속·재생 · 되받아치기는 맞으면 비기가 작게 터진다', () => {
  const hitBy = (tough: number) => { const s = quiet('sword'); s.ranks.tough = tough; s.enemies = []; s.shots.push({ x: s.x, y: s.y, vx: 0, vy: 0, life: 1, kind: 'enemy', damage: 50, radius: 10, hit: [], angle: 0, tx: 0, ty: 0 }); stepHaebi(s, idle, DT); return s.maxHp - s.hp }
  assert.ok(hitBy(5) < hitBy(0) * (1 - 5 * T.tough) + 1)
  const s = quiet('axe'); s.level = 5; Object.assign(s.ranks, { tough: 3, tempo: 3, breath: 1 })
  s.offers = ['stout']; s.xp = xpNeeded(s); const hp = s.maxHp
  assert.ok(choose(s, 'stout')); assert.equal(s.maxHp, hp + T.stout)
  const d = quiet('axe'); d.ranks.nimble = 3; stepHaebi(d, { ...idle, dash: true }, DT)
  assert.ok(Math.abs(d.dashCd - C.dashCooldown * (1 - 3 * T.nimble)) < .02)
  // 되받아치기
  for (const kit of KIT_LIST) {
    const r = quiet(kit); r.ranks.capC = 1; ring(r)
    r.shots.push({ x: r.x, y: r.y, vx: 0, vy: 0, life: 1, kind: 'enemy', damage: 5, radius: 10, hit: [], angle: 0, tx: 0, ty: 0 })
    r.cool[KITS[kit].primary === 'bell' ? 'bell' : KITS[kit].primary as 'axe'] = 99
    stepHaebi(r, idle, DT)
    assert.ok(r.counterDue && r.cool.counter > 0, kit)
    const before = r.damage, cd = r.skillCd
    for (let i = 0; i < 90; i++) stepHaebi(r, idle, DT)
    assert.ok(r.damage > before, `${kit} 되받아치기 피해`)
    assert.equal(r.skillCd, cd, '비기 재사용은 그대로')
    assert.ok(r.fx.some(f => f.ult === kit) || r.damage > before)
  }
})

test('봇 빌드 넷이 끝까지 돈다 · 몰빵은 제 갈래 끝을 연다', () => {
  for (const route of ['deepA', 'deepB'] as const) {
    const s = replay(4, 600, route, undefined, 'sword')
    const b = route === 'deepA' ? 'a' : 'b'
    assert.ok(branchPoints(s, b) >= T.tiers[3]!, `${route} ${branchPoints(s, b)}점`)
    assert.ok(s.ranks[b === 'a' ? 'capA' : 'capB'] > 0, `${route} 갈래 끝`)
  }
})
