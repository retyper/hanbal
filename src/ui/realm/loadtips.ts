/**
 * 첫 스플래시 · 판에 들어갈 때 가림막의 가운데 한 줄 (형 11-03: "스플래시 좀 더 길게 · 화면 중앙에 게임 tip 이나 역사적 사실, 기록 한 줄씩 · 읽을 수 있을 정도로 시간 좀 주고").
 * 도움말은 시스템 말이라 존댓말, 옛 기록은 이야기라 평서 (메모리 system-text-honorific). 기록은 사서에 적힌 것만 · 출처를 끝에 붙인다.
 * 고르는 굴림은 화면 쪽 무작위다 — 판의 결정론(A1)과 상관없다.
 */
import { lazyList, t as tr } from '../../i18n/index.ts'

export interface LoadTip {
  readonly kind: 'tip' | 'lore'
  readonly text: string
}

const TIPS: readonly string[] = lazyList('tip', 12)

const LORE: readonly string[] = lazyList('lore', 15)

let last = ''
/** 한 줄 — 바로 앞 줄과 겹치지 않게 · 셋에 둘은 옛 기록 */
export function loadTip(): LoadTip {
  for (let i = 0; i < 6; i++) {
    const lore = Math.random() < 0.6
    const pool = lore ? LORE : TIPS
    const text = pool[Math.floor(Math.random() * pool.length)]!
    if (text === last) continue
    last = text
    return { kind: lore ? 'lore' : 'tip', text }
  }
  return { kind: 'tip', text: TIPS[0]! }
}

/** 읽을 시간 — 글자 수에 비례 (메모리 notices-must-dismiss 의 noticeMs 와 같은 결) */
export function tipReadMs(t: LoadTip, minMs: number, perChar: number, maxMs: number): number {
  return Math.min(maxMs, Math.max(minMs, 1200 + t.text.length * perChar))
}

/** 가운데 한 줄 HTML — 작은 머리말(도움말 · 옛 기록)과 본문 */
export function tipHtml(t: LoadTip, esc: (s: string) => string): string {
  // 출처(『삼국사기』 …)는 작게 따로 — 본문이 먼저 읽히게
  const m = t.kind === 'lore' ? /^(.*?)\s*(『[^』]+』.*)$/.exec(t.text) : null
  const body = m !== null ? `${esc(m[1]!)}<small class="tips">${esc(m[2]!)}</small>` : esc(t.text)
  return `<span class="tipk">${tr(t.kind === 'lore' ? 'lt.lore' : 'lt.help')}</span>${body}`
}
