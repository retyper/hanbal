/**
 * 부적(符籍) — 여정 한 번짜리 소모품 (2026-09-02)
 *
 * 형: **"돈 쓸 곳을 좀 더 많이 마련해봐야 해. 돈을 벌고 싶어지도록."**
 *
 * 영구 성장(스탯·개조)은 한 번 사면 끝이라 훈련치가 쌓이는 어느 날 지갑이 닫힌다.
 * 부적은 **이번 여정에만** 붙고 여정이 끝나면 사라진다 — 그래서 매 출정마다 "이번엔 무엇을
 * 지니고 가나"가 결정이 되고, 훈련치를 **매 여정** 쓸 이유가 생긴다 (하데스의 '죽음의 저항'
 * 같은 런 자원, 뱀서의 시작 아이템).
 *
 * 하나만 지닌다. 넷을 다 지니게 하면 결정이 아니라 체크리스트다.
 * 넷은 서로 다른 축을 건다 — 탄약 · 방어 · 위험/보상 · 보스:
 *   살통 부적 (箭筒)  매 판 화살 +1 — "화살이 다했다"에 대한 답
 *   철갑 부적 (鐵甲)  두정갑 한 벌을 입고 출발 — 맞는 것에 대한 답
 *   노다지 부적 (金)  훈련치 ×1.3, 대신 체력을 깎고 출발 — 벌러 가는 사람의 것
 *   파귀 부적 (破鬼)  보스 체력 ×0.75 — 10판마다 서는 벽을 낮춘다
 *
 * sim은 부적을 모른다. 효과는 전부 game 레이어에서 **판 경계**에 얹는다 (A1):
 * 화살 지급(loop loadStage), 시작 체력·갑옷(startRun), 훈련치 배수(finishRun), 보스 체력(스테이지 정의).
 */
import type { StageDef } from '../sim/types.ts'
import { P } from '../tune/params.ts'
import { armorPer } from './defense.ts'
import { writeSave, type SaveData } from './save.ts'

export type CharmId = 'quiver' | 'iron' | 'gold' | 'ghost'

export interface CharmDef {
  id: CharmId
  name: string
  origin: string
  /** 무엇을 하는가 — 한 줄. 대가가 있으면 같은 줄에 적는다. */
  hint: string
}

export const CHARMS: readonly CharmDef[] = [
  { id: 'quiver', name: '살통 부적', origin: '箭筒', hint: '매 판 화살이 한 발 더 온다' },
  { id: 'iron', name: '철갑 부적', origin: '鐵甲', hint: '두정갑 한 벌을 입고 출발한다' },
  { id: 'gold', name: '노다지 부적', origin: '金', hint: '훈련치가 더 들어온다 — 대신 체력을 깎고 출발' },
  { id: 'ghost', name: '파귀 부적', origin: '破鬼', hint: '귀신(보스)의 체력이 준다' },
]

export function isCharmId(v: unknown): v is CharmId {
  return typeof v === 'string' && CHARMS.some((c) => c.id === v)
}

export function charmDef(id: CharmId): CharmDef {
  for (const c of CHARMS) if (c.id === id) return c
  return CHARMS[0] as CharmDef
}

export function charmCost(id: CharmId): number {
  const K = P.charm
  const v = id === 'quiver' ? K.quiverCost : id === 'iron' ? K.ironCost : id === 'gold' ? K.goldCost : K.ghostCost
  return Math.max(0, Math.floor(v))
}

/** 못 사는 이유. 살 수 있으면 빈 문자열. */
export function charmBlocked(d: SaveData, id: CharmId): string {
  const cost = charmCost(id)
  if (d.training < cost) return `훈련치 ${cost} 필요`
  return ''
}

/**
 * 출정하며 산다 — 훈련치를 깎고 이번 여정의 부적으로 적는다. 못 사면 부적 없이 떠난다(false).
 * 저장은 하지 않는다: 바로 뒤에 startRun 이 여정 상태를 통째로 적는다.
 */
export function buyCharm(d: SaveData, id: CharmId | ''): boolean {
  if (id === '') {
    d.runCharm = ''
    return false
  }
  if (charmBlocked(d, id) !== '') {
    d.runCharm = ''
    return false
  }
  d.training -= charmCost(id)
  d.runCharm = id
  writeSave(d)
  return true
}

/** 세이브의 문자열을 부적 id로. 모르는 값은 '없음'. */
export function runCharmOf(d: SaveData): CharmId | '' {
  return isCharmId(d.runCharm) ? d.runCharm : ''
}

// ─────────────────────────── 효과 ───────────────────────────
// 전부 순수 함수다. 어디에 얹는지는 game/loop.ts 가 정한다.

/** 매 판 화살 추가 발수. */
export function charmArrowBonus(id: CharmId | ''): number {
  return id === 'quiver' ? 1 : 0
}

/** 판 훈련치 배수 (갈림길 배수와 곱한다). */
export function charmTrainMul(id: CharmId | ''): number {
  return id === 'gold' ? Math.max(1, P.charm.goldTrainMul) : 1
}

/** 여정 시작 체력. */
export function charmStartHp(id: CharmId | ''): number {
  const max = Math.floor(P.enemy.hpMax)
  if (id !== 'gold') return max
  return Math.max(1, max - Math.floor(P.charm.goldHpCut))
}

/** 여정 시작 두정갑. */
export function charmStartArmor(id: CharmId | ''): number {
  return id === 'iron' ? armorPer() : 0
}

/** 보스 체력 배수. */
export function charmBossHpMul(id: CharmId | ''): number {
  return id === 'ghost' ? Math.max(0.1, Math.min(1, P.charm.ghostBossHp)) : 1
}

/**
 * 판 정의에 부적을 얹는다 — 지금은 파귀(보스 체력)만 판 정의를 건드린다.
 * 원본은 절대 고치지 않는다 (STAGES는 공유 객체). 건드릴 게 없으면 그대로 돌려준다.
 */
export function applyCharmToStage(stage: StageDef, id: CharmId | ''): StageDef {
  const mul = charmBossHpMul(id)
  if (mul >= 1) return stage
  if (!stage.targets.some((t) => t.kind === 'boss')) return stage
  return {
    ...stage,
    targets: stage.targets.map((t) =>
      t.kind === 'boss' && t.hp !== undefined
        ? { ...t, hp: Math.max(1, Math.floor(t.hp * mul)) }
        : t,
    ),
  }
}
