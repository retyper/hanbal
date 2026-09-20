/**
 * 보스의 몸 — **그림** (2026-09-20, 형: "캐릭터 적군 보스 등등도 전부 에셋 받아서 적용해야지.")
 *
 * 여덟 보스의 몸을 public/sprites/boss-<look>.png 로 그린다. 그림이 아직 안 떴거나 헤드리스면
 * `false` 를 돌려주고, 부르는 쪽(scene.ts)은 예전 벡터 몸을 그린다 — 폴백은 지우지 않는다 (ASSETS.md 3장).
 *
 * ── 이 파일이 지키는 것 ────────────────────────────────────────────────
 * 1. **눈은 그림에 없다.** 눈은 뜨고 감는 sim 의 상태이고 곧 급소다 (bosses.ts 1번). 그림은
 *    "눈구멍이 그늘진 몸"으로 받았고, 눈은 지금처럼 그 위에 그린다.
 * 2. **그림의 눈구멍이 sim 의 급소 자리에 온다.** 그림을 놓는 기준점은 몸 중심이 아니라
 *    눈구멍이다 (EYES 의 평균) — 거기를 급소(ax, ay)에 못 박고, 크기는 〈눈 → 발밑〉 거리로 정한다.
 *    그래야 "눈을 쐈는데 안 맞았다"가 안 생긴다.
 * 3. **발은 땅에 있다.** 걷는 넷은 그림의 밑단(footV)이 footY 에 붙는다. sim 이 걸음마다 몸을
 *    들면 〈눈 → 발〉이 늘어나 그림이 살짝 늘었다 줄고, 그게 걸음으로 읽힌다.
 * 4. 읽기만 한다 (A1). 시간축은 w.elapsed 뿐이다. 프레임당 힙 할당 0 (A5) — 눈 자리는 제자리 배열에 쓴다.
 *
 * 아래 숫자는 손맛 노브가 아니라 **그림 한 장 한 장의 좌표**다 (그림을 바꾸면 같이 바뀐다).
 * 그래서 params.ts 가 아니라 그림 옆에 둔다. 재는 법: tools/preview (?hit=1).
 */
import { sprite } from './sprites.ts'

interface BossArt {
  /**
   * 눈구멍들 — 그림 안의 자리 (u, v: 0~1) 와 크기 배수 k.
   * 유령은 외눈이고, 도깨비·장승은 3/4 로 받아 두 눈의 간격이 좁다. 나머지는 정면이다.
   */
  readonly eyes: readonly (readonly [number, number, number])[]
  /** 발밑(또는 자락 끝)의 v. 트림된 그림이라 거의 1 이다. */
  readonly footV: number
  /** 흔들림 (rad) — 유령은 자락이 흔들리고, 걷는 놈은 걸음마다 기운다. 눈구멍을 축으로 돈다. */
  readonly sway: number
}

const ART: readonly BossArt[] = [
  /* 0 눈알귀신   */ { eyes: [[0.487, 0.249, 1]], footV: 0.98, sway: 0.03 },
  /* 1 갑주귀신   */ { eyes: [[0.503, 0.303, 1]], footV: 0.98, sway: 0.025 },
  /* 2 쌍눈귀신   */ { eyes: [[0.503, 0.24, 1]], footV: 0.98, sway: 0.035 },
  /* 3 폭주귀신   */ { eyes: [[0.521, 0.315, 1]], footV: 0.99, sway: 0.02 },
  /* 4 도깨비     */ { eyes: [[0.372, 0.202, 0.5], [0.461, 0.197, 0.45]], footV: 0.99, sway: 0.012 },
  /* 5 구미호     */ { eyes: [[0.45, 0.284, 0.55], [0.533, 0.284, 0.55]], footV: 0.99, sway: 0.008 },
  /* 6 장승       */ { eyes: [[0.476, 0.25, 1], [0.65, 0.24, 0.9]], footV: 0.995, sway: 0.03 },
  /* 7 저승사자   */ { eyes: [[0.464, 0.219, 0.5], [0.536, 0.219, 0.5]], footV: 0.995, sway: 0.01 },
]

/** 가장 눈이 많은 그림의 눈 수. 제자리 배열의 크기다. */
const MAX_EYES = 2

/** drawBossArt 가 채우는 눈 자리 (화면 px). 호출마다 새로 만들지 않는다 (A5). */
export interface BossEyes {
  n: number
  readonly x: Float32Array
  readonly y: Float32Array
  /** 눈 크기 배수 — 먼 쪽 눈은 조금 작다. */
  readonly k: Float32Array
}
export const BOSS_EYES: BossEyes = {
  n: 0, x: new Float32Array(MAX_EYES), y: new Float32Array(MAX_EYES), k: new Float32Array(MAX_EYES),
}

/**
 * 여덟 장을 미리 받아 둔다. sprite() 는 처음 부를 때 받기 시작하므로, 이걸 안 하면 보스가 나온
 * 첫 몇 프레임은 벡터 몸이었다가 그림으로 **툭 바뀐다.** 헤드리스에서는 아무 일도 안 한다.
 */
export function warmBossArt(): void {
  for (let look = 0; look < ART.length; look++) sprite(`boss-${look}`)
}

/**
 * 보스의 몸을 그림으로 그린다. 그렸으면 true — 그때 BOSS_EYES 에 눈 자리가 들어 있다.
 *
 * (ax, ay) 급소의 화면 자리 (sim bossWeakSpot) · bottomY 발밑 또는 자락 끝의 화면 y ·
 * phase 흔들림의 위상 (−1~1) — 유령은 느린 사인, 걷는 놈은 걸음의 위상.
 */
export function drawBossArt(
  ctx: CanvasRenderingContext2D, look: number, ax: number, ay: number, bottomY: number, phase: number,
): boolean {
  const art = ART[look]
  if (art === undefined) return false
  const im = sprite(`boss-${look}`)
  if (im === null) return false

  let au = 0
  let av = 0
  for (const e of art.eyes) { au += e[0]; av += e[1] }
  au /= art.eyes.length
  av /= art.eyes.length

  const span = (art.footV - av) * im.naturalHeight
  if (span <= 0 || bottomY <= ay) return false
  const s = (bottomY - ay) / span
  const dw = im.naturalWidth * s
  const dh = im.naturalHeight * s

  ctx.save()
  ctx.translate(ax, ay)
  ctx.rotate(art.sway * phase)
  ctx.drawImage(im, -au * dw, -av * dh, dw, dh)
  ctx.restore()

  // 눈은 돌리지 않는다 — 급소는 sim 이 정한 그 자리에 가만히 있어야 한다. 축이 눈구멍이라
  // 몸이 흔들려도 눈구멍은 제자리다.
  BOSS_EYES.n = art.eyes.length
  for (let i = 0; i < art.eyes.length; i++) {
    const e = art.eyes[i]
    if (e === undefined) continue
    BOSS_EYES.x[i] = ax + (e[0] - au) * dw
    BOSS_EYES.y[i] = ay + (e[1] - av) * dh
    BOSS_EYES.k[i] = e[2]
  }
  return true
}
