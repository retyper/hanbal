/// <reference types="vite/client" />
/**
 * 장수 겨루기 시험판 (duel.html) — 주소에 ?me=aryeong&foe=haebi&muMe=5&muFoe=5&tier=1&seed=1
 * 화면·손·소리는 src/duel/view.ts (본편 전투판도 같은 것을 띄운다).
 */
import { mountDuel } from './duel/view.ts'
import { GEN_OWN, HERO_BUST } from './realm/data/art.ts'

const params = new URLSearchParams(location.search)
const num = (k: string, d: number): number => { const v = Number(params.get(k)); return params.get(k) !== null && Number.isFinite(v) ? v : d }
const NAMES: Record<string, string> = {
  aryeong: '알영', haebi: '해비', jumong: '주몽', soseono: '소서노', onjo: '온조', ara: '아라', gamsil: '감실', soebi: '쇠비', eomni: '엄니',
  malgalgi: '말갈기', daeso: '대소', hyeokgeose: '혁거세', duman: '두만', heo: '허황옥', irang: '이랑', gureum: '구름', beombal: '범발', dalli: '달리',
}
/** 띠 이름 → 초상 id (본편 표 그대로) */
const portraitOf = (key: string): string | undefined => {
  for (const [rid, k] of Object.entries(GEN_OWN)) if (k === key && HERO_BUST[rid] !== undefined) return HERO_BUST[rid]
  return undefined
}
const side = (key: string, mu: number) => {
  const p = portraitOf(key)
  return { name: NAMES[key] ?? key, mu, sprite: key, ...(p !== undefined ? { portrait: p } : {}) }
}
const meKey = params.get('me') ?? 'aryeong'
const foeKey = params.get('foe') ?? 'haebi'
void mountDuel({ me: side(meKey, num('muMe', 5)), foe: side(foeKey, num('muFoe', 5)), tier: num('tier', 1), seed: num('seed', 1), standalone: true })
