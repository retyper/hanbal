/**
 * 다국어 현황 조사 (docs/realm/I18N.md) — src/ 의 한글이 든 문자열·템플릿 글을 파일마다 센다.
 * 보고만 한다(실패하지 않는다). 주석은 안 센다. t() 로 옮긴 글은 ko.ts 에 있으니 src/i18n 은 센 뒤 따로 보인다.
 *   npx tsx tools/i18n-lint.ts           → 위 30 파일 표 + 묶음별 합계
 *   npx tsx tools/i18n-lint.ts --write   → tools/i18n-baseline.json 갱신
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

const files: string[] = []
const walk = (d: string): void => {
  for (const f of readdirSync(d)) {
    const p = join(d, f)
    if (statSync(p).isDirectory()) walk(p)
    else if (p.endsWith('.ts')) files.push(p.split(String.fromCharCode(92)).join('/'))
  }
}
walk('src')

const HANGUL = /[가-힣]/
const LIT = new Set([ts.SyntaxKind.StringLiteral, ts.SyntaxKind.NoSubstitutionTemplateLiteral, ts.SyntaxKind.TemplateHead, ts.SyntaxKind.TemplateMiddle, ts.SyntaxKind.TemplateTail])

type Group = 'ui' | 'data' | 'sim' | 'i18n' | 'other'
function groupOf(f: string): Group {
  if (f.startsWith('src/i18n/')) return 'i18n'
  if (f.startsWith('src/ui/')) return 'ui'
  if (f.startsWith('src/realm/data/')) return 'data'
  if (f.startsWith('src/realm/')) return 'sim'
  return 'other'
}

const perFile: Record<string, { lits: number; chars: number; group: Group }> = {}
for (const f of files) {
  const src = readFileSync(f, 'utf8')
  const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true)
  let lits = 0
  let chars = 0
  const visit = (node: ts.Node): void => {
    if (LIT.has(node.kind)) {
      const text = (node as ts.LiteralLikeNode).text
      if (HANGUL.test(text)) { lits++; chars += (text.match(/[가-힣]/g) ?? []).length }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  if (lits > 0) perFile[f] = { lits, chars, group: groupOf(f) }
}

const rows = Object.entries(perFile).sort((a, b) => b[1].lits - a[1].lits)
console.log('순위  글 수   한글자  묶음  파일')
rows.slice(0, Number(process.argv[process.argv.indexOf('--top') + 1]) || 30).forEach(([f, v], i) => console.log(`${String(i + 1).padStart(3)}  ${String(v.lits).padStart(6)}  ${String(v.chars).padStart(7)}  ${v.group.padEnd(5)} ${f}`))
const totals: Record<string, { files: number; lits: number; chars: number }> = {}
for (const [, v] of rows) {
  const t = (totals[v.group] ??= { files: 0, lits: 0, chars: 0 })
  t.files++; t.lits += v.lits; t.chars += v.chars
}
console.log('\n묶음별 합계 (ui = src/ui · data = src/realm/data · sim = src/realm 나머지 · i18n = 옮긴 곳)')
for (const [g, t] of Object.entries(totals)) console.log(`${g.padEnd(6)} 파일 ${String(t.files).padStart(4)} · 글 ${String(t.lits).padStart(6)} · 한글자 ${String(t.chars).padStart(8)}`)
const all = rows.reduce((s, [, v]) => s + v.lits, 0)
console.log(`전체   글 ${all}`)

if (process.argv.includes('--write')) {
  writeFileSync('tools/i18n-baseline.json', JSON.stringify({ totals, total: all, files: Object.fromEntries(rows.map(([f, v]) => [f, v.lits])) }, null, 1) + '\n')
  console.log('tools/i18n-baseline.json 갱신')
}
