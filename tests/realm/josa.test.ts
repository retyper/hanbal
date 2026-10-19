/**
 * 조사 (형 2026-10-19: "우리 궁수이 적어 잘 안먹힌다? 텍스트들 규칙에서 항상 이렇게 한글 조사 틀리지 않게 확실하게 규칙 짜놔")
 *  - 바뀌는 낱말 뒤 조사는 josa() 로만 — tools/josa-lint.ts 가 0 곳
 *  - 숫자는 우리말 읽기로 (일·이·삼 … 십·백·천·만)
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { josa } from '../../src/realm/data/prose.ts'
import { lint } from '../../tools/josa-lint.ts'

describe('조사', () => {
  it('글 틀에 손으로 붙인 조사가 없다', () => {
    const hits = lint()
    assert.deepEqual(hits.map((h) => `${h.file}:${h.line}`), [])
  })
  it('낱말 받침', () => {
    assert.equal(josa('궁수', '이', '가'), '궁수가')
    assert.equal(josa('창병·기병', '이', '가'), '창병·기병이')
    assert.equal(josa('방패병', '을', '를'), '방패병을')
    assert.equal(josa('서울', '으로', '로'), '서울로')
  })
  it('숫자는 우리말 읽기로', () => {
    assert.equal(josa('2', '을', '를'), '2를')
    assert.equal(josa('3', '을', '를'), '3을')
    assert.equal(josa('16', '이', '가'), '16이')
    assert.equal(josa('10', '이', '가'), '10이')
    assert.equal(josa('100', '을', '를'), '100을')
    assert.equal(josa('1,000', '이', '가'), '1,000이')
    assert.equal(josa('7', '으로', '로'), '7로')
    assert.equal(josa('곡식 30', '을', '를'), '곡식 30을')
    assert.equal(josa('곡식 5', '을', '를'), '곡식 5를')
  })
})
