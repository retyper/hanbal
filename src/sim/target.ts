/**
 * 과녁 — 갱신과 명중 처리
 *
 * 시간축은 w.tick * w.dt 뿐이다. 실시간 시계를 쓰면 프레임레이트에 따라 이동 과녁 위치가
 * 갈라지고 리플레이가 재현되지 않는다 (ARCHITECTURE A1).
 *
 * 클리어/실패 판정은 여기서 하지 않는다. w.status는 world.ts만 건드린다.
 */
import { clamp01, distSqPointSegment, TAU } from '../core/math.ts'
import { P } from '../tune/params.ts'
import type { Arrow, Target, World } from './types.ts'

export function stepTargets(w: World): void {
  const dt = w.dt
  // 시뮬 내부 시계. Date.now / performance.now 금지 (A1)
  const time = w.tick * dt
  const targets = w.targets

  for (let j = 0; j < targets.length; j++) {
    const tg = targets[j]
    if (tg === undefined || !tg.alive) continue

    // 직전 위치는 렌더 보간과 연쇄 선분 판정 양쪽에 필요하다. 종류와 무관하게 항상 갱신한다.
    tg.px = tg.x
    tg.py = tg.y

    if (tg.falling) {
      // 맞아서 떨어지는 중. 가속 없이 일정 속도로 내려간다 — 연쇄 타이밍을 눈으로 읽을 수 있어야 한다.
      tg.y -= P.chain.fallSpeed * dt
      sweepChain(w, tg)
      if (tg.y <= 0) tg.alive = false
    } else if (tg.kind === 'moving') {
      const phase = time * tg.freq * TAU
      const s = Math.sin(phase)
      // x·y 같은 위상을 쓴다. 그래야 t=0에서 스테이지가 적어둔 base 위치와 정확히 일치한다.
      tg.x = tg.baseX + tg.ampX * s
      tg.y = tg.baseY + tg.ampY * s
    } else if (tg.kind === 'archer') {
      // 이동 사수(드론 포함) — moving 과녁과 같은 위상 규칙 (t=0에 base와 일치).
      if (tg.ampX !== 0 || tg.ampY !== 0) {
        const s2 = Math.sin(time * tg.freq * TAU)
        tg.x = tg.baseX + tg.ampX * s2
        tg.y = tg.baseY + tg.ampY * s2
      }
      // 숨었다 쏘는 사수 (look 2) — 발사 예고 조금 전에 나와서, 쏘고 조금 뒤에 숨는다.
      // 숨은 동안은 못 맞히고(엄폐) 저쪽도 못 쏜다. 예고 없는 피해는 없다는 계약 그대로.
      if (tg.look === 2) {
        const period = tg.firePeriod > 0 ? tg.firePeriod : P.enemy.shootEvery
        // 다음 발사가 임박했거나(예고+선행) 방금 쐈으면(여운) 나와 있다. 그 밖엔 숨는다.
        const untilNext = tg.fireAt - time
        const sinceLast = time - (tg.fireAt - period)
        tg.hidden = !(untilNext <= P.enemy.windup + P.enemy.peekLead || sinceLast <= P.enemy.peekTail)
      }
      // ── 적 궁수 (docs/RUN.md 6장) — 주기적으로 나를 쏜다 ──
      // 시계는 elapsed 뿐이다 (A1). windup 진입 순간 예고 이벤트가 한 번 나간다 —
      // 렌더는 당기는 자세를, 소리는 삐걱임을 이걸로 만든다. 예고 없는 피해는 없다.
      // 첫 발사가 windup보다 이르면 예고 시각이 판 시작 전(음수)이다 — 첫 스텝에 예고한다.
      const windStart = tg.fireAt - P.enemy.windup
      if (time >= windStart && (time - dt < windStart || time - dt <= 0)) {
        w.events.push({ t: 'enemy_draw', x: tg.x, y: tg.y })
      }
      if (time >= tg.fireAt) {
        tg.fireAt += tg.firePeriod > 0 ? tg.firePeriod : P.enemy.shootEvery
        if (!tg.hidden) fireEnemyShot(w, tg)
      }
    } else if (tg.kind === 'boss') {
      // 보스 — 느리게, 그러나 멈추지 않고 온다 (docs/RUN.md 3장). 판이 끝나면 멈춘다.
      if (w.status === 'playing') tg.x -= tg.speed * dt
      tg.y = tg.baseY + Math.sin(time * P.target.chargeBobFreq * TAU) * P.target.chargeBob
      if (tg.x <= w.archer.x + P.target.chargeReach && w.status === 'playing') {
        // 닿았다 — 즉사다. 보스에게 깔리고 사는 궁수는 없다. **보스를 죽이지 않는다** —
        // 여기서 alive를 끄면 같은 스텝의 evaluateEnd(스텝 머리의 playing 스냅샷)가
        // '과녁 전멸 = 클리어'로 뒤집는다.
        w.hp = 0
        w.events.push({ t: 'player_hit', hp: 0, x: tg.x, y: tg.y, ang: 0, pin: false })
        w.status = 'failed'
        w.events.push({ t: 'stage_end', cleared: false, score: w.score })
      }
    } else if (tg.kind === 'charger') {
      // ★ 이 게임에서 유일하게 **나에게 오는** 것.
      tg.x -= tg.speed * dt
      // 다가오면서 살짝 위아래로 흔들린다. 일직선으로만 오면 물체가 아니라 슬라이더로 보인다.
      tg.y = tg.baseY + Math.sin(time * P.target.chargeBobFreq * TAU) * P.target.chargeBob
      if (tg.x <= w.archer.x + P.target.chargeReach) {
        // 닿았다 — 몬스터다. 체력을 깎고 사라진다 (docs/RUN.md 6장 — "몬스터가 나를 공격").
        // 판이 안 깨지게 과녁 자체는 확실히 제거한다. 남겨두면 클리어가 영원히 안 된다.
        tg.alive = false
        w.combo = 0
        // escape(화살 강탈 시절의 하강음)는 내지 않는다 — 이 사건의 이름은 '부딪힘'이다 (감사).
        if (w.status === 'playing' && P.enemy.chargerDamage > 0) {
          w.hp = Math.max(0, w.hp - Math.floor(P.enemy.chargerDamage))
          w.events.push({ t: 'player_hit', hp: w.hp, x: tg.x, y: tg.y, ang: 0, pin: false })
          if (w.hp <= 0) {
            w.status = 'failed'
            w.events.push({ t: 'stage_end', cleared: false, score: w.score })
          }
        }
      }
    }
    // static / pierceable / bonus / 낙하 전 aerial 은 정지. 위치를 건드리지 않는다.

    // 속도는 실제 변위에서 역산한다. 리드 샷을 읽는 렌더·HUD가 이 값을 쓴다.
    tg.vx = (tg.x - tg.px) / dt
    tg.vy = (tg.y - tg.py) / dt
  }
}

/**
 * 적 궁수의 발사. 궁수(플레이어)의 현재 위치를 겨눈 탄도해 — 낮은 호를 고른다.
 * 난수를 쓰지 않는다 (A1). 못 푸는 거리면(속도 부족) 직사로 던진다 — 어차피 못 미친다.
 */
function fireEnemyShot(w: World, tg: Target): void {
  let slot: import('./types.ts').EnemyShot | null = null
  for (let i = 0; i < w.shots.length; i++) {
    const sh = w.shots[i]
    if (sh !== undefined && !sh.alive) { slot = sh; break }
  }
  if (slot === null) return

  const v = P.enemy.arrowSpeed
  const g = P.arrow.gravity
  const dx = w.archer.x - tg.x
  const dy = w.archer.y - tg.y
  // 포물선 조준각: tanθ = (v² - √(v⁴ - g(g·dx² + 2·dy·v²))) / (g·dx)  (낮은 호)
  const disc = v * v * v * v - g * (g * dx * dx + 2 * dy * v * v)
  let ang: number
  if (disc >= 0 && dx !== 0) {
    ang = Math.atan((v * v - Math.sqrt(disc)) / (g * dx))
    // dx가 음수(적은 항상 오른쪽에 있으니 왼쪽으로 쏜다)면 각을 반대쪽으로 편다.
    if (dx < 0) ang += Math.PI
  } else {
    ang = Math.atan2(dy, dx)
  }
  // 조준 산포 — 적도 사람이다 (형: "무조건 백발백중이야?"). w.rng를 쓰지만 결정론은
  // 그대로다: 발사 시각이 결정론적이라 소비 순서도 판마다 같다 (A1).
  ang += w.rng.gaussian() * P.enemy.aimScatter * tg.aimMul
  slot.alive = true
  slot.x = tg.x
  slot.y = tg.y
  slot.px = tg.x
  slot.py = tg.y
  slot.vx = Math.cos(ang) * v
  slot.vy = Math.sin(ang) * v
  w.events.push({ t: 'enemy_shot', x: tg.x, y: tg.y })
}

export function resolveHit(w: World, arrow: Arrow, target: Target): void {
  // 명중도는 화살의 현재 점이 아니라 **이번 스텝 궤적 선분**과 중심의 최단거리로 잰다.
  // 빠른 화살은 한 스텝에 과녁을 통과해 버리므로, 점으로 재면 중심 명중이 가장자리로 읽힌다.
  const dsq = distSqPointSegment(target.x, target.y, arrow.px, arrow.py, arrow.x, arrow.y)
  // r이 0인 과녁은 정의상 항상 중심 명중. 0으로 나누면 NaN이 판 전체를 죽인다.
  let accuracy = target.r > 0 ? clamp01(1 - Math.sqrt(dsq) / target.r) : 1

  // 효과판은 화살 자신의 것 — 판 도중 장전이 바뀌어도 이 발은 제 성질대로 맞는다.
  const fx = arrow.fx
  arrow.struck++
  arrow.lastHit = target.id

  // ── 보스의 머리 (docs/RUN.md 3장) ──
  // 머리를 스친 선분이면 치명타다. 명중도를 정중앙(1)으로 올린다 — 링 판정·크리 사운드·
  // 점수 배수가 전부 기존 정중앙 축을 그대로 탄다. 새 채널을 만들지 않는다.
  // ── 머리 판정 ──
  // 이번 스텝의 선분이 아니라 **화살 진행 직선**과 머리 중심의 거리로 잰다. 선분으로 재면
  // 몸 앞면에 닿는 순간 선분이 거기서 끝나 정면 샷은 머리에 영영 못 닿는다 (작은 적일수록).
  // 화살은 몸을 뚫고 박히는 물건이라, 그 직선이 머리를 지나면 머리에 맞은 것이다.
  let head = false
  if (target.kind === 'boss' || target.kind === 'archer') {
    const hy = target.kind === 'boss'
      ? target.y + target.r * P.target.bossHeadUp
      : target.y + target.r * P.enemy.archerHeadUp
    const hr = target.kind === 'boss'
      ? target.r * P.target.bossHeadR
      : target.r * P.enemy.archerHeadR
    const sp = Math.hypot(arrow.vx, arrow.vy)
    if (sp > 0) {
      const ux2 = arrow.vx / sp
      const uy2 = arrow.vy / sp
      const rx2 = target.x - arrow.px
      const ry2 = hy - arrow.py
      // 직선까지의 수직 거리 = |외적|. 앞쪽(진행 방향)에 있는 머리만 (뒤로 맞는 머리는 없다).
      const perp = Math.abs(rx2 * uy2 - ry2 * ux2)
      const along = rx2 * ux2 + ry2 * uy2
      head = perp <= hr && along > -target.r
    }
  }

  if (head) accuracy = 1

  // 화살이 직접 맞힌 것이 연쇄의 뿌리다
  target.chainDepth = 0
  const gained = award(w, target, accuracy)
  // 적은 과녁이 아니다 — "정중앙"은 과녁의 말이다 (형: "심장이라도 맞았냐").
  const foe = target.kind === 'archer' || target.kind === 'boss' || target.kind === 'charger'
  w.events.push({
    t: 'hit',
    targetId: target.id,
    x: target.x,
    y: target.y,
    score: gained,
    accuracy,
    chain: target.chainDepth,
    combo: w.combo,
    head,
    foe,
    arrow: arrow.id,
  })

  /**
   * 관통 — **관통할 수 있는 화살만 뚫는다.**
   *
   * 예전에는 `pierceable` 과녁이 화살 종류와 무관하게 **공짜로** 뚫렸다. 그러면
   * 유엽전으로도 애기살로도 똑같이 꿰뚫려서 "관통"이 화살의 성격이 아니라 과녁의 성격이 되고,
   * 무엇보다 **어떤 건 뚫리고 어떤 건 안 뚫리는지 플레이어가 규칙을 세울 수가 없다**
   * (형의 지적: "관통은 관통살만 하게 해줘야 하는 거 아닌가"). 맞는 말이라 공짜 통로를 없앴다.
   *
   * 이제 규칙은 하나다: `fx.pierceExtra` 예산이 남았는가. 겹쳐 세운 과녁(pierceable)은
   * 그걸 **쓰기 좋게 늘어놓은 배치**일 뿐, 스스로 뚫리지는 않는다.
   */
  // 궁합(활×살)의 관통 가산 — 각궁×애기살=편전 · 장궁×육량전 (docs/BOWS.md).
  // game/bows.ts 가 짝이 맞을 때만 0이 아닌 값을 굽는다. sim은 조합표를 모른다.
  // 보스는 화살을 삼킨다 — 애기살도 못 뚫는다. 뚫리면 hp가 탄약 압박이 아니라 장식이 된다.
  if (target.kind !== 'boss' && arrow.kindPierced < fx.pierceExtra + w.bow.pierceAdd) {
    arrow.kindPierced++
    if (target.kind === 'pierceable') arrow.pierced++
    // 중심을 뚫을수록 더 두꺼운 부분을 지나 속도를 잃는다. 가장자리를 스치면 거의 안 잃는다.
    arrow.vx *= 1 - accuracy * fx.pierceLoss
    arrow.vy *= 1 - accuracy * fx.pierceLoss
  } else {
    arrow.outcome = 'hit'
    arrow.alive = false
    // 사슬 살은 여기서 죽은 화살을 ballistics가 되살려 다음 과녁으로 보낸다.
    // 방향을 바꾸는 일이라 충돌 순회(같은 선분) 안에서는 할 수 없다 — 플래그로 넘긴다.
    if (arrow.bounces < fx.chainBounces) arrow.chainPending = 1
  }

  // 분열 — 자식 생성은 ballistics의 몫이다 (풀에서 슬롯을 꺼내는 건 저쪽 책임).
  // 자식이 또 갈라지면 한 발이 화면을 채운다. 한 세대까지만.
  if (fx.splitCount > 0 && arrow.splitDepth <= 0) arrow.splitPending = 1

  if (arrow.splitPending > 0 || arrow.chainPending > 0) {
    arrow.pendX = target.x
    arrow.pendY = target.y
  }

  // 보급 — 화살 또는 기력. 이 게임에서 자원이 **느는** 유일한 자리다.
  if (target.kind === 'bonus') {
    if (target.healGive > 0) {
      w.hp = Math.min(Math.floor(P.enemy.hpMax), w.hp + target.healGive)
      w.events.push({ t: 'pickup', x: target.x, y: target.y, gain: target.healGive, hp: true })
    } else if (target.give > 0) {
      w.arrowsLeft += target.give
      w.events.push({ t: 'pickup', x: target.x, y: target.y, gain: target.give, hp: false })
    }
  }

  if (target.kind === 'boss' || target.kind === 'archer') {
    // ── 피해 = 기준 × (착탄 속도 / 기준 속도) × 살의 질량 배수 ──
    // 세게 당길수록·가까울수록·무거운 살일수록 아프다. 운동에너지의 게임 번역이다.
    // 착탄 속도는 관통 감속이 붙기 전(resolveHit 진입 시점)의 값이다.
    const impact = Math.sqrt(arrow.vx * arrow.vx + arrow.vy * arrow.vy)
    const dmg = Math.max(1, Math.round(
      P.enemy.playerDamage * (impact / Math.max(1, P.enemy.dmgRefSpeed)) * fx.dmgMul,
    ))
    if (target.kind === 'boss' && target.armored && !head) {
      // 갑주귀신 — 갑주는 눈을 못 덮는다. 몸통은 막힌 소리만 남긴다.
      w.events.push({ t: 'enemy_block', x: arrow.x, y: arrow.y })
    } else if (target.kind === 'archer' && head) {
      // 헤드샷 처형 — 체력 무관 즉사. 이 한 줄이 "조준할 이유"다.
      target.hp = 0
    } else if (target.kind === 'archer' && target.armored) {
      // 갑옷 — 몸통은 안 통한다 (형: "헤드샷 안 맞히면 안 죽음"). 막힌 소리·먼지만 남는다.
      w.events.push({ t: 'enemy_block', x: arrow.x, y: arrow.y })
    } else if (target.kind === 'boss') {
      target.hp -= head ? Math.floor(P.target.bossCritDmg) : dmg
    } else {
      target.hp -= dmg
    }
    if (target.hp > 0) {
      // 살아남아도 살의 효과는 터진다 — 화전이 적 몸에서 안 터지면 화전이 아니다 (형).
      // burst는 center 자신을 건드리지 않으므로 버틴 적의 체력과는 무관하다.
      burst(w, target)
      return
    }
    target.alive = false
  } else if (target.kind === 'aerial') {
    // 공중 과녁은 맞아도 사라지지 않는다. 떨어지면서 아래를 연쇄로 쳐야 한다 (GDD 7장).
    target.falling = true
  } else {
    target.alive = false
  }

  // 폭발은 맨 끝이다 — 직격의 hit 이벤트가 먼저 나가야 소리·이펙트의 인과가 읽힌다.
  burst(w, target)
}

/**
 * 폭발 살 — 명중 지점 둘레의 과녁을 같이 친다 (docs/HOOK.md ★1).
 *
 * 이벤트는 `chain`을 재사용한다. 새 이벤트 종류를 만들면 render·audio 양쪽에 분기가 하나씩
 * 더 생기는데, 플레이어에게 이건 "딸려 죽었다"는 같은 사건이다.
 *
 * ★ **재귀하지 않는다.** 폭발로 죽은 과녁은 다시 폭발하지 않는다 — 밀집 배치에서 한 발이
 * 판 전체를 지우면 조준이 사라진다. 다만 공중 과녁은 낙하로 넘겨 기존 연쇄에 합류시킨다.
 */
function burst(w: World, center: Target): void {
  const R = w.fx.burstRadius
  if (R <= 0) return
  const r2 = R * R
  const targets = w.targets

  // ★ 터졌다는 사건 자체를 알린다. 예전에는 딸려 죽은 과녁의 `chain` 이벤트만 나가서,
  // **아무것도 안 딸려 죽으면 폭발이 일어난 흔적이 화면에도 소리에도 남지 않았다**
  // (형의 지적: "폭발살은 폭발 소리도 이펙트도 없는데 뭐가 폭발이라는 건지").
  // 반경을 실어 보내는 이유: 렌더가 얼마나 크게 터뜨릴지 여기 말고는 알 길이 없다.
  w.events.push({ t: 'burst', x: center.x, y: center.y, radius: R })

  for (let j = 0; j < targets.length; j++) {
    const c = targets[j]
    if (c === undefined || c === center || !c.alive || c.falling || c.hidden) continue
    const dx = c.x - center.x
    const dy = c.y - center.y
    const d2 = dx * dx + dy * dy
    if (d2 > r2) continue

    // 중심에서 멀수록 약하게 맞는다. 링 배수와 같은 축이라 점수 규칙이 하나로 유지된다.
    c.chainDepth = 1
    award(w, c, clamp01(1 - Math.sqrt(d2) / R))
    w.events.push({ t: 'chain', targetId: c.id, x: c.x, y: c.y, depth: 1 })

    if (c.kind === 'aerial') c.falling = true
    else c.alive = false
  }
}

/**
 * 낙하 중인 과녁이 이번 스텝에 지나간 선분 위의 과녁을 연쇄로 친다 (GDD 7장, 보로로로록).
 *
 * 선분으로 판정하는 이유는 화살과 같다 — fallSpeed가 크면 한 스텝에 작은 과녁을 뛰어넘는다.
 * 처리 순서는 **위에 있는 것부터**. 낙하는 수직이라 그게 실제로 부딪히는 순서이고,
 * 배열 인덱스 순으로 처리하면 같은 상황에서 콤보 배수가 붙는 대상이 뒤바뀐다.
 */
function sweepChain(w: World, faller: Target): void {
  const targets = w.targets

  for (let pass = 0; pass < targets.length; pass++) {
    let bestJ = -1
    let bestY = 0
    for (let j = 0; j < targets.length; j++) {
      const c = targets[j]
      if (c === undefined || c === faller) continue
      // 이미 떨어지는 중인 과녁은 건너뛴다. 안 그러면 서로를 매 스텝 다시 치며 이벤트가 폭주한다.
      if (!c.alive || c.falling) continue
      // hitRadius는 낙하물 자체의 반경이다. 과녁 반경을 더해야 표면끼리 닿는 순간이 된다.
      const reach = P.chain.hitRadius + c.r
      if (distSqPointSegment(c.x, c.y, faller.px, faller.py, faller.x, faller.y) > reach * reach) continue
      if (bestJ < 0 || c.y > bestY) {
        bestY = c.y
        bestJ = j
      }
    }
    if (bestJ < 0) break
    const c = targets[bestJ]
    if (c === undefined) break

    c.chainDepth = faller.chainDepth + 1
    // 몸통으로 들이받은 것이라 링 명중도는 최대로 본다
    award(w, c, 1)
    w.events.push({ t: 'chain', targetId: c.id, x: c.x, y: c.y, depth: c.chainDepth })

    if (c.kind === 'aerial') {
      // 얘도 떨어지며 다음 연쇄를 만든다. 그래서 alive를 유지한다.
      c.falling = true
    } else {
      c.alive = false
    }
  }
}

/**
 * 점수 가산 + 콤보 증가. 직격과 연쇄가 같은 규칙을 쓴다 — 연쇄만 따로 계산하면
 * 배수 상한 없는 콤보(GDD 7장)가 두 곳에서 갈라진다.
 */
function award(w: World, target: Target, accuracy: number): number {
  // 가장자리 1배 ~ 중심 ringMulMax 배. ringCurve로 중심에 얼마나 인색할지 정한다.
  const ring = 1 + (P.score.ringMulMax - 1) * Math.pow(accuracy, P.score.ringCurve)
  // 화살 종류의 점수 배수는 여기 한 곳에만 곱한다 — 직격이든 폭발·연쇄로 딸려 죽었든
  // "이 화살이 만든 점수"는 전부 같은 배수를 받아야 설명이 하나로 남는다.
  const gained = Math.round(
    target.score * ring * Math.pow(P.chain.comboMul, w.combo) * w.fx.scoreMul,
  )
  w.score += gained
  w.combo++
  return gained
}
