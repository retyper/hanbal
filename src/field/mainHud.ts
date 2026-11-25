/**
 * 위쪽 띠(단추 · 사기 띠 · 사람 수)와 끝 상자 — DOM (docs/realm/battle-study/42-feel-lens-f3.md 의 1 · 2 · 9 · 18)
 * 사기 띠는 글 없는 두 색 띠: 파랑은 왼쪽 · 붉은색은 오른쪽, 가득 찬 쪽이 멀쩡한 것이고 문턱(끝)에 가까울수록 줄어든다.
 * 남은 몫이 lowShare 아래면 깜박인다. 판 상태는 VModel 로만 읽는다.
 * 시간이 지나 바뀌는 것(다시 누름 대기)은 타이머를 예약하지 않고 frame(now) 이 챙긴다.
 */
import { t, type Key } from '../i18n/index.ts'
import { P } from '../tune/params.ts'
import type { VModel } from './viewRead.ts'

export interface HudHandlers { onZoom(): void; onPause(): void; onAgain(): void; onHelp(): void }
/** 이번에 판이 보인 큰 부딪힘 — gold 상성이 맞음(막대 테두리가 금빛으로 번쩍) · blocked 막힘 */
export interface HudFx { gold: boolean; blocked: boolean }
/** 끝 상자의 숫자: 쓰러뜨린 적 · 잃은 우리 병사 */
export interface EndStats { killed: number; lost: number }
export interface Hud {
  setZoom(level: number): void
  setPaused(paused: boolean): void
  hide(hidden: boolean): void
  /** 위 띠를 지금 판으로 고친다 · ready 면 사기 띠는 가득 */
  sync(m: VModel, fx?: HudFx): void
  /** 끝 상자 (null 이면 닫는다) */
  showEnd(m: VModel | null, stats?: EndStats): void
  frame(nowMs: number): void
}

const CSS = `
#fd-hud{position:absolute;left:calc(8px + env(safe-area-inset-left));right:calc(8px + env(safe-area-inset-right));top:calc(6px + env(safe-area-inset-top));display:flex;gap:10px;align-items:flex-start;font-size:14px;pointer-events:none}
#fd-hud[hidden]{display:none}
#fd-hud>*{pointer-events:auto}
#fd-hud button[hidden]{display:none}
#fd-hud button,#fd-end button{font:inherit;color:inherit;background:#0009;border:1px solid #fff4;border-radius:8px;padding:12px 14px;min-height:44px;min-width:44px;transition:transform .08s}
#fd-hud button:active,#fd-end button:active{transform:scale(.94)}
#fd-hud button.on{border-color:#ffd27a;color:#ffd27a}
#fd-hud button.arm{border-color:#ffd27a;color:#1a1305;background:#ffd27a}
#fd-edge{position:absolute;left:50%;top:calc(6px + env(safe-area-inset-top));transform:translateX(-50%);display:flex;align-items:center;gap:8px;pointer-events:none;font-size:14px;font-weight:700;text-shadow:0 1px 3px #000}
#fd-edge[hidden]{display:none}
#fd-edge .bar{position:relative;width:min(20vw,190px);height:20px;background:#0009;border:1px solid #fff4;border-radius:10px;overflow:hidden}
#fd-edge .bar b{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:13px;z-index:1}
#fd-edge .bar i{position:absolute;top:0;bottom:0;display:block}
#fd-edge .bar i.a{right:0;background:#2f8cff}
#fd-edge .bar i.b{left:0;background:#c43e30}
#fd-edge .bar.low{animation:fd-low .5s steps(1) infinite}
@keyframes fd-low{50%{opacity:.35}}
#fd-edge .chip{position:absolute;top:8px;width:9px;height:9px;pointer-events:none;animation:fd-fall .3s ease-in forwards}
#fd-edge .chip.a{background:#2f8cff}
#fd-edge .chip.b{background:#c43e30}
#fd-edge .chip.big{width:14px;height:14px}
@keyframes fd-fall{to{transform:translateY(26px) rotate(40deg);opacity:0}}
#fd-edge .bar.sh{animation:fd-sh .15s linear}
@keyframes fd-sh{25%{transform:translateX(-2px)}75%{transform:translateX(2px)}}
#fd-edge .bar.gold{box-shadow:0 0 0 2px #ffd27a}
#fd-end .st{display:flex;gap:18px;justify-content:center;margin:0 0 8px;font-size:15px;font-weight:700}
#fd-end{position:absolute;left:0;right:0;bottom:calc(14px + env(safe-area-inset-bottom));display:flex;justify-content:center;pointer-events:none}
#fd-end[hidden]{display:none}
#fd-end>div{background:#000d;border:1px solid #ffd27a88;border-radius:10px;padding:12px 26px;text-align:center;pointer-events:auto}
#fd-end h2{margin:0 0 6px;font-size:24px}
#fd-end p{margin:0 0 10px;font-size:15px}
#fd-end button{min-width:96px;min-height:48px;font-size:16px;border-color:#ffd27a;color:#ffd27a}
`

export function mountHud(root: HTMLElement, h: HudHandlers): Hud {
  const style = document.createElement('style')
  style.textContent = CSS
  document.head.append(style)
  const hud = document.createElement('div')
  hud.id = 'fd-hud'
  hud.innerHTML = `<button id="fd-zoom" type="button"></button><button id="fd-pause" type="button"></button><button id="fd-helpbtn" type="button" aria-label="?">?</button><span style="flex:1"></span><button id="fd-again" type="button"></button>`
  const edge = document.createElement('div')
  edge.id = 'fd-edge'
  edge.innerHTML = `<span class="bar" id="fd-b0"><i class="a"></i><b id="fd-n0"></b></span><span class="bar" id="fd-b1"><i class="b"></i><b id="fd-n1"></b></span>`
  const end = document.createElement('div')
  end.id = 'fd-end'; end.hidden = true
  end.innerHTML = `<div><h2 id="fd-endtext"></h2><div class="st" id="fd-endstats"></div><p id="fd-why"></p><button id="fd-again2" type="button"></button></div>`
  root.append(edge, hud, end)
  const $ = (id: string): HTMLElement => document.getElementById(id) as HTMLElement
  const zoom = $('fd-zoom'), pause = $('fd-pause'), again = $('fd-again'), again2 = $('fd-again2')
  const n0 = $('fd-n0'), n1 = $('fd-n1'), b0 = $('fd-b0'), b1 = $('fd-b1')
  const fa = b0.firstElementChild as HTMLElement, fb = b1.firstElementChild as HTMLElement
  const endText = $('fd-endtext'), endWhy = $('fd-why'), endStats = $('fd-endstats')
  zoom.hidden = true // 시제품: 확대 단추는 뺀다 (51 §2) · 장수 따라가기 한 가지 배율
  again.textContent = again2.textContent = t('field.again')
  pause.textContent = t('field.pause')
  let armUntil = 0
  let goldUntil = 0
  const prevEdge = [-1, -1]
  const edgeBox = edge
  const chip = (bar: HTMLElement, share: number, side: 0 | 1, big: boolean): void => {
    const r = bar.getBoundingClientRect(), o = edgeBox.getBoundingClientRect()
    const x = r.left - o.left + r.width * (side === 0 ? 1 - share / 1000 : share / 1000)
    const c = document.createElement('i')
    c.className = `chip ${side === 0 ? 'a' : 'b'}${big ? ' big' : ''}`
    c.style.left = `${Math.round(x - 4)}px`
    edgeBox.append(c)
    c.addEventListener('animationend', () => c.remove())
    bar.classList.remove('sh'); void bar.offsetWidth; bar.classList.add('sh')
  }
  let key = ''
  zoom.addEventListener('click', () => h.onZoom())
  pause.addEventListener('pointerdown', e => { e.preventDefault(); h.onPause() })
  $('fd-helpbtn').addEventListener('click', () => h.onHelp())
  again.addEventListener('click', () => {
    if (armUntil > 0) { armUntil = 0; again.className = ''; again.textContent = t('field.again'); h.onAgain(); return }
    armUntil = performance.now() + P.field.noteMs
    again.className = 'arm'; again.textContent = t('field.again.sure')
  })
  again2.addEventListener('click', () => h.onAgain())
  const men = (m: VModel, side: number): number => m.squads.reduce((a, q) => a + (q.side === side ? q.men : 0), 0)

  return {
    setZoom(level) { zoom.textContent = t(`field.zoom.${level}` as Key); zoom.classList.toggle('on', level > 0) },
    setPaused(p) { pause.textContent = t(p ? 'field.resume' : 'field.pause'); pause.classList.toggle('on', p) },
    hide(hidden) { hud.hidden = hidden; edge.hidden = hidden },
    sync(m, fx) {
      // 막대가 크게 줄면 그 끝에서 조각이 떨어진다 (상성이 맞으면 막대 테두리가 금빛으로 번쩍)
      for (const sd of [0, 1] as const) {
        const was = prevEdge[sd]!
        if (was >= 0 && m.edge[sd] < was - P.field.chipDropPermille) chip(sd === 0 ? b0 : b1, m.edge[sd], sd, was - m.edge[sd] >= P.field.chipDropPermille * 3)
        prevEdge[sd] = m.edge[sd]
      }
      if (fx !== undefined && fx.gold) { goldUntil = performance.now() + P.field.goldFlashMs; b0.classList.add('gold'); b1.classList.add('gold') }
      const k = `${m.edge[0]}|${m.edge[1]}|${men(m, 0)}|${men(m, 1)}`
      if (k === key) return
      key = k
      n0.textContent = men(m, 0).toLocaleString()
      n1.textContent = men(m, 1).toLocaleString()
      fa.style.left = `${100 - m.edge[0] / 10}%`
      fb.style.right = `${100 - m.edge[1] / 10}%`
      b0.classList.toggle('low', m.edge[0] < P.field.edgeLowPermille)
      b1.classList.toggle('low', m.edge[1] < P.field.edgeLowPermille)
    },
    showEnd(m, stats) {
      if (m === null || m.end === null) { end.hidden = true; return }
      end.hidden = false
      endStats.innerHTML = stats === undefined ? '' : `<span>${t('field.res.killed', { n: stats.killed.toLocaleString() })}</span><span>${t('field.res.lost', { n: stats.lost.toLocaleString() })}</span>`
      endText.textContent = t(m.winner === 0 ? 'field.end.win' : m.winner === 1 ? 'field.end.lose' : 'field.end.draw')
      endWhy.textContent = t(`field.endwhy.${m.end}` as Key)
    },
    frame(nowMs) {
      if (goldUntil > 0 && performance.now() >= goldUntil) { goldUntil = 0; b0.classList.remove('gold'); b1.classList.remove('gold') }
      if (armUntil > 0 && nowMs >= armUntil) { armUntil = 0; again.className = ''; again.textContent = t('field.again') }
    },
  }
}
