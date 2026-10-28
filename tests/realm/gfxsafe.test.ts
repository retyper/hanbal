import { test } from 'node:test'
import assert from 'node:assert/strict'
import { colorMatrix, fixCss, parseColor } from '../../src/ui/gfxsafe.ts'

// 갤럭시(Xclipse) 크롬 피해 가기 — 부드러운 그러데이션은 계단으로, filter 색 함수는 SVG 필터로 (10-28)

test('색 읽기 — hex · rgba · transparent', () => {
  assert.deepEqual(parseColor('#fff'), [255, 255, 255, 1])
  assert.deepEqual(parseColor('#0b0d1066')?.slice(0, 3), [11, 13, 16])
  assert.deepEqual(parseColor('rgba(10, 20, 30, .5)'), [10, 20, 30, 0.5])
  assert.deepEqual(parseColor('transparent'), [0, 0, 0, 0])
  assert.equal(parseColor('var(--x)'), null)
})

test('직선 그러데이션 → 딱 끊기는 계단 · 두 번 돌려도 같다', () => {
  const a = fixCss('.x { background: linear-gradient(#a57a31, #2a6a8a); }')
  assert.ok(!a.includes('linear-gradient(#a57a31'))
  assert.match(a, /linear-gradient\(rgb\(\d+,\d+,\d+\) 0% 12\.5%, /)
  assert.equal(fixCss(a), a)
})

test('방향·둥근 그러데이션의 머리말은 그대로 · 자리 없는 가운데 색은 고르게', () => {
  const a = fixCss('background: radial-gradient(ellipse at 50% 42%, #2a2218 0, #14110d 55%, #0a0907 100%)')
  assert.match(a, /^background: radial-gradient\(ellipse at 50% 42%, /)
  const b = fixCss('background: linear-gradient(to bottom, #000, #fff, #000)')
  assert.match(b, /to bottom, .* 50% /)
})

test('repeating · 손으로 쓴 반반 띠 · var() 는 손대지 않는다', () => {
  for (const s of ['background: repeating-linear-gradient(#a 0 10px, #b 10px 20px)', 'background: linear-gradient(#a57a31 0 50%, #2a6a8a 50% 100%)', 'background: linear-gradient(var(--a), #fff)']) assert.equal(fixCss(s), s)
})

test('px 자리는 calc 로 나눈다', () => {
  const a = fixCss('background: linear-gradient(#000 0px, #fff 40px)')
  assert.match(a, /calc\(0px \+ \(40px - 0px\) \* 0\.125\)/)
})

test('filter 색 함수 → url(#gfx-n) · drop-shadow·blur 는 그대로 · backdrop-filter 는 안 건드림', () => {
  const a = fixCss('.b { filter: drop-shadow(0 0 4px #000) brightness(.8); transition: filter .1s; } .c { backdrop-filter: blur(3px) saturate(2); }')
  assert.match(a, /filter: drop-shadow\(0 0 4px #000\) url\(#gfx-\d+\);/)
  assert.match(a, /backdrop-filter: blur\(3px\) saturate\(2\)/)
  assert.equal(fixCss(a), a)
})

test('색 행렬 — brightness·opacity 는 그대로의 셈', () => {
  assert.deepEqual(colorMatrix('brightness', 0.5).slice(0, 5), [0.5, 0, 0, 0, 0])
  assert.equal(colorMatrix('opacity', 0.3)[18], 0.3)
  assert.ok(Math.abs(colorMatrix('saturate', 1)[0]! - 1) < 1e-9)
})
