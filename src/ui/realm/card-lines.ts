/**
 * 사람이 나오는 사건의 자막 — 누가 나오느냐에 따라 (형 10-29: "장수들마다 성별 나이 성격 다 다른데 그에 알맞게 짜여진거 맞지?").
 *   장수 다툼 · 쫓겨 온 사람 · 소도의 도망자 · 연정 소문 — 상황이 다 달라 짜임도 다르다.
 *
 * 이야기는 배경 → 까닭 → 맞섬 → 걸린 것 → 군장에게 온 물음 순서로 여덟아홉 장 (형 10-29: "3~4줄 가지고 무슨 스토리가 생기겠냐 ·
 * 개연성이랑 문량 챙겨서"). 한 장은 두 줄 안 (형 10-27 지인: "화면에 두 줄 넘어가면 안 돼").
 * 내세우는 까닭은 그 장수가 실제로 잘하는 것에서, 깎아내리는 말은 상대가 실제로 못하는 것에서 (능력치 · 특성) — 아무 말이나 하지 않는다
 * (형 10-29: "아이들이 자길 따른다고 고을의 주인이 될 자격이 있냐? 이게 장수들이 할 말이야?").
 * 말투는 목소리 결(voice.voiceKind)로 높임을 가른다 — 젊은이·밝은·약은 여인은 '합니다', 나머지는 '하오'.
 * 이름·고을·나라를 그 자리에서 넣고 조사는 josa() 로 (josa 규칙). 글만 고르고 판에는 손대지 않는다 — 효과는 events.cardPreview.
 */
import { seasonOf } from '../../realm/calendar.ts'
import type { QuarrelWhy } from '../../realm/data/cards.ts'
import { josa } from '../../realm/data/prose.ts'
import type { Card, Hero, Realm } from '../../realm/types.ts'
import { voiceKind, type VoiceKind } from './voice.ts'

type Stat = 'mu' | 'tong' | 'ryak' | 'chi' | 'deok'
const STATS: readonly Stat[] = ['mu', 'tong', 'ryak', 'chi', 'deok']
/** 가장 잘하는 것 · 가장 못하는 것 (같으면 앞의 것) */
const bestOf = (h: Hero): Stat => STATS.reduce((x, y) => (h[y] > h[x] ? y : x))
const worstOf = (h: Hero): Stat => STATS.reduce((x, y) => (h[y] < h[x] ? y : x))
/** 높임 — 젊은이·밝은 여인·약은 여인은 '합니다'체 */
const polite = (h: Hero): boolean => { const k: VoiceKind = voiceKind(h); return k === 'm-young' || k === 'w-bright' || k === 'w-sly' || k === 'm-knight' || k === 'w-knight' }
const iga = (h: Hero): string => josa(h.name, '이', '가')

/** 두 사람 사이 — 부부 · 부모와 자식 · 한 핏줄 (없으면 null) */
function kin(a: Hero, b: Hero): string | null {
  if (a.spouse === b.id || b.spouse === a.id) return '부부 사이인데도 둘은 한 치도 물러서지 않는다. 보는 이들이 더 민망하다.'
  const pc = (p: Hero, c: Hero): string | null =>
    c.parents?.includes(p.id) === true ? `${p.look === 'w' ? '어머니와' : '아버지와'} ${c.look === 'w' ? '딸이' : '아들이'} 맞섰다. 집안 싸움이 군중의 일이 되었다.` : null
  const line = pc(a, b) ?? pc(b, a)
  if (line !== null) return line
  if (a.parents !== undefined && b.parents !== undefined && a.parents.some((p) => b.parents!.includes(p))) {
    const pair = a.look === b.look ? (a.look === 'w' ? '자매' : '형제') : '남매'
    return `한 핏줄 ${pair}인데도 서로 눈을 흘긴다. 부모가 보았다면 무어라 했을까.`
  }
  return null
}

/** 갓 자란 자식 장수 — 혼인에서 난 아이가 자라 처음 맞는 다툼 (부모와 맞선 것은 kin 이 말한다) */
function fresh(a: Hero, b: Hero): string | null {
  if (a.parents !== undefined && b.parents === undefined) return `갓 자라 장수가 된 ${a.name}, 처음 세운 공을 빼앗길 수 없다는 얼굴이다.`
  if (b.parents !== undefined && a.parents === undefined) return `갓 자라 장수가 된 ${b.name}, 어른들 앞에서도 지지 않는다.`
  return null
}

// ── 장수 다툼 ─────────────────────────────────────────────

/** 지난 싸움에서 세운 공 — 그 장수가 가장 잘하는 것으로 (…것은) */
const DEED: Readonly<Record<Stat, string>> = {
  mu: '맨 앞에서 목책을 넘어 성문 빗장을 부순 것은',
  tong: '무너지던 대열을 다시 세워 버틴 것은',
  ryak: '적의 순라 길을 미리 알아내 빈틈을 짚은 것은',
  chi: '보름 치 군량을 끊기지 않게 대어 준 것은',
  deok: '마을 장정들을 달래 우리 편에 세운 것은',
}
/** 싸움에서 못한 것 — 상대가 가장 못하는 것으로 [하오, 합니다] */
const FAULT: Readonly<Record<Stat, readonly [string, string]>> = {
  mu: ['그쪽 군사는 칼끝 한 번 적에게 닿지 않았소', '그쪽 군사는 칼끝 한 번 적에게 닿지 않았습니다'],
  tong: ['그쪽 군사는 목책 앞에서 우왕좌왕하기만 했소', '그쪽 군사는 목책 앞에서 우왕좌왕하기만 했습니다'],
  ryak: ['그쪽은 꾀 없이 들이받기만 해서 우리 쪽 피만 흘리게 했소', '그쪽은 꾀 없이 들이받기만 해서 우리 쪽 피만 흘리게 했습니다'],
  chi: ['그쪽은 군량 수레를 반이나 길에 흘렸소', '그쪽은 군량 수레를 반이나 길에 흘렸습니다'],
  deok: ['장정들은 그쪽 깃발 아래로는 오지 않았소', '장정들은 그쪽 깃발 아래로는 오지 않았습니다'],
}
/** 고을을 맡을 만한 까닭 — 다스리는 데 쓰이는 솜씨 (…사람) */
const CAN: Readonly<Record<Stat, string>> = {
  chi: '곳간과 물길을 셈할 줄 아는',
  tong: '군사를 두어 고을을 지켜 낼',
  ryak: '도적과 첩자를 가려낼 눈이 있는',
  deok: '고을 원로들과 말이 통하는',
  mu: '변방 도적 떼를 칼로 막아 낼',
}
/** 고을을 맡기면 안 되는 까닭 — 상대가 가장 못하는 것으로 [하오, 합니다] */
const UNFIT: Readonly<Record<Stat, readonly [string, string]>> = {
  chi: ['셈 한 줄 못 하는 사람에게 곳간을 맡기면 한 해 안에 바닥이 나오', '셈 한 줄 못 하는 사람에게 곳간을 맡기면 한 해 안에 바닥이 납니다'],
  tong: ['제 군사도 못 다스리는 사람이 고을 사람을 어찌 다스리겠소', '제 군사도 못 다스리는 사람이 고을 사람을 어찌 다스리겠습니까'],
  ryak: ['꾀가 없으면 첩자가 곳간을 털어 가도 모를 것이오', '꾀가 없으면 첩자가 곳간을 털어 가도 모를 겁니다'],
  deok: ['그 사람이 가면 원로들이 문을 걸어 잠글 것이오', '그 사람이 가면 원로들이 문을 걸어 잠글 겁니다'],
  mu: ['도적 한 무리만 와도 그 사람은 막지 못하오', '도적 한 무리만 와도 그 사람은 막지 못합니다'],
}
/** 술자리에서 거는 시비 — 상대가 가장 못하는 것으로 [하오, 합니다] · 겁쟁이 특성이면 그것부터 */
const TAUNT: Readonly<Record<Stat | 'coward', readonly [string, string]>> = {
  mu: ['그 활은 말로만 쏘는 거요? 지난번엔 한 발도 못 맞혔다던데.', '그 활은 말로만 쏘시나 봐요? 지난번엔 한 발도 못 맞히셨다면서요.'],
  tong: ['제 군사도 못 추스르면서 싸움 이야기는 잘도 하오.', '제 군사도 못 추스르시면서 싸움 이야기는 잘도 하시네요.'],
  ryak: ['남의 군사 피로 공을 세운 사람이 큰소리요?', '남의 군사 피로 공을 세우신 분이 큰소리시네요.'],
  chi: ['곳간 셈도 못 하는 사람이 술 셈은 잘하는구려.', '곳간 셈도 못 하시면서 술 셈은 잘하시네요.'],
  deok: ['그쪽 깃발 아래엔 따르는 장정이 없다던데.', '그쪽 깃발 아래엔 따르는 장정이 없다던데요.'],
  coward: ['싸움터에서 제일 먼저 등을 보인 사람이 누구더라.', '싸움터에서 제일 먼저 등을 보이신 분이 누구더라?'],
}
/** 시비를 받은 쪽이 어떻게 일어서나 (결마다) */
const RISE: Readonly<Record<VoiceKind, (n: string) => string>> = {
  'm-gruff': (n) => `${n}, 술상을 걷어차고 일어선다.`,
  'm-young': (n) => `${n}, 얼굴이 새빨개져 벌떡 일어선다.`,
  'm-sage': (n) => `${n}, 잔을 내려놓고 조용히 노려본다.`,
  'm-elder': (n) => `${n}, 수염을 떨며 지팡이를 짚고 일어선다.`,
  'm-charm': (n) => `${n}, 웃음을 거두고 칼자루를 쥔다.`,
  'w-bright': (n) => `${n}, 발끈해 술잔을 내던진다.`,
  'w-cool': (n) => `${n}, 말없이 활을 집어 든다.`,
  'w-sly': (n) => `${n}, 웃으며 그 술잔을 상 위에 쏟아 버린다.`,
  'w-shaman': (n) => `${n}, 방울을 흔들며 낮게 읊조린다.`,
  'm-knight': (n) => `${n}, 굳은 얼굴로 천천히 일어선다.`,
  'w-knight': (n) => `${n}, 입술을 깨물고 칼자루에 손을 얹는다.`,
  'm-veteran': (n) => `${n}, 술잔을 탁 내려놓고 눈을 가늘게 뜬다.`,
  'w-matron': (n) => `${n}, 옷매무새를 고치고 조용히 일어선다.`,
}
/** 잔치의 때 — 계절마다 */
const FEAST_AT: Readonly<Record<'spring' | 'summer' | 'autumn' | 'winter', string>> = {
  spring: '봄 제사를 마친', summer: '모내기를 마친', autumn: '가을걷이를 마친', winter: '한 해를 보내는',
}

/** 장수의 말 한 마디 — 자막이 아니라 얼굴·이름·말로 그린다 (app.ts cardHtml · 형 10-29: "「"어쩌구" — 이름」은 명언집이지 대사가 아니다") */
const SAY = '\u0001'
const q = (h: Hero, s: string): string => `${SAY}${h.id}${SAY}${s}`
/** 그 자막이 장수의 말이면 누구 · 무슨 말 */
export function sayOfBeat(beat: string): { hero: string; line: string } | null {
  if (!beat.startsWith(SAY)) return null
  const i = beat.indexOf(SAY, 1)
  return i < 0 ? null : { hero: beat.slice(1, i), line: beat.slice(i + 1) }
}

/** 장수 다툼의 자막 — 덩이쇠 몫 · 고을 맡기 · 술자리 시비 */
export function quarrelBeats(r: Realm, c: Card, a: Hero, b: Hero): string[] {
  const why: QuarrelWhy = c.why ?? 'spoils'
  const pa = polite(a) ? 1 : 0
  const pb = polite(b) ? 1 : 0
  const sa = bestOf(a)
  const sb = bestOf(b)
  const wa = worstOf(a)
  const wb = worstOf(b)
  const tie = kin(a, b) ?? (why === 'feast' ? null : fresh(a, b))
  const out: string[] = []
  if (why === 'spoils') {
    out.push(
      '지난 싸움에서 거둬 온 덩이쇠가 창고 앞에 쌓였다.',
      '덩이쇠는 곧 창날이고 화살촉이다. 몫을 많이 받은 쪽 군사가 다음 싸움에서 더 세다.',
      `나누는 자리에서 ${iga(a)} 먼저 일어섰다.`,
      q(a, `${DEED[sa]} ${pa ? '저였습니다' : '나였소'}. 덩이쇠는 ${pa ? '제' : '내'} 군사들이 먼저 받아야 ${pa ? '합니다' : '하오'}.`),
      `${iga(b)} 곧바로 맞받았다.`,
      q(b, `${FAULT[wa][pb]}. ${DEED[sb]} ${pb ? '저입니다' : '나요'}.`),
      q(a, `${pa ? '말씀이 지나치십니다' : '말이 지나치오'}. ${FAULT[wb][pa]}.`),
    )
    if (tie !== null) out.push(tie)
    out.push('둘을 따르는 군사들까지 웅성대기 시작했다. 둘 다 칼자루에 손이 갔다.', '덩이쇠를 어떻게 나눌지는 군장이 정할 일이다.')
    return out
  }
  if (why === 'town') {
    const n = r.nodes[c.node ?? '']?.name ?? ''
    out.push(
      `${josa(n, '은', '는')} 아직 맡아 다스릴 장수가 없다.`,
      '세금을 걷고, 물길을 다스리고, 도적을 막을 사람이 있어야 고을이 굴러간다.',
      `${n} 원로들이 사람을 보내 누가 오느냐고 물어 왔다.`,
      `${iga(a)} 먼저 나섰다.`,
      q(a, `그 고을엔 ${CAN[sa]} 사람이 가야 ${pa ? '합니다. 제가 가겠습니다' : '하오. 내가 가겠소'}.`),
      q(b, `${UNFIT[wa][pb]}. ${CAN[sb]} 사람은 ${pb ? '저입니다' : '나요'}.`),
      q(a, `${pa ? '그 말씀 그대로 돌려 드리지요' : '그 말 그대로 돌려주겠소'}. ${UNFIT[wb][pa]}.`),
    )
    if (tie !== null) out.push(tie)
    out.push('원로들이 보낸 사람이 문밖에서 둘의 다툼을 다 듣고 있었다.', '이 일이 길어지면 고을 사람들이 우리를 우습게 볼 것이다. 누구에게 맡길지는 군장이 정해야 한다.')
    return out
  }
  // 술자리 시비 — b 가 a 의 약한 곳을 찌른다
  const at = FEAST_AT[seasonOf(r.season)]
  const sting = a.traits.includes('coward') ? TAUNT.coward : TAUNT[wa]
  out.push(
    `${at} 잔치 날 밤, 큰 집에 장수들이 모였다.`,
    '술동이가 몇 번 돌자 지난 싸움 이야기가 나왔다.',
    `${iga(b)} 잔을 내려놓으며 ${a.name}에게 말을 던졌다.`,
    q(b, sting[pb]),
    '자리가 순간 조용해졌다.',
    RISE[voiceKind(a)](a.name),
    q(a, `${pa ? '말 다 하셨습니까' : '말 다 했소'}? ${FAULT[wb][pa]}.`),
    '곁의 장수들이 둘을 뜯어말렸지만, 술잔 깨지는 소리가 밖까지 들렸다.',
  )
  if (tie !== null) out.push(tie)
  out.push('날이 밝으면 이 일은 온 군중의 입에 오를 것이다. 군장이 누구 편을 드느냐에 따라 앙금의 크기가 달라진다.')
  return out
}

/** 그림 — 사내 둘은 기본, 남녀는 -mw(사내가 왼쪽 · a 가 여인이면 좌우를 뒤집는다), 여인 둘은 -ww */
export function quarrelArt(base: string, a: Hero, b: Hero): { art: string; flip: boolean } {
  if (a.look === 'g' && b.look === 'g') return { art: base, flip: false }
  if (a.look === 'w' && b.look === 'w') return { art: `${base}-ww`, flip: false }
  return { art: `${base}-mw`, flip: a.look === 'w' }
}

// ── 쫓겨 온 사람 — 받기 전에 누구인지 · 왜 쫓겨났나 · 어떤 사람인지 ─────────

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
/** 문 앞에 섰을 때의 모습 — 그 사람이 가장 잘하는 것이 드러난다 */
const LOOK: Readonly<Record<Stat, string>> = {
  mu: '해진 옷에 봇짐 하나였지만, 허리에 찬 칼은 손질이 잘 돼 있었다.',
  tong: '데려온 종자 둘이 군기 있게 뒤를 따랐다.',
  ryak: '눈빛이 날카로워 문지기가 저도 모르게 비켜섰다.',
  chi: '봇짐 속에서 셈 막대와 씨앗 자루가 나왔다.',
  deok: '지나온 마을마다 사람들이 길을 일러 주었다고 한다.',
}
/** 군장 앞에서 하는 첫마디 (결마다) */
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
  'm-knight': '받아 주신다면 이 칼을 바치겠습니다.',
  'w-knight': '쓸모를 보여 드리겠습니다. 받아 주십시오.',
  'm-veteran': '싸움터를 스무 해 굴렀소. 써 보시오.',
  'w-matron': '살림이든 싸움이든, 맡기면 해내겠소.',
}

export function exileBeats(r: Realm, c: Card, g: Hero): string[] {
  const f = c.from !== undefined ? r.factions[c.from]?.name : undefined
  const from = f !== undefined ? `${f} 땅에서` : '이웃 나라에서'
  const one = g.look === 'w' ? '여인 하나가' : '사내 하나가'
  const why = g.traits.includes('traitor') ? EXILE_WHY['traitor']! : (g.traits.map((t) => EXILE_WHY[t]).find((s) => s !== undefined) ?? '군장이 바뀌자 옛 사람이라며 내쳐졌다고 한다.')
  return [
    `${from} 쫓겨난 ${one} 우리 고을 문 앞에 섰다.`,
    LOOK[bestOf(g)],
    '문지기가 데려와 군장 앞에 엎드리게 했다.',
    `이름은 ${josa(g.name, '이라', '라')} 했다. ${why}`,
    q(g, EXILE_SAY[voiceKind(g)]),
    g.traits.includes('traitor') ? '받아들였다가 언젠가 등에 칼이 꽂힐지도 모른다.' : '받아 주면 먹이고 입힐 곡식이 들지만, 쓸 만한 사람 하나를 얻는다.',
    '군장의 말 한마디에 이 사람의 앞날이 걸렸다.',
  ]
}

/** 쫓겨 온 사람 그림 — 여인이 문 앞에 선 그림이 기본, 사내면 -g */
export const exileArt = (base: string, g: Hero): string => (g.look === 'g' ? `${base}-g` : base)

// ── 소도의 도망자 — 어느 나라에서 무슨 죄를 짓고 왔나 (그 나라가 내놓으라 한다) ─────

const CRIME: readonly string[] = ['사람을 해치고', '곳간을 털고', '군장의 말을 훔쳐']
const CRIME_MORE: readonly string[] = ['죽은 이는 그 나라 군장의 먼 친척이라고 한다.', '털린 곳간은 그 나라 사람들이 겨울을 날 곡식이었다.', '훔친 말은 그 나라 군장이 아끼던 흰 말이었다.']

export function fugitiveBeats(r: Realm, c: Card): string[] | null {
  const f = c.from !== undefined ? r.factions[c.from]?.name : undefined
  if (f === undefined) return null
  const i = c.season % CRIME.length
  return [
    `${f} 땅에서 ${CRIME[i]!} 달아난 자가 우리 쪽 소도로 숨어들었다.`,
    '소도는 큰 나무에 방울과 북을 단 신성한 숲이다. 그 안에 든 사람은 누구도 잡아가지 못한다.',
    CRIME_MORE[i]!,
    `${f} 사신이 말을 달려와 그자를 내놓으라 한다.`,
    '"넘겨주지 않으면 이 일을 잊지 않겠소.": 사신',
    '소도를 지키는 천군은 고개를 저었다. "신성한 땅에서 사람을 끌어내면 하늘이 노합니다."',
    '이웃 나라들도 우리가 어찌하는지 지켜보고 있다.',
  ]
}

// ── 연정 소문 — 혼인 안 한 남녀 장수 둘 ──────────────────────

/** 어디서 눈에 띄었나 — 계절마다 */
const LOVE_AT: Readonly<Record<'spring' | 'summer' | 'autumn' | 'winter', string>> = {
  spring: '강가 버드나무 아래', summer: '밤 냇가', autumn: '달 밝은 타작마당', winter: '화톳불 곁',
}
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
  'm-knight': '…그런 말은 삼가 주십시오.',
  'w-knight': '허튼소리입니다. …정말 그리 보였습니까?',
  'm-veteran': '이 나이에 그런 소문이라니, 허허.',
  'w-matron': '다 늙어 무슨 소문이오. …싫지는 않구려.',
}

export function romanceBeats(r: Realm, _c: Card, a: Hero, b: Hero): string[] {
  const ka = voiceKind(a)
  const kb = voiceKind(b)
  // 같은 결이면 둘째는 다른 말로 — 같은 말을 두 번 하지 않게
  const sb = kb === ka ? '…부디 모르는 척해 주십시오.' : LOVE_SAY[kb]
  const place = a.at !== null && a.at === b.at ? r.nodes[a.at]?.name : undefined
  return [
    place !== undefined ? `${josa(a.name, '과', '와')} ${b.name}, 둘은 ${place}에서 같은 계절을 나며 자주 마주쳤다.` : `${josa(a.name, '과', '와')} ${b.name}, 둘은 같은 깃발 아래에서 여러 계절을 함께 보냈다.`,
    '처음엔 서로 말도 섞지 않던 사이였다.',
    `그런데 요즘 ${LOVE_AT[seasonOf(r.season)]}에서 둘이 함께 있는 것을 본 사람이 여럿이다.`,
    '소문은 금세 군중에 퍼졌다.',
    q(a, LOVE_SAY[ka]),
    q(b, sb),
    '혼례를 올리면 곡식이 들지만, 둘 사이에서 난 아이는 언젠가 장수가 될 것이다.',
    '한편 군기가 흐트러진다며 못마땅해하는 장수들도 있다.',
    '장수들이 군장의 뜻을 기다린다.',
  ]
}

/** 연정 소문 그림 — 사내가 왼쪽 · 먼저 나오는 이(a)가 여인이면 뒤집는다 */
export const romanceFlip = (a: Hero): boolean => a.look === 'w'
