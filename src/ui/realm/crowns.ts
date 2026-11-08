/**
 * 결승선의 왕관 (위원회 11-08 · loop L4 「결승선 왕관」 · 형: "후반에 너무 압도 · 재미가 떨어진다") —
 * 정복 승리에 쥐어야 할 도읍을 왕관으로 센다. 정복이 crownShowAt 몫을 넘으면
 *  - 위 깃발 줄 맨 앞에 왕관 줄(쥔 도읍만큼 금빛으로 켜짐)
 *  - 지도 위 아직 못 쥔 도읍마다 떠 있는 왕관
 *  - 도읍을 쥔 계절엔 그 고을에서 왕관이 날아와 줄에 박힌다
 * 판을 읽기만 한다 (절대 규칙 2) · 글 없이 그림으로 (메모리 show-not-read).
 */
import { P } from '../../tune/params.ts'
import type { Realm } from '../../realm/types.ts'
import { winNeed } from './front.ts'

/** 정복 승리에 쓰는 도읍 셈 — 쥔 수 · 쥐어야 할 수 (배우는 판·이야기 장은 없다) */
export function crownCount(r: Realm, me: string): { held: number; need: number } | null {
  if (r.region === 'tutorial' || r.scenario !== undefined || r.factions[me] === undefined) return null
  const need = winNeed(r.region ?? 'byeonhan-mini')
  const held = Object.values(r.factions).filter((x) => r.nodes[x.capital]?.owner === me).length
  return { held, need }
}

/** 왕관을 보일 때인가 — 정복이 crownShowAt 몫을 넘었다 */
export function crownPhase(r: Realm, me: string): boolean {
  const c = crownCount(r, me)
  return c !== null && c.need > 0 && c.held / c.need >= P.realm.crownShowAt && c.held < c.need
}

/** 지도에 왕관을 띄울 도읍 — 남의 도읍 가운데 아직 우리가 못 쥔 것 */
export function crownTargets(r: Realm, me: string): ReadonlySet<string> {
  if (!crownPhase(r, me)) return new Set()
  return new Set(Object.values(r.factions).map((f) => f.capital).filter((c) => r.nodes[c] !== undefined && r.nodes[c]!.owner !== me))
}

/** 위 깃발 줄 맨 앞 왕관 줄 — 쥔 도읍만큼 켜진다 */
export function crownRowHtml(r: Realm, me: string, art: string): string {
  if (!crownPhase(r, me)) return ''
  const c = crownCount(r, me)!
  let h = `<span class="crownrow" data-tip="도읍 ${c.held}/${c.need}: 다 쥐면 이긴다">`
  for (let i = 0; i < c.need; i++) h += `<img class="${i < c.held ? 'on' : ''}" src="${art}icon/crown-gold.png" alt="">`
  return h + '</span>'
}

/** 이번 계절에 새로 쥔 남의 도읍 — 왕관이 날아갈 곳 */
export function newCrowns(prev: Realm, next: Realm, me: string): string[] {
  return Object.values(next.factions).map((f) => f.capital).filter((c) => next.nodes[c]?.owner === me && prev.nodes[c]?.owner !== me && c !== next.factions[me]?.capital)
}

/**
 * 왕관이 고을에서 왕관 줄로 날아가 박힌다 — 화면 꾸밈뿐 (Web Animations · transform·opacity) · 고을이나 줄이 화면에 없으면 건너뛴다
 */
export function flyCrowns(root: HTMLElement, nodes: readonly string[], art: string): void {
  const row = root.querySelector<HTMLElement>('.crownrow')
  if (row === null || nodes.length === 0 || typeof document === 'undefined') return
  const slots = [...row.querySelectorAll<HTMLElement>('img.on')]
  nodes.forEach((id, i) => {
    const from = root.querySelector<HTMLElement>(`.nd[data-node="${id}"]`)
    const to = slots[slots.length - nodes.length + i] ?? slots[slots.length - 1]
    if (from === null || to === undefined) return
    const a = from.getBoundingClientRect()
    const b = to.getBoundingClientRect()
    const img = document.createElement('img')
    img.className = 'crownfly'
    img.src = `${art}icon/crown-gold.png`
    img.alt = ''
    document.body.appendChild(img)
    const x0 = a.left + a.width / 2 - 28
    const y0 = a.top - 10
    const dx = b.left + b.width / 2 - 28 - x0
    const dy = b.top + b.height / 2 - 28 - y0
    img.style.left = `${x0}px`
    img.style.top = `${y0}px`
    to.classList.add('wait')
    const anim = img.animate([
      { transform: 'translate(0, 0) scale(0.4)', opacity: 0 },
      { transform: 'translate(0, -40px) scale(1.6)', opacity: 1, offset: 0.25 },
      { transform: 'translate(0, -40px) scale(1.4)', opacity: 1, offset: 0.45 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.45)`, opacity: 1 },
    ], { duration: P.realm.crownFlyMs, delay: i * 350, easing: 'cubic-bezier(.5,0,.4,1)', fill: 'both' })
    anim.onfinish = (): void => { img.remove(); to.classList.remove('wait'); to.classList.add('pop') }
  })
}

export const CROWN_CSS = `
.ap .crownrow { display: inline-flex; align-items: center; gap: 1px; padding: 2px 6px; margin-right: 4px; border-radius: 12px; background: #1a120acc; border: 1px solid #c9a45a88; }
.ap .crownrow img { width: 18px; height: 18px; object-fit: contain; opacity: .28; filter: grayscale(1); }
.ap .crownrow img.on { opacity: 1; filter: drop-shadow(0 0 4px #ffd24a); }
.ap .crownrow img.on.wait { opacity: .28; filter: grayscale(1); }
.ap .crownrow img.pop { animation: crpop .5s cubic-bezier(.2,1.6,.4,1); }
@keyframes crpop { 0% { transform: scale(2.2); } 100% { transform: scale(1); } }
.ap .nd .crownm { position: absolute; left: 50%; top: -34px; width: 26px; height: 26px; translate: -50% 0; pointer-events: none; z-index: 3; animation: crbob 1.8s ease-in-out infinite alternate; }
.ap .nd .crownm img { width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 0 6px #ffd24acc); }
@keyframes crbob { from { transform: translateY(0); } to { transform: translateY(-5px); } }
.crownfly { position: fixed; z-index: 90; width: 56px; height: 56px; object-fit: contain; pointer-events: none; filter: drop-shadow(0 0 10px #ffd24a); }
@media (prefers-reduced-motion: reduce) { .ap .nd .crownm { animation: none; } }
`
