/**
 * 그 나라 군장의 얼굴 — 우리를 어떻게 보나 (형: "문명에선 타국 누를때마다 관계가 좋은지 안좋은지 바로나오잖아.
 * 별도로 만든 이모지표정으로 보여주는게 어떨까? … 직관적으로 얘네가 누군지, 어떻게 대할지 감이 안잡힘").
 *
 * 하회탈 여섯 (public/realm/icon/mood-*.png): 반긴다 · 웃는다 · 덤덤하다 · 경계한다 · 노했다 · 두려워한다.
 * 사이(전쟁·중립·화친·동맹) · 호감 · 우리가 그 땅을 빼앗았나 · 우리가 앞서가나 · 땅 크기 차이로 정한다 — 화면만 읽는다.
 * 까닭 한 줄을 함께 내서 "왜 저 얼굴인가"가 바로 보이게.
 */
import { favorOf, relationOf } from '../../realm/diplomacy.ts'
import { borders, leaderOf, tookRecently } from '../../realm/stance.ts'
import type { Realm } from '../../realm/types.ts'

export type Mood = 'joy' | 'warm' | 'calm' | 'wary' | 'angry' | 'afraid'

export const MOOD_WORD: Readonly<Record<Mood, string>> = {
  joy: '반긴다', warm: '웃는다', calm: '덤덤하다', wary: '경계한다', angry: '노했다', afraid: '두려워한다',
}

/** 땅 수 — 누구나 아는 크기 */
const lands = (r: Realm, f: string): number => Object.values(r.nodes).filter((n) => n.owner === f).length

/** `them` 의 군장이 `me` 를 보는 얼굴과 그 까닭 */
export function moodOf(r: Realm, me: string, them: string): { mood: Mood; why: string } {
  const rel = relationOf(r, me, them)
  const fav = favorOf(r, me, them)
  const big = lands(r, me) >= Math.max(3, lands(r, them) * 2) // 우리가 훨씬 크다
  const near = borders(r, me, them)
  if (rel.state === 'war') {
    if (big && near) return { mood: 'afraid', why: '싸우는 중인데 우리가 훨씬 크다' }
    return { mood: 'angry', why: tookRecently(r, me, them) ? '우리가 그 땅을 빼앗았다' : '우리와 싸우는 중이다' }
  }
  if (rel.state === 'ally') return fav >= 40 ? { mood: 'joy', why: '동맹이고 정이 두텁다' } : { mood: 'warm', why: '동맹이다' }
  if (rel.state === 'truce') {
    if (fav >= 50) return { mood: 'joy', why: '화친했고 정이 두텁다' }
    if (fav >= 0) return { mood: 'warm', why: '화친한 사이다' }
    return { mood: 'calm', why: '화친은 했지만 정은 없다' }
  }
  // 중립
  if (tookRecently(r, me, them)) return { mood: 'angry', why: '우리가 그 땅을 빼앗았다' }
  if (fav <= -40) return { mood: 'angry', why: '우리를 몹시 미워한다' }
  if (fav >= 40) return { mood: 'warm', why: '우리에게 마음이 있다' }
  if (big && near) return { mood: 'afraid', why: '곁에 붙은 우리가 훨씬 크다' }
  if (leaderOf(r, them) === me) return { mood: 'wary', why: '우리가 앞서간다고 본다' }
  if (fav <= -10) return { mood: 'wary', why: '우리를 좋게 보지 않는다' }
  return { mood: 'calm', why: '아직 아무 사이도 아니다' }
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
.ap .moodl.angry b { color: #ff8a70; } .ap .moodl.afraid b { color: #c8c0f0; } .ap .moodl.calm b { color: #d8d0c0; }
`
