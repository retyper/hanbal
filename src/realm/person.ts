/**
 * 사람 열쇠와 사람 단위 도장 (각성 v2 · docs/realm/study-20261118/30-PROPOSAL.md 1절 ⑥).
 *
 * 같은 사람이 판마다 다른 장수 id 로 나온다 (온조 = mh-onjo · tut-onjo, 말갈기 = sabeol-1 · tut-malgalgi …).
 * 사람 단위 기록(각성 도장 · 사연 · 인연)은 장수 id 가 아니라 여기서 묶는다.
 *  - 열쇠는 초상 id (data/hero-bust.ts): 같은 초상을 쓰는 id 는 같은 사람이다. 지금 일곱 쌍 (tests/realm/person.test.ts 가 센다)
 *  - 초상이 다르면 이름이 같아도 따로 센다 (늙은 대소: 각성 그림이 다른 사람은 따로가 눈에 맞다 · 진왕 진하와 신지 방울은 11-19 부터 아예 다른 사람)
 *  - 기록은 옮기지 않는다: 영웅전 표(hanbal.realm.dex)는 장수 id 로 적힌 그대로 두고, 읽을 때 같은 사람의 id 를 묶어 본다
 *
 * 의존성 없는 순수한 셈이다 (지역 자료 · 저장소 · 수치를 끌어오지 않는다). 본편과 열전이 같이 쓴다.
 */
import { HERO_BUST } from './data/hero-bust.ts'

/**
 * 손으로 적는 예외 — 장수 id → 사람 열쇠. 지금은 없다.
 * 남의 초상을 빌려 쓰는 다른 사람은 제 id 를, 초상이 달라도 같은 사람으로 칠 이는 그 사람의 초상 id 를 적는다.
 */
const PERSON_FIX: Readonly<Record<string, string>> = {}

/** 장수 id → 사람 열쇠. 초상이 없는 장수(판마다 새로 나는 자녀 등)는 id 가 곧 열쇠다 */
export const personOf = (heroId: string): string => PERSON_FIX[heroId] ?? HERO_BUST[heroId] ?? heroId

export const samePerson = (a: string, b: string): boolean => personOf(a) === personOf(b)

let IDS: Map<string, string[]> | null = null

/** 같은 사람의 장수 id 모두 (자기도 든다 · 가나다순). 표에 없는 id 는 자기 하나 */
export function sameIds(heroId: string): readonly string[] {
  if (IDS === null) {
    IDS = new Map()
    for (const id of [...new Set([...Object.keys(HERO_BUST), ...Object.keys(PERSON_FIX)])].sort()) {
      const key = personOf(id)
      const list = IDS.get(key)
      if (list === undefined) IDS.set(key, [id])
      else list.push(id)
    }
  }
  const list = IDS.get(personOf(heroId))
  return list !== undefined && list.includes(heroId) ? list : [heroId]
}

// ───────── 영웅전 표의 사람 단위 비트
// 네 칸(들음 1 · 만남 2 · 사로잡음 4 · 거느림 8 · dex.ts)은 장수 id 마다 센다. 아래 셋은 사람(personOf)으로 묶어 읽는다.
// 열전(raid/link.ts)도 쓰니 지역 자료를 끌어오는 dex.ts 가 아니라 여기 둔다. dex.ts 가 같은 이름으로 다시 내보낸다.

/** 본편 도장: 우리 장수로 본편에서 불꽃을 다 채워 봄 (지금까지의 「각성해 봄」 · 형 11-03 영웅전 각성 보기 · 단계 셈 dexLevel 에는 안 든다) */
export const DEX_AWOKE = 16
/** 도깨비 도장: 그 사람으로 장수 열전의 도깨비(목책 돌파의 두목)를 잡음 (raid/link.ts stampDemons) */
export const DEX_DEMON = 32
/** 그 사람으로 열전의 두목을 만남 — 사연 조각 2 의 열쇠 (통합안 3-1). 자리만 잡아 둔다: 적는 길은 사연과 함께 온다 */
export const DEX_BOSS = 64
export const PERSON_BITS = DEX_AWOKE | DEX_DEMON | DEX_BOSS

type DexLike = Readonly<Record<string, { readonly f: number } | undefined>>

/** 그 사람의 사람 단위 비트 — 같은 사람의 id 가운데 하나라도 켜져 있으면 켜진 것이다 */
export function personFlags(dex: DexLike, heroId: string): number {
  let f = 0
  for (const id of sameIds(heroId)) f |= dex[id]?.f ?? 0
  return f & PERSON_BITS
}

/** 그 사람의 도장 둘 — 본편(불꽃을 다 채워 봄) · 도깨비(열전에서 잡음). 둘 다 있으면 `both` */
export function sealsOf(dex: DexLike, heroId: string): { readonly flame: boolean; readonly demon: boolean; readonly both: boolean } {
  const f = personFlags(dex, heroId)
  const flame = (f & DEX_AWOKE) !== 0
  const demon = (f & DEX_DEMON) !== 0
  return { flame, demon, both: flame && demon }
}
