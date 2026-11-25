import type { HaebiRun } from './haebi.ts'
import { slamWatcher } from './slam-watch.ts'
import { criticalFinishEvent } from './critical-finish.ts'
import { HAEBI_IMPACT as F } from '../tune/params.ts'
/** Wall-time presentation state; observe never mutates the simulation. */
export class RaidFeel {
  time = 0
  private run: HaebiRun | null = null
  private seen = new WeakSet<object>()
  private stopUntil = 0
  private nextStop = 0
  private shakeUntil = 0
  private strength = 0
  private hp = 0
  private hurt = 0
  private elites = 0
  private bossHp = 0
  /** 큰 마무리(얼었다가 펑): 고른 이펙트 · 다음 큰 마무리가 허락되는 때 · 풀려 펑 하는 때(0 = 없음) · 펑을 아직 못 알렸나 */
  private bigs = new WeakSet<object>()
  private nextBig = 0
  private popAt = 0
  private popPending = false
  private slams = slamWatcher()   // 장수급 적 내려찍기도 흔들린다 (보스 「쿵」은 아래 quake 고리로)
  get stopped() { return this.time < this.stopUntil }
  get stopRemaining() { return Math.max(0, this.stopUntil - this.time) }
  get shake() {
    const pop = this.popAt > 0 && this.time >= this.popAt ? F.shakeFinish * Math.max(0, 1 - (this.time - this.popAt) / F.shakeLife) : 0
    return Math.min(F.shakeMax, Math.max(pop, this.strength * Math.max(0, (this.shakeUntil - this.time) / F.shakeLife)))
  }
  /** 이 마무리가 큰 마무리인가 (그리는 쪽·소리가 같은 답을 쓴다) */
  isBig = (f: object) => this.bigs.has(f)
  /** 얼음이 풀려 펑 하는 순간이면 한 번만 true (진동을 거기에 맞춘다) */
  consumePop() { if (this.popPending && this.time >= this.popAt) { this.popPending = false; return true } return false }
  advance(dt: number, active: boolean) { if (active) this.time += Math.max(0, dt) }
  observe(run: HaebiRun) {
    const bossHp = run.enemies.find(e => e.kind === 'boss' && e.hp > 0)?.hp ?? 0
    if (this.run !== run) {
      this.run = run; this.time = 0; this.stopUntil = this.nextStop = this.shakeUntil = this.strength = 0
      this.bigs = new WeakSet(); this.nextBig = this.popAt = 0; this.popPending = false
      this.seen = new WeakSet(run.fx); this.hp = run.hp; this.hurt = run.hurt; this.elites = run.elites; this.bossHp = bossHp
      return
    }
    let stop = 0, shake = 0, big: { n: number } | null = null, bigFx: object | null = null
    for (const f of run.fx) if (!this.seen.has(f)) {
      this.seen.add(f)
      // 한 번에 여럿이 죽으면 가장 센 한 놈만 큰 마무리 후보
      if (F.criticalFinish.bigHold && criticalFinishEvent(f) && (!big || (f.n ?? 0) > big.n)) { big = { n: f.n ?? 0 }; bigFx = f }
      if (f.crit) { stop = Math.max(stop, F.criticalStop); shake = Math.max(shake, F.shakeCritical) }
      if (f.championCue === 'enter' || f.championCue === 'roar' || f.championCue === 'quake') { stop = Math.max(stop, F.eliteStop); shake = Math.max(shake, F.shakeElite) }
      if (f.recoveryHit || f.awakenedRelease) { stop = Math.max(stop, F.bossSkillStop); shake = Math.max(shake, F.shakeSkill) }
    }
    if (this.slams(run).some(q => !q.boss)) shake = Math.max(shake, F.shakeElite)
    if (run.elites > this.elites) { stop = Math.max(stop, F.eliteStop); shake = Math.max(shake, F.shakeElite) }
    if (run.hp < this.hp || run.hurt > this.hurt) { stop = Math.max(stop, F.hurtStop); shake = Math.max(shake, F.shakeHurt) }
    // Multi-beat ultimates can hit after their opening effect was first observed.
    if (this.bossHp > 0 && bossHp < this.bossHp && (run.ult !== null || run.fx.some(f => f.kind === 'skill' && f.ult))) { stop = Math.max(stop, F.bossSkillStop); shake = Math.max(shake, F.shakeSkill) }
    // 큰 마무리: 마지막 큰 것 뒤 bigGap 이 지났으면 모두 bigHold 초 얼린다 (다른 멈칫의 쉬는 틈과 상관없이)
    const frozen = !!bigFx && this.time >= this.nextBig
    if (frozen) { this.bigs.add(bigFx!); this.nextBig = this.time + F.criticalFinish.bigGap; this.popAt = this.time + F.criticalFinish.bigHold; this.popPending = true; this.stopUntil = Math.max(this.stopUntil, this.popAt); this.nextStop = Math.max(this.nextStop, this.popAt + F.cooldown) }
    else if (stop && this.time >= this.nextStop) { this.stopUntil = this.time + stop; this.nextStop = this.time + F.cooldown }
    if (shake) { this.strength = Math.max(this.shake, shake); this.shakeUntil = this.time + F.shakeLife }
    this.hp = run.hp; this.hurt = run.hurt; this.elites = run.elites; this.bossHp = bossHp
  }
}
