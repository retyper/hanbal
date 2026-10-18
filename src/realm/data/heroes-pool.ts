/**
 * 떠돌이 인재 명단 (docs/realm/HEROES.md §4-2) — 봄마다 한 명쯤 어느 고을에 나타난다 (heroes.stepHeroes).
 *
 * 이름은 지어낸다: 삼한의 칭호(신지·견지·읍차·번예·살해·험측) + 우리말 이름. 실존 인물은 쓰지 않는다 (BUILD §8 Q6).
 * 형의 방향 — 여인 많이, 제각각 (ART 0-2). 그림은 화면(art.ts)이 look(g 남 · w 여)을 보고 짝짓는다.
 * 능력치 합은 무명 장수 21~33 (HEROES §1) · 순서 무예·통솔·지략·내정·매력·의리.
 */
import type { Hero } from '../types.ts'

const w = (
  id: string, name: string, look: 'g' | 'w',
  [mu, tong, ryak, chi, deok, uiri]: readonly [number, number, number, number, number, number],
  traits: readonly string[],
): Hero => ({ id, name, faction: '', mu, tong, ryak, chi, deok, uiri, traits, look, status: 'free', captor: null, at: null, post: null })

export const HERO_POOL: readonly Hero[] = [
  w('wander-01', '번예 다솜', 'w', [3, 3, 5, 7, 7, 6], ['farmer']),
  w('wander-02', '살해 매화', 'w', [6, 5, 5, 3, 4, 4], ['archer']),
  w('wander-03', '읍차 나리', 'w', [2, 3, 6, 6, 9, 5], ['charm']),
  w('wander-04', '험측 소리', 'w', [4, 4, 8, 4, 5, 3], ['nighteye']),
  w('wander-05', '견지 버들', 'w', [3, 5, 4, 8, 6, 7], ['farmer', 'careful']),
  w('wander-06', '번예 새벽', 'w', [5, 4, 6, 3, 5, 5], ['mountain']),
  w('wander-07', '읍차 가온', 'w', [2, 2, 5, 5, 7, 8], ['shaman']),
  w('wander-08', '살해 물결', 'w', [5, 5, 5, 4, 4, 4], ['river']),
  w('wander-09', '신지 별하', 'w', [4, 6, 7, 6, 6, 7], ['careful']),
  w('wander-10', '번예 연이', 'w', [3, 3, 4, 6, 8, 5], ['trader']),
  w('wander-11', '험측 바위', 'g', [8, 6, 3, 3, 3, 6], ['glutton']),
  w('wander-12', '견지 쇠울', 'g', [5, 5, 4, 6, 4, 7], ['smith']),
  w('wander-13', '살해 노을', 'w', [6, 6, 6, 3, 5, 3], ['coward', 'nighteye']),
  w('wander-14', '읍차 한결', 'g', [4, 7, 5, 5, 6, 8], ['hundred']),
  w('wander-15', '번예 단비', 'w', [3, 4, 5, 7, 6, 4], ['drinker', 'farmer']),
  w('wander-16', '견지 아름', 'w', [5, 6, 6, 5, 7, 6], ['ironhand']),
  w('wander-17', '살해 마파람', 'g', [7, 5, 6, 2, 3, 3], ['river', 'mountain']),
  w('wander-18', '신지 고은', 'w', [3, 5, 7, 7, 7, 2], ['traitor', 'charm']),
  w('wander-19', '험측 하늘', 'g', [6, 4, 4, 4, 4, 5], ['archer']),
  w('wander-20', '번예 이슬', 'w', [4, 4, 7, 4, 6, 4], ['nighteye', 'trader']),
]
