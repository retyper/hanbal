/**
 * 나라 깃발 그림 (data/art.ts flagIcon) — 모든 나라의 깃발 칸이 있는 그림 파일을 가리킨다
 * (형 11-02: 구지봉의 노래에서 마을마다 깃발이 깨진 그림으로 떴다 · 그림 없는 나라 열한 곳 → 같은 문양의 옛 깃발을 빌려 씀)
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'

import { FACTION_ART, flagIcon } from '../../src/realm/data/art.ts'

describe('나라 깃발 그림', () => {
  it('모든 나라의 깃발 그림 파일이 있다', () => {
    const missing = Object.keys(FACTION_ART).filter((f) => !existsSync(`public/realm/icon/${flagIcon(f)}.png`))
    assert.deepEqual(missing, [])
  })
})
