import { POWERS, kitCombos, type Power, type HaebiRun } from './haebi.ts'

// 활·창·칼 묶음 아이콘은 전용 그림이 올 때까지 병종 아이콘을 빌린다 (형 11-15 · 챗지피티 H27 굽는 중)
const icons: Record<Power, string> = {
  axe: 'raid/power-axe.png', gale: 'raid/power-gale.png', ember: 'raid/power-ember.png',
  thunder: 'raid/power-thunder.png', echo: 'raid/power-echo.png', tempo: 'raid/power-tempo.png', reach: 'raid/power-reach.png',
  bow: 'raid/power-bow.png', rain: 'raid/power-rain.png', spear: 'raid/power-spear.png', javelin: 'raid/power-javelin.png', sword: 'raid/power-sword.png', wave: 'raid/power-wave.png',
  dagger: 'raid/power-dagger.png', knife: 'raid/power-knife.png', bell: 'raid/power-bell.png', soul: 'raid/power-soul.png',
}
export function powerIcon(key: Power) {
  return `<img src="${import.meta.env.BASE_URL}realm/${icons[key]}" alt="" draggable="false">`
}
export function powerTooltip(s: HaebiRun, key: Power) {
  const p = POWERS[key], rank = s.ranks[key]
  const steps = Array.from({ length: p.max }, (_, i) => `<span class="${i < rank ? 'earned' : ''} ${i + 1 === rank ? 'current' : ''}">${i + 1}</span>`).join('')
  const combos = kitCombos(s.kit).filter(c => key in c.needs).map(c => `<p><b>${c.name}</b><br>${Object.entries(c.needs).map(([k,n]) => `${POWERS[k as Power].name} ${s.ranks[k as Power]}/${n}`).join(' · ')}</p>`).join('')
  return `<b>${p.name} · ${rank}/${p.max}</b><div class="rank-steps">${steps}</div><p>${p.desc}</p>${combos || '<p>모든 공격 능력에 함께 적용됩니다.</p>'}`
}

/** Hover/focus on desktop, hold on touch. Touch inspection suspends simulation until release. */
export function installPowerHints(container: HTMLElement, tooltip: HTMLElement, getRun: () => HaebiRun, setHeld: (held: boolean) => void) {
  let target: HTMLElement | null = null, touchId: number | null = null
  const hide = () => {
    target?.removeAttribute('aria-describedby'); target = null; touchId = null
    tooltip.hidden = true; setHeld(false)
  }
  const show = (el: HTMLElement) => {
    target?.removeAttribute('aria-describedby'); target = el
    const key = el.dataset.power as Power
    tooltip.innerHTML = powerTooltip(getRun(), key); tooltip.hidden = false
    el.setAttribute('aria-describedby', tooltip.id)
    const r = el.getBoundingClientRect()
    tooltip.style.left = Math.max(8, Math.min(r.left, innerWidth - tooltip.offsetWidth - 8)) + 'px'
    tooltip.style.top = Math.max(8, Math.min(r.bottom + 8, innerHeight - tooltip.offsetHeight - 8)) + 'px'
  }
  container.addEventListener('pointerover', e => { if (e.pointerType === 'mouse') { const el = (e.target as HTMLElement).closest<HTMLElement>('[data-power]'); if (el) show(el) } })
  container.addEventListener('pointerout', e => { if (e.pointerType === 'mouse' && target && !target.contains(e.relatedTarget as Node | null)) hide() })
  container.addEventListener('focusin', e => { const el = (e.target as HTMLElement).closest<HTMLElement>('[data-power]'); if (el && touchId === null) show(el) })
  container.addEventListener('focusout', hide)
  container.addEventListener('pointerdown', e => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-power]'); if (!el || e.pointerType === 'mouse') return
    e.preventDefault(); e.stopPropagation(); el.setPointerCapture(e.pointerId); touchId = e.pointerId; show(el); setHeld(true)
  })
  const release = (e: PointerEvent) => { if (e.pointerId === touchId) hide() }
  window.addEventListener('pointerup', release); window.addEventListener('pointercancel', release)
  container.addEventListener('lostpointercapture', release)
  window.addEventListener('blur', hide); window.addEventListener('resize', hide)
  document.addEventListener('visibilitychange', () => { if (document.hidden) hide() })
  container.addEventListener('contextmenu', e => e.preventDefault())
  return hide
}
