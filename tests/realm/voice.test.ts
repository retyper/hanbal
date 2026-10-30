/**
 * 장수 목소리 (ui/realm/voice.ts) — 결 아홉마다 짧은 대답 셋과 기술 외침 아홉이 다 public/realm/voice 에 있다
 * (형 10-26: "다른 데에서는 아무데서도 장수목소리가 안들리는데. 전투할때도" — 파일이 빠지면 조용히 안 난다)
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'

import { REGION_IDS, regionNations, startRegion } from '../../src/realm/data/regions/index.ts'
import { hireVoicePath, LOW_CHIEF, voiceSlot, type VoiceKind } from '../../src/ui/realm/voice.ts'
import type { Art, Hero } from '../../src/realm/types.ts'

const KINDS: readonly VoiceKind[] = ['m-young', 'm-gruff', 'm-sage', 'm-elder', 'm-charm', 'w-bright', 'w-cool', 'w-sly', 'w-shaman', 'm-knight', 'w-knight', 'm-veteran', 'w-matron']
const ARTS: readonly Art[] = ['snipe', 'rite', 'sway', 'stand', 'ambush', 'vanguard', 'feint', 'order', 'shout']

describe('장수 목소리 파일', () => {
  it('결마다 짧은 대답 셋', () => {
    for (const k of KINDS) for (const n of [1, 2, 3]) assert.ok(existsSync(`public/realm/voice/tap-${k}-${n}.ogg`), `tap-${k}-${n}`)
  })
  it('결마다 기술 외침 아홉', () => {
    for (const k of KINDS) for (const a of ARTS) assert.ok(existsSync(`public/realm/voice/art-${k}-${a}.ogg`), `art-${k}-${a}`)
  })
})

describe('갈아 끼운 목소리 (voice.ts LOW_SLOT · LOW_CHIEF · 형 10-30)', () => {
  const heroes = new Map<string, { h: Hero; ruler: boolean }>()
  for (const reg of REGION_IDS) {
    const r = startRegion(reg, 1, regionNations(reg)[0]!)
    const rulers = new Set(Object.values(r.factions).map((f) => f.ruler))
    for (const h of Object.values(r.heroes)) if (!heroes.has(h.id)) heroes.set(h.id, { h, ruler: rulers.has(h.id) })
  }
  it('모든 장수의 목소리 파일이 있다', () => {
    for (const { h, ruler } of heroes.values()) {
      const { dir, kind } = voiceSlot(h, ruler)
      const files = [...[1, 2, 3].flatMap((n) => [`tap-${kind}-${n}`, `obey-${kind}-${n}`, `auto-${kind}-${n}`]), 'auto-' + kind + '-win', 'auto-' + kind + '-lose', ...ARTS.map((a) => `art-${kind}-${a}`)]
      for (const f of files) assert.ok(existsSync(`public/${dir}${f}.ogg`), `${h.id} → ${dir}${f}`)
    }
  })
  it('소서노는 처진 목소리(B 의젓한 여장수)를 내지 않는다', () => {
    const s = heroes.get('mh-soseono')
    assert.ok(s !== undefined)
    assert.notEqual(`${voiceSlot(s.h).dir}${voiceSlot(s.h).kind}`, 'realm/voice/b/w-cool')
    assert.ok(!hireVoicePath(s.h).includes('/hire/'))
  })
  it('군장 말을 갈아 끼운 곳의 파일이 있다', () => {
    for (const { cast, kind } of Object.values(LOW_CHIEF)) {
      assert.ok(existsSync(`public/realm/voice/${cast === 'b' ? 'b/' : ''}chief/${kind}-aid-a.ogg`), `${cast}:${kind}`)
    }
  })
})
