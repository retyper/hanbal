// 판 안 각성 언제·몇 번 (11-17 · RAID-LINK §1) — 봇 판에서 각성 시각·조합 연 시각·분마다 격파
//   node --experimental-strip-types tools/raid-wake-probe.ts [kit axe] [seed 1] · SHOP=0 · AWAKE=0
import { createHaebi, choose, stepHaebi, isCombo, comboRank, type Kit } from '../src/raid/haebi.ts'
import { botChoice, botInput } from '../src/raid/haebi-replay.ts'
const kit = (process.argv[2] ?? 'axe') as Kit, seed = Number(process.argv[3] ?? 1)
const s = createHaebi(seed, 'stage', kit, { awaken: process.env['AWAKE'] !== '0' })
const log: string[] = []; let wakes = 0, minute = 1, kills = 0
const clock = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`
while (s.state === 'playing') {
  if (s.offers.length) { const k = botChoice(s, 'storm'); choose(s, k); if (isCombo(k)) log.push(`${clock(s.t)} 조합 ${k} ${comboRank(s, k)}`); continue }
  stepHaebi(s, botInput(s), 1 / 120)
  if (s.wakes > wakes) { wakes = s.wakes; log.push(`${clock(s.t)} 각성#${wakes}`) }
  if (s.t >= minute * 60) { log.push(`${minute}분 격파 ${s.kills - kills} 체력 ${Math.round(s.hp)} Lv${s.level}`); kills = s.kills; minute++ }
}
console.log(`${kit}/${seed} ${s.state} ${clock(s.t)}\n` + log.join('\n'))
