// 열전 · 무엇에 맞아 쓰러지나 (11-17 · 상점 없는 판의 이른 죽음) — 체력이 깎인 걸음마다 그 곁의 원인을 센다
//   node --experimental-strip-types tools/raid-hurt-probe.ts [kit bow] [seed 2] [until 240]
import { HAEBI_RUN as C, HAEBI_MOBS as M } from '../src/tune/params.ts'
import { createHaebi, choose, stepHaebi, type Kit } from '../src/raid/haebi.ts'
import { botChoice, botInput } from '../src/raid/haebi-replay.ts'
const kit = (process.argv[2] ?? 'bow') as Kit, seed = Number(process.argv[3] ?? 2), until = Number(process.argv[4] ?? 240)
Object.assign(C, JSON.parse(process.env['OVR'] ?? '{}'))
const s = createHaebi(seed, 'stage', kit, { awaken: true })
const by: Record<string, number> = {}
while (s.state === 'playing' && s.t < until) {
  if (s.offers.length) { choose(s, botChoice(s, 'storm')); continue }
  const hp = s.hp, x = s.x, y = s.y
  const cause = s.shots.find(b => (b.kind === 'barrage' || b.kind === 'stone') && b.life <= 1 / 120 + 1e-9 && Math.hypot(b.x - x, b.y - y) < b.radius + 4)?.kind
    ?? s.shots.find(b => (b.kind === 'enemy' || b.kind === 'hurl') && Math.hypot(b.x - x, b.y - y) < 26)?.kind
    ?? s.shots.find(b => b.kind === 'flame' && Math.hypot(b.x - x, b.y - y) < b.radius)?.kind
    ?? (s.enemies.some(e => e.wind > 0 && e.wind <= 1 / 120 + 1e-9) ? 'slam' : undefined)
    ?? s.enemies.filter(e => Math.hypot(e.x - x, e.y - y) < 30).map(e => 'touch:' + e.kind)[0] ?? '?'
  stepHaebi(s, botInput(s), 1 / 120)
  if (s.hp < hp - .5) by[cause] = (by[cause] ?? 0) + hp - s.hp
}
console.log(`${kit}/${seed} ${s.state} ${Math.round(s.t)}s Lv${s.level} 체력 ${Math.round(s.hp)} ·`, Object.entries(by).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${Math.round(v)}`).join(' · '))
void C; void M
