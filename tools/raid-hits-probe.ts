// 열전 · 잡졸이 몇 대 맞고 쓰러지나 (형 11-16: 「적들이 죄다 한방이라 강해지는지 모르겠다」)
//   node --experimental-strip-types tools/raid-hits-probe.ts [kit axe] [route storm] [seed 7] [until]
// 분마다: 잡졸 체력 · 잡졸이 맞은 횟수 ÷ 쓰러진 잡졸 · 한 방에 쓰러진 비율 · 레벨 · 남은 체력
import { HAEBI_RUN as C, HAEBI_MOBS, HAEBI_STAGES } from '../src/tune/params.ts'
import { createHaebi, choose, stepHaebi, type Kit } from '../src/raid/haebi.ts'
import { botChoice, botInput, type Route } from '../src/raid/haebi-replay.ts'
// OVR='{"mobHp":90}' — 값을 바꿔 재 본다 (params.ts 는 그대로)
Object.assign(C, JSON.parse(process.env['OVR'] ?? '{}')); Object.assign(HAEBI_MOBS, JSON.parse(process.env['MOVR'] ?? '{}'))
for (const [k, v] of Object.entries(JSON.parse(process.env['STOVR'] ?? '{}'))) Object.assign((HAEBI_STAGES as any)[k], v)
const kit = (process.argv[2] ?? 'axe') as Kit, route = (process.argv[3] ?? 'storm') as Route, seed = Number(process.argv[4] ?? 7)
const until = Number(process.argv[5] ?? C.duration)
const s = createHaebi(seed, (process.env['MODE'] ?? 'stage') as 'stage', kit, { stage: (process.env['STAGE'] ?? 'forest') as 'forest', bonus: JSON.parse(process.env['BONUS'] ?? '{}') })
const seen = new Map<number, { hits: number; kind: string; max: number }>()
let minute = 1, hits = 0, dead = 0, oneShot = 0, hpSum = 0, lowest = s.hp, taken = 0, minTaken = 0
while (s.t < until && s.state === 'playing') {
  if (s.offers.length) { choose(s, botChoice(s, route)); continue }
  const before = new Map(s.enemies.map(e => [e.id, e.hp]))
  const hpBefore = s.hp
  stepHaebi(s, botInput(s, Number(process.env['REACT'] ?? 0)), 1 / 120)
  if (s.hp < hpBefore - 0.5) { taken += hpBefore - s.hp; minTaken += hpBefore - s.hp }
  lowest = Math.min(lowest, s.hp)
  const alive = new Set(s.enemies.map(e => e.id))
  for (const e of s.enemies) {
    if (!seen.has(e.id)) seen.set(e.id, { hits: 0, kind: e.kind, max: e.max })
    const b = before.get(e.id); if (b !== undefined && e.hp < b) seen.get(e.id)!.hits++
  }
  for (const id of before.keys()) if (!alive.has(id)) {
    const r = seen.get(id)!; if (r.kind === 'elite' || r.kind === 'boss') continue
    r.hits++; dead++; hits += r.hits; hpSum += r.max; if (r.hits === 1) oneShot++
    seen.delete(id)
  }
  if (s.t >= minute * 60) {
    console.log(`${String(minute).padStart(2)}분 · 잡졸 체력 ${Math.round(hpSum / Math.max(1, dead))} · 맞고 쓰러짐 ${(hits / Math.max(1, dead)).toFixed(2)}대 · 한 방 ${Math.round(oneShot / Math.max(1, dead) * 100)}% · 격파 ${dead} · Lv ${s.level} · 체력 ${Math.round(s.hp)} · 받은 피해 ${Math.round(minTaken)}`)
    minute++; hits = dead = oneShot = hpSum = minTaken = 0
  }
}
console.log(`끝 ${s.state} ${Math.round(s.t)}s · 격파 ${s.kills} · 받은 피해 ${Math.round(taken)} · 가장 낮은 체력 ${Math.round(lowest)} · 조합 ${s.combos.join(',')}`)
