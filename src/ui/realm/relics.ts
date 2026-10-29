/**
 * 유물 화면 — 옛 무덤 · 끼우기 · 유물 도감 (docs/realm/HERO-GROWTH.md ★ 둘째 판 §B · §C · 셈은 src/realm/relics.ts).
 *
 *   이긴 판의 끝 화면 → 「옛 무덤을 열었다」 상자 셋(겉빛이 귀함) → 하나를 누르면 열린다(껴묻거리가 터지고 유물이 떠오른다) → 단련터.
 *   단련터의 장수 카드마다 유물 칸 — 누르면 가진 유물 고르기. 맨 아래 유물 도감(가진 것은 빛깔, 못 찾은 것은 검은 그림자).
 * 기록은 이 기기에만 (`hanbal.realm.relics` · 단련처럼). 못 읽으면 빈 기록 — 지우지는 않는다.
 */
import { josa } from '../../realm/data/prose.ts'
import { RELIC, RELICS, TIER_CHEST, TIER_NAME, poolOf } from '../../realm/data/relics.ts'
import {
  drawChests, emptyRelics, equip, holderOf, openTomb, pickTomb, relicLine, slotsFor, tombKey, unequip, type RelicOwn, type RelicStore, type RelicTomb,
} from '../../realm/relics.ts'
import type { Realm, RegionId } from '../../realm/types.ts'
import { P } from '../../tune/params.ts'

const KEY = 'hanbal.realm.relics'

const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

/** 판 밖 유물 기록 — 깨졌거나 없으면 빈 기록 */
export function loadRelics(): RelicStore {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<RelicStore> | null
    if (v === null || typeof v !== 'object') return emptyRelics()
    const own: Record<string, RelicOwn> = {}
    for (const [id, o] of Object.entries(v.own ?? {})) {
      if (RELIC[id] === undefined || o === null || typeof o !== 'object') continue
      own[id] = { n: Math.max(1, Math.floor(typeof o.n === 'number' ? o.n : 1)), seed: typeof o.seed === 'number' ? o.seed : 0, ...(typeof o.region === 'string' ? { region: o.region } : {}) }
    }
    const wear: Record<string, string[]> = {}
    for (const [hid, ids] of Object.entries(v.wear ?? {})) {
      const keep = strs(ids).filter((id) => own[id] !== undefined)
      if (keep.length > 0) wear[hid] = keep
    }
    const tombs: Record<string, RelicTomb> = {}
    for (const [k, t] of Object.entries(v.tombs ?? {})) {
      if (t === null || typeof t !== 'object') continue
      tombs[k] = { ids: strs(t.ids).filter((id) => RELIC[id] !== undefined), pick: typeof t.pick === 'string' ? t.pick : null }
    }
    const order = strs(v.order).filter((k) => tombs[k] !== undefined)
    return { v: 1, own, wear, tombs, order, ...(typeof v.wearAt === 'number' ? { wearAt: v.wearAt } : {}) }
  } catch {
    return emptyRelics()
  }
}

function saveRelics(s: RelicStore): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* 저장 못 하는 곳 — 이번 판의 무덤은 다시 열면 같은 셋이다 */ }
}

/** 이 판에 무덤이 열리나 — 이긴 판 · 배우는 판은 아니다 */
export const tombRun = (r: Realm | null): r is Realm => r !== null && r.outcome?.kind === 'win' && (r.region ?? 'byeonhan-mini') !== 'tutorial'

const regionOf = (r: Realm): RegionId => r.region ?? 'byeonhan-mini'

/** 이 판의 무덤 — 열지 않았으면 놓일 셋을 미리 (기록은 안 바꾼다) */
export function tombOf(r: Realm): RelicTomb {
  const s = loadRelics()
  return s.tombs[tombKey(r.seed)] ?? { ids: drawChests(r.seed, regionOf(r), s.own), pick: null }
}

/** 무덤을 연다 — 같은 판이면 같은 셋 (몇 번 불러도 한 번만 놓인다) */
export function openRunTomb(r: Realm): void {
  const s = loadRelics()
  const n = openTomb(s, r.seed, regionOf(r))
  if (n !== s) saveRelics(n)
}

/** 상자 하나를 골랐다 — 골랐으면 true (그 판에서 한 번만) */
export function pickRunRelic(r: Realm, id: string): boolean {
  const s = openTomb(loadRelics(), r.seed, regionOf(r))
  const n = pickTomb(s, r.seed, id, regionOf(r))
  if (n === s) return false
  saveRelics(n)
  return true
}

/** 단련터의 칸에 끼운다 — level 은 그 장수의 단련 단계 */
export function putRelic(hero: string, slot: number, relic: string, level: number): boolean {
  const s = loadRelics()
  const n = equip(s, hero, slot, relic, level)
  if (n === s) return false
  saveRelics({ ...n, wearAt: Date.now() }) // 기기를 맞출 때 나중에 바꾼 쪽을 따른다
  return true
}

/** 단련터의 칸을 비운다 */
export function takeOffRelic(hero: string, slot: number): boolean {
  const s = loadRelics()
  const n = unequip(s, hero, slot)
  if (n === s) return false
  saveRelics({ ...n, wearAt: Date.now() })
  return true
}

/** 그 장수가 끼운 유물 (다음 판에 들고 간다) */
export const wornBy = (hero: string): readonly string[] => loadRelics().wear[hero] ?? []

export interface RelicKit {
  /** 그림 뿌리 — …/realm/ */
  readonly art: string
  readonly esc: (s: string) => string
  /** 장수 이름 (명부 · 단련 기록) */
  readonly nameOf: (id: string) => string
}

const img = (k: RelicKit, id: string): string => `${k.art}relic/${id}.png`
const chestImg = (k: RelicKit, id: string): string => `${k.art}relic/${TIER_CHEST[RELIC[id]?.tier ?? 'common']}.png`
const tipOf = (id: string): string => { const d = RELIC[id]; return d === undefined ? '' : `${d.name} · ${d.era}: ${relicLine(id)}` }

// ───────── 끝 화면 — 무덤 한 줄

/** 끝 화면의 무덤 한 줄 — 아직 안 골랐으면 상자 셋과 「옛 무덤을 열었다 ›」, 골랐으면 얻은 유물 */
export function tombStripHtml(k: RelicKit, r: Realm): string {
  if (!tombRun(r)) return ''
  const t = tombOf(r)
  if (t.ids.length === 0) return ''
  if (t.pick !== null) {
    const d = RELIC[t.pick]!
    return `<div class="tbstrip got"><img class="tbsr" src="${img(k, d.id)}" alt=""><div><b>${k.esc(josa(d.name, '을', '를'))} 얻었다</b><small>${k.esc(d.era)}: 단련터에서 장수에게 끼운다</small></div></div>`
  }
  let h = `<div class="tbstrip"><h4>옛 무덤을 열었다 <small>껴묻거리 셋 가운데 하나</small></h4><div class="tbsl">`
  for (const id of t.ids) h += `<img class="tbsc t-${RELIC[id]!.tier}" src="${chestImg(k, id)}" alt="${TIER_NAME[RELIC[id]!.tier]}">`
  return h + `</div><button class="btn pri big tbopen" data-act="tomb-open">상자를 고르러 ›</button></div>`
}

// ───────── 무덤 화면

/** 옛 무덤 — 상자 셋. fresh 면 방금 연 상자가 터지며 열린다 */
export function tombHtml(k: RelicKit, r: Realm, fresh: boolean): string {
  const t = tombOf(r)
  let h = `<div class="front tomb"><div class="fhead"><h2>옛 무덤을 열었다</h2></div>`
  h += `<p class="tblead">${t.pick === null ? '덧널 셋이 놓였다. 하나만 연다. 겉빛이 귀함이고, 안은 열어야 안다.' : '껴묻거리를 얻었다. 장수가 몸에 지니고 다음 판에 들고 간다. 유물은 잃지 않는다.'}</p><div class="tbrow">`
  t.ids.forEach((id, i) => {
    const d = RELIC[id]!
    const tier = `t-${d.tier}`
    if (t.pick === null) {
      h += `<button class="tbx ${tier}" data-act="tomb-pick" data-id="${k.esc(id)}" style="--i:${i}"><img class="tbc" src="${chestImg(k, id)}" alt=""><span class="tbt">${TIER_NAME[d.tier]}</span></button>`
    } else if (id === t.pick) {
      h += `<div class="tbx ${tier} open${fresh ? ' fresh' : ''}"><img class="tbc" src="${chestImg(k, id)}" alt=""><img class="tbloot" src="${k.art}relic/loot.png" alt=""><img class="tbr" src="${img(k, id)}" alt="">`
        + `<b class="tbn">${k.esc(d.name)}</b><small class="tbe">${TIER_NAME[d.tier]} · ${k.esc(d.era)}</small><span class="tbfx">${k.esc(relicLine(id))}</span></div>`
    } else {
      // 안 고른 둘은 닫힌 채 — 안을 보여 주지 않는다 (형 10-29: "남은 2상자에 들어있던 거 보여 주는 건 말이 안 된다")
      h += `<div class="tbx ${tier} miss${fresh ? ' fresh' : ''}"><img class="tbc" src="${chestImg(k, id)}" alt=""></div>`
    }
  })
  h += `</div>`
  if (t.pick !== null) h += `<div class="tbgo"><button class="btn pri big" data-act="dy-open">단련터에서 끼운다 ›</button><button class="btn ghost" data-act="tomb-back">끝 화면으로</button></div>`
  else h += `<div class="tbgo"><button class="btn ghost" data-act="tomb-back">‹ 끝 화면으로 (나중에 고른다)</button></div>`
  if (t.pick !== null && fresh) h += revealHtml(k, t.pick)
  return h + `</div>`
}

/**
 * 방금 연 상자 — 화면을 덮고 크게 (형: "유저가 퍽 하면 게임은 으아아아" · 메모리 wwe-overreaction-ux).
 * 번쩍 → 상자가 터지며 흙먼지 → 유물이 솟아 낱알 금빛이 흩어지고 → 이름이 도장처럼 박힌다. 누르면 덮개만 걷힌다(안 고른 둘은 닫힌 채).
 * 금빛 낱알은 한 개짜리 그림(fx/gold)을 N개로 흩는다 — 덩어리 그림을 통째로 움직이지 않는다
 */
function revealHtml(k: RelicKit, id: string): string {
  const d = RELIC[id]!
  let fx = ''
  const dusts = P.realm.relicDusts
  for (let i = 0; i < dusts; i++) fx += `<img class="tbdu" src="${k.art}fx/dust.png" alt="" style="--a:${((i * 360) / Math.max(1, dusts) + 20).toFixed(0)}deg;--t:${(i % 3) * 0.05}s">`
  const sparks = P.realm.relicSparks
  for (let i = 0; i < sparks; i++) {
    // 해바라기 씨 배치(137.5°)로 고르게 · 거리·크기·늦음은 번호로 엇갈린다 (그리기만 — 판 상태는 안 건드린다)
    const a = (i * 137.5) % 360
    const r = 120 + ((i * 53) % 170)
    const s = 12 + ((i * 29) % 26)
    fx += `<img class="tbsp" src="${k.art}fx/gold.png" alt="" style="--a:${a.toFixed(1)}deg;--r:${r}px;--s:${s}px;--t:${(0.55 + (i % 8) * 0.05).toFixed(2)}s">`
  }
  return `<div class="tbrv t-${d.tier}" data-act="tomb-seen"><div class="tbfl"></div><div class="tbglow"></div>`
    + `<div class="tbst">${fx}<img class="tbrc" src="${chestImg(k, id)}" alt=""><img class="tbrr" src="${img(k, id)}" alt=""></div>`
    + `<div class="tbrt"><span class="tbtier">${TIER_NAME[d.tier]}</span><b>${k.esc(d.name)}</b><small>${k.esc(d.era)}</small><span class="tbrfx">${k.esc(relicLine(id))}</span></div>`
    + `<div class="tbgo"><button class="btn pri big" data-act="dy-open">단련터에서 끼운다 ›</button><button class="btn ghost" data-act="tomb-back">끝 화면으로</button></div></div>`
}

// ───────── 단련터 — 유물 칸 · 고르기 · 도감

/** 장수 카드 밑의 유물 칸 — sel 은 열려 있는 칸 */
export function slotsHtml(k: RelicKit, hero: string, level: number, sel: number | null): string {
  const s = loadRelics()
  const worn = s.wear[hero] ?? []
  const n = slotsFor(level)
  const none = Object.keys(s.own).length === 0
  let h = `<div class="rlslots">`
  for (let i = 0; i < n; i++) {
    const id = worn[i]
    const on = sel === i ? ' sel' : ''
    if (id !== undefined && RELIC[id] !== undefined) {
      h += `<button class="rlslot full${on}" data-act="rl-slot" data-id="${k.esc(hero)}" data-i="${i}" data-tip="${k.esc(tipOf(id))}"><img src="${img(k, id)}" alt=""><span><b>${k.esc(RELIC[id]!.name)}</b><small>${k.esc(relicLine(id))}</small></span></button>`
    } else {
      h += `<button class="rlslot${on}" data-act="rl-slot" data-id="${k.esc(hero)}" data-i="${i}"${none ? ' disabled data-tip="이긴 판의 옛 무덤에서 얻는다"' : ''}><i>＋</i><span>${none ? '유물 칸: 이기면 옛 무덤에서' : '유물 끼우기'}</span></button>`
    }
  }
  if (n < slotsFor(Number.MAX_SAFE_INTEGER)) h += `<small class="rlmore">단련 ${josa(String(slotsAt()), '이면', '면')} 한 칸 더</small>`
  return h + `</div>`
}

/** 두 칸이 열리는 단련 단계 */
const slotsAt = (): number => {
  for (let lv = 0; lv < 200; lv++) if (slotsFor(lv) > slotsFor(0)) return lv
  return 0
}

/** 칸을 누르면 — 가진 유물 고르기 (지닌 이가 있으면 옮긴다) */
export function pickerHtml(k: RelicKit, hero: string, slot: number): string {
  const s = loadRelics()
  const cur = s.wear[hero]?.[slot]
  const ids = RELICS.filter((d) => s.own[d.id] !== undefined).map((d) => d.id)
  let h = `<div class="rlpick"><div class="rlph"><b>유물 고르기</b><button class="btn ghost sm" data-act="rl-close">닫기</button></div><div class="rlpl">`
  for (const id of ids) {
    const d = RELIC[id]!
    const who = holderOf(s, id)
    const here = who === hero
    const by = who !== null && !here ? `<i class="rlwho">${k.esc(josa(k.nameOf(who), '이', '가'))} 지녔다: 옮긴다</i>` : here ? '<i class="rlwho me">이 장수가 지녔다</i>' : ''
    h += `<button class="rlopt t-${d.tier}${id === cur ? ' cur' : ''}" data-act="rl-put" data-id="${k.esc(hero)}" data-i="${slot}" data-r="${k.esc(id)}"${id === cur ? ' disabled' : ''}>`
      + `<img src="${img(k, id)}" alt=""><span><b>${k.esc(d.name)}</b><small>${TIER_NAME[d.tier]} · ${k.esc(d.era)}</small><em>${k.esc(relicLine(id))}</em>${by}</span></button>`
  }
  h += `</div>`
  if (cur !== undefined) h += `<button class="btn ghost sm rloff" data-act="rl-off" data-id="${k.esc(hero)}" data-i="${slot}">이 칸 비우기</button>`
  return h + `</div>`
}

/** 유물 도감 — 가진 것은 빛깔, 못 찾은 것은 검은 그림자와 ? (어느 땅에서 나는지는 보인다) */
export function relicDexHtml(k: RelicKit): string {
  const s = loadRelics()
  const got = RELICS.filter((d) => s.own[d.id] !== undefined).length
  let h = `<div class="rldex"><h3>유물 도감 <small>${got} / ${RELICS.length}</small></h3><div class="rldl">`
  for (const d of RELICS) {
    const o = s.own[d.id]
    if (o !== undefined) {
      const who = holderOf(s, d.id)
      h += `<span class="rld t-${d.tier}" data-tip="${k.esc(tipOf(d.id) + (who !== null ? ` · ${k.nameOf(who)} 지님` : ''))}"><img src="${img(k, d.id)}" alt=""><b>${k.esc(d.name)}</b>${o.n > 1 ? `<i>×${o.n}</i>` : ''}</span>`
    } else {
      const where = BOARD_HINT.filter((b) => poolOf(b.id).some((x) => x.id === d.id)).map((b) => b.name).join(' · ')
      h += `<span class="rld none" data-tip="${k.esc(`${TIER_NAME[d.tier]}: ${where !== '' ? `${where}에서 이기면 나올 수 있다` : '아직 나는 판이 없다'}`)}"><img src="${img(k, d.id)}" alt=""><b>?</b></span>`
    }
  }
  return h + `</div></div>`
}

/** 도감의 귀띔 — 어느 판에서 나나 */
const BOARD_HINT: ReadonlyArray<{ id: RegionId; name: string }> = [
  { id: 'byeonhan-mini', name: '변한' }, { id: 'yeongnam', name: '영남' }, { id: 'south', name: '삼한' }, { id: 'world', name: '북녘' },
]

// ───────── 판 안 — 장수 판의 유물

/** 장수 이름 곁의 유물 그림 — 누르거나 대면 이름 · 효과 */
export function relicChips(art: string, esc: (s: string) => string, ids: readonly string[] | undefined): string {
  if (ids === undefined || ids.length === 0) return ''
  return ids.filter((id) => RELIC[id] !== undefined).map((id) => `<span class="rlchip" data-tip="${esc(tipOf(id))}"><img src="${art}relic/${id}.png" alt="${esc(RELIC[id]!.name)}"></span>`).join('')
}

export const RELIC_CSS = `
.ap .rlchip { display: inline-grid; place-items: center; width: 24px; height: 24px; margin-left: 3px; vertical-align: middle; border-radius: 50%; background: radial-gradient(#4a3a1a, #1f170e); border: 1px solid #c9a23a; }
.ap .rlchip img { width: 21px; height: 21px; object-fit: contain; filter: drop-shadow(0 1px 1px #000a); }
.ap .rlslots { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.ap .rlslot { flex: 1 1 200px; display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 2px; border-radius: 0; border: 8px solid transparent; border-image: url(__ART__ui/btn-dark.png?v=2) 30 33 fill / 8px 10px stretch; background: none; color: #cbbf9f; font: inherit; font-size: 12.5px; text-align: left; cursor: pointer; }
.ap .rlslot i { font-style: normal; font-size: 18px; color: #c9a23a; width: 36px; text-align: center; }
.ap .rlslot.full { border-style: solid; border-color: #c9a23a; background: linear-gradient(90deg, #2c2412, #1a140d); }
.ap .rlslot.full img { width: 40px; height: 40px; object-fit: contain; flex: none; filter: drop-shadow(0 2px 3px #000b); }
.ap .rlslot span { display: flex; flex-direction: column; min-width: 0; } .ap .rlslot b { color: #f0e2c0; font-size: 13px; } .ap .rlslot small { color: #a89c84; font-size: 11px; }
.ap .rlslot.sel { box-shadow: 0 0 0 2px #ffd27a; }
.ap .rlslot:disabled { cursor: default; opacity: .6; }
.ap .rlmore { color: var(--mute); font-size: 11px; }
.ap .rlpick { margin-top: 2px; padding: 8px; border-radius: 12px; border: 1px solid #c9a23a; background: #120d08; animation: dyin .25s ease-out both; }
.ap .rlph { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; color: var(--gold); }
.ap .rlpl { display: flex; flex-direction: column; gap: 5px; max-height: 320px; overflow-y: auto; }
.ap .rlopt { display: flex; align-items: center; gap: 8px; padding: 5px 8px; border-radius: 10px; border: 1px solid #4a3e2a; background: #1d160e; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.ap .rlopt img { width: 44px; height: 44px; object-fit: contain; flex: none; }
.ap .rlopt span { display: flex; flex-direction: column; min-width: 0; } .ap .rlopt b { color: #f0e2c0; } .ap .rlopt small { color: #a89c84; font-size: 11px; }
.ap .rlopt em { font-style: normal; color: #9fd07a; font-size: 12px; }
.ap .rlopt .rlwho { font-style: normal; color: #e0b070; font-size: 11px; } .ap .rlopt .rlwho.me { color: #9fd07a; }
.ap .rlopt.cur { border-color: #9fd07a; cursor: default; }
.ap .rlopt.t-rare { border-color: #6a8aa0; } .ap .rlopt.t-legend { border-color: #c9a23a; background: linear-gradient(90deg, #2c2412, #1d160e); }
.ap .rloff { margin-top: 6px; }
.ap .rldex { max-width: 980px; margin: 14px auto 4px; padding: 0 14px; }
.ap .rldex h3 { margin: 0 0 6px; color: var(--gold); font-size: 15px; } .ap .rldex h3 small { color: var(--mute); font-weight: 400; margin-left: 6px; }
.ap .rldl { display: grid; grid-template-columns: repeat(auto-fill, minmax(76px, 1fr)); gap: 6px; }
.ap .rld { position: relative; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 6px 2px; border-radius: 10px; border: 1px solid #4a3e2a; background: #18120b; }
.ap .rld img { width: 54px; height: 54px; object-fit: contain; filter: drop-shadow(0 2px 3px #000b); }
.ap .rld b { font-size: 11px; color: #e8dcc0; text-align: center; line-height: 1.2; }
.ap .rld i { position: absolute; top: 3px; right: 5px; font-style: normal; font-size: 10.5px; color: #ffd27a; }
.ap .rld.t-rare { border-color: #6a8aa0; } .ap .rld.t-legend { border-color: #c9a23a; box-shadow: inset 0 0 12px #c9a23a33; }
.ap .rld.none img { filter: brightness(0) opacity(.45); } html.gfxsafe .ap .rld.none img { opacity: .12; } .ap .rld.none b { color: #6a604e; font-size: 16px; }
.ap .tbstrip { max-width: 560px; margin: 10px auto 4px; padding: 10px 12px; border-radius: 14px; border: 1px solid #c9a45a; background: radial-gradient(ellipse at top, #3a2c14e6, #1f1710e6); text-align: left; }
.ap .tbstrip h4 { margin: 0 0 6px; color: var(--gold); } .ap .tbstrip h4 small { color: var(--mute); font-weight: 400; margin-left: 6px; }
.ap .tbstrip .tbsl { display: flex; justify-content: center; gap: 14px; }
.ap .tbstrip .tbsc { width: 72px; height: 72px; object-fit: contain; animation: tbbob 2.2s ease-in-out infinite; filter: drop-shadow(0 3px 4px #000c); }
.ap .tbstrip .tbsc:nth-child(2) { animation-delay: .3s; } .ap .tbstrip .tbsc:nth-child(3) { animation-delay: .6s; }
.ap .tbstrip .tbsc.t-legend { filter: drop-shadow(0 0 10px #ffd27a); }
.ap .tbstrip .tbopen { display: flex; margin: 8px auto 0; }
.ap .tbstrip.got { display: flex; align-items: center; gap: 10px; } .ap .tbstrip.got div { display: flex; flex-direction: column; }
.ap .tbstrip.got b { color: #f0e2c0; } .ap .tbstrip.got small { color: var(--mute); font-size: 12px; }
.ap .tbstrip .tbsr { width: 56px; height: 56px; object-fit: contain; flex: none; }
@keyframes tbbob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
.ap .front.tomb { text-align: center; }
.ap .front.tomb .tblead { max-width: 640px; margin: 2px auto 10px; padding: 0 14px; color: #cbbf9f; font-size: 13.5px; }
.ap .tbrow { display: flex; justify-content: center; align-items: flex-end; flex-wrap: wrap; gap: 14px; max-width: 900px; margin: 0 auto; padding: 18px 14px 8px; }
.ap .tbx { position: relative; flex: 0 1 220px; min-height: 260px; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 4px; padding: 10px 8px 12px; border-radius: 16px; border: 1px solid #5a4a30; background: radial-gradient(ellipse at 50% 80%, #2c2214, #120d08); color: inherit; font: inherit; }
.ap button.tbx { cursor: pointer; animation: tbin .5s calc(var(--i) * .15s) ease-out both; }
.ap button.tbx:hover .tbc, .ap button.tbx:focus-visible .tbc { animation: tbshake .5s ease-in-out infinite; }
.ap .tbx .tbc { width: 170px; height: 170px; object-fit: contain; filter: drop-shadow(0 6px 6px #000c); }
.ap .tbx.t-rare { border-color: #6a8aa0; box-shadow: 0 0 18px #6a8aa055; }
.ap .tbx.t-legend { border-color: #e0b84a; box-shadow: 0 0 26px #ffd27a77; }
.ap .tbx .tbt { font-size: 13px; font-weight: 700; color: #cbbf9f; } .ap .tbx.t-rare .tbt { color: #a8c8e0; } .ap .tbx.t-legend .tbt { color: #ffe08a; }
.ap .tbx.open .tbc { opacity: .35; transform: translateY(26px) scale(.82); }
.ap .tbx.open .tbloot { position: absolute; left: 50%; top: 40%; width: 220px; height: 220px; object-fit: contain; transform: translate(-50%, -50%); pointer-events: none; opacity: 0; }
.ap .tbx.open .tbr { position: absolute; left: 50%; top: 18px; width: 140px; height: 140px; object-fit: contain; transform: translateX(-50%); filter: drop-shadow(0 0 16px #ffd27acc); }
.ap .tbx.open .tbn { font-size: 18px; color: #ffe08a; } .ap .tbx .tbe { color: #a89c84; font-size: 11.5px; } .ap .tbx .tbfx { color: #9fff8a; font-size: 13px; font-weight: 700; }
.ap .tbx.open.fresh .tbc { animation: tbpop .6s ease-out both; }
.ap .tbx.open.fresh .tbloot { animation: tbburst 1.3s .15s ease-out both; }
.ap .tbx.open.fresh .tbr { animation: tbrise 1.1s .35s cubic-bezier(.2,.9,.25,1.2) both; }
.ap .tbx.open.fresh .tbn, .ap .tbx.open.fresh .tbe, .ap .tbx.open.fresh .tbfx { animation: tbin .5s 1s ease-out both; }
.ap .tbx.miss { opacity: .55; } .ap .tbx.miss .tbc { opacity: .3; transform: scale(.8); }
.ap .tbx.miss .tbr { position: absolute; left: 50%; top: 40px; width: 96px; height: 96px; object-fit: contain; transform: translateX(-50%); filter: grayscale(.7); }
.ap .tbx.miss .tbn { color: #a89c84; font-size: 14px; }
.ap .tbx.miss.fresh { animation: tbfade 1s 1.4s ease-out both; }
@keyframes tbin { from { transform: translateY(14px); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes tbshake { 0%, 100% { transform: rotate(0); } 25% { transform: rotate(-3deg); } 75% { transform: rotate(3deg); } }
@keyframes tbpop { 0% { transform: scale(1.15) rotate(-4deg); opacity: 1; } 40% { transform: scale(1.25) rotate(4deg); opacity: 1; } 100% { transform: translateY(26px) scale(.82); opacity: .35; } }
@keyframes tbburst { 0% { opacity: 0; transform: translate(-50%, -50%) scale(.3); } 30% { opacity: 1; transform: translate(-50%, -50%) scale(1.15); } 100% { opacity: 0; transform: translate(-50%, -70%) scale(1.5); } }
@keyframes tbrise { from { opacity: 0; transform: translate(-50%, 90px) scale(.4); } to { opacity: 1; transform: translateX(-50%); } }
@keyframes tbfade { from { opacity: 0; } to { opacity: .55; } }
.ap .front.tomb .tbgo { display: flex; justify-content: center; gap: 8px; flex-wrap: wrap; margin: 14px 0 4px; }
/* 고른 상자가 북소리에 떨리고, 다른 둘은 물러난다 (app.ts tomb-pick — 터지기 전 relicShakeMs) */
.ap .tbrow.shaking button.tbx { pointer-events: none; }
.ap .tbrow.shaking .tbx.go { z-index: 2; animation: tbgo .2s ease-out both; }
.ap .tbrow.shaking .tbx.go .tbc { animation: tbrumble .12s linear infinite, tbswell var(--ms) ease-in both; }
.ap .tbrow.shaking .tbx.go.t-common { box-shadow: 0 0 34px #e0a85a88; } .ap .tbrow.shaking .tbx.go.t-rare { box-shadow: 0 0 40px #7ac0ffaa; } .ap .tbrow.shaking .tbx.go.t-legend { box-shadow: 0 0 56px #ffd27acc; }
.ap .tbrow.shaking .tbx:not(.go) { animation: tbaway .45s ease-in both; }
@keyframes tbgo { to { transform: translateY(-8px) scale(1.06); } }
@keyframes tbrumble { 0%, 100% { translate: 0 0; rotate: 0deg; } 25% { translate: -3px 1px; rotate: -3deg; } 50% { translate: 2px -2px; rotate: 2deg; } 75% { translate: 3px 1px; rotate: 4deg; } }
@keyframes tbswell { from { scale: 1; filter: drop-shadow(0 6px 6px #000c) brightness(1); } to { scale: 1.14; filter: drop-shadow(0 0 22px #ffe3a0) brightness(1.5); } }
@keyframes tbaway { to { opacity: .2; transform: translateY(16px) scale(.9); filter: grayscale(.8); } }
/* 열린 상자 — 화면을 덮는다 */
.ap .tbrv { position: fixed; inset: 0; z-index: 60; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 16px; background: radial-gradient(ellipse at 50% 42%, #22190efc, #070504fc 70%); cursor: pointer; overflow: hidden; animation: tbrvin .25s ease-out both; }
.ap .tbrv.t-legend { animation: tbrvin .25s ease-out both, tbquake .55s .1s ease-out both; }
@keyframes tbrvin { from { opacity: 0; } to { opacity: 1; } }
/* 화면 가득 흔들 때는 먼저 6% 키운 채로 흔든다 — 그냥 밀면 가장자리가 안으로 들어와 뒤의 지도가 비친다 (형 10-26) */ @keyframes tbquake { 0%, 100% { translate: 0 0; scale: 1; } 8%, 92% { translate: 0 0; scale: 1.06; } 25% { translate: -9px 5px; scale: 1.06; } 42% { translate: 8px -6px; scale: 1.06; } 60% { translate: -5px 3px; scale: 1.06; } 78% { translate: 3px -2px; scale: 1.06; } }
.ap .tbrv .tbfl { position: absolute; inset: 0; pointer-events: none; background: #fff3d8; animation: tbflash .55s ease-out both; }
.ap .tbrv.t-rare .tbfl { background: #dff0ff; } .ap .tbrv.t-legend .tbfl { background: #fff6c8; animation-duration: .8s; }
@keyframes tbflash { from { opacity: .95; } to { opacity: 0; } }
.ap .tbrv .tbglow { position: absolute; left: 50%; top: 40%; width: min(92vw, 620px); height: min(70vh, 460px); transform: translate(-50%, -50%); pointer-events: none; border-radius: 50%; background: radial-gradient(ellipse, #e0a85a55, #0000 68%); animation: tbglow 2.6s .3s ease-in-out infinite alternate both; }
.ap .tbrv.t-rare .tbglow { background: radial-gradient(ellipse, #7ac0ff55, #0000 68%); } .ap .tbrv.t-legend .tbglow { background: radial-gradient(ellipse, #ffd27a88, #0000 68%); }
@keyframes tbglow { from { opacity: .55; scale: .9; } to { opacity: 1; scale: 1.08; } }
.ap .tbrv .tbst { position: relative; width: 300px; height: 300px; flex: none; }
.ap .tbrv .tbrc { position: absolute; left: 50%; bottom: 0; width: 200px; height: 200px; object-fit: contain; transform: translateX(-50%); animation: tbcrack .9s ease-out both; }
@keyframes tbcrack { 0% { opacity: 1; transform: translateX(-50%) scale(1.25); } 18% { transform: translateX(-50%) scale(1.4) rotate(-5deg); } 100% { opacity: .28; transform: translateX(-50%) translateY(40px) scale(.75); } }
.ap .tbrv .tbdu { position: absolute; left: 50%; bottom: 40px; width: 120px; height: 120px; margin-left: -60px; object-fit: contain; pointer-events: none; opacity: 0; animation: tbdust 1.3s var(--t) ease-out both; }
@keyframes tbdust { 0% { opacity: .9; transform: rotate(var(--a)) translateY(0) scale(.4); } 100% { opacity: 0; transform: rotate(var(--a)) translateY(-150px) scale(1.4); } }
.ap .tbrv .tbsp { position: absolute; left: 50%; top: 45%; width: var(--s); height: var(--s); margin: calc(var(--s) / -2) 0 0 calc(var(--s) / -2); pointer-events: none; opacity: 0; animation: tbspark 1.5s var(--t) cubic-bezier(.15,.8,.3,1) both; }
@keyframes tbspark { 0% { opacity: 0; transform: rotate(var(--a)) translateY(0) scale(.3); } 15% { opacity: 1; } 100% { opacity: 0; transform: rotate(var(--a)) translateY(calc(var(--r) * -1)) scale(1); } }
.ap .tbrv .tbrr { position: absolute; left: 50%; top: 4px; width: 240px; height: 240px; object-fit: contain; transform: translateX(-50%); filter: drop-shadow(0 0 22px #ffd27acc); animation: tbup 1.1s .35s cubic-bezier(.2,.9,.25,1.25) both, tbhover 3s 1.5s ease-in-out infinite; }
.ap .tbrv.t-rare .tbrr { filter: drop-shadow(0 0 22px #8ac8ffcc); } .ap .tbrv.t-legend .tbrr { filter: drop-shadow(0 0 30px #ffd27a) drop-shadow(0 0 8px #fff3c0); }
@keyframes tbup { from { opacity: 0; transform: translate(-50%, 120px) scale(.3); } to { opacity: 1; transform: translateX(-50%); } }
@keyframes tbhover { 0%, 100% { translate: 0 0; } 50% { translate: 0 -8px; } }
.ap .tbrv .tbrt { position: relative; display: flex; flex-direction: column; align-items: center; gap: 3px; text-align: center; max-width: 560px; }
.ap .tbrv .tbtier { font-size: 13px; font-weight: 800; letter-spacing: .3em; padding: 2px 12px; border-radius: 99px; color: #f0e2c0; border: 1px solid #c9a45a88; background: #00000066; animation: tbin .4s 1.05s ease-out both; }
.ap .tbrv.t-rare .tbtier { color: #bfe0ff; border-color: #7ac0ff88; } .ap .tbrv.t-legend .tbtier { color: #ffe08a; border-color: #ffd27a; box-shadow: 0 0 14px #ffd27a88; }
.ap .tbrv .tbrt b { font-size: clamp(30px, 7vw, 46px); line-height: 1.15; color: #ffe8b0; text-shadow: 0 3px 0 #000, 0 0 18px #ffb84a88; animation: tbstamp .5s 1.2s cubic-bezier(.3,1.6,.5,1) both; }
@keyframes tbstamp { from { opacity: 0; transform: scale(2.4); } to { opacity: 1; transform: scale(1); } }
.ap .tbrv .tbrt small { color: #b8aa88; font-size: 13px; animation: tbin .4s 1.5s ease-out both; }
.ap .tbrv .tbrfx { margin-top: 4px; color: #b8ff9a; font-size: 16px; font-weight: 800; text-shadow: 0 2px 0 #000; animation: tbin .4s 1.65s ease-out both; }
.ap .tbrv .tbgo { position: relative; animation: tbin .4s 1.9s ease-out both; }
@media (max-width: 560px) { .ap .tbrv .tbst { width: 240px; height: 240px; } .ap .tbrv .tbrr { width: 190px; height: 190px; } .ap .tbrv .tbrc { width: 160px; height: 160px; } }
@media (prefers-reduced-motion: reduce) { .ap .tbrv, .ap .tbrv *, .ap .tbrow.shaking .tbx, .ap .tbrow.shaking .tbx .tbc { animation-duration: .01s !important; animation-iteration-count: 1 !important; } }
`
