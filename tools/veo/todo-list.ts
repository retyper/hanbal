// 1차 각성 영상 할 일 (release-pack 과 같은 셈 · 여인 먼저) — npx tsx tools/veo/todo-list.ts [n]
import { existsSync, readFileSync } from 'node:fs'
import { AWAKEN_ART, AWAKEN_LOOP } from '../../src/realm/data/awaken-art.ts'
const L = process.env.VEO_LEDGER ?? 'C:/Users/my/Documents/Codex/2026-11-06/windows-pc-claude-code-claude-code'
const lines = JSON.parse(readFileSync('tools/veo/tier1-lines-20261115.json', 'utf8'))
const st = existsSync(`${L}/outputs/veo-production-state.json`) ? JSON.parse(readFileSync(`${L}/outputs/veo-production-state.json`, 'utf8')) : { attempts: [] }
const last = (id: string) => st.attempts.filter((a: any) => a.heroId === id && String(a.tier) === '1').pop()
const todo = [...AWAKEN_ART].sort().filter((id) => {
  if (AWAKEN_LOOP.has(id)) return false
  const s = last(id)?.status ?? 'todo'
  return s !== 'held' && s !== 'downloaded' && !existsSync(`public/realm/awaken-loop/${id}.mp4`) && lines[id]?.motion
}).sort((a, b) => (/^[wl]-/.test(a) ? 0 : 1) - (/^[wl]-/.test(b) ? 0 : 1) || a.localeCompare(b, 'en', { numeric: true }))
console.log(todo.length, todo.filter((i) => /^[wl]-/.test(i)).length + ' women')
console.log(todo.slice(0, Number(process.argv[2] ?? 12)).join('\n'))
