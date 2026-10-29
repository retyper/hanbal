/**
 * 도감 판 — 판을 넘어 남는 장수 기록 (src/realm/dex.ts 의 셈을 그린다 · VISION §5-4).
 *
 * 팰 도감처럼 모르는 칸은 그림자와 "?" — 어느 판 어느 나라에 있는지만 귀띔한다 (찾으러 갈 까닭).
 * 들으면 이름과 얼굴, 만나면 능력치와 특성(그 판에 처음 나올 때의 솜씨), 사로잡으면 포승줄, 거느리면 금테.
 * 기록은 이 기기에만 (판 저장·판 해금처럼). 상태는 app.ts 가 쥐고, 누름은 data-act 로 app.ts 가 받는다.
 */
import { DEX_CAUGHT, DEX_HEARD, DEX_MET, DEX_SERVED, dexCatalog, dexCounts, dexLevel, scanDex, type Dex, type DexHero } from '../../realm/dex.ts'
import { GRADE_COLOR, GRADE_NAME, TRAIT } from '../../realm/data/traits.ts'
import { noteKids } from '../../realm/data/art.ts'
import { josa } from '../../realm/data/prose.ts'
import type { Hero, Realm, RegionId } from '../../realm/types.ts'
import { heroRadar, nameHtml, traitChips } from './heroview.ts'

const KEY = 'hanbal.realm.dex'

export function loadDex(): Dex {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as unknown
    if (v === null || typeof v !== 'object') return {}
    const out: Dex = {}
    for (const [id, e] of Object.entries(v as Record<string, unknown>)) {
      const f = (e as { f?: unknown })?.f
      if (typeof f === 'number' && f > 0) out[id] = { f: f & 15, ...(typeof (e as { b?: unknown }).b === 'string' ? { b: (e as { b: RegionId }).b } : {}) }
    }
    return out
  } catch {
    return {}
  }
}

function saveDex(d: Dex): void {
  try { localStorage.setItem(KEY, JSON.stringify(d)) } catch { /* 저장 못 하는 곳 */ }
}

/**
 * 판을 훑어 저장한다 — 새로 "만남" 이상에 오른 장수를 돌려준다 (알림으로 띄울 것).
 * 들음만 켜진 것은 알리지 않는다 (새 나라를 알면 그 나라 장수가 한꺼번에 들어온다).
 */
export function recordDex(r: Realm): Array<{ id: string; lv: 2 | 3 | 4 }> {
  const { dex, fresh } = scanDex(loadDex(), r)
  if (fresh.length > 0) saveDex(dex)
  recordClan(r)
  const out: Array<{ id: string; lv: 2 | 3 | 4 }> = []
  for (const x of fresh) {
    const lv = dexLevel(x.now)
    if (lv >= 2 && lv > dexLevel(x.was)) out.push({ id: x.id, lv: lv as 2 | 3 | 4 })
  }
  return out
}

// ───────── 가문 — 혼인에서 난 아이 (혈통 · SYSTEMS §5-10 "도감에 족보 칸이 열린다")
// 아이는 판마다 새로 생기는 사람이라 도감 명단(dex.ts)에 없다 — 우리 나라에서 난 아이를 따로 쌓는다. 판의 시드로 갈라 같은 이름도 다른 사람이다.

const CLAN_KEY = 'hanbal.realm.clan'

interface ClanKid { name: string; look: 'g' | 'w'; parents: [string, string]; traits: string[]; board: RegionId; nation: string; stats: number[] }

function loadClan(): Record<string, ClanKid> {
  try {
    const v = JSON.parse(localStorage.getItem(CLAN_KEY) ?? 'null') as Record<string, ClanKid> | null
    return v !== null && typeof v === 'object' ? v : {}
  } catch {
    return {}
  }
}

function recordClan(r: Realm): void {
  if (r.region === 'tutorial') return
  const had = loadClan()
  let changed = false
  for (const h of Object.values(r.heroes)) {
    if (h.parents === undefined || h.faction !== r.player) continue
    const key = `${r.seed}:${h.id}`
    if (had[key] !== undefined) continue
    had[key] = {
      name: h.name, look: h.look, parents: [r.heroes[h.parents[0]]?.name ?? '?', r.heroes[h.parents[1]]?.name ?? '?'], traits: [...h.traits],
      board: r.region ?? 'byeonhan-mini', nation: r.factions[r.player]?.name ?? '', stats: [h.mu, h.tong, h.ryak, h.chi, h.deok, h.uiri],
    }
    changed = true
  }
  if (changed) try { localStorage.setItem(CLAN_KEY, JSON.stringify(had)) } catch { /* 저장 못 하는 곳 */ }
}

/**
 * 가문의 아이를 다음 판에 데려갈 몸으로 (형 10-25: "데려갈 장수에 내가 혼인시켜서 낳은 장수들은 왜 없지?").
 * id 는 `clan-<생김>-<시드>-<판의 id>` — 얼굴은 판에서와 같은 그림 (art.bustOf 가 이 꼴을 읽는다)
 */
export function clanHeroes(): Array<{ id: string; name: string; hero: Hero }> {
  const out = Object.entries(loadClan()).map(([key, x]) => {
    const id = `clan-${x.look}-${key.replace(':', '-')}`
    const [mu, tong, ryak, chi, deok, uiri] = x.stats
    const hero: Hero = {
      id, name: x.name, faction: '', mu: mu ?? 3, tong: tong ?? 3, ryak: ryak ?? 3, chi: chi ?? 3, deok: deok ?? 3, uiri: uiri ?? 5,
      traits: [...x.traits], look: x.look, status: 'free', captor: null, at: null, post: null,
    }
    return { id, name: x.name, hero }
  })
  noteKids(out.map((x) => x.hero)) // 얼굴은 특성의 갈래로 — 판에서 본 얼굴 그대로
  return out
}

function clanHtml(k: DexKit): string {
  const kids = Object.values(loadClan())
  if (kids.length === 0) return `<p class="mute dxclan">아직 아무도 없다. 장수 카드에서 우리 장수 둘을 혼인시키면, 몇 계절 뒤 난 아이가 여기 오른다.</p>`
  let h = `<div class="dxclan">`
  for (const [key, x] of Object.entries(loadClan())) {
    const chips = x.traits.map((t) => TRAIT[t]).filter((t) => t !== undefined).map((t) => `<span class="trait" style="--g:${GRADE_COLOR[t!.grade]}"><b>${k.esc(t!.name)}</b></span>`).join('')
    const pic = k.kid(key.split(':').slice(1).join(':'), x.look, x.traits)
    h += `<div class="clk">${pic !== null ? `<img class="dxf" src="${pic}" alt="">` : `<span class="dxf none">${x.look === 'w' ? '여' : '남'}</span>`}<div><b>${nameHtml(x.name)}</b><span class="mute">${k.esc(x.parents.join(' · '))}의 아이 · ${k.esc(BOARD_NAME[x.board])} ${k.esc(x.nation)}</span><span class="tr3">${chips}</span></div></div>`
  }
  return h + `</div>`
}

export type DexBoard = RegionId | 'wander' | 'all' | 'clan'

const BOARD_NAME: Readonly<Record<RegionId | 'wander', string>> = {
  tutorial: '배우는 판', mahan: '온조 장', jumong: '주몽 장', seorabeol: '혁거세 장', 'byeonhan-mini': '작은 판', yeongnam: '큰 판', south: '삼한 남부', world: '삼한과 북녘', wander: '떠돌이',
}
const TABS: readonly Exclude<DexBoard, 'clan'>[] = ['all', 'mahan', 'jumong', 'seorabeol', 'byeonhan-mini', 'yeongnam', 'south', 'world', 'wander']
export const LV_NAME = ['모른다', '들음', '만남', '사로잡음', '거느림'] as const

interface DexKit {
  readonly esc: (s: string) => string
  /** 명치판 그림 주소 — 없으면 null */
  readonly bust: (hero: string) => string | null
  /** 아이의 얼굴 (판 밖 가문 칸 — 판의 장수 id 와 성별로) */
  readonly kid: (hero: string, look: 'g' | 'w', traits?: readonly string[]) => string | null
  /** 판 밖에서 키운 것 — 단련 단계 · 지닌 유물 (단련터 · drill.ts · relics.ts). 없으면 0 · [] */
  readonly grow: (hero: string) => { lv: number; relics: string }
}

/** 모르는 장수의 귀띔 — 어디 가면 만나나 */
function whereHint(x: DexHero): string {
  if (x.board === 'wander') return '떠돌이 — 봄에 어느 고을에 나타나 값을 부른다'
  return `${BOARD_NAME[x.board]} · ${x.nationName}${x.ruler ? '의 군주' : '의 장수'}`
}

function card(k: DexKit, x: DexHero, f: number, sel: boolean): string {
  const lv = dexLevel(f)
  const src = k.bust(x.id)
  const face = lv === 0 || src === null ? `<span class="dxf none">${lv === 0 ? '?' : ''}</span>` : `<img class="dxf" src="${src}" alt="" loading="lazy">`
  const name = lv === 0 ? '<b class="dxn">???</b>' : `<b class="dxn">${nameHtml(x.name)}</b>`
  const pips = [DEX_HEARD, DEX_MET, DEX_CAUGHT, DEX_SERVED].map((b, i) => `<i class="${f & b ? 'on' : ''}" title="${LV_NAME[i + 1]}"></i>`).join('')
  const g = lv >= 2 ? ` style="--g:${GRADE_COLOR[x.grade]}"` : ''
  const gr = k.grow(x.id)
  const grow = gr.lv > 0 || gr.relics !== '' ? `<span class="dxgr">${gr.lv > 0 ? `<b>단련 ${gr.lv}</b>` : ''}${gr.relics}</span>` : ''
  return `<button class="dxc lv${lv}${lv >= 2 ? ' graded' : ''}${sel ? ' sel' : ''}" data-act="dex-sel" data-id="${x.id}"${g}>${face}${grow}${f & DEX_CAUGHT ? '<span class="rope" title="사로잡은 적이 있다"></span>' : ''}${name}<span class="dxm">${k.esc(x.board === 'wander' ? '떠돌이' : x.nationName)}</span><span class="pips">${pips}</span></button>`
}

/** 고른 장수 — 아래에 붙는 판 */
function detail(k: DexKit, x: DexHero, f: number): string {
  const lv = dexLevel(f)
  let h = `<div class="dxsel"><button class="x" data-act="dex-sel" aria-label="닫기">✕</button>`
  const src = k.bust(x.id)
  h += `<div class="dxtop">${lv > 0 && src !== null ? `<img class="dxbig" src="${src}" alt="" data-act="bust-view" data-src="${src}">` : '<span class="dxbig none">?</span>'}<div>`
  h += `<b class="dxname">${lv > 0 ? nameHtml(x.name) : '???'}</b>`
  h += `<span class="mute">${k.esc(whereHint(x))}</span>`
  if (lv >= 2) h += `<span class="grade" style="--g:${GRADE_COLOR[x.grade]}">${GRADE_NAME[x.grade]}</span>`
  h += `<span class="lvs">${[DEX_HEARD, DEX_MET, DEX_CAUGHT, DEX_SERVED].map((b, i) => `<i class="${f & b ? 'on' : ''}">${LV_NAME[i + 1]}</i>`).join('')}</span></div></div>`
  const gr = k.grow(x.id)
  const grown = gr.lv > 0 || gr.relics !== '' ? `<p class="dxgrl">${gr.lv > 0 ? `<b>단련 ${gr.lv}</b> 단련터에서 키운 몸으로 다음 판에 온다` : ''}${gr.relics !== '' ? `<span>지닌 유물 ${gr.relics}</span>` : ''}</p>` : ''
  if (lv >= 2) h += `<div class="dxstat">${heroRadar(x.hero, true, (f & DEX_SERVED) !== 0, 150)}<div class="dxtr">${traitChips(x.hero, true)}<p class="mute">처음 나올 때의 솜씨다. 판에서 부리면 자란다.</p>${grown}</div></div>`
  else if (lv === 1) h += `<p class="mute">이름만 들었다. 싸워 보거나 정찰·첩자로 보면 솜씨가 적힌다.</p>`
  else h += `<p class="mute">아직 모른다. ${k.esc(x.board === 'wander' ? '떠돌이는 봄마다 한 명쯤 우리 땅에 나타난다.' : `${josa(x.nationName, '을', '를')} 알게 되면 이름이 들린다.`)}</p>`
  if (lv >= 2 && (f & DEX_CAUGHT) === 0 && (f & DEX_SERVED) === 0) h += `<p class="mute">싸움에서 이기고 사로잡으면 포승줄 칸이 켜진다. 회유하면 거느린다.</p>`
  return h + `</div>`
}

/** 도감 판 — `back` 은 돌아갈 곳의 이름 */
export function dexHtml(k: DexKit, board: DexBoard, sel: string | null, back: string): string {
  const dex = loadDex()
  const all = dexCatalog()
  const c = dexCounts(dex)
  let h = `<div class="front dexp"><div class="fhead"><button class="btn ghost" data-act="dex-close">‹ ${k.esc(back)}</button><h2>영웅전</h2></div>`
  h += `<div class="dxsum"><div class="dxbar"><i class="s" style="width:${(c.served / c.total) * 100}%"></i><i class="c" style="width:${(c.caught / c.total) * 100}%"></i><i class="m" style="width:${(c.met / c.total) * 100}%"></i><i class="h" style="width:${(c.heard / c.total) * 100}%"></i></div>`
  h += `<p><span><b>${c.served}</b>거느림</span><span><b>${c.caught}</b>사로잡음</span><span><b>${c.met}</b>만남</span><span><b>${c.heard}</b>들음</span><span class="mute">모두 ${c.total}</span></p>`
  h += `<p class="mute">판이 끝나도, 져도 남는다. 사로잡고 거느린 장수가 쌓인다.</p></div>`
  h += `<div class="dxtabs">`
  for (const t of TABS) {
    const xs = t === 'all' ? all : all.filter((x) => x.board === t)
    const got = xs.filter((x) => dexLevel(dex[x.id]?.f ?? 0) >= 2).length
    h += `<button class="${t === board ? 'on' : ''}" data-act="dex-board" data-v="${t}">${t === 'all' ? '모두' : BOARD_NAME[t]}<small>${got}/${xs.length}</small></button>`
  }
  h += `<button class="${board === 'clan' ? 'on' : ''}" data-act="dex-board" data-v="clan">가문<small>${Object.keys(loadClan()).length}</small></button>`
  if (board === 'clan') return h + `</div>${clanHtml(k)}</div>`
  h += `</div><div class="dxgrid">`
  const xs = board === 'all' ? all : all.filter((x) => x.board === board)
  for (const x of xs) h += card(k, x, dex[x.id]?.f ?? 0, x.id === sel)
  h += `</div>`
  const s = sel !== null ? all.find((x) => x.id === sel) : undefined
  if (s !== undefined) h += detail(k, s, dex[s.id]?.f ?? 0)
  return h + `</div>`
}

/** 판 안의 알림 — "도감에 올랐다" (몇 초 뒤 스스로 걷힌다 · CSS 만) */
export function dexToastHtml(k: DexKit, items: ReadonlyArray<{ id: string; lv: 2 | 3 | 4 }>): string {
  if (items.length === 0) return ''
  const cat = new Map(dexCatalog().map((x) => [x.id, x]))
  const top = [...items].sort((a, b) => b.lv - a.lv).slice(0, 3)
  let h = `<div class="dxtoast" data-act="dex-open">`
  for (const it of top) {
    const x = cat.get(it.id)
    if (x === undefined) continue
    const src = k.bust(x.id)
    h += `<div class="dxt lv${it.lv}">${src !== null ? `<img src="${src}" alt="">` : ''}<span><small>영웅전 · ${LV_NAME[it.lv]}</small><b>${nameHtml(x.name)}</b></span></div>`
  }
  if (items.length > top.length) h += `<div class="dxt more">그 밖에 ${items.length - top.length}명</div>`
  return h + `</div>`
}

export const DEX_CSS = `
/* 둥근 얼굴 — 청동 테 그림(ui/ring-portrait.png · 테 두께는 지름의 17%) · 얼굴이 줄지 않게 칸을 키운다 (형 10-29: "박스 테두리들이 여전히 css") */
.ap .dexp .dxf, .ap .dxt img { background: url(__ART__ui/ring-portrait.png) center / 100% 100% no-repeat, #17110c; background-origin: border-box; border-style: solid; border-color: transparent; border-radius: 50%; box-sizing: border-box; }
.ap .dexp .dxf { width: 78px !important; height: 78px !important; border-width: 13px; } .ap .dexp .dxf.none { border: 13px solid transparent !important; background: url(__ART__ui/ring-portrait.png) center / 100% 100% no-repeat, #17110c !important; background-origin: border-box !important; }
.ap .dxt img { width: 50px !important; height: 50px !important; border-width: 8.5px; }
.ap .dexp .dxsum { max-width: 980px; margin: 4px auto 0; padding: 0 14px; }
.ap .dexp .dxbar { position: relative; height: 10px; border-radius: 5px; background: #30241a; overflow: hidden; }
.ap .dexp .dxbar i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 5px; }
.ap .dexp .dxbar .h { background: #60524a; z-index: 1; } .ap .dexp .dxbar .m { background: #7a8aa0; z-index: 2; }
.ap .dexp .dxbar .c { background: #c07a4a; z-index: 3; } .ap .dexp .dxbar .s { background: #e0b860; z-index: 4; }
.ap .dexp .dxsum p { display: flex; flex-wrap: wrap; gap: 4px 12px; align-items: baseline; margin: 6px 0 2px; font-size: 12.5px; color: #a89c84; }
.ap .dexp .dxsum p b { font-size: 17px; color: var(--gold); margin-right: 3px; }
.ap .dexp .dxtabs { display: flex; gap: 6px; overflow-x: auto; max-width: 980px; margin: 8px auto 0; padding: 0 14px 4px; scrollbar-width: none; }
/* 테는 그림으로 — 쇠판 단추 · 고른 것은 금빛 (형 10-29: "박스 테두리들이 여전히 css") */
.ap .dexp .dxtabs button { flex: none; padding: 2px 5px; border: 6px solid transparent; border-image: url(__ART__ui/btn-dark.png?v=2) 30 33 fill / 6px 8px stretch; border-radius: 0; background: none; color: #d8cdb4; font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; }
.ap .dexp .dxtabs button.on { border-image: url(__ART__ui/btn-gold.png?v=2) 30 35 fill / 6px 8px stretch; color: #2a1606; } .ap .dexp .dxtabs button.on small { color: #4a2e10; } .ap .dexp .dxtabs small { margin-left: 5px; color: var(--mute); font-size: 11px; }
.ap .dexp .dxgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(86px, 1fr)); gap: 8px; max-width: 980px; margin: 8px auto; padding: 0 14px 220px; }
/* 명부 한 칸 — 밤빛 판에 청동 줄 · 모서리 징 (ui/card.png · 판 안 카드와 한 벌) · 다 알아낸 이는 청동·옻칠 나무 테 (ui/frame-panel.png) */
.ap .dexp .dxc { position: relative; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 0 0 1px; border-radius: 0;
  border: 10px solid transparent; border-image: url(__ART__ui/card.png?v=1) 24 fill / 10px stretch; background: none; color: var(--ink); font: inherit; cursor: pointer; min-width: 0; }
.ap .dexp .dxc.graded { filter: drop-shadow(0 0 4px color-mix(in srgb, var(--g) 70%, transparent)); }
.ap .dexp .dxc.lv4 { border-image: url(__ART__ui/frame-panel.png?v=3) 118 / 10px stretch; background: linear-gradient(#2c2618, #1f1710) padding-box; }
.ap .dexp .dxc.sel { filter: drop-shadow(0 0 3px #ffd27a) drop-shadow(0 0 8px #ffd27a88); }
/* 판 밖에서 키운 것 — 얼굴 위 왼쪽에 단련 단계 · 지닌 유물 (형 10-26: 영웅전 카드에도 「단련 n」) */
.ap .dexp .dxc .dxgr { position: absolute; top: 3px; left: 3px; z-index: 2; display: flex; align-items: center; gap: 1px; pointer-events: none; }
.ap .dexp .dxc .dxgr b { padding: 0 2px; border: 4px solid transparent; border-image: url(__ART__ui/btn-dark.png?v=2) 30 33 fill / 4px 5px stretch; border-radius: 0; background: none; color: #ffe08a; font-size: 10px; font-weight: 800; white-space: nowrap; }
.ap .dexp .dxc .dxgr .rlchip { width: 18px; height: 18px; margin-left: 1px; } .ap .dexp .dxc .dxgr .rlchip img { width: 15px; height: 15px; }
.ap .dexp .dxgrl { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; margin: 6px 0 0; font-size: 12.5px; color: #cbbf9f; }
.ap .dexp .dxgrl b { color: #ffe08a; margin-right: 4px; }
.ap .dexp .dxf { width: 64px; height: 64px; border-radius: 50%; object-fit: cover; object-position: top; }
.ap .dexp .dxc.lv1 .dxf { filter: grayscale(.85) brightness(.75); }
.ap .dexp .dxf.none { display: grid; place-items: center; background: #17110c; color: #60524a; font-size: 28px; font-weight: 700; border: 1px dashed #54412a; box-sizing: border-box; }
.ap .dexp .dxn { font-size: 12.5px; font-weight: 600; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ap .dexp .dxc.lv0 .dxn { color: #70625a; } .ap .dexp .dxn .ttl { font-size: 10px; }
.ap .dexp .dxm { font-size: 10.5px; color: var(--mute); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ap .dexp .pips { display: flex; gap: 3px; margin-top: 1px; } .ap .dexp .pips i { width: 6px; height: 6px; border-radius: 50%; background: #463a33; }
.ap .dexp .pips i.on:nth-child(1) { background: #90827a; } .ap .dexp .pips i.on:nth-child(2) { background: #a8b8d0; }
.ap .dexp .pips i.on:nth-child(3) { background: #e0915a; } .ap .dexp .pips i.on:nth-child(4) { background: #f0c860; }
.ap .dexp .rope { position: absolute; top: 46px; right: 10px; width: 22px; height: 22px; border-radius: 50%; background: #8a5a2a; border: 2px solid #e0b070;
  box-shadow: 0 1px 4px #000a; } .ap .dexp .rope::after { content: ''; position: absolute; inset: 4px; border-radius: 50%; border: 2px dashed #f0d8a8; }
.ap .dexp .dxclan { max-width: 980px; margin: 10px auto; padding: 0 14px 40px; display: flex; flex-direction: column; gap: 8px; }
.ap .dexp .clk { display: flex; gap: 10px; align-items: center; padding: 0; border-radius: 0; border: 10px solid transparent; border-image: url(__ART__ui/card.png?v=1) 24 fill / 10px stretch; background: none; }
.ap .dexp .clk > div { display: flex; flex-direction: column; gap: 2px; } .ap .dexp .clk .dxf.none { font-size: 16px; color: #f0b8c8; }
.ap .dexp .dxsel { position: fixed; left: 50%; bottom: 0; transform: translateX(-50%); width: min(560px, 100%); max-height: 62vh; overflow-y: auto; z-index: 6; box-sizing: border-box;
  padding: 0 0 env(safe-area-inset-bottom); border-radius: 0; border: 18px solid transparent; border-bottom-width: 12px; border-image: url(__ART__ui/panel.png?v=2) 64 fill / 18px 18px 12px stretch; background: none;
  box-shadow: 0 -8px 30px #000a; animation: dxup .25s ease-out both; }
@keyframes dxup { from { transform: translate(-50%, 30px); opacity: 0; } to { transform: translateX(-50%); opacity: 1; } }
.ap .dexp .dxsel .x { position: absolute; right: -6px; top: -8px; width: 38px; height: 34px; border: 6px solid transparent; border-image: url(__ART__ui/btn-dark.png?v=2) 30 33 fill / 6px 8px stretch; border-radius: 0; background: none; color: #efe3c6; font-weight: 700; cursor: pointer; }
.ap .dexp .dxtop { display: flex; gap: 12px; align-items: center; } .ap .dexp .dxtop > div { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.ap .dexp .dxbig { width: 96px; height: 96px; border-radius: 0; object-fit: cover; object-position: top; flex: none; box-sizing: border-box; border: 9px solid transparent; border-image: url(__ART__ui/frame-portrait.png) 60 / 9px stretch; }
.ap .dexp .dxbig.none { display: grid; place-items: center; background: #17110c; color: #60524a; font-size: 40px; }
.ap .dexp .dxname { font-size: 19px; color: var(--gold); font-family: 'Gowun Batang', serif; }
.ap .dexp .grade { align-self: flex-start; padding: 0 3px; border: 5px solid transparent; border-image: url(__ART__ui/btn-dark.png?v=2) 30 33 fill / 5px 7px stretch; border-radius: 0; color: var(--g); font-size: 12px; font-weight: 700; }
.ap .dexp .lvs { display: flex; flex-wrap: wrap; gap: 4px; } .ap .dexp .lvs i { font-style: normal; font-size: 11.5px; padding: 0 3px; border: 5px solid transparent; border-image: url(__ART__ui/btn-dark.png?v=2) 30 33 fill / 5px 7px stretch; border-radius: 0; color: #8a7c6a; opacity: .7; }
.ap .dexp .lvs i.on { border-image: url(__ART__ui/btn-gold.png?v=2) 30 35 fill / 5px 7px stretch; color: #2a1606; font-weight: 700; opacity: 1; }
.ap .dexp .dxstat { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 6px; } .ap .dexp .dxtr { flex: 1; min-width: 180px; display: flex; flex-wrap: wrap; gap: 4px; }
.ap .dexp .dxtr p { flex-basis: 100%; }
.ap .dxtoast { position: absolute; right: 10px; top: calc(64px + env(safe-area-inset-top)); z-index: 45; display: flex; flex-direction: column; gap: 6px; cursor: pointer;
  animation: dxt 5.5s ease-in-out both; } .ap .dxtoast.gone { display: none; }
@keyframes dxt { 0% { opacity: 0; transform: translateX(30px); } 8%, 82% { opacity: 1; transform: none; } 100% { opacity: 0; transform: translateX(30px); visibility: hidden; } }
.ap .dxt { display: flex; align-items: center; gap: 8px; padding: 0 4px 0 0; border-radius: 0; border: 10px solid transparent; border-image: url(__ART__ui/card.png?v=1) 24 fill / 10px stretch; background: none; filter: drop-shadow(0 4px 10px #0009); }
.ap .dxt img { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; object-position: top; }
.ap .dxt span { display: flex; flex-direction: column; line-height: 1.2; } .ap .dxt small { font-size: 11px; color: var(--mute); } .ap .dxt b { font-size: 14px; }
.ap .dxt.lv3 small { color: #f0b080; } .ap .dxt.lv4 { border-image: url(__ART__ui/frame-panel.png?v=3) 118 / 10px stretch; background: #1f1710 padding-box; } .ap .dxt.lv4 small { color: #f0c860; }
/* 새로 오른 장수 얼굴 뒤로 금빛이 한 번 터진다 (realm/fx/gold.png · __ART__ 는 app.ts 가 바꿔 넣는다) */
.ap .dxt { position: relative; } .ap .dxt img { position: relative; }
.ap .dxt:not(.more)::before { content: ''; position: absolute; left: -32px; top: 50%; width: 104px; height: 104px; margin-top: -52px; pointer-events: none;
  background: url(__ART__fx/gold.png) center / contain no-repeat; animation: dxglow 1.6s ease-out .25s both; }
@keyframes dxglow { 0% { opacity: 0; transform: scale(.4) rotate(-20deg); } 30% { opacity: 1; } 100% { opacity: 0; transform: scale(1.3) rotate(12deg); } }
.ap .dxt.more { font-size: 12px; color: var(--mute); padding: 4px 12px; align-self: flex-end; }
@media (prefers-reduced-motion: reduce) { .ap .dxtoast { animation-duration: 6s; } .ap .dexp .dxsel { animation: none; } .ap .dxt::before { display: none; } }
`
