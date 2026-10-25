/**
 * 그린 지도 — 글자 지도 위에 얹는 한 장 (docs/realm/SYSTEMS §13 · ART ⑩⑪ · 형: "파인다이닝식으로 담는다")
 *
 * 계절마다 같은 땅의 네 철 그림이 바탕이고, 그 위에 길(SVG)·고을 기호·우리 군대·고른 출정 화살을 얹는다.
 * **땅은 다 보이고 군세는 아는 만큼** (정보의 계약, 2026-10-18 고침): 고을·길·주인은 다 그린다. 남의 군세는 우리 intel 에 있는 만큼만.
 * 상태를 읽기만 하고 HTML 문자열을 돌려준다 — 고르는 손짓(고을 누르기)은 글자 지도가 data-node 로 받는다.
 * 자리·그림 이름은 realm/data/art.ts.
 */
import { headcount } from '../../realm/battle.ts'
import { FACTION_ART, GOOD_ICON, REGION_ART, SEASON_MAP, bustOf, nodeIcon, nodePos } from '../../realm/data/art.ts'
import { EDGE_NAME, GOOD_NAME, NODE_KIND_NAME, NODE_NOW, tagNow } from '../../realm/data/prose.ts'
import { worldGeoOf } from '../../realm/data/regions/index.ts'
import { knows } from '../../realm/discovery.ts'
import { crowdOf, isCoast, nodeHarvest, nodeSpecials, nodeYield } from '../../realm/economy.ts'
import { visibleRange } from '../../realm/intel.ts'
import { blockedWhy, forceOf, seasonOf } from '../../realm/season.ts'
import type { EdgeKind, NodeKind, Realm, REdge, RegionId, SeasonOfYear } from '../../realm/types.ts'
import { separatedRoutes, ferryAt, landClipSvg, midOf, naturalLines, riversSvg, routePoints, smoothPath, tidyEnds, trimPolyline, type Pt } from './mapgeo.ts'
import { territory, type Territory } from './territory.ts'
import { worldMapFallback, worldMapUrl } from './worldmap.ts'

/** 미리 받아 둔 다음 계절 지도 그림 — 붙잡아 두어야 브라우저가 풀어 둔 그림을 버리지 않는다 */
const warm = new Map<string, HTMLImageElement>()

/**
 * 다음 계절 바탕을 미리 — 계절이 넘어갈 때 새 그림을 그제야 받거나(작은 판·영남) 만드느라(넓은 판) 지도가 깜빡였다
 * (형 10-23: "계절 넘어갈 때 화면 로딩하느라 깜빡거리는 거"). 판을 그린 뒤 한숨 돌리고 부른다 — 탭이 가려져 있으면 하지 않는다 (규칙 4)
 */
export function warmNextSeason(art: string, region: RegionId, next: SeasonOfYear): void {
  if (document.visibilityState !== 'visible') return
  if (worldGeoOf(region) !== null) { worldMapUrl(art, next, region); return }
  const RA = REGION_ART[region]
  const url = `${art}${RA.dir}/${SEASON_MAP[next]}.${RA.ext}`
  if (warm.has(url)) return
  const im = new Image()
  im.src = url
  warm.set(url, im)
  void im.decode().catch(() => warm.delete(url))
}

/** 변한 판 지도 바탕의 크기 (map/*.jpg) — CSS 의 기본 비율. 판마다의 크기는 REGION_ART (영남 판 1024×765) */
const W = REGION_ART['byeonhan-mini'].w
const H = REGION_ART['byeonhan-mini'].h


/**
 * 길의 생김새 — 테두리 두른 관 대신 밟아 다진 흙길처럼 (형: "길같지가 않고 오브젝트같아").
 *   어깨(sh) — 길가의 닳은 풀·흙, 넓고 옅게 두 겹 · 바닥(bed) — 길 자체 · 가운데(mid) — 바퀴 자국·디딤돌·물살
 */
interface RoadLook {
  readonly sh: string
  readonly shW: number
  readonly bed: string
  readonly bedW: number
  readonly bedDash?: string
  readonly mid?: string
  readonly midW?: number
  readonly midDash?: string
}
const ROAD_LOOK: Readonly<Record<EdgeKind, RoadLook>> = {
  field: { sh: '#ead6a0', shW: 15, bed: '#8a6238', bedW: 6.5, mid: '#d9b97c', midW: 1.6, midDash: '7 6' }, // 수레바퀴 자국
  pass: { sh: '#d4c4a2', shW: 13, bed: '#5a4636', bedW: 5, mid: '#f1e5c8', midW: 3, midDash: '0.1 8' }, // 디딤돌
  forest: { sh: '#8aa562', shW: 15, bed: '#5e4a2c', bedW: 5, bedDash: '13 5' }, // 나무 그늘에 끊긴다
  reeds: { sh: '#d2ca82', shW: 14, bed: '#7a7a3a', bedW: 5, bedDash: '10 6' },
  ford: { sh: '#d4ebf6', shW: 14, bed: '#3d7fa8', bedW: 6, mid: '#eef8ff', midW: 1.8, midDash: '5 9' }, // 물살
  sea: { sh: '#e4f6ff', shW: 13, bed: '#22608f', bedW: 4.5, bedDash: '8 8' }, // 뱃길 — 멀리 건너오는 길이라 또렷하게
  mudflat: { sh: '#dcd1ba', shW: 14, bed: '#7d7466', bedW: 5, bedDash: '2 8' },
}

/** 길 한 줄의 SVG — 지도와 길 보기(범례)가 같은 것을 쓴다. k 굵기 배율 · op 흐림(막힌 길) */
export function roadSvg(d: string, kind: EdgeKind, k: number, op = 1, title = ''): string {
  const L = ROAD_LOOK[kind]
  const w = (x: number): string => (x * k).toFixed(1)
  const dash = (x: string | undefined): string => (x === undefined ? '' : ` stroke-dasharray="${x.split(' ').map((v) => w(Number(v))).join(' ')}"`)
  let s = `<path d="${d}" fill="none" stroke="${L.sh}" stroke-width="${w(L.shW * 1.55)}" stroke-linecap="round" stroke-linejoin="round" opacity="${(0.2 * op).toFixed(2)}"/>`
  s += `<path d="${d}" fill="none" stroke="${L.sh}" stroke-width="${w(L.shW)}" stroke-linecap="round" stroke-linejoin="round" opacity="${(0.42 * op).toFixed(2)}"/>`
  s += `<path d="${d}" fill="none" stroke="${L.bed}" stroke-width="${w(L.bedW)}"${dash(L.bedDash)} stroke-linecap="round" stroke-linejoin="round" opacity="${(0.9 * op).toFixed(2)}">${title !== '' ? `<title>${title}</title>` : ''}</path>`
  if (L.mid !== undefined) s += `<path d="${d}" fill="none" stroke="${L.mid}" stroke-width="${w(L.midW ?? 1.5)}"${dash(L.midDash)} stroke-linecap="round" opacity="${(0.85 * op).toFixed(2)}"/>`
  return s
}

/**
 * 지도는 제 상자의 **높이를 꽉 채운다** — 폰 세로에서는 지도가 화면보다 넓어져 옆으로 밀어 본다 (앱 화면, FLOW §5).
 * 글씨·기호 크기는 지도 높이(cqh)를 따른다.
 */
export const MAP_CSS = `
.map { position: relative; height: 100%; aspect-ratio: ${W} / ${H}; margin: 0 auto; background: #2a261f center / cover no-repeat;
  user-select: none; -webkit-user-select: none; container-type: size;
  /* 가장자리 고을 이름·말이 밖으로 삐져나가 굴릴 자리를 늘리지 않게 — 지도 바깥 빈 바탕까지 끌려 나갔다 (형 10-23: "맵에서 지도 바깥으로 막 나가지지 않게") */
  overflow: clip; }
.map svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.map .nd { position: absolute; transform: translate(-50%, -62%); width: calc(8.5% * var(--s, 1) * var(--ns, 1) * var(--cs, 1)); text-align: center; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.map .nd img.st { width: 100%; filter: drop-shadow(0 2px 2px rgba(0,0,0,.55)); }
/* 살아 있는 지도 — CSS 만 (규칙 4: 숨은 탭에선 그리지 않는다). 밥 짓는 연기 · 포구의 배 · 구름 그림자 */
.map .nd .smk { position: absolute; left: 46%; top: 10%; width: 30%; aspect-ratio: 1; pointer-events: none; z-index: 1; }
.map .nd .smk::before, .map .nd .smk::after { content: ''; position: absolute; inset: 0; border-radius: 50%;
  background: radial-gradient(circle, #fbf8f0f0 0, #d9d2c4b0 40%, #a89f9040 60%, #a89f9000 72%); opacity: 0;
  animation: smk 5.5s ease-out infinite; animation-delay: var(--d, 0s); }
.map .nd .smk::after { animation-delay: calc(var(--d, 0s) - 2.75s); left: 18%; }
@keyframes smk { 0% { opacity: 0; transform: translate(0, 0) scale(.45); } 15% { opacity: .9; } 60% { opacity: .55; } 100% { opacity: 0; transform: translate(45%, -230%) scale(2); } }
/* 배가 뜬 포구만 물결에 흔들린다 — 도읍인 항구(가락·거칠산)는 성이라 흔들리면 둥실거려 보였다 (형 10-24) */
.map .nd.k-port:not(.k-cap) img.st { animation: pbob 3.4s ease-in-out infinite alternate; animation-delay: var(--d, 0s); transform-origin: 50% 80%; }
@keyframes pbob { from { transform: translateY(0) rotate(-.6deg); } to { transform: translateY(-1.6%) rotate(.6deg); } }
.map .clsh { position: absolute; inset: -12%; pointer-events: none; z-index: 0; opacity: .55;
  background: radial-gradient(ellipse 14% 9% at 20% 30%, #1a160e2e, #1a160e00), radial-gradient(ellipse 18% 11% at 62% 58%, #1a160e26, #1a160e00),
    radial-gradient(ellipse 12% 8% at 85% 20%, #1a160e24, #1a160e00), radial-gradient(ellipse 16% 10% at 38% 85%, #1a160e22, #1a160e00);
  animation: clsh 110s linear infinite alternate; }
@keyframes clsh { from { transform: translate(-6%, -2%); } to { transform: translate(6%, 2%); } }
/* 지난 계절 넘어간 고을 — 불과 연기 */
.map .nd .burnfx { position: absolute; left: 22%; bottom: 18%; width: 62%; pointer-events: none; z-index: 2; transform-origin: 50% 100%; animation: bflick 1.2s ease-in-out infinite alternate; }
.map .nd .burnsm { position: absolute; left: 20%; bottom: 55%; width: 85%; pointer-events: none; z-index: 1; opacity: .75; animation: bsmoke 6s ease-in-out infinite alternate; }
@keyframes bflick { from { transform: scaleY(.9) skewX(-3deg); } to { transform: scaleY(1.08) skewX(3deg); } }
@keyframes bsmoke { from { transform: translateY(0) scale(1); } to { transform: translateY(-14%) scale(1.15); } }
@media (prefers-reduced-motion: reduce) { .map .nd .burnfx, .map .nd .burnsm { animation: none; } }
/* 빼앗은 고을 — 위에서 우리 깃발이 꽂히고(통 튐) 천이 나부끼며, 금빛 테가 번지고 「점령」이 떴다 사라진다. 연기는 옅게 */
.map .nd .burnsm.won { opacity: .35; }
/* 맡은 장수 — 고을 기호 오른쪽 위에 작은 얼굴 (금테) */
.map .nd .gov { position: absolute; right: -6%; top: -4%; width: 34%; aspect-ratio: 1; border-radius: 50%; object-fit: cover; border: 2px solid #e0b04a; box-shadow: 0 0 0 1px #000, 0 2px 6px #000c; z-index: 4; pointer-events: none; background: #2a2016; }
.map .nd .plant { position: absolute; left: 58%; bottom: 46%; width: 42%; aspect-ratio: 1 / 1.5; z-index: 3; pointer-events: none; transform-origin: 0 100%; animation: plantin .7s cubic-bezier(.3, 1.6, .5, 1) .4s both; }
.map .nd .plant .pole { position: absolute; left: 0; bottom: 0; width: 7%; height: 100%; border-radius: 2px; background: linear-gradient(90deg, #3a2814, #8a6a40); box-shadow: 0 0 2px #000; }
.map .nd .plant .cloth { position: absolute; left: 7%; top: 2%; width: 88%; height: 56%; border-radius: 0 3px 3px 0; background: var(--fc); border: 1.5px solid #2a1c0c; display: flex; align-items: center; justify-content: center;
  transform-origin: 0 50%; animation: clothwave 1.6s ease-in-out 1.1s infinite alternate; box-shadow: 0 2px 4px #0008; }
.map .nd .plant .cloth img { width: 70%; height: 70%; object-fit: contain; filter: drop-shadow(0 0 1px #000); }
@keyframes plantin { 0% { opacity: 0; transform: translateY(-160%) scale(1.3); } 60% { opacity: 1; transform: translateY(6%) scale(1); } 100% { transform: none; } }
@keyframes clothwave { from { transform: skewY(0deg) scaleX(1); } to { transform: skewY(-6deg) scaleX(.92); } }
.map .nd .wonring { position: absolute; left: 50%; top: 50%; width: 100%; aspect-ratio: 1; border-radius: 50%; border: 3px solid #ffd27a; box-shadow: 0 0 12px #ffd27a; transform: translate(-50%, -50%) scale(.3); opacity: 0; pointer-events: none;
  animation: wonring 1.6s ease-out .9s 2 both; }
@keyframes wonring { 0% { opacity: 0; transform: translate(-50%, -50%) scale(.3); } 10% { opacity: .9; } 100% { opacity: 0; transform: translate(-50%, -50%) scale(2.4); } }
.map .nd .wonchip, .map .nd .heldchip { position: absolute; left: 50%; bottom: 102%; transform: translateX(-50%); white-space: nowrap; pointer-events: none; z-index: 4; border-radius: 8px; padding: 0 6px;
  font-size: clamp(10px, calc(1.5cqh / var(--z, 1) * var(--zs, 1)), 13px); font-weight: 700; }
.map .nd .wonchip { background: #3a2a10; color: #ffe2a0; border: 1px solid #ffd27a; animation: wonchip 3.2s ease-out 1s both; }
@keyframes wonchip { 0% { opacity: 0; transform: translate(-50%, 6px); } 12% { opacity: 1; transform: translate(-50%, 0); } 80% { opacity: 1; } 100% { opacity: 0; } }
.map .nd .heldchip { background: #14243a; color: #cfe6ff; border: 1px solid #7ab0f0; box-shadow: 0 0 8px #7ab0f088; animation: wonchip 3.6s ease-out .6s both; }
@media (prefers-reduced-motion: reduce) { .map .nd .plant, .map .nd .plant .cloth, .map .nd .wonring { animation: none; } }
@media (prefers-reduced-motion: reduce) { .map .nd .smk, .map .clsh { display: none; } .map .nd.k-port img.st { animation: none; } }
.map .lbs { position: absolute; inset: 0; z-index: 5; pointer-events: none; }
/* 고을 배너 — 깃발·이름·군세가 한 덩어리 (문명 6 도시 배너 · Old World 의 위계 — docs/GAP.md M1) */
.map .lb { position: absolute; transform: translateX(-50%); text-align: center; white-space: nowrap; display: flex; align-items: center; gap: .18em;
  font-size: clamp(10px, calc(1.9cqh / var(--z, 1) * var(--zs, 1) * var(--ls, 1)), 16px); line-height: 1.2; color: #2a1d10; font-weight: 700;
  background: linear-gradient(#fbf4e3f2, #efe2c4f2); border: 1px solid color-mix(in srgb, var(--c, #8a7a5a) 65%, #2a1d10);
  border-left: .32em solid var(--c, #8a7a5a); border-radius: .2em .55em .55em .2em; padding: 0 .35em 0 .2em; box-shadow: 0 1px 3px #0006; }
.map .lb .lbe { width: 1.1em; height: 1.1em; object-fit: contain; flex: none; filter: drop-shadow(0 0 1px #fff); }
.map .lb .lbt { display: flex; flex-direction: column; align-items: flex-start; }
.map .lb .lbf { margin-left: .25em; padding: 0 .35em; border-radius: .6em; background: #2a1414; color: #f0b8a0; font-size: .82em; font-weight: 800; }
.map .lb .lbf.old { opacity: .6; }
/* 도읍 — 크고 두껍게, 금빛 별 */
.map .lb.k-cap { font-size: clamp(11px, calc(2.2cqh / var(--z, 1) * var(--zs, 1) * var(--ls, 1)), 18px); border-width: 2px; border-left-width: .38em;
  background: linear-gradient(#fff8e6f5, #f0dfb8f5); }
/* 빈땅·소도 — 주인 없는 땅은 띠 없이 옅게 (위계가 낮다) */
.map .lb.k-free { background: #f3e6c8b0; border-color: transparent; border-left-color: transparent; box-shadow: none; font-weight: 600; font-style: italic; color: #4a3a28; }
/* 우리 고을 — 금빛 테 */
.map .lb.me { box-shadow: 0 0 0 1.5px #ffd27a, 0 1px 4px #0007; }
.ap.hide-flags .map .lb .lbe { display: none; } .ap.hide-force .map .lb .lbf { display: none; }
.map .lb .star { font-style: normal; color: #b8860b; margin-right: 2px; text-shadow: 0 0 2px #fff8d0, 0 0 3px #fff8d0; } /* 도읍 (형: "수도같은건 별표해야하지 않나?") */
/* 지금 땅이름 줄은 가까이 볼 때만 (멀리서는 배너가 한 줄로 작게) */
.map[data-zl="far"] .lb small { display: none; }
.map .lb small { display: block; font-size: .74em; font-weight: 500; color: #5a4a36; margin-top: -2px; }
/* 받침 — 주인 색이 땅에 번진 둥근 자리 (고을이 땅 위에 앉아 보이게). 도읍은 크고 금빛 테 */
.map .nd .base { position: absolute; left: 50%; top: 80%; width: 118%; aspect-ratio: 2.6; transform: translate(-50%, -50%); border-radius: 50%; pointer-events: none; z-index: -1;
  background: radial-gradient(ellipse at 50% 45%, color-mix(in srgb, var(--c) 70%, transparent) 0, color-mix(in srgb, var(--c) 35%, transparent) 45%, transparent 72%); }
/* 도읍은 크게 — 군장이 있는 곳 (형: "도읍은 별표가 있기는 하지만 이미지도 좀 달라야") */
.map .nd.k-cap { --cs: 1.45; z-index: 2; }
.map .nd.k-cap .base { width: 140%; box-shadow: inset 0 0 0 2px #e8c06a99; }
.map .nd.k-free .base { opacity: .4; }
/* 고리 — 평소엔 없다. 고를 때 · 갈 곳 · 위협받을 때만 */
.map .nd .ring { position: absolute; left: 50%; top: 42%; width: 82%; aspect-ratio: 1; transform: translate(-50%, -50%);
  border-radius: 50%; border: 3px solid var(--c); box-shadow: 0 0 6px var(--c); pointer-events: none; display: none; }
.map .nd.sel .ring, .map .nd.tgt .ring, .map .nd.threat .ring { display: block; }
.map .nd.sel .ring { border: 3px solid #ffd27a; box-shadow: 0 0 0 3px #ffd27a55, 0 0 14px #ffd27a; animation: selp 1.6s ease-in-out infinite; }
@keyframes selp { 0%, 100% { transform: translate(-50%, -50%) scale(1); } 50% { transform: translate(-50%, -50%) scale(1.12); } }
/* 위협 — 적이 오는 우리 고을 (Total War 의 붉은 영향권 — GAP M4) */
.map .nd.threat .ring { border: 3px solid #d0301c; box-shadow: 0 0 0 4px #d0301c44, 0 0 16px #d0301c; animation: thr 1.1s ease-in-out infinite alternate; }
@keyframes thr { from { opacity: .45; } to { opacity: 1; } }
.map .nd .thr { position: absolute; left: 50%; top: -18%; transform: translateX(-50%); font-size: clamp(11px, calc(2.2cqh / var(--z, 1) * var(--zs, 1)), 18px);
  color: #fff; background: #b0281a; border-radius: 50%; width: 1.5em; height: 1.5em; line-height: 1.5em; box-shadow: 0 0 8px #d0301c; pointer-events: none; z-index: 2; }
/* 갈 수 없는 곳 — 군대를 고르면 흐려진다 (이동 범위만 또렷 — GAP M3) */
.map .nd.far { opacity: .42; filter: saturate(.5); } .map .lb.far { opacity: .45; }
.map svg .mvglow { animation: mvg 1.2s linear infinite; } @keyframes mvg { to { stroke-dashoffset: -40; } }
.map svg .thrarrow { animation: thr 1s ease-in-out infinite alternate; }
@media (prefers-reduced-motion: reduce) { .map .nd.sel .ring, .map .nd.threat .ring, .map svg .mvglow, .map svg .thrarrow { animation: none; } }
/* 특산 — 고을 그림 오른쪽 위에 작은 둥근 표 (쇠·소금·나무·말). 아무도 안 사는 땅은 흐리게 — 일구면 난다 */
/* 작게 겹쳐 쌓는다 — 넷이 나란히 서면 고을 그림과 길을 덮었다 (형: "자원들이랑 지도 길 이런거랑 좀안겹치게") */
.map .lb .lbg { display: inline-flex; align-items: center; gap: .1em; margin-left: .3em; padding: .1em .32em; border-radius: .55em; background: linear-gradient(#3a2a18f0, #20160cf0);
  box-shadow: inset 0 0 0 1px #c8a05099, 0 1px 2px #0006; }
.map .lb .lbg img { width: 1.5em; height: 1.5em; margin: -.18em -.04em; object-fit: contain; border-radius: 50%; filter: drop-shadow(0 1px 1px #000c);
  background: radial-gradient(circle, #fff3d4 0, #f0d9a0cc 38%, #f0d9a000 68%); }
.map .lb .lbg.idle img { opacity: .55; filter: saturate(.4) drop-shadow(0 0 1px #000c); }
.map .lb .lbg i { font-style: normal; font-size: .7em; font-weight: 700; color: #f3e3bd; padding-left: .35em; margin-left: .15em; border-left: 1px solid #c8a05066; }
.map .lb .lbg i.moat { color: #bfe0ff; }
/* 겨울 고기잡이 표 — 얼어 흐려진다 */
.map .lb .lbg img.frz { opacity: .5; filter: grayscale(1) brightness(1.25) drop-shadow(0 0 1px #7fb6d8); }
/* 지은 것 — 목책·해자 (고을 왼쪽 위) */
/* 글자 표 — 마을 그림으로 두면 또 하나의 마을처럼 보였다 (형: "도읍 좌상단에 마을이미지는 뭐지? 이거장터라는 얘긴가?") */
/* 안개 — 고을 아랫도리를 덮는 흰 김과 구름무늬 하나 */
.map .nd .mist { position: absolute; left: 50%; top: 66%; width: 170%; aspect-ratio: 2.2; transform: translate(-50%, -50%); pointer-events: none; z-index: 1;
  background: radial-gradient(ellipse at 50% 50%, #fffdf6d8 0, #fffdf690 38%, #fffdf600 70%); animation: mistb 5s ease-in-out infinite alternate; }
.map .nd .mist img { position: absolute; left: 4%; bottom: 4%; width: 46%; opacity: .85; }
@keyframes mistb { from { opacity: .7; } to { opacity: 1; } }
.map .nd .ice { position: absolute; left: 4%; top: 46%; font-style: normal; font-size: clamp(10px, calc(2cqh / var(--z, 1) * var(--zs, 1)), 16px); color: #e8f6ff;
  background: #2a5a7ae0; border-radius: 50%; width: 1.4em; height: 1.4em; line-height: 1.4em; text-align: center; box-shadow: 0 0 0 1px #bfe6ff, 0 1px 3px #0008; z-index: 2; }
@media (prefers-reduced-motion: reduce) { .map .nd .mist { animation: none; } }
.map svg .mine-edge { animation: mglow 3.2s ease-in-out infinite alternate; }
@keyframes mglow { from { opacity: .65; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .map svg .mine-edge { animation: none; } }
.map svg .rsign { pointer-events: auto; filter: drop-shadow(0 0 1.5px #f8eed6) drop-shadow(0 0 1.5px #f8eed6) drop-shadow(0 1px 2px #0009); } .map[data-zl="far"] svg .rs-f { display: none; } /* 들길은 흔해 가까이 볼 때만 */
.map .nd .men, .map .nd .foe { position: absolute; left: 86%; top: 42%; transform: translateY(-50%); background: #201811; border-radius: 9px; padding: 0 5px;
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
.map .nd .tchip .tn.big { margin-left: 3px; background: #3a2a24e8; color: #e8b8a0; }
.map .nd .tchip .tn.when { margin-left: 3px; } .map .nd .tchip .tn.pin { margin-left: 3px; background: #4a3a14ee; color: #ffe08a; box-shadow: 0 0 0 1px #ffd27a; }
.map .nd .tchip .tn.hard + .tn.when, .map .nd .tchip .feel + .tn.when { margin-left: 3px; }
.map .nd .tchip .tn.stay { background: #2a3a24e8; color: #c8e8a8; }
/* 「집 보내기」의 갈 곳 — 흙빛 (군대의 금빛·붉은 고리와 갈린다) */
.map .nd.tgt.pp .ring { border-color: #e0b070; box-shadow: 0 0 10px #e0b070; }
.map .nd.tgt.pp.on .ring { border-color: #8a5a2b; box-shadow: 0 0 12px #c8904a; }
.map .nd .tchip .tn.newv { background: #3f6a2ae6; color: #f4ffe8; box-shadow: 0 0 0 1px #b6e08f; }
.map .nd .tchip .tn.share { background: #6b4a2ae6; color: #fbe8c8; box-shadow: 0 0 0 1px #e0b070; }
.map .nd .tchip .tn.crowd { margin-left: 3px; background: #5a2418e8; color: #f0a08a; }
.map .nd .tchip .tn { background: #201811e8; color: #f3e6c8; border-radius: 9px; padding: 1px 7px; font-size: clamp(10px, calc(1.8cqh / var(--z, 1) * var(--zs, 1)), 14px); font-weight: 700; }
.map .toks { position: absolute; transform: translate(2px, -50%); display: flex; gap: 3px; z-index: 4; pointer-events: none; }
.map .tok { pointer-events: auto; display: flex; flex-direction: column; align-items: center; padding: 0; border: 0; background: none; cursor: pointer;
  -webkit-tap-highlight-color: transparent; width: clamp(26px, calc(4.2cqh / var(--z, 1) * var(--zs, 1) * var(--ls, 1)), 46px); }
.map .tok { position: relative; }
.map .tok img { width: 100%; aspect-ratio: 1; border-radius: 50%; object-fit: cover; border: 2.5px solid var(--tc, #9fd18b); background: #201811; box-shadow: 0 0 0 1.5px #201811, 0 2px 4px #0008; }
.map .tok .hp { position: absolute; left: 12%; right: 12%; top: calc(100% - 1.05em); height: 4px; border-radius: 2px; background: #201811; overflow: hidden; z-index: 1; }
.map .tok .hp::after { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: calc(var(--p, 1) * 100%); background: linear-gradient(90deg, #6aa84f, #b6e08f); }
.map .tok .dir { position: absolute; left: 50%; top: 50%; width: 150%; height: 150%; transform: translate(-50%, -50%) rotate(var(--a, 0deg)); pointer-events: none; }
.map .tok .dir::after { content: ''; position: absolute; right: -2px; top: 50%; transform: translateY(-50%); border: .4em solid transparent; border-left: .62em solid #f3e6c8; filter: drop-shadow(0 0 2px #000); }
.map .tok b { position: relative; z-index: 2; margin-top: -6px; background: #201811; color: #9fd18b; border: 1px solid #9fd18b; border-radius: 8px; padding: 0 4px;
  font-size: clamp(10px, calc(1.6cqh / var(--z, 1) * var(--zs, 1)), 13px); line-height: 1.3; }
.map .tok.ally b { color: #cfe8b8; border-color: var(--tc); }
.map .tok.ally img { border-style: double; border-width: 4px; }
.map .tok.party img { border-style: dashed; background: #3a2c1e; object-fit: contain; padding: 8%; } .map .tok.party b { color: #f0d8b0; border-color: #c8a070; }
.map .tok.sel img { border-color: #ffd27a; box-shadow: 0 0 0 3px #ffd27a88, 0 0 12px #ffd27a; transform: scale(1.12); }
.map .tok.going img { border-color: #c8402a; }
/* 개척할 수 있는 빈땅 — 누르면 그 땅 카드에 "사람 보내기" */
.map .nd .stl { position: absolute; left: 50%; bottom: 100%; transform: translate(-50%, -2px); /* 그림 위에 — 밑에는 고을 이름표가 온다 (형 10-23: "개마 들머리 뒤에 뭐가 있는지 모르겠어") */ white-space: nowrap; pointer-events: none; z-index: 2;
  font-size: clamp(10px, calc(1.6cqh / var(--z, 1) * var(--zs, 1)), 13px); font-weight: 700; color: #f4ffe8; background: #3f6a2ae6; border: 1px solid #b6e08f;
  border-radius: 9px; padding: 0 6px; box-shadow: 0 1px 4px #0008; animation: stlp 1.6s ease-in-out infinite alternate; }
@keyframes stlp { from { box-shadow: 0 0 0 #b6e08f00; } to { box-shadow: 0 0 10px #b6e08faa; } }
@media (prefers-reduced-motion: reduce) { .map .nd .stl { animation: none; } }
.map .nd .stl.go { background: #6b4a2ae6; border-color: #e0b070; color: #fbe8c8; animation: none; }
/* 붐빔 — 우리 고을 그림 밑 (가까우면 노란 띠, 넘치면 붉은 글) */
.map .nd .crw { position: absolute; left: 50%; bottom: 100%; transform: translate(-50%, -2px); /* 위로 — 밑의 이름표와 안 겹치게 */ pointer-events: none; z-index: 2; white-space: nowrap; }
.map .nd .crw.near { width: 40%; height: 4px; border-radius: 2px; background: #e8c040; box-shadow: 0 0 0 1px #201811; }
.map .nd .crw.full { font-size: clamp(9px, calc(1.5cqh / var(--z, 1) * var(--zs, 1)), 12px); font-weight: 700; color: #ffd8c8; background: #8a2a14e8;
  border: 1px solid #f0a08a; border-radius: 8px; padding: 0 5px; }
.map .toks.mv { transform: translate(-50%, -50%); } .map .toks.mv .tok img { border-style: dashed; border-color: #f3e6c8; }
/* 길 위의 우리 군대 — 발맞춰 걷듯 들썩이고, 밑에 "이동 중 · 다음 계절 도착" (형: "언제도착하는지 글씨가 가려져서 안보이기도") */
.map .toks.mv .tok { animation: mvbob .55s ease-in-out infinite alternate; }
@keyframes mvbob { from { transform: translateY(0) rotate(-3deg); } to { transform: translateY(-12%) rotate(3deg); } }
.map .toks.mv .mvtag { position: absolute; left: 50%; top: 100%; transform: translateX(-50%); margin-top: 2px; white-space: nowrap; z-index: 3; pointer-events: none;
  font-size: clamp(10px, calc(1.6cqh / var(--z, 1) * var(--zs, 1)), 13px); font-weight: 700; color: #fff4dc; background: #7a1f10e6; border-radius: 8px; padding: 1px 6px; box-shadow: 0 1px 3px #0008; }
.map svg .mvflow { animation: mvf .9s linear infinite; } @keyframes mvf { to { stroke-dashoffset: -22; } }
@media (prefers-reduced-motion: reduce) { .map .toks.mv .tok, .map svg .mvflow { animation: none; } }
.map .lb.crowd { visibility: hidden; } /* 겹쳐 자리가 없는 작은 고을 이름 — declutter */
.map .lb.sel { color: #7a1f10; } .map .lb.dim { opacity: 0; } /* 한 나라만 볼 때 다른 나라 글씨는 감춘다 (형: "다른나라들은 글자정돈 완전 투명하게") */ .map .nd.sel img.st { filter: drop-shadow(0 0 7px #ffd27a) drop-shadow(0 0 3px #ffd27a); }
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
  /** 우리를 지키러 오는 동맹 군대 — 초록 점선 · "도우러 · n계절" */
  readonly ally?: boolean
  /** 이번 계절 보내기로 한 집(새 마을 · 집 나누기) — 흙빛 점선 */
  readonly people?: boolean
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
  /** 지금 사람을 보내 마을을 세울 수 있는 빈땅 — 지도에 「＋마을」 (형: "개척이랑 이주가 전혀 직관적이지가 않아") */
  settleable: ReadonlySet<string> = new Set(),
  /** 지난 계절 주인이 바뀐 고을 — 불타고 연기가 오른다 (그림 realm/fx) */
  burning: ReadonlySet<string> = new Set(),
  /** 이번 계절 사람을 보내기로 한 빈땅 — 「＋마을」 대신 「사람 간다」 */
  settling: ReadonlySet<string> = new Set(),
  /** 지난 계절 우리가 빼앗은 고을 — 우리 깃발이 꽂히고 금빛이 번진다 · 지켜 낸 고을 — 방패가 빛난다 (형 10-23: "졌을 때는 불나는 게 맞는데 이겼을 땐 어떤 연출") */
  taken: ReadonlySet<string> = new Set(),
  held: ReadonlySet<string> = new Set(),
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
  /** 땅빛 — 고을 하나가 물들이는 둘레 (지도 좌표) */
  const TERRITORY_R = RA.terrR
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
  // 군대를 골랐으면 갈 수 있는 곳만 또렷하다 (Total War 의 노란 이동 범위 — GAP M3)
  const ranging = targets.length > 0
  // 우리 고을로 오는 적 — 그 고을에 붉은 고리, 그 길은 붉게 깜빡 (GAP M4)
  const threatened = new Set(marches.filter((m) => m.foe === true && r.nodes[m.to]?.owner === me).map((m) => m.to))

  let svg = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">`
  svg += `<defs><marker id="rm-ah" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">`
  svg += `<path d="M0 0L10 5L0 10z" fill="#c8402a"/></marker>`
  svg += `<marker id="rm-ah-foe" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">`
  svg += `<path d="M0 0L10 5L0 10z" fill="#3a2a5a"/></marker>`
  svg += `<marker id="rm-ah-ppl" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">`
  svg += `<path d="M0 0L10 5L0 10z" fill="#8a5a2b"/></marker>`
  for (const [f, a] of Object.entries(FACTION_ART).sort((x, y) => (x[0] < y[0] ? -1 : 1))) {
    svg += `<radialGradient id="rm-t-${f}"><stop offset="0" stop-color="${a.color}" stop-opacity=".72"/>`
    svg += `<stop offset=".65" stop-color="${a.color}" stop-opacity=".45"/><stop offset="1" stop-color="${a.color}" stop-opacity="0"/></radialGradient>`
  }
  // 두 끝을 다 본 길은 그 길을 따라 띠로 밝다 (누가 걸어 본 길)
  const corridors = r.known === undefined ? [] : Object.values(r.edges).sort((x, y) => (x.id < y.id ? -1 : 1))
    .filter((ed) => seen(ed.a) && seen(ed.b))
    .map((ed) => smoothPath(routePoints(region, ed, px(ed.a), px(ed.b), W, H)))
  const fog = r.known !== undefined ? fogSvg(r, me, region, W, H, TERRITORY_R, vis, isFresh, corridors, art) : null
  const landClip = landClipSvg(region, W, H)
  svg += `${landClip}${fog?.defs ?? ''}</defs>`
  // 땅빛 — 고을마다의 땅을 산·강을 따라 가르고(territory.ts) 주인 색으로
  svg += provincesSvg(r, region, W, H, TERRITORY_R, dim, focus, seen, me, landClip !== '')
  // 강 — 또렷하게 (영남 판)
  svg += riversSvg(region, W, H)
  // 모르는 땅 — 강·땅빛 위, 길 밑 (아는 고을 사이의 길은 늘 보인다)
  svg += fog?.body ?? ''
  // 길 — 골짜기·바닷가를 따라 휜다 (형: "직선경로만 있는게 이상하지 않냐?"). 막힌 길은 흐리고 가운데 ✕
  const sw = RA.nodeScale < 1 ? 0.6 : 1
  // 같은 골짜기를 따라가는 길이 한 줄로 포개지지 않게 서로 밀어 둔다 (mapgeo.separatedRoutes — 판마다 한 번)
  const allEdges = Object.values(r.edges).sort((x, y) => (x.id < y.id ? -1 : 1))
  const sep = separatedRoutes(`${region}:${W}x${H}:${allEdges.length}`, allEdges.map((ed) => [ed.id, routePoints(region, ed, px(ed.a), px(ed.b), W, H)] as const), 14 * sw, RA.terrR * 0.15)
  const route = (ed: REdge): Pt[] => sep.get(ed.id) ?? routePoints(region, ed, px(ed.a), px(ed.b), W, H)
  /** 길 기호의 크기 — 고을 그림의 절반 남짓 */
  const signW = ICON_W * RA.nodeScale * W * 0.6
  /** 고을 그림의 반 너비 (지도 좌표) — 그 밑에 묻힌 길은 안 보인다 */
  const nodeHalf = ICON_W * RA.nodeScale * W * 0.45
  svg += `<g class="ly-roads">` // 보기 켜고 끄기 (app 의 .layers) — 길
  for (const ed of Object.values(r.edges).sort((x, y) => (x.id < y.id ? -1 : 1))) {
    if (!seen(ed.a) || !seen(ed.b)) continue
    const pts = route(ed)
    const shut = blockedWhy(ed, season) !== null
    // 길가는 옅은 흙빛 어깨로 바탕과 떼어 본다 (형: "지도랑 색이 비슷해서 길 색이 잘 안보이는건" · "길같지가 않고 오브젝트같아")
    const d = smoothPath(pts)
    svg += roadSvg(d, ed.kind, sw, shut ? 0.35 : 1, EDGE_NAME[ed.kind])
    // 길 기호 — 나루는 나루터에, 다른 길은 고을 그림 사이 드러난 길의 가운데에서 조금 비켜 (행군 화살의 "n계절" 글씨를 안 가린다).
    // 고을이 가까워 드러난 길이 짧으면 기호를 줄이고, 그래도 모자라면 길 옆으로 비켜 단다 (형: "너무 가까운 마을사이 낑긴 도로이미지 안보이는데")
    const fr = ed.kind === 'ford' ? ferryAt(region, ed, W, H) : null
    const len = lenOf(pts)
    const t0 = Math.min(0.45, nodeHalf / Math.max(1, len))
    const gap = len * (1 - 2 * t0)
    let sz = signW
    let at: Pt = fr ?? midOf(trimPolyline(pts, t0 + (1 - 2 * t0) * 0.55, t0 + (1 - 2 * t0) * 0.6))
    if (fr === null && gap < sz * 1.15) {
      sz = Math.max(signW * 0.62, Math.min(signW, gap * 0.95))
      if (gap < sz * 0.9) {
        // 길 옆으로 — 두 고을을 잇는 줄에 직각으로, 고을 그림 반 너비만큼
        const [a, b] = [pts[0]!, pts[pts.length - 1]!]
        const ux = (b[0] - a[0]) / Math.max(1, len)
        const uy = (b[1] - a[1]) / Math.max(1, len)
        const m = midOf(pts)
        const side = uy > 0 ? 1 : -1
        at = [m[0] - uy * side * nodeHalf, m[1] + ux * side * nodeHalf]
      }
    }
    // 길마다 기호를 단다 — 막힌 길은 왜 막혔는지가 그림이다 (눈 덮인 고개 · 불어난 나루)
    const sign = routeSign(r, ed, season, fr !== null)
    svg += `<image class="rsign${ed.kind === 'field' && sign === 'oxcart' ? ' rs-f' : ''}" href="${art}icon/route-${sign}.png" x="${(at[0] - sz / 2).toFixed(1)}" y="${(at[1] - sz * 0.62).toFixed(1)}" width="${sz.toFixed(1)}" height="${sz.toFixed(1)}"><title>${ROUTE_SIGN_NAME[sign]}</title></image>`
    if (shut) {
      // ✕ 는 기호의 오른쪽 아래 귀퉁이에 작게 — 그림을 가리지 않게
      const [mx, my] = [at[0] + sz * 0.38, at[1] + sz * 0.26]
      const s = 7 * sw
      svg += `<path d="M${mx - s} ${my - s}L${mx + s} ${my + s}M${mx + s} ${my - s}L${mx - s} ${my + s}" stroke="#a02a1a" stroke-width="${6 * sw}" stroke-linecap="round"/>`
    }
  }
  if (ranging) {
    for (const t of targets) {
      if (t.edge === '' || t.off) continue
      const ed = r.edges[t.edge]
      if (ed === undefined || !seen(ed.a) || !seen(ed.b)) continue
      const d = smoothPath(route(ed))
      svg += `<path d="${d}" fill="none" stroke="#ffd27a" stroke-width="${(16 * sw).toFixed(1)}" stroke-linecap="round" opacity=".28"/>`
      svg += `<path class="mvglow" d="${d}" fill="none" stroke="#fff3c8" stroke-width="${(4 * sw).toFixed(1)}" stroke-dasharray="${(10 * sw).toFixed(1)} ${(10 * sw).toFixed(1)}" stroke-linecap="round" opacity=".95"/>`
    }
  }
  svg += `</g><g class="ly-marches">` // 출정 화살
  // 출정 화살 — 그 길의 모양을 따라 간다. 고른 것은 굵은 실선, 길 위의 것은 점선 + 남은 계절
  const edgeOf = (a: string, b: string): REdge | undefined => Object.values(r.edges).find((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a))
  for (const m of marches) {
    if (!seen(m.from) || !seen(m.to)) continue
    const ed = edgeOf(m.from, m.to)
    let full: Pt[] = ed !== undefined ? route(ed) : [px(m.from), px(m.to)]
    if (ed !== undefined && ed.a !== m.from) full = full.slice().reverse()
    const k = 0.22 // 고을 기호에 안 묻히게 끝을 당긴다
    const pts = tidyEnds(trimPolyline(full, k, 1 - k), 0.08)
    // 보내기로 한 집 — 흙빛 점선 (군대의 붉은 화살과 갈린다)
    if (m.people === true) {
      svg += `<path class="pplarrow" d="${smoothPath(pts)}" fill="none" stroke="#8a5a2b" stroke-width="${7 * lw}" stroke-dasharray="${(12 * lw).toFixed(1)} ${(8 * lw).toFixed(1)}" stroke-linecap="round" marker-end="url(#rm-ah-ppl)" opacity=".92"/>`
      continue
    }
    // 기습은 밤길처럼 — 어두운 짧은 점선. 정면은 붉은 실선
    const amb = m.ambush === true && m.foe !== true
    const dash = amb ? ' stroke-dasharray="2 14" stroke-linecap="round"' : m.left === null ? '' : ' stroke-dasharray="14 8"'
    const onUs = m.foe === true && threatened.has(m.to)
    const col = m.ally === true ? '#3f7a3a' : onUs ? '#b0281a' : m.foe === true || amb ? '#3a2a5a' : '#c8402a'
    const head = onUs ? 'rm-ah' : m.foe === true || amb ? 'rm-ah-foe' : 'rm-ah'
    if (onUs) svg += `<path d="${smoothPath(pts)}" fill="none" stroke="#ffb09a" stroke-width="${18 * lw}" stroke-linecap="round" opacity=".35"/>`
    // 길 위의 우리 행군은 점선이 가는 쪽으로 흐른다 (형: "이동중이면 … 애니메이션이 뭔가 있음 좋겠음")
    const flow = m.left !== null && m.foe !== true && !amb ? ' class="mvflow"' : onUs ? ' class="thrarrow"' : ''
    const label0 = m.ally === true && m.left !== null ? `도우러 · ${m.left <= 1 ? '다음 계절' : `${m.left}계절 뒤`}` : ''
    svg += `<path${flow} d="${smoothPath(pts)}" fill="none" stroke="${col}" stroke-width="${(amb ? 11 : onUs ? 10 : 9) * lw}"${dash} marker-end="url(#${head})" opacity=".9"/>`
    // 언제 닿나 — 우리 행군은 말 밑 꼬리표가 말한다(가려지지 않게). 적 행군은 길 위 글씨로 "다음 계절 닿음"
    const when = m.left !== null ? (m.left <= 1 ? '다음 계절' : `${m.left}계절 뒤`) : ''
    const label = label0 !== '' ? label0 : m.foe === true ? `적 · ${when} 닿음` : m.left !== null ? '' : amb ? '우리 기습' : ''
    // 보인 적의 행군 — 창을 멘 줄 그림 (무엇이 오는지 한눈에)
    // 보인 적의 행군 — 창을 멘 줄 그림을 길 한가운데 바로 위에 얹고, 글씨는 그 밑에 (형 10-23: "보인 적의 행군 이미지가 제대로 된 위치가 아닌 이상한 곳에")
    const cs = signW * 1.2
    if (m.foe === true) {
      const [cx, cy] = midOf(pts)
      svg += `<image class="rsign" href="${art}icon/route-column.png" x="${(cx - cs / 2).toFixed(1)}" y="${(cy - cs * 0.85).toFixed(1)}" width="${cs.toFixed(1)}" height="${cs.toFixed(1)}"><title>${ROUTE_SIGN_NAME.column}</title></image>`
    }
    if (label !== '') {
      const [lx, ly0] = midOf(pts)
      const ly = m.foe === true ? ly0 + cs * 0.45 + 12 : ly0
      svg += `<text x="${lx}" y="${ly - 12}" font-size="${26 * lw}" font-weight="700" fill="${m.ally === true ? '#2c5a28' : onUs ? '#8a1a0a' : m.foe === true || amb ? '#3a2a5a' : '#7a1f10'}" stroke="#f3e6c8" stroke-width="5" paint-order="stroke" text-anchor="middle">${label}</text>`
    }
  }
  svg += `</g></svg>`

  let nodes = ''
  const labels: LabelIn[] = []
  const govOf = new Map(Object.values(r.heroes).filter((h) => h.faction === me && h.status === 'free' && h.post != null && h.at === h.post).map((h) => [h.post!, h] as const))
  for (const n of Object.values(r.nodes).sort((x, y) => (x.id < y.id ? -1 : 1))) {
    if (!seen(n.id)) continue
    const p = pos(n.id)
    if (p === undefined) continue
    const fr = isFresh(n.id) ? ' fresh' : ''
    const owner = n.owner
    const color = owner !== null ? (FACTION_ART[owner]?.color ?? '#ccc') : '#d9d2c0'
    const ours = owner === me
    let badge = ''
    let force = ''
    if (ours && !hasTok.has(n.id)) {
      const men = Object.values(r.armies).filter((a) => a.at === n.id && a.faction === me && a.march === null)
        .reduce((s, a) => s + headcount(forceOf(r, a)), 0)
      if (men > 0) badge = `<span class="men">${men}</span>`
    } else if (!ours) {
      // 정찰로 본 군세는 남의 고을에만 — 차지해 우리 군대가 들어앉은 고을에 옛 적 군세가 남지 않게 (형 10-24: "개마들머리 점령했는데 붉은 273~550 이 남아 있다")
      const f = known[n.id]?.force
      if (f) {
        const v = visibleRange({ f0: f.f0, src: f.src, u: f.u }, r.season - f.season)
        // 척후·첩자가 본 군세만 — 못 본 곳마다 ?를 흩뿌리지 않는다 (형: "빨간물음표들 위치가 너무 중구난방"). 배너 끝에 붙는다
        if (v !== null) force = `<i class="lbf${r.season - f.season > 0 ? ' old' : ''}">${span(v[0], v[1])}</i>`
      }
    }
    const cap = Object.values(r.factions).some((f) => f.capital === n.id)
    const kcls = (cap ? ' k-cap' : owner === null || n.kind === 'sodo' ? ' k-free' : '') + (n.kind === 'port' ? ' k-port' : '')
    // 살아 있는 지도 (형: "화면들이 너무 정적… 어딘가는 계속 움직이거나") — 사람 사는 고을엔 밥 짓는 연기, 박자는 고을마다 다르게
    const lived = owner !== null && n.hh > 0 && n.kind !== 'sodo'
    const yl = (Object.entries(nodeYield(r, n.id, season)) as Array<[keyof typeof GOOD_NAME, number]>).filter(([, v]) => v > 0).map(([g, v]) => `${GOOD_NAME[g]} ${v}`)
    const hv = nodeHarvest(r, n.id)
    const more = owner === null ? '' : [yl.length > 0 ? `이번 계절 · ${yl.join(' · ')}` : '', hv > 0 ? `가을걷이 곡식 약 ${hv}` : ''].filter((x) => x !== '').join(' / ')
    const far = ranging && !target.has(n.id) && selected !== n.id ? ' far' : ''
    const thr = threatened.has(n.id) ? ' threat' : ''
    const who = owner === null ? '주인 없음' : (r.factions[owner]?.name ?? '?')
    const fa = owner !== null ? FACTION_ART[owner] : undefined
    const emb = fa !== undefined ? `${art}icon/${fa.emblem}.png` : ''
    // 고른 군대가 갈 수 있는 곳 — 누르면 그리로 간다 (data-act="go")
    const tg = target.get(n.id)
    const go = tg !== undefined && !tg.off ? ` data-act="${tg.act ?? 'go'}" data-edge="${tg.edge}"` : ''
    const tcls = (tg === undefined ? '' : tg.off ? ' tgt off' : tg.on ? ' tgt on' : ' tgt') + (tg?.act === 'ptgo' ? ' pp' : '')
    nodes += `<div class="nd${kcls}${selected === n.id ? ' sel' : ''}${dim(owner) && tg === undefined ? ' dim' : ''}${tcls}${far}${thr}${fr}"${go} data-node="${n.id}" style="left:${p[0] * 100}%;top:${p[1] * 100}%;--c:${color};--s:${sizeOf(n.hh).toFixed(2)};--d:${(-beat(n.id) * 7).toFixed(2)}s" title="${n.name} · ${NODE_KIND_NAME[n.kind]} · ${who}"${more !== '' ? ` data-more="${more}"` : ''}>`
    // 특산 — 사람이 살면 나는 것 (쇠·소금·나무·말). 빈땅도 보여 "일구면 말이 난다"를 미리 안다
    const sp = nodeSpecials(r, n.id)
    // 바닷가 고기잡이 — 곡식이 조금 난다. 겨울엔 바다가 거칠어 쉰다 (economy.nodeYield) → 표가 얼어 흐려진다
    const fish = n.kind !== 'sodo' && isCoast(r, n.id)
      ? `<img class="${season === 'winter' ? 'frz' : ''}" src="${art}icon/good-dried-fish.png" alt="고기" title="${season === 'winter' ? '겨울 — 바다가 거칠어 고기잡이를 쉰다' : '고기잡이 — 겨울 빼고 곡식이 조금 난다'}">`
      : ''
    // 붐빔 — 우리 고을이 품에 가까우면 노란 띠, 넘치면 붉은 「붐빈다」 (집이 더디게 는다)
    const cr = ours && n.kind !== 'sodo' ? crowdOf(n) : 0
    // 넘칠 때만 글자로 — 뜻 모를 노란 막대(곧 붐빔)는 걷었다 (형 10-23: "개마 들머리 마을 위에 노란색 바가 하나 생겼는데 이거 뭐임")
    const crowd = cr > 1 ? '<span class="crw full" title="집이 품을 넘쳐 더디게 늘고, 남는 백성은 저절로 이웃 고을로 옮겨 간다">붐빈다</span>' : ''
    // 계절따라 걸리는 규칙도 그림으로 — 봄·가을 안개(숨기 좋다) · 겨울 언 해자(못 막는다) (prose.tagNow 와 같은 것)
    const now = n.tags.map((t) => tagNow(t, season)).filter((x) => x !== null).join(' ')
    const mist = n.tags.includes('fog') && now !== '' ? `<span class="mist" title="${now}"><img src="${art}map-world/cloud-3.webp" alt=""></span>` : ''
    const ice = n.tags.includes('moat') && season === 'winter' ? `<i class="ice" title="${now}">❄</i>` : ''
    // 지은 것 — 목책 · 해자 작은 표 (왼쪽 위). 그림만으로는 도읍·포구의 울타리가 지은 것인지 알 수 없었다
    const dfs = (['palisade', 'moat'] as const).filter((t) => n.tags.includes(t))
    // 특산·지은 것은 이름표 옆 어두운 칸에 — 고을 그림 위에 흰 동그라미로 떠 있으면 이웃 고을 것인지 헷갈리고 지도가 어지럽다
    // (형 10-24: "지역에서 생산되는 품목도 우상단 동그라미가 아니라 더 효과적이게" — 문명 6 도시 배너처럼 이름에 붙인다)
    const tray = sp.length > 0 || fish !== '' || dfs.length > 0
      ? `<span class="lbg${n.owner === null || n.hh <= 0 ? ' idle' : ''}">${sp.map((g) => `<img src="${art}icon/${GOOD_ICON[g]}.png" alt="${GOOD_NAME[g]}" title="${GOOD_NAME[g]} — 사람이 살면 난다">`).join('')}${fish}${dfs.map((t) => `<i class="${t}" title="${DEF_TITLE[t]}">${t === 'palisade' ? '목책' : '해자'}</i>`).join('')}</span>`
      : ''
    labels.push({
      id: n.id, name: n.name, now: NODE_NOW[n.id], x: p[0], y: p[1], s: sizeOf(n.hh), cap: n.kind === 'capital' || cap, hh: n.hh,
      cls: `${kcls}${ours ? ' me' : ''}${selected === n.id ? ' sel' : ''}${dim(owner) && tg === undefined ? ' dim' : ''}${far}${fr}`,
      color: owner !== null ? color : '', emb, force, tray, trayW: sp.length + (fish !== '' ? 1 : 0) + dfs.length * 1.6,
    })
    // 맡은 장수 — 우리 고을이면 얼굴을 작게 (형 10-23: "마을에 장수 배치한 거 아직 맵에선 아무것도 안 보이던데")
    const gv = ours ? govOf.get(n.id) : undefined
    const gface = gv !== undefined && bustOf(gv.id) !== undefined ? `<img class="gov" src="${art}bust/${bustOf(gv.id)}.jpg" alt="" title="${gv.name} — 이 고을을 맡았다">` : ''
    nodes += `<span class="base"></span><span class="ring"></span><img class="st" src="${art}icon/${nodeIcon(n)}.png" alt="">${taken.has(n.id) ? `<img class="burnsm won" src="${art}fx/smoke.png" alt=""><span class="plant"><i class="pole"></i><i class="cloth" style="--fc:${FACTION_ART[me]?.color ?? '#c9a45a'}"><img src="${art}icon/${FACTION_ART[me]?.emblem ?? 'emblem-shell'}.png" alt=""></i></span><i class="wonring"></i><span class="wonchip">점령</span>` : burning.has(n.id) ? `<img class="burnsm" src="${art}fx/smoke.png" alt=""><img class="burnfx" src="${art}fx/fire.png" alt="">` : lived ? '<i class="smk"></i>' : ''}${held.has(n.id) ? '<span class="heldchip">🛡 지켜 냈다</span>' : ''}${mist}${ice}${gface}${badge}${thr !== '' ? '<i class="thr">⚔</i>' : ''}${tg !== undefined ? `<span class="tchip">${tg.chip}</span>` : settleable.has(n.id) ? (settling.has(n.id) ? '<span class="stl go">백성이 가는 중</span>' : '<span class="stl">＋마을</span>') : crowd}</div>`
  }
  // 우리 군대의 말 — 고을 밑에 나란히. 누르면 고르고, 갈 곳이 지도에 밝아진다
  const byNode = new Map<string, MapToken[]>()
  for (const t of tokens) if (t.march === undefined) byNode.set(t.node, [...(byNode.get(t.node) ?? []), t])
  const myColor = FACTION_ART[me]?.color ?? '#9fd18b'
  const topMen = Math.max(1, ...tokens.map((t) => t.men))
  const tokBtn = (t: MapToken, ang?: number): string =>
    `<button class="tok${t.sel ? ' sel' : ''}${t.going ? ' going' : ''}${t.ally !== undefined ? ' ally' : ''}${t.party === true ? ' party' : ''}" data-act="${t.party === true ? 'ptok' : 'tok'}" data-army="${t.army}" style="--tc:${t.party === true ? '#c8a070' : t.ally ?? myColor}">`
    + `${ang !== undefined ? `<i class="dir" style="--a:${ang.toFixed(0)}deg"></i>` : ''}<img src="${t.img}" alt=""><i class="hp" style="--p:${Math.max(0.08, t.men / topMen).toFixed(2)}"></i><b>${t.ally !== undefined ? '도움 ' : t.party === true ? '개척 ' : ''}${t.men}</b></button>`
  let toks = ''
  // 길 위의 우리 군대 — 떠난 쪽에서 삼분의 일쯤 (가운데의 "n계절" 글씨를 안 가린다)
  for (const t of tokens) {
    if (t.march === undefined || !seen(t.march.from) || !seen(t.march.to)) continue
    const ed = edgeOf(t.march.from, t.march.to)
    let full: Pt[] = ed !== undefined ? route(ed) : [px(t.march.from), px(t.march.to)]
    if (ed !== undefined && ed.a !== t.march.from) full = full.slice().reverse()
    const seg = trimPolyline(full, 0.28, 0.4)
    const [mx, my] = midOf(seg)
    // 가는 쪽 — 그 토막의 처음에서 끝으로 (화면 좌표: 지도 비율로 늘린다)
    const a0 = seg[0]!
    const a1 = seg[seg.length - 1]!
    const ang = (Math.atan2(a1[1] - a0[1], a1[0] - a0[0]) * 180) / Math.PI
    const left = t.march.left
    const tag = `이동 중 · ${left <= 1 ? '다음 계절 도착' : `${left}계절 뒤 도착`}`
    toks += `<div class="toks mv" style="left:${(mx / W) * 100}%;top:${(my / H) * 100}%">${tokBtn(t, ang)}<span class="mvtag">${tag}</span></div>`
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
  // 새 계절 바탕이 아직 안 됐으면 지난 계절 것을 그대로 — 빈 바탕으로 깜빡이지 않게 (다 되면 worldmap 이 갈아 끼운다)
  const bgUrl = world ? (worldMapUrl(art, season, region) || worldMapFallback(region)) : `${art}${RA.dir}/${SEASON_MAP[season]}.${RA.ext}`
  const bg = bgUrl !== '' ? `background-image:url('${bgUrl}');` : ''
  // 밝혀진 땅의 테두리 (0~1) — 축소는 여기까지만 (zoom.ts · 형: "문명처럼 유저가 보이는 구역을 기반으로 최대 축소")
  const sp = [...vis].map((id) => pos(id)).filter((p): p is readonly [number, number] => p !== undefined)
  const seenBox = sp.length === 0 ? '0,0,1,1' : [Math.min(...sp.map((p) => p[0])), Math.min(...sp.map((p) => p[1])), Math.max(...sp.map((p) => p[0])), Math.max(...sp.map((p) => p[1]))].map((v) => v.toFixed(3)).join(',')
  return `<div class="map" data-seen="${seenBox}" data-region="${region}"${world ? ` data-world="${season}"` : ''} data-aspect="${W / H}" data-zmax="${RA.zmax}" style="${bg}aspect-ratio:${W} / ${H};--ns:${RA.nodeScale};--ls:${RA.labelScale}">${svg}<div class="clsh"></div>${fog?.words ?? ''}${nodes}${toks}${placeLabels(labels, byNode, W, H, RA.nodeScale, RA.labelScale)}</div>`
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
  /** 길 위에 있다 — 그 길 가운데에 둔다 · left 남은 계절 */
  readonly march?: { readonly from: string; readonly to: string; readonly left: number }
  /** 동맹이 빌려준 군대 — 그 나라 색 테와 「도움」 (형: "지켜주는 군대를 요청하면 언제 어디로 오는지 … 안보이는데?") */
  readonly ally?: string
  /** 개척단 — 흙빛 테 · 누르면 'ptok' · 수는 가구 (parties.ts) */
  readonly party?: boolean
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
  /** 누르면 하는 일 — 기본 'go'(군대). 'pgo' 는 「집 보내기」의 갈 곳 */
  readonly act?: string
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
  /** 주인 나라 색 — 배너의 띠 (주인이 없으면 '') */
  readonly color: string
  /** 주인 나라 깃발 그림 주소 ('' 이면 없음) */
  readonly emb: string
  /** 척후가 본 군세 칩 html ('' 이면 없음) */
  readonly force: string
  /** 특산·지은 것 칸 html ('' 이면 없음) */
  readonly tray: string
  /** 그 칸의 너비 (글자 수 어림) */
  readonly trayW: number
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
    // 배너 — 깃발(1.4자) · 별 · 군세 칩도 자리를 먹는다
    const chars = Math.max(l.name.length + (l.cap ? 1 : 0), (l.now ?? '').length * 0.78) + (l.emb !== '' ? 1.6 : 0) + (l.force !== '' ? 3.5 : 0) + (l.tray !== '' ? l.trayW * 1.2 + 0.9 : 0) + 0.8
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
    out += `<span class="lb${l.cls}" data-n="${l.id}" style="left:${(cx * 100).toFixed(2)}%;top:${(cy * 100).toFixed(2)}%${l.color !== '' ? `;--c:${l.color}` : ''}">`
      + `${l.emb !== '' ? `<img class="lbe" src="${l.emb}" alt="">` : ''}<span class="lbt"><span>${l.cap ? '<i class="star">★</i>' : ''}${l.name}</span>${l.now !== undefined ? `<small>${l.now}</small>` : ''}</span>${l.tray}${l.force}</span>`
  }
  return out + '</div>'
}

// ───────── 고을마다의 땅 (형: "개활지 같은데 직선경로만" — 점이 아니라 땅을 나눠 가진 나라로 보이게, 2026-10-19)

/** 땅 조각의 크기 배수 — 고을 꼴로 정한다 (집 수는 판마다 바뀌어도 땅 모양은 그대로 두려고) */
const CELL_SIZE: Readonly<Record<NodeKind, number>> = { capital: 1.3, port: 1.1, fort: 0.95, village: 1, ironMine: 0.9, wild: 0.85, sodo: 0.7 }

/** 지은 것의 말 — 고을 왼쪽 위 작은 표 */
const DEF_TITLE = { palisade: '목책 — 한 번 지으면 계속 선다. 지키는 쪽이 세다', moat: '해자 — 목책 앞에서 한 번 더 막는다. 겨울엔 언다' } as const

// ───────── 길 기호 (public/realm/icon/route-* · 2026-10-20 그림 열여섯)

/** 길 기호의 이름 — 기호에 손을 대면 뜨는 말, 길 보기 표 */
export const ROUTE_SIGN_NAME = {
  oxcart: '들길 — 소달구지가 다니는 트인 길',
  caravan: '쇠 나는 고을로 가는 길 — 짐말이 오간다',
  cairn: '고갯길 — 서낭당 돌무더기',
  snowpass: '눈 덮인 고개 — 겨울엔 얼어서 사람을 잃는다',
  fortstair: '산성으로 오르는 고개 — 지키는 쪽이 높다',
  jangseung: '숲길 — 장승이 선 숨기 좋은 길',
  boardwalk: '갈대 늪 — 널다리 · 숨기 좋다',
  steppingstones: '갯벌 — 돌을 디뎌 건넌다 · 더디다',
  ferry: '나루 — 배로 강을 건넌다',
  logbridge: '여울 — 통나무 다리로 건넌다',
  raft: '장마에 불어난 나루 — 뗏목으로 건너다 사람을 잃는다',
  icefloe: '언 강 — 겨울엔 얼음 위로 건넌다 · 강을 믿던 쪽이 기습에 당하기 쉽다',
  searoute: '바닷길 — 배로 건넌다',
  sotdae: '소도로 드는 길 — 솟대 너머는 싸움이 없는 땅',
  column: '보인 적의 행군',
} as const
export type RouteSign = keyof typeof ROUTE_SIGN_NAME

/**
 * 길 기호 — 그 길에 걸린 규칙이 그림으로 보인다. 규칙이 바뀌면 그림도 바뀐다:
 * 겨울 고개는 눈 덮인 길(얼어서 사람을 잃는다), 여름 나루는 뗏목(물이 불었다), 겨울 나루·갈대는 언 강(기습이 쉽다 — ambushWinterIce), 산성으로 오르는 고개는 돌계단(높은 쪽이 지킨다),
 * 소도로 드는 길은 솟대, 쇠 나는 고을로 가는 들길은 짐말. 계절이 바뀔 때 "어, 고개 그림이 바뀌었네" 하고 규칙을 알아차리게
 * (형: "오 이게 구현이 되어있네. 오 이게 의도한대로 진행이 되네").
 */
export function routeSign(r: Realm, ed: REdge, season: SeasonOfYear, ferry: boolean): RouteSign {
  const to = (k: NodeKind): boolean => r.nodes[ed.a]?.kind === k || r.nodes[ed.b]?.kind === k
  if (ed.kind !== 'sea' && to('sodo')) return 'sotdae'
  switch (ed.kind) {
    case 'pass': return season === 'winter' ? 'snowpass' : to('fort') ? 'fortstair' : 'cairn'
    case 'ford': return season === 'summer' ? 'raft' : season === 'winter' ? 'icefloe' : ferry ? 'ferry' : 'logbridge'
    case 'forest': return 'jangseung'
    case 'reeds': return season === 'winter' ? 'icefloe' : 'boardwalk'
    case 'mudflat': return 'steppingstones'
    case 'sea': return 'searoute'
    case 'field': return to('ironMine') ? 'caravan' : 'oxcart'
  }
}

/** 꺾은선의 길이 */
/** 고을마다의 박자 0..1 — 연기·출렁임이 한꺼번에 움직이지 않게 (id 에서 딴다, 결정론) */
const beat = (id: string): number => [...id].reduce((s, c) => (s * 31 + c.charCodeAt(0)) % 997, 7) / 997
const lenOf = (p: readonly Pt[]): number => p.reduce((s, q, i) => (i === 0 ? 0 : s + Math.hypot(q[0] - p[i - 1]![0], q[1] - p[i - 1]![1])), 0)

/**
 * 고을마다의 땅을 주인 색으로 — 같은 나라 사이는 옅은 점선, 다른 나라 사이는 짙은 금, 강을 따라 갈린 금은 강과 겹친다.
 * **우리 땅**은 금빛 빗금을 깔고 둘레를 짙은 띠 위 금빛 겹선으로 두른다 (형: "내나라가 지도상에서 정확히 어딘지 가늠이 안됨").
 * 땅 모양은 판마다 한 번만 셈하고(territory.ts) 여기서는 색만 칠한다. 뭍이 있는 판은 뭍 밖을 잘라 낸다.
 */
function provincesSvg(
  r: Realm, region: RegionId, W: number, H: number, terrR: number,
  dim: (owner: string | null) => boolean, focus: string | null, seen: (id: string) => boolean, me: string, clipped: boolean,
): string {
  const { nodes, t } = terrOf(r, region, W, H, terrR)
  const clip = clipped ? ' clip-path="url(#rm-land)"' : ''
  const k = Math.max(1, W / 1100) // 굵기 — 그림 폭에 맞춘다
  let fill = ''
  let mine = ''
  let lines = ''
  let gold = ''
  // 나라마다 — 그 나라 땅(잘라 낼 틀)과 바깥 둘레. 둘레를 굵고 옅게 그려 땅 안쪽으로만 잘라 내면 문명 6 의 '안쪽 띠'가 된다 (GAP M2)
  const own = new Map<string, string>()
  const rim = new Map<string, string>()
  for (const [i, d] of t.fills.entries()) {
    if (d === '' || !seen(nodes[i]!.id)) continue // 모르는 땅은 안개가 덮는다
    const o = nodes[i]!.owner
    if (o === null) continue
    // 안은 옅게 — 나라는 둘레로 읽힌다
    fill += `<path d="${d}" fill="${FACTION_ART[o]?.color ?? '#ccc'}" opacity="${dim(o) ? 0.05 : focus === o ? 0.34 : o === me ? 0.26 : 0.17}"/>`
    if (o === me && !dim(o)) mine += d
    if (!dim(o)) own.set(o, (own.get(o) ?? '') + d)
  }
  for (const e of t.edges) {
    if (!seen(nodes[e.i]!.id) && (e.j < 0 || !seen(nodes[e.j]!.id))) continue
    const o = nodes[e.i]!.owner
    const o2 = e.j >= 0 ? nodes[e.j]!.owner : null
    if (o === null && o2 === null) continue
    const col = FACTION_ART[(o ?? o2)!]?.color ?? '#ccc'
    // 같은 나라 고을 사이 — 또렷한 가는 실선 (형 10-24: "마을 테두리도 확실하고")
    if (o === o2) lines += `<path d="${e.d}" stroke="color-mix(in srgb, ${col} 55%, #2a1d10)" stroke-width="${(1.5 * k).toFixed(1)}" opacity="${dim(o) ? 0.1 : 0.7}"/>`
    else {
      // 나라의 바깥 둘레 — 두 쪽 저마다 제 색 띠를 안쪽에 갖는다. 금 자체는 그 나라 색으로 또렷하게
      for (const x of [o, o2]) if (x !== null && own.has(x)) rim.set(x, (rim.get(x) ?? '') + e.d)
      if (e.j < 0) lines += `<path d="${e.d}" stroke="${col}" stroke-width="${(2.4 * k).toFixed(1)}" opacity="${dim(o) ? 0.1 : 0.85}"/>`
      else lines += `<path d="${e.d}" stroke="#1a120a" stroke-width="${(2 * k).toFixed(1)}" opacity=".85"/>`
    }
    // 우리 땅의 둘레 — 짙은 띠 위에 금빛
    if ((o === me) !== (o2 === me)) gold += e.d
  }
  let band = ''
  let crisp = ''
  let cps = ''
  for (const [o, d] of [...rim].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const col = FACTION_ART[o]?.color ?? '#ccc'
    cps += `<clipPath id="rm-own-${o}"><path d="${own.get(o)!}"/></clipPath>`
    band += `<path d="${d}" clip-path="url(#rm-own-${o})" stroke="${col}" stroke-width="${(o === me ? 30 : 24) * k}" opacity="${o === me ? 0.55 : 0.48}"/>`
    // 둘레 안쪽의 또렷한 제 색 선 — 이웃 나라와 맞닿으면 두 색이 나란히 선다 (문명 6 국경)
    crisp += `<path d="${d}" clip-path="url(#rm-own-${o})" stroke="${col}" stroke-width="${(9 * k).toFixed(1)}" opacity=".95"/>`
  }
  const blurK = (3 * k).toFixed(1)
  let h = `<defs><filter id="rm-band" x="-2%" y="-2%" width="104%" height="104%"><feGaussianBlur stdDeviation="${blurK}"/></filter>${cps}</defs>`
  h += `<g class="terr"${clip}>${fill}<g fill="none" stroke-linecap="round" stroke-linejoin="round" filter="url(#rm-band)">${band}</g><g fill="none" stroke-linejoin="round">${crisp}</g>`
  // 우리 땅 — 옅은 금빛 (빗금은 비 같다고 해서 뺐다 · 형: "비오는줄알았다"). 금빛 경계가 천천히 숨 쉰다
  if (mine !== '') h += `<path d="${mine}" fill="#ffe7a8" opacity=".13"/>`
  h += `<g fill="none" stroke-linecap="round" stroke-linejoin="round">${lines}`
  if (gold !== '') h += `<path d="${gold}" stroke="#2a1d10" stroke-width="${(6.5 * k).toFixed(1)}" opacity=".55"/><path class="mine-edge" d="${gold}" stroke="#ffd27a" stroke-width="${(3.2 * k).toFixed(1)}"/>`
  return h + `</g></g>`
}

/**
 * 판의 고을(id 순)과 그 땅 — 산·강·뭍을 따라 가른다 (territory.ts). 고을 자리는 안 바뀌니 판마다 한 번만 셈한다.
 * 뭍 자료가 없는 판(변한 축소판)은 바다로 번지지 않게 퍼지는 끝을 줄인다.
 */
function terrOf(r: Realm, region: RegionId, W: number, H: number, terrR: number): { nodes: Realm['nodes'][string][]; t: Territory } {
  const nodes = Object.values(r.nodes).sort((x, y) => (x.id < y.id ? -1 : 1))
  const nat = naturalLines(region, W, H)
  const seeds = nodes.map((n) => {
    const p = nodePos(region, n.id) ?? [0.5, 0.5]
    return { x: p[0] * W, y: p[1] * H, size: CELL_SIZE[n.kind] }
  })
  return { nodes, t: territory(`${region}:${W}x${H}:${nodes.length}`, W, H, terrR * (nat.land === null ? 1.15 : 1.5), { seeds, ...nat }) }
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
  const { nodes, t } = terrOf(r, region, W, H, terrR)
  const blur = Math.round(terrR * 0.3)
  let holes = ''
  for (const [i, d] of t.fills.entries()) {
    const id = nodes[i]!.id
    if (!vis.has(id)) continue
    const p = nodePos(region, id)
    // 땅을 못 받은 고을(이웃에 다 먹힌 작은 자리)도 제 둘레는 보인다
    const dot = p !== undefined ? `M${(p[0] * W - terrR * 0.5).toFixed(1)} ${(p[1] * H).toFixed(1)}a${(terrR * 0.5).toFixed(1)} ${(terrR * 0.5).toFixed(1)} 0 1 0 ${terrR.toFixed(1)} 0a${(terrR * 0.5).toFixed(1)} ${(terrR * 0.5).toFixed(1)} 0 1 0 ${(-terrR).toFixed(1)} 0Z` : ''
    holes += `<path d="${d}${dot}"${fresh(id) ? ' class="fresh"' : ''}/>`
  }
  for (const d of corridors) holes += `<path d="${d}" fill="none" stroke="#000" stroke-width="${Math.round(terrR * 1.6)}" stroke-linecap="round" stroke-linejoin="round"/>`
  const tile = Math.round(Math.min(W, H) * 0.42)
  // 거르개 자리는 판 전체 — 본 땅이 좁으면 ±5% 자리 밖으로 번진 먹이 잘려 곧은 금이 생겼다
  const defs = `<filter id="rm-fog-blur" filterUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}">`
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
