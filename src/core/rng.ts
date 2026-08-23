/**
 * 시드 난수 (ARCHITECTURE A1 — 결정론의 뿌리)
 *
 * 이 프로젝트에서 Math.random() 을 쓸 수 있는 곳은 없다. 전부 여기를 거친다.
 * 이유: 같은 시드가 같은 판을 만들어야 밸런스 시뮬·리플레이·버그 재현이 가능하다.
 *
 * mulberry32 — 32비트 상태, 빠르고 분포가 좋고 무엇보다 상태가 정수 하나라
 * 세이브/리플레이에 그대로 직렬화된다.
 */

export interface Rng {
  /** [0, 1) */
  next(): number
  /** [min, max) */
  range(min: number, max: number): number
  /** [min, max] 정수 */
  int(min: number, max: number): number
  /** 표준정규분포 근사. 산포·오차 표현용. */
  gaussian(): number
  /** true 확률 p */
  chance(p: number): boolean
  /** 현재 상태. 세이브·리플레이용. */
  state(): number
  /** 상태 복원. */
  restore(s: number): void
  /** 독립된 하위 스트림. 렌더용 난수가 sim 스트림을 오염시키지 않게 분리할 때 쓴다. */
  fork(tag: number): Rng
}

export function makeRng(seed: number): Rng {
  let s = seed >>> 0

  const next = (): number => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  return {
    next,
    range: (min, max) => min + next() * (max - min),
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    chance: (p) => next() < p,
    /**
     * Box-Muller의 짝 값을 캐시하지 않는다. 캐시하면 그 값이 RNG 상태의 일부가 되는데
     * state()가 정수 s 하나만 내보내므로 restore(seed)로 되감아도 캐시가 남아
     * 같은 시드의 다음 판이 직전 판의 난수를 쓴다 (A1 위반, 실측 확인).
     * 발사당 next() 한 번을 더 쓰는 값으로 상태를 s 하나에 완결시킨다 — 세이브·리플레이(A4)도 같이 산다.
     */
    gaussian(): number {
      // u가 정확히 0이면 log(0) = -Infinity. 뽑힐 확률은 2^-32이지만 NaN 한 번이면 판이 죽는다.
      let u = next()
      if (u === 0) u = Number.EPSILON
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next())
    },
    state: () => s,
    restore(v: number) {
      s = v >>> 0
    },
    fork(tag: number): Rng {
      return makeRng((s ^ Math.imul(tag + 1, 0x9e3779b9)) >>> 0)
    },
  }
}

/** 문자열 → 시드. 스테이지 ID나 날짜로 재현 가능한 판을 만들 때. */
export function seedFrom(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}
