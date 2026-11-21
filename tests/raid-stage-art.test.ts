// 51-2 스테이지마다 새 적 그림 — 판 셈(종류·능력치·스폰 표)은 그대로, 그리기만 HAEBI_STAGES.<스테이지>.art 의 그림으로.
// 가짜 붓으로 무엇을 어느 키로 찍었는지 적는다 (브라우저 없음 · 판 상태는 읽기만).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { HAEBI_STAGES as ST, HAEBI_MOBS as M, HAEBI_CHAMPION as B } from '../src/tune/params.ts'
import { createHaebi, spawnMob, type Effect, type HaebiRun, type MobKind, type StageId } from '../src/raid/haebi.ts'
import { drawField, imagePaths } from '../src/raid/haebi-view.ts'

type Art = { file: string; scale: number }
const root = new URL('../', import.meta.url)
const STAGES = Object.keys(ST) as StageId[]
const arts = (stage: StageId) => Object.entries(ST[stage].art as Partial<Record<string, Art>>) as [MobKind, Art][]
const images = new Map(imagePaths.map(p => [p, { path: p, width: 5120, height: 256, complete: true } as unknown as HTMLImageElement]))
/** 찍은 그림의 길과 그린 키(drawImage 의 dh) */
function draws(s: HaebiRun) {
  const out: { path: string; h: number }[] = [], state: Record<string | symbol, unknown> = { canvas: { width: 1120, height: 720 }, globalAlpha: 1, lineWidth: 1 }, stack: Record<string | symbol, unknown>[] = []
  const ctx = new Proxy(state, {
    get(o, k) {
      if (k in o) return o[k]
      return (...a: unknown[]) => {
        if (k === 'save') stack.push({ ...state }); else if (k === 'restore') Object.assign(state, stack.pop())
        else if (k === 'drawImage') { const p = (a[0] as { path?: string })?.path; if (p) out.push({ path: p, h: a.length === 9 ? a[8] as number : NaN }) }
        else if (k === 'measureText') return { width: 12 }
        else if (String(k).includes('Gradient')) return { addColorStop() {} }
        return undefined
      }
    },
    set(o, k, v) { o[k] = v; return true },
  }) as unknown as CanvasRenderingContext2D
  const before = JSON.stringify(s)
  drawField(ctx, images, s, null)
  assert.equal(JSON.stringify(s), before, 'renderer must not mutate serialized state')
  return out
}

test('stage art: real 20-cell strips (144 tall) · preloaded · only for kinds that spawn in that stage · size factor sane', () => {
  let n = 0
  for (const stage of STAGES) {
    const kinds = new Set<string>([...ST[stage].tiers.flat(), ...(stage in B.stages ? [B.stages[stage as keyof typeof B.stages].minion] : [])])
    for (const [kind, art] of arts(stage)) {
      n++
      assert.ok(kind in M, `${stage}: ${kind} is not a mob kind`)
      assert.ok(kinds.has(kind), `${stage}: ${kind} never spawns in this stage`)
      const png = readFileSync(new URL(`public/realm/anim-px/${art.file}.png`, root))
      assert.equal(png.toString('ascii', 1, 4), 'PNG')
      assert.equal(png.readUInt32BE(20), 144, `${art.file}: cell height`)
      assert.equal(png.readUInt32BE(16) % 20, 0, `${art.file}: 20 cells`)
      assert.equal(imagePaths.filter(p => p === `anim-px/${art.file}.png`).length, 1, `${art.file}: startup preload`)
      assert.ok(art.scale > .95 && art.scale < 1.45, `${art.file}: scale ${art.scale}`)
    }
  }
  assert.equal(n, 15, 'Codex 67 delivered 14 stage enemies + Codex 75 forest barrage archer')
  assert.deepEqual(arts('trial'), [], 'trial keeps the old bandits')
})

test('drawField picks the stage picture at mobHeight × scale for live and dying mobs · other stages keep bandit-<kind>', () => {
  for (const stage of STAGES) {
    for (const kind of ['club', 'runner', 'shield', 'berserker', 'iron', 'archer'] as MobKind[]) {
      const s = createHaebi(7, 'stage', 'axe', { stage }); s.spawn = 1e9; s.nextElite = 1e9; s.nextBarrage = 1e9
      spawnMob(s, kind, undefined, true)
      const art = (ST[stage].art as Partial<Record<string, Art>>)[kind]
      const path = `anim-px/${art ? art.file : `bandit-${kind}`}.png`, h = M[kind as keyof typeof M] as { height: number }
      const live = draws(s).filter(d => d.path === path)
      assert.equal(live.length, 1, `${stage}/${kind}: ${path}`)
      assert.ok(Math.abs(live[0]!.h - h.height * (art?.scale ?? 1)) < 1e-9, `${stage}/${kind}: draw height`)
      if (art) assert.equal(draws(s).filter(d => d.path === `anim-px/bandit-${kind}.png`).length, 0, `${stage}/${kind}: old bandit not drawn`)
      // 쓰러지는 몸(맞음 칸)도 같은 그림 · 같은 키
      const e = s.enemies[0]!; s.enemies.length = 0
      s.fx.push({ kind: 'death', x: e.x, y: e.y, x2: 0, y2: 0, r: 20, angle: 0, life: .4, total: .5, color: '#fff', mob: kind, face: 1 } as Effect)
      const dead = draws(s).filter(d => d.path === path)
      assert.equal(dead.length, 1, `${stage}/${kind}: death body`)
      assert.ok(Math.abs(dead[0]!.h - h.height * (art?.scale ?? 1)) < 1e-9)
    }
  }
})
