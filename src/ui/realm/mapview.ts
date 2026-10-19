/**
 * 그린 지도 — 글자 지도 위에 얹는 한 장 (docs/realm/SYSTEMS §13 · ART ⑩⑪ · 형: "파인다이닝식으로 담는다")
 *
 * 계절마다 같은 땅의 네 철 그림이 바탕이고, 그 위에 길(SVG)·고을 기호·우리 군대·고른 출정 화살을 얹는다.
 * **땅은 다 보이고 군세는 아는 만큼** (정보의 계약, 2026-10-18 고침): 고을·길·주인은 다 그린다. 남의 군세는 우리 intel 에 있는 만큼만.
 * 상태를 읽기만 하고 HTML 문자열을 돌려준다 — 고르는 손짓(고을 누르기)은 글자 지도가 data-node 로 받는다.
 * 자리·그림 이름은 realm/data/art.ts.
 */
import { headcount } from '../../realm/battle.ts'
import { FACTION_ART, REGION_ART, SEASON_MAP, nodeIcon, nodePos } from '../../realm/data/art.ts'
import { EDGE_NAME, NODE_KIND_NAME, NODE_NOW } from '../../realm/data/prose.ts'
import { worldGeoOf } from '../../realm/data/regions/index.ts'
import { knows } from '../../realm/discovery.ts'
import { visibleRange } from '../../realm/intel.ts'
import { blockedWhy, forceOf, seasonOf } from '../../realm/season.ts'
import type { EdgeKind, NodeKind, Realm, REdge, RegionId } from '../../realm/types.ts'
import { separatedRoutes, ferryAt, landClipSvg, midOf, polyPath, provinceCells, riversSvg, routePoints, smoothPath, trimPolyline, type Pt } from './mapgeo.ts'
import { worldMapUrl } from './worldmap.ts'

/** 변한 판 지도 바탕의 크기 (map/*.jpg) — CSS 의 기본 비율. 판마다의 크기는 REGION_ART (영남 판 1024×765) */
const W = REGION_ART['byeonhan-mini'].w
const H = REGION_ART['byeonhan-mini'].h

/** 길 종류의 선 — 색 · 굵기 · 점선 */
export const EDGE_STYLE: Readonly<Record<EdgeKind, string>> = {
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
.map .nd { position: absolute; transform: translate(-50%, -62%); width: calc(8.5% * var(--s, 1) * var(--ns, 1)); text-align: center; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.map .nd img.st { width: 100%; filter: drop-shadow(0 2px 2px rgba(0,0,0,.55)); }
.map .lbs { position: absolute; inset: 0; z-index: 5; pointer-events: none; }
.map .lb { position: absolute; transform: translateX(-50%); text-align: center; white-space: nowrap; display: block; font-size: clamp(10px, calc(2.1cqh / var(--z, 1) * var(--zs, 1) * var(--ls, 1)), 17px); line-height: 1.2; color: #2a1d10; font-weight: 700;
  text-shadow: 0 0 3px #f3e6c8, 0 0 3px #f3e6c8, 0 0 2px #f3e6c8; background: #f3e6c899; border-radius: 4px; padding: 0 3px; }
.map .lb .star { font-style: normal; color: #b8860b; margin-right: 2px; text-shadow: 0 0 2px #fff8d0, 0 0 3px #fff8d0; } /* 도읍 (형: "수도같은건 별표해야하지 않나?") */
.map .lb small { display: block; font-size: .78em; font-weight: 500; color: #4a3a28; margin-top: -1px; }
.map .nd .ring { position: absolute; left: 50%; top: 42%; width: 82%; aspect-ratio: 1; transform: translate(-50%, -50%);
  border-radius: 50%; border: 3px solid var(--c); box-shadow: 0 0 6px var(--c); pointer-events: none; }
.map .nd .men, .map .nd .foe { position: absolute; left: 86%; top: 42%; transform: translateY(-50%); background: #1c2129; border-radius: 9px; padding: 0 5px;
  font-size: clamp(10px, calc(1.9cqh / var(--z, 1) * var(--zs, 1) * var(--ls, 1)), 15px); font-weight: 700; white-space: nowrap; }
.map .nd .men { color: #9fd18b; border: 1px solid #9fd18b; } .map .nd .foe { color: #e8a08a; border: 1px solid #8a5a3a; }
.map .nd .foe.old { opacity: .6; border-style: dashed; } .map .nd.tgt .foe { display: none; }
.map .nd .flag { position: absolute; left: -18%; top: -34%; width: 52%; aspect-ratio: 1.15; pointer-events: none; }
.map .nd .flag::before { content: ''; position: absolute; left: 0; top: 0; width: 7%; height: 150%; background: #3a2a18; border-radius: 2px; }
.map .nd .flag::after { content: ''; position: absolute; left: 7%; top: 0; right: 0; height: 100%; background: var(--c);
  clip-path: polygon(0 0, 100% 0, 82% 50%, 100% 100%, 0 100%); box-shadow: inset 0 0 0 2px #0003; }
.map .nd .flag img { position: absolute; left: 12%; top: 8%; width: 66%; height: 84%; object-fit: contain; z-index: 1;
  filter: drop-shadow(0 0 1px #fff) drop-shadow(0 0 1px #fff); }
.map .nd .flag.me::after { box-shadow: inset 0 0 0 2px #fff8; }
.map .nd.dim { opacity: .38; }
.map .nd.tgt .ring { border: 3px dashed #ffd27a; box-shadow: 0 0 10px #ffd27a; animation: tgt 1.4s ease-in-out infinite alternate; }
.map .nd.tgt.on .ring { border-style: solid; border-color: #c8402a; box-shadow: 0 0 12px #c8402a; animation: none; }
.map .nd.tgt.off { opacity: .45; } .map .nd.tgt.off .ring { border-color: #777; box-shadow: none; animation: none; }
@keyframes tgt { from { opacity: .55; } to { opacity: 1; } }
.map .nd .tchip { position: absolute; left: 50%; bottom: 100%; transform: translate(-50%, -2px); white-space: nowrap; pointer-events: none; z-index: 3; }
.map .nd .tchip .tn.hide { margin-left: 3px; background: #2a3a24e8; color: #c8e8a8; }
.map .nd .tchip .feel { font-size: clamp(10px, calc(1.8cqh / var(--z, 1) * var(--zs, 1)), 14px); padding: 1px 6px; }
.map .nd .tchip .tn.stay { background: #2a3a24e8; color: #c8e8a8; }
.map .nd .tchip .tn { background: #1c2129e8; color: #f3e6c8; border-radius: 9px; padding: 1px 7px; font-size: clamp(10px, calc(1.8cqh / var(--z, 1) * var(--zs, 1)), 14px); font-weight: 700; }
.map .toks { position: absolute; transform: translate(2px, -50%); display: flex; gap: 3px; z-index: 4; pointer-events: none; }
.map .tok { pointer-events: auto; display: flex; flex-direction: column; align-items: center; padding: 0; border: 0; background: none; cursor: pointer;
  -webkit-tap-highlight-color: transparent; width: clamp(26px, calc(4.2cqh / var(--z, 1) * var(--zs, 1) * var(--ls, 1)), 46px); }
.map .tok img { width: 100%; aspect-ratio: 1; border-radius: 50%; object-fit: cover; border: 2px solid #9fd18b; background: #1c2129; box-shadow: 0 2px 4px #0008; }
.map .tok b { margin-top: -6px; background: #1c2129; color: #9fd18b; border: 1px solid #9fd18b; border-radius: 8px; padding: 0 4px;
  font-size: clamp(10px, calc(1.6cqh / var(--z, 1) * var(--zs, 1)), 13px); line-height: 1.3; }
.map .tok.sel img { border-color: #ffd27a; box-shadow: 0 0 0 3px #ffd27a88, 0 0 12px #ffd27a; transform: scale(1.12); }
.map .tok.going img { border-color: #c8402a; }
.map .toks.mv { transform: translate(-50%, -50%); } .map .toks.mv .tok img { border-style: dashed; border-color: #f3e6c8; }
.map .lb.sel { color: #7a1f10; } .map .lb.dim { opacity: .38; } .map .nd.sel img.st { filter: drop-shadow(0 0 7px #ffd27a) drop-shadow(0 0 3px #ffd27a); }
.map[data-world] { background-color: #cdb98e; }
.map .nd.fresh, .map .lb.fresh, .map svg .fresh { animation: rv 2.2s ease-out both; }
@keyframes rv { from { opacity: 0; } to { opacity: 1; } }
.map .fogc { position: absolute; z-index: 1; transform: translate(-50%, -50%); pointer-events: none; opacity: .5; mix-blend-mode: multiply;
  animation: fogdrift var(--d, 40s) ease-in-out infinite alternate; }
@keyframes fogdrift { from { transform: translate(-50%, -50%); } to { transform: translate(-38%, -54%); } }
.map .rumor { position: absolute; z-index: 2; transform: translate(-50%, -50%); pointer-events: none; text-align: center; white-space: nowrap;
  font-family: 'Gowun Batang', serif; color: #3d2e1ccc; font-weight: 700; font-size: clamp(10px, calc(2.1cqh / var(--z, 1) * var(--zs, 1) * var(--ls, 1)), 17px); }
.map .rumor i { display: block; margin: 0 auto 2px; width: 1.6em; height: 1.1em; border-radius: 48% 52% 45% 55%;
  background: radial-gradient(ellipse at 45% 50%, #2a1d10cc 0, #2a1d1088 45%, #2a1d1000 72%); }
.map .rumor small { display: block; font-size: .7em; font-weight: 500; opacity: .8; }
@media (prefers-reduced-motion: reduce) { .map .fogc { animation: none; } }
`

export interface MapMarch {
  readonly from: string
  readonly to: string
  /** 이미 길 위에 있으면 남은 계절, 이번에 고른 것이면 null */
  readonly left: number | null
  /** 남의 군대 (보인 행군) */
  readonly foe?: boolean
  /** 기습으로 들어간다 — 어두운 점선 · "기습" 글씨 */
  readonly ambush?: boolean
}

/**
 * 고을 그림의 크기 — 집이 많을수록 크다 (형: "규모를 이해하기 쉽게"). 빈땅·작은 마을 0.8 ~ 큰 도읍 1.35.
 * 화면의 생김새라 params 가 아니라 여기 둔다.
 */
/** 본 군세의 폭 — 같으면 한 수 */
const span = (lo: number, hi: number): string => (Math.round(lo) === Math.round(hi) ? `${Math.round(lo)}` : `${Math.round(lo)}~${Math.round(hi)}`)
const sizeOf = (hh: number): number => Math.min(1.35, Math.max(0.8, 0.7 + hh / 900))


/**
 * 지도 한 장 — `me` 의 눈으로. `marches` 는 길 위의 우리 군대와 이번 계절 고른 출정.
 * 땅은 주인 색으로 물든다 (형: "어느나라가 어디 먹는지 한방에 국기와 함께"). `focus` 나라를 고르면 그 나라 땅만 또렷하다.
 */
export function mapHtml(
  r: Realm, me: string, art: string, marches: readonly MapMarch[], selected: string, focus: string | null = null,
  tokens: readonly MapToken[] = [], targets: readonly MapTarget[] = [], fresh: ReadonlySet<string> = new Set(),
): string {
  // 판마다 지도 그림·좌표계·기호 크기 (영남 판은 고을이 빽빽해 작게)
  const region = r.region ?? 'byeonhan-mini'
  const RA = REGION_ART[region]
  const W = RA.w
  const H = RA.h
  const pos = (id: string): readonly [number, number] | undefined => nodePos(region, id)
  const px = (id: string): [number, number] => {
    const p = pos(id) ?? [0.5, 0.5]
    return [p[0] * W, p[1] * H]
  }
  /** 땅빛 — 고을 하나가 물들이는 둘레 (지도 좌표) · 같은 나라 고을 사이 띠의 굵기 */
  const TERRITORY_R = RA.terrR
  const TERRITORY_BAND = RA.terrBand
  /** 화살·글씨 굵기 — 작은 기호에 맞춘다 */
  const lw = RA.nodeScale < 1 ? 0.65 : 1
  const target = new Map(targets.map((t) => [t.node, t]))
  const hasTok = new Set(tokens.filter((t) => t.march === undefined).map((t) => t.node))
  const known = r.intel[me] ?? {}
  const season = seasonOf(r.season)
  // 아는 나라의 땅과 주인은 다 안다 (형: "어느나라가 어디 먹는지 한방에" — 2026-10-18). 모르는 것은 군세,
  // 그리고 넓어지는 지도에서는 아직 모르는 나라 (발견 — 그 땅은 '모르는 땅'으로 덮는다)
  const vis = visibleNodes(r, me)
  const seen = (id: string): boolean => vis.has(id)
  const isFresh = (id: string): boolean => {
    const o = r.nodes[id]?.owner
    return o !== null && o !== undefined && fresh.has(o)
  }
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
  const cellsOn = region === 'yeongnam' || worldGeoOf(region) !== null
  // 두 끝을 다 본 길은 그 길을 따라 띠로 밝다 (누가 걸어 본 길)
  const corridors = r.known === undefined ? [] : Object.values(r.edges).sort((x, y) => (x.id < y.id ? -1 : 1))
    .filter((ed) => seen(ed.a) && seen(ed.b))
    .map((ed) => smoothPath(routePoints(region, ed, px(ed.a), px(ed.b), W, H)))
  const fog = r.known !== undefined ? fogSvg(r, me, region, W, H, TERRITORY_R, vis, isFresh, corridors, art) : null
  svg += `${landClipSvg(region, W, H)}${fog?.defs ?? ''}</defs>`
  if (cellsOn) svg += provincesSvg(r, region, W, H, TERRITORY_R, dim, focus, seen)
  else svg += `<g class="terr">`
  // 땅빛 (변한 판) — 같은 나라 고을끼리 띠로 잇고, 고을마다 둥글게 번진다
  if (!cellsOn) for (const ed of Object.values(r.edges).sort((x, y) => (x.id < y.id ? -1 : 1))) {
    const oa = r.nodes[ed.a]?.owner
    if (oa === null || oa === undefined || oa !== r.nodes[ed.b]?.owner || !seen(ed.a) || !seen(ed.b) || ed.kind === 'sea') continue
    const [x1, y1] = px(ed.a)
    const [x2, y2] = px(ed.b)
    const c = FACTION_ART[oa]?.color ?? '#ccc'
    svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="${TERRITORY_BAND}" stroke-linecap="round" opacity="${dim(oa) ? 0.06 : focus === oa ? 0.42 : 0.24}"/>`
  }
  if (!cellsOn) {
    for (const n of Object.values(r.nodes).sort((x, y) => (x.id < y.id ? -1 : 1))) {
      if (n.owner === null || !seen(n.id) || FACTION_ART[n.owner] === undefined) continue
      const [x, y] = px(n.id)
      svg += `<circle cx="${x}" cy="${y}" r="${TERRITORY_R}" fill="url(#rm-t-${n.owner})" opacity="${dim(n.owner) ? 0.15 : 1}"/>`
    }
    svg += `</g>`
  }
  // 강 — 또렷하게 (영남 판)
  svg += riversSvg(region, W, H)
  // 모르는 땅 — 강·땅빛 위, 길 밑 (아는 고을 사이의 길은 늘 보인다)
  svg += fog?.body ?? ''
  // 길 — 골짜기·바닷가를 따라 휜다 (형: "직선경로만 있는게 이상하지 않냐?"). 막힌 길은 흐리고 가운데 ✕
  const sw = RA.nodeScale < 1 ? 0.6 : 1
  // 같은 골짜기를 따라가는 길이 한 줄로 포개지지 않게 서로 밀어 둔다 (mapgeo.separatedRoutes — 판마다 한 번)
  const allEdges = Object.values(r.edges).sort((x, y) => (x.id < y.id ? -1 : 1))
  const sep = separatedRoutes(`${region}:${W}x${H}:${allEdges.length}`, allEdges.map((ed) => [ed.id, routePoints(region, ed, px(ed.a), px(ed.b), W, H)] as const), 12 * sw, RA.terrR * 0.4)
  const route = (ed: REdge): Pt[] => sep.get(ed.id) ?? routePoints(region, ed, px(ed.a), px(ed.b), W, H)
  for (const ed of Object.values(r.edges).sort((x, y) => (x.id < y.id ? -1 : 1))) {
    if (!seen(ed.a) || !seen(ed.b)) continue
    const pts = route(ed)
    const shut = blockedWhy(ed, season) !== null
    const style = EDGE_STYLE[ed.kind].replace(/stroke-width="(\d+)"/, (_, w: string) => `stroke-width="${(Number(w) * sw).toFixed(1)}"`)
    // 밑에 옅은 한지빛 테두리를 깔아 바탕과 떼어 본다 (형: "지도랑 색이 비슷해서 길 색이 잘 안보이는건")
    const d = smoothPath(pts)
    const w0 = Number(/stroke-width="([\d.]+)"/.exec(style)?.[1] ?? 5)
    svg += `<path d="${d}" fill="none" stroke="#f8eed6" stroke-width="${(w0 + 5 * sw).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round" opacity="${shut ? 0.2 : 0.8}"/>`
    svg += `<path d="${d}" fill="none" ${style} stroke-linejoin="round" opacity="${shut ? 0.3 : 0.95}"><title>${EDGE_NAME[ed.kind]}</title></path>`
    const fr = ed.kind === 'ford' ? ferryAt(region, ed, W, H) : null
    if (fr !== null) svg += ferrySvg(fr, sw)
    if (shut) {
      const [mx, my] = midOf(pts)
      const s = 12 * sw
      svg += `<path d="M${mx - s} ${my - s}L${mx + s} ${my + s}M${mx + s} ${my - s}L${mx - s} ${my + s}" stroke="#a02a1a" stroke-width="${6 * sw}" stroke-linecap="round"/>`
    }
  }
  // 출정 화살 — 그 길의 모양을 따라 간다. 고른 것은 굵은 실선, 길 위의 것은 점선 + 남은 계절
  const edgeOf = (a: string, b: string): REdge | undefined => Object.values(r.edges).find((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a))
  for (const m of marches) {
    if (!seen(m.from) || !seen(m.to)) continue
    const ed = edgeOf(m.from, m.to)
    let full: Pt[] = ed !== undefined ? route(ed) : [px(m.from), px(m.to)]
    if (ed !== undefined && ed.a !== m.from) full = full.slice().reverse()
    const k = 0.22 // 고을 기호에 안 묻히게 끝을 당긴다
    const pts = trimPolyline(full, k, 1 - k)
    // 기습은 밤길처럼 — 어두운 짧은 점선. 정면은 붉은 실선
    const amb = m.ambush === true && m.foe !== true
    const dash = amb ? ' stroke-dasharray="2 14" stroke-linecap="round"' : m.left === null ? '' : ' stroke-dasharray="14 8"'
    const col = m.foe === true || amb ? '#3a2a5a' : '#c8402a'
    const head = m.foe === true || amb ? 'rm-ah-foe' : 'rm-ah'
    svg += `<path d="${smoothPath(pts)}" fill="none" stroke="${col}" stroke-width="${(amb ? 11 : 9) * lw}"${dash} marker-end="url(#${head})" opacity=".9"/>`
    const label = `${m.foe === true ? '적 ' : ''}${amb ? '기습' : ''}${m.left !== null ? `${amb ? ' ' : ''}${m.left}계절` : ''}`
    if (label !== '') {
      const [lx, ly] = midOf(pts)
      svg += `<text x="${lx}" y="${ly - 12}" font-size="${26 * lw}" font-weight="700" fill="${m.foe === true || amb ? '#3a2a5a' : '#7a1f10'}" stroke="#f3e6c8" stroke-width="5" paint-order="stroke" text-anchor="middle">${label}</text>`
    }
  }
  svg += `</svg>`

  let nodes = ''
  const labels: LabelIn[] = []
  for (const n of Object.values(r.nodes).sort((x, y) => (x.id < y.id ? -1 : 1))) {
    if (!seen(n.id)) continue
    const p = pos(n.id)
    if (p === undefined) continue
    const fr = isFresh(n.id) ? ' fresh' : ''
    const owner = n.owner
    const color = owner !== null ? (FACTION_ART[owner]?.color ?? '#ccc') : '#d9d2c0'
    const ours = owner === me
    let badge = ''
    if (ours && !hasTok.has(n.id)) {
      const men = Object.values(r.armies).filter((a) => a.at === n.id && a.faction === me && a.march === null)
        .reduce((s, a) => s + headcount(forceOf(r, a)), 0)
      if (men > 0) badge = `<span class="men">${men}</span>`
    } else {
      const f = known[n.id]?.force
      if (f) {
        const v = visibleRange({ f0: f.f0, src: f.src, u: f.u }, r.season - f.season)
        // 척후·첩자가 본 군세만 — 못 본 곳마다 ?를 흩뿌리지 않는다 (형: "빨간물음표들 위치가 너무 중구난방")
        if (v !== null) badge = `<span class="foe${r.season - f.season > 0 ? ' old' : ''}">${span(v[0], v[1])}</span>`
      }
    }
    const who = owner === null ? '주인 없음' : (r.factions[owner]?.name ?? '?')
    const fa = owner !== null ? FACTION_ART[owner] : undefined
    const flag = fa !== undefined ? `<span class="flag${ours ? ' me' : ''}"><img src="${art}icon/${fa.emblem}.png" alt=""></span>` : ''
    // 고른 군대가 갈 수 있는 곳 — 누르면 그리로 간다 (data-act="go")
    const tg = target.get(n.id)
    const go = tg !== undefined && !tg.off ? ` data-act="go" data-edge="${tg.edge}"` : ''
    const tcls = tg === undefined ? '' : tg.off ? ' tgt off' : tg.on ? ' tgt on' : ' tgt'
    labels.push({ id: n.id, name: n.name, now: NODE_NOW[n.id], x: p[0], y: p[1], s: sizeOf(n.hh), cap: n.kind === 'capital' || Object.values(r.factions).some((f) => f.capital === n.id), hh: n.hh, cls: `${selected === n.id ? ' sel' : ''}${dim(owner) && tg === undefined ? ' dim' : ''}${fr}` })
    nodes += `<div class="nd${selected === n.id ? ' sel' : ''}${dim(owner) && tg === undefined ? ' dim' : ''}${tcls}${fr}"${go} data-node="${n.id}" style="left:${p[0] * 100}%;top:${p[1] * 100}%;--c:${color};--s:${sizeOf(n.hh).toFixed(2)}" title="${n.name} · ${NODE_KIND_NAME[n.kind]} · ${who}">`
    nodes += `<span class="ring"></span><img class="st" src="${art}icon/${nodeIcon(n)}.png" alt="">${flag}${badge}${tg !== undefined ? `<span class="tchip">${tg.chip}</span>` : ''}</div>`
  }
  // 우리 군대의 말 — 고을 밑에 나란히. 누르면 고르고, 갈 곳이 지도에 밝아진다
  const byNode = new Map<string, MapToken[]>()
  for (const t of tokens) if (t.march === undefined) byNode.set(t.node, [...(byNode.get(t.node) ?? []), t])
  const tokBtn = (t: MapToken): string =>
    `<button class="tok${t.sel ? ' sel' : ''}${t.going ? ' going' : ''}" data-act="tok" data-army="${t.army}"><img src="${t.img}" alt=""><b>${t.men}</b></button>`
  let toks = ''
  // 길 위의 우리 군대 — 떠난 쪽에서 삼분의 일쯤 (가운데의 "n계절" 글씨를 안 가린다)
  for (const t of tokens) {
    if (t.march === undefined || !seen(t.march.from) || !seen(t.march.to)) continue
    const ed = edgeOf(t.march.from, t.march.to)
    let full: Pt[] = ed !== undefined ? route(ed) : [px(t.march.from), px(t.march.to)]
    if (ed !== undefined && ed.a !== t.march.from) full = full.slice().reverse()
    const [mx, my] = midOf(trimPolyline(full, 0.28, 0.4))
    toks += `<div class="toks mv" style="left:${(mx / W) * 100}%;top:${(my / H) * 100}%">${tokBtn(t)}</div>`
  }
  for (const [node, ts] of [...byNode].sort((x, y) => (x[0] < y[0] ? -1 : 1))) {
    const p = pos(node)
    if (p === undefined) continue
    toks += `<div class="toks" style="left:${(p[0] + ICON_W * RA.nodeScale * 0.5) * 100}%;top:${p[1] * 100}%">`
    for (const t of ts) toks += tokBtn(t)
    toks += `</div>`
  }
  // 넓어지는 지도는 조각을 이은 한 장에 계절 빛을 입힌다 (worldmap.ts — 다 되면 바탕을 갈아 끼운다)
  const world = worldGeoOf(region) !== null
  const bgUrl = world ? worldMapUrl(art, season, region) : `${art}${RA.dir}/${SEASON_MAP[season]}.${RA.ext}`
  const bg = bgUrl !== '' ? `background-image:url('${bgUrl}');` : ''
  // 밝혀진 땅의 테두리 (0~1) — 축소는 여기까지만 (zoom.ts · 형: "문명처럼 유저가 보이는 구역을 기반으로 최대 축소")
  const sp = [...vis].map((id) => pos(id)).filter((p): p is readonly [number, number] => p !== undefined)
  const seenBox = sp.length === 0 ? '0,0,1,1' : [Math.min(...sp.map((p) => p[0])), Math.min(...sp.map((p) => p[1])), Math.max(...sp.map((p) => p[0])), Math.max(...sp.map((p) => p[1]))].map((v) => v.toFixed(3)).join(',')
  return `<div class="map" data-seen="${seenBox}" data-region="${region}"${world ? ` data-world="${season}"` : ''} data-aspect="${W / H}" data-zmax="${RA.zmax}" style="${bg}aspect-ratio:${W} / ${H};--ns:${RA.nodeScale};--ls:${RA.labelScale}">${svg}${fog?.words ?? ''}${nodes}${toks}${placeLabels(labels, byNode, W, H, RA.nodeScale, RA.labelScale)}</div>`
}

/** 지도 위 우리 군대의 말 — 머무는 군대 하나에 하나 */
export interface MapToken {
  readonly army: string
  readonly node: string
  readonly men: number
  /** 장수 얼굴, 없으면 가장 많은 병종의 기호 */
  readonly img: string
  readonly sel: boolean
  /** 이번 계절 떠나기로 했다 */
  readonly going: boolean
  /** 길 위에 있다 — 그 길 가운데에 둔다 */
  readonly march?: { readonly from: string; readonly to: string }
}

/** 고른 군대가 갈 수 있는 고을 — 칩은 판세(싸울 곳) 또는 걸리는 계절 */
export interface MapTarget {
  readonly node: string
  readonly edge: string
  readonly chip: string
  /** 막힌 길 */
  readonly off: boolean
  /** 이미 그리로 가기로 했다 */
  readonly on: boolean
}

// ───────── 이름 겹 (형: "글자가 이미지에 가려 안보이는 부분 생기는거 주의해" — 2026-10-19)
// 고을 이름은 고을 그림·깃발·말보다 위의 한 겹에 그린다. 큰 판처럼 빽빽하면 이름끼리·그림과 안 겹치는 자리
// (밑 → 위 → 오른쪽 → 왼쪽)를 도읍·큰 고을부터 차례로 고른다. 지도 좌표는 0..1 (가로는 W, 세로는 H 의 몫).

/** 고을 그림의 너비 — 지도 너비의 몫 (CSS .nd width 8.5% 와 같은 값) */
const ICON_W = 0.085
/** 이름 글자 크기 — 지도 높이의 몫 (CSS 2.1cqh 와 같은 값) */
const LABEL_EM = 0.021

interface LabelIn {
  readonly id: string
  readonly name: string
  readonly now: string | undefined
  readonly x: number
  readonly y: number
  readonly s: number
  readonly cap: boolean
  readonly hh: number
  readonly cls: string
}

interface Box { x0: number; y0: number; x1: number; y1: number }

const hit = (a: Box, b: Box): number => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0))

function placeLabels(ls: readonly LabelIn[], toks: ReadonlyMap<string, readonly unknown[]>, W: number, H: number, ns: number, lsc: number): string {
  // 글씨는 배율의 제곱근으로 줄어든다(CSS --zs). 세로로 긴 판은 처음부터 크게 키워 보므로(가로 칸을 채우는 배율 ≈ 2 / 비율)
  // 그만큼 작게 셈한다 — 안 그러면 이름 상자가 실제의 두세 배라 이웃 고을 옆으로 밀려난다
  const zHint = W < H ? 2 / (W / H) : 1
  const em = (LABEL_EM * lsc) / Math.sqrt(zHint)
  // 그림이 차지하는 자리 — 고을 그림과 말
  const icons: Box[] = ls.map((l) => {
    const w = ICON_W * ns * l.s
    const h = (w * W) / H
    return { x0: l.x - w / 2, y0: l.y - h * 0.62, x1: l.x + w / 2, y1: l.y + h * 0.38 }
  })
  for (const [id, ts] of toks) {
    const l = ls.find((x) => x.id === id)
    if (l === undefined) continue
    const iw = ICON_W * ns * l.s
    const ih = (iw * W) / H
    const x0 = l.x + iw * 0.5
    // 말 표시는 화면에서 거의 같은 크기 — 큰 판(고을 그림이 작다)에서는 고을 그림 크기로 어림한다
    const tw = Math.min((Math.max(30 / H, 0.042) * H * ts.length) / W, iw * 1.3 * ts.length)
    const th = Math.min(0.03, ih * 0.65)
    icons.push({ x0, y0: l.y - th, x1: x0 + tw, y1: l.y + th })
  }
  const placed: Box[] = []
  let out = '<div class="lbs">'
  const order = ls.slice().sort((a, b) => (a.cap !== b.cap ? (a.cap ? -1 : 1) : b.hh - a.hh || (a.id < b.id ? -1 : 1)))
  for (const l of order) {
    const chars = Math.max(l.name.length + (l.cap ? 1 : 0), (l.now ?? '').length * 0.78)
    const w = (chars * em * 0.95 * H) / W + 0.004
    const h = em * (l.now !== undefined ? 2.05 : 1.25)
    const iw = ICON_W * ns * l.s
    const ih = (iw * W) / H
    const cands: Array<[number, number]> = [
      [l.x, l.y + ih * 0.3], // 밑
      [l.x, l.y - ih * 0.62 - h], // 위
      [l.x + iw / 2 + w / 2, l.y - h / 2], // 오른쪽
      [l.x - iw / 2 - w / 2, l.y - h / 2], // 왼쪽
    ]
    let best: { c: [number, number]; cost: number } | null = null
    for (const [i, c] of cands.entries()) {
      const b: Box = { x0: c[0] - w / 2, y0: c[1], x1: c[0] + w / 2, y1: c[1] + h }
      let cost = i * 1e-6 // 같으면 밑이 먼저
      for (const p of placed) cost += hit(b, p) * 4
      for (const [k, ic] of icons.entries()) if (ls[k]?.id !== l.id) cost += hit(b, ic)
      if (b.x0 < 0 || b.x1 > 1 || b.y0 < 0 || b.y1 > 1) cost += 1
      if (best === null || cost < best.cost) best = { c, cost }
    }
    const [cx, cy] = best!.c
    placed.push({ x0: cx - w / 2, y0: cy, x1: cx + w / 2, y1: cy + h })
    out += `<span class="lb${l.cls}" data-n="${l.id}" style="left:${(cx * 100).toFixed(2)}%;top:${(cy * 100).toFixed(2)}%">${l.cap ? '<i class="star">★</i>' : ''}${l.name}${l.now !== undefined ? `<small>${l.now}</small>` : ''}</span>`
  }
  return out + '</div>'
}

// ───────── 고을마다의 땅 (형: "개활지 같은데 직선경로만" — 점이 아니라 땅을 나눠 가진 나라로 보이게, 2026-10-19)

/** 땅 조각의 크기 배수 — 고을 꼴로 정한다 (집 수는 판마다 바뀌어도 땅 모양은 그대로 두려고) */
const CELL_SIZE: Readonly<Record<NodeKind, number>> = { capital: 1.3, port: 1.1, fort: 0.95, village: 1, ironMine: 0.9, wild: 0.85, sodo: 0.7 }

/** 나루의 작은 배 */
function ferrySvg([x, y]: Pt, k: number): string {
  const s = 7 * k
  return `<path d="M${x - s * 1.6} ${y - s * 0.2}Q${x} ${y + s * 1.3} ${x + s * 1.6} ${y - s * 0.2}Z" fill="#6b4a2a" stroke="#2a1d10" stroke-width="${1.2 * k}"/>`
    + `<path d="M${x} ${y - s * 0.3}V${y - s * 1.8}" stroke="#2a1d10" stroke-width="${1.2 * k}"/>`
}

/**
 * 고을마다의 땅을 주인 색으로 — 같은 나라 사이는 옅은 점선, 다른 나라 사이는 짙은 금. 뭍 밖은 잘라 낸다 (영남 판).
 * 땅 모양은 판마다 한 번만 셈하고(mapgeo.provinceCells) 여기서는 색만 칠한다.
 */
function provincesSvg(
  r: Realm, region: RegionId, W: number, H: number, terrR: number,
  dim: (owner: string | null) => boolean, focus: string | null, seen: (id: string) => boolean,
): string {
  const { nodes, cells } = cellsOf(r, region, W, H, terrR)
  const clip = ' clip-path="url(#rm-land)"'
  let fill = ''
  let lines = ''
  for (const [i, c] of cells.entries()) {
    if (!seen(nodes[i]!.id)) continue // 모르는 땅은 안개가 덮는다
    const o = nodes[i]!.owner
    const col = o !== null ? (FACTION_ART[o]?.color ?? '#ccc') : null
    if (col !== null) fill += `<path d="${polyPath(c.pts)}" fill="${col}" opacity="${dim(o) ? 0.06 : focus === o ? 0.46 : 0.3}"/>`
    for (let k = 0; k < c.pts.length; k++) {
      const j = c.nb[k]!
      if (j !== -1 && j < i) continue // 맞닿은 금은 한 번만
      const a = c.pts[k]!
      const b = c.pts[(k + 1) % c.pts.length]!
      const seg = `M${a[0].toFixed(1)} ${a[1].toFixed(1)}L${b[0].toFixed(1)} ${b[1].toFixed(1)}`
      if (j === -1) {
        if (col !== null) lines += `<path d="${seg}" stroke="${col}" stroke-width="1.6" opacity="${dim(o) ? 0.1 : 0.55}"/>`
        continue
      }
      const o2 = nodes[j]!.owner
      if (o === null && o2 === null) continue
      if (o === o2) lines += `<path d="${seg}" stroke="${col}" stroke-width="1" opacity="${dim(o) ? 0.08 : 0.35}" stroke-dasharray="3 4"/>`
      else lines += `<path d="${seg}" stroke="#2a1d10" stroke-width="2.2" opacity=".55"/>`
    }
  }
  return `<g class="terr"${clip}>${fill}<g fill="none" stroke-linecap="round">${lines}</g></g>`
}

/** 판의 고을(id 순)과 그 땅 조각 — 고을 자리는 안 바뀌니 판마다 한 번만 셈한다 (mapgeo 의 캐시) */
function cellsOf(r: Realm, region: RegionId, W: number, H: number, terrR: number): { nodes: Realm['nodes'][string][]; cells: ReturnType<typeof provinceCells> } {
  const nodes = Object.values(r.nodes).sort((x, y) => (x.id < y.id ? -1 : 1))
  const pts = nodes.map((n) => {
    const p = nodePos(region, n.id) ?? [0.5, 0.5]
    return [p[0] * W, p[1] * H] as const
  })
  return { nodes, cells: provinceCells(`${region}:${nodes.length}`, pts, nodes.map((n) => CELL_SIZE[n.kind]), terrR * 1.5) }
}

// ───────── 넓어지는 지도 — 모르는 땅 (발견, docs/realm/WORLD-MAP.md §2 · 2026-10-19)

/**
 * `me` 가 지도에서 볼 수 있는 고을 — 본 땅(intel.land: 제 땅·이웃 · 정찰 · 군대가 선 곳 · 사신이 오간 길 · 동맹이 나눠 준 땅).
 * 본 땅이라도 주인을 모르는 나라면 그리지 않는다 (나라를 흘리지 않게). 발견이 없는 판이면 전부.
 */
export function visibleNodes(r: Realm, me: string): Set<string> {
  if (r.known === undefined) return new Set(Object.keys(r.nodes))
  const out = new Set<string>()
  const k = r.intel[me] ?? {}
  for (const n of Object.values(r.nodes)) {
    if (n.owner !== me && k[n.id]?.land !== true) continue
    if (n.owner === null || knows(r, me, n.owner)) out.add(n.id)
  }
  for (const a of Object.values(r.armies)) if (a.faction === me) out.add(a.at)
  return out
}

/** 같은 id 면 같은 흔들림 (0..1) — 그림 자리 고르기에만 */
const jit = (s: string): number => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return ((h >>> 0) % 10007) / 10007
}

/**
 * 모르는 땅은 빈 한지다 (형: "한국엔 양피지가 없으니까 한지스타일로" — 2026-10-19). 닥나무 결이 보이는 종이 위에
 * 고구려 벽화의 구름무늬가 흘러가고, 본 땅만 붓으로 칠해져 있다 — 가장자리는 먹이 번진 듯 들쭉날쭉.
 * 이름만 들은 나라(아는데 땅을 못 본 나라)는 도읍 자리에 먹점 하나와 이름만 — 대강의 자리다.
 */
function fogSvg(
  r: Realm, me: string, region: RegionId, W: number, H: number, terrR: number, vis: ReadonlySet<string>, fresh: (id: string) => boolean,
  corridors: readonly string[], art: string,
): { defs: string; body: string; words: string } {
  const { nodes, cells } = cellsOf(r, region, W, H, terrR)
  const blur = Math.round(terrR * 0.3)
  let holes = ''
  for (const [i, c] of cells.entries()) {
    const id = nodes[i]!.id
    if (!vis.has(id)) continue
    holes += `<path d="${polyPath(c.pts)}"${fresh(id) ? ' class="fresh"' : ''}/>`
  }
  for (const d of corridors) holes += `<path d="${d}" fill="none" stroke="#000" stroke-width="${Math.round(terrR * 1.6)}" stroke-linecap="round" stroke-linejoin="round"/>`
  const tile = Math.round(Math.min(W, H) * 0.42)
  const defs = `<filter id="rm-fog-blur" x="-5%" y="-5%" width="110%" height="110%">`
    + `<feTurbulence type="fractalNoise" baseFrequency="${(3 / terrR).toFixed(4)}" numOctaves="2" seed="11" result="n"/>`
    + `<feDisplacementMap in="SourceGraphic" in2="n" scale="${Math.round(terrR * 0.9)}" xChannelSelector="R" yChannelSelector="G" result="d"/>`
    + `<feGaussianBlur in="d" stdDeviation="${blur}"/></filter>`
    + `<mask id="rm-fog" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#fff"/>`
    + `<g fill="#000" filter="url(#rm-fog-blur)">${holes}</g></mask>`
    + `<pattern id="rm-hanji" patternUnits="userSpaceOnUse" width="${tile}" height="${tile}"><image href="${art}map-world/hanji.webp" width="${tile}" height="${tile}" preserveAspectRatio="none"/></pattern>`
  const body = `<g class="fog" mask="url(#rm-fog)"><rect width="${W}" height="${H}" fill="#efe4cc"/><rect width="${W}" height="${H}" fill="url(#rm-hanji)"/></g>`
  // 구름무늬 — 고른 눈금 위, 본 고을에서 먼 자리 (나라 자리를 흘리지 않게 눈금으로)
  let words = ''
  const seenPts = [...vis].map((id) => nodePos(region, id)).filter((p) => p !== undefined)
  const cols = W < H ? 3 : 5
  const rows = Math.max(3, Math.round((cols * H) / W * 0.9))
  const cw = (W < H ? 26 : 14)
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const key = `${region}:${gx}:${gy}`
      const x = (gx + 0.5 + (gy % 2) * 0.3 + (jit(key) - 0.5) * 0.4) / cols
      const y = (gy + 0.5 + (jit(key + 'y') - 0.5) * 0.5) / rows
      if (seenPts.some((p) => Math.hypot((p[0] - x) * W, (p[1] - y) * H) < terrR * 3.2)) continue
      const n = 1 + Math.floor(jit(key + 'n') * 8)
      const flip = jit(key + 'f') < 0.5 ? ' scaleX(-1)' : ''
      words += `<img class="fogc" src="${art}map-world/cloud-${n}.webp" alt="" style="left:${(x * 100).toFixed(1)}%;top:${(y * 100).toFixed(1)}%;width:${(cw * (0.8 + jit(key + 's') * 0.5)).toFixed(1)}%;--d:${Math.round(30 + jit(key + 'd') * 30)}s${flip ? ';rotate:y 180deg' : ''}">`
    }
  }
  // 이름만 들은 나라 — 도읍 자리 언저리에 먹점과 이름
  for (const f of Object.keys(r.factions).sort()) {
    if (f === me || !knows(r, me, f)) continue
    if (Object.values(r.nodes).some((n) => n.owner === f && vis.has(n.id))) continue
    const cap = r.factions[f]!.capital
    const p = nodePos(region, cap)
    if (p === undefined || r.nodes[cap]?.owner !== f) continue
    const x = p[0] + ((jit(f) - 0.5) * terrR * 1.6) / W
    const y = p[1] + ((jit(f + 'y') - 0.5) * terrR * 1.6) / H
    words += `<span class="rumor" style="left:${(x * 100).toFixed(1)}%;top:${(y * 100).toFixed(1)}%"><i></i>${r.factions[f]!.name}<small>소문으로 들은 나라</small></span>`
  }
  return { defs, body, words }
}
