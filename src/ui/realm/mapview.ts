/**
 * 그린 지도 — 글자 지도 위에 얹는 한 장 (docs/realm/SYSTEMS §13 · ART ⑩⑪ · 형: "파인다이닝식으로 담는다")
 *
 * 계절마다 같은 땅의 네 철 그림이 바탕이고, 그 위에 길(SVG)·고을 기호·우리 군대·고른 출정 화살을 얹는다.
 * **땅은 다 보이고 군세는 아는 만큼** (정보의 계약, 2026-10-18 고침): 고을·길·주인은 다 그린다. 남의 군세는 우리 intel 에 있는 만큼만.
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

/**
 * 지도는 제 상자의 **높이를 꽉 채운다** — 폰 세로에서는 지도가 화면보다 넓어져 옆으로 밀어 본다 (앱 화면, FLOW §5).
 * 글씨·기호 크기는 지도 높이(cqh)를 따른다.
 */
export const MAP_CSS = `
.map { position: relative; height: 100%; aspect-ratio: ${W} / ${H}; margin: 0 auto; background: #2a261f center / cover no-repeat;
  user-select: none; -webkit-user-select: none; container-type: size; }
.map svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.map .nd { position: absolute; transform: translate(-50%, -62%); width: 8.5%; text-align: center; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.map .nd img.st { width: 100%; filter: drop-shadow(0 2px 2px rgba(0,0,0,.55)); }
.map .nd .nm { display: block; margin-top: -8%; font-size: max(10px, 2.1cqh); line-height: 1.2; color: #2a1d10; font-weight: 700;
  text-shadow: 0 0 3px #f3e6c8, 0 0 3px #f3e6c8, 0 0 2px #f3e6c8; white-space: nowrap; }
.map .nd .ring { position: absolute; left: 50%; top: 42%; width: 82%; aspect-ratio: 1; transform: translate(-50%, -50%);
  border-radius: 50%; border: 3px solid var(--c); box-shadow: 0 0 6px var(--c); pointer-events: none; }
.map .nd .men, .map .nd .foe { position: absolute; right: -10%; top: -6%; background: #1c2129; border-radius: 9px; padding: 0 5px;
  font-size: max(10px, 1.9cqh); font-weight: 700; }
.map .nd .men { color: #9fd18b; border: 1px solid #9fd18b; } .map .nd .foe { color: #e8a08a; border: 1px solid #8a5a3a; }
.map .nd .flag { position: absolute; left: -18%; top: -34%; width: 52%; aspect-ratio: 1.15; pointer-events: none; }
.map .nd .flag::before { content: ''; position: absolute; left: 0; top: 0; width: 7%; height: 150%; background: #3a2a18; border-radius: 2px; }
.map .nd .flag::after { content: ''; position: absolute; left: 7%; top: 0; right: 0; height: 100%; background: var(--c);
  clip-path: polygon(0 0, 100% 0, 82% 50%, 100% 100%, 0 100%); box-shadow: inset 0 0 0 2px #0003; }
.map .nd .flag img { position: absolute; left: 12%; top: 8%; width: 66%; height: 84%; object-fit: contain; z-index: 1;
  filter: drop-shadow(0 0 1px #fff) drop-shadow(0 0 1px #fff); }
.map .nd .flag.me::after { box-shadow: inset 0 0 0 2px #fff8; }
.map .nd.dim { opacity: .38; }
.map .nd.sel .nm { color: #7a1f10; } .map .nd.sel img.st { filter: drop-shadow(0 0 7px #ffd27a) drop-shadow(0 0 3px #ffd27a); }
`

export interface MapMarch {
  readonly from: string
  readonly to: string
  /** 이미 길 위에 있으면 남은 계절, 이번에 고른 것이면 null */
  readonly left: number | null
  /** 남의 군대 (보인 행군) */
  readonly foe?: boolean
}

const px = (id: string): [number, number] => {
  const p = NODE_POS[id] ?? [0.5, 0.5]
  return [p[0] * W, p[1] * H]
}

/** 땅빛 — 고을 하나가 물들이는 둘레 (지도 좌표) · 같은 나라 고을 사이 띠의 굵기 */
const TERRITORY_R = 150
const TERRITORY_BAND = 90

/**
 * 지도 한 장 — `me` 의 눈으로. `marches` 는 길 위의 우리 군대와 이번 계절 고른 출정.
 * 땅은 주인 색으로 물든다 (형: "어느나라가 어디 먹는지 한방에 국기와 함께"). `focus` 나라를 고르면 그 나라 땅만 또렷하다.
 */
export function mapHtml(r: Realm, me: string, art: string, marches: readonly MapMarch[], selected: string, focus: string | null = null): string {
  const known = r.intel[me] ?? {}
  const season = seasonOf(r.season)
  // 땅과 주인은 누구나 안다 (형: "어느나라가 어디 먹는지 한방에" — 2026-10-18). 모르는 것은 군세뿐이다
  const seen = (id: string): boolean => r.nodes[id] !== undefined
  const dim = (owner: string | null): boolean => focus !== null && owner !== focus

  let svg = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">`
  svg += `<defs><marker id="rm-ah" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">`
  svg += `<path d="M0 0L10 5L0 10z" fill="#c8402a"/></marker>`
  svg += `<marker id="rm-ah-foe" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">`
  svg += `<path d="M0 0L10 5L0 10z" fill="#3a2a5a"/></marker>`
  for (const [f, a] of Object.entries(FACTION_ART).sort((x, y) => (x[0] < y[0] ? -1 : 1))) {
    svg += `<radialGradient id="rm-t-${f}"><stop offset="0" stop-color="${a.color}" stop-opacity=".72"/>`
    svg += `<stop offset=".65" stop-color="${a.color}" stop-opacity=".45"/><stop offset="1" stop-color="${a.color}" stop-opacity="0"/></radialGradient>`
  }
  svg += `</defs><g class="terr">`
  // 땅빛 — 같은 나라 고을끼리 띠로 잇고, 고을마다 둥글게 번진다
  for (const ed of Object.values(r.edges).sort((x, y) => (x.id < y.id ? -1 : 1))) {
    const oa = r.nodes[ed.a]?.owner
    if (oa === null || oa === undefined || oa !== r.nodes[ed.b]?.owner || !seen(ed.a) || !seen(ed.b) || ed.kind === 'sea') continue
    const [x1, y1] = px(ed.a)
    const [x2, y2] = px(ed.b)
    const c = FACTION_ART[oa]?.color ?? '#ccc'
    svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="${TERRITORY_BAND}" stroke-linecap="round" opacity="${dim(oa) ? 0.06 : focus === oa ? 0.42 : 0.24}"/>`
  }
  for (const n of Object.values(r.nodes).sort((x, y) => (x.id < y.id ? -1 : 1))) {
    if (n.owner === null || !seen(n.id) || FACTION_ART[n.owner] === undefined) continue
    const [x, y] = px(n.id)
    svg += `<circle cx="${x}" cy="${y}" r="${TERRITORY_R}" fill="url(#rm-t-${n.owner})" opacity="${dim(n.owner) ? 0.15 : 1}"/>`
  }
  svg += `</g>`
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
    const col = m.foe === true ? '#3a2a5a' : '#c8402a'
    const head = m.foe === true ? 'rm-ah-foe' : 'rm-ah'
    svg += `<line x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}" stroke="${col}" stroke-width="9"${dash} marker-end="url(#${head})" opacity=".9"/>`
    if (m.left !== null) {
      svg += `<text x="${(sx + ex) / 2}" y="${(sy + ey) / 2 - 12}" font-size="26" font-weight="700" fill="${m.foe === true ? '#3a2a5a' : '#7a1f10'}" stroke="#f3e6c8" stroke-width="5" paint-order="stroke" text-anchor="middle">${m.foe === true ? '적 ' : ''}${m.left}계절</text>`
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
    const fa = owner !== null ? FACTION_ART[owner] : undefined
    const flag = fa !== undefined ? `<span class="flag${ours ? ' me' : ''}"><img src="${art}icon/${fa.emblem}.png" alt=""></span>` : ''
    nodes += `<div class="nd${selected === n.id ? ' sel' : ''}${dim(owner) ? ' dim' : ''}" data-node="${n.id}" style="left:${p[0] * 100}%;top:${p[1] * 100}%;--c:${color}" title="${n.name} · ${NODE_KIND_NAME[n.kind]} · ${who}">`
    nodes += `<span class="ring"></span><img class="st" src="${art}icon/${nodeIcon(n)}.png" alt="">${flag}${badge}<span class="nm">${n.name}</span></div>`
  }
  return `<div class="map" style="background-image:url('${art}map/${SEASON_MAP[season]}.jpg')">${svg}${nodes}</div>`
}
