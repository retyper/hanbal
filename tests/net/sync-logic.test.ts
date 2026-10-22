/**
 * 서버 맞추기의 셈 (docs/realm/SERVER.md §3 · src/net/bundle.ts · src/net/firestore.ts)
 *
 *  - Firestore 값 꼴 바꾸기가 왕복한다 (bytes · 정수/실수 · 깊은 map)
 *  - 판 밖에 쌓인 것을 합치면 잃는 것이 없고, 어느 기기에서 합쳐도 같다 (핑퐁 쓰기가 없다)
 *  - 판 맞추기 결정표의 줄마다 — 몰래 덮는 길이 없다 (물러난 기기 판 · 갈라진 판 포함)
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { EMPTY, lineage, logHash, mergeProgress, plan, sameProgress, type LocalHead, type Progress } from '../../src/net/bundle.ts'
import { fromBase64, fromFields, toBase64, toFields } from '../../src/net/firestore.ts'

describe('Firestore 값 꼴', () => {
  it('왕복한다', () => {
    const o = { v: 1, x: 1.5, s: '사로국', ok: true, n: null, list: [1, 'a', { k: 2 }], deep: { a: { b: [true] } }, data: new Uint8Array([0, 1, 254, 255]) }
    const back = fromFields(toFields(o))
    assert.deepEqual({ ...back, data: [...(back['data'] as Uint8Array)] }, { ...o, data: [0, 1, 254, 255] })
    assert.deepEqual(toFields({ a: 3, b: 3.25 }), { a: { integerValue: '3' }, b: { doubleValue: 3.25 } })
  })
  it('base64 은 큰 바이트도', () => {
    const b = new Uint8Array(200_000).map((_, i) => (i * 31) & 255)
    assert.deepEqual(fromBase64(toBase64(b)), b)
  })
})

describe('판 밖에 쌓인 것 합치기', () => {
  const a: Progress = { dex: { x: { f: 1, b: 'yeongnam' }, y: { f: 4 } }, clan: { '1:k': { name: '가' } }, unlock: { won: ['tutorial'], tutorial: 'quit', tiers: { yeongnam: 2 }, nations: { 'yeongnam/saro': 2 } } }
  const b: Progress = { dex: { x: { f: 2, b: 'south' }, z: { f: 8 } }, clan: { '2:m': { name: '나' } }, unlock: { won: ['byeonhan-mini'], tutorial: 'done', tiers: { yeongnam: 1, south: 1 }, nations: { 'yeongnam/saro': 3 } } }
  it('잃는 것이 없다', () => {
    const m = mergeProgress(a, b)
    assert.deepEqual(m.dex, { x: { f: 3, b: 'south' }, y: { f: 4 }, z: { f: 8 } })
    assert.deepEqual(Object.keys(m.clan).sort(), ['1:k', '2:m'])
    assert.deepEqual(m.unlock, { won: ['byeonhan-mini', 'tutorial'], tutorial: 'done', tiers: { yeongnam: 2, south: 1 }, nations: { 'yeongnam/saro': 3 } })
  })
  it('같은 것끼리 합치면 그대로 · 차례가 달라도 같다', () => {
    assert.ok(sameProgress(mergeProgress(a, a), a))
    assert.ok(sameProgress(mergeProgress(EMPTY, a), mergeProgress(a, EMPTY)))
    assert.ok(!sameProgress(a, b))
  })
  it('두 기기가 번갈아 합쳐도 서버에 다시 쓸 것이 없다 (핑퐁 없음)', () => {
    const server1 = mergeProgress(a, b) // 기기 A 가 합쳐 올림
    const deviceB = { ...b, unlock: { ...b.unlock, won: ['yeongnam', 'byeonhan-mini'] } }
    const server2 = mergeProgress(deviceB, server1) // 기기 B 가 합쳐 올림
    const againA = mergeProgress(mergeProgress(a, server2), server2) // 기기 A 가 다시 열어 합침
    assert.ok(sameProgress(againA, server2))
  })
})

describe('판 맞추기 결정표', () => {
  const log = (n: number, tag = 'a'): string[][] => Array.from({ length: n }, (_, i) => [`${tag}${i}`])
  const head = (seed: number, l: string[][]): LocalHead => ({ seed, rev: l.length, hashAt: (n) => logHash(l.slice(0, n)) })
  const remote = (seed: number, l: string[][], t = 't1') => ({ seed, rev: l.length, h: logHash(l), updateTime: t })
  const last = (seed: number, l: string[][], t = 't1') => ({ seed, rev: l.length, h: logHash(l), updateTime: t })

  it('한쪽만 있으면 그쪽으로', () => {
    assert.equal(plan(null, null, null), 'none')
    assert.equal(plan(head(1, log(3)), null, null), 'push')
    assert.equal(plan(null, remote(1, log(3)), null), 'pull')
  })
  it('맞춘 뒤 한쪽만 나아갔으면 그쪽으로', () => {
    const l = last(1, log(3))
    assert.equal(plan(head(1, log(3)), remote(1, log(3), 't1'), l), 'none')
    assert.equal(plan(head(1, log(5)), remote(1, log(3), 't1'), l), 'push')
    assert.equal(plan(head(1, log(3)), remote(1, log(6), 't2'), l), 'pull')
    assert.equal(plan(head(2, log(1)), remote(1, log(3), 't1'), l), 'push') // 이 기기에서 새 판을 시작했다
  })
  it('기기 판이 맞춘 자리보다 물러났거나 갈라졌으면 올리지 않고 받아 본다 (저장 막힘 · 묵은 탭)', () => {
    const l = last(1, log(5)) // 5계절까지 맞췄다
    assert.equal(plan(head(1, log(3)), remote(1, log(5), 't1'), l), 'fetch') // 기기에는 3계절 판만 남았다
    assert.equal(plan(head(1, [...log(3), ['x'], ['y'], ['z']]), remote(1, log(5), 't1'), l), 'fetch') // 묵은 탭이 셋째 뒤에서 갈라졌다
    assert.equal(lineage(log(3), log(5)), 'pull') // 받아 보니 내 판이 앞부분 — 받는다
    assert.equal(lineage([...log(3), ['x'], ['y'], ['z']], log(5)), 'choose')
  })
  it('둘 다 나아갔으면 — 한 줄기면 더 둔 쪽, 갈라졌으면 묻는다', () => {
    const l = last(1, log(3))
    assert.equal(plan(head(1, log(6)), remote(1, log(4), 't2'), l), 'push') // 서버 판이 내 판의 앞부분
    assert.equal(plan(head(1, log(6)), remote(1, [...log(3), ['b3']], 't2'), l), 'choose') // 셋째 뒤에 갈라졌다
    assert.equal(plan(head(1, log(4)), remote(1, log(6), 't2'), l), 'fetch')
    assert.equal(plan(head(2, log(4)), remote(1, log(6), 't2'), l), 'choose') // 다른 판
  })
  it('처음 맞추는 기기(로그아웃 뒤)도 같은 셈 — 같은 판 같은 자리는 아무것도 안 한다', () => {
    assert.equal(plan(head(1, log(3)), remote(1, log(3)), null), 'none')
    assert.equal(plan(head(1, log(5)), remote(1, log(3)), null), 'push')
    assert.equal(plan(head(9, log(5)), remote(1, log(3)), null), 'choose')
  })
  it('받아 본 뒤 — 내 기록이 앞부분이면 받는다', () => {
    assert.equal(lineage(log(4), log(6)), 'pull')
    assert.equal(lineage([...log(3), ['x']], log(6)), 'choose')
  })
})
