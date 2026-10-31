/**
 * 싸움의 끝맺음 — 연패와 잃은 사람 (FOCUS C · 형 10-30: "400, 300, 200 계속 옴, 섬멸 안 됨"). 달 시계 판만 (옛 판은 그대로).
 *  - 연패: AI 나라가 beatenStreak 번 잇달아 지면 그 계절 끝부터 beatenRest 계절 동안 새 출정을 쉰다 (ai.ts decide · approach).
 *    막혀 물러난 공격(고을 싸움의 교착)도 진 것으로 센다 · 이기면 다시 0 부터.
 *  - 잃은 사람 장부: 싸움에서 잃은 군사는 warDead 에 적히고 계절마다 warDeadHeal 몫씩 아문다. AI 징병의 나라 상한에서 뺀다 (ai.ts drafts) —
 *    잃은 만큼 곧바로 다시 뽑아 같은 크기 군대가 또 오지 않게.
 * 진 군대가 흩어지는 것(도망병 · 섬멸)은 판정 한가운데라 season.ts 의 scatterBeaten 이 한다.
 * 플레이어 나라는 쉬기·장부가 없다 (플레이어는 제 뜻대로). season.ts 가 부르고 ai.ts 가 읽는다 — 다른 판정 파일을 부르지 않는다.
 */
import { P } from '../tune/params.ts'
import { monthly, seasonEndTurn, seasons } from './calendar.ts'
import type { Army, Realm, ReportLine } from './types.ts'

/** 이 규칙이 걸리는 나라 — 달 시계 판의 AI 나라 */
function counted(r: Realm, faction: string): boolean {
  const f = r.factions[faction]
  return monthly(r) && f !== undefined && f.mind !== 'player'
}

/** 연달아 져서 새 출정을 쉬는 중인가 */
export function beatenResting(r: Realm, faction: string): boolean {
  const until = r.factions[faction]?.beaten?.until
  return counted(r, faction) && until !== undefined && until >= r.season
}

/** 싸움 줄 하나의 진 나라 · 이긴 나라 — 들판의 교착은 아무도 안 졌다 · 고을 싸움의 교착은 막혀 물러난 쪽이 졌다 */
function sides(l: Extract<ReportLine, { kind: 'battle' }>, atk: string): { lost: string | null; won: string | null } {
  const atkWon = l.outcome === 'rout' || l.outcome === 'win'
  if (atkWon) return { lost: l.defender, won: atk }
  if (l.outcome === 'draw' && l.field === true) return { lost: null, won: null }
  return { lost: atk, won: l.defender }
}

/**
 * 이번 턴의 싸움으로 연패를 센다 — beatenStreak 에 닿으면 쉬기에 들고 줄을 남긴다. 친 나라는 줄의 atkFaction (흩어진 군대도 남는다)
 */
export function noteBeaten(r: Realm, lines: ReportLine[]): void {
  const R = P.realm
  if (!monthly(r)) return
  const battles = lines.filter((l): l is Extract<ReportLine, { kind: 'battle' }> => l.kind === 'battle')
  for (const l of battles) {
    const atk = l.atkFaction ?? r.armies[l.attacker]?.faction
    if (atk === undefined) continue
    const { lost, won } = sides(l, atk)
    if (won !== null && counted(r, won) && !beatenResting(r, won)) {
      const f = r.factions[won]!
      if (f.beaten !== undefined) f.beaten.n = 0
    }
    if (lost === null || !counted(r, lost) || beatenResting(r, lost)) continue
    const f = r.factions[lost]!
    const b = (f.beaten ??= { n: 0 })
    b.n += 1
    if (b.n < Math.max(1, Math.round(R.beatenStreak)) || R.beatenRest <= 0) continue
    b.n = 0
    b.until = seasonEndTurn(r) + seasons(r, Math.round(R.beatenRest))
    lines.push({ kind: 'beaten', faction: lost, until: b.until })
  }
}

const menIn = (a: Army): number => Object.values(a.mix).reduce((s, v) => s + (v ?? 0), 0)

/** 나라마다 군사 수 — 싸움 앞뒤로 재어 잃은 사람을 센다 */
export function menByFaction(r: Realm): Map<string, number> {
  const out = new Map<string, number>()
  for (const a of Object.values(r.armies)) out.set(a.faction, (out.get(a.faction) ?? 0) + menIn(a))
  return out
}

/** 싸움 앞의 군사 수(before)와 견주어 잃은 사람을 장부에 적는다 (AI 나라만) */
export function noteWarDead(r: Realm, before: ReadonlyMap<string, number>): void {
  if (!monthly(r)) return
  const now = menByFaction(r)
  for (const [f, n] of [...before].sort((x, y) => (x[0] < y[0] ? -1 : 1))) {
    const lost = n - (now.get(f) ?? 0)
    if (lost <= 0 || !counted(r, f)) continue
    const fac = r.factions[f]!
    fac.warDead = (fac.warDead ?? 0) + lost
  }
}

/** 계절 끝 — 장부가 warDeadHeal 몫씩 아문다 (어린 사람이 자란다) */
export function healWarDead(r: Realm): void {
  if (!monthly(r)) return
  for (const f of Object.values(r.factions)) {
    if (f.warDead === undefined) continue
    const left = f.warDead * (1 - P.realm.warDeadHeal)
    if (left < 1) delete f.warDead
    else f.warDead = left
  }
}

/** AI 징병의 나라 상한에서 뺄 몫 — 아직 아물지 않은 잃은 사람 */
export function warDeadRoom(r: Realm, faction: string): number {
  return counted(r, faction) ? Math.ceil(r.factions[faction]?.warDead ?? 0) : 0
}
