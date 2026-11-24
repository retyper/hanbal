// 열전 거대 보스 「피해야 산다」 시험 (11-24 형 「보스 공격은 구태여 피할 필요도 없게 느껴짐」)
//   같은 판을 「안 피하는 봇」(기존 botInput) 과 「피하는 봇」(붉은 예고 안이면 밖으로 걷고 늦으면 구르기)으로 돌려
//   보스전(마지막 두목이 나온 뒤)의 승패 · 최저 체력 · 맞은 수 · 한 방 최대 몫 · 보스 닿은 피해 합을 견준다.
//   node --experimental-strip-types tools/raid-boss-hit.ts [stages forest,ford,palisade,snow,fortress] [kits axe,bow] [seeds 7,11]
//   MODE=nodge,dodge  SHOP=0(기본 · 형의 판처럼 상점 거의 없음)  REACT=.45(피하는 봇이 예고를 알아채는 초)  HIT=on|off(72-BOSSHIT 규칙)  HOVR='{"share":.3}' (HAEBI_BOSS_HIT 덮기)
import { HAEBI_SHOP, HAEBI_BOSS_HIT } from '../src/tune/params.ts'
import { createHaebi, choose, stepHaebi, runDuration, giantMob, type HaebiRun, type Kit, type Bonus, type StageId } from '../src/raid/haebi.ts'
import { botChoice, botInput } from '../src/raid/haebi-replay.ts'
import { stageToolOpts } from './raid-stage-balance.ts'
import { overlaps, type Shape } from '../src/raid/giant-core.ts'
import { fieldBounds } from '../src/raid/wide.ts'

type Gs = { state: string; timer: number; attack: { hit: boolean; shapes: readonly Shape[]; activeShapes?: readonly Shape[]; followShapes?: readonly Shape[] } | null }
const seen = new WeakMap<object, number>()
/** 피하는 봇: 붉은 예고(아직 안 맞은 공격의 모양) 안에 서 있으면 밖의 가장 가까운 자리로 걷는다 (react 초 뒤부터 · 끝나기 직전이면 구른다) */
export function dodgeInput(s: HaebiRun, react: number) {
  const base = botInput(s, react), e = giantMob(s); if (!e?.giant) return base
  const g = e.giant as unknown as Gs, a = g.attack
  if (!a || a.hit || (g.state !== 'tell' && g.state !== 'strike')) return base
  if (!seen.has(a)) seen.set(a, s.t)
  const shapes = [...a.shapes, ...(a.activeShapes ?? [])]
  const bad = (x: number, y: number) => shapes.some(sh => overlaps(sh, { kind: 'circle', center: { x, y }, radius: 24 }))
  if (!bad(s.x, s.y) || s.t - seen.get(a)! < react) return base
  const f = fieldBounds(s)
  for (const d of [80, 140, 210, 290, 380, 480]) {
    let best: { x: number; y: number } | null = null, bestTurn = 9
    for (let i = 0; i < 24; i++) {
      const ang = i / 24 * Math.PI * 2, x = s.x + Math.cos(ang) * d, y = s.y + Math.sin(ang) * d
      if (x < f.left + 30 || x > f.right - 30 || y < f.top + 30 || y > f.bottom - 30 || bad(x, y)) continue
      const turn = Math.abs(Math.atan2(Math.sin(ang - Math.atan2(base.y, base.x)), Math.cos(ang - Math.atan2(base.y, base.x))))
      if (turn < bestTurn) { bestTurn = turn; best = { x: Math.cos(ang), y: Math.sin(ang) } }
    }
    if (best) return { ...base, x: best.x, y: best.y, dash: s.dashCd === 0 && (g.state === 'strike' || g.timer < .45) }
  }
  return base
}

export function bossSample(stage: Exclude<StageId, 'trial'>, kit: Kit, seed: number, bonus: Partial<Bonus>, dodge: boolean, react: number, hit: boolean) {
  const opts = stageToolOpts(stage, bonus, undefined, false, true, true, true, true, true, true, true, true, true, true, true)
  if (hit) (opts as Record<string, unknown>)['bossHitRules'] = '72-BOSSHIT'
  const s = createHaebi(seed, 'stage', kit, opts), duration = runDuration(s)
  let prev = -1, inBoss = false, bossAt = -1, minHp = Infinity, hits: number[] = [], total = 0, maxHp = s.maxHp
  while (s.state === 'playing' && s.t < duration + 30) {
    if (s.offers.length) choose(s, botChoice(s, 'storm'))
    else stepHaebi(s, dodge ? dodgeInput(s, react) : botInput(s, react), 1 / 60)
    const boss = giantMob(s)
    if (boss && !inBoss && s.giantFlow?.finalSpawned) { inBoss = true; bossAt = s.t; prev = s.hp }
    if (inBoss) {
      const cur = s.hp, d = cur - prev; prev = cur; maxHp = s.maxHp
      if (d < -1.5) { hits.push(-d); total += -d }
      if (s.hp < minHp) minHp = s.hp
    }
  }
  return { state: s.state, t: s.t, bossAt, minHp: inBoss ? minHp : NaN, maxHp, hits, total, level: s.level, boss: inBoss }
}
function main() {
  Object.assign(HAEBI_BOSS_HIT, JSON.parse(process.env['HOVR'] ?? '{}'))
  const stages = (process.argv[2] ?? 'forest,ford,palisade,snow,fortress').split(',') as Exclude<StageId, 'trial'>[]
  const kits = (process.argv[3] ?? 'axe,bow').split(',') as Kit[], seeds = (process.argv[4] ?? '7,11').split(',').map(Number)
  const share = Number(process.env['SHOP'] ?? 0), react = Number(process.env['REACT'] ?? .45), hit = process.env['HIT'] !== 'off'
  const modes = (process.env['MODE'] ?? 'nodge,dodge').split(',')
  const bonus = Object.fromEntries(Object.entries(HAEBI_SHOP).filter(([k]) => k !== 'growth').map(([k, v]) => [k, Math.round((v as { max: number }).max * share)])) as Bonus
  for (const stage of stages) for (const mode of modes) {
    let n = 0, won = 0, reached = 0, hitsN = 0, worst = 0, minRatio = 9, sum = 0
    const rows: string[] = []
    for (const kit of kits) for (const seed of seeds) {
      const r = bossSample(stage, kit, seed, bonus, mode === 'dodge', react, hit); n++
      if (r.state === 'won') won++
      if (r.boss) { reached++; hitsN += r.hits.length; sum += r.total; worst = Math.max(worst, ...r.hits, 0) / 1; minRatio = Math.min(minRatio, r.minHp / r.maxHp) }
      rows.push(`${kit}/${seed}:${r.state === 'won' ? '승' : '패'}${r.boss ? `(최저${Math.round(r.minHp / r.maxHp * 100)}% 맞음${r.hits.length} 한방${Math.round(Math.max(0, ...r.hits) / r.maxHp * 100)}%)` : '(두목전 못 감)'}`)
    }
    console.log(`${stage.padEnd(8)} ${mode.padEnd(5)} 승 ${won}/${n} · 보스전 최저 체력 ${reached ? Math.round(minRatio * 100) + '%' : '-'} · 판당 맞은 수 ${reached ? (hitsN / reached).toFixed(1) : '-'} · 판당 맞은 피해 ${reached ? Math.round(sum / reached) : '-'} · ${rows.join(' ')}`)
  }
}
main()
