/**
 * 갑옷 프로브 — **벗기는 데 몇 발이 드는가**를 숫자로 못 박는다.
 *
 * 형의 규칙 (2026-08-31): "적 갑옷병은 갑옷도 무적이 아니게 — 관통되는 활이면 막히지 않고
 * 상대를 공격, 폭발터지면 갑옷 상관 없이 데미지, 일반화살로도 어느정도 데미지 입으면 없어지게."
 *
 * 네 길이 전부 살아 있어야 하고, **값이 서로 달라야** 선택이 된다. 같으면 셋은 장식이다.
 * 여기서 재는 것: 각 살로 갑옷병 하나를 눕히는 데 드는 발수 · 거리별 차이.
 */
import { createWorld, step } from '../src/sim/world.ts'
import { P } from '../src/tune/params.ts'
import type { ArrowKindId, InputFrame, SimEvent, StageDef, Stats, World } from '../src/sim/types.ts'

const STATS: Stats = { str: 12, steady: 8, stamina: 12, focus: 6 }

function arena(dist: number): StageDef {
  return {
    id: 'armor-probe',
    seed: 4,
    arrows: 60,
    targetScore: 100,
    wind: 0,
    targets: [
      { kind: 'archer', x: dist, y: 1.5, r: 0.7, hp: Math.floor(P.enemy.archerHp), armored: true, fireDelay: 9000 },
      { kind: 'static', x: dist + 40, y: 12, r: 0.2, score: 0 },
    ],
  }
}

function foe(w: World) {
  return w.targets.find((t) => t !== undefined && t.kind === 'archer')
}

function shoot(w: World, aimX: number, aimY: number): SimEvent[] {
  const hold: InputFrame = { aimX, aimY, drawing: true, steady: false }
  const rest: InputFrame = { aimX, aimY, drawing: false, steady: false }
  const seen: SimEvent[] = []
  const drain = (): void => {
    for (const e of w.events) if (e !== undefined) seen.push(e)
    w.events.length = 0
  }
  for (let i = 0; i < 900 && w.archer.phase !== 'full'; i++) { step(w, hold); drain() }
  step(w, rest); drain()
  for (let i = 0; i < 900; i++) {
    step(w, rest); drain()
    let flying = false
    for (const a of w.arrows) if (a !== undefined && a.alive && a.outcome === 'flying') flying = true
    if (!flying) break
  }
  return seen
}

/** 몸통만 쳐서 눕히는 데 드는 발수. 갑옷이 벗겨진 발수도 같이 돌려준다. */
function bodyShots(kind: ArrowKindId, dist: number): { down: number; strip: number } {
  const w = createWorld(arena(dist), STATS, kind)
  let strip = 0
  for (let n = 1; n <= 20; n++) {
    const t = foe(w)
    if (t === undefined) break
    const evs = shoot(w, t.x, t.y - t.r * 0.3)
    if (strip === 0 && evs.some((e) => e.t === 'armor_break')) strip = n
    const after = foe(w)
    if (after === undefined || !after.alive) return { down: n, strip }
  }
  return { down: -1, strip }
}

/**
 * 머리에 **맞았을 때** 한 발에 눕는가.
 *
 * ★ 예전엔 '머리를 겨눠 눕히는 데 든 발수'를 셌는데, 그건 갑옷이 아니라 **조준**을 재는
 *   숫자였다: 육량전은 느려서 14m에서도 조준선이 처져 머리 대신 몸통에 맞고, 신전은
 *   유도가 몸통 중심으로 당겨서 애초에 머리에 못 간다. 둘 다 갑옷의 성질이 아니다.
 *   그래서 이제 **머리에 실제로 맞은 발**만 골라 그 발에 누웠는지를 본다.
 *   돌려주는 값: 0 = 머리에 한 번도 못 맞음(측정 불가) · 1 = 맞자마자 누움 · -1 = 어겼다
 */
function headKillsInOne(kind: ArrowKindId): number {
  const w = createWorld(arena(14), STATS, kind)
  for (let n = 1; n <= 20; n++) {
    const t = foe(w)
    if (t === undefined || !t.alive) break
    const evs = shoot(w, t.x, t.y + t.r * P.enemy.archerHeadUp)
    const headHit = evs.some((e) => e.t === 'hit' && e.head)
    if (!headHit) continue
    const after = foe(w)
    return after === undefined || !after.alive ? 1 : -1
  }
  return 0
}

console.log('── 갑옷병 하나를 눕히는 데 드는 발수 (14m) ──')
console.log('  내구도 ' + Math.floor(P.enemy.armorHp) + ' · 체력 ' + Math.floor(P.enemy.archerHp))
console.log('')
console.log('  살         몸통   벗겨진 발   머리')
let bad = 0
for (const kind of ['basic', 'burst', 'split', 'chain', 'homing', 'pierce', 'heavy'] as const) {
  const body = bodyShots(kind as ArrowKindId, 14)
  const head = headKillsInOne(kind as ArrowKindId)
  const cell = (n: number): string => (n < 0 ? '못눕힘' : String(n))
  console.log(
    '  ' + kind.padEnd(9) + '  ' + cell(body.down).padEnd(6) +
    (body.strip === 0 ? '뚫음' : String(body.strip)).padEnd(11) +
    (head === 1 ? '한 발' : head === 0 ? '머리에 못 맞음' : '★ 안 죽음'),
  )
  // ① 막다른 장전이 없다 — 어떤 살로 들어와도 언젠가는 눕는다.
  if (body.down < 0) { console.log('    ✗ ' + kind + '로는 갑옷병을 아예 못 눕힌다'); bad++ }
  // ② 조준이 이긴다 — 머리에 맞으면 **한 발**이다. 갑옷은 머리를 안 덮는다.
  //    이게 뒤집히면 갑옷은 자물쇠가 아니라 그냥 성가신 것이 된다.
  if (head < 0) {
    console.log('    ✗ ' + kind + ': 머리에 맞았는데 한 발에 안 누웠다')
    bad++
  }
}
console.log('')
console.log(
  bad === 0
    ? '✓ 막다른 장전이 없고, 어떤 살로도 조준이 이긴다'
    : '✗ ' + bad + '건',
)
process.exit(bad === 0 ? 0 : 1)
