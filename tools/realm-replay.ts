/**
 * 형이 보낸 기록으로 막힌 계절을 그대로 다시 넘겨 본다 (형: "9년 가을에서 다음으로 안넘어가져" — 2026-10-19).
 *
 *   node --experimental-strip-types tools/realm-replay.ts 78guk-records-YYYY-MM-DD.json
 *
 * 내보낸 파일의 save.realm(지금 판)과 draft(그 계절에 정해 둔 명령)를 읽어, 화면과 같은 순서로 명령을 모아 advance 한다.
 * 던지면 그 자리(스택)를, 오래 걸리면 걸린 시간을 찍는다. 끝없이 돌면 10초 뒤에 멈추고 그렇다고 알린다.
 */
import { readFileSync } from 'node:fs'
import { aiOrders } from '../src/realm/ai.ts'
import { migrate } from '../src/realm/migrate.ts'
import { advance } from '../src/realm/season.ts'
import type { Order, Realm } from '../src/realm/types.ts'

const file = process.argv[2]
if (file === undefined) {
  console.log('쓰는 법: node --experimental-strip-types tools/realm-replay.ts <내보낸 기록.json>')
  process.exit(1)
}
const data = JSON.parse(readFileSync(file, 'utf8')) as { save?: { realm?: Realm }; draft?: Record<string, unknown> | null }
const realm = data.save?.realm
if (realm === undefined) {
  console.log('save.realm 이 없다 — 판이 없는 기록이다')
  process.exit(1)
}
migrate(realm)
const d = data.draft ?? null
const list = (k: string): Order[] => (d !== null && Array.isArray(d[k]) ? (d[k] as Order[]) : [])
const mine: Order[] = []
if (d !== null && d['seed'] === realm.seed && d['season'] === realm.season) {
  mine.push(...list('armyOrders'), ...list('settles'), ...list('heroOrders'), ...list('musters'), ...list('plots'))
  const pick = (d['pick'] ?? {}) as Record<string, { edge: string; ambush: boolean } | undefined>
  for (const [army, c] of Object.entries(pick)) if (c !== undefined) mine.push({ kind: 'march', army, edge: c.edge, ambush: c.ambush })
  for (const [ask, yes] of Object.entries((d['answers'] ?? {}) as Record<string, boolean>)) mine.push({ kind: 'answer', ask, yes })
  for (const e of Object.values((d['envoys'] ?? {}) as Record<string, Order>)) mine.push(e)
  console.log(`정해 둔 명령 ${mine.length}개를 싣는다`)
} else console.log('그 계절의 정해 둔 명령이 없다 — 명령 없이 넘긴다')
console.log(`판: ${realm.region ?? 'byeonhan-mini'} · 계절 ${realm.season} · 플레이어 ${realm.player}`)
const timer = setTimeout(() => { console.log('10초가 지나도 안 끝난다 — 끝없이 도는 곳이 있다'); process.exit(2) }, 10000)
const t0 = Date.now()
try {
  const ai = aiOrders(realm)
  const t1 = Date.now()
  const { next, report } = advance(realm, [...mine, ...ai])
  console.log(`넘어갔다: AI 명령 ${t1 - t0}ms · 넘기기 ${Date.now() - t1}ms · 다음 계절 ${next.season} · 보고 ${report.lines.length}줄`)
} catch (e) {
  console.log('던졌다:', e instanceof Error ? e.stack : e)
}
clearTimeout(timer)
