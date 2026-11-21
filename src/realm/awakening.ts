/** 56-A: permanent power and cosmetic appearance are separate. Pure model; no storage. */
import type { Hero, Realm, ReportLine } from './types.ts'
import { HERO_BUST } from './data/hero-bust.ts'
import { personOf } from './person.ts'
import { awardAwakening } from './heroes.ts'

export interface AwakeningEntry { unlocked: true; appearanceAwake?: boolean; [key: string]: unknown }
export interface AwakeningProfile { v: 1; people: Record<string, AwakeningEntry>; [key: string]: unknown }
export interface AwakeningProof { heroId: string; unlocked: boolean; appearanceAwake?: boolean }
/** Named people persist across campaigns. Generated children do not share a global identity. */
export const awakeningPersonAllowed = (id: string): boolean => HERO_BUST[id] !== undefined
export const awakeningVisible = (h: Pick<Hero, 'ascended' | 'awakeningLook'>): boolean => h.ascended === true && h.awakeningLook !== false

export function campaignAwakeningProofs(r: Realm): AwakeningProof[] {
  return Object.values(r.heroes).filter(h => h.faction === r.player && h.ascended === true && awakeningPersonAllowed(h.id) && (h.id !== 'tut-malgalgi' || h.trialCleared === true))
    .map(h => ({ heroId: h.id, unlocked: true, ...(h.awakeningLook !== undefined ? { appearanceAwake: h.awakeningLook } : {}) }))
}

/** Additive and monotonic. An existing registry preference always beats imported defaults. */
export function mergeAwakeningProfile(profile: AwakeningProfile, proofs: readonly AwakeningProof[]): AwakeningProfile {
  const people = { ...profile.people }
  const existing = new Set(Object.keys(profile.people))
  for (const proof of proofs) {
    if (!proof.unlocked || !awakeningPersonAllowed(proof.heroId)) continue
    const key = personOf(proof.heroId), old = people[key]
    if (old?.unlocked === true) {
      if (!existing.has(key) && old.appearanceAwake === undefined && proof.appearanceAwake !== undefined) people[key] = { ...old, appearanceAwake: proof.appearanceAwake }
      continue
    }
    people[key] = { ...old, unlocked: true, ...(proof.appearanceAwake !== undefined ? { appearanceAwake: proof.appearanceAwake } : {}) }
  }
  return { ...profile, people }
}

/** Returns a candidate; the UI must checkpoint it before adopting it. */
export function applyCampaignAwakening(realm: Realm, profile: AwakeningProfile): { next: Realm; changed: boolean; lines: ReportLine[] } {
  const next = structuredClone(realm), lines: ReportLine[] = []
  let changed = false
  for (const h of Object.values(next.heroes)) {
    if (h.faction !== next.player || !awakeningPersonAllowed(h.id)) continue
    const entry = profile.people[personOf(h.id)]
    if (entry?.unlocked !== true) continue
    if (awardAwakening(h, lines)) changed = true
    const show = entry.appearanceAwake !== false
    if ((h.awakeningLook ?? true) !== show) { h.awakeningLook = show; changed = true }
  }
  return { next: changed ? next : realm, changed, lines }
}
