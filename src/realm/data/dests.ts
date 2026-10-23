/**
 * 원정의 먼 땅 넷 (src/realm/expedition.ts · SYSTEMS §15-4) — 화면과 글(prose)도 이것을 읽는다.
 * 이름은 사료에서: 왜(동이전: 변진의 철을 왜가 사 간다) · 주호(동이전: 마한 서쪽 바다의 큰 섬, 소·돼지를 기른다) ·
 * 늑도(사천 늑도 — 원삼국 바닷길의 옛 교역섬, 유적) · 읍루(동이전: 북쪽 깊은 숲, 독화살). 바닷길 셋은 포구가 있어야 간다.
 */
import type { ExpDest, RegionId } from '../types.ts'

export interface DestInfo {
  readonly name: string
  readonly line: string
  /** 바닷길 — 포구가 있어야 간다 */
  readonly sea: boolean
  /** 얻는 것의 기울기 */
  readonly bias: Readonly<Record<'iron' | 'grain' | 'wanderer' | 'skill', number>>
  /** 배워 올 수 있는 낯선 재주 (특성) */
  readonly skills: readonly string[]
  /** 이 판들에서만 닿는다 — 남쪽 바다는 삼한에서, 읍루의 숲은 북쪽에서 (형 10-23: "지형적 조건에 따라 보낼 수 있는 게 달라지거나 · 못 가는 건 아예 선택지에 안 나와야") */
  readonly from: readonly RegionId[]
}

const SOUTH: readonly RegionId[] = ['byeonhan-mini', 'yeongnam', 'south', 'world']
const NORTH: readonly RegionId[] = ['jumong', 'world']

export const DESTS: Readonly<Record<ExpDest, DestInfo>> = {
  wa: { name: '왜의 포구', line: '바다 건너 왜의 포구 — 변진의 쇠를 사러 오는 이들의 땅. 쇠값을 잘 쳐준다.', sea: true,
    bias: { iron: 1.4, grain: 0.6, wanderer: 1.0, skill: 0.9 }, skills: ['trader', 'river'], from: SOUTH },
  juho: { name: '주호의 섬', line: '서쪽 바다의 큰 섬 — 소와 돼지를 기르고 가죽옷을 입는다. 먹을 것이 넉넉하다.', sea: true,
    bias: { iron: 0.5, grain: 1.5, wanderer: 0.9, skill: 1.0 }, skills: ['river', 'nighteye'], from: SOUTH },
  neukdo: { name: '늑도', line: '남해의 옛 교역섬 — 먼 데서 온 배들이 들러 사람과 물건이 섞인다. 떠돌이를 만나기 좋다.', sea: true,
    bias: { iron: 1.0, grain: 0.8, wanderer: 1.8, skill: 0.8 }, skills: ['trader', 'smith'], from: SOUTH },
  north: { name: '읍루의 숲', line: '북쪽 깊은 숲 — 독화살과 담비 가죽의 사람들. 거칠지만 배울 것이 있다.', sea: false,
    bias: { iron: 0.8, grain: 0.7, wanderer: 0.9, skill: 1.7 }, skills: ['mountain', 'archer'], from: NORTH },
  hills: { name: '큰 산의 골', line: '남쪽 큰 산 깊은 골 — 사냥꾼과 숯 굽는 이들이 산다. 산길과 활을 배워 온다.', sea: false,
    bias: { iron: 0.9, grain: 0.6, wanderer: 1.0, skill: 1.6 }, skills: ['mountain', 'archer'], from: SOUTH },
}
export const DEST_IDS: readonly ExpDest[] = ['wa', 'juho', 'neukdo', 'north', 'hills']
