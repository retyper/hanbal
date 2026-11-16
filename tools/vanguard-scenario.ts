import { startTutorial } from '../src/realm/data/regions/tutorial.ts'
import { awardAwakening } from '../src/realm/heroes.ts'
import type { Order } from '../src/realm/types.ts'
/** Isolated scenario only; the battle, rewards and season settlement are production code. */
export function vanguardScenario() {
  const realm = startTutorial(777), h = realm.heroes['tut-haebi']!
  h.faction = realm.player; h.status = 'free'; h.at = null; h.trialCleared = true
  awardAwakening(h, [])
  h.flames = 0 // Independent of the limited elemental awakening skill.
  realm.armies['a-us']!.hero = h.id
  realm.armies['a-guya']!.hero = 'tut-biryu'
  realm.armies['a-guya']!.mix = { spear: 700, shield: 300, bow: 450 }
  realm.armies['a-guya']!.kit = { spear: { bronze: 700 }, shield: { bronze: 300 }, bow: { bronze: 450 } }
  const orders: Order[] = [{ kind: 'march', army: 'a-us', edge: 't01', ambush: false }]
  return { realm, orders }
}
