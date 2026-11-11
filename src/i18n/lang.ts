/**
 * 말 고르기 — ?lang=en|ko > localStorage['hanbal.lang'] > navigator.language > 'ko'.
 * 상태는 이 모듈 하나가 쥔다(sim 은 안 읽는다). 바꾸면 다시 열어야 모든 화면이 갈아입는다(setLang 이 새로고침은 하지 않는다 · 부르는 쪽이 정한다).
 */
export type Lang = 'ko' | 'en'
export const LANGS: readonly Lang[] = ['ko', 'en']
export const LANG_KEY = 'hanbal.lang'

export function parseLang(v: string | null | undefined): Lang | null {
  if (v == null) return null
  const s = v.toLowerCase()
  if (s === 'ko' || s.startsWith('ko-')) return 'ko'
  if (s === 'en' || s.startsWith('en-')) return 'en'
  return null
}

/** 순서대로 따져 정한다 — 순수 함수(시험하기 좋게 입력을 받는다) */
export function pickLang(search: string, stored: string | null, nav: string | null): Lang {
  let q: string | null = null
  try { q = new URLSearchParams(search).get('lang') } catch { q = null }
  return parseLang(q) ?? parseLang(stored) ?? parseLang(nav) ?? 'ko'
}

let cur: Lang | null = null

function detect(): Lang {
  let search = ''
  let stored: string | null = null
  let nav: string | null = null // 브라우저에서만 본다 (노드 시험이 영어 PC 라고 영어로 돌지 않게)
  try { search = globalThis.location?.search ?? '' } catch { search = '' }
  try { stored = globalThis.localStorage?.getItem(LANG_KEY) ?? null } catch { stored = null }
  try { nav = globalThis.document !== undefined ? globalThis.navigator?.language ?? null : null } catch { nav = null }
  return pickLang(search, stored, nav)
}

/** 글자 길이가 말마다 달라 CSS 가 말로 갈린다 — <html lang data-lang> (레이아웃 검사 · docs/realm/I18N.md) */
function mark(l: Lang): void {
  try { const el = globalThis.document?.documentElement; if (el !== undefined) { el.setAttribute('lang', l); el.dataset['lang'] = l } } catch { /* DOM 없는 곳 */ }
}

export function lang(): Lang {
  if (cur === null) { cur = detect(); mark(cur) }
  return cur
}

/** 고른 말을 기억한다(주소의 ?lang= 은 그보다 앞서니 새로고침 땐 주소에서 지운다) */
export function setLang(l: Lang): void {
  cur = l
  try { globalThis.localStorage?.setItem(LANG_KEY, l) } catch { /* 저장 못 하는 곳 */ }
  mark(l)
}

/** 시험용 — 고른 말을 직접 정한다(저장 안 함) */
export function forceLang(l: Lang | null): void { cur = l }
