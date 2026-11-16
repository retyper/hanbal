import { breakthroughText, isBreakthrough } from './realm/vanguard.ts'
import { HAEBI_RUN as C, HAEBI_STICK as STICK } from './tune/params.ts'
import { createHaebi, runDuration, stepHaebi, choose, reroll, POWERS, kitCombos, KITS, xpNeeded, phase, runGold, type Kit, type Power, type HaebiRun, type StageId } from './raid/haebi.ts'
import { loadMeta, saveMeta, buy, refund, record, shopCost, shopMax, stageOpen, stageName, SHOP, STAGE_ORDER, type ShopKey } from './raid/meta.ts'
import { drawField, imagePaths, setHeroArt, heroArtFiles } from './raid/haebi-view.ts'
import { powerIcon, installPowerHints } from './raid/power-ui.ts'
import { KIT_BY_SPRITE } from './raid/kit-table.ts'
import { hasSkillBody } from './realm/data/skill-body.ts'
import { josa } from './core/josa.ts'
import { raidSound } from './raid/sound.ts'
import { DEFAULT_HERO, SEAL_STAGE, loadRoster, type RosterHero } from './raid/link.ts'
import { TRUE_WAKE } from './realm/data/awaken2.ts'
import './raid/combat.css'

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
/** 전용 그림이 있는 조합 (public/realm/raid/<id>.png) — 나머지는 능력 아이콘을 빌린다 */
const COMBO_ART = new Set(['cyclone', 'inferno', 'torrent', 'volley', 'meteor', 'grove', 'boomerang', 'tempest', 'splitwave', 'shadowdance', 'venom', 'rite', 'soulstorm'])
setHeroArt(sprite, HERO.awake)
/** 판 밖 기록 (금·상점·휘장) — 독립 열전만 쓴다 */
const meta = loadMeta()
let stage: Exclude<StageId, 'trial'> = STAGE_ORDER.find(id => stageOpen(meta, id) && !meta.cleared[id]) ?? 'forest'
const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`
const newRun = (seed: number) => { const r = createHaebi(seed, mode, kit, mode === 'stage' ? { stage, bonus: meta.shop } : {}); if (r.message.endsWith('첫 조합을 향해')) { r.message = ''; r.messageTime = 0 }  /* 시작 군말 띠는 걷는다 (형 11-16) */ return r }
root.innerHTML = `<header><div><small>장수 열전 · 독립 모드</small><h1>${HERO.name} <em>${K.title}</em></h1></div><div class="head-actions"><button id="pause" disabled aria-label="일시정지">Ⅱ</button></div></header>
<div id="layout"><aside id="character"><div id="portrait-media"><img id="hero-portrait" src="${import.meta.env.BASE_URL}realm/bust-hd/${HERO.bust}.jpg" alt="${HERO.name} 원화"><video id="hero-video" muted loop playsinline preload="none" hidden aria-label="각성 ${HERO.name} 영상"></video></div><div class="portrait-title"><span>${HERO.home}</span><b id="rank-title">${HERO.name}</b><button id="portrait-toggle" hidden>원화로 보기</button></div><div id="reaction">${weapon} 하나로 시작하는 열전</div><div id="combo-badges"></div><i class="frame-knots"></i></aside>
<main><section id="menu"><span class="eyebrow">장수 열전</span><h2>${HERO.name}<em>${K.title}</em></h2><p>능력을 고르고 두 힘을 묶어, 15분 가까이 버틴 뒤 오는 두목을 쓰러뜨리세요.</p><div class="journey"><span><b>01</b> 붉은 고리를 피하고</span><span><b>02</b> 두 힘을 묶어</span><span><b>03</b> 두목을 잡습니다</span></div><button id="start" class="primary" disabled>그림을 불러오는 중…</button><p class="controls">이동 WASD·방향키·화면 누르기 · 회피 Shift · 비기 Space · 멈춤 Esc</p><p class="note">본편의 병력과 따로인 한 판입니다.</p></section>
<section id="play" hidden><div id="arena"><canvas id="field" width="${C.width}" height="${C.height}" aria-label="${HERO.name} 토벌 전장. 클릭 또는 드래그로 이동"></canvas><div id="combat-hud"><div class="health-line"><b>${HERO.name}</b><span id="health">180 / 180</span></div><div class="bar hp"><span class="hp-track"><i id="hp-fill"></i><em id="hp-chunk"></em></span></div><div id="loadout" aria-label="획득한 전투 능력"></div></div><div id="hud"><small id="phase"></small><b id="clock"></b></div><div id="score"><b id="kills"></b><small>격파</small><b id="level"></b></div><div class="bar xp"><i id="xp-fill"></i></div><div id="announcement" aria-live="polite"></div><div id="streak"></div><footer><span id="hint">자동 공격 · 화면을 끌면 그쪽으로 이동 · 능력 아이콘을 누르고 있으면 설명</span><button id="dash">회피 Shift</button><button id="skill" class="primary">${K.skill} Space</button></footer><div id="stick" hidden aria-hidden="true"><i></i></div><i class="frame-knots"></i></div></section></main></div><div id="power-tooltip" role="tooltip" hidden></div><div id="overlay" hidden></div>`
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T
root.insertAdjacentHTML('beforeend', `<div id="rotate-guide" hidden><div><span style="font-size:44px">↻</span><h2>폰을 가로로 돌려 주세요</h2><p>확대 ${josa(HERO.name, '과', '와')} 전장을 함께 보며 싸웁니다.<br>회전하는 동안 전투는 멈춰 있습니다.</p></div></div>`)
$('arena').insertAdjacentHTML('beforeend', `<div id="skill-cutin" hidden aria-hidden="true"><img alt=""><b>${K.skill}</b></div>`)
let cutinUntil = 0
function showSkillCutin() {
  const id = HERO.bust, body = hasSkillBody(id)
  const cut = $('skill-cutin'); cut.classList.toggle('full-body', body)
  cut.querySelector('img')!.src = import.meta.env.BASE_URL + 'realm/' + (body ? 'skill-body' : run.combos.length ? 'awaken-hd' : 'bust-hd') + '/' + id + '.jpg'
  cut.style.animationDuration = C.skillCutin + 's'; cut.hidden = false; cutinUntil = run.t + C.skillCutin
}
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
  menu.querySelector('p')!.textContent = '20분을 버티고 두목을 쓰러뜨리면 휘장과 많은 금을 받습니다. 쓰러져도 버틴 만큼 금을 받아 상점에서 영구 강화를 삽니다.'
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
const canvas = $<HTMLCanvasElement>('field'), ctx = canvas.getContext('2d')!
const images = new Map<string, HTMLImageElement>(), keys = new Set<string>()
let run = newRun(7), live = false, paused = false, shown = '', loadoutKey = '', acc = 0, last = 0, raf = 0, dash = false, skill = false
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
function updatePortrait() {
  const awake = run.combos.length > 0, animate = awake && HERO.video && !stillPortrait && !videoFailed
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
function resetInput() { keys.clear(); destination = null; stickEnd(); dash = false; skill = false; acc = 0 }
function begin(sameSeed = false) {
  if (!sameSeed && !vanguardToken) pendingSeed = crypto.getRandomValues(new Uint32Array(1))[0]!
  sound.unlock(); hidePowerHint(); notifyVanguardStart(); run = newRun(pendingSeed); live = true; paused = false; shown = ''; loadoutKey = ''; resetInput(); last = 0
  $('skill-cutin').hidden = true; cutinUntil = 0
  $('menu').hidden = true; $('play').hidden = false; $('overlay').hidden = true; $<HTMLButtonElement>('pause').disabled = false; schedule()
  $<HTMLButtonElement>('start').blur(); window.scrollTo(0, 0)
  layoutTrial()
}
$('start').onclick = () => begin()
function pause() { if (!live || run.state !== 'playing' || run.offers.length) return; paused = !paused; resetInput(); shown = ''; showOverlay(); schedule() }
$('pause').onclick = pause
$('dash').onclick = () => { if (!paused && !run.offers.length) dash = true; $('dash').blur() }
$('skill').onclick = () => { if (!paused && !run.offers.length) skill = true; $('skill').blur() }
window.addEventListener('keydown', e => {
  if (!live) return
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) || e.key === ' ' && e.target === document.body) e.preventDefault()
  if (e.key === 'Escape' && !e.repeat) { pause(); return }
  if (paused || inspecting || run.offers.length || run.state !== 'playing') return
  if (e.target instanceof HTMLButtonElement && (e.key === ' ' || e.key === 'Enter')) return
  keys.add(e.key.toLowerCase()); if (e.key === 'Shift' && !e.repeat) dash = true; if (e.key === ' ' && !e.repeat) skill = true
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
function stickShow() {
  if (!stick) { stickEl.hidden = true; return }
  const r = $('arena').getBoundingClientRect()
  stickEl.hidden = false; stickEl.style.left = `${stick.ox - r.left}px`; stickEl.style.top = `${stick.oy - r.top}px`
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
canvas.onpointerdown = e => {
  if (!live || paused || inspecting || run.offers.length || run.state !== 'playing') return
  (document.activeElement as HTMLElement)?.blur(); canvas.setPointerCapture(e.pointerId)
  if (e.pointerType === 'mouse') { point(e); return }
  if (stick) return
  destination = null; stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY }; stickShow()
}
canvas.onpointermove = e => { if (!canvas.hasPointerCapture(e.pointerId)) return; if (stick && e.pointerId === stick.id) stickMove(e); else if (e.pointerType === 'mouse') point(e) }
canvas.onpointerup = e => { if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId); if (stick && e.pointerId === stick.id) stickEnd() }
canvas.onpointercancel = e => { destination = null; if (stick && e.pointerId === stick.id) stickEnd() }
/** 조합 길 — 글 대신 그림 셈: [능력 그림 ×단계] + [능력 그림 ×단계] = [조합 그림] (형 11-16: 「텍스트로 하지 말고 아이콘3 + 아이콘3 = 아이콘」) · 이미 채운 단계는 밝게 */
function routeHint(k: Power) {
  const rows = kitCombos(kit).filter(c => k in c.needs).map(c => {
    const parts = Object.entries(c.needs).map(([key, n]) => { const done = run.ranks[key as Power] >= n; return `<span class="need${done ? ' ok' : ''}${key === k ? ' me' : ''}">${powerIcon(key as Power)}<b>${n}</b></span>` }).join('<i class="op">+</i>')
    const got = run.combos.includes(c.id)
    return `<span class="recipe" aria-label="${c.name}: ${Object.entries(c.needs).map(([key, n]) => `${POWERS[key as Power].name} ${n}`).join(' + ')}">${parts}<i class="op">=</i><span class="combo${got ? ' got' : ''}"><img src="${import.meta.env.BASE_URL}realm/raid/${c.id}.png" alt=""><small>${c.name}</small></span></span>`
  })
  return rows.join('') || '모든 공격에 함께 효과'
}
function showOverlay() {
  const state = !live ? '' : run.state !== 'playing' ? run.state : run.offers.length ? 'upgrade:' + run.offers.join(',') : paused ? 'pause' : ''
  if (!state) { shown = ''; $('overlay').hidden = true; return }
  if (state === shown) return
  hidePowerHint()
  shown = state; const overlay = $('overlay'); overlay.hidden = !state; if (!state) return
  resetInput()
  if (state.startsWith('upgrade')) {
    overlay.innerHTML = `<div class="panel upgrade"><h2 class="lvup">레벨 업!</h2><div class="choices">${run.offers.map(k => { const p = POWERS[k]; return `<button data-up="${k}" style="--accent:${p.color}"><span class="rune">${powerIcon(k)}</span><small>${run.ranks[k] ? '강화' : '새 능력'} · ${run.ranks[k] + 1}/${p.max}</small><b>${p.name}</b><span>${p.desc}</span><em>${routeHint(k)}</em></button>` }).join('')}</div><button id="reroll" ${run.rerolls ? '' : 'disabled'}>다른 선택지 · ${run.rerolls}회 남음</button></div>`
    overlay.querySelectorAll<HTMLButtonElement>('[data-up]').forEach(b => b.onclick = () => { if (choose(run, b.dataset.up as Power)) { shown = ''; showOverlay(); updateHud() } })
    if (run.level === 1) { $<HTMLButtonElement>('reroll').disabled = true; $('reroll').textContent = '첫 공격 능력을 골라 주세요' }
    $('reroll').onclick = () => { if (reroll(run)) { shown = ''; showOverlay() } }
  } else if (state === 'pause') {
    overlay.innerHTML = '<div class="panel"><small>장수 열전</small><h2>잠시 숨 고르기</h2><p>성장과 전투는 그대로 기다립니다.</p><button id="resume" class="primary">계속 싸우기</button><button id="quit">출전 화면으로</button></div>'
    $('resume').onclick = () => { paused = false; shown = ''; last = 0; showOverlay() }; $('quit').onclick = menu
    if (vanguardToken) { $('quit').textContent = '지금 확보한 돌파로 귀환'; $('quit').onclick = withdraw }
    else if (mode === 'stage') { $('quit').textContent = '물러나기 · 버틴 만큼 금 받기'; $('quit').onclick = withdraw }
  } else {
    // 독립 열전: 판이 끝나면 한 번만 금을 주고 기록한다 (지면 버틴 만큼 · 깨면 휘장 + 깸 금)
    if (mode === 'stage' && rewarded !== run) { rewarded = run; const gold = runGold(run); reward = { gold, ...record(meta, run.stage, gold, run.state === 'won', run.t, heroId) }; saveMeta(meta) }
    overlay.innerHTML = `<div class="panel result ${run.state}"><h2>${run.state === 'won' ? mode === 'stage' ? `${stageName(run.stage)} 토벌 완료` : '열전 완수' : run.hp <= 0 ? '도전 실패' : run.t < runDuration(run) ? '철수' : '시간 초과 · 두목 생존'}</h2><p>${Math.floor(run.t / 60)}분 ${Math.floor(run.t % 60)}초 · ${run.kills.toLocaleString()}명 격파 · Lv.${run.level}</p><div class="result-combos">${kitCombos(kit).filter(c => run.combos.includes(c.id)).map(c => `<b>${COMBO_ART.has(c.id) ? `<img src="${import.meta.env.BASE_URL}realm/raid/${c.id}.png" alt="">` : ''}${c.name}</b>`).join('')}</div>${mode === 'stage' ? `<p class="reward">금 <b>+${reward.gold.toLocaleString()}</b> · 보유 ${meta.gold.toLocaleString()}${reward.first ? ` · <strong><img class="won-emblem" src="${import.meta.env.BASE_URL}realm/raid/emblem-${run.stage}.png" alt="">${stageName(run.stage)} 휘장 획득</strong>` : ''}${reward.heroFirst && run.stage === SEAL_STAGE && TRUE_WAKE.has(heroId) ? ` · <strong class="tw-open">본편에서 ${josa(HERO.name, '이', '가')} 진각성할 수 있습니다</strong>` : ''}</p>` : ''}${mode === 'stage' ? '' : '<p>본편 병력 손실 없음</p>'}<div class="result-acts"><button id="new-run" class="primary">다시 출전</button><div>${mode === 'stage' ? '<button id="to-shop">상점</button>' : ''}<button id="quit">스테이지 고르기</button>${window.parent !== window ? '<button id="return">본편으로</button>' : ''}</div></div></div>`
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
function setWidth(id: string, pct: number) { const v = pct.toFixed(1); if (hudLast.get(id + '.w') === v) return; hudLast.set(id + '.w', v); $(id).style.width = v + '%' }
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
function updateHud() {
  const hpPct = Math.max(0, run.hp / run.maxHp * 100)
  setText('health', `${Math.ceil(run.hp)} / ${run.maxHp}`); setWidth('hp-fill', hpPct); updateChunk(hpPct)
  setText('phase', phase(run));
  if (mode === 'vanguard') setText('hint', `전위대장 ${run.breaches}/3 돌파 · 일시정지에서 성과를 갖고 귀환 가능`);  const remaining = Math.max(0, Math.ceil(runDuration(run) - run.t)); setText('clock', `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`)
  setText('kills', run.kills.toLocaleString()); setText('level', `Lv.${run.level}`)
  setWidth('xp-fill', run.level >= C.maxLevel ? 100 : Math.min(100, run.xp / xpNeeded(run) * 100))
  setText('rank-title', run.combos.length ? `각성 · ${HERO.name}` : HERO.name)
  setText('reaction', !live ? mode === 'vanguard' ? '내가 길을 열겠다. 뒤따라와!' : `${weapon} 하나로 시작하는 열전` : run.hurt > 0 ? '버텨낼 수 있어!' : run.attack > 0 ? '길을 열어라!' : run.combos.length ? '이제, 몰아칠 차례다.' : run.moving ? '내 뒤를 따라와.' : '빈틈을 기다리는 중')
  setFlag('character', 'awakened', run.combos.length > 0); setFlag('character', 'hurt', run.hurt > 0)
  setFlag('layout', 'in-run', live)   // 싸우는 동안 초상 옆 글(고을·이름·한마디)은 걷는다 (형 11-16: 「백제의 장수 · 길을 열어라 같은 텍스트 다 없애」)
  setText('announcement', run.messageTime > 0 ? run.message : ''); setFlag('announcement', 'visible', run.messageTime > 0)
  setText('streak', run.comboKills >= 15 ? `${run.comboKills} 연속 격파` : '')
  for (const [id, cd, title] of [['dash', run.dashCd, '회피 Shift'], ['skill', run.skillCd, `${K.skill} Space`]] as const) {
    setText(id, cd > 0 ? `${title} · ${cd.toFixed(1)}초` : title); const off = cd > 0 || paused || !!run.offers.length || run.state !== 'playing'; if (hudLast.get(id + '.off') !== String(off)) { hudLast.set(id + '.off', String(off)); $<HTMLButtonElement>(id).disabled = off }
  }
  const key = JSON.stringify(run.ranks) + run.combos.join(',')
  if (key !== loadoutKey) {
    loadoutKey = key
    hidePowerHint()
    $('loadout').innerHTML = (Object.keys(POWERS) as Power[]).filter(k => run.ranks[k]).map(k => `<button class="power-slot" data-power="${k}" aria-label="${POWERS[k].name} ${run.ranks[k]}단계 / 최대 ${POWERS[k].max}단계" style="--accent:${POWERS[k].color}">${powerIcon(k)}<b>${run.ranks[k]}</b></button>`).join('')
    $('combo-badges').innerHTML = kitCombos(kit).filter(c => run.combos.includes(c.id)).map(c => `<span>${COMBO_ART.has(c.id) ? `<img src="${import.meta.env.BASE_URL}realm/raid/${c.id}.png" alt="">` : powerIcon(Object.keys(c.needs)[0] as Power)}<b>${c.name}</b></span>`).join('')
  }
}
function frame(now: number) {
  raf = 0; if (document.hidden) return
  const dt = last ? Math.min(.1, (now - last) / 1000) : 0; last = now
  if (live && !paused && !inspecting && !rotationBlocked && run.state === 'playing' && !run.offers.length) {
    acc += dt
    while (acc >= 1 / 120) {
      let x = Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft')), y = Number(keys.has('s') || keys.has('arrowdown')) - Number(keys.has('w') || keys.has('arrowup'))
      const sd = stickDir()
      if (x || y) destination = null
      else if (sd) { x = sd.x; y = sd.y }
      else if (destination) { const dx = destination.x - run.x, dy = destination.y - run.y, len = Math.hypot(dx, dy); if (len < 5) destination = null; else { x = dx / len; y = dy / len } }
      const skillBefore = run.skillCd
      stepHaebi(run, { x, y, dash, skill }, 1 / 120)
      if (run.skillCd > skillBefore) showSkillCutin()
      dash = false; skill = false; acc -= 1 / 120
      if (run.offers.length || run.state !== 'playing') { acc = 0; break }
    }
  }
  if (live) drawField(ctx, images, run, destination)
  if (!live || run.t >= cutinUntil) $('skill-cutin').hidden = true
  sound.frame(run, live, paused || inspecting || rotationBlocked)
  updatePortrait(); updateHud(); showOverlay(); schedule()
}
function schedule() { if (!raf && !document.hidden) raf = requestAnimationFrame(frame) }
updateHud(); schedule()
// 개발 검수 손잡이 — 헤드리스 시험(tools/raid-*-probe.ts)이 판 상태를 읽고 체력을 깎아 본다 · 배포 빌드엔 없음
if (import.meta.env.DEV) (window as unknown as { __raid: () => typeof run }).__raid = () => run
if (import.meta.env.DEV && new URLSearchParams(location.search).has('review')) {
  import('./raid/haebi-review.ts').then(({ installReview }) => installReview(root, s => { notifyVanguardStart(); run = s; live = true; paused = !s.offers.length; shown = ''; loadoutKey = ''; resetInput(); $('menu').hidden = true; $('play').hidden = false; $<HTMLButtonElement>('pause').disabled = false; layoutTrial(); showOverlay(); updateHud(); schedule() }, mode, kit))
}
