/**
 * 점수 팝 — 명중 지점에서 숫자가 튀어오르며 사라진다 (HOOK ★6-1).
 *
 * "획득했다"를 말이 아니라 눈으로 전하는 가장 직접적인 신호다. 규칙은 하나도 안 바뀐다 —
 * 같은 판, 같은 물리, 피드백만 쌓는다 ("Juice It or Lose It", GDC 2012).
 *
 * ★ 절제 (GDD 7장 · 9장 "화면 가득 찬 숫자와 이펙트"):
 *   - 배경 상자를 그리지 않는다. 글자만 뜨므로 뒤의 과녁이 비쳐 보인다.
 *   - 연쇄 팝은 작고(11px) 옅고(0.6) 짧다(0.5s). 동시 생존 수에 상한이 있다.
 *   - 팝은 전부 **명중 지점 위쪽**으로만 떠오른다. 조준 표식은 활 손에서 15~59px 지점에
 *     붙어 있고(hud.ts), 팝은 몇 미터 떨어진 과녁 자리에 뜬다 — 겹칠 자리가 없다.
 *
 * A5: 고정 크기 풀. 프레임당 힙 할당 0.
 *   폰트 문자열은 미리 구워둔 표에서 집는다 — `ctx.font = \`700 ${n}px ...\`` 는
 *   팝 하나당 매 프레임 문자열을 만든다.
 * A1: 이 파일은 render 다. World를 아예 받지 않는다.
 */
import { TAU, clamp01 } from '../core/math.ts'
import { THEME, worldToScreenX, worldToScreenY } from './camera.ts'
import type { Camera } from './camera.ts'

export type PopupKind = 'score' | 'crit' | 'chain' | 'feat'

const K_SCORE = 0
const K_CRIT = 1
const K_CHAIN = 2
const K_FEAT = 3

function kindIndex(kind: PopupKind): number {
  return kind === 'crit' ? K_CRIT : kind === 'chain' ? K_CHAIN : kind === 'feat' ? K_FEAT : K_SCORE
}

/**
 * 연출 상수. 손맛 시간값이라 언젠가 params.ts로 올라가야 한다.
 * (params.ts는 m/s/rad만 담기로 한 규약이라 px 값은 여기 남는 게 맞다 — camera.ts VIEW와 같은 처리.)
 */
const POP = {
  /** 동시에 살아 있을 수 있는 팝. 넘으면 가장 오래된 슬롯을 덮어쓴다. */
  cap: 20,
  /** 연쇄 팝만 따로 건 상한. 긴 연쇄에서 화면이 숫자로 덮이는 걸 막는 유일한 장치다. */
  chainLive: 5,
  /** 종류별 수명 (s) — score, crit, chain, feat */
  ttl: [0.75, 0.92, 0.5, 1.25],
  /** 종류별 상승 거리 (px) */
  rise: [34, 46, 20, 28],
  /** 종류별 기본 글자 크기 (px) */
  size: [15, 22, 11, 15],
  /** weight 1 에서 추가되는 글자 크기 (px). 점수가 클수록 크다. */
  sizeGain: [9, 10, 0, 0],
  /** 종류별 최대 불투명도 */
  alpha: [0.92, 1, 0.6, 0.95],
  /**
   * 종류별 시작 높이 (px, 명중 지점 기준 위쪽 +). 과녁을 덮지 않게 띄운다.
   * 위업만 **아래에서** 출발한다 — 정중앙이면 점수 팝과 위업이 같은 자리에 겹치는데,
   * 점수 팝은 위로 46px 튀고 위업은 아래에서 올라와 서로를 지나치지 않는다.
   */
  lift: [14, 14, 10, -12],
  /** 튀어나오는 순간의 확대. 0.16초 안에 1로 가라앉는다. */
  punch: 0.32,
  punchIn: 0.16,
  /** 페이드 인/아웃 구간 (수명 비율) */
  fadeIn: 0.09,
  fadeOut: 0.42,
  /** 크리티컬만 좌우로 살짝 떤다 */
  critShakeHz: 19,
  critShakePx: 2.2,
  /** 연쇄 팝이 서로 정확히 겹치지 않게 슬롯마다 주는 가로 어긋남 (px) */
  spreadPx: 5,
} as const
// TODO(params): render.popupTtl · render.popupRise · render.popupChainLive

const CRIT_COLOR = '#fff6d5'
const COLOR = [THEME.trailHit, CRIT_COLOR, THEME.target2, THEME.accent] as const

/** 미리 구운 폰트 문자열. 인덱스 = 픽셀 크기 - FONT_MIN. */
const FONT_MIN = 10
const FONT_MAX = 34
const FONTS: string[] = []
for (let s = FONT_MIN; s <= FONT_MAX; s++) FONTS.push(`700 ${s}px system-ui, -apple-system, sans-serif`)

export interface Popups {
  readonly cap: number
  head: number
  /** 월드 좌표 (m). 카메라가 움직여도 명중 지점에 붙어 있는다. */
  x: Float32Array
  y: Float32Array
  life: Float32Array
  ttl: Float32Array
  kind: Uint8Array
  /** 0..1 — 크기·밝기 가중치 (점수가 클수록 1에 가깝다) */
  weight: Float32Array
  /** 슬롯별 문자열. 길이 고정 배열을 덮어쓴다 (A5). */
  text: string[]
  /** 살아 있는 연쇄 팝 수. 상한 강제용 캐시. */
  chainLive: number
  live: number
}

export function createPopups(): Popups {
  const cap = POP.cap
  const text: string[] = new Array<string>(cap)
  for (let i = 0; i < cap; i++) text[i] = ''
  return {
    cap,
    head: 0,
    x: new Float32Array(cap),
    y: new Float32Array(cap),
    life: new Float32Array(cap),
    ttl: new Float32Array(cap),
    kind: new Uint8Array(cap),
    weight: new Float32Array(cap),
    text,
    chainLive: 0,
    live: 0,
  }
}

/** 연쇄 팝이 상한을 넘었다. 가장 수명이 적게 남은(=가장 오래된) 연쇄 팝을 재활용한다. */
function recycleOldestChain(p: Popups): number {
  let best = -1
  let bestLife = Infinity
  for (let i = 0; i < p.cap; i++) {
    if ((p.life[i] ?? 0) <= 0 || p.kind[i] !== K_CHAIN) continue
    const l = p.life[i] ?? 0
    if (l < bestLife) { bestLife = l; best = i }
  }
  return best
}

/**
 * 팝 하나를 띄운다. 좌표는 **월드(m)** 다 — 그려질 때 카메라로 변환된다.
 *
 * @param weight 0..1. 크기·밝기 가중치. 점수 팝에서 "이번 명중이 얼마나 컸는가"다.
 *               생략하면 0 (기본 크기).
 */
export function pushPopup(
  p: Popups, x: number, y: number, text: string, kind: PopupKind, weight = 0,
): void {
  const k = kindIndex(kind)

  let idx: number
  if (k === K_CHAIN && p.chainLive >= POP.chainLive) {
    const old = recycleOldestChain(p)
    // 살아있는 연쇄 팝을 못 찾았다면 카운터가 틀어진 것뿐이다. 링버퍼로 폴백한다.
    idx = old >= 0 ? old : p.head
    if (old < 0) p.head = p.head + 1 >= p.cap ? 0 : p.head + 1
  } else {
    idx = p.head
    p.head = p.head + 1 >= p.cap ? 0 : p.head + 1
  }

  const wasChain = (p.life[idx] ?? 0) > 0 && p.kind[idx] === K_CHAIN
  if (wasChain) p.chainLive--

  const ttl = POP.ttl[k] ?? 0.7
  p.x[idx] = x
  p.y[idx] = y
  p.ttl[idx] = ttl
  p.life[idx] = ttl
  p.kind[idx] = k
  p.weight[idx] = clamp01(weight)
  p.text[idx] = text
  if (k === K_CHAIN) p.chainLive++
}

export function updatePopups(p: Popups, dtReal: number): void {
  let chain = 0
  let live = 0
  for (let i = 0; i < p.cap; i++) {
    const l = p.life[i] ?? 0
    if (l <= 0) continue
    const nl = l - dtReal
    if (nl <= 0) {
      p.life[i] = 0
      // 슬롯이 잡고 있던 문자열을 놓아준다. 안 그러면 죽은 팝이 문자열을 영원히 붙든다.
      p.text[i] = ''
      continue
    }
    p.life[i] = nl
    live++
    if (p.kind[i] === K_CHAIN) chain++
  }
  p.chainLive = chain
  p.live = live
}

export function drawPopups(ctx: CanvasRenderingContext2D, cam: Camera, p: Popups): void {
  if (p.live === 0) return

  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'

  for (let i = 0; i < p.cap; i++) {
    const life = p.life[i] ?? 0
    if (life <= 0) continue
    const txt = p.text[i]
    if (txt === undefined || txt === '') continue

    const ttl = p.ttl[i] ?? 1
    const k = p.kind[i] ?? K_SCORE
    // t: 1 -> 0 (남은 수명), u: 0 -> 1 (진행)
    const t = clamp01(life / ttl)
    const u = 1 - t

    // 튀어오른다 — 처음이 빠르고 끝에서 멎는다
    const ease = 1 - (1 - u) * (1 - u)
    const rise = (POP.rise[k] ?? 30) * ease

    let alpha = (POP.alpha[k] ?? 1)
    if (u < POP.fadeIn) alpha *= u / POP.fadeIn
    if (t < POP.fadeOut) alpha *= t / POP.fadeOut

    // 나오는 순간 살짝 크게 — "터져 나왔다"의 절반은 이 0.16초다
    const punch = u < POP.punchIn ? POP.punch * (1 - u / POP.punchIn) : 0
    const w = p.weight[i] ?? 0
    const size = ((POP.size[k] ?? 14) + (POP.sizeGain[k] ?? 0) * w) * (1 + punch)

    let fi = Math.round(size) - FONT_MIN
    if (fi < 0) fi = 0
    else if (fi >= FONTS.length) fi = FONTS.length - 1

    let sx = worldToScreenX(cam, p.x[i] ?? 0)
    const sy = worldToScreenY(cam, p.y[i] ?? 0) - (POP.lift[k] ?? 14) - rise

    if (k === K_CRIT) {
      // 정중앙은 흔들린다. 진폭은 수명에 비례해 줄어 조준할 때쯤엔 이미 사라져 있다.
      sx += Math.sin((ttl - life) * POP.critShakeHz * TAU) * POP.critShakePx * t
    } else if (k === K_CHAIN) {
      // 슬롯마다 다른 어긋남. 연달아 터진 팝이 한 줄로 겹쳐 읽히지 않게 한다.
      sx += ((i * 7) % 5 - 2) * POP.spreadPx
    }

    // 점수가 클수록 밝게 — 가중치가 낮으면 살짝 죽인다
    ctx.globalAlpha = alpha * (k === K_SCORE ? 0.78 + 0.22 * w : 1)
    ctx.fillStyle = COLOR[k] ?? THEME.hudText
    ctx.font = FONTS[fi] ?? FONTS[0] ?? '700 15px sans-serif'
    ctx.fillText(txt, sx, sy)
  }

  ctx.globalAlpha = 1
}
