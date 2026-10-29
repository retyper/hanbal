/**
 * 나라마다 뽑는 군사의 비 — AI 징병이 맞춰 가는 병종 구성 (docs/realm/CUSTOMS.md §8-3 S0 · §7-3 · §3).
 *
 * 예전엔 모든 나라가 창 6 · 활 3 · 방패 1 로 뽑아 기병조차 없었고, 병종·풍습 차이를 재면 늘 0 이 나왔다.
 * 이제 결(문화권)마다 사서가 적은 싸움 버릇을 따른다. 사서에 따로 적힌 나라만 나라 줄로 덮는다.
 * 비는 데이터다 — 사서 한 줄이 근거이고, 셈의 손잡이(켜고 끄기 · 말이 모자랄 때의 문턱)는 params `aiKyeolMix` · `aiDraftGoodsMin`.
 *
 * 뽑을 수 있는 병종(season.draftable)만 쓴다 — 긴창(pike)·쇠뇌(crossbow)는 아직 못 뽑으니 넣지 않는다 (동예 세 길 창은 창으로).
 * 기병은 말이 있어야(economy.draftLimit), 수군은 포구에서 나무가 있어야 뽑힌다 — 모자라면 ai.drafts 가 다음 병종으로 넘긴다.
 * 비의 합은 1. 결의 차이를 또렷하게 하되 한 병종만으로 된 군대는 없게 (가장 큰 몫 0.7).
 */
import type { UnitKind } from '../battle.ts'
import { P } from '../../tune/params.ts'
import { kyeolOf, type CustomId, type Kyeol } from './customs.ts'

export type ArmyMix = ReadonlyArray<readonly [UnitKind, number]>

/** 바탕 — 결이 없는 나라 · 옛 판의 비 (aiKyeolMix 0 이면 모든 나라가 이것) */
export const BASE_MIX: ArmyMix = [['spear', 0.6], ['bow', 0.3], ['shield', 0.1]]

interface MixDef {
  readonly mix: ArmyMix
  /** 사서 한 줄 — 비를 왜 이렇게 두었나 */
  readonly source: string
}

export const KYEOL_MIX: Readonly<Record<Kyeol, MixDef>> = {
  goguryeo: {
    mix: [['spear', 0.35], ['bow', 0.35], ['horse', 0.2], ['shield', 0.1]],
    source: '『삼국지』 위서 고구려전 「其馬皆小，便登山」 · 「出好弓，所謂貊弓是也」: 작은 말과 활',
  },
  buyeo: {
    mix: [['spear', 0.4], ['horse', 0.3], ['bow', 0.2], ['shield', 0.1]],
    source: '『삼국지』 위서 부여전 「其國善養牲，出名馬」 · 「以弓矢刀矛爲兵」: 이름난 말',
  },
  okjeo: {
    mix: [['spear', 0.7], ['bow', 0.2], ['shield', 0.1]],
    source: '『삼국지』 위서 동옥저전 「少牛馬，便持矛步戰」: 말이 적어 창을 들고 걸어서 싸운다',
  },
  ye: {
    mix: [['spear', 0.65], ['bow', 0.2], ['horse', 0.1], ['shield', 0.05]],
    source: '『삼국지』 위서 예전 「作矛長三丈，或數人共持之，能步戰」 · 「樂浪檀弓出其地」 · 「又出果下馬」: 긴 창 (세 길 창은 긴창을 열 때까지 창으로)',
  },
  mahan: {
    mix: [['spear', 0.4], ['bow', 0.3], ['shield', 0.3]],
    source: '『진서』 사이전 마한조 「善用弓楯矛櫓」 · 『삼국지』 위서 한전 「不知乘牛馬」: 활·방패·창, 말은 타지 않는다',
  },
  byeonhan: {
    mix: [['spear', 0.6], ['bow', 0.25], ['shield', 0.15]],
    source: '『삼국지』 위서 변진전 「國出鐵」 · 「便步戰，兵仗與馬韓同」: 쇠 창, 걸어서 싸운다',
  },
  jinhan: {
    mix: [['spear', 0.5], ['bow', 0.3], ['horse', 0.1], ['shield', 0.1]],
    source: '『삼국지』 위서 변진전(진한) 「乘駕牛馬」: 마한의 「不知乘牛馬」와 맞서는 짝, 소·말을 부린다',
  },
  baekje: {
    mix: [['spear', 0.5], ['bow', 0.3], ['horse', 0.1], ['shield', 0.1]],
    source: '『삼국사기』 백제본기 시조 온조왕, 아버지 추모(주몽)가 북부여에서 왔다 (부여 갈래의 말은 게임의 해석)',
  },
  juho: {
    mix: [['spear', 0.5], ['bow', 0.3], ['boat', 0.2]],
    source: '『삼국지』 위서 한전 주호 「乘船往來，市買韓中」: 배를 타고 오간다 (포구가 있어야 뽑힌다)',
  },
  other: { mix: BASE_MIX, source: '' },
}

/** 결과 다르게 적힌 나라 — 사서에 그 나라 이야기가 따로 있을 때만 (CUSTOMS §8-1 나라 고리 · 지어내지 않는다) */
export const NATION_MIX: Readonly<Record<string, MixDef>> = {
  yangmaek: {
    mix: [['spear', 0.45], ['bow', 0.45], ['shield', 0.1]],
    source: '『삼국지』 위서 고구려전 「句麗別種依小水作國…出好弓，所謂貊弓是也」 (소수맥과 양맥을 잇는 것은 게임의 해석, CUSTOMS §7-3 맥궁)',
  },
  usan: {
    mix: [['spear', 0.5], ['bow', 0.3], ['boat', 0.2]],
    source: '『삼국사기』 신라본기 지증마립간 13년, 우산국은 바다 가운데 섬, 배로만 닿는다',
  },
}

/**
 * 그 나라가 맞춰 가는 병종 비 — 나라 줄 › 결 줄 › 바탕. `has` 를 주면 그 나라 풍습이 비를 바꾼다:
 * 쇠뇌(골벌)는 활 몫에서 sonoeMix 를 쇠뇌로 · 뱃길(땅)은 창 몫에서 landPortMix 를 수군으로 (data/customs.ts)
 */
export function mixOf(nation: string, has?: (id: CustomId) => boolean): ArmyMix {
  const base = NATION_MIX[nation]?.mix ?? KYEOL_MIX[kyeolOf(nation)].mix
  if (has === undefined) return base
  let m = base
  if (has('sonoe')) m = shift(m, 'bow', 'crossbow', P.realm.sonoeMix)
  if (has('landPort')) m = shift(m, 'spear', 'boat', P.realm.landPortMix)
  return m
}

/** 비의 한 몫을 다른 병종으로 옮긴다 — 옮길 몫이 모자라면 있는 만큼 (합은 그대로) */
function shift(m: ArmyMix, from: UnitKind, to: UnitKind, x: number): ArmyMix {
  const have = m.find(([k]) => k === from)?.[1] ?? 0
  const d = Math.min(have, x)
  if (d <= 0) return m
  const out: Array<readonly [UnitKind, number]> = m.map(([k, w]) => [k, k === from ? w - d : w] as const)
  const at = out.findIndex(([k]) => k === to)
  if (at >= 0) out[at] = [to, out[at]![1] + d]
  else out.push([to, d])
  return out.filter(([, w]) => w > 0)
}

/** 군대의 결 — 나라 고르기·나라 판의 「군대」 한 줄 (KYEOL_MIX 의 쉬운 말) */
export const KYEOL_ARMY: Readonly<Record<Kyeol, string>> = {
  goguryeo: '작은 말과 활: 산길을 잘 탄다',
  buyeo: '이름난 말: 기병이 두껍다',
  okjeo: '말이 적어 창을 들고 걸어서 싸운다',
  ye: '긴 창을 여럿이 함께 들고 걸어서 싸운다',
  mahan: '활과 큰 방패, 창: 말은 타지 않는다',
  byeonhan: '쇠 창을 들고 걸어서 싸운다',
  jinhan: '창과 활에 소·말을 부린다',
  baekje: '창과 활에 북에서 온 말이 조금',
  juho: '배를 타고 오가며 싸운다',
  other: '',
}
