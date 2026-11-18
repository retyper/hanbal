import { breakthroughText, isBreakthrough } from './realm/vanguard.ts'
import { HAEBI_RUN as C, HAEBI_STICK as STICK, HAEBI_TREE as TREE, HAEBI_ULT as ULT, HAEBI_AWAKEN as AWK, HAEBI_STAGES as ST } from './tune/params.ts'
import { createHaebi, runDuration, stepHaebi, choose, reroll, POWERS, kitCombos, KITS, xpNeeded, phase, runGold, isCombo, comboOf, comboRank, gaugeRatio, awakenedLook, nodeText, nodeAt, branchName, branchPoints, wakeReady, ultName, ultOpen, BRANCHES, branchNodes, type Kit, type Power, type Pick, type HaebiRun, type StageId } from './raid/haebi.ts'
import { loadMeta, saveMeta, buy, refund, record, shopCost, shopMax, stageOpen, stageName, pickStage, SHOP, STAGE_ORDER, type ShopKey } from './raid/meta.ts'
import { drawField, imagePaths, setHeroArt, heroArtFiles } from './raid/haebi-view.ts'
import { powerIcon, installPowerHints, comboIcon, rankMark, treeSvg, treeInfo, BRANCH_COLOR } from './raid/power-ui.ts'
import { KIT_BY_SPRITE } from './raid/kit-table.ts'
import { cutBandHtml, cutHeroPath, ensureCutinBandCss, type CutBg } from './ui/cutin-band.ts'
import { josa } from './core/josa.ts'
import { hitPortrait, hitStrength, hitArtKey, hitKeyPath, warmHitArt } from './ui/hit-portrait.ts'
import { raidSound } from './raid/sound.ts'
import { DEFAULT_HERO, DEMON_STAGE, SEAL_STAGE, demonSealed, loadRoster, stampDemons, type RosterHero } from './raid/link.ts'
import { TRUE_WAKE } from './realm/data/awaken2.ts'
import './raid/combat.css'
import { guardMedia } from './ui/media-guard.ts'
import { haptics } from './ui/haptics.ts'
guardMedia() // 그림 길게 누름 메뉴·끌기 막기 (11-19)

const root = document.querySelector<HTMLDivElement>('#raid')!
const query = new URLSearchParams(location.search)
const vanguardToken = window.parent !== window ? query.get('vanguard') : null
const trialToken = window.parent !== window ? new URLSearchParams(location.search).get('trial') : null
/** 판: 본편 선봉 · 본편 각성 시련(짧고 쉬움) · 독립 열전(스테이지·상점·휘장 · 형 11-16 「따로 떼기」) */
const mode = query.has('vanguard') ? 'vanguard' : trialToken ? 'trial' : 'stage'
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
const sound = raidSound((query.get('sex') ?? (/^[wl]-/.test(HERO.bust) ? 'f' : 'm')) === 'f', kit)
setHeroArt(sprite, HERO.awake)
/** 판 밖 기록 (금·상점·휘장) — 독립 열전만 쓴다 */
const meta = loadMeta()
/**
 * 판 안 각성 (각성 v2 가7 · 11-19) — 그 사람의 도깨비 도장(목책의 도깨비를 잡음)이 있는 장수만 막대가 차면 각성한다 · 없으면 「영웅의 투지」.
 * 판의 셈이 판 밖 기록을 읽지 않게 여기(출전 준비)서 읽어 createHaebi 의 awaken 으로 넘긴다. 도장 찍기(stampDemons)를 먼저 불러
 * 이 길이 생기기 전에 깬 목책도 넘겨받는다 · 시련은 아직 본편 각성 전이라 투지뿐 · 각성 띠가 없는 장수는 초상·영상·컷인·오라로 각성한다.
 * 숙련: 이 장수로 숲·여울·목책을 다 깼으면 막대 절반으로 시작.
 */
stampDemons()
const sealedWake = () => mode !== 'trial' && demonSealed(heroId, meta.heroes)
let canAwaken = sealedWake()
const mastery = (['forest', 'ford', 'palisade'] as const).every(id => (meta.heroes[heroId] ?? []).includes(id))
/** 골라 두는 스테이지 — 열렸고 아직 못 깬 첫 스테이지 · 목책의 벽 앞이면 여울 (meta.pickStage · 각성 v2 가9) */
let stage: Exclude<StageId, 'trial'> = pickStage(meta, kit)
/** 두목이 오는 때(분) — 수치에서 읽는다: 스테이지 19분(판은 20분) · 각성 시련 7분(판은 8분) */
const bossMinute = () => Math.floor(C.bossAt * ST[mode === 'trial' ? 'trial' : stage].length / 60)
const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`
const newRun = (seed: number) => { const r = createHaebi(seed, mode, kit, { ...mode === 'stage' ? { stage, bonus: meta.shop } : {}, awaken: canAwaken, mastery }); if (r.message.endsWith('첫 조합을 향해')) { r.message = ''; r.messageTime = 0 }  /* 시작 군말 띠는 걷는다 (형 11-16) */ return r }
root.innerHTML = `<header><div><small>장수 열전 · 독립 모드</small><h1>${HERO.name} <em>${K.title}</em></h1></div><div class="head-actions"><button id="pause" disabled aria-label="일시정지">Ⅱ</button></div></header>
<div id="layout"><aside id="character"><div id="portrait-media"><img id="hero-portrait" src="${import.meta.env.BASE_URL}realm/bust-hd/${HERO.bust}.jpg" alt="${HERO.name} 원화"><video id="hero-video" muted loop playsinline preload="none" hidden aria-label="각성 ${HERO.name} 영상"></video></div><div class="portrait-title"><span>${HERO.home}</span><b id="rank-title">${HERO.name}</b><button id="portrait-toggle" hidden>원화로 보기</button></div><div id="reaction">${weapon} 하나로 시작하는 열전</div><div id="combo-badges"></div><i class="frame-knots"></i></aside>
<main><section id="menu"><span class="eyebrow">장수 열전</span><h2>${HERO.name}<em>${K.title}</em></h2><p>능력을 고르고 두 힘을 묶어, ${bossMinute()}분을 버틴 뒤 오는 두목을 쓰러뜨리세요.</p><div class="journey"><span><b>01</b> 붉은 고리를 피하고</span><span><b>02</b> 두 힘을 묶어</span><span><b>03</b> 두목을 잡습니다</span></div><button id="start" class="primary" disabled>그림을 불러오는 중…</button><p class="controls">이동 WASD·방향키·화면 누르기 · 회피 Shift · 비기 Space · 각성 E · 멈춤 Esc</p><p class="note">본편의 병력과 따로인 한 판입니다.</p></section>
<section id="play" hidden><div id="arena"><canvas id="field" width="${C.width}" height="${C.height}" aria-label="${HERO.name} 토벌 전장. 클릭 또는 드래그로 이동"></canvas><div id="combat-hud"><div class="health-line"><b>${HERO.name}</b><span id="health">180 / 180</span></div><div class="bar hp"><span class="hp-track"><i id="hp-fill"></i><em id="hp-chunk"></em><b id="hp-ward" hidden></b></span></div><div id="wake-bar" class="${canAwaken ? '' : 'grit'}" aria-label="${canAwaken ? '각성' : '영웅의 투지'} 막대"><i id="wake-fill"></i></div><div id="loadout" aria-label="획득한 전투 능력"></div></div><div id="hud"><small id="phase"></small><b id="clock"></b></div><div id="score"><b id="kills"></b><small>격파</small><b id="level"></b></div><div class="bar xp"><i id="xp-fill"></i></div><div id="announcement" aria-live="polite"></div><div id="streak"></div><footer><button id="wake" class="${canAwaken ? '' : 'grit'}" hidden aria-label="${canAwaken ? '각성' : '영웅의 투지'} E">${canAwaken ? '' : '<small class="pre">영웅의</small>'}<b>${canAwaken ? '각성' : '투지'}</b><small>E</small></button><span id="hint">자동 공격 · 화면을 끌면 그쪽으로 이동 · 능력 아이콘을 누르고 있으면 설명</span><button id="dash">회피 Shift</button><button id="skill" class="primary" data-kit="${kit}">${K.skill} Space</button></footer><div id="stick" hidden aria-hidden="true"><i></i></div><i class="frame-knots"></i></div></section></main></div><div id="power-tooltip" role="tooltip" hidden></div><div id="overlay" hidden></div>`
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T
root.insertAdjacentHTML('beforeend', `<div id="rotate-guide" hidden><div><span style="font-size:44px">↻</span><h2>폰을 가로로 돌려 주세요</h2><p>확대 ${josa(HERO.name, '과', '와')} 전장을 함께 보며 싸웁니다.<br>회전하는 동안 전투는 멈춰 있습니다.</p></div></div>`)
/** 비기 컷인 띠의 기운 바탕 — 묶음마다 (fx/skill/bg/<결>.webp) */
const KIT_BG: Record<Kit, CutBg> = { axe: 'earth', bow: 'arrow', spear: 'wind', sword: 'bolt', dagger: 'shadow', magic: 'spirit', sling: 'earth' }
ensureCutinBandCss()
$('arena').insertAdjacentHTML('beforeend', '<div id="skill-cutin" hidden aria-hidden="true"></div>')
let cutinUntil = 0
/**
 * 비기 컷인 · 각성 컷인 — 본편과 같은 띠(ui/cutin-band.ts). 판 안에서 각성해 있으면 1차 각성 윗몸 → 기본 윗몸 → 각성 초상 순.
 * 띠를 새로 그려 넣으니 애니는 매번 처음부터 · 화면을 누르면 걷힌다 (판은 그대로 돈다).
 */
function showSkillCutin(wake = false, tru = false) {
  // 시전(판 시각 cast)이 끝나는 순간 띠가 번쩍이며 걷히기 시작하고 비기가 터진다 — 판이 느려지므로 화면에선 cast ÷ slow 초 (11-17 형: 「컷인 보고 → 데미지 보고」)
  const face = awakenedLook(run) ? `../awaken-hd/${HERO.bust}` : HERO.bust, cast = wake ? AWK.cast : tru ? ULT.trueCast : ULT.cast, hit = cast / ULT.slow * 1000
  const cut = $('skill-cutin')
  cut.innerHTML = cutBandHtml({ art: import.meta.env.BASE_URL + 'realm/', bg: KIT_BG[kit], hero: cutHeroPath(face), endMs: hit / .88, hitMs: hit,
    title: wake ? `각성 · ${HERO.name}` : ultName(kit, tru), ...wake ? {} : { sub: HERO.name }, dim: C.skillCutinDim, grand: wake || tru })
  cut.hidden = false; cutinUntil = run.t + cast + C.skillCutinTail
}
function skipCutin() { if (!$('skill-cutin').hidden) { $('skill-cutin').hidden = true; $('skill-cutin').innerHTML = ''; cutinUntil = 0 } }
$('pause').insertAdjacentHTML('beforebegin', '<button id="fullscreen">전체화면</button>')
$('fullscreen').textContent = '⛶'; $('fullscreen').setAttribute('aria-label', '전체화면');
$('fullscreen').onclick = () => { if (document.fullscreenElement) void document.exitFullscreen?.(); else void document.documentElement.requestFullscreen?.().catch(() => undefined) }
if (trialToken) {
  document.body.classList.add('campaign-trial')
  root.querySelector('header small')!.textContent = `본편 · ${HERO.name}의 각성 시련`
  $('menu').querySelector('.note')!.textContent = `두목을 쓰러뜨리고 돌아가면 본편의 ${josa(HERO.name, '이', '가')} 각성합니다.`
}
if (mode === 'vanguard') {
  document.body.classList.add('campaign-vanguard')
  root.querySelector('header small')!.textContent = '본편 합전 · 선봉에 서기'
  $('menu').querySelector('h2')!.innerHTML = '각성의 힘으로<br><em>본대가 나아갈 길을 열어라.</em>'
  $('menu').querySelector('p')!.textContent = `${(([a, b]) => `${josa(a!, '과', '와')} ${josa(b!, '을', '를')}`)(kitCombos(kit).filter(c => c.kit === kit).map(c => c.name))} 갖추고 출전합니다. 최대 3분 동안 전위대장 셋을 격파하세요.`
  $('menu').querySelector('.journey')!.innerHTML = '<span><b>1 돌파</b> 적 앞줄 −4% · 아군 힘 +35%</span><span><b>2 돌파</b> −8% · +55%</span><span><b>3 돌파</b> −12% · +75%</span>'
  $('menu').querySelector('.note')!.textContent = '한 전투에 한 번. 돌파 후 이번 합의 앞줄 싸움에 반영됩니다. 중도 귀환·패배도 확보한 성과는 유지되며 각성은 풀리지 않습니다.'
}
root.insertAdjacentHTML('beforeend', '<div id="shop" hidden></div>')
const startLabel = () => mode === 'vanguard' ? `각성 ${HERO.name} 출전 · 최대 3분` : mode === 'trial' ? `${HERO.name} 출전 · ${Math.round(runDuration(run) / 60)}분` : `${stageName(stage)} 출전 · ${Math.round(runDuration(run) / 60)}분`
/** 독립 열전 출전 화면: 스테이지 다섯(11-16 설원 고개·불타는 산성 더함 · 앞을 깨면 다음이 열림 · 깨면 휘장) + 금 + 상점 (형 11-16 다이센카식) */
const STAGE_GLYPH: Record<string, string> = { forest: '林', ford: '灘', palisade: '柵', snow: '雪', fortress: '城' }
function renderStageMenu() {
  if (mode !== 'stage') return
  const menu = $('menu')
  menu.querySelector('p')!.textContent = `${bossMinute()}분을 버틴 뒤 오는 두목을 쓰러뜨리면 휘장과 많은 금을 받습니다. 쓰러져도 버틴 만큼 금을 받아 상점에서 영구 강화를 삽니다.`
  const pick = menu.querySelector('.journey')!; pick.className = 'journey stage-pick'
  pick.innerHTML = STAGE_ORDER.map(id => {
    const open = stageOpen(meta, id), best = meta.best[id]
    return `<button data-stage="${id}" class="${id === stage ? 'on' : ''}" ${open ? '' : 'disabled title="앞 스테이지를 깨면 열립니다"'} aria-pressed="${id === stage}"><img class="emblem ${meta.cleared[id] ? 'got' : ''}" src="${import.meta.env.BASE_URL}realm/raid/emblem-${id}.png" alt="${STAGE_GLYPH[id]}"><b>${stageName(id)}</b><small>${!open ? '앞을 깨면 열립니다' : meta.cleared[id] ? '휘장 획득' : best ? `최고 ${clock(best)} 버팀` : '첫 도전'}</small></button>`
  }).join('')
  pick.querySelectorAll<HTMLButtonElement>('[data-stage]').forEach(b => b.onclick = () => { stage = b.dataset.stage as typeof stage; run = newRun(7); renderStageMenu() })
  menu.querySelector('.note')!.innerHTML = `<span class="gold-line">금 <b>${meta.gold.toLocaleString()}</b></span><button id="open-shop">상점 · 영구 강화</button><button id="open-heroes">장수 바꾸기</button>`
  $('open-shop').onclick = () => { renderShop(); $('shop').hidden = false }
  $('open-heroes').onclick = () => { renderHeroes(); $('shop').hidden = false }
  if (!$<HTMLButtonElement>('start').disabled) $('start').textContent = startLabel()
}
/**
 * 데려갈 장수 — 본편에서 모은 우리 장수만 (본편이 raid/link.ts 에 적어 둔다 · 해비는 늘). 고르면 그 장수의 겉모습으로 열전을 다시 연다.
 * 진각성 그림이 있는 장수는 이 장수로 마지막 스테이지를 깨면 본편에서 진각성할 수 있다 (금빛 「진」 · 깼으면 ✓)
 */
const HAEBI: RosterHero = { id: DEFAULT_HERO, name: '해비', home: '미추홀의 장수', bust: 'w-95-michuhol-haebi', sprite: 'haebi', awake: 'aw1-haebi', kit: 'axe', video: true }
function renderHeroes() {
  const list = [HAEBI, ...loadRoster().filter(h => h.id !== DEFAULT_HERO)]
  const sealed = (id: string) => (meta.heroes[id] ?? []).includes(SEAL_STAGE)
  $('shop').innerHTML = `<div class="panel shop heroes"><small>장수 열전 · 데려갈 장수</small><h2>${list.length}명</h2><p>본편에서 우리 장수가 되면 여기에 섭니다. <b class="tw">진</b> 장수는 ${josa(stageName(SEAL_STAGE), '을', '를')} 깨면 본편에서 진각성할 수 있습니다.</p><div class="hero-grid">${list.map(h =>
    `<button data-hero="${esc(h.id)}" class="${h.id === heroId ? 'on' : ''}" aria-pressed="${h.id === heroId}"><img src="${import.meta.env.BASE_URL}realm/bust/${esc(h.bust)}.jpg" alt="" loading="lazy"><b>${esc(h.name)}</b><small>${KITS[h.kit]?.weapon ?? ''}</small>${TRUE_WAKE.has(h.id) ? `<i class="tw${sealed(h.id) ? ' ok' : ''}">${sealed(h.id) ? '진 ✓' : '진'}</i>` : ''}</button>`).join('')}</div><div class="shop-actions"><button id="close-shop" class="primary">닫기</button></div></div>`
  $('shop').querySelectorAll<HTMLButtonElement>('[data-hero]').forEach(b => b.onclick = () => {
    const h = list.find(x => x.id === b.dataset.hero); if (!h || h.id === heroId) { $('shop').hidden = true; return }
    const q = new URLSearchParams({ hero: h.id, name: h.name, home: h.home, bust: h.bust, sprite: h.sprite, kit: h.kit, video: h.video ? '1' : '0' })
    if (h.awake) q.set('awake', h.awake)
    b.classList.add('bought'); location.replace(`${location.pathname}?${q}`)
  })
  $('close-shop').onclick = () => { $('shop').hidden = true }
}
function renderShop() {
  $('shop').innerHTML = `<div class="panel shop"><small>장수 열전 · 판 밖 상점</small><h2>금 ${meta.gold.toLocaleString()}</h2><p>산 것은 다음 판부터 모든 장수에게 붙습니다. 언제든 전부 되돌려 받습니다.</p><div class="shop-grid">${SHOP.map(it => {
    const lv = meta.shop[it.key], max = shopMax(it.key), full = lv >= max, cost = full ? 0 : shopCost(it.key, lv), poor = !full && meta.gold < cost
    return `<button data-buy="${it.key}" class="${full ? 'maxed' : poor ? 'poor' : ''}" ${full || poor ? 'aria-disabled="true"' : ''}><img class="rune" src="${import.meta.env.BASE_URL}realm/raid/shop-${it.key}.png" alt="${it.glyph}"><b>${it.name} <i>${lv}/${max}</i></b><small>${it.desc(full ? lv : lv + 1)}</small><em>${full ? '다 올림' : poor ? `금 ${cost} · 모자람` : `금 ${cost}`}</em></button>`
  }).join('')}</div><div class="shop-actions"><button id="refund" ${meta.spent ? '' : 'disabled'}>전부 되돌리기 · 금 ${meta.spent.toLocaleString()}</button><button id="close-shop" class="primary">닫기</button></div></div>`
  $('shop').querySelectorAll<HTMLButtonElement>('[data-buy]').forEach(b => b.onclick = () => { if (buy(meta, b.dataset.buy as ShopKey)) { saveMeta(meta); run = newRun(7); renderShop(); renderStageMenu(); b.classList.add('bought') } })
  $('refund').onclick = () => { refund(meta); saveMeta(meta); run = newRun(7); renderShop(); renderStageMenu() }
  $('close-shop').onclick = () => { $('shop').hidden = true }
}
const canvas = $<HTMLCanvasElement>('field'), ctx = canvas.getContext('2d', { alpha: false })!   // 판은 늘 바탕을 다 칠한다 — 불투명이면 폰이 겹치기를 덜 한다
const images = new Map<string, HTMLImageElement>(), keys = new Set<string>()
let run = newRun(7), live = false, paused = false, shown = '', loadoutKey = '', acc = 0, last = 0, raf = 0
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
const warmAwake = () => { new Image().src = import.meta.env.BASE_URL + 'realm/awaken-hd/' + HERO.bust + '.jpg'; warmHitArt(hitArtUrl(true).url) }
// 피격 그림도 미리 (처음 맞을 때부터 그림이 뜨게 · 실린 뒤에야 금을 끈다 · ui/hit-portrait.ts)
const hitArtUrl = (awake: boolean): { key: string | null; url: string | null } => { const key = hitArtKey(awake ? 'awaken' : 'bust', HERO.bust), p = hitKeyPath(key); return { key, url: p === null ? null : import.meta.env.BASE_URL + 'realm/' + p } }
warmHitArt(hitArtUrl(false).url); if (canAwaken) warmAwake()
/** 각성 단추·막대의 꼴 (각성 · 영웅의 투지) — 목책의 도깨비를 잡아 방금 도장을 받았으면 다음 판부터 각성 (판 가운데서는 안 바꾼다) */
function refreshWakeKind() {
  const was = canAwaken; canAwaken = sealedWake(); if (canAwaken === was) return
  const label = canAwaken ? '각성' : '영웅의 투지'
  $('wake-bar').classList.toggle('grit', !canAwaken); $('wake-bar').setAttribute('aria-label', `${label} 막대`)
  $('wake').classList.toggle('grit', !canAwaken); $('wake').setAttribute('aria-label', `${label} E`)
  $('wake').innerHTML = `${canAwaken ? '' : '<small class="pre">영웅의</small>'}<b>${canAwaken ? '각성' : '투지'}</b><small>E</small>`
  if (canAwaken) warmAwake()
}
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
  if (playing) void heroVideo.play().catch(() => { stillPortrait = true; mediaKey = ''; updatePortrait() }); else heroVideo.pause()
}
function layoutTrial() {
  rotationBlocked = live && run.state === 'playing' && innerWidth <= 700 && innerHeight > innerWidth
  $('rotate-guide').hidden = !rotationBlocked
  document.body.classList.toggle('raid-running', live)
  if (rotationBlocked) { paused = true; resetInput(); shown = ''; showOverlay() }
}
window.addEventListener('resize', layoutTrial)
let pendingSeed = vanguardToken ? Number(query.get('seed')) >>> 0 : crypto.getRandomValues(new Uint32Array(1))[0]!
const notifyVanguardStart = () => { if (vanguardToken) window.parent.postMessage({ type: 'hanbal.haebi.vanguard-start', token: vanguardToken }, location.origin) }
const base = import.meta.env.BASE_URL + 'realm/'
Promise.all([...imagePaths, ...heroArtFiles()].map(path => new Promise<void>((resolve, reject) => { const img = new Image(); img.onload = () => { images.set(path, img); resolve() }; img.onerror = reject; img.src = base + path }))).then(() => { $<HTMLButtonElement>('start').disabled = false; $('start').textContent = startLabel(); renderStageMenu(); schedule() }).catch(() => { $('start').textContent = '그림을 불러오지 못했어요. 새로고침해 주세요.' })
function resetInput() { keys.clear(); destination = null; stickEnd(); dashAt = skillAt = wakeAt = -9; acc = 0 }
function begin(sameSeed = false) {
  if (!sameSeed && !vanguardToken) pendingSeed = crypto.getRandomValues(new Uint32Array(1))[0]!
  sound.unlock(); hidePowerHint(); notifyVanguardStart(); run = newRun(pendingSeed); live = true; paused = false; shown = ''; loadoutKey = ''; resetInput(); last = 0
  skipCutin()
  $('menu').hidden = true; $('play').hidden = false; $('overlay').hidden = true; $<HTMLButtonElement>('pause').disabled = false; schedule()
  $<HTMLButtonElement>('start').blur(); window.scrollTo(0, 0)
  layoutTrial()
}
$('start').onclick = () => begin()
function pause() { if (!live || run.state !== 'playing' || run.offers.length) return; paused = !paused; resetInput(); shown = ''; showOverlay(); schedule() }
$('pause').onclick = pause
window.addEventListener('keydown', e => {
  if (!live) return
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) || e.key === ' ' && e.target === document.body) e.preventDefault()
  if (e.key === 'Escape' && !e.repeat) { if (!treeView.hidden) closeTree(); else pause(); return }
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
  if (document.hidden) { heroVideo.pause(); mediaKey = ''; cancelAnimationFrame(raf); raf = 0; resetInput(); if (live && run.state === 'playing') paused = true; shown = ''; showOverlay(); sound.frame(run, live, true) }
  else { last = 0; schedule() }
})
function point(e: PointerEvent) {
  const r = canvas.getBoundingClientRect(), scale = Math.min(r.width / C.width, r.height / C.height)
  // object-fit:contain may letterbox the canvas on short or narrow landscape screens.
  destination = { x: Math.max(0, Math.min(C.width, (e.clientX - r.left - (r.width - C.width * scale) / 2) / scale)), y: Math.max(0, Math.min(C.height, (e.clientY - r.top - (r.height - C.height * scale) / 2) / scale)) }
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
  el.addEventListener('pointerdown', e => { if (el === canvas) skipCutin(); stickStart(el, e) })
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
/** 갈래 막대 — 그 갈래에 찍은 점 · 층이 열리는 눈금(4·9·15점) · 다음 층까지 (조합에 안 쓰이는 칸의 카드 아래) */
function branchHint(k: Power) {
  const at = nodeAt(kit, k)!, pts = branchPoints(run, at.branch), last = TREE.tiers[TREE.tiers.length - 1]!, next = TREE.tiers.find(n => n > pts)
  const ticks = TREE.tiers.slice(1).map(n => `<b class="${pts >= n ? 'on' : ''}" style="left:${n / last * 100}%"></b>`).join('')
  return `<span class="branch-bar" style="--c:${BRANCH_COLOR[at.branch]}"><i style="width:${Math.min(100, pts / last * 100)}%"></i>${ticks}</span><small class="branch-next">${next ? `다음 층 ${next}점 · 지금 ${pts}점` : '갈래 끝까지 열림'}</small>`
}
function routeHint(k: Power) {
  // 끝 단계까지 올린 조합은 빼고 (카드가 길어져 폰 가로에서 넘쳤다)
  return kitCombos(kit).filter(c => k in c.needs && comboRank(run, c.id) < TREE.max).map(c => recipe(c, k)).join('') || branchHint(k)
}
/** 레벨업 카드 — 칸 카드(위에 갈래 띠 · 갈래 끝은 별 테) · 금테 조합 카드(처음엔 열기 · 다시 나오면 단계 올리기 · 끝 단계는 비기 강화) */
function card(k: Pick) {
  if (!isCombo(k)) {
    const p = POWERS[k], t = nodeText(kit, k), at = nodeAt(kit, k)!, cap = at.tier === TREE.tiers.length - 1, color = BRANCH_COLOR[at.branch]
    const tag = `<i class="branch-tag" style="--c:${color}">${branchName(kit, at.branch)}</i>`
    return `<button data-up="${k}" class="${cap ? 'cap-card' : ''}" style="--accent:${cap ? color : p.color};--c:${color}">${cap ? '<i class="ribbon cap">갈래 끝</i>' : tag}<span class="rune">${powerIcon(k, kit)}</span><small class="gain${run.ranks[k] ? '' : ' new'}">${run.ranks[k] ? '+1' : '획득'}</small><b>${t.name}</b><span>${t.desc}</span><em>${routeHint(k)}</em></button>`
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
const treeView = document.createElement('div'); treeView.id = 'tree-view'; treeView.hidden = true; treeView.setAttribute('role', 'dialog'); treeView.setAttribute('aria-label', '기술 나무')
root.append(treeView)
function openTree() {
  treeView.innerHTML = `<div class="panel tree-panel"><div class="tree-head"><h2>${weapon} 기술 나무</h2><small>레벨 ${run.level} · 남은 고름 ${Math.max(0, C.maxLevel - run.level)}번</small><button class="tree-close primary">닫기</button></div>${treeSvg(run)}<p class="tree-info">칸을 누르면 설명이 나옵니다</p></div>`
  treeView.hidden = false
}
function closeTree() { if (!treeView.hidden) treeView.hidden = true }   // 판마다 불린다 — 같은 값도 쓰면 속성이 바뀐 셈이 된다 (11-18)
treeView.onclick = e => {
  const t = e.target as Element, node = t.closest('[data-node],[data-combo],[data-ult]')
  if (node) { treeView.querySelectorAll('.picked').forEach(x => x.classList.remove('picked')); node.classList.add('picked'); treeView.querySelector('.tree-info')!.innerHTML = treeInfo(run, node); return }
  if (t === treeView || t.closest('.tree-close')) closeTree()
}
const treeButton = '<button id="tree-open" class="tree-btn" aria-label="기술 나무 보기"><img src="' + import.meta.env.BASE_URL + 'realm/raid/power-skill.png" alt="">나무</button>'
let wonBuzz: HaebiRun | null = null
function showOverlay() {
  const state = !live ? '' : run.state !== 'playing' ? run.state : run.offers.length ? 'upgrade:' + run.offers.join(',') : paused ? 'pause' : ''
  if (!state) { shown = ''; if (!$('overlay').hidden) $('overlay').hidden = true; closeTree(); return }
  if (state === shown) return
  hidePowerHint(); closeTree()
  shown = state; const overlay = $('overlay'); overlay.hidden = !state; if (!state) return
  resetInput()
  if (state.startsWith('upgrade')) {
    overlay.innerHTML = `<div class="panel upgrade">${treeButton}<div class="lv-head">${haveRow()}<h2 class="lvup">레벨 업!</h2></div><div class="choices">${run.offers.map(card).join('')}</div><button id="reroll" ${run.rerolls ? '' : 'disabled'}>다른 선택지 · ${run.rerolls}회 남음</button></div>`
    overlay.querySelectorAll<HTMLButtonElement>('[data-up]').forEach(b => b.onclick = () => { if (choose(run, b.dataset.up as Pick)) { shown = ''; showOverlay(); updateHud() } })
    if (run.level === 1) { $<HTMLButtonElement>('reroll').disabled = true; $('reroll').textContent = '첫 갈래를 골라 주세요' }
    $('reroll').onclick = () => { if (reroll(run)) { shown = ''; showOverlay() } }
    $('tree-open').onclick = openTree
  } else if (state === 'pause') {
    overlay.innerHTML = `<div class="panel">${treeButton}<small>장수 열전</small><h2>잠시 숨 고르기</h2><p>성장과 전투는 그대로 기다립니다.</p><button id="resume" class="primary">계속 싸우기</button><button id="quit">출전 화면으로</button></div>`
    $('tree-open').onclick = openTree
    $('resume').onclick = () => { paused = false; shown = ''; last = 0; showOverlay() }; $('quit').onclick = menu
    if (vanguardToken) { $('quit').textContent = '지금 확보한 돌파로 귀환'; $('quit').onclick = withdraw }
    else if (mode === 'stage') { $('quit').textContent = '물러나기 · 버틴 만큼 금 받기'; $('quit').onclick = withdraw }
  } else {
    // 이겼다 — 결과 판이 뜨는 그 박자에 다다닥 (11-19 형: 「듀오링고처럼 햅틱 막 지랄 나 주면」) · 판마다 한 번 (탭을 다녀와 다시 그려도 또 떨지 않는다)
    if (run.state === 'won' && wonBuzz !== run) { wonBuzz = run; haptics().win() }
    // 독립 열전: 판이 끝나면 한 번만 금을 주고 기록한다 (지면 버틴 만큼 · 깨면 휘장 + 깸 금)
    if (mode === 'stage' && rewarded !== run) { rewarded = run; const gold = runGold(run); reward = { gold, ...record(meta, run.stage, gold, run.state === 'won', run.t, heroId) }; saveMeta(meta); if (run.state === 'won' && run.stage === DEMON_STAGE) { stampDemons(); refreshWakeKind() } }
    overlay.innerHTML = `<div class="panel result ${run.state}"><h2>${run.state === 'won' ? mode === 'stage' ? `${stageName(run.stage)} 토벌 완료` : '열전 완수' : run.hp <= 0 ? '도전 실패' : run.t < runDuration(run) ? '철수' : '시간 초과 · 두목 생존'}</h2><p>${Math.floor(run.t / 60)}분 ${Math.floor(run.t % 60)}초 · ${run.kills.toLocaleString()}명 격파 · Lv.${run.level}</p><div class="result-combos">${kitCombos(kit).filter(c => run.combos.includes(c.id)).map(c => `<b>${comboIcon(c.id)}${c.name} ${rankMark(comboRank(run, c.id))}</b>`).join('')}</div>${mode === 'stage' ? `<p class="reward">금 <b>+${reward.gold.toLocaleString()}</b> · 보유 ${meta.gold.toLocaleString()}${reward.first ? ` · <strong><img class="won-emblem" src="${import.meta.env.BASE_URL}realm/raid/emblem-${run.stage}.png" alt="">${stageName(run.stage)} 휘장 획득</strong>` : ''}${reward.heroFirst && run.stage === SEAL_STAGE && TRUE_WAKE.has(heroId) ? ` · <strong class="tw-open">본편에서 ${josa(HERO.name, '이', '가')} 진각성할 수 있습니다</strong>` : ''}</p>` : ''}${mode === 'stage' ? '' : '<p>본편 병력 손실 없음</p>'}<div class="result-acts"><button id="new-run" class="primary">다시 출전</button><div>${mode === 'stage' ? '<button id="to-shop">상점</button>' : ''}<button id="quit">스테이지 고르기</button>${window.parent !== window ? '<button id="return">본편으로</button>' : ''}</div></div></div>`
    if (vanguardToken) {
      overlay.querySelector('h2')!.textContent = run.breaches === 3 ? '길은 열었다. 본대여, 진격하라!' : `${run.breaches}/3 돌파 확보 · 본대로 귀환`
      overlay.querySelector('.result-combos')!.textContent = isBreakthrough(run.breaches) ? breakthroughText(run.breaches) : ''
      for (const id of ['new-run', 'quit']) $(id).hidden = true
    }
    $('new-run').onclick = () => begin(); $('quit').onclick = menu
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
}
let rewarded: HaebiRun | null = null, reward = { gold: 0, first: false, heroFirst: false }
function withdraw() { run.state = 'lost'; run.offers = []; paused = false; shown = ''; showOverlay() }
function menu() { renderStageMenu(); hidePowerHint(); live = false; paused = false; shown = ''; resetInput(); run = newRun(7); loadoutKey = ''; $('menu').hidden = false; $('play').hidden = true; $('overlay').hidden = true; $<HTMLButtonElement>('pause').disabled = true; layoutTrial(); updateHud() }
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
    haptics().hurt((hitSeen.hp - run.hp) / run.maxHp)   // 맞으면 폰이 짧게 (11-19 형 · 잃은 몫만큼 15~40ms · 연타는 사이를 둠)
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
  setText('announcement', run.messageTime > 0 ? run.message : ''); setFlag('announcement', 'visible', run.messageTime > 0)
  if (countDue) setText('streak', run.comboKills >= 15 ? `${run.comboKills} 연속 격파` : '')
  // 각성 단추: 막대가 다 차면 뜬다 · 각성 동안 체력 막대가 금빛으로 흐른다 (무적)
  const ready = live && wakeReady(run); if ($('wake').hidden === ready) $('wake').hidden = !ready
  setFlag('combat-hud', 'awake', run.form === 'awake')
  for (const [id, cd, title] of [['dash', run.dashCd, '회피 Shift'], ['skill', run.skillCd, `${ultName(kit, run.form === 'awake')} Space`]] as const) {
    setText(id, cd > 0 ? `${title} · ${cd.toFixed(1)}초` : title); const off = cd > 0 || paused || !!run.offers.length || run.state !== 'playing'; setFlag(id, 'cool', off)   // disabled 대신 빛만 (재사용 중에도 누름을 받아 맡아 둔다)
  }
  watchUltOpen()
  // 칸·조합은 레벨이 오를 때만 바뀐다 — 판마다 JSON 을 만들지 않는다 (폰 프레임 11-17)
  const key = String(run.level)
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
function frame(now: number) {
  raf = 0; if (document.hidden) return
  perfTick(now)
  const dt = last ? Math.min(.1, (now - last) / 1000) : 0; last = now
  if (live && !paused && !inspecting && !rotationBlocked && run.state === 'playing' && !run.offers.length) {
    acc += dt
    while (acc >= 1 / 120) {
      let x = Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft')), y = Number(keys.has('s') || keys.has('arrowdown')) - Number(keys.has('w') || keys.has('arrowup'))
      const sd = stickDir()
      if (x || y) destination = null
      else if (sd) { x = sd.x; y = sd.y }
      else if (destination) { const dx = destination.x - run.x, dy = destination.y - run.y, len = Math.hypot(dx, dy); if (len < 5) destination = null; else { x = dx / len; y = dy / len } }
      const castBefore = run.cast, dashBefore = run.dashCd, wakesBefore = run.wakes
      // 맡아 둔 누름: 누른 지 STICK.queue 초 안이면 계속 넣는다 (재사용이 그 안에 풀리면 나간다) · 나가면 지운다
      stepHaebi(run, { x, y, dash: run.t - dashAt <= STICK.queue, skill: run.t - skillAt <= STICK.queue, wake: run.t - wakeAt <= STICK.queue }, 1 / 120)
      if (run.dashCd > dashBefore) dashAt = -9
      if (run.wakes > wakesBefore) wakeAt = -9
      // 시전이 새로 섰다 = 각성 또는 비기 (한 번에 하나 · 판이 줄 세운다)
      if (run.cast && run.cast !== castBefore) { showSkillCutin(run.cast.kind === 'wake', run.cast.tru); if (run.cast.kind === 'ult') skillAt = -9 }
      acc -= 1 / 120
      if (run.offers.length || run.state !== 'playing') { acc = 0; break }
    }
  }
  if (live) drawField(ctx, images, run, destination)
  if (!live || run.t >= cutinUntil) skipCutin()
  sound.frame(run, live, paused || inspecting || rotationBlocked)
  updatePortrait(); updateHud(); showOverlay(); schedule()
}
function schedule() { if (!raf && !document.hidden) raf = requestAnimationFrame(frame) }
updateHud(); schedule()
// 개발 검수 손잡이 — 헤드리스 시험(tools/raid-*-probe.ts)이 판 상태를 읽고 체력을 깎아 본다 · 배포 빌드엔 없음
if (import.meta.env.DEV) Object.assign(window, { __raid: () => run, __raidSound: sound, __raidCutin: (wake: boolean, tru = false) => showSkillCutin(wake, tru) })
if (import.meta.env.DEV && new URLSearchParams(location.search).has('review')) {
  import('./raid/haebi-review.ts').then(({ installReview }) => installReview(root, s => { notifyVanguardStart(); run = s; live = true; paused = !s.offers.length; shown = ''; loadoutKey = ''; resetInput(); $('menu').hidden = true; $('play').hidden = false; $<HTMLButtonElement>('pause').disabled = false; layoutTrial(); showOverlay(); updateHud(); schedule() }, mode, kit))
}
