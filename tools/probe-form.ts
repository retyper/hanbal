export {}
/**
 * 사법 프로브 — **활을 정말로 쥐고 있는가를 숫자로 본다.**
 *
 * 형의 반려 두 줄이 이 파일의 존재 이유다.
 *   "손이 활을 안 잡고 붕 떠 있는데다, 활시위를 당기면 활 잡은 위치가 오히려 손보다 앞으로 나가버려."
 *   "왼손은 확실히 활대를 잡아야 하고 오른손은 확실히 줄을 잡아야 해.
 *    당겨질 때는 활줄이 걸린 양끝이 뒤로 당겨져야 하고 왼손이 활을 잡은 곳은 고정되어야 하지 않겠냐."
 *
 * 이 데스크탑에서는 브라우저로 못 여니까(CLAUDE.md), Canvas2D를 **경로 전부를 기억하는**
 * 스텁으로 세우고 진짜 stickman.ts를 당김 0 → 만작까지 여러 번 그린 다음
 * 활 폴리라인·시위·주먹의 좌표로 아래 다섯 가지를 판정한다.
 *
 *   ① 활손 주먹이 활대(폴리라인) 위에 있는가 — 붕 떠 있으면 실패
 *   ② 활의 그립 지점이 당김과 무관하게 활손에 **고정**인가 — 앞으로 도망가면 실패
 *   ③ 시위가 걸린 양 끝(고자)이 당길수록 **뒤로** 물러나는가 (단조)
 *   ④ 시위손 주먹이 시위의 꺾이는 꼭짓점에 있는가 — 줄을 안 쥐었으면 실패
 *   ⑤ 당김 0에서 노크가 시위 위에 있는가 (시위가 활 앞으로 볼록하면 실패)
 *
 * 실행: node --experimental-strip-types tools/probe-form.ts
 */

interface Path {
  pts: Array<{ x: number; y: number }>
  style: string
  width: number
}
interface Dot {
  x: number
  y: number
  r: number
  style: string
}

const paths: Path[] = []
const dots: Dot[] = []

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
  private cur: Array<{ x: number; y: number }> = []
  /** 이번 경로에 arc가 섞였는가 — 머리·주먹은 arc 하나짜리 경로다. */
  private arcs: Dot[] = []

  setTransform(): void {}
  save(): void {}
  restore(): void {}
  beginPath(): void {
    this.cur = []
    this.arcs = []
  }
  moveTo(x: number, y: number): void {
    this.cur.push({ x, y })
  }
  lineTo(x: number, y: number): void {
    this.cur.push({ x, y })
  }
  quadraticCurveTo(cx: number, cy: number, x: number, y: number): void {
    // 곡선의 중간점을 하나 끼워 넣는다 (2차 베지어의 t=0.5). 폴리라인 근사로 충분하다.
    const p = this.cur[this.cur.length - 1]
    if (p !== undefined) {
      this.cur.push({ x: 0.25 * p.x + 0.5 * cx + 0.25 * x, y: 0.25 * p.y + 0.5 * cy + 0.25 * y })
    }
    this.cur.push({ x, y })
  }
  bezierCurveTo(_a: number, _b: number, _c: number, _d: number, x: number, y: number): void {
    this.cur.push({ x, y })
  }
  closePath(): void {}
  arcTo(): void {}
  setLineDash(): void {}
  translate(): void {}
  rotate(): void {}
  scale(): void {}
  roundRect(): void {}
  clip(): void {}
  arc(x: number, y: number, r: number): void {
    this.arcs.push({ x, y, r, style: '' })
  }
  ellipse(): void {}
  rect(): void {}
  fill(): void {
    for (const a of this.arcs) dots.push({ ...a, style: String(this.fillStyle) })
    this.arcs = []
  }
  stroke(): void {
    if (this.cur.length >= 2) {
      paths.push({ pts: this.cur.slice(), style: String(this.strokeStyle), width: this.lineWidth })
    }
  }
  fillRect(): void {}
  strokeRect(): void {}
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
  clientHeight = 800
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

const { drawArcher, bowHandScreenX, bowHandScreenY } = await import('../src/render/stickman.ts')
const { createCamera, resizeCamera, updateCamera, worldToScreenX, worldToScreenY } =
  await import('../src/render/camera.ts')
const { createWorld, step } = await import('../src/sim/world.ts')
const { getStage } = await import('../src/game/stages.ts')
import type { InputFrame, Stats } from '../src/sim/types.ts'

const STATS: Stats = { str: 14, steady: 8, stamina: 10, focus: 6 }

const canvas = new Canvas() as unknown as HTMLCanvasElement
const ctx = canvas.getContext('2d') as unknown as CanvasRenderingContext2D
const cam = createCamera()
resizeCamera(cam, canvas)

/** 당김을 target까지 올린 뒤 한 프레임 그린다. 기록은 그 프레임 것만 남는다. */
function frameAt(drawTarget: number): {
  hand: { x: number; y: number }
  anchor: { x: number; y: number }
  u: { x: number; y: number }
  draw: number
} {
  const w = createWorld(getStage(0), STATS)
  const hold: InputFrame = { aimX: 30, aimY: 2, drawing: true, steady: true }
  // 최소 한 스텝은 당긴다 — idle에서는 시위를 잡고 있지도 않으므로 잴 것이 없다.
  step(w, hold)
  // 붕괴하면 색이 경고 램프로 바뀌고 자세가 무너진다. 거기까지 가기 전에 멈춘다.
  for (let i = 0; i < 4000 && w.archer.draw < drawTarget && w.archer.phase !== 'collapsing'; i++) {
    step(w, hold)
  }
  updateCamera(cam, w, 0.016)
  updateCamera(cam, w, 0.016)
  paths.length = 0
  dots.length = 0
  drawArcher(ctx, cam, w, 1)
  const ux = Math.cos(w.archer.aimAngle)
  const uy = Math.sin(w.archer.aimAngle)
  return {
    hand: { x: bowHandScreenX(cam, w), y: bowHandScreenY(cam, w) },
    anchor: { x: worldToScreenX(cam, w.archer.x), y: worldToScreenY(cam, w.archer.y) },
    // 화면 좌표계는 y가 아래로 +다. 조준 방향의 화면 벡터.
    u: { x: ux, y: -uy },
    draw: w.archer.draw,
  }
}

function distToPath(p: Path, x: number, y: number): number {
  let best = Infinity
  for (let i = 1; i < p.pts.length; i++) {
    const a = p.pts[i - 1]
    const b = p.pts[i]
    if (a === undefined || b === undefined) continue
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len2 = dx * dx + dy * dy
    const t = len2 > 1e-9 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / len2)) : 0
    const d = Math.hypot(x - (a.x + dx * t), y - (a.y + dy * t))
    if (d < best) best = d
  }
  return best
}

let fails = 0
function check(ok: boolean, label: string, detail: string): void {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  ✗  '} ${label.padEnd(46)} ${detail}`)
}

const LEVELS = [0.0, 0.25, 0.5, 0.75, 0.98]
console.log('사법 프로브 — 활을 쥐었는가 (screen px, 1280x800, 챕터 1-1)\n')
console.log('당김    활대까지  그립고정   팁뒤로   시위손   노크-시위')
console.log('────────────────────────────────────────────────────────────')

const gripU: number[] = []
const tipBack: number[] = []
const rows: string[] = []

for (const lv of LEVELS) {
  const f = frameAt(lv)
  // 활 = 점이 가장 많은 경로 (팁·림·라이저로 8점). 색으로 찾지 않는 이유는 경고·만작 램프에서
  // 색이 바뀌기 때문이다 — 자세 검사가 색 변화에 넘어지면 안 된다.
  // 시위 = 그 활의 양 끝을 잇는 다른 경로. 정의상 고자 끝에 걸린 것이 시위다.
  let bp: Path | null = null
  for (const p of paths) if (bp === null || p.pts.length > bp.pts.length) bp = p
  if (bp === null || bp.pts.length < 6) {
    console.log(`  ✗ 당김 ${lv}: 활 경로를 못 찾았다`)
    fails++
    continue
  }
  const bowA = bp.pts[0] as { x: number; y: number }
  const bowB = bp.pts[bp.pts.length - 1] as { x: number; y: number }
  const sp = paths.find((p) => {
    if (p === bp || p.pts.length < 2) return false
    const a = p.pts[0] as { x: number; y: number }
    const b = p.pts[p.pts.length - 1] as { x: number; y: number }
    return Math.hypot(a.x - bowA.x, a.y - bowA.y) < 0.01 && Math.hypot(b.x - bowB.x, b.y - bowB.y) < 0.01
  })
  if (sp === undefined) {
    console.log(`  ✗ 당김 ${lv}: 시위 경로를 못 찾았다 (고자 끝에 걸린 선이 없다)`)
    fails++
    continue
  }

  // ① 활손 주먹이 활대 위에 있는가
  const handToBow = distToPath(bp, f.hand.x, f.hand.y)
  // 주먹 점 — 활손 자리에 몸색으로 찍힌 것
  const fist = dots.find((d) => Math.hypot(d.x - f.hand.x, d.y - f.hand.y) < 0.01)

  // ② 그립의 u 좌표 (앵커 기준). 당김과 무관하게 일정해야 한다.
  const gu = (f.hand.x - f.anchor.x) * f.u.x + (f.hand.y - f.anchor.y) * f.u.y
  gripU.push(gu)

  // ③ 시위가 걸린 양 끝 = 시위 경로의 처음과 끝. 앵커 기준 u가 작아질수록 뒤로 물러난 것.
  const t0 = sp.pts[0] as { x: number; y: number }
  const t1 = sp.pts[sp.pts.length - 1] as { x: number; y: number }
  const chordU = (((t0.x + t1.x) / 2 - f.anchor.x) * f.u.x + ((t0.y + t1.y) / 2 - f.anchor.y) * f.u.y)
  tipBack.push(gu - chordU)

  // ④ 시위손 주먹이 시위의 꺾이는 꼭짓점에 있는가 (당기는 중이므로 노크 = 손)
  const nock = sp.pts.length >= 3 ? (sp.pts[1] as { x: number; y: number }) : null
  const handDot = nock === null
    ? undefined
    : dots.find((d) => Math.hypot(d.x - nock.x, d.y - nock.y) < 0.01 && d.r < 30)

  // ⑤ 노크가 시위(현) 위 또는 뒤에 있는가 — 앞으로 볼록하면 시위를 안 맨 활이다
  const nockU = nock === null ? 0 : ((nock.x - f.anchor.x) * f.u.x + (nock.y - f.anchor.y) * f.u.y)

  rows.push(
    `${f.draw.toFixed(2)}    ${handToBow.toFixed(2).padStart(6)}px  ` +
    `${gu.toFixed(1).padStart(6)}px  ${(gu - chordU).toFixed(1).padStart(6)}px  ` +
    `${handDot === undefined ? '  없음' : '  있음'}  ${(nockU - chordU).toFixed(1).padStart(7)}px`,
  )

  if (lv === 0) {
    check(Math.abs(nockU - chordU) < 1.5, '당김 0: 노크가 시위 위에 있다', `${(nockU - chordU).toFixed(2)}px`)
  }
  check(handToBow < 1.5, `당김 ${lv}: 활손이 활대를 쥐었다`, `활대까지 ${handToBow.toFixed(2)}px`)
  check(fist !== undefined, `당김 ${lv}: 활손 주먹이 찍혔다`, fist === undefined ? '없음' : `r=${fist.r.toFixed(1)}px`)
  check(handDot !== undefined, `당김 ${lv}: 시위손이 줄을 쥐었다`, handDot === undefined ? '없음' : `r=${handDot.r.toFixed(1)}px`)
  check(nockU <= chordU + 1.5, `당김 ${lv}: 노크가 시위보다 앞에 없다`, `${(nockU - chordU).toFixed(2)}px`)
}

console.log('')
for (const r of rows) console.log('  ' + r)
console.log('')

// ② 그립 고정 — 당김이 그립의 u를 옮기면 안 된다 (형이 본 그 증상).
const gMin = Math.min(...gripU)
const gMax = Math.max(...gripU)
check(gMax - gMin < 1.0, '그립이 당김과 무관하게 고정이다', `흔들림 ${(gMax - gMin).toFixed(2)}px`)

// ③ 팁이 당길수록 뒤로 — 단조 증가
let mono = true
for (let i = 1; i < tipBack.length; i++) {
  if ((tipBack[i] as number) < (tipBack[i - 1] as number) - 0.5) mono = false
}
check(mono, '당길수록 시위 걸린 양끝이 뒤로 물러난다', tipBack.map((v) => v.toFixed(1)).join(' → '))
check(
  (tipBack[tipBack.length - 1] as number) > (tipBack[0] as number) + 2,
  '만작의 젖혀짐이 눈에 보일 만큼 깊다',
  `${(tipBack[0] as number).toFixed(1)}px → ${(tipBack[tipBack.length - 1] as number).toFixed(1)}px`,
)

console.log('')
if (fails > 0) {
  console.log(`실패 ${fails}건`)
  process.exit(1)
}
console.log('전부 통과')
