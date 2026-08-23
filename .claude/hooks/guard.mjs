#!/usr/bin/env node
/**
 * 정관 자동 집행기 (harness guard)
 *
 * 파일이 수정될 때마다 실행되어 docs/ARCHITECTURE.md 의 절대 규칙을 기계적으로 검사한다.
 * 사람이 리뷰에서 잡기 전에, 쓰는 순간 막는 게 목적이다.
 * exit 2 = 차단 + stderr 내용을 에이전트에게 되돌려줌.
 */
import { readFileSync } from 'node:fs'

let payload = ''
try {
  payload = readFileSync(0, 'utf8')
} catch {
  process.exit(0)
}

let file
try {
  file = JSON.parse(payload)?.tool_input?.file_path
} catch {
  process.exit(0)
}
if (!file) process.exit(0)

const norm = file.split('\\').join('/')
if (!/\.m?ts$/.test(norm)) process.exit(0)
if (/\/(tests|tools|node_modules)\//.test(norm)) process.exit(0)

let src = ''
try {
  src = readFileSync(file, 'utf8')
} catch {
  process.exit(0)
}

const lines = src.split('\n')
const problems = []
const isComment = (t) => t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')

const flag = (re, rule, fix) => {
  lines.forEach((line, i) => {
    const t = line.trim()
    if (isComment(t)) return
    if (re.test(line)) problems.push({ line: i + 1, text: t.slice(0, 90), rule, fix })
  })
}

// --- A1 결정론: sim/core 레이어는 비결정적 소스를 만지면 안 된다 ---
if (/\/src\/(sim|core)\//.test(norm) && !/\/core\/rng\.ts$/.test(norm)) {
  flag(/\bMath\.random\s*\(/, 'A1 결정론', 'core/rng.ts 의 시드 RNG를 주입받아 사용할 것')
  flag(/\b(Date\.now|performance\.now)\s*\(|\bnew Date\s*\(/, 'A1 결정론', '시뮬레이션 내부 tick 시계를 사용할 것')
  flag(/\b(document|window|localStorage|requestAnimationFrame)\b/, 'A1 레이어 분리', 'sim/core 는 DOM을 모른다. game/ 또는 render/ 로 옮길 것')
}

// --- A1 레이어 분리: render 는 게임 상태를 읽기만 한다 ---
if (/\/src\/render\//.test(norm)) {
  flag(/\b(state|world|sim|archer|bow|stage)\.[A-Za-z_$][\w.$]*\s*(=[^=]|\+=|-=|\*=|\/=|\+\+|--)/,
    'A1 레이어 분리', 'render/ 는 게임 상태를 변경할 수 없다. 변경은 sim/ 또는 game/ 에서')
}

// --- A2 튜닝 상수 단일 출처 ---
if (/\/src\/(sim|game)\//.test(norm)) {
  const OBVIOUS = new Set(['0.0', '1.0', '0.5', '2.0'])
  lines.forEach((line, i) => {
    const t = line.trim()
    if (isComment(t)) return
    const m = t.match(/(?:[<>]=?|[*/+-]|\breturn\b)\s*(\d+\.\d+)/)
    const v = m && m[1]
    if (v && !OBVIOUS.has(v)) {
      problems.push({
        line: i + 1,
        text: t.slice(0, 90),
        rule: 'A2 매직넘버',
        fix: `${v} 를 src/tune/params.ts 로 옮기고 P.<영역>.<이름> 으로 참조할 것`,
      })
    }
  })
}

// --- A6 런타임 의존성 0 ---
if (/\/src\//.test(norm)) {
  flag(/^\s*import\s[^'"]*from\s*['"](?!\.|\/|node:)/,
    'A6 의존성', '런타임 npm 패키지 금지. 직접 구현하거나 ARCHITECTURE.md A6 3문답을 먼저 문서화할 것')
}

if (problems.length === 0) process.exit(0)

const rel = norm.split('/').slice(-3).join('/')
console.error(`\n[정관 위반] ${rel} — ${problems.length}건\n`)
for (const p of problems.slice(0, 12)) {
  console.error(`  L${p.line}  ${p.rule}`)
  console.error(`        ${p.text}`)
  console.error(`     → ${p.fix}\n`)
}
if (problems.length > 12) console.error(`  ... 외 ${problems.length - 12}건\n`)
console.error('docs/ARCHITECTURE.md 참조. 고친 뒤 다시 저장할 것.\n')
process.exit(2)
