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
import { STAGES } from './game/stages.ts'
import { loadSave } from './game/save.ts'
import { progressOf, unlockedBows } from './game/unlocks.ts'
import { createOverlay } from './ui/overlay.ts'
import { mountGrowth, showOfflineGain, showReinforce, showRunGain, type AudioSwitch } from './ui/growth.ts'
import { mountFork, mountLoadout, mountSupply } from './ui/loadout.ts'
import { checkpointStage } from './game/stages.ts'
import { mountSandbox } from './ui/sandbox.ts'
import { mountQuiver } from './ui/quiver.ts'
import { mountDefense } from './ui/defense.ts'
import { mountSteady } from './ui/steady.ts'

const el = document.getElementById('game')
if (!(el instanceof HTMLCanvasElement)) {
  throw new Error('#game 캔버스를 찾을 수 없다')
}

// 수집 화면은 지연 청크다 (튜닝 콘솔과 같은 이유): 첫 페인트에 필요 없는 화면 코드와
// 해금 문구 뭉치를 본 번들(C6 예산 150KB)에서 뺀다. 첫 사용 순간 한 번만 불러온다.
type CollectionMod = typeof import('./ui/collection.ts')
let collection: CollectionMod | null = null
const withCollection = (fn: (m: CollectionMod) => void): void => {
  if (collection !== null) {
    fn(collection)
    return
  }
  void import('./ui/collection.ts').then((m) => {
    if (collection === null) {
      collection = m
      m.mountCollection(overlay, progressOf(save), save.unlocked, save.stars)
    }
    fn(m)
  })
}

// 지도도 지연 청크다 — 첫 3초에 필요 없는 화면이다 (형: "지도로 여행의 재미를 더해야겠어").
type MapMod = typeof import('./ui/map.ts')
let mapMod: MapMod | null = null
const withMap = (fn: (m: MapMod) => void): void => {
  if (mapMod !== null) {
    fn(mapMod)
    return
  }
  void import('./ui/map.ts').then((m) => {
    if (mapMod === null) {
      mapMod = m
      m.mountMap(
        overlay, save.stars, save.bossKills, save.bestRunStage, save.runActive,
        (index) => loop.mapJump(index),
      )
    }
    fn(m)
  })
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
// 소리 창구 — 성장·재정비 화면이 쓴다. 루프가 만들어진 뒤에야 실제로 불리므로 먼저 선언해도 된다.
const audio: AudioSwitch = {
  muted: () => loop.muted(),
  toggle: () => loop.toggleMute(),
  levelup: () => loop.ui('levelup'),
}
// 루프를 먼저 만든다 — 성장 화면의 소리 스위치가 루프의 오디오 창구를 필요로 한다.
// (루프는 overlay만 알면 되고 성장 패널이 아직 없어도 돈다. 반대 순서는 성립하지 않는다.)
const loop = createLoop(el, {
  save,
  ui: {
    paused: () => overlay.visible(),
    runGain: (line, leveled) => showRunGain(overlay, line, leveled),
    offlineGain: (gain) => showOfflineGain(overlay, gain),
    // 여정 로드아웃 (docs/RUN.md). 활·살통 목록은 해금에서 온다 — 연습궁·유엽전은 항상.
    loadout: (onStart) =>
      mountLoadout(
        overlay,
        ['practice', ...unlockedBows(save.unlocked)],
        save,
        checkpointStage(save.bossKills) + 1,
        onStart,
      ),
    // 보스 보급 3택 (docs/RUN.md) — 특수살 재고의 유일한 큰 획득처.
    supply: (offer, count, heal, onPick) => mountSupply(overlay, offer, count, save.arrowStock, heal, onPick),
    // 갈림길 2택 (docs/MEGAHIT.md §3) — 판마다(보스 제외) 뜨는 카드.
    fork: (options, onPick) => mountFork(overlay, options, onPick),
    // 여정 종료 = 재정비 (2026-09-02, 형: "죽고나서 강화하는거 바로화면에 띄워줘야").
    // 결과 머리 + 성장 줄 + '다음' → 출정. 성장 화면과 같은 줄을 쓴다 (ui/growth.ts).
    runOver: (reached, score, best, isNew, first, reason, summary, onNext) =>
      showReinforce(overlay, save, { reached, score, best, isNew, first, reason, ...summary }, audio, onNext),
    toast: (t, ms) => overlay.toast(t, ms),
    // 새로 열린 것은 구석 알림 한 줄. 모달로 막지 않는다 (C1).
    unlocked: (ids) => withCollection((m) => m.showUnlocked(overlay, ids)),
    progressed: () => {
      // 아직 한 번도 안 열었으면 갱신할 화면도 없다 — 열 때 최신 상태로 마운트된다.
      if (collection !== null) {
        collection.updateCollection(progressOf(save), save.unlocked, save.stars)
      }
      if (mapMod !== null) {
        mapMod.updateMap(save.stars, save.bossKills, save.bestRunStage, save.runActive)
      }
    },
  },
})

// 성장 화면이 스탯을 바꾸면 writeSave가 통지하고, 루프가 그걸 받아 활에 넣는다.
// 그래서 여기 onChange는 비워 둔다 — 통지 경로가 둘이면 반드시 어긋난다.
// 호흡정지 버튼 — HUD 줄의 맨 왼쪽에 선다. 성장 버튼보다 **먼저** 붙일 이유는 없다
// (steady.ts 가 prepend 한다). 손가락 화면에서만 보인다.
mountSteady(overlay, (on) => loop.steady(on))

mountGrowth(overlay, save, () => {}, audio)

// 수집 화면 — **잠긴 칸을 보여주는 것**이 이 화면의 목적이다 (HOOK ★2).
// 성장 화면 다음에 붙여야 HUD 버튼 순서가 [성장][수집]이 된다.
// 첫 페인트가 끝난 뒤 여유 시간에 마운트한다 — HUD 버튼도 그때 생긴다 (C1: 첫 발이 먼저다).
const idle: (fn: () => void) => void =
  'requestIdleCallback' in window
    ? (fn) => (window as unknown as { requestIdleCallback: (f: () => void) => void }).requestIdleCallback(fn)
    : (fn) => window.setTimeout(fn, 300)
idle(() => {
  // 캔버스에만 나오는 큰 글자(판 이름·결과 한마디)를 명조로 미리 받아둔다.
  // 브라우저는 DOM에 나온 글자만 받으므로, 이걸 안 하면 그 글자들만 대역 글꼴로 남는다.
  // 한 번에 모아 부르는 이유: unicode-range 조각 단위로 받으므로 요청 수는 몇 개뿐이다.
  let big = '판클리어쓰러졌다화살이다했0123456789-'
  for (const s of STAGES) big += s.title ?? ''
  overlay.warmFont(big)
})
idle(() => withCollection(() => {
  // 살통은 상시 버튼(성장·수집) **뒤**에 붙는다 — 가변 폭 요소가 앞에 서면
  // 매 판 누르는 버튼들의 자리가 널뛴다 (감사 UI구조).
  mountQuiver(overlay, save)
  // 방어 — 살통 바로 뒤. 둘 다 "판 도중에 지금 쓸 것을 고르는" 같은 무리다 (ui/defense.ts).
  mountDefense(overlay, save, (id) => loop.buyDefense(id))
  // 샌드박스(실험장) — 소환·판 점프. 기록에 남지 않는다.
  mountSandbox(overlay, {
    enter: () => loop.sandboxEnter(),
    exit: () => loop.sandboxExit(),
    spawn: (k) => loop.sandboxSpawn(k),
    refill: () => loop.sandboxRefill(),
    jump: (n) => loop.sandboxJump(n),
  })
  // 지도 — 수집 버튼 바로 뒤. 여정의 형태를 보여주는 자리라 같은 무리다.
  withMap(() => {})
}))

// 드래프트가 첫 프레임에 뜰 수 있으므로 화면들이 다 붙은 뒤에 시작한다.
loop.start()

// 백버퍼 크기·dpr을 실제로 계산하는 곳은 render/camera.ts 하나뿐이다. 여기서는 통지만 한다.
// 매 프레임이 아니라 이벤트로 부르는 이유: 렌더러가 리사이즈마다 배경 그라디언트를 다시 만든다.
window.addEventListener('resize', () => loop.resize(), { passive: true })
// 회전 직후에는 아직 옛 크기가 보고된다. resize가 뒤따라오지만, 안 오는 기기가 있어 같이 건다.
window.addEventListener('orientationchange', () => loop.resize(), { passive: true })
