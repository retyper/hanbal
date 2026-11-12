/**
 * 그 나라 군장의 얼굴 — 우리를 어떻게 보나 (형: "문명에선 타국 누를때마다 관계가 좋은지 안좋은지 바로나오잖아.
 * 별도로 만든 이모지표정으로 보여주는게 어떨까? … 직관적으로 얘네가 누군지, 어떻게 대할지 감이 안잡힘").
 *
 * 한국 탈 여섯 (public/realm/icon/mood-*.png): 기뻐한다 하회 양반탈 · 반가워한다 이매탈 (낱말은 다 마음 — 형: "'웃는다' 상태 이상한데.. 감정이어야") · 덤덤하다 중탈 · 경계한다 선비탈 · 노했다 봉산 먹중탈 · 두려워한다 할미탈.
 * 일본 노탈·오니, 중국 경극 얼굴과 섞지 않는다 (형: "탈도 절대 일본이나 중국문화랑 섞지마라").
 * 사이(전쟁·중립·화친·동맹) · 호감 · 우리가 그 땅을 빼앗았나 · 우리가 앞서가나 · 땅 크기 차이로 정한다 — 화면만 읽는다.
 * 까닭 한 줄을 함께 내서 "왜 저 얼굴인가"가 바로 보이게.
 * 까닭은 **우리 신하의 짐작**으로 말한다 (say) — 판이 아는 것을 내레이션하지 않는다. 짐작의 재료는 누구나 보는 것(땅 크기 · 싸움 · 오간 사신)뿐
 * (형 2026-10-20: "전지적작가시점에서 정보전달하면안된다니까? 주변정보나 인물의 발언 같은걸로 해야해").
 */
import { favorOf, relationOf } from '../../realm/diplomacy.ts'
import { borders, leaderOf, tookRecently } from '../../realm/stance.ts'
import type { Realm } from '../../realm/types.ts'
import { lazyTable, t as tr, type Key } from '../../i18n/index.ts'

export type Mood = 'joy' | 'warm' | 'calm' | 'wary' | 'angry' | 'afraid'

export const MOOD_WORD: Readonly<Record<Mood, string>> = lazyTable('moodWord', ['joy', 'warm', 'calm', 'wary', 'angry', 'afraid'])

/** 땅 수 — 누구나 아는 크기 */
const lands = (r: Realm, f: string): number => Object.values(r.nodes).filter((n) => n.owner === f).length

/** 까닭의 이름 — 말은 mood.why.<이름> (까닭 한 줄) · mood.say.<이름> (신하의 짐작) */
type WhyId = 'warBig' | 'tookLand' | 'atWar' | 'allyWarm' | 'ally' | 'truceWarm' | 'truce' | 'truceCold' | 'hate' | 'fond' | 'nearBig' | 'leads' | 'dislike' | 'none'

/** `them` 의 군장이 `me` 를 보는 얼굴과 그 까닭 */
export function moodOf(r: Realm, me: string, them: string): { mood: Mood; why: string; say: string } {
  const m = moodWhy(r, me, them)
  return { mood: m.mood, why: tr(`mood.why.${m.why}` as Key), say: tr(`mood.say.${m.why}` as Key) }
}

function moodWhy(r: Realm, me: string, them: string): { mood: Mood; why: WhyId } {
  const rel = relationOf(r, me, them)
  const fav = favorOf(r, me, them)
  const big = lands(r, me) >= Math.max(3, lands(r, them) * 2) // 우리가 훨씬 크다
  const near = borders(r, me, them)
  if (rel.state === 'war') {
    if (big && near) return { mood: 'afraid', why: 'warBig' }
    return { mood: 'angry', why: tookRecently(r, me, them) ? 'tookLand' : 'atWar' }
  }
  if (rel.state === 'ally') return fav >= 40 ? { mood: 'joy', why: 'allyWarm' } : { mood: 'warm', why: 'ally' }
  if (rel.state === 'truce') {
    if (fav >= 50) return { mood: 'joy', why: 'truceWarm' }
    if (fav >= 0) return { mood: 'warm', why: 'truce' }
    return { mood: 'calm', why: 'truceCold' }
  }
  // 중립
  if (tookRecently(r, me, them)) return { mood: 'angry', why: 'tookLand' }
  if (fav <= -40) return { mood: 'angry', why: 'hate' }
  if (fav >= 40) return { mood: 'warm', why: 'fond' }
  if (big && near) return { mood: 'afraid', why: 'nearBig' }
  if (leaderOf(r, them) === me) return { mood: 'wary', why: 'leads' }
  if (fav <= -10) return { mood: 'wary', why: 'dislike' }
  return { mood: 'calm', why: 'none' }
}

/** 탈 그림 하나 — `cls` 로 크기 */
export function moodImg(art: string, m: Mood, cls = 'mood'): string {
  return `<img class="${cls}" src="${art}icon/mood-${m}.png" alt="${MOOD_WORD[m]}" title="${MOOD_WORD[m]}">`
}

export const MOOD_CSS = `
.ap img.mood { width: 44px; height: 44px; flex: none; filter: drop-shadow(0 2px 3px #0009); }
.ap img.mood.sm { width: 22px; height: 22px; filter: drop-shadow(0 1px 1px #0008); }
.ap .moodl { display: flex; align-items: center; gap: 8px; margin: 2px 0 6px; }
.ap .moodl > div { display: flex; flex-direction: column; } .ap .moodl b { font-size: 15px; } .ap .moodl span { font-size: 12.5px; color: var(--mute); }
.ap .moodl.joy b, .ap .moodl.warm b { color: #9fd18b; } .ap .moodl.wary b { color: #e8c070; }
/* 신하의 짐작 — 얼굴 · 이름 · 따옴표 말 */
.ap .said { display: flex; align-items: flex-start; gap: 6px; margin-top: 3px; font-size: 12.5px; color: #d8cfbf; line-height: 1.45; }
.ap .said .sface { width: 24px; height: 24px; border-radius: 50%; object-fit: cover; flex: none; border: 1px solid #6a5a40; }
.ap .said .sface.noface { display: inline-block; background: #3a3328; }
.ap .said i { font-style: normal; color: var(--gold); font-weight: 700; margin-right: 4px; white-space: nowrap; }
.ap .said q { quotes: '“' '”'; }
.ap .moodl.angry b { color: #ff8a70; } .ap .moodl.afraid b { color: #c8c0f0; } .ap .moodl.calm b { color: #d8d0c0; }
`
