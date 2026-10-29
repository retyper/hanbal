/**
 * 단련터 — 판과 판 사이의 화톳불 (docs/realm/HERO-GROWTH.md ★ 둘째 판 §A · §C · 셈은 src/realm/drill.ts).
 *
 *   판이 끝나면(이기든 지든) 끝 화면이 이번 판의 공을 새기고(engraveRun), 「단련터」로 들어가 장수마다 공을 써 능력치를 하나씩 올린다.
 *   첫 화면의 「단련터」로도 들어온다 — 남은 공은 아무 때나 쓴다.
 * 기록은 이 기기에만 (`hanbal.realm.drill` · 영웅전·해금처럼). 못 읽으면 빈 기록 — 지우지는 않는다.
 */
import { STAT_NAME, josa } from '../../realm/data/prose.ts'
import { DRILL_STATS, capOf, emptyDrill, engrave, engraveVows, gainOf, raise, raiseState, spendCost, uiriWith, type DrillEntry, type DrillStore } from '../../realm/drill.ts'
import type { GrowStat, Hero, Realm, Vow } from '../../realm/types.ts'
import { P } from '../../tune/params.ts'
import { relicRoom } from '../../realm/relics.ts'
import { nameHtml } from './heroview.ts'
import { pickerHtml, relicDexHtml, slotsHtml, wornBy, type RelicKit } from './relics.ts'
import { radarSvg } from './radar.ts'

const KEY = 'hanbal.realm.drill'

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

/** 판 밖 단련 기록 — 깨졌거나 없으면 빈 기록 */
export function loadDrill(): DrillStore {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<DrillStore> | null
    if (v === null || typeof v !== 'object' || typeof v.h !== 'object' || v.h === null) return emptyDrill()
    const h: Record<string, DrillEntry> = {}
    for (const [id, e] of Object.entries(v.h)) {
      if (e === null || typeof e !== 'object') continue
      const add: Partial<Record<GrowStat, number>> = {}
      for (const s of DRILL_STATS) { const n = Math.max(0, Math.floor(num(e.add?.[s]))); if (n > 0) add[s] = n }
      h[id] = {
        points: Math.max(0, Math.floor(num(e.points))), level: Object.values(add).reduce((a, b) => a + (b ?? 0), 0), add, runs: Math.max(0, Math.floor(num(e.runs))),
        ...(typeof e.lastSeed === 'number' ? { lastSeed: e.lastSeed } : {}),
        ...(typeof e.name === 'string' ? { name: e.name } : {}),
        ...(e.look === 'g' || e.look === 'w' ? { look: e.look } : {}),
        ...(e.born !== undefined && typeof e.born === 'object' ? { born: e.born } : {}),
        // 의리 — 판 밖에서 움직인 몫 · 까닭 · 새긴 판 (UIRI)
        ...(typeof e.uiri === 'number' && Number.isFinite(e.uiri) && e.uiri !== 0 ? { uiri: Math.round(e.uiri) } : {}),
        ...(Array.isArray(e.tales) ? { tales: e.tales.filter((x): x is Vow => x === 'hold' || x === 'rescue' || x === 'heart' || x === 'turned').slice(-6) } : {}),
        ...(typeof e.uiriSeed === 'number' ? { uiriSeed: e.uiriSeed } : {}),
      }
    }
    const paid = typeof v.paid === 'object' && v.paid !== null ? v.paid : {}
    const order = Array.isArray(v.order) ? v.order.filter((x): x is string => typeof x === 'string') : Object.keys(paid)
    return { v: 1, h, paid, order }
  } catch {
    return emptyDrill()
  }
}

function saveDrill(s: DrillStore): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* 저장 못 하는 곳 — 이번 판의 공은 다음에 다시 새긴다(아직 안 새긴 몫으로 남는다) */ }
}

/** 판이 끝났다 — 공을 새기고, 이번에 새로 든 공을 돌려준다 (이미 새긴 판이면 빈 것). 몇 번 불러도 한 번만 든다 */
export function engraveRun(r: Realm): Record<string, number> {
  if (r.outcome == null) return {}
  const s = loadDrill()
  const won = r.outcome.kind === 'win'
  const g = gainOf(s, r, won)
  // 의리 — 공이 없어도 겪은 일은 새긴다 (같은 판은 한 번만 · drill.engraveVows)
  const v = engraveVows(s, r)
  if (Object.keys(g).length === 0) { if (v !== s) saveDrill(v); return {} }
  saveDrill(engrave(v, r, won))
  return g
}

/** 단련터의 + — 올렸으면 true */
export function raiseHero(id: string, stat: GrowStat, born: Pick<Hero, GrowStat> | undefined): boolean {
  const s = loadDrill()
  const n = raise(s, id, stat, born, relicRoom(wornBy(id))) // 지닌 유물이 넓힌 그릇까지 (relics.ts)
  if (n === s) return false
  saveDrill(n)
  return true
}

/** 단련터에 볼 이가 있나 (첫 화면 단추) */
export function hasDrill(): boolean {
  return Object.keys(loadDrill().h).length > 0
}

/** 그 장수의 판 밖 단련 단계 (동행 고르기 카드) */
export function drillLevel(id: string): number {
  return loadDrill().h[id]?.level ?? 0
}

export interface DrillKit {
  readonly esc: (s: string) => string
  readonly bust: (id: string) => string | null
  /** 처음 몸 — 영웅전 명부 · 가문의 아이 (없으면 새길 때 적어 둔 몸) */
  readonly bodyOf: (id: string) => Hero | undefined
  /** 유물 칸 · 도감 (ui/realm/relics.ts) */
  readonly relic: RelicKit
}

/** 단련터에 세울 사람 — 끝 화면에서 오면 그 판의 우리 장수, 첫 화면이면 null(단련 기록이 있는 모두) */
export interface YardOpts {
  readonly ids: readonly string[] | null
  /** 이번에 새로 든 공 — 막대가 차오른다 */
  readonly gain: Readonly<Record<string, number>>
  /** 이 판에서 쓰러진 이 — 「다음 판엔 돌아온다」 */
  readonly fell: readonly string[]
  /** 처음 그릴 때만 차오른다 (+ 를 누를 때마다 다시 차오르지 않게) */
  readonly anim: boolean
  /** 방금 올린 칸 — `id:stat` */
  readonly last: string | null
  readonly from: 'end' | 'title'
  /** 열어 둔 유물 칸 — 그 장수 카드 밑에 고르기가 펼쳐진다 */
  readonly slot?: { readonly id: string; readonly i: number } | null
}

/** 의리가 움직인 까닭 — 쉬운 말로 */
const TALE: Readonly<Record<Vow, string>> = {
  hold: '잡혀서도 넘어가지 않고 돌아왔다', rescue: '우리가 구해 왔다', heart: '정이 가득 찼다', turned: '적에게 넘어갔다',
}

const bodyFor = (k: DrillKit, id: string, e: DrillEntry): (Pick<Hero, GrowStat> & { uiri: number }) | null => {
  const h = k.bodyOf(id)
  if (h !== undefined) return h
  const b = e.born
  return b !== undefined ? { mu: b.mu ?? 1, tong: b.tong ?? 1, ryak: b.ryak ?? 1, chi: b.chi ?? 1, deok: b.deok ?? 1, uiri: 5 } : null
}

/** 단련터에 늘어선 순서 — 화면을 다시 그려도 카드가 자리를 바꾸지 않게 */
let yardOrder: string[] = []

/** 단련터 화면 */
export function yardHtml(k: DrillKit, o: YardOpts): string {
  const store = loadDrill()
  // 끝 화면에서 왔으면 공을 못 번 우리 장수도 — 무덤에서 얻은 유물을 끼울 몸이 있어야 한다 (빈 기록으로 보인다)
  const ent = (id: string): DrillEntry => store.h[id] ?? { points: 0, level: 0, add: {}, runs: 0 }
  const ids = (o.ids ?? Object.keys(store.h)).filter((id) => store.h[id] !== undefined || (o.from === 'end' && k.bodyOf(id) !== undefined))
  const fresh = [...new Set(ids)].sort((a, b) => (o.gain[b] ?? 0) - (o.gain[a] ?? 0) || ent(b).level - ent(a).level || ent(b).points - ent(a).points || (a < b ? -1 : 1))
  // 단련·유물로 단계가 오르면 그 카드가 맨 앞으로 순간이동했다 (형 10-28) — 같은 장수들을 보는 동안은 처음 순서 그대로
  const same = fresh.length === yardOrder.length && fresh.every((id) => yardOrder.includes(id))
  const list = same ? [...yardOrder] : fresh
  yardOrder = list
  let h = `<div class="front dyard"><div class="fhead">${o.from === 'title' ? `<button class="btn ghost" data-act="dy-next">‹ 처음으로</button>` : ''}<h2>단련터</h2></div>`
  h += `<p class="dylead">판에서 쌓은 공으로 장수를 단련한다. 져도 공은 남는다. 단련 한 단계마다 능력치 하나가 +1, 값은 ${spendCost(0)}에서 시작해 단계마다 ${spendCost(1) - spendCost(0)}씩 오른다.</p>`
  if (list.length === 0) h += `<p class="mute dylead">아직 공을 새긴 장수가 없다. 판에서 싸우고 고을을 맡으면 공이 쌓이고, 판이 끝나면 여기서 쓴다.</p>`
  h += `<div class="dyl">`
  for (const id of list) {
    const e = ent(id)
    const born = bodyFor(k, id, e)
    const name = k.bodyOf(id)?.name ?? e.name ?? id
    const src = k.bust(id)
    const cost = spendCost(e.level)
    const gain = o.gain[id] ?? 0
    let can = 0 // 지금 공으로 몇 단계 더 (그릇은 따지지 않는다 — 어림)
    for (let left = e.points; left >= spendCost(e.level + can); can++) left -= spendCost(e.level + can)
    const to = Math.min(100, (e.points / cost) * 100)
    const from = o.anim ? Math.min(100, (Math.max(0, e.points - gain) / cost) * 100) : to
    h += `<div class="dyc${gain > 0 && o.anim ? ' fresh' : ''}"><div class="dyf">${src !== null ? `<img src="${src}" alt="">` : '<span class="nof"></span>'}`
    h += `<div class="dyn"><b>${nameHtml(name)}</b>${e.level > 0 ? `<span class="dlv">단련 ${e.level}</span>` : '<span class="dlv zero">단련 0</span>'}`
    if (o.fell.includes(id)) h += `<small class="dyfell">이 판에서 쓰러졌다. 다음 판엔 돌아온다</small>`
    h += `</div></div>`
    h += `<div class="dyp"><span class="dypt">공 <b>${e.points}</b>${gain > 0 ? `<i class="dyg">+${gain}</i>` : ''}</span>`
    h += `<span class="dybar${e.points >= cost ? ' ready' : ''}"><i style="--from:${from.toFixed(1)}%;--to:${to.toFixed(1)}%"></i></span><small>다음 단련에 공 ${cost}${can > 1 ? ` · 지금 공으로 ${can}단계까지` : ''}</small></div>`
    if (born !== null) {
      const now = { mu: born.mu + (e.add.mu ?? 0), tong: born.tong + (e.add.tong ?? 0), ryak: born.ryak + (e.add.ryak ?? 0), chi: born.chi + (e.add.chi ?? 0), deok: born.deok + (e.add.deok ?? 0) }
      const axes = (['mu', 'tong', 'ryak', 'chi', 'deok'] as const).map((s) => ({ label: STAT_NAME[s], value: Math.min(10, now[s]) as number | null }))
      const shift = e.uiri ?? 0
      const uv = uiriWith(born.uiri, shift)
      h += `<div class="dyr">${radarSvg([...axes, { label: STAT_NAME.uiri, value: uv }], '#d9b36a', 150, [born.mu, born.tong, born.ryak, born.chi, born.deok, born.uiri])}`
      h += `<div class="dys">`
      const room = relicRoom(wornBy(id)) // 지닌 유물이 넓힌 그릇 (천마도 말다래 · 비파형동검)
      for (const s of DRILL_STATS) {
        const cap = capOf(born, s, room)
        const st = raiseState(store, id, s, born, room)
        const add = e.add[s] ?? 0
        const why = st === 'cap' ? `더 못 올린다: 타고난 값에서 ${cap - born[s]}칸까지` : st === 'poor' ? `공 ${josa(String(cost), '이', '가')} 든다` : `공 ${josa(String(cost), '을', '를')} 써서 ${STAT_NAME[s]} +1`
        h += `<div class="dyst${o.last === `${id}:${s}` ? ' up' : ''}"><span class="dysn">${STAT_NAME[s]}</span><b>${Math.min(10, born[s] + add)}</b>${add > 0 ? `<i>+${add}</i>` : '<i></i>'}<small>/${cap}</small>`
        h += `<button class="dyplus" data-act="dy-up" data-id="${k.esc(id)}" data-s="${s}"${st === 'ok' ? '' : ' disabled'} data-tip="${k.esc(why)}">${st === 'cap' ? '끝' : `+<small>${cost}</small>`}</button></div>`
      }
      // 의리 — 공으로는 못 올린다. + 자리에 「?」를 두고, 누르면 그 자리에서 어떻게 오르는지 (형 10-27: "유저가 '이건 왜 못 올리지?' 하는 의문만 제때 풀리게")
      const top = Math.min(10, born.uiri + P.realm.uiriRoom)
      h += `<details class="dyst dyui"><summary><span class="dysn">${STAT_NAME.uiri}</span><b>${uv}</b>${shift !== 0 ? `<i${shift < 0 ? ' class="dn"' : ''}>${shift > 0 ? '+' : ''}${shift}</i>` : '<i></i>'}<small>/${top}</small><span class="dyq">?</span></summary>`
      h += `<p>의리는 공으로 못 올린다. 판에서 <b>잡혀서도 넘어가지 않고 돌아오거나</b>, <b>우리가 구해 오거나</b>, <b>정이 가득 차면</b> 판이 끝날 때 1 오른다 (한 판에 1 · 최대 ${top}). 적에게 넘어가면 1 내린다.</p>`
      const last = e.tales?.[e.tales.length - 1]
      if (last !== undefined) h += `<p class="dyut">지난번: ${TALE[last]}</p>`
      h += `</details>`
      h += `</div></div>`
    }
    // 유물 칸 — 누르면 가진 유물 고르기 (HERO-GROWTH ★ §B · §C)
    const sel = o.slot?.id === id ? o.slot.i : null
    h += slotsHtml(k.relic, id, e.level, sel)
    if (sel !== null) h += pickerHtml(k.relic, id, sel)
    h += `</div>`
  }
  h += `</div>${relicDexHtml(k.relic)}<div class="dygo"><button class="btn pri big" data-act="dy-next">${o.from === 'end' ? '다음으로 ›' : '처음으로'}</button></div>`
  return h + `<p class="fine">점선은 처음 몸, 금빛은 단련한 몸: 다음 판을 열 때 우리 장수와 데려간 장수가 이 몸으로, 끼운 유물을 지니고 온다.</p></div>`
}

/** 끝 화면의 단련 한 줄 — 이번 판에 공을 번 장수 얼굴과 「+공」, 그리고 단련터로 */
export function yardStripHtml(k: DrillKit, rows: ReadonlyArray<{ id: string; name: string; earned: number }>, spare: number): string {
  if (rows.length === 0) return ''
  let h = `<div class="dystrip"><h4>이번 판의 공 <small>져도 남는다 · 단련터에서 쓴다</small></h4><div class="dysl">`
  for (const x of rows.slice(0, 8)) {
    const src = k.bust(x.id)
    h += `<span class="dysf">${src !== null ? `<img src="${src}" alt="">` : '<span class="nof"></span>'}<b>${nameHtml(x.name)}</b><i>+${x.earned}</i></span>`
  }
  h += `</div><button class="btn pri big dyopen" data-act="dy-open">단련터 ›${spare > 0 ? `<small>쓸 공 ${spare}</small>` : ''}</button></div>`
  return h
}

export const DRILL_CSS = `
/* 둥근 얼굴 — 청동 테 그림 (ui/ring-portrait.png) */
.ap .dyf img, .ap .dyf .nof, .ap .dystrip .dysf img, .ap .dystrip .dysf .nof { background: url(__ART__ui/ring-portrait.png) center / 100% 100% no-repeat, #17110c; background-origin: border-box; border-style: solid; border-color: transparent; border-radius: 50%; box-sizing: border-box; }
.ap .dyf img, .ap .dyf .nof, .ap .dystrip .dysf img, .ap .dystrip .dysf .nof { border-color: transparent !important; background: url(__ART__ui/ring-portrait.png) center / 100% 100% no-repeat, #17110c !important; background-origin: border-box !important; }
.ap .dyf img, .ap .dyf .nof { width: 72px !important; height: 72px !important; border-width: 12px !important; }
.ap .dystrip .dysf img, .ap .dystrip .dysf .nof { width: 54px !important; height: 54px !important; border-width: 9px !important; }
.ap .front.dyard .dylead { max-width: 760px; margin: 2px auto 8px; padding: 0 14px; color: #cbbf9f; font-size: 13.5px; }
.ap .front.dyard .dyl { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr)); gap: 10px; max-width: 980px; margin: 0 auto; padding: 0 14px 8px; }
/* 테는 그림으로 — 장수 한 사람 = 옻칠한 나무판에 청동 테 (ui/panel.png · 아래 판과 한 벌) (형 10-29: "박스 테두리들이 여전히 css") */
.ap .dyc { display: flex; flex-direction: column; gap: 6px; padding: 0 2px 2px; border: 18px solid transparent; border-image: url(__ART__ui/panel.png?v=2) 64 fill / 18px stretch; border-radius: 0; background: none; }
.ap .dyc.fresh { animation: dyin .5s ease-out both; }
@keyframes dyin { from { transform: translateY(10px) scale(.97); opacity: 0; } to { transform: none; opacity: 1; } }
.ap .dyf { display: flex; align-items: center; gap: 10px; }
.ap .dyf img, .ap .dyf .nof { width: 58px; height: 58px; flex: none; border-radius: 50%; object-fit: cover; object-position: top; border: 2px solid #8a7040; background: #17110c; }
.ap .dyn { display: flex; flex-direction: column; gap: 2px; min-width: 0; } .ap .dyn b { font-size: 16px; color: #f0e2c0; }
.ap .dlv { display: inline-block; align-self: flex-start; padding: 0 4px; border: 5px solid transparent; border-image: url(__ART__ui/btn-gold.png?v=2) 30 35 fill / 5px 7px stretch; border-radius: 0; color: #2a1606; font-size: 12px; font-weight: 800; background: none; }
.ap .dlv.zero { border-image: url(__ART__ui/btn-dark.png?v=2) 30 33 fill / 5px 7px stretch; color: #cbbf9f; font-weight: 700; }
.ap .dyfell { color: #e0a090; font-size: 11.5px; }
.ap .dyp { display: grid; grid-template-columns: auto 1fr; gap: 2px 8px; align-items: center; } .ap .dyp small { grid-column: 1 / 3; color: var(--mute); font-size: 11.5px; }
.ap .dypt { font-size: 13px; color: #cfc6b4; white-space: nowrap; } .ap .dypt b { color: #ffd27a; font-size: 16px; }
.ap .dypt .dyg { font-style: normal; margin-left: 4px; color: #9fff8a; font-weight: 800; animation: dypop 1.2s ease-out both; display: inline-block; }
@keyframes dypop { 0% { transform: scale(2.2); opacity: 0; } 30% { transform: scale(1.3); opacity: 1; } 100% { transform: none; } }
.ap .dybar { height: 10px; border-radius: 5px; background: #30241a; overflow: hidden; }
.ap .dybar i { display: block; height: 100%; width: var(--to); background: linear-gradient(90deg, #8a6a3a, #f0c060); border-radius: 5px; animation: dyfill 1.4s .25s cubic-bezier(.2,.8,.2,1) both; }
.ap .dybar.ready i { background: linear-gradient(90deg, #c9a23a, #ffe08a); box-shadow: 0 0 8px #ffd27a99; }
@keyframes dyfill { from { width: var(--from); } to { width: var(--to); } }
.ap .dyr { display: flex; align-items: center; gap: 6px; min-width: 0; } .ap .dyr .radar { flex: 0 1 auto; min-width: 0; max-width: 44%; height: auto; }
/* + 단추는 테(그림)까지 넣어 52px — 좁은 칸에서 카드 밖으로 튀어나갔다 (형 10-29) */
.ap .dyplus, .ap .dyui .dyq { box-sizing: border-box; min-width: 52px !important; max-width: 100%; }
.ap .dys { flex: 1; display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.ap .dyst { display: grid; grid-template-columns: 2.6em 1.4em 1.8em 1.8em 1fr; align-items: center; gap: 2px; font-size: 13px; }
.ap .dyst b { color: #f0e2c0; text-align: right; } .ap .dyst i { font-style: normal; color: #9fd07a; font-size: 11.5px; } .ap .dyst small { color: var(--mute); font-size: 11px; }
.ap .dyst.up b { animation: dyup .8s ease-out both; color: #ffe08a; }
@keyframes dyup { 0% { transform: scale(2); } 100% { transform: none; } }
.ap .dyst.dyui { display: block; } .ap .dyui summary { display: grid; grid-template-columns: 2.6em 1.4em 1.8em 1.8em 1fr; align-items: center; gap: 2px; cursor: pointer; list-style: none; }
.ap .dyui summary::-webkit-details-marker { display: none; }
.ap .dyui .dyq { box-sizing: border-box; justify-self: end; min-width: 46px; text-align: center; padding: 0 2px; border: 6px solid transparent; border-image: url(__ART__ui/btn-dark.png?v=2) 30 33 fill / 6px 8px stretch; border-radius: 0; color: #efe3c6; font-weight: 800; }
.ap .dyui[open] .dyq { border-image: url(__ART__ui/btn-gold.png?v=2) 30 35 fill / 6px 8px stretch; color: #2a1606; }
.ap .dyui p { margin: 4px 0 2px; padding: 6px 8px; border-radius: 8px; background: #2a2016; color: #e0d4b8; font-size: 12px; line-height: 1.5; }
.ap .dyui p b { color: #ffe08a; font-weight: 700; } .ap .dyui p.dyut { background: none; padding: 0 8px; color: var(--mute); }
.ap .dyst i.dn { color: #e08a7a; }
.ap .dyplus { justify-self: end; min-width: 46px; padding: 0 2px; border: 6px solid transparent; border-image: url(__ART__ui/btn-gold.png?v=2) 30 35 fill / 6px 8px stretch; border-radius: 0; background: none; color: #2a1606; font: inherit; font-weight: 800; cursor: pointer; }
.ap .dyplus small { font-weight: 700; font-size: 10.5px; color: #4a2e10; margin-left: 2px; }
.ap .dyplus:disabled { border-image: url(__ART__ui/btn-dark.png?v=2) 30 33 fill / 6px 8px stretch; color: #8a7e6a; cursor: default; } .ap .dyplus:disabled small { color: #8a7e6a; }
.ap .front.dyard .dygo { display: flex; justify-content: center; margin: 12px 0 4px; }
.ap .dystrip { max-width: 560px; margin: 10px auto 4px; padding: 2px 4px; border: 12px solid transparent; border-image: url(__ART__ui/frame-panel.png?v=3) 118 / 12px stretch; border-radius: 0; background: #1f1710f2 padding-box; text-align: left; }
.ap .dystrip h4 { margin: 0 0 6px; color: var(--gold); } .ap .dystrip h4 small { color: var(--mute); font-weight: 400; margin-left: 6px; }
.ap .dystrip .dysl { display: flex; flex-wrap: wrap; gap: 6px; }
.ap .dystrip .dysf { display: flex; flex-direction: column; align-items: center; width: 64px; gap: 1px; }
.ap .dystrip .dysf img, .ap .dystrip .dysf .nof { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; object-position: top; border: 2px solid #8a7040; background: #17110c; }
.ap .dystrip .dysf b { font-size: 11.5px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ap .dystrip .dysf i { font-style: normal; font-weight: 800; color: #9fff8a; font-size: 13px; }
.ap .dystrip .dyopen { display: flex; flex-direction: column; align-items: center; margin: 8px auto 0; } .ap .dystrip .dyopen small { font-size: 11.5px; font-weight: 400; }
`
