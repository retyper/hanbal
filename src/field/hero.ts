/**
 * 조종 장수 (C2 · docs/realm/battle-study/50-control-v2.md · 49-hero-plan.md §1·§2 · 47-hero-mechanics-now.md §1-B·C·D)
 *
 * 우리 장수(편 0)는 입력이 있으면 입력대로 — 방향(OP_HERO_DIR) · 찍은 자리(OP_MOVE) · 적을 쳐라(OP_ATTACK) · 내닫기 · 비기.
 * 입력이 한 번도 없던 장수와 적 장수는 임시 AI(sim.ts retarget · 제 편 맨 앞 앞줄 곁)를 따른다.
 * 장수가 하는 일: 닿는 적을 스스로 친다(무예) · 곁의 우리 대는 사기가 덜 꺾인다(통솔 · 본편 leadMul) · 내닫기 · 비기 한 칸.
 * sim 쪽 파일이다: 난수·시계·DOM·삼각함수·** 없음 (tests/field/purity.test.ts). 사건 줄은 읽기용이다(셈에 되먹이지 않는다).
 */
import { P } from '../tune/params.ts'
import { clamp, dist2, idiv, nearestDir } from './num.ts'
import { bladeLine, m, mul, perTickAt, rankCmp, ticksOf, walk, type Kit } from './sim.ts'
import { HERO_DIR, LOSS_ART, LOSS_HERO, OP_ATTACK, OP_AUTO, OP_DASH, OP_HERO_DIR, OP_MOVE, OP_SKILL, WHY_BUSY, WHY_COOL, WHY_DOWN, WHY_FAR, WHY_NO_ART, WHY_NO_TARGET, WHY_NONE } from './types.ts'
import type { FieldEvent, FieldInput, FieldState, Hero, Point, Squad } from './types.ts'

const MILLI = 1000
const sq = (x: number): number => x * x
const lastU = (s: FieldState): number => s.map.u * P.field.unit - 1
const lastV = (s: FieldState): number => s.map.w * P.field.unit - 1

/** 사건 줄에 하나 (읽기용) */
export function emit(s: FieldState, e: Omit<FieldEvent, 'tick'>): void {
  s.log.events.push({ tick: s.tick, ...e })
}

/** 마지막 eventKeepSec 초만 남긴다 (끝없이 자라지 않게 · 1초에 한 번 자른다) */
export function pruneEvents(s: FieldState): void {
  if (s.tick % P.field.hz !== 0) return
  const ev = s.log.events, cut = s.tick - ticksOf(P.field.eventKeepSec)
  let k = 0
  while (k < ev.length && ev[k]!.tick < cut) k++
  if (k > 0) ev.splice(0, k)
}

/** 장수 걸음 (단위/초) */
const heroSpeed = (): number => P.field.heroSpeedCellsPerSec * P.field.unit

/** 통솔 배수 (‰) — 본편 leadMul = leadBase + leadPerMu × (무예 + 통솔) ÷ 2 (능력치 1~10 · 여기는 10배라 10 으로 나눈다 · 47 §1-D) */
export function leadPermille(h: Hero): number {
  return m(P.realm.leadBase) + idiv(m(P.realm.leadPerMu) * (h.mu + h.tong), 2 * P.field.heroStatScale)
}

/** 곁의 기운 — 이 대가 덜 꺾이는 몫 (‰ · 곁에 선 제 편 장수가 없거나 쓰러져 있으면 0) */
export function auraOf(s: FieldState, q: Squad): number {
  const r2 = sq(P.field.heroAuraCells * P.field.unit)
  let best = 0
  for (const h of s.heroes) {
    if (h.side !== q.side || h.stun > 0 || dist2(h.u, h.v, q.u, q.v) > r2) continue
    best = Math.max(best, mul(P.field.heroAuraSteadyPermille, leadPermille(h)))
  }
  return Math.min(MILLI, best)
}

/** 버텨라 — 이 대가 받는 피해 배수 (‰ · 곁의 제 편 장수가 버텨라를 쓰고 있으면 tacArtStand) */
export function standOf(s: FieldState, q: Squad): number {
  const r2 = sq(P.field.heroArtCells * P.field.unit)
  for (const h of s.heroes) if (h.side === q.side && h.art === 'stand' && h.artOn > 0 && dist2(h.u, h.v, q.u, q.v) <= r2) return m(P.realm.tacArtStand)
  return MILLI
}

const foeHero = (s: FieldState, h: Hero): Hero | null => s.heroes.find(e => e.side !== h.side) ?? null
const vanguarding = (h: Hero): boolean => h.art === 'vanguard' && h.artOn > 0 && h.dash > 0

/** 우리 장수에게 온 입력 (g = 3) — 꼴은 sim.ts inputOk 가 이미 봤다 */
export function heroInput(s: FieldState, i: FieldInput): void {
  const h = s.heroes.find(e => e.side === 0)
  if (!h) return
  switch (i.op) {
    case OP_MOVE:
      h.manual = 1; h.dir = -1; h.foe = -1
      h.goal = { u: clamp(i.u, 0, lastU(s)), v: clamp(i.v, 0, lastV(s)) }
      return
    case OP_AUTO:
      h.manual = 0; h.dir = -1; h.foe = -1; h.goal = null
      return
    case OP_ATTACK:
      h.manual = 1; h.dir = -1; h.foe = i.u; h.goal = null
      return
    case OP_HERO_DIR:
      h.manual = 1; h.foe = -1; h.goal = null; h.dir = i.v === 1 ? i.u : -1
      return
    case OP_DASH: tryDash(s, h, i.u); return
    case OP_SKILL: trySkill(s, h, i.u, i.v); return
  }
}

const refuse = (s: FieldState, h: Hero, why: number): void => { h.why = why; h.whyTick = s.tick }

/** 내닫기 — 짧은 거리를 빠르게 · 내닫는 동안 안 맞는다 · 적 대를 뚫지는 못한다 */
export function tryDash(s: FieldState, h: Hero, dir: number): void {
  if (h.stun > 0) return refuse(s, h, WHY_DOWN)
  if (h.dash > 0) return refuse(s, h, WHY_BUSY)
  if (h.dashCd > 0) return refuse(s, h, WHY_COOL)
  h.dash = Math.max(1, idiv(P.field.heroDashMs * P.field.hz, MILLI))
  h.dashDir = dir >= 0 ? dir : h.face
  h.dashCd = ticksOf(P.field.heroDashCdSec)
  h.why = WHY_NONE; h.whyTick = s.tick
  emit(s, { kind: 'heroDash', side: h.side, id: -1, u: h.u, v: h.v, n: h.dashDir })
}

const artCdSec = (h: Hero): number => h.art === 'shout' ? P.field.heroCdShoutSec : h.art === 'stand' ? P.field.heroCdStandSec : h.art === 'snipe' ? P.field.heroCdSnipeSec : P.field.heroCdVanguardSec

/** 장수를 다치게 한다 — 체력이 다하면 쓰러져 heroStunSec 못 움직이고(죽지 않는다) 그 편 대마다 사기가 꺾인다 */
export function hurtHero(s: FieldState, h: Hero, d: number, byHero = false): void {
  if (d <= 0 || h.stun > 0) return
  h.hp -= d
  if (h.hp > 0) return
  h.hp = P.field.heroHp
  h.rem = 0
  h.stun = ticksOf(P.field.heroStunSec)
  h.dash = 0; h.artOn = 0; h.dir = h.manual === 1 ? -1 : h.dir
  // 적장이 쓰러뜨렸으면 heroSlainShock (51 §6 「적장을 쓰러뜨리면 적 전체 사기 뚝」) · 아니면 heroDownMorale
  const shock = byHero ? P.field.heroSlainShock : P.field.heroDownMorale
  for (const q of s.squads) if (q.side === h.side) { q.shock += shock; if (byHero) s.stats.artMorale[1 - h.side as 0 | 1] += shock }
  emit(s, { kind: 'heroDown', side: h.side, id: -1, u: h.u, v: h.v, n: 0 })
}

/**
 * 비기 한 칸 (Q) — 쓸 수 있는 조건 · 쿨(초) · 겨눔 · 효과 · 사건 줄. 47 §1-B 의 값(P.realm.tacArt*)을 읽는다.
 * 본편은 「한 판에 한 번 · 한 합 동안」이고 여기는 쿨타임으로 여러 번(49 물음 1 ①)이라 한 번의 몫은 P.field 의 몫(‰)으로 줄여 잰다.
 */
export function trySkill(s: FieldState, h: Hero, tu: number, tv: number): void {
  if (h.art === 'none') return refuse(s, h, WHY_NO_ART)
  if (h.stun > 0) return refuse(s, h, WHY_DOWN)
  if (h.artCd > 0) return refuse(s, h, WHY_COOL)
  if (h.dash > 0) return refuse(s, h, WHY_BUSY)
  const unit = P.field.unit
  const near = (q: Squad, cells: number): boolean => dist2(h.u, h.v, q.u, q.v) <= sq(cells * unit)
  if (h.art === 'snipe') {
    const e = foeHero(s, h)
    if (!e) return refuse(s, h, WHY_NO_TARGET)
    if (dist2(h.u, h.v, e.u, e.v) > sq(P.field.heroSnipeCells * unit)) return refuse(s, h, WHY_FAR)
    // 명궁의 한 발 — 적장 다침 + 적 사기 −tacArtShot (적장이 이미 쓰러져 있으면 사기만)
    hurtHero(s, e, P.field.heroSnipeHp, true)
    const shock = mul(m(P.realm.tacArtShot), P.field.heroSnipeShockPermille)
    for (const q of s.squads) if (q.side !== h.side) q.shock += shock
  } else if (h.art === 'shout') {
    // 큰 외침 — 곁의 무리 사기 +tacArtRally (처음 사기를 넘을 수 있다 · 사기 상한 1000)
    const up = mul(m(P.realm.tacArtRally), P.field.heroRallyPermille)
    for (const q of s.squads) if (q.side === h.side && q.men > 0 && near(q, P.field.heroArtCells)) q.calm += up * MILLI
    // 곁의 적 대는 사기가 뚝 (51 §6 · heroArtFoeShock)
    for (const q of s.squads) if (q.side !== h.side && q.men > 0 && near(q, P.field.heroArtCells)) artHit(s, h, q)
  } else if (h.art === 'stand') {
    // 버텨라 — heroStandSec 동안 곁의 무리 손실 ×tacArtStand (standOf)
    h.artOn = ticksOf(P.field.heroStandSec)
  } else {
    // 선봉 — 겨눈 곳 쪽으로 긴 내닫기 · 적 대를 뚫고 지나가며 곁의 적 대에 피해 (heroStrike)
    const d = nearestDir(tu - h.u, tv - h.v)
    h.dashDir = d >= 0 ? d : h.face
    const sp = mul(heroSpeed(), P.field.heroVanguardSpeedPermille)
    h.dash = Math.max(1, idiv(P.field.heroVanguardCells * unit * P.field.hz, Math.max(1, sp)))
    h.artOn = h.dash
    h.hitIds = []
  }
  h.artCd = ticksOf(artCdSec(h))
  h.why = WHY_NONE; h.whyTick = s.tick
  emit(s, { kind: 'heroSkill', side: h.side, id: -1, u: tu, v: tv, n: 0, art: h.art })
}

/** 이 틱에 장수가 걸어갈 곳 — 적을 쳐라 → 방향 → 찍은 자리(또는 임시 AI 가 정한 곳) */
export function heroGoal(s: FieldState, h: Hero): Point | null {
  if (h.foe >= 0) {
    const e = s.squads[h.foe]
    if (!e || e.men <= 0) { h.foe = -1; return h.goal }
    // 닿는 거리에 들면 멈춘다 (붙어 친다)
    if (dist2(h.u, h.v, e.u, e.v) <= sq(P.field.heroReachCells * P.field.unit) && bladeLine(s.map, h, e)) return null
    return { u: e.u, v: e.v }
  }
  if (h.dir >= 0) return along(s, h, h.dir, heroSpeed())
  return h.goal
}

/** 방향 번호 쪽으로 한 틱 걸음보다 먼 점 (판 안으로) — 걸음은 walk 가 1칸 이하로 나눠 찍는다 */
function along(s: FieldState, h: Hero, dir: number, perSec: number): Point {
  const far = perSec + P.field.unit
  const d = HERO_DIR[dir]!
  return { u: clamp(h.u + idiv(d[0] * far, MILLI), 0, lastU(s)), v: clamp(h.v + idiv(d[1] * far, MILLI), 0, lastV(s)) }
}

/**
 * 장수의 칼 — 닿는 거리의 가장 가까운 적 대(또는 적장)를 친다 (받은 적이 닿으면 그 적 먼저). 세기는 무예에 비례.
 * dmg 는 대마다 이 틱의 피해(백만분의 일 명/초 · sim.ts fight 와 같은 단위) · hits 는 loss 사건을 나누는 몫. 돌려주는 값: 적장에게 준 피해(장수마다).
 * 선봉 내닫기 중이면 칼 대신 곁의 적 대 모두에 heroVanguardHitPermillePerSec.
 */
export function heroStrike(s: FieldState, K: Kit, dmg: number[], hits: number[][]): number[] {
  const toHero = s.heroes.map(() => 0)
  const reach2 = sq(P.field.heroReachCells * P.field.unit)
  for (const h of s.heroes) {
    h.atk = -1
    if (h.stun > 0) continue
    if (vanguarding(h)) {
      for (const q of s.squads) {
        if (q.side === h.side || q.men <= 0 || dist2(h.u, h.v, q.u, q.v) > K.meleeR2) continue
        const v = q.hp * P.field.heroVanguardHitPermillePerSec
        dmg[q.id]! += v; hits[q.id]!.push(-1 - h.side, LOSS_ART, v)
        if (!h.hitIds.includes(q.id)) { h.hitIds.push(q.id); artHit(s, h, q) }
      }
      continue
    }
    if (h.dash > 0) continue
    let best: Squad | null = null, bd = 0
    const fo = h.foe >= 0 ? s.squads[h.foe]! : null
    if (fo && fo.men > 0 && dist2(h.u, h.v, fo.u, fo.v) <= reach2 && bladeLine(s.map, h, fo)) { best = fo; bd = -1 }
    else {
      for (const q of s.squads) {
        if (q.side === h.side || q.men <= 0) continue
        const d = dist2(h.u, h.v, q.u, q.v)
        if (d > reach2 || !bladeLine(s.map, h, q)) continue
        // 동점은 자리로 (배열 차례가 아니다 · 45 §1-2)
        const fq = (q.u - h.u) * (h.side === 0 ? 1 : -1), fb = best ? (best.u - h.u) * (h.side === 0 ? 1 : -1) : 0
        // 같은 자리에 선 두 대도 시작 자리로 가른다 (배열 차례가 아니다 · 차례 섞기 시험 stake/2100/1)
        if (best === null || d < bd || (d === bd && (q.v < best.v || (q.v === best.v && (fq > fb || (fq === fb && rankCmp(s, q, best) < 0)))))) { best = q; bd = d }
      }
    }
    const e = foeHero(s, h)
    const ed = e && e.stun <= 0 && e.dash <= 0 ? dist2(h.u, h.v, e.u, e.v) : -1
    if (e && ed >= 0 && ed <= reach2 && bladeLine(s.map, h, e) && (best === null || (bd >= 0 && ed < bd))) {
      toHero[s.heroes.indexOf(e)]! += h.mu * P.field.heroAtkHeroPerSecPerMu
      h.atk = -2
      continue
    }
    if (!best) continue
    const v = h.mu * P.field.heroAtkPerSecPerMu
    dmg[best.id]! += v; hits[best.id]!.push(-1 - h.side, LOSS_HERO, v)
    h.atk = best.id
  }
  return toHero
}

/**
 * 장수가 맞는다 — 곁(막힘 칸 너머 말고)의 깬 적 앞줄·기병 사람 수에 비례 + 적장의 칼. 내닫는 동안은 안 맞는다.
 * 쓰러져 있는 동안은 틱을 센다 (다 세면 일어남 사건).
 */
export function heroTakeHits(s: FieldState, K: Kit, fromHero: readonly number[]): void {
  const heroDen = P.field.squadMenRef * P.field.hz
  s.heroes.forEach((h, k) => {
    if (h.stun > 0) {
      h.stun--
      if (h.stun === 0) emit(s, { kind: 'heroUp', side: h.side, id: -1, u: h.u, v: h.v, n: 0 })
      return
    }
    if (h.dash > 0) return
    let men = 0
    for (const t of s.squads) if (t.side !== h.side && t.men > 0 && t.grp !== 'bows' && t.sleep <= 0 && dist2(h.u, h.v, t.u, t.v) <= K.meleeR2 && bladeLine(s.map, h, t)) men += t.men
    // 대에게 맞은 몫(squadMenRef 명마다 heroHitPerSec)과 적장의 칼(초당 체력)을 같은 분모로 모아 나머지를 들고 간다
    const num = men * P.field.heroHitPerSec + fromHero[k]! * P.field.squadMenRef + h.rem
    const d = idiv(num, heroDen)
    h.rem = num - d * heroDen
    hurtHero(s, h, d, fromHero[k]! > 0)
  })
}

/** 장수가 대에 막히나 (내닫기는 적 대를 뚫지 못한다) — 적 대 곁 heroBodyCells 안으로 더 다가가는 걸음 */
function blocked(s: FieldState, h: Hero, p: Point): boolean {
  const r2 = sq(P.field.heroBodyCells * P.field.unit)
  for (const q of s.squads) {
    if (q.side === h.side || q.men <= 0) continue
    const d = dist2(p.u, p.v, q.u, q.v)
    if (d <= r2 && d < dist2(h.u, h.v, q.u, q.v)) return true
  }
  return false
}

/** 장수 걸음 (틱 끝 · 대가 다 걸은 뒤) — 내닫기 / 걷기 · 보는 쪽 · 쿨 세기 */
export function heroMove(s: FieldState, K: Kit, asleep: (side: 0 | 1) => boolean): void {
  for (const h of s.heroes) {
    if (h.dashCd > 0) h.dashCd--
    if (h.artCd > 0) h.artCd--
    if (h.artOn > 0 && !(h.art === 'vanguard')) h.artOn--
    if (h.stun > 0) continue
    if (h.dash > 0) {
      const van = vanguarding(h)
      const sp = perTickAt(mul(heroSpeed(), van ? P.field.heroVanguardSpeedPermille : P.field.heroDashSpeedPermille), s.tick)
      const p = walk(s, K, h.side, h.u, h.v, along(s, h, h.dashDir, sp * P.field.hz), sp)
      h.dash--
      if (van) h.artOn = h.dash
      if ((p.u === h.u && p.v === h.v) || (!van && blocked(s, h, p))) { h.dash = 0; if (van) h.artOn = 0; continue }
      h.u = p.u; h.v = p.v
      continue
    }
    const goal = heroGoal(s, h)
    if (!goal || asleep(h.side)) continue
    const p = walk(s, K, h.side, h.u, h.v, goal, perTickAt(heroSpeed(), s.tick))
    const f = nearestDir(p.u - h.u, p.v - h.v)
    if (f >= 0) h.face = f
    h.u = p.u; h.v = p.v
  }
}

/** 비기에 맞은 적 대 — 사기가 그 자리에서 heroArtFoeShock 뚝 (통계 · artHit 사건) */
function artHit(s: FieldState, h: Hero, q: Squad): void {
  q.shock += P.field.heroArtFoeShock
  s.stats.artMorale[h.side] += P.field.heroArtFoeShock
  emit(s, { kind: 'artHit', side: h.side, id: -1, u: q.u, v: q.v, n: P.field.heroArtFoeShock, to: q.id, art: h.art })
}
