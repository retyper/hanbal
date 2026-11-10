/**
 * 인연 막대 — 저장과 그림 (src/realm/bonds.ts 의 셈 · docs/realm/BONDS.md §2 · §6 의 1~2단계).
 *
 * 기록 `hanbal.realm.bonds` = { v:1, h:{ [장수]:{ p } }, run:{ [판 시드]:{ [장수]:이 판에서 쌓은 몫 } } }
 *  - 판(시드)마다 가장 높은 값만 센다 — 같은 판을 다시 불러도 두 번 쌓지 않는다
 *  - 옛 기록(도감 거느림·사로잡음, 데려가기 고름)은 새 키를 처음 만들 때 한 번 옮긴다. 옛 키는 지우지 않는다 (localStorage.clear() 금지)
 *  - 저장하지 못하는 곳이면 조용히 건너뛴다
 */
import { P } from '../../tune/params.ts'
import { BOND_TIERS, bondFill, bondTierOf, bondWord, dexDeed, runDeeds, type BondMemory } from '../../realm/bonds.ts'
import { DEX_CAUGHT, DEX_SERVED, dexCatalog, type Dex } from '../../realm/dex.ts'
import type { Realm } from '../../realm/types.ts'
import { TRAIT } from '../../realm/data/traits.ts'
import { nameHtml } from './heroview.ts'

const KEY = 'hanbal.realm.bonds'
const KEEP_RUNS = 60

export interface BondStore {
  v: 1
  /** p = 쌓은 몫 · keep = 지난 판에 눈뜬 재주 (3단이 새 판에 들고 간다 · 옛 저장에는 없다) */
  h: Record<string, { p: number; keep?: string }>
  run: Record<string, Record<string, number>>
}

const num = (x: unknown): number => (typeof x === 'number' && Number.isFinite(x) && x > 0 ? x : 0)

function readDexRaw(): Dex {
  try {
    const v = JSON.parse(localStorage.getItem('hanbal.realm.dex') ?? 'null') as Record<string, { f?: unknown }> | null
    const out: Dex = {}
    if (v !== null && typeof v === 'object') for (const [id, e] of Object.entries(v)) if (typeof e?.f === 'number') out[id] = { f: e.f }
    return out
  } catch { return {} }
}

/** 옛 기록에서 첫 몫을 센다 — 거느림 15 · 사로잡음 +4 · 옛 데려가기에서 고른 이 +10 */
function migrated(): BondStore {
  const R = P.realm
  const s: BondStore = { v: 1, h: {}, run: {} }
  const add = (id: string, n: number): void => { if (n > 0) s.h[id] = { p: (s.h[id]?.p ?? 0) + n } }
  for (const [id, e] of Object.entries(readDexRaw())) {
    add(id, ((e.f & DEX_SERVED) !== 0 ? R.metaMigrateServed : 0) + ((e.f & DEX_CAUGHT) !== 0 ? R.metaMigrateCaught : 0))
  }
  const picked = new Set<string>()
  try {
    const bring = JSON.parse(localStorage.getItem('hanbal.realm.bring') ?? 'null') as unknown
    if (Array.isArray(bring)) for (const x of bring) if (typeof x === 'string') picked.add(x)
    const old = JSON.parse(localStorage.getItem('hanbal.realm.retain') ?? 'null') as { pick?: Array<{ id?: unknown }> } | null
    if (old !== null && Array.isArray(old.pick)) for (const h of old.pick) if (typeof h?.id === 'string') picked.add(h.id)
  } catch { /* 깨진 옛 기록은 건너뛴다 */ }
  for (const id of [...picked].sort()) add(id, R.metaMigratePick)
  return s
}

export function loadBonds(): BondStore {
  let raw: string | null = null
  try { raw = localStorage.getItem(KEY) } catch { /* 읽지 못하는 곳 */ }
  if (raw !== null) {
    try {
      const v = JSON.parse(raw) as Partial<BondStore> | null
      if (v !== null && typeof v === 'object' && v.v === 1 && typeof v.h === 'object' && v.h !== null) {
        const s: BondStore = { v: 1, h: {}, run: {} }
        for (const [id, e] of Object.entries(v.h)) {
          const p = num((e as { p?: unknown })?.p)
          const keep = (e as { keep?: unknown })?.keep
          if (p > 0) s.h[id] = typeof keep === 'string' && keep !== '' ? { p, keep } : { p }
        }
        if (typeof v.run === 'object' && v.run !== null) {
          for (const [seed, m] of Object.entries(v.run)) {
            if (m === null || typeof m !== 'object') continue
            s.run[seed] = {}
            for (const [id, n] of Object.entries(m)) { const q = num(n); if (q > 0) s.run[seed]![id] = q }
          }
        }
        return s
      }
    } catch { /* 깨졌으면 아래에서 새로 옮긴다 */ }
  }
  const s = migrated()
  saveBonds(s) // 새 키를 쓴 뒤에만 옛 것을 더는 읽지 않는다 (옛 키는 그대로 둔다)
  return s
}

function saveBonds(s: BondStore): void {
  const keys = Object.keys(s.run)
  for (const k of keys.slice(0, Math.max(0, keys.length - KEEP_RUNS))) delete s.run[k]
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* 저장 못 하는 곳 */ }
}

/** 장수마다 쌓은 몫 (id → 합) */
export function bondTotals(): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [id, e] of Object.entries(loadBonds().h)) out[id] = e.p
  return out
}

/** 새 판을 열 때 넘기는 기억 — 장수마다 쌓은 몫과 기억한 재주 */
export function bondMemory(): Record<string, BondMemory> {
  const out: Record<string, BondMemory> = {}
  for (const [id, e] of Object.entries(loadBonds().h)) out[id] = e.keep !== undefined ? { p: e.p, keep: e.keep } : { p: e.p }
  return out
}

/** 이 판의 몫을 올린다 — 판(시드)마다 가장 높은 값만. 판 안에서 계절마다·열 때마다 불러도 된다 */
export function recordBonds(r: Realm, dexFresh: ReadonlyArray<{ id: string; was: number; now: number }> = []): void {
  if (r.region === 'tutorial') return
  const s = loadBonds()
  let changed = false
  for (const x of dexFresh) {
    const d = dexDeed(x.was, x.now)
    if (d > 0) { s.h[x.id] = { p: (s.h[x.id]?.p ?? 0) + d }; changed = true }
  }
  const run = (s.run[String(r.seed)] ??= {})
  for (const [id, n] of Object.entries(runDeeds(r, r.player))) {
    const was = run[id] ?? 0
    if (n <= was) continue
    s.h[id] = { p: (s.h[id]?.p ?? 0) + (n - was) }
    run[id] = n
    changed = true
  }
  // 이 판에서 눈뜬 재주를 기억한다 — 가장 나중 것이 이긴다 (3단이 새 판에 들고 간다)
  for (const h of Object.values(r.heroes)) {
    if (h.faction !== r.player || h.awoken === undefined || h.status === 'dead') continue
    const cur = s.h[h.id]
    if (cur === undefined || cur.keep === h.awoken) continue
    cur.keep = h.awoken
    changed = true
  }
  if (changed) saveBonds(s)
}

export interface BondKit {
  readonly esc: (s: string) => string
  readonly bust: (hero: string) => string | null
}

const face = (k: BondKit, id: string): string => {
  const src = k.bust(id)
  return src !== null ? `<img class="bdf" src="${src}" alt="">` : '<span class="bdf none"></span>'
}

/** 단 칸 다섯 — 채운 칸은 금빛 */
function pips(tier: number): string {
  let h = '<span class="bdp" aria-hidden="true">'
  for (let i = 1; i <= 5; i++) h += `<i class="${i <= tier ? 'on' : ''}"></i>`
  return h + '</span>'
}

/** 지금 걸린 단 효과 — 그림 한 칸 + 짧은 말. 판을 열 때 붙는 것만 (3단은 눈뜬 재주를 기억해 둔 뒤에) */
function perks(k: BondKit, tier: number, keep: string | undefined): string {
  const chips: string[] = []
  if (tier >= 2) chips.push(`<span class="bdfx" data-tip="새 판을 열 때 정이 ${P.realm.metaStartBond} 만큼 앞서 있습니다">💗 정 +${P.realm.metaStartBond}</span>`)
  if (tier >= 3) {
    const t = keep !== undefined ? TRAIT[keep] : undefined
    chips.push(t !== undefined
      ? `<span class="bdfx" data-tip="지난 판에 눈뜬 재주를 새 판 처음부터 지닙니다">✨ ${k.esc(t.name)}</span>`
      : `<span class="bdfx dim" data-tip="정이 가득 차 재주에 눈뜬 판이 있으면 새 판에 들고 옵니다">✨ 재주 기억 대기</span>`)
  }
  if (tier >= 5) chips.push(`<span class="bdfx" data-tip="새 판을 열면 떠돌이로 찾아옵니다">🧭 덤 동행</span>`)
  return chips.length > 0 ? `<span class="bdfxs">${chips.join('')}</span>` : ''
}

const ROSTER_SHOW = 8

/** 명부 — 도감의 한 탭. 한 줄에 초상 · 이름 · 단 칸 · 다음 단까지 막대 · 다음 보상 */
export function rosterHtml(k: BondKit, expanded: boolean): string {
  const totals = bondTotals()
  const cat = new Map(dexCatalog().map((x) => [x.id, x]))
  const keeps = bondMemory()
  const rows = Object.entries(totals).filter(([id]) => cat.has(id)).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
  if (rows.length === 0) return `<p class="mute dxclan">아직 아무도 없다. 장수를 거느려 싸우면 정이 쌓여 여기 이름이 오른다.</p>`
  const shown = expanded ? rows : rows.slice(0, ROSTER_SHOW)
  let h = '<div class="bdlist">'
  for (const [id, p] of shown) {
    const x = cat.get(id)!
    const t = bondTierOf(p)
    const next = t < 5 ? BOND_TIERS[t + 1]!.reward : ''
    h += `<div class="bdrow t${t}" data-tip="${k.esc(t > 0 ? BOND_TIERS[t]!.name : '아직 이름만 아는 사이')}">${face(k, id)}<div class="bdm"><b>${nameHtml(x.name)}</b>${pips(t)}<span class="bdbar"><i style="width:${(bondFill(p) * 100).toFixed(0)}%"></i></span>${perks(k, t, keeps[id]?.keep)}</div><span class="bdn"><small>${k.esc(bondWord(p))}</small>${next !== '' ? `<em>${k.esc(next)}</em>` : '<em>다 채웠다</em>'}</span></div>`
  }
  h += '</div>'
  if (rows.length > shown.length) h += `<p class="bdmore"><button class="btn ghost sm" data-act="dex-sel" data-id="more">더 보기 (${rows.length - shown.length}명)</button></p>`
  else if (expanded && rows.length > ROSTER_SHOW) h += `<p class="bdmore"><button class="btn ghost sm" data-act="dex-sel" data-id="more">접기</button></p>`
  return h
}

const END_SHOW = 5

/** 끝 화면 — 이번 판에 쌓은 인연이 차오른다. 단이 오르면 도장 */
export function endBondsHtml(k: BondKit, r: Realm): string {
  if (r.region === 'tutorial') return ''
  const s = loadBonds()
  const mine = s.run[String(r.seed)] ?? {}
  const rows = Object.entries(mine)
    .filter(([id, n]) => n > 0 && r.heroes[id] !== undefined)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
  if (rows.length === 0) return ''
  let h = '<div class="bdend"><p class="bdhd">인연이 깊어졌습니다</p>'
  rows.slice(0, END_SHOW).forEach(([id, n], i) => {
    const after = s.h[id]?.p ?? n
    const before = Math.max(0, after - n)
    const t0 = bondTierOf(before)
    const t1 = bondTierOf(after)
    const f0 = t0 < t1 ? 0 : bondFill(before)
    const delay = (0.15 + i * 0.35).toFixed(2)
    const stamp = t1 > t0 ? `<b class="bdstamp" style="animation-delay:${(0.15 + i * 0.35 + 0.9).toFixed(2)}s">${k.esc(t1 >= 5 ? '한마음' : BOND_TIERS[t1]!.name)}</b>` : ''
    h += `<div class="bdrow t${t1}">${face(k, id)}<div class="bdm"><b>${nameHtml(r.heroes[id]!.name)}</b>${pips(t1)}<span class="bdbar"><i class="old" style="width:${(f0 * 100).toFixed(0)}%"></i><i class="up" style="--to:${(bondFill(after) * 100).toFixed(0)}%;--from:${(f0 * 100).toFixed(0)}%;animation-delay:${delay}s"></i></span></div>${stamp}</div>`
  })
  if (rows.length > END_SHOW) h += `<p class="mute bdlast">그 밖에 ${rows.length - END_SHOW}명도 인연이 쌓였습니다.</p>`
  return h + '</div>'
}

export const BOND_CSS = `
.ap .bdlist, .ap .bdend { display: flex; flex-direction: column; gap: 6px; max-width: 980px; margin: 8px auto; padding: 0 14px; box-sizing: border-box; }
.ap .dexp .bdlist { padding-bottom: 8px; }
.ap .bdhd { margin: 0 0 2px; font-size: 13px; font-weight: 800; color: var(--gold); text-align: center; }
.ap .bdrow { position: relative; display: flex; align-items: center; gap: 8px; padding: 4px 8px 4px 4px; border-radius: 10px; background: #17110c; border: 1px solid #3a2c1e; min-width: 0; }
.ap .bdrow.t0 { opacity: .8; }
.ap .bdrow .bdf { flex: none; width: 46px; height: 46px; border-radius: 50%; object-fit: cover; background: #17110c; }
.ap .bdrow .bdf.none { display: inline-block; border: 1px solid #3a2c1e; }
.ap .bdrow .bdm { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.ap .bdrow .bdm b { font-size: 13.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ap .bdfxs { display: flex; flex-wrap: wrap; gap: 4px; }
.ap .bdfx { padding: 0 6px; border-radius: 8px; background: #2a2014; border: 1px solid #5a4528; color: #ffe08a; font-size: 10.5px; line-height: 16px; white-space: nowrap; }
.ap .bdfx.dim { color: var(--mute); border-color: #3a2c1e; }
.ap .bdp { display: flex; gap: 3px; }
.ap .bdp i { width: 14px; height: 6px; border-radius: 2px; background: #30241a; }
.ap .bdp i.on { background: #e0b860; box-shadow: 0 0 4px #e0b86088; }
.ap .bdbar { position: relative; height: 6px; border-radius: 3px; background: #30241a; overflow: hidden; }
.ap .bdbar i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 3px; background: #c07a4a; }
.ap .bdbar i.up { background: #ffd986; width: var(--from); animation: bdfill 1.1s ease-out both; }
.ap .bdbar i.old { background: #c07a4a; }
@keyframes bdfill { from { width: var(--from); } to { width: var(--to); } }
.ap .bdn { flex: none; display: flex; flex-direction: column; align-items: flex-end; width: 84px; text-align: right; }
.ap .bdn small { font-size: 11px; color: var(--mute); }
.ap .bdn em { font-style: normal; font-size: 12px; font-weight: 700; color: #ffe08a; }
.ap .bdstamp { flex: none; padding: 2px 6px; border: 2px solid #c0392b; color: #e8584a; border-radius: 4px; font-size: 12px; font-weight: 900; transform: rotate(-6deg); white-space: nowrap; animation: bdstamp .35s cubic-bezier(.2, 1.6, .4, 1) both; }
@keyframes bdstamp { from { opacity: 0; transform: scale(2.2) rotate(-6deg); } to { opacity: 1; transform: scale(1) rotate(-6deg); } }
.ap .bdlast { margin: 0; font-size: 11.5px; text-align: center; }
.ap .bdmore { margin: 2px 0 200px; text-align: center; }
@media (prefers-reduced-motion: reduce) { .ap .bdbar i.up, .ap .bdstamp { animation: none; } .ap .bdbar i.up { width: var(--to); } }
`
