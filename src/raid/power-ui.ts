import { HAEBI_TREE as T } from '../tune/params.ts'
import { POWERS, KITS, BRANCHES, kitCombos, comboRank, comboReady, ultUpgraded, branchNodes, branchName, branchPoints, tierOpen, nodeText, nodeAt, type Branch, type Combo, type Kit, type Power, type HaebiRun } from './haebi.ts'

// 활·창·칼 묶음 아이콘은 전용 그림이 올 때까지 병종 아이콘을 빌린다 (형 11-15 · 챗지피티 H27 굽는 중)
const icons: Record<Power, string> = {
  axe: 'raid/power-axe.png', gale: 'raid/power-gale.png', ember: 'raid/power-ember.png',
  thunder: 'raid/power-thunder.png', echo: 'raid/power-echo.png', tempo: 'raid/power-tempo.png', reach: 'raid/power-reach.png',
  bow: 'raid/power-bow.png', rain: 'raid/power-rain.png', spear: 'raid/power-spear.png', javelin: 'raid/power-javelin.png', sword: 'raid/power-sword.png', wave: 'raid/power-wave.png',
  dagger: 'raid/power-dagger.png', knife: 'raid/power-knife.png', bell: 'raid/power-bell.png', soul: 'raid/power-soul.png',
  // 돌팔매 묶음 (11-16) — 전용 아이콘(H56·H57)이 오기 전엔 본편의 투석병·징검돌 아이콘을 빌린다
  sling: 'icon/unit-slingers.png', skip: 'icon/route-steppingstones.png',
  // 버팀 갈래 (11-17 밤) — 상점 영구 강화와 같은 물건 그림 (같은 뜻: 갑옷·회복·발·체력)
  tough: 'raid/shop-armor.png', breath: 'raid/shop-regen.png', nimble: 'raid/shop-swift.png', stout: 'raid/shop-vigor.png',
  // 묶음마다 다른 칸 — 아래 KIT_ART 가 덮는다 (없을 때만 이것)
  hone: 'raid/shop-might.png', drill: 'raid/shop-haste.png', capA: 'raid/power-skill.png', capB: 'raid/power-skill.png', capC: 'fx/shield.png',
}
/**
 * 묶음마다 다른 칸의 그림 — 전용 그림(release-jobs H59~H61)이 올 때까지 가까운 그림을 빌려 빛깔(tint)로 가른다.
 * 벼리기 = 주 무기 그림 + 불빛 · 숙련 = 보조 그림 + 물빛 · 갈래 끝은 그 꼴에 가까운 투사체·조합 그림.
 */
const KIT_ART: Record<Kit, { capA: string; capB: string }> = {
  axe: { capA: 'raid/power-skill.png', capB: 'raid/wind-blade.png' },
  bow: { capA: 'raid/arrow.png', capB: 'raid/power-rain.png' },
  spear: { capA: 'fx/spear.png', capB: 'raid/javelin.png' },
  sword: { capA: 'raid/sword-wave.png', capB: 'raid/power-wave.png' },
  dagger: { capA: 'raid/power-dagger.png', capB: 'raid/knife.png' },
  magic: { capA: 'raid/soul.png', capB: 'raid/power-soul.png' },
  sling: { capA: 'fx/rock.png', capB: 'icon/route-steppingstones.png' },
}
/** 칸 그림 (public/realm/ 아래) · tint 빛깔 이름 (combat.css .tint-*) */
export function nodeArt(kit: Kit | undefined, key: Power): { src: string; tint: string } {
  if (!kit) return { src: icons[key], tint: '' }
  const k = KITS[kit]
  if (key === 'hone') return { src: icons[k.primary], tint: 'hone' }
  if (key === 'drill') return { src: icons[k.secondary], tint: 'drill' }
  if (key === 'capA' || key === 'capB') return { src: KIT_ART[kit][key], tint: key === 'capA' ? 'cap-a' : 'cap-b' }
  if (key === 'capC') return { src: icons.capC, tint: 'cap-c' }
  return { src: icons[key], tint: '' }
}
export function powerIcon(key: Power, kit?: Kit) {
  const a = nodeArt(kit, key)
  return `<img src="${import.meta.env.BASE_URL}realm/${a.src}" alt="" draggable="false"${a.tint ? ` class="tint-${a.tint}"` : ''}>`
}
/** 조합 그림 (public/realm/ 아래) — 전용 그림은 raid/<id>.png · 돌팔매 둘은 H58 이 오기 전까지 본편 바위·타격 그림을 빌린다 */
const comboArt = (id: Combo) => id === 'boulder' ? 'fx/rock.png' : id === 'daze' ? 'raid/hit.png' : `raid/${id}.png`
export const comboSrc = (id: Combo) => `${import.meta.env.BASE_URL}realm/${comboArt(id)}`
export const comboIcon = (id: Combo) => `<img src="${comboSrc(id)}" alt="" draggable="false">`
/** 단계 표시 — Ⅰ Ⅱ Ⅲ */
export const rankMark = (n: number) => ['', 'Ⅰ', 'Ⅱ', 'Ⅲ'][n] ?? String(n)
/** 갈래 빛깔 — 주 무기 금 · 보조 물 · 버팀 보라 (나무·카드·띠 모두 같은 빛) */
export const BRANCH_COLOR: Record<Branch, string> = { a: '#f2c45a', b: '#6fd8c4', c: '#c7a3ff' }

/**
 * 기술 나무 (RAID-LINK §2 · 11-17 밤 D2 식) — 갈래 셋(주 무기 · 보조 · 버팀)을 세로 줄로, 줄마다 네 층.
 * 층은 그 갈래에 찍은 점으로 열린다(잠긴 층 사이엔 「이 갈래 9점」) · 4층은 갈래 끝(크게 · 별 테).
 * 오른쪽 줄: 조합(두 갈래를 잇는 금테 · 필요한 칸 그림 셈) → 맨 아래 비기 강화.
 * 열린 칸 금빛(on) · 고를 수 있는 칸 테두리(next) · 잠긴 칸 어둡게(off). 칸을 누르면 data-node 로 설명 (raid-main).
 * 그림 한 장(SVG · viewBox 1000×350)이라 폰 가로 844×390 에도 굴리지 않고 다 들어간다.
 */
export function treeSvg(s: HaebiRun) {
  const k = KITS[s.kit], base = import.meta.env.BASE_URL + 'realm/', tree = branchNodes(s.kit)
  const COL: Record<Branch, number> = { a: 135, b: 395, c: 645 }, ROW = (t: number) => 64 + t * 80, R = 22, PAIR = 58
  const parts: string[] = [], lines: string[] = []
  const img = (key: Power, x: number, y: number, r: number) => { const a = nodeArt(s.kit, key); return `<image href="${base + a.src}" x="${x - r * .8}" y="${y - r * .8}" width="${r * 1.6}" height="${r * 1.6}"${a.tint ? ` class="tint-${a.tint}"` : ''}/>` }
  for (const b of BRANCHES) {
    const cx = COL[b], pts = branchPoints(s, b), color = BRANCH_COLOR[b]
    parts.push(`<text class="head" x="${cx}" y="22" style="fill:${color}">${branchName(s.kit, b)} <tspan class="pts">${pts}점</tspan></text>`)
    tree[b].forEach((row, t) => {
      const y = ROW(t), open = tierOpen(s, b, t)
      // 층 사이: 다음 층이 열렸으면 금줄, 아니면 「이 갈래 N점」 알약
      if (t < tree[b].length - 1) {
        const nextOpen = tierOpen(s, b, t + 1), y2 = ROW(t + 1)
        lines.push(`<line class="${nextOpen ? 'on' : ''}" x1="${cx}" y1="${y + (row.length === 1 ? R + 19 : 0)}" x2="${cx}" y2="${tree[b][t + 1]!.length === 1 ? y2 - R - 6 : y2}" style="${nextOpen ? `stroke:${color}` : ''}"/>`)
        if (!nextOpen) parts.push(`<g class="lock"><rect x="${cx - 44}" y="${y + 41}" width="88" height="16" rx="8"/><text x="${cx}" y="${y + 53}">이 갈래 ${T.tiers[t + 1]}점</text></g>`)
      }
      row.forEach((p, i) => {
        const x = row.length === 1 ? cx : cx + (i ? PAIR : -PAIR), rank = s.ranks[p], max = POWERS[p].max, cap = t === tree[b].length - 1
        const state = rank >= max ? 'on max' : rank > 0 ? 'on' : open ? 'next' : 'off', r = cap ? R + 3 : R
        // 단계 알약은 칸 오른쪽 위 (아래는 이름 · 가운데 줄과 겹치지 않게)
        const bw = max >= 10 ? 32 : 26, badge = rank ? `<g class="badge"><rect x="${x + r - 12}" y="${y - r - 6}" width="${bw}" height="15" rx="7"/><text x="${x + r - 12 + bw / 2}" y="${y - r + 5}">${rank}/${max}</text></g>` : ''
        const star = cap ? `<circle class="cap-ring" cx="${x}" cy="${y}" r="${r + 5}" style="stroke:${color}"/>` : ''
        parts.push(`<g class="node ${state}${cap ? ' cap' : ''}" data-node="${p}">${star}<circle class="ring" cx="${x}" cy="${y}" r="${r}"/>${img(p, x, y, r)}${badge}<text class="label" x="${x}" y="${y + r + (cap ? 18 : 13)}">${nodeText(s.kit, p).name}</text></g>`)
      })
    })
  }
  // 조합 줄 — 금테 · 필요한 칸 그림 셈 (그림 + 단계) · 맨 아래 비기 강화
  const CX = 820, combos = kitCombos(s.kit)
  parts.push(`<text class="head" x="${CX + 70}" y="22" style="fill:#f2c45a">조합</text>`)
  combos.forEach((c, i) => {
    const y = ROW(i), r = comboRank(s, c.id), state = r >= T.max ? 'on max' : r ? 'on' : comboReady(s, c) ? 'next' : 'off'
    const needs = Object.entries(c.needs).map(([p, n], j) => { const ok = s.ranks[p as Power] >= n, x = CX + 32 + j * 58; return `<g class="need${ok ? ' ok' : ''}">${img(p as Power, x + 12, y + 13, 13)}<text x="${x + 28}" y="${y + 19}">${n}</text></g>` }).join('')
    parts.push(`<g class="node combo ${state}" data-combo="${c.id}"><circle class="ring" cx="${CX}" cy="${y}" r="${R}"/><image href="${comboSrc(c.id)}" x="${CX - R * .8}" y="${y - R * .8}" width="${R * 1.6}" height="${R * 1.6}"/><text class="cname" x="${CX + 32}" y="${y - 4}">${c.name}${r ? ' ' + rankMark(r) : ''}</text>${needs}</g>`)
  })
  const uy = ROW(3), uOn = ultUpgraded(s)
  parts.push(`<g class="node combo ult ${uOn ? 'on max' : combos.some(c => comboRank(s, c.id)) ? 'next' : 'off'}" data-ult="1"><circle class="ring" cx="${CX}" cy="${uy}" r="${R + 3}"/><image href="${base}raid/power-skill.png" x="${CX - 20}" y="${uy - 20}" width="40" height="40"/><text class="cname" x="${CX + 32}" y="${uy - 4}">${k.skill} 강화</text><text class="csub" x="${CX + 32}" y="${uy + 13}">조합 하나 ${rankMark(T.max)}</text></g>`)
  return `<svg class="tree" viewBox="0 0 1000 350" role="img" aria-label="${k.weapon} 기술 나무"><g class="lines">${lines.join('')}</g>${parts.join('')}</svg>`
}
/** 나무에서 누른 칸의 한 줄 설명 (조합·비기 강화 포함) */
export function treeInfo(s: HaebiRun, el: Element) {
  const node = el.getAttribute('data-node') as Power | null, combo = el.getAttribute('data-combo') as Combo | null
  if (node) {
    const at = nodeAt(s.kit, node)!, t = nodeText(s.kit, node), need = T.tiers[at.tier]!, open = tierOpen(s, at.branch, at.tier)
    return `<b>${t.name}</b> ${s.ranks[node]}/${POWERS[node].max} · ${t.desc}${open ? '' : ` · ${branchName(s.kit, at.branch)} 갈래 ${need}점에 열립니다`}`
  }
  if (combo) { const c = kitCombos(s.kit).find(x => x.id === combo)!; return `<b>${c.name}</b> ${comboRank(s, combo)}/${T.max} · ${c.desc}` }
  if (el.getAttribute('data-ult')) return `<b>${KITS[s.kit].skill} 강화</b> · 조합 하나를 ${T.max}단계로 올리면 비기가 더 세고 넓어지고 자주 쓸 수 있습니다`
  return ''
}
export function powerTooltip(s: HaebiRun, key: Power) {
  const p = POWERS[key], rank = s.ranks[key], t = nodeText(s.kit, key), at = nodeAt(s.kit, key)
  const steps = Array.from({ length: p.max }, (_, i) => `<span class="${i < rank ? 'earned' : ''} ${i + 1 === rank ? 'current' : ''}">${i + 1}</span>`).join('')
  const combos = kitCombos(s.kit).filter(c => key in c.needs).map(c => `<p><b>${c.name}</b><br>${Object.entries(c.needs).map(([k, n]) => `${nodeText(s.kit, k as Power).name} ${s.ranks[k as Power]}/${n}`).join(' · ')}</p>`).join('')
  const branch = at ? `<p class="branch-line" style="color:${BRANCH_COLOR[at.branch]}">${branchName(s.kit, at.branch)} 갈래 · ${branchPoints(s, at.branch)}점</p>` : ''
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
