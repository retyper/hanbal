/// <reference types="vite/client" />
/**
 * 진입점 — 조립만 한다.
 *
 * 스플래시도 로딩 화면도 없다 (제약 C1). 탭을 열면 곧바로 판이 돌아간다.
 * 여기서 하는 일은 셋뿐이다: 세이브를 읽고, 오버레이(성장 화면)를 붙이고, 루프에 넘긴다.
 *
 * 레이어 방향(A1)을 지키는 자리가 여기다. game/loop.ts 는 ui/ 를 모르고, ui/ 는 game/ 을 읽는다.
 * 둘을 아는 유일한 파일이 이 조립 파일이다.
 */
import { createLoop } from './game/loop.ts'
import { loadSave } from './game/save.ts'
import { createOverlay } from './ui/overlay.ts'
import { mountGrowth, showOfflineGain, showRunGain } from './ui/growth.ts'

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

// 세이브는 이 객체 하나뿐이다. 루프도 성장 화면도 **같은 참조**를 제자리에서 갱신한다 —
// 사본을 만들면 어느 쪽이 진실인지 알 수 없게 된다.
const save = loadSave()

const overlay = createOverlay()
// 자리를 뜰 때 패널이 열려 있으면 복귀 첫 발까지 3클릭이 든다 (닫기 → 다음 판 → 발사).
// 기준은 2클릭이다 (C1). 성장 화면은 refresh()로 매번 다시 그리므로 닫아도 잃는 상태가 없다.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) overlay.hide()
}, { passive: true })
// 루프를 먼저 만든다 — 성장 화면의 소리 스위치가 루프의 오디오 창구를 필요로 한다.
// (루프는 overlay만 알면 되고 성장 패널이 아직 없어도 돈다. 반대 순서는 성립하지 않는다.)
const loop = createLoop(el, {
  save,
  ui: {
    paused: () => overlay.visible(),
    runGain: (training, leveled) => showRunGain(overlay, training, leveled),
    offlineGain: (gain) => showOfflineGain(overlay, gain),
  },
})

// 성장 화면이 스탯을 바꾸면 writeSave가 통지하고, 루프가 그걸 받아 활에 넣는다.
// 그래서 여기 onChange는 비워 둔다 — 통지 경로가 둘이면 반드시 어긋난다.
mountGrowth(overlay, save, () => {}, {
  muted: () => loop.muted(),
  toggle: () => loop.toggleMute(),
})

loop.start()

// 백버퍼 크기·dpr을 실제로 계산하는 곳은 render/camera.ts 하나뿐이다. 여기서는 통지만 한다.
// 매 프레임이 아니라 이벤트로 부르는 이유: 렌더러가 리사이즈마다 배경 그라디언트를 다시 만든다.
window.addEventListener('resize', () => loop.resize(), { passive: true })
// 회전 직후에는 아직 옛 크기가 보고된다. resize가 뒤따라오지만, 안 오는 기기가 있어 같이 건다.
window.addEventListener('orientationchange', () => loop.resize(), { passive: true })
