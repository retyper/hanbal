export {}
/**
 * 화면 스타일 프로브 — **DOM 오버레이를 브라우저 없이 재는 자.**
 *
 * probe-ui.ts 는 캔버스 HUD만 잰다("DOM 오버레이는 캔버스 밖이라 여기서 못 잰다").
 * 그쪽 절반이 계속 눈으로만 검사되어 왔고, 그래서 폰에서 **패널을 닫을 방법이 없다**는
 * 사실이 몇 달 동안 아무 게이트에도 안 걸렸다 (2026-08-31 형의 반려).
 *
 * 브라우저를 못 여는 이 데스크탑(CLAUDE.md)에서 잴 수 있는 건 픽셀이 아니라 **약속**이다.
 * 여기서 보는 것:
 *   ① CSS 문법 — 중괄호·괄호가 맞는가 (템플릿 문자열 안이라 아무도 안 검사해 준다)
 *   ② 토큰 — 쓰는 var(--x) 가 전부 정의돼 있는가 (오타 하나면 색이 통째로 사라진다)
 *   ③ 대비 — 가장 어두운 글자도 패널 바탕 대비 7:1 이상인가 (형: "회색 글씨 쳐 안 보여")
 *   ④ 애셋 — CSS가 부르는 파일이 public/ 에 실제로 있는가 (없으면 조용히 안 그려진다)
 *   ⑤ 세로 화면 규약 — 닫기 버튼·안전 영역·44px 터치 크기가 살아 있는가
 *
 * 실행: node --experimental-strip-types tools/probe-style.ts
 * 하나라도 어긋나면 종료 코드 1.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const UI_DIR = 'src/ui'
const PUBLIC = 'public'

let fails = 0
function check(ok: boolean, label: string, detail = ''): void {
  if (!ok) fails++
  console.log(`  ${ok ? 'ok ' : '✗  '} ${label.padEnd(44)} ${detail}`)
}

// ───────────────────────── CSS 모으기 ─────────────────────────

/** `const CSS = \`…\`` 안의 내용. ui/*.ts 는 전부 이 형태로 스타일을 갖는다. */
function cssOf(src: string): string {
  const out: string[] = []
  const re = /const CSS = `([\s\S]*?)`\n/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) out.push(m[1] ?? '')
  return out.join('\n')
}

const files = readdirSync(UI_DIR).filter((f) => f.endsWith('.ts'))
const sheets = new Map<string, string>()
for (const f of files) {
  const src = readFileSync(join(UI_DIR, f), 'utf8')
  const css = cssOf(src)
  if (css !== '') sheets.set(f, css)
}

console.log('한 발 — 화면 스타일 프로브 (DOM 오버레이)\n')
console.log(`  스타일시트 ${sheets.size}개: ${[...sheets.keys()].join(' · ')}\n`)

// ── ① 문법 ────────────────────────────────────────────────────
for (const [name, css] of sheets) {
  let brace = 0
  let paren = 0
  let bad = ''
  for (const ch of css) {
    if (ch === '{') brace++
    else if (ch === '}') { brace--; if (brace < 0 && bad === '') bad = '} 가 먼저 나왔다' }
    else if (ch === '(') paren++
    else if (ch === ')') { paren--; if (paren < 0 && bad === '') bad = ') 가 먼저 나왔다' }
  }
  if (brace !== 0 && bad === '') bad = `중괄호 ${brace > 0 ? '안 닫힘' : '더 닫힘'} ${brace}`
  if (paren !== 0 && bad === '') bad = `괄호 ${paren}`
  check(bad === '', `${name} — 괄호가 맞는다`, bad)
}

// ── ② 토큰 ────────────────────────────────────────────────────
const all = [...sheets.values()].join('\n')
const defined = new Set<string>()
for (const m of all.matchAll(/(--[a-z0-9-]+)\s*:/g)) defined.add(m[1] as string)
/** JS가 넣어 주는 변수 — CSS 안에는 정의가 없는 게 정상이다. */
const FROM_JS = new Set(['--tint', '--map-s'])
const missing = new Set<string>()
for (const m of all.matchAll(/var\((--[a-z0-9-]+)/g)) {
  const v = m[1] as string
  if (!defined.has(v) && !FROM_JS.has(v)) missing.add(v)
}
check(missing.size === 0, '쓰는 토큰이 전부 정의돼 있다', missing.size === 0 ? `${defined.size}개 정의` : [...missing].join(' '))

// ── ③ 대비 ────────────────────────────────────────────────────
function tokenOf(name: string): string {
  const m = new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`).exec(all)
  return m === null ? '' : (m[1] as string)
}
function lum(hex: string): number {
  const c = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * (c[0] as number) + 0.7152 * (c[1] as number) + 0.0722 * (c[2] as number)
}
function ratio(a: string, b: string): number {
  const A = lum(a)
  const B = lum(b)
  return (Math.max(A, B) + 0.05) / (Math.min(A, B) + 0.05)
}

/** 패널 바탕의 어두운 쪽. 글자는 여기 위에서도 읽혀야 한다. */
const paper = tokenOf('--paper2')
const MIN_TEXT = 7
console.log('')
for (const t of ['--ink', '--body', '--dim', '--mute', '--accent', '--teal']) {
  const hex = tokenOf(t)
  const r = hex === '' ? 0 : ratio(hex, paper)
  check(r >= MIN_TEXT, `${t} 가 패널 위에서 읽힌다`, `${hex} on ${paper} = ${r.toFixed(2)}:1 (하한 ${MIN_TEXT})`)
}
// 채운 주버튼의 글자색 — 강조색 위에 앉는다.
const onAccent = /\.hb-pri \{[^}]*color: (#[0-9a-fA-F]{6})/.exec(all)?.[1] ?? ''
check(
  onAccent !== '' && ratio(onAccent, tokenOf('--accent')) >= MIN_TEXT,
  '주버튼 글자가 강조색 위에서 읽힌다',
  `${onAccent} on ${tokenOf('--accent')} = ${onAccent === '' ? '?' : ratio(onAccent, tokenOf('--accent')).toFixed(2)}:1`,
)

// ── ④ 애셋 ────────────────────────────────────────────────────
console.log('')
const assets = new Set<string>()
for (const m of all.matchAll(/url\(\$\{BASE\}([^)]+)\)/g)) assets.add(m[1] as string)
check(assets.size > 0, 'CSS가 부르는 애셋이 있다', `${assets.size}개`)
for (const a of assets) {
  check(existsSync(join(PUBLIC, a)), `public/${a} 가 있다`)
}
// 글꼴 — fonts.css 가 부르는 조각이 전부 있는가 (하나만 없어도 그 글자만 조용히 대역으로 떨어진다).
const fontCss = join(PUBLIC, 'fonts', 'fonts.css')
if (existsSync(fontCss)) {
  const text = readFileSync(fontCss, 'utf8')
  const urls = [...text.matchAll(/url\(([^)]+)\)/g)].map((m) => m[1] as string)
  const gone = urls.filter((u) => !existsSync(join(PUBLIC, 'fonts', u)))
  check(gone.length === 0, '글꼴 조각이 전부 있다', `${urls.length}조각 · 빠진 것 ${gone.length}`)
  check(/font-display:\s*swap/.test(text), '글꼴이 첫 그림을 막지 않는다 (swap)')
  // 조각이 하나로 합쳐지면(unicode-range 없이) 한글 2MB를 통째로 받게 된다.
  check(text.includes('unicode-range'), '글꼴이 조각으로 나뉘어 있다', '쓰는 글자가 든 조각만 받는다')
} else {
  check(false, 'public/fonts/fonts.css 가 있다')
}

// ── ⑤ 세로 화면 규약 ──────────────────────────────────────────
console.log('')
const shell = sheets.get('overlay.ts') ?? ''
check(shell.includes('.hb-x'), '패널에 닫기 버튼이 있다', '폰에는 Esc 키가 없다')
check(/\.hb-x \{[\s\S]*?width: 44px/.test(shell), '닫기 버튼이 44px 이상이다')
check(shell.includes('safe-area-inset-bottom'), '아래 홈바를 피한다 (safe-area)')
check(shell.includes('safe-area-inset-left'), '옆 노치를 피한다 (safe-area)')
check(/@media \(pointer: coarse\)[\s\S]*?min-height: 44px/.test(shell), '손가락용 최소 크기 44px')
check(shell.includes('max-height: 90dvh'), '세로에서 시트가 화면을 넘지 않는다 (dvh)')
check(/@media \(max-width: 640px\)[\s\S]*?align-items: flex-end/.test(shell), '세로에서 패널이 아래에서 올라온다')
check(shell.includes('min-height: 0'), '시트 안이 스크롤된다 (flex min-height:0)')

// 캔버스 쪽 세로 규약 — HUD와 카메라가 같은 기준을 쓰는가.
const cam = readFileSync('src/render/camera.ts', 'utf8')
const hud = readFileSync('src/render/hud.ts', 'utf8')
const camAsp = /portraitAspect: ([\d.]+)/.exec(cam)?.[1] ?? ''
const hudAsp = /PORTRAIT_ASPECT = ([\d.]+)/.exec(hud)?.[1] ?? ''
check(camAsp !== '' && camAsp === hudAsp, '카메라와 HUD의 세로 기준이 같다', `${camAsp} / ${hudAsp}`)

// index.html — 뷰포트가 노치까지 덮는가 (safe-area 값이 0이 아니려면 이게 있어야 한다).
const html = readFileSync('index.html', 'utf8')
check(html.includes('viewport-fit=cover'), 'viewport-fit=cover 가 있다', 'safe-area 가 살아나는 조건')
check(html.includes('100dvh'), '캔버스가 주소창을 뺀 높이를 쓴다 (dvh)')

console.log('')
if (fails > 0) {
  console.log(`실패 ${fails}건`)
  process.exit(1)
}
console.log('전부 통과')
