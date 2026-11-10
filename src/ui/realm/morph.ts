/**
 * 바뀐 곳만 고친다 — innerHTML 로 통째로 갈아 끼우면 그림(얼굴·아이콘·카드 바탕)이 새로 만들어지며 한 박자 깜빡인다
 * (형 10-24: "교환할 때 뭐 누를 때마다 화면 깜빡거림"). 같은 자리·같은 꼴의 요소는 그대로 두고 속성·글만 맞춘다.
 * 이벤트는 모두 위임(data-act)이라 요소를 살려 두어도 두 번 붙지 않는다.
 *
 * keyed — 자리만 보지 않고 꼴(태그 + data-k 또는 첫 클래스)로 맞춘다. 가운데에 하나가 끼거나 빠지면 그 뒤가 한 칸씩
 * 밀려 모두 남의 속성·그림으로 덮어써지던 것을, 낀 것만 넣고 빠진 것만 뺀다 (형 10-31: 전투에서 합이 풀릴 때·끝날 때 낱낱이 깜빡).
 */
export function morph(el: Element, html: string, keyed = false): void {
  const tpl = document.createElement('template')
  tpl.innerHTML = html
  children(el, tpl.content, keyed)
}

/** 만들어 둔 조각(template.content 등)으로 — 문자열을 다시 읽지 않고 */
export function morphInto(el: Element, frag: Node, keyed = false): void {
  children(el, frag, keyed)
}

function children(a: Node, b: Node, keyed: boolean): void {
  if (keyed) { keyedChildren(a, b); return }
  const an = [...a.childNodes]
  const bn = [...b.childNodes]
  for (let i = 0; i < bn.length; i++) {
    const x = an[i]
    const y = bn[i]!
    if (x === undefined) a.appendChild(y)
    else one(a, x, y, keyed)
  }
  for (let i = bn.length; i < an.length; i++) a.removeChild(an[i]!)
}

/** 요소의 꼴 — 태그 + data-k (없으면 첫 클래스) · 글은 노드 이름 */
function idOf(n: Node): string {
  if (n.nodeType !== Node.ELEMENT_NODE) return n.nodeName
  const e = n as Element
  return `${e.nodeName}.${e.getAttribute('data-k') ?? e.classList[0] ?? ''}`
}

const bump = (m: Map<string, number>, k: string, d: number): void => { m.set(k, (m.get(k) ?? 0) + d) }

/**
 * 꼴로 맞추되 욕심껏 한 번만 훑는다 — 옛 것이 새 줄에 더는 없고 새 것이 옛 줄 뒤에 있으면 옛 것을 빼고,
 * 새 것이 옛 줄에 없고 옛 것이 새 줄 뒤에 있으면 새 것을 끼운다. 둘 다 아니면 예전처럼 그 자리에서 고친다
 */
function keyedChildren(a: Node, b: Node): void {
  const an = [...a.childNodes]
  const bn = [...b.childNodes]
  const ak = an.map(idOf)
  const bk = bn.map(idOf)
  const leftA = new Map<string, number>()
  const leftB = new Map<string, number>()
  for (const k of ak) bump(leftA, k, 1)
  for (const k of bk) bump(leftB, k, 1)
  let i = 0
  for (let j = 0; j < bn.length; j++) {
    const y = bn[j]!
    const yk = bk[j]!
    while (i < an.length && ak[i] !== yk && (leftB.get(ak[i]!) ?? 0) === 0 && (leftA.get(yk) ?? 0) > 0) {
      a.removeChild(an[i]!)
      bump(leftA, ak[i]!, -1)
      i++
    }
    const x = an[i]
    if (x === undefined) { a.appendChild(y); bump(leftB, yk, -1); continue }
    const xk = ak[i]!
    if (xk !== yk && (leftA.get(yk) ?? 0) === 0 && (leftB.get(xk) ?? 0) > 0) { a.insertBefore(y, x); bump(leftB, yk, -1); continue }
    one(a, x, y, true)
    bump(leftA, xk, -1)
    bump(leftB, yk, -1)
    i++
  }
  for (; i < an.length; i++) a.removeChild(an[i]!)
}

/** 지난번에 이 요소에 준 style 글 · 그 속성 이름들 — 글이 같으면 건드리지 않고, 다르면 바뀐 속성만 고친다 (코드가 따로 단 속성은 둔다) */
const styleSeen = new WeakMap<Element, { text: string; props: string[] }>()
function mergeStyle(xe: HTMLElement, ye: HTMLElement): void {
  const text = ye.getAttribute('style') ?? ''
  const prev = styleSeen.get(xe)
  if (prev?.text === text) return
  const props = [...ye.style]
  for (const p of prev?.props ?? []) if (!props.includes(p)) xe.style.removeProperty(p)
  for (const p of props) {
    const v = ye.style.getPropertyValue(p)
    if (xe.style.getPropertyValue(p) !== v) xe.style.setProperty(p, v, ye.style.getPropertyPriority(p))
  }
  styleSeen.set(xe, { text, props })
}

function one(parent: Node, x: Node, y: Node, keyed: boolean): void {
  if (x.nodeType !== y.nodeType || x.nodeName !== y.nodeName) { parent.replaceChild(y, x); return }
  if (x.nodeType !== Node.ELEMENT_NODE) { if (x.nodeValue !== y.nodeValue) x.nodeValue = y.nodeValue; return }
  const xe = x as Element
  const ye = y as Element
  // 캔버스의 width·height 는 그림판 크기를 코드가 정한다 — 지우면 그린 그림이 날아간다 (mapcanvas.ts)
  const keepSize = xe instanceof HTMLCanvasElement
  // data-live="style data-zl" — 코드가 살아서 바꾸는 속성 (지도 칸의 배율·높이·--z · 줌 단계). 지우고 다시 쓰면 그때마다 아래 모든 요소의 스타일을 다시 셈한다 (카드 C)
  const live = ye.getAttribute('data-live')?.split(' ') ?? []
  for (const at of [...xe.attributes]) if (!ye.hasAttribute(at.name) && !live.includes(at.name) && !(keepSize && (at.name === 'width' || at.name === 'height'))) xe.removeAttribute(at.name)
  for (const at of [...ye.attributes]) {
    if (at.name === 'style' && live.includes('style')) { mergeStyle(xe as HTMLElement, ye as HTMLElement); continue }
    if (xe.getAttribute(at.name) !== at.value) xe.setAttribute(at.name, at.value)
  }
  if (xe instanceof HTMLInputElement && ye instanceof HTMLInputElement && xe.value !== ye.value && document.activeElement !== xe) xe.value = ye.value
  children(xe, ye, keyed)
}
