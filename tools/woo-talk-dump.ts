/**
 * 옥중 담판 대사 보기 — 한 판을 화면에 뜨는 차례대로 찍는다 (대사를 고칠 때 · 챗지피티 교차 검증에 붙일 때).
 *   npx tsx tools/woo-talk-dump.ts <회유하는 이> <갇힌 이> <거리,거리,거리> <반응,반응,반응> [fallen|alone|alive] [kin|blood|home]
 * 회유하는 이 · 갇힌 이는 장수 id(사람마다 묶음이 있으면 그것으로 · 두 사람이 다 있는 첫 판에서) 또는 결 이름(변한 판 us-ruler · guya-2 에 결을 박는다).
 *   예: npx tsx tools/woo-talk-dump.ts us-ruler guya-ruler soothe,cause,gain sway,hold,big fallen
 *   예: npx tsx tools/woo-talk-dump.ts m-young w-cool soothe,gain,cause sway,hold,big alone kin
 */
import { REGION_IDS, regionNations, startRegion } from '../src/realm/data/regions/index.ts'
import type { Realm, WooApproach, WooReact } from '../src/realm/types.ts'
import type { BaseKind } from '../src/ui/realm/voice.ts'
import { WOO_KIND_PIN, wooKneelLine, wooLordLine, wooNotYetLine, wooOpenLine, wooPitchLine, wooReactLine, wooWonLine } from '../src/ui/realm/woo-lines.ts'

const KINDS = new Set(['m-young', 'm-gruff', 'm-sage', 'm-elder', 'm-charm', 'w-bright', 'w-cool', 'w-sly', 'w-shaman'])

/** 두 사람이 다 있는 판 */
function boardWith(a: string, b: string): Realm {
  for (const reg of REGION_IDS) {
    const r = startRegion(reg, 1, regionNations(reg)[0]!)
    if (r.heroes[a] !== undefined && r.heroes[b] !== undefined) return r
  }
  throw new Error(`${a} · ${b} 가 함께 있는 판이 없다`)
}

/** 한 판을 찍는다 — 말한 사람 이름: 말 */
export function dumpTalk(byArg: string, xArg: string, talk: readonly WooApproach[], reacts: readonly WooReact[], sit = 'alive', tie = ''): string[] {
  const pinned = KINDS.has(byArg) || KINDS.has(xArg)
  const byId = KINDS.has(byArg) ? 'us-ruler' : byArg
  const xId = KINDS.has(xArg) ? 'guya-2' : xArg
  const r: Realm = boardWith(byId, xId)
  const by = r.heroes[byId]!
  const x = r.heroes[xId]!
  if (x.faction === by.faction) x.faction = Object.keys(r.factions).find((f) => f !== by.faction)!
  x.status = 'captive'; x.captor = by.faction; x.at = null
  for (const a of Object.values(r.armies)) if (a.hero === x.id) a.hero = null
  x.caughtAt = r.season - (sit === 'alone' ? 6 : 2)
  if (sit === 'fallen') for (const n of Object.values(r.nodes)) if (n.owner === x.faction) n.owner = by.faction
  WOO_KIND_PIN.clear()
  if (pinned) { if (KINDS.has(byArg)) WOO_KIND_PIN.set(by.id, byArg as BaseKind); if (KINDS.has(xArg)) WOO_KIND_PIN.set(x.id, xArg as BaseKind) }
  if (tie === 'kin') { const k = Object.values(r.heroes).find((h) => h.faction === by.faction && h.id !== by.id && h.status === 'free')!; x.spouse = k.id; k.spouse = x.id }
  if (tie === 'home') x.born = by.faction
  const out: string[] = []
  out.push(`${by.name}(군주에게): ${wooLordLine(by, r)}`)
  out.push(`${x.name}: ${wooOpenLine(r, x, by.id)}`)
  for (let i = 0; i < talk.length; i++) {
    out.push(`${by.name}: ${wooPitchLine(r, by, x, talk, i, reacts)}`)
    out.push(`${x.name}: ${wooReactLine(r, by, x, talk, i, reacts)}`)
    if (reacts[i] === 'rage') break
  }
  if (!reacts.includes('rage')) {
    out.push(`${x.name}: ${wooKneelLine(r, by, x, talk, reacts)}`)
    out.push(`[${wooWonLine(r, by, x, talk, reacts)}]`)
    out.push(`(손을 뿌리치면) ${x.name}: ${wooNotYetLine(r, x)}`)
  }
  WOO_KIND_PIN.clear()
  return out
}

if (process.argv[1]?.endsWith('woo-talk-dump.ts')) {
  const [byA, xA, talkS, reactS, sit = 'alive', tie = ''] = process.argv.slice(2) as [string, string, string, string, string?, string?]
  console.log(dumpTalk(byA, xA, talkS.split(',') as WooApproach[], reactS.split(',') as WooReact[], sit, tie).join('\n'))
}
