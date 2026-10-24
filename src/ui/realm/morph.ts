/**
 * 바뀐 곳만 고친다 — innerHTML 로 통째로 갈아 끼우면 그림(얼굴·아이콘·카드 바탕)이 새로 만들어지며 한 박자 깜빡인다
 * (형 10-24: "교환할 때 뭐 누를 때마다 화면 깜빡거림"). 같은 자리·같은 꼴의 요소는 그대로 두고 속성·글만 맞춘다.
 * 이벤트는 모두 위임(data-act)이라 요소를 살려 두어도 두 번 붙지 않는다.
 */
export function morph(el: Element, html: string): void {
  const tpl = document.createElement('template')
  tpl.innerHTML = html
  children(el, tpl.content)
}

function children(a: Node, b: Node): void {
  const an = [...a.childNodes]
  const bn = [...b.childNodes]
  for (let i = 0; i < bn.length; i++) {
    const x = an[i]
    const y = bn[i]!
    if (x === undefined) a.appendChild(y)
    else one(a, x, y)
  }
  for (let i = bn.length; i < an.length; i++) a.removeChild(an[i]!)
}

function one(parent: Node, x: Node, y: Node): void {
  if (x.nodeType !== y.nodeType || x.nodeName !== y.nodeName) { parent.replaceChild(y, x); return }
  if (x.nodeType !== Node.ELEMENT_NODE) { if (x.nodeValue !== y.nodeValue) x.nodeValue = y.nodeValue; return }
  const xe = x as Element
  const ye = y as Element
  for (const at of [...xe.attributes]) if (!ye.hasAttribute(at.name)) xe.removeAttribute(at.name)
  for (const at of [...ye.attributes]) if (xe.getAttribute(at.name) !== at.value) xe.setAttribute(at.name, at.value)
  if (xe instanceof HTMLInputElement && ye instanceof HTMLInputElement && xe.value !== ye.value && document.activeElement !== xe) xe.value = ye.value
  children(xe, ye)
}
