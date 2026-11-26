/**
 * 전장 실험실의 판 짜임 하나를 봇 셋으로 여러 판 (docs/realm/battle-study/56-lab.md §2) — 사람 기록 곁에 둘 「이 판은 가만히 두면 몇 %」.
 *
 *   node --experimental-strip-types tools/field-lab.ts <판 짜임.json> [판 수 50]
 *
 * 판 짜임은 lab.html 의 기록(cfg) 그대로 · 빠진 칸은 LAB_DEFAULT. 씨앗은 cfg.seed 부터 판 수만큼 (적 사람 수가 씨앗으로 ± spread).
 * 봇: 가만히(아무 명령 없음) · 뒤로 돌아 치기(위 날개가 적 활의 처음 깊이 바깥 길(판 위 끝 3칸)로 간 뒤 맨 위 적 활을 친다) · 정면 돌격(위 날개가 처음에 맨 위 적 앞줄을 곧게 친다).
 */
import { readFileSync } from 'node:fs'
import { LAB_DEFAULT, labSetup, type LabConfig } from '../src/field/scenario.ts'
import { createField, members, stepField } from '../src/field/sim.ts'
import { P } from '../src/tune/params.ts'
import { OP_ATTACK, OP_MOVE, type FieldInput } from '../src/field/types.ts'

const file = process.argv[2]
if (file === undefined) { console.error('쓰는 법: node --experimental-strip-types tools/field-lab.ts <판 짜임.json> [판 수]'); process.exit(1) }
const raw = JSON.parse(readFileSync(file, 'utf8')) as Partial<LabConfig> & { cfg?: Partial<LabConfig> }
const cfg: LabConfig = { ...LAB_DEFAULT, ...(raw.cfg ?? raw) }
const n = Math.max(1, Number(process.argv[3] ?? 50))
const U = P.field.unit

type Bot = 'idle' | 'rear' | 'front'
function play(seed: number, bot: Bot): { win: number; sec: number; hit: boolean; kills: number; lost: number } {
  const s = createField(labSetup(cfg, seed))
  const wing = members(s, 0, 2), ids = new Set(wing.map(q => q.id)), men0 = wing.reduce((a, q) => a + q.men, 0)
  const byV = (grp: string) => s.squads.filter(q => q.side === 1 && q.grp === grp).sort((a, b) => a.v - b.v)
  const bow = byV('bows')[0], front = byV('front')[0]
  const lane = bow === undefined ? null : { u: bow.u, v: 3 * U }
  let stage = 0, hit = false, kills = 0
  while (s.end === null) {
    const inp: FieldInput[] = []
    if (bot === 'front' && s.tick === 0 && front !== undefined) inp.push({ tick: 0, g: 2, op: OP_ATTACK, u: front.id, v: 0 })
    if (bot === 'rear' && lane !== null && bow !== undefined) {
      if (stage === 0) { inp.push({ tick: s.tick, g: 2, op: OP_MOVE, u: lane.u, v: lane.v }); stage = 1 }
      else if (stage === 1) {
        const w = wing.filter(q => q.men > 0)
        const cu = w.reduce((a, q) => a + q.u, 0) / Math.max(1, w.length), cv = w.reduce((a, q) => a + q.v, 0) / Math.max(1, w.length)
        if ((cu - lane.u) ** 2 + (cv - lane.v) ** 2 <= (P.field.arriveCells * U) ** 2 && bow.men > 0 && bow.flee === 0) { inp.push({ tick: s.tick, g: 2, op: OP_ATTACK, u: bow.id, v: 0 }); stage = 2 }
      }
    }
    stepField(s, inp)
    for (const e of s.log.events) {
      if (e.tick !== s.tick - 1) continue
      if (e.kind === 'loss' && e.id >= 0 && ids.has(e.id)) kills += e.n
      if (e.kind === 'flankHit' && ids.has(e.id)) hit = true
    }
  }
  return { win: s.winner, sec: s.tick / P.field.hz, hit, kills, lost: men0 - wing.reduce((a, q) => a + q.men, 0) }
}

const NAME: Record<Bot, string> = { idle: '가만히', rear: '뒤로 돌아 치기', front: '정면 돌격' }
const pct = (a: number, b: number): string => `${Math.round(100 * a / Math.max(1, b))}%`
console.log(`판 짜임: 땅 ${cfg.map} · 적의 꾀 ${cfg.tricks ? '씀' : '안 씀'} · 적 수 흔들림 ±${cfg.spread}‰ · 씨앗 ${cfg.seed}~${cfg.seed + n - 1} · ${n}판`)
for (const bot of ['idle', 'rear', 'front'] as const) {
  let w = 0, d = 0, sec = 0, hits = 0, k = 0, l = 0
  for (let i = 0; i < n; i++) { const r = play(cfg.seed + i, bot); if (r.win === 0) w++; else if (r.win === -1) d++; sec += r.sec; if (r.hit) hits++; k += r.kills; l += r.lost }
  const extra = bot === 'rear' ? ` · 옆·뒤로 닿음 ${hits}/${n}` : bot === 'front' ? ` · 위 날개 판당 쓰러뜨림 ${(k / n).toFixed(0)} 잃음 ${(l / n).toFixed(0)}` : ''
  console.log(`${NAME[bot]}: 이김 ${pct(w, n)} · 비김 ${pct(d, n)} · 평균 ${Math.round(sec / n)}초${extra}`)
}
