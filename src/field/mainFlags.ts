/**
 * 아래 띠 (깃발) — 무리 칸 셋 + 장수 칸 · 자세 단추 셋 · 전투 개시 단추 · 한 줄 말 (50-control-v2.md)
 * DOM 이다. sim 을 모른다: 읽는 것은 VModel(viewRead.ts)과 pickmodel.ts 의 목록뿐이고, 눌림은 handlers 로 field-main 에 알린다.
 * 칸은 맵에서 누르는 것과 같은 일을 하는 지름길이다. 고른 칸은 금빛 테두리 + ✓ (여럿이 골라질 수 있다).
 * 자세 단추는 앞줄을 골랐을 때만 앞줄 칸 위에 뜬다 · 지금 자세에 ✓ · 다시 누르면 알아서.
 * 새 UI 의 네 가지: 설명(무엇인지 · 위의 힌트 줄) · 반응(누르면 커진다) · 눌린 채(금빛 테두리 + ✓) · 까닭(못 누르면 왜인지).
 * 시간이 지나 사라지는 글은 타이머를 예약하지 않고 frame(now) 이 지운다 (숨은 탭에서는 아무것도 안 돈다).
 */
import { t, type Key } from '../i18n/index.ts'
import { P } from '../tune/params.ts'
import { firstKeyLabel, type ActionName } from './actions.ts'
import { cellWhy, pickables, type UiState } from './pickmodel.ts'
import { BIG_ARTS } from './input.ts'
import type { InputGroup } from './types.ts'
import type { VModel } from './viewRead.ts'

export interface FlagsHandlers {
  onCell(g: InputGroup): void
  onBig(i: number): void
  onGo(): void
}
export type Tone = 'ok' | 'why'
/** 아래 띠가 알아야 하는 바깥 사정 — cmd: 앞줄·활·기병이 지금 고른 명령 번호(알아서면 -1) · sentGroup: 무리를 한 번이라도 보냈는가 · touch: 손으로 쓰는 화면인가 */
/** big: 앞줄이 지금 고른 명령 번호(0 돌격 · 1 방진 · 없으면 -1) · aiming: 찍는 중인 큰 수 번호(2 화살비 · 3 옆치기 · 아니면 -1) */
export interface FlagsCtx { front: number; aiming: number; sentGroup: boolean; touch: boolean }
export interface FlagsView {
  sync(m: VModel, ui: UiState, c: FlagsCtx): void
  say(text: string, tone: Tone, nowMs: number): void
  frame(nowMs: number): void
}

const CELL_ICON = ['icon/unit-spear.png', 'icon/unit-archer.png', 'icon/unit-buyeo-cavalry.png', 'icon/unit-general.png']
const CELL_ACTION: readonly ActionName[] = ['pickFront', 'pickBows', 'pickHorse', 'pickHero']
const CMD_ACTION: readonly ActionName[] = ['cmd1', 'cmd2', 'cmd3', 'cmd4']
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
.fd-kb{position:absolute;left:4px;top:2px;font-size:11px;line-height:1;color:#f3ecd8aa;font-style:normal}
@media (pointer:coarse){.fd-kb{display:none}}
.fd-pop{position:absolute;left:0;bottom:calc(100% + 6px);display:flex;gap:6px;background:#000d;border:1px solid ${GOLD}88;border-radius:10px;padding:6px;z-index:3}
.fd-opt{font:inherit;color:#f3ecd8;background:#0b1a2ecc;border:2px solid #2f8cff88;border-radius:8px;min-width:60px;min-height:56px;padding:3px 6px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;position:relative;font-size:13px;transition:transform .08s}
.fd-opt:active{transform:scale(1.12)}
.fd-opt img{width:30px;height:30px;object-fit:contain}
.fd-opt.on{border-color:${GOLD};background:#2a2410d9}
.fd-opt.on::after{content:'✓';position:absolute;right:3px;top:0;color:${GOLD};font-size:13px}
.fd-opt i{position:absolute;left:4px;top:2px;font-size:11px;line-height:1;color:#f3ecd8aa;font-style:normal}
@media (pointer:coarse){.fd-opt i{display:none}}
.fd-go{margin-left:auto;font:inherit;font-size:20px;font-weight:700;color:#1a1305;background:${GOLD};border:0;border-radius:12px;min-height:var(--fd-bar,64px);min-width:132px;padding:0 20px;box-shadow:0 2px 10px #0008;transition:transform .08s}
.fd-go:active{transform:scale(1.08)}
.fd-go[hidden]{display:none}
#fd-say{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(var(--fd-bar,64px) + 22px + env(safe-area-inset-bottom));max-width:90vw;text-align:center;font-size:22px;font-weight:700;color:#fff;text-shadow:0 1px 3px #000,0 0 8px #000;pointer-events:none;white-space:nowrap}
#fd-say[hidden]{display:none}
#fd-say.ok{color:${GOLD}}
#fd-say.why{color:#ffc7b0;font-size:18px}
#fd-hint{position:absolute;left:calc(8px + env(safe-area-inset-left));bottom:calc(var(--fd-bar,64px) + 14px + env(safe-area-inset-bottom));display:flex;gap:8px;align-items:center;font-size:12px;color:#f3ecd8;pointer-events:none;flex-wrap:wrap;max-width:60vw}
#fd-hint[hidden]{display:none}
#fd-tip{position:absolute;left:calc(8px + env(safe-area-inset-left));bottom:calc(var(--fd-bar,64px) + 84px + env(safe-area-inset-bottom));max-width:min(420px,70vw);background:#000d;border:1px solid ${GOLD}88;border-radius:8px;padding:6px 10px;font-size:13px;line-height:1.4;color:#f3ecd8;pointer-events:none;z-index:5}
#fd-tip[hidden]{display:none}
#fd-hint span{background:#0009;border-radius:6px;padding:3px 7px;display:flex;align-items:center;gap:4px}
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
  const tip = document.createElement('div'); tip.id = 'fd-tip'; tip.hidden = true
  root.append(hint, say, tip, strip)
  const cells = strip.querySelector('.fd-cells') as HTMLDivElement
  const go = strip.querySelector('.fd-go') as HTMLButtonElement
  go.addEventListener('click', () => h.onGo())
  cells.addEventListener('click', e => {
    const el = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null
    if (el === null) return
    const act = el.dataset['act']
    if (act === 'cell') h.onCell(Number(el.dataset['g']) as InputGroup)
    else if (act === 'big') h.onBig(Number(el.dataset['i']))
  })

  /** 명령 단추를 누르고 있는 중 (오래 누르면 뜻 한 줄 · 그때 뗀 손은 명령으로 치지 않는다) */
  let hold: { name: string; t0: number } | null = null
  let tipShown = false
  cells.addEventListener('pointerdown', e => {
    const el = (e.target as HTMLElement).closest('.fd-opt') as HTMLElement | null
    if (el !== null) { hold = { name: el.dataset['n'] ?? '', t0: e.timeStamp }; tipShown = false }
  })
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave'] as const) cells.addEventListener(ev, () => { hold = null; tip.hidden = true })
  cells.addEventListener('click', e => { if (tipShown) { tipShown = false; e.stopImmediatePropagation() } }, true)
  let sig = ''
  let sayUntil = 0
  let sayText = ''
  let sayTone: Tone = 'ok'
  const img = (src: string): string => `<img src="${base}${src}" alt="" draggable="false">`
  const paintSay = (): void => {
    say.hidden = sayText === ''
    say.textContent = sayText
    say.className = sayTone
  }

  return {
    sync(m, ui, c) {
      const alive = [0, 1, 2, 3].map(g => cellWhy(m, g as InputGroup) === null ? 1 : 0)
      const key = [ui.phase, ui.sel.join(''), alive.join(''), c.front, c.aiming, c.sentGroup ? 1 : 0, c.touch ? 1 : 0, m.end === null ? 0 : 1].join('|')
      if (key === sig) return
      sig = key
      strip.hidden = ui.phase === 'end' || m.end !== null
      go.hidden = ui.phase !== 'ready'
      const shown = pickables(m, ui)
      const bigOn = ui.phase !== 'end' && m.end === null
      let html = ''
      for (const g of [0, 1, 2, 3] as const) {
        const live = shown.includes(g)
        const on = ui.sel.includes(g)
        let pop = ''
        if (g === 0 && bigOn) {
          pop = '<div class="fd-pop">' + BIG_ARTS.map((name, i) => `<button class="fd-opt${(i < 2 && c.front === i) || c.aiming === i ? ' on' : ''}" type="button" data-act="big" data-i="${i}" data-n="${name}" title="${t(`war.cmdShort.${name}` as Key)}"><i>${firstKeyLabel(CMD_ACTION[i]!)}</i>${img(`flag/flag-${name}.png`)}<span>${t(`war.cmdName.${name}` as Key)}</span></button>`).join('') + '</div>'
        }
        html += `<div class="fd-slot"><button class="fd-cell${on ? ' on' : ''}${live ? '' : ' no'}" type="button" data-act="cell" data-g="${g}" aria-pressed="${on}" aria-label="${t(`field.g.${g}`)}"><i class="fd-kb">${firstKeyLabel(CELL_ACTION[g]!)}</i>${img(CELL_ICON[g]!)}<b>${t(`field.g.${g}`)}</b><em class="fd-ck">✓</em></button>${pop}</div>`
      }
      cells.innerHTML = html
      // 한 줄 안내: 처음 무리를 보내기 전까지만 (자세 단추가 떠 있으면 그 자리를 비운다)
      const line = ui.phase === 'ready' ? t(c.touch ? 'field.hint.ready.touch' : 'field.hint.ready.pc') : !c.sentGroup ? t(c.touch ? 'field.hint.group.touch' : 'field.hint.group.pc') : ''
      const showHint = ui.phase !== 'end' && m.end === null && !bigOn && line !== ''
      hint.hidden = !showHint
      hint.innerHTML = showHint ? `<span>${line}</span>` : ''
    },
    say(text, tone, nowMs) {
      sayText = text; sayTone = tone
      sayUntil = nowMs + P.field.noteMs
      paintSay()
    },
    frame(nowMs) {
      if (hold !== null && !tipShown && nowMs - hold.t0 >= P.field.cmdHintMs) {
        tipShown = true
        tip.textContent = t(`war.cmdDoes.${hold.name}` as Key)
        tip.hidden = false
      }
      if (sayText !== '' && nowMs >= sayUntil) { sayText = ''; paintSay() }
    },
  }
}
