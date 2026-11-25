import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

/**
 * 그리는 쪽이 sim 상태를 건드리지 않는지 글자로 훑는다 (완전하지 않다: 한계는 아래 두 가지만 막는다).
 *  1) viewRead.ts 만 sim 의 타입·상태·sim 을 import 한다 (다른 view*.ts 는 VModel 만 안다)
 *  2) viewRead.ts 에 대입·증감·push 같은 쓰기가 없다 (새 객체를 만드는 return 만)
 */
const DIR = path.resolve(import.meta.dirname, '../../src/field')
const views = fs.readdirSync(DIR).filter(f => /^view.*\.ts$/.test(f))

test('viewRead.ts 말고는 sim 쪽 파일을 import 하지 않는다', () => {
  assert.ok(views.includes('viewRead.ts'))
  for (const f of views) {
    if (f === 'viewRead.ts') continue
    const text = fs.readFileSync(path.join(DIR, f), 'utf8')
    const bad = text.match(/from '\.\/(types|state|sim|rec|scenario|num)\.ts'/g) ?? []
    assert.deepEqual(bad, [], f)
  }
})

test('viewRead.ts 는 읽기만 한다', () => {
  const text = fs.readFileSync(path.join(DIR, 'viewRead.ts'), 'utf8').split('\n').filter(l => !l.trim().startsWith('*') && !l.trim().startsWith('//') && !l.trim().startsWith('/*')).join('\n')
  assert.deepEqual(text.match(/\bs\.[\w.\[\]]+\s*(=(?!=)|\+\+|--|\+=|-=)/g) ?? [], [])
  assert.deepEqual(text.match(/\bs\.[\w.]*\.(push|pop|splice|shift|unshift|sort|length\s*=)/g) ?? [], [])
})

test('view*.ts 는 DOM 이 아닌 곳에서 시계·난수를 쓰지 않는다 (렌더 난수는 해시)', () => {
  for (const f of views) {
    const text = fs.readFileSync(path.join(DIR, f), 'utf8')
    assert.deepEqual(text.match(/Math\.random|Date\.now/g) ?? [], [], f)
  }
})
