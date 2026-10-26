/**
 * 깃발 짐작의 보정 시험 (docs/realm/ODDS.md 「싸움 합 깃발」 · BUILD §3-3 · 형 10-26: "어느정도가 +- 범위이고 어느정도가 확률인지").
 * 화면이 보인 폭에 실제 그 합의 결과가 드는가 — 여러 판 · 여러 합 · 고른 깃발 그대로.
 *
 * 폭은 가운데 몫의 띠다 (tacLookBand 0.05 → 굴린 판의 위아래 다섯 몫씩 떼고 열에 아홉). 그러니 '늘'이 아니라 '열에 아홉 남짓' 든다.
 *  - 엔진이 셈한 폭(Look) — 값마다 85% 넘게 든다
 *  - 화면에 보인 폭(lookNums — 바깥으로 둥글린 것) — 그보다 덜 들지 않는다
 *  - 사로잡기 — 보인 확률의 폭 안에서 실제로 잡힌다 (많은 판의 비율)
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { roll } from '../../src/core/rng.ts'
import { fightRounds, lookRound, type Side } from '../../src/realm/tactics.ts'
import type { Grp, Look, Pending, RoundLog, RoundOrder } from '../../src/realm/types.ts'
import { lookNums } from '../../src/ui/realm/lookword.ts'

const MIXES: Array<Side['mix']> = [
  { spear: 60, bow: 20, shield: 10, horse: 10 },
  { spear: 20, bow: 60, shield: 20 },
  { spear: 20, bow: 10, shield: 70 },
  { spear: 30, bow: 20, shield: 10, horse: 40 },
  { spear: 34, bow: 33, shield: 33 },
]
const scale = (m: Side['mix'], k: number): Side['mix'] => Object.fromEntries(Object.entries(m).map(([u, n]) => [u, Math.round((n ?? 0) * k)]))
const total = (m: Side['mix']): number => Object.values(m).reduce((s: number, n) => s + (n ?? 0), 0)

function sideOf(s: number, who: 'us' | 'foe', player: boolean): Side {
  const r = (k: string): number => roll(s, 0, `look-test:${who}:${k}`)
  const mix = scale(MIXES[Math.floor(r('mix') * MIXES.length)]!, 0.6 + r('size') * 3)
  return {
    F: total(mix) * (0.8 + r('f') * 0.4), mix, morale: 0.85 + r('morale') * 0.3,
    hero: { id: who, mu: 2 + Math.floor(r('mu') * 7), ryak: 2 + Math.floor(r('ryak') * 7), coward: false },
    hungry: false, specials: [], water: false, player, seen: player ? r('seen') < 0.6 : true, ...(player && r('knows') < 0.3 ? { knowsFoe: true } : {}),
  }
}

/** 고르는 손 — 깃발마다 판마다 다르게 (사로잡기도 가끔, 퇴각은 빼고) */
function choose(p: Pending, s: number): RoundOrder {
  const pick = <T>(xs: readonly T[], k: string): T => xs[Math.floor(roll(s, p.round, `look-test:pick:${k}`) * xs.length)]!
  const o: { -readonly [K in Grp | 'lead']?: RoundOrder[K] } = {}
  for (const g of p.groups) if (g.options.length > 0) o[g.g] = pick(g.options, g.g)
  const lead = p.lead.filter((c) => c !== 'retreat')
  if (lead.length > 0) o.lead = pick(lead, 'lead')
  return o
}

interface Tally { n: number; raw: number[]; shown: number[] }
const KEYS = ['우리 군사', '적 군사', '우리 사기', '적 사기'] as const

function play(battles: number): { t: Tally; caps: Array<{ lo: number; hi: number; ok: boolean }> } {
  const t: Tally = { n: 0, raw: [0, 0, 0, 0], shown: [0, 0, 0, 0] }
  const caps: Array<{ lo: number; hi: number; ok: boolean }> = []
  for (let s = 0; s < battles; s++) {
    const weAtk = s % 2 === 0
    const us = sideOf(s, 'us', true)
    const foe = sideOf(s, 'foe', false)
    const [A, D] = weAtk ? [us, foe] : [foe, us]
    const key = `look-${s}`
    const cmds: RoundOrder[] = []
    for (let i = 0; i < 6; i++) {
      const p = fightRounds(A, D, key, s, 0, { cmds, open: true }).pending
      if (p === undefined || p.round !== cmds.length || p.look === undefined) break
      const o = choose(p, s)
      const lk: Look = lookRound(p.look, o)
      const res = fightRounds(A, D, key, s, 0, { cmds: [...cmds, o], open: true })
      const rd: RoundLog | undefined = res.rounds[i]
      if (rd === undefined) break
      const prev = res.rounds[i - 1]
      const n0 = (sd: Side, nb: number, na: number): number => total(sd.mix) * (nb - na)
      const mBefore = (x: 'a' | 'd'): number => (prev === undefined ? (x === 'a' ? A.morale : D.morale) : x === 'a' ? prev.ma : prev.md)
      const nBefore = (x: 'a' | 'd'): number => (prev === undefined ? 1 : x === 'a' ? prev.na : prev.nd)
      const me: 'a' | 'd' = weAtk ? 'a' : 'd'
      const them: 'a' | 'd' = weAtk ? 'd' : 'a'
      const sOf = (x: 'a' | 'd'): Side => (x === 'a' ? A : D)
      const nOf = (x: 'a' | 'd'): number => (x === 'a' ? rd.na : rd.nd)
      const mOf = (x: 'a' | 'd'): number => (x === 'a' ? rd.ma : rd.md)
      const caught = rd.ev === 'capture-ok' && rd.by === me
      if (o.lead === 'capture' && lk.capture !== undefined) caps.push({ lo: lk.capture[0], hi: lk.capture[1], ok: caught })
      if (!caught) {
        // 사로잡기는 놓쳤을 때의 폭을 보인다 — 잡았으면 견줄 것이 아니다
        const actual = [
          n0(sOf(me), nBefore(me), nOf(me)), n0(sOf(them), nBefore(them), nOf(them)),
          ((mOf(me) - mBefore(me)) / sOf(me).morale) * 100, ((mOf(them) - mBefore(them)) / sOf(them).morale) * 100,
        ]
        const raw = [lk.us, lk.foe, lk.usMor, lk.foeMor]
        const nums = lookNums(lk)
        const shown = [nums.us, nums.foe, nums.usMor, nums.foeMor]
        t.n++
        actual.forEach((x, k) => {
          if (x >= raw[k]![0] - 1e-6 && x <= raw[k]![1] + 1e-6) t.raw[k]!++
          if (x >= shown[k]![0] - 0.5 && x <= shown[k]![1] + 0.5) t.shown[k]!++
        })
      }
      cmds.push(o)
      if (res.pending === undefined) break
    }
  }
  return { t, caps }
}

describe('깃발 짐작 — 보인 폭에 실제 결과가 든다', () => {
  const { t, caps } = play(160)

  it('여러 판 · 여러 합 — 엔진이 셈한 폭에 값마다 85% 넘게 든다', () => {
    assert.ok(t.n >= 300, `합 ${t.n}`)
    KEYS.forEach((k, i) => assert.ok(t.raw[i]! / t.n >= 0.85, `${k} ${t.raw[i]}/${t.n}`))
  })

  it('화면에 보인 폭(바깥으로 둥글림)은 엔진의 폭보다 덜 들지 않는다', () => {
    KEYS.forEach((k, i) => assert.ok(t.shown[i]! >= t.raw[i]!, `${k} 보임 ${t.shown[i]} · 엔진 ${t.raw[i]}`))
  })

  it('사로잡기 — 실제로 잡힌 비율이 보인 확률의 폭 안이다', () => {
    const n = caps.length
    assert.ok(n >= 40, `사로잡기 ${n}번`)
    const ok = caps.filter((c) => c.ok).length / n
    const lo = caps.reduce((s, c) => s + c.lo, 0) / n
    const hi = caps.reduce((s, c) => s + c.hi, 0) / n
    const tol = 3 * Math.sqrt(Math.max(0.01, ((lo + hi) / 2) * (1 - (lo + hi) / 2)) / n)
    assert.ok(ok >= lo - tol && ok <= hi + tol, `잡힘 ${ok.toFixed(3)} · 보임 ${lo.toFixed(3)}~${hi.toFixed(3)} (±${tol.toFixed(3)})`)
  })
})
