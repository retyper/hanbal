/**
 * 세계판 계절 빛 (src/ui/realm/worldmap.ts) — 한 장을 제자리에서 센 tintPixels 가 점 하나씩 센 seasonTint 와 같은 값을 낸다 (카드 C · 형 11-11)
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { seasonTint, tintPixels } from '../../src/ui/realm/worldmap.ts'
import type { SeasonOfYear } from '../../src/realm/types.ts'

describe('세계판 계절 빛', () => {
  for (const season of ['spring', 'summer', 'autumn', 'winter'] as SeasonOfYear[]) {
    it(`${season}: 한 장 셈 = 점 셈`, () => {
      const src = new Uint8ClampedArray(4 * 4096)
      let s = 12345
      for (let i = 0; i < src.length; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; src[i] = (s >> 8) & 255 }
      const want = new Uint8ClampedArray(src)
      for (let i = 0; i < want.length; i += 4) {
        const [r, g, b] = seasonTint(season, src[i]!, src[i + 1]!, src[i + 2]!)
        want[i] = r; want[i + 1] = g; want[i + 2] = b
      }
      const got = new Uint8ClampedArray(src)
      tintPixels(got, season)
      assert.deepEqual([...got], [...want])
    })
  }
})
