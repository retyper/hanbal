/// <reference types="vite/client" />
/**
 * 바다도적 막기 — 사건 카드 「바다 도적」의 「맞선다」 (pirate.html · docs/realm/SNIPE.md §0-9)
 *
 * 활의 손맛·탄도·적·소리·그리기는 활터 것을 그대로 쓰고(sim/world · render/scene · audio/sfx),
 * 물결·목책·궤짝만 이 판의 것이다(src/pirate/). 칠십팔국이 `seed·sev·mu·watch·bow` 를 넘기고,
 * 끝나면 막은 물결 수를 부모(칠십팔국)에 보낸다: `hanbal.pirate.result` · { id, held, won } · 안 쏘고 나오면 { skip }.
 */
import { startGfxSafe } from './ui/gfxsafe.ts'
// 갤럭시 크롬의 그러데이션 깨짐 — 그림판을 만들기 전에 켠다 (contest-main 과 같다)
startGfxSafe()
import { isSettled } from './sim/world.ts'
import type { World } from './sim/types.ts'
import { createNightInput } from './night/input.ts'
import { drawPull } from './night/draw.ts'
import { setAlwaysPreview } from './render/stickman.ts'
import { BOOST } from './render/boost.ts'
import { createRenderer, getHitStopMs, setSceneHooks } from './render/scene.ts'
import type { HudState } from './render/hud.ts'
import { createSfx, playUi, pumpSfx, unlockSfx, updateSfx } from './audio/sfx.ts'
import { tierBow, tierOf } from './night/sim.ts'
import { arrowIcon } from './ui/arrowicons.ts'
import { ARROW_KINDS } from './game/arrows.ts'
import { createPirate, pickBoon, stepPirate, type PickId, type PirateRun } from './pirate/sim.ts'
import { pirateHooks } from './pirate/draw.ts'
import { WAVE_COUNT } from './pirate/waves.ts'
import { P } from './tune/params.ts'
import { josa } from './core/josa.ts'
import { guardMedia } from './ui/media-guard.ts'
guardMedia() // 그림 길게 누름 메뉴·끌기 막기 (11-19)

const canvas = document.getElementById('night') as HTMLCanvasElement
const ui = document.getElementById('night-ui') as HTMLDivElement
setAlwaysPreview(true) // 당기는 동안 늘 사선 — 몰려오는 판이라 숨 참기 없이 (겨루기와 같다)
const params = new URLSearchParams(location.search)
const num = (k: string, d: number): number => {
  const v = Number(params.get(k))
  return params.get(k) !== null && Number.isFinite(v) ? v : d
}
const bandit = params.get('mode') === 'bandit'
const missionId = params.get('id') ?? (bandit ? 'card-bandits' : 'card-pirates')
const back = params.get('back') ?? 'realm.html'
const tier = tierOf(num('bow', 0))
const opts = {
  seed: num('seed', 1) >>> 0,
  sev: num('sev', 2),
  mu: num('mu', 5),
  watch: num('watch', 0),
  bow: tierBow(tier),
  bowStat: P.night.tierStat * tier,
  mode: bandit ? ('bandit' as const) : ('pirate' as const),
}
const RESULT = 'hanbal.pirate.result'

BOOST.on = true // 밤 판의 살·작은 점선·그림자 번짐 없음 (render/boost.ts)
BOOST.waterX = bandit ? Infinity : P.pirate.shoreX
// 폰(손가락 화면)은 DPR 상한을 낮게 시작하고, 느린 묶음이 잇달아야 한 단계씩 내린다 · 바닥 아래로는 안 내린다 (11-16 형: 「이미지도 엄청 흐림」)
const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
const renderer = createRenderer(canvas, {
  dprCap: coarse ? P.pirate.dprTouchCap : P.pirate.dprCap,
  slowMs: P.pirate.dprDropMs,
  dprFloor: P.pirate.dprFloor,
  slowRuns: P.pirate.dprSlowRuns,
})
// 밤 판과 같은 당겨 쏘기 — 아무 데나 누르고 뒤로 끌어 반대로 겨눈다 (형 11-11: 암살 때와 정반대라 짜증났음)
// 브라우저가 손가락을 빼앗아 가도(pointercancel) 끌어 둔 살은 쏜다 (11-16 형: 「당겨 쐈는데 안 쏴짐」)
const input = createNightInput(canvas, { dead: P.pirate.pullDead, cancelShoots: true })
const ctx2 = canvas.getContext('2d')!
const sfx = createSfx()
const hud: HudState = { training: 0, canLevelUp: false, muted: false, silent: false, toast: '', arrow: '', stars: -1, endReason: '', arrowRule: false, time: 0, bestTime: 0, record: false, bare: true, breathCorner: true }

let run: PirateRun = createPirate(opts)
setSceneHooks(pirateHooks(() => run))
/** 판이 도는 중인가 — 첫 화면·끝 화면에서는 sim 을 세운다 */
let live = false
let sent = false

function send(m: { held: number; won: boolean; perfect: boolean } | { skip: true }): void {
  if (sent) return
  sent = true
  if (window.parent !== window) window.parent.postMessage({ type: RESULT, id: missionId, ...m }, location.origin)
}

// ───────────────────────── 화면 위 판 (DOM) ─────────────────────────
// 판·단추·체력창은 저장소에 있는 그림을 빌려 입힌다 (11-17 형: 「UI만 에셋 씌우고 체력창 제대로」) —
// 카드·단추는 본편 카드와 한 벌(ui/frame-panel · btn-dark · btn-gold), 체력창·띠·명패는 열전 것(raid/ui/bar-hp · bar-boss · banner · plaque · badge-bronze),
// 끝 도장은 본편 사건의 성공·실패 도장(fx/stamp-ok · stamp-fail). 우리 목책은 파랑(본편 지도 MY_LAND 와 같은 결), 적은 붉게.

const ART = (import.meta.env?.BASE_URL ?? '/') + 'realm/'
const IMG = {
  frame: `${ART}ui/frame-panel.png?v=3`,
  btn: `${ART}ui/btn-dark.png?v=2`,
  btnOn: `${ART}ui/btn-gold.png?v=2`,
  ring: `${ART}ui/ring-portrait.png`,
  hpFrame: `${ART}raid/ui/bar-hp.png`,
  bossFrame: `${ART}raid/ui/bar-boss.png`,
  banner: `${ART}raid/ui/banner.png`,
  plaque: `${ART}raid/ui/plaque.png`,
  badge: `${ART}raid/ui/badge-bronze.png`,
  wall: `${ART}raid/emblem-palisade.png`,
  wave: `${ART}icon/${bandit ? 'emblem-mountain' : 'emblem-wave'}.png`,
  fire: `${ART}icon/unit-fire-archers.png`,
  pull: `${ART}raid/power-bow.png`,
  arrows: `${ART}icon/good-arrow-bundle.png`,
  stampOk: `${ART}fx/stamp-ok.png`,
  stampFail: `${ART}fx/stamp-fail.png`,
  chief: `${ART}anim2/${bandit ? 'bandit-chief' : 'pirate-captain'}.png`,
} as const
/** 두목 얼굴 — 걷기 띠 첫 컷(서기)의 머리 자리 (띠 가로 3000px 로 늘였을 때 · 그림 좌표라 손맛 노브가 아니다) */
const FACE = bandit ? { x: -71, y: -10 } : { x: -36, y: -12 }
const img = (src: string, cls = ''): string => `<img${cls === '' ? '' : ` class="${cls}"`} src="${src}" alt="" draggable="false">`

const CSS = `
#night-ui { position: fixed; inset: 0; pointer-events: none; container-type: size; font: 15px/1.45 system-ui, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; color: #efe6d2; }
#night-ui [hidden] { display: none !important; }
#night-ui .card { pointer-events: auto; position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(92%, 440px); max-height: 94%; overflow-y: auto; box-sizing: border-box; padding: 10px 14px 12px;
  border: 12px solid transparent; border-image: url(${IMG.frame}) 118 / 12px stretch; background: #1d1610f2 padding-box; box-shadow: 0 16px 40px #000c; text-align: center; }
#night-ui h1 { font-family: 'Gowun Batang', serif; font-size: 26px; line-height: 1.25; margin: 2px 0 6px; color: #f0c86a; text-shadow: 0 2px 0 #000; }
#night-ui p { margin: 6px 0; color: #d8ccb2; }
#night-ui .mute { color: #a39a88; font-size: 13px; }
#night-ui .rules { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin: 10px 0 4px; }
#night-ui .rules > div { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; padding: 4px 2px 6px; border: 8px solid transparent; border-image: url(${IMG.btn}) 30 33 fill / 8px 10px stretch; font-size: 13px; line-height: 1.3; color: #d8ccb2; }
#night-ui .rules span { display: flex; align-items: center; gap: 2px; font: 800 20px/1 system-ui, sans-serif; color: #fff4dc; text-shadow: 0 1px 0 #000; }
#night-ui .rules img { width: 40px; height: 40px; object-fit: contain; }
#night-ui .btns { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin-top: 12px; }
#night-ui button { font: inherit; font-size: 16px; min-height: 48px; padding: 2px 22px; box-sizing: border-box; border: 9px solid transparent; border-image: url(${IMG.btn}) 30 33 fill / 9px 12px stretch;
  background: none; color: #efe3c6; text-shadow: 0 1px 2px #000c; cursor: pointer; -webkit-tap-highlight-color: transparent; }
#night-ui button.on { border-image: url(${IMG.btnOn}) 30 35 fill / 9px 12px stretch; color: #2a1606; font-weight: 800; text-shadow: 1px 1px 0 #f7dc9a; }
#night-ui button:active { transform: scale(0.94); }
#night-ui .quit { pointer-events: auto; position: absolute; right: max(8px, env(safe-area-inset-right)); top: max(6px, env(safe-area-inset-top)); min-height: 40px; padding: 0 14px; font-size: 14px; }

/* 체력창 — 열전 체력 바 틀(bar-hp)을 두른 칸 · 막대는 단번에 떨어지고 잃은 토막이 번쩍 뒤 줄어든다 (rollTo) */
#night-ui .hpb { --bh: 28px; position: relative; display: block; width: clamp(130px, 22cqw, 240px); height: var(--bh); box-sizing: border-box; padding: calc(var(--bh) * 16 / 68) calc(var(--bh) * 85 / 68) calc(var(--bh) * 15 / 68); }
#night-ui .hpb::after { content: ''; position: absolute; inset: 0; pointer-events: none; border-style: solid; border-color: transparent; border-width: 0 calc(var(--bh) * 85 / 68);
  border-image: url(${IMG.hpFrame}) 0 85 fill / 0 calc(var(--bh) * 85 / 68) stretch; }
#night-ui .hpb .trk { position: relative; display: block; height: 100%; background: #070d16; }
#night-ui .hpb .fill { position: absolute; left: 0; top: 0; bottom: 0; width: 100%; background: linear-gradient(#a8d4ff, #2f8cff 42%, #124a9e); }
#night-ui .hpb.foe .trk { background: #160605; }
#night-ui .hpb.foe .fill { background: linear-gradient(#ffb09a, #e0402c 42%, #7a160c); }
#night-ui .hpb .chunk { position: absolute; top: 0; bottom: 0; left: 100%; width: 0; background: #c8160c; transform-origin: left center; }
#night-ui .hpb .tick { position: absolute; top: 0; bottom: 0; width: 2px; margin-left: -1px; background: #070d16; }
/* 우리 목책 — 왼쪽 위 (밤 판의 남은 화살 자리) */
#night-ui .wall { position: absolute; left: max(6px, env(safe-area-inset-left)); top: max(4px, env(safe-area-inset-top)); display: flex; align-items: center; }
#night-ui .wall > img { position: relative; z-index: 2; width: 46px; height: 46px; margin-right: -12px; }
#night-ui .wall .num { margin-left: 4px; font: 800 17px/1 system-ui, sans-serif; color: #dcecff; text-shadow: 0 1px 0 #000, 0 0 6px #000, 0 0 2px #000; font-variant-numeric: tabular-nums; }
#night-ui .wall.hit { animation: pir-shake 0.38s ease-out; }
/* 물결 — 가운데 위 띠 (열전 알림 띠) */
#night-ui .waves { position: absolute; left: 50%; top: max(4px, env(safe-area-inset-top)); transform: translateX(-50%); height: 44px; box-sizing: border-box; display: flex; align-items: center; gap: 6px; padding: 0 4px;
  border-style: solid; border-color: transparent; border-width: 0 49px; border-image: url(${IMG.banner}) 0 115 fill / 0 49px stretch; }
#night-ui .waves i { width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-sizing: border-box; font: 800 14px/1 system-ui, sans-serif; font-style: normal;
  color: #ffffff80; background: #00000066; border: 2px solid #c9a46a77; }
#night-ui .waves i.done { background: linear-gradient(#ffe39a, #d9a640); border-color: #fff0c0; color: #2a1606; }
#night-ui .waves i.now { background: #fff4dc; border-color: #fff; color: #2a1606; animation: pir-blink 0.9s ease-in-out infinite alternate; }
/* 두목 — 물결 띠 아래 큰 붉은 체력창 (열전 두목 바 틀 bar-hp → bar-boss) */
#night-ui .boss { position: absolute; left: 50%; top: calc(max(4px, env(safe-area-inset-top)) + 46px); transform: translateX(-50%); display: none; align-items: flex-start; }
#night-ui .boss.on { display: flex; }
#night-ui.picking .boss { visibility: hidden; }
#night-ui .boss.in { animation: pir-in 0.4s ease-out; }
#night-ui .boss .hpb { --bh: 56px; width: clamp(220px, 36cqw, 400px); padding: calc(var(--bh) * 35 / 173) calc(var(--bh) * 104 / 173) calc(var(--bh) * 91 / 173); }
#night-ui .boss .hpb::after { border-width: calc(var(--bh) * 35 / 173) calc(var(--bh) * 104 / 173) calc(var(--bh) * 91 / 173);
  border-image: url(${IMG.bossFrame}) 35 104 91 104 fill / calc(var(--bh) * 35 / 173) calc(var(--bh) * 104 / 173) calc(var(--bh) * 91 / 173) stretch; }
#night-ui .boss .face { position: relative; z-index: 2; flex: none; width: 42px; height: 42px; margin: -9px -10px 0 0; border-radius: 50%; background: #3a2418 url(${IMG.chief}) no-repeat; background-size: 3000px auto; background-position: ${FACE.x}px ${FACE.y}px; }
#night-ui .boss .face::after { content: ''; position: absolute; inset: -6px; background: url(${IMG.ring}) center / 100% 100% no-repeat; }
/* 쥔 궤짝 살 — 오른쪽 위 명패 (열전 plaque) · 남은 시간 띠 */
#night-ui .arm { position: absolute; right: max(8px, env(safe-area-inset-right)); top: calc(max(6px, env(safe-area-inset-top)) + 46px); display: flex; align-items: center; gap: 8px; padding: 6px 16px 6px 10px;
  background: url(${IMG.plaque}) center / 100% 100% no-repeat; }
#night-ui .arm img { width: 38px; height: 38px; }
#night-ui .arm > span { display: flex; flex-direction: column; gap: 4px; }
#night-ui .arm b { color: #fff4dc; font-size: 14px; line-height: 1.1; text-shadow: 0 1px 0 #000; }
#night-ui .arm .bar { display: block; width: 92px; height: 7px; background: #0a0705; box-shadow: 0 0 0 1px #000; }
#night-ui .arm .bar i { display: block; height: 100%; background: linear-gradient(#ffe39a, #f0b84a); }
#night-ui .arm.pop { animation: pir-pop 0.35s ease-out; }
/* 알림 — 열전 알림 띠 위 큰 글자 */
#night-ui .banner { position: absolute; left: 50%; top: 31%; width: min(84%, 480px); margin-left: calc(min(84%, 480px) / -2); box-sizing: border-box; padding: 4px 6px; text-align: center;
  border-style: solid; border-color: transparent; border-width: 0 58px; border-image: url(${IMG.banner}) 0 115 fill / 0 58px stretch;
  font-family: 'Gowun Batang', serif; font-size: 32px; line-height: 1.35; font-weight: 800; color: #fff4dc; text-shadow: 0 2px 0 #000, 0 0 12px #000; animation: pir-banner 1.6s ease-out forwards; }
#night-ui .banner.red { color: #ff8a6a; }
/* 물결 사이 고르기 — 카드는 본편 카드 틀 · 고른 것은 금빛으로 눌린 채 + ✓ */
#night-ui .picks { pointer-events: auto; position: absolute; left: 50%; top: 45%; transform: translate(-50%, -50%); width: min(94%, 580px); text-align: center; }
#night-ui .picks h2 { font-family: 'Gowun Batang', serif; font-size: 26px; margin: 0 0 6px; color: #fff4dc; text-shadow: 0 2px 0 #000, 0 0 16px #000; }
#night-ui .picks .row { display: flex; gap: 10px; justify-content: center; }
#night-ui .picks button.pk { position: relative; flex: 1 1 0; min-width: 0; min-height: 0; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 2px 4px 6px;
  border: 11px solid transparent; border-image: url(${IMG.frame}) 118 / 11px stretch; background: #1d1610f0 padding-box; color: #efe3c6; text-shadow: none; animation: pir-pick 0.28s ease-out backwards; }
#night-ui .picks button.pk:nth-child(2) { animation-delay: 0.06s }
#night-ui .picks button.pk:nth-child(3) { animation-delay: 0.12s }
#night-ui .picks .ico { height: 56px; display: flex; align-items: center; }
#night-ui .picks .ico img { width: 56px; height: 56px; object-fit: contain; }
#night-ui .picks button.pk b { font-size: 18px; color: #f0c86a; text-shadow: 0 1px 0 #000; }
#night-ui .picks button.pk small { font-size: 13px; color: #d8ccb2; line-height: 1.35; }
#night-ui .picks button.pk.on { border-image: url(${IMG.frame}) 118 / 11px stretch; background: #4a3614 padding-box; box-shadow: 0 0 0 3px #ffd27a, 0 0 18px #ffd27a99; transform: scale(1.05); }
#night-ui .picks button.pk.on b { color: #ffe9a8; }
#night-ui .picks button.pk.on::after { content: '✓'; position: absolute; right: -14px; top: -16px; width: 28px; height: 28px; border-radius: 50%; background: #f0c86a; color: #2a1606; font: 900 18px/28px system-ui, sans-serif; box-shadow: 0 1px 0 #000; }
#night-ui .picks .auto { margin: 10px auto 0; width: 70%; height: 8px; background: #0a0705; box-shadow: 0 0 0 1px #000, 0 0 0 2px #c9a46a88; }
#night-ui .picks .auto i { display: block; height: 100%; background: linear-gradient(#ffe39a, #f0b84a); }
#night-ui .picks .left { margin-top: 4px; font-size: 13px; color: #f0e4c8; text-shadow: 0 1px 0 #000, 0 0 6px #000; }
#night-ui .pickbar { pointer-events: auto; position: absolute; left: 0; right: 0; bottom: 0; padding: 6px 16px calc(8px + env(safe-area-inset-bottom)); display: flex; justify-content: center; background: linear-gradient(#0000, #000b 45%); }
#night-ui .pickbar button { min-width: min(88%, 360px); min-height: 54px; font-size: 19px; font-weight: 800; }
/* 낮은 화면(세로 폰을 눕힌 360~430px) — 고르기가 위 물결 띠·아래 단추와 겹치지 않게 줄인다 */
@container (max-height: 430px) {
  #night-ui .picks { top: 50%; }
  #night-ui .picks h2 { font-size: 21px; margin: 0 0 2px; }
  #night-ui .picks .ico, #night-ui .picks .ico img { width: 42px; height: 42px; }
  #night-ui .picks button.pk b { font-size: 17px; }
  #night-ui .picks button.pk small { font-size: 12px; line-height: 1.3; }
  #night-ui .picks .auto { margin-top: 6px; }
  #night-ui .pickbar button { min-height: 48px; font-size: 17px; }
}
#night-ui .pickbar button:disabled { border-image: url(${IMG.btn}) 30 33 fill / 9px 12px stretch; color: #bfb39a; text-shadow: 0 1px 2px #000c; font-weight: 700; }
/* 끝 — 도장 · 셈 띠 (열전 결과 띠 badge) */
#night-ui .end .stamp { display: block; width: 128px; margin: 0 auto 2px; animation: pir-stamp 0.45s cubic-bezier(.3, 1.5, .5, 1) both; }
#night-ui .end.won h1 { color: #8fd07a; }
#night-ui .end.lost h1 { color: #e08a74; }
#night-ui .end.perfect h1 { color: #ffd36a; }
#night-ui .stats { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; margin: 8px 0 2px; }
#night-ui .stats span { display: inline-flex; align-items: center; gap: 6px; padding: 0 8px; border: 10px solid transparent; border-image: url(${IMG.badge}) 35 fill / 10px stretch; font-size: 13px; color: #e8dcc0; }
#night-ui .stats img { width: 24px; height: 24px; object-fit: contain; }
#night-ui .stats b { font: 800 16px/1 system-ui, sans-serif; color: #ffd36a; font-variant-numeric: tabular-nums; }
#night-ui .flash { position: absolute; inset: 0; box-shadow: inset 0 0 80px 30px #ff2a1a; animation: pir-fade 0.5s ease-out forwards; }
@keyframes pir-pick { from { transform: translateY(26px) scale(0.85); opacity: 0 } to { transform: none; opacity: 1 } }
@keyframes pir-blink { from { opacity: 0.45 } to { opacity: 1 } }
@keyframes pir-pop { 0% { transform: scale(1.5) } 100% { transform: none } }
@keyframes pir-in { from { opacity: 0; transform: translate(-50%, -10px) } to { opacity: 1; transform: translateX(-50%) } }
@keyframes pir-shake { 0%, 100% { transform: none } 20% { transform: translateX(-7px) } 45% { transform: translateX(6px) } 70% { transform: translateX(-3px) } }
@keyframes pir-stamp { 0% { transform: scale(2.4) rotate(-8deg); opacity: 0 } 60% { transform: scale(0.94) rotate(-3deg); opacity: 1 } 100% { transform: rotate(-3deg) } }
@keyframes pir-banner { 0% { transform: scale(1.6); opacity: 0 } 15% { transform: scale(1); opacity: 1 } 75% { opacity: 1 } 100% { opacity: 0 } }
@keyframes pir-fade { from { opacity: 1 } to { opacity: 0 } }
`
document.head.insertAdjacentHTML('beforeend', `<style>${CSS}</style>`)

const card = (h: string, cls = ''): void => { ui.innerHTML = `<div class="card${cls === '' ? '' : ` ${cls}`}">${h}</div>` }
const NTH = ['첫', '둘째', '셋째'] as const
/** 적 이름 — 판마다 (화전 설명 · 끝 글) */
const FOE = bandit ? '산적' : '도적'

function showIntro(): void {
  live = false
  const lives = run.livesMax
  card(`<h1>${bandit ? '산적이 고개를 넘어온다' : '바다 도적이 몰려온다'}</h1><p>${bandit ? '고갯길에 목책을 세웠다. 물결 셋을 막아 내면 산적의 쇠를 빼앗는다.' : '모래밭에 목책을 세웠다. 물결 셋을 막아 내면 도적의 쇠를 빼앗는다.'}</p>`
    + `<div class="rules"><div><span>${img(IMG.wave)}×${WAVE_COUNT}</span>물결</div><div><span>${img(IMG.wall)}×${lives}</span>목책</div><div><span>${arrowIcon('burst', 40)}</span>${josa(bandit ? '노획 수레' : '궤짝', '을', '를')} 쏘면 살이 바뀝니다</div></div>`
    + `<p class="mute">누르고 있으면 당기고, 놓으면 쏩니다. 화살은 끝이 없습니다. 방패를 든 자는 몸통을 두 번 맞혀야 방패가 깨지고, 머리는 한 발입니다.</p>`
    + `<div class="btns"><button data-act="back">물러난다</button><button class="on" data-act="go">막는다</button></div>`)
}

// ── 체력창 (롤식 피 감소 — 열전 raid-main updateChunk 와 같은 셈 · 수치는 P.pirate.hpChunk*) ──

/** 체력창 하나의 화면 쪽 기억 — 판 상태는 읽기만 한다 */
interface Roll {
  readonly fill: HTMLElement
  readonly chunk: HTMLElement
  /** 토막 끝 (%) · 지난 값 (%) · 마지막으로 깎인 때 · 마지막 번쩍 (초) */
  lag: number
  last: number
  hitAt: number
  flashAt: number
  shown: string
}
const CHUNK_FX: Keyframe[] = [
  { backgroundColor: '#ffffff', boxShadow: '0 0 14px 4px #ffffff', transform: 'scaleY(2)' },
  { backgroundColor: '#ffe14a', boxShadow: '0 0 12px 3px #ffc800', transform: 'scaleY(1.55)', offset: 0.3 },
  { backgroundColor: '#ff2a14', boxShadow: '0 0 10px 3px #ff2a14', transform: 'scaleY(1.15)', offset: 0.65 },
  { backgroundColor: '#c8160c', boxShadow: '0 0 5px 1px #ff2a1499', transform: 'none' },
]
/** 토막이 이만큼(%) 아래로 좁아지면 없앤다 · 이만큼 넘게 떨어져야 맞은 것으로 본다 (열전과 같다) */
const CHUNK_EPS = { snap: 0.15, hit: 0.05 } as const
function makeRoll(root: Element, pct = 100): Roll {
  return { fill: root.querySelector<HTMLElement>('.fill')!, chunk: root.querySelector<HTMLElement>('.chunk')!, lag: pct, last: pct, hitAt: -9, flashAt: -9, shown: '' }
}
function resetRoll(r: Roll, pct: number): void {
  r.lag = pct
  r.last = pct
  r.hitAt = -9
}
/** 막대는 곧바로 pct 로 · 잃은 토막은 번쩍인 뒤 hpChunkHold 초 지나 처음엔 빠르게 끝 무렵엔 천천히 줄어든다 */
function rollTo(r: Roll, pct: number, now: number, dt: number): void {
  const C = P.pirate
  if (pct < r.last - CHUNK_EPS.hit) {
    r.lag = Math.max(r.lag, r.last)
    r.hitAt = now
    if (now - r.flashAt > C.hpChunkFlash * 0.5) {
      r.flashAt = now
      r.chunk.animate(CHUNK_FX, { duration: C.hpChunkFlash * 1000, easing: 'linear' })
    }
  }
  r.last = pct
  if (r.lag <= pct) r.lag = pct
  else if (now - r.hitAt > C.hpChunkHold) {
    r.lag = pct + (r.lag - pct) * Math.exp(-C.hpChunkRate * dt)
    if (r.lag - pct < CHUNK_EPS.snap) r.lag = pct
  }
  const left = pct.toFixed(1)
  const w = (r.lag - pct).toFixed(1)
  const key = `${left}/${w}`
  if (key === r.shown) return // 바뀔 때만 쓴다 (폰은 같은 값을 다시 써도 배치를 다시 한다 · 열전 11-16)
  r.shown = key
  r.fill.style.width = `${left}%`
  r.chunk.style.left = `${left}%`
  r.chunk.style.width = `${w}%`
}

// ── 머리띠 — 왼쪽 위 목책 체력창 · 가운데 물결 띠 · 그 아래 두목 체력창 · 오른쪽 위 그만·쥔 살 ──

interface Hud {
  readonly wall: HTMLElement
  readonly num: HTMLElement
  readonly ticks: HTMLElement
  readonly waves: HTMLElement
  readonly boss: HTMLElement
  readonly arm: HTMLElement
  readonly wallRoll: Roll
  readonly bossRoll: Roll
}
let hudEl: Hud | null = null
const shown = { waves: '', wall: '', max: -1, arm: '' }
/** 두목 체력창이 따라가는 자리 · 두목이 사라진 때 (초 · 아직이면 −1) */
let bossId = -1
let bossGoneAt = -1

function buildHud(): void {
  const bar = (cls: string, ticks: boolean): string => `<span class="hpb ${cls}"><span class="trk"><i class="fill"></i><em class="chunk"></em>${ticks ? '<span class="ticks"></span>' : ''}</span></span>`
  ui.innerHTML = `<div class="wall">${img(IMG.wall)}${bar('us', true)}<b class="num"></b></div>`
    + '<div class="waves"></div>'
    + `<div class="boss"><span class="face"></span>${bar('foe', false)}</div>`
    + '<button class="quit" data-act="quit">그만</button>'
    + '<div class="arm" hidden></div>'
  const q = (s: string): HTMLElement => ui.querySelector<HTMLElement>(s)!
  hudEl = {
    wall: q('.wall'), num: q('.wall .num'), ticks: q('.wall .ticks'), waves: q('.waves'), boss: q('.boss'), arm: q('.arm'),
    wallRoll: makeRoll(q('.wall .hpb')), bossRoll: makeRoll(q('.boss .hpb')),
  }
  shown.waves = ''
  shown.wall = ''
  shown.max = -1
  shown.arm = ''
  bossId = -1
  bossGoneAt = -1
}

/** 프레임마다 — 바뀐 것만 고친다 */
function updateHud(now: number, dt: number): void {
  const h = hudEl
  if (h === null || !h.wall.isConnected) return
  // 물결 — 막은 것은 금빛 ✓, 지금 것은 깜박
  const wk = `${run.held}|${run.wave}|${run.phase}`
  if (wk !== shown.waves) {
    shown.waves = wk
    h.waves.innerHTML = Array.from({ length: WAVE_COUNT }, (_, k) => `<i class="${k < run.held ? 'done' : k === run.wave && run.phase === 'fight' ? 'now' : ''}">${k < run.held ? '✓' : k + 1}</i>`).join('')
  }
  // 목책 — 칸 나눈 파란 체력창 · 남은 수
  const lk = `${run.lives}/${run.livesMax}`
  if (lk !== shown.wall) {
    shown.wall = lk
    h.num.textContent = lk
  }
  if (run.livesMax !== shown.max) {
    shown.max = run.livesMax
    h.ticks.innerHTML = Array.from({ length: Math.max(0, run.livesMax - 1) }, (_, k) => `<i class="tick" style="left:${(((k + 1) / run.livesMax) * 100).toFixed(2)}%"></i>`).join('')
  }
  rollTo(h.wallRoll, run.livesMax > 0 ? (Math.max(0, run.lives) / run.livesMax) * 100 : 0, now, dt)
  bossHud(h, now, dt)
  // 쥔 궤짝 살
  if (run.special !== shown.arm) {
    const first = shown.arm !== ''
    shown.arm = run.special
    if (run.special === 'basic') h.arm.hidden = true
    else {
      h.arm.innerHTML = `${arrowIcon(run.special, 38)}<span><b>${ARROW_KINDS.find((k) => k.id === run.special)?.name ?? ''}</b><span class="bar"><i></i></span></span>`
      h.arm.hidden = false
      if (first) {
        h.arm.classList.remove('pop')
        void h.arm.offsetWidth
        h.arm.classList.add('pop')
      }
    }
  }
  if (run.special !== 'basic') {
    const bar = h.arm.querySelector<HTMLElement>('.bar i')
    if (bar !== null) bar.style.width = `${Math.max(0, (run.specialLeft / P.pirate.specialSec) * 100).toFixed(1)}%`
  }
}

/** 두목 체력창 — 두목이 서면 위에 뜨고, 쓰러지면 토막이 줄어든 뒤 거둔다 (목책에 닿아 사라졌으면 곧바로) */
function bossHud(h: Hud, now: number, dt: number): void {
  const ts = run.w.targets
  let id = -1
  if (bossId >= 0 && run.role[bossId] === 'captain' && ts[bossId]?.alive === true) id = bossId
  else for (let i = 0; i < ts.length; i++) if (run.role[i] === 'captain' && ts[i]!.alive) { id = i; break }
  if (id >= 0) {
    const t = ts[id]!
    const pct = t.hpMax > 0 ? Math.max(0, t.hp / t.hpMax) * 100 : 0
    if (id !== bossId || bossGoneAt >= 0) {
      bossId = id
      bossGoneAt = -1
      resetRoll(h.bossRoll, pct)
      h.boss.classList.add('on', 'in')
    }
    rollTo(h.bossRoll, pct, now, dt)
    return
  }
  if (bossId < 0) return
  if (bossGoneAt < 0) bossGoneAt = (ts[bossId]?.hp ?? 0) > 0 ? now - P.pirate.bossGoneSec : now
  rollTo(h.bossRoll, 0, now, dt)
  if (now - bossGoneAt >= P.pirate.bossGoneSec) {
    bossId = -1
    h.boss.classList.remove('on', 'in')
  }
}

/** 목책이 깎였다 — 체력창이 흔들린다 (작은 칸만 움직인다) */
function shakeWall(): void {
  const el = hudEl?.wall
  if (el === undefined || !el.isConnected) return
  el.classList.remove('hit')
  void el.offsetWidth
  el.classList.add('hit')
}

function banner(text: string, red = false): void {
  ui.querySelector('.banner')?.remove()
  const el = document.createElement('div')
  el.className = `banner${red ? ' red' : ''}`
  el.textContent = text
  el.addEventListener('animationend', () => el.remove())
  ui.appendChild(el)
}

function flash(): void {
  const el = document.createElement('div')
  el.className = 'flash'
  el.addEventListener('animationend', () => el.remove())
  ui.appendChild(el)
}

const PICK_UI: ReadonlyArray<{ id: PickId; ico: string; name: string; does: string }> = [
  { id: 'fire', ico: img(IMG.fire), name: '화전', does: `다음 물결 내내 불화살을 씁니다. 맞은 자리가 터져 ${P.arrowkind.burstRadius}미터 안의 ${josa(FOE, '이', '가')} 함께 다칩니다` },
  { id: 'repair', ico: img(IMG.wall), name: '목책 고치기', does: `부서진 목책 ${Math.round(P.pirate.pickLife)}칸을 고칩니다. 멀쩡하면 1칸 늘립니다` },
  { id: 'draw', ico: img(IMG.pull), name: '당김 빨라짐', does: `활이 만작까지 ${Math.round((1 - P.pirate.pickDrawMul) * 100)}퍼센트 빨리 당겨집니다. 이번 판 내내 이어집니다` },
]
let picking = false
/** 눌러 둔 카드 — 아래 「이걸로」를 눌러야 정해진다 */
let chosen: PickId | null = null
function showPick(): void {
  picking = true
  ui.classList.add('picking')
  chosen = null
  ui.querySelector('.picks')?.remove()
  ui.querySelector('.pickbar')?.remove()
  const el = document.createElement('div')
  el.className = 'picks'
  el.innerHTML = '<h2>고르세요</h2><div class="row">'
    + PICK_UI.map((p) => `<button class="pk" data-pick="${p.id}"><span class="ico">${p.ico}</span><b>${p.name}</b><small>${p.does}</small></button>`).join('')
    + '</div><div class="auto"><i></i></div><div class="left"></div>'
  ui.appendChild(el)
  const bar = document.createElement('div')
  bar.className = 'pickbar'
  bar.innerHTML = '<button class="on" data-ok="1" disabled>하나를 눌러 보세요</button>'
  ui.appendChild(bar)
}
/** 카드를 눌렀다 — 금빛으로 눌린 채 · 아래 단추가 켜진다 */
function chooseCard(id: PickId): void {
  chosen = id
  for (const b of ui.querySelectorAll<HTMLElement>('.picks .pk')) b.classList.toggle('on', b.dataset['pick'] === id)
  const ok = ui.querySelector<HTMLButtonElement>('.pickbar button')
  if (ok !== null) { ok.disabled = false; ok.textContent = `이걸로 · ${PICK_UI.find((p) => p.id === id)?.name ?? ''}` }
  playUi(sfx, 'press')
}
function pickBar(): void {
  if (!picking) return
  const bar = ui.querySelector<HTMLElement>('.picks .auto i')
  if (bar !== null) bar.style.width = `${Math.max(0, (run.pickLeft / P.pirate.pickSec) * 100).toFixed(1)}%`
  const left = ui.querySelector<HTMLElement>('.picks .left')
  if (left !== null) left.textContent = `남은 시간 ${Math.ceil(Math.max(0, run.pickLeft))}초`
  // 눌러 둔 것이 있는데 시간이 다 되면 그것으로 (안 눌렀으면 첫째)
  if (chosen !== null && run.pickLeft < 0.1 && run.phase === 'pick') pickBoon(run, chosen)
}
function donePick(id: PickId): void {
  picking = false
  ui.classList.remove('picking')
  const el = ui.querySelector<HTMLElement>('.picks')
  if (el !== null) el.style.pointerEvents = 'none' // 사라지는 동안 판 위 손가락을 먹지 않는다
  el?.querySelector(`[data-pick="${id}"]`)?.classList.add('on')
  ui.querySelector('.pickbar')?.remove()
  chosen = null
  setTimeout(() => el?.remove(), 380)
  banner(PICK_UI.find((p) => p.id === id)?.name ?? '')
  playUi(sfx, 'unlock')
}

function start(): void {
  run = createPirate(opts)
  live = true
  picking = false
  ui.classList.remove('picking')
  acc = 0
  buildHud()
}

function showEnd(won: boolean, held: number): void {
  live = false
  hudEl = null
  if (run.shots > 0) send({ held, won, perfect: run.perfect })
  else send({ skip: true })
  const stats = '<div class="stats">'
    + `<span>${img(IMG.wave)}물결<b>${held}/${WAVE_COUNT}</b></span>`
    + `<span>${img(IMG.wall)}목책<b>${Math.max(0, run.lives)}/${run.livesMax}</b></span>`
    + `<span>${img(IMG.arrows)}쏜 살<b>${run.shots}</b></span></div>`
  const stamp = img(won ? IMG.stampOk : IMG.stampFail, 'stamp')
  card(won
    ? `${stamp}<h1>${run.perfect ? '두목을 사로잡았다' : '물결 셋을 다 막았다'}</h1><p>${run.perfect ? '목책이 한 칸도 부서지지 않았다. 두목을 묶어 두고 쇠를 곱절로 거둔다.' : bandit ? '산적들이 산으로 달아난다. 남기고 간 쇠를 거둔다.' : '도적들이 배를 버리고 달아난다. 남기고 간 쇠를 거둔다.'}</p>${stats}<div class="btns"><button class="on" data-act="back">돌아가기</button></div>`
    : `${stamp}<h1>${NTH[Math.min(2, held)]} 물결에 목책이 뚫렸다</h1><p>${held > 0 ? `${['', '물결 하나를', '물결 둘을'][held]} 막아 낸 만큼 잃는 것이 줄었다.` : bandit ? '산적들이 마을로 쏟아져 들어온다.' : '도적들이 포구로 쏟아져 들어온다.'}</p>${stats}<div class="btns"><button class="on" data-act="back">돌아가기</button></div>`,
  `end ${won ? (run.perfect ? 'won perfect' : 'won') : 'lost'}`)
}

ui.addEventListener('click', (ev) => {
  const pk = (ev.target as HTMLElement).closest<HTMLElement>('[data-pick]')
  if (pk !== null) { unlock(); if (run.phase === 'pick') chooseCard(pk.dataset['pick'] as PickId); return }
  if ((ev.target as HTMLElement).closest('[data-ok]') !== null) { unlock(); if (run.phase === 'pick' && chosen !== null) pickBoon(run, chosen); return }
  const t = (ev.target as HTMLElement).closest<HTMLElement>('[data-act]')
  if (t === null) return
  unlock()
  switch (t.dataset['act']) {
    case 'go': start(); break
    // 쏘고 나서 그만두면 지금 물결에서 뚫린 것 — 한 발도 안 쐈으면 안 싸운 것
    case 'quit': if (run.shots > 0) showEnd(false, run.held); else { send({ skip: true }); showIntro() } break
    case 'back': if (run.shots === 0) send({ skip: true }); location.href = back; break
    default: break
  }
})

let unlocked = false
function unlock(): void {
  if (unlocked) return
  unlocked = true
  unlockSfx(sfx)
}
// 폰 크롬은 손을 뗄 때(pointerup)에야 소리를 허락한다 — 누를 때와 뗄 때 모두 깨운다 (11-12 형: 소리가 맛이 안 난다)
function wakeSound(): void {
  unlocked = false
  unlock()
}
canvas.addEventListener('pointerdown', wakeSound, { passive: true })
canvas.addEventListener('pointerup', wakeSound, { passive: true })

/** 판의 사건 → 띠·글자·소리 (WWE: 막으면 크게, 뚫리면 붉게) — 머리띠의 숫자는 updateHud 가 프레임마다 맞춘다 */
function pumpRun(): void {
  for (const e of run.events) {
    if (e.t === 'wave') banner(`${NTH[e.k]} 물결`)
    else if (e.t === 'clear' && e.k < WAVE_COUNT - 1) { banner('막았다!'); playUi(sfx, 'levelup') }
    else if (e.t === 'pick') showPick()
    else if (e.t === 'picked') donePick(e.id)
    else if (e.t === 'break') { flash(); shakeWall() }
    else if (e.t === 'arm') playUi(sfx, 'unlock')
  }
  run.events.length = 0
}

// ───────────────────────── 돌림 (활터 루프와 같다 · 숨은 탭에선 멈춘다) ─────────────────────────

/** 쏘는 순간 화면이 뒤로 밀렸다 돌아온다 (캔버스를 옮긴다 · 물리와 무관) · 한 놈 쓰러지면 잠깐 멈칫 */
let kickAt = -1e9
let killUntil = 0
const KICK_MS = 110
function feelEvents(w: World, now: number): void {
  for (const e of w.events) {
    if (e.t === 'release') kickAt = now
    else if (e.t === 'foe_down') killUntil = now + P.pirate.killStopMs
  }
  const k = (now - kickAt) / KICK_MS
  canvas.style.transform = k >= 0 && k < 1 ? `translateX(${(-P.pirate.kickPx * (1 - k) * (1 - k)).toFixed(2)}px)` : ''
}

let raf = 0
let last = 0
let acc = 0

/** 개발 서버에서만 — 프레임 안에서 쓴 시간 (tools/pirate-probe.ts 가 읽는다) */
const perf = { frames: 0, workMs: 0, worstMs: 0 }
/** 다음에 그릴 때 (ms) · 그 박자보다 이만큼 일찍 온 프레임은 그린다 (rAF 시각이 조금씩 흔들린다) */
let nextAt = 0
const FRAME_SLACK_MS = 2

function frame(now: number): void {
  raf = 0
  if (document.hidden) return
  raf = requestAnimationFrame(frame)
  // 그리기 상한 — 90·120Hz 폰(갤럭시 플립)에서 두 배로 그리지 않는다. 박자(nextAt)로 세어 90·75Hz 화면에서도 반토막(45·37fps)이 나지 않게 한다.
  // last 를 안 고치니 건너뛴 시간은 다음 dt 에 쌓인다 (결정론 그대로)
  const period = 1000 / P.pirate.maxFps
  if (last !== 0 && now < nextAt - FRAME_SLACK_MS) return
  nextAt = now - nextAt > period ? now + period : nextAt + period
  const t0 = import.meta.env.DEV ? performance.now() : 0
  const realDt = last === 0 ? 0 : (now - last) / 1000
  last = now
  const w = run.w
  if (live) {
    const ph = w.archer.phase
    const frozen = (getHitStopMs(renderer) > 0 || now < killUntil) && ph !== 'drawing' && ph !== 'full'
    const maxFrame = w.dt * P.sim.maxCatchUpSteps
    if (!frozen) acc += realDt < maxFrame ? realDt : maxFrame
    let steps = 0
    while (acc >= w.dt && steps < P.sim.maxCatchUpSteps) {
      input.syncAim(w.archer.x, w.archer.y)
      stepPirate(run, input.frame)
      input.endStep()
      acc -= w.dt
      steps++
    }
    if (steps >= P.sim.maxCatchUpSteps) acc = 0
    pumpRun()
    updateHud(now / 1000, realDt)
    pickBar()
  }
  feelEvents(w, now)
  try {
    pumpSfx(sfx, w)
    updateSfx(sfx, w, realDt)
  } catch {
    /* 이번 프레임 소리를 포기할 뿐이다 */
  }
  try {
    renderer.draw(w, live ? acc / w.dt : 0, realDt, hud)
    if (live) drawPull(ctx2, input.pull) // 당김 고리·호 (renderer 가 dpr 변환을 걸어 둔 채라 CSS px 로 그린다)
  } finally {
    w.events.length = 0
  }
  // 마지막 살이 멎은 뒤에 끝 화면을 띄운다
  if (live && run.result !== null && isSettled(w)) {
    showEnd(run.result.won, run.result.held)
  }
  if (import.meta.env.DEV) {
    const ms = performance.now() - t0
    perf.frames++
    perf.workMs += ms
    if (ms > perf.worstMs) perf.worstMs = ms
  }
}

function wake(): void {
  if (raf === 0 && !document.hidden) {
    last = 0
    raf = requestAnimationFrame(frame)
  }
}
document.addEventListener('visibilitychange', wake)
// ── 세로 폰은 판을 통째로 눕힌다 (형 11-08: "가로로 보게 해야지 활쏘기는. 세로는 너무 작잖아") ──
// 밤 판(night-main.ts layoutStage)과 같은 길: 판 점 (x, y) → 화면 (innerWidth − y, x) · 오른쪽으로 90°. 폰을 왼쪽으로 눕혀 쥔다.
// 활터 입력(input/pointer.ts)도 같이 돌려 푼다 (setRotated). 틀 안이면 칠십팔국에 알려 바깥 「닫기」도 같이 눕힌다.
const stageEl = document.getElementById('stage') as HTMLDivElement
const ROTATED_MSG = 'hanbal.night.rotated'
let rotatedNow: boolean | null = null
function layoutStage(): void {
  const rot = innerHeight > innerWidth
  const st = stageEl.style
  if (rot) {
    st.width = `${innerHeight}px`
    st.height = `${innerWidth}px`
    st.transform = `translate(${innerWidth}px, 0) rotate(90deg)`
  } else {
    st.width = '100%'
    st.height = '100%'
    st.transform = ''
  }
  if (rot !== rotatedNow) {
    rotatedNow = rot
    input.setRotated(rot)
  }
  if (window.parent !== window) window.parent.postMessage({ type: ROTATED_MSG, rot }, location.origin)
  renderer.resize()
}
addEventListener('resize', layoutStage, { passive: true })
addEventListener('orientationchange', layoutStage, { passive: true })
layoutStage()

showIntro()
wake()

// 개발 서버에서만 — 헤드리스 시험이 판을 들여다보고 쏜다 (tools 의 화면 확인용 · 빌드에는 안 들어간다)
if (import.meta.env.DEV) (window as unknown as { __pirate: unknown }).__pirate = { get run() { return run }, perf, renderer }
