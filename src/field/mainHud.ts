/**
 * 위쪽 띠(단추 · 사기 막대 둘)와 끝 상자 — DOM (docs/realm/battle-study/42-feel-lens-f3.md 의 1 · 2 · 9 · 18 · 화면 2차)
 * 사기 막대는 편마다 하나: 우리(파랑)는 왼쪽 끝에서 · 적(붉음)은 오른쪽 끝에서 각자 줄어든다.
 * 막대 길이 = (편 사기 − 무너짐 문턱) ÷ (1 − 문턱) — 막대가 다 비면 그 편이 무너진다(진다). 막대 바깥 끝에 편 사기 %를 작게 적는다.
 * 문턱 위 standAbovePermille 안으로 들어오면 우리 막대는 붉게 뛰고 · 적 막대는 희게 번쩍이며 떤다(북은 소리 쪽).
 * 깎인 몫은 밝은 잔상으로 hudGhostMs 남았다가 줄고 · 한 번에 chunkPermille 넘게 깎이면 그 몫이 덩어리째 떨어진다.
 * 판 상태는 VModel 로만 읽는다. 시간이 지나 바뀌는 것(잔상 · 다시 누름 대기)은 타이머를 예약하지 않고 frame(now) 이 챙긴다.
 */
import { t, type Key } from '../i18n/index.ts'
import { P } from '../tune/params.ts'
import type { VModel } from './viewRead.ts'

export interface HudHandlers { onZoom(): void; onPause(): void; onAgain(): void; onHelp(): void }
/** 이번에 판이 보인 큰 부딪힘 — gold 상성이 맞음(막대 테두리가 금빛으로 번쩍) · blocked 막힘 · breakSide 무너진 편(-1 없음) */
export interface HudFx { gold: boolean; blocked: boolean; breakSide: number }
/** 사기를 깎는 까닭 여섯 (stats.moraleBy 의 열쇠) 과 그 그림 */
const CAUSES = ['arrows', 'melee', 'flank', 'hero', 'domino', 'push'] as const
type Cause = typeof CAUSES[number]
const CAUSE_ICON: Readonly<Record<Cause, string>> = { arrows: 'icon/unit-archer.png', melee: 'icon/unit-spear.png', flank: 'icon/unit-buyeo-cavalry.png', hero: 'icon/unit-general.png', domino: 'flag/flag-retreat.png', push: 'flag/flag-hold.png' }
/** 그 편이 입은 몫이 가장 큰 까닭 (모두 0 이면 null) */
export function topCause(by: Readonly<Record<Cause, number>>): Cause | null {
  let best: Cause | null = null, bv = 0
  for (const c of CAUSES) if (by[c] > bv) { bv = by[c]; best = c }
  return best
}
/** 편 사기(천분율) → 막대 길이(천분율) — 무너짐 문턱이 0 · 처음 사기가 1000 */
export function barOf(morale: number): number {
  const thr = P.realm.tacBreakMorale
  return Math.round(Math.max(0, Math.min(1, (morale / 1000 - thr) / (1 - thr))) * 1000)
}
/**
 * 칼 든 대(앞줄·기병)가 다 달아난 편이 무너지기까지 남은 초 — 다 달아난 지 bladeShowSec 이 안 됐거나 · 엔진 규칙이 꺼졌거나 · 이미 무너졌으면 -1.
 * 엔진(judge)과 같은 셈: 지금 틱 − bladeTick 이 breakNoBladesSec 에 닿으면 그 편이 무너진다
 */
export function bladeLeftOf(m: VModel, side: 0 | 1): number {
  const F = P.field, gap = m.tick - m.bladeTick[side]
  if (F.breakNoBladesSec <= 0 || m.end !== null || m.breakTick[side] >= 0 || gap < F.bladeShowSec * F.hz) return -1
  return Math.max(0, Math.ceil((F.breakNoBladesSec * F.hz - gap) / F.hz))
}
/** 끝 상자의 숫자: 쓰러뜨린 적 · 잃은 우리 병사 · 먹힌 옆치기 · 비기로 깎은 사기 · 버팀 · 다시 선 대 · 투지 발동 (모두 지난 일) */
export interface EndStats { killed: number; lost: number; flank: number; art: number; stand?: number; regroup?: number; grit?: number }
/** by = 까닭별 몫 · won = 이겼나 · morale = 판이 갈린 순간(먼저 무너진 틱)의 편 사기 둘(천분율) */
export interface EndWhy { by: Readonly<Record<Cause, number>>; won: boolean; morale: readonly [number, number] }
export interface Hud {
  setZoom(level: number): void
  setPaused(paused: boolean): void
  hide(hidden: boolean): void
  /** 위 띠를 지금 판으로 고친다 */
  sync(m: VModel, fx?: HudFx): void
  /** 다시 선 대의 「+N」: 화면 자리(x, y)에서 떠올랐다가 그 편 막대로 날아가 붙는다 */
  fly(x: number, y: number, n: number, side: 0 | 1): void
  /** 끝 상자 (null 이면 닫는다) */
  showEnd(m: VModel | null, stats?: EndStats, why?: EndWhy): void
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
#fd-edge{position:absolute;left:50%;top:calc(8px + env(safe-area-inset-top));transform:translateX(-50%);display:flex;align-items:center;gap:6px;pointer-events:none;font-size:13px;font-weight:700;text-shadow:0 1px 3px #000;z-index:5}
#fd-edge[hidden]{display:none}
#fd-edge>b{min-width:34px;font-size:13px;color:#f3ecd8}
#fd-edge>b.fd-p0{text-align:right}
#fd-edge .fd-vs{width:10px}
#fd-edge .fd-side{position:relative;width:min(19vw,180px);height:16px;background:#1a1f2b;border:1px solid #fff4;border-radius:8px;overflow:hidden}
#fd-edge .fd-side i{position:absolute;top:0;bottom:0;display:block}
#fd-edge .fd-s0 i{left:0}
#fd-edge .fd-s1 i{right:0}
#fd-edge .fd-side i.gh{background:#fff;opacity:.75;transition:width .35s ease-in}
#fd-edge .fd-s0 i.fill{background:#2f8cff}
#fd-edge .fd-s1 i.fill{background:#c43e30}
#fd-edge .fd-bl{position:absolute;left:50%;top:0;bottom:0;transform:translateX(-50%);display:flex;align-items:center;gap:3px;padding:0 6px;background:#000c;border-radius:8px;font-size:13px;font-weight:800;line-height:1;color:#fff;z-index:1}
#fd-edge .fd-s0 .fd-bl{color:#ff8a7a}
#fd-edge .fd-bl[hidden]{display:none}
#fd-edge .fd-bl svg{width:13px;height:13px;filter:drop-shadow(0 0 1px #000)}
#fd-edge .fd-side.blade{animation:fd-danger .5s ease-in-out infinite;border-color:#ff5a4a}
#fd-edge .fd-side.danger{animation:fd-danger .6s ease-in-out infinite;border-color:#ff5a4a}
@keyframes fd-danger{50%{box-shadow:0 0 0 3px #ff3b2b,0 0 10px #ff3b2b}}
#fd-edge .fd-side.near{animation:fd-near .42s linear}
@keyframes fd-near{0%{background:#fff}20%{transform:translateX(-2px)}40%{transform:translateX(2px)}60%{transform:translateX(-2px)}80%{transform:translateX(2px)}}
#fd-edge .fd-side.sh{animation:fd-sh .15s linear}
@keyframes fd-sh{25%{transform:translateX(-2px)}75%{transform:translateX(2px)}}
#fd-edge .fd-side.sh2{animation:fd-sh2 .32s linear}
@keyframes fd-sh2{20%{transform:translateX(-6px)}40%{transform:translateX(5px)}60%{transform:translateX(-4px)}80%{transform:translateX(2px)}}
#fd-edge .fd-side.gold{box-shadow:0 0 0 2px #ffd27a}
#fd-edge .fd-side.up{box-shadow:0 0 0 2px #a8dcff}
#fd-edge .chip{position:absolute;top:8px;width:9px;height:9px;pointer-events:none;animation:fd-fall .3s ease-in forwards}
#fd-edge .chip.a{background:#2f8cff}
#fd-edge .chip.b{background:#c43e30}
#fd-edge .chip.big{width:14px;height:14px}
#fd-edge .chip.pic{width:auto;height:auto;background:none}
#fd-edge .chip.pic img{width:18px;height:18px;object-fit:contain;display:block}
@keyframes fd-fall{to{transform:translateY(26px) rotate(40deg);opacity:0}}
#fd-edge .chunk{position:absolute;height:16px;pointer-events:none;border-radius:2px;transform-origin:50% 0;animation:fd-chunk .8s cubic-bezier(.5,0,1,1) forwards}
#fd-edge .chunk.a{background:#2f8cff}
#fd-edge .chunk.b{background:#c43e30}
@keyframes fd-chunk{to{transform:translateY(52px) rotate(var(--r,16deg));opacity:0}}
.fd-fly{position:absolute;left:0;top:0;z-index:6;pointer-events:none;font-size:20px;font-weight:800;color:#a8dcff;text-shadow:0 0 3px #000,0 1px 3px #000;transition:transform .45s cubic-bezier(.5,0,.8,1),opacity .45s}
.fd-fly.b{color:#ffb3a8}
#fd-end{position:absolute;left:0;right:0;bottom:calc(14px + env(safe-area-inset-bottom));display:flex;justify-content:center;pointer-events:none}
#fd-end[hidden]{display:none}
#fd-end>div{background:#000d;border:1px solid #fff3;border-radius:10px;padding:10px 22px;text-align:center;pointer-events:auto;max-width:calc(100vw - 24px);box-sizing:border-box}
#fd-end h2{margin:0 0 4px;font-size:24px}
#fd-end .l1{margin:0 0 2px;font-size:16px;font-weight:700;color:#fff}
#fd-end .l2{margin:0 0 8px;font-size:15px;color:#f3ecd8cc}
#fd-end .st{display:flex;flex-wrap:wrap;gap:4px 16px;justify-content:center;margin:0 0 6px;font-size:14px;color:#f3ecd8cc}
#fd-end .cz{margin:0 0 10px;font-size:13px;color:#f3ecd899}
#fd-end button{min-width:180px;min-height:56px;font-size:20px;font-weight:700;border-color:#ffd27a;color:#1a1305;background:#ffd27a}
`

/** 작은 칼 (곧은 날 · 코등이 · 자루) — 칼 든 대가 없다는 표시 */
const SWORD = '<svg viewBox="0 0 16 16"><path d="M8 1 L9.2 3 V10 H6.8 V3 Z" fill="#f3ecd8" stroke="#1a1208" stroke-width=".8"/><rect x="4.5" y="10" width="7" height="1.6" fill="#c9a24a" stroke="#1a1208" stroke-width=".6"/><rect x="7.2" y="11.6" width="1.6" height="3.2" fill="#6b4a2a" stroke="#1a1208" stroke-width=".5"/></svg>'

export function mountHud(root: HTMLElement, h: HudHandlers, base = ''): Hud {
  const style = document.createElement('style')
  style.textContent = CSS
  document.head.append(style)
  const hud = document.createElement('div')
  hud.id = 'fd-hud'
  hud.innerHTML = `<button id="fd-zoom" type="button"></button><button id="fd-pause" type="button"></button><button id="fd-helpbtn" type="button" aria-label="?">?</button><span style="flex:1"></span><button id="fd-again" type="button"></button>`
  const edge = document.createElement('div')
  edge.id = 'fd-edge'
  // 막대 둘: 우리는 왼쪽 끝에서 · 적은 오른쪽 끝에서 줄어든다 (잔상 gh 가 채움 fill 뒤에 있다) · 바깥 끝에 편 사기 %
  edge.innerHTML = `<b class="fd-p0"></b><span class="fd-side fd-s0"><i class="gh"></i><i class="fill"></i><b class="fd-bl" hidden>${SWORD}<span></span></b></span><span class="fd-vs"></span><span class="fd-side fd-s1"><i class="gh"></i><i class="fill"></i><b class="fd-bl" hidden>${SWORD}<span></span></b></span><b class="fd-p1"></b>`
  const end = document.createElement('div')
  end.id = 'fd-end'; end.hidden = true
  end.innerHTML = `<div><h2 id="fd-endtext"></h2><p class="l1" id="fd-l1"></p><p class="l2" id="fd-l2"></p><div class="st" id="fd-endstats"></div><p class="cz" id="fd-why"></p><button id="fd-again2" type="button"></button></div>`
  root.append(edge, hud, end)
  const $ = (id: string): HTMLElement => document.getElementById(id) as HTMLElement
  const q = (sel: string): HTMLElement => edge.querySelector(sel) as HTMLElement
  const zoom = $('fd-zoom'), pause = $('fd-pause'), again = $('fd-again'), again2 = $('fd-again2')
  const bars = [q('.fd-s0'), q('.fd-s1')] as const
  const fills = [q('.fd-s0 .fill'), q('.fd-s1 .fill')] as const
  const ghosts = [q('.fd-s0 .gh'), q('.fd-s1 .gh')] as const
  const pcts = [q('.fd-p0'), q('.fd-p1')] as const
  /** 칼 그림 (칼 든 대가 다 달아난 편 막대 위 · 무너지기까지 남은 초) · 직전 남은 초(-1 안 뜸) */
  const blades = [q('.fd-s0 .fd-bl'), q('.fd-s1 .fd-bl')] as const
  const bladeLeft = [-1, -1]
  const endText = $('fd-endtext'), endL1 = $('fd-l1'), endL2 = $('fd-l2'), endWhy = $('fd-why'), endStats = $('fd-endstats')
  zoom.hidden = true // 시제품: 확대 단추는 뺀다 (51 §2) · 장수 따라가기 한 가지 배율
  again.textContent = again2.textContent = t('field.again')
  pause.textContent = t('field.pause')
  let armUntil = 0
  let goldUntil = 0
  let breakSeen = -1
  /** 편마다 직전 편 사기 · 잔상 길이 · 잔상이 줄기 시작할 때(0 = 안 기다림) · 문턱 곁에 있었나 */
  const prevMor = [-1, -1], ghostLen = [1000, 1000], ghostAt = [0, 0], wasNear = [false, false]
  /** 날아든 「+N」 이 닿아 막대가 옅은 파랑으로 빛나는 끝 시각 */
  const upUntil = [0, 0]
  const prevBy: Record<Cause, number>[] = [{ arrows: 0, melee: 0, flank: 0, hero: 0, domino: 0, push: 0 }, { arrows: 0, melee: 0, flank: 0, hero: 0, domino: 0, push: 0 }]
  /** 그 편에 이번에 가장 크게 더해진 까닭 (조각에 같이 떨어뜨린다) */
  const newCause = (m: VModel, side: 0 | 1): Cause | null => {
    const now = m.stats.moraleBy[side], was = prevBy[side]!
    let best: Cause | null = null, bv = 0
    for (const c of CAUSES) { const d = now[c] - was[c]; if (d > bv) { bv = d; best = c } }
    for (const c of CAUSES) was[c] = now[c]
    return best
  }
  /** 막대 안의 자리(천분율 · 그 편 막대가 차오르는 쪽 끝에서) → edge 안의 x */
  const xOf = (side: 0 | 1, len: number): number => {
    const r = bars[side].getBoundingClientRect(), o = edge.getBoundingClientRect()
    return r.left - o.left + (side === 0 ? r.width * len / 1000 : r.width * (1 - len / 1000))
  }
  const restart = (el: HTMLElement, cls: string): void => { el.classList.remove('sh', 'sh2', 'near'); void el.offsetWidth; el.classList.add(cls) }
  const chip = (side: 0 | 1, len: number, big: boolean, cause: Cause | null = null, delay = 0): void => {
    const c = document.createElement('i')
    c.className = `chip ${side === 0 ? 'a' : 'b'}${big ? ' big' : ''}${cause !== null ? ' pic' : ''}`
    if (cause !== null) c.innerHTML = `<img src="${base}${CAUSE_ICON[cause]}" alt="">`
    if (delay > 0) c.style.animationDelay = `${delay}ms`
    c.style.left = `${Math.round(xOf(side, len) - 4)}px`
    edge.append(c)
    c.addEventListener('animationend', () => c.remove())
    restart(bars[side], 'sh')
  }
  /** 한 번에 크게 깎이면 그 편 막대에서 깎인 몫(from → to)이 덩어리째 떨어진다 */
  const chunk = (side: 0 | 1, from: number, to: number): void => {
    const r = bars[side].getBoundingClientRect(), o = edge.getBoundingClientRect()
    const x0 = xOf(side, side === 0 ? to : from), w = Math.abs(from - to) * r.width / 1000
    const c = document.createElement('i')
    c.className = `chunk ${side === 0 ? 'a' : 'b'}`
    c.style.left = `${Math.round(x0)}px`
    c.style.top = `${Math.round(r.top - o.top)}px`
    c.style.width = `${Math.max(4, Math.round(w))}px`
    c.style.setProperty('--r', `${side === 0 ? -16 : 16}deg`)
    edge.append(c)
    c.addEventListener('animationend', () => c.remove())
    restart(bars[side], 'sh2')
  }
  zoom.addEventListener('click', () => h.onZoom())
  pause.addEventListener('pointerdown', e => { e.preventDefault(); h.onPause() })
  $('fd-helpbtn').addEventListener('click', () => h.onHelp())
  again.addEventListener('click', () => {
    h.onAgain() // 확인 상자 없이 곧바로 새 판
  })
  again2.addEventListener('click', () => h.onAgain())
  let key = ''

  return {
    setZoom(level) { zoom.textContent = t(`field.zoom.${level}` as Key); zoom.classList.toggle('on', level > 0) },
    setPaused(p) { pause.textContent = t(p ? 'field.resume' : 'field.pause'); pause.classList.toggle('on', p) },
    hide(hidden) { hud.hidden = hidden; edge.hidden = hidden },
    sync(m, fx) {
      const thr = P.realm.tacBreakMorale * 1000
      for (const side of [0, 1] as const) {
        const mor = m.morale[side], len = barOf(mor), was = prevMor[side]!
        if (was >= 0) {
          const drop = was - mor
          // 한 번에 크게 깎이면 깎인 몫이 덩어리째 · 조금 깎이면 그 까닭 그림 조각 하나
          if (drop >= P.field.chunkPermille) chunk(side, barOf(was), len)
          if (drop > P.field.chipDropPermille) chip(side, len, drop >= P.field.chipDropPermille * 3, newCause(m, side))
        }
        prevMor[side] = mor
        if (len >= ghostLen[side]!) { ghostLen[side] = len; ghostAt[side] = 0 } else if (ghostAt[side] === 0) ghostAt[side] = performance.now()
        // 문턱 위 standAbovePermille 안: 우리 막대는 붉게 뛰고 · 적 막대는 들어오는 순간 희게 번쩍이며 떤다 (기회)
        const near = mor >= thr && mor < thr + P.field.standAbovePermille
        if (side === 0) bars[0].classList.toggle('danger', near)
        else if (near && !wasNear[1]) restart(bars[1], 'near')
        wasNear[side] = near
      }
      // 칼 든 대가 다 달아났다: 막대 위에 칼 그림과 남은 초 · 우리 편은 붉게 뛰고 · 적 편은 뜨는 순간과 bladeDrumSec 아래로 올 때 희게 번쩍 (다시 서면 걷힌다)
      for (const side of [0, 1] as const) {
        const left = bladeLeftOf(m, side), was = bladeLeft[side]!
        if (left === was) continue
        bladeLeft[side] = left
        blades[side].hidden = left < 0
        ;(blades[side].lastElementChild as HTMLElement).textContent = left < 0 ? '' : String(left)
        if (side === 0) bars[0].classList.toggle('blade', left >= 0)
        else if (left >= 0 && (was < 0 || (left < P.field.bladeDrumSec && was >= P.field.bladeDrumSec))) restart(bars[1], 'near')
      }
      // 편이 무너지면 그 편 막대에 조각 여럿이 차례로 떨어진다
      if (fx !== undefined && fx.breakSide >= 0 && breakSeen !== fx.breakSide) {
        breakSeen = fx.breakSide
        for (let i = 0; i < 8; i++) chip(fx.breakSide as 0 | 1, 980 - i * 120, true, null, i * 60)
      }
      if (fx !== undefined && fx.gold) { goldUntil = performance.now() + P.field.goldFlashMs; bars[0].classList.add('gold'); bars[1].classList.add('gold') }
      const k = `${m.morale[0]}|${m.morale[1]}|${ghostLen[0]}|${ghostLen[1]}`
      if (k === key) return
      key = k
      for (const side of [0, 1] as const) {
        pcts[side].textContent = `${Math.floor(m.morale[side] / 10)}%` // 내림: 문턱(55%) 바로 아래가 55% 로 읽히지 않게
        fills[side].style.width = `${barOf(m.morale[side]) / 10}%`
        ghosts[side].style.width = `${ghostLen[side]! / 10}%`
      }
    },
    fly(x, y, n, side) {
      const el = document.createElement('b')
      el.className = `fd-fly${side === 1 ? ' b' : ''}`
      el.textContent = `+${n}`
      el.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px)`
      root.append(el)
      const r = root.getBoundingClientRect(), b = bars[side].getBoundingClientRect()
      const len = barOf(Math.max(0, prevMor[side]!))
      const tx = b.left - r.left + (side === 0 ? b.width * len / 1000 : b.width * (1 - len / 1000)), ty = b.top - r.top - 4
      // 그 대 위에서 잠깐 떠 있다가 막대로 날아간다 · 닿으면 막대가 옅은 파랑으로 한 번 빛난다
      setTimeout(() => { el.style.transform = `translate(${Math.round(tx - 10)}px,${Math.round(ty)}px) scale(.7)`; el.style.opacity = '.4' }, P.field.flyHoldMs)
      el.addEventListener('transitionend', () => { if (el.isConnected) { el.remove(); restart(bars[side], 'sh'); bars[side].classList.add('up'); upUntil[side] = performance.now() + P.field.goldFlashMs } })
    },
    showEnd(m, stats, why) {
      if (m === null || m.end === null) { end.hidden = true; return }
      end.hidden = false
      endText.textContent = t(m.winner === 0 ? 'field.end.win' : m.winner === 1 ? 'field.end.lose' : 'field.end.draw')
      // 1줄: 어떻게 갈렸나 · 두 편 사기 · 2줄: 아깝다(진 판: 적 무너짐까지) · 남은 몫(이긴 판: 우리 무너짐까지)
      const mor = why?.morale ?? m.morale
      const thr = P.realm.tacBreakMorale * 1000
      // 사기로 끝났는데 진 편 사기가 문턱 위였으면 칼 든 대가 다 달아나서 무너진 판이다 (엔진 breakNoBladesSec · sideBreak n 2)
      const loser = m.winner === 0 ? 1 : 0
      const kind = m.end === 'morale' && m.winner >= 0 && mor[loser] >= thr ? 'blades' : m.end
      const how = kind === 'morale' || kind === 'men' || kind === 'blades' ? `field.res.head.${m.winner === 0 ? 'win' : 'lose'}.${kind}` : 'field.endwhy.time'
      endL1.textContent = `${t(how as Key)} · ${t('field.res.pair', { a: Math.floor(mor[0] / 10), b: Math.floor(mor[1] / 10) })}`
      // 1%p 아래는 소수 한 자리 (「0%p 남음」 처럼 읽히지 않게)
      const g = Math.max(0, mor[m.winner === 0 ? 0 : 1] - thr), gap = g < 10 ? (g / 10).toFixed(1) : String(Math.round(g / 10))
      endL2.textContent = m.winner < 0 ? '' : t(m.winner === 0 ? 'field.res.gap.win' : 'field.res.gap.lose', { n: gap })
      const sp = (k: Key, n: number): string => `<span>${t(k, { n: n.toLocaleString() })}</span>`
      endStats.innerHTML = stats === undefined ? '' : sp('field.res.killed', stats.killed) + sp('field.res.lost', stats.lost)
        + (stats.flank > 0 ? sp('field.res.flank', stats.flank) : '') + (stats.art > 0 ? sp('field.res.art', stats.art) : '')
        + ((stats.stand ?? 0) > 0 ? sp('field.res.stand', stats.stand ?? 0) : '') + ((stats.regroup ?? 0) > 0 ? sp('field.res.regroup', stats.regroup ?? 0) : '')
        + ((stats.grit ?? 0) > 0 ? sp('field.res.grit', stats.grit ?? 0) : '')
      const top = why === undefined ? null : topCause(why.by)
      endWhy.textContent = top === null || why === undefined ? '' : t(`field.cause.${why.won ? 'win' : 'lose'}.${top}` as Key)
    },
    frame(nowMs) {
      const now = performance.now()
      if (goldUntil > 0 && now >= goldUntil) { goldUntil = 0; bars[0].classList.remove('gold'); bars[1].classList.remove('gold') }
      for (const side of [0, 1] as const) {
        if (upUntil[side]! > 0 && now >= upUntil[side]!) { upUntil[side] = 0; bars[side].classList.remove('up') }
        // 잔상: 깎인 뒤 hudGhostMs 동안 그 자리에 남았다가 지금 길이로 줄어든다
        if (ghostAt[side]! > 0 && now - ghostAt[side]! >= P.field.hudGhostMs) { ghostAt[side] = 0; ghostLen[side] = barOf(prevMor[side]!); ghosts[side].style.width = `${ghostLen[side]! / 10}%` }
      }
      if (armUntil > 0 && nowMs >= armUntil) { armUntil = 0; again.className = ''; again.textContent = t('field.again') }
    },
  }
}
