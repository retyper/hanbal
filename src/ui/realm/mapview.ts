/**
 * 그린 지도 — 글자 지도 위에 얹는 한 장 (docs/realm/SYSTEMS §13 · ART ⑩⑪ · 형: "파인다이닝식으로 담는다")
 *
 * 계절마다 같은 땅의 네 철 그림이 바탕이고, 그 위에 길(SVG)·고을 기호·우리 군대·고른 출정 화살을 얹는다.
 * **아는 만큼만 그린다** (정보의 계약): 우리 intel 에 없는 고을과 그 길은 아예 안 나온다.
 * 상태를 읽기만 하고 HTML 문자열을 돌려준다 — 고르는 손짓(고을 누르기)은 글자 지도가 data-node 로 받는다.
 * 자리·그림 이름은 realm/data/art.ts.
 */
import { headcount } from '../../realm/battle.ts'
import { FACTION_ART, NODE_POS, SEASON_MAP, nodeIcon } from '../../realm/data/art.ts'
import { EDGE_NAME, NODE_KIND_NAME } from '../../realm/data/prose.ts'
import { visibleRange } from '../../realm/intel.ts'
import { blockedWhy, forceOf, seasonOf } from '../../realm/season.ts'
import type { EdgeKind, Realm } from '../../realm/types.ts'

/** 지도 바탕의 크기 (map/*.jpg) — SVG 의 좌표계 */
const W = 1264
const H = 848

/** 길 종류의 선 — 색 · 굵기 · 점선 */
const EDGE_STYLE: Readonly<Record<EdgeKind, string>> = {
  field: 'stroke="#6b4a2a" stroke-width="5"',
  pass: 'stroke="#4a3a2e" stroke-width="5" stroke-dasharray="3 9" stroke-linecap="round"',
  forest: 'stroke="#3d5a2c" stroke-width="5" stroke-dasharray="14 7"',
  reeds: 'stroke="#7a7a3a" stroke-width="5" stroke-dasharray="10 6"',
  ford: 'stroke="#3d7fa8" stroke-width="6" stroke-dasharray="16 6"',
  sea: 'stroke="#2f6e9a" stroke-width="4" stroke-dasharray="6 10" stroke-linecap="round"',
  mudflat: 'stroke="#7d7466" stroke-width="5" stroke-dasharray="2 8" stroke-linecap="round"',
}

export const MAP_CSS = `
.rm .map { position: relative; width: 100%; aspect-ratio: ${W} / ${H}; background: #2a261f center / cover no-repeat;
  border-radius: 8px; border: 1px solid #4a5260; overflow: hidden; margin: 10px 0 4px; user-select: none; }
.rm .map svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.rm .map .nd { position: absolute; transform: translate(-50%, -62%); width: 8.5%; text-align: center; cursor: pointer; }
.rm .map .nd img.st { width: 100%; filter: drop-shadow(0 2px 2px rgba(0,0,0,.55)); }
.rm .map .nd .nm { display: block; margin-top: -8%; font-size: clamp(9px, 1.25vw, 12px); line-height: 1.2; color: #2a1d10; font-weight: 700;
  text-shadow: 0 0 3px #f3e6c8, 0 0 3px #f3e6c8, 0 0 2px #f3e6c8; white-space: nowrap; }
.rm .map .nd .ring { position: absolute; left: 50%; top: 42%; width: 82%; aspect-ratio: 1; transform: translate(-50%, -50%);
  border-radius: 50%; border: 3px solid var(--c); box-shadow: 0 0 6px var(--c); pointer-events: none; }
.rm .map .nd .men { position: absolute; right: -8%; top: -6%; background: #1c2129; color: #9fd18b; border: 1px solid #9fd18b;
  border-radius: 9px; padding: 0 5px; font-size: clamp(9px, 1.2vw, 12px); }
.rm .map .nd .foe { position: absolute; right: -10%; top: -6%; background: #1c2129; color: #e8a08a; border: 1px solid #8a5a3a;
  border-radius: 9px; padding: 0 5px; font-size: clamp(9px, 1.1vw, 11px); }
.rm .map .nd.sel .nm { color: #7a1f10; } .rm .map .nd.sel img.st { filter: drop-shadow(0 0 6px #ffd27a); }
.rm .maplegend { font-size: 12px; color: #9a9284; }
`

export interface MapMarch {
  readonly from: string
  readonly to: string
  /** 이미 길 위에 있으면 남은 계절, 이번에 고른 것이면 null */
  readonly left: number | null
}

const px = (id: string): [number, number] => {
  const p = NODE_POS[id] ?? [0.5, 0.5]
  return [p[0] * W, p[1] * H]
}

/** 지도 한 장 — `me` 의 눈으로. `marches` 는 길 위의 우리 군대와 이번 계절 고른 출정 */
export function mapHtml(r: Realm, me: string, art: string, marches: readonly MapMarch[], selected: string): string {
  const known = r.intel[me] ?? {}
  const season = seasonOf(r.season)
  const seen = (id: string): boolean => r.nodes[id]?.owner === me || known[id] !== undefined

  let svg = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">`
  svg += `<defs><marker id="rm-ah" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">`
  svg += `<path d="M0 0L10 5L0 10z" fill="#c8402a"/></marker></defs>`
  for (const ed of Object.values(r.edges).sort((x, y) => (x.id < y.id ? -1 : 1))) {
    if (!seen(ed.a) || !seen(ed.b)) continue
    const [x1, y1] = px(ed.a)
    const [x2, y2] = px(ed.b)
    const shut = blockedWhy(ed, season) !== null
    svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${EDGE_STYLE[ed.kind]} opacity="${shut ? 0.25 : 0.8}"><title>${EDGE_NAME[ed.kind]}</title></line>`
    if (shut) {
      const [mx, my] = [(x1 + x2) / 2, (y1 + y2) / 2]
      svg += `<path d="M${mx - 12} ${my - 12}L${mx + 12} ${my + 12}M${mx + 12} ${my - 12}L${mx - 12} ${my + 12}" stroke="#a02a1a" stroke-width="6" stroke-linecap="round"/>`
    }
  }
  // 출정 화살 — 고른 것은 굵은 실선, 길 위의 것은 점선 + 남은 계절
  for (const m of marches) {
    const [x1, y1] = px(m.from)
    const [x2, y2] = px(m.to)
    const k = 0.78 // 고을 기호에 안 묻히게 끝을 당긴다
    const ex = x1 + (x2 - x1) * k
    const ey = y1 + (y2 - y1) * k
    const sx = x1 + (x2 - x1) * (1 - k)
    const sy = y1 + (y2 - y1) * (1 - k)
    const dash = m.left === null ? '' : ' stroke-dasharray="14 8"'
    svg += `<line x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}" stroke="#c8402a" stroke-width="9"${dash} marker-end="url(#rm-ah)" opacity=".9"/>`
    if (m.left !== null) {
      svg += `<text x="${(sx + ex) / 2}" y="${(sy + ey) / 2 - 12}" font-size="26" font-weight="700" fill="#7a1f10" stroke="#f3e6c8" stroke-width="5" paint-order="stroke" text-anchor="middle">${m.left}계절</text>`
    }
  }
  svg += `</svg>`

  let nodes = ''
  for (const n of Object.values(r.nodes).sort((x, y) => (x.id < y.id ? -1 : 1))) {
    if (!seen(n.id)) continue
    const p = NODE_POS[n.id]
    if (p === undefined) continue
    const owner = n.owner
    const color = owner !== null ? (FACTION_ART[owner]?.color ?? '#ccc') : '#d9d2c0'
    const ours = owner === me
    let badge = ''
    if (ours) {
      const men = Object.values(r.armies).filter((a) => a.at === n.id && a.faction === me && a.march === null)
        .reduce((s, a) => s + headcount(forceOf(r, a)), 0)
      if (men > 0) badge = `<span class="men">${men}</span>`
    } else {
      const f = known[n.id]?.force
      if (f) {
        const v = visibleRange({ f0: f.f0, src: f.src, u: f.u }, r.season - f.season)
        badge = `<span class="foe">${v === null ? '?' : `${Math.round(v[0])}~${Math.round(v[1])}`}</span>`
      } else if (owner !== null && n.kind !== 'sodo') badge = `<span class="foe">?</span>`
    }
    const who = owner === null ? '주인 없음' : (r.factions[owner]?.name ?? '?')
    nodes += `<div class="nd${selected === n.id ? ' sel' : ''}" data-node="${n.id}" style="left:${p[0] * 100}%;top:${p[1] * 100}%;--c:${color}" title="${n.name} · ${NODE_KIND_NAME[n.kind]} · ${who}">`
    nodes += `<span class="ring"></span><img class="st" src="${art}icon/${nodeIcon(n)}.png" alt="">${badge}<span class="nm">${n.name}</span></div>`
  }
  return `<div class="map" style="background-image:url('${art}map/${SEASON_MAP[season]}.jpg')">${svg}${nodes}</div>`
    + `<div class="maplegend">테두리 색 = 주인 · 초록 수 = 우리 병력 · 붉은 수 = 정찰로 본 적 군세 (?는 못 봤다) · ✕ = 이번 계절 막힌 길 · 고을을 누르면 정찰할 곳으로 고른다</div>`
}
