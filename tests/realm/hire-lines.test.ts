/**
 * 등용 대사 (realm/data/hire-lines.ts) — 사극 하옵니다체 · 부르는 말 없이 (10-29 장수 설정 초안 · docs/realm/cast)
 *  - 우리는 왕(주몽 · 온조 · 혁거세)일 때도, 작은 나라 우두머리일 때도 있다 → 「주군 · 그대 · 대왕 · 전하」를 넣지 않는다
 *  - 문장마다 공손한 끝(…니다 · …지요 · …시오 · …소서)으로 · 어린 끝(~요 · ~할게요)은 안 된다
 *  - 소리가 있는 줄은 public/realm/voice/hire/<id>.ogg 가 있다 (없으면 voice.ts HIRE_UNRECORDED 에 적는다)
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'

import { HIRE_BY_TRAIT, HIRE_LINE, HIRE_PLAIN } from '../../src/realm/data/hire-lines.ts'
import { HIRE_UNRECORDED } from '../../src/ui/realm/voice.ts'

const ALL: readonly (readonly [string, string])[] = [
  ...Object.entries(HIRE_LINE),
  ...Object.entries(HIRE_BY_TRAIT).map(([k, t]) => [`trait:${k}`, t] as const),
  ['plain', HIRE_PLAIN],
]

/** 문장은 . ! ? 로 끊는다 — 그 앞이 늘 공손한 끝 (말줄임 … 은 문장 안) */
const POLITE = /^(?:[^.!?]*?(?:니다|지요|시오|소서)[.!?]+\s*)+$/
const ADDRESS = /그대|주군|대왕|전하/
const CHILDISH = /에요|해요|어요|아요|할게요|줄게요/

describe('등용 대사', () => {
  it('문장마다 공손한 끝', () => {
    for (const [id, t] of ALL) assert.match(t, POLITE, `${id}: ${t}`)
  })
  it('부르는 말이 없다', () => {
    for (const [id, t] of ALL) assert.doesNotMatch(t, ADDRESS, `${id}: ${t}`)
  })
  it('어린 끝이 없다', () => {
    for (const [id, t] of ALL) assert.doesNotMatch(t, CHILDISH, `${id}: ${t}`)
  })
  it('60자 안', () => {
    for (const [id, t] of ALL) assert.ok([...t].length <= 60, `${id}: ${[...t].length}자`)
  })
  it('녹음한 줄은 소리 파일이 있다', () => {
    for (const id of Object.keys(HIRE_LINE)) {
      if (HIRE_UNRECORDED.has(id)) continue
      assert.ok(existsSync(`public/realm/voice/hire/${id}.ogg`), `hire/${id}.ogg 가 없다 — 녹음하거나 HIRE_UNRECORDED 에`)
    }
    for (const id of HIRE_UNRECORDED) assert.ok(HIRE_LINE[id] !== undefined, `${id} 는 등용 대사가 없다`)
  })
})
