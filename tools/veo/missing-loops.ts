// 각성 그림은 있는데 숨 쉬는 영상(게임에 든 것 · 원장에 받아 둔 것)이 없는 장수 — 다음에 구울 차례 고르기
// npx tsx tools/veo/missing-loops.ts [원장 폴더]
import { existsSync, readFileSync } from 'node:fs'
import { AWAKEN_ART, AWAKEN_LOOP, AWAKEN2_LOOP } from '../../src/realm/data/awaken-art.ts'

const L = process.argv[2] ?? 'C:/Users/my/Documents/Codex/2026-11-06/windows-pc-claude-code-claude-code'
const st = JSON.parse(readFileSync(`${L}/outputs/veo-production-state.json`, 'utf8')) as { attempts: Array<{ heroId: string; tier: string; status: string }> }
const got = (id: string, tier: string): string | undefined => st.attempts.filter((a) => a.heroId === id && String(a.tier) === tier).map((a) => a.status).pop()

const t1: string[] = []
for (const id of [...AWAKEN_ART].sort()) {
  if (AWAKEN_LOOP.has(id)) continue
  const s = got(id, '1')
  const inGame = existsSync(`public/realm/awaken-loop/${id}.mp4`)
  t1.push(`${id}\t원장:${s ?? '-'}\t파일:${inGame ? '있음' : '-'}`)
}
const t2: string[] = []
for (const f of ['public/realm/awaken2-hd']) {
  if (!existsSync(f)) continue
}
console.log(`1차 각성 그림 ${AWAKEN_ART.size} · 영상 등록 ${AWAKEN_LOOP.size} · 등록 안 된 것 ${t1.length}`)
console.log(t1.join('\n'))
console.log(`\n2차 영상 등록 ${AWAKEN2_LOOP.size}`)
void t2
