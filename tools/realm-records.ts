/**
 * 판 기록 읽기 — 형이 "기록 내보내기"로 받은 JSON 을 읽어 판마다 한 줄씩 (realm-main.ts 의 GameRecord)
 *
 *   node --experimental-strip-types tools/realm-records.ts <78guk-records-*.json> [--turns]
 *
 * 판마다: 나라 · 계절 수 · 끝(이김/짐/그만둠) · 한 계절에 붙잡은 시간 · 명령 가짓수 · 탭을 연 횟수.
 * --turns 를 붙이면 계절마다 내 살림(고을·가호·병력·곡식)과 명령을 늘어놓는다.
 */
import { readFileSync } from 'node:fs'

interface Turn {
  s: number
  ms: number
  orders: Array<{ kind: string }>
  me: { nodes: number; hh: number; men: number; grain: number; iron: number }
  taps: Array<[number, string, string]>
}
interface Game {
  nation: string
  seed: number
  started: string
  screen: string
  turns: Turn[]
  end: { kind: string; season: number } | null
}

const file = process.argv[2]
if (file === undefined) {
  console.error('쓰는 법: node --experimental-strip-types tools/realm-records.ts <기록.json> [--turns]')
  process.exit(1)
}
const showTurns = process.argv.includes('--turns')
const data = JSON.parse(readFileSync(file, 'utf8')) as { exported: string; games: Game[] }

const count = <T extends string>(xs: readonly T[]): string => {
  const m = new Map<string, number>()
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1)
  return [...m].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ') || '-'
}
const sec = (ms: number): string => `${Math.round(ms / 1000)}초`

console.log(`내보낸 때 ${data.exported} · 판 ${data.games.length}`)
for (const g of data.games) {
  const n = g.turns.length
  const median = n === 0 ? 0 : [...g.turns].map((t) => t.ms).sort((a, b) => a - b)[Math.floor(n / 2)]!
  const end = g.end === null ? '하는 중' : g.end.kind === 'win' ? '이김' : g.end.kind === 'lose' ? '짐' : '그만둠'
  const last = g.turns[n - 1]?.me
  console.log(`\n■ ${g.nation} · ${g.started.slice(0, 16)} · ${g.screen} · 계절 ${n} · ${end}`)
  console.log(`  한 계절 붙잡은 시간(가운데) ${sec(median)} · 마지막 살림 ${last ? `고을 ${last.nodes} 가호 ${last.hh} 병력 ${last.men} 곡식 ${last.grain}` : '-'}`)
  console.log(`  명령: ${count(g.turns.flatMap((t) => t.orders.map((o) => o.kind)))}`)
  console.log(`  누른 탭: ${count(g.turns.flatMap((t) => t.taps.filter((x) => x[1] === 'tab').map((x) => x[2])))}`)
  console.log(`  누른 것: ${count(g.turns.flatMap((t) => t.taps.map((x) => x[1])))}`)
  if (showTurns) {
    for (const t of g.turns) {
      console.log(`   ${String(t.s).padStart(3)} ${sec(t.ms).padStart(5)} 고을 ${t.me.nodes} 가호 ${t.me.hh} 병력 ${t.me.men} 곡식 ${t.me.grain} · ${count(t.orders.map((o) => o.kind))}`)
    }
  }
}
