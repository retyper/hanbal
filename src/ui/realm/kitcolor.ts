/**
 * 나라의 두 빛 — 축구팀 유니폼처럼 바탕 빛(color)과 둘째 빛(color2) (형 10-26: "적국 수가 막 7개 넘어가면 어느 나라가 어느 나라인지 전혀 구분이 안 가")
 *
 * 문명처럼 고을 이름표를 주인 나라의 바탕 빛으로 칠하고, 둘째 빛을 굵은 띠로 두른다.
 * 바탕 빛이 비슷한 두 나라는 둘째 빛으로 가른다 — 그 판정이 kitClash (tests/realm/kit-color.test.ts · tools/kit-colors.ts).
 * 화면(ui)만 읽는다. 판(realm 상태)에는 빛이 없다.
 */
import { FACTION_ART } from '../../realm/data/art.ts'
import { P } from '../../tune/params.ts'

type Rgb = readonly [number, number, number]
type Lab = readonly [number, number, number]

/** '#rrggbb' → [r, g, b] 0~255 */
export function rgbOf(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1, 7), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const lin = (c: number): number => {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

/** 밝기 (WCAG 상대 휘도 0~1) */
export function luminance(hex: string): number {
  const [r, g, b] = rgbOf(hex)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

/** sRGB → CIELAB (D65) */
export function labOf(hex: string): Lab {
  const [r, g, b] = rgbOf(hex).map(lin) as unknown as Rgb
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
  const f = (t: number): number => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116)
  const [fx, fy, fz] = [f(x), f(y), f(z)]
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

/** 두 빛의 거리 (CIE76 ΔE — 2.3 이면 겨우 보이고, 20 넘으면 다른 빛) */
export function deltaE(a: string, b: string): number {
  const [l1, a1, b1] = labOf(a)
  const [l2, a2, b2] = labOf(b)
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2)
}

/** 그 빛 위에 얹을 글씨 빛 — 밝은 바탕엔 먹빛, 어두운 바탕엔 흰빛 */
export function inkOn(hex: string): string {
  return luminance(hex) >= P.realm.kitInkLum ? '#1c140a' : '#fffaf0'
}

export interface NationKit {
  /** 바탕 빛 — 이름표의 몸 */
  readonly c: string
  /** 둘째 빛 — 이름표의 띠 */
  readonly c2: string
  /** 바탕 위 글씨 빛 */
  readonly ink: string
}

const NO_KIT: NationKit = { c: '#cccccc', c2: '#5a4a36', ink: '#1c140a' }

/** 나라 id → 두 빛 */
export function nationKit(f: string | null | undefined): NationKit {
  const a = f != null ? FACTION_ART[f] : undefined
  return a === undefined ? NO_KIT : { c: a.color, c2: a.color2, ink: inkOn(a.color) }
}

/** CSS 변수 묶음 — `--c` 바탕 · `--c2` 띠 · `--ink` 글씨 (style 속성에 그대로) */
export const kitVars = (f: string | null | undefined): string => {
  const k = nationKit(f)
  return `--c:${k.c};--c2:${k.c2};--ink:${k.ink}`
}

/**
 * 두 나라의 옷이 겹치는가 — 바탕 빛이 멀면 갈린다. 바탕이 가까우면 둘째 빛이 멀어야 한다.
 * 겹치면 그 까닭을 말로, 아니면 null
 */
export function kitClash(a: string, b: string): string | null {
  const A = FACTION_ART[a]
  const B = FACTION_ART[b]
  if (A === undefined || B === undefined) return `${A === undefined ? a : b}: 빛이 없다`
  const dm = deltaE(A.color, B.color)
  if (dm >= P.realm.kitMainFar) return null
  const ds = deltaE(A.color2, B.color2)
  return ds >= P.realm.kitSecondFar ? null : `${a}·${b}: 바탕 ΔE ${dm.toFixed(1)} · 둘째 ΔE ${ds.toFixed(1)}`
}

/** 제 옷 안에서 띠가 바탕에 묻히는가 — 묻히면 까닭, 아니면 null */
export function kitSelfClash(f: string): string | null {
  const A = FACTION_ART[f]
  if (A === undefined) return `${f}: 빛이 없다`
  const d = deltaE(A.color, A.color2)
  return d >= P.realm.kitSelfFar ? null : `${f}: 바탕과 띠 ΔE ${d.toFixed(1)}`
}
