/**
 * 옥중 담판 대사 보기 — 한 판을 화면에 뜨는 차례대로 찍는다 (대사를 고칠 때 · 챗지피티 교차 검증에 붙일 때).
 *   npx tsx tools/woo-talk-dump.ts <우리 장수 결> <갇힌 이 결> <거리,거리,거리> <반응,반응,반응> [fallen|alone|alive] [kin|blood|home]
 *   예: npx tsx tools/woo-talk-dump.ts m-young w-cool soothe,gain,cause sway,hold,big alone kin
 */
import { byeonhanMini } from '../src/realm/data/regions/byeonhan-mini.ts'
import type { Hero, Realm, WooApproach, WooReact } from '../src/realm/types.ts'
import type { BaseKind } from '../src/ui/realm/voice.ts'
import { WOO_KIND_PIN, wooKneelLine, wooLordLine, wooOpenLine, wooPitchLine, wooReactLine, wooWonLine } from '../src/ui/realm/woo-lines.ts'

const [byK, xK, talkS, reactS, sit = 'alive', tie = ''] = process.argv.slice(2) as [BaseKind, BaseKind, string, string, string?, string?]
const r: Realm = structuredClone(byeonhanMini(1))
const x = r.heroes['guya-2']!
x.status = 'captive'; x.captor = 'us'; x.at = null
for (const a of Object.values(r.armies)) if (a.hero === 'guya-2') a.hero = null
x.caughtAt = r.season - (sit === 'alone' ? 6 : 2)
if (sit === 'fallen') for (const n of Object.values(r.nodes)) if (n.owner === x.faction) n.owner = 'us'
const by = r.heroes['us-ruler']!
WOO_KIND_PIN.set(by.id, byK)
WOO_KIND_PIN.set(x.id, xK)
if (tie === 'kin') { const k = Object.values(r.heroes).find((h) => h.faction === 'us' && h.id !== by.id && h.status === 'free')!; x.spouse = k.id; k.spouse = x.id }
if (tie === 'home') { x.born = by.faction; x.faction = 'guya' }
const talk = talkS.split(',') as WooApproach[]
const reacts = reactS.split(',') as WooReact[]
const who = (h: Hero): string => h.name
const out: string[] = []
out.push(`${who(by)}(군주에게): ${wooLordLine(by)}`)
out.push(`${who(x)}: ${wooOpenLine(r, x, by.id)}`)
for (let i = 0; i < talk.length; i++) {
  out.push(`${who(by)}: ${wooPitchLine(r, by, x, talk, i, reacts)}`)
  const end = i === talk.length - 1 || reacts[i] === 'rage'
  out.push(`${who(x)}: ${wooReactLine(r, by, x, talk, i, reacts, !end)}`)
  if (reacts[i] === 'rage') break
}
if (!reacts.includes('rage')) { out.push(`${who(x)}: ${wooKneelLine(x)}`); out.push(`[${wooWonLine(r, by, x, talk, reacts)}]`) }
console.log(out.join('\n'))
