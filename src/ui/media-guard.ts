/**
 * 그림 길게 누름 막기 (11-19 형: 「견지 아라 이미지 계속 누르니까 이미지 다운받기나 뭐 그런 거 뜨던데 · 이건 다 막아 놔야」).
 * 모든 게임 페이지(활터·본편·열전·겨루기·해적·밤·대회)가 처음에 한 번 부른다.
 *  - 그림·영상·캔버스: 폰이 꾹 누르면 띄우는 메뉴(저장·복사·공유) · 글자 고르기 · 끌어 옮기기를 끈다 (CSS 한 줄 + 끌기 막기)
 *  - 오른쪽 단추 메뉴(contextmenu)는 그림·영상·캔버스 위에서만 막는다 — 글 입력 칸·글은 그대로
 *  - 게임이 일부러 쓰는 길게 누름 설명(tips · holdbox · detail)은 pointer 이벤트로 돌고, 이 막기는 기본 동작만 끄며 이벤트를 멈추지 않는다
 */
const MEDIA = 'img, video, canvas, picture, svg image'
const CSS = `img, video, canvas { -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; -webkit-user-drag: none; }`

const onMedia = (t: EventTarget | null): boolean => t instanceof Element && t.closest(MEDIA) !== null && t.closest('input, textarea, [contenteditable="true"]') === null

let done = false
export function guardMedia(doc: Document = document): void {
  if (done) return
  done = true
  const style = doc.createElement('style')
  style.dataset['guard'] = 'media'
  style.textContent = CSS
  doc.head.append(style)
  doc.addEventListener('contextmenu', (e) => { if (onMedia(e.target)) e.preventDefault() })
  doc.addEventListener('dragstart', (e) => { if (onMedia(e.target)) e.preventDefault() })
}
