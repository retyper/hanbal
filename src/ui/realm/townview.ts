/**
 * 마을 안 (docs/realm/TOWN.md) — 고을 일터를 눈으로 보이는 마을로.
 * 형 11-05: "배경은 빈 터 · 구역마다 1·2·3단계 에셋 · 스타크래프트 구도 · 목책과 해자 · 제작 시작하면 일꾼들은 망치질".
 *
 * - 판(.tvboard)은 비스듬히 내려다본 빈 마을 터 그림 한 장(town/ground-*.png · 1376×768) — 터 넷의 자리는 그림에서 잰 비율(LOTS)
 * - 터마다 일터 하나 — 단마다 다른 그림(town/work-<일터>-<단>.png). 아직 안 구운 일터는 그 자리에 일터 그림표를 세운다
 * - 짓는 중이면 그 터에 비계(town/build.png)와 망치질하는 일꾼들 · 이번 달 고른 것은 흐리게 · 땅이 작아 없는 터는 잠긴 표
 * - 가구 수만큼 사람이 광장과 길을 오간다 (유민 걷기 띠)
 * - 아래엔 일터 짓기·올리기 칸(app 의 workCardHtml 을 그대로)
 *
 * 판을 읽기만 한다 (절대 규칙 2). 사람 자리·걸음 빠르기는 고을 id 로 정해 다시 그려도 튀지 않는다.
 * 폰 그래픽 한도 (메모리 mobile-gpu-layer-limit): 넓은 칸에 transform·filter 애니 금지 · 부드러운 linear-gradient 금지 —
 * 움직이는 건 작은 사람 칸뿐이고, 밝아지기는 opacity 로.
 */
import { P } from '../../tune/params.ts'
import { MIGRANT_ANIM } from '../../realm/data/art.ts'

/** 바탕 그림의 터 넷 — 가운데 x · 돌 테두리 아랫단 y · 폭 (그림 비율 · town/ground-field.png 에서 잼) · 차례: 왼위 · 오른위 · 왼아래 · 오른아래 */
const LOTS: ReadonlyArray<{ readonly x: number; readonly y: number; readonly w: number }> = [
  { x: 440 / 1376, y: 352 / 768, w: 404 / 1376 },
  { x: 939 / 1376, y: 356 / 768, w: 402 / 1376 },
  { x: 411 / 1376, y: 612 / 768, w: 432 / 1376 },
  { x: 968 / 1376, y: 612 / 768, w: 430 / 1376 },
]

export interface TownLot {
  readonly name: string
  /** 일터 그림표 (public/realm/icon) */
  readonly icon: string
  /** 단 그림 (없으면 그림표로) */
  readonly sprite: string | null
  readonly lv: number
  readonly max: number
}

export interface TownViewIn {
  readonly id: string
  readonly name: string
  readonly hh: number
  /** 바탕 그림 경로 (art 기준) */
  readonly bg: string
  readonly art: string
  /** 선 일터들 (터마다 하나 · 형 11-05: 논을 지으면 다른 걸 못 짓는 게 말이 안 된다) */
  readonly works: readonly TownLot[]
  /** 이 땅의 터 수 (works.lotCap) */
  readonly lots: number
  /** 짓는 것이 새 일터인가 (아니면 선 일터를 올리는 중) */
  readonly fresh2?: boolean
  /** 짓는 중 — 이름 · 그림표 · 남은 때 글 (없으면 null) */
  readonly going: { readonly icon: string; readonly name: string; readonly left: string } | null
  /** 이번 달 짓기로 고른 일터 (다음 달부터 선다 · 없으면 null) */
  readonly plan?: { readonly icon: string; readonly name: string; readonly sprite: string | null } | null
  /** 아래 칸 — 일터 짓기·올리기 (app.workCardHtml) */
  readonly card: string
  /** 처음 여는 그림이면 밝아지며 */
  readonly fresh: boolean
}
/** 고을 id 로 정하는 0~1 (다시 그려도 같은 자리) */
function hash01(s: string, i: number): number {
  let h = 2166136261 ^ i
  for (let j = 0; j < s.length; j++) h = Math.imul(h ^ s.charCodeAt(j), 16777619)
  return ((h >>> 0) % 10000) / 10000
}

export function townViewHtml(t: TownViewIn): string {
  const R = P.realm
  const pct = (v: number): string => `${(v * 100).toFixed(2)}%`
  const busy = t.going !== null
  // 터마다 무엇이 서나 — 선 일터 · 새로 짓는 것 · 이번 달 고른 것 · 빈 터 · (땅이 작아) 없는 터
  type Slot = { k: 'work'; lot: TownLot; up: boolean } | { k: 'new' } | { k: 'plan' } | { k: 'empty' } | { k: 'locked' }
  const slots: Slot[] = t.works.map((lot) => ({ k: 'work' as const, lot, up: busy && t.going!.name === lot.name }))
  if (busy && t.fresh2 === true) slots.push({ k: 'new' })
  else if (t.plan != null && !t.works.some((w) => w.name === t.plan!.name)) slots.push({ k: 'plan' })
  while (slots.length < Math.min(t.lots, LOTS.length)) slots.push({ k: 'empty' })
  while (slots.length < LOTS.length) slots.push({ k: 'locked' })
  let lotsHtml = ''
  let busyAt = -1
  slots.forEach((s, i) => {
    const L = LOTS[i]!
    const pos = `left:${pct(L.x)};top:${pct(L.y)};width:${pct(L.w)}`
    if (s.k === 'work') {
      const stars = '★'.repeat(s.lot.lv) + '☆'.repeat(Math.max(0, s.lot.max - s.lot.lv))
      const pic = s.lot.sprite !== null ? `<img class="tvsp" src="${s.lot.sprite}" alt="">` : `<img class="tvic" src="${t.art}icon/${s.lot.icon}.png" alt="">`
      if (s.up) busyAt = i
      lotsHtml += `<div class="tvlot2${s.up ? ' going' : ''}" style="${pos}">${pic}${s.up ? `<img class="tvsc2" src="${t.art}town/build.png" alt="">` : ''}<b class="tvl">${s.lot.name} <i>${stars}</i>${s.up ? ` · ${t.going!.left}` : ''}</b></div>`
    } else if (s.k === 'new') {
      busyAt = i
      lotsHtml += `<div class="tvlot2 going" style="${pos}"><img class="tvsp" src="${t.art}town/build.png" alt=""><b class="tvl">${t.going!.name} 짓는 중 · ${t.going!.left}</b></div>`
    } else if (s.k === 'plan') {
      const p = t.plan!
      const pic = p.sprite !== null ? `<img class="tvsp" src="${p.sprite}" alt="">` : `<img class="tvic" src="${t.art}icon/${p.icon}.png" alt="">`
      lotsHtml += `<div class="tvlot2 plan" style="${pos}">${pic}<b class="tvl">${p.name} · 다음 달부터</b></div>`
    } else if (s.k === 'empty') {
      lotsHtml += `<div class="tvlot2 empty" style="${pos}"><b class="tvl">빈 터</b></div>`
    } else {
      lotsHtml += `<div class="tvlot2 locked" style="${pos}" data-tip="땅이 작아 터가 ${t.lots}곳뿐입니다 · 도읍은 4곳"><b class="tvl">🔒</b></div>`
    }
  })
  // 사람 — 짓는 터 둘레에서 망치질하는 일꾼 · 나머지는 광장과 길을 오간다
  const n = Math.max(Math.round(R.townWalkMin), Math.min(Math.round(R.townWalkMax), Math.round(t.hh / Math.max(1, R.townHHPerWalker))))
  const workers = busyAt >= 0 ? Math.max(2, Math.min(4, Math.round(n * 0.4))) : 0
  let folk = ''
  for (let i = 0; i < n; i++) {
    const a = hash01(t.id, i)
    const b = hash01(t.id, i + 101)
    const c = hash01(t.id, i + 211)
    if (i < workers) {
      const L = LOTS[busyAt]!
      const ang = Math.PI * (0.1 + 0.8 * (i + 0.5) / workers)
      const x = L.x + Math.cos(ang) * L.w * 0.42
      const y = L.y - L.w * 0.16 + Math.sin(ang) * L.w * 0.12
      folk += `<i class="tvf work" style="left:${pct(x)};top:${pct(y)};--d:${(-c * 1.2).toFixed(2)}s;${x > L.x ? '--fl:-1;' : ''}"><u></u><s></s></i>`
    } else {
      // 광장과 둘레 길 — 가운데 마당을 가로로 오간다
      const y = 0.4 + b * 0.22
      const x0 = 0.34 + a * 0.16
      const sc = 0.8 + (y - 0.4) * 1.2
      folk += `<i class="tvf walk" style="left:${pct(x0)};top:${pct(y)};--dx:${(10 + c * 12).toFixed(1)}cqw;--sc:${sc.toFixed(2)};--dur:${(7 + c * 6).toFixed(1)}s;--d:${(-a * 9).toFixed(1)}s"><u></u></i>`
    }
  }
  return `<div class="townv${t.fresh ? ' fresh' : ''}" role="dialog" aria-label="${t.name} 마을 안">`
    + `<div class="tvstage"><div class="tvboard"><img class="tvbg" src="${t.art}${t.bg}" alt="">${lotsHtml}${folk}</div>`
    + `<div class="tvhd"><b>${t.name}</b><span>집 ${t.hh} · 터 ${Math.min(t.works.length + (busy && t.fresh2 === true ? 1 : 0), t.lots)}/${t.lots}</span></div>`
    + `<button class="tvx" data-act="town-out" aria-label="마을에서 나가기">✕</button></div>`
    + `<div class="tvcard">${t.card}</div></div>`
}

/** 들어갈 때의 막 — 고을 그림이 그 자리에서 커지며 어두워진다 (작은 그림 하나만 키운다 · 넓은 칸 transform 금지) */
export function townVeilHtml(x: number, y: number, img: string): string {
  return `<div class="tvveil" style="--x:${x.toFixed(0)}px;--y:${y.toFixed(0)}px"><img class="tvlens" src="${img}" alt=""></div>`
}

export const TOWN_CSS = `
.ap .tvveil { position: fixed; inset: 0; z-index: 60; pointer-events: none; background: radial-gradient(circle at var(--x) var(--y), #0000 0, #0b0906 60vmax); opacity: 0; animation: tvveil var(--tz, .48s) ease-in forwards; }
@keyframes tvveil { to { opacity: 1; } }
.ap .tvveil .tvlens { position: absolute; left: var(--x); top: var(--y); width: 90px; height: 90px; margin: -45px 0 0 -45px; object-fit: contain; animation: tvlens var(--tz, .48s) ease-in forwards; }
@keyframes tvlens { 60% { opacity: 1; } to { transform: scale(5.5); opacity: 0; } }
.ap .townov { position: fixed; inset: 0; z-index: 61; background: #0b0906; display: grid; }
.ap .townv { display: grid; grid-template-rows: 1fr auto; height: 100%; min-height: 0; }
.ap .townv.fresh { animation: tvin var(--tf, .32s) ease-out both; }
@keyframes tvin { from { opacity: 0; } }
.ap .townov.out { animation: tvout var(--tf, .32s) ease-in forwards; }
@keyframes tvout { to { opacity: 0; } }
/* 판 — 바탕 그림 한 장(1376×768)을 칸에 맞춘다 · 폰 세로는 터 넷이 다 들어오게 양옆(바깥 풀밭)을 잘라 크게 (터는 가로 14~86%) */
.ap .tvstage { position: relative; overflow: hidden; background: #2c3a1e; min-height: 0; container-type: size; }
.ap .tvboard { --bw: min(100cqw / 0.76, 100cqh * 1376 / 768); position: absolute; left: 50%; top: 50%; width: var(--bw); aspect-ratio: 1376 / 768; margin-left: calc(var(--bw) / -2); margin-top: calc(var(--bw) * 768 / 1376 / -2); }
.ap .tvbg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
/* 터 — 아랫단(돌 테두리 아래)에 맞춰 선다 · 그림은 터 폭 그대로 */
.ap .tvlot2 { position: absolute; z-index: 4; translate: -50% -100%; display: grid; justify-items: center; align-items: end; }
.ap .tvlot2 .tvsp { grid-area: 1 / 1; width: 100%; height: auto; display: block; }
.ap .tvlot2 .tvic { grid-area: 1 / 1; width: 34%; height: auto; margin-bottom: 14%; filter: drop-shadow(0 4px 6px #000a); }
.ap .tvlot2 .tvsc2 { grid-area: 1 / 1; width: 70%; margin-bottom: 8%; opacity: .95; }
.ap .tvlot2 .tvl { position: absolute; left: 50%; bottom: 0; translate: -50% 50%; z-index: 5; background: #1c1610e8; border: 1px solid #c9a45a; border-radius: 10px; padding: 2px 8px; color: #f3e6c8; font-size: clamp(11px, 1.2cqw + 6px, 14px); white-space: nowrap; }
.ap .tvlot2 .tvl i { font-style: normal; color: #f3d48a; }
.ap .tvlot2.going .tvsp:not([src$="build.png"]) { opacity: .55; }
.ap .tvlot2.plan .tvsp, .ap .tvlot2.plan .tvic { opacity: .55; animation: tvplan 1.4s ease-in-out infinite alternate; }
@keyframes tvplan { from { opacity: .4; } to { opacity: .8; } }
.ap .tvlot2.empty, .ap .tvlot2.locked { aspect-ratio: 2.1; }
.ap .tvlot2.empty .tvl { background: #1c1610b0; color: #e8dcc0; }
.ap .tvlot2.locked { opacity: .9; } .ap .tvlot2.locked .tvl { background: #0b0906c0; border-color: #6a5a3a; }
.ap .tvhd { position: absolute; z-index: 6; left: max(12px, env(safe-area-inset-left, 0px)); top: 10px; display: flex; gap: 10px; align-items: baseline; background: #1c1610d8; border: 1px solid #c9a45a; border-radius: 12px; padding: 6px 12px; color: #f3e6c8; }
.ap .tvhd b { font-size: 18px; color: #f3d48a; } .ap .tvhd span { font-size: 13px; }
.ap .tvx { position: absolute; z-index: 6; right: max(12px, env(safe-area-inset-right, 0px)); top: 10px; width: 44px; height: 44px; border-radius: 50%; border: 1px solid #c9a45a; background: #1c1610e0; color: #f3e6c8; font-size: 20px; cursor: pointer; }
/* 마을 사람 — 유민 걷기 8컷 띠 · 오가는 이는 가로로 오가며 돌아선다 · 일하는 이는 제자리에서 까딱 */
.ap .tvf { position: absolute; width: 30px; height: ${(30 / MIGRANT_ANIM.ar).toFixed(0)}px; margin: -${(30 / MIGRANT_ANIM.ar).toFixed(0)}px 0 0 -15px; z-index: 3; pointer-events: none; }
.ap .tvf u { position: absolute; inset: 0; background: url('__ART__${MIGRANT_ANIM.file}') 0 0 / ${MIGRANT_ANIM.nf * 100}% 100% no-repeat; }
.ap .tvf.walk { scale: var(--sc, 1); animation: tvwalk var(--dur, 9s) linear var(--d, 0s) infinite; }
.ap .tvf.walk u { animation: tvstep .8s steps(${MIGRANT_ANIM.nf - 1}) infinite; }
@keyframes tvstep { to { background-position-x: 100%; } }
@keyframes tvwalk { 0% { translate: 0 0; transform: scaleX(1); } 49.9% { translate: var(--dx) 0; transform: scaleX(1); } 50% { translate: var(--dx) 0; transform: scaleX(-1); } 100% { translate: 0 0; transform: scaleX(-1); } }
.ap .tvf.work { z-index: 5; transform: scaleX(var(--fl, 1)); }
.ap .tvf.work u { animation: tvbob .55s ease-in-out var(--d, 0s) infinite alternate; }
@keyframes tvbob { to { translate: 0 3px; } }
/* 일하는 곳의 흙먼지 — 작은 점 하나가 피었다 사라진다 */
.ap .tvf.work s { position: absolute; left: 60%; bottom: -2px; width: 10px; height: 10px; border-radius: 50%; background: #d8c09088; animation: tvdust 1.1s ease-out var(--d, 0s) infinite; }
@keyframes tvdust { from { transform: scale(.3); opacity: .9; } to { transform: scale(1.8) translateY(-6px); opacity: 0; } }
.ap .tvcard { background: #1c1610; border-top: 2px solid #c9a45a; padding: 10px 14px calc(10px + env(safe-area-inset-bottom, 0px)); max-height: 42vh; overflow: auto; color: #f3e6c8; }
@media (prefers-reduced-motion: reduce) { .ap .tvf, .ap .tvf u, .ap .tvf s, .ap .tvveil, .ap .tvveil .tvlens, .ap .townv.fresh { animation: none !important; } }
.ap.q-low .tvf u, .ap.q-low .tvf s, .ap.q-low .tvf.walk { animation-play-state: paused; }
`
