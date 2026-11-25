// 영웅 대시 한 칸 (형 11-25 「영웅대시 좋다」) — 대시하는 동안 대시 칸이 있는 장수는 그 한 칸 · 없는 장수는 예전 그대로 · 화면만(판은 안 바뀐다)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { HAEBI_RUN as C, HAEBI_DASH as DASH } from '../src/tune/params.ts'
import { createHaebi, stepHaebi } from '../src/raid/haebi.ts'
import { drawField, imagePaths, setHeroArt, dashPathOf, heroDashFiles, heroArtFiles } from '../src/raid/haebi-view.ts'
import { DASH_CELLS } from '../src/raid/dash-cells.ts'
import { SPRITE_PX } from '../src/realm/data/spritePx.ts'

// 옛 회피 잔상은 작은 캔버스를 만든다 — 노드엔 document 가 없어 가짜를 둔다 (붓은 아무것도 안 한다)
const nullCtx = new Proxy({}, { get: () => () => {}, set: () => true })
;(globalThis as { document?: unknown }).document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => nullCtx }) }

const fakeImage = (path: string, width = 5120, height = 256) => ({ path, width, height, complete: true, naturalWidth: width }) as unknown as HTMLImageElement
function images(...extra: string[]) { const m = new Map(imagePaths.map(p => [p, fakeImage(p)])); for (const p of extra) m.set(p, fakeImage(p, 240, 224)); return m }
function recorder() {
  const drawn: unknown[] = [], log = { banned: [] as string[] }
  const state: Record<string, unknown> = { globalAlpha: 1, globalCompositeOperation: 'source-over', fillStyle: '#000', strokeStyle: '#000', lineWidth: 1 }
  const stack: Record<string, unknown>[] = []
  const api: Record<string, unknown> = { canvas: { width: C.width, height: C.height }, save() { stack.push({ ...state }) }, restore() { Object.assign(state, stack.pop() ?? {}) }, drawImage(img: unknown) { drawn.push(img) }, createRadialGradient() { return { addColorStop() {} } }, createLinearGradient() { return { addColorStop() {} } } }
  const ctx = new Proxy(api, { get: (t, k) => k in t ? t[k as string] : k in state ? state[k as string] : () => {}, set: (_t, k, v) => { if (k === 'filter' || k === 'shadowBlur') log.banned.push(String(k)); state[k as string] = v; return true } }) as unknown as CanvasRenderingContext2D
  return { ctx, drawn, log }
}
function field() { const s = createHaebi(3, 'stage', 'dagger', { stage: 'forest', simRules: '56B' }); s.spawn = s.nextElite = s.nextBarrage = 1e9; for (const k of Object.keys(s.cool) as (keyof typeof s.cool)[]) s.cool[k] = 99; return s }

test('표와 그림: 대시 칸이 있는 장수는 모두 서기 띠 규격이 있고 · 그림 파일이 240×224 PNG 로 실제로 있다', () => {
  assert.ok(Object.keys(DASH_CELLS).length >= 9)
  for (const key of Object.keys(DASH_CELLS)) {
    assert.ok(SPRITE_PX[`gen-${key}`], `${key} 서기 띠 규격`)
    const file = `public/realm/anim-px/dash/gen-${key}.png`; assert.ok(existsSync(file), file)
    const buf = readFileSync(file); assert.equal(buf.readUInt32BE(16), 240); assert.equal(buf.readUInt32BE(20), 224)
    assert.ok(buf.length > 1000, '0바이트 아님')
  }
  assert.equal(dashPathOf('anim-px/gen-haebi.png'), 'anim-px/dash/gen-haebi.png'); assert.equal(dashPathOf('anim-px/gen-nobody.png'), null)
})

test('대시하는 동안 대시 칸이 있는 장수는 그 한 칸을 그린다 · 서 있을 땐 서기 · 읽히기 전엔 예전 그대로 · 그리기가 판을 안 바꾼다', () => {
  setHeroArt('haebi')
  assert.deepEqual(heroDashFiles(), ['anim-px/dash/gen-haebi.png'].filter(p => heroArtFiles().some(a => dashPathOf(a) === p)))
  const dash = images('anim-px/dash/gen-haebi.png'), noDash = images()
  const s = field(); s.dash = C.dashTime * .6; s.face = 1
  const before = JSON.stringify(s)
  const a = recorder(); drawField(a.ctx, dash, s, null); assert.ok(a.drawn.includes(dash.get('anim-px/dash/gen-haebi.png')), '대시 칸을 그렸다')
  const b = recorder(); drawField(b.ctx, noDash, s, null); assert.ok(!b.drawn.includes(dash.get('anim-px/dash/gen-haebi.png')), '그림이 안 읽혔으면 예전 그대로')
  assert.equal(JSON.stringify(s), before, '그리기가 판을 안 바꾼다')
  s.dash = 0; s.t += 5   // 대시 잔상이 다 사라진 뒤
  const c = recorder(); drawField(c.ctx, dash, s, null); assert.ok(!c.drawn.includes(dash.get('anim-px/dash/gen-haebi.png')), '서 있을 땐 서기')
  assert.deepEqual([a.log.banned, b.log.banned, c.log.banned], [[], [], []])
})

test('대시 칸이 없는 장수는 대시 동안에도 예전과 같은 그리기 호출', () => {
  setHeroArt('eureum')   // 옛 방식 장수(대시 칸 아직 없음 · 새 방식 장수는 칸이 모이면 표에 들어가므로 옛 방식으로 둔다)
  assert.equal(dashPathOf('anim-px/gen-eureum.png'), null)
  const withDashImage = images('anim-px/dash/gen-haebi.png'), plain = images()
  const s = field(); s.dash = C.dashTime * .6
  const a = recorder(), b = recorder(); drawField(a.ctx, withDashImage, s, null); drawField(b.ctx, plain, s, null)
  assert.equal(a.drawn.length, b.drawn.length, '대시 칸 그림이 있어도 다른 장수에겐 호출이 같다')
  assert.ok(!a.drawn.includes(withDashImage.get('anim-px/dash/gen-haebi.png')))
  setHeroArt('haebi')
})

test('대시 잔상과 먼지는 판을 안 건드린다 · 대시 걸음 동안 걸어도 판 걸음이 같다', () => {
  setHeroArt('haebi')
  const imgs = images('anim-px/dash/gen-haebi.png'), s = field(), r = recorder()
  for (let i = 0; i < 30; i++) { stepHaebi(s, { x: 1, y: 0, dash: i === 0 }, 1 / 120); const snap = JSON.stringify(s); drawField(r.ctx, imgs, s, null); assert.equal(JSON.stringify(s), snap) }
  assert.ok(s.dash > 0 || s.x > 0)
  assert.ok(DASH.dust >= 2 && DASH.stretch > 1)
})

test('대시 몸이 낮아졌다: 그림 속 뒤로 뻗은 발끝(발 줄 위 51px)이 drop 뒤 땅 위 10~14 칸 화소 · 시작엔 hop 만큼 더 떠 있다가 끝에서 내려앉는다', () => {
  const toeAboveFoot = 216 - 165   // 아홉 장 모두 발끝 줄이 165 (tools/out/dash 에서 알파를 훑어 잰 값)
  const clearance = toeAboveFoot - DASH.drop
  assert.ok(clearance >= 10 && clearance <= 14, `땅 위 ${clearance}px`)
  assert.ok(DASH.hop >= 2 && DASH.hop <= 4)
})
