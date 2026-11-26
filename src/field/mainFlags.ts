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
  onLine(i: number): void
  onGo(): void
}
export type Tone = 'ok' | 'why'
/** 아래 띠가 알아야 하는 바깥 사정 — cmd: 앞줄·활·기병이 지금 고른 명령 번호(알아서면 -1) · sentGroup: 무리를 한 번이라도 보냈는가 · touch: 손으로 쓰는 화면인가 */
/** big: 앞줄이 지금 고른 명령 번호(0 돌격 · 1 방진 · 없으면 -1) · aiming: 찍는 중인 큰 수 번호(2 화살비 · 3 옆치기 · 아니면 -1) */
/** cmdG: 시험판(?mvp)이면 고른 무리 번호(0~2 · 장수나 없으면 -1) — 큰 수 줄은 그 무리의 것만 Z X 차례로 · 진 고르기·안내 줄은 숨는다 · 옛 판은 undefined */
export interface FlagsCtx { line: number; foeLine: number; front: number; volley: boolean; flank: boolean; aiming: number; sentGroup: boolean; touch: boolean; cmdG?: number }
/** 시험판(?mvp): 무리마다 제 큰 수 (BIG_ARTS 번호) — 앞줄 돌격·방진 · 활 화살비 · 기병 옆치기 */
export const MVP_CMDS: readonly (readonly number[])[] = [[0, 1], [2], [3]]
export interface FlagsView {
  sync(m: VModel, ui: UiState, c: FlagsCtx): void
  say(text: string, tone: Tone, nowMs: number): void
  frame(nowMs: number): void
}

const CELL_ICON = ['icon/unit-spear.png', 'icon/unit-archer.png', 'icon/unit-buyeo-cavalry.png', 'icon/unit-general.png']
const CELL_ACTION: readonly ActionName[] = ['pickFront', 'pickBows', 'pickHorse', 'pickHero']
/** 큰 수가 누구의 수인가: Z·X 앞줄 · C 활 · V 기병 (단추 귀퉁이 그림) */
const BIG_WHO = [0, 0, 1, 2] as const
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
.fd-cell.on{border-color:#e8f2ff;background:#16294a;box-shadow:0 0 0 1px #e8f2ff88}
.fd-cell.no{opacity:.4}
.fd-ck{position:absolute;right:3px;top:2px;font-size:13px;color:${GOLD};font-style:normal;display:none}
.fd-cell.on .fd-ck{display:none}
.fd-kb{position:absolute;left:3px;top:2px;font-size:14px;font-weight:700;line-height:1.2;min-width:16px;padding:0 4px;box-sizing:border-box;text-align:center;color:#fff;background:#0b1a2e;border:1px solid #f3ecd8;border-bottom-width:3px;border-radius:4px;font-style:normal}
@media (pointer:coarse){.fd-kb{display:none}}
#fd-big{position:absolute;left:calc(8px + env(safe-area-inset-left));bottom:calc(var(--fd-bar,64px) + 12px + env(safe-area-inset-bottom));display:flex;gap:6px;background:#000d;border:1px solid ${GOLD}88;border-radius:10px;padding:6px;z-index:3}
#fd-big[hidden],.touch #fd-big[hidden]{display:none}
#fd-lines{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(var(--fd-bar,64px) + 12px + env(safe-area-inset-bottom));display:flex;gap:8px;z-index:4}
#fd-lines[hidden]{display:none}
.touch #fd-lines{bottom:calc(14px + env(safe-area-inset-bottom))}
.fd-line{position:relative;width:92px;min-height:76px;box-sizing:border-box;font:inherit;color:#f3ecd8;background:#0b1a2ecc;border:2px solid #2f8cff88;border-radius:10px;padding:4px;display:flex;flex-direction:column;align-items:center;gap:2px;transition:transform .08s}
.fd-line:active{transform:scale(1.08)}
.fd-line svg{width:76px;height:46px;display:block}
.fd-line b{font-size:13px;line-height:1.1}
.fd-line.on{border-color:#ffd27a;background:#2a2410d9}
.fd-line.on::after{content:'✓';position:absolute;right:4px;top:1px;color:#ffd27a;font-size:14px}
#fd-foeline{position:absolute;right:calc(16px + var(--fd-miniw,0px) + env(safe-area-inset-right));top:calc(58px + env(safe-area-inset-top));display:flex;align-items:center;gap:6px;background:#000a;border:1px solid #c43e3088;border-radius:8px;padding:3px 6px;z-index:4;pointer-events:none}
#fd-foeline[hidden]{display:none}
#fd-foeline svg{width:46px;height:30px}
#fd-foeline img{width:16px;height:16px;object-fit:contain}
.touch .fd-cells{display:none}
.touch .fd-kb,.touch .fd-opt i,.touch .fd-pb em{display:none}
.touch #fd-strip{min-height:0}
.touch #fd-big{left:50%;right:auto;transform:translateX(-50%);bottom:calc(8px + env(safe-area-inset-bottom));display:grid;grid-template-columns:repeat(4,54px);gap:3px;padding:3px}
.touch .fd-opt{min-width:54px;min-height:46px;padding:2px 3px;font-size:11px;gap:0}
.touch .fd-opt img{width:22px;height:22px}
.fd-opt{font:inherit;color:#f3ecd8;background:#0b1a2ecc;border:2px solid #2f8cff88;border-radius:8px;min-width:60px;min-height:56px;padding:3px 6px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;position:relative;font-size:13px;transition:transform .08s}
.fd-opt:active{transform:scale(1.12)}
.fd-opt img{width:30px;height:30px;object-fit:contain}
.fd-opt.on{border-color:${GOLD};background:#2a2410d9}
.fd-opt.on::after{content:'✓';position:absolute;left:4px;bottom:0;color:${GOLD};font-size:13px}
.fd-bighead{display:flex;align-items:center;padding:0 4px 0 2px;border-right:1px solid #ffd27a66;margin-right:2px}
.fd-bighead img{width:34px;height:34px;object-fit:contain}
.fd-who{position:absolute;right:2px;top:2px;width:17px;height:17px;object-fit:contain;opacity:.95;pointer-events:none}
.fd-opt i{position:absolute;left:3px;top:2px;font-size:14px;font-weight:700;line-height:1.2;min-width:16px;padding:0 4px;box-sizing:border-box;text-align:center;color:#fff;background:#0b1a2e;border:1px solid #f3ecd8;border-bottom-width:3px;border-radius:4px;font-style:normal}
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

/** 진 그림 (대 넷의 병종 점과 기병 자리) — 0 방패 벽 · 1 창 쐐기 · 2 넓은 날개 */
const LINE_DOTS: readonly (readonly (readonly [number, number, number])[])[] = [
  [[10, 8, 0], [20, 8, 0], [30, 8, 0], [40, 8, 0], [50, 8, 0], [22, 22, 1], [38, 22, 1], [8, 34, 2], [52, 34, 2]],
  [[30, 6, 0], [22, 14, 0], [38, 14, 0], [14, 22, 0], [46, 22, 0], [24, 32, 1], [36, 32, 1], [6, 36, 2], [54, 36, 2]],
  [[6, 22, 0], [16, 14, 0], [44, 14, 0], [54, 22, 0], [26, 28, 1], [34, 28, 1], [4, 6, 2], [56, 6, 2]],
]
const LINE_COLORS = ['#7fb8ff', '#9fd39a', '#ffd27a'] as const
export function lineSvg(i: number, front = ''): string {
  const dots = LINE_DOTS[i] ?? LINE_DOTS[0]!
  return `<svg viewBox="0 0 60 42" aria-hidden="true">${dots.map(d => `<circle cx="${d[0]}" cy="${d[1]}" r="${d[2] === 0 ? 3.2 : 2.8}" fill="${front !== '' && d[2] === 0 ? front : LINE_COLORS[d[2]]}"/>`).join('')}</svg>`
}
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
  const big = document.createElement('div'); big.id = 'fd-big'; big.hidden = true
  const lines = document.createElement('div'); lines.id = 'fd-lines'; lines.hidden = true
  const foe = document.createElement('div'); foe.id = 'fd-foeline'; foe.hidden = true
  lines.addEventListener('click', e => { const el = (e.target as HTMLElement).closest('[data-line]') as HTMLElement | null; if (el !== null) h.onLine(Number(el.dataset['line'])) })
  root.append(hint, say, tip, big, lines, foe, strip)
  const cells = strip.querySelector('.fd-cells') as HTMLDivElement
  const go = strip.querySelector('.fd-go') as HTMLButtonElement
  go.addEventListener('click', () => h.onGo())
  const wire = (box: HTMLElement): void => box.addEventListener('click', e => {
    const el = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null
    if (el === null) return
    const act = el.dataset['act']
    if (act === 'cell') h.onCell(Number(el.dataset['g']) as InputGroup)
    else if (act === 'big') h.onBig(Number(el.dataset['i']))
  })
  wire(cells); wire(big)

  /** 명령 단추를 누르고 있는 중 (오래 누르면 뜻 한 줄 · 그때 뗀 손은 명령으로 치지 않는다) */
  let hold: { name: string; t0: number } | null = null
  let tipShown = false
  big.addEventListener('pointerdown', e => {
    const el = (e.target as HTMLElement).closest('.fd-opt') as HTMLElement | null
    if (el !== null) { hold = { name: el.dataset['n'] ?? '', t0: e.timeStamp }; tipShown = false }
  })
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave'] as const) big.addEventListener(ev, () => { hold = null; tip.hidden = true })
  big.addEventListener('click', e => { if (tipShown) { tipShown = false; e.stopImmediatePropagation() } }, true)
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
      const key = [c.line, c.foeLine, ui.phase, ui.sel.join(''), alive.join(''), c.front, c.volley ? 1 : 0, c.flank ? 1 : 0, c.aiming, c.sentGroup ? 1 : 0, c.touch ? 1 : 0, m.end === null ? 0 : 1, c.cmdG ?? 'x'].join('|')
      const mvp = c.cmdG !== undefined
      if (key === sig) return
      sig = key
      strip.hidden = ui.phase === 'end' || m.end !== null
      go.hidden = ui.phase !== 'ready'
      const shown = pickables(m, ui)
      const mine = mvp ? MVP_CMDS[c.cmdG!] : undefined
      const bigOn = mvp ? ui.phase !== 'end' && m.end === null && mine !== undefined : ui.phase === 'play' && m.end === null
      let html = ''
      for (const g of [0, 1, 2, 3] as const) {
        const live = shown.includes(g)
        const on = ui.sel.includes(g)
        html += `<div class="fd-slot"><button class="fd-cell${on ? ' on' : ''}${live ? '' : ' no'}" type="button" data-act="cell" data-g="${g}" aria-pressed="${on}" aria-label="${t(`field.g.${g}`)}"><i class="fd-kb">${firstKeyLabel(CELL_ACTION[g]!)}</i>${img(CELL_ICON[g]!)}<b>${t(`field.g.${g}`)}</b><em class="fd-ck">✓</em></button></div>`
      }
      cells.innerHTML = html
      big.hidden = !bigOn
      const opt = (name: string, i: number, key: number): string => `<button class="fd-opt${(i < 2 && c.front === i) || (i === 2 && c.volley) || (i === 3 && c.flank) || c.aiming === i ? ' on' : ''}" type="button" data-act="big" data-i="${i}" data-n="${name}" title="${t(`field.big.${name}` as Key)}"><i>${firstKeyLabel(CMD_ACTION[key]!)}</i>${img(`flag/flag-${name}.png`)}<span>${t(`war.cmdName.${name}` as Key)}</span></button>`
      // 시험판: 머리에 고른 무리 그림 하나 · 그 무리의 큰 수만 Z X 차례로
      if (mvp) big.innerHTML = !bigOn || mine === undefined ? '' : `<span class="fd-bighead">${img(CELL_ICON[c.cmdG!]!)}</span>` + mine.map((i, k) => opt(BIG_ARTS[i]!, i, k)).join('')
      else big.innerHTML = !bigOn ? '' : BIG_ARTS.map((name, i) => `<button class="fd-opt${(i < 2 && c.front === i) || (i === 2 && c.volley) || (i === 3 && c.flank) || c.aiming === i ? ' on' : ''}" type="button" data-act="big" data-i="${i}" data-n="${name}" title="${t(`field.big.${name}` as Key)}"><i>${firstKeyLabel(CMD_ACTION[i]!)}</i><img class="fd-who" src="${base}${CELL_ICON[BIG_WHO[i]!]!}" alt="">${img(`flag/flag-${name}.png`)}<span>${t(`war.cmdName.${name}` as Key)}</span></button>`).join('')
      // 한 줄 안내: 처음 무리를 보내기 전까지만 (자세 단추가 떠 있으면 그 자리를 비운다)
      const line = ui.phase === 'ready' ? t(c.touch ? 'field.hint.ready.touch' : 'field.hint.ready.pc') : !c.sentGroup ? t(c.touch ? 'field.hint.group.touch' : 'field.hint.group.pc') : ''
      const showHint = ui.phase === 'play' && m.end === null && !bigOn && line !== '' && !mvp
      // 준비 화면: 진 카드 셋(고른 것 금빛 ✓) + 적의 진 (카드를 누르면 맵의 우리 진이 그 꼴로 다시 선다) · 시험판은 진이 하나라 숨는다
      lines.hidden = ui.phase !== 'ready' || mvp; foe.hidden = ui.phase !== 'ready' || mvp
      if (ui.phase === 'ready' && !mvp) {
        lines.innerHTML = [0, 1, 2].map(i => `<button class="fd-line${c.line === i ? ' on' : ''}" type="button" data-line="${i}" title="${t(`field.line.desc.${i}` as Key)}">${lineSvg(i)}<b>${t(`field.line.${i}` as Key)}</b></button>`).join('')
        foe.innerHTML = `${lineSvg(c.foeLine, '#ff8a7a')}${img('icon/unit-spear.png')}${img('icon/unit-archer.png')}${img('icon/unit-buyeo-cavalry.png')}`
      }
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
        tip.textContent = t(`field.big.${hold.name}` as Key)
        tip.hidden = false
      }
      if (sayText !== '' && nowMs >= sayUntil) { sayText = ''; paintSay() }
    },
  }
}
