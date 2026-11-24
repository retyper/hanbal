/**
 * 열전 목소리 고르기 (11-24 형 「꼬리 잘릴 때 남자 비명 · 여자 보스 웃음·피격이 없다」) — 판 상태를 읽기만 하는 순수 함수.
 * 한 프레임에 새로 본 이펙트·보스 모습을 받아 어떤 목소리를 낼지 돌려준다. 소리를 틀지는 sound.ts 가 한다.
 *  - die: 사람 적이 쓰러졌을 때만 (짐승·거대 보스·부위 파괴는 아님)
 *  - roar: 짐승 포효(방울로 바꾸는 것은 sound.ts) · 여자 보스는 목소리 파일이 켜지면 웃음으로 바꾼다
 *  - boss_f_laugh / boss_f_hurt / boss_f_scream: 여자 보스 (HAEBI_BOSS_VOICE.who)
 * 부위 파괴 때 남자 비명이 나던 까닭: 부위가 부서지면 판이 고리 이펙트에 championCue 'roar' 를 얹는데(haebi.ts hit()) 이것이 등장·막 전환과 같은 짐승 포효로 났다.
 */
import { HAEBI_BOSS_VOICE as BV, HAEBI_BOSS_BEAST as BB } from '../tune/params.ts'

/** beast_* = 짐승·괴물 보스의 고유 소리 (HAEBI_BOSS_BEAST.who 에 그 칸이 있는 보스만 · 어느 보스인지는 beastKind) */
export type VoiceCall = 'die' | 'roar' | 'boss_f_laugh' | 'boss_f_hurt' | 'boss_f_scream' | 'beast_roar' | 'beast_attack' | 'beast_hurt'
/** 이번 틀에 새로 본 이펙트 (Effect 의 일부) */
export interface VoiceFx { kind: string; mob?: string; partBreak?: boolean; championCue?: string }
/** 살아 있는 거대 보스 (없으면 null) — state 는 거대 보스 상태(tell · strike · roar …) */
export interface VoiceBoss { kind: string; state: string; hp: number; max: number }
export interface VoiceMemory { human: number; state: string | null; hp: number | null; hurtAcc: number; kind: string | null; laughAt: number; hurtAt: number; screamAt: number; attackAt: number; beastHurtAt: number }
export const newVoiceMemory = (): VoiceMemory => ({ human: 0, state: null, hp: null, hurtAcc: 0, kind: null, laughAt: -9e9, hurtAt: -9e9, screamAt: -9e9, attackAt: -9e9, beastHurtAt: -9e9 })
/** 지금(또는 막 쓰러진) 보스의 종류 — beast_* 소리의 파일을 고를 때 */
export const beastKind = (m: VoiceMemory, boss: VoiceBoss | null) => boss?.kind ?? m.kind

/** 쓰러짐 신음(사람 목소리)을 내지 않는 적 — 짐승(개·범·곰)과 거대 두목 (11-22 형 「개나 짐승 유닛이 죽는데도 사람 죽는 목소리」) */
export const NO_GROAN: ReadonlySet<string> = new Set(['dog', 'tiger', 'bear', 'boss'])

export interface VoiceInput {
  fx: readonly VoiceFx[]; fell: number; boss: VoiceBoss | null; bossStart: boolean; now: number
  /** 여자 보스 파일 묶음이 켜졌나 (꺼져 있으면 여자 보스 목소리는 전혀 없다) */
  filesOn: boolean
}

export function voiceCalls(m: VoiceMemory, i: VoiceInput): VoiceCall[] {
  const out: VoiceCall[] = []
  const boss = i.boss, kind = boss?.kind ?? m.kind, who = kind ? BV.who[kind] : undefined
  const fem = i.filesOn && who !== undefined
  const beast = kind ? BB.who[kind] : undefined
  let human = 0, roars = 0, breaks = 0, bossDown = false
  for (const f of i.fx) {
    if (f.kind === 'death') { if (f.mob === 'boss') bossDown = true; else if (f.mob !== undefined && !NO_GROAN.has(f.mob)) human++ }
    if (f.championCue === 'roar') { if (f.partBreak) breaks++; else roars++ }
  }
  // 남자 비명: 사람 적이 쓰러졌을 때만 (쓰러진 수는 sound.ts 가 hitGap 으로 묶는다 · 묶이는 동안 본 사람 수는 모아 둔다)
  m.human += human
  if (i.fell > 0) { if (m.human > 0) out.push('die'); m.human = 0 }
  // 부위 파괴·쓰러짐: 여자 보스는 비명 (파일이 없으면 조용히 · 짐승 포효를 내지 않는다) · 다른 보스는 지금처럼 포효
  const scream = (breaks > 0 || bossDown) && who?.scream === true
  // 짐승 보스: 부위가 끊기면 제 아픈 소리(없으면 지금처럼 포효 쪽으로)
  if (breaks > 0 && beast?.hurt) { if (i.now - m.beastHurtAt >= BB.hurtGap) { m.beastHurtAt = i.now; out.push('beast_hurt') } }
  else if (breaks > 0 && (who === undefined || !who.laugh && !i.filesOn)) roars++   // 다른 보스(방울 무녀 포함)는 지금처럼
  if (scream && fem && i.now - m.screamAt >= BV.screamGap) { m.screamAt = i.now; out.push('boss_f_scream') }
  // 등장·막 전환: 웃음이 켜진 여자 보스는 웃음, 아니면 포효
  const wake = roars + Number(i.bossStart)
  const laughs = who?.laugh === true
  let laughed = false
  const tellStart = boss !== null && who?.laugh === true && boss.state === 'tell' && m.state !== 'tell'
  if (wake > 0) { if (laughs && fem) { if (i.now - m.laughAt >= BV.laughGap) { m.laughAt = i.now; laughed = true; out.push('boss_f_laugh') } } else if (!laughs || !i.filesOn) out.push(beast?.roar ? 'beast_roar' : 'roar') }
  else if (tellStart && fem && i.now - m.laughAt >= BV.laughGap) { m.laughAt = i.now; laughed = true; out.push('boss_f_laugh') }
  // 짐승 보스: 공격 예고(tell)에 들어가는 순간 제 공격 소리 (등장·막 전환 포효가 난 틀은 건너뛴다 · attackGap 틈)
  if (boss !== null && beast?.attack && boss.state === 'tell' && m.state !== 'tell' && wake === 0 && i.now - m.attackAt >= BB.attackGap) { m.attackAt = i.now; out.push('beast_attack') }
  // 피격: 보스 체력이 hurtShare 만큼 깎일 때마다 한 번 · hurtGap 틈 · 비명·웃음이 난 틀은 건너뛴다
  if (boss) {
    if (m.hp !== null && boss.hp < m.hp) m.hurtAcc += m.hp - boss.hp
    if (fem && who?.hurt && m.hurtAcc >= boss.max * BV.hurtShare && !scream && !laughed && i.now - m.hurtAt >= BV.hurtGap) { m.hurtAt = i.now; m.hurtAcc = 0; out.push('boss_f_hurt') }
    m.hp = boss.hp; m.state = boss.state; m.kind = boss.kind
  } else { m.hp = null; m.state = null; m.hurtAcc = 0; if (bossDown) m.kind = null }
  return out
}
