/**
 * 목소리 없는 장수 찾기 — 모든 판(지역 × 나라)의 장수와 떠돌이 장수를 모아, 누르면 나는 소리(대답·분부·맡김·기술·등용)의
 * 파일이 public/ 에 실제로 있나 본다 (형 11-09: "신지 고은 목소리 없음 · 목소리 없는 장수 목록").
 *
 *   node --experimental-strip-types tools/voice-missing.ts
 */
import { existsSync } from 'node:fs'
import { REGION_IDS, regionNations, startRegion } from '../src/realm/data/regions/index.ts'
import { HERO_POOL } from '../src/realm/data/heroes-pool.ts'
import { artVoicePath, autoVoicePath, hireVoicePath, voicePath } from '../src/ui/realm/voice.ts'
import { heroArt } from '../src/realm/heroes.ts'
import type { Hero } from '../src/realm/types.ts'

const heroes = new Map<string, { h: Hero; ruler: boolean }>()
for (const h of HERO_POOL) heroes.set(h.id, { h, ruler: false })
for (const reg of REGION_IDS) {
  for (const nat of regionNations(reg)) {
    const r = startRegion(reg, 1, nat)
    for (const f of Object.values(r.factions)) {
      for (const h of Object.values(r.heroes)) {
        const ruler = f.ruler === h.id
        if (!heroes.has(h.id) || ruler) heroes.set(h.id, { h, ruler: ruler || (heroes.get(h.id)?.ruler ?? false) })
      }
    }
  }
}

const has = (p: string): boolean => existsSync(`public/${p.replace(/#.*$/, '')}`)
const out: string[] = []
for (const { h, ruler } of [...heroes.values()].sort((a, b) => (a.h.id < b.h.id ? -1 : 1))) {
  const miss: string[] = []
  // 같은 줄을 여러 번 불러 돌려 가며 나오는 것까지 본다
  for (let i = 0; i < 6; i++) {
    for (const want of ['tap', 'obey'] as const) { const p = voicePath(h, want, ruler); if (!has(p)) miss.push(p) }
    const g = autoVoicePath(h, 'go', ruler); if (!has(g)) miss.push(g)
  }
  for (const w of ['win', 'lose'] as const) { const p = autoVoicePath(h, w, ruler); if (!has(p)) miss.push(p) }
  const art = heroArt(h)
  if (art !== null && art !== undefined) { const p = artVoicePath(h, art, ruler); if (!has(p)) miss.push(p) }
  const hire = hireVoicePath(h, ruler); if (!has(hire)) miss.push(hire)
  const uniq = [...new Set(miss)]
  if (uniq.length > 0) out.push(`${h.id}\t${h.name}\t${uniq.length}\t${uniq.slice(0, 4).join(' ')}`)
}
console.log(`장수 ${heroes.size}명 · 빠진 소리가 있는 장수 ${out.length}명`)
for (const l of out) console.log(l)
