/**
 * 회의가 기억을 읽는다 (docs/realm/MEMORY.md §3-2 1 · src/ui/realm/council-agenda.ts · council-recall.ts · council-schemes.ts)
 *
 * 까닭
 *  - 그 나라를 쳐서 이긴 길을 기억하는 장수가 그 길을 든다 · 없으면 나라의 장부로 「우리가 …」 · 진 길은 다른 길을 권하는 말 앞에
 *  - 나눠 떠났다가 털린(짓밟힌) 장수가 「남기자」를 먼저 말한다 (곁에 보이는 적이 없어도) · 쪼개 갔다가 진 장부는 「다 데려가자」의 까닭
 *  - 사실이 없으면 지금 말 그대로 (recall 없음)
 * 새 안건 셋
 *  - 먼저 공작: 정찰로 본 곳간이 그득하고 공작을 걸 수 있을 때만 · 고르면 출정이 멈추고 방화가 미리 고른 이와 함께 걸린다
 *  - 두 갈래: 다른 우리 군대가 다른 길로 같은 계절에 닿을 때 · 고르면 그 군대의 출정이 서고, 판에서 한 싸움(협공)으로 붙는다
 *  - 동맹: 칠 나라가 우리와 땅을 맞댄 나라와 손잡았으면 · 치지 않는다 / 때를 기다린다 / 이간 (거친 이는 그래도 치자)
 * 회의의 기억
 *  - 들은 안이 장수의 기억에 적히고(따랐나), 그 고을 싸움의 결과가 붙는다 · 기다림은 그 계절에 결과가 난다
 *  - 맞았던 장수는 금빛 테와 「지난번 소장의 말대로」 · 빗나간 장수는 머뭇거린다
 *  - 같은 씨앗 · 같은 명령이면 같은 기억 · 회의 명령은 판(고을·군대·곡식)을 바꾸지 않는다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { aiOrders, decide } from '../../src/realm/ai.ts'
import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { REGION_IDS, regionNations, startRegion } from '../../src/realm/data/regions/index.ts'
import { pairKey } from '../../src/realm/diplomacy.ts'
import { approachMoves, movesOf, type Move } from '../../src/realm/estimate.ts'
import { hasTrait } from '../../src/realm/heroes.ts'
import { councilRecord, noteMemory } from '../../src/realm/memory.ts'
import { advance, otherEnd } from '../../src/realm/season.ts'
import type { Army, Hero, Order, Realm, ReportLine } from '../../src/realm/types.ts'
import { P } from '../../src/tune/params.ts'
import { councilAgendas, howOf, planChoice, planOrders, type Agenda, type CouncilCtx } from '../../src/ui/realm/council-agenda.ts'
import { SCHEME_NEED, SCHEME_SAYS, type Scheme } from '../../src/ui/realm/council-schemes.ts'
import { fill, sageuk } from '../../src/ui/realm/council-says.ts'

type Battle = Extract<ReportLine, { kind: 'battle' }>
const HAND: Pick<CouncilCtx, 'plotHand'> = { plotHand: () => ({ agent: null, grain: 25 }) }
const CTX: CouncilCtx = { canLead: () => true, rationNow: 2, rationCost: () => 10, grain: 1000 }

/** 꾸민 판 — 변한 작은 판: 우리 군대 하나가 고자 마을을 치러 간다 · 남의 군대는 멀리 (곁의 적 안건이 끼지 않게) */
function setup(seed = 4): { r: Realm; a: Army; m: Move; def: string; me: string } {
  const r = byeonhanMini(seed)
  const me = r.player
  const a = Object.values(r.armies).find((x) => x.faction === me)!
  for (const x of Object.values(r.armies)) if (x.faction !== me) x.at = 'nowhere'
  // 자리의 첫 장수는 신중한 이 — 거친 이만 앉으면 말리는 이가 없다
  ;(seat(r, a, 0) as unknown as { traits: string[] }).traits = ['careful']
  const m = movesOf(r, me, a).find((x) => x.hostile)!
  return { r, a, m, def: r.nodes[m.to]!.owner!, me }
}

function agendasOf(r: Realm, a: Army, to: string, ctx: Partial<CouncilCtx> = {}): Agenda[] {
  const m = movesOf(r, r.player, a).find((x) => x.to === to && x.hostile)!
  return councilAgendas(r, r.player, a, m, approachMoves(r, r.player, a, m), { ...CTX, ...ctx })
}

/** 우리 장수 — 자리에 앉는 이(군주 빼고) 가운데 군대를 이끌지 않는 이 */
function seat(r: Realm, a: Army, n = 0): Hero {
  return Object.values(r.heroes).filter((h) => h.faction === r.player && h.id !== a.hero && h.id !== r.factions[r.player]!.ruler).sort((x, y) => (x.id < y.id ? -1 : 1))[n]!
}

/** 문장마다 높임으로 끝나고 시키는 말이 없다 (council-agenda.test 와 같은 잣대) */
function polite(line: string, who: string): void {
  assert.ok(!/[{}]/.test(line), `채우지 못한 칸 ${who}: ${line}`)
  assert.ok(!/undefined|null|NaN/.test(line), `빈 값 ${who}: ${line}`)
  assert.ok(!line.includes('—'), `긴 줄표 ${who}: ${line}`)
  for (const s of line.split(/(?<=[.!?])\s+/)) {
    const t = s.trim()
    if (t === '') continue
    assert.match(t, /(니다|지요|시오|세요|소서)[.!?]$/, `${who}: ${t}`)
    if (/(십시오|시옵소서)[.!]$/.test(t)) assert.match(t, /주(십시오|시옵소서)[.!]$/, `군주에게 시키는 말 ${who}: ${t}`)
  }
}

function battle(over: Partial<Battle> & Pick<Battle, 'node' | 'defender' | 'atkFaction' | 'outcome'>): Battle {
  return { kind: 'battle', attacker: 'x', allies: [], pincer: false, ambush: 'none', p: 0.5, captured: null, killed: null, militia: 0, ...over } as Battle
}

describe('새 안건의 말', () => {
  const VARS = [
    { foe: '골포국', there: '갯벌 마을', ally: '아라국', via: '안개골', with: '쇠보', here: '골포 도읍' },
    { foe: '고자', there: '미리', ally: '구야', via: '돌섬', with: '아사', here: '고자' },
  ]
  it('숨결마다 처지마다 두 마디 · 들어갈 칸이 다 있고 · 채우면 모두 높임', () => {
    for (const [tone, sc] of Object.entries(SCHEME_SAYS)) {
      for (const k of Object.keys(SCHEME_NEED) as Scheme[]) {
        const ls = sc[k]
        assert.ok(ls.length >= 2, `${tone} ${k}`)
        assert.equal(new Set(ls).size, ls.length, `${tone} ${k} 겹침`)
        for (const t of ls) {
          for (const need of SCHEME_NEED[k]) assert.ok(t.includes(`{${need}`), `${tone} ${k} — {${need}} 없음: ${t}`)
          for (const v of VARS) { polite(fill(t, v), `${tone} ${k}`); polite(sageuk(fill(t, v)), `${tone} ${k}`) }
        }
      }
    }
  })
})

describe('까닭 있는 안 — 기억에서', () => {
  it('그 나라를 쳐서 이긴 길을 기억하는 장수가 그 길을 든다 (그 싸움을 겪은 이가 먼저)', () => {
    const { r, a, m, def } = setup()
    const h = seat(r, a, 1)
    h.mem = [{ s: r.season - 2, k: 'battle', at: m.to, foe: def, how: 'night', res: 'won' }]
    const route = agendasOf(r, a, m.to).find((x) => x.id === 'route')!
    const v = route.voices.find((x) => x.move === 'recall')
    assert.ok(v !== undefined, route.voices.map((x) => x.move).join(','))
    assert.equal(v.hero?.id, h.id)
    assert.deepEqual(v.opt, { k: 'route', ap: 'night' })
    assert.ok(v.line.includes(`${r.nodes[m.to]!.name} 싸움에서 밤길로 가 이겼사옵니다`), v.line)
    polite(v.line, 'recall')
  })

  it('겪은 이가 없으면 나라의 장부로 · 진 길은 다른 길을 권하는 말 앞에 · 사실이 없으면 지금 말 그대로', () => {
    const { r, a, m, def, me } = setup()
    const bare = agendasOf(r, a, m.to).find((x) => x.id === 'route')
    assert.ok(!(bare?.voices ?? []).some((x) => x.move === 'recall' || /이겼사옵니다|졌사옵니다/.test(x.line)), '사실이 없는데 지난 일을 말한다')
    r.lessons = { [me]: { [def]: [{ s: r.season - 1, k: 'b', at: m.to, how: 'night', res: 'won' }] } }
    const won = agendasOf(r, a, m.to).find((x) => x.id === 'route')!.voices.find((x) => x.move === 'recall')
    assert.ok(won !== undefined && won.line.includes('칠 때 밤길로 가 이겼사옵니다'), won?.line ?? '없음')
    r.lessons = { [me]: { [def]: [{ s: r.season - 1, k: 'b', at: m.to, how: 'night', res: 'lost' }] } }
    const lost = agendasOf(r, a, m.to).find((x) => x.id === 'route')!
    assert.ok(!lost.voices.some((x) => x.move === 'recall'), '진 길을 이긴 길로 든다')
    const cite = lost.voices.find((x) => x.line.includes('밤길로 갔다가 졌사옵니다'))
    assert.ok(cite !== undefined && cite.opt.k === 'route' && cite.opt.ap !== 'night', lost.voices.map((x) => x.line).join(' / '))
    // 오래된 일은 말하지 않는다
    r.lessons = { [me]: { [def]: [{ s: r.season - P.realm.cnMemAge - 1, k: 'b', at: m.to, how: 'night', res: 'won' }] } }
    assert.ok(!(agendasOf(r, a, m.to).find((x) => x.id === 'route')?.voices ?? []).some((x) => x.move === 'recall'))
  })

  it('나눠 떠났다가 털린 장수가 「남기자」를 먼저 · 쪼개 갔다가 진 장부는 「다 데려가자」의 까닭', () => {
    const { r, a, m, def, me } = setup()
    assert.ok(!agendasOf(r, a, m.to).some((x) => x.id === 'keep'), '곁에 적도 지난 일도 없는데 섰다')
    const h = seat(r, a, 0)
    h.mem = [{ s: r.season - 1, k: 'split', at: a.at, foe: def, n: 0, res: 'fail' }]
    r.lessons = { [me]: { [def]: [{ s: r.season - 1, k: 's', at: a.at, n: 0, raid: 1 }] } }
    const keep = agendasOf(r, a, m.to).find((x) => x.id === 'keep')
    assert.ok(keep !== undefined, '털린 장수가 있는데 군사 안건이 안 섰다')
    const v = keep.voices[0]!
    assert.equal(v.hero?.id, h.id)
    assert.ok(v.opt.k === 'take' && v.opt.share < 1)
    assert.ok(v.line.includes('군사를 다 데려갔다가') && v.line.includes('짓밟혔사옵니다'), v.line)
    polite(v.line, 'keep recall')
    // 나라의 장부가 「쪼개 갔다가 졌다」면 다 데려가자는 쪽이 그 일을 든다
    r.lessons = { [me]: { [def]: [{ s: r.season - 1, k: 's', at: a.at, n: 30, res: 'lost' }] } }
    const k2 = agendasOf(r, a, m.to).find((x) => x.id === 'keep')!
    const all = k2.voices.find((x) => x.opt.k === 'take' && x.opt.share === 1)!
    if (all.hero !== null) assert.ok(all.line.includes('쪼개 갔다가'), all.line)
  })
})

describe('새 안건 — 먼저 공작 · 두 갈래 · 동맹', () => {
  it('먼저 공작: 정찰로 본 곳간이 그득하고 공작을 걸 수 있을 때만 · 고르면 출정이 멈추고 방화가 걸린다', () => {
    const { r, a, m, def, me } = setup()
    const see = (v: number, s: number): void => { r.intel[me]![m.to] = { land: true, force: null, alert: null, grain: { v, season: s } } }
    see(P.realm.cnPlotRich + 100, r.season)
    const ag = agendasOf(r, a, m.to, HAND).find((x) => x.id === 'plot')
    assert.ok(ag !== undefined, '곳간이 그득한데 안 섰다')
    assert.deepEqual(ag.voices[0]!.opt, { k: 'plot', op: 'burn', target: def, agent: null, grain: 25 })
    assert.ok(ag.voices[0]!.line.includes('곳간에 곡식이 그득'), ag.voices[0]!.line)
    assert.equal(ag.voices[1]!.opt.k, 'go')
    for (const v of ag.voices) if (v.hero !== null) polite(v.line, 'plot')
    assert.ok(!agendasOf(r, a, m.to).some((x) => x.id === 'plot'), '공작을 걸 수 없는데 섰다')
    see(P.realm.cnPlotRich - 1, r.season)
    assert.ok(!agendasOf(r, a, m.to, HAND).some((x) => x.id === 'plot'), '곳간이 넉넉하지 않은데 섰다')
    see(P.realm.cnPlotRich + 100, r.season - P.realm.cnGrainAge - 1)
    assert.ok(!agendasOf(r, a, m.to, HAND).some((x) => x.id === 'plot'), '오래된 정찰로 섰다')
    // 한 번 누름 — 출정을 멈추고 방화를 건다 · 같은 안건에서 「곧장 친다」로 바꾸면 거둔다
    see(P.realm.cnPlotRich + 100, r.season)
    const ag2 = agendasOf(r, a, m.to, { plotHand: () => ({ agent: seat(r, a).id, grain: 25 }) }).find((x) => x.id === 'plot')!
    const plan = planChoice({}, ag2.voices[0]!, 'plot')
    assert.equal(plan.wait, true)
    const os = planOrders(r, me, a, m.edge.id, plan, [{ hero: ag2.voices[0]!.hero!.id, how: howOf(ag2.voices[0]!), took: true }])
    assert.ok(os.some((o) => o.kind === 'plot' && o.op === 'burn' && o.target === def && o.agent === seat(r, a).id), JSON.stringify(os))
    assert.ok(!os.some((o) => o.kind === 'march'), '출정이 멈추지 않았다')
    assert.ok(os.some((o) => o.kind === 'council' && o.foe === def && o.at === m.to && o.said[0]!.how === 'burn'))
    const back = planChoice(plan, ag2.voices[1]!, 'plot')
    assert.equal(back.wait, false)
    assert.equal(back.plot, undefined)
  })

  it('두 갈래: 다른 우리 군대가 다른 길로 같은 계절에 닿으면 · 고르면 그 군대도 떠나 한 싸움(협공)으로 붙는다', () => {
    const { r, a, m, me } = setup()
    // 다른 길로 칠 곳에 닿는 고을에 우리 군대 하나를 둔다 (장수 하나가 이끈다)
    const side = Object.values(r.edges).filter((e) => e.id !== m.edge.id && otherEnd(e, m.to) !== null).map((e) => otherEnd(e, m.to)!).find((n) => n !== a.at && r.nodes[n]?.owner !== r.nodes[m.to]!.owner)!
    const lead = seat(r, a, 1)
    r.armies['a-us-b'] = { ...a, id: 'a-us-b', at: side, hero: lead.id, mix: { ...a.mix }, march: null }
    const same = movesOf(r, me, r.armies['a-us-b']!).find((x) => x.to === m.to)!
    assert.ok(same.seasons === m.seasons && same.blocked === null, '꾸민 판의 두 길이 같은 계절이 아니다')
    const ag = agendasOf(r, a, m.to).find((x) => x.id === 'pincer')
    assert.ok(ag !== undefined, '두 갈래가 안 섰다')
    const v = ag.voices[0]!
    assert.equal(v.hero?.id, lead.id, '그쪽 군대를 이끄는 이가 먼저 나선다')
    assert.deepEqual(v.opt, { k: 'pincer', army: 'a-us-b', edge: same.edge.id, from: side })
    assert.equal(howOf(ag.voices[1]!), 'one')
    polite(v.line, 'pincer')
    // 이미 다른 곳으로 걸어 둔 군대는 부르지 않는다
    assert.ok(!agendasOf(r, a, m.to, { armyFree: (id) => id !== 'a-us-b' }).some((x) => x.id === 'pincer'))
    // 한 번 누름 → 그 군대의 출정이 선다 · 판에서 같은 계절에 닿아 한 싸움으로 붙는다
    const os = planOrders(r, me, a, m.edge.id, planChoice({}, v, 'pincer'), [])
    const mb = os.find((o): o is Extract<Order, { kind: 'march' }> => o.kind === 'march')
    assert.ok(mb !== undefined && mb.army === 'a-us-b' && mb.edge === same.edge.id, JSON.stringify(os))
    assert.equal(planOrders(r, me, a, m.edge.id, planChoice(planChoice({}, v, 'pincer'), ag.voices[1]!, 'pincer'), []).length, 0, '「한 길로」로 바꾸면 거둔다')
    const res = advance(r, [{ kind: 'march', army: a.id, edge: m.edge.id, ambush: false, approach: 'road' }, ...os])
    const bl = res.report.lines.find((l): l is Battle => l.kind === 'battle' && l.node === m.to)
    assert.ok(bl !== undefined, '싸움이 안 났다')
    assert.equal(bl.pincer, true, '두 길이 한 싸움으로 붙지 않았다')
  })

  it('동맹: 칠 나라가 우리와 땅을 맞댄 나라와 손잡았으면 · 치지 않는다 / 때를 기다린다 / 이간', () => {
    const { r, a, m, def, me } = setup()
    assert.ok(!agendasOf(r, a, m.to, HAND).some((x) => x.id === 'ally'))
    const border = new Set<string>()
    for (const e of Object.values(r.edges)) {
      const x = r.nodes[e.a]?.owner
      const y = r.nodes[e.b]?.owner
      if (x === me && y != null && y !== me && y !== def) border.add(y)
      if (y === me && x != null && x !== me && x !== def) border.add(x)
    }
    const ally = [...border].sort()[0]!
    r.relations[pairKey(def, ally)] = { state: 'ally', until: null }
    const ag = agendasOf(r, a, m.to, HAND).find((x) => x.id === 'ally')
    assert.ok(ag !== undefined, '동맹 안건이 안 섰다')
    assert.ok(!agendasOf(r, a, m.to, HAND).some((x) => x.id === 'wait'), '동맹 안건과 때 안건이 함께 섰다')
    const ks = ag.voices.map((v) => v.opt.k)
    assert.ok(ks.includes('hold') && ks.includes('wait') && ks.includes('plot'), ks.join(','))
    assert.ok(ag.voices.length <= 4)
    const first = ag.voices.find((v) => v.hero !== null)!
    assert.ok(first.line.includes('땅을 맞댄 나라'), first.line)
    for (const v of ag.voices) {
      if (v.hero === null) continue
      polite(v.line, `ally ${v.move}`)
      if (v.move === 'allyGo') assert.ok(!hasTrait(v.hero, 'coward') && !hasTrait(v.hero, 'careful'))
    }
    const sow = ag.voices.find((v) => v.opt.k === 'plot')!
    const [x, y] = def < ally ? [def, ally] : [ally, def]
    assert.deepEqual(sow.opt, { k: 'plot', op: 'sow', target: x, other: y, agent: null, grain: 25 })
    // 한 번 누름 — 치지 않는다: 출정 없음 · 이간: 공작이 걸린다
    const hold = ag.voices.find((v) => v.opt.k === 'hold')!
    const ph = planChoice({}, hold, 'ally')
    assert.equal(ph.wait, true)
    const os = planOrders(r, me, a, m.edge.id, ph, [{ hero: hold.hero?.id ?? 'x', how: howOf(hold), took: true }])
    assert.ok(!os.some((o) => o.kind === 'march' || o.kind === 'plot'))
    assert.equal(howOf(hold), 'hold')
    const ps = planOrders(r, me, a, m.edge.id, planChoice({}, sow, 'ally'), [])
    assert.ok(ps.some((o) => o.kind === 'plot' && o.op === 'sow' && o.target === x && o.other === y))
    // 이간을 걸 수 없으면 둘(과 거친 이)만
    assert.ok(!agendasOf(r, a, m.to).find((x2) => x2.id === 'ally')!.voices.some((v) => v.opt.k === 'plot'))
  })

  it('모든 판 — 새 안건의 말도 높임 · 고르는 이름이 겹치지 않고 · 밀어붙이는 말은 겁쟁이·신중한 이가 하지 않는다', () => {
    let seen = 0
    for (const region of REGION_IDS) {
      if (region === 'tutorial') continue
      const nations = regionNations(region)
      for (let seed = 1; seed <= 3; seed++) {
        const r = startRegion(region, seed, nations[seed % nations.length]!)
        const me = r.player
        const fs = Object.keys(r.factions).filter((f) => f !== me).sort()
        // 남의 나라끼리 손잡게 하고 · 모든 고을의 곳간을 보았다고 한다
        for (let i = 0; i + 1 < fs.length; i += 2) r.relations[pairKey(fs[i]!, fs[i + 1]!)] = { state: 'ally', until: null }
        for (const n of Object.values(r.nodes)) if (n.owner !== null && n.owner !== me) (r.intel[me] ??= {})[n.id] = { land: true, force: null, alert: null, grain: { v: P.realm.cnPlotRich * 2, season: r.season } }
        for (const a of Object.values(r.armies).filter((x) => x.faction === me && x.march === null)) {
          for (const m of movesOf(r, me, a).filter((x) => x.hostile)) {
            const ags = councilAgendas(r, me, a, m, approachMoves(r, me, a, m), { ...CTX, ...HAND })
            const lines = ags.flatMap((ag) => ag.voices.filter((v) => v.hero !== null).map((v) => v.line))
            assert.equal(new Set(lines).size, lines.length, `한 회의에 같은 말: ${lines.join(' / ')}`)
            for (const ag of ags) {
              if (ag.id === 'ally' || ag.id === 'plot' || ag.id === 'pincer') seen++
              assert.ok(ag.voices.length >= 2, `${region} ${ag.id}`)
              assert.equal(new Set(ag.voices.map((v) => v.label)).size, ag.voices.length, `${ag.id} 고르는 이름 겹침`)
              for (const v of ag.voices) {
                if (v.hero === null) continue
                polite(v.line, `${region}/${seed} ${v.hero.name} ${v.move}`)
                if (v.move === 'allyGo' || v.move === 'plotAgainst') assert.ok(!hasTrait(v.hero, 'coward') && !hasTrait(v.hero, 'careful'), `${v.hero.name} ${v.move}`)
              }
            }
          }
        }
      }
    }
    assert.ok(seen >= 5, `새 안건이 너무 적게 섰다 ${seen}`)
  })
})

describe('회의의 기억', () => {
  it('들은 안이 기억에 적히고(따랐나) · 그 고을 싸움의 결과가 붙는다 · 기다림은 그 계절에 난다', () => {
    const { r, a, m, def, me } = setup()
    const yes = seat(r, a, 0)
    const no = seat(r, a, 1)
    const o: Order = { kind: 'council', faction: me, foe: def, at: m.to, said: [{ hero: yes.id, how: 'night', took: true }, { hero: no.id, how: 'road', took: false }] }
    noteMemory(r, [battle({ node: m.to, defender: def, atkFaction: me, outcome: 'win' })], [o], [])
    const my = yes.mem!.find((x) => x.k === 'council')!
    assert.equal(my.n, 1)
    assert.equal(my.res, 'won')
    assert.equal(my.how, 'night')
    const nm = no.mem!.find((x) => x.k === 'council')!
    assert.equal(nm.n, 0)
    assert.equal(nm.res, undefined, '따르지 않은 안에는 결과를 붙이지 않는다')
    assert.equal(councilRecord(r, yes.id, 0)?.res, 'won')
    // 기다림 — 싸움이 없으면 그 계절에 「탈 없음」
    const r2 = setup().r
    const w = seat(r2, a, 0)
    noteMemory(r2, [], [{ kind: 'council', faction: me, foe: def, at: m.to, said: [{ hero: w.id, how: 'wait', took: true }] }], [])
    assert.equal(r2.heroes[w.id]!.mem!.find((x) => x.k === 'council')!.res, 'ok')
    // 떠난 안은 싸움이 날 때까지 기다린다 (cnCouncilWatch 안)
    const r3 = setup().r
    const g = seat(r3, a, 0)
    noteMemory(r3, [], [{ kind: 'council', faction: me, foe: def, at: m.to, said: [{ hero: g.id, how: 'road', took: true }] }], [])
    assert.equal(r3.heroes[g.id]!.mem!.find((x) => x.k === 'council')!.res, undefined)
  })

  it('맞았던 장수는 금빛 테와 「지난번 … 말대로」 · 빗나간 장수는 머뭇거린다 (처음 말할 때 한 번)', () => {
    const { r, a, m, def } = setup()
    const good = seat(r, a, 0)
    const bad = seat(r, a, 1)
    // 곳간 안건을 세운다 — 꾀 많은 신중한 이가 공작을, 힘센 이가 맞선다
    good.ryak = 8
    bad.mu = 9
    r.intel[r.player]![m.to] = { land: true, force: null, alert: null, grain: { v: P.realm.cnPlotRich + 100, season: r.season } }
    good.mem = [{ s: r.season - 1, k: 'council', how: 'road', foe: def, at: m.to, n: 1, res: 'won' }]
    bad.mem = [{ s: r.season - 1, k: 'council', how: 'night', foe: def, at: m.to, n: 1, res: 'lost' }]
    const vs = agendasOf(r, a, m.to, HAND).flatMap((x) => x.voices)
    const gv = vs.filter((v) => v.hero?.id === good.id)
    const bv = vs.filter((v) => v.hero?.id === bad.id)
    assert.ok(gv.length > 0 && bv.length > 0, '둘 다 말하지 않았다')
    assert.ok(gv.every((v) => v.proven === true))
    assert.equal(gv.filter((v) => /말대로 하시어 이겼사옵니다/.test(v.line)).length, 1, gv.map((v) => v.line).join(' / '))
    assert.ok(bv.every((v) => v.doubt === true && v.proven !== true))
    assert.equal(bv.filter((v) => v.line.includes('빗나갔사옵니다')).length, 1)
    for (const v of [...gv, ...bv]) polite(v.line, 'council recall')
    // 오래된 회의는 말하지 않는다
    good.mem = [{ s: r.season - P.realm.cnMemAge - 1, k: 'council', how: 'road', foe: def, at: m.to, n: 1, res: 'won' }]
    assert.ok(!agendasOf(r, a, m.to, HAND).flatMap((x) => x.voices).some((v) => v.hero?.id === good.id && v.proven === true))
  })

  it('같은 씨앗 · 같은 명령이면 같은 기억 · 회의 명령은 판을 바꾸지 않는다', () => {
    const run = (withCouncil: boolean): Realm => {
      let r = byeonhanMini(7)
      for (let s = 0; s < 14 && !r.outcome; s++) {
        const os: Order[] = [...aiOrders(r), ...decide(r, r.player, 'planner')]
        if (withCouncil) {
          for (const o of os) {
            if (o.kind !== 'march') continue
            const ar = r.armies[o.army]
            const to = ar !== undefined && r.edges[o.edge] !== undefined ? otherEnd(r.edges[o.edge]!, ar.at) : null
            const foe = to !== null ? r.nodes[to]?.owner ?? null : null
            if (ar === undefined || ar.faction !== r.player || ar.hero === null || to === null || foe === null || foe === r.player) continue
            os.push({ kind: 'council', faction: r.player, foe, at: to, said: [{ hero: ar.hero, how: o.approach ?? 'road', took: true }] })
            break
          }
        }
        r = advance(r, os).next
      }
      return r
    }
    const strip = (r: Realm): string => JSON.stringify({ nodes: r.nodes, armies: r.armies, stock: r.stock, rel: r.relations, heroes: Object.fromEntries(Object.entries(r.heroes).map(([k, h]) => [k, { ...h, mem: (h.mem ?? []).filter((x) => x.k !== 'council') }])) })
    const a = run(true)
    const b = run(true)
    assert.equal(JSON.stringify(a.heroes), JSON.stringify(b.heroes), '같은 씨앗인데 기억이 다르다')
    assert.equal(strip(a), strip(run(false)), '회의 명령이 판을 바꿨다')
  })
})
