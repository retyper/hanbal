/**
 * 등용 목소리 목록 — 장수마다 등용 대사(src/realm/data/hire-lines.ts)와 목소리 결(src/ui/realm/voice.ts voiceKind)
 *   npx tsx tools/hire-voice-list.ts           → 결마다 몇 줄 · 소리 파일이 없는 장수 · 문서(HIRE-VOICE.md)의 결과 다른 장수
 *   npx tsx tools/hire-voice-list.ts --json    → [{ id, name, kind, cast, text }] (녹음 묶음 짤 때 · cast 는 castOf — 등용 첫마디도 그 성우진 목소리로 뽑는다)
 *   npx tsx tools/hire-voice-list.ts --write   → public/realm/voice/hire/lines.json (들어 보는 판 realm/voice-picker.html 이 읽는다)
 * 한 줄을 고치면: hire-lines.ts 를 고치고 → 이것으로 그 장수의 결을 보고 → 같은 결 목소리로 다시 뽑아
 * tools/split-voice.py 로 public/realm/voice/hire/<id>.ogg 에 굽고 → --write.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { REGION_IDS, regionNations, startRegion } from '../src/realm/data/regions/index.ts'
import { HERO_POOL } from '../src/realm/data/heroes-pool.ts'
import { HIRE_LINE } from '../src/realm/data/hire-lines.ts'
import { castOf, voiceKind } from '../src/ui/realm/voice.ts'
import type { Hero } from '../src/realm/types.ts'

const LABEL: Readonly<Record<string, string>> = {
  '젊은 무사': 'm-young', '거친 노장': 'm-gruff', '책사': 'm-sage', '늙은 장수': 'm-elder', '매혹 미남': 'm-charm',
  '당찬 여무사': 'w-bright', '의젓한 여장수': 'w-cool', '요염한 여인': 'w-sly', '무녀': 'w-shaman',
}
const HIRE_DIR = new URL('../public/realm/voice/hire/', import.meta.url)

const heroes = new Map<string, Hero>()
const rulers = new Set<string>()
for (const reg of REGION_IDS) {
  const r = startRegion(reg, 1, regionNations(reg)[0]!)
  for (const h of Object.values(r.heroes)) if (!heroes.has(h.id)) heroes.set(h.id, h)
  for (const f of Object.values(r.factions)) if (f.ruler !== undefined) rulers.add(f.ruler)
}
for (const h of HERO_POOL) if (!heroes.has(h.id)) heroes.set(h.id, h)

// 문서의 결 — 챗지피티가 다듬을 때 쓴 이름표 (코드와 다르면 코드가 맞다)
const docKind = new Map<string, string>()
const doc = readFileSync(new URL('../docs/realm/HIRE-VOICE.md', import.meta.url), 'utf8')
for (const m of doc.matchAll(/^\| .+? <small>(.+?)<\/small> \| (.+?) \|/gm)) docKind.set(m[1]!, LABEL[m[2]!] ?? '?')

const rows = Object.entries(HIRE_LINE).map(([id, text]) => {
  const h = heroes.get(id)
  return { id, name: h?.name ?? id, kind: h !== undefined ? voiceKind(h, rulers.has(id)) : '?', cast: h !== undefined ? castOf(h, rulers.has(id)) : '?', text }
})

if (process.argv.includes('--json')) console.log(JSON.stringify(rows, null, 1))
else if (process.argv.includes('--write')) {
  writeFileSync(new URL('lines.json', HIRE_DIR), JSON.stringify(rows) + '\n')
  console.log(`lines.json ${rows.length}줄`)
} else {
  const by = new Map<string, number>()
  for (const r of rows) by.set(r.kind, (by.get(r.kind) ?? 0) + 1)
  console.log(`줄 ${rows.length}`, Object.fromEntries(by))
  for (const r of rows) if (!heroes.has(r.id)) console.log(`  판에 없는 장수 ${r.id}`)
  for (const r of rows) if (!existsSync(new URL(`${r.id}.ogg`, HIRE_DIR))) console.log(`  소리 없음 ${r.id} ${r.name} (${r.kind})`)
  for (const r of rows) if (docKind.has(r.id) && docKind.get(r.id) !== r.kind) console.log(`  결이 다름 ${r.id} ${r.name}: 문서 ${docKind.get(r.id)} → 코드 ${r.kind}`)
}
