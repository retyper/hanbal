import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { SKILL_BODY_AW1, aw1SkillBody } from '../../src/realm/data/skill-body-aw1.ts'
import { skillCutHtml } from '../../src/ui/realm/skillfx.ts'

test('각성 비기 전신: 적힌 것은 파일이 있다', () => {
  for (const id of SKILL_BODY_AW1) assert.ok(existsSync(`public/realm/skill-body/aw1/${id}.jpg`), id)
})

test('각성 비기 컷인: 각성 전신이 있으면 그것, 없으면 각성 초상', () => {
  assert.equal(aw1SkillBody('w-95-michuhol-haebi'), null, '각성 안 한 얼굴은 기본 전신 몫')
  assert.equal(aw1SkillBody('../awaken-hd/test-none'), null)
  const plain = skillCutHtml('A/', 'snipe', '../awaken-hd/test-none', '누구', '활', 'hit')
  assert.ok(plain.includes('A/bust/../awaken-hd/test-none.jpg'))
  const id = [...SKILL_BODY_AW1][0]
  if (id === undefined) return
  const h = skillCutHtml('A/', 'snipe', `../awaken-hd/${id}`, '누구', '활', 'hit')
  assert.ok(h.includes(`A/skill-body/aw1/${id}.jpg`))
  assert.ok(h.includes('wsk-bust body'))
})
