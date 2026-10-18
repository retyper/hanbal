/**
 * 장수 카드의 조각 — 육각형 · 특성 칩 · 지금 하는 일 (docs/realm/HEROES.md §5)
 *
 * 판을 읽기만 하고 HTML 을 돌려준다. 고르는 손짓(맡기기·이끌기·회유)은 app.ts 가 받는다.
 * **본 만큼만** (HEROES §5): 우리 장수 · 싸워 본 장수 · 정찰로 본 장수만 능력치와 특성이 보이고, 아니면 얼굴과 이름뿐.
 */
import { STAT_NAME, josa } from '../../realm/data/prose.ts'
import { GRADE_COLOR, GRADE_NAME, TRAIT } from '../../realm/data/traits.ts'
import { armyOfHero, isRuler } from '../../realm/heroes.ts'
import type { Hero, Realm } from '../../realm/types.ts'
import { radarSvg } from './radar.ts'

const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/** 육각형 꼭짓점 순서 — STAT_NAME 의 순서 */
const AXES = ['mu', 'tong', 'ryak', 'chi', 'deok', 'uiri'] as const

/** 우리 장수는 금빛, 남의 장수는 붉은빛 */
export function heroRadar(h: Hero, seen: boolean, ours: boolean, size = 190): string {
  const axes = AXES.map((k) => ({ label: STAT_NAME[k], value: seen ? ((h as unknown as Record<string, number>)[k] ?? null) : null }))
  return radarSvg(axes, ours ? '#d9b36a' : '#e07a5f', size)
}

/** 특성 칩 — 등급의 오방색 테 · 나쁜 것은 붉게 · 누르면 한 줄이 펼쳐진다(title) */
export function traitChips(h: Hero, seen: boolean): string {
  if (!seen) return '<span class="mute">특성은 아직 모른다</span>'
  const ts = h.traits ?? []
  if (ts.length === 0) return '<span class="mute">특성 없음</span>'
  return ts.map((id) => {
    const t = TRAIT[id]
    if (t === undefined) return ''
    return `<span class="trait${t.bad === true ? ' bad' : ''}" style="--g:${GRADE_COLOR[t.grade]}" title="${esc(t.line)}"><b>${esc(t.name)}</b><i>${GRADE_NAME[t.grade]}</i></span>`
  }).join('')
}

/** 특성 설명 줄 — 카드 안에서 칩 밑에 */
export function traitLines(h: Hero, seen: boolean): string {
  if (!seen) return ''
  return (h.traits ?? []).map((id) => TRAIT[id]).filter((t) => t !== undefined)
    .map((t) => `<p class="tline${t!.bad === true ? ' bad' : ''}"><b>${esc(t!.name)}</b> ${esc(t!.line)}</p>`).join('')
}

/** 지금 하는 일 한 줄 */
export function roleLine(r: Realm, h: Hero): string {
  const node = (id: string | null | undefined): string => (id != null ? (r.nodes[id]?.name ?? '?') : '?')
  if (h.status === 'dead') return '죽었다'
  if (h.status === 'captive') return `${r.factions[h.captor ?? '']?.name ?? '?'}에 사로잡혀 있다${h.persuade ? ` · 회유 중 (${h.persuade.left}계절 남음)` : ''}`
  if (isRuler(r, h.id)) return `군주 · ${node(h.at)}에 있다`
  const hurt = h.woundedUntil !== undefined && h.woundedUntil > r.season ? ` · 다쳐 누웠다 (${h.woundedUntil - r.season}계절)` : ''
  const a = armyOfHero(r, h.id)
  if (a !== null) {
    let n = 0
    for (const v of Object.values(a.mix)) n += v ?? 0
    return a.march !== null ? `군사 ${n}명을 이끌고 ${josa(node(a.march.to), '으로', '로')} 가는 중${hurt}` : `군사 ${n}명을 이끈다 · ${node(a.at)}${hurt}`
  }
  if (h.post != null) return `${josa(node(h.post), '을', '를')} 맡았다${hurt}`
  return `${node(h.at)}에서 쉰다${hurt}`
}

export const HERO_CSS = `
.ap .hrow { display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px; margin: 6px 0; border-radius: 12px; border: 1px solid var(--line);
  background: var(--card); color: var(--ink); font: inherit; text-align: left; cursor: pointer; box-sizing: border-box; }
.ap .hrow .face { width: 52px; height: 52px; } .ap .hrow .hb { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.ap .hrow .hb .mute { white-space: normal; } .ap .hrow .tr3 { display: flex; flex-wrap: wrap; gap: 3px; }
.ap .hrow.ruler { border-color: #8a7040; background: #262116; }
.ap .trait { display: inline-flex; align-items: baseline; gap: 3px; padding: 1px 7px; border-radius: 10px; border: 1.5px solid var(--g); background: #14181e;
  font-size: 12px; white-space: nowrap; } .ap .trait i { font-style: normal; font-size: 10px; color: var(--mute); }
.ap .trait.bad { border-style: dashed; color: #f1b8a8; }
.ap .hcard { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 4px; }
.ap .hcard img.big { width: 150px; height: 150px; border-radius: 16px; object-fit: cover; border: 2px solid #6a5a3a; }
.ap .hcard .hn { font-size: 20px; color: var(--gold); font-family: 'Gowun Batang', serif; }
.ap .hcard .radar { margin: 2px auto; }
.ap .tline { text-align: left; font-size: 13.5px; margin: 3px 0; color: #d8d0c0; } .ap .tline.bad { color: #f1b8a8; }
.ap .hacts { display: flex; flex-direction: column; gap: 6px; width: 100%; margin-top: 8px; }
`
