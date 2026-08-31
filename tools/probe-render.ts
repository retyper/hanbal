export {}
/**
 * 렌더 프로브 — **화면을 숫자로 본다.**
 *
 * 이 데스크탑에서는 게임을 브라우저로 못 연다(CLAUDE.md). "UI를 키웠다"를 눈으로 확인할 수
 * 없으니, Canvas2D 를 기록하는 스텁으로 세우고 진짜 `scene.ts` 를 한 프레임 돌린 다음
 * **글자 크기·자리·그린 횟수**를 표로 찍는다.
 *
 * 재는 것:
 *   1. 창 크기별 글자 크기 (형이 반려한 "UI가 작다"가 실제로 해결됐는가)
 *   2. HUD 항목이 화면 밖으로 나가지 않는가
 *   3. 판 시작 자막이 떴다가 사라지는가
 *   4. 바람 깃발이 풍속에 따라 실제로 눕는가 (예전엔 바람이 화면에 아예 없었다)
 *   5. 한 프레임의 draw 호출 수 (A5 프레임 예산)
 *
 * 실행: node --experimental-strip-types tools/probe-render.ts
 */

// ───────────────────────── Canvas2D 기록 스텁 ─────────────────────────

interface TextOp {
  text: string
  x: number
  y: number
  font: string
  align: string
  alpha: number
  /** font 문자열에서 뽑은 px */
  size: number
}

interface Rec {
  texts: TextOp[]
  /** 선분 하나하나. 깃발의 각도를 되짚는 데 쓴다. */
  lines: Array<{ x0: number; y0: number; x1: number; y1: number; style: string; width: number }>
  ops: number
  fills: number
  strokes: number
}

const rec: Rec = { texts: [], lines: [], ops: 0, fills: 0, strokes: 0 }

const fontPx = (f: string): number => {
  const m = /(\d+(?:\.\d+)?)px/.exec(f)
  return m === null ? 0 : Number(m[1])
}

class Ctx2D {
  font = '10px sans-serif'
  textAlign = 'left'
  textBaseline = 'alphabetic'
  fillStyle: string | object = '#000'
  strokeStyle: string | object = '#000'
  lineWidth = 1
  lineCap = 'butt'
  globalAlpha = 1
  /** 현재 경로의 시작·끝. 선 하나짜리 경로만 기록한다 (깃발·기둥·레일이 전부 그렇다). */
  private px = 0
  private py = 0
  private sx = 0
  private sy = 0
  private pts = 0

  setTransform(): void {}
  save(): void {}
  restore(): void {}
  beginPath(): void {
    this.pts = 0
  }
  moveTo(x: number, y: number): void {
    this.sx = x
    this.sy = y
    this.px = x
    this.py = y
    this.pts = 1
  }
  lineTo(x: number, y: number): void {
    this.px = x
    this.py = y
    this.pts++
  }
  closePath(): void {}
  quadraticCurveTo(_cx: number, _cy: number, x: number, y: number): void {
    this.px = x
    this.py = y
    this.pts++
  }
  bezierCurveTo(_a: number, _b: number, _c: number, _d: number, x: number, y: number): void {
    this.px = x
    this.py = y
    this.pts++
  }
  arcTo(): void {
    this.pts++
  }
  setLineDash(): void {}
  translate(): void {}
  rotate(): void {}
  scale(): void {}
  roundRect(): void {
    this.pts += 2
  }
  clip(): void {}
  arc(): void {
    this.pts += 2
  }
  ellipse(): void {
    this.pts += 2
  }
  rect(): void {
    this.pts += 2
  }
  fill(): void {
    rec.ops++
    rec.fills++
  }
  stroke(): void {
    rec.ops++
    rec.strokes++
    if (this.pts >= 2) {
      rec.lines.push({
        x0: this.sx, y0: this.sy, x1: this.px, y1: this.py,
        style: String(this.strokeStyle), width: this.lineWidth,
      })
    }
  }
  fillRect(): void {
    rec.ops++
    rec.fills++
  }
  strokeRect(): void {
    rec.ops++
  }
  clearRect(): void {}
  fillText(text: string, x: number, y: number): void {
    rec.ops++
    rec.texts.push({
      text, x, y, font: this.font, align: this.textAlign,
      alpha: this.globalAlpha, size: fontPx(this.font),
    })
  }
  strokeText(): void {
    rec.ops++
  }
  measureText(t: string): { width: number } {
    // 한글은 정사각에 가깝고 숫자·영문은 그 절반쯤. 자리 계산 검증에는 이 정도면 충분하다.
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

// ───────────────────────── 실행 ─────────────────────────

const { createRenderer } = await import('../src/render/scene.ts')
const { createWorld, step } = await import('../src/sim/world.ts')
const { getStage } = await import('../src/game/stages.ts')
const { CAMPAIGN } = await import('../src/game/stages.ts')
import type { HudState } from '../src/render/hud.ts'
import type { InputFrame, Stats, World } from '../src/sim/types.ts'

const STATS: Stats = { str: 8, steady: 6, stamina: 6, focus: 4 }
const IDLE: InputFrame = { aimX: 20, aimY: 3, drawing: false, steady: false }
const HUD_STATE: HudState = { training: 42, canLevelUp: true, muted: false, toast: '', arrow: '분열 살', stars: -1, endReason: '', time: 12.4, bestTime: 9.8, record: false }

function reset(): void {
  rec.texts.length = 0
  rec.lines.length = 0
  rec.ops = 0
  rec.fills = 0
  rec.strokes = 0
}

/** 한 프레임 그린다. steps 만큼 sim 을 미리 돌려 시간을 진행시킨다. */
function frame(canvas: Canvas, w: World, steps: number): void {
  for (let i = 0; i < steps; i++) {
    step(w, IDLE)
    w.events.length = 0
  }
  reset()
  const r = createRenderer(canvas as unknown as HTMLCanvasElement)
  r.draw(w, 0, 1 / 60, HUD_STATE)
}

console.log('신궁 — 렌더 프로브 (Canvas2D 기록 스텁)')

// ── 1. 창 크기별 글자 크기 ──
console.log('\n── 1. 창 크기별 HUD 글자 크기 ──')
console.log('  ' + '창'.padEnd(12) + '장-판'.padStart(8) + '과녁'.padStart(8) +
  '화살수'.padStart(8) + '훈련'.padStart(8) + '자막'.padStart(8))
const SIZES: ReadonlyArray<readonly [number, number]> = [[1024, 640], [1280, 800], [1920, 1080], [2560, 1440]]
for (const [cw, ch] of SIZES) {
  const canvas = new Canvas()
  canvas.clientWidth = cw
  canvas.clientHeight = ch
  const w = createWorld(getStage(0), STATS)
  frame(canvas, w, 0)
  const pick = (s: string): number => rec.texts.find((t) => t.text.includes(s))?.size ?? 0
  console.log(
    '  ' + `${cw}x${ch}`.padEnd(12) +
    // 장-판 쌍('1-1') — 머리글의 주인공. 통산 번호('1판')가 아니라 이게 커야 한다.
    String(rec.texts.find((t) => /^\d+-\d+$/.test(t.text))?.size ?? 0).padStart(8) +
    String(pick('과녁')).padStart(8) +
    String(rec.texts.find((t) => /^\d+$/.test(t.text))?.size ?? 0).padStart(8) +
    String(pick('훈련')).padStart(8) +
    String(rec.texts.filter((t) => t.align === 'center').map((t) => t.size).sort((a, b) => b - a)[0] ?? 0).padStart(8),
  )
}

// ── 2. HUD 항목이 화면 안에 있는가 ──
{
  console.log('\n── 2. 1280x800 에서 그려진 글자 ──')
  const canvas = new Canvas()
  const w = createWorld(getStage(0), STATS)
  frame(canvas, w, 0)
  console.log('  ' + 'text'.padEnd(26) + 'x'.padStart(7) + 'y'.padStart(7) + 'px'.padStart(5) + '  align')
  let outside = 0
  for (const t of rec.texts) {
    const label = t.text.length > 24 ? `${t.text.slice(0, 23)}…` : t.text
    console.log('  ' + label.padEnd(26) + t.x.toFixed(0).padStart(7) + t.y.toFixed(0).padStart(7) +
      String(t.size).padStart(5) + '  ' + t.align)
    if (t.x < -4 || t.x > 1284 || t.y < -4 || t.y > 804) outside++
  }
  console.log(`  화면 밖 ${outside}건 ${outside === 0 ? '✓' : '⚠'}`)
  console.log(`  한 프레임 draw 호출 ${rec.ops}회 (fill ${rec.fills} / stroke ${rec.strokes})`)
}

// ── 3. 판 시작 자막이 떴다 사라지는가 ──
{
  console.log('\n── 3. 판 시작 자막 ──')
  const canvas = new Canvas()
  const w = createWorld(getStage(0), STATS)
  const hz = Math.round(1 / w.dt)
  for (const sec of [0, 0.5, 1.2, 1.8, 2.5]) {
    const fresh = createWorld(getStage(0), STATS)
    frame(canvas, fresh, Math.round(sec * hz))
    const card = rec.texts.filter((t) => t.align === 'center' && t.alpha > 0)
    const big = card.map((t) => t.size).sort((a, b) => b - a)[0] ?? 0
    const alpha = card[0]?.alpha ?? 0
    console.log(`  t=${sec.toFixed(1)}s  자막 ${card.length}줄 · 최대 ${big}px · 알파 ${alpha.toFixed(2)}`)
  }
  void hz
}

// ── 4. 바람 깃발이 풍속에 반응하는가 ──
{
  console.log('\n── 4. 바람 깃발 (예전엔 화면에 바람이 아예 없었다) ──')
  const canvas = new Canvas()
  for (const wind of [0, 2, 4, 6, -4]) {
    const stage = { ...getStage(0), wind }
    const w = createWorld(stage, STATS)
    // 돌풍 위상이 0 근처인 첫 프레임에서 잰다.
    frame(canvas, w, 1)
    // 깃대는 세로선, 천은 그 위에서 뻗는 선이다. 천의 첫 선분 기울기가 곧 풍속의 눈금이다.
    const cloth = rec.lines.filter((l) => l.style === '#c99a5e')
    if (cloth.length === 0) {
      console.log(`  풍속 ${wind.toFixed(1).padStart(5)} m/s → 깃발 없음 ${wind === 0 ? '✓ (무풍 판)' : '⚠'}`)
      continue
    }
    const l = cloth[0] as { x0: number; y0: number; x1: number; y1: number }
    // 화면 y는 아래가 + 라 부호를 뒤집어야 '들린 각'이 된다.
    // 방향(좌/우)은 따로 보고, 각도는 항상 "수평에서 얼마나 내려갔는가"로 접어서 읽는다.
    const deg = (Math.atan2(-(l.y1 - l.y0), Math.abs(l.x1 - l.x0)) * 180) / Math.PI
    console.log(
      `  풍속 ${wind.toFixed(1).padStart(5)} m/s → 천이 ${deg.toFixed(0).padStart(4)}° ` +
      `(${deg > -8 ? '거의 수평 (강풍)' : deg < -55 ? '축 늘어짐 (약풍)' : '비스듬'}) · ${l.x1 > l.x0 ? '오른쪽' : '왼쪽'}`,
    )
  }
}

// ── 5. 무한 구간 판이 실제로 다르게 그려지는가 ──
{
  console.log('\n── 5. 무한 구간 판 머리글 ──')
  const canvas = new Canvas()
  for (let k = 0; k < 5; k++) {
    const w = createWorld(getStage(CAMPAIGN + k), STATS)
    frame(canvas, w, 0)
    const pair = rec.texts.find((t) => /^\d+-\d+$/.test(t.text))?.text ?? '?'
    const tot = rec.texts.find((t) => /^\d+판$/.test(t.text))?.text ?? '?'
    const no = `${pair} (${tot})`
    const title = rec.texts.find((t) => t.align === 'center' && t.size >= 30)?.text ?? '?'
    console.log(`  ${no.padEnd(14)} ${title}`)
  }
}

console.log('')
console.log('※ 이 프로브는 "어디에 얼마나 크게 그렸는가"만 답한다. 보기 좋은지는 형이 확인해야 한다.')
