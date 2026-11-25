/**
 * 조작표 한 곳 (docs/realm/battle-study/50-control-v2.md · 49 §3) — 동작 이름 → 기본 키.
 * 키 처리(field-main.ts) · 화면의 키 글자(아래 칸) · 조작표 상자(mainHelp.ts)가 전부 이 표를 읽는다.
 * 키는 `KeyboardEvent.code` 로 적는다 (한글 자판이어도 같은 자리의 키가 눌린다). 순수 표 — DOM 을 모른다.
 */
export type ActionName =
  | 'pickHero' | 'pickFront' | 'pickBows' | 'pickHorse' | 'pickAll'
  | 'cmd1' | 'cmd2' | 'cmd3' | 'cmd4'
  | 'heroUp' | 'heroDown' | 'heroLeft' | 'heroRight'
  | 'skillQ' | 'skillE' | 'skillR' | 'dash'
  | 'camFree' | 'camFight' | 'camLeft' | 'camRight' | 'camUp' | 'camDown'
  | 'pause' | 'slow' | 'go' | 'help'

export const KEYS: Readonly<Record<ActionName, readonly string[]>> = {
  pickHero: ['Digit1'],
  pickFront: ['Digit2'],
  pickBows: ['Digit3'],
  pickHorse: ['Digit4'],
  pickAll: ['Backquote'],
  cmd1: ['KeyZ'],
  cmd2: ['KeyX'],
  cmd3: ['KeyC'],
  cmd4: ['KeyV'],
  heroUp: ['KeyW'],
  heroDown: ['KeyS'],
  heroLeft: ['KeyA'],
  heroRight: ['KeyD'],
  skillQ: ['KeyQ'],
  skillE: ['KeyE'],
  skillR: ['KeyR'],
  dash: ['Space'],
  camFree: ['KeyY'],
  camFight: ['Tab'],
  camLeft: ['ArrowLeft'],
  camRight: ['ArrowRight'],
  camUp: ['ArrowUp'],
  camDown: ['ArrowDown'],
  pause: ['KeyP', 'Escape'],
  slow: ['ShiftLeft', 'ShiftRight'],
  go: ['Enter'],
  help: ['Slash'],
}

/** 이 키(code)가 어느 동작인가 · 없으면 null */
export function actionOf(code: string): ActionName | null {
  for (const name of Object.keys(KEYS) as ActionName[]) if (KEYS[name].includes(code)) return name
  return null
}

const LABEL: Readonly<Record<string, string>> = {
  Backquote: '`', Space: 'Space', Escape: 'Esc', Enter: 'Enter', Tab: 'Tab', Slash: '?',
  ShiftLeft: 'Shift', ShiftRight: 'Shift', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓',
}
/** 화면에 적을 키 글자 (code → 글자) */
export function keyLabel(code: string): string {
  const known = LABEL[code]
  if (known !== undefined) return known
  if (code.startsWith('Key')) return code.slice(3)
  if (code.startsWith('Digit')) return code.slice(5)
  return code
}
/** 동작의 첫 키 글자 (화면에 하나만 적을 때) */
export const firstKeyLabel = (name: ActionName): string => keyLabel(KEYS[name][0] ?? '')
