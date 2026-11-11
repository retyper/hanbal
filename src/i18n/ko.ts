/**
 * 한국어 글 — 이 표가 원본이다(키의 모양이 곧 형식). 영어는 en.ts, 없으면 여기 글이 나간다.
 * 자리표: {name} 그대로 · {name|이/가} 받침 따라 조사(한국어만) · 영어는 {n|day/days} 하나·여럿.
 * 이름 규칙: 화면.쓰임 (title.new · more.close). 새로 넣으면 docs/realm/I18N.md 의 「글 하나 더하기」.
 */
export const ko = {
  // 첫 화면
  'title.logoAlt': '삼한열전',
  'title.continue': '{name} 이어 하기',
  'title.progress': '도읍 {caps}/{need}',
  'title.known': '아는 나라 {n}/{total}',
  'title.savedAgo': '최근 저장 · {ago}',
  'title.learnFirst': '처음이면, 배우는 판부터',
  'title.new': '새 게임',
  'title.load': '불러오기',
  'title.loadCount': '끝나지 않은 판 {n}',
  'title.heroes': '영웅전',
  'title.drill': '단련터',
  'title.annals': '나의 역사',
  'title.unfinished': '끝나지 않은 판',
  'title.dropSlot': '이 판 지우기',
  'title.dropConfirm': '한 번 더 누르면 지운다',
  // 때
  'ago.now': '방금',
  'ago.min': '{n}분 전',
  'ago.hour': '{n}시간 전',
  'ago.day': '{n}일 전',
  // 더 보기 · 설정
  'more.open': '더 보기',
  'more.close': '닫기',
  'more.closeAria': '닫기',
  'more.gfxSafe': '그래픽 호환 모드 켜짐',
  'more.install': '📲 앱으로 설치',
  'more.archery': '활터',
  'more.practice': '궁술 연습장',
  'more.credits': '소리 출처',
  'more.spar': '⚔ 연습 싸움',
  'more.sparTip': '판을 거치지 않고 싸움 한 판을 바로 엽니다. 하던 판은 그대로입니다',
  'more.export': '기록 내보내기',
  'more.exportTip': '지금까지 둔 판 {n}개의 기록을 파일로 받는다',
  'more.login': '구글 로그인',
  'more.loginTip': '다른 기기에서 하던 판을 이어 할 수 있습니다',
  'gfx.title': '그래픽',
  'gfx.auto': '자동',
  'gfx.low': '저사양',
  'gfx.mid': '보통',
  'gfx.high': '고사양',
  'gfx.now': '지금 {tier}',
  'vol.title': '소리 크기',
  'vol.bgm': '배경음',
  'vol.sfx': '효과음',
  'vol.voice': '사람 목소리',
  'vol.aria': '{name} 크기',
  // 말 바꾸기
  'lang.title': '언어',
  'lang.ko': '한국어',
  'lang.en': 'English',
  // 판 고르기
  'boards.back': '‹ 처음으로',
  'boards.title': '어느 이야기로 시작할까',
  'boards.warn': '새 게임을 시작하면 지금 판은 끝난 판으로 기록된다.',
  'boards.freeTitle': '자유 판',
  'detail.start': '이 나라로 시작',
  // 아래 탭 추천
  'rec.jail': '옥에 가둔 적장 {n}명: 회유하면 우리 장수가 된다',
} as const

export type Key = keyof typeof ko
