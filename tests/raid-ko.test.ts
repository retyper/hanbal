// 쓰러짐 KO 연출 (형 11-23 「1:1 대전 게임의 KO 처럼 · 오래 유지 · 슬로우 · 줌 · 겨루기에도」) — 화면만 · 셈만 시험
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HAEBI_KO as K, HAEBI_END as E } from '../src/tune/params.ts'
import { fallCells, fallTime, koFrame, koZoom, koDuration, koStampAt, koSkippable, koTargetZoom } from '../src/raid/ko.ts'
import { DUEL_ATLASES, LEGACY_ATLAS, fighterMotion, pxAtlas } from '../src/duel/fighter-motion.ts'

const four = [18, 20, 21, 19]

test('쓰러지는 칸: 맞은 멈춤 동안 첫 칸 · 차례대로 · 끝 칸에 머문다 · 앞은 빨리 뒤는 느리게', () => {
  assert.deepEqual(fallCells(), [18, 19]); assert.deepEqual(fallCells(undefined, 14, 15), [14, 15]); assert.deepEqual(fallCells(four), four)
  assert.equal(fallCells([1, 2, 3, 4, 5, 6]).length, K.maxCells, '길어야 maxCells 칸')
  assert.equal(koFrame(four, -1), 18); assert.equal(koFrame(four, 0), 18)
  assert.equal(koFrame(four, fallTime(four)), 19); assert.equal(koFrame(four, 99), 19)
  const seq: number[] = [], at = new Map<number, number>()
  for (let t = 0; t <= fallTime(four) + .01; t += .005) { const f = koFrame(four, t); if (seq[seq.length - 1] !== f) { seq.push(f); at.set(f, t) } }
  assert.deepEqual(seq, four, '건너뛰거나 되돌아가지 않는다')
  const d1 = at.get(20)!, d2 = at.get(21)! - at.get(20)!, d3 = at.get(19)! - at.get(21)!
  assert.ok(d1 < d2 && d2 < d3, `앞 칸 ${d1.toFixed(2)} < ${d2.toFixed(2)} < 마지막 ${d3.toFixed(2)}`)
  assert.equal(koFrame([18, 19], fallTime([18, 19]) - .001), 18); assert.equal(koFrame([19], 5), 19)
})

test('카메라 다가감: 0 에서 zoomTime 에 1 · 살짝 지나쳤다 돌아옴 · 움직임 줄이기면 0 · KO 가까이 배율 · 막 길이와 건너뛰기 문턱', () => {
  assert.equal(koZoom(-.1), 0); assert.equal(koZoom(0), 0); assert.ok(Math.abs(koZoom(K.zoomTime) - 1) < 1e-12); assert.ok(Math.abs(koZoom(99) - 1) < 1e-12)
  let peak = 0
  for (let t = 0; t < 2; t += .01) { const z = koZoom(t); assert.ok(z >= 0 && z <= 1 + K.overshoot * .2, `${t} ${z}`); peak = Math.max(peak, z) }
  assert.ok(peak > 1, '살짝 지나친다')
  // 누운 몸(키 94 × lieWidth)이 보이는 폭 1120 의 fill 몫 — 열전 기본은 약 5배 · 지금보다 줄이지 않고 maxZoom 을 넘지 않는다
  const z = koTargetZoom(1, 94, 1120)
  assert.ok(Math.abs(94 * K.lieWidth * z / 1120 - K.fill) < 1e-9 && z > 3 && z <= K.maxZoom, `${z}`)
  assert.equal(koTargetZoom(1, 10, 1120), K.maxZoom); assert.equal(koTargetZoom(7, 94, 1120), 7)
  assert.ok(K.fill >= 1 / 3 && K.fill <= .4, '화면 폭의 3분의 1 ~ 40%')
  assert.equal(koZoom(.5, true), 0)
  assert.ok(Math.abs(koDuration() - (E.defeat.freeze + K.fallStep * (K.maxCells - 1) + K.hold)) < 1e-12)
  assert.ok(koDuration() - (E.defeat.freeze + fallTime(four)) >= K.hold - 1e-9, '네 칸이어도 마지막 칸에 hold 초')
  assert.ok(koStampAt() > E.defeat.freeze + fallTime(four), '「패배」 띠는 다 쓰러진 뒤')
  assert.equal(koSkippable(K.minSkip - .01), false); assert.equal(koSkippable(K.minSkip), true)
})

test('겨루기: 쓰러짐은 끝난 뒤 시계로 칸을 넘기고 · 시계가 없으면 예전처럼 바로 누운 칸 · 범은 열전과 같은 도트 띠 칸 표', () => {
  const atlas = DUEL_ATLASES.aryeong!
  assert.deepEqual(fighterMotion(atlas, { kind: 'idle', t0: 0 }, 0, false, 'dead'), { frame: atlas.dead, dx: 0 })
  assert.equal(fighterMotion(atlas, { kind: 'idle', t0: 0 }, 0, false, 'dead', 0).frame, atlas.hit)
  assert.equal(fighterMotion(atlas, { kind: 'idle', t0: 0 }, 0, false, 'dead', (E.defeat.freeze + fallTime([atlas.hit, atlas.dead])) * 1000).frame, atlas.dead)
  const beom = pxAtlas('beom')
  assert.equal(beom.hit, LEGACY_ATLAS.hit); assert.equal(beom.dead, LEGACY_ATLAS.dead); assert.ok(beom.plan)
  assert.equal(pxAtlas('haebi'), LEGACY_ATLAS, '계획 없는 띠는 정규 칸 표 그대로')
  assert.equal(beom.cells, 20, '본 띠는 20칸'); assert.deepEqual(beom.fall, [18, 20, 21, 19])
  assert.equal(pxAtlas('beom', false).fall, undefined, '덧 띠가 아직이면 18 → 19')
  const seq = new Set<number>(); for (let t = 0; t < 4000; t += 20) seq.add(fighterMotion(beom, { kind: 'idle', t0: 0 }, 0, false, 'dead', t).frame)
  assert.deepEqual([...seq], [18, 20, 21, 19])
  for (let t = 0; t < 60000; t += 50) assert.ok([0, 1].includes(fighterMotion(beom, { kind: 'idle', t0: 0 }, t, false, null, undefined, true).frame), '움직임 줄이기면 base 만')
  const idle = new Set<number>(); for (let t = 0; t < 120000; t += 50) idle.add(fighterMotion(beom, { kind: 'idle', t0: 0 }, t, false).frame)
  assert.deepEqual([...idle].sort((a, b) => a - b), [0, 1, 2, 3, 22, 23, 24, 25])
})
