/**
 * 칠십팔국의 소리 (ui/realm/sound.ts) — 고른 후보가 다 public/realm/sfx 에 있고, 장면 소리의 장면 그림도 있다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

import { PICK, SCENE_SOUND, snd, type Slot } from '../../src/ui/realm/sound.ts'

describe('칠십팔국의 소리', () => {
  it('고른 후보 파일이 다 있고, 출처에 적혀 있다', () => {
    const credits = readFileSync('public/realm/sfx/CREDITS.txt', 'utf8')
    for (const slot of Object.keys(PICK) as Slot[]) {
      assert.ok(existsSync(`public/${snd(slot)}.ogg`), slot)
      assert.ok(credits.includes(`${slot}_${PICK[slot]}.ogg`), `${slot} 출처`)
    }
  })

  it('장면 소리의 장면 그림이 있다', () => {
    for (const ev of Object.keys(SCENE_SOUND)) assert.ok(existsSync(`public/realm/event/${ev}.jpg`), ev)
  })
})
