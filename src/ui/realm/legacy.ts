/**
 * 동행 화면 (src/realm/legacy.ts 의 셈 · VISION §5-4 · PLAY §5).
 *
 *   판 고르기(이야기 장 · 자유 판 나라 자세히) — 영웅전에서 거느려 본 장수 가운데 데려갈 이를 고른다.
 *   새 판을 열 때 — 고른 이를 처음 몸으로 들인다 (realm-main.fresh). 고름은 판을 넘어 남는다.
 * 고른 것은 이 기기에만 (판 저장·영웅전처럼). 옛 끝 화면 고름(hanbal.realm.retain)은 처음 한 번 읽어 이어 쓴다.
 */
import { retainMaxOf, snapshot } from '../../realm/legacy.ts'
import type { Hero, RegionId } from '../../realm/types.ts'
import { nameHtml } from './heroview.ts'

interface Kit {
  readonly esc: (s: string) => string
  readonly bust: (hero: string) => string | null
}

const face = (k: Kit, id: string): string => {
  const src = k.bust(id)
  return src !== null ? `<img src="${src}" alt="">` : '<span class="nof"></span>'
}

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

/**
 * 동행 — 영웅전에서 고른다 (형 10-25: "캠페인에서 장수 데려갈 때도 지난 판에서 데려가는 게 아니라 영웅전에서 데려가는 거 아님?").
 * 영웅전에 「거느림」으로 오른 장수(우리 장수로 부린 적이 있다) 가운데 난세 단계가 허락하는 만큼 — 이야기 장이든 자유 판이든 판을 열 때 고른다.
 * 고른 것은 판을 넘어 남는다 (다음 판에 다시 고르지 않아도 된다). 몸은 처음 나올 때의 몸이다 (legacy.bringRetainers)
 */
const BRING = 'hanbal.realm.bring'

export function loadBring(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(BRING) ?? 'null') as unknown
    if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string')
  } catch { /* 깨졌으면 아래 옛 고름으로 */ }
  // 옛 고름(끝 화면에서 고른 셋)이 있으면 그 사람들로 시작한다
  const old = load()
  return old !== null ? old.pick.filter((h) => !old.off.includes(h.id)).map((h) => h.id) : []
}

function saveBring(ids: readonly string[]): void {
  try { localStorage.setItem(BRING, JSON.stringify(ids)) } catch { /* 저장 못 하는 곳 */ }
}

/** 하나를 넣거나 뺀다 — 이미 다 찼으면 넣지 않는다 */
export function toggleBring(id: string, max: number): void {
  const ids = loadBring()
  if (ids.includes(id)) saveBring(ids.filter((x) => x !== id))
  else if (ids.length < max) saveBring([...ids, id])
}

/** 새 판을 열 때 — 고른 이의 처음 몸. 배우는 판이면 아무도 (몸은 영웅전 명부에서) */
export function takeRetainers(region: RegionId, tier: number, bodyOf: (id: string) => Hero | undefined): Hero[] {
  if (region === 'tutorial') return []
  return loadBring().slice(0, retainMaxOf(tier)).map((id) => bodyOf(id)).filter((h): h is Hero => h !== undefined).map(snapshot)
}

/** 판 고르기의 「데려갈 장수」 — 영웅전에서 거느려 본 장수들. max 는 고른 난세 단계의 동행 수 */
export function bringHtml(k: Kit, served: ReadonlyArray<{ id: string; name: string }>, max: number): string {
  const ids = loadBring().filter((id) => served.some((x) => x.id === id))
  const on = new Set(ids.slice(0, max))
  let h = `<div class="retain carry"><h4>데려갈 장수 <small>${on.size}/${max}</small></h4>`
  if (max === 0) return h + `<p class="mute">이 난세에서는 혼자 간다.</p></div>`
  if (served.length === 0) return h + `<p class="mute">우리 장수로 부린 이가 영웅전에 오르면 여기서 데려간다.</p></div>`
  h += `<p class="mute">영웅전에서 거느려 본 장수 · 처음 몸으로 온다.</p><div class="rtl">`
  for (const x of served) {
    const sel = on.has(x.id)
    h += `<button class="rtc${sel ? ' on' : ''}${!sel && on.size >= max ? ' full' : ''}" data-act="bring" data-id="${x.id}" data-max="${max}">${face(k, x.id)}<b>${nameHtml(x.name)}</b><i>${sel ? '데려간다' : '남는다'}</i></button>`
  }
  return h + `</div></div>`
}

export const LEGACY_CSS = `
.ap .retain { text-align: left; margin: 10px 0 4px; } .ap .retain h4 { margin: 4px 0 2px; color: var(--gold); } .ap .retain h4 small { color: var(--mute); font-weight: 400; }
.ap .retain .rtl { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.ap .retain .rtc { display: flex; flex-direction: column; align-items: center; gap: 2px; width: 78px; padding: 6px 2px 5px; border-radius: 12px; border: 1.5px solid var(--line);
  background: #1f1710; color: var(--ink); font: inherit; cursor: pointer; opacity: .62; }
.ap .retain .rtc img, .ap .retain .rtc .nof { width: 50px; height: 50px; border-radius: 50%; object-fit: cover; object-position: top; background: #17110c; }
.ap .retain .rtc b { font-size: 12px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .ap .retain .rtc .ttl { font-size: 9.5px; }
.ap .retain .rtc i { font-style: normal; font-size: 10.5px; color: var(--mute); }
.ap .retain .rtc.on { opacity: 1; border-color: #e0b860; background: linear-gradient(#2c2618, #1f1710); } .ap .retain .rtc.on i { color: #f0c860; }
.ap .retain .rtc.full { cursor: default; opacity: .4; }
.ap .front .retain.carry { margin: 8px 0 14px; }
.ap .tierp { display: flex; flex-direction: column; gap: 4px; margin: 6px 0 10px; } .ap .tierp > b { color: #f0a070; } .ap .tierp b { color: #f0a070; }
.ap .tierp .seg { flex-wrap: wrap; } .ap .tierp .seg button { min-width: 44px; }
.ap .tierp .seg button.locked { opacity: .45; cursor: default; } .ap .tierp .seg button.apex:not(.locked) { color: #ffb08a; border-color: #c0603a; }
.ap .front.boards .tierp { max-width: 980px; margin: 0 auto 8px; padding: 0 14px; }
.ap .tierup { text-align: center; color: #f0a070; margin: 8px 0; } .ap .tierc { display: inline-block; white-space: nowrap; margin-left: 6px; padding: 0 7px; border-radius: 9px; border: 1px solid #a0603a; color: #f0a070; font-size: 12px; }
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
