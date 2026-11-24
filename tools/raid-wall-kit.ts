// raid-early · raid-wall 이 같이 쓰는 켜기 손잡이 — TAG 환경 변수로 새 규칙 태그를 겹쳐 켠다 (비우면 지금 판 그대로)
import type { HaebiOpts } from '../src/raid/haebi.ts'
export function extraRules(env: NodeJS.ProcessEnv = process.env): Partial<HaebiOpts> {
  const tags = (env['TAG'] ?? '').split(',').filter(Boolean), out: Record<string, string> = {}
  for (const t of tags) {
    if (t === '75-WALL') out['wallRules'] = '75-WALL'
    else throw new Error(`알 수 없는 TAG ${t}`)
  }
  return out as Partial<HaebiOpts>
}
