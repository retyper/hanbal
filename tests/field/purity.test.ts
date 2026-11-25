import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

/** sim 쪽 파일: src/field 의 .ts 가운데 그리는 쪽(view*)·진입점(main*)이 아닌 것 전부. 새 sim 파일은 이 배열에 넣는다. */
const DIR = path.resolve(import.meta.dirname, '../../src/field')
const SIM_FILES = ['types', 'num', 'state', 'sim', 'rec', 'scenario', 'map', 'input', 'pickmodel']
const BANNED = /\*\*|new Date|Math\.(random|sin|cos|tan|atan2?|asin|acos|hypot|pow|exp|log|log2|log10|cbrt)\b|Date\.now|performance\.now|\bdocument\b|\bwindow\b|localStorage|requestAnimationFrame|setTimeout|setInterval/g

/** 주석과 문자열 속 글자는 세지 않는다 */
function code(text: string): string {
  let out = '', i = 0
  while (i < text.length) {
    const c = text[i]!, n = text[i + 1]
    if (c === '/' && n === '/') { while (i < text.length && text[i] !== '\n') i++; continue }
    if (c === '/' && n === '*') { i += 2; while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++; i += 2; continue }
    if (c === '"' || c === "'" || c === '`') {
      i++
      while (i < text.length && text[i] !== c) { if (text[i] === '\\') i++; i++ }
      i++; out += '""'; continue
    }
    out += c; i++
  }
  return out
}

const simFiles = (): string[] => fs.readdirSync(DIR).filter(f => f.endsWith('.ts') && !/^(view|main)/.test(f)).map(f => f.slice(0, -3))

test('sim 쪽 파일 목록이 폴더와 같다 (새 sim 파일은 이 시험의 배열에 넣는다)', () => {
  assert.deepEqual(simFiles().sort(), [...SIM_FILES].sort())
})

test('sim 쪽 파일에 난수·시계·DOM·삼각함수 0건', () => {
  for (const f of SIM_FILES) {
    const hits = code(fs.readFileSync(path.join(DIR, f + '.ts'), 'utf8')).match(BANNED) ?? []
    assert.deepEqual(hits, [], `${f}.ts`)
  }
})

test('검사기가 제대로 잡는다 (주석·문자열은 거르고 코드는 센다)', () => {
  assert.equal((code('const a = Math.sin(1) // Math.cos').match(BANNED) ?? []).length, 1)
  assert.equal((code("const a = 'Math.random' /* Date.now */").match(BANNED) ?? []).length, 0)
  assert.equal((code('x = `window ${Math.random()}`').match(BANNED) ?? []).length, 0)
})
