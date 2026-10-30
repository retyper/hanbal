/**
 * 옥중 담판 대사 (src/ui/realm/woo-lines.ts · 형 10-29: "옥중담판 대사가 이어지지가 않는데... 루트마다 분기가 나뉘어야 하는 거 아냐?")
 * (형 10-30: 되묻기 「~ 물었소?」 금지 · 군주는 군주 말 · 사람마다 제 사연 · 서로 다른 두 사람 짝의 대사가 어느 루트에서도 겹치지 않게)
 *
 *  - 결 × 거리 × 반응마다 한 줄이 있다 · 같은 결 같은 반응이라도 거리가 다르면 다른 말이다
 *  - 한 판 안에서 같은 줄이 두 번 나오지 않는다 (거리 셋 × 반응의 모든 길)
 *  - 어린애 끝(-요 · -죠)이 어느 문장 끝에도 없다 · 긴 줄표가 없다
 *  - 우리 장수가 앞말을 되받지 않는다 (「~ 했소?」로 열거나 갇힌 이의 말을 옮겨 오지 않는다)
 *  - 사람마다 묶음: 칸이 다 찼다 · 모든 줄이 서로 다르다 · 자리표가 다 채워진다
 *  - 고개를 저은 뒤에 넘어오면 그 거절을 짚는 줄
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import { REGION_IDS, regionNations, startRegion } from '../../src/realm/data/regions/index.ts'
import { RULER_HELD, WOO_TALK, type WooBundle, type WooHeld, type WooSpeak } from '../../src/realm/data/woo-talk/index.ts'
import type { Realm, WooApproach, WooReact } from '../../src/realm/types.ts'
import { WOO_APPROACHES } from '../../src/realm/woo.ts'
import type { BaseKind } from '../../src/ui/realm/voice.ts'
import {
  BODY, factsOf, fillTalk, heldOf, KNEEL, KNEEL_AFTER_NO, REACT, REPEAT, WOO_KIND_PIN, wooKneelLine, wooLordLine, wooNotYetLine, wooOpenLine, wooPitchLine, wooReactLine, wooWonLine, talkVars, type Facts,
} from '../../src/ui/realm/woo-lines.ts'

const KINDS: readonly BaseKind[] = ['m-young', 'm-gruff', 'm-sage', 'm-elder', 'm-charm', 'w-bright', 'w-cool', 'w-sly', 'w-shaman']
const APPS: readonly WooApproach[] = [...WOO_APPROACHES, 'bond']
const REACTS: readonly WooReact[] = ['big', 'sway', 'hold', 'rage']
const CHILD = /(요|에요|예요|해요|게요|네요|죠)[.!?…]?$/
/** 되묻기 — 앞말을 되받는 물음으로 연다 */
const ECHO = /^[^.!?…]*(물었소|했소|하였소|물었나|했나|했느냐|물었느냐|느냐 물었|라 했소)\?/

/** 문장마다 끝을 본다 (지문 괄호 · 따옴표는 걷고) */
function childish(line: string): string | null {
  for (const raw of line.split(/(?<=[.!?…])\s+/)) {
    const s = raw.replace(/\([^)]*\)/g, '').replace(/[」"'\s]+$/, '').trim()
    if (s !== '' && CHILD.test(s)) return s
  }
  return CHILD.test(line.trim()) ? line : null
}

/** 사실 묶음 — 무너졌다 · 오래 아무도 안 왔다 · 아직 버틴다 × 피붙이 · 한 핏줄 · 고향 */
function factSets(): Facts[] {
  const out: Facts[] = []
  for (const sit of ['fallen', 'alone', 'alive'] as const) {
    for (const t of ['kin', 'jailed', 'blood', 'home'] as const) {
      for (const blade of ['칼', '도끼', '비녀', '화살', '신칼']) {
        out.push({
          nation: sit === 'fallen' ? '가락국' : '비류', sit, jail: sit === 'alone' ? '여섯 계절' : '두 계절',
          kin: t === 'kin' || t === 'jailed' ? { name: '솔미', rel: '딸', jailed: t === 'jailed' } : null,
          blood: t === 'blood', home: t === 'home' ? '골포국' : null, grain: '마흔 섬', ours: '갯마을', blade,
          tie: t === 'kin' || t === 'jailed' ? '솔미' : t === 'blood' ? '한 핏줄' : '골포국',
        })
      }
    }
  }
  return out
}

/** 구야의 둘째 장수를 우리 옥에 — 우리 군주가 달랜다 */
function jail(opts: { sit?: 'fallen' | 'alone' | 'alive'; kin?: boolean; x?: string } = {}): { r: Realm; by: string; x: string } {
  const r = structuredClone(byeonhanMini(1))
  const xId = opts.x ?? 'guya-2'
  const x = r.heroes[xId]!
  x.status = 'captive'
  x.captor = 'us'
  x.at = null
  for (const a of Object.values(r.armies)) if (a.hero === xId) a.hero = null
  x.caughtAt = r.season - (opts.sit === 'alone' ? 6 : 2)
  if (opts.sit === 'fallen') for (const n of Object.values(r.nodes)) if (n.owner === x.faction) n.owner = 'us'
  if (opts.kin === true) {
    const k = Object.values(r.heroes).find((h) => h.faction === 'us' && h.id !== 'us-ruler' && h.status === 'free')!
    x.spouse = k.id
    k.spouse = x.id
  }
  return { r, by: 'us-ruler', x: xId }
}

/** 한 판을 화면에 뜨는 차례대로 — [군주에게, 첫마디, (설득, 반응)×n, 넘어옴, 아직은, 넘어온 한 줄] */
function convo(r: Realm, byId: string, xId: string, talk: readonly WooApproach[], reacts: readonly WooReact[]): string[] {
  const by = r.heroes[byId]!
  const x = r.heroes[xId]!
  const out = [wooLordLine(by, r), wooOpenLine(r, x, byId)]
  for (let i = 0; i < talk.length; i++) {
    out.push(wooPitchLine(r, by, x, talk, i, reacts))
    out.push(wooReactLine(r, by, x, talk, i, reacts))
  }
  out.push(wooKneelLine(r, by, x, talk, reacts), wooNotYetLine(r, x), wooWonLine(r, by, x, talk, reacts))
  return out
}

/** 거리 셋의 모든 길 (인연은 판에 한 번) */
function routes(): WooApproach[][] {
  const out: WooApproach[][] = []
  for (const a of APPS) for (const b of APPS) for (const c of APPS) {
    const t = [a, b, c]
    if (t.filter((y) => y === 'bond').length > 1) continue
    out.push(t)
  }
  return out
}
const OUTS: ReadonlyArray<readonly WooReact[]> = (() => {
  const o: WooReact[][] = []
  for (const a of ['big', 'sway', 'hold'] as const) for (const b of ['big', 'sway', 'hold'] as const) for (const c of ['sway', 'hold', 'rage'] as const) o.push([a, b, c])
  return o
})()

/** 우리 장수가 앞말을 옮겨 왔나 — 사실 낱말을 걷고 여덟 글자(빈칸 빼고)가 겹치면 옮긴 것 */
function quotes(prev: string, pitch: string, facts: readonly string[]): string | null {
  const strip = (s: string): string => facts.reduce((a, w) => (w.length >= 2 ? a.split(w).join('') : a), s.replace(/\([^)]*\)/g, '')).replace(/[\s.,!?…「」]/g, '')
  const p = strip(prev)
  const q = strip(pitch)
  for (let i = 0; i + 8 <= p.length; i++) { const w = p.slice(i, i + 8); if (q.includes(w)) return w }
  return null
}

// ───────────────────────── 사람마다의 묶음 ─────────────────────────

const HELD_KEYS = ['open', 'kin', 'grudge', 'hit', 'miss', 'againHit', 'againMiss', 'rage', 'yield', 'notYet'] as const
/** 묶음 한 칸의 줄을 모두 (칸 이름과 함께) */
function heldLines(h: WooHeld): Array<[string, string]> {
  return [
    ...(['pride', 'long', 'hurt', 'greed', 'fear'] as const).map((k): [string, string] => [`open.${k}`, h.open[k]]),
    ['kin', h.kin], ['grudge', h.grudge],
    ...APPS.map((a): [string, string] => [`hit.${a}`, h.hit[a]]),
    ...APPS.map((a): [string, string] => [`miss.${a}`, h.miss[a]]),
    ['againHit.0', h.againHit[0]], ['againHit.1', h.againHit[1]], ['againMiss.0', h.againMiss[0]], ['againMiss.1', h.againMiss[1]],
    ['rage.insult', h.rage.insult], ['rage.slight', h.rage.slight], ['yield.agreed', h.yield.agreed], ['yield.refused', h.yield.refused], ['notYet', h.notYet],
  ]
}
function speakLines(s: WooSpeak): Array<[string, string]> {
  return [
    ['lord', s.lord],
    ...([0, 1, 2] as const).flatMap((i): Array<[string, string]> => [[`soothe.${i}`, s.soothe[i]], [`gain.${i}`, s.gain[i]], [`fear.${i}`, s.fear[i]]]),
    ...(['fallen', 'alone', 'alive', 'again', 'third'] as const).map((k): [string, string] => [`cause.${k}`, s.cause[k]]),
    ...(['kin', 'blood', 'home'] as const).map((k): [string, string] => [`bond.${k}`, s.bond[k]]),
  ]
}
const bundleLines = (b: WooBundle): Array<[string, string]> => [...heldLines(b.held), ...speakLines(b.speak)]
const PLACE = new Set(['nation', 'ours', 'captor', 'jail', 'grain', 'kin', 'rel', 'home', 'tie', 'blade'])
/** 자리표 바로 뒤에 올 수 있는 것 — 끝 · 바뀌는 조사 + 끝 · 안 바뀌는 조사 */
const AFTER = /^(?:$|[\s.,!?…」)·]|(?:으로|은|는|이|가|을|를|과|와|로)(?:$|[\s.,!?…」)])|의|에서|에게|에|도|만|까지|부터|처럼|보다|뿐|께)/
const VARS = { nation: '비류', ours: '갯마을', captor: '갯마을', jail: '세 계절', grain: '마흔 섬', kin: '솔미', rel: '딸', home: '골포국', tie: '솔미', blade: '칼' }

/** 사람마다 묶음이 있는 장수 둘이 다 있는 판 하나 (변한 판 먼저) */
function boardOf(id: string): Realm | null {
  for (const reg of ['byeonhan-mini', ...REGION_IDS] as const) {
    const r = startRegion(reg, 1, regionNations(reg)[0]!)
    if (r.heroes[id] !== undefined) return r
  }
  return null
}

describe('옥중 담판 대사', () => {
  it('결 × 거리 × 반응마다 한 줄이 있고, 거리가 다르면 반응도 다르다', () => {
    let n = 0
    for (const f of factSets()) {
      for (const k of KINDS) {
        for (const re of REACTS) {
          const lines = APPS.map((a) => REACT[k][a][re](f))
          for (const l of lines) { assert.ok(l.length > 4, `${k} ${re} 빈 줄`); n++ }
          assert.equal(new Set(lines).size, APPS.length, `${k} · ${re}: 거리마다 다른 말이어야 한다\n${lines.join('\n')}`)
        }
      }
    }
    assert.ok(n >= 9 * 5 * 4)
  })

  it('본말은 결 × 거리 × 갈래마다 있고, 첫 마디와 이어 하는 말이 다르다', () => {
    const f = factSets()[0]!
    for (const k of KINDS) {
      for (const a of APPS) {
        const B = BODY[k]
        const modes = a === 'bond' ? (['open', 'press', 'recover'] as const) : (['open', 'press', 'recover', 'again'] as const)
        const lines = modes.map((m) => (a === 'bond' ? B.bond[m as 'open'](f, '「사실」') : B[a][m](f, '「사실」')))
        assert.equal(new Set(lines).size, modes.length, `${k} ${a}: 갈래마다 다른 말\n${lines.join('\n')}`)
      }
    }
    for (const k of KINDS) for (const c of ['ok', 'hold'] as const) for (const v of [0, 1] as const) assert.ok(REPEAT[k][c][v]!('그 다정한 말').length > 4)
  })

  it('같은 거리라도 첫 마디와 둘째 마디의 말이 다르다', () => {
    const { r, by, x } = jail({ kin: true })
    for (const bk of KINDS) {
      WOO_KIND_PIN.set(by, bk)
      for (const a of WOO_APPROACHES) {
        for (const re of ['sway', 'hold'] as const) {
          const t = [a, a]
          const p1 = wooPitchLine(r, r.heroes[by]!, r.heroes[x]!, t, 0, [re])
          const p2 = wooPitchLine(r, r.heroes[by]!, r.heroes[x]!, t, 1, [re])
          assert.notEqual(p1, p2, `${bk} ${a}`)
        }
      }
    }
    WOO_KIND_PIN.clear()
  })

  it('한 판 안에서 같은 줄이 두 번 나오지 않고, 어린애 끝 · 되묻기가 없다 (모든 길 · 결 아홉)', () => {
    let checked = 0
    for (const opts of [{ sit: 'alive' as const }, { sit: 'alone' as const, kin: true }, { sit: 'fallen' as const, kin: true }]) {
      const { r, by, x } = jail(opts)
      for (let i = 0; i < KINDS.length; i++) {
        WOO_KIND_PIN.set(by, KINDS[i]!)
        WOO_KIND_PIN.set(x, KINDS[(i * 4 + 1) % KINDS.length]!)
        for (const t of routes()) {
          for (const o of OUTS) {
            const lines = convo(r, by, x, t, o)
            const talkLines = lines.slice(2, 2 + t.length * 2)
            assert.equal(new Set(talkLines).size, talkLines.length, `되풀이: ${KINDS[i]} ${t.join(',')} ${o.join(',')}\n${talkLines.join('\n')}`)
            for (const l of lines) {
              const bad = childish(l)
              assert.equal(bad, null, `어린애 끝: ${bad}`)
              assert.ok(!l.includes('—'), `긴 줄표: ${l}`)
              assert.ok(!/undefined|NaN|\$\{|\{\w+\}/.test(l), `빈 사실: ${l}`)
            }
            for (let j = 1; j < t.length; j++) assert.doesNotMatch(talkLines[j * 2]!, ECHO, `되묻기: ${talkLines[j * 2]}`)
            checked++
          }
        }
      }
    }
    WOO_KIND_PIN.clear()
    assert.ok(checked > 1000)
  })

  it('모든 결 틀의 줄에 어린애 끝이 없다', () => {
    for (const f of factSets()) {
      const all: string[] = []
      for (const k of KINDS) {
        for (const a of APPS) {
          for (const re of REACTS) all.push(REACT[k][a][re](f))
          const B = BODY[k]
          if (a === 'bond') for (const m of ['open', 'press', 'recover'] as const) all.push(B.bond[m](f, ''))
          else for (const m of ['open', 'press', 'recover', 'again'] as const) all.push(B[a][m](f, ''))
        }
        for (const c of ['ok', 'hold'] as const) for (const v of [0, 1] as const) all.push(REPEAT[k][c][v]!('그 으름장'), REPEAT[k][c][v]!('곡식 이야기'))
        all.push(KNEEL[k], KNEEL_AFTER_NO[k])
      }
      for (const l of all) assert.equal(childish(l), null, `어린애 끝: ${l}`)
    }
  })

  it('넘어온 한 줄은 판을 가른 말을 인용한다', () => {
    const { r, by, x } = jail({ sit: 'alone' })
    WOO_KIND_PIN.set(by, 'm-young')
    WOO_KIND_PIN.set(x, 'm-gruff')
    const line = wooWonLine(r, r.heroes[by]!, r.heroes[x]!, ['soothe', 'gain', 'fear'], ['hold', 'big', 'hold'])
    // 먹힌 것은 둘째 마디(이익) · 본말의 알맹이 문장
    assert.match(line, /^「그대 식구들 겨울 걱정이나 덜자는 것이오」 .+의 이 한마디에 .+ 무릎을 꿇었다$/)
    WOO_KIND_PIN.clear()
  })

  it('고개를 저은 뒤에 넘어오면 그 거절을 짚는다 (결 틀 · 군주 · 사람마다)', () => {
    const { r, by, x } = jail({ sit: 'fallen' })
    const B = r.heroes[by]!
    for (const k of KINDS) {
      WOO_KIND_PIN.set(x, k)
      const X = r.heroes[x]!
      assert.equal(wooKneelLine(r, B, X, ['soothe', 'cause'], ['sway', 'big']), KNEEL[k])
      assert.equal(wooKneelLine(r, B, X, ['soothe', 'cause'], ['sway', 'hold']), KNEEL_AFTER_NO[k])
      assert.notEqual(KNEEL[k], KNEEL_AFTER_NO[k])
    }
    WOO_KIND_PIN.clear()
    // 군주였던 이 — 사람마다 묶음이 없으면 군주 묶음
    const g = jail({ sit: 'fallen', x: 'guya-ruler' })
    const held = heldOf(g.r, g.r.heroes['guya-ruler']!)!
    assert.ok(held !== null)
    if (WOO_TALK['guya-ruler'] === undefined) assert.equal(held, RULER_HELD)
    const G = g.r.heroes['guya-ruler']!
    assert.equal(wooKneelLine(g.r, g.r.heroes[g.by]!, G, ['cause', 'gain'], ['hold', 'hold']), held.yield.refused)
    assert.equal(wooKneelLine(g.r, g.r.heroes[g.by]!, G, ['cause', 'gain'], ['hold', 'big']), held.yield.agreed)
    // 사람마다 묶음이 있는 모든 사람
    for (const [id, b] of Object.entries(WOO_TALK)) {
      const rr = boardOf(id)
      if (rr === null) continue
      const X = rr.heroes[id]!
      const other = Object.values(rr.heroes).find((h) => h.faction !== X.faction)!
      X.status = 'captive'; X.captor = other.faction
      assert.equal(wooKneelLine(rr, other, X, ['soothe'], ['hold']), b.held.yield.refused, id)
      assert.equal(wooKneelLine(rr, other, X, ['soothe'], ['big']), b.held.yield.agreed, id)
    }
  })

  it('군주였던 이는 군주 말을 한다 (첫마디 · 반응 · 넘어옴이 장수 결 틀이 아니다)', () => {
    const g = jail({ sit: 'fallen', x: 'guya-ruler' })
    const X = g.r.heroes['guya-ruler']!
    const B = g.r.heroes[g.by]!
    const held = heldOf(g.r, X)!
    const v = talkVars(factsOf(g.r, X, B))
    const mine = new Set([...Object.values(held.open), held.kin, held.grudge].map((l) => fillTalk(l, v)))
    assert.ok(mine.has(wooOpenLine(g.r, X, g.by)), wooOpenLine(g.r, X, g.by))
    for (const a of APPS) assert.equal(wooReactLine(g.r, B, X, [a], 0, ['hold']), fillTalk(held.miss[a], talkVars(factsOf(g.r, X, B, a === 'gain' ? 1 : 0))))
  })

  it('사람마다 묶음 · 군주 묶음: 칸이 다 찼고, 줄이 서로 다르고, 해요체 · 되묻기 · 긴 줄표가 없고, 자리표가 채워진다', () => {
    const seen = new Map<string, string>()
    const check = (who: string, slot: string, line: string): void => {
      assert.equal(typeof line, 'string', `${who} ${slot} 빈 칸`)
      assert.ok(line.trim().length >= 6, `${who} ${slot} 너무 짧다: ${line}`)
      assert.ok(!line.includes('—') && !line.includes('–'), `${who} ${slot} 긴 줄표: ${line}`)
      assert.doesNotMatch(line, ECHO, `${who} ${slot} 되묻기: ${line}`)
      for (const m of line.matchAll(/\{(\w+)\}/g)) {
        assert.ok(PLACE.has(m[1]!), `${who} ${slot} 모르는 자리표 {${m[1]}}: ${line}`)
        const after = line.slice(m.index! + m[0].length)
        assert.match(after, AFTER, `${who} ${slot} 자리표 뒤에 받침 따라 바뀌는 말: ${line}`)
      }
      const filled = fillTalk(line, VARS)
      assert.ok(!/\{\w*\}/.test(filled), `${who} ${slot} 자리표가 남았다: ${filled}`)
      assert.equal(childish(filled), null, `${who} ${slot} 해요체: ${filled}`)
      const prev = seen.get(line)
      assert.equal(prev, undefined, `같은 줄이 둘: ${who} ${slot} = ${prev}\n${line}`)
      seen.set(line, `${who} ${slot}`)
    }
    for (const [slot, line] of heldLines(RULER_HELD)) check('군주 묶음', slot, line)
    for (const [id, b] of Object.entries(WOO_TALK)) {
      for (const k of HELD_KEYS) assert.ok(b.held[k] !== undefined, `${id} held.${k} 없음`)
      for (const [slot, line] of bundleLines(b)) check(id, slot, line)
      for (const [slot, line] of speakLines(b.speak)) {
        if (slot.startsWith('gain.')) assert.ok(line.includes('{grain}'), `${id} ${slot}: 이익엔 {grain}: ${line}`)
      }
      assert.ok(b.held.kin.includes('{kin}'), `${id} kin 에 {kin}: ${b.held.kin}`)
      assert.ok(b.speak.bond.kin.includes('{kin}'), `${id} bond.kin 에 {kin}: ${b.speak.bond.kin}`)
    }
  })

  it('사람마다 묶음이 있는 두 사람의 담판: 되풀이 · 되묻기 · 앞말 옮겨 오기가 없다', () => {
    const ids = Object.keys(WOO_TALK)
    for (let n = 0; n < ids.length; n++) {
      const xId = ids[n]!
      const r0 = boardOf(xId)
      if (r0 === null) continue
      // 회유하는 이: 같은 판의 다른 나라 사람 가운데 묶음이 있는 이 (없으면 아무나)
      const others = Object.values(r0.heroes).filter((h) => h.faction !== r0.heroes[xId]!.faction)
      const byH = others.find((h) => WOO_TALK[h.id] !== undefined && h.id !== xId) ?? others[0]!
      for (const sit of ['fallen', 'alive'] as const) {
        const r = structuredClone(r0)
        const x = r.heroes[xId]!
        x.status = 'captive'; x.captor = byH.faction; x.at = null
        x.caughtAt = r.season - 2
        if (sit === 'fallen') for (const nd of Object.values(r.nodes)) if (nd.owner === x.faction) nd.owner = byH.faction
        const facts = [r.factions[x.faction]?.name ?? '', r.factions[byH.faction]?.name ?? '', '섬', '계절', x.name, byH.name]
        for (const t of routes().filter((_, i) => i % 3 === n % 3)) {
          for (const o of OUTS.filter((_, i) => i % 4 === n % 4)) {
            const lines = convo(r, byH.id, xId, t, o)
            const talkLines = lines.slice(2, 2 + t.length * 2)
            assert.equal(new Set(talkLines).size, talkLines.length, `되풀이: ${byH.id}→${xId} ${t.join(',')} ${o.join(',')}\n${talkLines.join('\n')}`)
            for (const l of lines) {
              assert.equal(childish(l), null, `어린애 끝: ${l}`)
              assert.ok(!/undefined|\{\w+\}/.test(l), `빈 사실: ${l}`)
            }
            for (let j = 1; j < t.length; j++) {
              const pitch = talkLines[j * 2]!
              assert.doesNotMatch(pitch, ECHO, `되묻기: ${pitch}`)
              const q = quotes(talkLines[j * 2 - 1]!, pitch, facts)
              assert.equal(q, null, `앞말을 옮겨 왔다 「${q}」\n${talkLines[j * 2 - 1]}\n${pitch}`)
            }
          }
        }
      }
    }
  })
})
