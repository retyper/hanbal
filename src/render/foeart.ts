/**
 * 적의 몸 — **그림** (2026-09-20, 형: "캐릭터 적군 보스 등등도 전부 에셋 받아서 적용해야지.")
 *
 * 사람 적은 〈몸통·머리·다리〉만 그림이다. **팔과 무기는 여전히 절차적으로 그린다** (render/foe.ts) —
 * 나를 겨누는 팔, 당겨지는 시위, 물려 있는 화살이 이 게임의 예고(windup)라서 그림에 굳히면 안 된다.
 * 그래서 그림은 "팔 없는 몸"으로 받았다 (public/sprites/foe-*.png · 출처는 같은 폴더).
 *
 * 보스(render/bossart.ts)와 같은 원리다:
 * 1. **그림의 머리가 sim 의 헤드샷 자리에 온다.** 기준점은 머리 중심이고, 크기는 〈머리 → 발밑〉으로 정한다.
 * 2. 그림이 아직 안 떴거나 헤드리스면 false — 부르는 쪽이 벡터 몸을 그린다. 폴백은 지우지 않는다.
 * 3. 읽기만 한다 (A1). 프레임당 힙 할당 0 (A5).
 *
 * 아래 숫자는 손맛 노브가 아니라 **그림 한 장 한 장의 좌표**다. 재는 법: tools/preview (?hit=1).
 */
import { sprite } from './sprites.ts'

interface FoeArt {
  /** 머리 중심 — 그림 안의 자리 (0~1). */
  readonly headU: number
  readonly headV: number
  /** 발밑의 v. */
  readonly footV: number
}

const ART = {
  archer: { headU: 0.5, headV: 0.112, footV: 0.985 },
  armored: { headU: 0.485, headV: 0.112, footV: 0.985 },
  gunner: { headU: 0.345, headV: 0.2, footV: 0.985 },
  slinger: { headU: 0.43, headV: 0.108, footV: 0.985 },
  scout: { headU: 0.35, headV: 0.245, footV: 0.985 },
} as const satisfies Record<string, FoeArt>

export type FoeArtName = keyof typeof ART

/** 미리 받아 둔다 — 안 그러면 적이 나온 첫 몇 프레임은 벡터였다가 그림으로 툭 바뀐다. */
export function warmFoeArt(): void {
  for (const name of Object.keys(ART)) sprite(`foe-${name}`)
  sprite('foe-falcon-a')
  sprite('foe-falcon-b')
}

/**
 * 적의 몸을 그림으로 그린다. 그렸으면 true.
 * (hx, hy) 머리 중심의 화면 자리 (sim 의 헤드샷 자리) · footY 발밑의 화면 y.
 * 그림은 전부 **왼쪽(궁수 쪽)** 을 본다. faceRight 면 뒤집는다.
 */
export function drawFoeArt(
  ctx: CanvasRenderingContext2D, name: FoeArtName, hx: number, hy: number, footY: number, faceRight: boolean,
): boolean {
  const im = sprite(`foe-${name}`)
  if (im === null) return false
  const art = ART[name]
  const span = (art.footV - art.headV) * im.naturalHeight
  if (span <= 0 || footY <= hy) return false
  const s = (footY - hy) / span
  const dw = im.naturalWidth * s
  const dh = im.naturalHeight * s
  if (faceRight) {
    ctx.save()
    ctx.translate(hx, hy)
    ctx.scale(-1, 1)
    ctx.drawImage(im, -art.headU * dw, -art.headV * dh, dw, dh)
    ctx.restore()
  } else {
    ctx.drawImage(im, hx - art.headU * dw, hy - art.headV * dh, dw, dh)
  }
  return true
}

/**
 * 매 — 두 컷 (날개를 든 a · 내린 b). 기준점은 **눈**이다 — sim 의 급소(foeWeakSpot 3)가 눈이라서.
 * perRx 는 그림의 긴 변이 몸 반경(rx)의 몇 배인가다. 두 컷은 트림된 크기가 달라(날개를 들면 세로로 길다)
 * 같은 값을 쓰면 몸이 커졌다 작아졌다 한다 — 원본에서 **몸길이가 같도록** 잰 두 값이다 (몸길이 ≈ 2.2rx).
 */
const FALCON = {
  a: { eyeU: 0.12, eyeV: 0.805, perRx: 2.7 },
  b: { eyeU: 0.115, eyeV: 0.147, perRx: 2.36 },
} as const

/** 매를 그림으로 그린다. (ex, ey) 눈의 화면 자리 · rx 몸의 반경 · wingsUp 날개를 든 컷인가. */
export function drawFalconArt(
  ctx: CanvasRenderingContext2D, ex: number, ey: number, rx: number, wingsUp: boolean,
): boolean {
  const im = sprite(wingsUp ? 'foe-falcon-a' : 'foe-falcon-b')
  if (im === null) return false
  const f = wingsUp ? FALCON.a : FALCON.b
  const s = (rx * f.perRx) / Math.max(im.naturalWidth, im.naturalHeight)
  const dw = im.naturalWidth * s
  const dh = im.naturalHeight * s
  ctx.drawImage(im, ex - f.eyeU * dw, ey - f.eyeV * dh, dw, dh)
  return true
}
