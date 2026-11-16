import { openWar, WAR_CSS } from '../src/ui/realm/battlefield.ts'
import { APP_CSS } from '../src/ui/realm/appstyle.ts'
import { BATTLE_CSS } from '../src/ui/realm/battlecard.ts'
import { SKFX_CSS } from '../src/ui/realm/skillfx.ts'
import { WINFX_CSS } from '../src/ui/realm/winfx.ts'
import { FIT_CSS, MQ_CSS } from '../src/ui/realm/fit.ts'
import { advance } from '../src/realm/season.ts'
import { vanguardScenario } from './vanguard-scenario.ts'
import type { Realm, Report } from '../src/realm/types.ts'
if (!import.meta.env.DEV) throw new Error('Development review only')
const key = 'hanbal.review.haebi-vanguard.v1', root = document.getElementById('app')!
const style = document.createElement('style')
style.textContent = (FIT_CSS + MQ_CSS + APP_CSS + BATTLE_CSS + WAR_CSS + SKFX_CSS + WINFX_CSS).replaceAll('__ART__', '/realm/')
document.head.append(style)
function receipt(next: Realm, report: Report) {
  const rounds = report.lines.flatMap(l => l.kind === 'battle' ? l.rounds ?? [] : [])
  const acts = rounds.flatMap(r => r.acts ?? []).filter(a => a.breakthrough !== undefined)
  document.getElementById('receipt')!.textContent = `\n본편 반영 완료 · 계절 ${next.season} · 해비 각성 ${next.heroes['tut-haebi']!.ascended}\n돌파 기록 ${JSON.stringify(acts)}\n남은 실제 병력 ${JSON.stringify(Object.fromEntries(Object.values(next.armies).map(a => [a.id, a.mix])))}`
}
const saved = JSON.parse(sessionStorage.getItem(key) ?? 'null') as { next: Realm; report: Report } | null
if (saved) receipt(saved.next, saved.report)
else {
  const { realm, orders } = vanguardScenario()
  if (!openWar(root, realm, orders, { art: '/realm/', me: realm.player, review: true, ding() {}, done(tactics) {
    const result = advance(realm, orders, {}, tactics)
    sessionStorage.setItem(key, JSON.stringify(result)); receipt(result.next, result.report)
  } })) document.getElementById('receipt')!.textContent = '검수 전투가 열리지 않았습니다.'
}
document.getElementById('reset-review')!.onclick = () => { sessionStorage.removeItem(key); location.reload() }
