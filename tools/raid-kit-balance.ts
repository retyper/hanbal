// 무기 묶음별 10분 열전 — 같은 봇·같은 씨앗으로 이기는 시각·격파·조합을 나란히 (형 11-15 · 밸런스는 숫자로)
//   node --experimental-strip-types tools/raid-kit-balance.ts [씨앗 7,11,23]
import { replay, type Route } from '../src/raid/haebi-replay.ts'
import type { Kit } from '../src/raid/haebi.ts'
import { HAEBI_RUN as C } from '../src/tune/params.ts'
Object.assign(C, JSON.parse(process.env['OVR'] ?? '{}'))   // OVR='{"mobHp":90}' 로 바꿔 재 본다
const seeds = (process.argv[2] ?? '7,11,23').split(',').map(Number)
for (const kit of ['axe', 'bow', 'spear', 'sword'] as Kit[]) for (const route of ['storm', 'fire'] as Route[]) {
  const rows = seeds.map(seed => { const per: number[] = []; let k = 0; const s = replay(seed, C.duration, route, r => { per.push(r.kills - k); k = r.kills }, kit); return { s, per } })
  const won = rows.filter(r => r.s.state === 'won').length
  const t = rows.map(r => Math.round(r.s.t)).join('/'), kills = rows.map(r => r.s.kills).join('/'), hp = rows.map(r => Math.round(r.s.hp)).join('/')
  const m1 = Math.round(rows.reduce((a, r) => a + (r.per[0] ?? 0), 0) / rows.length), m8 = Math.round(rows.reduce((a, r) => a + (r.per[12] ?? r.per[7] ?? 0), 0) / rows.length)
  console.log(`${kit.padEnd(5)} ${route.padEnd(5)} 승 ${won}/${seeds.length} · 끝 ${t}s · 격파 ${kills} · 남은 체력 ${hp} · 1분 ${m1} → 13분 ${m8} · 조합 ${[...new Set(rows.flatMap(r => r.s.combos))].join(',')}`)
}
