/**
 * 아래 띠 (깃발) — 무리 칸 셋 + 장수 칸 · 자세 상자 · 전투 개시 단추 · 한 줄 말 (40-cards.md F5a)
 * DOM 이다. sim 을 모른다: 읽는 것은 VModel(viewRead.ts)과 pickmodel.ts 의 목록뿐이고, 눌림은 handlers 로 field-main 에 알린다.
 * 새 UI 의 네 가지: 설명(무엇인지 · 위의 힌트 줄) · 반응(누르면 커진다) · 눌린 채(금빛 테두리 + ✓) · 까닭(못 누르면 왜인지).
 * 시간이 지나 사라지는 글은 타이머를 예약하지 않고 frame(now) 이 지운다 (숨은 탭에서는 아무것도 안 돈다).
 */
import { t } from '../i18n/index.ts'
import { P } from '../tune/params.ts'
import { cellWhy, pickables, type UiState } from './pickmodel.ts'
import type { InputGroup } from './types.ts'
import type { VModel } from './viewRead.ts'

export interface FlagsHandlers {
  onCell(g: InputGroup): void
  onStance(g: InputGroup, intent: 'charge' | 'hold' | 'open'): void
  onAuto(g: InputGroup): void
  onGo(): void
}
export type Tone = 'ok' | 'why' | 'live'
export interface FlagsView {
  /** usedNow: 무리별로 이번 때에 쓴 입력 수 (줄 선 것까지) · stance: 앞줄 지금 자세 */
  sync(m: VModel, ui: UiState, usedNow: readonly number[], stance: number): void
  say(text: string, tone: Tone, nowMs: number): void
  /** 쥐고 있는 동안 보이는 말 (놓으면 사라진다) */
  live(text: string | null): void
  frame(nowMs: number): void
}

const CELL_ICON = ['icon/unit-spear.png', 'icon/unit-archer.png', 'icon/unit-buyeo-cavalry.png', 'icon/unit-general.png']
const STANCE_FLAG = ['flag/flag-charge.png', 'flag/flag-hold.png', 'flag/flag-open.png']
const STANCE_KEY = ['charge', 'hold', 'open'] as const
const GOLD = '#ffd27a'

const CSS = `
#fd-strip{position:absolute;left:0;right:0;bottom:0;min-height:calc(var(--fd-bar,64px) + 6px);padding:0 calc(8px + env(safe-area-inset-right)) calc(6px + env(safe-area-inset-bottom)) calc(8px + env(safe-area-inset-left));display:flex;align-items:flex-end;gap:8px;pointer-events:none}
#fd-strip[hidden]{display:none}
#fd-strip>*{pointer-events:auto}
.fd-cells{display:flex;gap:6px}
.fd-slot{position:relative}
.fd-cell{position:relative;width:84px;min-height:var(--fd-bar,64px);box-sizing:border-box;font:inherit;color:#f3ecd8;background:#0b1a2ecc;border:2px solid #2f8cff88;border-radius:10px;padding:4px 4px 3px;display:flex;flex-direction:column;align-items:center;justify-content:space-between;gap:1px;transition:transform .08s,border-color .08s}
.fd-cell:active{transform:scale(1.12)}
.fd-cell img{width:30px;height:30px;object-fit:contain;display:block}
.fd-cell b{font-size:13px;line-height:1}
.fd-cell.on{border-color:${GOLD};background:#2a2410d9;box-shadow:0 0 0 1px ${GOLD}66}
.fd-cell.no{opacity:.4}
.fd-ck{position:absolute;right:3px;top:2px;font-size:13px;color:${GOLD};font-style:normal;display:none}
.fd-cell.on .fd-ck{display:block}
.fd-pips{display:flex;gap:3px;height:6px}
.fd-pips i{width:12px;height:5px;border-radius:2px;background:#fff3;display:block}
.fd-pips i.f{background:#7fb8ff}
.fd-cell.on .fd-pips i.f{background:${GOLD}}
.fd-pop{position:absolute;left:0;bottom:calc(100% + 6px);display:flex;gap:6px;background:#000d;border:1px solid ${GOLD}88;border-radius:10px;padding:6px;z-index:3}
.fd-opt{font:inherit;color:#f3ecd8;background:#0b1a2ecc;border:2px solid #2f8cff88;border-radius:8px;min-width:64px;min-height:56px;padding:3px 6px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;position:relative;font-size:13px;transition:transform .08s}
.fd-opt:active{transform:scale(1.12)}
.fd-opt img{width:30px;height:30px;object-fit:contain}
.fd-opt.on{border-color:${GOLD};background:#2a2410d9}
.fd-opt.on::after{content:'✓';position:absolute;right:3px;top:0;color:${GOLD};font-size:13px}
.fd-go{margin-left:auto;font:inherit;font-size:20px;font-weight:700;color:#1a1305;background:${GOLD};border:0;border-radius:12px;min-height:var(--fd-bar,64px);min-width:132px;padding:0 20px;box-shadow:0 2px 10px #0008;transition:transform .08s}
.fd-go:active{transform:scale(1.08)}
.fd-go[hidden]{display:none}
#fd-say{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(var(--fd-bar,64px) + 22px + env(safe-area-inset-bottom));max-width:90vw;text-align:center;font-size:22px;font-weight:700;color:#fff;text-shadow:0 1px 3px #000,0 0 8px #000;pointer-events:none;white-space:nowrap}
#fd-say[hidden]{display:none}
#fd-say.ok{color:${GOLD}}
#fd-say.why{color:#ffc7b0;font-size:18px}
#fd-hint{position:absolute;left:calc(8px + env(safe-area-inset-left));bottom:calc(var(--fd-bar,64px) + 14px + env(safe-area-inset-bottom));display:flex;gap:8px;align-items:center;font-size:12px;color:#f3ecd8;pointer-events:none;flex-wrap:wrap;max-width:60vw}
#fd-hint[hidden]{display:none}
#fd-hint span{background:#0009;border-radius:6px;padding:3px 7px;display:flex;align-items:center;gap:4px}
#fd-hint img{width:16px;height:16px;object-fit:contain}
`

export function mountFlags(root: HTMLElement, base: string, h: FlagsHandlers): FlagsView {
  const style = document.createElement('style')
  style.textContent = CSS
  document.head.append(style)
  const strip = document.createElement('div')
  strip.id = 'fd-strip'
  strip.style.setProperty('--fd-bar', `${P.field.flagBarPx}px`)
  strip.innerHTML = `<div class="fd-cells"></div><button class="fd-go" type="button" hidden>${t('field.go')}</button>`
  const say = document.createElement('div'); say.id = 'fd-say'; say.hidden = true
  const hint = document.createElement('div'); hint.id = 'fd-hint'; hint.hidden = true
  root.style.setProperty('--fd-bar', `${P.field.flagBarPx}px`)
  root.append(hint, say, strip)
  const cells = strip.querySelector('.fd-cells') as HTMLDivElement
  const go = strip.querySelector('.fd-go') as HTMLButtonElement
  go.addEventListener('click', () => h.onGo())
  cells.addEventListener('click', e => {
    const el = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null
    if (el === null) return
    const g = Number(el.dataset['g']) as InputGroup
    const act = el.dataset['act']
    if (act === 'cell') h.onCell(g)
    else if (act === 'stance') h.onStance(g, STANCE_KEY[Number(el.dataset['st'])]!)
    else if (act === 'auto') h.onAuto(g)
  })

  let sig = ''
  let sayUntil = 0
  let liveText: string | null = null
  let sayText = ''
  let sayTone: Tone = 'ok'
  const img = (src: string): string => `<img src="${base}${src}" alt="" draggable="false">`
  const paintSay = (): void => {
    const text = liveText ?? sayText
    say.hidden = text === ''
    say.textContent = text
    say.className = liveText !== null ? 'live' : sayTone
  }

  return {
    sync(m, ui, usedNow, stance) {
      const alive = [0, 1, 2, 3].map(g => cellWhy(m, g as InputGroup) === null ? 1 : 0)
      const key = [ui.phase, ui.sel, ui.popup ? 1 : 0, alive.join(''), usedNow.join(','), stance, m.end === null ? 0 : 1].join('|')
      if (key === sig) return
      sig = key
      strip.hidden = ui.phase === 'end' || m.end !== null
      go.hidden = ui.phase !== 'ready'
      const items = pickables(m, ui)
      const open = items.some(i => i.kind !== 'cell')
      let html = ''
      for (const g of [0, 1, 2, 3] as const) {
        const live = alive[g] === 1
        const left = Math.max(0, P.field.inputPerGroupPerTime - (usedNow[g] ?? 0))
        const pips = Array.from({ length: P.field.inputPerGroupPerTime }, (_, i) => `<i class="${i < left ? 'f' : ''}"></i>`).join('')
        let pop = ''
        if (open && ui.sel === g) {
          pop = '<div class="fd-pop">' + items.map(i => i.kind === 'stance' && i.stance !== -1
            ? `<button class="fd-opt${stance === i.stance ? ' on' : ''}" type="button" data-act="stance" data-g="${g}" data-st="${i.stance}">${img(STANCE_FLAG[i.stance]!)}<span>${t(`field.i.${STANCE_KEY[i.stance]!}`)}</span></button>`
            : `<button class="fd-opt" type="button" data-act="auto" data-g="${g}"><span>${t('field.auto')}</span></button>`).join('') + '</div>'
        }
        html += `<div class="fd-slot"><button class="fd-cell${ui.sel === g ? ' on' : ''}${live ? '' : ' no'}" type="button" data-act="cell" data-g="${g}" aria-pressed="${ui.sel === g}" aria-label="${t(`field.g.${g}`)}">${img(CELL_ICON[g]!)}<b>${t(`field.g.${g}`)}</b><span class="fd-pips" title="${t('field.left', { n: left })}">${live ? pips : ''}</span><em class="fd-ck">✓</em></button>${pop}</div>`
      }
      cells.innerHTML = html
      const showHint = ui.phase !== 'end' && m.end === null && !ui.popup
      hint.hidden = !showHint
      if (showHint) {
        hint.innerHTML = ui.sel < 0 && ui.phase === 'ready'
          ? `<span>${t('field.hint.ready')}</span>`
          : ui.sel < 0 ? '' : `<span>${t('field.hint.tap')}</span><span>${img(STANCE_FLAG[1]!)}${t('field.hint.hold')}</span><span>${img(STANCE_FLAG[0]!)}${t('field.hint.charge')}</span><span>${img(STANCE_FLAG[2]!)}${t('field.hint.open')}</span>`
        if (hint.innerHTML === '') hint.hidden = true
      }
    },
    say(text, tone, nowMs) {
      sayText = text; sayTone = tone
      sayUntil = nowMs + P.field.noteMs
      paintSay()
    },
    live(text) {
      if (text === liveText) return
      liveText = text
      paintSay()
    },
    frame(nowMs) {
      if (sayText !== '' && nowMs >= sayUntil) { sayText = ''; paintSay() }
    },
  }
}
