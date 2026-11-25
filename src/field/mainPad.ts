/**
 * 장수 조작판 (50-control-v2.md · 51 §2) — DOM. 왼쪽 아래 가상 스틱(폰) · 오른쪽 아래 내닫기·비기 단추(쿨 고리 · 키 글자).
 * 스틱의 크기·죽은 구간은 열전의 값(HAEBI_STICK)을 읽기만 한다 (열전 화면 파일은 부팅 스크립트라 import 못 한다).
 * 스틱 각 → 16방위 번호는 input.ts 의 stickDir (정수 비교) · 이 파일은 손가락 자리만 잰다.
 */
import { HAEBI_STICK } from '../tune/params.ts'
import { stickDir } from './input.ts'

export interface PadHandlers { onDir(dir: number): void; onDash(): void; onSkill(): void; onRally(): void }
/** 단추 한 칸의 지금 모양: frac = 쿨이 남은 몫 0~1 · sec = 남은 초 · label = 이름 · key = 키 글자 · icon = 그림 경로 (없으면 글자만) */
export interface PadBtn { lit?: boolean; grit?: number; frac: number; sec: number; label: string; key: string; icon: string }
export interface Pad { sync(show: boolean, touch: boolean, shake: boolean, dash: PadBtn, skill: PadBtn, rally: PadBtn, readyStick: boolean): void }

const GOLD = '#ffd27a'
const R = 15.9155
const CSS = `
#fd-stick{position:absolute;left:calc(34px + env(safe-area-inset-left));bottom:calc(34px + env(safe-area-inset-bottom));width:${HAEBI_STICK.radius * 2}px;height:${HAEBI_STICK.radius * 2}px;border-radius:50%;background:#0b1a2e66;border:2px solid #f3ecd855;touch-action:none;z-index:6;display:none}
#fd-stick.on{display:block}
#fd-stick i{position:absolute;left:50%;top:50%;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;background:#f3ecd8aa;border:2px solid #fff;pointer-events:none}
#fd-stick.shake{animation:fd-shake .5s 2}
@keyframes fd-shake{25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
#fd-pad{position:absolute;right:calc(10px + env(safe-area-inset-right));bottom:calc(var(--fd-bar,64px) + 14px + env(safe-area-inset-bottom));display:flex;gap:10px;z-index:6}
#fd-pad[hidden]{display:none}
.touch #fd-pad{bottom:calc(14px + env(safe-area-inset-bottom))}
.fd-arw{position:absolute;left:0;top:0;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:2px solid #4aa3ff;background:#0b1a2ee6;padding:0;z-index:6;display:flex;align-items:center;justify-content:center}
.fd-arw[hidden]{display:none}
.fd-arw img{width:26px;height:26px;object-fit:contain;pointer-events:none}
.fd-arw s{position:absolute;left:50%;top:50%;width:0;height:0;border:6px solid transparent;border-left:10px solid #4aa3ff;margin:-6px 0 0 -5px;pointer-events:none;text-decoration:none}
.fd-pb{position:relative;width:64px;height:64px;border-radius:50%;box-sizing:border-box;font:inherit;color:#f3ecd8;background:#0b1a2ee6;border:2px solid ${GOLD};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;padding:0;transition:transform .08s}
.fd-pb:active{transform:scale(1.12)}
.fd-pb img{width:26px;height:26px;object-fit:contain;pointer-events:none}
.fd-pb b{font-size:11px;line-height:1;pointer-events:none}
.fd-pb em{position:absolute;left:0;right:0;top:-15px;text-align:center;font-style:normal;font-size:11px;color:#f3ecd8aa;pointer-events:none}
@media (pointer:coarse){.fd-pb em{display:none}}
.fd-pb.lit{border-color:#fff;box-shadow:0 0 0 3px ${GOLD},0 0 12px ${GOLD}}
.fd-pb.cool{opacity:.55;border-color:#f3ecd855}
.fd-pb svg{position:absolute;inset:-2px;width:calc(100% + 4px);height:calc(100% + 4px);transform:rotate(-90deg);pointer-events:none}
.fd-pb s{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;text-decoration:none;color:#fff;text-shadow:0 1px 3px #000;pointer-events:none}
`

export function mountPad(root: HTMLElement, base: string, h: PadHandlers): Pad {
  const style = document.createElement('style')
  style.textContent = CSS
  document.head.append(style)
  const stick = document.createElement('div'); stick.id = 'fd-stick'
  stick.innerHTML = '<i></i>'
  const knob = stick.firstElementChild as HTMLElement
  const pad = document.createElement('div'); pad.id = 'fd-pad'; pad.hidden = true
  pad.innerHTML = ['dash', 'skill', 'rally'].map(k => `<button class="fd-pb" type="button" data-k="${k}"></button>`).join('')
  root.append(stick, pad)
  let cur = -1, id = -1
  const move = (e: PointerEvent): void => {
    const r = stick.getBoundingClientRect()
    let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2)
    const len2 = dx * dx + dy * dy, max = HAEBI_STICK.radius
    if (len2 > max * max) { const k = max / Math.sqrt(len2); dx *= k; dy *= k }
    knob.style.transform = `translate(${Math.round(dx)}px,${Math.round(dy)}px)`
    const d = stickDir(dx, dy, HAEBI_STICK.dead)
    if (d !== cur) { cur = d; h.onDir(d) }
  }
  const end = (e: PointerEvent): void => {
    if (e.pointerId !== id) return
    id = -1; knob.style.transform = ''
    if (cur !== -1) { cur = -1; h.onDir(-1) }
  }
  stick.addEventListener('pointerdown', e => { e.preventDefault(); id = e.pointerId; try { stick.setPointerCapture(e.pointerId) } catch { /* 합성 입력 */ } move(e) })
  stick.addEventListener('pointermove', e => { if (e.pointerId === id) move(e) })
  stick.addEventListener('pointerup', end)
  stick.addEventListener('pointercancel', end)
  pad.addEventListener('pointerdown', e => {
    const el = (e.target as HTMLElement).closest('[data-k]') as HTMLElement | null
    if (el === null) return
    e.preventDefault(); e.stopPropagation()
    const k = el.dataset['k']
    if (k === 'dash') h.onDash(); else if (k === 'skill') h.onSkill(); else h.onRally()
  })
  const sigs = ['', '', '']
  const paint = (i: number, b: PadBtn): void => {
    const sig = `${b.sec}|${b.label}|${b.key}|${b.icon}|${Math.round(b.frac * 40)}|${b.lit === true ? 1 : 0}|${Math.round((b.grit ?? 0) / 25)}`
    if (sig === sigs[i]) return
    sigs[i] = sig
    const el = pad.children[i] as HTMLElement
    const cool = b.sec > 0
    el.className = `fd-pb${cool ? ' cool' : ''}${b.lit === true ? ' lit' : ''}`
    const grit = (b.grit ?? 0) > 0 ? `<circle cx="18" cy="18" r="17.2" fill="none" stroke="#7fe3ff" stroke-width="1.4" stroke-dasharray="${((b.grit ?? 0) / 1000 * 108).toFixed(1)} 200"/>` : ''
    const ring = cool || grit !== '' ? `<svg viewBox="0 0 36 36">${cool ? `<circle cx="18" cy="18" r="${R}" fill="none" stroke="${GOLD}" stroke-width="2.4" stroke-dasharray="${(b.frac * 100).toFixed(1)} 100"/>` : ''}${grit}</svg>${cool ? `<s>${b.sec}</s>` : ''}` : ''
    el.innerHTML = `<em>${b.key}</em>${b.icon === '' ? '' : `<img src="${base}${b.icon}" alt="">`}<b>${b.label}</b>${ring}`
  }
  return {
    sync(show, touch, shake, dash, skill, rally, readyStick) {
      pad.hidden = !show
      stick.classList.toggle('on', (show || readyStick) && touch)
      stick.classList.toggle('shake', shake)
      if (show) { paint(0, dash); paint(1, skill); paint(2, rally) }
    },
  }
}

/** 화면 밖에 있는 우리 무리의 가장자리 화살표 (누르면 그 무리를 고른다) — rot 는 화면 가운데에서 그 무리 쪽 방향(라디안) */
export interface ArrowItem { g: number; x: number; y: number; rot: number; icon: string }
export interface Arrows { sync(items: readonly ArrowItem[]): void }
export function mountArrows(root: HTMLElement, base: string, onPick: (g: number) => void): Arrows {
  const els: HTMLButtonElement[] = []
  for (let g = 0; g < 3; g++) {
    const b = document.createElement('button')
    b.className = 'fd-arw'; b.type = 'button'; b.hidden = true; b.dataset['g'] = String(g)
    b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); onPick(g) })
    root.append(b); els.push(b)
  }
  const sigs = ['', '', '']
  return {
    sync(items) {
      for (let g = 0; g < 3; g++) {
        const it = items.find(i => i.g === g), el = els[g]!
        if (it === undefined) { if (!el.hidden) el.hidden = true; sigs[g] = ''; continue }
        el.hidden = false
        const sig = `${Math.round(it.x)}|${Math.round(it.y)}|${Math.round(it.rot * 20)}`
        if (sig === sigs[g]) continue
        sigs[g] = sig
        if (el.firstElementChild === null) el.innerHTML = `<img src="${base}${it.icon}" alt=""><s></s>`
        el.style.transform = `translate(${Math.round(it.x)}px,${Math.round(it.y)}px)`
        const a = el.querySelector('s') as HTMLElement
        a.style.transform = `rotate(${it.rot.toFixed(2)}rad) translateX(30px)`
      }
    },
  }
}
