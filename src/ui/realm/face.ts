/**
 * 화면에 그리는 장수 얼굴 파일 — 각성한 장수는 각성 초상으로 (형 10-31).
 * bustOf 는 나이·목소리 같은 판단에도 쓰이므로 건드리지 않고, 그림 주소를 만들 때만 이걸 쓴다.
 * 돌려주는 값은 `bust/` 뒤에 붙는 이름 — 각성 초상은 `../awaken-hd/<초상 id>` 라서 bust/·bust-hd/ 어느 쪽에 붙어도 900px 각성 그림이 뜬다.
 */
import { bustOf } from '../../realm/data/art.ts'
import { AWAKEN_ART } from '../../realm/data/awaken-art.ts'
import type { Realm } from '../../realm/types.ts'

let ascended: ReadonlySet<string> = new Set()

/** 판이 바뀔 때마다 — 각성한 장수 id 를 다시 센다 (화면은 판을 읽기만 한다) */
export function noteAscended(r: Realm | null): void {
  ascended = new Set(r === null ? [] : Object.values(r.heroes).filter((h) => h.ascended === true).map((h) => h.id))
}

export function faceFile(id: string): string | undefined {
  const b = bustOf(id)
  return b !== undefined && ascended.has(id) && AWAKEN_ART.has(b) ? `../awaken-hd/${b}` : b
}
