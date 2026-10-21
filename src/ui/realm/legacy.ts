/**
 * 계승 가신 화면 (src/realm/legacy.ts 의 셈 · VISION §5-4 · PLAY §5).
 *
 *   끝 화면 — 우리 장수 가운데 셋까지 고른다. 처음엔 솜씨 좋은 셋이 골라져 있다 (안 골라도 셋은 따라온다).
 *   나라 고르기 자세히 — "따라올 장수" 를 켜고 끈다 (기본은 셋 다).
 *   새 판을 열 때 — 켜진 이를 들이고 기록을 비운다 (realm-main.fresh).
 * 고른 것은 이 기기에만 (판 저장·도감처럼).
 */
import { retainable, snapshot } from '../../realm/legacy.ts'
import type { Hero, Realm, RegionId } from '../../realm/types.ts'
import { P } from '../../tune/params.ts'
import { nameHtml } from './heroview.ts'

const KEY = 'hanbal.realm.retain'

interface Rec {
  /** 고른 판의 시드 — 같은 판이면 고친다, 다른 판이면 새로 */
  seed: number
  from: { region: RegionId; nation: string }
  pick: Hero[]
  /** 자세히 화면에서 끈 이 */
  off: string[]
}

function load(): Rec | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Rec> | null
    if (v === null || typeof v.seed !== 'number' || !Array.isArray(v.pick) || v.from === undefined) return null
    return { seed: v.seed, from: v.from, pick: v.pick.filter((h) => typeof h?.id === 'string'), off: Array.isArray(v.off) ? v.off : [] }
  } catch {
    return null
  }
}

function save(r: Rec | null): void {
  try {
    if (r === null) localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, JSON.stringify(r))
  } catch { /* 저장 못 하는 곳 */ }
}

/**
 * 끝난 판의 고름을 맞춘다 — 처음이면 솜씨 좋은 셋, 이미 골랐으면 그 사람들의 지금 몸으로 고친다 (계속 둔 판에서 자랐을 수 있다).
 * 끝 화면을 그릴 때마다 부른다 (같으면 쓰지 않는다).
 */
export function syncRetain(r: Realm): void {
  if (r.outcome == null || r.region === 'tutorial') return
  const can = retainable(r)
  const had = load()
  const ids = had !== null && had.seed === r.seed ? had.pick.map((h) => h.id).filter((id) => can.some((h) => h.id === id)) : can.slice(0, P.realm.retainMax).map((h) => h.id)
  const next: Rec = { seed: r.seed, from: { region: r.region ?? 'byeonhan-mini', nation: r.player }, pick: ids.map((id) => snapshot(r.heroes[id]!)), off: [] }
  if (JSON.stringify(next) !== JSON.stringify(had)) save(next)
}

/** 끝 화면에서 하나를 넣거나 뺀다 — 셋이 차 있으면 넣지 않는다 */
export function toggleKeep(r: Realm, id: string): void {
  syncRetain(r)
  const had = load()
  const h = r.heroes[id]
  if (had === null || h === undefined || !retainable(r).some((x) => x.id === id)) return
  const on = had.pick.some((x) => x.id === id)
  if (on) had.pick = had.pick.filter((x) => x.id !== id)
  else if (had.pick.length < P.realm.retainMax) had.pick.push(snapshot(h))
  save(had)
}

/** 자세히 화면에서 켜고 끈다 */
export function toggleCarry(id: string): void {
  const had = load()
  if (had === null) return
  had.off = had.off.includes(id) ? had.off.filter((x) => x !== id) : [...had.off, id]
  save(had)
}

/** 새 판을 열 때 — 켜진 이를 넘기고 기록을 비운다. 배우는 판이면 손대지 않는다 */
export function takeRetainers(region: RegionId): Hero[] {
  if (region === 'tutorial') return []
  const had = load()
  if (had === null) return []
  save(null)
  return had.pick.filter((h) => !had.off.includes(h.id))
}

interface Kit {
  readonly esc: (s: string) => string
  readonly bust: (hero: string) => string | null
}

const face = (k: Kit, id: string): string => {
  const src = k.bust(id)
  return src !== null ? `<img src="${src}" alt="">` : '<span class="nof"></span>'
}

/** 끝 화면의 고르기 칸 */
export function retainHtml(k: Kit, r: Realm): string {
  const can = retainable(r)
  if (can.length === 0) return ''
  const had = load()
  const on = new Set(had !== null && had.seed === r.seed ? had.pick.map((h) => h.id) : [])
  const max = P.realm.retainMax
  let h = `<div class="retain"><h4>다음 판에 데려갈 장수 <small>${on.size}/${max}</small></h4><p class="mute">이겨도 져도 셋까지 따라온다. 자란 솜씨와 특성을 그대로 지니고 온다.</p><div class="rtl">`
  for (const x of can) {
    const sel = on.has(x.id)
    h += `<button class="rtc${sel ? ' on' : ''}${!sel && on.size >= max ? ' full' : ''}" data-act="keep" data-id="${x.id}">${face(k, x.id)}<b>${nameHtml(x.name)}</b><i>${sel ? '따라온다' : '남는다'}</i></button>`
  }
  return h + `</div></div>`
}

/** 나라 고르기 자세히의 "따라올 장수" — 고른 게 없으면 빈 글 */
export function carryHtml(k: Kit): string {
  const had = load()
  if (had === null || had.pick.length === 0) return ''
  let h = `<div class="retain carry"><h4>따라올 장수</h4><p class="mute">지난 판에서 고른 이들이다. 끄면 이번 판엔 데려가지 않는다 (그러면 이 기록은 사라진다).</p><div class="rtl">`
  for (const x of had.pick) {
    const on = !had.off.includes(x.id)
    h += `<button class="rtc${on ? ' on' : ''}" data-act="carry-tog" data-id="${x.id}">${face(k, x.id)}<b>${nameHtml(x.name)}</b><i>${on ? '따라온다' : '두고 간다'}</i></button>`
  }
  return h + `</div></div>`
}

export const LEGACY_CSS = `
.ap .retain { text-align: left; margin: 10px 0 4px; } .ap .retain h4 { margin: 4px 0 2px; color: var(--gold); } .ap .retain h4 small { color: var(--mute); font-weight: 400; }
.ap .retain .rtl { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.ap .retain .rtc { display: flex; flex-direction: column; align-items: center; gap: 2px; width: 78px; padding: 6px 2px 5px; border-radius: 12px; border: 1.5px solid var(--line);
  background: #1b2028; color: var(--ink); font: inherit; cursor: pointer; opacity: .62; }
.ap .retain .rtc img, .ap .retain .rtc .nof { width: 50px; height: 50px; border-radius: 50%; object-fit: cover; object-position: top; background: #14181e; }
.ap .retain .rtc b { font-size: 12px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .ap .retain .rtc .ttl { font-size: 9.5px; }
.ap .retain .rtc i { font-style: normal; font-size: 10.5px; color: var(--mute); }
.ap .retain .rtc.on { opacity: 1; border-color: #e0b860; background: linear-gradient(#2c2618, #1b2028); } .ap .retain .rtc.on i { color: #f0c860; }
.ap .retain .rtc.full { cursor: default; opacity: .4; }
.ap .front .retain.carry { margin: 8px 0 14px; }
.ap .tierp { display: flex; flex-direction: column; gap: 4px; margin: 6px 0 10px; } .ap .tierp > b { color: #f0a070; } .ap .tierp b { color: #f0a070; }
.ap .tierp .seg { flex-wrap: wrap; } .ap .tierp .seg button { min-width: 34px; }
.ap .tierup { text-align: center; color: #f0a070; margin: 8px 0; } .ap .tierc { margin-left: 6px; padding: 0 7px; border-radius: 9px; border: 1px solid #a0603a; color: #f0a070; font-size: 12px; }
.ap .front .bmeta.tierw { color: #f0a070; }
.ap .cardc { display: flex; gap: 10px; margin: 8px 0; padding: 10px; border-radius: 14px; border: 1px solid #6a5a3a; background: #201c16; text-align: left; flex-wrap: wrap; }
.ap .cardc.bad { border-color: #7a4a3a; background: #221816; }
.ap .cardc .cimg { width: min(180px, 100%); aspect-ratio: 3 / 2; object-fit: cover; border-radius: 10px; flex: none; }
.ap .cardc .cb { flex: 1; min-width: 200px; display: flex; flex-direction: column; gap: 4px; } .ap .cardc .cb > b { color: var(--gold); display: flex; align-items: center; gap: 6px; }
.ap .cardc .cic { width: 22px; height: 22px; } .ap .cardc p { margin: 0; font-size: 13.5px; }
.ap .cardc .copts { display: flex; flex-direction: column; gap: 6px; }
.ap .cardc .copt { display: flex; flex-direction: column; align-items: flex-start; gap: 1px; padding: 7px 10px; border-radius: 10px; border: 1px solid var(--line); background: var(--card); color: var(--ink); font: inherit; text-align: left; cursor: pointer; }
.ap .cardc .copt.on { border-color: var(--gold); background: #2c2618; } .ap .cardc .copt span { font-size: 12.5px; color: #cfc6b4; } .ap .cardc .copt i { font-style: normal; font-size: 11px; color: var(--mute); }
.ap .prologue .carried { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; font-size: 15px; animation-delay: .9s; }
.ap .prologue .carried img { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; object-position: top; border: 2px solid #2a1d10; }
`
