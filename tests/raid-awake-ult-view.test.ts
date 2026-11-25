import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHaebi, stepHaebi, runDuration, type Kit, type Effect } from '../src/raid/haebi.ts'
import { drawField, imagePaths } from '../src/raid/haebi-view.ts'
import { HAEBI_AWAKEN_ULT, HAEBI_ULT } from '../src/tune/params.ts'

const kits: Kit[] = ['sword', 'axe', 'bow', 'spear', 'dagger', 'magic', 'sling']
const pathOf = (kit: Kit) => `raid/fx/awaken/${kit}.png`
function brush() {
  const fills: { style: unknown; alpha: unknown }[] = [], drawCalls: { img: unknown; clipped: boolean; args: unknown[] }[] = [], draws: unknown[] = [], clips: unknown[][] = [], banned: string[] = [], state: Record<string, unknown> = { globalAlpha: 1, globalCompositeOperation: 'source-over', clipped: false }, stack: Record<string, unknown>[] = []
  const ctx = new Proxy({ canvas: { width: 1600, height: 900 }, save() { stack.push({ ...state }) }, restore() { Object.assign(state, stack.pop()) }, drawImage(img: unknown, ...args: unknown[]) { draws.push(img); drawCalls.push({ img, clipped: state['clipped'] === true, args }) }, fillRect() { fills.push({ style: state['fillStyle'], alpha: state['globalAlpha'] }) }, clip() { state['clipped'] = true }, rect(...v: unknown[]) { clips.push(v) }, arc(...v: unknown[]) { clips.push(v) }, createRadialGradient() { return { addColorStop() {} } } }, {
    get: (t, k) => k in t ? t[k as keyof typeof t] : k in state ? state[k as string] : () => {},
    set: (_t, k, v) => { if (k === 'filter' || k === 'shadowBlur') banned.push(String(k)); state[k as string] = v; return true },
  }) as unknown as CanvasRenderingContext2D
  return { ctx, draws, drawCalls, clips, banned, fills }
}
function run(kit: Kit, awakened: boolean) {
  const s = createHaebi(7, 'stage', kit, { simRules: '56A', permanentAwake: awakened, appearanceAwake: false })
  const f: Effect = { x: 500, y: 450, x2: 880, y2: 450, angle: 0, r: kit === 'magic' ? 0 : 80, life: .4, total: .5, kind: kit === 'magic' ? 'ult' : 'skill', ult: kit, color: '#ffd66a', awakened }
  s.fx = [f]; return s
}
test('56B awake ult uses its selected authored particle and does not mutate a run', () => {
  for (const kit of kits) {
    const s = run(kit, true), before = structuredClone(s), art = { complete: true, naturalWidth: 1024, naturalHeight: 1536, width: 1024, height: 1536 }
    const { ctx, draws, drawCalls, banned } = brush()
    drawField(ctx, new Map([[pathOf(kit), art as HTMLImageElement]]), s, null)
    assert.ok(draws.includes(art), `${kit}: selected native awake particle must be drawn`)
    if (kit === 'bow' || kit === 'magic') assert.ok(drawCalls.filter(d => d.img === art).every(d => !d.clipped), '2.5D air billboard is intentionally above the ground clip; anchor contract is tested separately')
    else assert.ok(drawCalls.filter(d => d.img === art).every(d => d.clipped), 'other five native attacks retain their original ground geometry clip')
    assert.deepEqual(s, before); assert.deepEqual(banned, [])
  }
})
test('normal ult does not borrow awake art and seven optional textures are not eager imagePaths', () => {
  for (const kit of kits) {
    assert.ok(!imagePaths.includes(pathOf(kit)))
    const art = { complete: true, naturalWidth: 1024, naturalHeight: 1536, width: 1024, height: 1536 }, { ctx, draws } = brush()
    drawField(ctx, new Map([[pathOf(kit), art as HTMLImageElement]]), run(kit, false), null)
    assert.ok(!draws.includes(art))
  }
})

// Geometry/cache checks are render-unit contracts, not real owned-account or browser evidence.
import { awakeUltGeometry, drawAwakeUlt, awakeCastDim, awakeAirParticles } from '../src/raid/awake-ult-view.ts'
import { awakeUltPath, prewarmAwakeUlt } from '../src/raid/awake-ult-art.ts'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

test('awake line clip matches existing collision bounds; circular pulses use their actual radius', () => {
  for (const kit of ['sword', 'axe'] as Kit[]) {
    const f = run(kit, true).fx[0]!, { ctx, clips } = brush()
    assert.deepEqual(awakeUltGeometry(f, 240), { kind: 'line', length: 380, radius: 80, burst: kit === 'axe' ? 240 : 0 })
    const art = { complete: true, naturalWidth: 1024 } as HTMLImageElement
    drawAwakeUlt(ctx, new Map([[awakeUltPath(kit), art]]), f, .3, 240)
    assert.deepEqual(clips[0], [-40, -80, 420, 160])
    if (kit === 'axe') assert.ok(clips.some(c => c[2] === 240), 'only axe adds its existing origin burst')
  }
  for (const kit of ['spear', 'dagger', 'sling'] as Kit[]) assert.deepEqual(awakeUltGeometry(run(kit, true).fx[0]!), { kind: 'disc', radius: 80 })
  assert.deepEqual(awakeUltGeometry(run('bow', true).fx[0]!), { kind: 'line', length: 380, radius: 80, burst: 0 })
  const magic = run('magic', true).fx[0]!
  assert.deepEqual(awakeUltGeometry(magic), { kind: 'target' })
  assert.deepEqual(awakeUltGeometry({ ...magic, kind: 'skill' }), { kind: 'none' })
})
test('sword has exactly three ghosts on its actual line; authored rendering is read-only and random-free', () => {
  const f = run('sword', true).fx[0]!, before = structuredClone(f), ghosts: number[][] = [], { ctx, banned } = brush()
  const random = Math.random; Math.random = () => { throw Error('render RNG forbidden') }
  try {
    assert.equal(drawAwakeUlt(ctx, new Map([[awakeUltPath('sword'), { complete: true, naturalWidth: 2172 } as HTMLImageElement]]), f, .3, 0, (x, y, a) => ghosts.push([x, y, a])), true)
    assert.deepEqual(ghosts.map(g => g.slice(0, 2)), [[595, 450], [690, 450], [785, 450]])
    assert.ok(ghosts.every(g => g[2]! > 0 && g[2]! <= .32)); assert.deepEqual(f, before); assert.deepEqual(banned, [])
  } finally { Math.random = random }
})
test('selected texture prewarm deduplicates only that kit, decodes before exposure, and fails softly', async () => {
  const images = new Map<string, HTMLImageElement>(), paths: string[] = []; let decodes = 0
  const art = { complete: true, naturalWidth: 1024, decode: async () => { decodes++ } } as HTMLImageElement
  const load = async (path: string) => { paths.push(path); assert.equal(images.size, 0); return art }
  const a = prewarmAwakeUlt(images, 'bow', load), b = prewarmAwakeUlt(images, 'bow', load)
  assert.equal(a, b); assert.equal(await a, true); assert.deepEqual(paths, [awakeUltPath('bow')]); assert.equal(decodes, 1); assert.equal(images.size, 1)
  assert.equal(await prewarmAwakeUlt(images, 'bow', load), true); assert.equal(paths.length, 1)
  const failed = new Map<string, HTMLImageElement>()
  assert.equal(await prewarmAwakeUlt(failed, 'axe', async () => { throw Error('HTTP failure') }), false)
  assert.equal(await prewarmAwakeUlt(failed, 'spear', async () => ({ ...art, decode: async () => { throw Error('decode failure') } } as HTMLImageElement)), false)
  assert.equal(failed.size, 0)
  const { ctx, draws } = brush()
  assert.equal(drawAwakeUlt(ctx, failed, run('axe', true).fx[0]!, .3), false); assert.equal(draws.length, 0)
})
test('canvas dim is accepted-manual awake sequence and cast progress only', () => {
  assert.equal(awakeCastDim(null), 0)
  const c = { kind: 'ult' as const, tru: false, awakened: true, seq: 1, t: .5, total: 1 }
  assert.equal(awakeCastDim(c), HAEBI_AWAKEN_ULT.dim)
  assert.equal(awakeCastDim({ ...c, t: 1 }), 0); assert.equal(awakeCastDim({ ...c, t: 0 }), 0)
  assert.equal(awakeCastDim({ ...c, awakened: false }), 0)
  assert.equal(awakeCastDim({ ...c, kind: 'wake' }), 0)
  assert.equal(awakeCastDim({ kind: 'ult', tru: true, t: .5, total: 1 }), 0)
  assert.equal(awakeCastDim({ ...c, seq: 0 }), 0)
})
test('shipped seven particle PNGs are byte-identical native RAW, not cropped or regenerated', () => {
  const sha: Partial<Record<Kit, string>> = {
    sword: '27a88ff1c9a570707534bcbee4fd5bc5014945ef825f2a4a39dbb899e9b40b21', axe: 'ddffa5b99608aee44d2a87cdd183a0311cd8c34453ee984e2add557318f17aba',
    bow: '6d5c9ba70b7a8ee3f323abcd1249c4bf8096e1dae49651e519256fa183eea020', spear: '38207ee7b6869f0dfaf584ce446e8a0c00e03ad18bd1c41ff8ab1792b3cfa98d',
    dagger: '558d843db202441dba215af9899423b6db53ee9cb28d65f076e858697fa06896', magic: '6d9ca3ce05a1f0b537289048631783dcacc9a2ef21f489ca7e1b1993142fe691',
    sling: '0168fef2bf6ee38533c4cf65daef5376b61246dc210c48d7e438de93e38e873d',
  }
  for (const kit of kits) {
    const data = readFileSync(new URL(`../public/realm/${awakeUltPath(kit)}`, import.meta.url))
    assert.equal(createHash('sha256').update(data).digest('hex'), sha[kit])
    assert.equal(data.readUInt32BE(12), 0x49484452)
  }
})


test('terminal cast remaining after actual timeout never leaves the canvas dimmed', () => {
  const s = createHaebi(7, 'stage', 'sword', { simRules: '56B', permanentAwake: true, appearanceAwake: false })
  s.level = 2; s.spawn = s.nextElite = s.nextBarrage = 1e9; s.boss = true; s.t = runDuration(s) - .015
  stepHaebi(s, { x: 0, y: 0, skill: true }, .01)
  for (let i = 0; i < 5 && s.state === 'playing'; i++) stepHaebi(s, { x: 0, y: 0 }, .05)
  assert.equal(s.state, 'lost'); assert.ok(s.cast?.seq); assert.ok(awakeCastDim(s.cast) > 0, 'actual timeout retains a mid-progress accepted cast')
  const playing = structuredClone(s); playing.state = 'playing'
  const active = brush(); drawField(active.ctx, new Map(), playing, null)
  assert.ok(active.fills.some(f => f.style === '#080b13' && Number(f.alpha) > 0), 'playing positive control must dim')
  for (const state of ['lost', 'won'] as const) {
    // Lost comes from the real timeout above; won is the corresponding read-only render-state contract.
    const terminal = structuredClone(s); terminal.state = state
    const before = structuredClone(terminal), out = brush(); drawField(out.ctx, new Map(), terminal, null)
    assert.equal(out.fills.filter(f => f.style === '#080b13' && Number(f.alpha) > 0).length, 0, `${state}: terminal canvas must not retain cast dim`)
    assert.deepEqual(terminal, before)
  }
})


test('2.5D bow has a full 250px core above the ground anchor with the same 13 draws', () => {
  const f = { ...run('bow', true).fx[0]!, r: HAEBI_ULT.bow.width }, art = { complete: true, naturalWidth: 1024 } as HTMLImageElement, out = brush()
  drawAwakeUlt(out.ctx, new Map([[awakeUltPath('bow'), art]]), f, .3)
  const calls = out.drawCalls.filter(d => d.img === art)
  assert.equal(calls.length, 13)
  assert.ok(Math.abs(Math.max(...calls.map(c => Number(c.args[3]) * 1308 / 1536)) - HAEBI_AWAKEN_ULT.bowArtHeight) < 1e-9)
})
test('2.5D magic has a full 200px main flame above its target with the same three draws', () => {
  const f = run('magic', true).fx[0]!, art = { complete: true, naturalWidth: 1024 } as HTMLImageElement, out = brush()
  drawAwakeUlt(out.ctx, new Map([[awakeUltPath('magic'), art]]), f, .3)
  const calls = out.drawCalls.filter(d => d.img === art)
  assert.equal(calls.length, 3)
  assert.ok(Math.abs(Math.max(...calls.map(c => Number(c.args[3]) * 1189 / 1536)) - HAEBI_AWAKEN_ULT.magicArtHeight) < 1e-9)
})


test('2.5D arrows preserve the original lane anchors at every aim; only positive air height is projected and ends at ground', () => {
  for (const angle of [0, Math.PI / 2, -.7]) for (const age of [0, .18 / HAEBI_ULT.bow.fx, .35 / HAEBI_ULT.bow.fx, 1]) {
    const len = HAEBI_ULT.bow.length, f = { ...run('bow', true).fx[0]!, r: HAEBI_ULT.bow.width, angle, x2: 500 + Math.cos(angle) * len, y2: 450 + Math.sin(angle) * len }, before = structuredClone(f)
    const particles = awakeAirParticles(f, age); assert.equal(particles.length, 13)
    particles.forEach((p, i) => {
      const phase = (age * 2.4 + i * .19) % 1, along = len * (i + .5) / 13, across = (phase - .5) * f.r * .28
      assert.ok(Math.abs(p.anchorX - (f.x + Math.cos(angle) * along - Math.sin(angle) * across)) < 1e-9)
      assert.ok(Math.abs(p.anchorY - (f.y + Math.sin(angle) * along + Math.cos(angle) * across)) < 1e-9)
      assert.ok(along > -f.r / 2 && along < len && Math.abs(across) < f.r)
      assert.equal(p.tipX, p.anchorX); assert.equal(p.tipY, p.anchorY - p.z); assert.ok(p.z >= 0 && p.z <= HAEBI_AWAKEN_ULT.bowFallHeight)
      assert.equal(p.artHeight, HAEBI_AWAKEN_ULT.bowArtHeight); assert.equal(p.rotation, 0)
      assert.deepEqual([p.sourceTipX, p.sourceTipY], [512, 1421.5]); if (age === 1) { assert.equal(p.z, 0); assert.equal(p.tipY, p.anchorY) }
    })
    assert.deepEqual(f, before)
  }
})
test('2.5D magic stays attached to the same hit target; native source tips and aspect ratio are preserved without RNG', () => {
  const random = Math.random; Math.random = () => { throw Error('air renderer RNG forbidden') }
  try {
    for (const kit of ['bow', 'magic'] as const) {
      const f = run(kit, true).fx[0]!, before = structuredClone(f), particles = awakeAirParticles(f, .3), art = { complete: true, naturalWidth: 1024 } as HTMLImageElement, out = brush()
      drawAwakeUlt(out.ctx, new Map([[awakeUltPath(kit), art]]), f, .3)
      assert.equal(out.drawCalls.length, kit === 'bow' ? 13 : 3)
      out.drawCalls.forEach((c, i) => {
        const p = particles[i]!, k = p.artHeight / (kit === 'bow' ? 1308 : 1189)
        assert.equal(c.args.length, 4); assert.equal(c.clipped, false)
        assert.ok(Math.abs(Number(c.args[0]) + p.sourceTipX * k) < 1e-9); assert.ok(Math.abs(Number(c.args[1]) + p.sourceTipY * k) < 1e-9)
        assert.ok(Math.abs(Number(c.args[2]) / 1024 - Number(c.args[3]) / 1536) < 1e-9)
        if (kit === 'magic') { assert.deepEqual([p.anchorX, p.anchorY, p.tipX, p.tipY, p.z], [f.x, f.y, f.x, f.y, 0]); assert.deepEqual([p.sourceTipX, p.sourceTipY], [320, 1320.5]) }
      })
      assert.deepEqual(f, before); assert.deepEqual(out.banned, [])
    }
  } finally { Math.random = random }
})

