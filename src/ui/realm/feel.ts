/**
 * 확률을 숫자 대신 색과 말로 (형: "숫자나오면 재미없잖아" — 2026-10-18)
 *
 * 판정은 그대로 확률이고, 화면만 감으로 보인다. 아는 만큼만 또렷하다: 범위가 넓으면 칩이 두 색으로 번지고 "?" 가 붙는다.
 * 단계 경계는 화면의 말일 뿐이라 params 가 아니라 여기 둔다 (규칙 3 은 판의 수치).
 * 말은 "~할 듯" 꼴을 버리고 한눈에 읽히는 낱말로 (형 10-23: "거의 된다 · 될 듯 · 안 될 듯 … 어휘 표현 좀 적절한 거 없나").
 */

interface Tier { readonly at: number; readonly word: string; readonly color: string }

/** 싸움 — 이길 확률 */
const FIGHT: readonly Tier[] = [
  { at: 0.85, word: '압도', color: '#3f8f3a' },
  { at: 0.65, word: '우세', color: '#7aa83a' },
  { at: 0.45, word: '팽팽', color: '#c9a23a' },
  { at: 0.25, word: '불리', color: '#d0702f' },
  { at: 0, word: '무모', color: '#b83a2a' },
]

/** 사신 — 받아들일 확률 */
const ENVOY: readonly Tier[] = [
  { at: 0.7, word: '반긴다', color: '#3f8f3a' },
  { at: 0.45, word: '솔깃', color: '#7aa83a' },
  { at: 0.25, word: '망설인다', color: '#c9a23a' },
  { at: 0.1, word: '시큰둥', color: '#d0702f' },
  { at: 0, word: '퇴짜', color: '#b83a2a' },
]

/** 기습 — 안 들키고 닿을 확률 */
const AMBUSH: readonly Tier[] = [
  { at: 0.7, word: '감쪽같다', color: '#3f8f3a' },
  { at: 0.45, word: '아슬아슬', color: '#7aa83a' },
  { at: 0.25, word: '들킬라', color: '#d0702f' },
  { at: 0, word: '빤히 보인다', color: '#b83a2a' },
]

/** 공작 — 먹힐 확률 */
const PLOT: readonly Tier[] = [
  { at: 0.7, word: '확실', color: '#3f8f3a' },
  { at: 0.45, word: '승산 있다', color: '#7aa83a' },
  { at: 0.25, word: '해볼 만', color: '#c9a23a' },
  { at: 0.1, word: '어렵다', color: '#d0702f' },
  { at: 0, word: '가망 없다', color: '#b83a2a' },
]

/** 경계 — 높을수록 기습이 어렵다 */
const ALERT: readonly Tier[] = [
  { at: 0.6, word: '삼엄하다', color: '#b83a2a' },
  { at: 0.3, word: '살핀다', color: '#c9a23a' },
  { at: 0, word: '느슨하다', color: '#3f8f3a' },
]

/** 범위가 이보다 넓으면 "가늠이 덜 됐다" */
const WIDE = 0.3

const tierOf = (tiers: readonly Tier[], p: number): Tier => tiers.find((t) => p >= t.at) ?? tiers[tiers.length - 1]!

function chip(tiers: readonly Tier[], lo: number, hi: number): string {
  const mid = tierOf(tiers, (lo + hi) / 2)
  const a = tierOf(tiers, lo).color
  const b = tierOf(tiers, hi).color
  const wide = hi - lo > WIDE
  const bg = a === b ? a : `linear-gradient(90deg, ${a}, ${b})`
  return `<span class="feel${wide ? ' wide' : ''}" style="background:${bg}">${mid.word}${wide ? ' ?' : ''}</span>`
}

export const fightFeel = (lo: number, hi: number): string => chip(FIGHT, lo, hi)
export const envoyFeel = (lo: number, hi: number): string => chip(ENVOY, lo, hi)
export const ambushFeel = (p: number): string => chip(AMBUSH, p, p)
/** 호감 −100..100 — 숫자 없이 사이의 온도로 */
const FAVOR: readonly Tier[] = [
  { at: 60, word: '매우 가깝다', color: '#3f8f3a' },
  { at: 25, word: '가깝다', color: '#7aa83a' },
  { at: -25, word: '데면데면', color: '#80706a' },
  { at: -60, word: '껄끄럽다', color: '#d0702f' },
  { at: -Infinity, word: '원수 같다', color: '#b83a2a' },
]
export const favorFeel = (v: number): string => `<span class="feel" style="background:${tierOf(FAVOR, v).color}">호감 · ${tierOf(FAVOR, v).word}</span>`
export const plotFeel =(lo: number, hi: number): string => chip(PLOT, lo, hi)
export const alertFeel =(lo: number, hi: number): string => chip(ALERT, lo, hi)
/** 모르는 싸움 — 본 적 없는 곳 */
export const unknownFeel = (): string => `<span class="feel unknown">모른다</span>`

export const FEEL_CSS = `
.ap .feel { display: inline-block; padding: 2px 9px; border-radius: 11px; color: #fff; font-size: 12.5px; font-weight: 700; line-height: 1.5;
  text-shadow: 0 1px 1px #0008; white-space: nowrap; vertical-align: middle; }
.ap .feel.wide { opacity: .85; border: 1px dashed #fff8; }
.ap .feel.unknown { background: #54412a; color: #c8c0b0; }
`
