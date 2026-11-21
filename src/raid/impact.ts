import type { HaebiRun } from './haebi.ts'
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
  get stopped() { return this.time < this.stopUntil }
  get stopRemaining() { return Math.max(0, this.stopUntil - this.time) }
  get shake() { return Math.min(F.shakeMax, this.strength * Math.max(0, (this.shakeUntil - this.time) / F.shakeLife)) }
  advance(dt: number, active: boolean) { if (active) this.time += Math.max(0, dt) }
  observe(run: HaebiRun) {
    const bossHp = run.enemies.find(e => e.kind === 'boss' && e.hp > 0)?.hp ?? 0
    if (this.run !== run) {
      this.run = run; this.time = 0; this.stopUntil = this.nextStop = this.shakeUntil = this.strength = 0
      this.seen = new WeakSet(run.fx); this.hp = run.hp; this.hurt = run.hurt; this.elites = run.elites; this.bossHp = bossHp
      return
    }
    let stop = 0, shake = 0
    for (const f of run.fx) if (!this.seen.has(f)) {
      this.seen.add(f)
      if (f.crit) { stop = Math.max(stop, F.criticalStop); shake = Math.max(shake, F.shakeCritical) }
      if (f.championCue === 'enter' || f.championCue === 'roar') { stop = Math.max(stop, F.eliteStop); shake = Math.max(shake, F.shakeElite) }
      if (f.recoveryHit || f.awakenedRelease) { stop = Math.max(stop, F.bossSkillStop); shake = Math.max(shake, F.shakeSkill) }
    }
    if (run.elites > this.elites) { stop = Math.max(stop, F.eliteStop); shake = Math.max(shake, F.shakeElite) }
    if (run.hp < this.hp || run.hurt > this.hurt) { stop = Math.max(stop, F.hurtStop); shake = Math.max(shake, F.shakeHurt) }
    // Multi-beat ultimates can hit after their opening effect was first observed.
    if (this.bossHp > 0 && bossHp < this.bossHp && (run.ult !== null || run.fx.some(f => f.kind === 'skill' && f.ult))) { stop = Math.max(stop, F.bossSkillStop); shake = Math.max(shake, F.shakeSkill) }
    if (stop && this.time >= this.nextStop) { this.stopUntil = this.time + stop; this.nextStop = this.time + F.cooldown }
    if (shake) { this.strength = Math.max(this.shake, shake); this.shakeUntil = this.time + F.shakeLife }
    this.hp = run.hp; this.hurt = run.hurt; this.elites = run.elites; this.bossHp = bossHp
  }
}
