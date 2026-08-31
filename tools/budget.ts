export {}
/**
 * 번들 예산 검사 — **GDD 1장 C6을 실제로 막는 자.**
 *
 * 왜 생겼나: GDD C6은 "CI에서 번들 크기 측정"이라고 적혀 있었는데 `deploy.yml`에는
 * 그런 단계가 없었다. 그동안 사람이 손으로 세고 있었다 — 문서가 거짓말을 하고 있었던 것이다.
 *
 * 왜 자가 둘인가 (2026-08-25, 형: "크기 굳이 꾸역꾸역 작게 제한할 필요 없어"):
 *   예전 C6은 **raw 150KB** 하나였는데, 그건 유저가 내는 값이 아니다.
 *     · 유저가 첫 방문에 실제로 받는 건 **압축된 바이트**다 (gzip ~35%). 그게 로딩 시간이다.
 *     · CPU가 파싱하는 건 **raw 바이트**다. 그건 저사양 기기에서만 의미가 있다.
 *   둘은 다른 것을 지키므로 자도 둘이어야 한다. 하나로 세면 반드시 한쪽을 잘못 잰다.
 *
 * 이 숫자의 진짜 일은 로딩 속도가 아니라 **"런타임 의존성 0개"의 방아쇠**다 (ARCHITECTURE A6).
 * 세는 걸 그만두면 언젠가 게임 엔진이 들어온다. 그러니 넉넉하되, 반드시 센다.
 *
 * 실행: node --experimental-strip-types tools/budget.ts
 */
import { gzipSync } from 'node:zlib'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/** dist 전체의 상한. 청크 하나가 아니라 **첫 방문이 받는 총량**이 유저의 경험이다. */
const LIMIT = {
  /** 전송 크기 (gzip, KB). 로딩 시간을 지배하는 값. */
  gzipKB: 90,
  /** 파싱 크기 (raw, KB). 저사양 기기의 CPU가 내는 값. */
  rawKB: 260,
} as const

const DIST = 'dist'

function walk(dir: string, out: string[]): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

let files: string[]
try {
  files = walk(DIST, [])
} catch {
  console.error(`✗ ${DIST}/ 가 없다. 먼저 npm run build.`)
  process.exit(1)
}

// public/ 에서 복사돼 온 것(소리·스프라이트·글꼴)은 세지 않는다 — 번들이 아니고,
// 첫 페인트를 막지도 않는다 (소리는 첫 제스처 뒤에 받고 audio/samples.ts,
// 글꼴 CSS는 첫 프레임 뒤에 ui/overlay.ts 가 붙인다 · font-display: swap).
//
// 확장자만 보면 public/fonts/fonts.css 같은 것이 '번들 CSS'로 잡힌다 (2026-08-31에
// 실제로 그렇게 잡혀 예산을 1KB 넘겼다). 그래서 **public/ 의 실제 파일 목록**과 대조한다 —
// 규칙을 글로만 적어두면 언젠가 또 어긋난다.
const publicFiles = new Set<string>()
try {
  for (const p of walk('public', [])) {
    publicFiles.add(p.replace(/\\/g, '/').replace(/^public\//, ''))
  }
} catch { /* public/ 이 없으면 대조할 것도 없다 */ }

const CODE = /\.(js|css|html)$/
const rows: Array<{ name: string; raw: number; gz: number }> = []
for (const f of files) {
  if (!CODE.test(f)) continue
  if (publicFiles.has(f.replace(/\\/g, '/').replace(/^dist\//, ''))) continue
  const buf = readFileSync(f)
  rows.push({ name: f.replace(/\\/g, '/'), raw: buf.length, gz: gzipSync(buf, { level: 9 }).length })
}
rows.sort((a, b) => b.raw - a.raw)

const rawSum = rows.reduce((s, r) => s + r.raw, 0)
const gzSum = rows.reduce((s, r) => s + r.gz, 0)
const kb = (n: number): string => (n / 1024).toFixed(1)

console.log('번들 예산 (GDD 1장 C6)\n')
console.log('  ' + '파일'.padEnd(34) + 'raw'.padStart(10) + 'gzip'.padStart(10))
for (const r of rows) {
  console.log('  ' + r.name.padEnd(34) + `${kb(r.raw)}KB`.padStart(10) + `${kb(r.gz)}KB`.padStart(10))
}
console.log('  ' + '─'.repeat(52))
console.log('  ' + '합계'.padEnd(33) + `${kb(rawSum)}KB`.padStart(10) + `${kb(gzSum)}KB`.padStart(10))
console.log('')

let bad = 0
function gate(label: string, got: number, limit: number): void {
  const ok = got <= limit * 1024
  if (!ok) bad++
  const pct = ((got / (limit * 1024)) * 100).toFixed(0)
  console.log(
    `  ${ok ? 'ok ' : '✗  '} ${label.padEnd(24)} ${kb(got)}KB / ${limit}KB  (${pct}%)` +
    (ok ? `  여유 ${kb(limit * 1024 - got)}KB` : '  ★ 초과'),
  )
}
gate('전송 크기 (gzip)', gzSum, LIMIT.gzipKB)
gate('파싱 크기 (raw)', rawSum, LIMIT.rawKB)

if (bad > 0) {
  console.log('\n예산 초과. 기능을 넣기 전에 먼저 줄이거나, GDD C6을 고칠 근거를 대라.')
  process.exit(1)
}
console.log('\n예산 안에 있다.')
