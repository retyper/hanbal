/**
 * 그래픽 단계 (src/ui/realm/quality.ts · 형 10-29: 폰 절전 모드에서 그림이 다 깨졌다) — 쌍둥이 규칙을 만드는 글 다루기와 버거움 판정
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { dimOf, flatShadow, midFilter, playStates, shorthandStates, slowFrames, splitTop, twinSel } from '../../src/ui/realm/quality.ts'

describe('그래픽 단계', () => {
  it('맨 바깥 쉼표로만 나눈다', () => {
    assert.deepEqual(splitTop('.ap .a:is(.b, .c), .ap .d[x="1,2"]'), ['.ap .a:is(.b, .c)', '.ap .d[x="1,2"]'])
    assert.deepEqual(splitTop('drop-shadow(0 0 2px rgba(0, 0, 0, .5)) blur(2px)', ' '), ['drop-shadow(0 0 2px rgba(0, 0, 0, .5))', 'blur(2px)'])
  })
  it('쌍둥이 선택자는 세기가 같고 ::before 는 :is 밖', () => {
    assert.equal(twinSel('.ap.q-low', '.ap .x .y'), ':where(.ap.q-low) :is(.ap .x .y)')
    assert.equal(twinSel('.ap.q-low', '.ap .x::after'), ':where(.ap.q-low) :is(.ap .x)::after')
    assert.equal(twinSel('.ap.q-low', '::before'), null)
  })
  it('끝없는 움직임만 멈춘다 · 긴 이름 흘리기는 그대로', () => {
    assert.equal(playStates('spwalk, spidle', '2, infinite'), 'running, paused')
    assert.equal(playStates('a, b, c', 'infinite'), 'paused, paused, paused')
    assert.equal(playStates('mqgo', 'infinite'), 'running')
    assert.equal(playStates('none', '1'), null)
    assert.equal(shorthandStates('spwalk calc(.42s * var(--s, 1)) steps(var(--n, 2)) var(--fa, 0s) 2, spidle calc(1.5s * var(--k)) steps(2) infinite'), 'running, paused')
    assert.equal(shorthandStates('var(--an) calc(var(--du) * 1s) var(--ease) var(--t) both'), 'running')
    assert.equal(shorthandStates(''), null)
  })
  it('filter 를 빼면 어둡게 · 잿빛은 opacity 로 남는다', () => {
    assert.equal(dimOf('brightness(.3) saturate(.7) blur(2px)'), 0.28)
    assert.equal(dimOf('grayscale(1)'), 0.6)
    assert.equal(dimOf('brightness(0) opacity(.55)'), 0.15)
    assert.equal(dimOf('drop-shadow(0 2px 3px #000)'), null)
    assert.equal(dimOf('brightness(1.4)'), null)
    assert.equal(dimOf('saturate(.85)'), null)
  })
  it('보통은 blur 를 빼고 drop-shadow 는 한 겹', () => {
    assert.equal(midFilter('drop-shadow(0 0 2px #ff6a5a) drop-shadow(0 2px 2px #000c) sepia(.25) saturate(1.2)'), 'drop-shadow(0 0 2px #ff6a5a) sepia(.25) saturate(1.2)')
    assert.equal(midFilter('blur(6px)'), 'none')
    assert.equal(midFilter('drop-shadow(0 3px 6px #000c)'), null)
  })
  it('저사양 그림자는 두 겹 · 얕게', () => {
    assert.equal(flatShadow('rgba(255, 210, 122, 0.8) 0px 0px 22px, rgba(0, 0, 0, 0.7) 0px 8px 22px, red 0px 0px 4px'), 'rgba(255, 210, 122, 0.8) 0px 0px 6px, rgba(0, 0, 0, 0.7) 0px 8px 6px')
    assert.equal(flatShadow('0 2px 4px #0008'), null)
    assert.equal(flatShadow('0 0 0 4px #d0301c44'), '0 0 0 2px #d0301c44')
    assert.equal(flatShadow('none'), null)
  })
  it('절전 모드의 30장은 버겁다 · 60장은 괜찮다', () => {
    assert.equal(slowFrames(Array.from({ length: 60 }, () => 33.3)), true)
    assert.equal(slowFrames(Array.from({ length: 120 }, () => 16.7)), false)
    assert.equal(slowFrames(Array.from({ length: 120 }, (_, i) => (i % 3 === 0 ? 70 : 16.7))), true)
    assert.equal(slowFrames([16, 16]), false)
  })
})
