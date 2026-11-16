import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { SKILL_BODY_AW2, aw2SkillBody } from '../../src/realm/data/skill-body-aw2.ts'
import { SKILL_BODY_AW1 } from '../../src/realm/data/skill-body-aw1.ts'
import { cutHeroPath } from '../../src/ui/cutin-band.ts'
import { SKILL_BG, skillCutHtml, type SkillId } from '../../src/ui/realm/skillfx.ts'

test('진각성 비기 전신: 적힌 것은 전신과 잘라 낸 윗몸이 있다', () => {
  assert.ok(SKILL_BODY_AW2.size > 0)
  for (const id of SKILL_BODY_AW2) {
    assert.ok(existsSync(`public/realm/skill-body/aw2/${id}.jpg`), id)
    assert.ok(existsSync(`public/realm/skill-body/aw2/cut/${id}.webp`), id)
  }
})

test('컷인 그림 고르기: 진각성 전신 → 1차 전신 → 기본 전신 → 초상', () => {
  const both = [...SKILL_BODY_AW2].find((id) => SKILL_BODY_AW1.has(id))
  if (both !== undefined) {
    assert.deepEqual(cutHeroPath(`../awaken2-hd/${both}`), { src: `skill-body/aw2/cut/${both}.webp`, cut: true })
    assert.deepEqual(cutHeroPath(`../awaken-hd/${both}`), { src: `skill-body/aw1/cut/${both}.webp`, cut: true }, '1차 각성 얼굴엔 진각성 옷을 입히지 않는다')
  }
  assert.equal(aw2SkillBody('w-95-michuhol-haebi'), null)
  assert.deepEqual(cutHeroPath('../awaken2-hd/test-none'), { src: 'bust-hd/../awaken2-hd/test-none.jpg', cut: false })
  assert.equal(cutHeroPath(null), null)
  const id = [...SKILL_BODY_AW2][0]!
  const h = skillCutHtml('A/', 'w-fire', `../awaken2-hd/${id}`, '누구', '진 불', 'hit')
  assert.ok(h.includes(`A/skill-body/aw2/cut/${id}.webp`))
})

test('기술마다 띠 바탕의 결이 있고 그림 파일이 있다', () => {
  for (const [id, bg] of Object.entries(SKILL_BG) as Array<[SkillId, string]>) assert.ok(existsSync(`public/realm/fx/skill/bg/${bg}.webp`), id)
})
