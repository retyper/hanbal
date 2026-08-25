/**
 * 스프라이트 — 기성 에셋(CC0)을 가져와 쓴다 (형: "가져올 수 있는 건 가져와서 써").
 * 출처는 public/sprites/출처.txt.
 *
 * 계약:
 *  - 렌더 전용. sim은 스프라이트의 존재를 모른다 (A1 — 로딩 여부가 게임 결과를 못 바꾼다).
 *  - **없으면 null** — 헤드리스(프로브)나 로딩 전에는 벡터 폴백으로 그린다.
 *    그래서 모든 사용처는 `const im = sprite('drone'); if (im) { ... } else { 벡터 }` 꼴이다.
 */

const cache = new Map<string, HTMLImageElement>()

export function sprite(name: string): HTMLImageElement | null {
  // 헤드리스 환경(프로브·테스트)에는 Image가 없다 — 항상 벡터 폴백.
  if (typeof Image === 'undefined') return null
  let im = cache.get(name)
  if (im === undefined) {
    im = new Image()
    const base = import.meta.env.BASE_URL || '/'
    im.src = `${base}sprites/${name}.png`
    cache.set(name, im)
  }
  return im.complete && im.naturalWidth > 0 ? im : null
}
