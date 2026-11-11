// 등용 첫마디가 어떤 소리로 나는지 장수마다 센다 — 전용 성우 · 등용 녹음 · 짧은 대답(대신) · 파일 없음
// npx tsx tools/hire-voice-cover.ts [--list]
import { existsSync } from 'node:fs'
import { HERO_POOL } from '../src/realm/data/heroes-pool.ts'
import { HIRE_LINE } from '../src/realm/data/hire-lines.ts'
import { HIRE_LOW, HIRE_UNRECORDED } from '../src/ui/realm/voice.ts'
import { heroVoiceDir } from '../src/ui/realm/voice-hero.ts'

const ids = new Set<string>([...HERO_POOL.map((h) => h.id), ...Object.keys(HIRE_LINE)])
const bins: Record<string, string[]> = { own: [], ownMissing: [], hire: [], hireMissing: [], low: [], unrec: [], noLine: [] }
for (const id of ids) {
  const own = heroVoiceDir(id)
  if (own !== null) { (existsSync(`public/${own}hire.ogg`) ? bins.own : bins.ownMissing)!.push(id); continue }
  if (HIRE_LINE[id] === undefined) { bins.noLine!.push(id); continue }
  if (HIRE_UNRECORDED.has(id)) { bins.unrec!.push(id); continue }
  if (HIRE_LOW.has(id)) { bins.low!.push(id); continue }
  ;(existsSync(`public/realm/voice/hire/${id}.ogg`) ? bins.hire : bins.hireMissing)!.push(id)
}
console.log(`장수 ${ids.size}`)
for (const [k, v] of Object.entries(bins)) console.log(`${k} ${v.length}${process.argv.includes('--list') && k !== 'own' && k !== 'hire' ? `: ${v.join(' ')}` : ''}`)
