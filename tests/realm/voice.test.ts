/**
 * 장수 목소리 (ui/realm/voice.ts) — 결 아홉마다 짧은 대답 셋과 기술 외침 아홉이 다 public/realm/voice 에 있다
 * (형 10-26: "다른 데에서는 아무데서도 장수목소리가 안들리는데. 전투할때도" — 파일이 빠지면 조용히 안 난다)
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'

import type { VoiceKind } from '../../src/ui/realm/voice.ts'
import type { Art } from '../../src/realm/types.ts'

const KINDS: readonly VoiceKind[] = ['m-young', 'm-gruff', 'm-sage', 'm-elder', 'm-charm', 'w-bright', 'w-cool', 'w-sly', 'w-shaman']
const ARTS: readonly Art[] = ['snipe', 'rite', 'sway', 'stand', 'ambush', 'vanguard', 'feint', 'order', 'shout']

describe('장수 목소리 파일', () => {
  it('결마다 짧은 대답 셋', () => {
    for (const k of KINDS) for (const n of [1, 2, 3]) assert.ok(existsSync(`public/realm/voice/tap-${k}-${n}.ogg`), `tap-${k}-${n}`)
  })
  it('결마다 기술 외침 아홉', () => {
    for (const k of KINDS) for (const a of ARTS) assert.ok(existsSync(`public/realm/voice/art-${k}-${a}.ogg`), `art-${k}-${a}`)
  })
})
