/**
 * 칠십팔국의 소리 (ui/realm/sound.ts) — 고른 후보가 다 public/realm/sfx 에 있고, 장면 소리의 장면 그림도 있다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

import { LATER, PICK, ROTATE, SCENE_SOUND, sndFile, tapSlot, type Slot } from '../../src/ui/realm/sound.ts'

describe('칠십팔국의 소리', () => {
  it('고른 후보 파일이 다 있고, 출처에 적혀 있다', () => {
    const credits = readFileSync('public/realm/sfx/CREDITS.txt', 'utf8')
    for (const slot of Object.keys(PICK) as Slot[]) {
      if (LATER.has(slot) && !existsSync(`public/realm/sfx/${sndFile(slot)}`)) continue
      assert.ok(existsSync(`public/realm/sfx/${sndFile(slot)}`), slot)
      assert.ok(credits.includes(sndFile(slot)), `${slot} 출처`)
    }
  })

  it('번갈아 도는 곡이 다 있고, 첫 곡이 고른 후보다', () => {
    for (const [slot, list] of Object.entries(ROTATE) as Array<[Slot, readonly string[]]>) {
      assert.equal(list[0], PICK[slot], slot)
      for (const p of list) assert.ok(existsSync(`public/realm/sfx/${sndFile(slot, p)}`), `${slot}_${p}`)
    }
  })

  it('누른 것의 바탕대로 소리가 갈린다 — 안 받은 자리는 대신 소리', () => {
    const real = (s: Slot): Slot | null => (LATER.has(s) && !existsSync(`public/realm/sfx/${sndFile(s)}`) ? null : s)
    assert.equal(tapSlot('dex-open'), 'ui_open')
    assert.equal(tapSlot('help'), 'ui_open')
    assert.equal(tapSlot('lobby'), 'ui_order')
    // 형의 파일이 오면 그 자리로, 그 전엔 나무 딱 (지도 고을은 소리 없이)
    assert.equal(tapSlot('sortie-go'), real('tap_arms') ?? 'ui_order')
    assert.equal(tapSlot('hire'), real('tap_coin') ?? 'ui_order')
    assert.equal(tapSlot('compose-go'), real('tap_brush') ?? 'ui_order')
    assert.equal(tapSlot('mig-to'), real('tap_move') ?? 'ui_order')
    assert.equal(tapSlot('unplot'), real('tap_cancel') ?? 'ui_order')
    assert.equal(tapSlot('node'), real('tap_map'))
  })

  it('장면 소리의 장면 그림이 있다', () => {
    for (const ev of Object.keys(SCENE_SOUND)) assert.ok(existsSync(`public/realm/event/${ev}.jpg`), ev)
  })
})
