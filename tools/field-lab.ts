/**
 * 전장 실험실의 판 짜임 하나를 봇 셋으로 여러 판 (docs/realm/battle-study/56-lab.md §2) — 사람 기록 곁에 둘 「이 판은 가만히 두면 몇 %」.
 *
 *   node --experimental-strip-types tools/field-lab.ts <판 짜임.json> [판 수 40]
 *
 * 판 짜임은 lab.html 의 기록(cfg) 그대로 · 빠진 칸은 LAB_DEFAULT(시험판과 같은 판). 씨앗은 cfg.seed 부터 판 수만큼.
 * 봇은 src/field/labbots.ts (실험실 화면의 「이 판의 봇 기준」과 같은 것).
 */
import { readFileSync } from 'node:fs'
import { LAB_DEFAULT, type LabConfig } from '../src/field/scenario.ts'
import { addRun, emptySum, labBot, LAB_BOTS, type LabBot } from '../src/field/labbots.ts'

const file = process.argv[2]
if (file === undefined) { console.error('쓰는 법: node --experimental-strip-types tools/field-lab.ts <판 짜임.json> [판 수]'); process.exit(1) }
const raw = JSON.parse(readFileSync(file, 'utf8')) as Partial<LabConfig> & { cfg?: Partial<LabConfig> }
const cfg: LabConfig = { ...LAB_DEFAULT, ...(raw.cfg ?? raw) }
const n = Math.max(1, Number(process.argv[3] ?? 40))
const NAME: Record<LabBot, string> = { idle: '가만히', rear: '뒤로 돌아 치기', front: '정면 돌격' }
const pct = (a: number, b: number): string => `${Math.round(100 * a / Math.max(1, b))}%`
console.log(`판 짜임: 땅 ${cfg.map} · 적 사람 ${cfg.foe}‰ ± ${cfg.spread}‰ · 적의 꾀 ${cfg.tricks ? '씀' : '안 씀'} · 씨앗 ${cfg.seed}~${cfg.seed + n - 1} · ${n}판`)
for (const bot of LAB_BOTS) {
  const a = emptySum()
  for (let i = 0; i < n; i++) addRun(a, labBot(cfg, cfg.seed + i, bot))
  const extra = bot === 'rear' ? ` · 옆·뒤로 닿음 ${a.hits}/${n}` : bot === 'front' ? ` · 위 날개 판당 쓰러뜨림 ${Math.round(a.kills / n)} 잃음 ${Math.round(a.lost / n)}` : ''
  console.log(`${NAME[bot]}: 이김 ${pct(a.wins, n)} · 비김 ${pct(a.draws, n)} · 평균 ${Math.round(a.sec / n)}초${extra}`)
}
