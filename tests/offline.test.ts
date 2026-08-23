/**
 * 오프라인 축적 불변식 (GDD 5장 C4)
 *
 * 여기서 못 박는 건 하나다: **흘러간 시간은 정산되기 전에 삭제되지 않는다.**
 * 저장은 판 보상·성장·탭 이탈 등 아무 때나 일어나는데, 저장이 lastSeen에 도장을 찍으면
 * 그 사이 방치 시간이 축적 없이 증발한다. 게임 탭을 공부 화면 옆에 띄워둔 사람
 * (= 이 게임의 대표 사용법)이 정확히 그 경로를 밟는다.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { defaultSave, writeSave, type SaveData } from '../src/game/save.ts'
import { settleOffline } from '../src/game/offline.ts'
import { P } from '../src/tune/params.ts'

const MIN = 60_000

/** 25분 = 뽀모도로 한 번. docs/BALANCE.md가 "판당 5~6발이니 정확히 3판"이라 적어둔 그 구간이다. */
const AWAY_MS = 25 * MIN

function freshSave(now: number): SaveData {
  const d = defaultSave(now)
  d.arrows = 0
  d.training = 0
  d.requests = 0
  return d
}

describe('오프라인 축적', () => {
  it('탭이 보이는 채로 25분이 흘러도 축적이 삭제되지 않는다', () => {
    const t0 = 1_800_000_000_000
    const d = freshSave(t0)

    // 판이 끝나 저장이 일어났다. 여기서 도장을 찍으면 아래 25분이 통째로 사라진다.
    writeSave(d)
    assert.equal(d.lastSeen, t0, 'writeSave는 lastSeen을 옮기면 안 된다')

    // 탭은 계속 보이는 채로 25분. visibilitychange가 한 번도 안 뜬 상황이다.
    const gain = settleOffline(d, t0 + AWAY_MS)

    const expected = Math.floor((AWAY_MS / 1000) * P.offline.arrowPerSec)
    assert.equal(gain.arrows, expected)
    assert.ok(gain.arrows >= 16, `25분에 화살 ${gain.arrows}발 — 16발 이상이어야 한다`)
    assert.ok(gain.training > 0, '훈련치도 같이 쌓여야 한다')
  })

  it('저장을 여러 번 해도 흘러간 시간은 한 번만, 전부 정산된다', () => {
    const t0 = 1_800_000_000_000
    const d = freshSave(t0)

    // 판을 세 번 돌리는 동안 저장이 세 번 일어났다 (awardRun · spendTraining · loadStage).
    writeSave(d)
    writeSave(d)
    writeSave(d)

    const a = settleOffline(d, t0 + AWAY_MS)
    // 같은 시각으로 한 번 더 정산해도 두 번 주지 않는다.
    const b = settleOffline(d, t0 + AWAY_MS)

    assert.equal(b.arrows, 0)
    assert.equal(b.training, 0)
    assert.equal(a.arrows, Math.floor((AWAY_MS / 1000) * P.offline.arrowPerSec))
  })

  it('실제로 논 시간을 lastSeen에 더하면 그만큼만 축적에서 빠진다', () => {
    const t0 = 1_800_000_000_000
    const d = freshSave(t0)

    // loop.ts의 playedMs가 하는 일. 25분 중 5분은 실제로 판을 돌렸다.
    const played = 5 * MIN
    d.lastSeen += played
    const gain = settleOffline(d, t0 + AWAY_MS)

    const expected = Math.floor(((AWAY_MS - played) / 1000) * P.offline.arrowPerSec)
    assert.equal(gain.arrows, expected)
  })
})
