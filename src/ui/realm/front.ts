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
import { badgeRank, lockWhy } from './unlock.ts'
import { CHAPTERS, chapterOfRegion } from '../../realm/data/campaign.ts'
import { seasonOf } from '../../realm/calendar.ts'
import { battleName, josa, seasonLabel } from '../../realm/data/prose.ts'
import type { Realm, RegionId, ReportLine } from '../../realm/types.ts'
import { P } from '../../tune/params.ts'
import { winFxHtml } from './winfx.ts'

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
  /** 그 나라로 이긴 가장 높은 난세 단계 — 휘장 (unlock.nationWon). 없으면 0 */
  readonly won?: (region: RegionId, nation: string) => number
}

/** 지난 계절들의 보고 — 판 기록에서 (realm-main) */
export type History = ReadonlyArray<{ readonly s: number; readonly lines: readonly ReportLine[] }>

/**
 * 판 — 해 보고 싶은 이야기 묶음 (형 2026-10-22: "지도가 작냐 크냐가 중요한게 아님 … 게임 패키지처럼 정말 이거 해보고싶다라는 마음이 들게
 * 각각 이미지랑 제목 제대로"). 제목 · 때와 곳 · 한 줄 이야기 · 무엇을 하나 · 그림(keyart — 제미나이). 나라 수·길이는 아래 작은 표로.
 */
export const BOARDS: ReadonlyArray<{ id: RegionId; name: string; era: string; hook: string; play: string; art: string; length: string; badge?: string }> = [
  {
    id: 'tutorial', name: '형제의 강', era: '기원전 18년 · 한강', art: 'keyart/tutorial.jpg', length: '아주 짧다', badge: '처음이면 여기부터',
    hook: '졸본을 떠나온 두 형제. 형은 바다로, 아우는 강으로 — 한강의 주인은 하나다.',
    play: '온조가 되어 형 비류의 미추홀을 아우른다. 징병부터 사로잡기까지 하나씩 배운다.',
  },
  {
    id: 'byeonhan-mini', name: '쇠의 바다', era: '2세기 · 변한 남쪽 바닷가', art: 'keyart/byeonhan.jpg', length: '짧다',
    hook: '덩이쇠 한 장이 곧 돈이던 바다. 쇠를 쥔 나라가 뱃길을 쥔다.',
    play: '변한 여섯 나라 가운데 하나로 쇠와 뱃길을 다툰다.',
  },
  {
    id: 'yeongnam', name: '낙동강 스물한 나라', era: '2세기 · 낙동강', art: 'keyart/yeongnam.jpg', length: '보통',
    hook: '훗날 신라가 될 사로도, 가야가 될 가락도 아직은 강가의 작은 나라였다.',
    play: '스물한 나라 가운데 하나로 강을 오르내리며 판을 넓힌다.',
  },
  {
    id: 'south', name: '삼한', era: '3세기 · 한강에서 영산강까지', art: 'keyart/south.jpg', length: '길다',
    hook: '천군이 소도에서 하늘에 제사하던 땅. 마한·진한·변한 서른여섯 나라가 깃발을 올렸다.',
    play: '처음엔 이웃만 안다 — 보고 다닌 만큼 지도가 칠해진다.',
  },
  {
    id: 'world', name: '북녘의 바람', era: '3세기 · 탐라에서 부여의 들까지', art: 'keyart/world.jpg', length: '아주 길다',
    hook: '압록 골짜기의 고구려 다섯 나부와 송화강 들의 부여 네 가가 남쪽을 내려다본다.',
    play: '쉰두 나라 — 요동·옥저·동해의 우산국까지. 가장 긴 판.',
  },
]

/** 이기려면 쥘 도읍 수 (season.ts checkOutcome 과 같은 값) */
export function winNeed(region: RegionId): number {
  if (region === 'tutorial') return 2 // 배우는 판 — 미추홀 도읍 하나 (제 도읍 포함 둘)
  return region === 'yeongnam' ? P.realm.winCapitalsYeongnam : region === 'south' ? P.realm.winCapitalsSouth : region === 'world' ? P.realm.winCapitalsWorld : P.realm.winCapitals
}

const capsHeld = (r: Realm, f: string): number => Object.values(r.factions).filter((x) => r.nodes[x.capital]?.owner === f).length

// ───────── 첫 화면

export function titleHtml(k: FrontKit, r: Realm | null, savedAt: string | null, links = '', firstTime = false, more = ''): string {
  // 로비 — 산마루에서 내려다본 일흔여덟 나라의 땅 · 로고는 청동 거울과 맥궁의 문장 + 붓글씨 (형: "게임 로고랑 파비콘, 로비 배경은 좀 제대로")
  let h = `<div class="front title"><div class="kv" style="background-image:url('${k.art}title/title-lobby.jpg')"></div><div class="tv">`
  // 로고 밑엔 단추만 — 설명 글은 걷었다 (형 10-23: "로고 밑에 텍스트 설명 너무 많음. 다른 명작 게임들에서는 그런 거 없잖아")
  h += `<div class="logo"><img class="lemb" src="${k.art}logo/emblem.png" alt=""><h1>칠십팔국</h1></div>`
  h += `<div class="fbtns">`
  if (r !== null && (!r.outcome || (r.endless === true && r.outcome.kind === 'win'))) {
    const me = r.player
    const region = r.region ?? 'byeonhan-mini'
    const name = r.factions[me]?.name ?? ''
    h += `<button class="cont" data-act="continue">${k.face(me, 'cface')}<span class="ct"><b>${k.emblem(me, 'cem')}${k.esc(name)} 이어 하기</b>`
    h += `<span>${k.esc(seasonLabel(r.season))} · 도읍 ${capsHeld(r, me)}/${winNeed(region)}${r.known !== undefined ? ` · 아는 나라 ${(r.known[me]?.length ?? 0) + 1}/${Object.keys(r.factions).length}` : ''}</span>`
    h += `${savedAt !== null ? `<small>최근 저장 · ${k.esc(agoText(savedAt))}</small>` : ''}</span></button>`
  }
  // 처음 켠 사람은 배우는 판으로 (형: "맨 위 첫번째 할 게임은 1:1수준으로 여러 기능 익혀가며 쉽게")
  if (firstTime) h += `<button class="btn pri big" data-act="fr-tutorial">처음이면 — 배우는 판부터</button><button class="btn big" data-act="fr-new">새 판</button>${more}</div>`
  else h += `<button class="btn pri big" data-act="fr-new">새 판</button>${more}</div>`
  return h + `${links}</div></div>`
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
export function boardHtml(k: FrontKit, hasGame: boolean, unlocked?: ReadonlySet<RegionId>, tierWon?: (r: RegionId) => number): string {
  let h = `<div class="front boards"><div class="fhead"><button class="btn ghost" data-act="fr-back">‹ 처음으로</button><h2>어느 이야기로 시작할까</h2></div>`
  const names = Object.fromEntries(BOARDS.map((b) => [b.id, b.name])) as Partial<Record<RegionId, string>>
  // 캠페인 — 사료의 사건 하나가 한 장 (CAMPAIGN.md · 형: "문명처럼 … 특수한 승리조건"). 장은 배우는 차례로 열린다
  h += `<h3 class="bsec"><b>캠페인</b><span>삼국의 새벽 — 사서에 남은 일을 그 사람이 되어</span></h3><div class="bcards chaps">`
  CHAPTERS.forEach((c, i) => {
    const prev = CHAPTERS[i - 1]
    const ready = c.region !== null
    const open = ready && (unlocked === undefined || unlocked.has(c.region!))
    const why = !ready ? '짓는 중 — 곧 열린다' : prev !== undefined ? `앞 장 「${prev.name}」에서 이기면 열린다` : lockWhy(c.region!, names)
    const peek = `<span class="peek"><small>${c.n}장 · ${k.esc(c.era)}</small><b>${k.esc(c.name)}</b><span class="ph">${k.esc(c.hook)}</span>`
      + `<span class="pp">${k.esc(c.hero)} — ${k.esc(c.goal)}</span></span>`
    h += `<button class="bcard chap${open ? '' : ' locked'}" ${open ? `data-act="fr-board" data-v="${c.region}"` : 'data-act="fr-locked"'} data-peek><span class="bth" style="background-image:url('${k.art}${c.art}')">`
    h += `<i class="bbadge">${c.n}장</i>${open ? '' : '<i class="lock">🔒</i>'}<span class="btitle"><small>${k.esc(c.era)} · ${k.esc(c.hero)}</small><b>${k.esc(c.name)}</b>${open ? '' : `<em>${k.esc(why)}</em>`}</span></span>${peek}</button>`
  })
  h += `</div><h3 class="bsec"><b>자유 판</b><span>나라 하나를 골라 마음대로 — 정복 · 맹주 · 철과 뱃길 · 큰 제사</span></h3><div class="bcards">`
  for (const b of BOARDS) {
    if (CHAPTERS.some((c) => c.region === b.id)) continue // 장으로 올라간 판
    const open = unlocked === undefined || unlocked.has(b.id)
    // 카드는 그림 · 때 · 제목만 — 이야기와 작은 표는 펼침(길게 누르기 · 마우스 올리기 — tips.ts)으로
    const goal = b.id === 'tutorial' ? '미추홀 도읍을 쥐면 끝' : `도읍 ${winNeed(b.id)}곳을 쥐면 이긴다`
    const won = b.id !== 'tutorial' && (tierWon?.(b.id) ?? 0) > 0 ? `<i>난세 ${tierWon!(b.id)}단계까지 이겼다</i>` : ''
    const peek = `<span class="peek"><small>${k.esc(b.era)}</small><b>${k.esc(b.name)}</b><span class="ph">${k.esc(b.hook)}</span><span class="pp">${k.esc(b.play)}</span>`
      + `<span class="pm"><i>나라 ${k.nations(b.id).length}</i><i>${goal}</i><i>한 판이 ${b.length}</i>${won}</span></span>`
    h += `<button class="bcard${open ? '' : ' locked'}" data-act="${open ? 'fr-board' : 'fr-locked'}" data-v="${b.id}" data-peek><span class="bth" style="background-image:url('${k.art}${b.art}')">`
    h += `${b.badge !== undefined && open ? `<i class="bbadge">${k.esc(b.badge)}</i>` : ''}${open ? '' : '<i class="lock">🔒</i>'}<span class="btitle"><small>${k.esc(b.era)}</small><b>${k.esc(b.name)}</b>${open ? '' : `<em>${k.esc(lockWhy(b.id, names))}</em>`}</span></span>${peek}</button>`
  }
  h += `</div>${hasGame ? '<p class="fine">새 판을 시작하면 지금 판은 끝난 판으로 기록된다.</p>' : ''}</div>`
  return h
}

// ───────── 나라 고르기 · 자세히

export function nationsHtml(k: FrontKit, region: RegionId): string {
  const b = BOARDS.find((x) => x.id === region)!
  const all = k.nations(region)
  const wonN = all.filter((n) => (k.won?.(region, n.id) ?? 0) > 0).length
  let h = `<div class="front choose"><div class="fhead"><button class="btn ghost" data-act="fr-new">‹ 이야기 고르기</button><h2>「${k.esc(b.name)}」 — 어느 나라로</h2>`
  if (wonN > 0) h += `<span class="wonc">휘장 ${wonN}/${all.length}</span>`
  h += `</div><div class="ncards">`
  for (const n of all) {
    const w = k.won?.(region, n.id) ?? 0
    h += `<button class="ncard pick" data-act="fr-nation" data-id="${n.id}">${k.face(n.id, 'nface')}<div class="nb">`
    h += `<div class="an">${k.emblem(n.id)}<b>${k.esc(n.name)}</b><span class="mute">${k.esc(n.place)}</span>${n.hard ? '<span class="hard">어려움</span>' : ''}${w > 0 ? `<span class="wonb r${badgeRank(w)}">휘장 · 난세 ${w}</span>` : ''}</div>`
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

export function detailHtml(k: FrontKit, region: RegionId, id: string, carry = ''): string {
  const n = k.nations(region).find((x) => x.id === id)
  if (n === undefined) return nationsHtml(k, region)
  let h = `<div class="front detail"><div class="fhead"><button class="btn ghost" data-act="fr-board" data-v="${region}">‹ 다른 나라</button></div>`
  h += `<div class="dcard">${k.face(id, 'dface')}<div class="db"><div class="dn">${k.emblem(id, 'dem')}<div><b>${k.esc(n.name)}</b><span>${k.esc(n.place)}</span></div></div>`
  h += `<p class="blurb">${k.esc(n.blurb)}</p>${barsHtml(n)}`
  h += `<p class="src">${k.esc(n.source)}</p>${n.hard ? '<p class="hard">어려운 나라다 — 처음이면 다른 나라를 권한다.</p>' : ''}`
  h += `${carry}<button class="btn pri big" data-act="fr-start" data-id="${id}">이 나라로 시작</button></div></div></div>`
  return h
}

// ───────── 서막 — 시대 · 우리 나라 · 할 일

const ERA: Readonly<Record<RegionId, string>> = {
  tutorial: '한강 아래. 졸본에서 내려온 형제 가운데 형 비류는 바닷가 미추홀에, 아우 온조는 하남 위례성에 자리 잡았다 — 형제의 두 나라에서 군장의 일을 하나씩 배운다.',
  'byeonhan-mini': '변한의 남쪽 바닷가. 쇠를 캐고 배를 띄우는 여섯 나라가 서로를 엿본다.',
  yeongnam: '낙동강 물길을 따라 스물한 나라. 훗날 신라가 될 사로도, 가야가 될 가락과 대가야도 아직은 이웃 읍락과 키를 잰다.',
  south: '한강에서 영산강, 동해 바닷가까지. 마한·진한·변한의 서른여섯 나라가 저마다 깃발을 올렸다.',
  world: '탐라에서 부여의 들까지. 압록강 골짜기에서는 고구려 다섯 나부가, 송화강 들에서는 부여의 네 가가 말을 달린다.',
}

export const PROLOGUE_STEPS = 3

/** 지난 판에서 따라온 장수 (계승 가신 — legacy.ts) */
function carriedHtml(k: FrontKit, r: Realm): string {
  const ids = r.retainers ?? []
  if (ids.length === 0) return ''
  const faces = ids.map((id) => { const src = k.bust?.(id) ?? null; return src !== null ? `<img src="${src}" alt="">` : '' }).join('')
  const names = ids.map((id) => r.heroes[id]?.name ?? '').filter((x) => x !== '')
  return `<p class="carried">${faces}<span>지난 판에서 <b>${k.esc(josa(names.join(' · '), '이', '가'))}</b> 따라왔다</span></p>`
}

export function prologueHtml(k: FrontKit, r: Realm, step: number): string {
  const region = r.region ?? 'byeonhan-mini'
  const me = r.player
  const f = r.factions[me]
  const n = k.nations(region).find((x) => x.id === me)
  const ruler = f?.ruler !== undefined ? r.heroes[f.ruler] : undefined
  let body = ''
  if (step === 0) {
    // 배우는 판은 백제가 서던 해 — 『삼국사기』 온조왕 원년 (기원전 18)
    const [when, age] = region === 'tutorial' ? ['기원전 18년.', '옛 조선이 무너진 지 아흔 해, 주몽이 졸본에 고구려를 세운 무렵.'] : ['기원 2세기.', '옛 조선이 무너진 지 삼백 년, 왕이 하나가 아니던 때.']
    body = `<div class="pl pera"><p class="l1">${when}</p><p class="l2">${age}</p>`
      + `<p class="l3">${k.esc(ERA[region])}</p>`
      + `<p class="l4">${r.known !== undefined ? '그러나 너는 아직 이웃밖에 모른다. 지도는 빈 한지다.' : '저마다 제 도읍을 지키며, 남의 도읍을 넘본다.'}</p></div>`
  } else if (step === 1) {
    body = `<div class="pl pyou">${k.face(me, 'pface')}<div class="pt">${k.emblem(me, 'pem')}<b>${k.esc(f?.name ?? '')}</b>`
      + `<span>${k.esc(n?.place ?? '')}</span>${ruler !== undefined ? `<p class="who">군장 <b>${k.esc(ruler.name)}</b></p>` : ''}`
      + `<p>${k.esc(n?.blurb ?? '')}</p>${carriedHtml(k, r)}</div></div>`
  } else {
    const need = winNeed(region)
    const ways: Array<[string, string, string]> = [
      ['unit-spear', '군대', '징병해 군대를 세우고, 이웃 고을을 쳐서 쥔다'],
      ['good-tribute-bell', '사신', '화친·동맹·교역 — 적의 적은 벗이 된다'],
      [r.known !== undefined ? 'unit-scouts' : 'status-spy', r.known !== undefined ? '정찰' : '첩자', r.known !== undefined ? '정찰꾼과 군대가 다닌 만큼 지도가 밝아진다' : '적의 군세와 속셈을 엿본다'],
    ]
    // 캠페인의 장이면 그 장의 목표를 (CAMPAIGN.md)
    const ch = chapterOfRegion(region)
    const head = ch !== undefined ? `<small class="gch">${ch.n}장 · ${k.esc(ch.name)}</small>${k.esc(ch.goal)}.` : `도읍 <b>${need}</b>곳을 쥐면 이긴다.`
    body = `<div class="pl pgoal"><p class="gl">${head}<br><small>우리 도읍을 잃으면 진다.</small></p><div class="ways">`
      + ways.map(([ic, t, d]) => `<div class="way">${k.icon(ic, 'wic')}<b>${t}</b><span>${d}</span></div>`).join('')
      + `</div><p class="ptip">한 계절에 명령을 정하고 <b>다음 계절</b>을 누른다. 모든 나라가 한꺼번에 움직인다.</p></div>`
  }
  const dots = Array.from({ length: PROLOGUE_STEPS }, (_, i) => `<i class="${i === step ? 'on' : ''}"></i>`).join('')
  const last = step >= PROLOGUE_STEPS - 1
  return `<div class="prologue s${step}"><div class="pin">${body}</div><div class="pnav"><span class="pdots">${dots}</span>`
    + `<button class="btn ghost" data-act="pl-skip">넘기기</button><button class="btn pri big" data-act="pl-next">${last ? '첫 봄을 연다' : '다음'}</button></div></div>`
}

// ───────── 끝 — 연대기

const HEAD: Readonly<Record<RegionId, string>> = {
  tutorial: '미추홀 도읍을 쥐었다 — 군장의 일을 다 배웠다',
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

/** 끝 화면 필름에 거는 장면 수 (마지막 제목 장 빼고) */
const SHOTS = 6
/** 필름 한 장이 머무는 때 (초) · 다음 장과 겹치는 때 · 첫 장이 뜨기까지 — FRONT_CSS 의 --film 과 같은 수 */
const FILM_S = 4.2
const FILM_OVERLAP_S = 0.9
const FILM_LEAD_S = 0.5
/** 도읍을 쥔 장면 — 차례로 돌려 쓴다 */
const TAKE_ART = ['event-night-raid', 'event-eight-harbours', 'event-expedition-return', 'event-goguryeo-hunt'] as const

/**
 * 끝 화면 — 그 판의 큰 장면들이 **영화 필름처럼** 어두운 화면에 한 장씩 떠올랐다 사라지고, 마지막에 잔치 그림 위로 제목이 뜬다
 * (형: "사진콜라주 좀 별로인거같고 너무빨라서 읽을수가 없음. 영화 필름처럼 어두운 배경에서 페이드인아웃").
 * 한 장에 글을 읽을 만큼 머문다. 누르면 마지막 장으로 바로 간다.
 * 이겼으면 "계속하기 (무한 모드)" — 남은 나라까지 (형: "이어서 진행해서 전부 점령하고 싶은 마음도 드네").
 * 화면 전체를 덮고, 마지막 장에서 「승리」가 쾅 박히며 불티가 튄다 (형 10-23: "창이 화면 전체로 · 승리면 승리라고 제대로").
 * 다 돌고 나면 ‹ › 로 지나간 장면을 다시 넘겨 본다 (형: "방금 지나간 역사 슬라이드들도 버튼 눌러서 샥샥").
 */
export function endingHtml(k: FrontKit, r: Realm, history: History, keep = ''): string {
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
        const ourWin = (l.atkFaction === me && atkWon) || (l.defender === me && defWon)
        if (l.atkFaction === me) { if (atkWon) won++; else if (defWon) lost++ }
        else if (l.defender === me) { if (defWon) won++; else if (atkWon) lost++ }
        // 이긴 싸움은 그 이름으로 연대기에 (형: "황산벌전투 옥포해전 … 그지역들을따서") — 크게 이겼거나 적장을 잡았으면 큰일
        if (ourWin && r.nodes[l.node] !== undefined) {
          const caught = l.captured !== null ? r.heroes[l.captured] : undefined
          const big = l.outcome === 'rout' || l.outcome === 'routed' || caught !== undefined
          const art = caught !== undefined ? 'event-capture' : l.approach === 'night' ? 'event-night-raid' : l.via === 'ford' || l.via === 'reeds' ? 'event-monsoon-ford' : seasonOf(s) === 'winter' ? 'event-winter-ambush' : 'event-expedition-return'
          const t = `${battleName(r, l)} — ${big ? '크게 이겼다' : '이겼다'}${caught !== undefined ? ` · ${josa(caught.name, '을', '를')} 사로잡았다` : ''}`
          const foe = l.atkFaction === me ? l.defender : l.atkFaction
          events.push({ s, t, big, img: `${k.art}event/${art}.jpg`, ...(foe !== undefined ? { em: foe } : {}) })
        }
      } else if (l.kind === 'take' && l.faction === me) {
        const was = capOf.get(l.node)
        const img = `${k.art}event/${TAKE_ART[takes++ % TAKE_ART.length]}.jpg`
        events.push({ s, t: `${josa(node(l.node), "을", "를")} 쥐었다`, big: was !== undefined, img, ...(was !== undefined && was !== me ? { em: was } : {}) })
      } else if (l.kind === 'relation' && (l.a === me || l.b === me) && (l.state === 'ally' || l.state === 'truce')) {
        const other = l.a === me ? l.b : l.a
        const img = `${k.art}event/${l.state === 'ally' ? 'event-alliance-oath' : 'event-outside-envoy'}.jpg`
        events.push({ s, t: `${josa(name(other), '과', '와')} ${l.state === 'ally' ? '동맹을 맺었다' : '화친했다'}`, big: l.state === 'ally', img, em: other })
      } else if (l.kind === 'recruit' && l.faction === me) {
        heroes++
        events.push({ s, t: `${josa(r.heroes[l.hero]?.name ?? '장수', '이', '가')} 우리 장수가 됐다`, big: false, img: k.bust?.(l.hero) ?? `${k.art}event/event-wanderer-arrives.jpg` })
      } else if (l.kind === 'discover' && l.faction === me) {
        found++
      }
    }
  }
  // 큰일 먼저 — 도읍과 동맹, 그다음 나머지. 계절 순으로
  const ranked = [...events.filter((e) => e.big), ...events.filter((e) => !e.big)]
  const pickd = ranked.slice(0, 9).sort((a, b) => a.s - b.s)
  const shots = ranked.slice(0, SHOTS).sort((a, b) => a.s - b.s)
  const years = Math.floor((r.outcome?.season ?? r.season) / 4) + 1
  // 어느 길로 끝났나 — 맹주(진왕)면 제목이 다르다 (VICTORY §1-2)
  const path = r.outcome?.path
  const by = name(r.outcome?.by ?? '')
  const PATH_WIN: Partial<Record<string, string>> = {
    suzerain: '진왕이 됐다 — 여러 나라 군장이 우리를 받들었다',
    ironsea: '변진의 쇠가 우리 뱃길로 흘렀다',
    rite: '온 나라가 모여 하늘에 절했다',
  }
  const PATH_LOSE: Partial<Record<string, string>> = {
    suzerain: `${josa(by, '이', '가')} 진왕이 됐다`,
    ironsea: `${by}의 뱃길로 변진의 쇠가 흘렀다`,
    rite: `온 나라가 ${by}의 큰 제사에 절했다`,
  }
  const title = win
    ? (all ? HEAD_ALL[region] : (path !== undefined ? PATH_WIN[path] : undefined) ?? HEAD[region])
    : (path !== undefined ? PATH_LOSE[path] : undefined) ?? '도읍이 무너졌다'
  // 마지막 장 그림 — 길마다
  const lastArt = win
    ? (path === 'suzerain' ? 'event-eight-harbours' : path === 'ironsea' ? 'event-iron-trade' : path === 'rite' ? 'event-yeonggo' : 'event-festival')
    : (path === 'suzerain' || path === 'ironsea' ? 'event-outside-envoy' : path === 'rite' ? 'event-divination' : 'event-sky-drought')
  let h = `<div class="mcard end front-end" data-act="rep-fast"><div class="clg film${win ? '' : ' lose'}" style="--n:${shots.length + 1}">`
  shots.forEach((e, i) => {
    // 홀수 장은 반대로 천천히 민다 (켄 번스)
    h += `<figure class="cp${i % 2 === 1 ? ' odd' : ''}" style="--i:${i}"><img src="${e.img}" alt="">`
    h += `<figcaption>${e.em !== undefined ? k.emblem(e.em, 'cpem') : ''}<i>${k.esc(seasonLabel(e.s))}</i><span>${k.esc(e.t)}</span></figcaption></figure>`
  })
  // 마지막 장 — 잔치(이김) · 가뭄(짐) 위로 제목
  h += `<figure class="cp last" style="--i:${shots.length}"><img src="${k.art}event/${lastArt}.jpg" alt=""><figcaption><b>${k.esc(title)}</b></figcaption></figure>`
  h += winFxHtml(win ? '승리' : '패배', '', shots.length * (FILM_S - FILM_OVERLAP_S) + FILM_LEAD_S + 0.6, !win)
  h += `<span class="skip">누르면 넘긴다</span>`
  h += `<button class="fnav fprev" data-act="film-prev" aria-label="앞 장면">‹</button><button class="fnav fnext" data-act="film-next" aria-label="다음 장면">›</button></div>`
  h += `<div class="after" style="--n:${shots.length + 1}">`
  h += `<p class="mute">${k.emblem(me, 'cem')}${k.esc(name(me))} · ${k.esc(seasonLabel(r.outcome?.season ?? r.season))}${win ? '' : ' — 여기까지였다'}</p>`
  h += `<div class="stats"><span><b>${years}</b>해</span><span><b>${capsHeld(r, me)}</b>도읍</span><span><b>${won}</b>이긴 싸움</span><span><b>${lost}</b>진 싸움</span>`
  h += `${r.known !== undefined ? `<span><b>${found}</b>새로 안 나라</span>` : ''}<span><b>${heroes}</b>얻은 장수</span></div>`
  if (pickd.length > 0) h += `<div class="chron"><h4>연대기</h4>${pickd.map((e) => `<p class="${e.big ? 'big' : ''}"><i>${k.esc(seasonLabel(e.s))}</i>${k.esc(e.t)}</p>`).join('')}</div>`
  h += `${keep}<div class="btns">`
  if (win && !all) h += `<button class="btn pri" data-act="fr-endless">계속하기 (무한 모드)<small>남은 나라까지 이어서 한다</small></button>`
  h += `<button class="btn${win && !all ? '' : ' pri'}" data-act="fr-again">${k.esc(josa(name(me), "으로", "로"))} 다시</button><button class="btn" data-act="fr-new">새 판</button>`
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
.ap .front.title .kv { position: absolute; inset: 0; background: center 40% / cover no-repeat; animation: kv 18s ease-out both; }
.ap .front.title .kv::after { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse 60% 55% at 50% 52%, #0b0d1066, #0000 70%), linear-gradient(to bottom, #0000 35%, #0b0d10b3 70%, #0b0d10 100%); }
@keyframes kv { from { transform: scale(1.08); filter: brightness(.6); } 12% { filter: brightness(1); } to { transform: scale(1); } }
/* 폰 세로 — 가로 그림을 세로로 잘라 쓰면 가운데 한 토막만 보인다. 그림을 제 비율대로 두고 왼쪽 끝에서 오른쪽 끝까지
   천천히 흘렀다가 되돌아온다 (형: "좌에서 우로 흘러가듯 · 천천히 · 우측끝 도달하면 돌아오고"). 어둡게 깔기는 세로 띠로만 — 그림과 함께 움직여도 티가 안 난다 */
@media (orientation: portrait) {
  .ap .front.title .kv { right: auto; width: auto; height: 100%; aspect-ratio: 16 / 9; background-position: center; will-change: transform;
    animation: kvlit 2.4s ease-out both, kvpan 75s ease-in-out infinite alternate; }
  .ap .front.title .kv::after { background: linear-gradient(to bottom, #0b0d1040, #0000 25%, #0000 35%, #0b0d10b3 68%, #0b0d10 100%); }
}
@keyframes kvlit { from { filter: brightness(.6); } to { filter: brightness(1); } }
@keyframes kvpan { from { transform: translateX(0); } to { transform: translateX(calc(100vw - 100%)); } }
@media (orientation: portrait) and (prefers-reduced-motion: reduce) { .ap .front.title .kv { animation: kvlit 2.4s ease-out both; transform: translateX(calc((100vw - 100%) / 2)); } }
.ap .front.title .tv { position: relative; text-align: center; padding: 0 18px calc(26px + env(safe-area-inset-bottom)); max-width: 640px; animation: tv 1.4s .3s ease-out both; }
@keyframes tv { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
/* 로고 — 문장(청동 거울·맥궁) 위에 붓글씨 이름. 금빛 그러데이션 글자 + 어두운 테 · 문장은 숨 쉬듯 빛난다 */
.ap .front.title .logo { position: relative; display: flex; flex-direction: column; align-items: center; margin-bottom: 2px; }
.ap .front.title .lemb { width: clamp(84px, 16vw, 128px); aspect-ratio: 1; filter: drop-shadow(0 4px 14px #000d) drop-shadow(0 0 18px #e8b85a55); animation: lemb 4.5s ease-in-out infinite; }
@keyframes lemb { 0%, 100% { filter: drop-shadow(0 4px 14px #000d) drop-shadow(0 0 14px #e8b85a40); } 50% { filter: drop-shadow(0 4px 14px #000d) drop-shadow(0 0 26px #f0c86a88); } }
.ap .front.title h1 { font-family: 'East Sea Dokdo', var(--display); font-weight: 400; font-size: clamp(72px, 17vw, 132px); line-height: .9; margin: -6px 0 0; letter-spacing: .04em;
  background: linear-gradient(#fff4cc 10%, #f0c86a 48%, #b07a2c 80%, #7a4e18); -webkit-background-clip: text; background-clip: text; color: transparent;
  filter: drop-shadow(0 2px 0 #2a1606) drop-shadow(0 6px 16px #000e); }
@media (prefers-reduced-motion: reduce) { .ap .front.title .lemb { animation: none; } }
.ap .front.title .sub { margin: 2px 0 8px; color: #e8dcc0; font-size: 14px; letter-spacing: .08em; }
.ap .front.title .hook { margin: 0 auto 16px; color: #cfc6b4; font-size: 13.5px; line-height: 1.6; max-width: 460px; }
.ap .front .fbtns { display: flex; flex-direction: column; align-items: center; gap: 10px; }
.ap .front .cont { display: flex; align-items: center; gap: 12px; width: min(420px, 92vw); padding: 10px 14px; border-radius: 16px; background: #1f1710ee; border: 1px solid #c9a45a; color: var(--ink); font: inherit; text-align: left; cursor: pointer; animation: glow 2.6s ease-in-out infinite alternate; }
@keyframes glow { from { box-shadow: 0 0 0 #c9a45a00; } to { box-shadow: 0 0 22px #c9a45a55; } }
.ap .front .cont .cface { width: 56px; height: 56px; border-radius: 50%; object-fit: cover; object-position: top; border: 2px solid #c9a45a; }
.ap .front .cont .ct { display: flex; flex-direction: column; gap: 2px; } .ap .front .cont .ct b { font-size: 16px; color: #f3d48a; display: flex; align-items: center; gap: 6px; }
.ap .front .cont .ct span { font-size: 13px; color: #d8d0c0; } .ap .front .cont small { font-size: 11px; color: #8f8778; }
.ap .front img.cem { width: 22px; height: 22px; vertical-align: middle; }
/* 판 고르기 */
.ap .front .bcards { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr)); gap: 14px; padding: 10px 14px 24px; max-width: 1180px; margin: 0 auto; }
.ap .front .bcard { display: flex; flex-direction: column; padding: 0; overflow: hidden; border-radius: 16px; background: var(--card); border: 1px solid var(--line); color: var(--ink); font: inherit; text-align: left; cursor: pointer; }
.ap .front .bcard:active, .ap .front .bcard:hover { border-color: var(--gold); }
/* 판 카드 — 상자 그림처럼: 그림 위에 때와 제목, 아래에 이야기 한 줄 */
.ap .front .bth { position: relative; display: block; aspect-ratio: 16 / 9; background: center / cover no-repeat; }
.ap .front .bth::after { content: ''; position: absolute; inset: 40% 0 0; background: linear-gradient(#0000, #0b0d11e8); }
.ap .front .btitle { position: absolute; left: 14px; right: 14px; bottom: 10px; z-index: 1; display: flex; flex-direction: column; text-shadow: 0 2px 10px #000; }
.ap .front .btitle small { font-size: 12px; letter-spacing: .08em; color: #e8d8b0; } .ap .front .btitle b { font-family: var(--display); font-weight: 400; font-size: clamp(26px, 3.4vw, 34px); color: #f3d48a; letter-spacing: .06em; line-height: 1.15; }
.ap .front .bbadge { position: absolute; top: 10px; left: 10px; z-index: 1; font-style: normal; font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 10px; background: #d9b36ae8; color: #2a1d10; }
.ap .front .bb { display: flex; flex-direction: column; gap: 6px; padding: 10px 14px 14px; }
.ap .front .bb .bhook { font-family: var(--serif); font-size: 15px; color: #efe5cf; line-height: 1.55; } .ap .front .bb .bplay { font-size: 13px; color: #b8ad96; line-height: 1.5; }
.ap .front .bb .bmeta { display: flex; flex-wrap: wrap; gap: 4px; font-size: 12px; color: #a89c84; } .ap .front .bb .bmeta i { font-style: normal; padding: 1px 8px; border-radius: 9px; border: 1px solid #54412a; }
.ap .front .bb .bmeta.tierw, .ap .front .bb .bmeta.lockwhy { display: block; }
.ap .front .btitle em { font-style: normal; font-size: 12.5px; color: #e8c070; margin-top: 2px; }
.ap .front .bcards .bcard { -webkit-touch-callout: none; }
/* 캠페인 · 자유 판 머리 */
.ap .front .bsec { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; max-width: 1180px; margin: 14px auto 0; padding: 0 16px; font-weight: 400; }
.ap .front .bsec b { font-family: var(--display); font-weight: 400; font-size: 22px; color: #f3d48a; letter-spacing: .08em; } .ap .front .bsec span { font-size: 13px; color: #b8ad96; }
.ap .front .bcards.chaps { padding-bottom: 8px; }
.ap .front .pgoal .gl .gch { display: block; font-size: 13px; letter-spacing: .1em; color: #8a6a3a; margin-bottom: 4px; }
.ap .front .bcard.chap .bbadge { background: linear-gradient(#f0d08a, #b8863a); font-family: var(--serif); }
/* 잠긴 판 — 그림만 잿빛으로 어둡게, 제목과 여는 길 글씨는 또렷하게 (그림 위에 덮개) */
.ap .front .bcard.locked { cursor: default; } .ap .front .bcard.locked .bth { filter: grayscale(1); position: relative; }
.ap .front .bcard.locked .bth::after { inset: 0; background: linear-gradient(#0b0d1199, #0b0d11f0); }
.ap .front .bcard.locked .btitle b { color: #c9bfae; } .ap .front .bcard.locked .btitle em { color: #f0d08a; font-size: 13px; }
.ap .front .bcard.locked .lock, .ap .front .bbadge { z-index: 2; }
.ap .front .bcard.locked .bth .lock { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); font-style: normal; font-size: 34px; }
.ap .front .bcard.locked .bb b { color: #8f8778; } .ap .front .bcard.locked .bmeta.lockwhy { color: #e8c070; }
.ap .front .bcard.locked:hover, .ap .front .bcard.locked:active { border-color: var(--line); }
/* 나라 고르기 — 옛 .choose 와 같은 카드 · 휘장(이 나라로 이겼다)은 단계따라 구리 → 은 → 금 → 붉은 금 */
.ap .front .wonb { margin-left: auto; padding: 1px 9px; border-radius: 10px; font-size: 12px; font-weight: 700; white-space: nowrap; color: #2a1d10;
  background: linear-gradient(#f0d27a, #b8892e); box-shadow: inset 0 1px 0 #fff6, 0 0 0 1px #0005; }
.ap .front .wonb.r1 { background: linear-gradient(#e3b07a, #9a6a3a); } .ap .front .wonb.r2 { background: linear-gradient(#eef1f5, #9aa4b0); }
.ap .front .wonb.r4 { color: #fff4dc; background: linear-gradient(#f2c46a, #b8452a); }
.ap .front .wonc { margin-left: auto; font-size: 13px; color: #e8c070; }
.ap .front.choose .ncards { max-width: 980px; margin: 8px auto; padding: 0 14px 24px; }
/* 자세히 */
.ap .front .dcard { display: flex; gap: 16px; max-width: 760px; margin: 10px auto; padding: 0 14px 24px; flex-wrap: wrap; }
.ap .front .dface { width: min(260px, 70vw); aspect-ratio: 1; object-fit: cover; object-position: top; border-radius: 18px; border: 1px solid var(--line); animation: tv .9s ease-out both; }
.ap .front .db { flex: 1; min-width: 240px; } .ap .front .dn { display: flex; align-items: center; gap: 10px; }
.ap .front .dn b { display: block; font-family: 'Gowun Batang', serif; font-size: 26px; color: var(--gold); } .ap .front .dn span { font-size: 13px; color: #a89c84; }
.ap .front img.dem { width: 54px; height: 54px; } .ap .front .blurb { font-size: 14px; line-height: 1.6; }
.ap .front .src { font-size: 12px; color: #8f8778; } .ap .front .hard { color: #e0a080; font-size: 13px; }
/* 서막 */
/* 서막은 검은 화면에서 시작한다 — 한지가 깔리기 전에 지도가 비치지 않게 (형 10-23: "맵이 잠깐 보였다가 페이드인") */
.ap .plbox:has(> .prologue:not(.out))::before { content: ''; position: absolute; inset: 0; z-index: 69; background: #000; }
.ap .prologue { position: absolute; inset: 0; z-index: 70; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 20px 18px;
  background: #e9dfc6 url('__ART__map-world/hanji.webp') center / 520px; color: #2a1d10; animation: plin 1.4s ease-in .3s both; }
/* 바탕은 첫 장에서만 서서히 — 다음 장은 바로 깔린다 (바꿀 때마다 판이 비쳐 보였다 — 형: "다음 누를때마다 자꾸 게임화면 잠깐 나옴"). 글자는 장마다 먹물처럼 번진다 */
.ap .prologue:not(.s0) { animation: none; }
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
/* 지도가 열린다 — 한지가 걷히고 본 땅이 번진다 */
.ap.opening .map { animation: mapin 2.4s cubic-bezier(.2, .8, .3, 1) both; }
@keyframes mapin { from { transform: scale(.82); filter: sepia(.6) brightness(1.15); } to { transform: none; filter: none; } }
.ap.opening .map svg mask g path { animation: rv 2.6s .3s ease-out both; }
/* 끝 */
.ap .front-end .stats { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin: 8px 0; }
.ap .front-end .stats span { min-width: 64px; padding: 6px 8px; border-radius: 10px; background: #ffffff0d; text-align: center; font-size: 12px; color: #a89c84; }
.ap .front-end .stats b { display: block; font-size: 20px; color: var(--gold); }
.ap .front-end .chron { text-align: left; margin: 8px 0; } .ap .front-end .chron h4 { margin: 4px 0; color: var(--gold); }
/* 끝 화면 필름 — 검은 바탕에 한 장씩 떠올랐다 사라진다. 한 장 --film 초 (형: "너무빨라서 읽을수가 없음") */
/* 판 끝은 화면 전체 — 카드가 아니다 (형 10-23: "창이 화면 전체로 되어야 하는데 지금은 카드 팝업같이") */
.ap .modal:has(.front-end) { padding: 0; background: #000; }
.ap .mcard.front-end { width: 100%; max-width: none; height: 100%; max-height: none; border: 0; border-image: none; border-radius: 0; background: #0b0d10;
  padding: 0 0 calc(24px + env(safe-area-inset-bottom)); }
.ap .front-end .after { max-width: 640px; margin: 0 auto; padding: 0 16px; }
.ap .front-end .btns .btn small { display: block; font-size: 11px; font-weight: 500; opacity: .85; }
.ap .front-end .clg.film { --film: ${FILM_S}s; position: relative; height: 74dvh; min-height: 300px; margin: 0 0 8px; overflow: hidden; background: #000; }
@media (orientation: portrait) { .ap .front-end .clg.film { height: 62dvh; } }
/* 다 돈 뒤에 ‹ › — 지나간 장면을 다시 넘긴다 */
.ap .front-end .fnav { position: absolute; top: 50%; z-index: 6; width: 44px; height: 64px; margin-top: -32px; border: 1px solid #c9a45a88; border-radius: 12px; background: #0b0d10aa; color: #f3d48a;
  font-size: 34px; line-height: 1; cursor: pointer; opacity: 0; pointer-events: none; animation: fnav .5s ease-out calc(var(--n, 7) * (var(--film) - ${FILM_OVERLAP_S}s) + 2.4s) forwards; }
.ap .front-end .fnav.fprev { left: 10px; } .ap .front-end .fnav.fnext { right: 10px; }
@keyframes fnav { to { opacity: 1; pointer-events: auto; } }
.ap .modal.fast .front-end .fnav, .ap .front-end .clg.browse .fnav { animation: none; opacity: 1; pointer-events: auto; }
.ap .front-end .clg.browse .cp, .ap .front-end .clg.browse .cp img { animation: none !important; display: block !important; }
.ap .front-end .clg.browse .cp { opacity: 0; transition: opacity .35s ease; } .ap .front-end .clg.browse .cp.show { opacity: 1; z-index: 3; }
.ap .front-end .clg.browse .winfx { display: none; }
.ap .front-end .clg.browse .skip { display: block !important; top: 9%; right: 50%; transform: translateX(50%); color: #f3d48a; font-size: 13px; letter-spacing: .1em; }
.ap .modal.fast .front-end .winfx { --wd: 0s !important; }
.ap .front-end .clg.film::before, .ap .front-end .clg.film::after { content: ''; position: absolute; left: 0; right: 0; height: 7%; background: #000; z-index: 3; }
.ap .front-end .clg.film::before { top: 0; } .ap .front-end .clg.film::after { bottom: 0; }
.ap .front-end .clg.lose .cp img { filter: grayscale(.55) brightness(.8); }
.ap .front-end .cp { position: absolute; inset: 0; margin: 0; opacity: 0;
  animation: film var(--film) ease-in-out calc(var(--i) * (var(--film) - .9s) + .5s) both; }
.ap .front-end .cp img { display: block; width: 100%; height: 100%; object-fit: cover; animation: kenb var(--film) linear calc(var(--i) * (var(--film) - .9s) + .5s) both; }
.ap .front-end .cp.odd img { animation-name: kenb2; }
.ap .front-end .cp figcaption { position: absolute; left: 0; right: 0; bottom: 7%; padding: 40px 16px 14px; text-align: center; background: linear-gradient(#0000, #000d 60%);
  color: #f1e6cc; display: flex; flex-direction: column; align-items: center; gap: 3px; }
.ap .front-end .cp figcaption i { font-style: normal; color: #c9a45a; font-size: 12px; letter-spacing: .1em; }
.ap .front-end .cp figcaption span { font-family: 'Gowun Batang', serif; font-size: clamp(15px, 4vw, 21px); line-height: 1.4; text-shadow: 0 2px 6px #000; }
.ap .front-end .cp img.cpem { position: static; width: 34px; height: 34px; object-fit: contain; animation: none; filter: drop-shadow(0 2px 3px #000a); }
.ap .front-end .cp.last { z-index: 2; animation: cplast 1.8s ease-out calc(var(--i) * (var(--film) - .9s) + .5s) both; }
.ap .front-end .cp.last img { animation: none; }
.ap .front-end .cp.last b { font-family: 'Gowun Batang', serif; font-size: clamp(22px, 6vw, 32px); color: #f3d48a; text-shadow: 0 2px 8px #000; }
.ap .front-end .clg .skip { position: absolute; right: 10px; top: 9%; z-index: 4; font-size: 11px; color: #ffffff80; }
.ap .front-end .after { animation: bkin .7s ease-out calc(var(--n) * (4.2s - .9s) + 1.2s) both; }
@keyframes film { 0% { opacity: 0; } 18% { opacity: 1; } 80% { opacity: 1; } 100% { opacity: 0; } }
@keyframes kenb { from { transform: scale(1.12) translate(-2%, 1%); } to { transform: scale(1.02) translate(1%, -1%); } }
@keyframes kenb2 { from { transform: scale(1.02) translate(2%, -1%); } to { transform: scale(1.12) translate(-1%, 1%); } }
@keyframes cplast { from { opacity: 0; transform: scale(1.08); } to { opacity: 1; transform: none; } }
.ap .modal.fast .front-end .cp:not(.last) { display: none; }
.ap .modal.fast .front-end .clg .skip { display: none; }
.ap .modal.fast .front-end .cp, .ap .modal.fast .front-end .after { animation-delay: 0s !important; animation-duration: .01s !important; }
@media (prefers-reduced-motion: reduce) { .ap .front-end .cp, .ap .front-end .after { animation-delay: 0s !important; animation-duration: .01s !important; } }
.ap .front-end .chron p { margin: 3px 0; font-size: 13px; } .ap .front-end .chron p.big { color: #f3d48a; } .ap .front-end .chron i { font-style: normal; color: #8f8778; margin-right: 6px; }
.ap .lookbar { position: absolute; top: calc(8px + env(safe-area-inset-top)); left: 50%; transform: translateX(-50%); z-index: 40; display: flex; gap: 8px; align-items: center;
  padding: 6px 10px; border-radius: 12px; background: #17110ce8; border: 1px solid #8a7040; font-size: 13px; }
@media (prefers-reduced-motion: reduce) { .ap .front.title .kv, .ap .prologue p, .ap .prologue .way, .ap.opening .map { animation-duration: .01s !important; animation-delay: 0s !important; } }
`
