/**
 * 열전 판 기록 — 적기와 다시 돌리기 (형 11-19). 기기 칸·꼴은 runlog-store.ts.
 *
 * 화면(raid-main)이 판에 넣는 입력을 그대로 받아 적는다: 이동은 HAEBI_LOG.grid 칸으로 맞춘 값을 판에 넣고 적는다(맞춘 값이 판이 받은 값이라
 * 씨앗 + 입력으로 같은 판이 그대로 다시 돈다 · A1). 판의 셈(haebi.ts)은 읽고 부르기만 한다.
 */
import { HAEBI_LOG as LG, HAEBI_CHAMPION as CH } from '../tune/params.ts'
import { spawnView, type SpawnView } from './champion.ts'
import { choose, createHaebi, expireChests, normalizedRaidOpts, usesGiantBoss, giantRules, usesPalisade, giantHUD, usesPermanentAwakening, usesAwakenedCast, reroll, stepHaebi, type HaebiRun, type Pick, type RunInput } from './haebi.ts'
import type { RaidEnd, RaidGame } from './runlog-store.ts'

/** 판의 한 걸음 (raid-main 과 같은 1/120초) */
export const STEP = 1 / 120

export interface Recorder {
  readonly g: RaidGame
  /** 이 기록이 적는 판 (다른 판이 들어오면 — 개발 검수 재생 — 적지 않는다) */
  readonly run: HaebiRun
  parts: string[]
  /** 지금 입력으로 걸은 걸음 수 · 지금 입력(격자 정수 · 누름 비트) */
  n: number; x: number; y: number; f: number; source: number; view: string
  quit: boolean
}

export function startRecord(run: HaebiRun, g: Omit<RaidGame, 'v' | 'grid' | 'input' | 'picks' | 'steps' | 'end'>): Recorder {
  return { g: { v: 1, ...g, opts: normalizedRaidOpts(run, g.opts), ...(usesGiantBoss(run) ? { rules: giantRules(run) } : usesPalisade(run) ? { rules: '56C' as const } : usesAwakenedCast(run) ? { rules: '56B' as const } : usesPermanentAwakening(run) ? { rules: '56A' as const } : run.mode === 'stage' ? { rules: '53B' as const } : {}), grid: LG.grid, input: '', picks: [], steps: 0, end: null }, run, parts: [], n: 0, x: 0, y: 0, f: 0, source: -1, view: '', quit: false }
}

const b36 = (n: number) => n.toString(36)
/** 격자에 맞춘 정수 (-0 은 0 으로 — atan2 가 둘을 다르게 본다) */
const cell = (v: number, grid: number) => Math.round(v * grid) || 0
const encodeView = (view?: SpawnView) => view ? Object.values(spawnView(view)).map(n => b36(Math.round(n / CH.viewGrid) * CH.viewGrid)).join(',') : ''
function decodeView(text: string): SpawnView | undefined {
  const parts = text.split(',')
  if (parts.length !== 4 || parts.some(n => !/^[0-9a-z]+$/.test(n))) return undefined
  const [left, top, right, bottom] = parts.map(n => parseInt(n, 36))
  const v = spawnView({ left: left!, top: top!, right: right!, bottom: bottom! })
  return v === spawnView() ? undefined : v
}
const inputOf = (x: number, y: number, f: number, grid: number, source = -1, view = ''): RunInput => {
  const bounds = view ? decodeView(view) : undefined
  return { x: x / grid, y: y / grid, dash: (f & 1) !== 0, skill: (f & 2) !== 0, wake: (f & 4) !== 0, ...(f & 8 ? { shortCutin: true } : {}), ...(source >= 0 ? { barrageSource: source } : {}), ...(bounds ? { viewBounds: bounds } : {}) }
}

/** 한 걸음의 입력을 적고, 판에 넣을 입력(격자에 맞춘 값)을 돌려준다 */
export function recInput(r: Recorder, i: RunInput): RunInput {
  const q = r.g.grid, x = cell(i.x, q), y = cell(i.y, q), f = (i.dash ? 1 : 0) | (i.skill ? 2 : 0) | (i.wake ? 4 : 0) | (i.shortCutin ? 8 : 0), source = i.barrageSource ?? -1, view = encodeView(i.viewBounds)
  if (x !== r.x || y !== r.y || f !== r.f || source !== r.source || view !== r.view) { r.parts.push(`${b36(r.n)},${b36(x)},${b36(y)},${f}${source >= 0 ? `,${b36(source)}` : ''}${view ? '|' + view : ''}`); r.n = 0; r.x = x; r.y = y; r.f = f; r.source = source; r.view = view }
  r.n++; r.g.steps++
  return inputOf(x, y, f, q, source, view)
}
/** 기록 없이 판에 넣을 때도 같은 격자로 (개발 검수 재생 등 · 손맛이 기록 있을 때와 같게) */
export const gridInput = (i: RunInput): RunInput => { const q = LG.grid; return inputOf(cell(i.x, q), cell(i.y, q), (i.dash ? 1 : 0) | (i.skill ? 2 : 0) | (i.wake ? 4 : 0) | (i.shortCutin ? 8 : 0), q, i.barrageSource ?? -1, encodeView(i.viewBounds)) }
export function recPick(r: Recorder, pick: Pick) { r.parts.push(`${b36(r.n)}=${pick}`); r.n = 0; r.g.picks.push(pick) }
export function recReroll(r: Recorder) { r.parts.push(`${b36(r.n)}!`); r.n = 0 }
export function recQuit(r: Recorder) { r.parts.push(`${b36(r.n)}.`); r.n = 0; r.quit = true }

/** 판에서 물러난다 (멈춤 창 「물러나기」) — 화면과 다시 돌리기가 같은 셈을 쓴다 */
export function withdrawRun(s: HaebiRun) { s.state = 'lost'; expireChests(s) }

/** 지금까지 적은 것을 기록 한 장에 담는다 (기기 칸에 쓰기 전에) */
export function sealInput(r: Recorder): RaidGame {
  r.g.input = (r.n ? [...r.parts, b36(r.n)] : r.parts).join(' ')
  if (r.g.end === null) r.g.snap = { t: Math.round(r.run.t * 10) / 10, level: r.run.level, kills: r.run.kills, hp: Math.round(r.run.hp) }
  return r.g
}

/** 판이 끝났다 — 결과를 적는다 (left: 판 가운데 화면을 떠남) */
export function finishRecord(r: Recorder, gold: number, at: string, left = false): RaidGame {
  const s = r.run
  const result: RaidEnd['result'] = left ? 'left' : r.quit ? 'quit' : s.state === 'won' ? 'won' : 'lost'
  const end: RaidEnd = { result, t: Math.round(s.t * 100) / 100, gold, level: s.level, kills: s.kills, hp: Math.max(0, Math.round(s.hp)), at }
  if (result === 'lost') {
    end.why = s.hp <= 0 ? 'fell' : 'time'
    if (end.why === 'fell') end.near = s.enemies.map((e) => [e.kind, Math.hypot(e.x - s.x, e.y - s.y)] as const).filter(([, d]) => d < 150).sort((a, b) => a[1] - b[1]).slice(0, 3).map(([k]) => k)
  }
  const giant = giantHUD(s)
  if (giant) end.bossHp = Math.max(0, Math.min(100, Math.round(giant.hp / giant.max * 10000) / 100))
  r.g.end = end
  delete r.g.snap
  return sealInput(r)
}

/** 기록 한 장(씨앗 + 판 옵션 + 입력)으로 판을 처음부터 다시 돌린다 — 입력을 덜어 낸 기록(cut)은 못 돌린다 */
/** tick: 걸음마다 판을 들여다본다(분석 도구 tools/raid-records.ts · 판은 바꾸지 않는다) */
export function replayRaid(g: RaidGame, tick?: (s: HaebiRun) => void, miss?: (pick: string, offers: readonly string[], t: number) => void): HaebiRun {
  const s = createHaebi(g.seed, g.mode, g.kit, { ...g.opts, simRules: g.rules === '55-IMUGI' ? '55-IMUGI' : g.rules === '55-TIGER' ? '55-TIGER' : g.rules === '57-BULGASARI' ? '57-BULGASARI' : g.rules === '55-GUMIHO' ? '55-GUMIHO' : g.rules === '55-SHAMAN' ? '55-SHAMAN' : g.rules === '56C' ? '56C' : g.rules === '56B' ? '56B' : g.rules === '56A' ? '56A' : '53B' })
  let inp = inputOf(0, 0, 0, g.grid)
  for (const tok of g.input.split(' ')) {
    const m = /^([0-9a-z]+)(.*)$/.exec(tok); if (!m) continue
    for (let i = parseInt(m[1]!, 36); i > 0; i--) { stepHaebi(s, inp, STEP); tick?.(s) }
    const rest = m[2]!
    if (rest.startsWith(',')) { const [controls, view = ''] = rest.slice(1).split('|'), [x, y, f, source] = controls!.split(','); inp = inputOf(parseInt(x!, 36), parseInt(y!, 36), Number(f), g.grid, source === undefined ? -1 : parseInt(source, 36), view) }
    else if (rest.startsWith('=')) { const pick = rest.slice(1) as Pick; if (!choose(s, pick)) miss?.(pick, [...s.offers], s.t) }
    else if (rest === '!') reroll(s)
    else if (rest === '.') withdrawRun(s)
  }
  return s
}
