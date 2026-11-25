// 열전 무기 묶음별 승률 — 같은 봇(replay)으로 씨앗 여럿 (11-17 · 상점 없는 새 사람이 숲 산길을 깰 수 있나)
//   node --experimental-strip-types tools/raid-winrate.ts [kits axe,bow,...] [seeds 1-10] [stage forest] [route storm]
//   stage: forest · ford · palisade · snow · fortress (독립 열전 20분) · trial (본편 각성 시련 8분 · 11-18)
//   route: storm(예전 길) · deepA/deepB/deepC(한 갈래 몰빵) · spread(고르게) — 기술 나무 갈래 빌드 (RAID-LINK §2)
//   OVR='{"bowDamage":28}' (HAEBI_RUN) · MOVR (HAEBI_MOBS) · STOVR='{"forest":{"damage":.8}}' · AWOVR (HAEBI_AWAKEN) · TROVR (HAEBI_TREE) — params.ts 는 그대로 두고 재 본다
//   SHOP=0 (상점 없음) · SHOP=small (체력3·힘2·갑옷1) · SHOP=.5 (최대의 반) · AWAKE=0 (본편 각성 없음 → 영웅의 투지 · 보호막) · MASTER=1 (막대 절반으로 시작)
//   한 줄: 승 수 · 이긴 판의 두목 잡은 시각(두목이 나온 뒤 초) 평균 · 20분(또는 진 때) 레벨 평균 · 갈래 점수 평균 a/b/c · 씨앗마다
//   시련 판(trial)은 본편이 여는 꼴 그대로 잰다 (raid-main.ts newRun): 상점 강화와 판 안 각성이 안 붙는다(SHOP · AWAKE 는 안 먹는다 · MASTER 는 먹는다).
//   한 줄 끝에 이긴 판의 걸린 시간 평균과, 본편이 시련 통과로 받아 주는 시간 범위(haebi.trialWinValid) 안에 든 판 수가 붙는다.
//   tools/first-hour.ts 의 시련 보정(「이겼다 치고 8분」)이 얼마나 맞는 가정인지 이 줄로 본다
import { HAEBI_SHOP, HAEBI_RUN, HAEBI_MOBS, HAEBI_STAGES, HAEBI_AWAKEN, HAEBI_TREE } from '../src/tune/params.ts'
import { bossTime, branchPoints, choose, createHaebi, stepHaebi, trialWinValid, type Bonus, type HaebiRun, type Kit, type StageId } from '../src/raid/haebi.ts'
import { botChoice, botInput, replay, type Route } from '../src/raid/haebi-replay.ts'
Object.assign(HAEBI_RUN, JSON.parse(process.env['OVR'] ?? '{}')); Object.assign(HAEBI_MOBS, JSON.parse(process.env['MOVR'] ?? '{}'))
Object.assign(HAEBI_AWAKEN, JSON.parse(process.env['AWOVR'] ?? '{}')); Object.assign(HAEBI_TREE, JSON.parse(process.env['TROVR'] ?? '{}'))
for (const [k, v] of Object.entries(JSON.parse(process.env['STOVR'] ?? '{}'))) Object.assign((HAEBI_STAGES as Record<string, object>)[k]!, v)
const kits = (process.argv[2] ?? 'axe,bow,spear,sword,dagger,magic,sling,whip').split(',') as Kit[]
const range = process.argv[3] ?? '1-10'
const seeds = range.includes('-') ? (([a, b]) => Array.from({ length: b! - a! + 1 }, (_, i) => a! + i))(range.split('-').map(Number)) : range.split(',').map(Number)
const stage = (process.argv[4] ?? 'forest') as StageId
const trial = stage === 'trial'
const route = (process.argv[5] ?? 'storm') as Route
const shop = process.env['SHOP'] ?? '0'
const bonus: Partial<Bonus> = shop === 'small' ? { vigor: 3, might: 2, armor: 1 } : Object.fromEntries(Object.entries(HAEBI_SHOP).filter(([k]) => k !== 'growth').map(([k, v]) => [k, Math.round((v as { max: number }).max * Number(shop))]))
const awake = process.env['AWAKE'] !== '0', mastery = process.env['MASTER'] === '1'
/** 한 판 — 스테이지는 replay 그대로. 시련은 replay 가 판 종류를 stage 로만 만들어서 같은 봇(botChoice · botInput)과 같은 걸음(1/120초)으로 여기서 돌린다 */
function run(seed: number, kit: Kit): HaebiRun {
  if (!trial) return replay(seed, Infinity, route, undefined, kit, { stage, bonus, awaken: awake, mastery } as Parameters<typeof replay>[5])
  const s = createHaebi(seed, 'trial', kit, { awaken: false, mastery })
  while (s.state === 'playing') {
    if (s.offers.length) choose(s, botChoice(s, route))
    else stepHaebi(s, botInput(s), 1 / 120)
  }
  return s
}
if (trial) console.log(`각성 시련 판 · 길이 ${HAEBI_RUN.duration * HAEBI_STAGES.trial.length}초 · 두목 ${HAEBI_RUN.bossAt * HAEBI_STAGES.trial.length}초에 나옴 · 상점 강화와 판 안 각성 없음${mastery ? ' · 숙련(막대 절반)' : ''}`)
for (const kit of kits) {
  const rows: string[] = []; let won = 0, clear = 0, level = 0, took = 0, valid = 0
  const pts = { a: 0, b: 0, c: 0 }
  for (const seed of seeds) {
    const s = run(seed, kit)
    if (s.state === 'won') { won++; clear += s.t - bossTime(s); took += s.t; if (trialWinValid(s.t)) valid++ }
    level += s.level; for (const b of ['a', 'b', 'c'] as const) pts[b] += branchPoints(s, b)
    rows.push(`${seed}:${s.state === 'won' ? '승' : `패${Math.floor(s.t / 60)}분`}`)
  }
  const n = seeds.length
  const trialNote = trial ? ` · 걸린 시간 ${won ? Math.round(took / won) + '초' : '-'}(본편이 받는 범위 안 ${valid}/${won})` : ''
  console.log(`${kit.padEnd(6)} ${route.padEnd(6)} ${won}/${n} · 두목 ${won ? Math.round(clear / won) + '초' : '-'} · Lv ${(level / n).toFixed(1)} · 갈래 ${(pts.a / n).toFixed(0)}/${(pts.b / n).toFixed(0)}/${(pts.c / n).toFixed(0)}${trialNote} · ${rows.join(' ')}`)
}
