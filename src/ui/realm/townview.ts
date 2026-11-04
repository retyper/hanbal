/**
 * 마을 안 (docs/realm/TOWN.md 1단계) — 고을 일터를 눈으로 보이는 마을로.
 * 형 11-04: "일터를 UX 주면서 에셋 만들어 가며 시각화 · 버튼으로 딸깍해서 좋아졌다 ~ 이러는 게 아니라 · 가구 수에 맞게 자동 노동 배치".
 *
 * - 바탕은 땅 결 셋(들판 · 물가 · 숲) — 그림이 구워지기 전까진 전장 바탕을 빌린다
 * - 일터는 가운데 터에 단만큼 크게 선다 · 짓는 중이면 비계와 망치질하는 일꾼들 · 없으면 빈 터
 * - 가구 수만큼 사람이 저절로 일한다 (유민 걷기 띠 · 오가는 이 + 터 곁에서 일하는 이)
 * - 아래엔 일터 짓기·올리기 칸(app 의 workCardHtml 을 그대로)
 *
 * 판을 읽기만 한다 (절대 규칙 2). 사람 자리·걸음 빠르기는 고을 id 로 정해 다시 그려도 튀지 않는다.
 * 폰 그래픽 한도 (메모리 mobile-gpu-layer-limit): 넓은 칸에 transform·filter 애니 금지 · 부드러운 linear-gradient 금지 —
 * 움직이는 건 작은 사람 칸뿐이고, 밝아지기는 opacity 로.
 */
import { P } from '../../tune/params.ts'
import { MIGRANT_ANIM } from '../../realm/data/art.ts'

export interface TownViewIn {
  readonly id: string
  readonly name: string
  readonly hh: number
  /** 바탕 그림 경로 (art 기준) */
  readonly bg: string
  readonly art: string
  /** 일터 그림 · 이름 · 단 (없으면 null) */
  readonly work: { readonly img: string; readonly name: string; readonly lv: number; readonly max: number } | null
  /** 짓는 중 — 그림 · 남은 때 글 (없으면 null) */
  readonly going: { readonly img: string; readonly name: string; readonly left: string } | null
  /** 이번 달 짓기로 고른 일터 그림 (다음 달부터 선다 · 없으면 null) */
  readonly plan?: { readonly img: string; readonly name: string } | null
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
  const n = Math.max(Math.round(R.townWalkMin), Math.min(Math.round(R.townWalkMax), Math.round(t.hh / Math.max(1, R.townHHPerWalker))))
  const busy = t.going !== null
  // 일꾼 — 셋에 하나는 터 곁에서 일하고(짓는 중이면 절반) 나머지는 마을을 오간다
  const atWork = t.work !== null || busy ? Math.max(1, Math.round(n * (busy ? 0.5 : 0.34))) : 0
  let folk = ''
  for (let i = 0; i < n; i++) {
    const a = hash01(t.id, i)
    const b = hash01(t.id, i + 101)
    const c = hash01(t.id, i + 211)
    if (i < atWork) {
      // 터 곁 — 일터 둘레에 반원으로 둘러서서 일한다 (몸을 까딱이며)
      const ang = Math.PI * (0.15 + 0.7 * (i + 0.5) / atWork)
      const x = 50 + Math.cos(ang) * 22
      const y = 66 + Math.sin(ang) * 7
      folk += `<i class="tvf work" style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%;--d:${(-c * 1.2).toFixed(2)}s;${x > 50 ? '--fl:-1;' : ''}"><u></u><s></s></i>`
    } else {
      // 오가는 이 — 마을 마당을 가로로 오간다 (깊이에 따라 작게)
      const y = 52 + b * 36
      const x0 = 6 + a * 40
      const x1 = x0 + 24 + c * 30
      const sc = 0.7 + (y - 52) / 36 * 0.5
      folk += `<i class="tvf walk" style="left:${x0.toFixed(1)}%;top:${y.toFixed(1)}%;--dx:${(x1 - x0).toFixed(1)}vw;--sc:${sc.toFixed(2)};--dur:${(7 + c * 6).toFixed(1)}s;--d:${(-a * 9).toFixed(1)}s"><u></u></i>`
    }
  }
  let mid = ''
  if (busy) {
    mid = `<div class="tvb going"><img src="${t.going!.img}" alt=""><span class="tvsc"></span><b class="tvl">${t.going!.name} 짓는 중 · ${t.going!.left}</b></div>`
  } else if (t.plan != null && t.work === null) {
    mid = `<div class="tvb plan"><img src="${t.plan.img}" alt=""><span class="tvsc"></span><b class="tvl">${t.plan.name} · 다음 달부터 짓습니다</b></div>`
  } else if (t.work !== null) {
    const stars = '★'.repeat(t.work.lv) + '☆'.repeat(Math.max(0, t.work.max - t.work.lv))
    mid = `<div class="tvb" style="--lv:${t.work.lv}"><img src="${t.work.img}" alt=""><b class="tvl">${t.work.name} <i>${stars}</i></b></div>`
  } else {
    mid = `<div class="tvb empty"><span class="tvlot"></span><b class="tvl">빈 터</b></div>`
  }
  return `<div class="townv${t.fresh ? ' fresh' : ''}" role="dialog" aria-label="${t.name} 마을 안">`
    + `<div class="tvstage" style="background-image:url('${t.art}${t.bg}')">${mid}${folk}`
    + `<div class="tvhd"><b>${t.name}</b><span>집 ${t.hh}</span></div>`
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
.ap .tvstage { position: relative; overflow: hidden; background: #2a2016 center / cover no-repeat; min-height: 0; }
.ap .tvstage::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 65%, #0000 30%, #0b0906b0 100%); pointer-events: none; }
.ap .tvhd { position: absolute; left: 12px; top: 10px; display: flex; gap: 10px; align-items: baseline; background: #1c1610d8; border: 1px solid #c9a45a; border-radius: 12px; padding: 6px 12px; color: #f3e6c8; }
.ap .tvhd b { font-size: 18px; color: #f3d48a; } .ap .tvhd span { font-size: 13px; }
.ap .tvx { position: absolute; right: 12px; top: 10px; width: 44px; height: 44px; border-radius: 50%; border: 1px solid #c9a45a; background: #1c1610e0; color: #f3e6c8; font-size: 20px; cursor: pointer; }
.ap .tvb { position: absolute; z-index: 4; left: 50%; top: 62%; width: calc(clamp(160px, 34vw, 260px) * (0.8 + var(--lv, 1) * 0.2)); translate: -50% -50%; display: grid; justify-items: center; }
.ap .tvb img { width: 100%; height: auto; filter: drop-shadow(0 8px 10px #000a); }
.ap .tvb .tvl { position: relative; z-index: 5; margin-top: -6px; background: #1c1610e0; border: 1px solid #c9a45a; border-radius: 10px; padding: 2px 10px; color: #f3e6c8; font-size: 14px; white-space: nowrap; }
.ap .tvb .tvl i { font-style: normal; color: #f3d48a; }
.ap .tvb.going img { opacity: .55; } .ap .tvb.plan img { opacity: .6; animation: tvplan 1.4s ease-in-out infinite alternate; } @keyframes tvplan { from { opacity: .45; } to { opacity: .85; } }
.ap .tvb.going .tvsc, .ap .tvb.plan .tvsc { position: absolute; left: 8%; right: 8%; top: 10%; bottom: 22%; border: 3px solid #6a4a2a; background: repeating-linear-gradient(60deg, #0000 0 18px, #6a4a2acc 18px 21px); border-radius: 4px; }
.ap .tvb.empty { width: min(30vw, 220px); }
.ap .tvb.empty .tvlot { width: 100%; aspect-ratio: 2.2; border: 3px dashed #f3e6c8aa; border-radius: 50%; background: radial-gradient(ellipse, #6a4a2a55, #0000 70%); }
/* 마을 사람 — 유민 걷기 8컷 띠 · 오가는 이는 가로로 오가며 돌아선다 · 일하는 이는 제자리에서 까딱 */
.ap .tvf { position: absolute; width: 30px; height: ${(30 / MIGRANT_ANIM.ar).toFixed(0)}px; margin: -${(30 / MIGRANT_ANIM.ar).toFixed(0)}px 0 0 -15px; z-index: 3; pointer-events: none; }
.ap .tvf u { position: absolute; inset: 0; background: url('__ART__${MIGRANT_ANIM.file}') 0 0 / ${MIGRANT_ANIM.nf * 100}% 100% no-repeat; }
.ap .tvf.walk { scale: var(--sc, 1); animation: tvwalk var(--dur, 9s) linear var(--d, 0s) infinite; }
.ap .tvf.walk u { animation: tvstep .8s steps(${MIGRANT_ANIM.nf - 1}) infinite; }
@keyframes tvstep { to { background-position-x: 100%; } }
@keyframes tvwalk { 0% { translate: 0 0; transform: scaleX(1); } 49.9% { translate: var(--dx) 0; transform: scaleX(1); } 50% { translate: var(--dx) 0; transform: scaleX(-1); } 100% { translate: 0 0; transform: scaleX(-1); } }
.ap .tvf.work { transform: scaleX(var(--fl, 1)); }
.ap .tvf.work u { animation: tvbob .55s ease-in-out var(--d, 0s) infinite alternate; }
@keyframes tvbob { to { translate: 0 3px; } }
/* 일하는 곳의 흙먼지 — 작은 점 하나가 피었다 사라진다 */
.ap .tvf.work s { position: absolute; left: 60%; bottom: -2px; width: 10px; height: 10px; border-radius: 50%; background: #d8c09088; animation: tvdust 1.1s ease-out var(--d, 0s) infinite; }
@keyframes tvdust { from { transform: scale(.3); opacity: .9; } to { transform: scale(1.8) translateY(-6px); opacity: 0; } }
.ap .tvcard { background: #1c1610; border-top: 2px solid #c9a45a; padding: 10px 14px calc(10px + env(safe-area-inset-bottom, 0px)); max-height: 42vh; overflow: auto; color: #f3e6c8; }
@media (prefers-reduced-motion: reduce) { .ap .tvf, .ap .tvf u, .ap .tvf s, .ap .tvveil, .ap .tvveil .tvlens, .ap .townv.fresh { animation: none !important; } }
.ap.q-low .tvf u, .ap.q-low .tvf s, .ap.q-low .tvf.walk { animation-play-state: paused; }
`
