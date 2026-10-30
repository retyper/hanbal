/**
 * 사람마다의 회유 대사 묶음 (docs/realm/MEMORY.md §2 · 형 10-30: "캐릭터마다 출신과 사연이 있는데 ... 회유 루트를 캐릭터마다 다 만들어서 개성이 있게.
 * 서로 다른 두 사람의 대화가 다른 회유 루트에서 같은 내용이 절대 없게").
 *
 * 글만 담는다. 자리표는 화면이 판의 사실로 채운다 (src/ui/realm/woo-lines.ts fillTalk) — 자리표 뒤의 조사(은·는·이·가·을·를·과·와·으로·로)는
 * 받침에 맞게 고쳐진다. 자리표 뒤에 「이오 · 이다」 같은 잡음말은 붙이지 않는다 (tests/realm/woo-lines.test.ts 가 지킨다).
 *   {nation} 갇힌 이의 나라 · {ours} 사로잡은 나라 · {jail} 갇힌 동안(「세 계절」) · {grain} 이익으로 건 곡식(「스무 섬」)
 *   {kin} 우리 손에 있는 피붙이 이름 · {rel} 그 사이(짝 · 딸 · 아들 · 어머니 · 아버지) · {home} 같은 고향 나라 · {tie} 인연의 낱말
 */
import type { WooApproach } from '../../types.ts'

/** 갇혔을 때 — 첫마디 · 거리마다 먹힘/안 먹힘 · 노여움 · 넘어옴 · 아직은 · 원한 */
export interface WooHeld {
  /** 첫마디 — 그 사람의 약한 곳(가장 맞는 거리)이 단서가 된다. pride 맞는 곳이 없을 때 · long 달래기 · hurt 명분 · greed 이익 · fear 겁주기 */
  readonly open: { readonly pride: string; readonly long: string; readonly hurt: string; readonly greed: string; readonly fear: string }
  /** 피붙이가 우리 손에 있을 때의 첫마디 ({rel} {kin}) */
  readonly kin: string
  /** 지난 담판에서 노여움을 산 이를 다시 볼 때 */
  readonly grudge: string
  /** 거리마다 먹혔다 */
  readonly hit: Readonly<Record<WooApproach, string>>
  /** 거리마다 안 먹혔다 */
  readonly miss: Readonly<Record<WooApproach, string>>
  /** 같은 거리를 또 듣고 또 먹혔다 · [0] 두 번째 [1] 세 번째 */
  readonly againHit: readonly [string, string]
  /** 같은 거리를 또 듣고 또 튕겼다 · [0] 두 번째 [1] 세 번째 */
  readonly againMiss: readonly [string, string]
  /** 가시를 밟았다 — insult 곡식·칼로 · slight 달래기·명분·인연으로 깔보였다 */
  readonly rage: { readonly insult: string; readonly slight: string }
  /** 손을 잡는다 — agreed 앞 말이 먹힌 뒤 · refused 방금 고개를 저어 놓고 */
  readonly yield: { readonly agreed: string; readonly refused: string }
  /** 벽은 무너졌으나 아직은 */
  readonly notYet: string
}

/** 회유하러 갈 때 — 군주에게 · 거리마다 설득 (같은 거리를 거듭하면 다음 줄) */
export interface WooSpeak {
  /** 군주에게 옥문을 열어 달라 (군주 자신이면 신하들에게 직접 가겠다고) */
  readonly lord: string
  readonly soothe: readonly [string, string, string]
  /** 명분 — 처음은 판의 처지(무너짐 · 오래 아무도 안 옴 · 아직 버팀)대로 */
  readonly cause: { readonly fallen: string; readonly alone: string; readonly alive: string; readonly again: string; readonly third: string }
  /** 이익 — 셋 다 {grain} 을 넣는다 */
  readonly gain: readonly [string, string, string]
  readonly fear: readonly [string, string, string]
  /** 인연 — 피붙이({rel} {kin}) · 한 핏줄 · 같은 고향({home}) */
  readonly bond: { readonly kin: string; readonly blood: string; readonly home: string }
}

export interface WooBundle {
  readonly held: WooHeld
  readonly speak: WooSpeak
}
