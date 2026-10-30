/**
 * 나라마다 고유한 것 — 결 풍습 · 나라 고리 · 땅 한 수 (docs/realm/CUSTOMS.md §8 · data/customs.ts · hooks.ts)
 *
 *  - 진한 결의 「여섯 마을의 뜻 · 잇금」은 사로 전용이다 (§8-0 지뢰) · 영남 스물한 나라는 모두 고리나 땅 한 수가 있다
 *  - 땅 한 수는 지어내지 않는다 — 그 나라 땅에 정말 그 꼬리표가 있다
 *  - 규칙마다 동사 한 문장 · 무엇이 되나 · 무엇을 내주나 · 확신 표기
 *  - 규칙마다 판에서 정말 걸린다 (득과 값 둘 다) — 처음 걸리면 first
 *  - 나라 고르기 · 서막 둘째 장의 카드에 고리와 군대의 결이 보인다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { CUSTOMS, LAND_OF, customDef, customsOf, hasCustom, kyeolOf, nativeCustoms, type CustomId } from '../../src/realm/data/customs.ts'
import { mixOf } from '../../src/realm/data/armymix.ts'
import { YEONGNAM_NATIONS } from '../../src/realm/data/nations-yeongnam.ts'
import { startRegion } from '../../src/realm/data/regions/index.ts'
import { YEONGNAM_NATION_IDS, startYeongnam } from '../../src/realm/data/regions/yeongnam.ts'
import { startSouth } from '../../src/realm/data/regions/south.ts'
import { startCustoms } from '../../src/realm/hooks.ts'

/** 나라가 다 있는 판 — 자유판은 타국을 몇만 남기지만 (regions/rivals.ts), 풍습은 그 나라가 있어야 본다 */
const full = (r: Realm): Realm => { startCustoms(r); return r }
import { bigTwo, envoyTrueChance, favorOf, judgeOf, pairKey, relationOf } from '../../src/realm/diplomacy.ts'
import { armCost, canBuild, draftLimit, draftNeeds, draftPay, militiaMen, nextBuild, nodeYield, riteCost, sonoeRoom, stockOf, upkeepOf } from '../../src/realm/economy.ts'
import { concealBonus, customMarks, passExtra, riseState, siegeFort } from '../../src/realm/hooks.ts'
import { advance, checkOutcome, draftable, fortMul } from '../../src/realm/season.ts'
import { reportText } from '../../src/realm/data/prose.ts'
import { customsHtml } from '../../src/ui/realm/front.ts'
import { P } from '../../src/tune/params.ts'
import type { Order, Realm, ReportLine } from '../../src/realm/types.ts'

const NONE = { grain: 0, iron: 0 }
const customLines = (lines: readonly ReportLine[], id: CustomId) => lines.filter((l): l is Extract<ReportLine, { kind: 'custom' }> => l.kind === 'custom' && l.id === id)
/** 그 나라의 풍습을 바꾼 판 (짝 씨앗 도구와 같은 길) */
const without = (r: Realm, f: string, id: CustomId): Realm => {
  const q = structuredClone(r)
  q.factions[f]!.customs = customsOf(q, f).filter((c) => c !== id)
  return q
}

describe('풍습의 층 셋 — 데이터', () => {
  it('진한 결의 여섯 마을 · 잇금은 사로 전용 — 다벌·압독엔 없다', () => {
    assert.ok(nativeCustoms('saro').includes('yeoseotmaeul'))
    for (const f of ['dabeol', 'apdok', 'golbeol', 'iseo', 'usisan', 'eumjeup', 'bihwa', 'gammun', 'jomun', 'sabeol']) {
      assert.equal(kyeolOf(f), 'jinhan')
      assert.ok(!nativeCustoms(f).includes('yeoseotmaeul') && !nativeCustoms(f).includes('itgeum'), f)
    }
  })

  it('영남 스물한 나라는 모두 나라 고리나 땅 한 수가 하나 있다 · 고리가 있으면 땅은 없다', () => {
    for (const f of YEONGNAM_NATION_IDS) {
      const tiers = nativeCustoms(f).map((id) => customDef(id).tier)
      const hooks = tiers.filter((t) => t === 'nation' || t === 'land').length
      assert.equal(hooks, 1, `${f}: ${nativeCustoms(f).join(',')}`)
    }
  })

  it('규칙이 걸린 풍습은 동사 한 문장 · 득 · 값 · 사서 · 확신 표기가 다 있다 · 해명 문구가 없다', () => {
    for (const c of CUSTOMS.filter((x) => x.live)) {
      // 화면에 뜨는 두 문장 — 못 하는 것 · 대신(그래서) 이렇게 싸운다 · 설계 틀(「○○로 하면 … 못 해서」)이 화면에 새지 않는다 (형 10-29)
      assert.ok(/(대신|그래서|다만)/.test(c.verb) && !/로 하면/.test(c.verb), `${c.id} 두 문장: ${c.verb}`)
      assert.ok(c.does !== '' && c.cost !== '' && c.source !== '', c.id)
      assert.ok(['문헌', '고고학', '전승', '땅'].includes(c.sure), c.id)
      for (const s of [c.does, c.cost, c.verb, c.name]) assert.ok(!/이지 .*(이|가) 아니다/.test(s), `${c.id} 해명 문구: ${s}`)
      // 늦은 시대 이름은 본편에 쓰지 않는다 (§8-1 지킬 것 6)
      for (const late of ['골품', '화백', '판갑', '가야금', '개마', '임나', '기자']) assert.ok(!`${c.name}${c.does}${c.cost}${c.source}`.includes(late), `${c.id}: ${late}`)
    }
  })

  it('땅 한 수는 지어내지 않는다 — 영남 판에서 그 나라 땅에 정말 그 꼬리표가 있다', () => {
    const r = startYeongnam(1, 'saro')
    const mine = (f: string) => Object.values(r.nodes).filter((n) => n.owner === f)
    const edgesOf = (id: string) => Object.values(r.edges).filter((e) => e.a === id || e.b === id)
    const nextTo = (id: string) => edgesOf(id).map((e) => (e.a === id ? e.b : e.a))
    for (const [f, land] of Object.entries(LAND_OF)) {
      if (r.factions[f] === undefined) continue
      const ns = mine(f)
      const ok = land === 'landIron' ? ns.some((n) => n.kind === 'ironMine')
        : land === 'landPort' ? ns.some((n) => n.kind === 'port')
          : land === 'landReeds' ? ns.some((n) => n.tags.includes('reeds') || n.tags.includes('shallows') || edgesOf(n.id).some((e) => e.kind === 'reeds' || e.kind === 'ford'))
            : land === 'landHigh' ? ns.some((n) => n.tags.includes('high') || n.kind === 'fort' || edgesOf(n.id).some((e) => e.kind === 'pass'))
              : land === 'landPasture' ? ns.some((n) => n.tags.includes('pasture') || nextTo(n.id).some((x) => r.nodes[x]?.tags.includes('pasture')))
                : ns.some((n) => nextTo(n.id).some((x) => r.nodes[x]?.kind === 'sodo'))
      assert.ok(ok, `${f} 의 ${land}`)
    }
  })
})

describe('나라 고리 — 판에서 걸린다', () => {
  it('여섯 마을의 뜻(사로) — 중립 나라로는 이번 계절 묻기만 하고, 다음 계절에 떠난다 · 치는 사기 덤', () => {
    const r = startYeongnam(3, 'saro')
    const go: Order = { kind: 'march', army: 'a-saro-1', edge: 'y60', ambush: false } // 사로 도읍 → 골벌 도읍 (고갯길)
    const a = advance(r, [go])
    assert.equal(a.next.armies['a-saro-1']!.march, null, '이번 계절엔 떠나지 않는다')
    assert.equal(relationOf(a.next, 'saro', 'golbeol').state, 'war')
    const l = customLines(a.report.lines, 'yeoseotmaeul')
    assert.equal(l.length, 1)
    assert.equal(l[0]!.first, true)
    assert.ok(reportText(r, a.next, l[0]!, 'saro')!.includes('여섯 마을에 물었다'))
    const b = advance(a.next, [{ ...go }])
    assert.notEqual(b.next.armies['a-saro-1']?.march ?? null, null, '물은 다음 계절엔 떠난다')
    // 풍습이 없으면 바로 떠난다
    const c = advance(without(r, 'saro', 'yeoseotmaeul'), [go])
    assert.notEqual(c.next.armies['a-saro-1']!.march, null)
  })

  it('수로왕의 판결(음즙벌) — 싸우는 나라에 화친 청이 더 먹히고, 받아들여지면 판결해 준 가락에 곡식을 바친다', () => {
    const r = startYeongnam(1, 'saro')
    r.relations[pairKey('eumjeup', 'saro')] = { state: 'war', until: null }
    const p1 = envoyTrueChance(r, 'eumjeup', 'saro', 'truce', NONE, NONE)
    const p0 = envoyTrueChance(without(r, 'eumjeup', 'judge'), 'eumjeup', 'saro', 'truce', NONE, NONE)
    assert.ok(p1 > p0)
    assert.equal(judgeOf(r, 'eumjeup', 'saro'), 'guya')
    for (let seed = 1; seed < 300; seed++) {
      const q = startYeongnam(seed, 'us') // 받는 쪽이 플레이어면 사신이 청으로 바뀐다 — 둘 다 남의 나라로
      q.relations[pairKey('eumjeup', 'saro')] = { state: 'war', until: null }
      const before = stockOf(q, 'guya').grain
      const { next, report } = advance(q, [{ kind: 'envoy', from: 'eumjeup', to: 'saro', ask: 'truce', give: NONE, take: NONE }])
      const l = customLines(report.lines, 'judge')[0]
      if (l === undefined) continue
      assert.equal(l.other, 'guya')
      assert.ok(l.n! > 0)
      assert.equal(relationOf(next, 'eumjeup', 'saro').state, 'truce')
      assert.ok(next.stock['guya']!.grain >= before + l.n! - 1 - 50, '가락이 판결 값을 받았다')
      return
    }
    assert.fail('300 시드 안에 판결이 한 번도 안 붙었다')
  })

  it('달천 철광(우시산) — 쇠가 곱으로 나고, 철광 고을에서는 못 뽑고, 나라 상한이 준다', () => {
    const r = startYeongnam(1, 'saro')
    const q = without(r, 'usisan', 'dalcheon')
    assert.ok(nodeYield(r, 'y-usisan-iron').iron! >= 2 * nodeYield(q, 'y-usisan-iron').iron! - 1)
    assert.equal(draftLimit(r, 'usisan', 'y-usisan-iron'), 0)
    assert.ok(draftLimit(q, 'usisan', 'y-usisan-iron') > 0)
    assert.ok(draftLimit(r, 'usisan', 'y-usisan-cap') <= draftLimit(q, 'usisan', 'y-usisan-cap'))
    assert.deepEqual(customMarks(r, 'y-usisan-iron', 'usisan').map((m) => m.id), ['dalcheon'])
  })

  it('쇠뇌(골벌) — 쇠뇌병을 뽑는다 · 틀만큼만 · 한 명마다 쇠가 든다', () => {
    const r = startYeongnam(1, 'golbeol')
    const cap = r.nodes['y-golbeol-cap']!
    assert.ok(draftable(cap, r, 'golbeol').includes('crossbow'))
    assert.ok(!draftable(cap, r, 'dabeol').includes('crossbow'))
    assert.equal(sonoeRoom(r, 'golbeol'), P.realm.sonoeFrames * P.realm.sonoePerFrame)
    stockOf(r, 'golbeol').iron = 100
    stockOf(r, 'golbeol').grain = 2000
    const lim = draftLimit(r, 'golbeol', 'y-golbeol-cap', 'crossbow')
    assert.ok(lim > 0 && lim <= sonoeRoom(r, 'golbeol'))
    const n = Math.min(lim, 20)
    const { next, report } = advance(r, [{ kind: 'draft', faction: 'golbeol', node: 'y-golbeol-cap', unit: 'crossbow', n }])
    assert.ok(Object.values(next.armies).some((a) => a.faction === 'golbeol' && (a.mix.crossbow ?? 0) > 0))
    assert.equal(customLines(report.lines, 'sonoe').length, 1)
    assert.equal(draftNeeds('crossbow', n, r, 'golbeol').iron, Math.ceil(n * P.realm.sonoeIron))
    assert.equal(sonoeRoom(next, 'golbeol'), P.realm.sonoeFrames * P.realm.sonoePerFrame - n)
  })

  it('다시 일어남(압독) — 빼앗긴 도읍을 비워 두면 들고일어나 되찾는다 · 그동안 지지 않는다 · 판에 한 번', () => {
    let r = startYeongnam(2, 'apdok')
    // 다벌이 압독 도읍을 앗았다 — 지킴이는 두지 않았다
    for (const a of Object.values(r.armies)) if (a.faction === 'apdok') delete r.armies[a.id]
    r.nodes['y-apdok-cap']!.owner = 'dabeol'
    r.relations[pairKey('apdok', 'dabeol')] = { state: 'war', until: null }
    const hh0 = r.nodes['y-apdok-cap']!.hh
    let rose: Extract<ReportLine, { kind: 'custom' }> | undefined
    for (let i = 0; i < P.realm.riseWait + 2 && rose === undefined; i++) {
      const s = advance(r, [])
      r = s.next
      if (rose === undefined && r.nodes['y-apdok-cap']!.owner !== 'apdok') assert.equal(checkOutcome(r), null, '불씨가 살아 있으면 지지 않는다')
      rose = customLines(s.report.lines, 'ireoseom')[0]
    }
    assert.ok(rose !== undefined, '들고일어났다')
    assert.equal(r.nodes['y-apdok-cap']!.owner, 'apdok')
    assert.ok(r.nodes['y-apdok-cap']!.hh < hh0, '집이 준다')
    assert.equal(r.rise?.['apdok'], 'done')
    assert.equal(riseState(r, 'apdok'), null)
  })

  it('다시 일어남 — 빼앗은 나라가 넉넉히 지키면 들고일어나지 못하고, 기한이 지나면 진다', () => {
    let r = startYeongnam(2, 'apdok')
    for (const a of Object.values(r.armies)) if (a.faction === 'apdok') delete r.armies[a.id]
    r.nodes['y-apdok-cap']!.owner = 'dabeol'
    r.armies['a-dabeol']!.at = 'y-apdok-cap'
    r.armies['a-dabeol']!.mix = { spear: 4000 }
    let lost = false
    for (let i = 0; i < P.realm.riseWindow + 3 && !lost; i++) {
      r = advance(r, []).next
      lost = r.outcome?.kind === 'lose'
    }
    assert.equal(r.nodes['y-apdok-cap']!.owner, 'dabeol')
    assert.ok(lost, '불씨가 꺼지면 진다')
  })

  it('달벌 흙성(다벌) — 도읍에 흙성을 쌓는다 · 쌓는 계절엔 못 뽑는다 · 서면 굳다', () => {
    const r = startYeongnam(1, 'dabeol')
    assert.equal(nextBuild(r, 'y-dabeol-cap'), 'earthwall')
    assert.notEqual(nextBuild(r, 'y-saro-cap'), 'earthwall')
    stockOf(r, 'dabeol').grain = 2000
    stockOf(r, 'dabeol').wood = 500
    assert.ok(canBuild(r, 'dabeol', 'y-dabeol-cap', 'earthwall'))
    assert.ok(!canBuild(r, 'saro', 'y-saro-cap', 'earthwall'))
    const before = fortMul(r.nodes['y-dabeol-cap']!, 'spring')
    const { next, report } = advance(r, [{ kind: 'build', faction: 'dabeol', node: 'y-dabeol-cap', what: 'earthwall' }])
    assert.ok(next.nodes['y-dabeol-cap']!.tags.includes('earthwall'))
    assert.ok(Math.abs(fortMul(next.nodes['y-dabeol-cap']!, 'spring') - before * P.realm.fortEarth) < 1e-9)
    assert.equal(customLines(report.lines, 'dalbeol').length, 1)
    // 쌓는 동안(계획판) — 그 도읍에서 못 뽑는다
    const q = structuredClone(r)
    q.builds = [{ faction: 'dabeol', node: 'y-dabeol-cap', what: 'earthwall', done: q.season }]
    assert.equal(draftLimit(q, 'dabeol', 'y-dabeol-cap'), 0)
  })

  it('도읍 에우기(이서) — 남의 도읍은 성의 덤을 덜 받고, 그 나라의 동맹이 구하러 온다', () => {
    const r = startYeongnam(1, 'iseo')
    const cap = r.nodes['y-miri-cap']!
    const t = fortMul(cap, 'spring')
    assert.ok(siegeFort(r, 'iseo', cap, t) < t)
    assert.equal(siegeFort(r, 'apdok', cap, t), t)
    assert.equal(siegeFort(r, 'iseo', r.nodes['y-miri-v']!, fortMul(r.nodes['y-miri-v']!, 'spring')), fortMul(r.nodes['y-miri-v']!, 'spring'), '도읍이 아니면 그대로')
    // 이서가 추화 도읍을 친다 — 추화와 동맹인 비화가 칼을 뽑는다
    r.relations[pairKey('miri', 'bihwa')] = { state: 'ally', until: null }
    r.relations[pairKey('iseo', 'miri')] = { state: 'war', until: null }
    const { next, report } = advance(r, [{ kind: 'march', army: 'a-iseo', edge: 'y33', ambush: false }])
    if (customLines(report.lines, 'geumseong').length > 0) assert.equal(relationOf(next, 'bihwa', 'iseo').state, 'war')
    else {
      // 한 계절에 닿지 않았으면 다음 계절에
      const b = advance(next, [])
      assert.equal(customLines(b.report.lines, 'geumseong').length, 1)
      assert.equal(relationOf(b.next, 'bihwa', 'iseo').state, 'war')
    }
  })

  it('줄타기(사벌) — 가장 센 두 나라에 청이 잘 먹히고, 한쪽과 손잡으면 다른 쪽이 언짢아한다', () => {
    const r = startYeongnam(1, 'saro')
    const big = bigTwo(r, 'sabeol')
    assert.equal(big.length, 2)
    const p1 = envoyTrueChance(r, 'sabeol', big[0]!, 'truce', NONE, NONE)
    const p0 = envoyTrueChance(without(r, 'sabeol', 'julta'), 'sabeol', big[0]!, 'truce', NONE, NONE)
    assert.ok(p1 > p0)
    for (let seed = 1; seed < 300; seed++) {
      const q = startYeongnam(seed, 'saro')
      const [a, b] = bigTwo(q, 'sabeol') as [string, string]
      if (a === 'saro' || b === 'saro') continue
      const f0 = favorOf(q, 'sabeol', b)
      const { next, report } = advance(q, [{ kind: 'envoy', from: 'sabeol', to: a, ask: 'truce', give: NONE, take: NONE }])
      if (customLines(report.lines, 'julta').length === 0) continue
      assert.ok(favorOf(next, 'sabeol', b) < f0)
      return
    }
    assert.fail('300 시드 안에 줄타기가 한 번도 안 됐다')
  })

  it('쇠 실은 배(가락) — 가을에 남는 쇠를 실어 내고 곡식을 사 온다', () => {
    let r = startYeongnam(1, 'saro')
    stockOf(r, 'guya').iron = P.realm.soebaeKeep + 50
    while (r.season % 4 !== 2) r = advance(r, []).next // 가을
    stockOf(r, 'guya').iron = P.realm.soebaeKeep + 50
    const g0 = stockOf(r, 'guya').grain
    const { next, report } = advance(r, [])
    const l = customLines(report.lines, 'soebae')[0]
    assert.ok(l !== undefined)
    assert.ok(l.n! >= 50 && l.n! <= P.realm.soebaeMax, '남는 쇠를 끝까지 싣는다')
    assert.equal(l.m, Math.round(l.n! * P.realm.soebaePrice))
    assert.ok(next.stock['guya']!.iron >= P.realm.soebaeKeep, '남길 쇠는 남긴다')
    assert.ok(g0 > 0)
  })

  it('바닷가 여덟 나라(포상) — 골포·사물·고자는 화친으로 시작하고, 가락이 그들을 미워한다', () => {
    const r = full(startYeongnam(1, 'us'))
    assert.equal(relationOf(r, 'us', 'samul').state, 'truce')
    assert.equal(relationOf(r, 'us', 'goja').state, 'truce')
    assert.equal(relationOf(r, 'samul', 'goja').state, 'truce')
    assert.ok(envoyTrueChance(r, 'us', 'samul', 'alliance', NONE, NONE) > envoyTrueChance(r, 'us', 'anya', 'alliance', NONE, NONE))
    assert.ok(favorOf(r, 'guya', 'us') < 0)
    assert.equal(relationOf(r, 'us', 'anya').state, 'neutral')
    // 판을 열기 전에 풍습을 빼면 동맹도 없다 (짝 씨앗 도구의 길)
    const q = startYeongnam(1, 'us')
    q.factions['us']!.customs = customsOf(q, 'us').filter((c) => c !== 'posang')
    full(q)
    assert.equal(relationOf(q, 'us', 'samul').state, 'neutral')
    assert.equal(relationOf(q, 'samul', 'goja').state, 'truce')
  })
})

describe('결 풍습 — 변한', () => {
  it('덩이쇠 — 쇠가 쌓이면 징병값을 쇠로 내고, 곡식이 없어도 쇠로 뽑는다', () => {
    const r = startYeongnam(1, 'anya')
    assert.ok(hasCustom(r, 'anya', 'deongisoe') && !hasCustom(r, 'saro', 'deongisoe'))
    stockOf(r, 'anya').iron = P.realm.deongiCovet + 20
    const pay = draftPay(r, 'anya', 50)
    assert.ok(pay.iron > 0 && pay.grain < Math.ceil(50 * P.realm.draftGrain))
    stockOf(r, 'anya').grain = 0
    stockOf(r, 'anya').iron = 40
    assert.ok(draftLimit(r, 'anya', 'y-anya-cap') > 0, '곡식이 없어도 쇠로 뽑는다')
    stockOf(r, 'saro').grain = 0
    assert.equal(draftLimit(r, 'saro', 'y-saro-cap'), 0)
  })

  it('길 비켜 주기 — 우리 청이 더 먹히고, 남의 공작도 우리에게 더 든다', () => {
    const r = startYeongnam(1, 'saro')
    const p1 = envoyTrueChance(r, 'anya', 'miri', 'alliance', NONE, NONE)
    const p0 = envoyTrueChance(without(r, 'anya', 'girbikyeo'), 'anya', 'miri', 'alliance', NONE, NONE)
    assert.ok(p1 > p0)
  })
})

describe('땅 한 수', () => {
  it('쇠 다루기(대가야) — 무장 쇠가 덜 든다', () => {
    const r = startYeongnam(1, 'daegaya')
    const q = without(r, 'daegaya', 'landIron')
    const a = armCost(r, 'a-daegaya', 'spear')
    const b = armCost(q, 'a-daegaya', 'spear')
    assert.ok(a !== null && b !== null && a.iron < b.iron)
  })

  it('뱃길(거칠산) — 바닷길에 숨기 덤 · 수군 나무가 덜 든다 · 포구 장정이 적다', () => {
    const r = startYeongnam(1, 'dokro')
    assert.ok(concealBonus(r, 'dokro', 'sea') > 0 && concealBonus(r, 'saro', 'sea') === 0)
    assert.ok(draftNeeds('boat', 100, r, 'dokro').wood < draftNeeds('boat', 100).wood)
    assert.equal(passExtra(r, 'dokro', 'pass'), 0)
    assert.ok(militiaMen(r, 'y-dokro-v') < militiaMen(without(r, 'dokro', 'landPort'), 'y-dokro-v'))
  })

  it('갈대밭(추화·비화) — 갈대·나루 기습에 숨기 덤 · 여름 큰물에 강가 집이 준다', () => {
    let r = startYeongnam(1, 'miri')
    assert.ok(concealBonus(r, 'miri', 'reeds') > 0 && concealBonus(r, 'bihwa', 'ford') > 0 && concealBonus(r, 'saro', 'reeds') === 0)
    r = advance(r, []).next // 여름으로
    const flood = customLines(advance(r, []).report.lines, 'landReeds').filter((l) => l.faction === 'miri')
    assert.equal(flood.length, 1)
    assert.ok(flood[0]!.n! > 0)
  })

  it('고갯목(아라·초팔·감문) — 우리 고갯길 행군은 한 계절 더', () => {
    const r = startYeongnam(1, 'gammun')
    for (const f of ['anya', 'chopal', 'gammun']) assert.equal(passExtra(r, f, 'pass'), 1, f)
    assert.equal(passExtra(r, 'saro', 'pass'), 0)
    assert.ok(customMarks(r, 'y-gammun-cap', 'gammun').some((m) => m.id === 'landHigh'))
  })

  it('말 치는 들(조문) — 겨울 빼고 계절마다 말이 들고 먹이 곡식이 든다', () => {
    const r = startYeongnam(1, 'jomun')
    const h0 = stockOf(r, 'jomun').horse ?? 0
    const { next, report } = advance(r, [])
    assert.equal(customLines(report.lines, 'landPasture').length, 1)
    assert.ok((next.stock['jomun']!.horse ?? 0) > h0)
  })

  it('소도 곁(벽진) — 제사가 반값 · 봄 제사를 거르면 그해 가을걷이가 준다', () => {
    const r = startYeongnam(1, 'byeokjin')
    const q = without(r, 'byeokjin', 'landSodo')
    assert.ok(riteCost(r, 'byeokjin').grain < riteCost(q, 'byeokjin').grain)
    const { next, report } = advance(r, []) // 봄을 그냥 넘긴다
    assert.equal(customLines(report.lines, 'landSodo').length, 1)
    assert.ok((next.harvestMod?.['byeokjin']?.mul ?? 1) < 1)
  })
})

describe('나라 고르기 · 서막 둘째 장의 카드', () => {
  it('영남 스물한 나라 모두 — 고리(또는 땅 한 수) 카드 · 확신 표기 · 군대의 결이 보인다', () => {
    for (const n of YEONGNAM_NATIONS) {
      const h = customsHtml({ esc: (s) => s, icon: (x) => `[${x}]` }, n.id)
      assert.ok(/class="cust t-(nation|land)"/.test(h), `${n.id} 고리 카드`)
      assert.ok(/(문헌|고고학|전승|땅)<\/i>/.test(h), `${n.id} 확신 표기`)
      assert.ok(h.includes('class="carmy"'), `${n.id} 군대`)
    }
    // 골벌은 쇠뇌가 군대 비에 든다
    assert.ok(mixOf('golbeol', (id) => nativeCustoms('golbeol').includes(id)).some(([u]) => u === 'crossbow'))
  })
})

describe('남부 판 대비 셋 (S3)', () => {
  it('책화(동예) — 우리 땅에 쳐들어온 적은 첫 합 사기가 깎이고, 밖에 나간 우리 군사는 군량이 곱으로 든다', () => {
    const r = full(startSouth(1, 'mokji'))
    assert.ok(hasCustom(r, 'maek', 'chaekhwa') && hasCustom(r, 'siljik', 'chaekhwa') && !hasCustom(r, 'mokji', 'chaekhwa'))
    // 맥국 군대를 남의 땅에 세워 본다 — 군량(upkeep)이 책화 없는 판보다 크다
    const a = Object.values(r.armies).find((x) => x.faction === 'maek')!
    const foreign = Object.values(r.nodes).find((n) => n.owner !== null && n.owner !== 'maek' && n.kind !== 'sodo')!
    a.at = foreign.id
    assert.ok(upkeepOf(r, 'maek', false) > upkeepOf(without(r, 'maek', 'chaekhwa'), 'maek', false))
    assert.ok(customMarks(r, Object.values(r.nodes).find((n) => n.owner === 'maek' && Object.values(r.edges).some((e) => (e.a === n.id || e.b === n.id) && r.nodes[e.a === n.id ? e.b : e.a]?.owner !== 'maek'))!.id, 'maek').some((m) => m.id === 'chaekhwa'))
  })

  it('말 장례(마한) — 기병을 못 뽑고, 가을마다 장례로 장수들의 정이 오른다', () => {
    let r = startRegion('south', 1, 'mokji')
    const cap = r.nodes[r.factions['mokji']!.capital]!
    assert.ok(!draftable(cap, r, 'mokji').includes('horse'))
    assert.ok(draftable(cap, r, 'maek').includes('horse'))
    while (r.season % 4 !== 2) r = advance(r, []).next // 가을
    stockOf(r, 'mokji').grain = 1000
    stockOf(r, 'mokji').horse = 3
    const h = Object.values(r.heroes).find((x) => x.faction === 'mokji' && x.status === 'free' && r.factions['mokji']!.ruler !== x.id)!
    const b0 = h.bond ?? P.realm.bondStart
    const { next, report } = advance(r, [])
    const l = customLines(report.lines, 'maljangrye').filter((x) => x.faction === 'mokji')
    assert.equal(l.length, 1)
    assert.equal(l[0]!.n, 3)
    assert.ok((next.heroes[h.id]!.bond ?? 0) >= b0 + P.realm.maljangBond)
    assert.equal(next.stock['mokji']!.horse ?? 0, 0)
  })
})
