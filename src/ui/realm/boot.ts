/**
 * 부팅 연출 — 제작사 카드 → 게임 로고 카드. 처음 켤 때 한 번(탭 하나에 한 번)만, 아무 데나 누르면 바로 건너뛴다.
 * 스플래시(realm.html #splash) 위에 얹혀 같이 흐른다 — 받는 일은 뒤에서 계속되고, 걷히면 스플래시(도움말 한 줄)가 이어 보인다.
 * 제작사 이름이 비어 있으면(realm/studio.ts) 제작사 카드는 없다. 로고는 그림이라 제목이 바뀌어도 코드는 그대로.
 * 숨은 탭에서는 시작하지 않고, 도중에 숨으면 바로 걷는다 (규칙 4).
 */
import { t } from '../../i18n/index.ts'
import { STUDIO_NAME } from '../../realm/studio.ts'
import { P } from '../../tune/params.ts'

const SEEN_KEY = 'hanbal.boot'
let shown = false

function seenThisSession(): boolean {
  if (shown) return true
  try { return sessionStorage.getItem(SEEN_KEY) === '1' } catch { return false }
}

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)

const CSS = `
#bootcards { position: fixed; inset: 0; z-index: 10000; display: grid; place-items: center; background: #0a0907 radial-gradient(ellipse at 50% 45%, #1d1812 0, #0a0907 70%); cursor: pointer; transition: opacity var(--bfade) ease; }
#bootcards.out { opacity: 0; pointer-events: none; }
#bootcards .bc { grid-area: 1 / 1; display: flex; flex-direction: column; align-items: center; gap: 14px; max-width: 86vw; text-align: center; opacity: 0; transition: opacity var(--bfade) ease; }
#bootcards .bc.on { opacity: 1; }
#bootcards .bcname { margin: 0; font: 700 34px/1.3 'Gowun Batang', serif; letter-spacing: .1em; color: #c9a45a; background: linear-gradient(#f0d28a, #a8803f 60%, #7a5a2a); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; filter: drop-shadow(0 2px 10px #000); word-break: keep-all; }
#bootcards .bcsub { margin: 0; font: 13px/1.4 'Gowun Dodum', sans-serif; letter-spacing: .3em; color: #8e8166; }
#bootcards img { max-width: min(80vw, 520px); max-height: 46vh; width: auto; height: auto; filter: drop-shadow(0 0 22px #e8b85a40); }
@media (prefers-reduced-motion: reduce) { #bootcards, #bootcards .bc { transition: none; } }
`

/** 부팅 카드를 연다. 보였으면 true. 이미 본 탭 · 숨은 탭이면 아무것도 안 한다 */
export function showBoot(base: string): boolean {
  if (seenThisSession() || document.hidden) return false
  shown = true
  try { sessionStorage.setItem(SEEN_KEY, '1') } catch { /* 못 남겨도 이 로드에서는 한 번뿐 */ }
  const cards: string[] = []
  if (STUDIO_NAME.trim() !== '') cards.push(`<div class="bc"><p class="bcname">${esc(STUDIO_NAME)}</p><p class="bcsub">${esc(t('boot.presents'))}</p></div>`)
  cards.push(`<div class="bc"><img src="${base}realm/logo/title.png" alt="${esc(t('boot.logoAlt'))}" /></div>`)

  const el = document.createElement('div')
  el.id = 'bootcards'
  el.setAttribute('role', 'presentation')
  el.style.setProperty('--bfade', `${P.realm.bootFadeMs}ms`)
  el.innerHTML = `<style>${CSS}</style>${cards.join('')}`
  document.body.appendChild(el)

  const els = [...el.querySelectorAll<HTMLElement>('.bc')]
  const timers: number[] = []
  let done = false
  const end = (): void => {
    if (done) return
    done = true
    timers.forEach((x) => clearTimeout(x))
    document.removeEventListener('visibilitychange', onVis)
    removeEventListener('keydown', end, true)
    el.classList.add('out')
    setTimeout(() => el.remove(), P.realm.bootFadeMs + 60)
  }
  const onVis = (): void => { if (document.hidden) { el.remove(); done = true; timers.forEach((x) => clearTimeout(x)) } }
  document.addEventListener('visibilitychange', onVis)
  el.addEventListener('pointerdown', end)
  addEventListener('keydown', end, true)

  const card = P.realm.bootCardMs
  const fade = P.realm.bootFadeMs
  els.forEach((c, i) => {
    const at = i * card
    timers.push(window.setTimeout(() => c.classList.add('on'), at + 30))
    timers.push(window.setTimeout(() => c.classList.remove('on'), at + card))
  })
  timers.push(window.setTimeout(end, els.length * card + fade))
  return true
}
