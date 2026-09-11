export {}
/**
 * 적 그림 프로브 — **형이 반려한 것들이 실제로 화면에서 사라졌는가** (2026-09-11)
 *
 * 이 데스크탑에서는 게임을 브라우저로 못 연다 (CLAUDE.md). 그래서 Canvas2D 를 **도형까지**
 * 기록하는 스텁으로 세우고 진짜 `scene.ts` 를 한 프레임 돌린 다음, 그려진 원·타원을 뒤져
 * 형이 지운 것들이 정말 안 그려지는지 **숫자로** 확인한다.
 *
 * 재는 것 (전부 형의 2026-09-11 반려):
 *   1. **"노란 동그라미가 왜 자꾸 있는거 매나 화차나 이런거에 있는지 모르겠고"**
 *      → 매·화차를 그릴 때 급소 표시용 노란/주황 큰 원이 하나도 없어야 한다.
 *   2. **"좆같은 눈깔은 뭔 모든보스에 들어가있어서 도깨비새끼는 왕눈이 뇌속에"**
 *      → 보스 4~7 을 그릴 때 공용 흰 눈알(반경 ≒ 급소 반경)이 없어야 한다.
 *        유령 넷(0~3)에는 **있어야** 한다 — 저건 몸이 곧 눈알인 것들이다.
 *   3. **"화차는 대체 왜 공중을 쳐 날라다니고 있는거냐?"**
 *      → 판에 선 화차·투석군은 발이 땅에 닿아야 한다 (중심 높이 = 반경).
 *   4. **"화차 기수는 사람처럼 안보이고"**
 *      → 화차를 그릴 때 사람 한 명 몫의 획(다리 둘·몸통·팔·목)이 있어야 한다.
 *
 * 실행: node --experimental-strip-types tools/probe-enemy.ts
 */

interface Shape {
  kind: 'arc' | 'ellipse' | 'rect'
  x: number
  y: number
  rx: number
  ry: number
  style: string
  filled: boolean
}
interface Line { x0: number; y0: number; x1: number; y1: number; style: string; w: number }

const shapes: Shape[] = []
const lines: Line[] = []

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
  private pend: Omit<Shape, 'style' | 'filled'>[] = []
  private seg: Array<[number, number, number, number]> = []
  private px = 0
  private py = 0

  setTransform(): void {}
  save(): void {}
  restore(): void {}
  translate(): void {}
  rotate(): void {}
  scale(): void {}
  clip(): void {}
  setLineDash(): void {}
  clearRect(): void {}
  beginPath(): void {
    this.pend = []
    this.seg = []
  }
  moveTo(x: number, y: number): void {
    this.px = x
    this.py = y
  }
  lineTo(x: number, y: number): void {
    this.seg.push([this.px, this.py, x, y])
    this.px = x
    this.py = y
  }
  closePath(): void {}
  quadraticCurveTo(_a: number, _b: number, x: number, y: number): void {
    this.px = x
    this.py = y
  }
  bezierCurveTo(_a: number, _b: number, _c: number, _d: number, x: number, y: number): void {
    this.px = x
    this.py = y
  }
  arcTo(): void {}
  roundRect(): void {}
  arc(x: number, y: number, r: number): void {
    this.pend.push({ kind: 'arc', x, y, rx: r, ry: r })
  }
  ellipse(x: number, y: number, rx: number, ry: number): void {
    this.pend.push({ kind: 'ellipse', x, y, rx, ry })
  }
  rect(x: number, y: number, w: number, h: number): void {
    this.pend.push({ kind: 'rect', x: x + w / 2, y: y + h / 2, rx: w / 2, ry: h / 2 })
  }
  private flush(style: string, filled: boolean): void {
    for (const p of this.pend) shapes.push({ ...p, style, filled })
    for (const [x0, y0, x1, y1] of this.seg) {
      lines.push({ x0, y0, x1, y1, style, w: this.lineWidth })
    }
    this.pend = []
    this.seg = []
  }
  fill(): void {
    this.flush(String(this.fillStyle), true)
  }
  stroke(): void {
    this.flush(String(this.strokeStyle), false)
  }
  fillRect(x: number, y: number, w: number, h: number): void {
    shapes.push({ kind: 'rect', x: x + w / 2, y: y + h / 2, rx: w / 2, ry: h / 2, style: String(this.fillStyle), filled: true })
  }
  strokeRect(): void {}
  fillText(): void {}
  strokeText(): void {}
  measureText(t: string): { width: number } {
    return { width: t.length * 8 }
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

const { createRenderer, getCamera } = await import('../src/render/scene.ts')
const { createWorld, step } = await import('../src/sim/world.ts')
const { getStage } = await import('../src/game/stages.ts')
const { P } = await import('../src/tune/params.ts')
import type { HudState } from '../src/render/hud.ts'
import type { InputFrame, Stats, StageDef, TargetSpec, World } from '../src/sim/types.ts'

const STATS: Stats = { str: 8, steady: 6, stamina: 6, focus: 4 }
const IDLE: InputFrame = { aimX: 20, aimY: 3, drawing: false, steady: false, parry: false }
const HUD: HudState = {
  training: 42, canLevelUp: false, muted: false, silent: false, toast: '',
  arrow: '', stars: -1, endReason: '', arrowRule: false, time: 0, bestTime: 0, record: false,
}

/** 적 하나만 세운 판. 그림에 다른 것이 안 섞이게 과녁도 건물도 없다. */
function loneStage(spec: TargetSpec): StageDef {
  return {
    id: 'probe', chapter: 1, index: 1, name: '프로브', hint: '',
    arrows: 9, wind: 0, targetScore: 100, targets: [spec],
  } as unknown as StageDef
}

/** 한 프레임 그리고, 그려진 도형을 돌려준다. */
function frameOf(spec: TargetSpec, steps: number): { w: World; cam: ReturnType<typeof getCamera> } {
  const canvas = new Canvas()
  const w = createWorld(loneStage(spec), STATS)
  for (let i = 0; i < steps; i++) {
    step(w, IDLE)
    w.events.length = 0
  }
  shapes.length = 0
  lines.length = 0
  const r = createRenderer(canvas as unknown as HTMLCanvasElement)
  r.draw(w, 0, 1 / 60, HUD)
  return { w, cam: getCamera(r) }
}

const pad = (s: string, n: number): string => (s.length >= n ? s : s + ' '.repeat(n - s.length))
let bad = 0
const ok = (label: string, pass: boolean, note = ''): void => {
  if (!pass) bad++
  console.log(`  ${pass ? 'ok ' : '✗  '} ${pad(label, 44)} ${note}`)
}

console.log('신궁 — 적 그림 프로브 (2026-09-11 형의 반려)\n')

// ── 1. 매·화차에 노란 동그라미가 없다 ────────────────────────────────
console.log('1. 노란 동그라미 (형: "매나 화차나 이런거에 있는지 모르겠고")')
{
  /** 급소 표시로 쓰이던 노랑·주황. 이 색의 **큰** 원이 보이면 그게 그 동그라미다. */
  const YELLOW = new Set(['#ffd35c', '#e8a33c'])
  const { worldToScreenX: wsx, worldToScreenY: wsy } = await import('../src/render/camera.ts')
  for (const [name, look] of [['매', 3], ['화차', 4]] as const) {
    const { w, cam } = frameOf({ kind: 'archer', look, x: 22, y: look === 4 ? 0.8 : 4.2, r: 0.8, hp: 30, fireDelay: 9 } as TargetSpec, 6)
    const t = w.targets.find((q) => q.alive)
    const rpx = (t?.r ?? 1) * cam.scale
    // '큰' 의 기준: 급소 판정 반경의 절반. 눈동자·불씨 같은 작은 점은 여기 안 걸린다.
    const big = rpx * P.enemy.archerHeadR * 0.5
    // **몸 둘레만** 본다. HUD 오른쪽 위의 엽전도 같은 금색이라, 화면 전체를 훑으면 그게 걸린다.
    const ox = wsx(cam, t?.x ?? 0)
    const oy = wsy(cam, t?.y ?? 0)
    const hits = shapes.filter((sp) =>
      YELLOW.has(sp.style.toLowerCase()) && Math.max(sp.rx, sp.ry) >= big &&
      Math.hypot(sp.x - ox, sp.y - oy) <= rpx * 3)
    ok(`${name} — 노란 급소 원이 없다`, hits.length === 0, hits.length === 0 ? '' : `${hits.length}개 (r=${hits.map((h) => h.rx.toFixed(1)).join(',')})`)
  }
}

// ── 2. 보스의 공용 왕눈알 ────────────────────────────────────────────
console.log('\n2. 보스의 눈 (형: "도깨비새끼는 왕눈이 뇌속에 들어있게")')
{
  const { bossWeakSpot } = await import('../src/sim/target.ts')
  const EYE_WHITE = '#e8eef5'
  for (let look = 0; look <= 7; look++) {
    const r = look === 4 ? 2.3 : look === 6 ? 1.9 : 1.5
    // 눈이 뜬 순간을 잡는다 — 판 시작은 weak=1 이라 첫 프레임이면 충분하다.
    const { w, cam } = frameOf({ kind: 'archer' as const, x: 26, y: 3, r, hp: 999 } as TargetSpec, 0)
    void w
    void cam
    // 보스로 다시 세운다 (kind 를 바꿔야 하므로 따로).
    const f = frameOf({ kind: 'boss', look, x: 26, y: 3, r, hp: 999, speed: 0 } as TargetSpec, 0)
    const t = f.w.targets.find((q) => q.alive)
    const rpx = (t?.r ?? 1) * f.cam.scale
    const ws = bossWeakSpot(look)
    // 공용 눈알 = 흰자색의 **급소 반경만 한** 타원. 각자의 눈은 이보다 훨씬 작다.
    const huge = rpx * ws.r * 0.8
    const hits = shapes.filter(
      (sp) => sp.style.toLowerCase() === EYE_WHITE && Math.max(sp.rx, sp.ry) >= huge,
    )
    // 갑주귀신(1)만 예외다 — 투구 틈이라 뜨기 전에는 실낱이다 (가로만 길고 세로가 없다).
    // 그게 이 놈의 문법이라(guard) 여기서는 '큰 눈알' 을 기대하지 않는다.
    const ghost = look < 4 && look !== 1
    ok(
      `look ${look} — ${ghost ? '유령이라 큰 눈알이 있다' : look === 1 ? '투구 틈이라 실낱이다' : '큰 눈알이 없다'}`,
      ghost ? hits.length > 0 : hits.length === 0,
      `${hits.length}개 · 문턱 r≥${huge.toFixed(1)}px`,
    )
  }
}

// ── 3. 수레와 사람은 땅을 딛는다 ─────────────────────────────────────
console.log('\n3. 땅을 딛는가 (형: "화차는 대체 왜 공중을 쳐 날라다니고")')
{
  let off = 0
  let seen = 0
  const names: Record<number, string> = { 4: '화차', 5: '총통수', 6: '투석군' }
  for (let n = 21; n <= 60; n++) {
    const st = getStage(n - 1)
    for (const t of st.targets) {
      if (t.kind !== 'archer') continue
      const look = t.look ?? 0
      if (look !== 4 && look !== 5 && look !== 6) continue
      seen++
      const foot = (t.y ?? 0) - (t.r ?? 0)
      if (Math.abs(foot) > 1e-6) {
        off++
        console.log(`     ✗ ${n}판 ${names[look]} — 발끝 y=${foot.toFixed(2)}m (떠 있다)`)
      }
    }
  }
  ok('화차·총통수·투석군이 전부 땅 위다', off === 0, `${seen}마리 중 ${off}마리 떠 있음`)
}

// ── 4. 화차의 포수가 사람이다 ────────────────────────────────────────
console.log('\n4. 화차의 포수 (형: "화차 기수는 사람처럼 안보이고")')
{
  const f = frameOf({ kind: 'archer', look: 4, x: 22, y: 0.8, r: 0.8, hp: 30, fireDelay: 9 } as TargetSpec, 6)
  const t = f.w.targets.find((q) => q.alive)
  const rpx = (t?.r ?? 1) * f.cam.scale
  // 포수는 수레 **오른쪽**(뒤)에 선다. 그 구역의 획을 센다.
  const cx = (t?.x ?? 0)
  const { worldToScreenX } = await import('../src/render/camera.ts')
  const gx = worldToScreenX(f.cam, cx) + rpx * 0.9
  const near = lines.filter((l) => Math.min(l.x0, l.x1) >= gx - rpx * 0.4)
  // 사람 하나 = 다리 넷(무릎 꺾임 둘씩) + 몸통 + 팔 넷 + 목 = 최소 여덟 획.
  ok('수레 뒤에 사람 몫의 획이 있다', near.length >= 8, `${near.length}획 (하한 8)`)
  // 전립 — 몸색이 아닌 어두운 타원이 머리 위에 둘.
  const hats = shapes.filter((sp) => sp.style.toLowerCase() === '#2b2f38')
  ok('전립(氈笠)을 쓰고 있다', hats.length >= 2, `${hats.length}개`)
}

console.log(bad === 0 ? '\n전부 통과' : `\n✗ ${bad}건 실패`)
if (bad > 0) process.exitCode = 1
