/**
 * 방어 — 판 도중에 훈련치로 사는 두 가지 (형: "게임플레이 도중에 방어벽이나 방어구 구매")
 *
 * 그동안 이 게임에는 **맞는 것에 대한 대답이 없었다.** 적 화살이 오면 할 수 있는 건 셋뿐이고
 * (먼저 쏴 죽인다 · 맞불로 쳐낸다 · 과녁 뒤에 선다) 셋 다 판의 배치가 허락해야 되는 것이라,
 * 배치가 나쁜 판에서는 선택지가 아예 없었다. **사는 것**이 네 번째 답이다.
 *
 * 둘의 성격을 일부러 갈랐다 (P.defense 주석):
 *   · 방패(防牌)     — 앞에 세운다. 이 판만. 싸다. 위기 한 번을 넘긴다.
 *   · 두정갑(頭釘甲) — 입는다. 여정 내내. 비싸다. 체력의 예산을 늘린다.
 *
 * 값은 훈련치다 — 스탯을 올리는 그 지갑이다 (GDD 9장: 결제·광고·에너지 없음).
 * 같은 지갑이라 "지금 방패를 살까, 힘을 올릴까"가 진짜 저울질이 된다.
 *
 * ── 이 파일이 들고 있지 않은 것 ──
 * 방패의 내구는 **월드의 상태**다 (sim/world.ts shield). 여기 저장하지 않는다 —
 * 판이 끝나면 사라지는 물건이라 세이브에 남을 이유가 없고, 남기면 두 곳이 어긋난다.
 * 갑옷만 세이브(runArmor)에 산다. 여정을 넘어가기 때문이다.
 */
import { P } from '../tune/params.ts'
import { writeSave, type SaveData } from './save.ts'

export type DefenseId = 'shield' | 'armor' | 'arrow'

export interface DefenseItem {
  id: DefenseId
  /** 화면에 뜨는 이름. 한자 뿌리는 화살·활 이름과 같은 문법이다 (game/arrows.ts). */
  name: string
  origin: string
  /** 한 줄 설명 — 무엇을 사는지 한 번에 읽혀야 한다. */
  hint: string
}

export const DEFENSE_ITEMS: readonly DefenseItem[] = [
  {
    id: 'shield',
    name: '방패',
    origin: '防牌',
    hint: '앞에 세운다 — 적 화살을 삼킨다 · 이 판만',
  },
  {
    id: 'armor',
    name: '두정갑',
    origin: '頭釘甲',
    hint: '입는다 — 피해를 대신 받는다 · 여정 내내',
  },
  // 화살 한 발 (2026-09-02, 형: "돈 쓸 곳을 좀 더 많이"). 방어는 아니지만 **같은 무리**다 —
  // "지금 이 판에서 훈련치로 사는 것". 살수록 비싸지고 판당 상한이 있다 (P.defense.arrow*).
  {
    id: 'arrow',
    name: '화살 한 발',
    origin: '箭',
    hint: '살통에 한 발 더 — 이 판만 · 살수록 비싸진다',
  },
]

/**
 * 값 (훈련치). 노브에서 바로 읽는다 — 코드 속 매직넘버 금지 (CLAUDE.md 3).
 * 화살은 **이 판에서 산 발수**만큼 오른다 — 그래서 상태가 필요하다. 없으면 첫 발 값.
 */
export function defenseCost(id: DefenseId, state?: DefenseState): number {
  if (id === 'arrow') {
    const bought = state !== undefined ? state.arrowsBought : 0
    return Math.max(0, Math.floor(P.defense.arrowCost + P.defense.arrowCostStep * bought))
  }
  return Math.max(0, Math.floor(id === 'shield' ? P.defense.shieldCost : P.defense.armorCost))
}

/** 한 판에 살 수 있는 화살 수. */
export function arrowBuyMax(): number {
  return Math.max(1, Math.floor(P.defense.arrowMaxPerStage))
}

/** 방패 하나의 내구 (적 화살 발수). */
export function shieldHp(): number {
  return Math.max(1, Math.floor(P.defense.shieldHp))
}

/** 두정갑 한 벌의 방어량과 겹쳐 입기 상한. */
export function armorPer(): number {
  return Math.max(1, Math.floor(P.defense.armorPer))
}
export function armorCap(): number {
  return Math.max(1, Math.floor(P.defense.armorMax))
}

/**
 * 지금 이걸 살 수 있는가. **못 사는 이유를 문자열로 돌려준다** — 버튼이 왜 꺼져 있는지
 * 말하지 않으면 사용자는 그게 버그인지 규칙인지 알 수 없다 (감사 UI 원칙).
 * 살 수 있으면 빈 문자열.
 */
export function defenseBlocked(d: SaveData, id: DefenseId, state: DefenseState): string {
  if (!state.playing) return '판이 도는 중에만 산다'
  if (id === 'shield' && state.shieldMax > 0) return '이미 세워 뒀다'
  if (id === 'armor' && d.runArmor >= armorCap()) return '더 겹쳐 입지 못한다'
  if (id === 'arrow' && state.arrowsBought >= arrowBuyMax()) return '이 판에서는 더 못 산다'
  if (d.training < defenseCost(id, state)) return `훈련치 ${defenseCost(id, state)} 필요`
  return ''
}

/**
 * 산다. 훈련치를 깎고, 갑옷이면 세이브의 여정 방어량을 늘린다.
 * **월드에 세우는 일은 여기서 하지 않는다** — 그건 game/loop.ts 의 몫이다 (레이어 방향 A1).
 * 살 수 없으면 아무것도 하지 않고 false. 부분 지불은 없다 (progression.spendTraining 과 같은 규칙).
 */
export function buyDefense(d: SaveData, id: DefenseId, state: DefenseState): boolean {
  if (defenseBlocked(d, id, state) !== '') return false
  d.training -= defenseCost(id, state)
  if (id === 'armor') {
    const cap = armorCap()
    d.runArmor = Math.min(cap, d.runArmor + armorPer())
    // 최대치는 "지금 입은 벌의 총량"이다. 깎이는 건 runArmor 쪽이라 바가 줄어드는 게 보인다.
    d.runArmorMax = Math.max(d.runArmorMax, d.runArmor)
  }
  writeSave(d)
  return true
}

// ─────────────────────────── 화면에 알리기 ───────────────────────────
//
// 방패 내구는 sim 안에서 매 스텝 줄어드는데, 그걸 세이브에 적으면 안 된다 (A3: 저장은
// 탭 이탈과 판 종료뿐이다). 그렇다고 화면이 매 프레임 폴링하면 그건 A5 위반이다.
// 그래서 save.ts 의 onSaveChanged 와 **같은 문법**의 작은 통지 하나를 여기에 둔다:
// 루프가 프레임마다 값을 비교해서 **바뀔 때만** 부른다.

export interface DefenseState {
  /** 판이 지금 돌고 있는가 (드래프트·결과 화면이 아니라). */
  playing: boolean
  shield: number
  shieldMax: number
  armor: number
  armorMax: number
  /** 이 판에서 훈련치로 산 화살 수. 값이 여기서 오른다 (defenseCost). */
  arrowsBought: number
}

/** 현재 상태. 제자리에서 갱신되는 객체 하나다 — 프레임당 할당 0 (A5). */
const STATE: DefenseState = { playing: false, shield: 0, shieldMax: 0, armor: 0, armorMax: 0, arrowsBought: 0 }

const listeners = new Set<() => void>()

export function defenseState(): DefenseState {
  return STATE
}

export function onDefenseChanged(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/**
 * 루프가 프레임마다 부른다. 값이 하나도 안 바뀌었으면 아무 일도 일어나지 않는다 —
 * 그 조건이 이 함수의 존재 이유다 (매 프레임 화면을 다시 그리면 A5가 깨진다).
 */
export function syncDefense(
  playing: boolean, shield: number, shieldMax: number, armor: number, armorMax: number, arrowsBought: number,
): void {
  if (
    STATE.playing === playing && STATE.shield === shield && STATE.shieldMax === shieldMax &&
    STATE.armor === armor && STATE.armorMax === armorMax && STATE.arrowsBought === arrowsBought
  ) return
  STATE.playing = playing
  STATE.shield = shield
  STATE.shieldMax = shieldMax
  STATE.armor = armor
  STATE.armorMax = armorMax
  STATE.arrowsBought = arrowsBought
  for (const fn of listeners) fn()
}
