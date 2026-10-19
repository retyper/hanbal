/**
 * 싸움 이야기와 싸움 이름 (prose.roundStory · endStory · battleName — 형 2026-10-19:
 * "누가 얼마가 어떻게 공격한거고 … 어느쪽 군사들이 어떻게 와해됐는지" · "황산벌전투 옥포해전 칠천량전투 … 그지역들을따서")
 *
 *  - 합마다 누가 몇이 무엇을 해서 어떻게 됐나 — 사람 수가 들고, 조사가 맞는다 (받침 있는 말 · 없는 말 · 숫자)
 *  - 사로잡기는 날랜 무리와 호위의 사람 수가 이야기에 든다
 *  - 끝에 왜 무너졌나 한 줄
 *  - 이름은 땅에서 딴다: ○○ 바다 · ○○나루 · ○○재 · ○○성 · ○○벌 싸움
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { fightRounds, type Side } from '../../src/realm/tactics.ts'
import { battleName, endStory, roundStory, type StoryCtx } from '../../src/realm/data/prose.ts'
import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import type { Pending, Realm, RoundOrder } from '../../src/realm/types.ts'

const side = (mix: Side['mix'], player: boolean, over: Partial<Side> = {}): Side => {
  let F = 0
  for (const v of Object.values(mix)) F += v ?? 0
  return { F, mix, morale: 1, hero: { id: player ? 'me' : 'foe', mu: 6, ryak: 5, coward: false }, hungry: false, specials: [], water: false, player, seen: true, ...over }
}
const MIXES: Array<Side['mix']> = [
  { spear: 120, bow: 40, shield: 20, horse: 20 }, { spear: 40, bow: 120, shield: 40 }, { spear: 40, bow: 20, shield: 140 }, { spear: 60, bow: 40, shield: 20, horse: 80 },
]
/** 합마다 바꿔 가며 — 여러 일이 다 나오게 */
const POL: Array<(p: Pending, i: number) => RoundOrder> = [
  (p) => ({ front: p.hint === 'charge' ? 'hold' : 'charge', bows: 'volley', horse: 'flank', lead: p.capture >= 0.3 ? 'capture' : 'drum' }),
  (_p, i) => ({ front: (['open', 'hold', 'charge'] as const)[i % 3]!, bows: i % 2 === 0 ? 'counter' : 'fire', horse: 'pursue', lead: i === 1 ? 'duel' : 'drum' }),
  (_p, i) => ({ front: 'hold', bows: 'height', horse: 'guard', lead: i >= 2 ? 'retreat' : 'drum' }),
  (p) => ({ front: p.foeWaver ? 'charge' : 'ford', bows: 'volley', horse: 'punch', lead: 'capture' }),
]

/** 받침 있는 이름 · 없는 이름 — 조사가 갈린다 */
const CTX = (ma: Side['mix'], md: Side['mix']): StoryCtx => {
  const n = (m: Side['mix']): number => Object.values(m).reduce((s, v) => s + (v ?? 0), 0)
  return { side: ['우리', '적'], hero: ['주몽', '온조'], mix: [ma, md], m0: [1, 1], men0: [n(ma), n(md)] }
}

/** 틀린 조사 — 받침 있는 말 뒤 가·를·는·와, 없는 말 뒤 이·을·은·과 */
const WRONG = [
  /명(가|를|는|와|로)[\s.,!—]/, /우리(이|을|은|과)[\s.,!—]/, /적(가|를|는|와)[\s.,!—]/, /주몽(가|를|는|와)[\s.,!—]/, /온조(이|을|은|과)[\s.,!—]/,
]

describe('싸움 이야기 (prose.roundStory · endStory)', () => {
  it('합마다 누가 몇이 무엇을 했고 어떻게 됐나 — 사람 수가 들고 조사가 맞는다', () => {
    const seen = new Set<string>()
    let lines = 0
    for (let s = 0; s < 64; s++) {
      const ma = MIXES[s % 4]!
      const md = MIXES[(s >> 2) % 4]!
      const me = side(ma, true, { specials: ['fire'], terrain: { ford: true, height: true } })
      const foe = side(md, false)
      const pol = POL[s % POL.length]!
      const cmds: RoundOrder[] = []
      let t = fightRounds(me, foe, `st${s}`, s, 0, { cmds, open: true })
      for (let g = 0; g < 8 && t.pending !== undefined; g++) {
        cmds.push(pol(t.pending, g))
        t = fightRounds(me, foe, `st${s}`, s, 0, { cmds, open: true })
      }
      const c = CTX(ma, md)
      t.rounds.forEach((rd, i) => {
        const story = roundStory(rd, t.rounds[i - 1], c)
        assert.ok(story.length >= 1, `판 ${s} 합 ${i} — 이야기가 있다`)
        for (const x of story) {
          lines++
          assert.ok(!/undefined|NaN|\$\{/.test(x), x)
          for (const w of WRONG) assert.ok(!w.test(x), `조사 — ${x}`)
          assert.ok(!/^적 .*적 궁수를 겨눠/.test(x), `누구 눈인가 — ${x}`)
        }
        assert.ok(story.some((x) => /\d+명/.test(x)) || rd.ev === 'duel-win' || rd.ev === 'duel-lose', `사람 수가 든다 — ${story.join(' ')}`)
        for (const a of rd.acts ?? []) {
          seen.add(`${a.c}:${a.res}`)
          // 사로잡기 — 날랜 무리와 호위의 사람 수
          if (a.c === 'capture' && a.s === 'a') {
            const line = story.find((x) => x.includes('날랜 무리'))
            assert.ok(line !== undefined && line.includes(`${a.n}명`) && line.includes(`${(a.guard ?? 0).toLocaleString('ko-KR')}명`), `사로잡기 — ${story.join(' ')}`)
            assert.ok(a.res === 'ok' ? line.includes('사로잡았다') : line.includes('막혔다'))
          }
        }
      })
      const end = endStory({ outcome: t.outcome, endWhy: t.endWhy, rounds: t.rounds }, c)
      assert.ok(end.length > 8 && !/undefined|NaN/.test(end), end)
      for (const w of WRONG) assert.ok(!w.test(end), `조사 — ${end}`)
    }
    assert.ok(lines > 200)
    for (const k of ['charge:won', 'hold:won', 'volley:hit', 'flank:hit', 'capture:fail', 'retreat:ok']) assert.ok(seen.has(k), `${k} 가 한 번은 나온다`)
  })

  it('끝 줄 — 사로잡힘 · 사람이 줄어서 · 기세가 꺾여서 · 물러나서 · 해가 저물어', () => {
    const c = CTX(MIXES[0]!, MIXES[1]!)
    const rounds = [{ a: 'charge', d: 'hold', beat: 'd', push: 0.4, na: 0.5, nd: 0.9, ma: 0.6, md: 1, ga: { front: 40, bows: 30, horse: 15 } }] as const
    assert.match(endStory({ outcome: 'routed', endWhy: 'captured', rounds }, c), /^주몽이 사로잡히자/)
    assert.match(endStory({ outcome: 'lose', endWhy: 'men', rounds }, c), /우리 군사가 200명에서 100명으로 줄자/)
    assert.match(endStory({ outcome: 'lose', endWhy: 'morale', rounds }, c), /우리 창병·방패병이 꺾이자 기세가 무너져/)
    assert.match(endStory({ outcome: 'draw', endWhy: 'draw', rounds }, c), /날이 저물자/)
  })
})

describe('싸움 이름 (prose.battleName)', () => {
  const fake = (name: string, kind: string, tags: string[] = []): Realm =>
    ({ nodes: { x: { id: 'x', name, kind, tags } }, edges: { e: { id: 'e', a: 'x', b: 'x', kind: 'field', tags: [] } } }) as unknown as Realm
  it('땅에서 딴다 — 바다 · 나루 · 재 · 성 · 벌', () => {
    assert.equal(battleName(fake('감포 항구', 'port'), { node: 'x', via: 'sea' }), '감포 바다 싸움')
    assert.equal(battleName(fake('삼랑 나루 마을', 'village'), { node: 'x', via: 'ford' }), '삼랑나루 싸움')
    assert.equal(battleName(fake('봉황 마을', 'village'), { node: 'x', via: 'reeds' }), '봉황나루 싸움')
    assert.equal(battleName(fake('팔공 산마을', 'village'), { node: 'x', via: 'pass' }), '팔공재 싸움')
    assert.equal(battleName(fake('토함 산성', 'fort'), { node: 'x', via: 'field' }), '토함성 싸움')
    assert.equal(battleName(fake('사로 도읍', 'capital'), { node: 'x', via: 'forest' }), '사로성 싸움')
    assert.equal(battleName(fake('다호리 마을', 'village'), { node: 'x', via: 'field' }), '다호리벌 싸움')
    assert.equal(battleName(fake('너른벌', 'wild'), { node: 'x', via: 'field' }), '너른벌 싸움', '같은 꼬리를 또 붙이지 않는다')
    // 들판 싸움은 길의 종류로
    assert.equal(battleName(fake('다호리 마을', 'village'), { node: 'x', field: true, edge: 'e' }), '다호리벌 싸움')
  })
  it('판의 모든 고을에 이름이 선다 — 빈 이름·undefined 가 없다', () => {
    const r = byeonhanMini(1)
    for (const n of Object.values(r.nodes)) {
      for (const via of ['field', 'pass', 'forest', 'reeds', 'ford', 'sea', 'mudflat'] as const) {
        const nm = battleName(r, { node: n.id, via })
        assert.match(nm, /^\S+.* 싸움$/, nm)
        assert.ok(!nm.includes('undefined'))
      }
    }
  })
})
