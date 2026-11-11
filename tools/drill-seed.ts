/**
 * 단련터 시험용 기록 — 영웅전 명부 앞 40명에 단련 기록을 넣은 { 키: 값 } json 을 쓴다 (tools/layout-check.ts 의 drill 화면 · tools/phone-shot.ts 의 LS=).
 *   node --experimental-strip-types tools/drill-seed.ts <나갈 json>
 */
import { writeFileSync } from 'node:fs'
import { dexCatalog } from '../src/realm/dex.ts'

const cat = dexCatalog()
const h: Record<string, unknown> = {}
const dex: Record<string, unknown> = {}
cat.slice(0, 40).forEach((x, i) => {
  h[x.id] = { points: (i * 7) % 23, level: i % 9, add: { mu: i % 3 }, runs: 1 + (i % 4) }
  dex[x.id] = { f: 31, b: 'mahan' }
})
writeFileSync(process.argv[2] ?? 'drill-ls.json', JSON.stringify({ 'hanbal.realm.drill': { v: 1, h, paid: {}, order: [] }, 'hanbal.realm.dex': dex }))
