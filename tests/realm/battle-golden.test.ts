// 본편 전투 골든 해시 (battle-study 카드 P1 · 11-25) — 앞으로 전투를 고쳐도 옛 길이 글자 하나 달라지지 않았는지 잡는다.
// A: fightRounds 직접 (병종 3종 x 비 6칸 x 정책 3종) · B: advance 가 command 명령 줄(Tactic.cmds/dusk)을 지나는 16턴.
// 판(규칙)을 정말 바꿀 때만 새로 굽는다: BAKE=1 node --test --experimental-strip-types tests/realm/battle-golden.test.ts  (이유는 커밋 글에)
// 큰 판(정책당 N판)은 tools/realm-golden.ts --n 10000. 앞 GOLDEN_N 판의 값은 이 시험과 같다.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { GOLDEN_N, POLICIES, goldenA, goldenB, RUNS } from './battle-golden-kit.ts'

const GOLDEN: Record<string, string> = {
  'A auto': '459e7134 oc[draw:31,lose:56,rout:109,routed:38,win:66] ew[captured:69,draw:31,morale:69,retreat:3,share:116,withdraw:12]',
  'A good': '2b74986 oc[draw:23,lose:28,rout:179,routed:27,win:43] ew[captured:89,draw:23,morale:122,share:50,withdraw:16]',
  'A still': 'c6eeb3a1 oc[draw:41,lose:57,rout:97,routed:28,win:77] ew[captured:13,draw:41,morale:108,share:128,withdraw:10]',
  'B tutorial 1': '65e2085d fd418ee7 ours:2',
  'B mahan 2': 'a5f4e171 35e797af ours:19',
  'B jumong 1': '6260ae01 20f339eb ours:7',
}

for (const p of POLICIES) {
  test(`골든 A ${p} ${GOLDEN_N}판`, () => {
    const h = goldenA(p, GOLDEN_N)
    if (process.env['BAKE']) console.log(`  'A ${p}': '${h}',`)
    assert.equal(h, GOLDEN[`A ${p}`])
    assert.equal(goldenA(p, GOLDEN_N), h, '같은 판 두 번')
  })
}
for (const [reg, nat, seed] of RUNS) {
  test(`골든 B command 길 16턴 ${reg} ${seed}`, () => {
    const { hash, ours } = goldenB(reg, nat, seed)
    if (process.env['BAKE']) console.log(`  'B ${reg} ${seed}': '${hash}',`)
    assert.ok(ours > 0 || process.env['BAKE'], 'command 길을 지난 우리 싸움이 있어야 한다')
    assert.equal(hash, GOLDEN[`B ${reg} ${seed}`])
  })
}
