// 열전 판 골든 해시 (journey-study 카드 0 · 11-25) — 벽 체력(75-WALL)·초반 곡선(76-PACE)처럼 판 규칙을 새 태그로 바꿀 때,
// 태그를 안 켠 옛 판이 글자 하나 달라지지 않았는지 바로 안다. 이 해시가 깨지면 옛 기록 재생이 어긋난 것이다.
// 규칙: 지금 켜 둔 규칙을 모두 켠 판(74-BUFF 는 뺀다 · 아직 이 판에 안 붙었다) · 설치물 여덟을 처음에 모두 세우고 · 장수는 정해진 길로 걷는다.
// 11-25 카드 2: 골든 판이 사실은 시간이 0초에서 멈춰 있었다(종류 칸이 차서 마지막 설치 카드가 안 걷혀 걸음이 안 갔다) — 걷게 고치고 HEAD(b34b447c) 코드로 해시를 새로 구웠다.
// 해시를 일부러 바꿔야 할 때(옛 판의 규칙을 정말 고칠 때)는 이유를 커밋 글에 적고 아래 값을 새로 굽는다 (BAKE=1 npm test 가 새 값을 찍는다).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { goldenRun } from './raid-golden-kit.ts'

const sha = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex')
const GOLDEN = {
  'forest axe 7': '44803c1a614696163ee522e4df05e3cd88f4cb925451c8528066983f536c2741',
  'ford bow 11': 'adb9c82e2c14393fb9f43b558ec2b15a6f2d9b458508232916c09298687882e2',
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
