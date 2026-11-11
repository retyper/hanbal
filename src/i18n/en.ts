/**
 * English — 없는 키는 한국어로 나간다(빈 칸은 없다). 고유명사는 국어의 로마자 표기법: Mahan, Jinhan, Byeonhan, Saro.
 * 삼한은 한반도 남부의 세 연맹 (한국사 중심 · 중국의 속국 틀 금지). 말투는 번역투가 아니라 영어로 자연스럽게.
 * 아직 안 옮긴 키는 PENDING_EN 에 적는다(tests/i18n.test.ts 가 읽는다).
 */
import type { Key } from './ko.ts'

export const en: Partial<Record<Key, string>> = {
  'title.logoAlt': 'Samhan Chronicles',
  'title.continue': 'Continue as {name}',
  'title.progress': 'Capitals {caps}/{need}',
  'title.known': 'Known realms {n}/{total}',
  'title.savedAgo': 'Last saved {ago}',
  'title.learnFirst': 'New here? Start with the tutorial',
  'title.new': 'New Game',
  'title.load': 'Load',
  'title.loadCount': '{n|game|games} in progress',
  'title.heroes': 'Heroes',
  'title.drill': 'Training Ground',
  'title.annals': 'My History',
  'title.unfinished': 'Games in progress',
  'title.dropSlot': 'Delete this game',
  'title.dropConfirm': 'Tap again to delete',
  'ago.now': 'just now',
  'ago.min': '{n|minute|minutes} ago',
  'ago.hour': '{n|hour|hours} ago',
  'ago.day': '{n|day|days} ago',
  'more.open': 'More',
  'more.close': 'Close',
  'more.closeAria': 'Close',
  'more.gfxSafe': 'Graphics safe mode is on',
  'more.install': '📲 Install as app',
  'more.archery': 'Archery Range',
  'more.practice': 'Archery Practice',
  'more.credits': 'Sound credits',
  'more.spar': '⚔ Practice Duel',
  'more.sparTip': 'Jump straight into a single duel. Your current game stays as it is',
  'more.export': 'Export records',
  'more.exportTip': 'Save the records of your {n|game|games} so far as a file',
  'more.login': 'Sign in with Google',
  'more.loginTip': 'Pick up a game from another device',
  'gfx.title': 'Graphics',
  'gfx.auto': 'Auto',
  'gfx.low': 'Low',
  'gfx.mid': 'Medium',
  'gfx.high': 'High',
  'gfx.now': 'Now: {tier}',
  'vol.title': 'Volume',
  'vol.bgm': 'Music',
  'vol.sfx': 'Effects',
  'vol.voice': 'Voices',
  'vol.aria': '{name} volume',
  'lang.title': 'Language',
  'lang.ko': '한국어',
  'lang.en': 'English',
  'boards.back': '‹ Back',
  'boards.title': 'Which story will you play?',
  'boards.warn': 'Starting a new game will record the current one as finished.',
  'boards.freeTitle': 'Free Play',
  'detail.start': 'Start with this realm',
}

/** 아직 영어로 안 옮긴 키 — 일부러 비워 둔 것만 (한국어로 나간다) */
export const PENDING_EN: readonly Key[] = []
