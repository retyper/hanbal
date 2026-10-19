/**
 * 칠십팔국 — 판의 앞과 끝 (형 2026-10-19: "게임 시작과 자동저장과 종료도 시스테믹하게 잘 만들어야 할텐디.
 * 특히 시작할때는 이 게임 드디어 시작하는구나! 하는 기대감이 들게 … 처음하는사람한테는 오 이런게임이라니 하는 이해과 기대")
 *
 *   첫 화면 — 그림 한 장 · 이어 하기(어느 나라 · 몇 해 · 도읍 몇) · 새 판
 *   판 고르기 — 지도 한 조각을 얹은 큰 카드 넷
 *   나라 고르기 → 자세히 (군장 얼굴 · 사료 · 강약) → "이 나라로 시작"
 *   서막 세 장 — 시대 · 우리 나라 · 할 일. 그다음 한지가 걷히며 지도가 열린다 (app.ts 의 opening)
 *   끝 — 연대기: 이 판의 큰일과 숫자 · 같은 나라로 다시 · 새 판 · 지도 둘러보기
 *
 * 글을 만들기만 한다 — 상태는 app.ts 가 쥐고, 누름은 data-act 로 app.ts 가 받는다.
 */
import type { NationInfo } from '../../realm/data/nations.ts'
import { lockWhy } from './unlock.ts'
import { seasonLabel } from '../../realm/data/prose.ts'
import type { Realm, RegionId, ReportLine } from '../../realm/types.ts'
import { P } from '../../tune/params.ts'

/** app.ts 가 넘기는 그림 손 */
export interface FrontKit {
  readonly art: string
  readonly esc: (s: string) => string
  readonly icon: (name: string, cls?: string) => string
  readonly emblem: (nation: string, cls?: string) => string
  /** 나라의 군장 얼굴 (명치판) */
  readonly face: (nation: string, cls?: string) => string
  readonly nations: (region: RegionId) => readonly NationInfo[]
  /** 장수 명치판 그림의 주소 — 없으면 null (끝 화면의 콜라주) */
  readonly bust?: (hero: string) => string | null
}

/** 지난 계절들의 보고 — 판 기록에서 (realm-main) */
export type History = ReadonlyArray<{ readonly s: number; readonly lines: readonly ReportLine[] }>

export const BOARDS: ReadonlyArray<{ id: RegionId; name: string; line: string; thumb: string; length: string }> = [
  { id: 'tutorial', name: '배우는 판', line: '골포국과 가락국, 두 나라만. 징병·개척·정찰·사신·출정·전장·사로잡기·회유·공작·제사를 하나씩 해 본다.', thumb: 'map/spring.jpg', length: '아주 짧다' },
  { id: 'byeonhan-mini', name: '작은 판', line: '변한 남쪽 바닷가의 여섯 나라. 쇠와 뱃길을 두고 겨룬다.', thumb: 'map/spring.jpg', length: '짧다' },
  { id: 'yeongnam', name: '큰 판', line: '낙동강 물길과 동해·남해의 스물한 나라. 사로·가락·대가야가 아직 이웃 읍락과 키를 잰다.', thumb: 'map-yeongnam/spring.webp', length: '보통' },
  { id: 'south', name: '삼한 남부', line: '한강에서 영산강, 동해 바닷가까지 서른여섯 나라. 처음엔 이웃만 안다 — 지도는 보고 다닌 만큼 칠해진다.', thumb: 'map-world/m2-spring.webp', length: '길다' },
  { id: 'world', name: '삼한과 북녘', line: '탐라에서 부여의 들까지 쉰 나라. 고구려 다섯 나부 · 부여의 네 가 · 옥저 · 동예가 더해진다.', thumb: 'map-world/m7b-spring.webp', length: '아주 길다' },
]

/** 이기려면 쥘 도읍 수 (season.ts checkOutcome 과 같은 값) */
export function winNeed(region: RegionId): number {
  if (region === 'tutorial') return 2 // 배우는 판 — 가락 도읍 하나 (제 도읍 포함 둘)
  return region === 'yeongnam' ? P.realm.winCapitalsYeongnam : region === 'south' ? P.realm.winCapitalsSouth : region === 'world' ? P.realm.winCapitalsWorld : P.realm.winCapitals
}

const capsHeld = (r: Realm, f: string): number => Object.values(r.factions).filter((x) => r.nodes[x.capital]?.owner === f).length

// ───────── 첫 화면

export function titleHtml(k: FrontKit, r: Realm | null, savedAt: string | null, links = '', firstTime = false): string {
  let h = `<div class="front title"><div class="kv" style="background-image:url('${k.art}title/title-keyart.jpg')"></div><div class="tv">`
  h += `<h1>칠십팔국</h1><p class="sub">삼한의 일흔여덟 나라 · 고구려와 부여의 북녘</p>`
  h += `<p class="hook">왕이 하나가 아니던 때. 한 읍락의 군장으로 시작해, 이웃을 알고 · 사귀고 · 쳐서 도읍을 하나씩 쥔다.</p>`
  h += `<div class="fbtns">`
  if (r !== null && (!r.outcome || (r.endless === true && r.outcome.kind === 'win'))) {
    const me = r.player
    const region = r.region ?? 'byeonhan-mini'
    const name = r.factions[me]?.name ?? ''
    h += `<button class="cont" data-act="continue">${k.face(me, 'cface')}<span class="ct"><b>${k.emblem(me, 'cem')}${k.esc(name)} 이어 하기</b>`
    h += `<span>${k.esc(seasonLabel(r.season))} · 도읍 ${capsHeld(r, me)}/${winNeed(region)}${r.known !== undefined ? ` · 아는 나라 ${(r.known[me]?.length ?? 0) + 1}/${Object.keys(r.factions).length}` : ''}</span>`
    h += `${savedAt !== null ? `<small>${k.esc(agoText(savedAt))} 저장됨</small>` : ''}</span></button>`
  }
  // 처음 켠 사람은 배우는 판으로 (형: "맨 위 첫번째 할 게임은 1:1수준으로 여러 기능 익혀가며 쉽게")
  if (firstTime) h += `<button class="btn on big" data-act="fr-tutorial">처음이면 — 배우는 판부터</button><button class="btn big" data-act="fr-new">새 판</button></div>`
  else h += `<button class="btn on big" data-act="fr-new">새 판</button></div>`
  return h + `<p class="fine">판은 계절마다 저절로 저장된다.</p>${links}</div></div>`
}

function agoText(iso: string): string {
  const ms = Date.now() - Date.parse(iso)
  if (!Number.isFinite(ms) || ms < 0) return ''
  const m = Math.round(ms / 60000)
  return m < 1 ? '방금' : m < 60 ? `${m}분 전` : m < 60 * 24 ? `${Math.round(m / 60)}시간 전` : `${Math.round(m / 1440)}일 전`
}

// ───────── 판 고르기

/**
 * 판 고르기 — 위에서부터 배우는 판 → 작은 판 → … 차례로 열린다 (unlock.ts). 잠긴 판은 자물쇠와 여는 길.
 * `unlocked` 가 없으면 다 열린 것으로 (시험)
 */
export function boardHtml(k: FrontKit, hasGame: boolean, unlocked?: ReadonlySet<RegionId>): string {
  let h = `<div class="front boards"><div class="fhead"><button class="btn ghost" data-act="fr-back">‹ 처음으로</button><h2>어느 땅에서 시작할까</h2></div><div class="bcards">`
  const names = Object.fromEntries(BOARDS.map((b) => [b.id, b.name])) as Partial<Record<RegionId, string>>
  for (const b of BOARDS) {
    const open = unlocked === undefined || unlocked.has(b.id)
    h += `<button class="bcard${open ? '' : ' locked'}" data-act="${open ? 'fr-board' : 'fr-locked'}" data-v="${b.id}"><span class="bth" style="background-image:url('${k.art}${b.thumb}')">${open ? '' : '<i class="lock">🔒</i>'}</span>`
    h += `<span class="bb"><b>${k.esc(b.name)}</b><span>${k.esc(b.line)}</span>`
    const goal = b.id === 'tutorial' ? '가락 도읍을 쥐면 끝난다' : `도읍 ${winNeed(b.id)}곳을 쥐면 이긴다`
    h += open
      ? `<span class="bmeta">나라 ${k.nations(b.id).length} · ${goal} · 한 판이 ${b.length}</span></span></button>`
      : `<span class="bmeta lockwhy">${k.esc(lockWhy(b.id, names))}</span></span></button>`
  }
  h += `</div>${hasGame ? '<p class="fine">새 판을 시작하면 지금 판은 끝난 판으로 기록된다.</p>' : ''}</div>`
  return h
}

// ───────── 나라 고르기 · 자세히

export function nationsHtml(k: FrontKit, region: RegionId): string {
  const b = BOARDS.find((x) => x.id === region)!
  let h = `<div class="front choose"><div class="fhead"><button class="btn ghost" data-act="fr-new">‹ 판 고르기</button><h2>${k.esc(b.name)} — 어느 나라로</h2></div><div class="ncards">`
  for (const n of k.nations(region)) {
    h += `<button class="ncard pick" data-act="fr-nation" data-id="${n.id}">${k.face(n.id, 'nface')}<div class="nb">`
    h += `<div class="an">${k.emblem(n.id)}<b>${k.esc(n.name)}</b><span class="mute">${k.esc(n.place)}</span>${n.hard ? '<span class="hard">어려움</span>' : ''}</div>`
    h += `<p>${k.esc(n.blurb)}</p>${barsHtml(n)}</div></button>`
  }
  return h + `</div></div>`
}

function barsHtml(n: NationInfo): string {
  let h = `<div class="bars">`
  for (const [key, label] of [['army', '군사'], ['grain', '곡식'], ['militia', '장정'], ['terrain', '지형']] as const) {
    const v = n.bars[key]
    h += `<span class="bar"><i>${label}</i>${'<b></b>'.repeat(v)}${'<s></s>'.repeat(5 - v)}</span>`
  }
  return h + `</div>`
}

export function detailHtml(k: FrontKit, region: RegionId, id: string): string {
  const n = k.nations(region).find((x) => x.id === id)
  if (n === undefined) return nationsHtml(k, region)
  let h = `<div class="front detail"><div class="fhead"><button class="btn ghost" data-act="fr-board" data-v="${region}">‹ 다른 나라</button></div>`
  h += `<div class="dcard">${k.face(id, 'dface')}<div class="db"><div class="dn">${k.emblem(id, 'dem')}<div><b>${k.esc(n.name)}</b><span>${k.esc(n.place)}</span></div></div>`
  h += `<p class="blurb">${k.esc(n.blurb)}</p>${barsHtml(n)}`
  h += `<p class="src">${k.esc(n.source)}</p>${n.hard ? '<p class="hard">어려운 나라다 — 처음이면 다른 나라를 권한다.</p>' : ''}`
  h += `<button class="btn on big" data-act="fr-start" data-id="${id}">이 나라로 시작</button></div></div></div>`
  return h
}

// ───────── 서막 — 시대 · 우리 나라 · 할 일

const ERA: Readonly<Record<RegionId, string>> = {
  tutorial: '변한의 남쪽 바닷가. 작은 골포국과 이웃 가락국 — 두 나라만 있는 땅에서 군장의 일을 하나씩 배운다.',
  'byeonhan-mini': '변한의 남쪽 바닷가. 쇠를 캐고 배를 띄우는 여섯 나라가 서로를 엿본다.',
  yeongnam: '낙동강 물길을 따라 스물한 나라. 훗날 신라가 될 사로도, 가야가 될 가락과 대가야도 아직은 이웃 읍락과 키를 잰다.',
  south: '한강에서 영산강, 동해 바닷가까지. 마한·진한·변한의 서른여섯 나라가 저마다 깃발을 올렸다.',
  world: '탐라에서 부여의 들까지. 압록강 골짜기에서는 고구려 다섯 나부가, 송화강 들에서는 부여의 네 가가 말을 달린다.',
}

export const PROLOGUE_STEPS = 3

export function prologueHtml(k: FrontKit, r: Realm, step: number): string {
  const region = r.region ?? 'byeonhan-mini'
  const me = r.player
  const f = r.factions[me]
  const n = k.nations(region).find((x) => x.id === me)
  const ruler = f?.ruler !== undefined ? r.heroes[f.ruler] : undefined
  let body = ''
  if (step === 0) {
    body = `<div class="pl pera"><p class="l1">기원 2세기.</p><p class="l2">옛 조선이 무너진 지 삼백 년, 왕이 하나가 아니던 때.</p>`
      + `<p class="l3">${k.esc(ERA[region])}</p>`
      + `<p class="l4">${r.known !== undefined ? '그러나 너는 아직 이웃밖에 모른다. 지도는 빈 한지다.' : '저마다 제 도읍을 지키며, 남의 도읍을 넘본다.'}</p></div>`
  } else if (step === 1) {
    body = `<div class="pl pyou">${k.face(me, 'pface')}<div class="pt">${k.emblem(me, 'pem')}<b>${k.esc(f?.name ?? '')}</b>`
      + `<span>${k.esc(n?.place ?? '')}</span>${ruler !== undefined ? `<p class="who">군장 <b>${k.esc(ruler.name)}</b></p>` : ''}`
      + `<p>${k.esc(n?.blurb ?? '')}</p></div></div>`
  } else {
    const need = winNeed(region)
    const ways: Array<[string, string, string]> = [
      ['unit-spear', '군대', '징병해 군대를 세우고, 이웃 고을을 쳐서 쥔다'],
      ['good-tribute-bell', '사신', '화친·동맹·교역 — 적의 적은 벗이 된다'],
      [r.known !== undefined ? 'unit-scouts' : 'status-spy', r.known !== undefined ? '정찰' : '첩자', r.known !== undefined ? '척후와 군대가 다닌 만큼 지도가 밝아진다' : '적의 군세와 속셈을 엿본다'],
    ]
    body = `<div class="pl pgoal"><p class="gl">도읍 <b>${need}</b>곳을 쥐면 이긴다.<br><small>우리 도읍을 잃으면 진다.</small></p><div class="ways">`
      + ways.map(([ic, t, d]) => `<div class="way">${k.icon(ic, 'wic')}<b>${t}</b><span>${d}</span></div>`).join('')
      + `</div><p class="ptip">한 계절에 명령을 정하고 <b>다음 계절</b>을 누른다. 모든 나라가 한꺼번에 움직인다.</p></div>`
  }
  const dots = Array.from({ length: PROLOGUE_STEPS }, (_, i) => `<i class="${i === step ? 'on' : ''}"></i>`).join('')
  const last = step >= PROLOGUE_STEPS - 1
  return `<div class="prologue s${step}"><div class="pin">${body}</div><div class="pnav"><span class="pdots">${dots}</span>`
    + `<button class="btn ghost" data-act="pl-skip">넘기기</button><button class="btn on big" data-act="pl-next">${last ? '첫 봄을 연다' : '다음'}</button></div></div>`
}

// ───────── 끝 — 연대기

const HEAD: Readonly<Record<RegionId, string>> = {
  tutorial: '가락 도읍을 쥐었다 — 군장의 일을 다 배웠다',
  'byeonhan-mini': '변한의 바닷가를 차지했다',
  yeongnam: '낙동강의 나라들을 거느렸다',
  south: '삼한의 남쪽에 이름을 떨쳤다',
  world: '삼한과 북녘에 이름을 떨쳤다',
}

/** 이긴 뒤 계속 둬서 도읍을 모두 쥐었을 때 */
const HEAD_ALL: Readonly<Record<RegionId, string>> = {
  tutorial: '두 나라가 한 나라가 됐다',
  'byeonhan-mini': '변한의 바닷가가 한 나라가 됐다',
  yeongnam: '낙동강의 나라들이 하나가 됐다',
  south: '삼한의 남쪽이 하나가 됐다',
  world: '삼한과 북녘이 하나가 됐다',
}

/** 콜라주 자리 — 왼쪽·위·너비 (%) · 기울기. 여섯 장까지 */
const SLOTS: ReadonlyArray<readonly [number, number, number, number]> = [
  [2, 3, 46, -5], [50, 1, 46, 4], [26, 27, 44, -2], [1, 50, 44, 3], [54, 47, 44, -4], [28, 64, 42, 2],
]
/** 도읍을 쥔 장면 — 차례로 돌려 쓴다 */
const TAKE_ART = ['event-night-raid', 'event-eight-harbours', 'event-expedition-return', 'event-goguryeo-hunt'] as const

/**
 * 끝 화면 — 그 판의 큰 장면들이 한 장씩 사진처럼 떨어져 쌓이고, 마지막에 잔치 그림 위로 제목이 뜬다
 * (형: "승리하는건 나중에 문명처럼 영상처럼 … 지금은 이미지 들만 가지고 콜라주같은거로"). 누르면 바로 다 보인다.
 * 이겼으면 "계속 둔다" — 남은 나라까지 (형: "이어서 진행해서 전부 점령하고 싶은 마음도 드네").
 */
export function endingHtml(k: FrontKit, r: Realm, history: History): string {
  const win = r.outcome?.kind === 'win'
  const all = r.unified !== undefined
  const region = r.region ?? 'byeonhan-mini'
  const me = r.player
  const name = (f: string): string => r.factions[f]?.name ?? ''
  const node = (id: string): string => r.nodes[id]?.name ?? ''
  const capOf = new Map(Object.values(r.factions).map((f) => [f.capital, f.id]))
  const events: Array<{ s: number; t: string; big: boolean; img: string; em?: string }> = []
  let won = 0
  let lost = 0
  let found = 0
  let heroes = 0
  let takes = 0
  for (const { s, lines } of history) {
    for (const l of lines) {
      if (l.kind === 'battle') {
        const atkWon = l.outcome === 'rout' || l.outcome === 'win'
        const defWon = l.outcome === 'lose' || l.outcome === 'routed'
        if (l.atkFaction === me) { if (atkWon) won++; else if (defWon) lost++ }
        else if (l.defender === me) { if (defWon) won++; else if (atkWon) lost++ }
      } else if (l.kind === 'take' && l.faction === me) {
        const was = capOf.get(l.node)
        const img = `${k.art}event/${TAKE_ART[takes++ % TAKE_ART.length]}.jpg`
        events.push({ s, t: `${node(l.node)}을(를) 쥐었다`, big: was !== undefined, img, ...(was !== undefined && was !== me ? { em: was } : {}) })
      } else if (l.kind === 'relation' && (l.a === me || l.b === me) && (l.state === 'ally' || l.state === 'truce')) {
        const other = l.a === me ? l.b : l.a
        const img = `${k.art}event/${l.state === 'ally' ? 'event-marriage' : 'event-outside-envoy'}.jpg`
        events.push({ s, t: `${name(other)}과(와) ${l.state === 'ally' ? '동맹을 맺었다' : '화친했다'}`, big: l.state === 'ally', img, em: other })
      } else if (l.kind === 'recruit' && l.faction === me) {
        heroes++
        events.push({ s, t: `${r.heroes[l.hero]?.name ?? '장수'}이(가) 우리 장수가 됐다`, big: false, img: k.bust?.(l.hero) ?? `${k.art}event/event-wanderer-arrives.jpg` })
      } else if (l.kind === 'discover' && l.faction === me) {
        found++
      }
    }
  }
  // 큰일 먼저 — 도읍과 동맹, 그다음 나머지. 계절 순으로
  const ranked = [...events.filter((e) => e.big), ...events.filter((e) => !e.big)]
  const pickd = ranked.slice(0, 9).sort((a, b) => a.s - b.s)
  const shots = ranked.slice(0, SLOTS.length).sort((a, b) => a.s - b.s)
  const years = Math.floor((r.outcome?.season ?? r.season) / 4) + 1
  // 어느 길로 끝났나 — 맹주(진왕)면 제목이 다르다 (VICTORY §1-2)
  const pact = r.outcome?.path === 'suzerain'
  const title = win
    ? (all ? HEAD_ALL[region] : pact ? '진왕이 됐다 — 여러 나라 군장이 우리를 받들었다' : HEAD[region])
    : pact ? `${name(r.outcome?.by ?? '')}이(가) 진왕이 됐다` : '도읍이 무너졌다'
  let h = `<div class="mcard end front-end" data-act="rep-fast"><div class="clg${win ? '' : ' lose'}">`
  shots.forEach((e, i) => {
    const [x, y, w, rot] = SLOTS[i]!
    h += `<figure class="cp" style="--i:${i};left:${x}%;top:${y}%;width:${w}%;--r:${rot}deg"><img src="${e.img}" alt="">`
    h += `${e.em !== undefined ? k.emblem(e.em, 'cpem') : ''}<figcaption><i>${k.esc(seasonLabel(e.s))}</i>${k.esc(e.t)}</figcaption></figure>`
  })
  // 마지막 장 — 잔치(이김) · 가뭄(짐) 위로 제목
  h += `<figure class="cp last" style="--i:${shots.length}"><img src="${k.art}event/${win ? (pact ? 'event-eight-harbours' : 'event-festival') : pact ? 'event-outside-envoy' : 'event-sky-drought'}.jpg" alt=""><figcaption><b>${k.esc(title)}</b></figcaption></figure></div>`
  h += `<div class="after" style="--n:${shots.length + 1}">`
  h += `<p class="mute">${k.emblem(me, 'cem')}${k.esc(name(me))} · ${k.esc(seasonLabel(r.outcome?.season ?? r.season))}${win ? '' : ' — 여기까지였다'}</p>`
  h += `<div class="stats"><span><b>${years}</b>해</span><span><b>${capsHeld(r, me)}</b>도읍</span><span><b>${won}</b>이긴 싸움</span><span><b>${lost}</b>진 싸움</span>`
  h += `${r.known !== undefined ? `<span><b>${found}</b>새로 안 나라</span>` : ''}<span><b>${heroes}</b>얻은 장수</span></div>`
  if (pickd.length > 0) h += `<div class="chron"><h4>연대기</h4>${pickd.map((e) => `<p class="${e.big ? 'big' : ''}"><i>${k.esc(seasonLabel(e.s))}</i>${k.esc(e.t)}</p>`).join('')}</div>`
  h += `<div class="btns">`
  if (win && !all) h += `<button class="btn on" data-act="fr-endless">계속 둔다 · 남은 나라까지</button>`
  h += `<button class="btn${win && !all ? '' : ' on'}" data-act="fr-again">${k.esc(name(me))}로 다시</button><button class="btn" data-act="fr-new">새 판</button>`
  return h + `<button class="btn ghost" data-act="fr-look">지도 둘러보기</button></div></div></div>`
}

export const FRONT_CSS = `
.ap .front { position: absolute; inset: 0; overflow-y: auto; z-index: 5; background: #101318; color: var(--ink); }
.ap .front .fhead { display: flex; align-items: center; gap: 10px; padding: calc(12px + env(safe-area-inset-top)) 14px 4px; max-width: 980px; margin: 0 auto; }
.ap .front .fhead h2 { margin: 0; font-family: 'Gowun Batang', serif; color: var(--gold); font-size: 20px; }
.ap .front .fine { text-align: center; font-size: 12px; color: #8f8778; margin: 10px 16px 20px; }
.ap .front .btn.big { padding: 12px 26px; font-size: 16px; }
/* 첫 화면 */
.ap .front.title { overflow: hidden; display: flex; align-items: flex-end; justify-content: center; }
.ap .front.title .kv { position: absolute; inset: 0; background: center 30% / cover no-repeat; animation: kv 18s ease-out both; }
.ap .front.title .kv::after { content: ''; position: absolute; inset: 0; background: linear-gradient(to bottom, #0000 30%, #0b0d10cc 68%, #0b0d10 100%); }
@keyframes kv { from { transform: scale(1.08); filter: brightness(.6); } 12% { filter: brightness(1); } to { transform: scale(1); } }
.ap .front.title .tv { position: relative; text-align: center; padding: 0 18px calc(26px + env(safe-area-inset-bottom)); max-width: 640px; animation: tv 1.4s .3s ease-out both; }
@keyframes tv { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
.ap .front.title h1 { font-family: 'Gowun Batang', serif; font-size: clamp(44px, 11vw, 76px); margin: 0; color: #f3d48a; letter-spacing: .12em; text-shadow: 0 3px 18px #000c; }
.ap .front.title .sub { margin: 2px 0 8px; color: #e8dcc0; font-size: 14px; letter-spacing: .08em; }
.ap .front.title .hook { margin: 0 auto 16px; color: #cfc6b4; font-size: 13.5px; line-height: 1.6; max-width: 460px; }
.ap .front .fbtns { display: flex; flex-direction: column; align-items: center; gap: 10px; }
.ap .front .cont { display: flex; align-items: center; gap: 12px; width: min(420px, 92vw); padding: 10px 14px; border-radius: 16px; background: #1b2028ee; border: 1px solid #c9a45a; color: var(--ink); font: inherit; text-align: left; cursor: pointer; animation: glow 2.6s ease-in-out infinite alternate; }
@keyframes glow { from { box-shadow: 0 0 0 #c9a45a00; } to { box-shadow: 0 0 22px #c9a45a55; } }
.ap .front .cont .cface { width: 56px; height: 56px; border-radius: 50%; object-fit: cover; object-position: top; border: 2px solid #c9a45a; }
.ap .front .cont .ct { display: flex; flex-direction: column; gap: 2px; } .ap .front .cont .ct b { font-size: 16px; color: #f3d48a; display: flex; align-items: center; gap: 6px; }
.ap .front .cont .ct span { font-size: 13px; color: #d8d0c0; } .ap .front .cont small { font-size: 11px; color: #8f8778; }
.ap .front img.cem { width: 22px; height: 22px; vertical-align: middle; }
/* 판 고르기 */
.ap .front .bcards { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); gap: 12px; padding: 10px 14px; max-width: 980px; margin: 0 auto; }
.ap .front .bcard { display: flex; flex-direction: column; padding: 0; overflow: hidden; border-radius: 16px; background: var(--card); border: 1px solid var(--line); color: var(--ink); font: inherit; text-align: left; cursor: pointer; }
.ap .front .bcard:active, .ap .front .bcard:hover { border-color: var(--gold); }
.ap .front .bth { display: block; height: 120px; background: center / cover no-repeat; }
.ap .front .bb { display: flex; flex-direction: column; gap: 4px; padding: 10px 12px 12px; } .ap .front .bb b { font-size: 17px; color: var(--gold); }
.ap .front .bb span { font-size: 13px; color: #cfc6b4; line-height: 1.5; } .ap .front .bb .bmeta { font-size: 12px; color: #a89c84; }
.ap .front .bcard.locked { cursor: default; } .ap .front .bcard.locked .bth { filter: grayscale(1) brightness(.45); position: relative; }
.ap .front .bcard.locked .bth .lock { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); font-style: normal; font-size: 34px; }
.ap .front .bcard.locked .bb b { color: #8f8778; } .ap .front .bcard.locked .bmeta.lockwhy { color: #e8c070; }
.ap .front .bcard.locked:hover, .ap .front .bcard.locked:active { border-color: var(--line); }
/* 나라 고르기 — 옛 .choose 와 같은 카드 */
.ap .front.choose .ncards { max-width: 980px; margin: 8px auto; padding: 0 14px 24px; }
/* 자세히 */
.ap .front .dcard { display: flex; gap: 16px; max-width: 760px; margin: 10px auto; padding: 0 14px 24px; flex-wrap: wrap; }
.ap .front .dface { width: min(260px, 70vw); aspect-ratio: 1; object-fit: cover; object-position: top; border-radius: 18px; border: 1px solid var(--line); animation: tv .9s ease-out both; }
.ap .front .db { flex: 1; min-width: 240px; } .ap .front .dn { display: flex; align-items: center; gap: 10px; }
.ap .front .dn b { display: block; font-family: 'Gowun Batang', serif; font-size: 26px; color: var(--gold); } .ap .front .dn span { font-size: 13px; color: #a89c84; }
.ap .front img.dem { width: 54px; height: 54px; } .ap .front .blurb { font-size: 14px; line-height: 1.6; }
.ap .front .src { font-size: 12px; color: #8f8778; } .ap .front .hard { color: #e0a080; font-size: 13px; }
/* 서막 */
.ap .prologue { position: absolute; inset: 0; z-index: 70; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 20px 18px;
  background: #e9dfc6 url('__ART__map-world/hanji.webp') center / 520px; color: #2a1d10; animation: plin .6s ease-out both; }
.ap .prologue.out { animation: plout 1.1s ease-in forwards; pointer-events: none; }
@keyframes plin { from { opacity: 0; } to { opacity: 1; } } @keyframes plout { to { opacity: 0; transform: scale(1.04); filter: blur(4px); } }
.ap .prologue .pin { max-width: 680px; width: 100%; font-family: 'Gowun Batang', serif; }
.ap .prologue p { margin: 0 0 14px; line-height: 1.75; font-size: clamp(16px, 2.1vw, 21px); opacity: 0; animation: ink 1.2s ease-out forwards; }
.ap .prologue .pera .l1 { font-size: clamp(26px, 3.6vw, 40px); font-weight: 700; } .ap .prologue .pera .l2 { animation-delay: .9s; } .ap .prologue .pera .l3 { animation-delay: 2s; } .ap .prologue .pera .l4 { animation-delay: 3.4s; color: #7a1f10; }
@keyframes ink { from { opacity: 0; filter: blur(3px); transform: translateY(6px); } to { opacity: 1; filter: none; transform: none; } }
.ap .prologue .pyou { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; justify-content: center; }
.ap .prologue .pface { width: min(220px, 56vw); aspect-ratio: 1; object-fit: cover; object-position: top; border-radius: 50%; border: 3px solid #2a1d10; box-shadow: 0 6px 30px #2a1d1055; animation: ink 1s ease-out both; }
.ap .prologue .pt { flex: 1; min-width: 220px; } .ap .prologue .pt > b { font-size: 30px; display: inline-block; vertical-align: middle; margin-left: 6px; }
.ap .prologue img.pem { width: 48px; height: 48px; vertical-align: middle; } .ap .prologue .pt > span { display: block; color: #6a5634; margin: 2px 0 8px; }
.ap .prologue .pt p { animation-delay: .5s; font-size: 15px; } .ap .prologue .who { animation-delay: .3s !important; }
.ap .prologue .pgoal .gl { font-size: clamp(20px, 2.6vw, 28px); text-align: center; } .ap .prologue .pgoal .gl b { font-size: 1.6em; color: #7a1f10; } .ap .prologue .pgoal .gl small { font-size: 14px; color: #6a5634; }
.ap .prologue .ways { display: grid; gap: 10px; margin: 6px 0 14px; }
.ap .prologue .way { display: grid; grid-template-columns: 48px 56px 1fr; align-items: center; gap: 8px; opacity: 0; animation: ink 1s ease-out forwards; font-size: clamp(14px, 1.8vw, 17px); }
.ap .prologue .way:nth-child(1) { animation-delay: .6s; } .ap .prologue .way:nth-child(2) { animation-delay: 1.2s; } .ap .prologue .way:nth-child(3) { animation-delay: 1.8s; }
.ap .prologue .wic { width: 40px; height: 40px; } .ap .prologue .way b { font-size: 16px; }
.ap .prologue .ptip { font-size: 14px; text-align: center; animation-delay: 2.4s; color: #4a3a28; }
.ap .prologue .pnav { display: flex; align-items: center; gap: 10px; margin-top: 18px; }
.ap .prologue .pdots i { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #2a1d1033; margin: 0 3px; } .ap .prologue .pdots i.on { background: #7a1f10; }
.ap .prologue .btn.ghost { color: #4a3a28; border-color: #4a3a2855; }
/* 지도가 열린다 — 한지가 걷히고 본 땅이 번진다 */
.ap.opening .map { animation: mapin 2.4s cubic-bezier(.2, .8, .3, 1) both; }
@keyframes mapin { from { transform: scale(.82); filter: sepia(.6) brightness(1.15); } to { transform: none; filter: none; } }
.ap.opening .map svg mask g path { animation: rv 2.6s .3s ease-out both; }
/* 끝 */
.ap .front-end .stats { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin: 8px 0; }
.ap .front-end .stats span { min-width: 64px; padding: 6px 8px; border-radius: 10px; background: #ffffff0d; text-align: center; font-size: 12px; color: #a89c84; }
.ap .front-end .stats b { display: block; font-size: 20px; color: var(--gold); }
.ap .front-end .chron { text-align: left; margin: 8px 0; } .ap .front-end .chron h4 { margin: 4px 0; color: var(--gold); }
.ap .front-end .clg { position: relative; aspect-ratio: 4 / 3.3; margin: -4px -4px 6px; border-radius: 12px; overflow: hidden;
  background: #d9c8a0 url('__ART__map-world/hanji.webp') center / 320px; box-shadow: inset 0 0 40px #5a4020aa; }
.ap .front-end .clg.lose { filter: grayscale(.55) brightness(.85); }
.ap .front-end .cp { position: absolute; margin: 0; padding: 5px 5px 0; background: #f6eedb; box-shadow: 0 6px 18px #000a; border-radius: 3px;
  opacity: 0; transform: rotate(var(--r)); animation: cpin .8s cubic-bezier(.2, 1.3, .4, 1) calc(var(--i) * 1.1s + .4s) both; }
.ap .front-end .cp img { display: block; width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 2px; }
.ap .front-end .cp img.cpem { position: absolute; right: -6px; top: -8px; width: 26%; aspect-ratio: 1; object-fit: contain; filter: drop-shadow(0 2px 3px #000a); }
.ap .front-end .cp figcaption { font-size: 11px; color: #3a2a18; padding: 3px 2px 5px; line-height: 1.3; text-align: left; }
.ap .front-end .cp figcaption i { font-style: normal; color: #8a6a40; margin-right: 4px; }
.ap .front-end .cp.last { left: 8%; top: 14%; width: 84%; height: 72%; z-index: 2; --r: 0deg; padding: 0; background: none; border-radius: 12px; overflow: hidden;
  animation: cplast 1.4s ease-out calc(var(--i) * 1.1s + .6s) both; }
.ap .front-end .cp.last img { aspect-ratio: auto; height: 100%; }
.ap .front-end .cp.last figcaption { position: absolute; left: 0; right: 0; bottom: 0; padding: 26px 10px 10px; text-align: center; background: linear-gradient(#0000, #000c); }
.ap .front-end .cp.last b { font-family: 'Gowun Batang', serif; font-size: clamp(20px, 5.4vw, 28px); color: #f3d48a; text-shadow: 0 2px 8px #000; }
.ap .front-end .after { animation: bkin .7s ease-out calc(var(--n) * 1.1s + 1.4s) both; }
@keyframes cpin { from { opacity: 0; transform: scale(1.5) rotate(0deg); } to { opacity: 1; transform: rotate(var(--r)); } }
@keyframes cplast { from { opacity: 0; transform: scale(1.12); } to { opacity: 1; transform: none; } }
.ap .modal.fast .front-end .cp, .ap .modal.fast .front-end .after { animation-delay: 0s !important; animation-duration: .01s !important; }
@media (prefers-reduced-motion: reduce) { .ap .front-end .cp, .ap .front-end .after { animation-delay: 0s !important; animation-duration: .01s !important; } }
.ap .front-end .chron p { margin: 3px 0; font-size: 13px; } .ap .front-end .chron p.big { color: #f3d48a; } .ap .front-end .chron i { font-style: normal; color: #8f8778; margin-right: 6px; }
.ap .lookbar { position: absolute; top: calc(8px + env(safe-area-inset-top)); left: 50%; transform: translateX(-50%); z-index: 40; display: flex; gap: 8px; align-items: center;
  padding: 6px 10px; border-radius: 12px; background: #14181ee8; border: 1px solid #8a7040; font-size: 13px; }
@media (prefers-reduced-motion: reduce) { .ap .front.title .kv, .ap .prologue p, .ap .prologue .way, .ap.opening .map { animation-duration: .01s !important; animation-delay: 0s !important; } }
`
