/**
 * 처음 뜨는 DOM 판을 미리 한 번 그려 두기 — 열전 레벨업 카드 창 · 비기 컷인 띠 (11-22 · 4배 느린 CPU 에서 처음 뜰 때만 카드 창 70~100ms · 컷인 90~130ms 끊김).
 *
 * 처음 한 번만 비싼 것: 새 글자가 든 글꼴 조각 받기 · 그 크기의 글자 모양 잡기 · 테두리·띠 바탕·장수 그림 풀기 · 칠하기 셰이더.
 * 두 번째부터는 싸다 — 그래서 출전 화면에서 같은 HTML 을 화면 크기 상자에 한 번 깔아 그 값을 미리 치른다.
 * visibility 로 숨기면 칠하지 않아 반만 풀린다 → 아주 옅게(HAEBI_WARM.opacity · 8비트 화면에서 0) 실제로 칠하게 둔다
 * (will-change 로 따로 칠한 판을 옅게 얹는다 · 옅기를 칠하는 쪽에 맡기면 0 으로 떨어져 아예 안 칠한다).
 * 애니도 판에서처럼 돌린다 — 띠·장수가 커졌다 줄며 칠하는 크기가 바뀌는 것까지 같아야 그림이 그 크기로 풀린다.
 * 누를 수 없고(inert · pointer-events) 읽히지 않는다(aria-hidden). 판 셈은 건드리지 않는다. 가려진 탭에서는 기다렸다가 보일 때 한다 (가려진 탭은 칠하지 않는다).
 */
import { HAEBI_WARM as W } from '../tune/params.ts'

/** 한 겹 — 화면 크기 상자 하나에 깔 HTML · 그 상자의 꼴(카드 창은 #overlay 처럼 가운데 정렬) */
export interface WarmLayer { readonly html: string; readonly style?: string }

const CSS = '.raid-warm{position:fixed;inset:0;pointer-events:none;overflow:hidden;contain:strict;z-index:2147483000;will-change:opacity}.raid-warm>div{position:absolute;inset:0}'
let styled = false
const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
const shown = (): Promise<void> => !document.hidden ? Promise.resolve() : new Promise((r) => {
  const on = () => { if (document.hidden) return; document.removeEventListener('visibilitychange', on); r() }
  document.addEventListener('visibilitychange', on)
})

/**
 * host 끝에 겹들을 깔고 · 글꼴·그림이 다 온 뒤 holdMs 동안 칠하게 두었다가 걷는다. 끝나면 true (도중에 잘못돼도 상자는 걷는다).
 * inside: 화면 전체 대신 host 상자 크기로 (컷인 띠처럼 판 안 크기로 그려지는 것 — 그림은 그리는 크기마다 따로 풀린다)
 */
export async function warmDom(host: HTMLElement, layers: readonly WarmLayer[], inside = false): Promise<boolean> {
  if (!styled) { styled = true; const s = document.createElement('style'); s.dataset['raidWarm'] = '1'; s.textContent = CSS; document.head.append(s) }
  await shown()
  const box = document.createElement('div')
  box.className = 'raid-warm'; box.setAttribute('aria-hidden', 'true'); box.inert = true; box.style.opacity = String(W.opacity)
  if (inside) box.style.position = 'absolute'
  box.innerHTML = layers.map((l) => `<div${l.style ? ` style="${l.style}"` : ''}>${l.html}</div>`).join('')
  host.append(box)
  try {
    void box.offsetHeight   // 지금 배치해 글꼴 조각 받기를 바로 시작한다
    await Promise.all([...box.querySelectorAll('img')].map((i) => i.decode().catch(() => undefined)))
    await document.fonts.ready
    await wait(W.holdMs)
    return true
  } catch { return false } finally { box.remove() }
}
