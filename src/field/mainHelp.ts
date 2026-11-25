/**
 * 조작표 한 장 (? 단추 · ? 키) 과 처음 10초 안내 (50-control-v2.md) — DOM.
 * 조작표는 떴다 사라지는 상자다 (스크롤 없음 · 아무 데나 누르거나 Esc · ? 로 닫힌다). 키 글자는 전부 actions.ts 표에서 읽는다.
 * 처음 10초 안내는 그림 하나 + 한 줄: PC 는 마우스 그림(오른쪽 단추가 깜박), 폰은 누르라는 고리. 장수가 움직이면 걷힌다.
 */
import { t } from '../i18n/index.ts'
import { keyLabel, KEYS, type ActionName } from './actions.ts'

export interface Help { toggle(): void; close(): void; isOpen(): boolean }
export interface First { sync(show: boolean, x: number, y: number, touch: boolean, vpW: number, vpH: number): void }

const GOLD = '#ffd27a'
const CSS = `
#fd-help{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#000a;z-index:20;padding:0 calc(12px + env(safe-area-inset-right)) 0 calc(12px + env(safe-area-inset-left));box-sizing:border-box}
#fd-help[hidden]{display:none}
#fd-help>div{max-width:min(760px,100%);background:#10140df2;border:1px solid ${GOLD}88;border-radius:12px;padding:10px 14px;box-sizing:border-box;color:#f3ecd8}
#fd-help h2{margin:0 0 6px;font-size:17px;color:${GOLD}}
#fd-help .cols{display:flex;gap:16px}
#fd-help .cols>div{flex:1 1 0;min-width:0}
#fd-help h3{margin:0 0 3px;font-size:13px;color:#9cc8ff}
#fd-help p{margin:0 0 4px;font-size:12.5px;line-height:1.35}
#fd-help .x{margin:6px 0 0;font-size:12px;color:#f3ecd8aa}
@media (max-width:700px){#fd-help .cols{gap:10px}#fd-help p{font-size:12px}}
#fd-first{position:absolute;left:0;top:0;display:flex;align-items:center;gap:8px;pointer-events:none;z-index:4;font-size:15px;font-weight:700;color:#fff;text-shadow:0 1px 3px #000,0 0 8px #000;white-space:nowrap}
#fd-first[hidden]{display:none}
#fd-first svg{width:34px;height:44px;flex:none}
#fd-first .rb{animation:fd-blink .8s steps(1) infinite}
#fd-first .tap{width:30px;height:30px;border:3px solid ${GOLD};border-radius:50%;flex:none;animation:fd-blink .8s steps(1) infinite}
@keyframes fd-blink{50%{opacity:.25}}
`

/** 조작표에 적을 한 줄들 (키 글자는 표에서 · 아직 안 되는 동작의 줄은 만들지 않는다) */
function rows(): { pc: string[]; touch: string[] } {
  const k = (a: ActionName, i = 0): string => keyLabel(KEYS[a][i] ?? '')
  return {
    pc: [
      t('field.help.pc.pick', { k1: k('pickHero'), k2: k('pickFront'), k3: k('pickBows'), k4: k('pickHorse'), k5: k('pickAll') }),
      t('field.help.pc.send'),
      t('field.help.pc.stance', { k1: k('cmd1'), k2: k('cmd2'), k3: k('cmd3'), k4: k('cmd4') }),
      t('field.help.pc.cam', { k1: k('camFree'), k2: k('camFight') }),
      t('field.help.pc.pause', { k1: k('pause'), k2: k('pause', 1), k3: k('slow'), k4: k('go') }),
    ],
    touch: [t('field.help.t.pick'), t('field.help.t.send'), t('field.help.t.stance'), t('field.help.t.cam')],
  }
}

export function mountHelp(root: HTMLElement): Help {
  const style = document.createElement('style')
  style.textContent = CSS
  document.head.append(style)
  const box = document.createElement('div')
  box.id = 'fd-help'; box.hidden = true
  const r = rows()
  box.innerHTML = `<div><h2>${t('field.help.title')}</h2><div class="cols"><div><h3>${t('field.help.pc')}</h3>${r.pc.map(s => `<p>${s}</p>`).join('')}</div><div><h3>${t('field.help.touch')}</h3>${r.touch.map(s => `<p>${s}</p>`).join('')}</div></div><p class="x">${t('field.help.close', { k: k0() })}</p></div>`
  box.addEventListener('pointerdown', e => { e.stopPropagation(); box.hidden = true })
  root.append(box)
  return {
    toggle() { box.hidden = !box.hidden },
    close() { box.hidden = true },
    isOpen() { return !box.hidden },
  }
}
const k0 = (): string => keyLabel(KEYS.help[0] ?? '')

export function mountFirst(root: HTMLElement): First {
  const el = document.createElement('div')
  el.id = 'fd-first'; el.hidden = true
  let mode = ''
  let w = 220, h = 44
  root.append(el)
  return {
    sync(show, x, y, touch, vpW, vpH) {
      if (!show) { if (!el.hidden) el.hidden = true; return }
      const m = touch ? 'touch' : 'pc'
      if (m !== mode) {
        mode = m
        el.innerHTML = touch
          ? `<span class="tap"></span><span>${t('field.first.touch')}</span>`
          : `<svg viewBox="0 0 34 44" aria-hidden="true"><rect x="2" y="2" width="30" height="40" rx="15" fill="#0b1a2ecc" stroke="#f3ecd8" stroke-width="2.5"/><path class="rb" d="M17 2 H17 A15 15 0 0 1 32 17 V18 H17 Z" fill="${GOLD}"/><path d="M17 2 V18 M2 18 H32" stroke="#f3ecd8" stroke-width="2" fill="none"/></svg><span>${t('field.first.pc')}</span>`
      }
      el.hidden = false
      if (el.dataset['m'] !== m) { el.dataset['m'] = m; w = el.offsetWidth || 220; h = el.offsetHeight || 44 }
      // 장수 곁 오른쪽 위 · 화면 밖으로 안 나가게
      const px = Math.max(8, Math.min(vpW - w - 8, x + 40)), py = Math.max(60, Math.min(vpH - h - 120, y - 80))
      el.style.transform = `translate(${Math.round(px)}px,${Math.round(py)}px)`
    },
  }
}

/** 첫 판 안내: 사기 띠 아래 「이기는 법」 한 줄과 화면 가장자리의 처음 걸음 한 줄 (하나를 끝내면 ✓ 로 바뀌었다가 다음이 뜬다) */
export interface Steps { sync(goal: boolean, step: string | null, ok: boolean): void }
const STEPS_CSS = `
#fd-goal{position:absolute;left:50%;transform:translateX(-50%);top:calc(36px + env(safe-area-inset-top));font-size:13px;font-weight:700;color:#fff;background:#0009;border-radius:8px;padding:3px 10px;pointer-events:none;white-space:nowrap;z-index:4}
#fd-step{position:absolute;left:calc(8px + env(safe-area-inset-left));top:calc(62px + env(safe-area-inset-top));font-size:14px;font-weight:700;color:#fff;background:#000b;border:1px solid ${GOLD}88;border-radius:8px;padding:4px 10px;pointer-events:none;white-space:nowrap;z-index:4}
#fd-step.ok{color:${GOLD}}
#fd-goal[hidden],#fd-step[hidden]{display:none}
`
export function mountSteps(root: HTMLElement): Steps {
  const style = document.createElement('style')
  style.textContent = STEPS_CSS
  document.head.append(style)
  const goal = document.createElement('div'); goal.id = 'fd-goal'; goal.hidden = true; goal.textContent = t('field.goal')
  const step = document.createElement('div'); step.id = 'fd-step'; step.hidden = true
  root.append(goal, step)
  let last = ''
  return {
    sync(showGoal, text, ok) {
      if (goal.hidden === showGoal) goal.hidden = !showGoal
      const k = `${text ?? ''}|${ok ? 1 : 0}`
      if (k === last) return
      last = k
      step.hidden = text === null
      step.textContent = text === null ? '' : (ok ? '✓ ' : '') + text
      step.className = ok ? 'ok' : ''
    },
  }
}
