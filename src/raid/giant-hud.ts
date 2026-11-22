import { HAEBI_RUN as C } from '../tune/params.ts'

export interface GiantHudFrame { readonly id: number; readonly name: string; readonly hp: number; readonly max: number; readonly phase: number; readonly enraged: boolean; readonly entry: number }
const unit = (x: number) => Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0
/** Presentation memory only. Its caller supplies active seconds, never a wall clock. */
export class GiantHealthTrail {
 private id: number | null = null
 private last = 1
 private lag = 1
 private hold = 0
 update(id: number, ratio: number, activeSeconds: number): number {
  const p = unit(ratio)
  if (id !== this.id) { this.id = id; this.lag = this.last = p; this.hold = 0 }
  if (p < this.last) { this.lag = Math.max(this.lag, this.last); this.hold = C.hpChunkHold }
  this.last = p; this.lag = Math.max(p, this.lag)
  const dt = Number.isFinite(activeSeconds) ? Math.max(0, activeSeconds) : 0, decay = Math.max(0, dt - this.hold)
  this.hold = Math.max(0, this.hold - dt)
  if (decay > 0) this.lag = p + (this.lag - p) * Math.exp(-C.hpChunkRate * decay)
  return this.lag
 }
 clear() { this.id = null; this.hold = 0 }
}
/** One requested lower boss bar; no input handlers, animation clocks, or run mutations. */
export class RaidGiantHud {
 private root: HTMLElement
 private name: HTMLElement
 private fill: HTMLElement
 private trail: HTMLElement
 private meter: HTMLElement
 private memory = new GiantHealthTrail()
 /** 지난번에 쓴 값 — 같은 값을 틀마다 다시 쓰면(이름 글자는 매번 새 글자 마디) 폰이 스타일·배치를 다시 셈한다 (raid-main setText 와 같은 까닭 · 11-16 플립7 · 11-22) */
 private shown = { phase: '', enter: '', name: '', now: '', fill: '', trail: '' }
 constructor(host: HTMLElement, phaseCuts: readonly number[]) {
  this.root = document.createElement('div'); this.root.className = 'giant-hud'; this.root.hidden = true
  this.root.innerHTML = '<b class="giant-name"></b><div class="giant-meter" role="progressbar" aria-valuemin="0" aria-valuemax="100"><i class="giant-trail"></i><i class="giant-fill"></i></div>'
  this.name = this.root.querySelector('.giant-name')!; this.fill = this.root.querySelector('.giant-fill')!; this.trail = this.root.querySelector('.giant-trail')!; this.meter = this.root.querySelector('.giant-meter')!
  for (const cut of phaseCuts) { const mark = document.createElement('em'); mark.className = 'giant-phase'; mark.style.left = unit(cut) * 100 + '%'; this.meter.appendChild(mark) }
  host.appendChild(this.root)
 }
 update(s: GiantHudFrame | null, activeSeconds: number) {
  if (!s) { if (!this.root.hidden) this.root.hidden = true; this.memory.clear(); return }
  const hp = s.max > 0 ? unit(s.hp / s.max) : 0, lag = this.memory.update(s.id, hp, activeSeconds), was = this.shown
  if (this.root.hidden) this.root.hidden = false
  this.root.classList.toggle('enraged', s.enraged)
  const phase = String(s.phase), enter = String(unit(s.entry)), now = String(Math.round(hp * 100)), fill = (hp * 100).toFixed(2) + '%', trail = (lag * 100).toFixed(2) + '%'
  if (was.phase !== phase) { was.phase = phase; this.root.dataset.phase = phase }
  if (was.enter !== enter) { was.enter = enter; this.root.style.setProperty('--giant-enter', enter) }
  if (was.name !== s.name) { was.name = s.name; this.name.textContent = s.name; this.meter.setAttribute('aria-label', s.name) }
  if (was.now !== now) { was.now = now; this.meter.setAttribute('aria-valuenow', now) }
  if (was.fill !== fill) { was.fill = fill; this.fill.style.width = fill }
  if (was.trail !== trail) { was.trail = trail; this.trail.style.width = trail }
 }
}
