import type { HaebiRun } from './haebi.ts'
import { HAEBI_END as E } from '../tune/params.ts'
import { koDuration, koStampAt } from './ko.ts'

export type EndingKind = 'victory' | 'defeat' | 'retreat'
/** Presentation clock, independent of pause/offers and simulation time. */
export class RaidEnding {
  private run: HaebiRun | null = null
  kind: EndingKind | null = null
  elapsed = 0
  boss = { x: 0, y: 0 }
  private startPending = false
  private stamped = false
  observe(run: HaebiRun) {
    if (this.run !== run) { this.run = run; this.kind = null; this.elapsed = 0; this.stamped = false; this.startPending = false }
    if (run.state === 'playing' || this.kind) return
    this.kind = run.state === 'won' ? 'victory' : run.hp <= 0 ? 'defeat' : 'retreat'
    const boss = run.fx.find(f => f.kind === 'death' && f.mob === 'boss')
    const giant = this.kind === 'victory' && run.giantFlow?.finalDefeated ? run.giantFlow.finalOwner : undefined
    this.boss = giant ? { x: giant.x, y: giant.y } : boss ? { x: boss.x, y: boss.y } : { x: run.x, y: run.y }
    this.startPending = true
  }
  /** 쓰러짐(defeat)은 KO 막 — 맞은 멈춤 · 쓰러지는 칸 · 누운 채 멈춤 (raid/ko.ts) */
  get duration() { return this.kind === 'victory' ? E.victory.duration : this.kind === 'defeat' ? koDuration() : E.retreatDuration }
  get freeze() { return this.kind === 'victory' ? E.victory.freeze : this.kind === 'defeat' ? E.defeat.freeze : 0 }
  get stampAt() { return this.kind === 'victory' ? E.victory.stampAt : this.kind === 'defeat' ? koStampAt() : Infinity }
  get active() { return this.kind !== null && this.elapsed < this.duration }
  get effectTime() { return Math.max(0, this.elapsed - this.freeze) * E.slowRate }
  get ready() { return this.kind !== null && !this.active }
  advance(dt: number, visible: boolean) { if (visible && this.active) this.elapsed = Math.min(this.duration, this.elapsed + Math.max(0, dt)) }
  skip() { if (this.kind) this.elapsed = this.duration }
  events() {
    const start = this.startPending; this.startPending = false
    const stamp = !this.stamped && this.elapsed >= this.stampAt
    if (stamp) this.stamped = true
    return { start, stamp }
  }
}
