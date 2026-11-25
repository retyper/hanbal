import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clampCenter, fieldView, fitZoom, followCam, newCam, toField } from '../../src/field/viewCamera.ts'

const B = { left: 0, top: 0, right: 3840, bottom: 960 }
const VP = { w: 844, h: 390 }

test('맞춤 배율은 맵 높이가 화면 높이에 든다 · 가로 띠', () => {
  const z = fitZoom(VP, B)
  assert.ok(Math.abs(z - 390 / 960) < 1e-9)
  const cam = newCam(VP, B)
  const v = fieldView(cam, VP)
  assert.ok(v.top >= -1e-6 && v.bottom <= 960 + 1e-6)
})

test('가운데는 땅 밖으로 못 나간다', () => {
  const z = fitZoom(VP, B) * 2
  const c = clampCenter(z, -999, 99999, VP, B)
  const v = fieldView({ level: 0, zoom: z, ...c }, VP)
  assert.ok(v.left >= -1e-6 && v.top >= -1e-6 && v.right <= 3840 + 1e-6 && v.bottom <= 960 + 1e-6)
})

test('따라가기는 목표로 다가가고 snap 이면 곧바로', () => {
  const cam = newCam(VP, B, 1)
  followCam(cam, 3000, 480, 0, VP, B, true)
  const x0 = cam.x
  followCam(cam, 500, 480, 0.1, VP, B)
  assert.ok(cam.x < x0)
})

test('화면 좌표 → 판 좌표는 화면 가운데가 카메라 가운데', () => {
  const cam = newCam(VP, B)
  const p = toField(cam, VP, VP.w / 2, VP.h / 2)
  assert.ok(Math.abs(p.x - cam.x) < 1e-9 && Math.abs(p.y - cam.y) < 1e-9)
})

test('frameBox: 점이 없으면 null · 있으면 모두 담고 배율은 맞춤 이상', async () => {
  const { frameBox, wholeZoom } = await import('../../src/field/viewCamera.ts')
  assert.equal(frameBox(VP, B, [], [], 10), null)
  const f = frameBox(VP, B, [1000, 1200], [400, 500], 20)!
  assert.ok(f.zoom >= fitZoom(VP, B) - 1e-9)
  assert.equal(f.x, 1100)
  assert.ok(wholeZoom(VP, B) <= fitZoom(VP, B))
  const v = fieldView({ level: 0, zoom: f.zoom, x: f.x, y: f.y }, VP)
  assert.ok(v.left <= 1000 && v.right >= 1200)
})
