/**
 * 튜닝 값 — 손잡이(k) 말고 맨 숫자·배열로 둔 값도 그 모양 그대로 읽힌다 (10-24: materialize 가 배열·숫자를 {} 로 풀어
 * 등용 장면이 「hireCutMs is not iterable」로 멈춰 닫히지 않았다 — 형: "게임으로 돌아갈 수가 없어")
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { P } from '../../src/tune/params.ts'

describe('튜닝 값의 모양', () => {
  it('배열은 배열 · 맨 숫자는 숫자', () => {
    assert.ok(Array.isArray(P.realm.hireCutMs) && P.realm.hireCutMs.length === 3)
    for (const v of [P.realm.hirePopMs, P.realm.backToastMs, P.realm.tutStuckMs]) assert.equal(typeof v, 'number')
  })
  it('어디에도 빈 묶음({})이 없다 — 맨 값을 묶음으로 잘못 푼 흔적', () => {
    const walk = (o: unknown, path: string): void => {
      if (o === null || typeof o !== 'object' || Array.isArray(o)) return
      const keys = Object.keys(o)
      assert.ok(keys.length > 0, `${path} 가 비었다`)
      for (const k of keys) walk((o as Record<string, unknown>)[k], `${path}.${k}`)
    }
    walk(P, 'P')
  })
})
