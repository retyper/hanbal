import { test as it } from 'node:test'
import assert from 'node:assert/strict'
import { slamWatcher } from '../src/raid/slam-watch.ts'
import type { HaebiRun } from '../src/raid/haebi.ts'

// 보스 「쿵」 찾기 (형 11-23): 새 quake 고리 · 장수급 적 내려찍기가 끝난 순간만 한 번씩

it('새로 생긴 quake 고리만 · 처음 본 판의 옛 것은 빼고', () => {
    const old = { x: 0, y: 0, r: 65, championCue: 'quake' }
    const run = { fx: [old], enemies: [] } as unknown as HaebiRun
    const w = slamWatcher()
    assert.deepEqual(w(run), [])
    run.fx.push({ x: 5, y: 6, r: 65, championCue: 'quake' } as never, { x: 1, y: 1, r: 65, championCue: 'roar' } as never)
    assert.deepEqual(w(run), [{ x: 5, y: 6, r: 65, boss: true }])
    assert.deepEqual(w(run), [])
})
it('내려찍기 예고가 끝나면 그 자리 한 번 · 돌진은 아님', () => {
    const e = { hp: 10, pattern: 'slam', wind: .3, aimX: 40, aimY: 50, champion: { mode: 'tell', radius: 90 } }
    const d = { hp: 10, pattern: 'dash', wind: .3, aimX: 0, aimY: 0, champion: { mode: 'tell', radius: 90 } }
    const run = { fx: [], enemies: [e, d] } as unknown as HaebiRun
    const w = slamWatcher(); w(run)
    assert.deepEqual(w(run), [])
    e.champion.mode = 'chase'; d.champion.mode = 'dash'
    assert.deepEqual(w(run), [{ x: 40, y: 50, r: 90, boss: false }])
    assert.deepEqual(w(run), [])
})

