// 상자 보상 밸런스: 스테이지 × 묶음 × 씨앗 봇 판의 승률과 「상자가 올려 준 칸 수」를 잰다 (raid-stage-balance 의 stageSample 을 그대로 쓴다).
// CLI: [stages] [kits] [seeds]; JACKPOT=on|off (기본 on = 새 판의 잭팟 상자 · off = 옛 고르는 상자) MAP=wide|off (기본 wide = 새 판의 59-WIDE 넓은 맵 · off = 한 장짜리 옛 판) SHOP=.5 REACT=.5 OUTJSON=path
import { HAEBI_SHOP } from '../src/tune/params.ts'
import type { Bonus, HaebiRun, Kit, StageId } from '../src/raid/haebi.ts'
import { stageSample } from './raid-stage-balance.ts'
import { writeFileSync } from 'node:fs'

/** 상자가 올려 준 칸 수 — 새 판은 판이 센 잭팟 칸 + 중간 보스 상자에서 고른 하나, 옛 판은 주운 상자의 쓴 고름 수 */
export function chestRanks(s: HaebiRun) {
  if (s.jackpots) return s.jackpots.ranks + (s.chests ?? []).filter(c => c.boss && c.state === 'claimed').length
  return (s.chests ?? []).reduce((n, c) => n + (c.pickedAt === undefined ? 0 : (c.large ? 2 : 1) - c.choicesRemaining), 0)
}
function main() {
  const stages = (process.argv[2] ?? 'forest,ford,palisade,snow,fortress').split(',') as Exclude<StageId, 'trial'>[], kits = (process.argv[3] ?? 'axe,bow,spear,sword,dagger,magic,sling,whip').split(',') as Kit[], seeds = (process.argv[4] ?? '7,11,23').split(',').map(Number)
  const react = Number(process.env['REACT'] ?? .5), share = Number(process.env['SHOP'] ?? .5), jackpot = process.env['JACKPOT'] !== 'off', wide = process.env['MAP'] !== 'off'
  const bonus = Object.fromEntries(Object.entries(HAEBI_SHOP).filter(([k]) => k !== 'growth').map(([k, v]) => [k, Math.round((v as { max: number }).max * share)])) as Bonus
  const rows: { stage: string; kit: Kit; seed: number; won: boolean; time: number; chests: number; picked: number; ranks: number; level: number; tiers: number[] }[] = []
  for (const stage of stages) for (const kit of kits) for (const seed of seeds) {
    const { s, row } = stageSample({ stage, kit, seed, bonus, react, kits: true, jackpot, wide })
    const tiers = (s.chests ?? []).flatMap(c => c.jackpot ? [c.jackpot.count] : [])
    rows.push({ stage, kit, seed, won: row.won, time: row.time, chests: s.chests?.length ?? 0, picked: (s.chests ?? []).filter(c => c.pickedAt !== undefined).length, ranks: chestRanks(s), level: s.level, tiers })
  }
  const pct = (list: typeof rows) => `${list.filter(r => r.won).length}/${list.length} ${(list.filter(r => r.won).length / (list.length || 1) * 100).toFixed(1)}%`
  const mean = (list: typeof rows, f: (r: typeof rows[number]) => number) => (list.reduce((n, r) => n + f(r), 0) / (list.length || 1)).toFixed(2)
  const line = (name: string, list: typeof rows) => console.log(`${name.padEnd(9)} 승 ${pct(list).padEnd(13)} · 버틴 분 ${mean(list, r => r.time / 60)} · 주운 상자 ${mean(list, r => r.picked)} · 상자 칸 ${mean(list, r => r.ranks)} · 레벨 ${mean(list, r => r.level)}`)
  console.log(`상자 = ${jackpot ? '잭팟(새 판)' : '고르기(옛 판)'} · 맵 = ${wide ? '넓은 맵(새 판)' : '한 장(옛 판)'} · 상점 ${share} · 반응 ${react} · 씨앗 ${seeds.join(',')}`)
  for (const kit of kits) line(kit, rows.filter(r => r.kit === kit))
  for (const stage of stages) line(stage, rows.filter(r => r.stage === stage))
  line('모두', rows)
  const tierCount: Record<number, number> = {}
  for (const r of rows) for (const n of r.tiers) tierCount[n] = (tierCount[n] ?? 0) + 1
  if (Object.keys(tierCount).length) console.log(`상자 단계 · ${Object.entries(tierCount).map(([n, c]) => `${n}개 ${c}번`).join(' · ')} · 5개 넘게 터진 판 ${rows.filter(r => r.tiers.some(n => n >= 5)).length}/${rows.length}`)
  if (process.env['OUTJSON']) writeFileSync(process.env['OUTJSON'], `${JSON.stringify({ config: { stages, kits, seeds, react, shop: share, jackpot, wide }, rows }, null, 2)}\n`)
}
main()
