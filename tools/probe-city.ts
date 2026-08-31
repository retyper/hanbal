export {}
/**
 * 건물 프로브 — **건물이 제대로 쌓였는가, 그리고 적이 죽어도 남는가를 숫자로 본다.**
 *
 * 형의 반려 두 줄이 이 파일의 존재 이유다.
 *   "건물 1·2·3층으로 쌓으려면 좀 제대로 쌓고"
 *   "적군이 죽었는데 건물은 왜 없어져."
 *
 * 재는 것:
 *   ① 벽이 **땅에서** 자라는가 (허공에 뜬 창문 금지)
 *   ② 위아래로 선 사수 셋이 **한 건물**을 쓰는가 (벽 두 장이 포개지면 실패)
 *   ③ 층 간격이 일정한가 — 사수가 없는 층도 같은 간격으로 채워졌는가
 *   ④ 사수의 창이 정확히 층·열 위에 앉았는가
 *   ⑤ **적을 전부 죽인 뒤에도 건물이 똑같이 서 있는가** ← 형이 본 그 버그
 *
 * 실행: node --experimental-strip-types tools/probe-city.ts
 */

interface Box {
  x: number
  y: number
  w: number
  h: number
  style: string
}

const boxes: Box[] = []
const frames: Box[] = []

class Ctx2D {
  font = '10px sans-serif'
  textAlign = 'left'
  textBaseline = 'alphabetic'
  fillStyle: string | object = '#000'
  strokeStyle: string | object = '#000'
  lineWidth = 1
  lineCap = 'butt'
  lineJoin = 'miter'
  globalAlpha = 1

  setTransform(): void {}
  save(): void {}
  restore(): void {}
  beginPath(): void {}
  moveTo(): void {}
  lineTo(): void {}
  quadraticCurveTo(): void {}
  bezierCurveTo(): void {}
  closePath(): void {}
  arcTo(): void {}
  setLineDash(): void {}
  translate(): void {}
  rotate(): void {}
  scale(): void {}
  roundRect(): void {}
  clip(): void {}
  arc(): void {}
  ellipse(): void {}
  rect(): void {}
  fill(): void {}
  stroke(): void {}
  fillRect(x: number, y: number, w: number, h: number): void {
    boxes.push({ x, y, w, h, style: String(this.fillStyle) })
  }
  strokeRect(x: number, y: number, w: number, h: number): void {
    frames.push({ x, y, w, h, style: String(this.strokeStyle) })
  }
  clearRect(): void {}
  fillText(): void {}
  strokeText(): void {}
  measureText(): { width: number } {
    return { width: 0 }
  }
  createLinearGradient(): { addColorStop: () => void } {
    return { addColorStop: (): void => {} }
  }
  createRadialGradient(): { addColorStop: () => void } {
    return { addColorStop: (): void => {} }
  }
}

class Canvas {
  width = 0
  height = 0
  clientWidth = 1280
  clientHeight = 720
  private c2d = new Ctx2D()
  getContext(): Ctx2D {
    return this.c2d
  }
  addEventListener(): void {}
  removeEventListener(): void {}
  getBoundingClientRect(): { left: number; top: number; width: number; height: number } {
    return { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight }
  }
  style = { setProperty: (): void => {} }
}

const g = globalThis as unknown as Record<string, unknown>
g['devicePixelRatio'] = 1
g['document'] = { addEventListener: (): void => {}, removeEventListener: (): void => {}, hidden: false }
g['window'] = { addEventListener: (): void => {}, removeEventListener: (): void => {} }

const { drawBuildings, drawBuildingFronts, windowOf, invalidateBuildings } =
  await import('../src/render/buildings.ts')
const { createCamera, resizeCamera, updateCamera, worldToScreenX, worldToScreenY } =
  await import('../src/render/camera.ts')
const { createWorld } = await import('../src/sim/world.ts')
import type { StageDef, Stats, World } from '../src/sim/types.ts'

const STATS: Stats = { str: 10, steady: 6, stamina: 8, focus: 4 }

/** 위아래로 셋 + 옆에 하나 — "1·2·3층" 그 자체를 재는 판. */
const TOWER: StageDef = {
  id: 'probe-tower',
  seed: 7,
  arrows: 9,
  targetScore: 100,
  wind: 0,
  targets: [
    { kind: 'archer', x: 18, y: 1.6, r: 0.63, hp: 2, look: 1 },
    { kind: 'archer', x: 18, y: 4.2, r: 0.63, hp: 2, look: 1 },
    { kind: 'archer', x: 18, y: 6.8, r: 0.63, hp: 2, look: 2 },
    { kind: 'archer', x: 30, y: 3.0, r: 0.63, hp: 2, look: 1 },
  ],
}

const canvas = new Canvas() as unknown as HTMLCanvasElement
const ctx = canvas.getContext('2d') as unknown as CanvasRenderingContext2D
const cam = createCamera()
resizeCamera(cam, canvas)

/** render/buildings.ts 의 COL.wall · COL.dark 와 같은 값이어야 한다 (색을 바꾸면 여기도). */
const WALL = '#373e4b'
const DARK = '#1c232e'

function render(w: World): void {
  boxes.length = 0
  frames.length = 0
  drawBuildings(ctx, cam, w)
  drawBuildingFronts(ctx, cam)
}

let fails = 0
function check(ok: boolean, label: string, detail: string): void {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  ✗  '} ${label.padEnd(44)} ${detail}`)
}

const w = createWorld(TOWER, STATS)
for (let i = 0; i < 8; i++) updateCamera(cam, w, 0.016)
render(w)

console.log('건물 프로브 — 1·2·3층으로 제대로 쌓였는가 (1280x720)\n')

const walls = boxes.filter((b) => b.style === WALL)
const gy = worldToScreenY(cam, 0)

// ① 벽이 땅에서 자란다
check(walls.length === 2, '건물이 둘이다 (탑 하나 + 옆 하나)', `벽 ${walls.length}장`)
const tower = walls.find((b) => b.x < worldToScreenX(cam, 24)) as Box | undefined
check(tower !== undefined, '탑의 벽을 찾았다', tower === undefined ? '없음' : `x=${tower.x.toFixed(0)}`)
if (tower !== undefined) {
  check(Math.abs(tower.y + tower.h - gy) < 0.5, '벽이 땅(y=0)까지 내려온다', `밑단 ${(tower.y + tower.h).toFixed(1)} vs 지면 ${gy.toFixed(1)}`)
}

// ② 사수 셋이 한 벽을 쓴다 — 겹치는 벽이 없어야 한다
let overlap = 0
for (let i = 0; i < walls.length; i++) {
  for (let j = i + 1; j < walls.length; j++) {
    const a = walls[i] as Box
    const b = walls[j] as Box
    if (a.x < b.x + b.w && b.x < a.x + a.w) overlap++
  }
}
check(overlap === 0, '벽이 서로 포개지지 않는다', `겹침 ${overlap}쌍`)

// ③ 층 간격이 일정한가 — 창(빈 창 + 사수 창)의 y를 모아 본다
const winY: number[] = []
for (const b of boxes) {
  if (b.style === WALL || b.w > 200) continue
  const cx = b.x + b.w / 2
  if (cx > worldToScreenX(cam, 24)) continue
  const cy = b.y + b.h / 2
  if (b.h > 6 && !winY.some((v) => Math.abs(v - cy) < 1)) winY.push(cy)
}
winY.sort((p, q) => p - q)
const gaps: number[] = []
for (let i = 1; i < winY.length; i++) gaps.push((winY[i] as number) - (winY[i - 1] as number))
const gMin = gaps.length > 0 ? Math.min(...gaps) : 0
const gMax = gaps.length > 0 ? Math.max(...gaps) : 0
check(winY.length >= 3, '탑에 층이 여럿이다', `${winY.length}층`)
check(gaps.length > 0 && gMax - gMin < 1.0, '층 간격이 일정하다', `${gMin.toFixed(1)} ~ ${gMax.toFixed(1)}px`)

// ④ 사수의 창이 층 위에 앉았는가
for (const t of w.targets) {
  if (t === undefined || t.kind !== 'archer' || (t.look !== 1 && t.look !== 2)) continue
  const win = windowOf(t)
  if (win === null) {
    check(false, `사수 #${t.id}의 창`, '없음')
    continue
  }
  const dy = Math.abs(worldToScreenY(cam, win.cy) - worldToScreenY(cam, t.y))
  const dx = Math.abs(worldToScreenX(cam, win.cx) - worldToScreenX(cam, t.x))
  check(dx < 1 && dy < 1, `사수 #${t.id}가 제 층·열에 앉았다`, `어긋남 ${dx.toFixed(2)}, ${dy.toFixed(2)}px`)
}

// ⑤ ★ 적을 전부 죽인다. 건물은 그대로여야 한다.
const before = JSON.stringify(boxes.map((b) => [b.x | 0, b.y | 0, b.w | 0, b.h | 0, b.style]))
const framesBefore = frames.length
for (const t of w.targets) {
  if (t !== undefined && t.kind === 'archer') t.alive = false
}
render(w)
const after = JSON.stringify(boxes.map((b) => [b.x | 0, b.y | 0, b.w | 0, b.h | 0, b.style]))
check(before === after, '적이 전멸해도 건물이 그대로다', before === after ? '동일' : '달라졌다')
check(frames.length === framesBefore, '창틀도 그대로 남는다', `${framesBefore} → ${frames.length}`)
check(boxes.filter((b) => b.style === DARK).length > 0, '사수가 없어도 창은 빈 채로 남는다', `${boxes.filter((b) => b.style === DARK).length}칸`)

// 판이 바뀌면 다시 굽는다
invalidateBuildings()
const w2 = createWorld({ ...TOWER, id: 'probe-empty', targets: [{ kind: 'static', x: 20, y: 2 }] }, STATS)
render(w2)
check(boxes.length === 0, '창문의 사수가 없는 판엔 건물이 없다', `상자 ${boxes.length}개`)

console.log('')
if (fails > 0) {
  console.log(`실패 ${fails}건`)
  process.exit(1)
}
console.log('전부 통과')
