/**
 * 전장 실험실 (lab.html · docs/realm/battle-study/56-lab.md) — 왼쪽 「판 짜기」 서랍과 아래 「기록」 판. DOM 이다. sim 을 모른다.
 * 판 짜임과 기록은 브라우저 저장소의 열쇠 하나(LAB_KEY)에만 둔다 — 다른 열쇠는 읽지도 지우지도 않는다 (clear() 금지).
 * 기록은 판이 끝날 때마다 한 줄 · LAB_REC_MAX 줄까지 (넘으면 오래된 것부터 뺀다).
 */
import { t, type Key } from '../i18n/index.ts'
import { LAB_MAPS, LAB_PRESETS, type LabConfig, type LabSide } from './scenario.ts'

export const LAB_KEY = 'zz.field.lab'
export const LAB_REC_MAX = 500

/** 판 하나의 기록 (56 §2) — 다시 돌리기에 쓰는 입력 줄(inputs)까지 */
export interface LabRecord {
  at: string
  build: string
  cfg: LabConfig
  seed: number
  sec: number
  winner: number
  end: string
  morale: [number, number]
  killed: number
  lost: number
  flankHits: number
  inputs: string
  /** 5초마다 [틱, 우리 사기, 적 사기, 우리 사람, 적 사람] */
  samples: number[][]
  /** 사건 [틱, 종류, 편, 대 id, 맞은 대 id(없으면 -1)] — flankHit · rout · regroup · heroDown · sideBreak · gateBreak · blocked */
  events: Array<[number, string, number, number, number]>
  /** 자리마다 명령 수 (g 0 가운데 · 1 뒷줄 · 2 위 날개 · 3 대장 · 4 아래 날개) */
  orders: number[]
  pauses: number
  pausedSec: number
  fastSec: number
}
interface Store { v: 1; cfg: LabConfig | null; recs: LabRecord[] }

function load(): Store {
  try {
    const raw = localStorage.getItem(LAB_KEY)
    const s = raw === null ? null : JSON.parse(raw) as Store
    if (s !== null && s.v === 1 && Array.isArray(s.recs)) return s
  } catch { /* 저장 칸이 막혔거나 깨졌으면 빈 것으로 (지우지 않는다) */ }
  return { v: 1, cfg: null, recs: [] }
}
function save(s: Store): void {
  try { localStorage.setItem(LAB_KEY, JSON.stringify(s)) } catch { /* 저장 못 해도 판은 돈다 */ }
}
/** 저장해 둔 판 짜임 (없으면 null) */
export const savedLabConfig = (): LabConfig | null => load().cfg

export interface LabHandlers {
  /** 짠 대로 판을 새로 세운다 (준비 화면 · 같은 씨앗) */
  onApply(cfg: LabConfig): void
}
export interface Lab {
  /** 끝난 판 한 줄을 더한다 */
  record(r: LabRecord): void
  /** 판 짜기 서랍을 열고 닫는다 (싸움이 시작되면 닫힌다) */
  open(show: boolean): void
}

const GOLD = '#ffd27a'
const CSS = `
#lab-side{position:absolute;left:0;top:60px;bottom:170px;width:300px;max-width:calc(100vw - 48px);overflow:auto;background:#10140df2;border:1px solid ${GOLD}66;border-left:0;border-radius:0 10px 10px 0;padding:10px 12px;box-sizing:border-box;z-index:8;font-size:13px;color:#f3ecd8}
#lab-side[hidden]{display:none}
#lab-side h3{margin:10px 0 4px;font-size:13px;color:${GOLD}}
#lab-side h3:first-child{margin-top:0}
#lab-side .lab-row{display:flex;gap:4px;align-items:center;flex-wrap:wrap;margin:3px 0}
#lab-side .lab-row span{min-width:64px}
#lab-side button,#lab-rec button{font:inherit;color:#f3ecd8;background:#0b1a2ecc;border:1px solid #2f8cff88;border-radius:6px;padding:5px 8px;min-height:30px}
#lab-side button.on{border-color:${GOLD};color:${GOLD}}
#lab-side select,#lab-side input{font:inherit;background:#0b1a2e;color:#f3ecd8;border:1px solid #fff4;border-radius:5px;padding:3px 4px}
#lab-side input[type=number]{width:70px}
#lab-side .lab-go{background:${GOLD};color:#1a1305;border:0;font-weight:700}
#lab-side small{color:#f3ecd8aa}
#lab-tab{position:absolute;left:0;top:60px;z-index:9;font:inherit;font-size:13px;color:#1a1305;background:${GOLD};border:0;border-radius:0 8px 8px 0;padding:8px 6px;writing-mode:vertical-rl}
#lab-side:not([hidden])~#lab-tab,#lab-side:not([hidden])~#lab-recbtn{left:min(300px,calc(100vw - 48px))}
#lab-recbtn{position:absolute;left:0;top:170px;z-index:9;font:inherit;font-size:13px;color:#f3ecd8;background:#0b1a2ee6;border:1px solid ${GOLD}88;border-left:0;border-radius:0 8px 8px 0;padding:8px 6px;writing-mode:vertical-rl}
#lab-rec{position:absolute;left:0;right:0;bottom:0;height:60vh;overflow:auto;background:#10140df7;border-top:1px solid ${GOLD}88;z-index:21;padding:10px 14px;box-sizing:border-box;font-size:12px;color:#f3ecd8}
#lab-rec[hidden]{display:none}
#lab-rec .lab-bar{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:8px}
#lab-rec .lab-bar b{font-size:14px;color:${GOLD};margin-right:auto}
#lab-rec table{border-collapse:collapse;margin:4px 0 12px}
#lab-rec th,#lab-rec td{border-bottom:1px solid #fff2;padding:3px 8px;text-align:right;white-space:nowrap}
#lab-rec th{color:${GOLD};font-weight:600}
#lab-rec td:first-child,#lab-rec th:first-child{text-align:left}
`
const FRONT_KINDS = ['spear', 'pike', 'shield'] as const
const BOW_KINDS = ['bow', 'crossbow'] as const
const MEN_MAX = 3000

/** 군 한 편을 짧게: 「창600 활300 기300」 */
export function armyLabel(l: LabSide): string {
  return `${t(`lab.kind.${l.front.kind}` as Key)}${l.front.men} ${t(`lab.kind.${l.bows.kind}` as Key)}${l.bows.men} ${t('lab.kind.horse')}${l.horse}`
}
const total = (l: LabSide): number => l.front.men + l.bows.men + l.horse

export function mountLab(root: HTMLElement, first: LabConfig, h: LabHandlers): Lab {
  const style = document.createElement('style')
  style.textContent = CSS
  document.head.append(style)
  let cfg: LabConfig = structuredClone(first)
  const side = document.createElement('div'); side.id = 'lab-side'
  const tab = document.createElement('button'); tab.id = 'lab-tab'; tab.type = 'button'; tab.textContent = t('lab.panel')
  const recBtn = document.createElement('button'); recBtn.id = 'lab-recbtn'; recBtn.type = 'button'
  const rec = document.createElement('div'); rec.id = 'lab-rec'; rec.hidden = true
  root.append(side, tab, recBtn, rec)
  let clearArmed = false

  const num = (v: string, lo: number, hi: number): number => { const n = Math.round(Number(v) / 100) * 100; return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : lo }
  const sideHtml = (s: 0 | 1): string => {
    const l = cfg.sides[s]
    const opts = (kinds: readonly string[], cur: string): string => kinds.map(k => `<option value="${k}"${k === cur ? ' selected' : ''}>${t(`lab.kind.${k}` as Key)}</option>`).join('')
    return `<h3>${t(s === 0 ? 'lab.ours' : 'lab.foe')} <small>${total(l)}</small></h3>
<div class="lab-row">${(Object.keys(LAB_PRESETS) as Array<keyof typeof LAB_PRESETS>).map(p => `<button type="button" data-preset="${p}" data-side="${s}">${t(`lab.preset.${p}` as Key)}</button>`).join('')}</div>
<div class="lab-row"><span>${t('lab.slot.1')}</span><select data-f="frontKind" data-side="${s}">${opts(FRONT_KINDS, l.front.kind)}</select><input type="number" step="100" min="100" max="${MEN_MAX}" value="${l.front.men}" data-f="frontMen" data-side="${s}"></div>
<div class="lab-row"><span>${t('lab.slot.2')}</span><select data-f="bowsKind" data-side="${s}">${opts(BOW_KINDS, l.bows.kind)}</select><input type="number" step="100" min="0" max="${MEN_MAX}" value="${l.bows.men}" data-f="bowsMen" data-side="${s}"></div>
<div class="lab-row"><span>${t('lab.slot.34')}</span><span>${t('lab.kind.horse')}</span><input type="number" step="100" min="0" max="${MEN_MAX}" value="${l.horse}" data-f="horse" data-side="${s}"><small>${t('lab.wingNote')}</small></div>
<div class="lab-row"><span>${t('lab.slot.5')}</span><span>${t('lab.hero')}</span></div>`
  }
  const paintSide = (): void => {
    side.innerHTML = `<h3>${t('lab.map')}</h3><div class="lab-row">${LAB_MAPS.map(m => `<button type="button" data-map="${m}" class="${m === cfg.map ? 'on' : ''}">${t(`lab.map.${m}` as Key)}</button>`).join('')}</div>
${sideHtml(0)}${sideHtml(1)}
<h3>${t('lab.foeOpts')}</h3>
<div class="lab-row"><label><input type="checkbox" data-f="tricks"${cfg.tricks ? ' checked' : ''}> ${t('lab.tricks')}</label></div>
<div class="lab-row"><span>${t('lab.spread')}</span><input type="number" step="10" min="0" max="400" value="${cfg.spread}" data-f="spread"></div>
<h3>${t('lab.seed')}</h3>
<div class="lab-row"><input type="number" step="1" min="1" value="${cfg.seed}" data-f="seed"><button type="button" data-act="newseed">${t('lab.newSeed')}</button></div>
<div class="lab-row"><button type="button" class="lab-go" data-act="apply">${t('lab.apply')}</button><button type="button" data-act="again">${t('lab.again')}</button></div>`
  }
  const apply = (): void => { save({ ...load(), cfg }); paintSide(); h.onApply(structuredClone(cfg)) }
  side.addEventListener('change', e => {
    const el = e.target as HTMLInputElement
    const f = el.dataset['f'], s = Number(el.dataset['side']) as 0 | 1
    if (f === undefined) return
    const l: LabSide = structuredClone(cfg.sides[s] ?? cfg.sides[0])
    if (f === 'frontKind') l.front.kind = el.value as LabSide['front']['kind']
    else if (f === 'bowsKind') l.bows.kind = el.value as LabSide['bows']['kind']
    else if (f === 'frontMen') l.front.men = num(el.value, 100, MEN_MAX)
    else if (f === 'bowsMen') l.bows.men = num(el.value, 0, MEN_MAX)
    else if (f === 'horse') l.horse = num(el.value, 0, MEN_MAX)
    else if (f === 'tricks') { cfg = { ...cfg, tricks: el.checked }; return }
    else if (f === 'spread') { cfg = { ...cfg, spread: Math.max(0, Math.min(400, Math.round(Number(el.value) || 0))) }; return }
    else if (f === 'seed') { cfg = { ...cfg, seed: Math.max(1, Math.round(Number(el.value) || 1)) }; return }
    cfg = { ...cfg, sides: s === 0 ? [l, cfg.sides[1]] : [cfg.sides[0], l] }
    paintSide()
  })
  side.addEventListener('click', e => {
    const el = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null
    if (el === null) return
    const map = el.dataset['map'], preset = el.dataset['preset'], act = el.dataset['act']
    if (map !== undefined) { cfg = { ...cfg, map: map as LabConfig['map'] }; apply(); return }
    if (preset !== undefined) {
      const s = Number(el.dataset['side']) as 0 | 1, l = structuredClone(LAB_PRESETS[preset as keyof typeof LAB_PRESETS])
      cfg = { ...cfg, sides: s === 0 ? [l, cfg.sides[1]] : [cfg.sides[0], l] }; apply(); return
    }
    if (act === 'newseed') { cfg = { ...cfg, seed: cfg.seed + 1 }; apply(); return }
    if (act === 'apply' || act === 'again') apply()
  })
  tab.addEventListener('click', () => { side.hidden = !side.hidden })
  recBtn.addEventListener('click', () => { rec.hidden = !rec.hidden; clearArmed = false; if (!rec.hidden) paintRec() })

  /** 묶어 보기: 열쇠(땅 · 군)마다 판 수 · 우리가 이긴 몫 · 평균 길이 */
  const groupTable = (recs: readonly LabRecord[], keyOf: (r: LabRecord) => string, head: string): string => {
    const g = new Map<string, { n: number; w: number; sec: number }>()
    for (const r of recs) { const k = keyOf(r), v = g.get(k) ?? { n: 0, w: 0, sec: 0 }; v.n++; if (r.winner === 0) v.w++; v.sec += r.sec; g.set(k, v) }
    const rows = [...g.entries()].sort((a, b) => b[1].n - a[1].n).map(([k, v]) => `<tr><td>${k}</td><td>${v.n}</td><td>${Math.round(100 * v.w / v.n)}%</td><td>${Math.round(v.sec / v.n)}${t('lab.sec')}</td></tr>`).join('')
    return `<table><tr><th>${head}</th><th>${t('lab.col.games')}</th><th>${t('lab.col.rate')}</th><th>${t('lab.col.avg')}</th></tr>${rows}</table>`
  }
  const paintRec = (): void => {
    const recs = load().recs
    const winName = (w: number): string => t(w === 0 ? 'lab.win.0' : w === 1 ? 'lab.win.1' : 'lab.win.draw')
    const p2 = (n: number): string => String(n).padStart(2, '0')
    const when = (iso: string): string => { const d = new Date(iso); return `${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}` }
    const list = recs.slice().reverse().map(r => `<tr><td>${when(r.at)}</td><td>${t(`lab.map.${r.cfg.map}` as Key)}</td><td>${total(r.cfg.sides[0])} : ${total(r.cfg.sides[1])}</td><td>${r.seed}</td><td>${Math.round(r.sec)}${t('lab.sec')}</td><td>${winName(r.winner)}</td><td>${r.morale.join(' : ')}</td><td>${r.killed} / ${r.lost}</td><td>${r.flankHits}</td><td>${r.orders.reduce((a, b) => a + b, 0)}</td><td>${r.pauses} · ${Math.round(r.pausedSec)}${t('lab.sec')}</td></tr>`).join('')
    rec.innerHTML = `<div class="lab-bar"><b>${t('lab.records')} · ${t('lab.rec.n', { n: recs.length })}</b><button type="button" data-act="copy">${t('lab.copy')}</button><button type="button" data-act="down">${t('lab.download')}</button><button type="button" data-act="clear">${t(clearArmed ? 'lab.clearSure' : 'lab.clear')}</button><button type="button" data-act="close">${t('lab.close')}</button></div>
${recs.length === 0 ? `<p>${t('lab.empty')}</p>` : groupTable(recs, r => t(`lab.map.${r.cfg.map}` as Key), t('lab.sum.map')) + groupTable(recs, r => `${armyLabel(r.cfg.sides[0])} : ${armyLabel(r.cfg.sides[1])}`, t('lab.sum.army'))
  + `<table><tr><th>${t('lab.col.when')}</th><th>${t('lab.map')}</th><th>${t('lab.col.army')}</th><th>${t('lab.seed')}</th><th>${t('lab.col.sec')}</th><th>${t('lab.col.win')}</th><th>${t('lab.col.mor')}</th><th>${t('lab.col.kl')}</th><th>${t('lab.col.flank')}</th><th>${t('lab.col.orders')}</th><th>${t('lab.col.pause')}</th></tr>${list}</table>`}`
  }
  rec.addEventListener('click', e => {
    const act = ((e.target as HTMLElement).closest('button') as HTMLButtonElement | null)?.dataset['act']
    if (act === undefined) return
    const json = JSON.stringify(load().recs)
    if (act === 'close') { rec.hidden = true; return }
    if (act === 'copy') { void navigator.clipboard?.writeText(json).catch(() => { /* 막혀도 판은 돈다 */ }); return }
    if (act === 'down') {
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
      a.download = `field-lab-${new Date().toISOString().slice(0, 10)}.json`
      a.click(); URL.revokeObjectURL(a.href); return
    }
    if (act === 'clear') {
      // 두 번 눌러야 지운다 · 이 열쇠의 기록만 (판 짜임은 남긴다)
      if (!clearArmed) { clearArmed = true; paintRec(); return }
      clearArmed = false; save({ ...load(), recs: [] }); paintRec()
    }
  })
  const paintRecBtn = (): void => { recBtn.textContent = `${t('lab.records')} ${load().recs.length}` }
  paintSide(); paintRecBtn()
  return {
    record(r) {
      const s = load()
      s.recs.push(r)
      if (s.recs.length > LAB_REC_MAX) s.recs.splice(0, s.recs.length - LAB_REC_MAX)
      save(s); paintRecBtn()
      if (!rec.hidden) paintRec()
    },
    open(show) { side.hidden = !show },
  }
}
