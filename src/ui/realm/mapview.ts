/**
 * 그린 지도 — 글자 지도 위에 얹는 한 장 (docs/realm/SYSTEMS §13 · ART ⑩⑪ · 형: "파인다이닝식으로 담는다")
 *
 * 계절마다 같은 땅의 네 철 그림이 바탕이고, 그 위에 길(SVG)·고을 기호·우리 군대·고른 출정 화살을 얹는다.
 * **땅은 다 보이고 군세는 아는 만큼** (정보의 계약, 2026-10-18 고침): 고을·길·주인은 다 그린다. 남의 군세는 우리 intel 에 있는 만큼만.
 * 상태를 읽기만 하고 HTML 문자열을 돌려준다 — 고르는 손짓(고을 누르기)은 글자 지도가 data-node 로 받는다.
 * 자리·그림 이름은 realm/data/art.ts.
 */
import { headcount } from '../../realm/battle.ts'
import { FACTION_ART, GOOD_ICON, REGION_ART, SEASON_MAP, bustOf, flagIcon, nodeIcon, nodePos } from '../../realm/data/art.ts'
import { EDGE_NAME, GOOD_NAME, NODE_KIND_NAME, NODE_NOW, tagNow } from '../../realm/data/prose.ts'
import { worldGeoOf } from '../../realm/data/regions/index.ts'
import { relationOf } from '../../realm/diplomacy.ts'
import { knows } from '../../realm/discovery.ts'
import { postHero, rulerOf } from '../../realm/heroes.ts'
import { crowdOf, isCoast, nodeHarvest, nodeSpecials, nodeYield } from '../../realm/economy.ts'
import { visibleRange } from '../../realm/intel.ts'
import { customMarks } from '../../realm/hooks.ts'
import { blockedWhy, forceOf, seasonOf } from '../../realm/season.ts'
import type { EdgeKind, NodeKind, Realm, REdge, RegionId, SeasonOfYear } from '../../realm/types.ts'
import { P } from '../../tune/params.ts'
import { curvePts, ferryAt, landClipSvg, midOf, riversSvg, smoothPath, tidyEnds, trimPolyline, type Pt } from './mapgeo.ts'
import { boardRoutes, boardTerritory } from './roadlayout.ts'
import { kitVars, nationKit } from './kitcolor.ts'
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
 * 길의 생김새 — 테두리 두른 관 대신 밟아 다진 흙길처럼 (형: "길같지가 않고 오브젝트같아" · 10-26: "길은 길답게").
 * 같은 줄을 겹겹이 긋는다 (그림 한 장 없이, 한 번 그리면 끝 — 밀 때 다시 셈하지 않는다):
 *   어깨(sh) — 길가의 닳은 풀·흙, 넓고 옅게 두 겹 · 가장자리(edge) — 바닥보다 조금 넓은 짙은 흙선이라 붓으로 그은 길 테가 된다
 *   바닥(bed) — 길 자체 · 바퀴 자국(rut) — 바닥 빛으로 가운데를 다시 덮어 남는 두 가는 줄 · 결(tex) — 돌·판자·나무 그늘을 끊긴 줄로
 *   가운데(mid) — 밟혀 밝게 닳은 자리 · 물살
 */
interface RoadTex {
  readonly c: string
  /** 굵기 (바닥과 같은 눈금) */
  readonly w: number
  readonly dash: string
  readonly op: number
  readonly off?: number
  /** 끝 모양 — 판돌·판자는 모난 끝(butt), 그 밖엔 둥글게 */
  readonly cap?: 'butt'
}
interface RoadLook {
  readonly sh: string
  readonly shW: number
  readonly edge?: string
  readonly bed: string
  readonly bedW: number
  readonly bedDash?: string
  readonly rut?: string
  readonly tex?: readonly RoadTex[]
  readonly mid?: string
  readonly midW?: number
  readonly midDash?: string
  readonly midOp?: number
}
const ROAD_LOOK: Readonly<Record<EdgeKind, RoadLook>> = {
  // 들길 — 넓은 흙길에 수레바퀴 두 줄, 가운데는 밟혀 밝다
  field: { sh: '#ead6a0', shW: 15, edge: '#4a321c', bed: '#9a6e40', bedW: 7, rut: '#5e3e20', mid: '#e6cc96', midW: 1.1, midOp: 0.55 },
  // 고갯길 — 좁은 돌길: 크기가 들쭉날쭉한 돌을 엇갈려 깐다 (가장자리 두 줄과 가운데 줄의 이음매가 어긋난다 — 한 줄로 맞추면 철길 같았다).
  // 돌 틈은 바닥보다 조금 짙을 뿐 (예전엔 고르게 찍힌 흰 점이라 사슬·구슬 꿴 줄 같았다)
  pass: { sh: '#d4c4a2', shW: 12, edge: '#2a2016', bed: '#56493a', bedW: 4.6, tex: [
    { c: '#857560', w: 4, dash: '2.2 0.5 1.6 0.5 2.7 0.5 1.9 0.5', op: 1, cap: 'butt' },
    { c: '#94846c', w: 1.7, dash: '1.3 0.5 2.4 0.5 1.7 0.5 2.1 0.5', op: 1, off: 1.1, cap: 'butt' },
    { c: '#3a2e22', w: 1.1, dash: '0.1 7 0.1 11 0.1 5', op: 0.45, off: 2 },
  ] },
  // 숲길 — 좁은 오솔길에 나무 그늘이 띄엄띄엄 가로지른다
  forest: { sh: '#8aa562', shW: 14, edge: '#2c2a16', bed: '#6a5232', bedW: 4.6, mid: '#a88a5a', midW: 0.9, midDash: '4 7', midOp: 0.6, tex: [
    { c: '#24381a', w: 8, dash: '7 13 4 19', op: 0.4 },
  ] },
  // 갈대밭 — 판자를 깐 둑길
  reeds: { sh: '#d2ca82', shW: 14, edge: '#3a3418', bed: '#9a8a56', bedW: 5, tex: [{ c: '#5a4a26', w: 5, dash: '1.1 2.3', op: 0.7, cap: 'butt' }] },
  // 나루 — 물을 건너는 자리 (물살)
  ford: { sh: '#d4ebf6', shW: 14, edge: '#1d4a6a', bed: '#3d7fa8', bedW: 6, mid: '#eef8ff', midW: 1.8, midDash: '5 9' },
  sea: { sh: '#e4f6ff', shW: 13, bed: '#22608f', bedW: 4.5, bedDash: '8 8' }, // 뱃길 — 멀리 건너오는 길이라 또렷하게
  // 갯벌 — 질척한 바닥에 발자국
  mudflat: { sh: '#dcd1ba', shW: 14, edge: '#3a342a', bed: '#857a68', bedW: 5, tex: [{ c: '#4a4236', w: 1.6, dash: '1.4 4.2', op: 0.6 }] },
}

/** 길 한 줄의 SVG — 지도와 길 보기(범례)가 같은 것을 쓴다. k 굵기 배율 · op 흐림(막힌 길) */
export function roadSvg(d: string, kind: EdgeKind, k: number, op = 1, title = ''): string {
  const L = ROAD_LOOK[kind]
  const w = (x: number): string => (x * k).toFixed(1)
  const dash = (x: string | undefined): string => (x === undefined ? '' : ` stroke-dasharray="${x.split(' ').map((v) => w(Number(v))).join(' ')}"`)
  const o = (x: number): string => (x * op).toFixed(2)
  const line = (c: string, wd: number, a: number, extra = '', cap = 'round'): string =>
    `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w(wd)}" stroke-linecap="${cap}" stroke-linejoin="round" opacity="${o(a)}"${extra}/>`
  let s = line(L.sh, L.shW * 1.55, 0.2) + line(L.sh, L.shW, 0.36)
  if (L.edge !== undefined) s += line(L.edge, L.bedW + 2.2, 0.75, dash(L.bedDash))
  s += `<path d="${d}" fill="none" stroke="${L.bed}" stroke-width="${w(L.bedW)}"${dash(L.bedDash)} stroke-linecap="round" stroke-linejoin="round" opacity="${o(0.95)}">${title !== '' ? `<title>${title}</title>` : ''}</path>`
  if (L.rut !== undefined) s += line(L.rut, L.bedW * 0.78, 0.65) + line(L.bed, L.bedW * 0.5, 1)
  for (const t of L.tex ?? []) s += line(t.c, t.w, t.op, `${dash(t.dash)}${t.off !== undefined ? ` stroke-dashoffset="${w(t.off)}"` : ''}`, t.cap ?? 'round')
  if (L.mid !== undefined) s += line(L.mid, L.midW ?? 1.5, L.midOp ?? 0.85, dash(L.midDash))
  return s
}

/**
 * 출정 화살의 꼴 (지도 좌표 · 화면의 생김새라 params 가 아니라 여기 둔다).
 * 흐르는 점선은 모두 한 마디(period) — keyframes 가 꼭 한 마디만큼 돌아 이음매에서 튀지 않는다 (형 10-30: "툭툭 끊어지고").
 */
const ARROW = {
  /** 흐르는 점선 한 마디 (칠 + 틈) */
  period: 23,
  /** 고을 그림 반지름의 몫 — 화살은 고을 그림 밖에서 떠나 그림 앞에서 멎는다 */
  iconR: 0.36,
  /** 끝을 당기는 것은 그 걸음 길이의 이 몫까지만 (가까운 고을 사이에도 화살이 남게) */
  maxTrim: 0.34,
  /** 끝 곁의 잔 점을 덜어 내는 몫 (tidyEnds) */
  tidy: 0.12,
  /** 곡선을 쪼개는 수 (구간마다) — 꺾은선으로 그려 자르기·점선이 곡선과 딱 맞는다 */
  sub: 8,
  /** 같은 길을 나눠 쓰는 화살 사이 */
  lane: 13,
  /** 크림빛 바탕 띠가 화살보다 굵은 만큼 */
  casing: 5,
  /** 촉을 다는 실선 끝의 길이 — 점선 틈에 촉이 뜨지 않게 */
  stub: 16,
} as const

/**
 * 지도는 제 상자의 **높이를 꽉 채운다** — 폰 세로에서는 지도가 화면보다 넓어져 옆으로 밀어 본다 (앱 화면, FLOW §5).
 * 글씨·기호 크기는 지도 높이(cqh)를 따른다.
 */
export const MAP_CSS = `
/* --aw: 출정 화살 굵기 — 지도 배율(--z)만큼 부풀지 않고 배율의 제곱근만큼만 (고을 그림·글씨와 같은 결 · 형 10-26: "가까이볼때 군사화살표가 너무 확대") */
.map { --aw: calc(var(--zs, 1) / var(--z, 1)); position: relative; height: 100%; aspect-ratio: ${W} / ${H}; margin: 0 auto; background: #2a261f center / cover no-repeat;
  user-select: none; -webkit-user-select: none; container-type: size;
  /* 가장자리 고을 이름·말이 밖으로 삐져나가 굴릴 자리를 늘리지 않게 — 지도 바깥 빈 바탕까지 끌려 나갔다 (형 10-23: "맵에서 지도 바깥으로 막 나가지지 않게") */
  overflow: clip; }
.map svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.map svg.marr { z-index: 6; pointer-events: none; }
.map .nd { position: absolute; transform: translate(-50%, -62%); width: calc(8.5% * var(--s, 1) * var(--ns, 1) * var(--cs, 1)); text-align: center; cursor: pointer; -webkit-tap-highlight-color: transparent; }
/* 나라가 많은 판 — 당기면 고을 그림이 지도만큼 커지지 않아 서로 벌어진다 (형 10-25: "낙동강 스물한 나라는 마을 이미지가 너무 커서 텍스트가 밀려난다") */
.map[data-region="yeongnam"] .nd, .map[data-region="south"] .nd, .map[data-region="world"] .nd { width: calc(8.5% * var(--s, 1) * var(--ns, 1) * var(--cs, 1) / var(--z, 1) * var(--zs, 1)); }
/* 고을 그림엔 거르개(drop-shadow)를 걸지 않는다 — 그림자는 밑의 받침(.base)이 늘 들고 있다. 거르개는 밀 때 무거워 껐다 켜야 했고,
   그래서 지도를 밀면 그림자가 사라졌다가 멈추면 돋았다 (형 10-26: "맵을 움직일 때 마을 그림자가 없어졌다가 … 깜빡임 버그").
   relative 는 받침 위에 그림이 오게 (받침·그림·고리가 문서 순서대로 쌓인다) */
.map .nd img.st { position: relative; width: 100%; }
.mapwrap.panning .map .nd, .mapwrap.panning .map .nd * { animation-play-state: paused !important; } /* 미는 동안 (zoom.ts) — 멈출 뿐 모습은 그대로 */
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
/* 우리와의 사이 칩 — 이름표 깃발 곁 */
.map .lb .lbr { flex: none; font-style: normal; font-weight: 800; font-size: .78em; line-height: 1; padding: .18em .38em; border-radius: .5em; margin-right: .25em; border: 1px solid #0008; box-shadow: 0 1px 2px #0006; }
.map .lb .lbr.war { background: #b3261e; color: #fff; animation: lbrwar 1.4s ease-in-out infinite alternate; }
.map .lb .lbr.ally { background: #2e7d32; color: #fff; } .map .lb .lbr.tru { background: #4a90b8; color: #fff; }
.map .lb .lbr.tri { background: #d4a72c; color: #1c140a; } .map .lb .lbr.srv { background: #6b6358; color: #fff; }
@keyframes lbrwar { from { box-shadow: 0 1px 2px #0006; } to { box-shadow: 0 0 6px #ff4a3a; } }
@media (prefers-reduced-motion: reduce) { .map .lb .lbr.war { animation: none; } }
.map .nd .gov.lord { width: 40%; border-color: #ffd77a; box-shadow: 0 0 0 1px #000, 0 0 10px #ffd77acc, 0 2px 6px #000c; }
.map .nd .gov.lord.away { filter: grayscale(.8) brightness(.7); box-shadow: 0 0 0 1px #000, 0 2px 6px #000c; }
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
/* 고을 배너 — 깃발·이름·군세가 한 덩어리 (문명 6 도시 배너 · Old World 의 위계 — docs/GAP.md M1)
   주인 나라의 두 빛을 입는다 — 몸은 바탕 빛(--c), 굵은 왼 띠와 테는 둘째 빛(--c2), 글씨는 바탕에 맞춘 먹빛·흰빛(--ink) (kitcolor.ts · 형 10-26: "축구팀 유니폼 2가지 색") */
.map .lb { position: absolute; transform: translateX(-50%); text-align: center; white-space: nowrap; display: flex; align-items: center; gap: .18em;
  font-size: clamp(10px, calc(1.9cqh / var(--z, 1) * var(--zs, 1) * var(--ls, 1)), 16px); line-height: 1.2; color: var(--ink, #2a1d10); font-weight: 700;
  background: linear-gradient(color-mix(in srgb, var(--c, #f6ecd4) 82%, #fff), var(--c, #efe2c4)); border: .13em solid var(--c2, #8a7a5a);
  border-left: .55em solid var(--c2, #8a7a5a); border-radius: .2em .55em .55em .2em; padding: 0 .35em 0 .22em; box-shadow: 0 0 0 1px #1a120ad0, 0 1px 3px #0006; }
/* 나라 많은 판 — 이름표를 작게 (한 줄 · 글씨 작게 · 깃발·특산 칸도 작게) */
.map[data-region="yeongnam"] .lb, .map[data-region="south"] .lb, .map[data-region="world"] .lb { font-size: clamp(8px, calc(1.9cqh / var(--z, 1) * var(--zs, 1) * var(--ls, 1)), 12.5px); border-left-width: .45em; padding: 0 .28em 0 .16em; }
.map[data-region="yeongnam"] .lb .lbg img, .map[data-region="south"] .lb .lbg img, .map[data-region="world"] .lb .lbg img { width: 1.25em; height: 1.25em; }
.map .lb small.nowi { display: inline; font-size: .68em; font-weight: 500; margin: 0 0 0 .3em; opacity: .75; }
.map .lb .lbe { width: 1.1em; height: 1.1em; object-fit: contain; flex: none; filter: drop-shadow(0 0 1px #fff); }
.map .lb .lbt { display: flex; flex-direction: column; align-items: flex-start; }
.map .lb .lbf { margin-left: .25em; padding: 0 .35em; border-radius: .6em; background: #2a1414; color: #f0b8a0; font-size: .82em; font-weight: 800; }
.map .lb .lbf.old { opacity: .6; }
/* 도읍 — 크고 두껍게, 금빛 별 */
.map .lb.k-cap { font-size: clamp(11px, calc(2.2cqh / var(--z, 1) * var(--zs, 1) * var(--ls, 1)), 18px); border-width: .17em; border-left-width: .62em; }
/* 빈땅·소도 — 주인 없는 땅은 띠 없이 옅게 (위계가 낮다) */
.map .lb.k-free { background: #f3e6c8; border-color: #8a6a3e; border-left-color: #8a6a3e; border-left-width: .2em; box-shadow: none; font-weight: 600; font-style: italic; color: #4a3a28; } /* 비침 없이 또렷하게 (형 10-28: "소도랑 들은 이름택에 opacity · 잘 안 보이니까") */
/* 우리 고을 — 두 빛 바깥에 금빛 테 (남의 나라 옷과 섞여도 우리 것이 먼저 보인다) */
.map .lb.me { box-shadow: 0 0 0 1px #1a120a, 0 0 0 2.6px #ffd27a, 0 0 7px #ffd27acc; }
.ap.hide-flags .map .lb .lbe { display: none; } .ap.hide-force .map .lb .lbf { display: none; }
.map .lb .star { font-style: normal; color: #b8860b; margin-right: 2px; text-shadow: 0 0 2px #fff8d0, 0 0 3px #fff8d0; } /* 도읍 (형: "수도같은건 별표해야하지 않나?") */
/* 지금 땅이름 줄은 가까이 볼 때만 (멀리서는 배너가 한 줄로 작게) */
/* 빽빽한 판을 멀리 볼 때 — 이름표의 꾸밈 칩(목책·특산)과 같은 나라 고을 사이 점선은 가까이 볼 때만 (형 10-26: "이미지랑 마을 이름 텍스트 서로 자리 차지") */
.map[data-zl="far"][data-region="yeongnam"] .lb .lbg, .map[data-zl="far"][data-region="south"] .lb .lbg, .map[data-zl="far"][data-region="world"] .lb .lbg { display: none; }
.map[data-zl="far"][data-region="yeongnam"] svg .tw, .map[data-zl="far"][data-region="south"] svg .tw, .map[data-zl="far"][data-region="world"] svg .tw { display: none; }
/* 빽빽한 판을 멀리 볼 때 — 길은 옅게, 길 기호(소달구지·돌다리…)와 남의 군세 어림 칩은 가까이 볼 때만. 막힌 길의 ✕ 는 남는다 */
.map[data-zl="far"][data-region="yeongnam"] .ly-roads, .map[data-zl="far"][data-region="south"] .ly-roads, .map[data-zl="far"][data-region="world"] .ly-roads { opacity: .62; }
.map[data-zl="far"][data-region="yeongnam"] svg .rsign, .map[data-zl="far"][data-region="south"] svg .rsign, .map[data-zl="far"][data-region="world"] svg .rsign { display: none; }
.map[data-zl="far"][data-region="yeongnam"] .lb .lbf, .map[data-zl="far"][data-region="south"] .lb .lbf, .map[data-zl="far"][data-region="world"] .lb .lbf { display: none; }
/* 빽빽한 판을 멀리 볼 때 — 이름표는 깃발 · 별 · 이름만 (지금 땅 이름은 숨기고), 나라 사이(전쟁·동맹…)는 글 대신 색 점 하나, 나라 둘레는 굵고 짙게
   (형 10-26: "멀리 볼 때는 마을 수십 개 — 이름표 바가 더 단순하게 · 국경들도 명확하고 · 가까울 때 더 많은 정보는 잘했어") */
.map[data-zl="far"][data-region="yeongnam"] .lb small, .map[data-zl="far"][data-region="south"] .lb small, .map[data-zl="far"][data-region="world"] .lb small { display: none !important; }
.map[data-zl="far"][data-region="yeongnam"] .lb .lbr, .map[data-zl="far"][data-region="south"] .lb .lbr, .map[data-zl="far"][data-region="world"] .lb .lbr { font-size: 0; width: .62em; height: .62em; padding: 0; border-radius: 50%; margin-right: .3em; animation: none; box-shadow: 0 0 0 1.5px #1a120a; }
.map[data-zl="far"][data-region="yeongnam"] svg .nb, .map[data-zl="far"][data-region="south"] svg .nb, .map[data-zl="far"][data-region="world"] svg .nb { stroke-width: 20; opacity: 1; }
.map[data-zl="far"][data-region="yeongnam"] svg .nbd, .map[data-zl="far"][data-region="south"] svg .nbd, .map[data-zl="far"][data-region="world"] svg .nbd { opacity: .55; }
.map[data-zl="far"] .lb small { display: none; } .map[data-zl="far"] .lb small.nowi, .map .lb small.nowi { display: inline; }
.map .lb small { display: block; font-size: .74em; font-weight: 500; color: var(--ink, #5a4a36); opacity: .78; margin-top: -2px; }
.map .lb.k-free small { color: #5a4a36; }
/* 받침 — 주인 빛으로 칠한 흙판에 짙은 테, 그 위에 고을이 드리운 그림자 (고을이 떠 있지 않고 땅에 앉게 · 형 10-26: "마을 이미지 고도화").
   길·땅빛(SVG) 위, 고을 그림 밑. 그림자도 여기 그라데이션이라 지도를 밀 때 아무것도 껐다 켜지 않는다. 도읍은 크고 금빛 겹테 */
.map .nd .base { position: absolute; left: 50%; top: 82%; width: 118%; aspect-ratio: 2.7; transform: translate(-50%, -50%); pointer-events: none;
  background: url(__ART__fx/ground-shadow.png) center / 100% 100% no-repeat; } /* 땅에 깔린 그림자만 — 나라 색 타원은 뺐다 (형 10-29: "마을마다 바닥에 이상한 타원 · 왜 있는지 다시 생각해") · 나라 색은 이름표 띠와 땅 둘레 선이 이미 보여 준다 */
/* 도읍은 크게 — 군장이 있는 곳 (형: "도읍은 별표가 있기는 하지만 이미지도 좀 달라야") */
.map .nd.k-cap { --cs: 1.45; z-index: 2; }
.map .nd.k-cap .base { width: 132%; }
.map .nd.k-free .base { opacity: .6; }
/* 고리 — 평소엔 없다. 고를 때 · 갈 곳 · 위협받을 때만. 그림 뒤에 두어 그림 위에 걸린다 */
.map .nd .ring { position: absolute; left: 50%; top: 42%; width: 82%; aspect-ratio: 1; transform: translate(-50%, -50%);
  border-radius: 50%; border: 3px solid var(--c); box-shadow: 0 0 6px var(--c); pointer-events: none; display: none; }
.map .nd.tgt .ring, .map .nd.threat .ring { display: block; }
/* 소도 — 큰 나무에 방울과 북을 단 신성한 숲 (형 10-29: "신성한 중립 지역이니까 맵에서도 제대로").
   둘레에 금줄(왼새끼 · 솔가지 · 숯 · 한지 띠)을 두르고, 방울 소리가 물결처럼 퍼지고, 한지 띠가 바람에 날아오른다.
   빛은 미리 구운 그림(그 폰은 CSS 그러데이션·거르개를 못 그린다 — gfxsafe) · 움직임은 transform·opacity 만 · 햇살 무늬 금지 */
.map .nd.k-sodo .sg { position: absolute; left: 50%; top: 40%; width: 150%; transform: translate(-50%, -50%); pointer-events: none; z-index: 0; opacity: .6; animation: holyb 4.2s ease-in-out infinite alternate; }
/* 금줄 — 땅에 납작하게. 뒤쪽 반은 숲 뒤, 앞쪽 반은 숲 앞 (같은 그림을 위아래로 잘라 둘) */
.map .nd.k-sodo .sr { position: absolute; left: 50%; top: 84%; width: 190%; aspect-ratio: 2.4; transform: translate(-50%, -50%); pointer-events: none; z-index: 0; clip-path: inset(0 0 50% 0); }
.map .nd.k-sodo .sr.f { z-index: 2; clip-path: inset(50% 0 0 0); }
/* 방울 소리 — 금줄 안에서 물결처럼 퍼진다 */
.map .nd.k-sodo .sp { position: absolute; left: 50%; top: 84%; width: 150%; aspect-ratio: 2.4; border-radius: 50%; border: 2px solid #fff3c8; pointer-events: none; z-index: 0; opacity: 0; animation: holyp 4.8s ease-out infinite; }
.map .nd.k-sodo .sp + .sp { animation-delay: 2.4s; }
/* 한지 띠 — 바람에 하나씩 날아오른다 (낱낱이 · 메모리 effects-individual-particles) */
.map .nd.k-sodo .sc { position: absolute; top: 74%; width: 7%; pointer-events: none; z-index: 2; opacity: 0; animation: holym 6s ease-in infinite; }
.map .nd.k-sodo .sc.c1 { left: 14%; } .map .nd.k-sodo .sc.c2 { left: 78%; animation-delay: 2s; } .map .nd.k-sodo .sc.c3 { left: 46%; animation-delay: 4s; }
@keyframes holyb { from { opacity: .45; } to { opacity: .85; } }
@keyframes holyp { 0% { transform: translate(-50%, -50%) scale(.4); opacity: .9; } 100% { transform: translate(-50%, -50%) scale(1.1); opacity: 0; } }
@keyframes holym { 0% { transform: translate(0, 0) rotate(-8deg); opacity: 0; } 15% { opacity: .95; } 100% { transform: translate(120%, -700%) rotate(24deg); opacity: 0; } }
.map .nd.k-sodo img.st { position: relative; z-index: 1; }
@media (prefers-reduced-motion: reduce) { .map .nd.k-sodo .sg { animation: none; } .map .nd.k-sodo .sp, .map .nd.k-sodo .sc { display: none; } }
/* 척후를 보낸 고을 — 작은 표 하나 (움직이지 않는다) */
.map .nd .sctmk { position: absolute; left: 50%; top: -4%; transform: translate(-50%, -100%); display: flex; align-items: center; gap: 2px; padding: 1px 7px 1px 2px; border-radius: 999px; background: #1c2a1ce6; border: 1px solid #8ab07a; color: #d8f0c8; font-size: 11px; font-weight: 700; white-space: nowrap; pointer-events: none; z-index: 5; }
.map .nd .sctmk img { width: 18px; height: 18px; object-fit: contain; }
/* 고른 것 — 고리·금빛 번짐 대신 머리 위에 도는 초록 사각뿔 (싸움판의 보석과 한 벌 · 형 10-29: "전투 때 녹색 3d 포인터 · 맵에서도 · 지금 css 강조효과 너무 별로") */
.map .mgem { position: absolute; left: 50%; top: 2%; z-index: 6; width: 0; height: 0; pointer-events: none; perspective: 260px;
  --a: calc(19px * var(--aw, 1)); --s: calc(26.5px * var(--aw, 1)); --t: 20.9deg; animation: mgembob 1.1s ease-in-out infinite alternate; }
.map .tok .mgem { top: -62%; }
@keyframes mgembob { from { translate: 0 calc(-14px * var(--aw, 1)); } to { translate: 0 calc(-8px * var(--aw, 1)); } }
.map .mgem .g3 { position: absolute; left: 0; top: 0; transform-style: preserve-3d; animation: mgemspin 2.6s linear infinite; }
@keyframes mgemspin { from { transform: rotateX(-22deg) rotateY(0deg); } to { transform: rotateX(-22deg) rotateY(360deg); } }
.map .mgem .gf { position: absolute; left: calc(var(--a) / -2); top: 0; width: var(--a); height: var(--s); transform-origin: 50% 0; clip-path: polygon(0 0, 100% 0, 50% 100%); backface-visibility: visible; }
.map .mgem .f0 { transform: rotateY(0deg) translateZ(calc(var(--a) / 2)) rotateX(calc(var(--t) * -1)); background: #3fd46a; }
.map .mgem .f1 { transform: rotateY(90deg) translateZ(calc(var(--a) / 2)) rotateX(calc(var(--t) * -1)); background: #1f9e48; }
.map .mgem .f2 { transform: rotateY(180deg) translateZ(calc(var(--a) / 2)) rotateX(calc(var(--t) * -1)); background: #13702f; }
.map .mgem .f3 { transform: rotateY(270deg) translateZ(calc(var(--a) / 2)) rotateX(calc(var(--t) * -1)); background: #2bba57; }
.map .mgem .gt { position: absolute; left: calc(var(--a) / -2); top: calc(var(--a) / -2); width: var(--a); height: var(--a); transform: rotateX(90deg); background: #9dffbe; box-shadow: inset 0 0 0 2px #d8ffe6; }
@media (prefers-reduced-motion: reduce) { .map .mgem, .map .mgem .g3 { animation: none; } }
/* 위협 — 적이 오는 우리 고을 (Total War 의 붉은 영향권 — GAP M4) */
.map .nd.threat .ring { border: 3px solid #d0301c; box-shadow: 0 0 0 4px #d0301c44, 0 0 16px #d0301c; animation: thr 1.1s ease-in-out infinite alternate; }
@keyframes thr { from { opacity: .45; } to { opacity: 1; } }
.map .nd .thr { position: absolute; left: 50%; top: -18%; transform: translateX(-50%); font-size: clamp(11px, calc(2.2cqh / var(--z, 1) * var(--zs, 1)), 18px);
  color: #fff; background: #b0281a; border-radius: 50%; width: 1.5em; height: 1.5em; line-height: 1.5em; box-shadow: 0 0 8px #d0301c; pointer-events: none; z-index: 2; }
/* 갈 수 없는 곳 — 군대를 고르면 흐려진다 (이동 범위만 또렷 — GAP M3) */
.map .nd.far { opacity: .42; filter: saturate(.5); } .map .lb.far { opacity: .45; }
.map svg .mvglow { animation: mvg .6s linear infinite; } @keyframes mvg { to { stroke-dashoffset: -20; } }
/* 위협 화살은 또렷하게 떠나 옅어진다 — 저사양·쉼(q-rest)에서 처음 장면에 멈춰도 진하게 보이게 */
.map svg .thrarrow { animation: thrarw 1s ease-in-out infinite alternate; } @keyframes thrarw { from { opacity: 1; } to { opacity: .6; } }
@media (prefers-reduced-motion: reduce) { .map .nd.threat .ring, .map svg .mvglow, .map svg .thrarrow { animation: none; } }
/* 특산 — 고을 그림 오른쪽 위에 작은 둥근 표 (쇠·소금·나무·말). 아무도 안 사는 땅은 흐리게 — 일구면 난다 */
/* 작게 겹쳐 쌓는다 — 넷이 나란히 서면 고을 그림과 길을 덮었다 (형: "자원들이랑 지도 길 이런거랑 좀안겹치게") */
.map .lb .lbg { display: inline-flex; align-items: center; gap: .1em; margin-left: .3em; padding: .1em .32em; border-radius: .55em; background: linear-gradient(#3a2a18f0, #20160cf0);
  box-shadow: inset 0 0 0 1px #c8a05099, 0 1px 2px #0006; }
.map .lb .lbg img { width: 1.5em; height: 1.5em; margin: -.18em -.04em; object-fit: contain; border-radius: 50%; filter: drop-shadow(0 1px 1px #000c);
  background: radial-gradient(circle, #fff3d4 0, #f0d9a0cc 38%, #f0d9a000 68%); }
.map .lb .lbg.idle img { opacity: .55; filter: saturate(.4) drop-shadow(0 0 1px #000c); }
.map .lb .lbg i { font-style: normal; font-size: .7em; font-weight: 700; color: #f3e3bd; padding-left: .35em; margin-left: .15em; border-left: 1px solid #c8a05066; }
.map .lb .lbg i.moat { color: #bfe0ff; } .map .lb .lbg i.earthwall { color: #f0c890; }
.map .lb .lbg i.cmk { color: #ffd2a0; } .map .lb .lbg i.cmk.hot { color: #fff1c8; text-shadow: 0 0 6px #ff9a4a; animation: cmkhot 1.6s ease-in-out infinite; }
@keyframes cmkhot { 50% { text-shadow: 0 0 12px #ffb060, 0 0 2px #fff; } }
@media (prefers-reduced-motion: reduce) { .map .lb .lbg i.cmk.hot { animation: none; } }
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
.map .nd .tchip .tn.when { margin-left: 3px; } .map .nd .tchip .tn.far { margin-left: 3px; background: #2a3a4aee; color: #bfe0ff; }
/* 먼 곳 — 고르기 전엔 고리·칩 없이 조용히 (누르면 간다 · 고른 곳만 고리) · 판 가득 도는 고리가 버벅였다 (형 10-26) */ .map .nd.tgt.farg:not(.on) .ring { display: none; } .map .nd .tchip .tn.pin { margin-left: 3px; background: #4a3a14ee; color: #ffe08a; box-shadow: 0 0 0 1px #ffd27a; }
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
/* 살아 있는 말 — 쉬는 군대는 들썩이고 · 군기가 펄럭이고 · 명령이 없으면 「명령?」 */
.map .tok.idle { animation: tokidle 2.2s ease-in-out infinite alternate; } .map .toks .tok.idle:nth-child(2) { animation-delay: -.8s; } .map .toks .tok.idle:nth-child(3) { animation-delay: -1.5s; }
@keyframes tokidle { from { transform: translateY(0); } to { transform: translateY(-14%); } }
/* 유닛 — 땅에 선 병사 셋 + 장수 메달 (형 10-28: "맵에서 유닛들 선택하고 싶게 · 둥실 떠다니기만 하면 뭐하냐 · 유닛처럼").
   떠다니지 않는다: 병사가 제자리에서 숨 쉬고(동작 그림 0·1컷) · 고르면 발밑에 금빛 고리 + 무기를 치켜든다 · 길 위에선 걷는다.
   그림자는 단색 + blur (갤럭시 크롬이 부드러운 그러데이션을 못 그린다) */
.map .tok.unit { width: calc(clamp(26px, calc(4.2cqh / var(--z, 1) * var(--zs, 1) * var(--ls, 1)), 46px) * 2); }
.map .tok.unit.idle, .map .toks.mv .tok.unit { animation: none; }
.map .tok.unit > img { position: absolute; left: -10%; top: -26%; width: 42%; z-index: 3; }
.map .tok.unit .squad { position: relative; display: flex; justify-content: center; align-items: flex-end; width: 100%; aspect-ratio: 1.55 / 1; }
.map .tok.unit .squad::before { content: ''; position: absolute; left: 6%; right: 6%; bottom: -6%; height: 24%; border-radius: 50%; background: #000b; filter: blur(2px); z-index: -1; }
.map .tok.unit .sq { position: relative; height: 100%; aspect-ratio: var(--ar, 1); margin: 0 -13%; }
.map .tok.unit .sq:nth-child(2) { z-index: 1; height: 92%; margin-bottom: 4%; }
.map .tok.unit .sq u { position: absolute; inset: 0; pointer-events: none; /* 공격 칸 때문에 그림이 칸보다 3배 넓어 투명한 자리가 옆 고을을 덮고 누름을 먹었다 · 누름은 .squad 칸이 받는다 (형 10-30: "군사가 있으면 마을 선택이 안돼") */ background: 0 0 / calc(var(--nf, 8) * 100%) 100% no-repeat; animation: mqidle calc(calc(1.25s + var(--k, .5) * .7s) * var(--mqidles, 1)) steps(var(--mqidlen, 2)) calc(var(--k, .5) * -1.6s) infinite; /* 병사마다 박자를 따로 (형 10-28) */ }
@keyframes mqidle { from { background-position-x: var(--i0, 0%); } to { background-position-x: var(--i1, 28.5714%); } }
@keyframes mqwalk { from { background-position-x: var(--w0, 28.5714%); } to { background-position-x: var(--w1, 57.1429%); } }
@keyframes mqatk { from { background-position-x: var(--a0, 57.1429%); } to { background-position-x: var(--a1, 85.7143%); } }
/* 새 20컷 띠(v2 · tools/anim-pack.py) — 칸이 넓다. 병사 자리는 옛 비 그대로, 안의 그림만 --r 배 넓혀 가운데에 (형 10-29) */
.map .tok.unit .sq.v2 u { left: 50%; right: auto; width: calc(var(--r, 1) * 100%); transform: translateX(-50%); --nf: 20; --i0: 0%; --i1: 21.0526%; --w0: 21.0526%; --w1: 63.1579%; --a0: 63.1579%; --a1: 94.7368%; --al: 89.4737%; --fl: 94.7368%; --mqidlen: 4; --mqwalkn: 8; --mqatkn: 6; --mqidles: 1.6; --mqwalks: 1.4; --mqatks: 1.3; --spdraws: 1.2; }
.map .tok.unit.going .sq u, .map .toks.mv .tok.unit .sq u { animation: mqwalk calc(.42s * var(--mqwalks, 1)) steps(var(--mqwalkn, 2)) calc(var(--j) * -.14s) infinite; }
.map .tok.unit.sel .sq u { animation: mqatk calc(.32s * var(--mqatks, 1)) steps(var(--mqatkn, 2)) calc(var(--j) * .06s) 3, mqidle calc(calc(1.25s + var(--k, .5) * .7s) * var(--mqidles, 1)) steps(var(--mqidlen, 2)) calc(1.1s - var(--k, .5) * 1.6s) infinite; }
.map .tok.unit .squad::after { content: ''; position: absolute; left: -4%; right: -4%; bottom: -14%; height: 34%; border-radius: 50%; border: 2px solid transparent; z-index: -1; pointer-events: none; }
@media (hover: hover) { .map .tok.unit:not(.sel):not(.foe):hover .squad::after { border-color: #ffd27a88; } }
.map .tok.unit.foe .squad { transform: scaleX(-1); }
.map .tok.unit.foe .squad::after { border-color: #e0604a99; }
.map .tok.unit .flag { left: -2%; top: -46%; height: 80%; }
/* 병사 그림 말 — 사람 수(초록) 바로 밑에 사기 막대(노랑) · 숫자 칸에 가려 안 보였다 */
.map .tok.unit .hp { position: relative; order: 9; left: auto; right: auto; top: auto; width: 46%; margin-top: 2px; box-shadow: 0 0 0 1px #201811, 0 1px 3px #000a; }
@media (prefers-reduced-motion: reduce) { .map .tok.unit .sq u { animation: none !important; } .map .tok.unit.sel .squad::after { animation: none; } }
.map .tok .flag { position: absolute; left: 4%; top: -34%; width: 6%; height: 70%; background: #5a3a1a; border-radius: 2px; z-index: -1; }
.map .tok .flag::after { content: ''; position: absolute; left: 100%; top: 0; width: 520%; height: 34%; min-height: 6px; background: linear-gradient(90deg, var(--tc, #c8402a), var(--tc2, var(--tc, #c8402a))); clip-path: polygon(0 0, 100% 0, 80% 50%, 100% 100%, 0 100%); transform-origin: left center; animation: tokflag 1.1s ease-in-out infinite alternate; }
@keyframes tokflag { from { transform: skewY(0deg) scaleX(1); } to { transform: skewY(-10deg) scaleX(.86); } }
.map .tok .ask { position: absolute; left: 64%; top: -30%; z-index: 3; padding: 0 5px; border-radius: 8px 8px 8px 2px; background: #fff3d6; color: #3a2a10; font-size: clamp(9px, calc(1.5cqh / var(--z, 1) * var(--zs, 1)), 12px); font-weight: 800; font-style: normal; white-space: nowrap; box-shadow: 0 1px 3px #0009; transform-origin: left bottom; opacity: 0; animation: tokask var(--ae, 10s) ease-out var(--ad, 0s) infinite; } /* 가끔 2초 — 군대마다 때가 어긋나게 (형 10-29) */
@keyframes tokask { 0% { opacity: 0; transform: scale(.4); } 3% { opacity: 1; transform: scale(1.18) rotate(-4deg); } 6% { transform: scale(1) rotate(2deg); } 8% { transform: scale(1) rotate(0); } 20% { opacity: 1; transform: scale(1); } 24%, 100% { opacity: 0; transform: scale(.9); } }
@media (prefers-reduced-motion: reduce) { .map .tok.idle, .map .tok .flag::after, .map .tok .ask { animation: none; } }
.map .tok img { width: 100%; aspect-ratio: 1; border-radius: 50%; object-fit: cover; border: 2.5px solid var(--tc, #9fd18b); background: #201811; box-shadow: 0 0 0 2.5px var(--tc2, #201811), 0 0 0 3.5px #201811, 0 2px 4px #0008; }
.map .tok .hp { position: absolute; left: 12%; right: 12%; top: calc(100% - 1.05em); height: 4px; border-radius: 2px; background: #201811; overflow: hidden; z-index: 1; }
.map .tok .hp::after { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: calc(var(--p, 1) * 100%); background: linear-gradient(90deg, #6aa84f, #b6e08f); }
.map .tok .hp.mor { height: 5px; } .map .tok .hp.mor::after { background: #f2c94c; box-shadow: inset 0 -1px 0 #b8892a; } /* 사기 — 노랑 · 낮으면 붉은 주황 */
.map .tok .hp.mor.low::after { background: #e8673a; box-shadow: inset 0 -1px 0 #9a3a1a; }
.map .tok .dir { position: absolute; left: 50%; top: 50%; width: 150%; height: 150%; transform: translate(-50%, -50%) rotate(var(--a, 0deg)); pointer-events: none; }
.map .tok .dir::after { content: ''; position: absolute; right: -2px; top: 50%; transform: translateY(-50%); border: .4em solid transparent; border-left: .62em solid #f3e6c8; filter: drop-shadow(0 0 2px #000); }
.map .tok b { position: relative; z-index: 2; margin-top: -6px; background: #201811; color: #9fd18b; border: 1px solid #9fd18b; border-radius: 8px; padding: 0 4px;
  font-size: clamp(10px, calc(1.6cqh / var(--z, 1) * var(--zs, 1)), 13px); line-height: 1.3; }
.map .tok.ally b { color: #cfe8b8; border-color: var(--tc); }
.map .tok.ally img { border-style: double; border-width: 4px; }
.map .tok.foe { cursor: default; } .map .tok.foe b { color: #ffd0c4; background: #6a1a10; border-color: #e0604a; } .map .tok.foe img { filter: saturate(.8) brightness(.9); }
.map .tok.foe.sneak img { filter: brightness(.55) saturate(.6); border-style: dotted; } .map .toks.mv .tok.foe img { border-style: solid; border-color: var(--tc); }
.map .toks.mv .tok.foe.sneak img { border-style: dotted; }
.map .tok.party img { border-style: dashed; background: #3a2c1e; object-fit: contain; padding: 8%; } .map .tok.party b { color: #f0d8b0; border-color: #c8a070; }
.map .tok.sel img { transform: scale(1.08); }
.map .tok.going img { border-color: #c8402a; }
/* 개척할 수 있는 빈땅 — 누르면 그 땅 카드에 "사람 보내기" */
.map .nd .stl { position: absolute; left: 50%; bottom: 100%; transform: translate(-50%, -2px); /* 그림 위에 — 밑에는 고을 이름표가 온다 (형 10-23: "개마 들머리 뒤에 뭐가 있는지 모르겠어") */ white-space: nowrap; pointer-events: none; z-index: 2;
  font-size: clamp(10px, calc(1.6cqh / var(--z, 1) * var(--zs, 1)), 13px); font-weight: 700; color: #f4ffe8; background: #3f6a2ae6; border: 1px solid #b6e08f;
  border-radius: 9px; padding: 0 6px; box-shadow: 0 1px 4px #0008; animation: stlp 1.1s ease-in-out infinite; }
/* 개척할 수 있는 빈땅은 깜빡이며 튄다 — 가만히 있는 「＋마을」엔 눈이 안 갔다 (형 10-27) · 땅 둘레에 초록 고리도 */
@keyframes stlp { 0%, 100% { transform: translate(-50%, -2px) scale(1); box-shadow: 0 0 0 #b6e08f00; opacity: 1; } 50% { transform: translate(-50%, -7px) scale(1.14); box-shadow: 0 0 16px #b6e08f; opacity: .78; } }
.map .nd.stlok .ring { display: block; border: 3px dashed #b6e08f; box-shadow: 0 0 12px #b6e08f; animation: stlring 1.1s ease-in-out infinite; }
@keyframes stlring { 0%, 100% { opacity: .35; } 50% { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .map .nd .stl, .map .nd.stlok .ring { animation: none; } }
.map .nd .stl.go { background: #6b4a2ae6; border-color: #e0b070; color: #fbe8c8; animation: none; }
/* 군대만 가면 우리 땅 — 개척단 초록과 갈리게 붉은 구리빛 · 창 그림 */
.map .nd .stl.frt { background: #7a3a1ee6; border-color: #f0b070; color: #fff0dc; display: inline-flex; align-items: center; gap: 2px; padding-left: 2px; }
.map .nd .stl.frt img { width: 1.4em; height: 1.4em; object-fit: contain; }
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
.map svg .mvflow { animation: mvf .9s linear infinite; } @keyframes mvf { to { stroke-dashoffset: -${ARROW.period}; } }
@media (prefers-reduced-motion: reduce) { .map .toks.mv .tok, .map svg .mvflow { animation: none; } }
.map .lb.crowd { visibility: hidden; } /* 겹쳐 자리가 없는 작은 고을 이름 — declutter */
.map .lb.sel { z-index: 1; } .map .lb.dim { opacity: 0; } /* 한 나라만 볼 때 다른 나라 글씨는 감춘다 (형: "다른나라들은 글자정돈 완전 투명하게") */
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
  /** 먼 갈 곳 — `to` 다음에 차례로 지날 고을 (마지막이 갈 곳). 이번 계절 걸음에 이어 흐린 점선으로 */
  readonly then?: readonly string[]
  /** 갈 곳까지 걸리는 계절 — 먼 갈 곳 화살에 「n계절」 */
  readonly eta?: number
}

/**
 * 고을 그림의 크기 — 집이 많을수록 크다 (형: "규모를 이해하기 쉽게"). 빈땅·작은 마을 0.8 ~ 큰 도읍 1.35.
 * 화면의 생김새라 params 가 아니라 여기 둔다.
 */
/** 출정 화살의 갈래 — 고른 걸음 · 길 위의 우리 · 동맹 · 남의 행군 · 우리 고을로 오는 적 · 우리 기습 · 개척단 */
type ArrowKind = 'pick' | 'road' | 'ally' | 'foe' | 'thr' | 'amb' | 'ppl'
/** 갈래마다 색·굵기·촉 · on: 점선의 칠 길이 (틈은 한 마디의 나머지 · 길 위에 있으면 흐른다) · ink: 글씨 색 */
const ARROW_STYLE: Readonly<Record<ArrowKind, { col: string; w: number; head: string; ink: string; on?: number; round?: boolean }>> = {
  pick: { col: '#c8402a', w: 9, head: 'rm-ah', ink: '#7a1f10' },
  road: { col: '#c8402a', w: 9, head: 'rm-ah', ink: '#7a1f10', on: 14 },
  ally: { col: '#3f7a3a', w: 9, head: 'rm-ah-ally', ink: '#2c5a28', on: 14 },
  foe: { col: '#3a2a5a', w: 9, head: 'rm-ah-foe', ink: '#3a2a5a' },
  thr: { col: '#b0281a', w: 10, head: 'rm-ah-thr', ink: '#8a1a0a' },
  // 기습은 밤길처럼 — 어두운 둥근 점
  amb: { col: '#3a2a5a', w: 11, head: 'rm-ah-foe', ink: '#3a2a5a', on: 2, round: true },
  // 보내기로 한 집 — 흙빛 점선 (군대의 붉은 화살과 갈린다)
  ppl: { col: '#8a5a2b', w: 7, head: 'rm-ah-ppl', ink: '#5a3a1b', on: 13 },
}
/** 본 군세의 폭 — 같으면 한 수 */
const span = (lo: number, hi: number): string => (Math.round(lo) === Math.round(hi) ? `${Math.round(lo)}` : `${Math.round(lo)}~${Math.round(hi)}`)
/** 고른 고을·군대 머리 위의 초록 사각뿔 (싸움판 battlefield .wgem 과 같은 꼴) */
const GEM = '<i class="mgem"><i class="g3"><b class="gf f0"></b><b class="gf f1"></b><b class="gf f2"></b><b class="gf f3"></b><b class="gt"></b></i></i>'
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
  /** 척후를 보낸 고을 — 금빛 고리(누르라는 듯 보였다) 대신 작은 「척후」 표 (형 10-27) */
  scouting = '',
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
  svg += `<marker id="rm-ah-ally" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">`
  svg += `<path d="M0 0L10 5L0 10z" fill="#3f7a3a"/></marker>`
  svg += `<marker id="rm-ah-thr" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">`
  svg += `<path d="M0 0L10 5L0 10z" fill="#b0281a"/></marker>`
  for (const [f, a] of Object.entries(FACTION_ART).sort((x, y) => (x[0] < y[0] ? -1 : 1))) {
    svg += `<radialGradient id="rm-t-${f}"><stop offset="0" stop-color="${a.color}" stop-opacity=".72"/>`
    svg += `<stop offset=".65" stop-color="${a.color}" stop-opacity=".45"/><stop offset="1" stop-color="${a.color}" stop-opacity="0"/></radialGradient>`
  }
  // 길 모양 — 골짜기를 따르는 물길을 서로 밀어 두고, 엇갈리거나 남의 고을 땅을 지나는 길은 단순한 모양으로 편다 (roadlayout.ts — 판마다 한 번)
  const routes = boardRoutes(r)
  const route = (ed: REdge): Pt[] => routes.get(ed.id) ?? [px(ed.a), px(ed.b)]
  // 두 끝을 다 본 길은 그 길을 따라 띠로 밝다 (누가 걸어 본 길)
  const corridors = r.known === undefined ? [] : Object.values(r.edges).sort((x, y) => (x.id < y.id ? -1 : 1))
    .filter((ed) => seen(ed.a) && seen(ed.b))
    .map((ed) => smoothPath(route(ed)))
  const fog = r.known !== undefined ? fogSvg(r, me, region, W, H, TERRITORY_R, vis, isFresh, corridors, art) : null
  const landClip = landClipSvg(region, W, H)
  svg += `${landClip}${fog?.defs ?? ''}</defs>`
  // 땅빛 — 고을마다의 땅을 산·강을 따라 가르고(territory.ts) 주인 색으로
  svg += provincesSvg(r, W, H, dim, focus, seen, me, landClip !== '')
  // 강 — 또렷하게 (영남 판)
  svg += riversSvg(region, W, H)
  // 모르는 땅 — 강·땅빛 위, 길 밑 (아는 고을 사이의 길은 늘 보인다)
  svg += fog?.body ?? ''
  // 길 — 골짜기·바닷가를 따라 휜다 (형: "직선경로만 있는게 이상하지 않냐?"). 막힌 길은 흐리고 가운데 ✕
  const sw = RA.nodeScale < 1 ? 0.6 : 1
  /** 길 기호의 크기 — 고을 그림의 3/4 쯤 (10-30 물건 하나짜리 실루엣이 되어 디오라마보다 덜 차서 키웠다) */
  const signW = ICON_W * RA.nodeScale * W * 0.75
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
    // 고른 군대가 선 고을 — 갈 수 있는 길들이 모두 거기서 나간다(가장 많이 겹치는 끝). 먼 곳도 첫 길은 거기서 떠난다
    const ends = new Map<string, number>()
    for (const t of targets) { const e = r.edges[t.edge]; if (e !== undefined && !t.off) for (const x of [e.a, e.b]) ends.set(x, (ends.get(x) ?? 0) + 1) }
    const src = targets.length === 1 ? selected : [...ends.entries()].sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1))[0]?.[0] ?? selected
    // 먼 곳들은 첫 길을 함께 쓴다 — 같은 길은 한 번만 (겹쳐 그리면 빛이 진해지고 그릴 일만 는다)
    const lit = new Set<string>()
    for (const t of targets) {
      if (t.edge === '' || t.off || lit.has(t.edge)) continue
      lit.add(t.edge)
      const ed = r.edges[t.edge]
      if (ed === undefined || !seen(ed.a) || !seen(ed.b)) continue
      // 흐름은 늘 지금 고을에서 바깥으로 — 길은 a→b 로 그려져 있어 b 에 서 있으면 뒤집는다 (형 10-27: "애니메이션이 항상 지금 고을에서 바깥쪽으로 흐르게")
      const pts = route(ed)
      const inward = ed.b === src || (ed.a !== src && t.node === ed.a)
      const d = smoothPath(inward ? [...pts].reverse() : pts)
      svg += `<path d="${d}" fill="none" stroke="#ffd27a" stroke-width="${(16 * sw).toFixed(1)}" stroke-linecap="round" opacity=".28"/>`
      svg += `<path class="mvglow" d="${d}" fill="none" stroke="#fff3c8" stroke-width="${(4 * sw).toFixed(1)}" stroke-dasharray="10 10" stroke-linecap="round" opacity=".95"/>`
    }
  }
  svg += `</g>`
  // 출정 화살은 따로 떼어 고을·말·이름표보다 위의 막에 그린다 (형 10-31: "화살표는 다른 어떤 오브젝트보다도 위에 · 적국에서 올 때도 잘 안 보임")
  const arrowAt = svg.length
  svg += `<g class="ly-marches">` // 출정 화살
  // 출정 화살 — 군대 하나에 화살 하나 (형 10-30: "군사 보낼 때 화살표가 왜 이렇게 툭툭 끊어지고 제대로 안 보이냐").
  // 예전엔 걸음마다 따로 그려 양 끝을 길이의 22%씩 잘랐다: 먼 갈 곳은 고을마다 큰 틈이 나고 토막마다 촉이 달렸다.
  //  · 먼 갈 곳도 지나는 고을을 꿰어 한 줄로. 떠나는 고을 그림 밖에서 나와 마지막 고을 그림 앞에서 멎고, 촉은 그 끝에 하나
  //  · 이번 계절 걸음은 또렷하게, 그 뒤 걸음은 흐린 점선 + 「n계절」
  //  · 같은 길을 같은 꼴로 가는 군대는 화살 하나에 「×n」, 다른 화살과 길을 나누면 나란히 비켜 선다
  //  · 점선은 지도 단위의 맨 숫자 (흐름은 꼭 한 마디만큼 돈다) · 촉은 점선 틈에 뜨지 않게 짧은 실선 끝에 단다
  // 굵기는 style 로 --aw 를 곱한다: 가까이 볼수록 지도처럼 커지지 않게 (머리는 marker 라 굵기를 따라간다)
  const aw = (n: number): string => `calc(${n.toFixed(1)}px * var(--aw, 1))`
  const edgeOf = (a: string, b: string): REdge | undefined => Object.values(r.edges).find((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a))
  /** 한 걸음의 길 모양 — 떠나는 쪽부터. 끝 곁의 잔 점은 덜어 촉이 거꾸로 서지 않게 */
  const legOf = (a: string, b: string): Pt[] => {
    const ed = edgeOf(a, b)
    let p: Pt[] = ed !== undefined ? route(ed) : [px(a), px(b)]
    if (ed !== undefined && ed.a !== a) p = p.slice().reverse()
    return tidyEnds(p, ARROW.tidy)
  }
  /** 고을 그림의 반지름쯤 (지도 좌표) */
  const iconR = (id: string): number => ICON_W * RA.nodeScale * W * ARROW.iconR * sizeOf(r.nodes[id]?.hh ?? 0)
  /** 보이는 고을 자리와 이름표까지의 내림 (지도 좌표) — 화살 글씨를 비켜 단다 */
  const seenPts = Object.values(r.nodes).filter((n) => seen(n.id) && pos(n.id) !== undefined).map((n) => [...px(n.id), iconR(n.id) * 2.2] as const)
  const lineD = (p: readonly Pt[]): string => `M${p.map((q) => `${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join('L')}`
  const arrows = new Map<string, { kind: ArrowKind; nodes: string[]; n: number; m: MapMarch }>()
  for (const m of marches) {
    // 모르는 땅 앞에서 끊는다 (첫 걸음은 두 끝을 다 봐야 그린다)
    const all = [m.from, m.to, ...(m.then ?? [])]
    const cut = all.findIndex((id) => !seen(id))
    const nodes = cut < 0 ? all : all.slice(0, cut)
    if (nodes.length < 2) continue
    const amb = m.ambush === true && m.foe !== true
    const kind: ArrowKind = m.people === true ? 'ppl' : m.ally === true ? 'ally' : m.foe === true ? (threatened.has(m.to) ? 'thr' : 'foe') : amb ? 'amb' : m.left === null ? 'pick' : 'road'
    const key = `${kind}|${nodes.join('>')}`
    const g = arrows.get(key)
    if (g !== undefined) g.n++
    else arrows.set(key, { kind, nodes, n: 1, m })
  }
  // 첫 걸음의 길이 같은 화살끼리 나란히 선다 (길의 두 끝 이름 차례를 기준으로 왼쪽·오른쪽)
  const laneKey = (nodes: readonly string[]): string => [nodes[0]!, nodes[1]!].sort().join('~')
  const lanes = new Map<string, string[]>()
  for (const [key, g] of arrows) lanes.set(laneKey(g.nodes), [...(lanes.get(laneKey(g.nodes)) ?? []), key])
  for (const [key, { kind, nodes, n, m }] of arrows) {
    const st = ARROW_STYLE[kind]
    // 길을 꿴다 — 이음점(앞 걸음의 끝)은 한 번만. joint: 이번 계절 걸음이 끝나는 점 · last: 마지막 걸음이 떠나는 점
    const pts: Pt[] = []
    let joint = 0
    let last = 0
    for (let i = 1; i < nodes.length; i++) {
      const leg = legOf(nodes[i - 1]!, nodes[i]!)
      if (i === nodes.length - 1) last = i === 1 ? 0 : pts.length - 1
      pts.push(...(i === 1 ? leg : leg.slice(1)))
      if (i === 1) joint = pts.length - 1
    }
    const k = pts.length <= 2 ? 1 : ARROW.sub
    const cv0 = pts.length <= 2 ? pts : curvePts(pts, ARROW.sub)
    const lane = lanes.get(laneKey(nodes))!
    const off = lane.length < 2 ? 0 : (lane.indexOf(key) - (lane.length - 1) / 2) * ARROW.lane * lw * (nodes[0]! < nodes[1]! ? 1 : -1)
    const cv: Pt[] = off === 0 ? cv0 : cv0.map((q, i): Pt => {
      const a = cv0[Math.max(0, i - 1)]!
      const b = cv0[Math.min(cv0.length - 1, i + 1)]!
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
      return [q[0] - ((b[1] - a[1]) / l) * off, q[1] + ((b[0] - a[0]) / l) * off]
    })
    const acc: number[] = [0]
    for (let i = 1; i < cv.length; i++) acc.push(acc[i - 1]! + Math.hypot(cv[i]![0] - cv[i - 1]![0], cv[i]![1] - cv[i - 1]![1]))
    const L = acc[acc.length - 1]!
    const d0 = Math.min(iconR(nodes[0]!), acc[joint * k]! * ARROW.maxTrim)
    const d1 = L - Math.min(iconR(nodes[nodes.length - 1]!), (L - acc[last * k]!) * ARROW.maxTrim)
    if (d1 - d0 < ARROW.stub) continue
    const dj = Math.min(d1, Math.max(d0, acc[joint * k]!))
    const later = d1 - dj > 1
    const part = (a: number, b: number): string => lineD(trimPolyline(cv, a / L, b / L))
    const at = (d: number): Pt => trimPolyline(cv, d / L, d / L)[0]!
    const w = st.w * lw
    const cap = st.round === true ? 'round' : 'butt'
    // 크림빛 바탕 띠 — 길·땅빛 위에서도 화살이 또렷하고, 점선 틈도 한 줄로 이어 보인다
    svg += `<path d="${part(d0, dj)}" fill="none" stroke="#f3e6c8" style="stroke-width:${aw(w + ARROW.casing * lw)}" stroke-linecap="round" stroke-linejoin="round" opacity=".6"/>`
    if (later) svg += `<path d="${part(dj, d1)}" fill="none" stroke="#f3e6c8" style="stroke-width:${aw(w * 0.8 + ARROW.casing * lw)}" stroke-linecap="round" stroke-linejoin="round" opacity=".35"/>`
    if (kind === 'thr') svg += `<path d="${part(d0, d1)}" fill="none" stroke="#ffb09a" style="stroke-width:${aw(18 * lw)}" stroke-linecap="round" stroke-linejoin="round" opacity=".35"/>`
    // 길 위의 점선은 가는 쪽으로 흐른다 · 우리 고을로 오는 적은 깜빡 · 개척단 길은 pplarrow
    const cls = [kind === 'ppl' ? 'pplarrow' : '', st.on !== undefined && m.left !== null ? 'mvflow' : '', kind === 'thr' ? 'thrarrow' : ''].filter((c) => c !== '').join(' ')
    const flow = cls !== '' ? ` class="${cls}"` : ''
    const dash = (on: number): string => `;stroke-dasharray:${on} ${ARROW.period - on}`
    const head = ` marker-end="url(#${st.head})"`
    // 이번 계절 걸음 — 실선이면 촉까지 한 줄, 점선이면 촉은 끝의 짧은 실선에
    const stubbed = !later && st.on !== undefined
    const nowEnd = stubbed ? d1 - ARROW.stub : dj
    svg += `<path${flow} d="${part(d0, nowEnd)}" fill="none" stroke="${st.col}" style="stroke-width:${aw(w)}${st.on !== undefined ? dash(st.on) : ''}" stroke-linecap="${cap}" stroke-linejoin="round"${!later && !stubbed ? head : ''} opacity=".92"/>`
    if (stubbed) svg += `<path d="${part(nowEnd, d1)}" fill="none" stroke="${st.col}" style="stroke-width:${aw(w)}" stroke-linejoin="round"${head} opacity=".92"/>`
    // 그 뒤 걸음 — 흐린 점선, 끝의 짧은 실선에 촉 하나
    if (later) {
      svg += `<path d="${part(dj, d1 - ARROW.stub)}" fill="none" stroke="${st.col}" style="stroke-width:${aw(w * 0.8)};stroke-dasharray:10 9" stroke-linejoin="round" opacity=".6"/>`
      svg += `<path d="${part(d1 - ARROW.stub, d1)}" fill="none" stroke="${st.col}" style="stroke-width:${aw(w * 0.8)}" stroke-linejoin="round"${head} opacity=".75"/>`
    }
    // 글씨 — 먼 갈 곳은 흐린 걸음 가운데에 「n계절」 · 이번에 고른 기습 · 같은 화살 여럿은 「×n」 (도우러 오는 동맹은 길 위의 말 꼬리표가 말한다)
    const text = (p: Pt, t: string, size: number): string =>
      `<text x="${p[0].toFixed(1)}" y="${(p[1] - 12).toFixed(1)}" font-size="${size * lw}" font-weight="700" fill="${st.ink}" stroke="#f3e6c8" stroke-width="5" paint-order="stroke" text-anchor="middle">${t}</text>`
    if (later && m.eta !== undefined) {
      // 고을 그림과 그 밑 이름표에서 가장 먼 자리에 — 길이 이름표 곁을 지나면 글씨가 이름표 밑에 묻혔다
      const away = (p: Pt): number => Math.min(...seenPts.map((q) => Math.min(Math.hypot(p[0] - q[0], p[1] - q[1]), Math.hypot(p[0] - q[0], p[1] - q[1] - q[2]))))
      const cands = [0.3, 0.4, 0.5, 0.6, 0.7].map((f) => at(dj + (d1 - dj) * f))
      svg += text(cands.reduce((b, p) => (away(p) > away(b) ? p : b)), `${m.eta}계절`, 24)
    }
    const label = kind === 'amb' && m.left === null ? '우리 기습' : ''
    if (label !== '') svg += text(at(d0 + (dj - d0) * 0.7), label, 26)
    if (n > 1) svg += text(at(d0 + (dj - d0) * 0.62), `×${n}`, 26)
  }
  svg += `</g>`
  const arrowSvg = `<svg class="marr" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${svg.slice(arrowAt)}</svg>`
  svg = `${svg.slice(0, arrowAt)}</svg>`

  let nodes = ''
  const labels: LabelIn[] = []
  const capOf = r.factions[me]?.capital
  const govOf = new Map(Object.values(r.heroes).filter((h) => h.faction === me && h.status === 'free' && h.post != null && h.at === h.post && h.post !== capOf).map((h) => [h.post!, h] as const))
  // 도읍은 늘 군주 — 자리를 비운 계절(친정·사신)엔 흐리게 (형 10-26: "도읍은 항상 군주가 성주인 거 맞지? 그건 왜 맵에서 안 보이지?")
  const lord = rulerOf(r, me)
  if (capOf != null && lord !== null) govOf.set(capOf, lord)
  const lordAway = capOf != null && lord !== null && postHero(r, capOf)?.id !== lord.id
  for (const n of Object.values(r.nodes).sort((x, y) => (x.id < y.id ? -1 : 1))) {
    if (!seen(n.id)) continue
    const p = pos(n.id)
    if (p === undefined) continue
    const fr = isFresh(n.id) ? ' fresh' : ''
    const owner = n.owner
    const ours = owner === me
    const color = ours ? MY_LAND : owner !== null ? (FACTION_ART[owner]?.color ?? '#ccc') : '#d9d2c0'
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
    const kcls = (cap ? ' k-cap' : owner === null || n.kind === 'sodo' ? ' k-free' : '') + (n.kind === 'port' ? ' k-port' : '') + (n.kind === 'sodo' ? ' k-sodo' : '')
    // 살아 있는 지도 (형: "화면들이 너무 정적… 어딘가는 계속 움직이거나") — 사람 사는 고을엔 밥 짓는 연기, 박자는 고을마다 다르게
    const lived = owner !== null && n.hh > 0 && n.kind !== 'sodo'
    const yl = (Object.entries(nodeYield(r, n.id, season)) as Array<[keyof typeof GOOD_NAME, number]>).filter(([, v]) => v > 0).map(([g, v]) => `${GOOD_NAME[g]} ${v}`)
    const hv = nodeHarvest(r, n.id)
    const more = owner === null ? '' : [yl.length > 0 ? `이번 계절 · ${yl.join(' · ')}` : '', hv > 0 ? `가을걷이 곡식 약 ${hv}` : ''].filter((x) => x !== '').join(' / ')
    const far = ranging && !target.has(n.id) && selected !== n.id ? ' far' : ''
    const thr = threatened.has(n.id) ? ' threat' : ''
    const who = owner === null ? '주인 없음' : (r.factions[owner]?.name ?? '?')
    const fa = owner !== null ? FACTION_ART[owner] : undefined
    const emb = fa !== undefined ? `${art}icon/${flagIcon(owner)}.png` : ''
    // 고른 군대가 갈 수 있는 곳 — 누르면 그리로 간다 (data-act="go")
    const tg = target.get(n.id)
    const go = tg !== undefined && !tg.off ? ` data-act="${tg.act ?? 'go'}" data-edge="${tg.edge}"${tg.goal !== undefined ? ` data-goal="${tg.goal}"` : ''}` : ''
    const tcls = (tg === undefined ? '' : tg.off ? ' tgt off' : tg.on ? ' tgt on' : ' tgt') + (tg?.act === 'ptgo' ? ' pp' : '') + (tg?.goal !== undefined ? ' farg' : '')
    nodes += `<div class="nd${kcls}${tg === undefined && settleable.has(n.id) && !settling.has(n.id) ? ' stlok' : ''}${selected === n.id ? ' sel' : ''}${dim(owner) && tg === undefined ? ' dim' : ''}${tcls}${far}${thr}${fr}"${go} data-node="${n.id}" style="left:${p[0] * 100}%;top:${p[1] * 100}%;--c:${color};--s:${sizeOf(n.hh).toFixed(2)};--d:${(-beat(n.id) * 7).toFixed(2)}s" title="${n.name} · ${NODE_KIND_NAME[n.kind]} · ${who}"${more !== '' ? ` data-more="${more}"` : ''}>`
    // 특산 — 사람이 살면 나는 것 (쇠·소금·나무·말). 빈땅도 보여 "일구면 말이 난다"를 미리 안다
    const sp = nodeSpecials(r, n.id)
    // 바닷가 고기잡이 — 곡식이 조금 난다. 겨울엔 바다가 거칠어 쉰다 (economy.nodeYield) → 표가 얼어 흐려진다
    const fish = n.kind !== 'sodo' && isCoast(r, n.id)
      ? `<img class="${season === 'winter' ? 'frz' : ''}" src="${art}icon/good-dried-fish.png" alt="고기" title="${season === 'winter' ? '겨울: 바다가 거칠어 고기잡이를 쉰다' : '고기잡이: 겨울 빼고 곡식이 조금 난다'}">`
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
    const dfs = (['palisade', 'moat', 'earthwall'] as const).filter((t) => n.tags.includes(t))
    // 풍습이 이 고을에 걸려 있다 — 쇠 곱 · 쇠뇌 틀 · 불씨 · 고갯목 … (규칙은 지도에 보이게 · GAP §11 · hooks.customMarks)
    const cms = customMarks(r, n.id, me)
    // 특산·지은 것은 이름표 옆 어두운 칸에 — 고을 그림 위에 흰 동그라미로 떠 있으면 이웃 고을 것인지 헷갈리고 지도가 어지럽다
    // (형 10-24: "지역에서 생산되는 품목도 우상단 동그라미가 아니라 더 효과적이게" — 문명 6 도시 배너처럼 이름에 붙인다)
    const tray = sp.length > 0 || fish !== '' || dfs.length > 0 || cms.length > 0
      ? `<span class="lbg${n.owner === null || n.hh <= 0 ? ' idle' : ''}">${sp.map((g) => `<img src="${art}icon/${GOOD_ICON[g]}.png" alt="${GOOD_NAME[g]}" title="${GOOD_NAME[g]}: 사람이 살면 난다">`).join('')}${fish}${dfs.map((t) => `<i class="${t}" title="${DEF_TITLE[t]}">${DEF_NAME[t]}</i>`).join('')}`
        + `${cms.map((m) => `<i class="cmk${m.hot === true ? ' hot' : ''}" title="${m.tip}">${m.label}</i>`).join('')}</span>`
      : ''
    labels.push({
      // 나라 많은 판은 지금 지명 줄을 빼 이름표를 한 줄로 — 작아야 제 고을 곁에 붙는다 (형 10-26: "마을 텍스트 바가 너무 큼 · 줄여서 제대로 그 마을의 텍스트라는 게 보이게")
      id: n.id, name: n.name, now: NODE_NOW[n.id], inl: CROWDED.has(region), x: p[0], y: p[1], s: sizeOf(n.hh), cap: n.kind === 'capital' || cap, hh: n.hh,
      cls: `${kcls}${ours ? ' me' : ''}${selected === n.id ? ' sel' : ''}${dim(owner) && tg === undefined ? ' dim' : ''}${far}${fr}`,
      kit: owner !== null ? kitVars(owner) : '', emb, rel: relChip(r, me, owner), force, tray, trayW: sp.length + (fish !== '' ? 1 : 0) + dfs.length * 1.6 + cms.reduce((s, m) => s + 0.6 + m.label.length * 0.62, 0),
    })
    // 맡은 장수 — 우리 고을이면 얼굴을 작게 (형 10-23: "마을에 장수 배치한 거 아직 맵에선 아무것도 안 보이던데")
    const gv = ours ? govOf.get(n.id) : undefined
    const lordHere = gv !== undefined && n.id === capOf
    const gface = gv !== undefined && bustOf(gv.id) !== undefined
      ? `<img class="gov${lordHere ? ' lord' : ''}${lordHere && lordAway ? ' away' : ''}" src="${art}bust/${bustOf(gv.id)}.jpg" alt="" title="${gv.name}: ${lordHere ? (lordAway ? '군주가 도읍을 비웠다' : '군주가 몸소 다스린다') : '이 고을을 맡았다'}">` : ''
    // 소도 — 신성한 숲: 은은한 빛 · 금줄(뒤 반 · 앞 반) · 방울 소리 물결 둘 · 날아오르는 한지 띠 셋 (CSS 는 위 .k-sodo)
    const holy = n.kind === 'sodo'
      ? `<img class="sg" src="${art}fx/sodo-glow.png" alt=""><img class="sr" src="${art}fx/sodo-rope.png" alt=""><i class="sp"></i><i class="sp"></i>` : ''
    const holyFront = n.kind === 'sodo'
      ? `<img class="sr f" src="${art}fx/sodo-rope.png" alt=""><img class="sc c1" src="${art}fx/sodo-cloth-a.png" alt=""><img class="sc c2" src="${art}fx/sodo-cloth-b.png" alt=""><img class="sc c3" src="${art}fx/sodo-cloth-a.png" alt="">` : ''
    const sct = scouting === n.id ? `<span class="sctmk" title="척후가 이 고을을 엿본다"><img src="${art}icon/unit-scouts.png" alt="">척후</span>` : ''
    // 주인 없이 사람만 사는 철광·포구 — 지키는 군대가 없어 우리 군대가 닿기만 하면 싸움 없이 우리 땅 (season.walkIn · 형 10-31: "문명6 촌락처럼")
    const freeTake = owner === null && n.kind !== 'wild' && n.kind !== 'sodo' && n.hh > 0 && !Object.values(r.armies).some((a) => a.at === n.id && a.march === null)
      ? `<span class="stl frt" title="주인이 없습니다. 군대를 보내면 싸움 없이 우리 땅이 됩니다"><img src="${art}icon/unit-spear.png" alt="">군대만 가면</span>` : ''
    nodes += `${holy}<span class="base"></span><img class="st" src="${art}icon/${nodeIcon(n)}.png" alt="">${holyFront}<span class="ring"></span>${selected === n.id ? GEM : ''}${sct}${taken.has(n.id) ? `<img class="burnsm won" src="${art}fx/smoke.png" alt=""><span class="plant"><i class="pole"></i><i class="cloth" style="--fc:${FACTION_ART[me]?.color ?? '#c9a45a'}"><img src="${art}icon/${FACTION_ART[me]?.emblem ?? 'emblem-shell'}.png" alt=""></i></span><i class="wonring"></i><span class="wonchip">점령</span>` : burning.has(n.id) ? `<img class="burnsm" src="${art}fx/smoke.png" alt=""><img class="burnfx" src="${art}fx/fire.png" alt="">` : lived ? '<i class="smk"></i>' : ''}${held.has(n.id) ? '<span class="heldchip">🛡 지켜 냈다</span>' : ''}${mist}${ice}${gface}${badge}${thr !== '' ? '<i class="thr">⚔</i>' : ''}${tg !== undefined ? (tg.chip !== '' ? `<span class="tchip">${tg.chip}</span>` : '') : settleable.has(n.id) ? (settling.has(n.id) ? '<span class="stl go">백성이 가는 중</span>' : '<span class="stl">＋마을</span>') : freeTake !== '' ? freeTake : crowd}</div>`
  }
  // 우리 군대의 말 — 고을 밑에 나란히. 누르면 고르고, 갈 곳이 지도에 밝아진다
  const byNode = new Map<string, MapToken[]>()
  for (const t of tokens) if (t.march === undefined) byNode.set(t.node, [...(byNode.get(t.node) ?? []), t])
  const topMen = Math.max(1, ...tokens.filter((t) => t.foe === undefined).map((t) => t.men))
  // 말의 테도 그 나라의 두 빛 — 안쪽 테는 바탕 빛, 바깥 고리는 둘째 빛 (개척단은 흙빛)
  const tokKit = (t: MapToken): string => {
    if (t.party === true) return '--tc:#c8a070'
    const k = nationKit(t.foe ?? t.ally ?? me)
    return `--tc:${k.c};--tc2:${k.c2}`
  }
  // 우리 군대의 말은 살아 있다 — 군기가 펄럭이고, 쉬는 군대는 숨 쉬듯 들썩인다 (형 10-27 지인: "유닛을 전혀 안 누르더라 · 누르고 싶은 모습으로 · idle 모션")
  const ours = (t: MapToken): boolean => t.foe === undefined && t.ally === undefined && t.party !== true
  const tokBtn = (t: MapToken, ang?: number): string =>
    `<button class="tok${t.squad !== undefined ? ' unit' : ''}${ours(t) && t.march === undefined && !t.going ? ' idle' : ''}${t.sel ? ' sel' : ''}${t.going ? ' going' : ''}${t.ally !== undefined ? ' ally' : ''}${t.party === true ? ' party' : ''}${t.foe !== undefined ? ` foe${t.sneak === true ? ' sneak' : ''}` : ''}" data-act="${t.foe !== undefined ? 'foetok' : t.party === true ? 'ptok' : 'tok'}" data-army="${t.army}" style="${tokKit(t)}">`
    + `${t.sel ? GEM : ''}${ang !== undefined ? `<i class="dir" style="--a:${ang.toFixed(0)}deg"></i>` : ''}${ours(t) ? '<i class="flag"></i>' : ''}${t.wait === true ? `<i class="ask" style="--ae:${P.realm.mapAskEveryS}s;--ad:${(-(jit(t.army) * P.realm.mapAskEveryS)).toFixed(1)}s">명령?</i>` : ''}${t.squad !== undefined ? `<span class="squad">${t.squad.map((q, j) => `<i class="sq${q.r !== undefined ? ' v2' : ''}" style="--ar:${q.ar.toFixed(3)};${q.r !== undefined ? `--r:${q.r.toFixed(3)};` : ''}--j:${j};--k:${((([...t.army].reduce((h, ch) => h * 31 + ch.charCodeAt(0), 7) + j * 53) % 97 + 97) % 97 / 97).toFixed(2)}"><u style="background-image:url('${q.src}')"></u></i>`).join('')}</span>` : ''}<img src="${t.img}" alt="">${t.foe !== undefined ? '' : t.morale !== undefined ? `<i class="hp mor${t.morale < P.realm.mapMoraleLow ? ' low' : ''}" style="--p:${Math.max(0.06, Math.min(1, t.morale / P.realm.moraleMax)).toFixed(2)}"></i>` : `<i class="hp" style="--p:${Math.max(0.08, t.men / topMen).toFixed(2)}"></i>`}<b>${t.foe !== undefined ? '적' : `${t.ally !== undefined ? '도움 ' : t.party === true ? '개척 ' : ''}${t.men}`}</b></button>`
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
    const when = left <= 1 ? '다음 계절' : `${left}계절 뒤`
    const tag = t.foe !== undefined ? `${t.sneak === true ? '기습 낌새' : '적'} · ${when} 닿음` : `이동 중 · ${when} 도착`
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
  return `<div class="map" data-seen="${seenBox}" data-region="${region}"${world ? ` data-world="${season}"` : ''} data-aspect="${W / H}" data-zmax="${RA.zmax}" style="${bg}aspect-ratio:${W} / ${H};--ns:${RA.nodeScale};--ls:${RA.labelScale}">${svg}<div class="clsh"></div>${fog?.words ?? ''}${nodes}${toks}${placeLabels(labels, byNode, W, H, RA.nodeScale, RA.labelScale)}${arrowSvg}</div>`
}

/** 지도 위 우리 군대의 말 — 머무는 군대 하나에 하나 */
export interface MapToken {
  readonly army: string
  readonly node: string
  readonly men: number
  /** 그 군대의 사기 (1 = 100) — 있으면 말 밑 막대가 사기(노랑) · 사람 수는 초록 글씨 (형 10-28: 사건·제사로 사기가 오르내리는 게 보이게) */
  readonly morale?: number
  /** 장수 얼굴, 없으면 가장 많은 병종의 기호 */
  readonly img: string
  readonly sel: boolean
  /** 이번 계절 떠나기로 했다 */
  readonly going: boolean
  /** 길 위에 있다 — 그 길 가운데에 둔다 · left 남은 계절 */
  readonly march?: { readonly from: string; readonly to: string; readonly left: number }
  /** 동맹이 빌려준 군대 — 그 나라 id. 그 나라 두 빛 테와 「도움」 (형: "지켜주는 군대를 요청하면 언제 어디로 오는지 … 안보이는데?") */
  readonly ally?: string
  /** 개척단 — 흙빛 테 · 누르면 'ptok' · 수는 가구 (parties.ts) */
  readonly party?: boolean
  /** 보인 적의 군대 — 그 나라 id. 그 나라 빛 테 · 붉은 「적」 (형 10-27: "어느 마을로 오는지 텍스트 말고 동맹군 오듯이 유닛들이 아예 보이게") */
  readonly foe?: string
  /** 몰래 오는 낌새 — 어둡게 · 「기습 낌새」 */
  readonly sneak?: boolean
  /** 이번 계절 아직 명령이 없는 우리 군대 — 「명령?」 말풍선 (문명의 "유닛 명령 필요") */
  readonly wait?: boolean
  /** 땅에 선 병사 셋 — 그 군대에 많은 병종의 동작 그림 (형 10-28: "둥실 떠다니기만 하면 뭐하냐 · 유닛처럼") */
  readonly squad?: ReadonlyArray<{ readonly src: string; readonly ar: number; readonly r?: number }>
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
  /** 먼 갈 곳 — 옆 고을이 아니면 그곳 (첫 걸음은 edge) */
  readonly goal?: string
}

// ───────── 이름 겹 (형: "글자가 이미지에 가려 안보이는 부분 생기는거 주의해" — 2026-10-19)
// 고을 이름은 고을 그림·깃발·말보다 위의 한 겹에 그린다. 큰 판처럼 빽빽하면 이름끼리·그림과 안 겹치는 자리
// (밑 → 위 → 오른쪽 → 왼쪽)를 도읍·큰 고을부터 차례로 고른다. 지도 좌표는 0..1 (가로는 W, 세로는 H 의 몫).

/** 고을 그림의 너비 — 지도 너비의 몫 (CSS .nd width 8.5% 와 같은 값) */
const ICON_W = 0.085
/** 이름 글자 크기 — 지도 높이의 몫 (CSS 2.1cqh 와 같은 값) */
const LABEL_EM = 0.021

/** 나라가 많아 이름표가 엉키는 판 */
const CROWDED: ReadonlySet<RegionId> = new Set<RegionId>(['yeongnam', 'south', 'world'])

/**
 * 우리와 그 나라의 사이 — 이름표 깃발 곁에 (형 10-26: "어떤 국가랑 전쟁 중인지 동맹 중인지가 마을 이름표에서도 바로 보이게")
 * 전쟁 붉게(깜빡) · 동맹 초록 · 화친 하늘 · 조공(우리에게 바친다) 금빛 · 섬김(우리가 바친다) 잿빛. 중립·모르는 나라·우리 땅은 없음
 */
function relChip(r: Realm, me: string, owner: string | null): string {
  if (owner === null || owner === me || r.factions[owner] === undefined || !knows(r, me, owner)) return ''
  const rel = relationOf(r, me, owner)
  const v = rel.vassal !== undefined && rel.vassal.until >= r.season ? rel.vassal.lord : null
  if (rel.state === 'war') return '<i class="lbr war" title="전쟁 중">전쟁</i>'
  if (v === me) return '<i class="lbr tri" title="우리를 섬기는 속국">속국</i>'
  if (v === owner) return '<i class="lbr srv" title="우리가 바치는 나라">섬김</i>'
  if (rel.state === 'ally') return '<i class="lbr ally" title="동맹">동맹</i>'
  if (rel.state === 'truce') return '<i class="lbr tru" title="화친">화친</i>'
  return ''
}

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
  /** 주인 나라의 두 빛 — 배너의 몸·띠·글씨 CSS 변수 (kitcolor.kitVars · 주인이 없으면 '') */
  readonly kit: string
  /** 주인 나라 깃발 그림 주소 ('' 이면 없음) */
  readonly emb: string
  /** 우리와의 사이 칩 html — 전쟁·동맹·화친·조공 ('' 이면 없음) */
  readonly rel: string
  /** 지금 지명을 이름 뒤에 작게 한 줄로 (나라 많은 판 · 형 10-26: "창녕 청도 대구 이런 거 작게라도") */
  readonly inl?: boolean
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
    const chars = (l.inl === true ? l.name.length + (l.cap ? 1 : 0) + (l.now ?? '').length * 0.62 + 0.3 : Math.max(l.name.length + (l.cap ? 1 : 0), (l.now ?? '').length * 0.78)) + (l.emb !== '' ? 1.6 : 0) + (l.rel !== '' ? 2.4 : 0) + (l.force !== '' ? 3.5 : 0) + (l.tray !== '' ? l.trayW * 1.2 + 0.9 : 0) + 0.8
    const w = (chars * em * 0.95 * H) / W + 0.004
    const h = em * (l.now !== undefined ? 2.05 : 1.25)
    const iw = ICON_W * ns * l.s
    const ih = (iw * W) / H
    const cands: Array<[number, number]> = [
      [l.x, l.y + ih * 0.3], // 밑 — 이름은 늘 고을 아래 (형 10-31 · 그린 뒤 declutter 가 더 아래로만 내린다)
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
    out += `<span class="lb${l.cls}" data-n="${l.id}" style="left:${(cx * 100).toFixed(2)}%;top:${(cy * 100).toFixed(2)}%${l.kit !== '' ? `;${l.kit}` : ''}">`
      + `${l.emb !== '' ? `<img class="lbe" src="${l.emb}" alt="">` : ''}${l.rel}<span class="lbt"><span>${l.cap ? '<i class="star">★</i>' : ''}${l.name}${l.inl === true && l.now !== undefined ? `<small class="nowi">${l.now}</small>` : ''}</span>${l.inl !== true && l.now !== undefined ? `<small>${l.now}</small>` : ''}</span>${l.tray}${l.force}</span>`
  }
  return out + '</div>'
}

// ───────── 고을마다의 땅 (형: "개활지 같은데 직선경로만" — 점이 아니라 땅을 나눠 가진 나라로 보이게, 2026-10-19)

/** 땅 조각의 크기 배수 — 고을 꼴로 정한다 (집 수는 판마다 바뀌어도 땅 모양은 그대로 두려고) */
/** 지은 것의 말 — 고을 왼쪽 위 작은 표 */
const DEF_TITLE = { palisade: '목책: 한 번 지으면 계속 선다. 지키는 쪽이 세다', moat: '해자: 목책 앞에서 한 번 더 막는다. 겨울엔 언다', earthwall: '흙성: 흙을 다져 쌓은 성. 목책보다 훨씬 굳다 (달벌 흙성)' } as const
const DEF_NAME = { palisade: '목책', moat: '해자', earthwall: '흙성' } as const

// ───────── 길 기호 (public/realm/icon/route-* · 2026-10-20 그림 열여섯)

/** 길 기호의 이름 — 기호에 손을 대면 뜨는 말, 길 보기 표 */
export const ROUTE_SIGN_NAME = {
  oxcart: '들길: 소달구지가 다니는 트인 길',
  caravan: '쇠 나는 고을로 가는 길: 짐말이 오간다',
  cairn: '고갯길: 서낭당 돌무더기',
  snowpass: '눈 덮인 고개: 겨울엔 얼어서 사람을 잃는다',
  fortstair: '산성으로 오르는 고개: 지키는 쪽이 높다',
  jangseung: '숲길: 장승이 선 숨기 좋은 길',
  boardwalk: '갈대 늪: 널다리 · 숨기 좋다',
  steppingstones: '갯벌: 돌을 디뎌 건넌다 · 더디다',
  ferry: '나루: 배로 강을 건넌다',
  logbridge: '여울: 통나무 다리로 건넌다',
  raft: '장마에 불어난 나루: 뗏목으로 건너다 사람을 잃는다',
  icefloe: '언 강: 겨울엔 얼음 위로 건넌다 · 강을 믿던 쪽이 기습에 당하기 쉽다',
  searoute: '바닷길: 배로 건넌다',
  sotdae: '소도로 드는 길: 솟대 너머는 싸움이 없는 땅',
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

interface BandItem { own: string; rim: string; col: string; w: number; a: number }
let bandKey = ''
let bandOut: string | null = null
/**
 * 나라 땅 안쪽 띠를 그림 한 장으로 — 둘레를 굵게 긋고 그 나라 땅 안으로만 잘라 흐린다 (옛 SVG 거르개와 같은 꼴).
 * 작게 구워 늘린다 — 늘리면 저절로 부드럽고, 확대·축소 때 다시 그리지 않는다. DOM 이 없으면(시험) null
 */
function bandImage(items: readonly BandItem[], W: number, H: number, blur: number): string | null {
  if (typeof document === 'undefined' || items.length === 0) return null
  const key = `${W}|${H}|${items.map((x) => `${x.col}${x.w}${x.a}${x.rim}${x.own}`).join('|')}`
  if (key === bandKey) return bandOut
  try {
    const s = P.realm.mapBandBakeScale
    const w = Math.max(8, Math.round(W * s))
    const h = Math.max(8, Math.round(H * s))
    const cv = document.createElement('canvas')
    cv.width = w
    cv.height = h
    const g = cv.getContext('2d')
    if (g === null) return null
    g.scale(w / W, h / H)
    g.lineCap = 'round'
    g.lineJoin = 'round'
    for (const x of items) {
      g.save()
      g.clip(new Path2D(x.own))
      g.globalAlpha = x.a
      g.strokeStyle = x.col
      g.lineWidth = x.w
      g.stroke(new Path2D(x.rim))
      g.restore()
    }
    // 흐림 — 알파를 곱한 채로 상자 흐림 두 번 (가장자리가 검게 번지지 않게)
    const img = g.getImageData(0, 0, w, h)
    const d = img.data
    const ch = [new Float32Array(w * h), new Float32Array(w * h), new Float32Array(w * h), new Float32Array(w * h)]
    for (let i = 0; i < w * h; i++) { const al = d[i * 4 + 3]! / 255; ch[0]![i] = d[i * 4]! * al; ch[1]![i] = d[i * 4 + 1]! * al; ch[2]![i] = d[i * 4 + 2]! * al; ch[3]![i] = al }
    const rr = Math.max(1, Math.round(blur * s))
    const tmp = new Float32Array(w * h)
    for (const c of ch) {
      for (let pass = 0; pass < 2; pass++) {
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let sum = 0; for (let k = -rr; k <= rr; k++) sum += c[y * w + Math.min(w - 1, Math.max(0, x + k))]!; tmp[y * w + x] = sum / (rr * 2 + 1) }
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let sum = 0; for (let k = -rr; k <= rr; k++) sum += tmp[Math.min(h - 1, Math.max(0, y + k)) * w + x]!; c[y * w + x] = sum / (rr * 2 + 1) }
      }
    }
    for (let i = 0; i < w * h; i++) {
      const al = ch[3]![i]!
      d[i * 4 + 3] = Math.round(al * 255)
      if (al > 0.001) { d[i * 4] = Math.round(ch[0]![i]! / al); d[i * 4 + 1] = Math.round(ch[1]![i]! / al); d[i * 4 + 2] = Math.round(ch[2]![i]! / al) }
    }
    g.putImageData(img, 0, 0)
    bandKey = key
    bandOut = cv.toDataURL('image/png')
    return bandOut
  } catch { return null }
}

/**
 * 우리 땅의 빛 — 어느 나라를 골라도 늘 같은 파랑 (형 10-30: "내 영토는 항상 고정된 색깔로 해야하지 않을까? 노란색이 내땅인줄알았네").
 * 나라 빛(FACTION_ART)에는 이만큼 짙고 맑은 파랑이 없다 — 남의 땅과 섞이지 않는다
 */
export const MY_LAND = '#2f8cff'
const MY_EDGE_DARK = '#0a1a3a'
const MY_EDGE_CORE = '#eaf4ff'

/**
 * 고을마다의 땅을 주인 색으로 — 같은 나라 사이는 옅은 점선, 다른 나라 사이는 짙은 금, 강을 따라 갈린 금은 강과 겹친다.
 * **우리 땅**은 늘 같은 파랑(MY_LAND)으로 칠하고 둘레를 남색 띠 위 파랑·흰 심 겹선으로 두른다 (형: "내나라가 지도상에서 정확히 어딘지 가늠이 안됨").
 * 땅 모양은 판마다 한 번만 셈하고(territory.ts) 여기서는 색만 칠한다. 뭍이 있는 판은 뭍 밖을 잘라 낸다.
 */
function provincesSvg(
  r: Realm, W: number, H: number,
  dim: (owner: string | null) => boolean, focus: string | null, seen: (id: string) => boolean, me: string, clipped: boolean,
): string {
  const { nodes, t } = boardTerritory(r)
  const clip = clipped ? ' clip-path="url(#rm-land)"' : ''
  const k = Math.max(1, W / 1100) // 굵기 — 그림 폭에 맞춘다
  let fill = ''
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
    fill += `<path d="${d}" fill="${o === me ? MY_LAND : FACTION_ART[o]?.color ?? '#ccc'}" opacity="${dim(o) ? 0.05 : focus === o ? 0.34 : o === me ? 0.3 : 0.17}"/>`
    if (!dim(o)) own.set(o, (own.get(o) ?? '') + d)
  }
  for (const e of t.edges) {
    if (!seen(nodes[e.i]!.id) && (e.j < 0 || !seen(nodes[e.j]!.id))) continue
    const o = nodes[e.i]!.owner
    const o2 = e.j >= 0 ? nodes[e.j]!.owner : null
    if (o === null && o2 === null) continue
    const col = (o ?? o2) === me ? MY_LAND : FACTION_ART[(o ?? o2)!]?.color ?? '#ccc'
    // 같은 나라 고을 사이 — 옛 지도의 고을 금처럼 긴 점·짧은 점이 번갈아 (형 10-24: "마을 테두리도 확실하고" · 10-26: "마을들 테두리 고도화").
    // 밑에 한지 빛 가는 띠를 깔아 짙은 땅 위에서도 끊긴 금이 보인다. 나라 둘레의 굵은 띠보다는 한참 낮은 위계
    // 금은 덜 긋는다 — 줄이 몇 겹씩 돌아 지도가 어지러웠다 (형 10-26: "국경 영역도 너무 몇 줄씩 테두리 두르고 있어서 너무 복잡")
    if (o === o2) {
      // 같은 나라 고을 사이 — 가는 점선 하나만 (밑 띠는 걷었다 · 빽빽한 판을 멀리 볼 땐 숨는다 .tw)
      const a = dim(o) ? 0.1 : 1
      lines += `<path class="tw" d="${e.d}" stroke="color-mix(in srgb, ${col} 45%, #2a1d10)" stroke-width="${(1.2 * k).toFixed(1)}" stroke-dasharray="${(5 * k).toFixed(1)} ${(4 * k).toFixed(1)}" opacity="${(0.5 * a).toFixed(2)}"/>`
    } else {
      // 나라의 바깥 둘레 — 두 쪽 저마다 제 색 선을 안쪽에 갖는다. 금 자체는 가는 먹선 하나
      for (const x of [o, o2]) if (x !== null && own.has(x)) rim.set(x, (rim.get(x) ?? '') + e.d)
      lines += `<path d="${e.d}" stroke="#1a120a" stroke-width="${(1.3 * k).toFixed(1)}" opacity="${e.j < 0 && dim(o) ? 0.1 : 0.7}"/>`
    }
    // 우리 땅의 둘레 — 짙은 띠 위에 금빛
    if ((o === me) !== (o2 === me)) gold += e.d
  }
  let band = ''
  let crisp = ''
  let cps = ''
  const bake: BandItem[] = []
  for (const [o, d] of [...rim].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const col = o === me ? MY_LAND : nationKit(o).c
    cps += `<clipPath id="rm-own-${o}"><path d="${own.get(o)!}"/></clipPath>`
    // 둘레 안쪽의 번진 제 색 띠 하나 + 또렷한 제 색 선 하나 — 이웃과 맞닿으면 두 색이 나란히 선다 (문명 6 국경).
    // 둘째 빛 띠·먹빛 테는 걷었다 — 비슷한 빛의 이웃은 이름표의 두 색(kitcolor)으로 가른다 (형 10-26: "몇 줄씩 테두리")
    band += `<path class="nbd" d="${d}" clip-path="url(#rm-own-${o})" stroke="${col}" stroke-width="${(o === me ? 24 : 18) * k}" opacity="${o === me ? 0.45 : 0.36}"/>`
    bake.push({ own: own.get(o)!, rim: d, col, w: (o === me ? 24 : 18) * k, a: o === me ? 0.45 : 0.36 })
    crisp += `<path class="nb" d="${d}" clip-path="url(#rm-own-${o})" stroke="${col}" stroke-width="${(6 * k).toFixed(1)}" opacity=".9"/>`
  }
  const blurK = (3 * k).toFixed(1)
  // 띠를 미리 구운 그림으로 — 흐림 거르개는 확대·축소 때마다 다시 그려 무거웠다 (형 10-29) · 구울 수 없는 곳(시험)만 옛 거르개
  const baked = bandImage(bake, W, H, 3 * k)
  let h = `<defs>${baked === null ? `<filter id="rm-band" x="-2%" y="-2%" width="104%" height="104%"><feGaussianBlur stdDeviation="${blurK}"/></filter>` : ''}${cps}</defs>`
  // 둘레는 고을 사이 금(조각)을 이어 그린다 — 끝을 둥글게 해야 꺾인 모서리에서 제 색 선이 끊기지 않는다 (형 10-26: "가까이서 보면 각진 곳에 국경 색이 끊어져 있음")
  const bandLayer = baked !== null ? `<image href="${baked}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="none"/>` : `<g fill="none" stroke-linecap="round" stroke-linejoin="round" filter="url(#rm-band)">${band}</g>`
  h += `<g class="terr"${clip}>${fill}${bandLayer}<g fill="none" stroke-linecap="round" stroke-linejoin="round">${crisp}</g>`
  // 우리 땅의 둘레 — 짙은 남색 띠 위에 우리 빛 · 흰 심 세 겹. 천천히 숨 쉰다
  // (옛 금빛 가는 선은 노란 나라와 헷갈렸다 · 형 10-30: "노란색이 내땅인줄알았네… 영토 테두리 금색이 너무 가시성 떨어지고 효과가 없는거같다")
  h += `<g fill="none" stroke-linecap="round" stroke-linejoin="round">${lines}`
  if (gold !== '') {
    h += `<g class="mine-edge"><path d="${gold}" stroke="${MY_EDGE_DARK}" stroke-width="${(9 * k).toFixed(1)}" opacity=".8"/>`
      + `<path d="${gold}" stroke="${MY_LAND}" stroke-width="${(5.5 * k).toFixed(1)}"/>`
      + `<path d="${gold}" stroke="${MY_EDGE_CORE}" stroke-width="${(1.8 * k).toFixed(1)}"/></g>`
  }
  return h + `</g></g>`
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
  const { nodes, t } = boardTerritory(r)
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
  // 갤럭시 호환 모드 — 그 폰 크롬은 가림막(mask) 속 SVG 거르개(흐림·일렁임)를 네모 조각으로 깨뜨린다 (형 10-28: 안개가 네모 칸처럼 끊김)
  // 그래서 작은 그림판에 미리 그려 흐린 그림 한 장을 가림막으로 쓴다 — 늘려 그리면 가장자리가 저절로 부드럽다
  // 확대·축소할 때마다 지도 전체에 걸린 거르개(일렁임+흐림)를 다시 그려 한 번에 수십 ms 씩 버벅였다 (형 10-29: "확대 축소할 때 버벅거리는 게 고질적") —
  // 이제 모든 기기에서 미리 구운 가림막 한 장을 늘려 쓴다 (갤럭시는 그 거르개를 네모로 깨뜨리기도 했다 · gfxSafe 이 아니어도)
  const safe = fogMaskUrl(t.fills.flatMap((d, i) => {
    if (!vis.has(nodes[i]!.id)) return []
    const p = nodePos(region, nodes[i]!.id)
    return [{ d, dot: p !== undefined ? [p[0] * W, p[1] * H] as const : undefined }]
  }), corridors, W, H, terrR, blur)
  if (safe !== null) {
    const defs = `<mask id="rm-fog" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><image href="${safe}" width="${W}" height="${H}" preserveAspectRatio="none"/></mask>`
      + `<pattern id="rm-hanji" patternUnits="userSpaceOnUse" width="${tile}" height="${tile}"><image href="${art}map-world/hanji.webp" width="${tile}" height="${tile}" preserveAspectRatio="none"/></pattern>`
    return { defs, body: `<g class="fog" mask="url(#rm-fog)"><rect width="${W}" height="${H}" fill="#efe4cc"/><rect width="${W}" height="${H}" fill="url(#rm-hanji)"/></g>`, words: fogWords(r, me, region, W, H, terrR, vis, art) }
  }
  // 거르개 자리는 판 전체 — 본 땅이 좁으면 ±5% 자리 밖으로 번진 먹이 잘려 곧은 금이 생겼다
  const defs = `<filter id="rm-fog-blur" filterUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}">`
    + `<feTurbulence type="fractalNoise" baseFrequency="${(3 / terrR).toFixed(4)}" numOctaves="2" seed="11" result="n"/>`
    + `<feDisplacementMap in="SourceGraphic" in2="n" scale="${Math.round(terrR * 0.9)}" xChannelSelector="R" yChannelSelector="G" result="d"/>`
    + `<feGaussianBlur in="d" stdDeviation="${blur}"/></filter>`
    + `<mask id="rm-fog" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#fff"/>`
    + `<g fill="#000" filter="url(#rm-fog-blur)">${holes}</g></mask>`
    + `<pattern id="rm-hanji" patternUnits="userSpaceOnUse" width="${tile}" height="${tile}"><image href="${art}map-world/hanji.webp" width="${tile}" height="${tile}" preserveAspectRatio="none"/></pattern>`
  const body = `<g class="fog" mask="url(#rm-fog)"><rect width="${W}" height="${H}" fill="#efe4cc"/><rect width="${W}" height="${H}" fill="url(#rm-hanji)"/></g>`
  return { defs, body, words: fogWords(r, me, region, W, H, terrR, vis, art) }
}

/** 갤럭시 호환 모드의 안개 가림막 — 본 땅을 검게 뚫은 흰 판을 작게 그려 흐린다 (같은 판이면 다시 그리지 않는다) */
let fogMaskKey = ''
let fogMaskOut = ''
function fogMaskUrl(holes: ReadonlyArray<{ d: string; dot: readonly [number, number] | undefined }>, corridors: readonly string[], W: number, H: number, terrR: number, blur: number): string | null {
  if (typeof document === 'undefined') return null
  const key = `${W}|${H}|${terrR}|${corridors.join('')}|${holes.map((h) => h.d).join('')}`
  if (key === fogMaskKey) return fogMaskOut
  const s = P.realm.mapFogSafeScale
  const w = Math.max(8, Math.round(W * s))
  const h = Math.max(8, Math.round(H * s))
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  const g = cv.getContext('2d')
  if (g === null) return null
  g.fillStyle = '#fff'
  g.fillRect(0, 0, w, h)
  g.scale(w / W, h / H)
  g.fillStyle = '#000'
  g.strokeStyle = '#000'
  for (const x of holes) {
    g.fill(new Path2D(x.d))
    if (x.dot !== undefined) { g.beginPath(); g.arc(x.dot[0], x.dot[1], terrR * 0.5, 0, Math.PI * 2); g.fill() }
  }
  g.lineWidth = Math.round(terrR * 1.6)
  g.lineCap = 'round'
  g.lineJoin = 'round'
  for (const d of corridors) g.stroke(new Path2D(d))
  // 흐림 — 상자 흐림 세 번(가우스 흉내) · 캔버스 filter 를 안 쓴다 (그 폰은 그것도 못 믿는다)
  const img = g.getImageData(0, 0, w, h)
  const a = new Float32Array(w * h)
  for (let i = 0; i < a.length; i++) a[i] = img.data[i * 4]!
  const rr = Math.max(1, Math.round(blur * s))
  const tmp = new Float32Array(w * h)
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let sum = 0
      for (let k = -rr; k <= rr; k++) sum += a[y * w + Math.min(w - 1, Math.max(0, x + k))]!
      tmp[y * w + x] = sum / (rr * 2 + 1)
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let sum = 0
      for (let k = -rr; k <= rr; k++) sum += tmp[Math.min(h - 1, Math.max(0, y + k)) * w + x]!
      a[y * w + x] = sum / (rr * 2 + 1)
    }
  }
  // 먹이 번진 듯 들쭉날쭉 — 옛 거르개(일렁임)처럼, 흐린 판을 매끈한 물결만큼 비껴 읽는다
  const amp = terrR * 0.35 * s
  const fq = (Math.PI * 2) / Math.max(4, terrR * 2.2 * s)
  const at = (x: number, y: number): number => {
    const xi = Math.min(w - 2, Math.max(0, Math.floor(x)))
    const yi = Math.min(h - 2, Math.max(0, Math.floor(y)))
    const fx = Math.min(1, Math.max(0, x - xi))
    const fy = Math.min(1, Math.max(0, y - yi))
    const o = yi * w + xi
    return (a[o]! * (1 - fx) + a[o + 1]! * fx) * (1 - fy) + (a[o + w]! * (1 - fx) + a[o + w + 1]! * fx) * fy
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = amp * (Math.sin(y * fq + x * fq * 0.37) * 0.6 + Math.sin(y * fq * 2.3 - x * fq * 1.1 + 1.7) * 0.4)
      const dy = amp * (Math.sin(x * fq * 1.13 + y * fq * 0.29 + 0.8) * 0.6 + Math.sin(x * fq * 2.7 + y * fq * 0.9 + 2.9) * 0.4)
      const v = Math.round(at(x + dx, y + dy))
      const o = (y * w + x) * 4
      img.data[o] = v; img.data[o + 1] = v; img.data[o + 2] = v; img.data[o + 3] = 255
    }
  }
  g.putImageData(img, 0, 0)
  fogMaskKey = key
  fogMaskOut = cv.toDataURL('image/png')
  return fogMaskOut
}

function fogWords(r: Realm, me: string, region: RegionId, W: number, H: number, terrR: number, vis: ReadonlySet<string>, art: string): string {
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
  return words
}
