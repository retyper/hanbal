/**
 * 「다음 달」 단추의 곡식 칩 — grainAtSeasonEnd 가 실제 계절 끝 곳간 변화와 맞는가 (형 11-04: "다음 달에 들어올 곡식도 그 버튼에").
 * 아무 명령 없이 넘긴다 · 겨울 썩음과 사건 카드가 없는 계절만 비교한다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { startRegion } from '../../src/realm/data/regions/index.ts'
import { advance } from '../../src/realm/season.ts'
import { grainAtSeasonEnd } from '../../src/realm/economy.ts'
import { isSeasonEnd, seasonOf } from '../../src/realm/calendar.ts'

describe('다음 달 곡식 칩', () => {
  it('계절 끝 달에 미리 셈한 곡식이 실제로 들고 난 곡식과 같다 (봄·여름 · 여러 시드)', () => {
    let checked = 0
    for (let seed = 1; seed <= 6; seed++) {
      let r = startRegion('byeonhan-mini', seed, 'us')
      for (let t = 0; t < 8; t++) {
        if (isSeasonEnd(r) && seasonOf(r) !== 'winter' && r.card == null) {
          const want = grainAtSeasonEnd(r, r.player)
          const before = r.stock[r.player]!.grain
          const { next, report } = advance(r, [])
          // 다른 곡식 드나듦(사건·상단·싸움 노획 등)이 있었으면 건너뛴다 — 경제 줄만 있는 달을 본다
          const other = report.lines.some((l) => l.kind !== 'harvest' && 'grain' in l && (l as { faction?: string }).faction === r.player)
          if (!other && before + want >= 0) {
            assert.equal(next.stock[r.player]!.grain - before, want, `시드 ${seed} · ${seasonOf(r)}`)
            checked++
          }
          r = next
        } else r = advance(r, []).next
      }
    }
    assert.ok(checked >= 4, `비교한 달 ${checked}`)
  })
})
