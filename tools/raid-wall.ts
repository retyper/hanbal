// 벽 셋 구석 꼼수 시험 (11-25 · journey-study 카드 0) — 장수를 땅 구석에 세워 가만히 두고, 설치물 셋을 둘레 R 에 0°·45°·90° 로 손으로 둘러 5분을 본다
//   형 11-25 「건물들은 다 부서져야 · 막혀서 적이 공격 못 하는 꼼수」 — 벽이 장수를 감싸면 맞는 횟수가 얼마나 줄어드나
//   node --experimental-strip-types tools/raid-wall.ts [stage forest] [kits axe,bow,dagger] [seeds 7,11,13]
//   환경: MIN=5 · WALL=off (옛 판) · GAP=off (78-GAP 틈 규칙 끄기) · FIRM=off (79-FIRM 단단한 설치물 끄기 = 78-GAP 판) · FIX=1 (장수가 다시 세우기를 늘 누르고 있다) · GAPPX=90 (틈 값 시험 · stageToolOpts 가 읽는다) · HPSCALE=1 (체력 배수 시험) · KIND=beacon (벽 종류: jar·sotdae·beacon·well·fence·tower·totem·catapult · none 이면 벽 없음) · R=60 (둘레 px) · SHOP=0 · 
//   한 줄: 맞은 수/판 · 판 최저 체력 · 처치 · 끝에 서 있는 벽 · 비교 한 줄(벽 없음 대비 %)
import { HAEBI_SHOP, HAEBI_BREAKABLE, HAEBI_GAP } from '../src/tune/params.ts'
import { createHaebi, choose, stepHaebi, type Kit, type StageId, type Bonus } from '../src/raid/haebi.ts'
import { botChoice } from '../src/raid/haebi-replay.ts'
import { buildHp, standing, hasHp, type BuildKind } from '../src/raid/build.ts'
import { fieldBounds } from '../src/raid/wide.ts'
import { stageToolOpts } from './raid-stage-balance.ts'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

export interface WallResult { hits: number; low: number; kills: number; standing: number; dead: boolean }
/** kind === 'none' 이면 벽 없이 구석에만 세운다 · rank 는 벽 종류의 설치 단계 (셋 다 같은 종류) */
export function wallRun(stage: StageId, kit: Kit, seed: number, minutes: number, share: number, kind: BuildKind | 'none', radius: number, rank = 3, opt?: { onStep?: (s: ReturnType<typeof createHaebi>) => void }): WallResult {
  const bonus = Object.fromEntries(Object.entries(HAEBI_SHOP).filter(([k]) => k !== 'growth').map(([k, v]) => [k, Math.round((v as { max: number }).max * share)])) as Bonus
  const s = createHaebi(seed, 'stage', kit, { ...stageToolOpts(stage, bonus, undefined, false, true, true, true, true, true, true, true, true, true, true, true) })
  const f = fieldBounds(s)
  s.x = f.left + 32; s.y = f.top + 65
  if (kind !== 'none') {
    s.ranks[kind] = rank
    for (const deg of [0, 45, 90]) {
      const a = deg * Math.PI / 180, wall = !!s.build!.wall, max = buildHp(kind, rank, wall)
      s.build!.items.push({ id: s.build!.nextId++, kind, x: s.x + Math.cos(a) * radius, y: s.y + Math.sin(a) * radius, hp: max, max, down: 0, cd: 0, flash: 0, push: 0, ...(wall && !hasHp(kind) ? { w: true as const } : {}) })
    }
  }
  let low = 1, hits = 0, prev = 0
  while (s.state === 'playing' && s.t < minutes * 60) {
    if (s.offers.length) choose(s, botChoice(s, 'storm'))
    else { stepHaebi(s, { x: 0, y: 0, ...(process.env['FIX'] === '1' ? { fix: true } : {}) }, 1 / 60); opt?.onStep?.(s) }
    low = Math.min(low, Math.max(0, s.hp) / s.maxHp)
    if (s.hurt > 0 && prev <= 0) hits++
    prev = s.hurt
  }
  return { hits, low, kills: s.kills, standing: s.build!.items.filter(it => standing(it)).length, dead: s.state === 'lost' || s.hp <= 0 }
}
function main() {
  const stage = (process.argv[2] ?? 'forest') as StageId, kits = (process.argv[3] ?? process.env['KITS'] ?? 'axe,bow,dagger').split(',') as Kit[], seeds = (process.argv[4] ?? process.env['SEEDS'] ?? '7,11,13').split(',').map(Number)
  const hpScale = Number(process.env['HPSCALE'] ?? 1)   // 75-WALL 체력을 몇 배로 시험할지 (값 잡기 전용 · 판 규칙 아님)
  if (hpScale !== 1) for (const tbl of [HAEBI_BREAKABLE.hp, HAEBI_BREAKABLE.hpStep] as Record<string, number>[]) for (const k of Object.keys(tbl)) tbl[k] = tbl[k]! * hpScale
  const minutes = Number(process.env['MIN'] ?? 5), share = Number(process.env['SHOP'] ?? 0), kind = (process.env['KIND'] ?? 'beacon') as BuildKind | 'none', radius = Number(process.env['R'] ?? 60)
  const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length
  const run = (k: BuildKind | 'none') => kits.flatMap(kit => seeds.map(seed => wallRun(stage, kit, seed, minutes, share, k, radius)))
  const bare = run('none'), walled = kind === 'none' ? bare : run(kind)
  const line = (name: string, r: WallResult[]) => `${name} · 맞은 수 ${mean(r.map(x => x.hits)).toFixed(2)}/판 · 최저 체력 ${Math.round(mean(r.map(x => x.low)) * 100)}% · 처치 ${Math.round(mean(r.map(x => x.kills)))} · 죽음 ${r.filter(x => x.dead).length}/${r.length} · 끝에 선 벽 ${mean(r.map(x => x.standing)).toFixed(1)}`
  console.log(`${stage} ${minutes}분 상점 ${share} R${radius} ${process.env['WALL'] === 'off' ? '옛 판(WALL=off)' : '75-WALL'} ${process.env['FIRM'] === 'off' ? process.env['GAP'] === 'off' ? '틈 없음(GAP=off)' : `78-GAP 틈 ${HAEBI_GAP.gap}` : `79-FIRM 다시 세우기 ${process.env['FIX'] === '1' ? '늘 누름' : '안 누름'}`} HPSCALE ${hpScale}`)
  console.log('  ' + line('벽 없음', bare))
  console.log('  ' + line(`벽 셋 ${kind}`, walled))
  const b = mean(bare.map(x => x.hits)), w = mean(walled.map(x => x.hits))
  console.log(`  맞은 수 비율(벽 셋 ÷ 벽 없음) ${b ? Math.round(w / b * 100) : 0}%  (합격선: 70% 이상)`)
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
