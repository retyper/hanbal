/** 시작 화면 「아무 키나 누르세요」 (ui/realm/startgate.ts · Codex 59-A) — 어떤 그림·영상을 고르나 · 언제 띄우나 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { START_FALLBACK, pickStartArt, wantStartGate } from '../../src/ui/realm/startgate.ts'
import { P } from '../../src/tune/params.ts'

describe('시작 화면 그림 고르기', () => {
  it('아무것도 없으면 로비 그림 하나', () => {
    assert.deepEqual(pickStartArt([], true, true), { video: null, still: START_FALLBACK })
    assert.deepEqual(pickStartArt([], false, true), { video: null, still: START_FALLBACK })
  })
  it('화면 방향과 같은 꼴 먼저 · 세로 화면엔 가로 그림도 · 가로 화면에 세로 그림은 쓰지 않는다', () => {
    const all = ['start-16x9.jpg', 'start-9x16.jpg']
    assert.equal(pickStartArt(all, true, false).still, 'start-9x16.jpg')
    assert.equal(pickStartArt(all, false, false).still, 'start-16x9.jpg')
    assert.equal(pickStartArt(['start-16x9.jpg'], true, false).still, 'start-16x9.jpg')
    assert.equal(pickStartArt(['start-9x16.jpg'], false, false).still, START_FALLBACK)
  })
  it('영상은 되는 때만 · 그 영상과 같은 꼴의 그림을 첫 장으로', () => {
    const all = ['start-16x9.mp4', 'start-9x16.mp4', 'start-16x9.jpg', 'start-9x16.jpg']
    assert.deepEqual(pickStartArt(all, true, true), { video: 'start-9x16.mp4', still: 'start-9x16.jpg' })
    assert.deepEqual(pickStartArt(all, false, true), { video: 'start-16x9.mp4', still: 'start-16x9.jpg' })
    // 저사양 · 움직임 줄이기 → 정지 그림만
    assert.deepEqual(pickStartArt(all, true, false), { video: null, still: 'start-9x16.jpg' })
    // 세로 영상만 있고 그림은 가로뿐 — 세로 화면은 영상 + 가로 그림 · 가로 화면은 가로 그림
    assert.deepEqual(pickStartArt(['start-9x16.mp4', 'start-16x9.jpg'], true, true), { video: 'start-9x16.mp4', still: 'start-16x9.jpg' })
    assert.deepEqual(pickStartArt(['start-9x16.mp4', 'start-16x9.jpg'], false, true), { video: null, still: 'start-16x9.jpg' })
  })
  it('옛 첫 화면(해 동그라미·시위 당긴 궁수)은 바탕으로 쓰지 않는다', () => {
    assert.notEqual(START_FALLBACK, 'title-keyart.jpg')
  })
})

describe('시작 화면을 띄울 때', () => {
  it('?start=1 은 늘 · ?start=0 과 크레딧 주소는 건너뛴다', () => {
    assert.equal(wantStartGate('?start=1'), true)
    assert.equal(wantStartGate('?start=1&credits=1'), true)
    assert.equal(wantStartGate('?start=0'), false)
    assert.equal(wantStartGate('?credits=1'), false)
  })
  it('누르고 로비가 다 드러나기까지 1초 안 (번쩍임 뒤 걷힘)', () => {
    assert.ok(P.realm.startExitDelayMs + P.realm.startFadeMs <= 1000)
    assert.ok(P.realm.startFlashMs <= P.realm.startExitDelayMs + P.realm.startFadeMs)
  })
})
