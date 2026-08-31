/**
 * 과녁 — 갱신과 명중 처리
 *
 * 시간축은 w.tick * w.dt 뿐이다. 실시간 시계를 쓰면 프레임레이트에 따라 이동 과녁 위치가
 * 갈라지고 리플레이가 재현되지 않는다 (ARCHITECTURE A1).
 *
 * 클리어/실패 판정은 여기서 하지 않는다. w.status는 world.ts만 건드린다.
 */
import { clamp, clamp01, distSqPointSegment, TAU } from '../core/math.ts'
import { P } from '../tune/params.ts'
import type { Arrow, Target, World } from './types.ts'
import { flowHit } from './flow.ts'

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

/**
 * 이 한 발이 이 적에게 **실제로** 넣을 피해. 체력이라는 축을 안 쓰는 과녁은 0이다.
 *
 * ── 피해 = 운동에너지 = 기준 × 질량 × (착탄 속도 / 기준 속도)² ──
 *
 * 형의 물음(2026-08-25): "데미지는 화살 속도랑 화살 무게에 따라도 달라지지 않을까."
 * 그대로다. 예전엔 속도에 **선형**이고 질량은 손으로 박은 배수였다.
 * 이제 진짜 KE = ½mv² 다 (½은 playerDamage가 흡수한다).
 * 속도가 제곱으로 들어가므로 **가까이서 쏜 한 발이 확실히 더 아프다.**
 *
 * ── 갑옷 (docs/RUN.md · 형의 반려 2026-08-25) ──
 *
 * 갑옷의 규칙은 "몸통은 안 통한다"였다. 그런데 **육량전(六兩箭)** 은 여섯 냥짜리
 * 전쟁용 무거운 살이다. 그게 판금을 못 뚫으면 그 살은 존재할 이유가 없다.
 * 그래서 갑옷은 이제 **자물쇠**고, 관통력(단면밀도×속도)이 문턱을 넘는 살이 그 열쇠다.
 * 다만 헤드샷보다 좋으면 안 된다 — 머리는 즉사, 뚫는 몸통샷은 절반의 피해로 여러 발.
 * **조준이 여전히 이긴다.** 그리고 관통력에 착탄 속도비를 곱하므로 **너무 멀면 못 뚫는다.**
 *
 * 왜 함수로 뺐나: 값을 hit 이벤트보다 **먼저** 알아야 화면이 점수 대신 피해를 띄울 수 있다
 * (형: "화살이 맞으면 점수가 아니라 데미지가 떠야"). 적용은 여전히 원래 자리에서 한다.
 */
function damageOf(
  arrow: Arrow, target: Target, head: boolean,
): { dealt: number; blocked: boolean } {
  if (target.kind !== 'boss' && target.kind !== 'archer') return { dealt: 0, blocked: false }
  const fx = arrow.fx
  // 착탄 속도는 관통 감속이 붙기 전(resolveHit 진입 시점)의 값이다.
  const impact = Math.sqrt(arrow.vx * arrow.vx + arrow.vy * arrow.vy)
  const vr = impact / Math.max(1, P.enemy.dmgRefSpeed)
  const dmg = Math.max(1, Math.round(P.enemy.playerDamage * fx.mass * vr * vr))

  const penNow = fx.pen * vr
  if (target.armored && !head && (fx.armorPierce <= 0 || penNow < P.arrowkind.armorPen)) {
    return { dealt: 0, blocked: true }
  }
  // 헤드샷 처형 — 체력 무관 즉사. 이 한 줄이 "조준할 이유"다.
  // 화면에는 **남은 체력 전부**가 피해로 뜬다. 그게 실제로 일어난 일이다.
  if (target.kind === 'archer' && head) return { dealt: Math.max(1, target.hp), blocked: false }
  // 판금을 뚫었다. 갑옷이 삼킨 몫만큼 피해가 깎인다.
  if (target.armored && !head) {
    return { dealt: Math.max(1, Math.round(dmg * fx.armorPierce)), blocked: false }
  }
  if (target.kind === 'boss') {
    return { dealt: head ? Math.floor(P.target.bossCritDmg) : dmg, blocked: false }
  }
  return { dealt: dmg, blocked: false }
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
  // 중(中) — 이 화살의 **첫** 명중만 센다. 관통·분열·사슬로 여럿을 맞혀도 한 발은 한 발이다
  // (국궁에서도 세는 단위는 화살이다). 분열 자식은 지급된 화살이 아니라 그 한 발의 결과물이라
  // 세지 않는다 — miss를 안 세는 것과 같은 이유다 (sim/ballistics.ts).
  if (arrow.struck === 1 && arrow.splitDepth <= 0) flowHit(w)

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

  // ── 피해를 **먼저** 센다 ──
  // 예전엔 hit 이벤트를 먼저 뱉고 피해는 한참 아래에서 깎았다. 그래서 화면이 띄울 수 있는
  // 숫자가 점수뿐이었다 (형: "화살이 맞으면 점수가 아니라 데미지가 떠야 하는 거 아냐?").
  // 순서를 뒤집는 게 아니라 **계산만 앞으로 당긴다** — hit 이벤트는 여전히 폭발보다 먼저 나가고,
  // 실제로 체력을 깎는 건 아래 그 자리 그대로다. 여기서는 값만 정한다.
  const hurt = damageOf(arrow, target, head)
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
    dmg: hurt.dealt,
    // 적 궁수 헤드샷만 즉사(체력 무관)라 dmg가 "남은 체력"이지 "넣은 피해"가 아니다 (damageOf).
    execute: target.kind === 'archer' && head,
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
    // 값은 위 damageOf가 이미 정했다. 여기서는 **적용만** 한다.
    if (hurt.blocked) {
      // 갑주는 눈을(보스) · 머리를(궁수) 못 덮는다. 나머지는 막힌 소리와 먼지뿐이다.
      w.events.push({ t: 'enemy_block', x: arrow.x, y: arrow.y })
    } else {
      target.hp -= hurt.dealt
    }
    if (target.hp > 0) {
      // 살아남아도 살의 효과는 터진다 — 화전이 적 몸에서 안 터지면 화전이 아니다 (형).
      // burst는 center 자신을 건드리지 않으므로 버틴 적의 체력과는 무관하다.
      burst(w, target)
      return
    }
    target.alive = false
    // 쓰러졌다 — 시체는 렌더의 것이다. 여기서는 **무엇이 얼마로 때렸는지**만 넘긴다.
    downEvent(w, target, arrow.vx, arrow.vy, arrow.fx.mass)
  } else if (target.kind === 'aerial') {
    // 공중 과녁은 맞아도 사라지지 않는다. 떨어지면서 아래를 연쇄로 쳐야 한다 (GDD 7장).
    target.falling = true
  } else {
    target.alive = false
    // 돌진(charger)도 사람 취급이다 — 쓰러지면 남는다. 과녁은 downEvent 가 걸러낸다.
    downEvent(w, target, arrow.vx, arrow.vy, arrow.fx.mass)
  }

  // 폭발은 맨 끝이다 — 직격의 hit 이벤트가 먼저 나가야 소리·이펙트의 인과가 읽힌다.
  burst(w, target)
}

/**
 * 폭발 — 명중 지점 둘레의 과녁을 같이 친다 (docs/HOOK.md ★1 · 폭탄 과녁은 2026-08-26).
 *
 * 두 근원이 반경을 낸다: **화살**(fx.burstRadius, 폭발 살 — 맞을 때마다, 죽든 안 죽든)과
 * **과녁 자신**(center.bomb, 폭탄 — **죽는 순간에만** 한 번). `!center.alive`로 후자를
 * 가른다: 이 함수가 불릴 때 아직 살아 있으면(보스·궁수가 버틴 경우) 폭탄은 아직 안 터진다.
 *
 * 이벤트는 `chain`을 재사용한다. 새 이벤트 종류를 만들면 render·audio 양쪽에 분기가 하나씩
 * 더 생기는데, 플레이어에게 이건 "딸려 죽었다"는 같은 사건이다.
 *
 * ★ **재귀하지 않는다.** 폭발로 죽은 과녁은 다시 폭발하지 않는다 — 밀집 배치에서 한 발이
 * 판 전체를 지우면 조준이 사라진다. 다만 공중 과녁은 낙하로 넘겨 기존 연쇄에 합류시킨다.
 */
function burst(w: World, center: Target): void {
  const R = Math.max(w.fx.burstRadius, !center.alive && center.bomb ? P.target.bombRadius : 0)
  burstAt(w, center.x, center.y, R, center)
}

/**
 * 좌표에서 터진다. 위 burst()가 과녁을 중심으로 부르는 것과, ballistics가 **땅에 꽂힌 자리**를
 * 중심으로 부르는 것이 같은 함수를 쓴다 (형: "어딜 맞춰도 폭발해야해. 심지어 땅에맞아도").
 *
 * exclude 는 이미 직격으로 처리한 과녁 — 두 번 세지 않기 위해서다. 땅 폭발은 null.
 */
export function burstAt(w: World, x: number, y: number, R: number, exclude: Target | null): void {
  if (R <= 0) return
  const r2 = R * R
  const targets = w.targets
  const center = { x, y }

  // ★ 터졌다는 사건 자체를 알린다. 예전에는 딸려 죽은 과녁의 `chain` 이벤트만 나가서,
  // **아무것도 안 딸려 죽으면 폭발이 일어난 흔적이 화면에도 소리에도 남지 않았다**
  // (형의 지적: "폭발살은 폭발 소리도 이펙트도 없는데 뭐가 폭발이라는 건지").
  // 반경을 실어 보내는 이유: 렌더가 얼마나 크게 터뜨릴지 여기 말고는 알 길이 없다.
  w.events.push({ t: 'burst', x: center.x, y: center.y, radius: R })

  for (let j = 0; j < targets.length; j++) {
    const c = targets[j]
    if (c === undefined || c === exclude || !c.alive || c.falling || c.hidden) continue
    const dx = c.x - center.x
    const dy = c.y - center.y
    const d2 = dx * dx + dy * dy
    if (d2 > r2) continue

    // 중심에서 멀수록 약하게 맞는다. 링 배수와 같은 축이라 점수 규칙이 하나로 유지된다.
    c.chainDepth = 1
    award(w, c, clamp01(1 - Math.sqrt(d2) / R))
    w.events.push({ t: 'chain', targetId: c.id, x: c.x, y: c.y, depth: 1 })

    if (c.kind === 'aerial') {
      c.falling = true
    } else {
      c.alive = false
      // 폭발로 죽은 적은 **바깥으로** 날아간다. 세기는 중심에서 멀수록 약하다.
      const d = Math.sqrt(d2)
      const k = (1 - clamp01(d / R)) * P.render.blastPush
      downEvent(w, c, d > 0 ? (dx / d) * k : 0, d > 0 ? (dy / d) * k : k, 1)
    }
  }

  // ── 자해 ──────────────────────────────────────────────────────────
  //
  // 형: "내발앞에 떨어지면 나도 데미지 맞아야지." 폭발에 편이 없어야 폭발이다.
  // 판이 끝난 뒤(status !== 'playing')에는 안 친다 — 결과 배너가 뜬 뒤 날아오던 살이
  // 여정을 끝내면 그건 사고가 아니라 배신이다 (적 화살도 같은 규칙이다, world.ts).
  const dmg = Math.floor(P.arrowkind.burstSelfDamage)
  if (dmg <= 0 || w.status !== 'playing') return
  const self = R * P.arrowkind.burstSelfRange
  // 궁수를 점이 아니라 **서 있는 몸**(발 y=0 ~ 활 손 y=archer.y)으로 본다.
  // 활 손 한 점으로만 재면 바로 발밑에서 터져도 1.4m 떨어진 것으로 나온다 — 안 아프다.
  const ax = center.x - w.archer.x
  const ay = center.y - clamp(center.y, 0, w.archer.y)
  if (ax * ax + ay * ay > self * self) return
  w.hp = Math.max(0, w.hp - dmg)
  w.combo = 0
  w.events.push({ t: 'player_hit', hp: w.hp, x: center.x, y: center.y, ang: 0, pin: false })
  if (w.hp <= 0) {
    w.status = 'failed'
    w.events.push({ t: 'stage_end', cleared: false, score: w.score })
  }
}

/**
 * 쓰러진 적을 알린다 (SimEvent 'foe_down'). **사람과 드론만** — 과녁은 그냥 사라진다.
 * 형: "과녁이면 과녁이고 적이면 적이지." 남는 것도 그래서 다르다.
 */
function downEvent(w: World, t: Target, vx: number, vy: number, mass: number): void {
  if (t.kind !== 'archer' && t.kind !== 'boss' && t.kind !== 'charger') return
  w.events.push({
    t: 'foe_down',
    x: t.x, y: t.y, vx, vy, mass,
    look: t.kind === 'boss' ? -1 : t.kind === 'charger' ? 0 : t.look,
    r: t.r,
  })
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
