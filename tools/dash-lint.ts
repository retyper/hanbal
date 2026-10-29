/**
 * 긴 줄표(—) 점검 — 화면에 뜨는 글(문자열·템플릿 글)에 「—」가 있으면 알린다 (형 10-29: "긴 대시 문자 텍스트에 보이게 하지 마 · AI 만 이런 거 써 · 키보드에도 없는 문자").
 * 주석은 안 본다 · 글 속 CSS 주석(／* … *／)도 뺀다 · src/tune/params.ts 는 손맛 조율판(개발용) 이름표라 뺀다.
 *   npx tsx tools/dash-lint.ts          → 곳마다 한 줄 · 끝에 「N 곳」
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

const ROOTS = ['src']
const files: string[] = []
const walk = (d: string): void => {
  for (const f of readdirSync(d)) {
    const p = join(d, f)
    if (statSync(p).isDirectory()) walk(p)
    else if (p.endsWith('.ts')) files.push(p)
  }
}
for (const r of ROOTS) walk(r)
const SKIP = /tune[\\/]params\.ts$/

const LIT = new Set([ts.SyntaxKind.StringLiteral, ts.SyntaxKind.NoSubstitutionTemplateLiteral, ts.SyntaxKind.TemplateHead, ts.SyntaxKind.TemplateMiddle, ts.SyntaxKind.TemplateTail])
let n = 0
for (const f of files.filter((x) => !SKIP.test(x))) {
  const src = readFileSync(f, 'utf8')
  const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true)
  const visit = (node: ts.Node): void => {
    if (LIT.has(node.kind)) {
      const raw = node.getText(sf).replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '')
      if (raw.includes('—')) {
        const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf))
        n++
        console.log(`${f}:${line + 1}  ${raw.slice(0, 90).replace(/\s+/g, ' ')}`)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
}
console.log(`${n} 곳`)
