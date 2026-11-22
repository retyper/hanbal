/**
 * 겨루기 · 각성 시련 프레임 재기 (11-19 형 ③: 「각성 시련·겨루기(엘든링식) 프레임 최적화 · 열전 기법 옮기기」).
 *
 *   node --experimental-strip-types tools/duel-fps-probe.ts [duel|trial|giant] [390x844] [THROTTLE 4] [FRAMES 900] [ROOT http://127.0.0.1:5195]
 *
 * 헤드리스 크롬을 폰 크기(DPR 3)로 띄우고 CPU 를 THROTTLE 배 느리게 한 채 판 시계를 「한 틀 = 1/60초」로 묶어 돌린다 (lockstep):
 * 진짜 rAF 가 한 번 돌 때마다 페이지의 rAF·performance.now 를 정확히 1/60초씩 민다 → 고치기 전과 뒤가 똑같은 틀을 그린다 (재는 값만 다르다).
 *  - duel: 개발 손잡이 __duel·__duelTap 으로 고리가 닿는 틱에 맞춰 누른다 — 정확(치명·흰 베기·번쩍) · 막음(챙) · 일부러 못 막음(붉은 베기·흔들림) ·
 *          체간이 차면 연타(베기·숫자) · 적장 무예 7 이라 이어치기 고리 둘도 뜬다.
 *  - trial: raid.html 을 본편처럼 틀(iframe ?trial=) 안에 연다 → 검수 재생으로 판을 연 뒤 시련 판(활 묶음 · 화살비·유성)을 UNTIL 초까지 돌려 끼운다
 *          (11-18 형 플립7: 「3:35 폭풍의 진격」·「4:46 힘의 결합 늑대 떼」) → 키보드로 원을 그리며 걷고 비기·투지를 쓴다 (체력은 반 아래로 안 떨어지게).
 *          폰 세로는 판이 「가로로 돌려 주세요」로 멈춘 채 그려진다 (게임이 그렇게 한다).
 *  - giant: 지금 본편의 각성 길(목책 돌파를 깨면 각성 · 11-21) — 독립 열전 STAGE=palisade 의 거대 두목(불가사리)이 막 나온 판.
 *  - raid: 독립 열전 처음 판(STAGE=forest) — 첫 레벨업 카드 창(60틀) · 첫 비기 컷인 띠(170틀) · 둘째 카드(400) · 둘째 비기(520) (11-22 · 폰 가로 844x390 으로).
 *          사건마다 그 틀부터 25틀의 가장 긴 틀 간격·16.7ms 넘은 수를 적는다 · RAID_DELAY=틀 로 사건을 늦춘다 · 찍을 땐 CSS 애니를 그 틀 자리에 세운다.
 *  - crowd: 독립 열전(STAGE=forest) 몰려오는 판(UNTIL 초까지 봇이 돌린 판)에서 넓게 네모로 걷는다 — MAP=off 한 장짜리 옛 판 · 기본 59-WIDE 넓은 맵 (넓은 맵 프레임 견주기 · 11-22)
 *          CHEST=1|3|5|8: 240틀에 그 단계의 보물 상자가 터진다 (60-JACKPOT 연출 · chest 연출이 열리는 틀 · burst 뚜껑이 터지는 틀 · rune 첫 룬이 솟는 틀 · close 걷히는 틀) — 연출이 도는 동안 다른 사건은 쉰다.
 *  - TRACE=1: 렌더러 주 스레드·GPU 의 긴 일(LONG=ms 넘는)을 몇 번째 틀인지와 함께 이름별로 나눈다 (스타일·배치·글자 모양·그림 풀기·칠하기)
 *  - PRE=파일.js: 재기 전에 판 창에서 한 번 돌린다 (가설 견주기)
 *
 * 적는 것 (한 줄 JSON + 표):
 *  - 틀 간격(진짜 rAF) p50·p95·최대 · 16.7ms 넘은 틀 수 · 틀마다 페이지 스크립트 시간(우리 rAF 콜백) p50·p95·최대 · 무거운 틀만 따로
 *  - COUNT=1: 캔버스 셈 (보이는 판: drawImage 수 · 칠한 넓이를 화면 장수로 · fill/stroke · 글자 · save · 그라디언트 · 새 캔버스 / 굽는 판은 따로) — 폰 GPU 가 칠하는 양을 가늠
 *  - PROFILE=1: CDP Profiler — 자기 시간 순 함수 · 안까지 더한 몫
 *  - SHOTS=폴더 TAG=이름: 정해 둔 틀(사건 뒤 몇 틀)에서 멈춰 찍는다 · CMP=견줄 태그 면 같은 틀끼리 화소 차를 적는다
 *  - WATCH=1: 겨루기의 「느리면 DPR 내리기」를 켠 채 (기본은 꺼서 DPR 을 고정 — 전후를 같은 해상도로 견준다)
 *  - DPR=3 · QUERY='me=…&foe=…' (겨루기 주소) · UNTIL=286 · KIT=bow (시련)
 * 런타임 의존성 없음 · 임시 크롬 프로필은 끝나면 지운다 · 5195 같은 제 서버로 (형이 쓰는 5173·5174 는 건드리지 않는다).
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const SCENE = process.argv[2] === 'trial' ? 'trial' : process.argv[2] === 'giant' ? 'giant' : process.argv[2] === 'raid' ? 'raid' : process.argv[2] === 'crowd' ? 'crowd' : 'duel'
const [VW, VH] = (process.argv[3] ?? '390x844').split('x').map(Number) as [number, number]
const THROTTLE = Number(process.argv[4] ?? 4)
const FRAMES = Number(process.argv[5] ?? 900)
const ROOT = process.argv[6] ?? 'http://127.0.0.1:5195'
const env = (k: string): string => process.env[k] ?? ''
const DPR = Number(env('DPR') || 3)
const COUNT = env('COUNT') === '1', PROFILE = env('PROFILE') === '1', WATCH = env('WATCH') === '1'
const SHOTS = env('SHOTS'), TAG = env('TAG') || 'now', CMP = env('CMP')
const QUERY = env('QUERY') || 'me=aryeong&foe=haebi&muMe=5&muFoe=7&tier=2&seed=1'
const UNTIL = Number(env('UNTIL') || (SCENE === 'crowd' ? 480 : 286)), KIT = env('KIT') || 'bow', STAGE = env('STAGE') || (SCENE === 'raid' || SCENE === 'crowd' ? 'forest' : 'palisade')
/** 열전 장면에서 터뜨릴 보물 상자 단계 (0 = 없음) */
const CHEST = [1, 3, 5, 8].includes(Number(env('CHEST'))) ? Number(env('CHEST')) : 0
const CHROMES = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe']
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
const exe = CHROMES.find((p) => existsSync(p))
if (exe === undefined) throw new Error('크롬을 못 찾았다')

/**
 * 묶은 시계 — 모든 창(틀 안 창도)에 문서보다 먼저 심는다. 켜기 전엔 원래대로 돈다.
 * 켜면 진짜 rAF 한 번에 판 시계를 정확히 1/60초 밀고, 페이지가 건 rAF 콜백을 그 시각으로 부른다 · 그 시간(콜백 합)과 진짜 틀 간격을 적는다.
 * before(n): 틀마다 콜백 앞에서 부르는 손 (누르기·찍기 예약) · hold: 찍는 동안 멈춤 (시각도 멈춘다)
 */
const LOCK = `(() => {
  // 틀(iframe)은 처음 빈 문서의 창을 새 문서가 물려받는다 — 원래 함수는 한 번만 쥐고, 시계 고리는 문서마다 새로 건다
  if (window.__lock && window.__lock.doc === document) return
  const O = window.__lockOrig ??= { now: performance.now.bind(performance), raf: window.requestAnimationFrame.bind(window), caf: window.cancelAnimationFrame.bind(window) }
  const realNow = O.now, raf0 = O.raf, caf0 = O.caf
  const L = window.__lock = { doc: document, on: false, t: 100000, q: new Map(), id: 1e7, n: 0, rec: [], hold: false, step: 1000 / 60, before: null, tag: null, stop: false, holdAt: -1 }
  window.__realNow = realNow
  performance.now = () => L.on ? L.t : realNow()
  window.requestAnimationFrame = (cb) => { if (!L.on) return raf0(cb); const id = ++L.id; L.q.set(id, cb); return id }
  window.cancelAnimationFrame = (id) => { if (!L.q.delete(id)) caf0(id) }
  let prev = 0
  const tick = (ts) => {
    const gap = prev ? ts - prev : 0
    prev = ts
    if (L.on && !L.hold && !L.stop) {
      L.t += L.step
      const n = L.n++; if (L.stamp) console.timeStamp("f" + n)
      try { L.before?.(n) } catch (e) { L.err = String(e && e.stack || e) }
      const cbs = [...L.q.values()]; L.q.clear()
      const a = realNow(); for (const f of cbs) f(L.t); const b = realNow()
      let tag = 0; try { tag = L.tag?.(n) ?? 0 } catch { tag = -1 }
      L.rec.push([gap, b - a, tag])
      if (L.holdAt === n) L.hold = true
      // 찍을 틀 — [이름, 사건, 몇 틀 뒤] 가 이 틀이면 멈춘다 (찍는 쪽이 shotNow 를 비우고 푼다)
      if (L.shots?.length && L.marksOf) {
        const marks = L.marksOf(), now = [], keep = []
        for (const s of L.shots) { const m = marks[s[1]]; if (m === undefined || m < 0) { keep.push(s); continue } const at = m + s[2]; if (at === n) now.push(s[0]); else if (at < n) (L.passed ??= []).push(s[0]); else keep.push(s) }
        L.shots = keep
        if (now.length) { L.shotNow = now; L.hold = true }
      }
    }
    raf0(tick)
  }
  raf0(tick)
})()`

/** 캔버스 셈 — 보이는 판(문서에 붙은 캔버스)과 굽는 판(떨어진 캔버스)을 따로 · 틀마다 끊는다 */
const COUNTER = `(() => {
  const C = window.__cnt = { cur: null, frames: [], reset() { this.cur = { vis: {}, off: {}, visPx: 0, offPx: 0 } } }
  C.reset()
  const P = CanvasRenderingContext2D.prototype
  const bump = (ctx, k, px, who) => { const vis = ctx.canvas.isConnected, s = vis ? C.cur.vis : C.cur.off; s[k] = (s[k] ?? 0) + 1; if (vis && who) { const n = C.cur.n ??= {}; n[who] = (n[who] ?? 0) + 1 } if (px) { if (vis) { C.cur.visPx += px; if (who) { const b = C.cur.by ??= {}; b[who] = (b[who] ?? 0) + px } } else C.cur.offPx += px } }
  const area = (ctx, w, h) => { const t = ctx.getTransform(); return Math.abs(w * h * (t.a * t.d - t.b * t.c)) }
  // 칠한 넓이를 누가 먹나 — 그림 이름(또는 구운 판 크기) · 섞기가 lighter 면 + · 겹친 투명도가 1 아래면 ~
  const who = (ctx, img) => (img instanceof HTMLImageElement ? (img.src.split('/').pop() || '?').split('?')[0] : img instanceof HTMLVideoElement ? 'video' : 'cv' + img.width + 'x' + img.height) + (ctx.globalCompositeOperation === 'lighter' ? '+' : '') + (ctx.globalAlpha < 1 ? '~' : '')
  const di = P.drawImage
  P.drawImage = function (img, ...a) { const w = a.length >= 8 ? a[6] : a.length >= 4 ? a[2] : (img.videoWidth || img.naturalWidth || img.width), h = a.length >= 8 ? a[7] : a.length >= 4 ? a[3] : (img.videoHeight || img.naturalHeight || img.height); bump(this, 'drawImage', area(this, w, h), this.canvas.isConnected ? who(this, img) : ''); return di.call(this, img, ...a) }
  for (const m of ['fillRect', 'clearRect', 'strokeRect']) { const o = P[m]; P[m] = function (x, y, w, h) { bump(this, m, m === 'strokeRect' ? 0 : area(this, w, h), m + (this.globalCompositeOperation === 'lighter' ? '+' : '')); return o.call(this, x, y, w, h) } }
  for (const m of ['fill', 'stroke', 'clip', 'fillText', 'strokeText', 'measureText', 'save', 'getImageData', 'createLinearGradient', 'createRadialGradient', 'createPattern']) { const o = P[m]; P[m] = function (...a) { bump(this, m, 0); return o.apply(this, a) } }
  const ce = Document.prototype.createElement
  Document.prototype.createElement = function (t, ...a) { if (String(t).toLowerCase() === 'canvas') { C.cur.off.newCanvas = (C.cur.off.newCanvas ?? 0) + 1 } return ce.call(this, t, ...a) }
})()`

/** 겨루기 손 — 고리 번호로 정확·정확·막음·정확·못 막음·막음 (붉은 큰 공격은 늘 정확) · 연타는 6틱마다 자리를 바꿔 */
const DUEL_SCENE = `(() => {
  const L = window.__lock, PLAN = ['perfect', 'perfect', 'good', 'perfect', 'miss', 'good']
  const S = window.__scene = { ev: 0, marks: {}, lastRush: -99, tapped: new Set(), over: -1, duelAt: -1 }
  L.marksOf = () => ({ ...S.marks, duel: S.duelAt, over: S.over })
  L.before = (n) => {
    const mode = window.__duelMode?.()
    if (n === 12 && mode === 'field') document.querySelector('.dflag')?.click()
    if (mode === 'intro') document.querySelector('.dskip')?.click()
    if (mode === 'end' && S.over < 0) S.over = n
    if (mode !== 'duel') return
    if (S.duelAt < 0) { S.duelAt = n; S.warmAtDuel = window.__duelWarm?.() }
    const d = window.__duel()
    for (; S.ev < d.events.length; S.ev++) { const k = d.events[S.ev].kind; if (!(k in S.marks)) S.marks[k] = n }
    if (d.over !== null) { if (S.over < 0) S.over = n; return }
    if (d.phase === 'rush') { if (d.t - S.lastRush >= 6) { S.lastRush = d.t; const i = (d.t / 6) | 0; window.__duelTap(0.3 + 0.4 * ((i * 37) % 10) / 10, 0.25 + 0.5 * ((i * 61) % 10) / 10) } return }
    for (const c of d.cues) {
      if (c.done !== null || d.t < c.t0 || S.tapped.has(c.id)) continue
      const plan = c.heavy ? 'perfect' : PLAN[c.id % PLAN.length]
      if (plan === 'miss') continue
      if (d.t >= (plan === 'perfect' ? c.hitAt - 1 : c.hitAt - 7)) { S.tapped.add(c.id); window.__duelTap(c.x, c.y) }
    }
  }
  // 틀 꼬리표: 0 = 겨루기 밖 · 1 = 겨루기 · 2 = 무거운 틀 (치명·맞음·연타 뒤 30틀 안 · 연타 중)
  let heavyUntil = -1, seen = 0
  L.tag = (n) => {
    if (window.__duelMode?.() !== 'duel') return 0
    const d = window.__duel()
    for (; seen < d.events.length; seen++) { const k = d.events[seen].kind; if (k === 'crit' || k === 'miss' || k === 'rushHit' || k === 'break' || k === 'good' || k === 'perfect') heavyUntil = n + 30 }
    return d.phase === 'rush' || n <= heavyUntil ? 2 : 1
  }
})()`
/** 겨루기 찍을 때 — 처음 난 사건 뒤 몇 틀 (전후가 같은 틀) */
const DUEL_SHOTS: ReadonlyArray<readonly [string, string, number]> = [
  ['intro-a', 'duel', 22], ['intro-b', 'duel', 45], ['calm', 'duel', 150], ['crit-a', 'crit', 2], ['crit-b', 'crit', 14], ['good', 'good', 5], ['miss', 'miss', 3],
  ['rush', 'break', 40], ['rushhit', 'rushHit', 4], ['end-a', 'over', 8], ['end-b', 'over', 40],
]

/** 시련 판 짓기 — 활 묶음 · 화살비·유성 먼저 · 돌리는 동안 죽지 않게 (tools/raid-fps-probe.ts SCENE=trial 과 같은 판) */
const TRIAL_BUILD = `(async () => {
  const H = await import('/src/raid/haebi.ts'), R = await import('/src/raid/haebi-replay.ts')
  const s = H.createHaebi(7, 'trial', '${KIT}'), want = { rain: 3, reach: 2, bow: 5, tempo: 3, echo: 2 }, pick = () => s.offers.find(p => p === 'volley' || p === 'meteor') ?? Object.keys(want).find(p => s.offers.includes(p) && s.ranks[p] < want[p]) ?? s.offers[0]
  for (let n = 0; s.t < ${UNTIL} && s.state === 'playing'; n++) {
    if (s.offers.length) H.choose(s, pick()); else { H.stepHaebi(s, R.botInput(s), 1 / 120); s.hp = s.maxHp }
    if (n % 2400 === 0) await new Promise(r => setTimeout(r, 0))
  }
  Object.assign(window.__raid(), s)
  return { t: Math.round(s.t), kills: s.kills, level: s.level, mode: s.mode, enemies: s.enemies.length, combos: s.combos.join(',') }
})()`
/**
 * giant: 거대 두목 판 — 지금 본편의 각성 길(11-21 형 「목책 깨면 각성」 · 시련 모드는 본편에서 닫혔다): 목책 돌파 불가사리 (STAGE 로 다른 거대 두목).
 * 두목이 오기 3초 앞으로 건너뛰어 판을 지은 뒤 봇이 8초 싸운다 (체력은 채움) → 열린 판에 끼운다. 판은 독립 열전(raid.html?review&stage=) 그대로.
 */
const GIANT_BUILD = `(async () => {
  const H = await import('/src/raid/haebi.ts'), R = await import('/src/raid/haebi-replay.ts')
  const stage = '${STAGE}', s = H.createHaebi(7, 'stage', '${KIT}', { stage, simRules: H.raidRulesForStage(stage) })
  s.t = H.bossTime(s) - 3
  for (let n = 0; n < 120 * 8 && s.state === 'playing'; n++) { if (s.offers.length) H.choose(s, s.offers[0]); else { H.stepHaebi(s, R.botInput(s), 1 / 120); s.hp = s.maxHp } }
  Object.assign(window.__raid(), s)
  return { t: Math.round(s.t), giant: s.enemies.filter(e => e.giant).map(e => e.giant.kind).join(','), enemies: s.enemies.length, stage: s.stage }
})()`
/** 시련 손 — 20틀마다 여덟 방향을 돌며 걷고 · 레벨업이면 첫 카드 · 240틀마다 비기 · 투지가 차면 쓴다 · 체력은 반 아래로 안 떨어지게 */
const TRIAL_SCENE = `(() => {
  const L = window.__lock, DIRS = [['d'], ['d', 's'], ['s'], ['s', 'a'], ['a'], ['a', 'w'], ['w'], ['w', 'd']]
  const S = window.__scene = { held: [], marks: {}, cast: 0 }
  L.marksOf = () => ({ ...S.marks, start: 0 })
  const key = (type, k) => window.dispatchEvent(new KeyboardEvent(type, { key: k, bubbles: true }))
  L.before = (n) => {
    const r = window.__raid?.()
    if (!r || r.state !== 'playing') return
    r.hp = r.maxHp
    if (r.offers.length) { document.querySelector('#overlay .choices button')?.click(); if (!('offer' in S.marks)) S.marks.offer = n; return }
    const want = DIRS[Math.floor(n / 20) % DIRS.length]
    for (const k of S.held) if (!want.includes(k)) key('keyup', k)
    for (const k of want) if (!S.held.includes(k)) key('keydown', k)
    S.held = want
    if (n % 240 === 120) { key('keydown', ' '); key('keyup', ' '); if (!('skill' in S.marks)) S.marks.skill = n }
    if (n % 300 === 200) { key('keydown', 'e'); key('keyup', 'e') }
    if (r.cast && r.cast !== S.cast) { S.cast = r.cast; if (!('cast' in S.marks)) S.marks.cast = n }
  }
  L.tag = () => { const r = window.__raid?.(); return r ? r.enemies.length : 0 }
})()`
const TRIAL_SHOTS: ReadonlyArray<readonly [string, string, number]> = [['start', 'start', 30], ['crowd', 'start', 110], ['skill', 'skill', 20]]
/**
 * raid: 독립 열전(STAGE=forest) 처음 판 — 첫 레벨업 카드 창 · 첫 비기 컷인 띠가 뜨는 틀 (11-22 · 폰에서 90~130ms · 70~100ms 끊김).
 * 판은 레벨 1 · 아직 카드가 한 번도 안 뜬 채로 짓는다 (검수 재생은 판 셈만 · 카드 창은 이 판에서 처음 뜬다).
 */
const RAID_BUILD = `(async () => {
  const H = await import('/src/raid/haebi.ts'), R = await import('/src/raid/haebi-replay.ts')
  const stage = '${STAGE}', s = H.createHaebi(7, 'stage', '${KIT}', { stage, simRules: H.raidRulesForStage(stage)${CHEST ? ', chestRules: H.CHEST_RULES' : ''} })
  for (let n = 0; n < 120 * 8 && s.state === 'playing' && !s.offers.length && s.xp < H.xpNeeded(s) * .6; n++) { H.stepHaebi(s, R.botInput(s), 1 / 120); s.hp = s.maxHp }
  Object.assign(window.__raid(), s); window.__probeH = H
  // 검수 재생은 고를 카드가 없으면 멈춤 창으로 연다 — 계속 싸우기
  document.getElementById('resume')?.click()
  return { t: Math.round(s.t), level: s.level, xp: Math.round(s.xp), need: H.xpNeeded(s), offers: s.offers.length, enemies: s.enemies.length, overlay: !!document.querySelector('#overlay .choices') }
})()`
/** 열전 손 — 걷기 · 60틀: 경험치를 채워 첫 레벨업 카드 · 40틀 뒤 첫 카드 · 170틀: 첫 비기 · 400틀: 둘째 카드 · 520틀: 둘째 비기 (재사용을 비워) */
const RAID_SCENE = `(() => {
  const L = window.__lock, DIRS = [['d'], ['d', 's'], ['s'], ['s', 'a'], ['a'], ['a', 'w'], ['w'], ['w', 'd']]
  const S = window.__scene = { held: [], marks: {}, offerSeen: 0, offerAt: -1 }
  L.marksOf = () => ({ ...S.marks })
  const key = (type, k) => window.dispatchEvent(new KeyboardEvent(type, { key: k, bubbles: true }))
  L.before = (n) => {
    const r = window.__raid?.(), H = window.__probeH
    if (!r || r.state !== 'playing') return
    r.hp = r.maxHp
    const d = ${Number(env('RAID_DELAY') || 0)}   // RAID_DELAY=틀: 사건을 그만큼 늦춘다 (미리 그린 것이 오래 지나도 남아 있나)
    // CHEST=단계: 240틀에 그 단계의 상자가 「이미 터진 채」 판에 들어온다 → 화면이 그것을 보고 연출을 연다 (진짜 화면 길 · 판의 셈은 그대로)
    const chest = ${CHEST}, show = window.__chestShow
    if (chest && n === 240 + d && r.jackpots && !r.offers.length) {
      const picks = ['cyclone', 'cyclone', 'hone', 'reach', 'capA', 'echo', 'drill', 'thunder'].slice(0, chest)
      for (const p of picks) { if (p in r.ranks) r.ranks[p]++; else { if (!r.combos.includes(p)) r.combos.push(p); r.comboRanks[p] = (r.comboRanks[p] ?? 0) + 1 } }
      r.jackpots.ranks += picks.length
      r.chests.push({ id: 9001, eliteId: 0, x: r.x, y: r.y, bornAt: r.t, pickedAt: r.t, state: 'claimed', choicesRemaining: 0, gold: 0, large: true, jackpot: { count: chest, picks, opened: chest >= 3 ? ['cyclone'] : [], bonus: 0 } })
      S.marks.chest = n
    }
    if (chest && show) {
      if (show.active && S.marks.burst === undefined && document.querySelector('#chest-show.open')) S.marks.burst = n - 1
      if (show.active && S.marks.rune === undefined && document.querySelector('#chest-show .cs-runes .cs-r')) S.marks.rune = n - 1
      if (!show.active && S.marks.chest !== undefined && S.marks.close === undefined && n > S.marks.chest + 2) S.marks.close = n - 1
      // 연출이 도는 동안 아무 키도 누르지 않는다 (아무 키나 누르면 건너뛴다)
      if (show.active) { for (const k of S.held) key('keyup', k); S.held = []; return }
    }
    if (n === 60 + d || n === 400 + d) r.xp = Math.max(r.xp, H.xpNeeded(r))
    if (r.offers.length) {
      if (S.offerAt < 0) { S.offerAt = n; S.offerSeen++; S.marks['offer' + S.offerSeen] = n - 1 }
      if (n >= S.offerAt + 40) { document.querySelector('#overlay .choices button')?.click(); S.offerAt = -1 }
      return
    }
    const want = DIRS[Math.floor(n / 20) % DIRS.length]
    for (const k of S.held) if (!want.includes(k)) key('keyup', k)
    for (const k of want) if (!S.held.includes(k)) key('keydown', k)
    S.held = want
    if (n === 170 + d || n === 520 + d) { if (n === 520 + d) r.skillCd = 0; key('keydown', ' '); key('keyup', ' '); S.marks[n === 170 + d ? 'cast1' : 'cast2'] = n }
  }
  L.tag = () => { const r = window.__raid?.(); return r ? (r.cast ? 2 : 1) : 0 }
})()`
/**
 * crowd: 독립 열전(STAGE=forest)의 몰려오는 판 — 봇이 UNTIL 초까지 돌린 판(체력은 채움)을 끼우고 넓게 네모로 걷는다 (11-22 59-WIDE 넓은 맵 프레임).
 * MAP=off 면 한 장짜리 옛 판 · 기본은 넓은 맵 (같은 씨앗·같은 손 · 판 규칙만 다르다 → 넓은 맵이 틀 시간을 늘리는지 견준다).
 */
const CROWD_BUILD = `(async () => {
  const H = await import('/src/raid/haebi.ts'), R = await import('/src/raid/haebi-replay.ts')
  const stage = '${STAGE}', s = H.createHaebi(7, 'stage', '${KIT}', { stage, simRules: H.raidRulesForStage(stage), kitRules: H.KIT_RULES${env('MAP') === 'off' ? '' : ', mapRules: H.MAP_RULES'} })
  for (let n = 0; s.t < ${UNTIL} && s.state === 'playing'; n++) {
    if (s.offers.length) H.choose(s, R.botChoice(s, 'storm')); else { H.stepHaebi(s, R.botInput(s), 1 / 120); s.hp = s.maxHp }
    if (n % 2400 === 0) await new Promise(r => setTimeout(r, 0))
  }
  const r = window.__raid()
  for (const k of Object.keys(r)) if (!(k in s)) delete r[k]   // 열려 있던 판에만 있던 칸(넓은 맵 등)을 남기지 않는다
  Object.assign(r, s)
  document.getElementById('resume')?.click()
  return { t: Math.round(s.t), kills: s.kills, level: s.level, enemies: s.enemies.length, wide: !!s.wide, combos: s.combos.join(',') }
})()`
/** 몰려오는 판의 손 — 오른쪽 220틀 · 아래 140틀 · 왼쪽 220틀 · 위 140틀 (넓은 맵이면 결전장 밖까지 나갔다 돌아온다) · 레벨업이면 첫 카드 · 240틀마다 비기 · 체력은 채움 */
const CROWD_SCENE = `(() => {
  const L = window.__lock, LEGS = [['d'], ['s'], ['a'], ['w']], LEN = [220, 140, 220, 140]
  const S = window.__scene = { held: [], marks: {} }
  L.marksOf = () => ({ ...S.marks, start: 0 })
  const key = (type, k) => window.dispatchEvent(new KeyboardEvent(type, { key: k, bubbles: true }))
  L.before = (n) => {
    const r = window.__raid?.()
    if (!r || r.state !== 'playing') return
    r.hp = r.maxHp
    if (r.offers.length) { document.querySelector('#overlay .choices button')?.click(); return }
    let m = n % 720, i = 0
    while (m >= LEN[i]) { m -= LEN[i]; i++ }
    const want = LEGS[i]
    for (const k of S.held) if (!want.includes(k)) key('keyup', k)
    for (const k of want) if (!S.held.includes(k)) key('keydown', k)
    S.held = want
    if (n % 240 === 120) { key('keydown', ' '); key('keyup', ' ') }
  }
  L.tag = () => { const r = window.__raid?.(); return r ? r.enemies.length : 0 }
})()`
/** 열전 찍을 때 — 카드 창은 뜬 뒤 12틀 · 컷인은 띠가 들어온 뒤(8틀)·한가운데(30틀) (CSS 애니는 찍는 틀의 판 시각에 묶는다) */
const RAID_SHOTS: ReadonlyArray<readonly [string, string, number]> = [['offer1', 'offer1', 12], ['cut1-a', 'cast1', 8], ['cut1-b', 'cast1', 30], ['offer2', 'offer2', 12], ['offer3', 'offer3', 12], ['cut2-b', 'cast2', 30]]

function stats(a: number[]): { n: number; p50: number; p95: number; max: number; mean: number } {
  const s = [...a].sort((x, y) => x - y), n = s.length
  if (n === 0) return { n: 0, p50: 0, p95: 0, max: 0, mean: 0 }
  const q = (k: number): number => +(s[Math.min(n - 1, Math.floor(n * k))] as number).toFixed(2)
  return { n, p50: q(0.5), p95: q(0.95), max: +(s[n - 1] as number).toFixed(2), mean: +(s.reduce((x, y) => x + y, 0) / n).toFixed(2) }
}

const PORT = 9600 + Math.floor(Math.random() * 60)
const prof = mkdtempSync(join(tmpdir(), 'dfps-'))
const chrome = spawn(exe, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, `--window-size=${VW},${VH}`, '--no-first-run', '--mute-audio', '--enable-gpu-rasterization', 'about:blank'], { stdio: 'ignore' })
try {
  let tabs: any = null
  for (let i = 0; i < 50 && tabs === null; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json() } catch { await sleep(200) } }
  const ws = new WebSocket(tabs.find((t: any) => t.type === 'page').webSocketDebuggerUrl)
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
  let id = 0, crashed = false
  const waits = new Map<number, (v: any) => void>()
  ws.onmessage = (m) => {
    const o = JSON.parse(String(m.data))
    if (o.method === 'Runtime.exceptionThrown') console.log('  페이지 예외', String(o.params.exceptionDetails?.exception?.description ?? o.params.exceptionDetails?.text).slice(0, 300))
    if (o.method === 'Inspector.targetCrashed') { console.log('  페이지가 죽었다 (targetCrashed)'); crashed = true; for (const w of waits.values()) w({ error: 'closed' }); waits.clear() }
    if (o.id !== undefined) { waits.get(o.id)?.(o.result ?? o.error); waits.delete(o.id) }
    if (o.method === 'Tracing.dataCollected') traceEvents.push(...o.params.value)
    if (o.method === 'Tracing.tracingComplete') traceDone?.()
  }
  // TRACE=1: 재는 동안 렌더러 주 스레드를 적어 두고 · 긴 일(40ms 넘는 한 덩이)마다 그 안을 이름별로 나눠 보인다 (스타일·배치·그림 풀기·칠하기 …)
  const traceEvents: any[] = []
  let traceDone: (() => void) | null = null
  // 크롬이 죽거나 답이 없으면 기다리지 않고 끝낸다 (판이 멈춘 채 몇 분씩 걸려 있었다)
  ws.onclose = () => { for (const w of waits.values()) w({ error: 'closed' }); waits.clear() }
  const call = (method: string, params: object = {}): Promise<any> => new Promise((r, j) => {
    if (crashed) { j(new Error(`${method}: 페이지가 죽은 뒤`)); return }
    const k = ++id
    const t = setTimeout(() => { waits.delete(k); j(new Error(`${method}: 120초 동안 답 없음`)) }, 120000)
    waits.set(k, (v) => { clearTimeout(t); if (v?.error === 'closed') j(new Error(`${method}: 크롬 연결이 끊겼다`)); else r(v) })
    ws.send(JSON.stringify({ id: k, method, params }))
  })
  const step = (what: string): void => { if (env('VERBOSE') === '1') console.error(`  [${new Date().toISOString().slice(11, 19)}] ${what}`) }
  const evTop = async (expression: string): Promise<any> => {
    const r = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (r.exceptionDetails) console.log('  스크립트 오류', String(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text).slice(0, 400))
    else if (r.result === undefined) console.log('  CDP 오류', JSON.stringify(r).slice(0, 300), expression.slice(0, 80))
    return r.result?.value
  }
  /** 판이 사는 창 — 겨루기·거대 두목은 이 창 · 시련은 틀 안 창 */
  const WIN = SCENE === 'trial' ? `document.querySelector('iframe').contentWindow` : 'window'
  /** 판이 사는 창의 realm 에서 돌린다 (그 창의 document·window 로) */
  const ev = (src: string): Promise<any> => evTop(`${WIN}.eval(${JSON.stringify(src)})`)
  /**
   * 열전 판을 끼운다 — 시계를 먼저 묶어 세운 채(진짜 틀이 판을 앞으로 돌리지 않게) 검수 재생으로 판을 열고 · 판을 지어 덮고 ·
   * 화면이 돌아온 척(visibilitychange) 해 열전의 지난 틀 시각을 비운다 → 첫 틀부터 전후가 같은 판 (판 시각이 진짜 시계에 흔들리지 않는다)
   */
  const raidInstall = async (build: string, settleMs: number, hand = TRIAL_SCENE, until = 0): Promise<void> => {
    await ev(`(() => { const L = window.__lock; L.on = true; L.hold = true })()`)
    await ev(`document.querySelector('button[data-until="${until}"]').click()`)
    for (let i = 0; i < 240 && await ev(`document.getElementById('play').hidden`) !== false; i++) await sleep(250)
    step('판 열림')
    await ev(`[...document.querySelectorAll('.review-tools button')].find(b => b.textContent === '검수 도구 닫기')?.click()`)
    built = await ev(build)
    step('판 지음 ' + JSON.stringify(built))
    await sleep(settleMs)
    await ev(`document.dispatchEvent(new Event('visibilitychange'))`)
    await ev(hand)
  }
  await call('Emulation.setDeviceMetricsOverride', { width: VW, height: VH, deviceScaleFactor: DPR, mobile: true })
  await call('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
  await call('Emulation.setFocusEmulationEnabled', { enabled: true })
  await call('Page.enable'); await call('Runtime.enable')
  // BLOCK='*/realm/hit/*,…': 그 주소는 받지 않는다 — 무엇 때문에 멈추는지 하나씩 빼 볼 때
  if (env('BLOCK')) { await call('Network.enable'); await call('Network.setBlockedURLs', { urls: env('BLOCK').split(',') }) }
  await call('Page.addScriptToEvaluateOnNewDocument', { source: LOCK })
  if (COUNT) await call('Page.addScriptToEvaluateOnNewDocument', { source: COUNTER })
  let built: unknown = null
  if (SCENE === 'duel') {
    await call('Page.navigate', { url: `${ROOT}/duel.html?${QUERY}` })
    for (let i = 0; i < 80 && await ev(`typeof window.__duel === 'function' && !!document.querySelector('.dflag')`) !== true; i++) await sleep(250)
    // 겨루기의 그림(바탕·띠·초상·테두리)이 다 오기를 — 처음 굽기(warmNow)도 이때 끝난다
    await sleep(2500)
    // FONTS=1: 겨루기 글자에 드는 고운바탕 조각(700·800·900)을 먼저 다 받아 둔다 — 글꼴이 늦게 와 대신 글꼴로 구워지던 예전 판과 화소를 견줄 때 (글꼴 말고 다른 차이만 보려고)
    if (env('FONTS') === '1') console.log('  글꼴 미리 받음: ' + await ev(`(async () => { const ko = (await import('/src/i18n/ko.ts')).ko; const text = Object.entries(ko).filter(([k]) => k.startsWith('duel.')).map(([, v]) => v).join('') + '알영해비0123456789−⚔!'; await Promise.all([700, 800, 900].map(w => document.fonts.load(w + ' 20px "Gowun Batang"', text))); const ok = [700, 800, 900].every(w => document.fonts.check(w + ' 20px "Gowun Batang"', text)); dispatchEvent(new Event('resize')); return ok })()`))
    // 재는 판만: DPR 고정(전후 같은 해상도) · 체간 끝을 낮춰 연타가 일찍 온다 (판 셈 자체는 그대로 · 전후 같은 판)
    await ev(`import('/src/tune/params.ts').then(m => { ${WATCH ? '' : 'm.P.duel.dprDropMs = 1e9;'} m.P.duel.posture = ${Number(env('POSTURE') || 40)} })`)
    await ev(DUEL_SCENE)
  } else if (SCENE === 'giant') {
    await call('Page.navigate', { url: `${ROOT}/raid.html?review&background&stage=${STAGE}&kit=${KIT}` })
    for (let i = 0; i < 120 && await ev(`!!document.querySelector('button[data-until="0"]')`) !== true; i++) await sleep(250)
    await raidInstall(GIANT_BUILD, 2500)   // 거대 두목 그림 미리 받기(prewarm*Art)가 끝나게
  } else if (SCENE === 'crowd') {
    await call('Page.navigate', { url: `${ROOT}/raid.html?review&background&stage=${STAGE}&kit=${KIT}` })
    for (let i = 0; i < 120 && await ev(`!!document.querySelector('button[data-until="60"]')`) !== true; i++) await sleep(250)
    await raidInstall(CROWD_BUILD, 2500, CROWD_SCENE, 60)
  } else if (SCENE === 'raid') {
    await call('Page.navigate', { url: `${ROOT}/raid.html?review&background&stage=${STAGE}&kit=${KIT}` })
    for (let i = 0; i < 120 && await ev(`!!document.querySelector('button[data-until="60"]')`) !== true; i++) await sleep(250)
    // 출전 화면의 미리 그리기(warmFirstViews · 있으면)가 끝나기를 — 사람이 출전 화면을 보는 동안 끝나는 일
    for (let i = 0; i < 80 && await ev(`window.__raidWarm === undefined || window.__raidWarm() !== null`) !== true; i++) await sleep(250)
    console.log('  미리 그리기: ' + await ev(`window.__raidWarm === undefined ? '없음' : String(window.__raidWarm())`))
    // 「첫 성장까지」는 카드 창을 연 채 끝나 첫 창이 재기 전에 지나간다 — 1분 재생(판 셈만)으로 열고 레벨 1 판으로 덮는다
    await raidInstall(RAID_BUILD, Number(env('SETTLE') || 2500), RAID_SCENE, 60)
  } else {
    // 위 창은 스크립트 없는 같은 곳 문서(그림 한 장)로 — 본편처럼 틀 안에서만 판이 돈다
    await call('Page.navigate', { url: `${ROOT}/favicon-32.png` })
    await sleep(800)
    await evTop(`(() => { document.documentElement.innerHTML = '<head><style>html,body{margin:0;height:100%;overflow:hidden;background:#000}iframe{position:fixed;inset:0;width:100vw;height:100vh;border:0}</style></head><body><iframe src="/raid.html?trial=probe&review&background&kit=${KIT}"></iframe></body>' })()`)
    step('틀 열림')
    for (let i = 0; i < 120 && await evTop(`!!document.querySelector('iframe')?.contentDocument?.querySelector('button[data-until="0"]')`) !== true; i++) await sleep(250)
    // 틀은 처음 빈 문서의 창을 물려받아 새 문서에 시계가 안 심길 때가 있다 (빈 문서의 시계가 남아 판이 멈췄다) — 이 문서에 다시 심는다 (이미 이 문서 것이면 그대로)
    await ev(LOCK)
    step('검수 단추 보임 · ' + await ev(`location.search + ' · ' + (window.__lock?.doc === document ? '시계 있음' : '시계 없음')`))
    await raidInstall(TRIAL_BUILD, 1500)
  }
  // PRE=파일.js: 재기 전에 판 창에서 한 번 돌린다 (가설 견주기 — 미리 굽기를 손으로 흉내 내 보기 등)
  if (env('PRE')) console.log('  pre: ' + JSON.stringify(await ev(readFileSync(env('PRE'), 'utf8'))))
  // 시계를 묶는다 — 걸려 있던 진짜 rAF 하나가 묶인 줄로 들어오게 잠깐 세웠다가 푼다
  await ev(`(() => { const L = window.__lock; L.hold = true; L.on = true })()`)
  await sleep(300)
  if (THROTTLE > 1) await call('Emulation.setCPUThrottlingRate', { rate: THROTTLE })
  if (PROFILE) { await call('Profiler.enable'); await call('Profiler.setSamplingInterval', { interval: 250 }); await call('Profiler.start') }
  if (COUNT) await ev(`(() => { const L = window.__lock, C = window.__cnt, tag0 = L.tag; L.tag = (n) => { C.frames.push(C.cur); C.reset(); return tag0 ? tag0(n) : 0 }; C.reset() })()`)
  const shotList = SHOTS ? (SCENE === 'duel' ? DUEL_SHOTS : SCENE === 'raid' ? RAID_SHOTS : TRIAL_SHOTS) : []
  const shotsTaken: Record<string, string> = {}
  if (shotList.length) await ev(`window.__lock.shots = ${JSON.stringify(shotList)}`)
  // PROFAT=780,160: 그 틀(앞뒤 한 틀씩)만 따로 프로파일 — 가장 무거운 틀이 무엇에 시간을 쓰나
  const profAt = env('PROFAT').split(',').filter(Boolean).map(Number).sort((a, b) => a - b)
  const profOut: string[] = []
  let profOn = -1
  if (profAt.length) { await call('Profiler.enable'); await call('Profiler.setSamplingInterval', { interval: 100 }) }
  // 주 스레드가 화면 배치·스타일을 몇 번 다시 셈했나 · JS 더미 크기 (CDP Performance) — 재는 동안의 차로 틀마다
  await call('Performance.enable')
  const metrics = async (): Promise<Record<string, number>> => Object.fromEntries(((await call('Performance.getMetrics')).metrics ?? []).map((m: { name: string; value: number }) => [m.name, m.value]))
  const m0 = await metrics()
  const TRACE = env('TRACE') === '1'
  if (TRACE) { await call('Tracing.start', { categories: 'toplevel,devtools.timeline,disabled-by-default-devtools.timeline,blink,cc,gpu,v8', transferMode: 'ReportEvents' }); await ev('window.__lock.stamp = true') }
  await ev(`window.__lock.hold = false`)
  const t0 = Date.now()
  let lastN = -1, lastMove = Date.now()
  for (;;) {
    const st = await ev(`(() => { const L = window.__lock, S = window.__scene; return { n: L.n, hold: L.hold, shotNow: L.shotNow ?? null, marks: S.marks, duelAt: S.duelAt ?? 0, over: S.over ?? -1, err: L.err ?? '' } })()`)
    if (st === undefined || st === null) { console.log('  판 창을 못 읽었다'); break }
    if (st.err) { console.log('  손 오류', st.err.slice(0, 300)); break }
    // 틀이 20초 넘게 안 넘어가면 멈춘 것 — 기다리지 않고 끝낸다
    if (st.n !== lastN || st.hold) { lastN = st.n; lastMove = Date.now() } else if (Date.now() - lastMove > 20000) { console.log(`  틀이 ${st.n} 에서 멈췄다 (시계가 안 돈다)`); break }
    if (st.n % 100 < 8) step(`틀 ${st.n}`)
    if (profAt.length) {
      const target = profAt[0]!
      if (profOn < 0 && !st.hold) {
        if (st.n <= target - 2) { await ev(`window.__lock.holdAt = ${target - 2}`); await sleep(20) } else profAt.shift()
        continue
      }
      if (profOn < 0) { await call('Profiler.start'); profOn = target; await ev(`(() => { const L = window.__lock; L.holdAt = ${target + 1}; L.hold = false })()`); continue }
      if (st.hold) {
        const { profile } = await call('Profiler.stop')
        const self = new Map<string, number>(), byId = new Map<number, any>(profile.nodes.map((n: any) => [n.id, n]))
        ;(profile.samples as number[]).forEach((sid, i) => { const f = byId.get(sid).callFrame; if (f.functionName === '(idle)') return; const k = `${f.functionName || '(anon)'}:${f.lineNumber + 1}`; self.set(k, (self.get(k) ?? 0) + ((profile.timeDeltas as number[])[i] ?? 0)) })
        profOut.push(`#${profOn - 1}..${profOn + 1}: ` + [...self].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => `${k} ${(v / 1000).toFixed(1)}ms`).join(' · '))
        profAt.shift(); profOn = -1
        await ev(`(() => { const L = window.__lock; L.holdAt = -1; L.hold = false })()`)
        continue
      }
    }
    if (st.n >= FRAMES || (st.over >= 0 && st.n > st.over + 120) || Date.now() - t0 > 600000) break
    if (shotList.length && st.hold && st.shotNow) {
      // 페이지가 그 틀을 그린 뒤 멈춰 있다 — 위 창 전체를 찍는다 (같은 틀에 둘이면 같은 그림)
      mkdirSync(SHOTS, { recursive: true })
      // 열전: CSS 애니(컷인 띠·카드 들어오기)는 진짜 시계로 돈다 — 찍는 동안 모두 세워 「사건 뒤 몇 틀 × 1/60초」 자리에 둔다 (전후가 같은 자세)
      const off = shotList.find((s) => (st.shotNow as string[]).includes(s[0]))?.[2] ?? 0
      if (SCENE === 'raid') await ev(`(() => { window.__pinned = document.getAnimations(); for (const a of window.__pinned) { try { a.pause(); a.currentTime = ${off * 1000 / 60} } catch {} } return new Promise(r => setTimeout(r, 300)) })()`)
      const { data } = await call('Page.captureScreenshot', { format: 'png' })
      if (SCENE === 'raid') await ev(`(() => { for (const a of window.__pinned ?? []) { try { a.play() } catch {} } window.__pinned = null })()`)
      for (const name of st.shotNow as string[]) { const file = join(SHOTS, `${SCENE}-${VW}x${VH}-${name}-${TAG}.png`); writeFileSync(file, Buffer.from(data, 'base64')); shotsTaken[name] = file }
      await ev(`(() => { const L = window.__lock; L.shotNow = null; L.hold = false })()`)
      continue
    }
    await sleep(SHOTS ? 30 : 400)
  }
  await ev(`window.__lock.stop = true`)
  const m1 = await metrics()
  if (TRACE) {
    await new Promise<void>((r) => { traceDone = r; void call('Tracing.end') })
    const main = new Set<string>(), others = new Map<string, string>()
    for (const e of traceEvents) if (e.ph === 'M' && e.name === 'thread_name') { if (e.args.name === 'CrRendererMain') main.add(e.pid + ':' + e.tid); else others.set(e.pid + ':' + e.tid, e.args.name) }
    const onMain = traceEvents.filter((e) => e.ph === 'X' && e.dur && main.has(e.pid + ':' + e.tid)).sort((a, b) => a.ts - b.ts)
    const longs = onMain.filter((e) => e.name === 'ThreadControllerImpl::RunTask' && e.dur > Number(env('LONG') || 40) * 1000)
    // 몇 번째 틀의 일인가 — 시계가 틀마다 console.timeStamp('f<n>') 을 남긴다
    const stamps = traceEvents.filter((e) => e.name === 'TimeStamp').sort((a, b) => a.ts - b.ts)
    for (const t of longs.slice(0, Number(env('LONGN') || 12))) {
      const sum = new Map<string, number>()
      for (const e of onMain) if (e !== t && e.ts >= t.ts && e.ts + e.dur <= t.ts + t.dur && e.name !== 'ThreadControllerImpl::RunTask') sum.set(e.name, (sum.get(e.name) ?? 0) + e.dur / 1000)
      // 배치(Layout)·스타일 다시 셈이 몇 개를 건드렸나 — 판 전체를 다시 잡는지
      const lay = onMain.filter((e) => e.ts >= t.ts && e.ts + e.dur <= t.ts + t.dur && (e.name === 'Layout' || e.name === 'UpdateLayoutTree') && e.dur > 3000).map((e) => `${e.name} ${(e.dur / 1000).toFixed(0)}ms ${JSON.stringify(e.args?.beginData ?? {}).slice(0, 120)}${e.args?.elementCount !== undefined ? ' els ' + e.args.elementCount : ''}`)
      if (lay.length) console.log('    ' + lay.join(' | '))
      console.log(`long task ${(t.dur / 1000).toFixed(0)}ms @${stamps.filter((s) => s.ts <= t.ts + t.dur).pop()?.args?.data?.message ?? '?'}: ` + [...sum].sort((a, b) => b[1] - a[1]).slice(0, Number(env('LONGK') || 14)).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(' · '))
    }
    // 다른 스레드(그림 풀기·칠하기)에서 오래 걸린 것
    const off = new Map<string, number>()
    for (const e of traceEvents) if (e.ph === 'X' && e.dur > 8000 && !main.has(e.pid + ':' + e.tid)) { const k = (others.get(e.pid + ':' + e.tid) ?? '?') + ' ' + e.name; off.set(k, Math.max(off.get(k) ?? 0, e.dur / 1000)) }
    console.log('off-main longest: ' + [...off].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${k} ${v.toFixed(0)}`).join(' · '))
    // GPU 쪽(칠하기·그림 올리기)의 긴 일 — 몇 번째 틀 뒤인가 · 안을 이름별로
    const gpu = new Set([...others].filter(([, n]) => n === 'CrGpuMain' || n === 'VizCompositorThread').map(([k]) => k))
    const onGpu = traceEvents.filter((e) => e.ph === 'X' && e.dur && gpu.has(e.pid + ':' + e.tid)).sort((a, b) => a.ts - b.ts)
    for (const t of onGpu.filter((e) => e.name === 'ThreadControllerImpl::RunTask' && e.dur > Number(env('LONG') || 40) * 1000).slice(0, 10)) {
      const sum = new Map<string, number>()
      for (const e of onGpu) if (e !== t && e.ts >= t.ts && e.ts + e.dur <= t.ts + t.dur && e.pid + ':' + e.tid === t.pid + ':' + t.tid) sum.set(e.name, (sum.get(e.name) ?? 0) + e.dur / 1000)
      console.log(`gpu task ${(t.dur / 1000).toFixed(0)}ms @${stamps.filter((s) => s.ts <= t.ts).pop()?.args?.data?.message ?? '?'}: ` + [...sum].sort((a, b) => b[1] - a[1]).slice(0, Number(env('LONGK') || 14)).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(' · '))
    }
  }
  if (THROTTLE > 1) await call('Emulation.setCPUThrottlingRate', { rate: 1 })
  const rec: Array<[number, number, number]> = await ev(`window.__lock.rec`)
  const scene = await ev(SCENE === 'duel' ? `(() => { const d = window.__duel(), S = window.__scene; return { stats: d.stats, over: d.over, t: d.t, duelAt: S.duelAt, marks: S.marks, dpr: +(document.querySelector('.duelx canvas:last-of-type').width / innerWidth).toFixed(2), warm: [S.warmAtDuel ?? null, window.__duelWarm?.() ?? null] } })()`
    : `(() => { const r = window.__raid(), S = window.__scene; return { t: +r.t.toFixed(1), state: r.state, mode: r.mode, kills: r.kills, enemies: r.enemies.length, fx: r.fx.length, marks: S.marks, canvas: document.getElementById('field').width + 'x' + document.getElementById('field').height, rotate: !document.getElementById('rotate-guide').hidden, arena: (b => [b.left, b.top, b.width, b.height].map(Math.round).join(','))(document.getElementById('arena').getBoundingClientRect()), view: innerWidth + 'x' + innerHeight } })()`)
  // 겨루기는 겨루기 화면이 선 뒤의 틀만 (들어오는 암전·이름판 1초도 넣는다) · 시련은 첫 30틀(판 갈아 끼운 뒤 첫 굽기)을 뺀다
  const from = SCENE === 'duel' ? Math.max(0, (scene.duelAt as number) + 1) : 30
  const body = rec.slice(from)
  const gaps = body.map((r) => r[0]).filter((g) => g > 0), cbs = body.map((r) => r[1])
  const heavy = SCENE === 'duel' ? body.filter((r) => r[2] === 2) : body.filter((r) => r[2] >= 0)
  const out = {
    scene: SCENE, size: `${VW}x${VH}`, dpr: DPR, throttle: THROTTLE, frames: body.length, tag: TAG,
    gap: { ...stats(gaps), over16: gaps.filter((g) => g > 16.7 + 0.5).length, over33: gaps.filter((g) => g > 33.4 + 0.5).length },
    script: stats(cbs),
    heavy: SCENE === 'duel' ? { n: heavy.length, gap: stats(heavy.map((r) => r[0]).filter((g) => g > 0)), script: stats(heavy.map((r) => r[1])) } : undefined,
    // 틀마다: 화면 배치(Layout)·스타일 다시 셈 횟수와 ms · JS 더미(MB · 150틀마다)
    dom: (() => { const n = Math.max(1, rec.length), d = (k: string): number => (m1[k] ?? 0) - (m0[k] ?? 0); return { layouts: +(d('LayoutCount') / n).toFixed(2), styles: +(d('RecalcStyleCount') / n).toFixed(2), layoutMs: +(1000 * d('LayoutDuration') / n).toFixed(2), styleMs: +(1000 * d('RecalcStyleDuration') / n).toFixed(2), scriptMs: +(1000 * d('ScriptDuration') / n).toFixed(2), taskMs: +(1000 * d('TaskDuration') / n).toFixed(2), nodes: m1['Nodes'], heapMB: [Math.round((m0['JSHeapUsedSize'] ?? 0) / 1048576), Math.round((m1['JSHeapUsedSize'] ?? 0) / 1048576)] } })(),
    built, at: scene,
  }
  console.log(JSON.stringify(out))
  for (const line of profOut) console.log('profile ' + line)
  // 가장 오래 걸린 틀 — 몇 번째 틀(겨루기 시작부터) · 스크립트 ms · 틀 간격 ms · 그 앞 사건
  const marksOf = (scene.marks ?? {}) as Record<string, number>
  const near = (n: number): string => Object.entries(marksOf).filter(([, m]) => m <= n + 1).sort((a, b) => b[1] - a[1]).slice(0, 1).map(([k, m]) => `${k}+${n + 1 - m}`).join('')
  console.log('slowest: ' + body.map((r, i) => [i + from, r[1], r[0]] as const).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([n, s, g]) => `#${n} ${s.toFixed(1)}ms/${g.toFixed(0)}ms ${near(n)}`).join(' · '))
  // 틀 간격이 가장 길었던 곳 — 간격은 그 앞 틀이 끝난 뒤부터 이 틀까지 (앞 틀의 일 · 그 사이 GC·그림 풀기 등)
  console.log('longest gaps: ' + body.map((r, i) => [i + from, r[0], body[i - 1]?.[1] ?? 0] as const).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([n, g, prevS]) => `#${n} ${g.toFixed(0)}ms (앞 틀 ${prevS.toFixed(1)}ms) ${near(n - 1)}`).join(' · '))
  // 열전: 사건마다 그 틀부터 25틀 — 가장 긴 틀 간격 · 가장 긴 스크립트 · 16.7ms 넘은 틀 수 (사건 틀의 일은 다음 틀 간격에 잡힌다)
  if (SCENE === 'raid') for (const [k, m] of Object.entries(marksOf).sort((a, b) => a[1] - b[1])) {
    const w = rec.slice(m, m + 26), g = w.slice(1).map((r) => r[0])
    const at = g.indexOf(Math.max(...g))
    console.log(`event ${k} @${m}: gap max ${Math.max(...g).toFixed(1)}ms (+${at + 1}) · script max ${Math.max(...w.map((r) => r[1])).toFixed(1)}ms · over16 ${g.filter((x) => x > 16.7 + 0.5).length} · gaps ${g.slice(0, 6).map((x) => x.toFixed(0)).join(',')}`)
  }
  if (COUNT) {
    const frames: Array<{ vis: Record<string, number>; off: Record<string, number>; visPx: number; offPx: number }> = (await ev(`window.__cnt.frames`)).slice(from)
    const px = DPR * DPR, screen = VW * VH * px
    const keys = new Set<string>(); for (const f of frames) { for (const k of Object.keys(f.vis)) keys.add('vis.' + k); for (const k of Object.keys(f.off)) keys.add('off.' + k) }
    const row: Record<string, string> = {}
    for (const k of [...keys].sort()) { const [side, m] = k.split('.') as [string, string]; const v = frames.map((f) => (side === 'vis' ? f.vis : f.off)[m] ?? 0); const s = stats(v); row[k] = `${s.mean}/${s.max}` }
    const vis = stats(frames.map((f) => f.visPx / screen)), off = stats(frames.map((f) => f.offPx / screen))
    console.log('canvas per frame (mean/max): ' + Object.entries(row).map(([k, v]) => `${k} ${v}`).join(' · '))
    console.log(`fill (screens of ${VW}x${VH}@${DPR}): visible mean ${vis.mean} p95 ${vis.p95} max ${vis.max} · offscreen mean ${off.mean} max ${off.max}`)
    const by = new Map<string, number>(); for (const f of frames as Array<{ by?: Record<string, number> }>) for (const [k, v] of Object.entries(f.by ?? {})) by.set(k, (by.get(k) ?? 0) + v)
    console.log('fill by source (screens/frame): ' + [...by].sort((a, b) => b[1] - a[1]).slice(0, 16).map(([k, v]) => `${k} ${(v / frames.length / screen).toFixed(3)}`).join(' · '))
    const cnt = new Map<string, number>(); for (const f of frames as Array<{ n?: Record<string, number> }>) for (const [k, v] of Object.entries(f.n ?? {})) cnt.set(k, (cnt.get(k) ?? 0) + v)
    console.log('draws by source (calls/frame): ' + [...cnt].sort((a, b) => b[1] - a[1]).slice(0, 18).map(([k, v]) => `${k} ${(v / frames.length).toFixed(1)}`).join(' · '))
  }
  if (PROFILE) {
    const { profile } = await call('Profiler.stop')
    const self = new Map<string, number>(), byId = new Map<number, any>(profile.nodes.map((n: any) => [n.id, n]))
    const dt = profile.timeDeltas as number[], samples = profile.samples as number[]
    samples.forEach((sid, i) => { const f = byId.get(sid).callFrame; const k = `${f.functionName || '(anon)'} ${(f.url || '').split('/').pop()?.split('?')[0]}:${f.lineNumber + 1}`; self.set(k, (self.get(k) ?? 0) + (dt[i] ?? 0)) })
    const tot = [...self.values()].reduce((a, b) => a + b, 0)
    const idle = [...self].filter(([k]) => /^\(idle\)|^\(program\)|^\(garbage collector\)/.test(k)).map(([k, v]) => `${k.split(' ')[0]} ${(100 * v / tot).toFixed(1)}%`).join(' · ')
    console.log('self (all samples · ' + idle + '):\n' + [...self].filter(([k]) => !/^\(idle\)/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 28).map(([k, v]) => `  ${(100 * v / tot).toFixed(1)}% ${k}`).join('\n'))
    const parent = new Map<number, number>(); for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id)
    const incl = new Map<string, number>()
    samples.forEach((sid, i) => { const seen = new Set<string>(); for (let p: number | undefined = sid; p !== undefined; p = parent.get(p)) { const nm = byId.get(p).callFrame.functionName; if (nm && !seen.has(nm)) { seen.add(nm); incl.set(nm, (incl.get(nm) ?? 0) + (dt[i] ?? 0)) } } })
    const WANT = /^(frame|tick|drawDuel|drawCue|drawSlash|clang|bar|barFrame|putText|textSprite|sprite|fieldFighters|crowdRow|bakedBg|panelBake|glow|scaled|rushCue|drawHitPortrait|hitArtDraw|drawIntro|drawEnd|onEvent|burst|syncRisers|riserStart|stepDuel|watchLoad|warmNow|drawField|stepHaebi|updateHud|showOverlay|updatePortrait|drawNumbers|trackNumbers|drawEnemies|effectStrip|bakedStrip|whiteStrip|drawAura|drawWard|syncEndingVideo|updateChunk|watchHit|feed|runFrame)$/
    console.log('inclusive: ' + [...incl].filter(([k]) => WANT.test(k)).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(100 * v / tot).toFixed(1)}%`).join(' · '))
  }
  if (SHOTS) {
    console.log('shots: ' + Object.keys(shotsTaken).join(' · ') + ' · 지나침: ' + JSON.stringify(await ev(`window.__lock.passed ?? []`)) + ' · 못 옴: ' + JSON.stringify(await ev(`(window.__lock.shots ?? []).map(s => s[0])`)))
    if (CMP) {
      // 견줄 태그의 같은 틀 그림과 화소 차 — 페이지 캔버스로 읽는다 (차 > 8 인 화소 몫 · 가장 큰 차)
      await call('Page.navigate', { url: `${ROOT}/favicon-32.png` }); await sleep(800)
      for (const [name, file] of Object.entries(shotsTaken)) {
        const other = file.replace(`-${TAG}.png`, `-${CMP}.png`)
        if (!existsSync(file) || !existsSync(other)) { console.log(`  ${name}: 견줄 그림 없음`); continue }
        const a = readFileSync(file).toString('base64'), b = readFileSync(other).toString('base64')
        const r = await evTop(`(async () => { const load = (s) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = 'data:image/png;base64,' + s }); const [A, B] = await Promise.all([load(${JSON.stringify(a)}), load(${JSON.stringify(b)})]); const w = A.width, h = A.height; if (B.width !== w || B.height !== h) return { size: 'differs' }; const px = (im) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.drawImage(im, 0, 0); return g.getImageData(0, 0, w, h).data }; const p = px(A), q = px(B); let diff = 0, max = 0, sum = 0, x0 = w, y0 = h, x1 = -1, y1 = -1; for (let i = 0; i < p.length; i += 4) { const d = Math.max(Math.abs(p[i] - q[i]), Math.abs(p[i + 1] - q[i + 1]), Math.abs(p[i + 2] - q[i + 2])); if (d > 8) { diff++; const x = (i / 4) % w, y = Math.floor(i / 4 / w); if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y } if (d > max) max = d; sum += d } return { diffPct: +(100 * diff / (w * h)).toFixed(3), max, mean: +(sum / (w * h)).toFixed(3), box: x1 < 0 ? null : [x0, y0, x1, y1] } })()`)
        console.log(`  ${name} vs ${CMP}: ${JSON.stringify(r)}`)
      }
    }
  }
  ws.close()
} finally {
  // 크롬이 다 내려간 뒤 임시 프로필을 지운다 (곧바로 지우면 잠겨 있어 판마다 남았다)
  await new Promise<void>((r) => { chrome.once('exit', () => r()); chrome.kill(); setTimeout(r, 5000) })
  await sleep(600)
  for (let i = 0; i < 20 && existsSync(prof); i++) { try { rmSync(prof, { recursive: true, force: true }) } catch { await sleep(500) } }
  if (existsSync(prof)) console.log('  임시 프로필이 남았다: ' + prof)
}
