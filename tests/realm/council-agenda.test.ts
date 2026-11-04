/**
 * 전략 회의의 안건과 말 (src/ui/realm/council-agenda.ts · council-says.ts · 형 10-29: "대사 점검 · 장수 인물 특성과의 적절성 · 대사 다양하게 · 의도대로 작동")
 *
 * 말
 *  - 모든 말(결·특성·나서는 말)은 문장마다 '합니다'로 끝나고, 군주에게 시키는 말(-하십시오)이 없다 — 청하는 '주십시오'만
 *  - 결마다 처지마다 두 마디 넘게 · 채운 뒤 빈 칸·{ } 가 남지 않는다 · 받침 있는 말·없는 말 둘 다 조사가 맞다
 * 사람다움 (모든 판 · 여러 씨앗 · 장수 결·특성을 고루 섞어서)
 *  - 밀어붙이는 말(지금 친다 · 모두 데려간다 · 우리가 세니 대로 · 모르니 정면)은 겁쟁이·신중한 이가 하지 않는다
 *  - 「우리가 세다」는 판세를 알고 최악이 반 넘을 때만 · 기다리자는 지략이 cnReadRyak 넘는 이만
 *  - 나서는 이는 겁쟁이가 아니고, 이끌 이로 고르면 정말 이끌 수 있다
 * 작동
 *  - 곁에 남의 군사가 있으면 「군사를 얼마나 데려갈까」 · 없으면 없다 · 나눌 수 없으면 없다
 *  - 호전적인 나라가 곁에 큰 군사를 두면 「기다릴까」
 *  - 안건마다 말은 둘 이상 · 고르는 이름이 겹치지 않는다 · 한 회의 안에서 같은 말이 두 번 나오지 않는다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { REGION_IDS, regionNations, startRegion } from '../../src/realm/data/regions/index.ts'
import { approachMoves, movesOf } from '../../src/realm/estimate.ts'
import { hasTrait } from '../../src/realm/heroes.ts'
import { marchTurns, otherEnd } from '../../src/realm/season.ts'
import { isMonsoon, seasonOf } from '../../src/realm/calendar.ts'
import type { Hero, Realm } from '../../src/realm/types.ts'
import { P } from '../../src/tune/params.ts'
import { councilAgendas, takeCount, type Agenda } from '../../src/ui/realm/council-agenda.ts'
import { fill, NEED, sageuk, SAYS, TRAIT_SAYS, VOLUNTEER, VOLUNTEER_ASK, type Move } from '../../src/ui/realm/council-says.ts'

const WHEN_IDS = new Set(['ally', 'plot', 'wait', 'sky'])
const CTX = { canLead: () => true, rationNow: 2, rationCost: () => 10, grain: 1000 }
const MOVES = Object.keys(NEED) as Move[]
/** 받침 있는 낱말 · 없는 낱말 두 벌 */
const VARS = [
  { foe: '골포국', here: '골포 도읍', there: '갯벌 마을', tf: '아라국', tn: '안개골', size: '만만치 않은 군사', go: '336명', stay: '144명', all: '480명', ap: '여울', read: '적은 여울목에 군사를 둘 것입니다. ', turn: '달', seasons: '2계절', rnow: '4계절치', rmore: '5계절치', rcost: '120' },
  { foe: '고자', here: '고자', there: '미리', tf: '구야', tn: '돌섬', size: '얼마간의 군사', go: '70명', stay: '30명', all: '100명', ap: '대로', read: '', turn: '계절', seasons: '3계절', rnow: '5계절치', rmore: '6계절치', rcost: '15' },
]

/** 한 마디 — 처지마다 들어갈 칸(곳 · 숫자 · 길)이 다 있고 · 세 토막만큼 길고 · 사극 말투로 바꿔도 높임 (형 10-29: "어디는 어떤 이유 때문에 · 어떻게 해 달라") */
function checkLine(t: string, mv: Move, who: string): void {
  for (const k of NEED[mv]) assert.ok(t.includes(`{${k}`), `${who} — {${k}} 가 없다: ${t}`)
  for (const v of VARS) {
    const f = fill(t, v)
    // 길목을 읽은 말이 늘 앞에 붙는 처지(sneakRead·sneakSame)는 그 말 없이 재지 않는다
    if (v.read === '' && mv !== 'sneakRead' && mv !== 'sneakSame') assert.ok(f.length >= 35, `${who} — 너무 짧다(${f.length}): ${f}`)
    polite(f, who)
    polite(sageuk(f), who)
  }
}

/** 문장마다 높임으로 끝나고, 시키는 말이 없다 */
function polite(line: string, who: string): void {
  assert.ok(!/[{}]/.test(line), `채우지 못한 칸 ${who}: ${line}`)
  assert.ok(!/undefined|null/.test(line), `빈 값 ${who}: ${line}`)
  for (const s of line.split(/(?<=[.!?])\s+/)) {
    const t = s.trim()
    if (t === '') continue
    assert.match(t, /(니다|지요|시오|세요|소서)[.!?]$/, `${who}: ${t}`)
    if (/(십시오|시옵소서)[.!]$/.test(t)) assert.match(t, /주(십시오|시옵소서)[.!]$/, `군주에게 시키는 말 ${who}: ${t}`)
    assert.ok(!/(에요|예요|해요|어요|아요)[.!?]/.test(t), `어린애 말투 ${who}: ${t}`)
  }
}

const PUSHY = new Set(['waitAgainst', 'keepAgainst', 'keepAllSafe', 'roadStrong', 'roadBlind'])
const VOICES = ['m-gruff', 'm-young', 'm-sage', 'm-elder', 'm-charm', 'w-bright', 'w-cool', 'w-sly', 'w-shaman', 'm-knight', 'w-knight', 'm-veteran', 'w-matron'] as const
const TRAITS = ['coward', 'careful', 'drinker', 'glutton', 'farmer', 'trader', 'steadfast', 'hundred', 'smith', 'ironhand', 'shaman', 'nighteye', 'river', 'mountain', 'charm']

/** 씨앗으로 정해지는 굴림 (시험만) */
function lcg(seed: number): () => number {
  let s = seed >>> 0 || 1
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296 }
}

/** 우리 장수들의 결·특성을 고루 섞는다 — 모든 결과 특성이 회의에 앉아 보게 */
function shuffleHeroes(r: Realm, rnd: () => number): void {
  for (const h of Object.values(r.heroes) as Array<Hero & { traits: string[]; look: 'g' | 'w' }>) {
    if (h.faction !== r.player) continue
    h.ryak = 1 + Math.floor(rnd() * 10); h.tong = 1 + Math.floor(rnd() * 10); h.mu = 1 + Math.floor(rnd() * 10); h.chi = 1 + Math.floor(rnd() * 10)
    ;(h as { traits: string[] }).traits = TRAITS.filter(() => rnd() < 0.18).slice(0, 2)
    ;(h as { look: 'g' | 'w' }).look = rnd() < 0.5 ? 'g' : 'w'
  }
}

function agendasOf(r: Realm, army: string, edge: string, canLead: (id: string) => boolean = () => true): Agenda[] {
  const a = r.armies[army]!
  const m = movesOf(r, r.player, a).find((x) => x.edge.id === edge)!
  return councilAgendas(r, r.player, a, m, approachMoves(r, r.player, a, m), { ...CTX, canLead })
}

describe('전략 회의의 말', () => {
  it('결마다 처지마다 두 마디 넘게 · 모두 높임 · 시키는 말 없음', () => {
    for (const k of VOICES) {
      for (const mv of MOVES) {
        const ls = SAYS[k][mv]
        assert.ok(ls.length >= 2, `${k} ${mv}: ${ls.length}`)
        assert.equal(new Set(ls).size, ls.length, `${k} ${mv} 겹침`)
        for (const t of ls) checkLine(t, mv, `${k} ${mv}`)
      }
    }
    for (const [tr, ms] of Object.entries(TRAIT_SAYS)) for (const [mv, ls] of Object.entries(ms)) for (const t of ls ?? []) checkLine(t, mv as Move, `${tr} ${mv}`)
    for (const vol of VOLUNTEER) for (const t of vol.intro) polite(t, vol.trait)
    for (const [k, x] of Object.entries(VOLUNTEER_ASK)) for (const t of [...x.leads, ...x.lead]) for (const v of VARS) polite(fill(t, v), `${k} 나섬`)
  })

  it('사극 말투 — -사옵니다 · -옵니다 · -시옵소서', () => {
    assert.equal(sageuk('성이 굳습니다. 오래 걸립니다. 군량을 늘려 주십시오. 지금 치시지요.'), '성이 굳사옵니다. 오래 걸리옵니다. 군량을 늘려 주시옵소서. 지금 치시지요.')
    assert.equal(sageuk('것입니다 · 하겠습니다 · 됩니다'), '것이옵니다 · 하겠사옵니다 · 되옵니다')
  })

  it('조사가 받침을 따른다', () => {
    assert.equal(fill('{there|을} 친다 {ap|으로} {foe|은} {tn|이}', VARS[0]!), '갯벌 마을을 친다 여울로 골포국은 안개골이')
    assert.equal(fill('{there|을} 친다 {ap|으로} {foe|은} {tn|이}', VARS[1]!), '미리를 친다 대로로 고자는 돌섬이')
  })
})

describe('전략 회의 — 사람다움과 작동 (모든 판)', () => {
  it('밀어붙이는 말은 겁쟁이·신중한 이가 하지 않고 · 「우리가 세다」는 판세를 알 때만 · 기다리자는 지략 높은 이만 · 같은 말 두 번 없음', () => {
    let councils = 0
    const seenMoves = new Set<string>()
    for (const region of REGION_IDS) {
      if (region === 'tutorial') continue
      const nations = regionNations(region)
      for (let seed = 1; seed <= 6; seed++) {
        const r = startRegion(region, seed, nations[seed % nations.length]!)
        const rnd = lcg(seed * 97 + region.length)
        shuffleHeroes(r, rnd)
        for (const f of Object.values(r.factions) as Array<{ id: string; mind: string }>) if (f.id !== r.player && rnd() < 0.6) f.mind = 'greedy'
        for (const a of Object.values(r.armies).filter((x) => x.faction === r.player && x.march === null)) {
          for (const m of movesOf(r, r.player, a).filter((x) => x.hostile)) {
            const can = (id: string): boolean => r.heroes[id]?.at === a.at
            const ags = councilAgendas(r, r.player, a, m, approachMoves(r, r.player, a, m), { ...CTX, canLead: can })
            if (ags.length === 0) continue
            councils++
            assert.ok(ags.length <= Math.round(P.realm.cnAgendaMax), `${region} 안건 ${ags.length}: ${ags.map((x) => x.id).join(',')}`)
            assert.ok(ags.filter((x) => WHEN_IDS.has(x.id)).length <= 1, `${region} 「때」 안건 둘: ${ags.map((x) => x.id).join(',')}`)
            const lines = ags.flatMap((ag) => ag.voices.filter((v) => v.hero !== null).map((v) => v.line))
            assert.equal(new Set(lines).size, lines.length, `한 회의에 같은 말: ${lines.join(' / ')}`)
            for (const ag of ags) {
              assert.ok(ag.voices.length >= 2, `${region} ${ag.id}: 말 ${ag.voices.length}`)
              assert.equal(new Set(ag.voices.map((v) => v.label)).size, ag.voices.length, `${ag.id} 고르는 이름 겹침`)
              for (const v of ag.voices) {
                if (v.hero === null) continue
                seenMoves.add(v.move ?? '')
                polite(v.line, `${region}/${seed} ${v.hero.name} ${v.move}`)
                if (PUSHY.has(v.move ?? '')) assert.ok(!hasTrait(v.hero, 'coward') && !hasTrait(v.hero, 'careful'), `${v.hero.name}(${v.hero.traits}) 이 ${v.move}`)
                if (v.move === 'roadStrong') assert.ok(m.win !== null && m.win[0] >= 0.5, `판세를 모르는데 「우리가 세다」 ${m.win}`)
                if (v.move === 'waitAdvise') assert.ok(v.hero.ryak >= P.realm.cnReadRyak, `지략 ${v.hero.ryak} 이 기다리자`)
                if (v.move === 'volunteer') {
                  assert.ok(!hasTrait(v.hero, 'coward'), `겁쟁이가 나섰다 ${v.hero.name}`)
                  if (v.opt.k === 'route' && v.opt.lead !== undefined) assert.ok(can(v.opt.lead), '이끌 수 없는 이를 이끌 이로')
                  else assert.equal(v.hero.id, a.hero, '이끌지도 못하는데 맡겨 달라')
                }
                if (v.opt.k === 'take' && v.opt.share < 1) {
                  const go = takeCount(a, v.opt.share)
                  const all = takeCount(a, 1)
                  assert.ok(go >= P.realm.splitMin && all - go >= P.realm.splitMin, `나눌 수 없는데 ${go}/${all}`)
                }
              }
            }
          }
        }
      }
    }
    assert.ok(councils >= 10, `회의가 너무 적다 ${councils}`)
    assert.ok(seenMoves.size >= 4, `처지가 고루 안 나왔다 ${[...seenMoves]}`)
  })

  it('곁에 남의 군사가 있으면 「군사를 얼마나 데려갈까」 · 칠 곳의 군사·빈 곁이면 없다', () => {
    const r = byeonhanMini(4)
    const a = Object.values(r.armies).find((x) => x.faction === r.player)!
    const m = movesOf(r, r.player, a).find((x) => x.hostile)!
    const edge = m.edge.id
    const at = a.at
    const to = otherEnd(r.edges[edge]!, at)!
    for (const x of Object.values(r.armies)) if (x.faction !== r.player) x.at = 'nowhere'
    assert.ok(!agendasOf(r, a.id, edge).some((x) => x.id === 'keep'), '곁에 아무도 없는데 섰다')
    const side = Object.values(r.edges).map((ed) => otherEnd(ed, at)).find((o): o is string => o !== null && o !== to)
    assert.ok(side !== undefined, '이웃 고을이 하나뿐')
    const foe = Object.values(r.armies).find((x) => x.faction !== r.player)!
    for (const k of Object.keys(r.relations)) if (k.includes(foe.faction)) (r.relations[k] as { state: string }).state = 'war'
    foe.at = to
    assert.ok(!agendasOf(r, a.id, edge).some((x) => x.id === 'keep'), '칠 곳의 군사로 섰다')
    foe.at = side
    const keep = agendasOf(r, a.id, edge).find((x) => x.id === 'keep')
    assert.ok(keep !== undefined, '곁에 남의 군사가 있는데 안 섰다')
    assert.ok(keep.voices.some((v) => v.opt.k === 'take' && v.opt.share < 1))
    assert.ok(keep.voices.some((v) => v.opt.k === 'take' && v.opt.share === 1))
    // 나눌 수 없을 만큼 작으면 안 선다
    a.mix = { spear: P.realm.splitMin + 2 }
    assert.ok(!agendasOf(r, a.id, edge).some((x) => x.id === 'keep'), '나눌 수 없는데 섰다')
  })

  it('호전적인 나라가 곁에 큰 군사를 두면 「기다릴까」', () => {
    const r = byeonhanMini(4)
    const a = Object.values(r.armies).find((x) => x.faction === r.player)!
    const m = movesOf(r, r.player, a).find((x) => x.hostile)!
    const to = otherEnd(m.edge, a.at)!
    const def = r.nodes[to]!.owner!
    ;(r.factions[def] as { mind: string }).mind = 'greedy'
    for (const k of Object.keys(r.relations)) if (k.includes(def)) (r.relations[k] as { state: string }).state = 'war'
    const foe = Object.values(r.armies).find((x) => x.faction === def)!
    foe.at = to
    foe.mix = { spear: 5000 }
    for (const h of Object.values(r.heroes)) if (h.faction === r.player) h.ryak = 9
    const ags = agendasOf(r, a.id, m.edge.id)
    const w = ags.find((x) => x.id === 'wait')
    assert.ok(w !== undefined, ags.map((x) => x.id).join(','))
    assert.ok(w.voices.some((v) => v.opt.k === 'wait') && w.voices.some((v) => v.opt.k === 'go'))
  })

  it('장마 끝물이면 「장마가 걷히길 기다릴까」 · 해자를 두른 고을은 기다리면 언 해자에 닿을 때 「해자가 얼길」 (형 11-05: 제안의 다양성)', () => {
    // 뭍길로 남의 고을을 칠 수 있는 판을 찾는다 (달 시계 · 지략 높은 장수들)
    type Case = { r: Realm; a: string; edge: string; to: string }
    const cases: Case[] = []
    for (const region of REGION_IDS) {
      if (region === 'tutorial') continue
      for (let seed = 1; seed <= 3; seed++) {
        const r = startRegion(region, seed, regionNations(region)[seed % regionNations(region).length]!)
        ;(r as { clock: string }).clock = 'month'
        for (const h of Object.values(r.heroes)) if (h.faction === r.player) h.ryak = 9
        for (const a of Object.values(r.armies).filter((x) => x.faction === r.player && x.march === null)) {
          const m = movesOf(r, r.player, a).find((x) => x.hostile && x.edge.kind !== 'ford' && x.edge.kind !== 'pass' && x.edge.kind !== 'sea')
          if (m !== undefined) cases.push({ r, a: a.id, edge: m.edge.id, to: otherEnd(m.edge, a.at)! })
        }
      }
    }
    assert.ok(cases.length > 0)
    const at = (c: Case, t: number): Agenda[] => { (c.r as { season: number }).season = t; return agendasOf(c.r, c.a, c.edge) }
    // 8월 — 이번에 떠나면 장마 한 달이 붙고 9월엔 없다 · 7월엔 기다려도 장마라 서지 않는다
    let mud = 0
    for (const c of cases) {
      const ag = at(c, 5).find((x) => x.id === 'sky')
      if (ag === undefined) continue
      mud++
      assert.ok(ag.voices.some((v) => v.opt.k === 'wait' && v.hero !== null && v.line.includes('장마')) && ag.voices.some((v) => v.opt.k === 'go'))
      assert.ok(!at(c, 4).some((x) => x.id === 'sky'), '7월에 장마 안건')
    }
    assert.ok(mud > 0, '8월에 장마 안건이 한 번도 안 섰다')
    // 해자 — 지금 떠나면 겨울 전에, 한 턴 늦으면 겨울에 닿는 때 · 해자가 없으면 서지 않는다
    let ice = 0
    for (const c of cases) {
      const ed = c.r.edges[c.edge]!
      let t = 0
      while (t < 24 && !(!isMonsoon(c.r, t) && seasonOf(c.r, t + marchTurns(c.r, ed, t)) !== 'winter' && seasonOf(c.r, t + 1 + marchTurns(c.r, ed, t + 1)) === 'winter')) t++
      const tags = c.r.nodes[c.to]!.tags as string[]
      const had = tags.includes('moat')
      if (!had) tags.push('moat')
      const ag = at(c, t).find((x) => x.id === 'sky')
      if (ag !== undefined) { ice++; assert.ok(ag.title.includes('해자')) }
      tags.splice(tags.indexOf('moat'), 1)
      assert.ok(!at(c, t).some((x) => x.id === 'sky'), '해자 없는 고을에 해자 안건')
      if (had) tags.push('moat')
    }
    assert.ok(ice > 0, '해자 안건이 한 번도 안 섰다')
  })
})
