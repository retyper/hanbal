// 열전 무기 묶음별 승률 — 같은 봇(replay · 'storm' 길)으로 씨앗 여럿 (11-17 · 상점 없는 새 사람이 숲 산길을 깰 수 있나)
//   node --experimental-strip-types tools/raid-winrate.ts [kits axe,bow,...] [seeds 1-10] [stage forest]
//   OVR='{"bowDamage":28}' (HAEBI_RUN) · MOVR (HAEBI_MOBS) · STOVR='{"forest":{"damage":.8}}' · AWOVR (HAEBI_AWAKEN) · TROVR (HAEBI_TREE) — params.ts 는 그대로 두고 재 본다
//   SHOP=0 (상점 없음) · SHOP=small (체력3·힘2·갑옷1) · SHOP=.5 (최대의 반) · AWAKE=0 (본편 각성 없음 → 투지) · MASTER=1 (막대 절반으로 시작)
import { HAEBI_SHOP, HAEBI_RUN, HAEBI_MOBS, HAEBI_STAGES, HAEBI_AWAKEN, HAEBI_TREE } from '../src/tune/params.ts'
import { type Kit, type Bonus, type StageId } from '../src/raid/haebi.ts'
import { replay } from '../src/raid/haebi-replay.ts'
Object.assign(HAEBI_RUN, JSON.parse(process.env['OVR'] ?? '{}')); Object.assign(HAEBI_MOBS, JSON.parse(process.env['MOVR'] ?? '{}'))
Object.assign(HAEBI_AWAKEN, JSON.parse(process.env['AWOVR'] ?? '{}')); Object.assign(HAEBI_TREE, JSON.parse(process.env['TROVR'] ?? '{}'))
for (const [k, v] of Object.entries(JSON.parse(process.env['STOVR'] ?? '{}'))) Object.assign((HAEBI_STAGES as Record<string, object>)[k]!, v)
const kits = (process.argv[2] ?? 'axe,bow,spear,sword,dagger,magic,sling').split(',') as Kit[]
const range = process.argv[3] ?? '1-10'
const seeds = range.includes('-') ? (([a, b]) => Array.from({ length: b! - a! + 1 }, (_, i) => a! + i))(range.split('-').map(Number)) : range.split(',').map(Number)
const stage = (process.argv[4] ?? 'forest') as Exclude<StageId, 'trial'>
const shop = process.env['SHOP'] ?? '0'
const bonus: Partial<Bonus> = shop === 'small' ? { vigor: 3, might: 2, armor: 1 } : Object.fromEntries(Object.entries(HAEBI_SHOP).filter(([k]) => k !== 'growth').map(([k, v]) => [k, Math.round((v as { max: number }).max * Number(shop))]))
const awake = process.env['AWAKE'] !== '0', mastery = process.env['MASTER'] === '1'
for (const kit of kits) {
  const rows: string[] = []; let won = 0
  for (const seed of seeds) {
    const s = replay(seed, Infinity, 'storm', undefined, kit, { stage, bonus, awaken: awake, mastery } as Parameters<typeof replay>[5])
    if (s.state === 'won') won++
    rows.push(`${seed}:${s.state === 'won' ? '승' : `패${Math.floor(s.t / 60)}분`}`)
  }
  console.log(`${kit.padEnd(6)} ${won}/${seeds.length} · ${rows.join(' ')}`)
}
