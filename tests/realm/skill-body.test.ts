import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { SKILL_BODY } from '../../src/realm/data/skill-body.ts'
import { skillCutHtml } from '../../src/ui/realm/skillfx.ts'

test('비기 전신 그림: 적힌 것은 파일이 있다', () => {
  for (const id of SKILL_BODY) assert.ok(existsSync(`public/realm/skill-body/${id}.jpg`), id)
})

test('비기 컷인: 전신 그림이 있으면 초상 대신 전신', () => {
  const id = [...SKILL_BODY][0] ?? 'g-64-jumong'
  const h = skillCutHtml('A/', 'snipe', id, '주몽', '활', 'hit')
  assert.ok(h.includes(`A/skill-body/${id}.jpg`))
  assert.ok(h.includes('wsk-bust body'))
  const plain = skillCutHtml('A/', 'snipe', 'test-no-skill-body', '노을', '활', 'hit')
  assert.ok(plain.includes('A/bust/test-no-skill-body.jpg'))
})

test('해비는 새로 교정한 양팔 컷인을 사용한다', () => {
  const html = skillCutHtml('A/', 'snipe', 'w-95-michuhol-haebi', '해비', '천지 가르기', 'hit')
  assert.ok(html.includes('A/skill-body/w-95-michuhol-haebi.jpg'))
  assert.ok(html.includes('wsk-bust body'))
})
