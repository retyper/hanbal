/**
 * 처음 한 번 알림 — 안 본 것 가운데 보이는 첫 것 하나만 (형 11-01: 배우는 판에 없는 기능은 처음 만날 때 한 번)
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FIRSTS, nextFirst } from '../../src/ui/realm/firsts.ts'
import { wipeable } from '../../src/ui/realm/wipe.ts'

test('보이는 것 가운데 아직 안 본 첫 것', () => {
  const shown = new Set([FIRSTS[1]!.sel, FIRSTS[2]!.sel])
  assert.equal(nextFirst(new Set(), (s) => shown.has(s))?.id, FIRSTS[1]!.id)
  assert.equal(nextFirst(new Set([FIRSTS[1]!.id]), (s) => shown.has(s))?.id, FIRSTS[2]!.id)
  assert.equal(nextFirst(new Set([FIRSTS[1]!.id, FIRSTS[2]!.id]), (s) => shown.has(s)), null)
})

test('본 기록은 기록 지우기로 지워진다 (다시 알려 준다)', () => {
  assert.ok(wipeable('hanbal.realm.firsts'))
})

test('알림 글은 존댓말로 끝나고 긴 줄표가 없다', () => {
  for (const f of FIRSTS) {
    assert.match(f.text, /니다\.$/, f.id)
    assert.ok(!f.text.includes('—'), f.id)
  }
})
