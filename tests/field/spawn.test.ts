/**
 * 시작 자리 = 진 자리 — 전투 개시 뒤 3초 동안 어느 대도 옆(v)으로 0.5칸 넘게 움직이지 않는다 (3×3 진 · 씨앗 1~20).
 * 예전에는 기병 날개 슬롯을 i % 2 로 갈라, 판을 만들 때 세운 자리(homeV)로 차례를 다시 매기면 같은 날개의 앞뒤 두 대가 양 날개로 갈려 첫 틱에 위아래로 달렸다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createField, fitBody, stepField } from '../../src/field/sim.ts'
import { plainSetup } from '../../src/field/scenario.ts'
import { P } from '../../src/tune/params.ts'
import { FORM_HOLD } from '../../src/field/types.ts'
import type { LiveSetup, Squad } from '../../src/field/types.ts'

test('시작 3초 동안 옆 움직임 ≤ 0.5칸 (3×3 진 · 씨앗 1~20)', () => {
  const bad: string[] = []
  for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) for (let seed = 1; seed <= 20; seed++) {
    const st = plainSetup(seed, 1200)
    const s = createField({ ...st, sides: [{ ...st.sides[0], form: a as 0 | 1 | 2 }, { ...st.sides[1], form: b as 0 | 1 | 2 }] })
    const v0 = s.squads.map(q => q.v)
    for (let t = 0; t < 3 * P.field.hz && s.end === null; t++) {
      stepField(s)
      for (const q of s.squads) if (Math.abs(q.v - v0[q.id]!) * 2 > P.field.unit) { bad.push(`진 ${a}·${b} 씨앗 ${seed} 대 ${q.id} ${q.grp} t${s.tick}`); break }
    }
  }
  assert.deepEqual(bad.slice(0, 5), [], `옆으로 움직인 판 ${bad.length}`)
})

/** 앞줄 줄의 바깥 몸 가장자리 [아래, 위] (단위) */
function span(qs: Squad[]): [number, number] {
  return [Math.min(...qs.map(q => q.v - q.bw / 2)), Math.max(...qs.map(q => q.v + q.bw / 2))]
}
function uneven(seed: number, m0: number, m1: number): LiveSetup {
  const a = plainSetup(seed, m0), b = plainSetup(seed, m1)
  return { ...a, sides: [a.sides[0], b.sides[1]] }
}

test('수가 많은 편의 앞줄이 더 길어 적 줄 양 끝을 넘고 · 시작 3초 동안 옆으로 안 움직인다 (1200 대 800 · 800 대 1200)', () => {
  for (const [m0, m1] of [[1200, 800], [800, 1200]] as const) for (let seed = 1; seed <= 10; seed++) {
    const s = createField(uneven(seed, m0, m1))
    const big = m0 > m1 ? 0 : 1
    const fr = (side: number) => s.squads.filter(q => q.side === side && q.grp === 'front')
    const [bl, bh] = span(fr(big)), [sl, sh] = span(fr(1 - big))
    assert.ok(bl < sl && bh > sh, `seed ${seed} ${m0}:${m1} 큰 편 ${bl}~${bh} · 작은 편 ${sl}~${sh}`)
    const v0 = s.squads.map(q => q.v)
    for (let t = 0; t < 3 * P.field.hz && s.end === null; t++) stepField(s)
    for (const q of s.squads) assert.ok(Math.abs(q.v - v0[q.id]!) * 2 <= P.field.unit, `seed ${seed} ${m0}:${m1} 대 ${q.id} 옆으로`)
  }
})

test('대 몸은 사람 수로 — 1200명 판의 처음 몸은 옛 고정 몸 · 사람이 죽으면 얇아지다가 짧아지고 · 방진이면 깊어진다', () => {
  const s = createField(plainSetup(1, 1200))
  const U = P.field.unit
  const f = s.squads.find(q => q.grp === 'front')!, b = s.squads.find(q => q.grp === 'bows')!, h = s.squads.find(q => q.grp === 'horse')!
  assert.deepEqual([f.bw, f.bd, b.bw, b.bd], [3 * U, 2 * U, 3 * U, 2 * U])
  assert.ok(Math.abs(h.bw - 3 * U) <= 2 && Math.abs(h.bd - 3 * U) <= 2, `기병 ${h.bw}×${h.bd}`)
  const w0 = f.bw
  // 먼저 얇아지고 (폭 그대로 · 깊이 줄어듦) · 열이 bodyThinRanks 아래로 가면 줄이 짧아진다
  f.men = 60; fitBody(f)
  assert.ok(f.bw === w0 && f.bd < 2 * U, `60명 ${f.bw}×${f.bd}`)
  f.men = 30; fitBody(f)
  assert.ok(f.bw < w0, `30명 ${f.bw}×${f.bd}`)
  const d0 = f.bd
  f.form = FORM_HOLD; fitBody(f)
  assert.ok(f.bd > d0, '방진 깊이')
  f.men = 1; f.form = 0; fitBody(f)
  assert.ok(f.bw >= Math.trunc(U * P.field.bodyMinPermille / 1000) && f.bd > 0)
})
