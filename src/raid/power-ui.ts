import { HAEBI_TREE as T, HAEBI_RUN as C } from '../tune/params.ts'
import { POWERS, KITS, kitCombos, comboRank, comboReady, ultUpgraded, attackPowers, type Combo, type Power, type HaebiRun } from './haebi.ts'

// 활·창·칼 묶음 아이콘은 전용 그림이 올 때까지 병종 아이콘을 빌린다 (형 11-15 · 챗지피티 H27 굽는 중)
const icons: Record<Power, string> = {
  axe: 'raid/power-axe.png', gale: 'raid/power-gale.png', ember: 'raid/power-ember.png',
  thunder: 'raid/power-thunder.png', echo: 'raid/power-echo.png', tempo: 'raid/power-tempo.png', reach: 'raid/power-reach.png',
  bow: 'raid/power-bow.png', rain: 'raid/power-rain.png', spear: 'raid/power-spear.png', javelin: 'raid/power-javelin.png', sword: 'raid/power-sword.png', wave: 'raid/power-wave.png',
  dagger: 'raid/power-dagger.png', knife: 'raid/power-knife.png', bell: 'raid/power-bell.png', soul: 'raid/power-soul.png',
  // 돌팔매 묶음 (11-16) — 전용 아이콘(H56·H57)이 오기 전엔 본편의 투석병·징검돌 아이콘을 빌린다
  sling: 'icon/unit-slingers.png', skip: 'icon/route-steppingstones.png',
}
export function powerIcon(key: Power) {
  return `<img src="${import.meta.env.BASE_URL}realm/${icons[key]}" alt="" draggable="false">`
}
/** 조합 그림 (public/realm/ 아래) — 전용 그림은 raid/<id>.png · 돌팔매 둘은 H58 이 오기 전까지 본편 바위·타격 그림을 빌린다 */
const comboArt = (id: Combo) => id === 'boulder' ? 'fx/rock.png' : id === 'daze' ? 'raid/hit.png' : `raid/${id}.png`
export const comboSrc = (id: Combo) => `${import.meta.env.BASE_URL}realm/${comboArt(id)}`
export const comboIcon = (id: Combo) => `<img src="${comboSrc(id)}" alt="" draggable="false">`
/** 단계 표시 — Ⅰ Ⅱ Ⅲ */
export const rankMark = (n: number) => ['', 'Ⅰ', 'Ⅱ', 'Ⅲ'][n] ?? String(n)

/**
 * 기술 나무 (RAID-LINK §2 디아블로식) — 1층 능력(주 무기·보조·조합에 쓰는 공용) → 2층 조합 → 3층 비기 강화.
 * 열린 칸 금빛(on) · 다음에 열 칸 테두리(next) · 잠긴 칸 어둡게(off). 줄은 조합 조건 그대로 (아이콘 셈과 같은 줄).
 * 그림 한 장(SVG)이라 폰 가로 844×390 에도 굴리지 않고 다 들어간다.
 */
export function treeSvg(s: HaebiRun) {
  const k = KITS[s.kit], base = import.meta.env.BASE_URL + 'realm/'
  const tier1: Power[] = [k.primary, k.secondary, 'echo', 'ember', 'thunder']
  const combos = kitCombos(s.kit), byNeed = (p: Power) => combos.find(c => c.kit !== null && p in c.needs && (p === k.primary || p === 'echo'))
  const tier2 = [byNeed(k.primary), byNeed('echo'), combos.find(c => c.kit === null)].filter((c): c is typeof combos[number] => !!c)
  const X1 = 110, X2 = 400, X3 = 650, Y1 = (i: number) => 36 + i * 74, R = 26
  const Y2 = (id: Combo) => { const c = tier2.find(x => x.id === id)!, ys = Object.keys(c.needs).map(p => Y1(tier1.indexOf(p as Power))); return ys.reduce((a, b) => a + b, 0) / ys.length }
  const slotsFull = attackPowers(s.kit).filter(p => s.ranks[p] > 0).length >= C.attackSlots
  const pState = (p: Power) => s.ranks[p] > 0 ? 'on' : slotsFull && attackPowers(s.kit).includes(p) ? 'off' : 'next'
  const cState = (id: Combo) => comboRank(s, id) > 0 ? 'on' : comboReady(s, tier2.find(c => c.id === id)!) ? 'next' : 'off'
  const ultOn = ultUpgraded(s), uState = ultOn ? 'on' : tier2.some(c => comboRank(s, c.id) > 0) ? 'next' : 'off'
  const tag = (x: number, y: number, text: string, on: boolean) => `<g class="tag ${on ? 'on' : ''}"><rect x="${x - 17}" y="${y - 10}" width="34" height="20" rx="10"/><text x="${x}" y="${y + 5}">${text}</text></g>`
  const lines: string[] = [], nodes: string[] = []
  for (const c of tier2) {
    const y2 = Y2(c.id)
    for (const [p, n] of Object.entries(c.needs) as [Power, number][]) {
      const y1 = Y1(tier1.indexOf(p)), met = s.ranks[p] >= n
      lines.push(`<line class="${met ? 'on' : ''}" x1="${X1 + R}" y1="${y1}" x2="${X2 - R}" y2="${y2}"/>`)
      const tx = X1 + R + (X2 - X1 - 2 * R) * .62, ty = y1 + (y2 - y1) * .62
      lines.push(tag(tx, ty, `${Math.min(s.ranks[p], n)}/${n}`, met))
    }
    const r = comboRank(s, c.id)
    lines.push(`<line class="${r >= T.max ? 'on' : ''}" x1="${X2 + R + 18}" y1="${y2}" x2="${X3 - 34}" y2="${Y1(2)}"/>`)
    lines.push(tag(X2 + R + 18 + (X3 - 52 - X2 - R) * .5, y2 + (Y1(2) - y2) * .5, `${r}/${T.max}`, r >= T.max))
  }
  const node = (x: number, y: number, r: number, href: string, state: string, label: string, badge = '') =>
    `<g class="node ${state}"><circle class="ring" cx="${x}" cy="${y}" r="${r}"/><image href="${href}" x="${x - r * .78}" y="${y - r * .78}" width="${r * 1.56}" height="${r * 1.56}"/>${badge}<text class="label" x="${x}" y="${y + r + 15}">${label}</text></g>`
  tier1.forEach((p, i) => nodes.push(node(X1, Y1(i), R, base + icons[p], pState(p), POWERS[p].name, s.ranks[p] ? `<g class="badge"><circle cx="${X1 + R - 3}" cy="${Y1(i) + R - 5}" r="10"/><text x="${X1 + R - 3}" y="${Y1(i) + R - 1}">${s.ranks[p]}</text></g>` : '')))
  for (const c of tier2) {
    const y = Y2(c.id), r = comboRank(s, c.id)
    const pips = Array.from({ length: T.max }, (_, i) => `<circle class="pip ${i < r ? 'on' : ''}" cx="${X2 + R + 11}" cy="${y + (i - 1) * 13}" r="5"/>`).join('')
    nodes.push(node(X2, y, R, comboSrc(c.id), cState(c.id), c.name, pips))
  }
  nodes.push(node(X3, Y1(2), 34, base + 'raid/power-skill.png', uState, `${k.skill} 강화`))
  return `<svg class="tree" viewBox="0 0 760 400" role="img" aria-label="${k.weapon} 기술 나무"><g class="lines">${lines.join('')}</g>${nodes.join('')}<text class="tier" x="${X1}" y="396">능력</text><text class="tier" x="${X2}" y="396">조합</text><text class="tier" x="${X3}" y="396">비기</text></svg>`
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
