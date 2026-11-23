import test from 'node:test'
import assert from 'node:assert/strict'
import { companionPlace, companionScale, mirroredLeft } from '../src/raid/strip-geom.ts'

// 본 띠 칸: 208×160 · 발 줄 156 · 배율 k (원본 1px = 화면 k px) — 본 띠 칸의 (한가운데, 발 줄) 점이 기준점 (0, 0)
const main = { w: 208, h: 160, feet: 156 }
const mainPlace = (k: number) => ({ left: -main.w * k / 2, top: -main.feet * k })

test('덧 띠 자리: xGeom 없음 = 본 띠 칸과 같은 자리(한가운데 · 발 줄 · 높이)', () => {
  for (const k of [1, 1.5, 2.2]) {
    const p = companionPlace(main.w, main.h, k, main.feet), m = mainPlace(k)
    assert.equal(p.left, m.left); assert.equal(p.top, m.top); assert.equal(p.w, main.w * k); assert.equal(p.h, main.h * k)
  }
})

test('덧 띠 자리: xGeom 있음 = 뿌리·발 줄이 본 띠 칸의 (한가운데, 발 줄) 점에 온다 · 배율은 같다', () => {
  const geom = { h: 256, root: 120, foot: 200 }, cellW = 400
  for (const k of [1, 1.5, 2.2]) {
    const p = companionPlace(cellW, geom.h, k, main.feet, geom)
    assert.ok(Math.abs(p.left + geom.root * k) < 1e-9)   // 칸 왼쪽 + 뿌리 = 기준 x (0)
    assert.ok(Math.abs(p.top + geom.foot * k) < 1e-9)   // 칸 위 + 발 줄 = 기준 y (0 = 본 띠 발 줄)
    assert.equal(p.w, cellW * k); assert.equal(p.h, geom.h * k)   // 원본 1px 이 본 띠와 같은 화면 px
  }
  assert.equal(companionScale(160, geom), 256 / 160); assert.equal(companionScale(160), 1)
})

test('덧 띠 자리: 좌우로 뒤집어도 뿌리는 같은 자리(x = 0)', () => {
  const geom = { h: 256, root: 120, foot: 200 }, p = companionPlace(400, geom.h, 2, main.feet, geom)
  // 뒤집힌 칸의 왼쪽 모서리 = 오른쪽 모서리의 거울상 · 뿌리 = 칸 왼쪽에서 root·k → 뒤집으면 오른쪽 모서리에서 root·k 왼쪽
  const flippedRoot = mirroredLeft(p) + p.w - geom.root * 2
  assert.ok(Math.abs(flippedRoot) < 1e-9)
  // 뿌리가 한가운데가 아니라서 뒤집으면 칸 몸통은 반대편으로 간다
  assert.ok(mirroredLeft(p) !== p.left)
  // xGeom 없음(한가운데 뿌리)은 뒤집어도 칸이 같은 자리
  const q = companionPlace(main.w, main.h, 2, main.feet)
  assert.ok(Math.abs(mirroredLeft(q) - q.left) < 1e-9)
})
