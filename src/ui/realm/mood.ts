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

export type Mood = 'joy' | 'warm' | 'calm' | 'wary' | 'angry' | 'afraid'

export const MOOD_WORD: Readonly<Record<Mood, string>> = {
  joy: '기뻐한다', warm: '반가워한다', calm: '덤덤하다', wary: '경계한다', angry: '노했다', afraid: '두려워한다',
}

/** 땅 수 — 누구나 아는 크기 */
const lands = (r: Realm, f: string): number => Object.values(r.nodes).filter((n) => n.owner === f).length

/** `them` 의 군장이 `me` 를 보는 얼굴과 그 까닭 */
export function moodOf(r: Realm, me: string, them: string): { mood: Mood; why: string; say: string } {
  const m = moodWhy(r, me, them)
  return { ...m, say: SAY[m.why] ?? `${m.why} 싶습니다` }
}

/** 까닭 → 신하의 말 (짐작이라 "~듯합니다") */
const SAY: Readonly<Record<string, string>> = {
  '싸우는 중인데 우리가 훨씬 크다': '싸우고는 있지만 우리가 훨씬 크니 겁을 먹은 듯합니다.',
  '우리가 그 땅을 빼앗았다': '우리가 땅을 빼앗았으니 이를 갈고 있을 겁니다.',
  '우리와 싸우는 중이다': '싸우는 사이니 좋을 리가 없지요.',
  '동맹이고 정이 두텁다': '오가는 사신마다 얼굴이 밝습니다. 정이 두텁습니다.',
  '동맹이다': '동맹이라 우리를 반기는 눈치입니다.',
  '화친했고 정이 두텁다': '화친한 뒤로 사이가 퍽 좋습니다.',
  '화친한 사이다': '화친한 사이라 낯빛이 밝습니다.',
  '화친은 했지만 정은 없다': '화친은 했지만 아직 서먹합니다.',
  '우리를 몹시 미워한다': '사신을 보내도 문전박대입니다. 몹시 미워하는 듯합니다.',
  '우리에게 마음이 있다': '선물이 오간 뒤로 우리를 좋게 보는 듯합니다.',
  '곁에 붙은 우리가 훨씬 크다': '바로 곁의 우리가 훨씬 크니 겁을 먹은 듯합니다.',
  '우리가 앞서간다고 본다': '우리가 앞서간다고 보고 눈여겨보는 듯합니다.',
  '우리를 좋게 보지 않는다': '우리를 좋게 보지 않는 눈치입니다.',
  '아직 아무 사이도 아니다': '아직 오간 일이 없어 속을 모르겠습니다.',
}

function moodWhy(r: Realm, me: string, them: string): { mood: Mood; why: string } {
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
/* 신하의 짐작 — 얼굴 · 이름 · 따옴표 말 */
.ap .said { display: flex; align-items: flex-start; gap: 6px; margin-top: 3px; font-size: 12.5px; color: #d8cfbf; line-height: 1.45; }
.ap .said .sface { width: 24px; height: 24px; border-radius: 50%; object-fit: cover; flex: none; border: 1px solid #6a5a40; }
.ap .said .sface.noface { display: inline-block; background: #3a3328; }
.ap .said i { font-style: normal; color: var(--gold); font-weight: 700; margin-right: 4px; white-space: nowrap; }
.ap .said q { quotes: '“' '”'; }
.ap .moodl.angry b { color: #ff8a70; } .ap .moodl.afraid b { color: #c8c0f0; } .ap .moodl.calm b { color: #d8d0c0; }
`
