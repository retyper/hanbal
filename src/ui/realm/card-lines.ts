/**
 * 사람이 나오는 사건의 자막 — 누가 나오느냐에 따라 (형 10-29: "장수들마다 성별 나이 성격 다 다른데 그에 알맞게 짜여진거 맞지?").
 *   장수 다툼 · 쫓겨 온 사람 · 소도의 도망자 · 연정 소문 — 상황이 다 달라 짜임도 다르다.
 *
 * 말투는 목소리 결 아홉(voice.voiceKind — 거친 사내·젊은이·꾀돌이·어른·멋쟁이 · 밝은·차가운·약은 여인·무당)을 따른다.
 * 부부 · 부모와 자식 · 한 핏줄 · 갓 자란 자식 장수면 한 장이 더 붙는다. 그림은 성별로 고른다.
 * 글만 고르고 판에는 손대지 않는다 — 효과는 events.cardPreview. 이름 뒤에는 조사를 붙이지 않는다 (josa 규칙).
 * {a} {b} 장수 · {g} 쫓겨 온 사람 · {f} 그 나라 · {n} 고을 — 화면이 바꿔 넣는다.
 */
import type { QuarrelWhy } from '../../realm/data/cards.ts'
import type { Card, Hero } from '../../realm/types.ts'
import { voiceKind, type VoiceKind } from './voice.ts'

/** 덩이쇠 몫 · 고을 맡기 — 결마다 [먼저 나서는 말, 맞받는 말] */
const CLAIM: Readonly<Record<'spoils' | 'town', Readonly<Record<VoiceKind, readonly [string, string]>>>> = {
  spoils: {
    'm-gruff': ['목책을 제일 먼저 넘은 게 누구냐! 나다!', '웃기지 마라, 길은 내 도끼가 텄다!'],
    'm-young': ['제가 맨 먼저 넘었습니다! 다들 보셨잖아요!', '아니에요, 길은 제 군사들이 열었다고요!'],
    'm-sage': ['빗장을 풀 꾀를 낸 것은 나였소.', '꾀만으로 목책이 넘어가오? 길은 내 군사가 열었소.'],
    'm-elder': ['이 늙은 몸이 맨 앞에 섰던 걸 잊었나.', '젊은 것들 앞을 막아 준 게 누구였더냐.'],
    'm-charm': ['목책 위에서 깃발을 흔든 건 누가 봐도 나였지.', '사람들이 누구 이름을 외쳤는지 들었을 텐데?'],
    'w-bright': ['내가 제일 먼저 넘었어! 다들 봤잖아!', '무슨 소리야, 길은 우리가 뚫었어!'],
    'w-cool': ['목책을 먼저 넘은 건 나다. 더 할 말 없다.', '길을 연 건 내 군사다. 그걸로 됐다.'],
    'w-sly': ['누가 문지기를 꾀어냈는지 다들 잊으셨나 봐요?', '덩이쇠 셈은 제가 제일 잘 알거든요.'],
    'w-shaman': ['신령께서 내 화살을 먼저 이끄셨소.', '점괘대로 길을 연 것은 나요. 하늘이 보았소.'],
  },
  town: {
    'm-gruff': ['그 고을 놈들은 내 주먹을 무서워한다!', '주먹으로 다스리면 사흘 만에 들고일어난다!'],
    'm-young': ['저도 이제 고을 하나는 맡을 수 있습니다!', '저한테 한 번만 맡겨 주십시오!'],
    'm-sage': ['그 고을 물길과 곳간은 내가 다 셈해 두었소.', '셈만으로 사람 마음은 못 얻소.'],
    'm-elder': ['고을은 연륜으로 다스리는 법이다.', '그 고을 어른들과 나는 오랜 벗이다.'],
    'm-charm': ['고을 사람들이 나를 반기는 걸 봤잖소.', '웃음 한 번이면 그 고을은 내 편이오.'],
    'w-bright': ['그 고을 아이들이 다 나를 따라!', '내가 맡으면 그 고을이 환해질 거야!'],
    'w-cool': ['그 고을 길은 내가 훤히 안다.', '고을은 맡을 사람이 맡아야 한다. 나다.'],
    'w-sly': ['그 고을 장사치들 셈은 제 손안에 있죠.', '누가 맡든 결국 곡식은 제 셈을 거쳐요.'],
    'w-shaman': ['그 고을 당산나무가 나를 불렀소.', '그 고을 제사는 내가 지내야 하오.'],
  },
}

/** 술자리 — 시비를 거는 말(결마다) */
const TAUNT: Readonly<Record<VoiceKind, string>> = {
  'm-gruff': '그 활은 말로만 쏘는가?',
  'm-young': '그 활은 소리만 요란하던데요?',
  'm-sage': '꾀 없는 용맹은 멧돼지나 하는 짓이오.',
  'm-elder': '요즘 것들은 술만 세지 싸움은 영 못 써.',
  'm-charm': '싸움터에서도 그렇게 목소리가 컸으면 좋았을 텐데.',
  'w-bright': '솔직히 지난번엔 제일 뒤에 있었잖아!',
  'w-cool': '겁먹은 자는 술자리에서만 용감하다.',
  'w-sly': '어머, 싸움터에선 그렇게 조용하시더니.',
  'w-shaman': '신령께서 그대 이름을 부끄러워하시오.',
}

/** 술자리 — 시비를 받은 쪽이 어떻게 일어서나(결마다) */
const RISE: Readonly<Record<VoiceKind, string>> = {
  'm-gruff': '장수 {a}, 술상을 걷어차고 일어선다.',
  'm-young': '장수 {a}, 얼굴이 새빨개져 벌떡 일어선다.',
  'm-sage': '장수 {a}, 잔을 내려놓고 조용히 노려본다.',
  'm-elder': '장수 {a}, 수염을 떨며 지팡이를 짚고 일어선다.',
  'm-charm': '장수 {a}, 웃음을 거두고 칼자루를 쥔다.',
  'w-bright': '장수 {a}, 발끈해 술잔을 내던진다.',
  'w-cool': '장수 {a}, 말없이 활을 집어 든다.',
  'w-sly': '장수 {a}, 웃으며 그 술잔을 상 위에 쏟아 버린다.',
  'w-shaman': '장수 {a}, 방울을 흔들며 낮게 읊조린다.',
}

const quote = (s: string, who: '{a}' | '{b}'): string => `"${s}" — 장수 ${who}`

/** 두 사람 사이 — 부부 · 부모와 자식 · 한 핏줄 (없으면 null) */
function kin(a: Hero, b: Hero): string | null {
  if (a.spouse === b.id || b.spouse === a.id) return '부부 사이인데도 서로 한 치도 물러서지 않는다.'
  const pc = (p: Hero, c: Hero): string | null =>
    c.parents?.includes(p.id) === true ? `${p.look === 'w' ? '어머니와' : '아버지와'} ${c.look === 'w' ? '딸이' : '아들이'} 맞섰다. 장수들이 술렁인다.` : null
  const line = pc(a, b) ?? pc(b, a)
  if (line !== null) return line
  if (a.parents !== undefined && b.parents !== undefined && a.parents.some((p) => b.parents!.includes(p))) {
    const pair = a.look === b.look ? (a.look === 'w' ? '자매' : '형제') : '남매'
    return `한 핏줄 ${pair}인데도 서로 눈을 흘긴다.`
  }
  return null
}

/** 갓 자란 자식 장수 — 혼인에서 난 아이가 자라 처음 맞는 다툼 (부모와 맞선 것은 kin 이 말한다) */
function fresh(a: Hero, b: Hero): string | null {
  if (a.parents !== undefined && b.parents === undefined) return '갓 자라 장수가 된 {a}, 처음으로 제 몫을 외친다.'
  if (b.parents !== undefined && a.parents === undefined) return '갓 자라 장수가 된 {b}, 어른들 앞에서도 지지 않는다.'
  return null
}

/** 자막 — {a} {b} {n} 은 화면이 바꿔 넣는다 */
export function quarrelBeats(c: Card, a: Hero, b: Hero): string[] {
  const why: QuarrelWhy = c.why ?? 'spoils'
  const ka = voiceKind(a)
  const kb = voiceKind(b)
  const out: string[] = []
  if (why === 'feast') {
    out.push('잔치 술자리가 무르익은 밤.', quote(TAUNT[kb], '{b}'), RISE[ka])
  } else {
    out.push(why === 'spoils' ? '싸움에서 거둔 덩이쇠가 마당에 쌓였다.' : '{n} 고을을 맡을 사람을 아직 정하지 않았다.')
    // 같은 결끼리면 둘째는 맞받는 말로 — 같은 말을 두 번 하지 않게
    out.push(quote(CLAIM[why][ka][0], '{a}'), quote(CLAIM[why][kb][1], '{b}'))
  }
  const k = kin(a, b) ?? (why === 'feast' ? null : fresh(a, b))
  if (k !== null) out.push(k)
  out.push(why === 'feast' ? '모두가 숨을 죽이고 군장만 본다.' : '둘 다 물러설 생각이 없다. 모두가 군장만 본다.')
  return out
}

/** 그림 — 사내 둘은 기본, 남녀는 -mw(사내가 왼쪽 · {a} 가 여인이면 좌우를 뒤집는다), 여인 둘은 -ww */
export function quarrelArt(base: string, a: Hero, b: Hero): { art: string; flip: boolean } {
  if (a.look === 'g' && b.look === 'g') return { art: base, flip: false }
  if (a.look === 'w' && b.look === 'w') return { art: `${base}-ww`, flip: false }
  return { art: `${base}-mw`, flip: a.look === 'w' }
}

// ── 쫓겨 온 사람 — 받기 전에 누구인지 · 왜 쫓겨났나 · 어떤 사람인지 (형 10-29)

/** 왜 쫓겨났나 — 그 사람의 특성으로 (배신 기질이 맨 먼저 · 받을지 가늠하라고) */
const EXILE_WHY: Readonly<Record<string, string>> = {
  traitor: '옛 주인을 팔아넘겼다는 소문이 따라다닌다.',
  shaman: '새 군장이 무당을 내치자 방울 하나만 들고 쫓겨났다고 한다.',
  coward: '싸움터에서 달아났다가 쫓겨났다고 한다.',
  charm: '군장 집안의 미움을 사서 쫓겨났다고 한다.',
  smith: '솜씨를 탐낸 군장에게 붙잡혀 있다가 몰래 도망쳤다고 한다.',
  ironhand: '솜씨를 탐낸 군장에게 붙잡혀 있다가 몰래 도망쳤다고 한다.',
  farmer: '흉년에 곳간을 열어 백성을 먹였다가 쫓겨났다고 한다.',
  trader: '셈이 꼬여 큰 빚을 지고 쫓겨났다고 한다.',
  archer: '군장의 사냥에서 군장보다 큰 짐승을 잡았다가 미움을 샀다고 한다.',
  nighteye: '군장의 사냥에서 군장보다 큰 짐승을 잡았다가 미움을 샀다고 한다.',
  mountain: '군장의 사냥에서 군장보다 큰 짐승을 잡았다가 미움을 샀다고 한다.',
  river: '물길을 두고 군장과 다투다 쫓겨났다고 한다.',
  careful: '군장에게 바른말을 했다가 쫓겨났다고 한다.',
  hundred: '군장에게 바른말을 했다가 쫓겨났다고 한다.',
  steadfast: '군장에게 바른말을 했다가 쫓겨났다고 한다.',
  glutton: '잔치에서 취해 군장 앞에서 큰소리를 쳤다가 쫓겨났다고 한다.',
  drinker: '잔치에서 취해 군장 앞에서 큰소리를 쳤다가 쫓겨났다고 한다.',
}

/** 우리 앞에서 하는 첫마디 (결마다) */
const EXILE_SAY: Readonly<Record<VoiceKind, string>> = {
  'm-gruff': '칼 한 자루면 밥값은 하겠소.',
  'm-young': '무엇이든 시켜만 주십시오!',
  'm-sage': '내 꾀를 쓸 곳을 찾고 있소.',
  'm-elder': '늙었어도 아직 쓸모는 있소.',
  'm-charm': '날 들이면 손해 볼 일은 없을 거요.',
  'w-bright': '받아 주시면 정말 열심히 할게요!',
  'w-cool': '쓸 데가 있으면 쓰고, 없으면 가겠다.',
  'w-sly': '제가 아는 걸 다 알려 드리죠. 값만 맞으면요.',
  'w-shaman': '신령께서 이 고을로 가라 하셨소.',
}

export function exileBeats(c: Card, g: Hero): string[] {
  const from = c.from !== undefined ? '{f} 땅에서' : '이웃 나라에서'
  const one = g.look === 'w' ? '여인 하나가' : '사내 하나가'
  const why = g.traits.includes('traitor') ? EXILE_WHY['traitor']! : (g.traits.map((t) => EXILE_WHY[t]).find((s) => s !== undefined) ?? '군장이 바뀌자 옛 사람이라며 내쳐졌다고 한다.')
  return [`${from} 쫓겨난 ${one} 우리 고을 문을 두드렸다.`, why, `"${EXILE_SAY[voiceKind(g)]}" — {g}`]
}

/** 쫓겨 온 사람 그림 — 여인이 문 앞에 선 그림이 기본, 사내면 -g */
export const exileArt = (base: string, g: Hero): string => (g.look === 'g' ? `${base}-g` : base)

// ── 소도의 도망자 — 어느 나라에서 무슨 죄를 짓고 왔나 (그 나라가 내놓으라 한다)

const CRIME: readonly string[] = ['사람을 해치고', '곳간을 털고', '군장의 말을 훔쳐']

export function fugitiveBeats(c: Card): string[] | null {
  if (c.from === undefined) return null
  return [`{f} 땅에서 ${CRIME[c.season % CRIME.length]!} 달아난 자가 소도로 숨어들었다.`, '{f} 사신이 와서 그자를 내놓으라 한다.', '소도에 든 사람은 잡지 않는 것이 삼한의 법이다.']
}

// ── 연정 소문 — 혼인 안 한 남녀 장수 둘

/** 어디서 눈에 띄었나 — 계절마다 */
const LOVE_AT: readonly string[] = ['강가 버드나무 아래', '밤 냇가', '달 밝은 타작마당', '화톳불 곁']

/** 소문을 들은 장수의 말 (결마다) */
const LOVE_SAY: Readonly<Record<VoiceKind, string>> = {
  'm-gruff': '그, 그런 거 아니다! 누가 그런 소리를 해!',
  'm-young': '소문이 벌써 거기까지 갔습니까…?',
  'm-sage': '사람 입은 막을 수 없는 법이오.',
  'm-elder': '늘그막에 이런 일이 생길 줄이야.',
  'm-charm': '소문이 사실이면 어쩌겠소?',
  'w-bright': '에이, 아니야! …조금은 맞나?',
  'w-cool': '쓸데없는 소리. …귀가 왜 뜨겁지.',
  'w-sly': '소문이란 원래 반쯤은 참말이죠.',
  'w-shaman': '신령께서 맺어 주신 인연이오.',
}

export function romanceBeats(c: Card, a: Hero, b: Hero): string[] {
  const at = LOVE_AT[((c.season % 4) + 4) % 4]!
  const ka = voiceKind(a)
  const kb = voiceKind(b)
  // 같은 결이면 둘째는 다른 말로 — 같은 말을 두 번 하지 않게
  const sb = kb === ka ? '…부디 모르는 척해 주십시오.' : LOVE_SAY[kb]
  return [`{a} · {b} 두 장수가 ${at}에서 함께 있는 것을 본 사람이 있다.`, quote(LOVE_SAY[ka], '{a}'), quote(sb, '{b}'), '장수들이 수군댄다. 군장의 뜻은 어떠한가.']
}

/** 연정 소문 그림 — 사내가 왼쪽 · 먼저 나오는 이({a})가 여인이면 뒤집는다 */
export const romanceFlip = (a: Hero): boolean => a.look === 'w'
