import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHaebi, spawnMob, type HaebiRun } from '../src/raid/haebi.ts'
import { drawField, imagePaths } from '../src/raid/haebi-view.ts'
import { championFanAngles, type ChampionPattern } from '../src/raid/champion.ts'
import { HAEBI_RUN as C, HAEBI_CHAMPION as B, HAEBI_FX as K, HAEBI_STAGES as ST } from '../src/tune/params.ts'
import { fieldView } from '../src/raid/camera.ts'

type Call = { method: string; args: unknown[]; path: { method: string; args: number[] }[]; width: number; color: unknown }
function canvas() {
  const calls: Call[] = [], props: Record<string | symbol, unknown> = { canvas: { width: C.width * 2, height: C.height * 2 }, globalAlpha: 1, lineWidth: 1, strokeStyle: '', fillStyle: '', imageSmoothingEnabled: false }
  const stack: Record<string | symbol, unknown>[] = []; let path: { method: string; args: number[] }[] = []
  const ctx = new Proxy(props, { get(o, key) {
    if (key in o) return o[key]
    return (...args: unknown[]) => {
      if (key === 'save') stack.push({ ...props })
      if (key === 'restore') Object.assign(props, stack.pop())
      if (key === 'beginPath') path = []
      if (['moveTo', 'lineTo', 'arc', 'ellipse'].includes(String(key))) path.push({ method: String(key), args: args as number[] })
      calls.push({ method: String(key), args, path: [...path], width: Number(props.lineWidth), color: key === 'fill' || key === 'fillRect' || key === 'fillText' ? props.fillStyle : props.strokeStyle })
      if (key === 'measureText') return { width: String(args[0]).length * 6 }
      if (String(key).startsWith('create') && String(key).endsWith('Gradient')) return { addColorStop() {} }
      return undefined
    }
  }, set(o, key, value) { o[key] = value; return true } }) as unknown as CanvasRenderingContext2D
  return { ctx, calls }
}
function image(path: string, width: number, height: number) { return { path, width, height, complete: true } as unknown as HTMLImageElement }
function assets() { return new Map([
  ['anim-px/elite-forest.png', image('chief', 2320, 144)],
  ['raid/ui/plaque.png', image('plate', 200, 50)],
  ['raid/chest.png', image('chest', 56, 56)],
  ['raid/arrow.png', image('arrow', 100, 20)],
]) }
function champion(pattern: ChampionPattern = 'dash') {
  const s = createHaebi(530, 'stage', 'sword'); spawnMob(s, 'elite'); const e = s.enemies[0]!
  Object.assign(e, { x: 250, y: 300, aimX: 650, aimY: 340, wind: pattern === 'guard' ? 0 : .6, recovery: 0, pattern })
  Object.assign(e.champion!, { mode: pattern === 'guard' ? 'guard' : 'tell', startX: e.x, startY: e.y, dx: 1, dy: 0, range: B.dashRange, radius: B.slamRadius })
  s.fx = []; return { s, e }
}
function paint(s: HaebiRun, cam?: { x: number; y: number; zoom: number }) {
  const x = canvas(); drawField(x.ctx, assets(), s, null, cam); return x.calls
}
const arcsAt = (calls: Call[], x: number, y: number) => calls.filter(c => c.method === 'arc' && c.args[0] === x && c.args[1] === y)
const lanes = (calls: Call[], width: number) => calls.filter(c => c.method === 'stroke' && c.width === width && [K.foe.line, K.foe.rim, K.foe.hot].includes(c.color as typeof K.foe.line))

test('53B drawField: dash/fan/summon never collect the legacy slam circle; guard has no red zone', () => {
  for (const pattern of ['dash', 'fan', 'summon', 'guard'] as const) {
    const { s, e } = champion(pattern), calls = paint(s)
    assert.equal(arcsAt(calls, e.aimX, e.aimY).length, 0, `${pattern}: fake circle at ${e.aimX},${e.aimY}`)
  }
})

test('53B drawField: champion slam uses locked aim and champion radius120, not legacy95', () => {
  const { s, e } = champion('slam'), calls = paint(s)
  assert.ok(arcsAt(calls, e.aimX, e.aimY).some(c => c.args[2] === e.champion!.radius))
  assert.ok(!arcsAt(calls, e.aimX, e.aimY).some(c => c.args[2] === C.bossRadius))
})

test('53B drawField: dash lane uses frozen start/end and exact collision width', () => {
  const { s, e } = champion('dash'); e.x += 30; e.y += 10
  const band = lanes(paint(s), B.dashWidth * 2).find(c => c.path.some(p => p.method === 'lineTo' && p.args[0] === e.aimX && p.args[1] === e.aimY))
  assert.ok(band, 'red48px damage band must exist')
  assert.ok(band.path.some(p => p.method === 'moveTo' && p.args[0] === e.champion!.startX && p.args[1] === e.champion!.startY))
})

test('53B drawField: fan is exactly five projectile corridors, not a filled cone between gaps', () => {
  const { s, e } = champion('fan'), calls = paint(s), distance = B.fanSpeed * B.fanLife
  const band = lanes(calls, B.fanHitRadius * 2).find(c => c.path.filter(p => p.method === 'lineTo').length === B.fanCount)
  assert.ok(band, 'five40px missile corridors must exist')
  const ends = band.path.filter(p => p.method === 'lineTo')
  championFanAngles(e).forEach((a, i) => {
    assert.ok(Math.abs(ends[i]!.args[0]! - (e.champion!.startX + Math.cos(a) * distance)) < 1e-8)
    assert.ok(Math.abs(ends[i]!.args[1]! - (e.champion!.startY + Math.sin(a) * distance)) < 1e-8)
  })
  assert.ok(!calls.some(c => c.method === 'fill' && c.color === K.foe.fill && c.path.some(p => p.method === 'lineTo')), 'no filled fan wedge')
})

test('53B drawField: elite plaque/name/HP stay inside zoomed view near its edges', () => {
  const { s, e } = champion('guard'), cam = { x: C.width / 2, y: C.height / 2, zoom: 1.8 }, v = fieldView(cam)
  e.x = v.left + 2; e.y = v.top + 40
  const calls = paint(s, cam), name = calls.find(c => c.method === 'fillText' && c.args[0] === ST.forest.eliteName)
  assert.ok(name, 'real elite name missing')
  const plate = calls.find(c => c.method === 'drawImage' && (c.args[0] as { path?: string })?.path === 'plate')
  assert.ok(plate)
  assert.ok(Number(plate.args[1]) >= v.left && Number(plate.args[2]) >= v.top)
  assert.ok(Number(plate.args[1]) + Number(plate.args[3]) <= v.right && Number(plate.args[2]) + Number(plate.args[4]) <= v.bottom)
})

test('53B drawField: recovery uses existing HIT18 and a body lean; no new atlas/image required', () => {
  const { s, e } = champion('guard'); e.recovery = B.recoverySeconds; e.champion!.mode = 'chase'
  const calls = paint(s), sprite = calls.find(c => c.method === 'drawImage' && (c.args[0] as { path?: string })?.path === 'chief')
  assert.ok(sprite); assert.equal(sprite.args[1], 18 * 116)
  assert.ok(calls.some(c => c.method === 'rotate' && Math.abs(Number(c.args[0])) > 0))
})

test('53B drawField: phase2/3 roar visibly rings without new explanatory captions', () => {
  for (const phase of [2, 3] as const) {
    const { s, e } = champion('guard'); e.phase = phase; e.champion!.mode = 'roar'; e.champion!.t = B.roarSeconds / 2
    const calls = paint(s)
    assert.ok(calls.some(c => c.method === 'arc' && c.args[0] === e.x && Number(c.args[2]) > 0), `phase${phase} ring missing`)
    assert.deepEqual(calls.filter(c => c.method === 'fillText').map(c => c.args[0]), [ST.forest.eliteName])
  }
})

test('53B drawField: ground closed chest is preloaded, large differs, opened/claimed/expired are not redrawn', () => {
  assert.ok(imagePaths.includes('raid/chest.png'))
  const s = createHaebi(531), chest = { id: 1, eliteId: 1, x: 600, y: 350, bornAt: 0, state: 'ground' as const, choicesRemaining: 1, gold: 12, large: false }
  s.chests = [chest]
  const small = paint(s).find(c => c.method === 'drawImage' && (c.args[0] as { path?: string })?.path === 'chest')
  assert.ok(small)
  chest.large = true
  const large = paint(s).find(c => c.method === 'drawImage' && (c.args[0] as { path?: string })?.path === 'chest')
  assert.ok(large); assert.ok(Number(large.args[3]) > Number(small.args[3]))
  for (const state of ['opened', 'claimed', 'expired'] as const) { s.chests![0] = { ...chest, state }; assert.ok(!paint(s).some(c => c.method === 'drawImage' && (c.args[0] as { path?: string })?.path === 'chest')) }
})

test('53B actual field is readonly, keeps53A DPR2xzoom and paints red tells on the ground under bodies and player FX (11-23)', () => {
  const { s, e } = champion('dash')
  s.shots.push({ x: 100, y: 100, vx: 100, vy: 0, life: 1, kind: 'arrow', damage: 1, radius: 1, hit: [], angle: 0, tx: 200, ty: 100 })
  const before = JSON.stringify(s), calls = paint(s, { zoom: 1.8, x: C.width / 2, y: C.height / 2 })
  assert.equal(JSON.stringify(s), before)
  const transforms = calls.filter(c => c.method === 'setTransform').map(c => c.args)
  assert.deepEqual(transforms[0], [2, 0, 0, 2, 0, 0]); assert.equal(transforms[1]![0], 3.6); assert.equal(transforms.at(-1)![0], 2)
  const ray = calls.findIndex(c => c.method === 'drawImage' && (c.args[0] as { path?: string })?.path === 'arrow')
  const band = lanes(calls, 2 * B.dashWidth).find(c => c.path.some(p => p.method === 'lineTo' && p.args[0] === e.aimX))
  // 11-23 형 「패턴이 인물 위로 그려지는 건 이상하다 · 던파·테일즈위버도 그렇게 안 한다」 → 붉은 예고는 땅 표식 차례 (몸·내 효과가 그 위)
  assert.ok(band); assert.ok(calls.indexOf(band) < ray, 'red telegraph lies on the ground, under later player FX')
})
test('53B elite plaque stays above the real lower control lane seen in landscape play', () => {
  const { s, e } = champion('guard'); e.x = C.width * .7; e.y = C.height - 10
  const calls = paint(s), plate = calls.find(c => c.method === 'drawImage' && (c.args[0] as { path?: string })?.path === 'plate')
  assert.ok(plate)
  assert.ok(Number(plate.args[2]) + Number(plate.args[4]) + B.view.eliteHpHeight <= C.height * .78, 'name/HP must not share the lower22percent control lane')
})