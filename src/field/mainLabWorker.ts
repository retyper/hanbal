/**
 * 실험실 일꾼 — 판 짜임 하나를 봇 셋으로 n 판씩 돌려 「이 판의 봇 기준」을 낸다 (화면을 막지 않게 따로 돈다).
 * 받는 것 { key, cfg, n } · 보내는 것 { key, done, total, sums } (판 하나 끝날 때마다 · 마지막은 done === total)
 */
import { addRun, emptySum, labBot, LAB_BOTS, type LabBotSum } from './labbots.ts'
import type { LabConfig } from './scenario.ts'

const ctx = self as unknown as { onmessage: ((e: MessageEvent) => void) | null; postMessage(m: unknown): void }
ctx.onmessage = (e: MessageEvent): void => {
  const { key, cfg, n } = e.data as { key: string; cfg: LabConfig; n: number }
  const sums: Record<string, LabBotSum> = {}
  for (const b of LAB_BOTS) sums[b] = emptySum()
  const total = n * LAB_BOTS.length
  let done = 0
  for (let i = 0; i < n; i++) for (const b of LAB_BOTS) {
    addRun(sums[b]!, labBot(cfg, cfg.seed + i, b))
    done++
    ctx.postMessage({ key, done, total, sums })
  }
}
