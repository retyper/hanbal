import { mountRealmApp } from '../src/ui/realm/app.ts'
import { startTutorial } from '../src/realm/data/regions/tutorial.ts'
import { battleGrowth, ascendNeed } from '../src/realm/heroes.ts'
import type { Realm } from '../src/realm/types.ts'

// Actual campaign UI and actual raid replay; only the starting scenario/save slot is isolated.
if (!import.meta.env.DEV) throw new Error('Development review only')
// ?hero=<장수 id> — 해비 말고 다른 장수의 시련도 같은 길로 (11-15 각성 시련을 모든 장수로)
const HERO = new URLSearchParams(location.search).get('hero') ?? 'tut-haebi'
const key = HERO === 'tut-haebi' ? 'hanbal.review.haebi-trial.v1' : `hanbal.review.trial.${HERO}.v1`
function initial() {
  const r = startTutorial(777), h = r.heroes[HERO]!
  h.faction = r.player; h.status = 'free'; h.at = 'tut-wirye-cap'
  for (const a of Object.values(r.armies)) if (a.hero === h.id) a.hero = null
  for (let i = 0; i < ascendNeed(h); i++) battleGrowth(r, [h.id], [], [], [])
  return r
}
let realm: Realm = JSON.parse(sessionStorage.getItem(key) ?? 'null') ?? initial()
function receipt() {
  const h = realm.heroes[HERO]!
  document.querySelector('output')!.textContent = `각성 ${h.ascended === true} · 완료 ${h.trialCleared === true} · 각성 횟수 ${h.ascents ?? 0} · 무예 ${h.mu} · 불꽃 ${h.flames ?? 0} · 계절 ${realm.season}`
}
const app = mountRealmApp(document.getElementById('app')!, {
  isolated: true,
  onCheckpoint(next) { sessionStorage.setItem(key, JSON.stringify(next)); realm = next; receipt(); return null },
  onAdvance(next) { realm = next; sessionStorage.setItem(key, JSON.stringify(next)); receipt() },
  onNewGame() {}, onTap() {}, onExport() {}, gameCount: () => 0, history: () => [], savedAt: () => new Date().toISOString(),
})
app.show(realm, null, null); receipt()
document.getElementById('losses')!.onclick = () => {
  for (let i = 0; i < 5; i++) battleGrowth(realm, [], [HERO], [], [])
  sessionStorage.setItem(key, JSON.stringify(realm)); app.show(realm, null, null); receipt()
}
document.getElementById('reset-review')!.onclick = () => { sessionStorage.removeItem(key); location.reload() }
