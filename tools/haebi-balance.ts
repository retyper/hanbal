import { replay, type Route } from '../src/raid/haebi-replay.ts'
const seed = Number(process.argv[2] || 7), route = (process.argv[3] || 'storm') as Route
const rows: object[] = []; let lastKills = 0
const start = performance.now()
const s = replay(seed, 600, route, s => { rows.push({ t: Math.round(s.t), hp: Math.round(s.hp), level: s.level, kills: s.kills, killsPerMinute: s.kills - lastKills, combos: [...s.combos], enemies: s.enemies.length }); lastKills = s.kills })
console.log(JSON.stringify({ seed, route, result: s.state, time: Math.round(s.t), hp: Math.round(s.hp), kills: s.kills, ranks: s.ranks, combos: s.combos, seconds: (performance.now() - start) / 1000, rows }, null, 2))
