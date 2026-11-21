import { createEndingVideo } from './raid/ending-video.ts'
import './raid/ending-video.css'
import { imugiVisualBounds } from './raid/imugi-view.ts'
import { fieldPixels, raidLowGraphics } from './raid/surface.ts'
import { breakthroughText, isBreakthrough } from './realm/vanguard.ts'
import { HAEBI_RUN as C, HAEBI_STICK as STICK, HAEBI_TREE as TREE, HAEBI_ULT as ULT, HAEBI_AWAKEN as AWK, HAEBI_STAGES as ST, HAEBI_ZOOM as ZOOM, HAEBI_SPEED as SPEED, HAEBI_GIANT as GIANT } from './tune/params.ts'
import { createHaebi, runDuration, raidRulesForStage, giantMob, giantHUD, championViewNeeded, stepHaebi, barrageArcher, choose, reroll, POWERS, kitCombos, KITS, xpNeeded, phase, runGold, isCombo, comboOf, comboRank, gaugeRatio, awakenedLook, usesPermanentAwakening, normalizedRaidOpts, castWallSeconds, nodeText, nodeAt, branchName, wakeReady, ultName, ultOpen, BRANCHES, branchNodes, type Kit, type Power, type Pick, type HaebiRun, type RunInput, type StageId } from './raid/haebi.ts'
import { startRecord, recInput, gridInput, recPick, recReroll, recQuit, withdrawRun, sealInput, finishRecord, STEP, type Recorder } from './raid/runlog.ts'
import { runFrame, speedOf, nextSpeed, speedLevel } from './raid/speed.ts'
import { RaidFeel } from './raid/impact.ts'
import { RaidEnding } from './raid/ending.ts'
import { drawEnding } from './raid/ending-view.ts'
import { HAEBI_END as END } from './tune/params.ts'
import { warmFx } from './raid/fx-art.ts'
import { putRaidGame, sealLeftovers, unsentRaids, markRaidsSent, type RaidGame, type RaidOpts } from './raid/runlog-store.ts'
import { pushRaids } from './net/sync.ts'
import { newCam, followCam, nextLevel, closest, toField, fieldView, clampCenter, bossFrameZoom } from './raid/camera.ts'
import { loadMeta, saveMeta, buy, refund, refundFee, record, shopCost, shopMax, stageOpen, stageName, pickStage, SHOP, STAGE_ORDER, type ShopKey } from './raid/meta.ts'
import { drawField, imagePaths, setHeroArt, heroArtFiles, heroHdFiles, warmHeroSprites } from './raid/haebi-view.ts'
import { powerIcon, installPowerHints, comboIcon, rankMark, treeInfo, BRANCH_COLOR } from './raid/power-ui.ts'
import { KIT_BY_SPRITE } from './raid/kit-table.ts'
import { cutBandHtml, cutHeroPath, ensureCutinBandCss, type CutBg } from './ui/cutin-band.ts'
import { josa } from './core/josa.ts'
import { hitPortrait, hitStrength, hitArtKey, hitKeyPath, warmHitArt } from './ui/hit-portrait.ts'
import { raidSound } from './raid/sound.ts'
import { DEFAULT_HERO, DEMON_STAGE, SEAL_STAGE, loadRoster, stampDemons, type RosterHero } from './raid/link.ts'
import { TRUE_WAKE } from './realm/data/awaken2.ts'
import { DLC } from './realm/dlc.ts'
import { legacyAwakeningOpen } from './realm/trial-rules.ts'
import { AWAKENING_KEY, readAwakeningProfile, readHeroAwakening, setHeroAwakeningAppearance } from './ui/realm/awakening-store.ts'
import { hringCss, mountRing, ringFaces, ringHtml, type RingHandle, type RingHero, type RingOpts } from './ui/realm/hero-ring.ts'
import { awakeningPersonAllowed } from './realm/awakening.ts'
import { personOf } from './realm/person.ts'
import { genArtOf } from './realm/data/art.ts'
import { P } from './tune/params.ts'
import './raid/combat.css'
import './raid/awakening-cutin.css'
import './raid/giant-hud.css'
import { RaidGiantHud } from './raid/giant-hud.ts'
import { prewarmImugiArt } from './raid/imugi-art.ts'
import { prewarmTigerArt } from './raid/tiger-art.ts'
import { tigerVisualBounds } from './raid/tiger-view.ts'
import { prewarmGumihoArt } from './raid/gumiho-art.ts'
import { gumihoVisualBounds } from './raid/gumiho-view.ts'
import { GIANT_NAMES, giantEntrySeconds } from './raid/giant.ts'
import { RaidAwakeningCutin } from './raid/awakening-cutin.ts'
import { prewarmAwakeUlt } from './raid/awake-ult-art.ts'
import { HAEBI_AWAKEN_ULT as AC } from './tune/params.ts'
import './raid/pause.css'
import { raidShortcut, keyHints } from './raid/keyboard.ts'
import './raid/keyboard.css'
import './raid/card-skins.css'
import './raid/skill-tree-view.css'
import { nodeOpen, kitPowers } from './raid/haebi.ts'
import { skillTreeHtml, drawTreeLinks, flashTreeParents, highlightTreePath } from './raid/skill-tree-view.ts'
import { guardMedia } from './ui/media-guard.ts'
import { haptics } from './ui/haptics.ts'
/** 금은 글자 대신 동전 그림 (형 11-19 「금도 아이콘으로 해야겠음 텍스트 말고」) */
const COIN = `<img class="coin" src="${import.meta.env.BASE_URL}realm/raid/coins.png" alt="금" draggable="false">`
guardMedia() // 그림 길게 누름 메뉴·끌기 막기 (11-19)

const root = document.querySelector<HTMLDivElement>('#raid')!
const query = new URLSearchParams(location.search)
const vanguardToken = window.parent !== window ? query.get('vanguard') : null
const trialToken = window.parent !== window ? new URLSearchParams(location.search).get('trial') : null
/** 판: 본편 선봉 · 본편 각성 시련(짧고 쉬움) · 독립 열전(스테이지·상점·휘장 · 형 11-16 「따로 떼기」) */
const mode = query.has('vanguard') ? 'vanguard' : trialToken ? 'trial' : 'stage'
/**
 * 본편 장수 판에서 연 열전 (app.ts openRaidStage) — 장수마다 본편 한 달에 한 번이라 (형 11-19) 이 틀에서는 한 판만 싸운다:
 * 출전하면 본편에 알리고(그 달은 쓴 것) · 끝나면 「본편으로」만 · 장수 바꾸기도 숨긴다. 주소로 따로 연 열전(본편 틀 밖)은 그대로 연습판이다
 */
const campaignToken = window.parent !== window && mode === 'stage' ? query.get('campaign') : null
/** 본편에서 연 판 (열전 · 각성 시련 · 선봉) — 결과 화면에 「다시 출전」이 없다 */
const fromCampaign = campaignToken !== null || trialToken !== null || vanguardToken !== null
let campaignBegun = false
/**
 * 열전에 서는 장수 — 본편(app.ts)이 주소로 넘긴다. 없으면 해비 (형 11-15: 각성 시련을 모든 장수로).
 * 겉모습만 정하는 값이라 주소를 믿는다: 보상은 본편이 제 쪽 기록(토큰·장수 id)으로만 준다.
 */
const esc = (t: string) => t.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
const sprite = query.get('sprite') ?? 'haebi'
const askedKit = query.get('kit') as Kit | null
const kit: Kit = askedKit && askedKit in KITS ? askedKit : KIT_BY_SPRITE[sprite] ?? 'sword'
const HERO = { name: esc(query.get('name') ?? '해비'), bust: query.get('bust') ?? 'w-95-michuhol-haebi', home: esc(query.get('home') ?? '미추홀의 장수'),
  awake: query.get('awake') ?? (sprite === 'haebi' ? 'aw1-haebi' : undefined), video: query.has('bust') ? query.get('video') === '1' : true }
const K = KITS[kit], weapon = K.weapon
/** 본편 장수 id — 열전 깸을 장수마다 적는다 (본편 진각성 자격 · raid/link.ts) */
const heroId = query.get('hero') ?? DEFAULT_HERO
/** 목소리 결 — 본편이 넘기면 그대로, 아니면 초상 이름의 앞 글자(w·l = 여인) */
const sound = raidSound((query.get('sex') ?? (/^[wl]-/.test(HERO.bust) ? 'f' : 'm')) === 'f', kit, () => DLC.trueWake && TRUE_WAKE.has(heroId) && (meta.heroes[heroId] ?? []).includes(SEAL_STAGE))   // 진각성(DLC)한 장수면 「진」 비기가 진각성 계단 소리·진동
setHeroArt(sprite, HERO.awake)
/** 판 밖 기록 (금·상점·휘장) — 독립 열전만 쓴다 */
const meta = loadMeta()
/** 영구 자격·모습은 출전 경계에서만 읽는다. 판과 재생은 이 snapshot만 쓴다. */
stampDemons()
let awakening = readHeroAwakening(localStorage, heroId)
const trialEntryClosed = () => mode === 'trial' && !legacyAwakeningOpen()
const mastery = (['forest', 'ford', 'palisade'] as const).every(id => (meta.heroes[heroId] ?? []).includes(id))
/** 골라 두는 스테이지 — 열렸고 아직 못 깬 첫 스테이지 · 목책의 벽 앞이면 여울 (meta.pickStage · 각성 v2 가9) */
let stage: Exclude<StageId, 'trial'> = pickStage(meta, kit)
/** 두목이 오는 때(분) — 수치에서 읽는다: 스테이지 19분(판은 20분30초) · 각성 시련 7분(판은 8분) */
const bossMinute = () => Math.floor(C.bossAt * ST[mode === 'trial' ? 'trial' : stage].length / 60)
const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`
/** createHaebi 에 넘기는 판 옵션 — 판 기록에도 이것 그대로 적는다 (다시 돌리기) */
const runOpts = (): RaidOpts => ({ ...mode === 'stage' ? { stage, bonus: { ...meta.shop } } : {}, ...mode === 'trial' ? { awaken: false, simRules: '53B' as const } : { permanentAwake: awakening.permanentAwake, appearanceAwake: awakening.appearanceAwake, simRules: mode === 'stage' ? raidRulesForStage(stage) : '56B' as const }, mastery })
const newRun = (seed: number, opts: RaidOpts = runOpts()) => { const r = createHaebi(seed, mode, kit, opts); if (r.message.endsWith('첫 조합을 향해')) { r.message = ''; r.messageTime = 0 }  /* 시작 군말 띠는 걷는다 (형 11-16) */ return r }
root.innerHTML = `<header><div><small>장수 열전 · 독립 모드</small><h1>${HERO.name} <em>${K.title}</em></h1></div><div class="head-actions"><button id="pause" disabled aria-label="일시정지">Ⅱ</button></div></header>
<div id="layout"><aside id="character"><div id="portrait-media"><img id="hero-portrait" src="${import.meta.env.BASE_URL}realm/bust-hd/${HERO.bust}.jpg" alt="${HERO.name} 원화"><video id="hero-video" muted loop playsinline preload="none" hidden aria-label="각성 ${HERO.name} 영상"></video></div><div class="portrait-title"><span>${HERO.home}</span><b id="rank-title">${HERO.name}</b><button id="portrait-toggle" hidden>원화로 보기</button></div><div id="reaction">${weapon} 하나로 시작하는 열전</div><div id="combo-badges"></div><i class="frame-knots"></i></aside>
<main><section id="menu"><span class="eyebrow">장수 열전</span><h2>${HERO.name}<em>${K.title}</em></h2><p>능력을 고르고 두 힘을 묶어, ${bossMinute()}분을 버틴 뒤 오는 두목을 쓰러뜨리세요.</p><div class="journey"><span><b>01</b> 붉은 고리를 피하고</span><span><b>02</b> 두 힘을 묶어</span><span><b>03</b> 두목을 잡습니다</span></div><button id="start" class="primary" disabled aria-label="불러오는 중"><i class="load-dots" aria-hidden="true"><b></b><b></b><b></b></i></button><p class="controls">이동 WASD·방향키·화면 누르기 · 회피 Shift · 비기 Space · 투지 E · 배속 X · 일시정지 Esc</p><p class="note">본편의 병력과 따로인 한 판입니다.</p></section>
<section id="play" hidden><div id="arena"><canvas id="field" width="${C.width}" height="${C.height}" aria-label="${HERO.name} 토벌 전장. 클릭 또는 드래그로 이동"></canvas><div id="combat-hud"><div class="health-line"><b>${HERO.name}</b><span id="health">180 / 180</span></div><div class="bar hp"><span class="hp-track"><i id="hp-fill"></i><em id="hp-chunk"></em><b id="hp-ward" hidden></b></span></div><div id="wake-bar" class="grit" aria-label="투지 막대"><i id="wake-fill"></i></div><div id="loadout" aria-label="획득한 전투 능력"></div></div><div id="hud"><small id="phase"></small><b id="clock"></b></div><div id="score"><b id="kills"></b><small>격파</small><b id="level"></b></div><div class="bar xp"><i id="xp-fill"></i></div><div id="announcement" aria-live="polite"></div><div id="streak"></div><footer><button id="wake" class="grit" hidden aria-label="투지 E"><b>투지</b><small>E</small></button><span id="hint">자동 공격 · 화면을 끌면 그쪽으로 이동 · 능력 아이콘을 누르고 있으면 설명</span><button id="dash">회피 Shift</button><button id="skill" class="primary" data-kit="${kit}">${K.skill} Space</button></footer><div id="stick" hidden aria-hidden="true"><i></i></div><i class="frame-knots"></i></div></section></main></div><div id="power-tooltip" role="tooltip" hidden></div><div id="overlay" hidden></div>`
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T
const endingMediaHost = document.createElement('div')
root.appendChild(endingMediaHost)
const endingVideo = createEndingVideo(import.meta.env.BASE_URL)
function syncEndingVideo() {
  endingVideo.sync({ host: endingMediaHost, run: live ? run : null, portraitKey: HERO.bust,
    kind: ending.ready ? ending.kind : null, visible: !document.hidden && !$('overlay').hidden, lowGraphics: fieldLowGraphics })
}

let baseArtReady = false, beginning = false
let startRevision = 0
function cancelBegin() { startRevision++; beginning = false; $<HTMLButtonElement>('start').disabled = !baseArtReady || trialEntryClosed(); if (baseArtReady) $('start').textContent = startLabel() }
const giantHud = new RaidGiantHud($('arena'), GIANT.phaseCuts)
let giantCameraOwner: ReturnType<typeof giantMob> | null = null
let giantZoomRestore: number | null = null
let giantAutoFraming = false
let giantFitZoom: number = GIANT.cameraZoom
function restoreGiantZoom() { giantAutoFraming = false; if (giantZoomRestore !== null) { cam.level = giantZoomRestore; giantZoomRestore = null; paintZoom() } }
const giantResultLine = () => { const g = giantHUD(run); return run.state === 'lost' && g ? `<p>보스 남은 체력 ${Math.ceil(100 * Math.max(0, g.hp) / g.max)}%</p>` : '' }
root.insertAdjacentHTML('beforeend', `<div id="rotate-guide" hidden><div><span style="font-size:44px">↻</span><h2>폰을 가로로 돌려 주세요</h2><p>확대 ${josa(HERO.name, '과', '와')} 전장을 함께 보며 싸웁니다.<br>회전하는 동안 전투는 멈춰 있습니다.</p></div></div>`)
/** 비기 컷인 띠의 기운 바탕 — 묶음마다 (fx/skill/bg/<결>.webp) */
const KIT_BG: Record<Kit, CutBg> = { axe: 'earth', bow: 'arrow', spear: 'wind', sword: 'bolt', dagger: 'shadow', magic: 'spirit', sling: 'earth' }
ensureCutinBandCss()
$('arena').insertAdjacentHTML('beforeend', '<div id="skill-cutin" hidden aria-hidden="true"></div>')
let cutinUntil = 0
const bigCutin = new RaidAwakeningCutin($('skill-cutin'), import.meta.env.BASE_URL + 'realm/', HERO.bust, K.skill, query.get('name') ?? '해비')
/**
 * 비기 컷인 · 각성 컷인 — 본편과 같은 띠(ui/cutin-band.ts). 판 안에서 각성해 있으면 1차 각성 윗몸 → 기본 윗몸 → 각성 초상 순.
 * 띠를 새로 그려 넣으니 애니는 매번 처음부터 · 화면을 누르면 걷힌다 (판은 그대로 돈다).
 */
function showSkillCutin(wake = false, tru = false) {
  // 시전(판 시각 cast)이 끝나는 순간 띠가 번쩍이며 걷히기 시작하고 비기가 터진다 — 판이 느려지므로 화면에선 cast ÷ slow 초 (11-17 형: 「컷인 보고 → 데미지 보고」)
  if (wake && usesPermanentAwakening(run)) return
  if (run.cast?.awakened && run.cast.seq !== undefined) {
    skipCutin(); bigCutin.show(run, awakenedLook(run)); cutinUntil = run.t + run.cast.t + AC.exitSeconds; return
  }
  const awake = usesPermanentAwakening(run) ? run.cast?.awakened === true : tru
  const face = awakenedLook(run) ? `../awaken-hd/${HERO.bust}` : HERO.bust, cast = run.cast?.total ?? (wake ? AWK.cast : tru ? ULT.trueCast : ULT.cast), hit = run.cast ? castWallSeconds(run.cast) * 1000 : cast / ULT.slow * 1000
  const cut = $('skill-cutin')
  cut.innerHTML = cutBandHtml({ art: import.meta.env.BASE_URL + 'realm/', bg: KIT_BG[kit], hero: cutHeroPath(face), endMs: hit / .88, hitMs: hit,
    title: wake ? `투지 · ${HERO.name}` : usesPermanentAwakening(run) ? K.skill : ultName(kit, tru), ...wake ? {} : { sub: HERO.name }, dim: C.skillCutinDim, grand: wake || awake })
  cut.hidden = false; cutinUntil = run.t + cast + C.skillCutinTail
}
function skipCutin() { bigCutin.clear(); cutinUntil = 0; if (!$('skill-cutin').hidden) { $('skill-cutin').hidden = true; $('skill-cutin').innerHTML = ''; cutinUntil = 0 } }
$('pause').insertAdjacentHTML('beforebegin', '<button id="fullscreen">전체화면</button>')
$('fullscreen').textContent = '⛶'; $('fullscreen').setAttribute('aria-label', '전체화면');
$('fullscreen').onclick = () => { if (document.fullscreenElement) void document.exitFullscreen?.(); else void document.documentElement.requestFullscreen?.().catch(() => undefined) }
/**
 * 전투판 확대 돋보기 (11-19 형: 「한 번 누르면 조금 · 한 번 더 누르면 더 가까이 · 그때는 돋보기 − 로 바뀌고 · 누르면 원래대로」) — 우상단 전체화면 왼쪽.
 * 확대 중엔 카메라가 장수를 따라간다 (raid/camera.ts · 맵 끝에서는 판 밖이 보이지 않게 가장자리에 멈춤) · 판의 셈은 그대로 · 단계는 판 사이에 기억
 */
const ZOOM_KEY = 'hanbal.raid.zoom'
const cam = newCam((() => { try { return Number(localStorage.getItem(ZOOM_KEY) ?? 0) } catch { return 0 } })())
const zoomSvg = (minus: boolean) => `<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="13.5" cy="13.5" r="9" fill="#0d1a17aa" stroke="currentColor" stroke-width="3"/><path d="M20.6 20.6 28 28" stroke="currentColor" stroke-width="4.4" stroke-linecap="round"/><path d="M9.2 13.5h8.6${minus ? '' : 'M13.5 9.2v8.6'}" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/></svg>`
$('fullscreen').insertAdjacentHTML('beforebegin', '<button id="zoom"></button>')
const zoomBtn = $<HTMLButtonElement>('zoom')
zoomBtn.style.setProperty('--pop', ZOOM.pop + 's')
function paintZoom() {
  const minus = closest(cam.level)
  zoomBtn.innerHTML = zoomSvg(minus); zoomBtn.classList.toggle('on', cam.level > 0)
  zoomBtn.setAttribute('aria-pressed', String(cam.level > 0)); zoomBtn.setAttribute('aria-label', minus ? '원래 크기로' : '전투판 확대')
}
function cycleZoom() {
  giantAutoFraming = false
  giantZoomRestore = null // A deliberate zoom choice supersedes the temporary boss framing.
  cam.level = nextLevel(cam.level); paintZoom()
  try { localStorage.setItem(ZOOM_KEY, String(cam.level)) } catch { /* 이번 창만 */ }
  prepareHeroRaster(cam.zoom)
  zoomBtn.classList.remove('pop'); void zoomBtn.offsetWidth; zoomBtn.classList.add('pop')   // 누르면 크게 튀었다 돌아온다 (매번 처음부터)
}
zoomBtn.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); cycleZoom() })
zoomBtn.addEventListener('click', e => { if (e.detail === 0) cycleZoom(); zoomBtn.blur() })   // 키보드로 눌렀을 때만 (손가락·마우스는 pointerdown 에서)
zoomBtn.addEventListener('animationend', () => zoomBtn.classList.remove('pop'))
paintZoom()
/**
 * 판 빠르기 (11-19 형: 「×1 누르면 ×2 · 또 누르면 ×3 · 한 번 더 누르면 ×1」) — 돋보기 왼쪽 · 단축키 X · 단계는 판 사이에 기억.
 * 걸음 크기는 그대로 두고 한 프레임에 더 돌린다 (raid/speed.ts runFrame) · 레벨업 카드·멈춤·결과 창에서는 판이 원래대로 서 있다
 */
const SHORT_CUTIN_KEY = 'hanbal.raid.shortCutin'
let shortCutin = (() => { try { return localStorage.getItem(SHORT_CUTIN_KEY) === '1' } catch { return false } })()
const SPEED_KEY = 'hanbal.raid.speed'
let speed = speedLevel((() => { try { return localStorage.getItem(SPEED_KEY) } catch { return 0 } })())
zoomBtn.insertAdjacentHTML('beforebegin', '<button id="speed"></button>')
const speedBtn = $<HTMLButtonElement>('speed')
speedBtn.style.setProperty('--pop', SPEED.pop + 's')
function paintSpeed() {
  const x = speedOf(speed)
  speedBtn.textContent = `×${x}`; speedBtn.classList.toggle('on', x > 1)
  speedBtn.setAttribute('aria-pressed', String(x > 1)); speedBtn.setAttribute('aria-label', `배속 ${x}배`)
}
function cycleSpeed() {
  speed = nextSpeed(speed); paintSpeed()
  try { localStorage.setItem(SPEED_KEY, String(speed)) } catch { /* 이번 창만 */ }
  speedBtn.classList.remove('pop'); void speedBtn.offsetWidth; speedBtn.classList.add('pop')   // 누르면 크게 튀었다 돌아온다 (매번 처음부터)
}
speedBtn.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); cycleSpeed() })
speedBtn.addEventListener('click', e => { if (e.detail === 0) cycleSpeed(); speedBtn.blur() })   // 키보드로 눌렀을 때만
speedBtn.addEventListener('animationend', () => speedBtn.classList.remove('pop'))
paintSpeed()
if (campaignToken) root.querySelector('header small')!.textContent = `본편 · ${HERO.name}의 열전`
if (trialToken) {
  document.body.classList.add('campaign-trial')
  root.querySelector('header small')!.textContent = `본편 · ${HERO.name}의 각성 시련`
  $('menu').querySelector('.note')!.textContent = `두목을 쓰러뜨리고 돌아가면 본편의 ${josa(HERO.name, '이', '가')} 각성합니다.`
}
if (mode === 'vanguard') {
  document.body.classList.add('campaign-vanguard')
  root.querySelector('header small')!.textContent = '본편 합전 · 선봉에 서기'
  $('menu').querySelector('h2')!.innerHTML = awakening.permanentAwake ? '각성의 힘으로<br><em>본대가 나아갈 길을 열어라.</em>' : '선봉에 서서<br><em>본대가 나아갈 길을 열어라.</em>'
  $('menu').querySelector('p')!.textContent = `${(([a, b]) => `${josa(a!, '과', '와')} ${josa(b!, '을', '를')}`)(kitCombos(kit).filter(c => c.kit === kit).map(c => c.name))} 갖추고 출전합니다. 최대 3분 동안 전위대장 셋을 격파하세요.`
  $('menu').querySelector('.journey')!.innerHTML = '<span><b>1 돌파</b> 적 앞줄 −4% · 아군 힘 +35%</span><span><b>2 돌파</b> −8% · +55%</span><span><b>3 돌파</b> −12% · +75%</span>'
  $('menu').querySelector('.note')!.textContent = '한 전투에 한 번. 돌파 후 이번 합의 앞줄 싸움에 반영됩니다. 중도 귀환·패배도 확보한 성과는 유지되며 각성은 풀리지 않습니다.'
}
/**
 * 본편으로 나가는 길 (11-19 형: 「열전에 닫기는 없애도 되지 않을까 · 정지하고 거기까지의 돈 얻는 거 확인하고 끝내야지」) — 본편 틀의 「닫기」는 없다.
 * 판 밖(출전 화면)은 「본편으로」 · 판 중에는 멈춤 → 물러나기 → 결과 → 「본편으로」. 선봉은 본편 쪽 「출전 취소」가 따로 있다 (raid/vanguard-bridge.ts)
 */
const toRealm = window.parent !== window && mode !== 'vanguard' ? '<button id="to-realm">본편으로</button>' : ''
const leaveToRealm = () => location.replace('about:blank')   // 본편 틀이 about:blank 를 보면 닫는다 (app.ts openFrame)
if (toRealm) $('menu').querySelector('.note')!.insertAdjacentHTML('beforeend', toRealm)
$('menu').addEventListener('click', e => { if ((e.target as Element).closest('#to-realm')) leaveToRealm() })
root.insertAdjacentHTML('beforeend', '<div id="shop" hidden></div>')
const durationLabel = () => `${Math.floor(runDuration(run) / 60)}분${runDuration(run) % 60 ? ` ${Math.floor(runDuration(run) % 60)}초` : ''}`
const startLabel = () => trialEntryClosed() ? '목책 돌파로 각성' : mode === 'vanguard' ? `${awakening.permanentAwake ? '각성 ' : ''}${HERO.name} 출전 · 최대 3분` : mode === 'trial' ? `${HERO.name} 출전 · ${durationLabel()}` : `${stageName(stage)} 출전 · ${durationLabel()}`
/** 독립 열전 출전 화면: 스테이지 다섯(11-16 설원 고개·불타는 산성 더함 · 앞을 깨면 다음이 열림 · 깨면 휘장) + 금 + 상점 (형 11-16 다이센카식) */
const STAGE_GLYPH: Record<string, string> = { forest: '林', ford: '灘', palisade: '柵', snow: '雪', fortress: '城' }
function renderStageMenu() {
  renderAwakeningChoice()
  if (trialEntryClosed()) {
    $<HTMLButtonElement>('start').disabled = true
    $('start').textContent = startLabel()
    $('menu').querySelector('p')!.textContent = '이전 각성 시련은 닫혔습니다. 이 장수로 열전 목책의 도깨비를 쓰러뜨리면 영구 각성합니다.'
    $('menu').querySelector('.note')!.innerHTML = toRealm
  }
  if (mode !== 'stage') return
  const menu = $('menu')
  const rules = raidRulesForStage(stage), giantTitle = rules === '55-IMUGI' ? GIANT_NAMES.imugi : rules === '55-TIGER' ? GIANT_NAMES.tiger : rules === '55-GUMIHO' ? GIANT_NAMES.gumiho : null
  menu.querySelector('p')!.textContent = giantTitle ? `${Math.floor(C.bossAt * ST[stage].length * GIANT.midFraction / 60)}분의 중간 보스를 넘고 ${bossMinute()}분에 나타나는 ${josa(giantTitle, '을', '를')} 쓰러뜨리면 휘장을 받습니다. 쓰러져도 버틴 만큼 금을 받아 상점에서 영구 강화를 삽니다.` : `${bossMinute()}분을 버틴 뒤 오는 두목을 쓰러뜨리면 휘장과 많은 금을 받습니다. 쓰러져도 버틴 만큼 금을 받아 상점에서 영구 강화를 삽니다.`
  const pick = menu.querySelector('.journey')!; pick.className = 'journey stage-pick'
  pick.innerHTML = STAGE_ORDER.map(id => {
    const open = stageOpen(meta, id), best = meta.best[id]
    return `<button data-stage="${id}" class="${id === stage ? 'on' : ''}" ${open ? '' : 'disabled title="앞 스테이지를 깨면 열립니다"'} aria-pressed="${id === stage}"><img class="emblem ${meta.cleared[id] ? 'got' : ''}" src="${import.meta.env.BASE_URL}realm/raid/emblem-${id}.png" alt="${STAGE_GLYPH[id]}"><b>${stageName(id)}</b><small>${!open ? '앞을 깨면 열립니다' : meta.cleared[id] ? '휘장 획득' : best ? `최고 ${clock(best)} 버팀` : '첫 도전'}</small></button>`
  }).join('')
  pick.querySelectorAll<HTMLButtonElement>('[data-stage]').forEach(b => b.onclick = () => { cancelBegin(); stage = b.dataset.stage as typeof stage; run = newRun(7); if (baseArtReady && !beginning) $<HTMLButtonElement>('start').disabled = trialEntryClosed(); renderStageMenu() })
  menu.querySelector('.note')!.innerHTML = `<span class="gold-line">${COIN}<b>${meta.gold.toLocaleString()}</b></span><button id="open-shop">상점 · 영구 강화</button>${campaignToken ? '' : '<button id="open-heroes">장수 바꾸기</button>'}${toRealm}`
  $('open-shop').onclick = () => { cancelBegin(); renderShop(); $('shop').hidden = false }
  if (!campaignToken) $('open-heroes').onclick = () => { cancelBegin(); $('shop').hidden = false; renderHeroes() }
  if (!$<HTMLButtonElement>('start').disabled) $('start').textContent = startLabel()
  keyHints(root)
}
/**
 * 데려갈 장수 — 본편에서 모은 우리 장수만 (본편이 raid/link.ts 에 적어 둔다 · 해비는 늘). 고르면 그 장수의 겉모습으로 열전을 다시 연다.
 * 진각성 그림이 있는 장수는 이 장수로 마지막 스테이지를 깨면 본편에서 진각성할 수 있다 (금빛 「진」 · 깼으면 ✓)
 * 얼굴 링 (ui/realm/hero-ring.ts · 58-B) — 데려갈 장수 · 단련터와 같은 고리. 한 명만 고른다: 고르면 목소리와 공격 한 번 ·
 * 고른 장수를 한 번 더 고르거나(Enter) 아래 「○○로 바꾸기」로 그 장수의 열전을 연다. 지금 장수를 고르면 그대로 닫는다.
 */
const HAEBI: RosterHero = { id: DEFAULT_HERO, name: '해비', home: '미추홀의 장수', bust: 'w-95-michuhol-haebi', sprite: 'haebi', awake: 'aw1-haebi', kit: 'axe', video: true }
const ART = import.meta.env.BASE_URL + 'realm/'
let heroRing: RingHandle | null = null
/** 얼굴 링 모양은 처음 열 때 한 번 (#shop 아래에서만) */
let ringStyled = false
/** 장수 바꾸기 판을 걷는다 — 링도 멈춘다 (상점과 같은 #shop 을 쓴다) */
function closeHeroes() { heroRing?.dispose(); heroRing = null; $('shop').classList.remove('hrgshop'); $('shop').hidden = true }
/** 고른 장수의 목소리 — 본편과 같은 대사 · 소리 끄기 · 크기를 따른다. 대사 셈(voice.ts)과 명부는 이 판을 처음 열 때 따로 받는다 */
let voiceKit: Promise<[typeof import('./ui/realm/voice.ts'), typeof import('./ui/realm/voice-hero.ts'), typeof import('./realm/dex.ts'), typeof import('./ui/realm/sound.ts')]> | null = null
const loadVoiceKit = () => voiceKit ??= Promise.all([import('./ui/realm/voice.ts'), import('./ui/realm/voice-hero.ts'), import('./realm/dex.ts'), import('./ui/realm/sound.ts')])
function heroVoice(id: string) {
  if (localStorage.getItem('hanbal.realm.mute') === '1' || query.has('silent')) return
  void loadVoiceKit().then(([v, vh, d, s]) => {
    if (document.hidden || !v.voiceGate(performance.now())) return
    const body = d.dexCatalog().find(x => x.id === id)?.hero
    const own = vh.heroVoiceDir(id)
    const path = body !== undefined ? v.voicePath(body, 'tap') : own !== null ? `${own}tap-1.ogg` : null
    const gain = s.soundVolume('voice')
    if (path !== null && gain > 0) s.playOnce(import.meta.env.BASE_URL + path, P.realm.voiceVol * gain)
  }).catch(() => undefined)
}
function renderHeroes() {
  heroRing?.dispose(); heroRing = null
  if (!ringStyled) { ringStyled = true; const st = document.createElement('style'); st.textContent = hringCss('#shop'); document.head.appendChild(st) }
  void loadVoiceKit()
  const list = [HAEBI, ...loadRoster().filter(h => h.id !== DEFAULT_HERO)]
  const sealed = (id: string) => (meta.heroes[id] ?? []).includes(SEAL_STAGE)
  // 각성 모습을 켜 둔 장수는 각성 초상 · 각성 전투 띠로 (출전 화면 초상과 같은 셈 · readHeroAwakening)
  const profile = readAwakeningProfile(localStorage)
  const looks = (id: string) => { const e = awakeningPersonAllowed(id) ? profile.people[personOf(id)] : undefined; return e?.unlocked === true && e.appearanceAwake !== false }
  const heroes: RingHero[] = list.map(h => {
    const aw = looks(h.id), tw = DLC.trueWake && TRUE_WAKE.has(h.id), k = KITS[h.kit]
    const won = STAGE_ORDER.filter(s => (meta.heroes[h.id] ?? []).includes(s))
    return {
      id: h.id, name: h.name, nameHtml: esc(h.name), from: h.home, lv: null, stats: [],
      ...ringFaces(ART, h.bust, aw),
      sprite: ART + genArtOf(aw && h.awake ? h.awake : h.sprite).file,
      extra: `<b class="rh-kit">${esc(k?.weapon ?? '')}</b>${k ? `<small class="rh-ult">${esc(k.skill)}</small>` : ''}${tw ? `<i class="tw${sealed(h.id) ? ' ok' : ''}">${sealed(h.id) ? '진 ✓' : '진'}</i>` : ''}${won.map(s => `<img class="rh-em" src="${ART}raid/emblem-${s}.png" alt="${esc(stageName(s))}" title="${esc(stageName(s))} 휘장">`).join('')}`,
      mark: tw ? (sealed(h.id) ? '진 ✓' : '진') : '',
    }
  })
  let pick = heroId
  const choose = (id: string) => {
    const h = list.find(x => x.id === id)
    if (!h || h.id === heroId) { closeHeroes(); return }
    const q = new URLSearchParams({ hero: h.id, name: h.name, home: h.home, bust: h.bust, sprite: h.sprite, kit: h.kit, video: h.video ? '1' : '0' })
    if (h.awake) q.set('awake', h.awake)
    location.replace(`${location.pathname}?${q}`)
  }
  const note = `본편에서 우리 장수가 되면 여기에 섭니다. ${DLC.trueWake ? `진 표시 장수는 ${josa(stageName(SEAL_STAGE), '을', '를')} 깨면 본편에서 진각성할 수 있습니다.` : '진각성은 추후 내려받을 묶음으로 준비 중입니다.'}`
  const opts: RingOpts = {
    heroes, max: 1, picked: [pick], start: heroId,
    text: { title: '데려갈 장수', party: '', prev: '이전 장수', next: '다음 장수', lv: n => String(n) },
    top: `<div class="rh-top"><h4 class="hrg-title">데려갈 장수 <small>${list.length}명</small></h4><p class="rh-note">${esc(note)}</p></div>`,
    // 한 명만 — 다른 장수를 고르면 그 장수로 옮겨 가고, 고른 장수를 한 번 더 고르면 그 장수로 연다
    onToggle: id => { if (id === pick) { choose(id); return [pick] } pick = id; paintGo(); return [pick] },
    onPicked: heroVoice,
  }
  $('shop').classList.add('hrgshop')
  $('shop').innerHTML = `<div class="hrgscr">${ringHtml(opts)}<div class="hrg-go"><button id="close-shop">닫기</button><button id="hero-go" class="primary" hidden><span></span></button></div></div>`
  const go = $<HTMLButtonElement>('hero-go')
  function paintGo() {
    const h = list.find(x => x.id === pick)
    go.hidden = !h || h.id === heroId
    if (h) go.querySelector('span')!.textContent = `${josa(h.name, '으로', '로')} 바꾸기`
  }
  go.onclick = () => choose(pick)
  $('close-shop').onclick = closeHeroes
  const host = $('shop').querySelector<HTMLElement>('.hrg')
  if (host) heroRing = mountRing(host, opts)
  keyHints(root)
}
function renderShop() {
  heroRing?.dispose(); heroRing = null; $('shop').classList.remove('hrgshop')
  const fee = refundFee(meta), refundPoor = meta.spent > 0 && meta.gold < fee
  $('shop').innerHTML = `<div class="panel shop"><small>장수 열전 · 판 밖 상점</small><h2>${COIN}${meta.gold.toLocaleString()}</h2><p>산 것은 다음 판부터 모든 장수에게 붙습니다. 되돌리기는 금을 내야 합니다.</p><div class="shop-grid">${SHOP.map(it => {
    const lv = meta.shop[it.key], max = shopMax(it.key), full = lv >= max, cost = full ? 0 : shopCost(it.key, lv), poor = !full && meta.gold < cost
    return `<button data-buy="${it.key}" class="${full ? 'maxed' : poor ? 'poor' : ''}" ${full || poor ? 'aria-disabled="true"' : ''}><img class="rune" src="${import.meta.env.BASE_URL}realm/raid/shop-${it.key}.png" alt="${it.glyph}"><b>${it.name} <i>${lv}/${max}</i></b><small>${it.desc(full ? lv : lv + 1)}</small><em>${full ? '다 올림' : poor ? `${COIN}${cost} · 모자람` : `${COIN}${cost}`}</em></button>`
  }).join('')}</div><div class="shop-actions"><button id="refund" class="${refundPoor ? 'poor' : ''}" ${meta.spent ? '' : 'disabled'} ${refundPoor ? 'aria-disabled="true"' : ''} aria-label="전부 되돌리기 · 값 금 ${fee}${refundPoor ? ' · 모자람' : ''}"><i class="rf-ic" aria-hidden="true">↺</i>전부 되돌리기 <em>${COIN}${fee.toLocaleString()}${refundPoor ? ' · 모자람' : ''}</em></button><button id="close-shop" class="primary">닫기</button></div>${refundAsk(fee)}</div>`
  // 금이 모자란 칸·되돌리기를 누르면 흔들린다 (못 하는 까닭 · 값 옆 「모자람」)
  const nudge = (b: HTMLElement) => { b.classList.remove('nudge'); void b.offsetWidth; b.classList.add('nudge') }
  $('shop').querySelectorAll<HTMLButtonElement>('[data-buy]').forEach(b => b.onclick = () => { if (buy(meta, b.dataset.buy as ShopKey)) { saveMeta(meta); run = newRun(7); renderShop(); renderStageMenu(); $('shop').querySelector(`[data-buy="${b.dataset.buy}"]`)?.classList.add('bought') } else if (b.classList.contains('poor')) nudge(b) })
  $('shop').querySelectorAll<HTMLElement>('[data-buy], #refund').forEach(b => b.addEventListener('animationend', e => { if (e.animationName === 'skill-nudge') b.classList.remove('nudge') }))
  // 되돌리기 (11-19 형: 「무료로 하지 말고 돈 써서」) — 한 번 묻고(게임 안 상자) 값을 낸다
  $('refund').onclick = () => { if (refundPoor) { nudge($('refund')); return } $('refund-ask').hidden = false; $('refund-yes').focus() }
  $('refund-no').onclick = () => { $('refund-ask').hidden = true }
  $('refund-yes').onclick = () => { if (!refund(meta)) { $('refund-ask').hidden = true; return } saveMeta(meta); run = newRun(7); renderShop(); renderStageMenu(); $('shop').querySelector('.panel.shop h2')?.classList.add('refunded') }
  $('close-shop').onclick = () => { $('shop').hidden = true }
  keyHints(root)
}
/** 되돌리기를 묻는 상자 (브라우저 confirm 대신 · 그림 셈: 돌려받는 금 + · 내는 값 −) */
function refundAsk(fee: number) {
  return `<div id="refund-ask" class="refund-ask" role="dialog" aria-label="전부 되돌리기" hidden><div><b><i class="rf-ic" aria-hidden="true">↺</i>전부 되돌리기</b><p>되돌리면 금 ${josa(fee.toLocaleString(), '을', '를')} 냅니다.</p><div class="ask-sum"><span class="back">${COIN}<b>+${meta.spent.toLocaleString()}</b></span><span class="pay">${COIN}<b>−${fee.toLocaleString()}</b></span></div><div class="ask-acts"><button id="refund-no">그만두기</button><button id="refund-yes" class="primary">되돌리기</button></div></div></div>`
}
const canvas = $<HTMLCanvasElement>('field'), ctx = canvas.getContext('2d', { alpha: false })!   // 판은 늘 바탕을 다 칠한다 — 불투명이면 폰이 겹치기를 덜 한다
const images = new Map<string, HTMLImageElement>(), keys = new Set<string>()
canvas.style.aspectRatio = C.width + '/' + C.height
const hdRequested = new Set<string>()
let heroWarmKey = ''
function prepareHeroRaster(zoom: number) {
  const density = zoom * Math.max(canvas.width / C.width, canvas.height / C.height), key = Math.ceil(density * 16) + ''
  if (key !== heroWarmKey) { heroWarmKey = key; warmHeroSprites(images, density) }
  for (const path of heroHdFiles(density)) if (!hdRequested.has(path)) {
    hdRequested.add(path); const img = new Image()
    img.onload = () => { void img.decode().catch(() => {}).then(() => { images.set(path, img); heroWarmKey = ''; prepareHeroRaster(cam.zoom) }) }
    img.onerror = () => {} // Optional HD failure keeps approved base art.
    img.src = import.meta.env.BASE_URL + 'realm/' + path
  }
}
let fieldLowGraphics = raidLowGraphics()
function syncFieldPixels() {
  const r = canvas.getBoundingClientRect(); if (!(r.width > 0 && r.height > 0)) return
  fieldLowGraphics = raidLowGraphics()
  const p = fieldPixels(r.width, r.height, devicePixelRatio, fieldLowGraphics)
  if (canvas.width !== p.width || canvas.height !== p.height) { canvas.width = p.width; canvas.height = p.height; heroWarmKey = '' }
  prepareHeroRaster(cam.zoom)
}
new ResizeObserver(syncFieldPixels).observe(canvas)
window.addEventListener('storage', e => { if (e.key === 'hanbal.realm.gfx') syncFieldPixels() })
try { const host = window.parent.document.querySelector('.ap'); if (host) new MutationObserver(syncFieldPixels).observe(host, { attributes: true, attributeFilter: ['class'] }) } catch { /* cross-origin host */ }
let run = newRun(7), live = false, paused = false, shown = '', loadoutKey = '', acc = 0, last = 0, raf = 0
/**
 * 판 기록 (11-19 형: 「열전 플레이데이터도 받고 있지?」 · raid/runlog.ts · runlog-store.ts) — 판마다 씨앗·판 옵션·입력 흐름·고른 카드·결과를
 * 기기 칸(hanbal.raid.games)에 남기고, 로그인했으면 본편처럼 서버로 올린다(net/sync.ts pushRaids · 실패해도 판은 그대로).
 * 적는 때: 출전 · 카드를 고를 때 · 탭이 가려질 때 · 끝날 때. 판 가운데 창을 닫으면 다음에 열 때 「떠남」으로 닫는다
 */
let rec: Recorder | null = null
const numQ = (k: string) => { const v = query.get(k); return v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : undefined }
const fromRealm: RaidGame['from'] = (() => {
  const via = campaignToken ? 'campaign' : trialToken ? 'trial' : vanguardToken ? 'vanguard' : null
  if (via === null) return null
  const game = numQ('game'), turn = numQ('turn')
  return { via, ...game !== undefined ? { game } : {}, ...turn !== undefined ? { turn } : {} }
})()
/** 지금 판을 적는 중인가 (개발 검수 재생이 판을 갈아 끼우면 적지 않는다) */
const logging = (): boolean => rec !== null && rec.run === run && rec.g.end === null
const feed = (i: RunInput): RunInput => logging() ? recInput(rec!, i) : gridInput(i)
function saveLog() { if (logging()) putRaidGame(sealInput(rec!)) }
/** 끝을 적고 올린다 — left: 판 가운데 떠남 */
function closeLog(left = false) {
  if (!logging()) return
  const r = rec!
  finishRecord(r, runGold(r.run), new Date().toISOString(), left); putRaidGame(r.g); void sendRaids()
}
let sending = false
async function sendRaids() {
  if (sending) return
  sending = true
  try { markRaidsSent(await pushRaids(unsentRaids())) } catch (e) { console.warn('[열전 기록] 서버에 못 올렸다 · 다음에 다시:', e) } finally { sending = false }
}
// 열 때: 지난번에 판 가운데 닫힌 판은 「떠남」으로 닫고, 못 올린 판을 올린다
sealLeftovers(new Date().toISOString()); void sendRaids()
/** 회피·비기를 누른 판 시각 (STICK.queue 초 동안 맡아 둔다 · press) */
let dashAt = -9, skillAt = -9, wakeAt = -9
let destination: { x: number; y: number } | null = null
/** 손가락 조이스틱 — 닿은 자리(받침)와 지금 손가락 · 화면 px · 마우스는 예전대로 누른 곳으로 걷기 */
let stick: { id: number; ox: number; oy: number; x: number; y: number } | null = null
let rotationBlocked = false, inspecting = false
const hidePowerHint = installPowerHints($('loadout'), $('power-tooltip'), () => run, held => { inspecting = held; if (held) resetInput() })
const heroVideo = $<HTMLVideoElement>('hero-video'), heroPortrait = $<HTMLImageElement>('hero-portrait')
heroVideo.muted = true; heroVideo.volume = 0
let stillPortrait = matchMedia('(prefers-reduced-motion: reduce)').matches, mediaKey = '', videoFailed = false
$('portrait-toggle').onclick = () => { stillPortrait = !stillPortrait; mediaKey = ''; updatePortrait() }
heroVideo.onerror = () => { videoFailed = true; mediaKey = ''; updatePortrait() }
// 각성 원화는 판 가운데 갑자기 바뀌니 미리 받아 둔다
let awakeVoicePrepared = false
const warmAwake = () => {
  new Image().src = import.meta.env.BASE_URL + 'realm/awaken-hd/' + HERO.bust + '.jpg'; warmHitArt(hitArtUrl(true).url)
  void bigCutin.prewarm(awakening.appearanceAwake)
  void prewarmAwakeUlt(images, kit, path => new Promise<HTMLImageElement>((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = import.meta.env.BASE_URL + 'realm/' + path }))
  if (!awakeVoicePrepared) {
    awakeVoicePrepared = true
    void import('./ui/realm/voice-hero.ts').then(({ heroVoiceDir }) => { const dir = heroVoiceDir(heroId); if (dir) return sound.setAwakeningVoice(import.meta.env.BASE_URL + dir + 'art.ogg'); return false }).catch(() => false)
  }
}
// 피격 그림도 미리 (처음 맞을 때부터 그림이 뜨게 · 실린 뒤에야 금을 끈다 · ui/hit-portrait.ts)
const hitArtUrl = (awake: boolean): { key: string | null; url: string | null } => { const key = hitArtKey(awake ? 'awaken' : 'bust', HERO.bust), p = hitKeyPath(key); return { key, url: p === null ? null : import.meta.env.BASE_URL + 'realm/' + p } }
warmHitArt(hitArtUrl(false).url); if (awakening.permanentAwake) warmAwake()
/** 요청된 출전 모습 토글 하나. 힘은 바뀌지 않으며 진행 중 판의 snapshot은 고치지 않는다. */
function renderAwakeningChoice() {
  let choice = document.getElementById('awakening-choice')
  if (!choice) {
    $('start').insertAdjacentHTML('beforebegin', '<div id="awakening-choice" hidden><button id="awakening-look" role="switch" aria-checked="true">각성 모습</button><small>모습만 바뀝니다. 각성의 힘은 유지됩니다.</small><p id="awakening-error" role="status" hidden></p></div>')
    choice = $('awakening-choice')
    $('awakening-look').onclick = () => {
      if (live) return
      const result = setHeroAwakeningAppearance(localStorage, heroId, !awakening.appearanceAwake)
      $('awakening-error').hidden = result.ok
      $('awakening-error').textContent = result.why ?? ''
      if (!result.ok) return
      refreshWakeKind(); void bigCutin.prewarm(awakening.appearanceAwake); run = newRun(7); renderStageMenu(); updatePortrait(); updateHud()
    }
  }
  choice.hidden = !awakening.permanentAwake || trialEntryClosed()
  $('awakening-look').setAttribute('aria-checked', String(awakening.appearanceAwake))
  $('awakening-look').classList.toggle('on', awakening.appearanceAwake)
}
function refreshWakeKind() {
  const was = awakening.permanentAwake
  awakening = readHeroAwakening(localStorage, heroId)
  if (awakening.permanentAwake && !was) warmAwake()
}
window.addEventListener('storage', e => {
  if (e.key !== null && ![AWAKENING_KEY, 'hanbal.realm.v2', 'hanbal.realm.v2.prev', 'hanbal.raid.roster', 'hanbal.raid.meta', 'hanbal.realm.dex'].includes(e.key)) return
  refreshWakeKind()
  if (!live) { run = newRun(7); renderStageMenu(); updatePortrait(); updateHud() }
})
function updatePortrait() {
  const awake = awakenedLook(run), animate = awake && HERO.video && !stillPortrait && !videoFailed
  const playing = animate && !paused && !run.offers.length && !document.hidden && !inspecting && (!live || run.state === 'playing')
  const key = [awake, animate, playing].join(':'); if (key === mediaKey) return; mediaKey = key
  heroPortrait.src = import.meta.env.BASE_URL + 'realm/' + (awake ? 'awaken-hd' : 'bust-hd') + '/' + HERO.bust + '.jpg'
  heroVideo.poster = heroPortrait.src
  heroVideo.hidden = !animate; heroPortrait.hidden = animate
  $('portrait-toggle').hidden = !awake || videoFailed
  $('portrait-toggle').textContent = stillPortrait ? '영상으로 보기' : '원화로 보기'
  if (animate && !heroVideo.getAttribute('src')) heroVideo.src = import.meta.env.BASE_URL + 'realm/awaken-loop/' + HERO.bust + '.mp4'
  if (playing) void heroVideo.play().catch(() => { if (mediaKey !== key) return; stillPortrait = true; mediaKey = ''; updatePortrait() }); else heroVideo.pause()
}
function layoutTrial() {
  syncFieldPixels()
  const wasBlocked = rotationBlocked
  rotationBlocked = live && run.state === 'playing' && innerWidth <= 700 && innerHeight > innerWidth
  $('rotate-guide').hidden = !rotationBlocked
  document.body.classList.toggle('raid-running', live)
  if (rotationBlocked) { paused = true; resetInput(); shown = ''; showOverlay() }
  else if (wasBlocked) { shown = ''; showOverlay() }
}
window.addEventListener('resize', layoutTrial)
let pendingSeed = vanguardToken ? Number(query.get('seed')) >>> 0 : crypto.getRandomValues(new Uint32Array(1))[0]!
const notifyVanguardStart = () => { if (vanguardToken) window.parent.postMessage({ type: 'hanbal.haebi.vanguard-start', token: vanguardToken }, location.origin) }
const base = import.meta.env.BASE_URL + 'realm/'
Promise.all([...imagePaths, ...heroArtFiles()].map(path => new Promise<void>((resolve, reject) => { const img = new Image(); img.onload = () => { images.set(path, img); resolve() }; img.onerror = reject; img.src = base + path }))).then(async () => { await Promise.all(heroArtFiles().map(p => images.get(p)?.decode().catch(() => {}))); heroWarmKey = ''; prepareHeroRaster(cam.zoom); warmFx(images); baseArtReady = true; $<HTMLButtonElement>('start').disabled = trialEntryClosed(); $('start').textContent = startLabel(); renderStageMenu(); schedule() }).catch(() => { $('start').textContent = '그림을 불러오지 못했어요. 새로고침해 주세요.' })
function resetInput() { keys.clear(); destination = null; stickEnd(); dashAt = skillAt = wakeAt = -9; acc = 0 }
async function begin(sameSeed = false) {
  if (beginning || trialEntryClosed()) return
  sound.unlock() // Keep audio activation inside the actual start gesture, before optional asset loading.
  const selected = stage, revision = ++startRevision
  // 거대 보스 판은 그 보스의 부위 그림을 먼저 데운다 (여울 이무기 · 설원 백두 대호 · 숲 산길 구미호)
  const giantArt = mode === 'stage' ? raidRulesForStage(selected) === '55-IMUGI' ? prewarmImugiArt : raidRulesForStage(selected) === '55-TIGER' ? prewarmTigerArt : raidRulesForStage(selected) === '55-GUMIHO' ? prewarmGumihoArt : null : null
  if (giantArt) {
    beginning = true; $<HTMLButtonElement>('start').disabled = true; $('start').textContent = '그림을 불러오는 중…'
    const ready = await giantArt(selected, images, base).catch(() => false)
    if (revision !== startRevision) return
    beginning = false
    if (stage !== selected || !$('shop').hidden) { $<HTMLButtonElement>('start').disabled = !baseArtReady || trialEntryClosed(); renderStageMenu(); return }
    if (!ready) { $('start').textContent = '그림을 불러오지 못했어요. 새로고침해 주세요.'; return }
    $<HTMLButtonElement>('start').disabled = !baseArtReady || trialEntryClosed()
  }
  refreshWakeKind()
  // 본편에서 연 열전은 한 판만 — 출전하는 그 순간 본편에 알린다 (그 장수의 이번 달 출전 · app.ts markRaid)
  if (campaignToken) { if (campaignBegun) return; campaignBegun = true; window.parent.postMessage({ type: 'hanbal.raid.start', token: campaignToken }, location.origin) }
  if (!sameSeed && !vanguardToken) pendingSeed = crypto.getRandomValues(new Uint32Array(1))[0]!
  closeLog(true)   // 앞 판이 끝을 안 적었으면 (드묾) 「떠남」으로
  const opts = runOpts()
  endingVideo.clear(); hidePowerHint(); notifyVanguardStart(); restoreGiantZoom(); giantCameraOwner = null; giantHud.update(null, 0); run = newRun(pendingSeed, opts); live = true; paused = false; shown = ''; loadoutKey = ''; resetInput(); last = 0
  // 판 기록 — 시작 시각은 화면 쪽 벽시계 · 판 옵션은 createHaebi 에 넘긴 그것 (runlog.ts)
  const now = new Date()
  rec = startRecord(run, { id: `${now.getTime().toString(36)}-${pendingSeed.toString(36)}`, started: now.toISOString(), mode, stage: run.stage, hero: heroId, kit, sprite, seed: pendingSeed, opts: normalizedRaidOpts(run, opts), from: fromRealm })
  saveLog()
  followCam(cam, run.x, run.y, 0, true)   // 새 판은 카메라를 곧바로 장수에게
  skipCutin()
  $('menu').hidden = true; $('play').hidden = false; $('overlay').hidden = true; $<HTMLButtonElement>('pause').disabled = false; schedule()
  $<HTMLButtonElement>('start').blur(); window.scrollTo(0, 0)
  layoutTrial()
}
$('start').onclick = () => begin()
function pause() { if (!live || run.state !== 'playing' || run.offers.length || paused && rotationBlocked) return; paused = !paused; resetInput(); shown = ''; showOverlay(); schedule() }
$('pause').onclick = pause
window.addEventListener('keydown', e => {
  if (raidShortcut(e, root, pause, closeTree)) return
  if (!live) return
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) || e.key === ' ' && e.target === document.body) e.preventDefault()
  if (e.key === 'Escape' && !e.repeat) { if (!treeView.hidden) closeTree(); else pause(); return }
  if (e.key.toLowerCase() === 'z' && !e.repeat) { cycleZoom(); return }   // 확대 단추와 같다
  if (e.key.toLowerCase() === 'x' && !e.repeat) { cycleSpeed(); return }   // 빠르기 단추와 같다
  if (paused || inspecting || run.offers.length || run.state !== 'playing') return
  if (e.target instanceof HTMLButtonElement && (e.key === ' ' || e.key === 'Enter')) return
  keys.add(e.key.toLowerCase()); if (e.key === 'Shift' && !e.repeat) press('dash'); if (e.key === ' ' && !e.repeat) press('skill'); if (e.key.toLowerCase() === 'e' && !e.repeat) press('wake')
})
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()))
window.addEventListener('blur', () => {
  resetInput()
  // Read-only visual QA can run without stealing focus from the user's other apps.
  const backgroundReview = import.meta.env.DEV && query.has('review') && query.has('background')
  if (!backgroundReview && live && run.state === 'playing') { paused = true; shown = ''; showOverlay() }
})
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { heroVideo.pause(); mediaKey = ''; cancelAnimationFrame(raf); raf = 0; resetInput(); if (live && run.state === 'playing') paused = true; shown = ''; showOverlay(); sound.frame(run, live, true); saveLog(); syncEndingVideo() }   // 판이 멈춰도 기록은 그 자리까지 남긴다
  else { last = 0; schedule() }
})
window.addEventListener('pagehide', () => saveLog())
function point(e: PointerEvent) {
  const r = canvas.getBoundingClientRect(), scale = Math.min(r.width / C.width, r.height / C.height)
  // object-fit:contain may letterbox the canvas on short or narrow landscape screens.
  // 확대 중이면 화면 자리를 카메라로 되돌려 판 자리로 (raid/camera.ts toField)
  const at = toField(cam, (e.clientX - r.left - (r.width - C.width * scale) / 2) / scale, (e.clientY - r.top - (r.height - C.height * scale) / 2) / scale)
  destination = { x: Math.max(0, Math.min(C.width, at.x)), y: Math.max(0, Math.min(C.height, at.y)) }
}
const stickEl = $('stick'), knobEl = stickEl.querySelector('i')!
document.body.append(stickEl)   // 화면 기준으로 띄운다 (초상 판에서도 · #stick 은 position:fixed)
function stickShow() {
  if (!stick) { stickEl.hidden = true; return }
  stickEl.hidden = false; stickEl.style.left = `${stick.ox}px`; stickEl.style.top = `${stick.oy}px`
  knobEl.style.transform = `translate(${stick.x - stick.ox}px, ${stick.y - stick.oy}px)`
}
function stickMove(e: PointerEvent) {
  if (!stick) return
  let dx = e.clientX - stick.ox, dy = e.clientY - stick.oy
  const len = Math.hypot(dx, dy)
  // 끝을 넘겨 끌면 받침이 손가락을 따라온다 — 방향을 바꿀 때 손을 떼지 않아도 된다
  if (len > STICK.radius) { const over = (len - STICK.radius) * STICK.follow; stick.ox += dx / len * over; stick.oy += dy / len * over; dx = e.clientX - stick.ox; dy = e.clientY - stick.oy }
  const l2 = Math.hypot(dx, dy), k = l2 > STICK.radius ? STICK.radius / l2 : 1
  stick.x = stick.ox + dx * k; stick.y = stick.oy + dy * k
  stickShow()
}
function stickEnd() { stick = null; const el = document.getElementById('stick'); if (el) el.hidden = true }  // resetInput 이 위에서 먼저 불려도 되게 (stickEl 선언 전)
/** 조이스틱 방향 (-1~1 · 끝까지 밀면 길이 1, 덜 밀면 천천히) */
function stickDir(): { x: number; y: number } | null {
  if (!stick) return null
  const dx = stick.x - stick.ox, dy = stick.y - stick.oy, len = Math.hypot(dx, dy)
  if (len < STICK.dead) return null
  return { x: dx / STICK.radius, y: dy / STICK.radius }
}
/** 조이스틱을 띄울 수 있는 곳 — 전장 캔버스와 왼쪽 초상 판(영상·원화 · 11-17 형: 「왼쪽 캐릭터 부분을 눌러도 조이스틱」) · 단추는 빼고 */
function stickStart(el: HTMLElement, e: PointerEvent) {
  if (!live || paused || inspecting || run.offers.length || run.state !== 'playing') return
  if ((e.target as Element).closest('button')) return
  (document.activeElement as HTMLElement)?.blur(); el.setPointerCapture(e.pointerId)
  if (e.pointerType === 'mouse') { if (el === canvas) point(e); return }
  e.preventDefault()
  if (stick) return
  destination = null; stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY }; stickShow()
}
for (const el of [canvas, $('character')]) {
  el.addEventListener('pointerdown', e => { if (el === canvas && !bigCutin.active) skipCutin(); stickStart(el, e) })
  el.addEventListener('pointermove', e => { if (!el.hasPointerCapture(e.pointerId)) return; if (stick && e.pointerId === stick.id) stickMove(e); else if (e.pointerType === 'mouse' && el === canvas) point(e) })
  el.addEventListener('pointerup', e => { if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId); if (stick && e.pointerId === stick.id) stickEnd() })
  el.addEventListener('pointercancel', e => { destination = null; if (stick && e.pointerId === stick.id) stickEnd() })
}
/**
 * 회피·비기 단추 (11-17 형: 「회피나 기술도 잘 안 눌렸음」) — 누르는 순간(pointerdown) · 다른 손가락이 조이스틱을 잡고 있어도 ·
 * 재사용이 STICK.queue 초 안에 풀리면 그때 나간다(누름을 잠깐 맡아 둠) · 재사용 중에도 disabled 를 걸지 않는다(걸면 눌림 자체가 사라짐).
 */
/** 잠긴 비기 단추를 눌렀다 — 자물쇠가 흔들린다 (글 없이 · 못 하는 까닭) */
function lockedNudge() { const b = $('skill'); b.classList.remove('nudge-lock'); void b.offsetWidth; b.classList.add('nudge-lock') }
$('skill').addEventListener('animationend', e => { if (e.animationName === 'skill-nudge') $('skill').classList.remove('nudge-lock') })
/**
 * 비기 열림 (11-19 형: 「시작은 평타만」) — 판은 평타만으로 시작하고 첫 레벨업(ULT.unlockLevel)에서 열린다.
 * 꺼진(자물쇠) 단추가 그 자리에서 금빛으로 크게 터지며 켜진다 · 설명 글 없음 · 새 판을 받을 때는 터뜨리지 않는다.
 */
let ultSeen: HaebiRun | null = null, ultWas = false, ultFlashUntil = 0
function watchUltOpen() {
  const open = ultOpen(run)
  if (ultSeen !== run) { ultSeen = run; ultWas = open; ultFlashUntil = 0 }
  if (open && !ultWas && live) { ultFlashUntil = performance.now() + ULT.unlockFlash * 1000; $('skill').style.setProperty('--unlock-s', ULT.unlockFlash + 's') }
  ultWas = open
  setFlag('skill', 'locked', !open); setFlag('skill', 'unlock', performance.now() < ultFlashUntil)
}
function press(kind: 'dash' | 'skill' | 'wake') {
  if (!live || paused || inspecting || run.offers.length || run.state !== 'playing') return
  // 시전 중에 누른 비기·각성은 시전이 끝난 뒤까지 맡아 둔다 (각성 컷인 뒤에 비기 컷인 · 겹치지 않게)
  const at = run.t + (run.cast ? run.cast.t : 0)
  if (kind === 'skill' && !ultOpen(run)) { lockedNudge(); return }   // 아직 잠긴 비기 · 누르면 자물쇠가 흔들린다 (못 하는 까닭 · 첫 레벨업에서 열림)
  if (kind === 'dash') dashAt = run.t; else if (kind === 'skill') skillAt = at; else wakeAt = at
}
for (const kind of ['dash', 'skill', 'wake'] as const) {
  const b = $(kind)
  b.addEventListener('pointerdown', e => {
    e.preventDefault(); e.stopPropagation(); press(kind)
    b.classList.add('pressed'); window.setTimeout(() => b.classList.remove('pressed'), 140)
  })
  b.addEventListener('click', e => { if (e.detail === 0) press(kind); b.blur() })   // 키보드로 단추를 눌렀을 때만 (손가락·마우스는 pointerdown 에서 이미)
}
/** 조합 길 — 글 대신 그림 셈: [능력 그림 ×단계] + [능력 그림 ×단계] = [조합 그림] (형 11-16: 「텍스트로 하지 말고 아이콘3 + 아이콘3 = 아이콘」) · 이미 채운 단계는 밝게 */
const recipe = (c: ReturnType<typeof kitCombos>[number], me?: Power) => {
  const parts = Object.entries(c.needs).map(([key, n]) => { const done = run.ranks[key as Power] >= n; return `<span class="need${done ? ' ok' : ''}${key === me ? ' me' : ''}">${powerIcon(key as Power, kit)}<b>${n}</b></span>` }).join('<i class="op">+</i>')
  const r = comboRank(run, c.id)
  return `<span class="recipe" aria-label="${c.name}: ${Object.entries(c.needs).map(([key, n]) => `${nodeText(kit, key as Power).name} ${n}`).join(' + ')}">${parts}<i class="op">=</i><span class="combo${r ? ' got' : ''}">${comboIcon(c.id)}<small>${c.name}${r ? ' ' + rankMark(r) : ''}</small></span></span>`
}
/** 자물쇠 그림 (열림 · 잠김) — 카드의 「열리는 칸」과 나무의 잠긴 층이 같은 그림 */
const lockSvg = (open: boolean) => `<svg class="lock-ic" viewBox="0 0 16 16" aria-hidden="true"><path d="${open ? 'M5 7V4.6a3 3 0 0 1 5.8-1.1' : 'M5 7V5a3 3 0 0 1 6 0v2'}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><rect x="2.6" y="7" width="10.8" height="8" rx="1.6" fill="currentColor"/></svg>`
/**
 * 이 갈래에서 다음에 열리는 칸 (11-19 형: 「다음 층 12점 · 지금 10점」이 뭔 말인지 모르겠다 · 「갈래 끝까지 열림」은 이 기술이 최대로 읽힌다).
 * 이 카드 하나로 문턱에 닿으면 열림 자물쇠 + 열리는 칸 그림 + 이름을 금빛으로 크게 · 아직 멀면 흐린 그림 + 「N번 더」(이 갈래에서 고를 횟수) ·
 * 갈래가 다 열렸으면 아무것도 없다. soon 만 = 조합 셈이 이미 있는 카드는 가까운 것만 (폰 가로에서 넘친다)
 */
function unlockHint(k: Power, _soonOnly: boolean) {
  const next = { ...run, ranks: { ...run.ranks, [k]: run.ranks[k] + 1 } }
  const nodes = kitPowers(kit).filter(p => !nodeOpen(run, p) && nodeOpen(next, p))
  if (!nodes.length) return ''
  const names = nodes.map(p => nodeText(kit, p).name).join(' · ')
  return `<i class="unlock now" aria-label="고르면 ${names} 열림">${lockSvg(true)}${nodes.map(p => `<i class="unl-node">${powerIcon(p, kit)}<i>${nodeText(kit, p).name}</i></i>`).join('')}</i>`
}
function routeHint(k: Power) {
  // 끝 단계까지 올린 조합은 빼고 (카드가 길어져 폰 가로에서 넘쳤다)
  const recipes = kitCombos(kit).filter(c => k in c.needs && comboRank(run, c.id) < TREE.max).map(c => recipe(c, k)).join('')
  return recipes + unlockHint(k, recipes !== '')
}
/** 기술 단계 칸 — 지금 단계는 채움 · 이번에 오를 한 칸은 금빛 반짝 · 남은 칸은 빈 칸 · 숫자는 작게 (11-19 형: 「+1」로는 이 기술이 몇 단계인지 안 보였다) */
function levelPips(rank: number, max: number) {
  const cells = Array.from({ length: max }, (_, i) => `<i class="${i < rank ? 'on' : i === rank ? 'up' : ''}"></i>`).join('')
  return `<i class="lv-pips" aria-label="${rank + 1}/${max}단계">${cells}<i class="lv-num">${rank ? `${rank}→` : ''}<i class="to">${rank + 1}</i>/${max}</i></i>`
}
/** 레벨업 카드 — 세 갈래 공유 껍데기 · 갈래 끝 표식 · 이름 밑 단계 칸 / 조합은 기존 금테 */
function card(k: Pick) {
  if (!isCombo(k)) {
    const p = POWERS[k], t = nodeText(kit, k), at = nodeAt(kit, k)!, cap = at.tier === TREE.tiers.length - 1, color = BRANCH_COLOR[at.branch], rank = run.ranks[k]
    return `<button data-up="${k}" class="branch-card branch-${at.branch}${cap ? ' cap-card' : ''}" aria-label="${t.name}, ${branchName(kit, at.branch)} 갈래, ${rank + 1}/${p.max}단계. ${t.desc}" style="--accent:${cap ? color : p.color};--c:${color}">${cap ? '<i class="ribbon cap">갈래 끝</i>' : ''}<span class="rune">${powerIcon(k, kit)}</span>${rank ? '' : '<small class="gain new">획득</small>'}<b>${t.name}</b>${levelPips(rank, p.max)}<span>${t.desc}</span><em>${routeHint(k)}</em></button>`
  }
  const c = comboOf(k), r = comboRank(run, k), next = r + 1
  const pips = Array.from({ length: TREE.max }, (_, i) => `<i class="${i < r ? 'on' : i === r ? 'new' : ''}"></i>`).join('')
  const ult = next >= TREE.max ? `<span class="ultup"><img src="${import.meta.env.BASE_URL}realm/raid/power-skill.png" alt="">${K.skill} 강화</span>` : ''
  return `<button data-up="${k}" class="combo-card" style="--accent:#f2c45a"><i class="ribbon">조합</i><span class="rune">${comboIcon(k)}</span><small class="gain${r ? '' : ' new'}">${r ? '+1' : '획득'}</small><b>${c.name}</b><span>${c.desc}</span><em><span class="pips" aria-label="${next}단계">${pips}</span>${ult || recipe(c)}</em></button>`
}
/** 레벨업 창 좌상단의 지금 가진 칸 — 갈래 차례(주 무기 · 보조 · 버팀) · 그림 + 단계 배지 · 갈래 빛 테 · 끝 단계는 금빛 배지 · 연 조합은 금테 */
function haveRow() {
  const tree = branchNodes(kit)
  const slots = BRANCHES.flatMap(b => tree[b].flat().filter(p => run.ranks[p] > 0).map(p => `<i class="have${run.ranks[p] >= POWERS[p].max ? ' max' : ''}" style="--c:${BRANCH_COLOR[b]}" title="${nodeText(kit, p).name}">${powerIcon(p, kit)}<b>${run.ranks[p]}</b></i>`))
  const combos = kitCombos(kit).filter(c => run.combos.includes(c.id)).map(c => `<i class="have combo" title="${c.name}">${comboIcon(c.id)}<b>${rankMark(comboRank(run, c.id))}</b></i>`)
  return `<div class="lv-have" aria-label="지금 가진 능력">${[...slots, ...combos].join('')}</div>`
}
/** 기술 나무 보기 (레벨업 창 · 멈춤 창의 「나무」) — 판 위에 한 겹 더 · 칸을 누르면 아래 한 줄에 설명 · 바깥이나 닫기를 누르면 닫힘 */
const treeView = document.createElement('div'); treeView.id = 'tree-view'; treeView.hidden = true; treeView.setAttribute('role', 'dialog'); treeView.setAttribute('aria-label', '스킬 트리')
root.append(treeView)
const treeResize = new ResizeObserver(() => { if (!treeView.hidden) drawTreeLinks(treeView, run) })
function openTree() {
  treeResize.disconnect()
  treeView.innerHTML = `<div class="panel tree-panel"><div class="tree-head"><button class="tree-close primary">돌아가기</button><h2>${weapon} 스킬 트리</h2><small>레벨 ${run.level} · 앞으로 레벨업 ${Math.max(0, C.maxLevel - run.level)}번</small></div>${skillTreeHtml(run)}<p class="tree-info" aria-live="polite">칸을 누르거나 가리키면 설명이 나옵니다</p></div>`
  treeView.hidden = false
  drawTreeLinks(treeView, run)
  treeResize.observe(treeView.querySelector('.tree-board')!)
  keyHints(root)
  treeView.querySelector<HTMLButtonElement>('.tree-close')!.focus()
}
function closeTree() { if (!treeView.hidden) { treeView.hidden = true; treeResize.disconnect() } }   // 판마다 불린다 — 같은 값도 쓰면 속성이 바뀐 셈이 된다 (11-18)
function selectTreeNode(node: HTMLElement) {
  treeView.querySelectorAll('.picked').forEach(x => x.classList.remove('picked')); node.classList.add('picked')
  highlightTreePath(treeView, run, node.dataset.treeId!)
  treeView.querySelector('.tree-info')!.innerHTML = treeInfo(run, node)
}
treeView.onclick = e => {
  const t = e.target as Element, node = t.closest<HTMLElement>('[data-tree-id]')
  if (node) { selectTreeNode(node); flashTreeParents(treeView, node.dataset.treeId!); return }
  if (t === treeView || t.closest('.tree-close')) closeTree()
}
treeView.addEventListener('pointerover', e => {
  if (e.pointerType !== 'mouse') return
  const node = (e.target as Element).closest<HTMLElement>('[data-tree-id]')
  if (node && !node.contains(e.relatedTarget as Node | null)) selectTreeNode(node)
})
treeView.addEventListener('focusin', e => { const node = (e.target as Element).closest<HTMLElement>('[data-tree-id]'); if (node) selectTreeNode(node) })
treeView.addEventListener('keydown', e => {
  const node = (e.target as Element).closest<HTMLElement>('.tree-node')
  if (!node || e.key !== 'Enter' && e.key !== ' ') return
  e.preventDefault(); e.stopPropagation()
  if (!e.repeat) node.click()
})
const treeButton = '<button id="tree-open" class="tree-btn" aria-label="스킬 트리 보기"><img src="' + import.meta.env.BASE_URL + 'realm/raid/power-skill.png" alt="">스킬 트리</button>'
let settledRun: HaebiRun | null = null
function settleRun() {
  if (settledRun === run) return
  settledRun = run; closeLog()
  // 결과 저장 시점은 그대로. 연출 중 탭을 닫아도 보상과 판 기록을 잃지 않는다.
  if (mode === 'stage' && rewarded !== run) { rewarded = run; const gold = runGold(run); reward = { gold, ...record(meta, run.stage, gold, run.state === 'won', run.t, heroId) }; saveMeta(meta); if (run.state === 'won' && run.stage === DEMON_STAGE) { stampDemons(); refreshWakeKind() } }
}
const chestGoldSeen = new WeakMap<HaebiRun, Set<number>>()
function chestBurst(id: number) {
  let seen = chestGoldSeen.get(run)
  if (!seen) chestGoldSeen.set(run, seen = new Set())
  if (seen.has(id)) return ''
  seen.add(id)
  return '<span class="chest-coinburst" aria-hidden="true">' + [[-56,-12],[-35,-26],[-12,-32],[18,-28],[42,-16],[62,0]].map(([x,y]) => `<img src="${import.meta.env.BASE_URL}realm/raid/coins.png" alt="" style="--coin-x:${x}px;--coin-y:${y}px">`).join('') + '</span>'
}
function showOverlay() {
  if (run.state !== 'playing') { rotationBlocked = false; $('rotate-guide').hidden = true }
  if (live) {
    ending.observe(run)
    if (ending.kind) settleRun()
    if (ending.active) { shown = ''; $('overlay').hidden = true; closeTree(); return }
  }
  const state = !live ? '' : run.state !== 'playing' ? run.state : run.offers.length ? (run.choiceOrigin === 'chest' ? 'chest:' + run.chestChoice?.id : 'upgrade') + ':' + run.offerNonce + ':' + run.offers.join(',') : paused ? 'pause' : ''
  // 세로에서도 성장·나무·철수는 쓸 수 있다. 전투 재개는 회전 뒤에만 허용한다.
  $('rotate-guide').hidden = !rotationBlocked || state === 'pause' || state.startsWith('upgrade:') || state.startsWith('chest:')
  if (!state) { shown = ''; if (!$('overlay').hidden) $('overlay').hidden = true; closeTree(); return }
  if (state === shown) return
  hidePowerHint(); closeTree()
  shown = state; const overlay = $('overlay'); overlay.hidden = !state; if (!state) return
  resetInput()
  if (state.startsWith('upgrade:') || state.startsWith('chest:')) {
    const chest = run.choiceOrigin === 'chest' ? run.chests?.find(c => c.id === run.chestChoice?.id) : undefined, nonce = run.offerNonce
    overlay.innerHTML = `<div class="panel upgrade${chest ? ' chest-reward' + (chest.large ? ' large' : '') : ''}"${chest ? ` data-chest-id="${chest.id}" data-choice-left="${run.chestChoice!.left}"` : ''}><div class="lv-head">${haveRow()}<h2 class="lvup">${chest ? `<img class="chest-open" src="${import.meta.env.BASE_URL}realm/raid/chest-open.png" alt="">보물 상자<small>남은 선택 ${run.chestChoice!.left}회</small>${chestBurst(chest.id)}` : '레벨업!'}</h2>${treeButton}</div><div class="choices">${run.offers.map(card).join('')}</div>${chest ? '' : `<button id="reroll" ${run.rerolls ? '' : 'disabled'}>리롤 · ${run.rerolls}회 남음</button>`}</div>`
    overlay.querySelectorAll<HTMLButtonElement>('[data-up]').forEach(b => b.onclick = () => { const pick = b.dataset.up as Pick, log = logging(); if (choose(run, pick, nonce)) { if (log) { recPick(rec!, pick); saveLog() } shown = ''; showOverlay(); updateHud() } })
    const openedArt = overlay.querySelector<HTMLImageElement>('.chest-open')
    if (openedArt) openedArt.addEventListener('error', () => { openedArt.src = import.meta.env.BASE_URL + 'realm/raid/chest.png' }, { once: true })
    if (!chest) {
      if (run.level === 1) { $<HTMLButtonElement>('reroll').disabled = true; $('reroll').textContent = '첫 갈래를 골라 주세요' }
      $('reroll').onclick = () => { const log = logging(); if (reroll(run)) { if (log) recReroll(rec!); shown = ''; showOverlay() } }
    }
    $('tree-open').onclick = openTree
  } else if (state === 'pause') {
    const reason = '폰을 가로로 돌리면 전투를 계속할 수 있습니다.'
    overlay.innerHTML = `<div class="panel pause-panel" role="dialog" aria-labelledby="pause-title"><div class="pause-heading"><small>장수 열전</small><h2 id="pause-title">일시정지</h2><p id="pause-note" role="status">${rotationBlocked ? reason : '성장과 전투는 그대로 기다립니다.'}</p></div><div class="pause-actions">${treeButton}<button id="quit" title="이번 출전을 마칩니다">출전 화면으로</button></div><label class="pause-short-cutin"><input id="short-cutin" type="checkbox" ${shortCutin ? 'checked' : ''}>연출 짧게</label><div class="pause-confirm"><button id="resume" class="primary" aria-disabled="${rotationBlocked}" title="${rotationBlocked ? reason : '멈춘 곳에서 계속 싸웁니다'}">계속 싸우기</button></div></div>`
    // 터치는 브라우저의 :active 지연을 기다리지 않고 누른 순간 반응한다.
    overlay.querySelectorAll<HTMLButtonElement>('.pause-panel button').forEach(b => {
      const release = () => b.classList.remove('pressed')
      b.addEventListener('pointerdown', () => b.classList.add('pressed'))
      for (const event of ['pointerup', 'pointercancel', 'pointerleave', 'blur']) b.addEventListener(event, release)
    })
    $('tree-open').onclick = openTree
    $<HTMLInputElement>('short-cutin').onchange = () => { shortCutin = $<HTMLInputElement>('short-cutin').checked; try { localStorage.setItem(SHORT_CUTIN_KEY, shortCutin ? '1' : '0') } catch { /* current window only */ } }
    $('resume').onclick = () => { if (rotationBlocked) { $('pause-note').textContent = reason; return }; paused = false; shown = ''; last = 0; showOverlay() }; $('quit').onclick = menu
    if (vanguardToken) { $('quit').textContent = '지금 확보한 돌파로 귀환'; $('quit').onclick = withdraw }
    else if (mode === 'stage') { $('quit').textContent = '물러나기 · 버틴 만큼 금 받기'; $('quit').onclick = withdraw }
    else if (trialToken) { $('quit').textContent = '물러나기'; $('quit').onclick = withdraw } // 본편에서 연 시련은 다시 고르는 화면 없이 결과로 (다시 도전은 본편 장수 판에서)
  } else {
    // 이겼다 — 결과 판이 뜨는 그 박자에 다다닥 (11-19 형: 「듀오링고처럼 햅틱 막 지랄 나 주면」) · 판마다 한 번 (탭을 다녀와 다시 그려도 또 떨지 않는다)
    // 독립 열전: 판이 끝나면 한 번만 금을 주고 기록한다 (지면 버틴 만큼 · 깨면 휘장 + 깸 금)
    overlay.innerHTML = `<div class="panel result ${run.state}"><h2>${run.state === 'won' ? mode === 'stage' ? `${stageName(run.stage)} 토벌 완료` : '열전 완수' : run.hp <= 0 ? '도전 실패' : run.t < runDuration(run) ? '철수' : '시간 초과 · 두목 생존'}</h2><p>${Math.floor(run.t / 60)}분 ${Math.floor(run.t % 60)}초 · ${run.kills.toLocaleString()}명 격파 · Lv.${run.level}${mode === 'stage' ? ` · 정예 ${run.elites} <img class="result-chests" src="${import.meta.env.BASE_URL}realm/raid/chest.png" alt="획득 상자"> ${run.chestsClaimed ?? 0}` : ''}</p>${giantResultLine()}<div class="result-combos">${kitCombos(kit).filter(c => run.combos.includes(c.id)).map(c => `<b>${comboIcon(c.id)}${c.name} ${rankMark(comboRank(run, c.id))}</b>`).join('')}</div>${mode === 'stage' ? `<p class="reward">${COIN}<b>+${reward.gold.toLocaleString()}</b> · 보유 ${COIN}${meta.gold.toLocaleString()}${reward.first ? ` · <strong><img class="won-emblem" src="${import.meta.env.BASE_URL}realm/raid/emblem-${run.stage}.png" alt="">${stageName(run.stage)} 휘장 획득</strong>` : ''}${reward.heroFirst && run.stage === SEAL_STAGE && TRUE_WAKE.has(heroId) ? ` · <strong class="tw-open">본편에서 ${josa(HERO.name, '이', '가')} 진각성할 수 있습니다</strong>` : ''}</p>` : ''}${mode === 'stage' ? '' : '<p>본편 병력 손실 없음</p>'}${fromCampaign ? `<div class="result-acts">${window.parent !== window ? '<button id="return" class="primary">본편으로</button>' : ''}</div>` : `<div class="result-acts"><button id="new-run" class="primary">다시 출전</button><div>${mode === 'stage' ? '<button id="to-shop">상점</button>' : ''}<button id="quit">스테이지 고르기</button>${window.parent !== window ? '<button id="return">본편으로</button>' : ''}</div></div>`}</div>`
    if (vanguardToken) {
      overlay.querySelector('h2')!.textContent = run.breaches === 3 ? '길은 열었다. 본대여, 진격하라!' : `${run.breaches}/3 돌파 확보 · 본대로 귀환`
      overlay.querySelector('.result-combos')!.textContent = isBreakthrough(run.breaches) ? breakthroughText(run.breaches) : ''
    }
    // 본편에서 연 판은 결과 화면에 「다시 출전」·「스테이지 고르기」가 없다 (형 11-19 · 한 달에 한 번) — 「본편으로」만
    if ($('new-run')) $('new-run').onclick = () => begin()
    if ($('quit')) $('quit').onclick = menu
    if ($('to-shop')) $('to-shop').onclick = () => { menu(); renderShop(); $('shop').hidden = false }
    if ($('return')) {
      const back = $<HTMLButtonElement>('return')
      if (vanguardToken) {
        back.textContent = '돌파 성과를 반영하고 합전 계속'
        back.onclick = () => { back.disabled = true; window.parent.postMessage({ type: 'hanbal.haebi.vanguard-result', token: vanguardToken, breaches: run.breaches, elapsed: run.t }, location.origin) }
      } else if (trialToken && run.state === 'won') {
        back.textContent = '각성하고 본편으로 귀환'
        back.onclick = () => {
          back.disabled = true; back.textContent = '각성 보상 저장 중…'
          window.parent.postMessage({ type: 'hanbal.haebi.trial-result', token: trialToken, result: run.state, elapsed: run.t }, location.origin)
          window.setTimeout(() => { if (back.isConnected) { back.disabled = false; back.textContent = '귀환 다시 시도' } }, 4000)
        }
      } else back.onclick = () => location.replace('about:blank')
    }
  }
  keyHints(root)
}
let rewarded: HaebiRun | null = null, reward = { gold: 0, first: false, heroFirst: false }
function withdraw() { if (logging()) recQuit(rec!); withdrawRun(run); paused = false; shown = ''; showOverlay() }
function menu() { endingVideo.clear(); cancelBegin(); giantHud.update(null, 0); restoreGiantZoom(); giantCameraOwner = null; closeLog(true); renderStageMenu(); hidePowerHint(); live = false; paused = false; shown = ''; resetInput(); run = newRun(7); loadoutKey = ''; $('menu').hidden = false; $('play').hidden = true; $('overlay').hidden = true; $<HTMLButtonElement>('pause').disabled = true; layoutTrial(); updateHud() }
/**
 * 본편의 뒤로 가기 (안드로이드 뒤로 단추 · 브라우저 뒤로 · app.ts backOne 이 'hanbal.raid.back' 으로 알린다) — 곧장 본편으로 빠지지 않는다:
 * 묻는 상자·나무·상점이 떠 있으면 그것만 닫고 · 판 중이면 멈춤 창 · 출전 화면이면 「본편으로」와 같다 · 레벨업 카드·결과 화면은 그대로 (그 창의 단추로)
 */
function backPressed() {
  const ask = document.getElementById('refund-ask')
  if (ask && !ask.hidden) { ask.hidden = true; return }
  if (!treeView.hidden) { closeTree(); return }
  if (!$('shop').hidden) { $('shop').hidden = true; return }
  if (live) { if (run.state === 'playing' && !run.offers.length && !paused) pause(); return }
  if (toRealm) leaveToRealm()
}
window.addEventListener('message', e => { if (e.origin === location.origin && e.source === window.parent && e.data?.type === 'hanbal.raid.back') backPressed() })
window.addEventListener('message', e => {
  if (e.origin !== location.origin || e.source !== window.parent || !trialToken || e.data?.token !== trialToken || e.data?.type !== 'hanbal.haebi.trial-error') return
  const back = $<HTMLButtonElement>('return'); if (back) { back.disabled = false; back.textContent = '귀환 다시 시도'; back.insertAdjacentHTML('afterend', '<p class="save-error"></p>'); $('overlay').querySelector('.save-error')!.textContent = String(e.data.reason) }
})
/** 값이 바뀔 때만 DOM 에 쓴다 — 같은 글자·폭을 매 프레임 다시 써도 폰은 화면 배치·그리기를 다시 해서 프레임이 20 으로 떨어졌다 (11-16 형 · 갤럭시 플립7) */
const hudLast = new Map<string, string>()
function setText(id: string, v: string) { if (hudLast.get(id) === v) return; hudLast.set(id, v); $(id).textContent = v }
function setWidth(id: string, pct: number, step = .1) { const v = (Math.round(pct / step) * step).toFixed(1); if (hudLast.get(id + '.w') === v) return; hudLast.set(id + '.w', v); $(id).style.width = v + '%' }
function setFlag(id: string, cls: string, on: boolean) { const k = id + '.' + cls, v = on ? '1' : ''; if (hudLast.get(k) === v) return; hudLast.set(k, v); $(id).classList.toggle(cls, on) }
/** 잃은 체력 토막 — 롤 체력바 (본편 battlefield 막대와 같은 결 · 형 11-16) · 화면 쪽 기억만 (판 상태는 읽기만) */
const chunk = { lag: 100, last: 100, hitAt: -9, flashAt: -9, at: 0 }
const CHUNK_FX: Keyframe[] = [
  { backgroundColor: '#ffffff', boxShadow: '0 0 14px 4px #ffffff', transform: 'scaleY(2)' },
  { backgroundColor: '#ffe14a', boxShadow: '0 0 12px 3px #ffc800', transform: 'scaleY(1.55)', offset: .3 },
  { backgroundColor: '#ff2a14', boxShadow: '0 0 10px 3px #ff2a14', transform: 'scaleY(1.15)', offset: .65 },
  { backgroundColor: '#c8160c', boxShadow: '0 0 5px 1px #ff2a1499', transform: 'none' },
]
function updateChunk(pct: number) {
  const now = performance.now() / 1000, dt = Math.min(.1, now - chunk.at); chunk.at = now
  if (!live || run.t < .05) { chunk.lag = chunk.last = pct; chunk.hitAt = -9 }
  if (pct < chunk.last - .05) {   // 맞음: 막대는 이미 떨어졌고, 떨어지기 전 자리까지 토막이 남아 번쩍
    chunk.lag = Math.max(chunk.lag, chunk.last); chunk.hitAt = now
    if (now - chunk.flashAt > C.hpChunkFlash * .5) { chunk.flashAt = now; $('hp-chunk').animate(CHUNK_FX, { duration: C.hpChunkFlash * 1000, easing: 'linear' }) }
  }
  chunk.last = pct
  if (chunk.lag <= pct) chunk.lag = pct
  else if (now - chunk.hitAt > C.hpChunkHold) { chunk.lag = pct + (chunk.lag - pct) * Math.exp(-C.hpChunkRate * dt); if (chunk.lag - pct < .15) chunk.lag = pct }
  const left = pct.toFixed(1), w = (chunk.lag - pct).toFixed(1)
  if (hudLast.get('chunk') !== left + '/' + w) { hudLast.set('chunk', left + '/' + w); const el = $('hp-chunk'); el.style.left = left + '%'; el.style.width = w + '%' }
}
/**
 * 맞은 초상 (11-17 형: 「맞았을 때 모습」) — 판이 맞을 때마다 hurt 를 새로 세운다(판 상태는 읽기만). 그때 왼쪽 초상 판이 흔들리고 붉게 번쩍 · 빛 빠짐 · (피격 그림이 없거나 덜 실렸을 때만) 금.
 * 잃은 체력이 클수록 세게 (ui/hit-portrait.ts · P.render.hitPortrait*). 피격 그림(realm/hit)이 있으면 그것도 잠깐.
 * 초상 판은 그림을 잘라 보여 주므로(가로 화면은 좁고 긴 판 · 폰 세로는 넓은 판) 피격 그림은 얼굴이 보이게 민다 — 판 크기는 hitPortrait 가 맞는 순간 한 번 잰다
 * (영상이 떠 있든 원화든 같은 판 #portrait-media). 얼굴 자료가 없는 그림은 예전 자리 그대로 (combat.css #portrait-media img).
 */
const hitSeen = { run: null as HaebiRun | null, hurt: 0, hp: 0 }
let hudCountAt = -9
function watchHit() {
  if (!live || hitSeen.run !== run) { hitSeen.run = run; hitSeen.hurt = run.hurt; hitSeen.hp = run.hp; return }
  if (run.hurt > hitSeen.hurt + 1e-6) {
    const art = hitArtUrl(awakenedLook(run))
    hitPortrait($('portrait-media'), hitStrength(hitSeen.hp - run.hp, run.maxHp), { art: art.url, focus: art.key, pos: heroVideo.hidden ? '48% 12%' : '50% 20%' })
    if (run.hp > 0) haptics().hurt((hitSeen.hp - run.hp) / run.maxHp)   // 치명타격 진동은 막 내림의 정지 순간 한 번
  }
  hitSeen.hurt = run.hurt; hitSeen.hp = run.hp
}
function updateHud() {
  const hpPct = Math.max(0, run.hp / run.maxHp * 100)
  setText('health', `${Math.ceil(run.hp)} / ${run.maxHp}`); setWidth('hp-fill', hpPct); updateChunk(hpPct); watchHit()
  // 영웅의 투지 보호막: 체력 끝에 이어 붙는 하늘빛 덧막대 (막대가 넘치면 끝에 붙여 체력 위로 겹친다)
  const wardPct = Math.min(100, run.ward / run.maxHp * 100), wardOn = live && wardPct > 0
  if ($('hp-ward').hidden === wardOn) $('hp-ward').hidden = !wardOn
  if (wardOn) { setWidth('hp-ward', wardPct); const left = Math.min(hpPct, 100 - wardPct).toFixed(1); if (hudLast.get('ward.l') !== left) { hudLast.set('ward.l', left); $('hp-ward').style.left = left + '%' } }
  setText('phase', phase(run));
  if (mode === 'vanguard') setText('hint', `전위대장 ${run.breaches}/3 돌파 · 일시정지에서 성과를 갖고 귀환 가능`);  const remaining = Math.max(0, Math.ceil(runDuration(run) - run.t)); setText('clock', `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`)
  // 격파 수·연속 격파 글자는 C.hudCountEvery 초에 한 번만 (늑대 떼에 프레임마다 바뀌어 그림자 진 큰 글자를 매번 다시 칠했다 · 11-18 플립7)
  const countNow = performance.now() / 1000, countDue = countNow - hudCountAt >= C.hudCountEvery || run.comboKills < 15
  if (countDue) { hudCountAt = countNow; setText('kills', run.kills.toLocaleString()) }
  setText('level', `Lv.${run.level}`)
  setWidth('xp-fill', run.level >= C.maxLevel ? 100 : Math.min(100, run.xp / xpNeeded(run) * 100), C.hudBarStep)
  // 각성 막대 — 차는 동안 · 각성(투지) 동안은 남은 시간이 줄어든다 (바뀔 때만 씀)
  setWidth('wake-fill', gaugeRatio(run) * 100, C.hudBarStep); setFlag('wake-bar', 'on', run.form !== 'normal')
  setText('rank-title', awakenedLook(run) ? `각성 · ${HERO.name}` : HERO.name)
  setText('reaction', !live ? mode === 'vanguard' ? '내가 길을 열겠다. 뒤따라와!' : `${weapon} 하나로 시작하는 열전` : run.hurt > 0 ? '버텨낼 수 있어!' : run.attack > 0 ? '길을 열어라!' : awakenedLook(run) ? '이제, 몰아칠 차례다.' : run.moving ? '내 뒤를 따라와.' : '빈틈을 기다리는 중')
  setFlag('character', 'awakened', awakenedLook(run)); setFlag('character', 'hurt', run.hurt > 0)
  setFlag('layout', 'in-run', live)   // 싸우는 동안 초상 옆 글(고을·이름·한마디)은 걷는다 (형 11-16: 「백제의 장수 · 길을 열어라 같은 텍스트 다 없애」)
  setText('announcement', run.messageTime > 0 ? run.message : ''); setFlag('announcement', 'visible', !ending.active && run.messageTime > 0)
  if (countDue) setText('streak', run.comboKills >= 15 ? `${run.comboKills} 연속 격파` : '')
  // 투지 단추: 막대가 다 차면 뜬다. 각성 모습·힘은 영구 자격과 별개다.
  const ready = live && wakeReady(run); if ($('wake').hidden === ready) $('wake').hidden = !ready
  setFlag('combat-hud', 'awake', awakenedLook(run))
  for (const [id, cd, title] of [['dash', run.dashCd, '회피 Shift'], ['skill', run.skillCd, `${usesPermanentAwakening(run) ? K.skill : ultName(kit, run.form === 'awake')} Space`]] as const) {
    setText(id, cd > 0 ? `${title} · ${cd.toFixed(1)}초` : title); const off = cd > 0 || paused || !!run.offers.length || run.state !== 'playing'; setFlag(id, 'cool', off)   // disabled 대신 빛만 (재사용 중에도 누름을 받아 맡아 둔다)
  }
  watchUltOpen()
  // 무료 상자 선택도 능력을 바꾼다. 원시 snapshot 키로 다음 프레임에 갱신한다.
  const key = `${run.level}:${run.offerNonce ?? 0}:${run.offers.length}`
  if (key !== loadoutKey) {
    loadoutKey = key
    hidePowerHint()
    $('loadout').innerHTML = (Object.keys(POWERS) as Power[]).filter(k => run.ranks[k]).map(k => `<button class="power-slot" data-power="${k}" aria-label="${nodeText(kit, k).name} ${run.ranks[k]}단계 / 최대 ${POWERS[k].max}단계" style="--accent:${POWERS[k].color}">${powerIcon(k, kit)}<b>${run.ranks[k]}</b></button>`).join('')
    $('combo-badges').innerHTML = kitCombos(kit).filter(c => run.combos.includes(c.id)).map(c => `<span>${comboIcon(c.id)}<b>${c.name} ${rankMark(comboRank(run, c.id))}</b></span>`).join('')
  }
}
/**
 * 폰에서 프레임 재기 (11-18 · 헤드리스로는 플립7의 늑대 떼 렉이 재현되지 않았다) — 주소에 ?perf 를 붙이면 왼쪽 위에 초당 프레임 · 적 · 늑대 · 효과 · 숫자 수를
 * 0.5초마다 적는다. 배포본에서도 된다: …/raid.html?kit=bow&perf
 */
const perfEl = query.has('perf') ? Object.assign(document.body.appendChild(document.createElement('output')), { id: 'perf-meter' }) : null
if (perfEl) perfEl.style.cssText = 'position:fixed;left:4px;top:4px;z-index:99;font:11px monospace;color:#fff;background:#000a;padding:2px 5px;pointer-events:none'
const perf = { at: 0, frames: 0 }
function perfTick(now: number) {
  if (!perfEl) return
  perf.frames++; if (now - perf.at < 500) return
  const fps = perf.frames * 1000 / (now - perf.at); perf.at = now; perf.frames = 0
  perfEl.textContent = `${fps.toFixed(0)}fps 적${run.enemies.length} 늑대${run.enemies.filter(e => e.kind === 'dog').length} 투사${run.shots.length} 효과${run.fx.length} 숫자${run.fx.filter(f => f.n !== undefined).length}`
}
const feel = new RaidFeel()
const ending = new RaidEnding()
let endHit: HTMLImageElement | null = null, skipClickUntil = 0
root.addEventListener('pointerdown', e => {
  if (!live || !ending.active) return
  e.preventDefault(); e.stopImmediatePropagation(); ending.skip(); skipCutin(); skipClickUntil = performance.now() + END.skipClickMs
  showOverlay(); schedule()
}, true)
root.addEventListener('click', e => { if (performance.now() < skipClickUntil) { e.preventDefault(); e.stopImmediatePropagation() } }, true)
function frame(now: number) {
  raf = 0; if (document.hidden) return
  perfTick(now)
  const wallDt = last ? Math.max(0, (now - last) / 1000) : 0
  const dt = Math.min(.1, wallDt); last = now
  const endWasActive = ending.active
  feel.observe(run)
  feel.advance(wallDt, live && !paused && !inspecting && !rotationBlocked && !run.offers.length)
  if (live && !paused && !inspecting && !rotationBlocked && !feel.stopped && run.state === 'playing' && !run.offers.length) {
    // 빠르기 ×2·×3 은 한 프레임에 걸음을 더 돌린다 (걸음은 늘 STEP · raid/speed.ts) · 시전·컷인 동안은 ×1
    acc = runFrame(acc, dt, () => run.cast || run.t < cutinUntil ? 1 : speedOf(speed), () => {
      let x = Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft')), y = Number(keys.has('s') || keys.has('arrowdown')) - Number(keys.has('w') || keys.has('arrowup'))
      const sd = stickDir()
      if (x || y) destination = null
      else if (sd) { x = sd.x; y = sd.y }
      else if (destination) { const dx = destination.x - run.x, dy = destination.y - run.y, len = Math.hypot(dx, dy); if (len < 5) destination = null; else { x = dx / len; y = dy / len } }
      const castBefore = run.cast, dashBefore = run.dashCd, wakesBefore = run.wakes
      // 맡아 둔 누름: 누른 지 STICK.queue 초 안이면 계속 넣는다 (재사용이 그 안에 풀리면 나간다) · 나가면 지운다
      stepHaebi(run, feed({ x, y, ...(championViewNeeded(run, STEP) ? { viewBounds: fieldView(cam) } : {}), ...(run.mode === 'stage' ? { barrageSource: barrageArcher(run, fieldView(cam))?.id ?? 0 } : {}), dash: run.t - dashAt <= STICK.queue, skill: run.t - skillAt <= STICK.queue, wake: run.t - wakeAt <= STICK.queue, shortCutin }), STEP)   // 판 기록이 이동을 격자에 맞춰 적고 그 값을 넣는다 (runlog.ts)
      feel.observe(run)
      if (run.dashCd > dashBefore) dashAt = -9
      if (run.wakes > wakesBefore) wakeAt = -9
      // 시전이 새로 섰다 = 각성 또는 비기 (한 번에 하나 · 판이 줄 세운다)
      if (run.cast && run.cast !== castBefore) { showSkillCutin(run.cast.kind === 'wake', run.cast.tru); if (run.cast.kind === 'ult') skillAt = -9 }
      return !feel.stopped && !run.offers.length && run.state === 'playing'
    })
  }
  if (live) {
    ending.observe(run); ending.advance(wallDt, endWasActive && !rotationBlocked)
    const events = ending.events()
    if (events.start) {
      skipCutin(); resetInput()
      if (ending.kind === 'defeat') { haptics().hurt(1); endHit = new Image(); endHit.src = hitArtUrl(awakenedLook(run)).url ?? import.meta.env.BASE_URL + 'realm/bust-hd/' + HERO.bust + '.jpg' }
    }
    if (events.stamp && ending.kind !== 'retreat') { sound.ending(ending.kind === 'victory'); if (ending.kind === 'victory') haptics().win() }
    const boss = giantMob(run)
    if (boss && boss !== giantCameraOwner) { giantCameraOwner = boss; giantZoomRestore = cam.level; giantAutoFraming = true; giantFitZoom = GIANT.cameraZoom; cam.level = 0; paintZoom() }
    const bossFrame = giantAutoFraming && boss?.giant && !ending.active ? bossFrameZoom(boss.giant.kind === 'tiger' ? tigerVisualBounds(boss.giant) : boss.giant.kind === 'gumiho' ? gumihoVisualBounds(boss.giant) : imugiVisualBounds(boss.giant.pose), GIANT.cameraZoom) : null
    if (bossFrame !== null) giantFitZoom = Math.min(giantFitZoom, bossFrame)
    followCam(cam, run.x, run.y, feel.stopped || ending.active ? 0 : dt, false, bossFrame !== null ? giantFitZoom : undefined)
    // Entry eases out while the boss arrives; later overhangs must fit on the same displayed/input camera.
    if (bossFrame !== null && boss!.giant!.age >= giantEntrySeconds(boss!.giant!)) { cam.zoom = Math.min(cam.zoom, giantFitZoom); Object.assign(cam, clampCenter(cam.zoom, cam.x, cam.y)) }
    const zoom = ending.kind === 'victory' ? Math.min(1, Math.max(0, ending.elapsed - ending.freeze) / END.cameraTime) : 0
    const endCam = zoom ? { zoom: cam.zoom * (1 + END.cameraZoom * zoom), x: cam.x + (run.x - cam.x) * zoom, y: cam.y + (run.y - cam.y) * zoom } : cam
    if (zoom) Object.assign(endCam, clampCenter(endCam.zoom, endCam.x, endCam.y))
    prepareHeroRaster(endCam.zoom)
    drawField(ctx, images, run, destination, endCam, feel, ending.kind ? ending : undefined, fieldLowGraphics)
    drawEnding(ctx, ending, endHit, runGold(run), images)
  }
  bigCutin.update(run)
  if (!live || run.t >= cutinUntil) skipCutin()
  // 기술이 터지면 계단마다 떨고(비기 한 번 · 각성 두 박 · 진각성 세 박) 크리티컬은 짧게 한 번 (11-19 형 · HAEBI_FEEL_TIERS · 끄기·가려진 탭은 haptics 가 막음)
  const felt = sound.frame(run, live, paused || inspecting || rotationBlocked, true)
  if (felt.skill) haptics().skill(felt.skill); else if (felt.crit) haptics().crit()
  updatePortrait(); updateHud(); giantHud.update(live ? giantHUD(run) : null, live && !paused && !inspecting && !rotationBlocked && !run.offers.length && !feel.stopped ? dt : 0); showOverlay(); syncEndingVideo(); schedule()
}
function schedule() { if (!raf && !document.hidden) raf = requestAnimationFrame(frame) }
updateHud(); schedule()
// 개발 검수 손잡이 — 헤드리스 시험(tools/raid-*-probe.ts)이 판 상태를 읽고 체력을 깎아 본다 · 배포 빌드엔 없음
if (import.meta.env.DEV) Object.assign(window, { __raid: () => run, __raidEnd: () => ({ kind: ending.kind, elapsed: ending.elapsed, duration: ending.duration, active: ending.active, ready: ending.ready, stampAt: ending.stampAt, effectTime: ending.effectTime, overlayVisible: !$('overlay').hidden }), __raidFeel: () => ({ time: feel.time, stopRemaining: feel.stopRemaining, shake: feel.shake }), __raidSound: sound, __raidCutin: (wake: boolean, tru = false) => showSkillCutin(wake, tru) })
if (import.meta.env.DEV && new URLSearchParams(location.search).has('review')) {
  import('./raid/haebi-review.ts').then(({ installReview }) => installReview(root, s => { if (s.giantFlow && s.stage === 'snow') void prewarmTigerArt('snow', images, base).then(() => schedule()); if (s.giantFlow && s.stage === 'forest') void prewarmGumihoArt('forest', images, base).then(() => schedule()); notifyVanguardStart(); run = s; live = true; paused = !s.offers.length; shown = ''; loadoutKey = ''; resetInput(); $('menu').hidden = true; $('play').hidden = false; $<HTMLButtonElement>('pause').disabled = false; layoutTrial(); showOverlay(); updateHud(); schedule() }, mode, kit))
}
