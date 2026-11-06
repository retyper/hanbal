export const BATTLE_SPEEDS = [1, 2, 2.5] as const
export type BattleSpeed = typeof BATTLE_SPEEDS[number]

export function battleSpeed(value: number): BattleSpeed {
  return value === 2 || value === 2.5 ? value : 1
}

/** Shared presentation clock. A rate change keeps elapsed battle time continuous. */
export function battlePlayback(initialRate: number) {
  let rate = initialRate
  let anchor = performance.now()
  let elapsed = 0
  const pending = new Set<{ due: number; run: () => void; id: number }>()
  const now = (time = performance.now()): number => elapsed + (time - anchor) * rate
  const arm = (job: { due: number; run: () => void; id: number }): void => {
    job.id = window.setTimeout(() => {
      pending.delete(job)
      job.run()
    }, Math.max(0, (job.due - now()) / rate))
  }
  return {
    get rate() { return rate },
    now,
    setRate(next: number): void {
      if (rate === next) return
      const time = performance.now()
      elapsed = now(time)
      anchor = time
      rate = next
      for (const job of pending) { clearTimeout(job.id); arm(job) }
    },
    after(run: () => void, ms: number): () => void {
      const job = { due: now() + ms, run, id: 0 }
      pending.add(job)
      arm(job)
      return () => { clearTimeout(job.id); pending.delete(job) }
    },
  }
}

export type BattlePlayback = ReturnType<typeof battlePlayback>
