/**
 * 지난 기록 — 지난 계절들의 소식을 다시 본다 (형 2026-10-19: "최근로그 확인할수 있어야함. 어디서 조공요구했는지 기억이안나고
 * 어디서 전쟁선포했는지 모르겠음").
 *
 * 판 기록(host.history — 계절마다의 보고 줄)을 그대로 읽는다. 엔진은 모른다 — 화면의 일.
 * 걸러 보기: 갈래(전쟁·화친 · 사신 · 싸움 · 공작 · 우리 살림)와 나라 하나. 최근 계절이 위.
 * 보고판에서는 받기·거절 칸이 대신하던 "남이 우리에게 건 청"(ask)과 싸움 카드도 여기서는 글 한 줄로 남긴다.
 */
import { askLine, fieldName, josa, reportText, seasonLabel } from '../../realm/data/prose.ts'
import type { Realm, ReportLine } from '../../realm/types.ts'
import type { History } from './front.ts'

export type LogFilter = 'all' | 'rel' | 'envoy' | 'war' | 'plot' | 'home'

export const LOG_FILTERS: ReadonlyArray<readonly [LogFilter, string]> = [
  ['all', '전부'], ['rel', '전쟁·화친'], ['envoy', '사신'], ['war', '싸움'], ['plot', '공작'], ['home', '우리 살림'],
]

const KINDS: Readonly<Record<Exclude<LogFilter, 'all'>, ReadonlySet<string>>> = {
  rel: new Set(['relation', 'suzerain', 'end']),
  envoy: new Set(['envoy', 'ask', 'answered', 'recall', 'pledge', 'lent', 'envoyHeld']),
  war: new Set(['battle', 'take', 'sighted', 'blocked']),
  plot: new Set(['plot', 'mystery', 'confess', 'rumor']),
  home: new Set(['harvest', 'draft', 'settle', 'migrate', 'place', 'disband', 'hunger', 'build', 'rite', 'arm', 'market', 'spoil', 'bowUp', 'wed', 'birth', 'recruit', 'persuade', 'exile', 'retake', 'expGo', 'expStay', 'expBack', 'card', 'omen']),
}

/** 줄에 적힌 나라들 — 문자열 값 가운데 나라 id (청은 안의 from·to) */
export function lineNations(r: Realm, l: ReportLine): string[] {
  const out = new Set<string>()
  const scan = (o: Record<string, unknown>): void => {
    for (const v of Object.values(o)) if (typeof v === 'string' && r.factions[v] !== undefined) out.add(v)
  }
  scan(l as unknown as Record<string, unknown>)
  if (l.kind === 'ask') scan(l.ask as unknown as Record<string, unknown>)
  return [...out]
}

/** 싸움 한 줄 — 누가 어디를 쳐서 어떻게 됐나 (보고판에선 싸움 카드가 대신한다) */
function battleText(r: Realm, l: Extract<ReportLine, { kind: 'battle' }>): string {
  const fn = (f: string | undefined): string => (f !== undefined ? (r.factions[f]?.name ?? '?') : '?')
  const atk = fn(l.atkFaction)
  const def = fn(l.defender)
  const place = l.field === true && l.edge !== undefined ? fieldName(r, l.edge) : (r.nodes[l.node]?.name ?? l.node)
  const won = l.outcome === 'rout' || l.outcome === 'win'
  const lost = l.outcome === 'lose' || l.outcome === 'routed'
  let t = l.field === true
    ? `${josa(atk, '과', '와')} ${josa(def, '이', '가')} ${place}에서 맞붙었다 — `
    : `${josa(atk, '이', '가')} ${def}의 ${josa(place, '을', '를')} 쳤다 — `
  t += won ? (l.outcome === 'rout' ? `${atk}의 크게 이김.` : `${atk}의 이김.`) : lost ? (l.outcome === 'routed' ? `${def}의 크게 이김.` : `${def}의 이김.`) : '승부가 나지 않았다.'
  if (l.captured !== null) t += ` ${josa(r.heroes[l.captured]?.name ?? '장수', '이', '가')} 사로잡혔다.`
  if (l.killed !== null) t += ` ${josa(r.heroes[l.killed]?.name ?? '장수', '이', '가')} 쓰러졌다.`
  return t
}

/** 기록 한 줄의 글 — 보고 글과 같고, 보고판에서 다른 칸이 대신하던 것(청 · 싸움)만 여기서 글로 */
export function logText(r: Realm, l: ReportLine, viewer: string): string | null {
  if (l.kind === 'ask') {
    if (l.ask.to !== viewer) return null
    const place = l.ask.node !== undefined ? (r.nodes[l.ask.node]?.name ?? '') : ''
    return `사신이 왔다 — ${askLine(l.ask, r.factions[l.ask.from]?.name ?? '', place)}`
  }
  if (l.kind === 'battle') {
    const ours = l.atkFaction === viewer || l.defender === viewer
    return ours ? battleText(r, l) : null
  }
  return reportText(r, r, l, viewer)
}

export interface LogRow {
  readonly s: number
  readonly l: ReportLine
  readonly text: string
}

/**
 * 걸러 낸 기록 줄 — 최근 계절이 먼저(한 계절 안은 일어난 차례). `heard` 는 모르는 나라 이야기를 빼는 거름 (보고판과 같은 규칙).
 */
export function logRows(r: Realm, history: History, viewer: string, filter: LogFilter, nation: string | null, heard: (l: ReportLine) => boolean): LogRow[] {
  const out: LogRow[] = []
  for (const { s, lines } of [...history].sort((a, b) => b.s - a.s)) {
    for (const l of lines) {
      if (filter !== 'all' && !KINDS[filter].has(l.kind)) continue
      if (nation !== null && !lineNations(r, l).includes(nation)) continue
      if (!heard(l)) continue
      const text = logText(r, l, viewer)
      if (text !== null) out.push({ s, l, text })
    }
  }
  return out
}

/** 기록에 나오는 나라들 — 나라 거름 칩용 (나라 id 순) */
export function logNations(r: Realm, history: History, viewer: string): string[] {
  const set = new Set<string>()
  for (const { lines } of history) for (const l of lines) for (const f of lineNations(r, l)) if (f !== viewer) set.add(f)
  return [...set].sort()
}

export interface LogKit {
  readonly esc: (s: string) => string
  readonly emblem: (f: string, cls?: string) => string
  /** 보고판과 같은 그림 줄 */
  readonly row: (l: ReportLine, text: string) => string
}

/** 기록 판 — 위에 걸러 보기 칩, 아래에 계절마다 묶은 그림 줄 */
export function logbookHtml(k: LogKit, r: Realm, rows: readonly LogRow[], nations: readonly string[], filter: LogFilter, nation: string | null): string {
  let h = `<h3>지난 기록</h3><div class="logf">`
  for (const [id, name] of LOG_FILTERS) h += `<button class="${filter === id ? 'on' : ''}" data-act="log-f" data-v="${id}">${k.esc(name)}</button>`
  h += `</div>`
  if (nations.length > 0) {
    h += `<div class="logn"><button class="${nation === null ? 'on' : ''}" data-act="log-n" data-id="">모든 나라</button>`
    for (const f of nations) h += `<button class="${nation === f ? 'on' : ''}" data-act="log-n" data-id="${f}">${k.emblem(f, 'lem')}${k.esc(r.factions[f]?.name ?? '')}</button>`
    h += `</div>`
  }
  if (rows.length === 0) return h + `<p class="mute">${filter === 'all' && nation === null ? '아직 남은 기록이 없다. 계절이 지나면 여기 쌓인다.' : '고른 갈래에 남은 기록이 없다.'}</p>`
  let last = -1
  h += `<div class="lines logl">`
  for (const x of rows) {
    if (x.s !== last) {
      h += `<h4 class="logs">${k.esc(seasonLabel(x.s))}</h4>`
      last = x.s
    }
    h += k.row(x.l, x.text)
  }
  return h + `</div>`
}

export const LOG_CSS = `
.ap .logf, .ap .logn { display: flex; gap: 6px; flex-wrap: wrap; margin: 4px 0 8px; }
.ap .logf button, .ap .logn button { display: inline-flex; align-items: center; gap: 4px; padding: 5px 10px; border-radius: 14px; border: 1px solid #6a5236;
  background: #241a12; color: var(--mute); font: inherit; font-size: 13px; cursor: pointer; }
.ap .logf button.on, .ap .logn button.on { color: var(--ink); border-color: var(--gold); background: #3a3020; }
.ap .logn img.lem { width: 18px; height: 18px; }
.ap .logl .logs { margin: 12px 0 4px; color: var(--gold); font-size: 14px; }
.ap .logl .rrow { animation: none; opacity: 1; }
.ap .logbtn { position: absolute; left: 96px; top: calc(var(--toph) + var(--legh) + 8px); z-index: 6; padding: 6px 12px; border-radius: 12px;
  border: 1px solid #6a5236; background: #1f1710e6; color: var(--ink); font: inherit; font-size: 13px; cursor: pointer; }
.ap.sheet-open .logbtn, .ap.choosing .logbtn { display: none; }
`
