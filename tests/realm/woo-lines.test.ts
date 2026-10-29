/**
 * 옥중 담판 대사 (src/ui/realm/woo-lines.ts · 형 10-29: "옥중담판 대사가 이어지지가 않는데... 루트마다 분기가 나뉘어야 하는 거 아냐?")
 *
 *  - 결 × 거리 × 반응마다 한 줄이 있다 · 같은 결 같은 반응이라도 거리가 다르면 다른 말이다
 *  - 같은 거리라도 첫 마디와 둘째 마디의 말이 다르다 (앞 마디를 받는다)
 *  - 한 판 안에서 같은 줄이 두 번 나오지 않는다 (거리 셋 × 반응 둘의 모든 길)
 *  - 어린애 끝(-요 · -죠)이 어느 문장 끝에도 없다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { byeonhanMini } from '../../src/realm/data/regions/byeonhan-mini.ts'
import type { Realm, WooApproach, WooReact } from '../../src/realm/types.ts'
import { WOO_APPROACHES } from '../../src/realm/woo.ts'
import type { BaseKind } from '../../src/ui/realm/voice.ts'
import {
  BODY, ECHO, HOOK, REACT, REPEAT, WOO_KIND_PIN, wooKneelLine, wooLordLine, wooNotYetLine, wooOpenLine, wooPitchLine, wooReactLine, wooWonLine, type Facts, type Reg,
} from '../../src/ui/realm/woo-lines.ts'

const KINDS: readonly BaseKind[] = ['m-young', 'm-gruff', 'm-sage', 'm-elder', 'm-charm', 'w-bright', 'w-cool', 'w-sly', 'w-shaman']
const APPS: readonly WooApproach[] = [...WOO_APPROACHES, 'bond']
const REACTS: readonly WooReact[] = ['big', 'sway', 'hold', 'rage']
const REGS: readonly Reg[] = ['hao', 'hage', 'hae']
const CHILD = /(요|에요|예요|해요|게요|네요|죠)[.!?…]?$/

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
function jail(opts: { sit?: 'fallen' | 'alone' | 'alive'; kin?: boolean } = {}): { r: Realm; by: string; x: string } {
  const r = structuredClone(byeonhanMini(1))
  const x = r.heroes['guya-2']!
  x.status = 'captive'
  x.captor = 'us'
  x.at = null
  for (const a of Object.values(r.armies)) if (a.hero === 'guya-2') a.hero = null
  x.caughtAt = r.season - (opts.sit === 'alone' ? 6 : 2)
  if (opts.sit === 'fallen') for (const n of Object.values(r.nodes)) if (n.owner === x.faction) n.owner = 'us'
  if (opts.kin === true) {
    const k = Object.values(r.heroes).find((h) => h.faction === 'us' && h.id !== 'us-ruler' && h.status === 'free')!
    x.spouse = k.id
    k.spouse = x.id
  }
  return { r, by: 'us-ruler', x: 'guya-2' }
}

/** 한 판을 화면에 뜨는 차례대로 */
function convo(r: Realm, byId: string, xId: string, talk: readonly WooApproach[], reacts: readonly WooReact[]): string[] {
  const by = r.heroes[byId]!
  const x = r.heroes[xId]!
  const out = [wooLordLine(by), wooOpenLine(r, x, byId)]
  for (let i = 0; i < talk.length; i++) {
    out.push(wooPitchLine(r, by, x, talk, i, reacts))
    out.push(wooReactLine(r, by, x, talk, i, reacts, i < talk.length - 1))
  }
  out.push(wooKneelLine(x), wooNotYetLine(x), wooWonLine(r, by, x, talk, reacts))
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
  })

  it('걸이와 받는 말이 거리 × 먹혔나 × 마디 × 말씨마다 있다', () => {
    const f = factSets()[0]!
    for (const a of APPS) for (const ok of ['ok', 'no'] as const) for (const st of [0, 1] as const) for (const reg of REGS) {
      assert.ok(HOOK[`${a}:${ok}`][st]![reg](f).length > 4)
      assert.ok(ECHO[`${a}:${ok}`][st]![reg](f).length > 4)
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
      // 다른 거리 뒤에 오면 그 앞 마디를 받는다 (받는 말이 붙는다)
      const p = wooPitchLine(r, r.heroes[by]!, r.heroes[x]!, ['soothe', 'cause'], 1, ['sway'])
      const q = wooPitchLine(r, r.heroes[by]!, r.heroes[x]!, ['gain', 'cause'], 1, ['sway'])
      assert.notEqual(p, q, `${bk}: 앞 마디가 다르면 받는 말도 다르다`)
    }
    WOO_KIND_PIN.clear()
  })

  it('한 판 안에서 같은 줄이 두 번 나오지 않고, 어린애 끝이 없다 (모든 길 · 결 아홉)', () => {
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
              assert.ok(!/undefined|NaN|\$\{/.test(l), `빈 사실: ${l}`)
            }
            checked++
          }
        }
      }
    }
    WOO_KIND_PIN.clear()
    assert.ok(checked > 1000)
  })

  it('모든 표의 줄에 어린애 끝이 없다', () => {
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
      }
      for (const a of APPS) for (const ok of ['ok', 'no'] as const) for (const st of [0, 1] as const) for (const reg of REGS) all.push(HOOK[`${a}:${ok}`][st]![reg](f), ECHO[`${a}:${ok}`][st]![reg](f))
      for (const l of all) assert.equal(childish(l), null, `어린애 끝: ${l}`)
    }
  })

  it('넘어온 한 줄은 판을 가른 말을 인용한다', () => {
    const { r, by, x } = jail({ sit: 'alone' })
    WOO_KIND_PIN.set(by, 'm-young')
    const line = wooWonLine(r, r.heroes[by]!, r.heroes[x]!, ['soothe', 'gain', 'fear'], ['hold', 'big', 'hold'])
    // 먹힌 것은 둘째 마디(이익) · 받는 말(「…물었소?」)은 빼고 본말의 알맹이 문장
    assert.match(line, /^「그대 식구들 겨울 걱정이나 덜자는 것이오」 .+의 이 한마디에 .+ 무릎을 꿇었다$/)
    WOO_KIND_PIN.clear()
  })
})
