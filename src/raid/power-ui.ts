import { HAEBI_TREE as T } from '../tune/params.ts'
import { POWERS, KITS, kitCombos, comboRank, branchName, branchPoints, nodeText, nodeAt, nodeParent, type Branch, type Combo, type Kit, type Power, type HaebiRun } from './haebi.ts'
import { ICON_READY } from './icon-ready.ts'
import { renderTree } from './tree-view.ts'
const BASE = import.meta.env?.BASE_URL ?? '/'

/** 전용 아이콘(release-jobs H56~H61 · tools/raid-icons-h56.py)이 구워져 있으면 raid/<이름>.png, 아니면 빌린 그림 */
const own = (name: string, borrowed: string) => ICON_READY.has(name) ? `raid/${name}.png` : borrowed
const icons: Record<Power, string> = {
  axe: 'raid/power-axe.png', gale: 'raid/power-gale.png', ember: 'raid/power-ember.png',
  thunder: 'raid/power-thunder.png', echo: 'raid/power-echo.png', tempo: 'raid/power-tempo.png', reach: 'raid/power-reach.png',
  bow: 'raid/power-bow.png', rain: 'raid/power-rain.png', spear: 'raid/power-spear.png', javelin: 'raid/power-javelin.png', sword: 'raid/power-sword.png', wave: 'raid/power-wave.png',
  dagger: 'raid/power-dagger.png', knife: 'raid/power-knife.png', bell: 'raid/power-bell.png', soul: 'raid/power-soul.png',
  // 돌팔매 묶음 (11-16 · H56·H57) — 없으면 본편의 투석병·징검돌 아이콘
  sling: own('power-sling', 'icon/unit-slingers.png'), skip: own('power-skip', 'icon/route-steppingstones.png'),
  // 버팀 갈래 (11-17 밤) — 상점 영구 강화와 같은 물건 그림 (같은 뜻: 갑옷·회복·발·체력)
  tough: 'raid/shop-armor.png', breath: 'raid/shop-regen.png', nimble: 'raid/shop-swift.png', stout: 'raid/shop-vigor.png',
  // 묶음마다 다른 칸 — 아래 KIT_ART 가 덮는다 (없을 때만 이것)
  hone: 'raid/shop-might.png', drill: 'raid/shop-haste.png', capA: 'raid/power-skill.png', capB: 'raid/power-skill.png', capC: own('node-counter', 'fx/shield.png'),
}
/**
 * 묶음마다 다른 칸의 그림 — 전용 그림(H59~H61)이 없으면 가까운 그림을 빌려 빛깔(tint)로 가른다.
 * 벼리기 = 주 무기 그림 + 불빛 · 숙련 = 보조 그림 + 물빛 · 갈래 끝은 그 꼴에 가까운 투사체·조합 그림.
 */
const BORROWED: Record<Kit, { capA: string; capB: string }> = {
  axe: { capA: 'raid/power-skill.png', capB: 'raid/wind-blade.png' },
  bow: { capA: 'raid/arrow.png', capB: 'raid/power-rain.png' },
  spear: { capA: 'fx/spear.png', capB: 'raid/javelin.png' },
  sword: { capA: 'raid/sword-wave.png', capB: 'raid/power-wave.png' },
  dagger: { capA: 'raid/power-dagger.png', capB: 'raid/knife.png' },
  magic: { capA: 'raid/soul.png', capB: 'raid/power-soul.png' },
  sling: { capA: 'fx/rock.png', capB: 'icon/route-steppingstones.png' },
}
const capArt = (kit: Kit, key: 'capA' | 'capB') => own(`cap-${kit}-${key === 'capA' ? 'a' : 'b'}`, BORROWED[kit][key])
/** 칸 그림 (public/realm/ 아래) · tint 빛깔 이름 (combat.css .tint-*) · 전용 그림이면 빛깔을 바꾸지 않는다 (갈래 끝의 테두리 빛만) */
export function nodeArt(kit: Kit | undefined, key: Power): { src: string; tint: string } {
  if (!kit) return { src: icons[key], tint: '' }
  const k = KITS[kit]
  if (key === 'hone') return ICON_READY.has('node-hone') ? { src: 'raid/node-hone.png', tint: '' } : { src: icons[k.primary], tint: 'hone' }
  if (key === 'drill') return ICON_READY.has('node-drill') ? { src: 'raid/node-drill.png', tint: '' } : { src: icons[k.secondary], tint: 'drill' }
  if (key === 'capA' || key === 'capB') return { src: capArt(kit, key), tint: key === 'capA' ? 'cap-a' : 'cap-b' }
  if (key === 'capC') return { src: icons.capC, tint: ICON_READY.has('node-counter') ? 'cap-glow' : 'cap-c' }
  return { src: icons[key], tint: '' }
}
export function powerIcon(key: Power, kit?: Kit) {
  const a = nodeArt(kit, key)
  return `<img src="${BASE}realm/${a.src}" alt="" draggable="false"${a.tint ? ` class="tint-${a.tint}"` : ''}>`
}
/** 조합 그림 (public/realm/ 아래) — raid/<id>.png · 돌팔매 둘은 H58 이 없으면 본편 바위·타격 그림 */
const comboArt = (id: Combo) => id === 'boulder' ? own('boulder', 'fx/rock.png') : id === 'daze' ? own('daze', 'raid/hit.png') : `raid/${id}.png`
export const comboSrc = (id: Combo) => `${BASE}realm/${comboArt(id)}`
export const comboIcon = (id: Combo) => `<img src="${comboSrc(id)}" alt="" draggable="false">`
/** 단계 표시 — Ⅰ Ⅱ Ⅲ */
export const rankMark = (n: number) => ['', 'Ⅰ', 'Ⅱ', 'Ⅲ'][n] ?? String(n)
/** 갈래 빛깔 — 주 무기 금 · 보조 물 · 버팀 보라 (나무·카드·띠 모두 같은 빛) */
export const BRANCH_COLOR: Record<Branch, string> = { a: '#f2c45a', b: '#6fd8c4', c: '#c7a3ff' }

/** Responsive tree; the name stays stable for existing callers. */
export function treeSvg(s: HaebiRun) {
  return renderTree(s, p => powerIcon(p, s.kit), comboIcon, BRANCH_COLOR, powerIcon('capA'))
}
/** 나무에서 누른 칸의 한 줄 설명 (조합·비기 강화 포함) */
export function treeInfo(s: HaebiRun, el: Element) {
  const node = el.getAttribute('data-node') as Power | null, combo = el.getAttribute('data-combo') as Combo | null
  if (node) {
    const t = nodeText(s.kit, node)
    const at = nodeAt(s.kit, node)!, left = Math.max(0, T.tiers[at.tier]! - branchPoints(s, at.branch)), parent = nodeParent(s.kit, node)
    return `<b>${t.name}</b> ${s.ranks[node]}/${POWERS[node].max} · ${t.desc}${left && (!parent || s.ranks[parent] >= 1) ? ` · 이 갈래를 ${left}번 더 고르면 열립니다` : ''}`
  }
  if (combo) { const c = kitCombos(s.kit).find(x => x.id === combo)!; return `<b>${c.name}</b> ${comboRank(s, combo)}/${T.max} · ${c.desc}` }
  if (el.getAttribute('data-ult')) return `<b>${KITS[s.kit].skill} 강화</b> · 조합 하나를 ${T.max}단계로 올리면 비기가 더 세고 넓어지고 자주 쓸 수 있습니다`
  return ''
}
export function powerTooltip(s: HaebiRun, key: Power) {
  const p = POWERS[key], rank = s.ranks[key], t = nodeText(s.kit, key), at = nodeAt(s.kit, key)
  const steps = Array.from({ length: p.max }, (_, i) => `<span class="${i < rank ? 'earned' : ''} ${i + 1 === rank ? 'current' : ''}">${i + 1}</span>`).join('')
  const combos = kitCombos(s.kit).filter(c => key in c.needs).map(c => `<p><b>${c.name}</b><br>${Object.entries(c.needs).map(([k, n]) => `${nodeText(s.kit, k as Power).name} ${s.ranks[k as Power]}/${n}`).join(' · ')}</p>`).join('')
  const branch = at ? `<p class="branch-line" style="color:${BRANCH_COLOR[at.branch]}">${branchName(s.kit, at.branch)} 갈래 · ${branchPoints(s, at.branch)}번 고름</p>` : ''
  return `<b>${t.name} · ${rank}/${p.max}</b><div class="rank-steps">${steps}</div><p>${t.desc}</p>${branch}${combos}`
}

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
