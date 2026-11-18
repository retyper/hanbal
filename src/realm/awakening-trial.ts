import { ascendNeed, awardAwakening } from './heroes.ts'
import { hasAwakeningTrial } from './trial-rules.ts'
import type { Realm, ReportLine } from './types.ts'
import { josa } from '../core/josa.ts'
/**
 * 시련에 못 들어가는 까닭 (들어갈 수 있으면 null). 시련이 있는 장수만 본다 (trial-rules.hasAwakeningTrial).
 * 본편의 시련 관문을 닫으면(P.realm.ascendTrialOpen 0 · 각성 v2) 본편 장수는 첫 줄에서 막힌다: 시련 문이 안 열리고 보상(completeTrial)도 없다.
 * 그때 힘은 불꽃이 다 켜지는 싸움 끝에 셈 안에서 붙는다 (heroes.kindle). 배우는 판의 해비는 어느 쪽이든 이 길을 탄다
 */
export function trialBlock(r: Realm, id: string): string | null {
  const h = r.heroes[id]
  if (!h || !hasAwakeningTrial(h) || h.faction !== r.player || h.status !== 'free') return '우리 장수만 도전할 수 있습니다.'
  if (r.outcome) return '끝난 캠페인에서는 시련을 진행할 수 없습니다.'
  if (h.trialCleared) return '이 캠페인에서 시련을 완료했습니다.'
  if (h.woundedUntil !== undefined && h.woundedUntil > r.season) return '부상을 회복한 뒤 도전할 수 있습니다.'
  if (h.awayUntil !== undefined && h.awayUntil >= r.season || (r.expeditions ?? []).some(e => e.hero === id)) return `${josa(h.name, '이', '가')} 돌아온 뒤 도전할 수 있습니다.`
  if (Object.values(r.armies).some(a => a.hero === id && a.march !== null)) return '진군을 마친 뒤 도전할 수 있습니다.'
  if (!h.trialReady && !h.ascended && (h.flames ?? 0) < ascendNeed(h)) return `공훈 ${h.flames ?? 0}/${ascendNeed(h)} · 만만치 않은 적과의 승리로 시련을 여세요.`
  return null
}
/** Returns a new campaign. The caller must durably save it before accepting the receipt. */
export function completeTrial(r: Realm, id: string): { next: Realm; lines: ReportLine[] } | null {
  if (trialBlock(r, id)) return null
  const next = structuredClone(r), h = next.heroes[id]!, lines: ReportLine[] = []
  h.trialReady = true; h.trialCleared = true
  awardAwakening(h, lines)
  return { next, lines }
}
