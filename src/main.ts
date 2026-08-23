/// <reference types="vite/client" />
/**
 * 진입점.
 *
 * 스플래시도 로딩 화면도 없다 (제약 C1). 탭을 열면 곧바로 판이 돌아간다.
 * 저장 복원은 M2 범위다 — 훅은 game/loop.ts 안에 있다.
 */
import { createLoop } from './game/loop.ts'

const el = document.getElementById('game')
if (!(el instanceof HTMLCanvasElement)) {
  throw new Error('#game 캔버스를 찾을 수 없다')
}

// 튜닝 콘솔은 개발 빌드에만 들어간다 (제약 C6 — 프로덕션 번들 예산).
// applyStoredTuning은 World가 만들어지기 전이어야 저장된 손맛이 반영된다.
// World를 만드는 건 createLoop이므로 순서는 반드시 [적용 → createLoop] 다.
if (import.meta.env.DEV) {
  const tune = await import('./tune/console.ts')
  tune.applyStoredTuning()
  tune.mountTuneConsole()
}

const loop = createLoop(el)
loop.start()

// 백버퍼 크기·dpr을 실제로 계산하는 곳은 render/camera.ts 하나뿐이다. 여기서는 통지만 한다.
// 매 프레임이 아니라 이벤트로 부르는 이유: 렌더러가 리사이즈마다 배경 그라디언트를 다시 만든다.
window.addEventListener('resize', () => loop.resize(), { passive: true })
// 회전 직후에는 아직 옛 크기가 보고된다. resize가 뒤따라오지만, 안 오는 기기가 있어 같이 건다.
window.addEventListener('orientationchange', () => loop.resize(), { passive: true })
