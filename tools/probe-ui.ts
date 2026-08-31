export {}
/**
 * UI 겹침 프로브 — **HUD가 서로를 밟는지 숫자로 본다.**
 *
 * 이 데스크탑에서는 게임을 브라우저로 못 연다(CLAUDE.md). "글자가 겹쳐 보인다"는 반려를
 * 눈 대신 좌표로 잡기 위해, Canvas2D 를 기록 스텁으로 세우고(probe-render.ts 의 패턴)
 * 진짜 렌더러를 돌린 뒤 **HUD가 그린 사각형들끼리의 교차를 전수 검사**한다.
 *
 * 월드 요소(배경·능선·과녁·궁수)는 겹치는 게 정상이라 검사 대상이 아니다.
 * 가장자리 밴드 같은 어림 기준 대신, `drawHud` 가 export 돼 있다는 걸 이용한다:
 * 전체 프레임을 한 번 그려 카메라·캐시를 실전 상태로 만든 다음, 기록을 비우고
 * **drawHud 만 다시 호출**한다. 그 사이에 기록된 것이 곧 HUD의 전부다.
 *
 * 같은 위젯이 일부러 겹쳐 그리는 것(게이지의 트랙 위 채움, 화살 글리프의 촉·대·깃)은
 * 겹침이 아니다 — 위젯은 자기 층을 연달아 그리므로, **그린 순서가 가까운 도형끼리의
 * 겹침은 층 쌓기로 보고 건너뛴다**. 글자가 낀 겹침은 순서와 무관하게 전부 잡는다:
 * 글자는 무엇과 겹쳐도 읽기가 죽기 때문이다.
 *
 * 한계 (여기서 못 재는 것):
 *   - DOM 오버레이 — 화살 3택(ui/draft.ts)·성장 패널(ui/growth.ts) 같은 quiver 버튼류는
 *     HTML 요소라 이 스텁 밖에 있다. 캔버스 HUD와 DOM 버튼이 겹치는지는 형이 눈으로
 *     확인해야 한다 (특히 왼쪽 아래 성장 버튼 자리).
 *   - 글자 폭은 어림값이다 (한글 1em·영숫자 0.55em). 실제 폰트와 몇 px 다를 수 있으니
 *     겹침 폭 1~2px 짜리는 여기서 아예 세지 않는다.
 *
 * 실행: node --experimental-strip-types tools/probe-ui.ts
 * 겹침이 하나라도 있으면 종료 코드 1.
 */

// ───────────────────────── 기록 스텁 ─────────────────────────

interface Box {
  /** 그린 순서. 순서가 가까운 도형끼리의 겹침은 같은 위젯의 층 쌓기로 본다. */
  ord: number
  kind: 'text' | 'shape'
  label: string
  x0: number
  y0: number
  x1: number
  y1: number
  alpha: number
}

/** 이 안에 있을 때만 기록한다 — 전체 프레임(월드 포함)을 그릴 땐 끈다. */
let recOn = false
let ord = 0
const boxes: Box[] = []

function resetRec(): void {
  boxes.length = 0
  ord = 0
}

const fontPx = (f: string): number => {
  const m = /(\d+(?:\.\d+)?)px/.exec(f)
  return m === null ? 0 : Number(m[1])
}

const fmt = (v: number): string => String(Math.round(v))

class Ctx2D {
  font = '10px sans-serif'
  textAlign = 'left'
  textBaseline = 'alphabetic'
  fillStyle: string | object = '#000'
  strokeStyle: string | object = '#000'
  lineWidth = 1
  lineCap = 'butt'
  globalAlpha = 1
  /** 현재 경로의 바운딩 박스. fill/stroke 시점에 도형 하나로 떨어진다. */
  private bx0 = Infinity
  private by0 = Infinity
  private bx1 = -Infinity
  private by1 = -Infinity

  private pt(x: number, y: number): void {
    if (x < this.bx0) this.bx0 = x
    if (y < this.by0) this.by0 = y
    if (x > this.bx1) this.bx1 = x
    if (y > this.by1) this.by1 = y
  }

  private push(kind: 'text' | 'shape', label: string, x0: number, y0: number, x1: number, y1: number): void {
    ord++
    if (!recOn) return
    boxes.push({
      ord, kind, label,
      x0: Math.min(x0, x1), y0: Math.min(y0, y1),
      x1: Math.max(x0, x1), y1: Math.max(y0, y1),
      alpha: this.globalAlpha,
    })
  }

  private styleName(s: string | object): string {
    return typeof s === 'string' ? s : '그라디언트'
  }

  setTransform(): void {}
  save(): void {}
  restore(): void {}
  beginPath(): void {
    this.bx0 = Infinity
    this.by0 = Infinity
    this.bx1 = -Infinity
    this.by1 = -Infinity
  }
  moveTo(x: number, y: number): void {
    this.pt(x, y)
  }
  lineTo(x: number, y: number): void {
    this.pt(x, y)
  }
  closePath(): void {}
  quadraticCurveTo(cx: number, cy: number, x: number, y: number): void {
    this.pt(cx, cy)
    this.pt(x, y)
  }
  bezierCurveTo(a: number, b: number, c: number, d: number, x: number, y: number): void {
    this.pt(a, b)
    this.pt(c, d)
    this.pt(x, y)
  }
  arcTo(x1: number, y1: number, x2: number, y2: number): void {
    this.pt(x1, y1)
    this.pt(x2, y2)
  }
  setLineDash(): void {}
  translate(): void {}
  rotate(): void {}
  scale(): void {}
  clip(): void {}
  /** 원호는 중심±반지름의 사각형으로 어림한다 — 겹침 판정에는 이 정도면 충분하다. */
  arc(x: number, y: number, r: number): void {
    this.pt(x - r, y - r)
    this.pt(x + r, y + r)
  }
  ellipse(x: number, y: number, rx: number, ry: number): void {
    this.pt(x - rx, y - ry)
    this.pt(x + rx, y + ry)
  }
  rect(x: number, y: number, w: number, h: number): void {
    this.pt(x, y)
    this.pt(x + w, y + h)
  }
  roundRect(x: number, y: number, w: number, h: number): void {
    this.pt(x, y)
    this.pt(x + w, y + h)
  }
  fill(): void {
    if (this.bx1 >= this.bx0) {
      this.push('shape', `면#${ord + 1}(${fmt(this.bx1 - this.bx0)}x${fmt(this.by1 - this.by0)} ${this.styleName(this.fillStyle)})`,
        this.bx0, this.by0, this.bx1, this.by1)
    }
  }
  stroke(): void {
    if (this.bx1 >= this.bx0) {
      const half = this.lineWidth * 0.5
      this.push('shape', `선#${ord + 1}(${fmt(this.bx1 - this.bx0)}x${fmt(this.by1 - this.by0)} ${this.styleName(this.strokeStyle)})`,
        this.bx0 - half, this.by0 - half, this.bx1 + half, this.by1 + half)
    }
  }
  fillRect(x: number, y: number, w: number, h: number): void {
    this.push('shape', `네모#${ord + 1}(${fmt(Math.abs(w))}x${fmt(Math.abs(h))} ${this.styleName(this.fillStyle)})`,
      x, y, x + w, y + h)
  }
  strokeRect(x: number, y: number, w: number, h: number): void {
    this.push('shape', `네모선#${ord + 1}(${fmt(Math.abs(w))}x${fmt(Math.abs(h))})`, x, y, x + w, y + h)
  }
  clearRect(): void {}
  /** 글자 사각형: 폭은 measureText 어림, 높이는 폰트 px. align/baseline 을 반영해 앵커를 푼다. */
  private textBox(text: string, x: number, y: number): readonly [number, number, number, number] {
    const h = fontPx(this.font)
    const w = this.measureText(text).width
    const x0 = this.textAlign === 'right' ? x - w : this.textAlign === 'center' ? x - w * 0.5 : x
    // alphabetic 이면 y가 밑선이다 — 글자 잉크는 대략 위로 0.8em, 아래로 0.2em.
    const y0 = this.textBaseline === 'top' ? y : y - h * 0.8
    return [x0, y0, x0 + w, y0 + h]
  }
  fillText(text: string, x: number, y: number): void {
    const [x0, y0, x1, y1] = this.textBox(text, x, y)
    this.push('text', `'${text}'`, x0, y0, x1, y1)
  }
  strokeText(text: string, x: number, y: number): void {
    const [x0, y0, x1, y1] = this.textBox(text, x, y)
    this.push('text', `'${text}'`, x0, y0, x1, y1)
  }
  measureText(t: string): { width: number } {
    // probe-render.ts 와 같은 어림 — 한글은 정사각, 영숫자는 그 절반쯤.
    let wsum = 0
    for (const ch of t) wsum += ch.charCodeAt(0) > 0x2000 ? 1 : 0.55
    return { width: wsum * fontPx(this.font) }
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

// ───────────────────────── 겹침 판정 ─────────────────────────

/**
 * 이 순서 거리 안의 도형끼리는 같은 위젯의 층 쌓기로 본다.
 * 게이지 하나가 트랙·채움·문턱·빨간 바까지 6~10번의 draw 로 완성되기 때문이다.
 */
const WIDGET_WINDOW = 12
/** 이보다 얕은 교차는 글자 폭 어림 오차일 수 있어 세지 않는다 (px). */
const MIN_OVERLAP = 2
/** 거의 안 보이는 것(사라지는 자막 꼬리 등)은 겹쳐도 안 읽힌다. */
const MIN_ALPHA = 0.05

function findOverlaps(): string[] {
  const out: string[] = []
  for (let i = 0; i < boxes.length; i++) {
    const a = boxes[i]
    if (a === undefined || a.alpha < MIN_ALPHA) continue
    for (let j = i + 1; j < boxes.length; j++) {
      const b = boxes[j]
      if (b === undefined || b.alpha < MIN_ALPHA) continue
      if (a.kind === 'shape' && b.kind === 'shape' && b.ord - a.ord <= WIDGET_WINDOW) continue
      const ow = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)
      const oh = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0)
      if (ow >= MIN_OVERLAP && oh >= MIN_OVERLAP) {
        out.push(`${a.label} × ${b.label} (겹침 영역 ${fmt(ow)}x${fmt(oh)}px)`)
      }
    }
  }
  return out
}

// ───────────────────────── 실행 ─────────────────────────

const { createRenderer, getCamera } = await import('../src/render/scene.ts')
const { drawHud } = await import('../src/render/hud.ts')
const { createWorld, step } = await import('../src/sim/world.ts')
const { getStage } = await import('../src/game/stages.ts')
import type { HudState } from '../src/render/hud.ts'
import type { InputFrame, Stats, World } from '../src/sim/types.ts'
import type { Renderer } from '../src/render/scene.ts'

const STATS: Stats = { str: 8, steady: 6, stamina: 6, focus: 4 }
const IDLE: InputFrame = { aimX: 20, aimY: 3, drawing: false, steady: false }
/** HUD 상태는 실전값으로. toast·stars 는 결과 배너에서만 그려진다 (아래 '클리어 배너' 프레임). */
const HUD_STATE: HudState = {
  training: 12, canLevelUp: true, muted: false,
  toast: '한 번 더 누르면 다음 판', arrow: '화전', stars: 2, endReason: '', time: 11.2, bestTime: 14.0, record: true,
}

function makeCanvas(cw: number, ch: number): Canvas {
  const canvas = new Canvas()
  canvas.clientWidth = cw
  canvas.clientHeight = ch
  return canvas
}

/** sim 을 steps 만큼 진행시킨다. 이벤트는 프로브가 소비자다 — 쌓아두면 pumpEvents 가 몰아서 먹는다. */
function advance(w: World, steps: number): void {
  for (let i = 0; i < steps; i++) {
    step(w, IDLE)
    w.events.length = 0
  }
}

/**
 * 전체 프레임을 한 번 그려 카메라·HUD 캐시를 실전 상태로 만든 뒤,
 * 기록을 켜고 drawHud 만 다시 호출한다. 기록에 남는 건 HUD 뿐이다.
 */
function recordHud(canvas: Canvas, r: Renderer, w: World): void {
  r.draw(w, 0, 1 / 60, HUD_STATE)
  resetRec()
  recOn = true
  drawHud(canvas.getContext() as unknown as CanvasRenderingContext2D, getCamera(r), w, HUD_STATE)
  recOn = false
}

let total = 0

/** 겹침 말고 **값**을 묻는 검사 (세로 구도 등). 실패하면 겹침과 같은 무게로 센다. */
function check(ok: boolean, label: string, detail = ''): void {
  if (!ok) total++
  console.log(`  ${ok ? 'ok ' : '⚠  '} ${label.padEnd(34)} ${detail}`)
}

/**
 * 화면 밖으로 나간 것 — **세로 화면(폰)의 주된 고장 방식이다.**
 *
 * 겹침 검사만으로는 못 잡는다: 오른쪽 정렬 글자가 왼쪽 벽을 뚫거나(폭 부족),
 * 왼쪽 열이 오른쪽으로 넘쳐 잘려도 남은 것끼리는 안 겹치기 때문이다.
 * 잘린 글자는 겹친 글자보다 나쁘다 — 아예 없는 정보가 된다.
 */
const MIN_OUT = 2

function findOutOfBounds(cw: number, ch: number): string[] {
  const out: string[] = []
  for (const b of boxes) {
    if (b.alpha < MIN_ALPHA) continue
    const dl = -b.x0
    const dr = b.x1 - cw
    const dt = -b.y0
    const db = b.y1 - ch
    const worst = Math.max(dl, dr, dt, db)
    if (worst < MIN_OUT) continue
    const side = worst === dl ? '왼쪽' : worst === dr ? '오른쪽' : worst === dt ? '위' : '아래'
    out.push(`${b.label} 이(가) ${side} 밖으로 ${fmt(worst)}px`)
  }
  return out
}

function report(name: string, cw = 0, ch = 0): void {
  const texts = boxes.filter((b) => b.kind === 'text').length
  console.log(`\n── ${name} ──`)
  console.log(`  기록 ${boxes.length}개 (글자 ${texts} · 도형 ${boxes.length - texts})`)
  const hits = findOverlaps()
  const outs = cw > 0 ? findOutOfBounds(cw, ch) : []
  total += hits.length + outs.length
  if (hits.length === 0 && outs.length === 0) {
    console.log('  겹침 없음 ✓' + (cw > 0 ? ' · 화면 안 ✓' : ''))
    return
  }
  for (const h of hits) console.log(`  ⚠ ${h}`)
  for (const h of outs) console.log(`  ⚠ ${h}`)
}

console.log('신궁 — UI 겹침 프로브 (HUD 사각형 전수 교차 검사)')

// ── 판 × 해상도: 판 시작 직후(자막 떠 있음)의 HUD ──
// getStage(0) 첫 판 · getStage(10) 적 궁수가 서는 판 · getStage(9) 보스판.
const STAGES_UNDER_TEST: ReadonlyArray<readonly [number, string]> = [
  [0, '1판'], [10, '11판(적 궁수)'], [9, '10판(보스)'],
]
// 세로 둘은 폰이다: 390x844(아이폰 14 급) · 360x640(작은 안드로이드, 가장 좁은 기준선).
for (const [cw, ch] of [[1280, 720], [800, 600], [390, 844], [360, 640]] as const) {
  for (const [idx, name] of STAGES_UNDER_TEST) {
    const canvas = makeCanvas(cw, ch)
    const w = createWorld(getStage(idx), STATS)
    const r = createRenderer(canvas as unknown as HTMLCanvasElement)
    advance(w, 1)
    recordHud(canvas, r, w)
    report(`${cw}x${ch} · ${name} · 시작 직후`, cw, ch)
  }
}

// ── 세로 화면 구도 (render/camera.ts VIEW.bandTop) ────────────────────
//
// 겹침 검사는 HUD끼리만 본다. 세로에서 진짜 물어야 하는 건 다른 것이다:
// **과녁이 HUD 밑에 깔리지 않고, 지면이 화면 아래쪽에 앉는가.**
// 가운데 정렬을 쓰면 폰에서 장면이 화면 한복판에 우표만 하게 박히고 위아래가 통째로 빈다.
{
  const { worldToScreenX, worldToScreenY } = await import('../src/render/camera.ts')
  console.log('\n── 세로 구도 (390x844 · 844x390 비교) ──')
  const shot = (cw: number, ch: number, idx: number): { s: number; ground: number; top: number; bot: number; l: number; r: number } => {
    const canvas = makeCanvas(cw, ch)
    const w = createWorld(getStage(idx), STATS)
    const r = createRenderer(canvas as unknown as HTMLCanvasElement)
    advance(w, 1)
    r.draw(w, 0, 1 / 60, HUD_STATE)
    const cam = getCamera(r)
    let top = Infinity
    let bot = -Infinity
    let l = Infinity
    let rr = -Infinity
    for (const t of w.stage.targets) {
      const rad = t.r ?? 0.5
      const x = worldToScreenX(cam, t.x)
      const y = worldToScreenY(cam, t.y)
      const px = rad * cam.scale
      if (y - px < top) top = y - px
      if (y + px > bot) bot = y + px
      if (x - px < l) l = x - px
      if (x + px > rr) rr = x + px
    }
    return { s: cam.scale, ground: worldToScreenY(cam, 0), top, bot, l, r: rr }
  }

  /**
   * DOM 버튼 바가 화면 아래에서 차지하는 높이 (px) — 화면형마다 다르다.
   * tools/probe-style.ts 의 ⑦번이 CSS와 맞대어 보는 그 값이고, 여기서는 **실제 투영**을 잰다:
   * 궁수의 발(지면)이 이 선보다 위에 있어야 "버튼이 캐릭터를 가린다"가 안 된다.
   *   세로 폰   아이콘 두 줄 46×2+8 + 아래 18 + 홈바 34 + 여유 16 = 168
   *   낮은 화면 아이콘 한 줄 46      + 18 + 21 + 16              = 101
   *   데스크탑  50 + 67 + 8          + 18 +  0 + 16              = 159
   */
  const barOf = (cw: number, ch: number): number =>
    ch > cw * 1.15 ? 168 : ch <= 560 ? 101 : 159

  // 세로 폰 둘 · 눕힌 폰 · 데스크탑 둘. 형이 실제로 노는 화면형을 전부 건다.
  for (const [cw, ch] of [[390, 844], [360, 640], [844, 390], [1280, 720], [1920, 1080]] as const) {
    for (const idx of [0, 10]) {
      const p = shot(cw, ch, idx)
      const BAR = barOf(cw, ch)
      const name = `${idx === 0 ? '1판' : '11판'} ${cw}x${ch}`
      console.log(
        `  ${name}  scale ${p.s.toFixed(1)}px/m · 지면 y=${p.ground.toFixed(0)}/${ch} ` +
        `· 과녁 y ${p.top.toFixed(0)}~${p.bot.toFixed(0)} · x ${p.l.toFixed(0)}~${p.r.toFixed(0)}`,
      )
      // ★★ 형의 신고 — **버튼이 궁수를 덮으면 안 된다.** 화면형과 무관하게 지켜야 한다
      //    (세로를 고쳤더니 "아직도 가로화면에서 버튼이랑 화면이 겹친다"가 왔다).
      //    궁수는 지면 위에 서 있으므로, 지면이 바 위에 있으면 몸 전체가 바 위에 있다.
      check(
        p.ground < ch - BAR,
        `${name} — 아래 버튼 바가 궁수를 안 덮는다`,
        `지면 ${p.ground.toFixed(0)} < 바 윗선 ${ch - BAR}`,
      )
      // 과녁도 마찬가지다 — 버튼 뒤에 숨은 과녁은 못 맞힌다.
      check(
        p.bot < ch - BAR,
        `${name} — 과녁이 버튼 바 위에 있다`,
        `과녁 밑 ${p.bot.toFixed(0)} < ${ch - BAR}`,
      )
      // 좌우로 잘리지 않는다.
      check(p.l >= -2 && p.r <= cw + 2, `${name} — 과녁이 좌우로 안 잘린다`, `${p.l.toFixed(0)}~${p.r.toFixed(0)}`)

      if (ch > cw * 1.15) {
        // 세로에서만: 위 띠는 캔버스 HUD의 자리이고, 지면은 아래쪽에 앉아야 한다.
        check(p.top >= ch * 0.2 - 2, `${name} — 과녁이 위 HUD 띠 아래`, `${p.top.toFixed(0)} ≥ ${Math.round(ch * 0.2)}`)
        check(p.ground > ch * 0.55, `${name} — 지면이 화면 아래쪽에 앉는다`, `y=${p.ground.toFixed(0)}`)
      } else {
        // 가로에서는 예전처럼 가운데 정렬이다 — 다만 가운데의 기준이 '빈 자리'로 바뀌었다.
        const mid = Math.abs((p.top + p.bot) / 2 - ch * 0.5)
        check(mid < ch * 0.3, `${name} — 가로는 여전히 가운데 근처다`, `중심 어긋남 ${mid.toFixed(0)}px`)
      }
    }
  }
}

// ── 한 순 눈금 (docs/MEGAHIT.md §1) — 화살 숫자 아래에 줄이 하나 더 끼어든다 ──
// 3중과 몰기를 따로 본다: 몰기는 칸이 자라고 '몰기' 글자까지 붙어 제일 넓다.
for (const [hits, molgi, label] of [[3, false, '3중'], [5, true, '몰기']] as const) {
  const canvas = makeCanvas(1280, 720)
  const w = createWorld(getStage(10), STATS)
  const r = createRenderer(canvas as unknown as HTMLCanvasElement)
  advance(w, 1)
  w.flowHits = hits
  w.molgi = molgi
  recordHud(canvas, r, w)
  report(`1280x720 · 11판 · ${label}`)
}
// 작은 창에서도 — 여기가 제일 빡빡하다.
{
  const canvas = makeCanvas(800, 600)
  const w = createWorld(getStage(10), STATS)
  const r = createRenderer(canvas as unknown as HTMLCanvasElement)
  advance(w, 1)
  w.flowHits = 5
  w.molgi = true
  recordHud(canvas, r, w)
  report('800x600 · 11판 · 몰기')
}

// ── 바람 판 — 오른쪽 위에 바람 눈금이 훈련치와 같은 기둥에 쌓인다 ──
{
  const canvas = makeCanvas(1280, 720)
  const w = createWorld(getStage(25), STATS)
  const r = createRenderer(canvas as unknown as HTMLCanvasElement)
  advance(w, 1)
  recordHud(canvas, r, w)
  report('1280x720 · 26판(바람) · 시작 직후')
}

// ── 클리어 배너 — toast·별·점수가 실제로 그려지는 유일한 화면 ──
// 초 단위 시간은 w.dt 로 환산한다 — sim 은 60Hz 가 아니라 P.sim.hz(120)로 돈다.
// status 를 손으로 넘기는 건 sim 을 조작하는 게 아니라 "클리어된 월드"라는 입력을 만드는 것이다.
function clearedFrame(clearAtSec: number, name: string): void {
  const canvas = makeCanvas(1280, 720)
  const w = createWorld(getStage(0), STATS)
  const r = createRenderer(canvas as unknown as HTMLCanvasElement)
  advance(w, Math.round(clearAtSec / w.dt))
  w.status = 'cleared'
  r.draw(w, 0, 1 / 60, HUD_STATE) // 결과 배너의 등장 시각(endT)이 여기서 박힌다
  advance(w, Math.round(0.5 / w.dt)) // 등장 연출(0.22s)이 끝나 알파 1인 프레임
  recordHud(canvas, r, w)
  report(name)
}
// 자막이 다 사라진 뒤(자막 수명 3.5s)의 평상시 배너.
clearedFrame(4.2, '1280x720 · 1판 · 클리어 배너 (별 2 · 토스트)')
// 빠른 클리어 — 1판은 자막이 떠 있는 채로도 깰 수 있다. 그때 자막과 배너가 같은 세로줄에 선다.
clearedFrame(1.2, '1280x720 · 1판 · 빠른 클리어 (시작 자막이 아직 떠 있음)')

console.log(`\n겹침 ${total}건${total === 0 ? ' ✓' : ' ⚠'}`)
console.log('※ DOM 오버레이(화살 3택·성장 버튼)는 캔버스 밖이라 여기서 못 잰다 — 그건 형의 눈이 판정한다.')
if (total > 0) process.exitCode = 1
