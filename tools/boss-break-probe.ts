/**
 * 거대 보스 부위 파괴 재기 (docs/realm/RAID-BOSS-SIEGE-20261123.md §2 · 64-BREAK) — 봇으로 스테이지를 끝까지 돌려
 * 보스가 나온 뒤 부위가 처음 깨질 때 보스 체력이 몇 % 남았나 · 죽기 전에 몇 부위가 깨졌나를 적는다.
 *   node --experimental-strip-types tools/boss-break-probe.ts [스테이지들] [무기들] [씨앗들]   (BREAK=off 면 옛 셈 · SHOP=.5 상점 몫)
 */
import { HAEBI_SHOP } from '../src/tune/params.ts'
import { createHaebi, choose, stepHaebi, type HaebiRun, type Kit } from '../src/raid/haebi.ts'
import { botChoice, botInput } from '../src/raid/haebi-replay.ts'
import { stageToolOpts } from './raid-stage-balance.ts'
import type { StageId } from '../src/raid/haebi.ts'

const stages = (process.argv[2] ?? 'forest,ford,palisade,snow,fortress').split(',') as Exclude<StageId, 'trial'>[]
const kits = (process.argv[3] ?? 'axe,bow,spear').split(',') as Kit[]
const seeds = (process.argv[4] ?? '7,11').split(',').map(Number)
const share = Number(process.env['SHOP'] ?? .5)
const bonus = Object.fromEntries(Object.entries(HAEBI_SHOP).filter(([k]) => k !== 'growth').map(([k, v]) => [k, Math.round((v as { max: number }).max * share)]))

for (const stage of stages) {
  const rows: string[] = []
  for (const kit of kits) for (const seed of seeds) {
    const s: HaebiRun = createHaebi(seed, 'stage', kit, stageToolOpts(stage, bonus, undefined, false, true, true, true, true))
    let first: number | null = null, breaks = 0, seenBoss = false, bossDead = false
    const known = new Set<string>()
    for (let i = 0; i < 1300 * 120 && s.state === 'playing'; i++) {
      if (s.offers.length) { choose(s, botChoice(s, 'storm')); continue }
      stepHaebi(s, botInput(s), 1 / 120)
      const boss = s.giantFlow?.finalOwner
      if (!boss?.giant) continue
      seenBoss = true
      const hp = boss.giant.partHP as Record<string, number>
      for (const [k, v] of Object.entries(hp)) if (v <= 0 && !known.has(k)) { known.add(k); breaks++; if (first === null) first = boss.hp / boss.max }
      if (boss.hp <= 0) bossDead = true
    }
    rows.push(`${kit}/${seed} ${s.state === 'won' ? '승' : '패'} 보스${seenBoss ? '' : '없음'} 첫부위 ${first === null ? '-' : Math.round(first * 100) + '%'} 깨짐 ${breaks}${bossDead ? '' : ' (안 죽음)'}`)
  }
  console.log(`${stage.padEnd(9)} ${rows.join(' · ')}`)
}
