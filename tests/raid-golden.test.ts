// 열전 판 골든 해시 (journey-study 카드 0 · 11-25) — 벽 체력(75-WALL)·초반 곡선(76-PACE)처럼 판 규칙을 새 태그로 바꿀 때,
// 태그를 안 켠 옛 판이 글자 하나 달라지지 않았는지 바로 안다. 이 해시가 깨지면 옛 기록 재생이 어긋난 것이다.
// 규칙: 지금 켜 둔 규칙을 모두 켠 판(74-BUFF 는 뺀다 · 아직 이 판에 안 붙었다) · 설치물 여덟을 처음에 모두 세우고 · 장수는 정해진 길로 걷는다.
// 해시를 일부러 바꿔야 할 때(옛 판의 규칙을 정말 고칠 때)는 이유를 커밋 글에 적고 아래 값을 새로 굽는다 (BAKE=1 npm test 가 새 값을 찍는다).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { goldenRun } from './raid-golden-kit.ts'

const sha = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex')
const GOLDEN = {
  'forest axe 7': '265afe60e95c87aa05390853070d5d6710799d089ac37cb9edac37532cc2aecc',
  'ford bow 11': 'd765d69ceb9807c5b71302bb64eef39947fd0d3185fc400d22ff400c845ac130',
} as const
import type { Kit, StageId } from '../src/raid/haebi.ts'
const cases: [string, StageId, Kit, number][] = [['forest axe 7', 'forest', 'axe', 7], ['ford bow 11', 'ford', 'bow', 11]]
for (const [name, stage, kit, seed] of cases) {
  test(`골든 ${name} 90초 · 옛 규칙 판은 글자 하나까지 같다`, () => {
    const h = sha(goldenRun(stage, kit, seed, 90))
    if (process.env['BAKE']) console.log(`  '${name}': '${h}',`)
    assert.equal(h, GOLDEN[name as keyof typeof GOLDEN])
    assert.equal(sha(goldenRun(stage, kit, seed, 90)), h, '같은 씨앗 두 번')
  })
}
