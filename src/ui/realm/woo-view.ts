/**
 * 회유 화면 — 누구를 시킬지 얼굴로 고르기 · 마음의 벽 막대와 그 까닭 · 가망은 % · 곡식은 범위 (docs/realm/WOO.md §1).
 * (형 10-29: "회유를 권할 때 누구를 시킬지 장수 얼굴도 안 나오고, 뭐가 얼마나 되는지 구체적이지도 않음")
 * 숫자는 ODDS 원칙 1 — 우리 옥의 사람이라 %. 말 칩은 숫자 곁에 남긴다. 판은 읽기만 한다.
 */
import { josa, STAT_NAME } from '../../realm/data/prose.ts'
import { deokOf, hasTrait, persuadeDropOf, persuadeSeasons, recruitChance, resistOf } from '../../realm/heroes.ts'
import { TRAIT } from '../../realm/data/traits.ts'
import type { Hero, Realm, WooApproach, WooReact } from '../../realm/types.ts'
import { approachesOf, chanceOf, shownRange, talkRun, wallOf, wallParts, wooOutlook, WOO_BEATS, type WooTalk } from '../../realm/woo.ts'
import { P } from '../../tune/params.ts'

export interface WooKit {
  /** 그림 바탕 주소 (realm/) */
  readonly art: string
  readonly esc: (s: string) => string
  readonly bust: (h: Hero | undefined, cls?: string) => string
  readonly name: (n: string) => string
  readonly icon: (name: string, cls?: string) => string
  readonly cost: (g: { grain: number }, per?: string) => string
  /** 곡식 그림 이름 (icon 에 넘긴다) */
  readonly grainIcon: string
  /** 이번 계절 다른 일을 맡은 장수면 그 일 (없으면 null) */
  readonly jobOf: (id: string) => string | null
}

const pct = (p: number): string => `${Math.round(p * 100)}%`
const n1 = (x: number): string => (Math.round(x * 10) / 10).toFixed(1)
/** 넘어올 가망의 말 칩 (숫자 곁에 남긴다) */
export const oddsWord = (p: number): string => (p >= 0.6 ? '가망이 크다' : p >= 0.35 ? '반반쯤' : p >= 0.15 ? '가망이 적다' : '좀처럼 안 넘어온다')

const PART_NAME = { base: '바탕', uiri: '의리', loyal: '옛 주인을 믿었다', ruler: '군주였다', steadfast: '일편단심' } as const
const PART_TIP = {
  base: '누구나 처음엔 이만큼 마음을 닫고 있습니다',
  uiri: '의리가 5를 넘는 만큼 벽이 두껍습니다',
  loyal: '옛 주인을 믿던 장수(정 70 이상)는 벽이 더 두껍습니다',
  ruler: '한 나라의 군주였던 사람은 쉽게 꺾이지 않습니다',
  steadfast: '일편단심은 옛 주인을 저버리지 않습니다. 벽이 아주 두껍고 넘어올 가망도 낮습니다',
} as const

/** 회유할 수 있는 우리 장수 — 한가한 이가 먼저, 그 안에서 빨리 될 사람부터 */
export function wooers(r: Realm, me: string, captive: string, jobOf: (id: string) => string | null): Array<{ x: Hero; job: string | null; seasons: number }> {
  return Object.values(r.heroes)
    .filter((y) => y.faction === me && y.status === 'free')
    .map((x) => ({ x, job: jobOf(x.id), seasons: persuadeSeasons(r, captive, x.id) }))
    .sort((a, b) => (a.job === null) !== (b.job === null) ? (a.job === null ? -1 : 1) : a.seasons - b.seasons || (a.x.id < b.x.id ? -1 : 1))
}
/** 추천 — 한가한 이 가운데 가장 빨리 될 사람 (매혹 · 유물이 셈에 든다) */
export function wooBest(r: Realm, me: string, captive: string, jobOf: (id: string) => string | null): Hero | null {
  return wooers(r, me, captive, jobOf).find((c) => c.job === null)?.x ?? null
}

/** 마음의 벽 — 막대 · 남은 값 · 무엇이 쌓았나 칩 (길게 누르면 풀이) */
export function wallHtml(k: WooKit, r: Realm, captive: string): string {
  const x = r.heroes[captive]
  if (x === undefined) return ''
  const full = Math.max(0.1, resistOf(r, captive))
  const now = Math.max(0, wallOf(r, captive))
  const w = Math.max(0, Math.min(100, (now / Math.max(full, now)) * 100))
  const chips = wallParts(r, captive).map((p) => `<i class="dp-chip" data-tip="${k.esc(PART_TIP[p.key])}">${PART_NAME[p.key]}${p.key === 'uiri' ? ` ${x.uiri}` : ''} <b>+${n1(p.n).replace(/\.0$/, '')}</b></i>`)
  if ((x.grudge ?? 0) > 0) chips.push(`<i class="dp-chip bad" data-tip="${k.esc(`담판에서 노엽게 한 일을 잊지 않았습니다. 넘어올 가망이 한 겹마다 ${Math.round(P.realm.wooGrudgeRecruit * 100)}%p 낮습니다`)}">원한 <b>${x.grudge}</b></i>`)
  return `<div class="dp-wall"><div class="dp-wh"><b>마음의 벽</b><span>${now <= 0 ? '무너졌다' : `${n1(now)} <small>/ ${n1(full)}</small>`}</span></div>`
    + `<div class="dp-bar"><i style="width:${w.toFixed(1)}%"></i></div><div class="dp-chips">${chips.join('')}</div></div>`
}

/** 회유하는 이 한 칸의 숫자 — 한 계절에 깎는 벽 · 넘어올 가망 */
function perHtml(r: Realm, captive: string, by: string): string {
  return `<small class="dp-n"><span>한 계절 <b>−${n1(persuadeDropOf(r, by))}</b></span><span>넘어올 <b>${pct(recruitChance(r, captive, by))}</b></span></small>`
}
const statsHtml = (y: Hero): string => `<small class="dp-st"><span>${STAT_NAME.deok} ${deokOf(y)}</span><span>${STAT_NAME.ryak} ${y.ryak}</span></small>`

/** 지금 고른 회유하는 이 — 누르면 얼굴 고르기 상자 */
export function whoHtml(k: WooKit, r: Realm, captive: string, by: Hero | null, rec: boolean): string {
  if (by === null) return `<p class="mute">회유를 맡길 장수가 없다.</p>`
  const tags = [hasTrait(by, 'charm') ? '매혹' : '', (by.relics ?? []).length > 0 ? '유물' : ''].filter((s) => s !== '')
  return `<div class="dp-who"><span class="mute">누가 회유하나</span><button class="dp-sel" data-act="dp-pick" data-id="${captive}">${k.bust(by, 'face')}`
    + `<span class="dp-sb"><b>${k.name(by.name)}${rec ? '<i class="recst">추천</i>' : ''}</b>${statsHtml(by)}${perHtml(r, captive, by.id)}${tags.length > 0 ? `<small class="dp-tg">${tags.join(' · ')}</small>` : ''}</span><i class="dp-sw">바꾼다 ›</i></button></div>`
}

/** 맡겨 둘 때의 어림 — 벽이 무너질 때까지 · 그 뒤 계절마다 · 곡식 모두 */
export function outlookHtml(k: WooKit, r: Realm, captive: string, by: string | null): string {
  const o = wooOutlook(r, captive, by)
  const p = recruitChance(r, captive, by)
  const rng = (a: number, b: number): string => (a === b ? `${a}` : `${a}~${b}`)
  const wall = wallOf(r, captive) <= 0 ? '<span>마음의 벽은 이미 무너졌다</span>' : `<span>벽이 무너질 때까지 <b>${rng(o.wall[0], o.wall[1])}계절</b></span>`
  return `<div class="dp-out">${wall}<span>그 뒤 계절마다 넘어올 가망 <b>${pct(p)}</b> <i class="dp-word">${oddsWord(p)}</i></span>`
    + `<span>곡식 모두 ${k.icon(k.grainIcon, 'dp-ic')}<b>${rng(o.grain[0], o.grain[1])}</b>쯤 <small>(계절마다 ${P.realm.persuadeGrain})</small></span></div>`
}

/** 회유 중 — 달래는 이의 얼굴과 남은 벽 */
export function progressHtml(k: WooKit, r: Realm, captive: string, talk = ''): string {
  const x = r.heroes[captive]
  const pz = x?.persuade
  if (x === undefined || pz === undefined) return ''
  const by = pz.by !== null ? r.heroes[pz.by] : undefined
  const head = by !== undefined
    ? `<div class="dp-pg">${k.bust(by, 'dp-pf')}<span><b>${k.esc(josa(by.name, '이', '가'))} 달래는 중</b>${perHtml(r, captive, by.id)}</span></div>`
    : `<div class="dp-pg"><span><b>회유하는 중</b></span></div>`
  return `<div class="dp-prog">${head}${pz.resist !== undefined ? wallHtml(k, r, captive) + outlookHtml(k, r, captive, pz.by) : ''}${talk}</div>`
}

/** 옥 목록 한 줄에 붙는 작은 진행 — 달래는 이 얼굴 · 남은 벽 막대 */
export function miniHtml(k: WooKit, r: Realm, captive: string): string {
  const pz = r.heroes[captive]?.persuade
  if (pz === undefined || pz.resist === undefined) return ''
  const by = pz.by !== null ? r.heroes[pz.by] : undefined
  const full = Math.max(0.1, resistOf(r, captive))
  const w = Math.max(0, Math.min(100, (pz.resist / Math.max(full, pz.resist)) * 100))
  return `<span class="dp-mini">${by !== undefined ? k.bust(by, 'dp-mf') : ''}<span class="dp-bar sm"><i style="width:${w.toFixed(1)}%"></i></span><small>${pz.resist <= 0 ? '벽이 무너졌다' : `벽 ${n1(pz.resist)}`}</small></span>`
}

/** 얼굴 고르기 상자 — 우리 장수를 모두, 한 줄에 셋. 일이 있는 이는 ⏳ 와 그 일을 보이고 흐리게 */
export function pickBoxHtml(k: WooKit, r: Realm, me: string, captive: string, sel: string | null): string {
  const x = r.heroes[captive]
  if (x === undefined) return ''
  const list = wooers(r, me, captive, k.jobOf)
  const best = list.find((c) => c.job === null)?.x.id ?? null
  let h = `<div class="dp-box" role="dialog" aria-label="누가 회유하나"><button class="dp-x" data-act="dp-x" aria-label="닫기">✕</button>`
  h += `<div class="dp-hd">${k.bust(x, 'dp-hf')}<span><b>${k.esc(josa(x.name, '을', '를'))} 누가 회유하나</b><small>마음의 벽 ${n1(Math.max(0, wallOf(r, captive)))} · 매력이 높으면 빨리 깎고, 넘어올 가망도 오른다</small></span></div>`
  h += `<div class="dp-grid">`
  for (const { x: y, job } of list) {
    if (job !== null) {
      h += `<button class="dp-c busy" aria-disabled="true" data-tip="${k.esc(job)}">${k.bust(y, 'face')}<b>${k.name(y.name)}</b>${statsHtml(y)}<small class="dp-job">⏳ ${k.esc(job)}</small></button>`
      continue
    }
    h += `<button class="dp-c${y.id === sel ? ' on' : ''}" data-act="dp-by" data-id="${captive}" data-by="${y.id}">${y.id === best ? '<i class="recst">추천</i>' : ''}${k.bust(y, 'face')}<b>${k.name(y.name)}</b>${statsHtml(y)}${perHtml(r, captive, y.id)}</button>`
  }
  return h + `</div></div>`
}

export const WOO_CSS = `
.ap .dp-wall { display: flex; flex-direction: column; gap: 4px; padding: 8px 10px; border: 1px solid #5a4630; border-radius: 10px; background: #1c150e; }
.ap .dp-wh { display: flex; justify-content: space-between; align-items: baseline; font-size: 13px; } .ap .dp-wh b { color: #e0bd78; } .ap .dp-wh span { color: #f3e3c0; font-weight: 700; } .ap .dp-wh small { color: var(--mute); font-weight: 400; }
.ap .dp-bar { position: relative; height: 12px; border-radius: 6px; background: #3a2c1e; border: 1px solid #6a5236; overflow: hidden; }
.ap .dp-bar > i { position: absolute; inset: 0 auto 0 0; background: repeating-linear-gradient(90deg, #8a6a4a 0 10px, #75583c 10px 12px); transition: width .5s ease; }
.ap .dp-bar.sm { height: 7px; width: 70px; flex: none; }
.ap .dp-chips { display: flex; flex-wrap: wrap; gap: 4px; }
.ap .dp-chip { font-style: normal; font-size: 11.5px; padding: 1px 7px; border-radius: 9px; background: #2e2418; border: 1px solid #5a4630; color: #d9c69a; white-space: nowrap; } .ap .dp-chip b { color: #f3d38a; }
.ap .dp-chip.bad { border-color: #a03a2a; color: #ffb4a0; background: #3a1812; } .ap .dp-chip.bad b { color: #ff8a70; }
.ap .dp-who { display: flex; flex-direction: column; gap: 4px; }
.ap .dp-sel { display: flex; align-items: center; gap: 10px; width: 100%; min-width: 0; padding: 8px 10px; border-radius: 10px; border: 1px solid #e0bd78; background: #2a1f14; color: inherit; text-align: left; cursor: pointer; }
.ap .dp-sel .face { width: 56px; height: 56px; }
.ap .dp-sb { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; } .ap .dp-sb > b { position: relative; font-size: 14px; display: flex; align-items: center; gap: 6px; }
.ap .dp-sb > b > .recst, .ap .dp-c > .recst { position: static; padding: 0 5px; border-radius: 6px; background: #f2c94c; color: #2a1a06; font-size: 10px; font-weight: 800; font-style: normal; line-height: 1.5; }
.ap .dp-c > .recst { position: absolute; top: -6px; right: -3px; box-shadow: 0 1px 3px #000a; z-index: 1; }
.ap .dp-sw { flex: none; font-style: normal; font-size: 12px; color: #e0bd78; }
.ap .dp-st, .ap .dp-n { display: flex; flex-wrap: wrap; gap: 0 8px; font-size: 11.5px; color: var(--mute); } .ap .dp-n b { color: #f3d38a; } .ap .dp-tg { font-size: 11px; color: #e8a0d0; }
.ap .dp-out { display: flex; flex-direction: column; gap: 2px; font-size: 12.5px; color: #d9c69a; padding: 0 2px; } .ap .dp-out b { color: #f3e3c0; } .ap .dp-out small { color: var(--mute); }
.ap .dp-word { font-style: normal; font-size: 11px; padding: 0 6px; border-radius: 8px; background: #2e2418; border: 1px solid #5a4630; color: #e0bd78; }
.ap .dp-ic { width: 16px; height: 16px; vertical-align: -3px; }
.ap .dp-prog { display: flex; flex-direction: column; gap: 6px; }
.ap .dp-pg { display: flex; align-items: center; gap: 8px; } .ap .dp-pg > span { display: flex; flex-direction: column; min-width: 0; } .ap .dp-pg b { font-size: 13.5px; color: #e0bd78; }
.ap .dp-pf { flex: none; width: 44px; height: 44px; border-radius: 50%; object-fit: cover; object-position: top; border: 2px solid #c9a45a; }
.ap .dp-mini { display: flex; align-items: center; gap: 5px; min-width: 0; } .ap .dp-mini small { font-size: 11px; color: var(--mute); white-space: nowrap; }
.ap .dp-mf { flex: none; width: 22px; height: 22px; border-radius: 50%; object-fit: cover; object-position: top; border: 1px solid #c9a45a; }
.ap .dpov { position: absolute; inset: 0; z-index: 85; display: flex; align-items: center; justify-content: center; padding: 12px; background: #000b; }
.ap .dp-box { position: relative; width: 100%; max-width: 430px; max-height: calc(100% - 8px); overflow-y: auto; display: flex; flex-direction: column; gap: 10px; padding: 14px 12px 12px; border-radius: 14px; border: 1px solid #8a6a3a; background: #1a130c; box-shadow: 0 10px 30px #000c; box-sizing: border-box; }
.ap .dp-x { position: absolute; top: 6px; right: 6px; width: 32px; height: 32px; border-radius: 50%; border: 1px solid #5a4630; background: #2a1f14; color: #e0bd78; font-size: 15px; cursor: pointer; }
.ap .dp-hd { display: flex; align-items: center; gap: 10px; padding-right: 34px; } .ap .dp-hd > span { display: flex; flex-direction: column; gap: 2px; min-width: 0; } .ap .dp-hd b { font-size: 15px; color: #f3e3c0; } .ap .dp-hd small { font-size: 11.5px; color: var(--mute); }
.ap .dp-hf { flex: none; width: 46px; height: 46px; border-radius: 8px; object-fit: cover; object-position: top; border: 2px solid #6a6a6a; }
.ap .dp-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
.ap .dp-c { position: relative; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 7px 3px 6px; border-radius: 10px; border: 1px solid #5a4630; background: #241a10; color: inherit; cursor: pointer; }
.ap .dp-c .face { width: 50px; height: 50px; } .ap .dp-c > b { font-size: 12.5px; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ap .dp-c .dp-st, .ap .dp-c .dp-n { justify-content: center; font-size: 10.5px; gap: 0 5px; } .ap .dp-c .dp-n { flex-direction: column; align-items: center; }
.ap .dp-c.on { border-color: #e0bd78; box-shadow: 0 0 0 2px #e0bd78, 0 0 10px #e0bd7866; }
.ap .dp-c.busy { opacity: .45; cursor: default; } .ap .dp-job { font-size: 10.5px; color: #f0d090; text-align: center; line-height: 1.2; word-break: keep-all; }
`

// ── 옥중 담판 상자 (WOO §2 · §4) ─────────────────────────────

const APP_NAME: Readonly<Record<WooApproach, string>> = { soothe: '달래기', cause: '명분', gain: '이익', fear: '겁주기', bond: '★ 인연' }
const APP_STAT: Readonly<Record<WooApproach, string>> = { soothe: '매력', cause: '지략', gain: '매력', fear: '무예', bond: '판에 한 번' }
/** 그 말할 거리에 쓰는 우리 장수의 능력치 (woo.ts 와 같은 것) */
const APP_KEY: Readonly<Partial<Record<WooApproach, 'deok' | 'ryak' | 'mu'>>> = { soothe: 'deok', cause: 'ryak', gain: 'deok', fear: 'mu' }

/** 담판 상자가 그릴 것 — 지금까지 한 마디 · 고른 거리 · 손을 내밀었나 */
export interface TalkState {
  readonly id: string
  readonly by: Hero
  readonly talk: readonly WooApproach[]
  readonly sel: WooApproach | null
  readonly hand: boolean
  /** 지금 쓸 수 있는 곡식 (이익을 걸 수 있나) */
  readonly grain: number
}
export interface TalkLines {
  readonly open: (r: Realm, x: Hero, by: string | null) => string
  readonly lord: (by: Hero, r: Realm) => string
  /** i 번째 마디에 우리 장수가 할 말 (talk[i] 가 그 거리 · reacts 는 앞 마디들의 반응) */
  readonly pitch: (r: Realm, by: Hero, x: Hero, talk: readonly WooApproach[], i: number, reacts: readonly WooReact[]) => string
  /** i 번째 마디의 대답 (앞말을 되받지 않는다 · 형 10-30) */
  readonly react: (r: Realm, by: Hero, x: Hero, talk: readonly WooApproach[], i: number, reacts: readonly WooReact[]) => string
  readonly notYet: (r: Realm, x: Hero) => string
  /** 손을 잡는 한마디 — 마지막 마디에 고개를 저었으면 그 거절을 짚는다 */
  readonly kneel: (r: Realm, by: Hero, x: Hero, talk: readonly WooApproach[], reacts: readonly WooReact[]) => string
  readonly won: (r: Realm, by: Hero, x: Hero, talk: readonly WooApproach[], reacts: readonly WooReact[]) => string
  /** 넘어온 이의 등용 첫마디 (hire-lines · 녹음이 함께 울린다) */
  readonly hire: (x: Hero) => string | null
}

/** 담판이 끝났나 — 노여움 · 벽이 무너짐 · 세 마디 */
export const talkOver = (t: WooTalk, n: number): boolean => t.end !== 'done' || n >= WOO_BEATS

/** 말하는 사람 한 줄 — 작은 둥근 얼굴과 그 밑 이름, 오른쪽에 말 (형 10-29: 「"말" — 이름」 금지) */
const say = (k: WooKit, h: Hero, line: string, cls = ''): string =>
  `<div class="dp-say${cls}"><span class="dp-who2">${k.bust(h, 'dp-sf')}<small>${k.esc(h.name)}</small></span><span class="dp-line">${k.esc(line)}</span></div>`
/** 지난 말 — 한 마디를 한 줄로 접는다 (작은 얼굴 + 말 앞머리 · 폰에서 굴리지 않게) */
const oldHalf = (k: WooKit, h: Hero, line: string, cls = ''): string =>
  `<span class="dp-oh${cls}">${k.bust(h, 'dp-of')}<i>${k.esc(line)}</i></span>`

/** 조각 — 벽이 깎이면 낱낱이 튄다 (메모리: 이펙트는 낱낱이) */
const pieces = (n: number, at: number): string => Array.from({ length: n }, (_, i) => {
  const a = (i / n) * Math.PI * 2 + 0.4
  return `<i class="dp-pc" style="left:${at.toFixed(1)}%;--x:${Math.round(Math.cos(a) * (40 + (i % 3) * 22))}px;--y:${Math.round(Math.sin(a) * (26 + (i % 4) * 10) - 18)}px;--r:${(i * 67) % 360}deg;--d:${((i % 5) * 0.04).toFixed(2)}s"></i>`
}).join('')

/** 담판 상자 한 장 — 굴리지 않는다 · 아래 붙박이 띠 */
export function talkBoxHtml(k: WooKit, L: TalkLines, r: Realm, s: TalkState): string {
  const x = r.heroes[s.id]
  if (x === undefined) return ''
  const by = s.by
  const t = talkRun(r, s.id, by.id, s.talk, false)
  const over = talkOver(t, s.talk.length)
  const last = t.beats[t.beats.length - 1]
  const full = Math.max(0.1, resistOf(r, s.id), t.from, t.resist)
  const won = over && s.hand && t.hand?.ok === true
  const lost = over && s.hand && t.hand !== null && !t.hand.ok
  const rage = last?.react === 'rage'
  let h = `<div class="dp-tk${rage ? ' rage' : ''}${won ? ' won' : ''}${t.beats.length > 0 ? ' deep' : ''}" role="dialog" aria-label="옥중 담판" style="--bg:url('${k.art}event/event-captive-persuade.jpg')">`
  const dot = (i: number): string => { const b = t.beats[i]; return b === undefined ? '' : b.react === 'big' || b.react === 'sway' ? 'ok' : b.react === 'rage' ? 'bad' : 'no' }
  h += `<div class="dp-th"><b>옥중 담판</b><i class="dp-dots">${Array.from({ length: WOO_BEATS }, (_, i) => `<b class="${dot(i)}"></b>`).join('')}</i><span>${over ? '끝' : `${s.talk.length + 1} / ${WOO_BEATS} 마디`}</span></div>`
  // 얼굴 둘. 갇힌 이는 사로잡기 장면과 같은 옥문 틀(fx/jail-frame.png)과 쇠창살(fx/jail-bars.png), 우리 장수는 청동 얼굴 테(ui/frame-portrait.png).
  // 넘어오면 창살이 들보 속으로 올라가고 옥문 틀이 걷히고 청동 테가 씌워진 채 우리 쪽으로 건너온다 (형 10-29: "감옥 틀이랑 철창 어따 팔아먹고 회색 svg")
  h += `<div class="dp-fr"><span class="dp-fx jail"><span class="dp-cell">${k.bust(x, 'dp-ff')}<i class="dp-bars"><b></b></i><i class="dp-jail"></i><i class="dp-gold"></i></span><small>${k.name(x.name)}</small></span><span class="dp-vs">${won ? '' : '⇄'}</span><span class="dp-fx ours"><span class="dp-cell">${k.bust(by, 'dp-ff')}<i class="dp-gold on"></i></span><small>${k.name(by.name)}</small><small class="dp-st3">매력 <b>${deokOf(by)}</b> · 지략 <b>${by.ryak}</b> · 무예 <b>${by.mu}</b></small></span></div>`
  // 말 — 한 줄기로 쌓인다 (형 10-29: "대사가 이어지지가 않는데 · 루트마다 분기가 나뉘어야"). 위가 먼저 한 말.
  // 지난 마디는 한 줄로 접고(얼굴 둘 + 말 앞머리), 지금 마디만 펼쳐 밝힌다. 첫마디(단서)는 마디 0
  const n = t.beats.length
  const said = s.talk.slice(0, n)
  const reacts = t.beats.map((b) => b.react)
  const pitch = (i: number, tk: readonly WooApproach[] = said): string => L.pitch(r, by, x, tk, i, reacts)
  const react = (i: number): string => L.react(r, by, x, said, i, reacts)
  const rows: string[] = []
  const fold = (upto: number): void => {
    rows.push(`<div class="dp-old">${oldHalf(k, x, L.open(r, x, by.id))}</div>`)
    for (let i = 0; i < upto; i++) rows.push(`<div class="dp-old">${oldHalf(k, by, pitch(i))}${oldHalf(k, x, react(i), ` r-${reacts[i]}`)}</div>`)
  }
  if (n === 0) {
    if (s.sel !== null) rows.push(say(k, x, L.open(r, x, by.id)), say(k, by, pitch(0, [s.sel]), ' pre now'))
    else rows.push(say(k, by, L.lord(by, r), ' lord'), say(k, x, L.open(r, x, by.id), ' now'))
  } else if (won || lost) {
    // 등용 첫마디는 다음 계절 등용 장면에서 한다 · 여기서는 고개를 숙이는 한마디만 (형 10-29: "여기서 바로 옥을 열고 나와선 안 돼 · 다음 판에 등용 뜨잖아")
    fold(n - 1)
    // 판을 가른 말은 아래 큰 글이 인용한다 · 마지막 마디도 접어 두고 고개 숙이는 한마디만 펼친다 (폰에서 넘치지 않게)
    rows.push(`<div class="dp-old">${oldHalf(k, by, pitch(n - 1))}${oldHalf(k, x, react(n - 1), ` r-${reacts[n - 1]}`)}</div>`)
    rows.push(won ? say(k, x, L.kneel(r, by, x, said, reacts), ' hire now') : say(k, x, L.notYet(r, x), ' now'))
  } else if (s.sel !== null && !over) {
    fold(n - 1)
    rows.push(`<div class="dp-old">${oldHalf(k, by, pitch(n - 1))}</div>`)
    rows.push(say(k, x, react(n - 1), ` r-${reacts[n - 1]}`), say(k, by, pitch(n, [...said, s.sel]), ' pre now'))
  } else {
    fold(n - 1)
    rows.push(say(k, by, pitch(n - 1)), say(k, x, react(n - 1), ` r-${reacts[n - 1]} now`))
  }
  h += `<div class="dp-talk">${rows.join('')}</div>`
  // 벽 — 막대와 조각 · 노여움이면 붉게 두꺼워진다
  const w = Math.max(0, Math.min(100, (t.resist / full) * 100))
  const cut = last !== undefined && (last.react === 'big' || last.react === 'sway') && !s.hand
  const d = t.resist - t.from
  h += `<div class="dp-tw${rage ? ' up' : ''}"><div class="dp-wh"><b>마음의 벽</b><span>${t.resist <= 0 ? '무너졌다' : n1(t.resist)}${Math.abs(d) >= 0.05 ? ` <small class="${d < 0 ? 'dn' : 'upn'}">${d < 0 ? '−' : '+'}${n1(Math.abs(d))}</small>` : ''}</span></div>`
    + `<div class="dp-bar big${won ? ' gone' : ''}"><i style="width:${w.toFixed(1)}%"></i>${cut ? pieces(last!.react === 'big' ? 10 : 5, w) : ''}${won ? pieces(16, 50) : ''}</div>`
  // 칩 — 됨됨이의 사실 (단서)
  const chips: string[] = [`의리 ${x.uiri}`]
  const fallen = !Object.values(r.nodes).some((n) => n.owner === x.faction)
  chips.push(`${r.factions[x.faction]?.name ?? ''} ${fallen ? '무너짐' : '남아 있음'}`)
  if (x.caughtAt !== undefined && r.season - x.caughtAt > 0) chips.push(`갇힌 지 ${r.season - x.caughtAt}계절`)
  for (const tr of x.traits.slice(0, 2)) { const td = TRAIT[tr]; if (td !== undefined) chips.push(td.name) }
  // 도장 — 노여움이 터지면 붉은 네모 「원한」이 결과 위에 쿵 (둥근 것 · 해 동그라미 금지)
  h += `<div class="dp-chips">${chips.map((c) => `<i class="dp-chip">${k.esc(c)}</i>`).join('')}${(x.grudge ?? 0) > 0 ? `<i class="dp-chip bad">원한 ${x.grudge}</i>` : ''}</div></div>`
  // 가운데 — 말할 거리 단추 · 끝났으면 결과
  if (won) {
    h += `<div class="dp-end won"><b class="dp-big">${k.esc(L.won(r, by, x, said, reacts))}</b><small>다음 계절에 옥문을 열고 우리 장수로 맞습니다.</small></div>`
  } else if (lost) {
    const pc = Math.round(t.hand!.p * 100)
    h += `<div class="dp-end"><b>${pc >= 50 ? `아깝다! ${pc}%였다` : `넘어올 가망 ${pc}%, 이번엔 고개를 저었다`}</b><small>마음의 벽은 무너진 채로 남습니다. 맡겨 두면 계절마다 다시 굴립니다.</small></div>`
  } else if (over && t.hand !== null) {
    h += `<div class="dp-end hand"><b>마음의 벽이 무너졌다</b><small>지금 손을 내밀 수 있습니다. 넘어올 가망 <b>${Math.round(t.hand.p * 100)}%</b>${last?.react === 'big' ? ' · 약한 곳으로 끝냈다' : ''}</small></div>`
  } else if (over) {
    h += `<div class="dp-end${rage ? ' bad' : ''}">${rage ? '<i class="dp-stamp">원한</i>' : ''}<b>${rage ? '노여움을 샀다. 담판이 끝났다' : '담판을 마쳤다'}</b><small>마음의 벽 ${d <= 0 ? '−' : '+'}${n1(Math.abs(d))} · 남은 벽 ${n1(t.resist)}${rage ? ' · 원한이 남았다' : ''}</small></div>`
  } else {
    const mom = last === undefined ? 0 : last.react === 'big' || last.react === 'sway' ? 1 : -1
    const gains = s.talk.filter((a) => a === 'gain').length
    h += `<div class="dp-apps">`
    for (const a of approachesOf(r, s.id, by.id)) {
      const sh = shownRange(r, by.id, chanceOf(r, s.id, by.id, a, mom))
      const no = (a === 'bond' && s.talk.includes('bond')) || (a === 'gain' && s.grain < P.realm.persuadeGrain + P.realm.wooGainGrain * (gains + 1))
      h += `<button class="dp-ap${a === 'bond' ? ' gold' : ''}${s.sel === a ? ' on' : ''}" data-act="dp-sel" data-a="${a}"${no ? ' disabled' : ''}>`
        + `<b>${APP_NAME[a]}</b><span class="dp-p">${sh.lo === sh.hi ? `${sh.lo}%` : `${sh.lo}~${sh.hi}%`}</span><small>${APP_STAT[a]}${APP_KEY[a] !== undefined ? ` <b>${APP_KEY[a] === 'deok' ? deokOf(by) : by[APP_KEY[a]!]}</b>` : ''}${a === 'gain' ? k.cost({ grain: P.realm.wooGainGrain }) : ''}${sh.dim ? ' · 잘 모르겠다' : ''}</small></button>`
    }
    h += `</div>`
  }
  // 아래 붙박이 띠 (메모리 confirm-bar-bottom)
  h += `<div class="dp-go">`
  if (won || lost || (over && t.hand === null)) h += `<button class="btn pri" data-act="dp-ok">확인</button>`
  else if (over && t.hand !== null) h += `<button class="btn pri" data-act="dp-hand">손을 내민다 <b>${Math.round(t.hand.p * 100)}%</b></button>`
  else h += `<button class="btn ghost" data-act="dp-leave">맡긴다</button><button class="btn pri" data-act="dp-say"${s.sel === null ? ' disabled' : ''}>${s.sel === null ? '말할 거리를 고르세요' : '이 말로 한다'}</button>`
  return h + `</div></div>`
}

export const TALK_CSS = `
.ap .dp-tk { position: relative; width: 100%; max-width: 430px; height: 100%; max-height: 760px; display: flex; flex-direction: column; gap: 8px; padding: 10px 12px 0; box-sizing: border-box; overflow: hidden;
  background: radial-gradient(ellipse at 50% 30%, #0a070588, #0a0705ee 75%), var(--bg) center / cover no-repeat, #120d08; border: 1px solid #6a5236; border-radius: 14px; }
.ap .dp-tk.rage { animation: dpshake .45s ease-out; } @keyframes dpshake { 20% { transform: translateX(-7px); } 40% { transform: translateX(6px); } 60% { transform: translateX(-4px); } 80% { transform: translateX(2px); } }
.ap .dp-th { flex: none; display: flex; align-items: center; gap: 8px; } .ap .dp-th > b { font-size: 15px; color: #e0bd78; letter-spacing: .05em; } .ap .dp-th > span { margin-left: auto; font-size: 12px; color: var(--mute); }
.ap .dp-dots { display: flex; gap: 4px; } .ap .dp-dots b { width: 9px; height: 9px; border-radius: 2px; border: 1px solid #8a6a3a; background: #2a1f14; } .ap .dp-dots b.ok { background: #e0bd78; } .ap .dp-dots b.no { background: #6a6a6a; } .ap .dp-dots b.bad { background: #c0392b; border-color: #ff7a60; }
.ap .dp-fr { flex: none; display: flex; align-items: flex-start; justify-content: space-between; padding: 0 6px; }
.ap .dp-fx { position: relative; display: flex; flex-direction: column; align-items: center; gap: 3px; width: 124px; } .ap .dp-fx small { font-size: 12.5px; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #f3e3c0; }
.ap .dp-ff { width: 78px; height: 78px; border-radius: 10px; object-fit: cover; object-position: top; display: block; box-sizing: border-box; }
/* 얼굴 칸 둘레에 옥문 틀이 30% 씩 나온다 (틀 그림의 빈 칸 62.5% · 사로잡기 장면 appstyle .cere.capt .jail 과 같은 셈) */
.ap .dp-cell { position: relative; width: 78px; height: 78px; margin: 20px 0 16px; }
.ap .dp-cell .dp-ff { border-radius: 2px; box-shadow: 0 6px 14px #000c; }
.ap .dp-tk.deep .dp-cell, .ap .dp-tk.deep .dp-ff { width: 62px; height: 62px; } .ap .dp-tk.deep .dp-cell { margin: 13px 0 11px; }
.ap .dp-bars { position: absolute; inset: 0; z-index: 2; overflow: hidden; pointer-events: none; }
.ap .dp-bars b { position: absolute; inset: 0; background: url(__ART__fx/jail-bars.png) center / 100% 100% no-repeat; filter: drop-shadow(2px 3px 3px #000c); }
.ap .dp-jail { position: absolute; left: -30%; top: -30%; width: 160%; height: 160%; z-index: 3; pointer-events: none; background: url(__ART__fx/jail-frame.png) center / 100% 100% no-repeat; filter: drop-shadow(0 6px 12px #000d); }
.ap .dp-gold { position: absolute; inset: -8px; z-index: 4; pointer-events: none; border: 10px solid transparent; border-image: url(__ART__ui/frame-portrait.png) 60 / 10px stretch; opacity: 0; filter: drop-shadow(0 4px 8px #000c); }
.ap .dp-gold.on { opacity: 1; }
.ap .dp-fx small.dp-st3 { font-size: 11px; color: #cbbf9f; } .ap .dp-fx small.dp-st3 b, .ap .dp-ap small b { color: #ffe0a0; }
.ap .dp-vs { align-self: center; font-size: 18px; color: #8a6a3a; }
/* 넘어와도 옥에 그대로 있다 · 창살 너머에서 고개를 숙인다 (풀려나는 것은 다음 계절 등용 장면) */
.ap .dp-tk.won .dp-fx.jail .dp-ff { animation: dpbow .6s .6s ease-out both; } @keyframes dpbow { to { transform: translateY(5px); filter: brightness(1.15); } }
.ap .dp-talk { flex: none; display: flex; flex-direction: column; gap: 6px; min-height: 120px; }
.ap .dp-say { display: flex; align-items: center; gap: 10px; padding: 7px 10px 7px 7px; border-radius: 10px; background: #1c150ee6; border: 1px solid #4a3826; animation: dpin .3s ease-out both; }
.ap .dp-say.pre { border-style: dashed; border-color: #e0bd78; background: #2a1f14e6; } .ap .dp-say.lord .dp-line { color: #d9c69a; font-size: 13px; }
.ap .dp-say.r-big { border-color: #e0bd78; } .ap .dp-say.hire { border-color: #f2c94c; background: #3a2a10e6; animation-delay: 1.5s; } .ap .dp-say.hire .dp-sf { border-color: #f2c94c; } .ap .dp-say.r-rage { border-color: #c0392b; background: #2a0f0ae6; }
@keyframes dpin { from { opacity: 0; transform: translateY(6px); } }
.ap .dp-old { flex: none; display: flex; gap: 5px; min-width: 0; opacity: .66; }
.ap .dp-oh { flex: 1 1 0; min-width: 0; display: flex; align-items: center; gap: 4px; height: 24px; padding: 0 7px 0 2px; border-radius: 12px; background: #1c150ecc; border: 1px solid #3a2c1e; box-sizing: border-box; }
.ap .dp-oh > i { flex: 1; min-width: 0; font-style: normal; font-size: 12px; color: #d9c69a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ap .dp-oh.r-big, .ap .dp-oh.r-sway { border-color: #8a6a3a; } .ap .dp-oh.r-rage { border-color: #a03a2a; }
.ap .dp-of { flex: none; width: 20px; height: 20px; border-radius: 50%; object-fit: cover; object-position: top; border: 1px solid #c9a45a; box-sizing: border-box; }
.ap .dp-say.now { box-shadow: 0 0 0 1px #e0bd7866, 0 0 12px #e0bd7833; }
.ap .dp-who2 { flex: none; width: 50px; display: flex; flex-direction: column; align-items: center; gap: 2px; } .ap .dp-who2 small { max-width: 52px; font-size: 10.5px; line-height: 1.15; color: #e8cf94; text-align: center; word-break: keep-all; }
.ap .dp-sf { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; object-position: top; box-sizing: border-box; border: 2px solid #c9a45a; }
.ap .dp-line { flex: 1; min-width: 0; font-size: 14px; line-height: 1.4; color: #f3e3c0; word-break: keep-all; overflow-wrap: anywhere; }
.ap .dp-tw { position: relative; flex: none; display: flex; flex-direction: column; gap: 4px; padding: 7px 10px; border-radius: 10px; background: #1c150ee6; border: 1px solid #5a4630; }
.ap .dp-tw .dp-wh small.dn { color: #8fd08f; } .ap .dp-tw .dp-wh small.upn { color: #ff8a70; }
.ap .dp-bar.big { height: 14px; overflow: visible; }
.ap .dp-bar.big > i { border-radius: 6px; }
.ap .dp-tw.up .dp-bar > i { background: repeating-linear-gradient(90deg, #c0392b 0 10px, #8a2a1e 10px 12px); animation: dpthick .5s ease-out; } @keyframes dpthick { from { transform: scaleY(1.8); } }
.ap .dp-bar.gone > i { animation: dpgone .4s .2s both; } @keyframes dpgone { to { opacity: 0; } }
.ap .dp-pc { position: absolute; top: 2px; width: 8px; height: 8px; margin-left: -4px; background: #8a6a4a; border: 1px solid #c9a45a; animation: dpfly .8s var(--d) ease-out both; pointer-events: none; }
@keyframes dpfly { from { transform: translate(0, 0) rotate(0); opacity: 1; } to { transform: translate(var(--x), var(--y)) rotate(var(--r)); opacity: 0; } }
.ap .dp-stamp { display: inline-block; margin-bottom: 10px; padding: 4px 10px; border: 4px solid #c0392b; color: #e0402b; background: #2a0a06cc; font-style: normal; font-size: 30px; font-weight: 900; letter-spacing: .1em; transform: rotate(-12deg); animation: dpstamp .35s .25s cubic-bezier(.3, 1.6, .5, 1) both; pointer-events: none; }
@keyframes dpstamp { from { transform: rotate(-12deg) scale(2.6); opacity: 0; } }
.ap .dp-apps { flex: 1; min-height: 0; display: grid; grid-template-columns: 1fr 1fr; grid-auto-rows: minmax(54px, auto); align-content: start; gap: 6px; }
.ap .dp-ap { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; padding: 6px 4px; border-radius: 10px; border: 1px solid #6a5236; background: #241a10ee; color: #f3e3c0; cursor: pointer; min-width: 0; }
.ap .dp-ap b { font-size: 15px; } .ap .dp-ap .dp-p { font-size: 15px; font-weight: 800; color: #f3d38a; } .ap .dp-ap small { display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--mute); }
.ap .dp-ap.on { border-color: #e0bd78; box-shadow: 0 0 0 2px #e0bd78, 0 0 12px #e0bd7866; background: #3a2a16; }
.ap .dp-ap.gold { grid-column: 1 / -1; border-color: #f2c94c; background: #3a2a10ee; } .ap .dp-ap.gold b { color: #ffe08a; }
.ap .dp-ap:disabled { opacity: .4; cursor: default; }
.ap .dp-end { flex: 1; min-height: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; text-align: center; padding: 6px; } .ap .dp-end > b { font-size: 17px; color: #f3e3c0; } .ap .dp-end small { font-size: 12.5px; color: #d9c69a; word-break: keep-all; }
.ap .dp-end.bad > b { color: #ff8a70; } .ap .dp-end.hand > b { color: #ffe08a; }
.ap .dp-end.won .dp-big { font-size: 19px; line-height: 1.35; color: #ffe08a; text-shadow: 0 2px 8px #000; word-break: keep-all; animation: dpbig .6s 2.1s cubic-bezier(.3, 1.5, .5, 1) both; } .ap .dp-end.won small { animation: dpin .4s 2.7s both; }
@keyframes dpbig { from { opacity: 0; transform: scale(.6); } }
.ap .dp-go { flex: none; margin: 0 -12px; padding: 10px 12px calc(10px + env(safe-area-inset-bottom)); display: flex; gap: 8px; background: #120d08f2; border-top: 1px solid #6a5236; }
.ap .dp-go .btn { flex: 1; min-height: 48px; font-size: 16px; } .ap .dp-go .btn.ghost { flex: 0 0 34%; }
.ap .dpov.talk { padding: 0; align-items: stretch; } @media (min-height: 780px) { .ap .dpov.talk { align-items: center; padding: 10px; } }
`
