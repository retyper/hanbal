/**
 * 옥중 담판의 대사 (docs/realm/WOO.md §5) — 결 아홉(voice.baseKind)으로 짠다. 글만 (녹음은 반응을 본 뒤).
 *   - 열림: 갇힌 이의 첫마디가 단서다. 그 사람의 약한 곳(가장 맞는 거리)으로 속을 고른다: 그리움 · 서운함 · 욕심 · 두려움 · 자존심 · 피붙이
 *   - 우리 장수 → 군주: 사극체, 부르는 말 없이 (cast-delegated) · 우리 장수 → 갇힌 이: 그 장수의 결대로
 *   - 내세우는 말은 판의 사실에서 (나라 이름 · 피붙이 이름 · 갇힌 계절) · 조사는 josa() 로
 * 글만 고르고 판에는 손대지 않는다. 결 × 속마다 한 줄 (같은 판이면 같은 줄).
 */
import { josa } from '../../realm/data/prose.ts'
import type { Hero, Realm, WooApproach, WooReact } from '../../realm/types.ts'
import { approachesOf, bondHookOf, bornOf, fitOf } from '../../realm/woo.ts'
import { baseKind, voiceKind, type BaseKind } from './voice.ts'

const kindOf = (h: Hero): BaseKind => baseKind(voiceKind(h))
type Clue = 'long' | 'hurt' | 'greed' | 'fear' | 'pride'

/** 약한 곳 → 속. 맞는 것이 없으면(모두 0 이하) 자존심 */
function clueOf(r: Realm, hero: string, by: string | null): Clue | 'kin' {
  const order: readonly WooApproach[] = ['bond', 'cause', 'soothe', 'gain', 'fear']
  const have = approachesOf(r, hero, by)
  let best: WooApproach | null = null
  let fit = 0
  for (const a of order) {
    if (!have.includes(a)) continue
    const f = fitOf(r, hero, by, a).fit
    if (f > fit) { fit = f; best = a }
  }
  if (best === 'bond') { const k = bondHookOf(r, hero, by); return k !== null && k.kind !== 'kin' && k.kind !== 'home' ? 'kin' : 'pride' }
  return best === 'cause' ? 'hurt' : best === 'soothe' ? 'long' : best === 'gain' ? 'greed' : best === 'fear' ? 'fear' : 'pride'
}

/** 열림 — 결 × 속 (단서) */
const OPEN: Readonly<Record<BaseKind, Readonly<Record<Clue, string>>>> = {
  'm-young': {
    long: '고향 들녘엔 지금쯤 보리가 패었겠지. 어머니는 내가 살아 있는 줄이나 아실까.',
    hurt: '이만큼 기다렸으면 누구라도 왔어야 하오. 내 칼을 믿고 따르던 이들은 다 어디 갔소.',
    greed: '옥밥이 이래서야 말이 나오겠소? 배라도 불러야 입이 열릴 것 아니오.',
    fear: '나, 나를 어쩔 셈이오? 목을 칠 거면 차라리 빨리 치시오.',
    pride: '살려 달라고 빌 생각은 없소. 할 말이 있거든 해 보시오.',
  },
  'm-gruff': {
    long: '허, 이 옥은 춥기도 하구나. 우리 집 아궁이 불이 그립다.',
    hurt: '내가 바친 피가 몇 말인데, 데리러 오는 놈 하나 없구나. 허허.',
    greed: '죽이려면 죽여라. 대신 술이나 한 사발 다오. 맨입으론 말 못 한다.',
    fear: '이, 이놈들. 칼부터 치워라! 칼 앞에선 말도 제대로 안 나오는 법이다.',
    pride: '동정 따위 필요 없다. 칼을 들이대도 눈 하나 깜짝 안 한다.',
  },
  'm-sage': {
    long: '서책 몇 권을 두고 왔소. 그것만은 아직도 마음에 걸리오.',
    hurt: '셈은 끝났소. 내 주인은 나를 버렸고, 나는 그걸 알고 있소.',
    greed: '말은 값이 있어야 오가는 법이오. 그대는 무엇을 내놓겠소?',
    fear: '목숨을 두고 흥정할 마음은 없소만, 손이 떨리는 것까지 어찌 감추겠소.',
    pride: '그대가 무슨 말을 할지 이미 다 셈해 두었소. 어디 해 보시오.',
  },
  'm-elder': {
    long: '늙으면 고향 흙에 묻히는 것이 소원이라네. 그것도 이제 어렵겠구먼.',
    hurt: '내 나라가 이리 되었으니, 늙은이가 지킬 것이 무엇이 남았겠느냐.',
    greed: '늙은이도 배는 고프다네. 따뜻한 밥 한 그릇이면 이야기가 길어질 게야.',
    fear: '죽는 건 두렵지 않다만, 이 나이에 칼 맞아 죽기는 싫구나.',
    pride: '칼을 들이대면 내가 겁먹을 줄 알았느냐. 내 수염이 그리 가볍지 않다.',
  },
  'm-charm': {
    long: '옥 안엔 꽃 한 송이가 없구려. 바깥 봄이 몹시 보고 싶소.',
    hurt: '나를 아끼던 주인이 이리 쉽게 잊을 줄이야. 서운한 건 서운한 거요.',
    greed: '좋은 술과 비단이 있다면 이 혀도 좀 부드러워질 텐데.',
    fear: '이 얼굴에 흉이라도 지면 곤란하오. 부디 험한 손은 쓰지 마시오.',
    pride: '나를 꺾으러 왔소? 웃음 하나로 넘어갈 사람은 아니오.',
  },
  'w-bright': {
    long: '동생들이 밥은 먹고 다니는지 모르겠어요. 그 생각만 하면 잠이 안 와요.',
    hurt: '다들 날 구하러 올 줄 알았어요. 그런데 아무도 안 왔잖아요.',
    greed: '배고파서 말할 기운도 없어요. 떡이라도 주면 들어는 볼게요.',
    fear: '무, 무서운 짓을 하려는 거면 그만둬요. 저, 정말 아무것도 몰라요.',
    pride: '울 줄 알았어요? 나 그렇게 약하지 않아요.',
  },
  'w-cool': {
    long: '돌아갈 곳이 있었소. 이제는 그 길이 아득하게만 보이오.',
    hurt: '나를 버린 자들을 위해 입을 다물 까닭이 있겠소. 허나 그리 쉽게 입을 열 생각도 없소.',
    greed: '값을 부르시오. 들어 보고 정하겠소.',
    fear: '칼을 뽑으면 나도 가만있지 않소. 손이 묶여 있어도.',
    pride: '나를 꺾고 싶으면 칼보다 무거운 것을 가져오시오.',
  },
  'w-sly': {
    long: '여긴 너무 쓸쓸해요. 누가 말동무라도 해 주면 좋을 텐데.',
    hurt: '날 그리 아끼던 분이 한 번도 찾지 않네요. 사람 마음 참 가볍죠.',
    greed: '빈손으로 오셨어요? 요즘은 말 한마디에도 값이 붙는 법이에요.',
    fear: '어머, 그 칼은 좀 치워 주세요. 저 겁 많은 거 아시잖아요.',
    pride: '어머, 그게 겁주는 거예요? 절 꺾으려면 그 정도로는 어림없어요.',
  },
  'w-shaman': {
    long: '고향 당나무가 꿈에 자꾸 보이는구나. 나를 부르는 게지.',
    hurt: '하늘이 내 나라를 거두셨다. 이제 와 내가 다시 지킬 까닭이 있겠느냐.',
    greed: '신께 올릴 제물이 모자라다. 그것을 채워 주면 말이 열릴 게다.',
    fear: '방울이 떨린다. 칼날 냄새가 나는구나. 썩 물리거라.',
    pride: '사람의 칼로 신의 뜻을 꺾으려느냐. 어림없다.',
  },
}
/** 피붙이를 묻는 열림 — 말씨 셋 (거친 · 의젓한 · 여린) */
const OPEN_KIN: Readonly<Record<BaseKind, (who: string, rel: string) => string>> = {
  'm-young': (w, rel) => `${rel} ${josa(w, '은', '는')} 무사하오? 그것만 알려 주시오.`,
  'm-gruff': (w, rel) => `${rel} ${josa(w, '은', '는')} 살아 있느냐. 그것부터 말해라.`,
  'm-sage': (w, rel) => `${rel} ${josa(w, '이', '가')} 그대들 손에 있다 들었소. 무사하오?`,
  'm-elder': (w, rel) => `${rel} ${josa(w, '은', '는')} 어찌 지내는가. 늙은이가 그것 하나 묻겠네.`,
  'm-charm': (w, rel) => `${rel} ${josa(w, '은', '는')} 잘 있소? 그 얼굴이 자꾸 떠오르오.`,
  'w-bright': (w, rel) => `${rel} ${josa(w, '은', '는')} 괜찮아요? 다치진 않았어요?`,
  'w-cool': (w, rel) => `${rel} ${josa(w, '은', '는')} 무사하오? 거짓 없이 말해 주시오.`,
  'w-sly': (w, rel) => `${rel} ${josa(w, '은', '는')} 잘 지내요? 그 소식만은 듣고 싶네요.`,
  'w-shaman': (w, rel) => `${rel} ${josa(w, '의', '의')} 넋이 어디 있는지 알려 다오. 꿈에 자꾸 보인다.`,
}
/** 원한을 품은 이의 열림 — 지난 담판을 이어받는다 */
const OPEN_GRUDGE: Readonly<Record<BaseKind, string>> = {
  'm-young': '또 그 자요? 지난번 일은 아직 잊지 않았소.',
  'm-gruff': '또 왔느냐. 지난번에 들이댄 칼, 아직 기억한다.',
  'm-sage': '지난번 말을 아직 셈하고 있소. 같은 수는 두 번 안 먹히오.',
  'm-elder': '또 그 낯이구나. 늙은이는 모욕을 쉬이 잊지 않느니라.',
  'm-charm': '또 오셨구려. 지난번 그 말, 제법 아프더이다.',
  'w-bright': '또 왔어요? 지난번 일, 아직도 화가 안 풀렸어요.',
  'w-cool': '지난번 일은 아직 끝나지 않았소.',
  'w-sly': '어머, 또 오셨네요. 지난번 일은 잊지 않았어요.',
  'w-shaman': '지난번 그 말이 아직 내 방울에 걸려 있다.',
}

/** 우리 장수가 군주에게 — 사극체 · 부르는 말 없이 (cast-delegated) */
const TO_LORD: Readonly<Record<BaseKind, string>> = {
  'm-young': '옥문을 열어 주시옵소서. 제가 직접 마주 앉아 설득하겠사옵니다.',
  'm-gruff': '말로 안 되면 술상이라도 차려 놓고 풀어 보겠사옵니다. 맡겨 주시옵소서.',
  'm-sage': '그 사람의 속을 먼저 읽어 보겠사옵니다. 말은 그다음이옵니다.',
  'm-elder': '늙은 혀도 쓸 데가 있사옵니다. 차분히 달래 보겠사옵니다.',
  'm-charm': '닫힌 마음을 여는 일도 제법 재미있사옵니다. 다녀오겠사옵니다.',
  'w-bright': '제가 가서 반드시 마음을 돌려놓겠사옵니다. 믿어 주시옵소서.',
  'w-cool': '쉽지 않은 사람이옵니다. 그래도 해 보겠사옵니다.',
  'w-sly': '사람 마음을 여는 일이라면 제법 자신 있사옵니다. 지켜봐 주시옵소서.',
  'w-shaman': '그 사람의 넋이 무엇을 바라는지 들어 보겠사옵니다.',
}

/** 사실 — 회유하는 말에 넣을 것 */
interface Facts { nation: string; fallen: boolean; seasons: number; kin: { name: string; rel: string } | null; blood: boolean; home: string | null }
function factsOf(r: Realm, x: Hero, by: string | null): Facts {
  const nation = r.factions[x.faction]?.name ?? '그대 나라'
  const fallen = !Object.values(r.nodes).some((n) => n.owner === x.faction)
  const seasons = x.caughtAt !== undefined ? Math.max(0, r.season - x.caughtAt) : 0
  const k = bondHookOf(r, x.id, by)
  let kin: Facts['kin'] = null
  if (k !== null && k.who !== null && (k.kind === 'spouse' || k.kind === 'child' || k.kind === 'parent')) {
    const y = r.heroes[k.who]
    if (y !== undefined) kin = { name: y.name, rel: k.kind === 'spouse' ? '그대 짝' : k.kind === 'child' ? (y.look === 'w' ? '그대 딸' : '그대 아들') : (y.look === 'w' ? '그대 어머니' : '그대 아버지') }
  }
  return { nation, fallen, seasons, kin, blood: k?.kind === 'kin', home: k?.kind === 'home' ? (r.factions[bornOf(x)]?.name ?? null) : null }
}

/** 우리 장수가 갇힌 이에게 — 결 × 거리 (공손한 결은 합니다체) */
const PITCH: Readonly<Record<BaseKind, Readonly<Record<Exclude<WooApproach, 'cause' | 'bond'>, string>>>> = {
  'm-young': { soothe: '여기선 아무도 그대를 해치지 않습니다. 따뜻한 밥부터 드시지요.', gain: '곡식 스무 섬을 그대 집안에 보내 드리겠습니다. 빈말이 아닙니다.', fear: '칼집에서 칼을 반쯤 뽑는다. "이 칼이 언제까지 칼집에만 있을 것 같습니까?"' },
  'm-gruff': { soothe: '허허, 겁먹지 마시오. 술이나 한잔하면서 이야기합시다.', gain: '곡식 스무 섬이면 그대 식구들 한 해는 거뜬하오. 받으시오.', fear: '도끼날을 탁자에 쿵 내려놓는다. "두 번 말하게 하지 마시오."' },
  'm-sage': { soothe: '그대를 탓하려는 게 아니오. 그대 처지를 들으러 왔소.', gain: '곡식 스무 섬이 그대 집안에 닿도록 하겠소. 셈은 정확하오.', fear: '칼끝으로 촛불 심지를 자른다. "다음엔 무엇이 잘려 나갈지 헤아려 보시오."' },
  'm-elder': { soothe: '젊은이, 고향 생각에 잠 못 드는 밤이 길었겠구먼. 나도 그랬다네.', gain: '곡식 스무 섬을 그대 집에 보내겠네. 늙은이의 약조일세.', fear: '지팡이 속 칼을 살짝 드러낸다. "늙었다고 손이 무딘 건 아니라네."' },
  'm-charm': { soothe: '그리 굳은 얼굴은 그대에게 어울리지 않소. 마음을 좀 놓으시오.', gain: '곡식 스무 섬에 비단까지 얹어 드리리다. 그대라면 그만한 대접을 받아 마땅하오.', fear: '웃으며 칼을 뽑아 든다. "나도 웃음만 있는 사람은 아니오."' },
  'w-bright': { soothe: '걱정 마세요. 여기서는 아무도 그대를 해치지 않아요.', gain: '곡식 스무 섬을 그대 집에 보내 드리겠습니다. 약속합니다.', fear: '활에 살을 먹여 겨눈다. "저 이래 봬도 백 보 밖 과녁을 맞힙니다."' },
  'w-cool': { soothe: '그대를 욕보일 생각은 없소. 그대가 지켜 온 것을 듣고 싶소.', gain: '곡식 스무 섬을 그대 집안에 보내겠소. 거래는 깔끔하게 하오.', fear: '말없이 칼을 뽑아 무릎 위에 올려 둔다.' },
  'w-sly': { soothe: '그렇게 떨지 마세요. 저 그렇게 무서운 사람 아닙니다.', gain: '곡식 스무 섬을 그대 식구들에게 보내 드릴게요. 이 정도면 마음이 움직이시겠어요?', fear: '비녀를 빼어 칼처럼 손에 쥔다. "이것도 찌르면 아픕니다."' },
  'w-shaman': { soothe: '그대의 넋이 지쳤구나. 내가 달래 주마.', gain: '곡식 스무 섬을 그대 집 당나무 아래 바치겠다.', fear: '방울을 흔들며 칼춤을 추다 칼끝을 그대 목에 멈춘다. "신께서 노하시면 그대 목숨도 무사하지 못하리라."' },
}
/** 명분 — 사실을 내세운다 [하오, 합니다] */
function causeLine(f: Facts, polite: boolean): string {
  const end = (hao: string, ham: string): string => (polite ? ham : hao)
  if (f.fallen) return `${josa(f.nation, '은', '는')} 이미 무너졌${end('소. 지킬 나라가 없는데 누구를 위해 버티시오?', '습니다. 지킬 나라가 없는데 누구를 위해 버티십니까?')}`
  if (f.seasons > 4) return `${f.seasons}계절이 지나도록 ${f.nation}에서는 아무도 오지 않았${end('소. 그대를 버린 것이오.', '습니다. 그대를 버린 겁니다.')}`
  return `${f.nation}의 군장이 그대 하나를 위해 싸움을 걸 것 같${end('소? 기다려도 소용없소.', '습니까? 기다려도 소용없습니다.')}`
}
/** 인연 — 피붙이 · 한 핏줄 · 같은 고향 [하오, 합니다] */
function bondLine(f: Facts, polite: boolean): string {
  const end = (hao: string, ham: string): string => (polite ? ham : hao)
  if (f.kin !== null) return `${f.kin.rel} ${josa(f.kin.name, '은', '는')} 우리 고을에서 잘 지내${end('오. 이제 그대 차례요.', '고 있습니다. 이제 그대 차례입니다.')}`
  if (f.blood) return `우리는 한 핏줄이${end('오. 피를 나눈 사이끼리 칼을 겨눌 수는 없소.', '지 않습니까. 피를 나눈 사이끼리 칼을 겨눌 수는 없습니다.')}`
  if (f.home !== null) return `우리 둘 다 ${f.home}에서 났${end('소. 같은 물을 마시고 자란 사이요.', '습니다. 같은 물을 마시고 자란 사이입니다.')}`
  return end('그대와 나 사이엔 끊을 수 없는 끈이 있소.', '그대와 저 사이엔 끊을 수 없는 끈이 있습니다.')
}
const POLITE: ReadonlySet<BaseKind> = new Set<BaseKind>(['m-young', 'w-bright', 'w-sly'])

/** 반응 — 결 × 크게 흔들림 · 흔들림 · 버팀 · 노여움 */
const REACT: Readonly<Record<BaseKind, Readonly<Record<WooReact, string>>>> = {
  'm-young': { big: '……그 말이 가슴에 박히는구려. 이제 무슨 말을 해야 할지 모르겠소.', sway: '흠, 그 말은 좀 생각해 보겠소.', hold: '그 정도로는 안 넘어가오.', rage: '그 말 거두시오! 사내를 그리 업신여기지 마시오!' },
  'm-gruff': { big: '크흠. 그래, 네 말이 맞다. 내가 대체 무엇을 지키려 했던 게냐.', sway: '허, 말은 잘하는구나.', hold: '흥. 그걸로는 어림없다.', rage: '칼을 들이대면 내가 겁먹을 줄 알았느냐!' },
  'm-sage': { big: '……내 셈이 틀렸구려. 그 수는 미처 못 보았소.', sway: '일리는 있소. 한 번 더 따져 보리다.', hold: '그 말엔 빈틈이 있소.', rage: '나를 그리 얕보았소? 말을 아끼시오.' },
  'm-elder': { big: '허허, 늙은이 눈시울을 붉히는구먼. 자네 말이 옳네.', sway: '허, 듣고 보니 그렇기도 하구먼.', hold: '늙은이 고집이 그리 쉽게 꺾이겠느냐.', rage: '이 늙은이를 모욕하느냐! 썩 물러가라!' },
  'm-charm': { big: '……이런, 내가 먼저 마음을 들키다니.', sway: '그 말, 싫지는 않소.', hold: '그리 쉽게 넘어갈 내가 아니오.', rage: '감히 내 얼굴을 앞에 두고 그런 말을 하시오? 그만두시오.' },
  'w-bright': { big: '……그 말을 들으니 눈물이 날 것 같아요.', sway: '음, 그건 좀 맞는 말 같아요.', hold: '흥, 그런 말로는 안 돼요.', rage: '지금 나 놀리는 거예요? 다시는 말 걸지 마요!' },
  'w-cool': { big: '……그대 말이 옳소. 부정하지 않겠소.', sway: '들을 만은 하오.', hold: '그것으로는 부족하오.', rage: '나를 그리 보았소? 더 할 말 없소.' },
  'w-sly': { big: '어머, 그건 좀 아프네요. 마음이 흔들려요.', sway: '흐응, 제법이시네요.', hold: '그걸로는 모자라요.', rage: '어머, 그게 겁주는 거예요? 정말 실망했어요.' },
  'w-shaman': { big: '방울이 멎었다. 신께서 네 말에 고개를 끄덕이신다.', sway: '바람결이 조금 바뀌었구나.', hold: '신께서는 아직 대답이 없다.', rage: '신을 노엽게 했구나! 이 방울이 너를 잊지 않으리라.' },
}
/** 손을 내밀었는데 아직은 — 고개를 돌린다 */
const NOT_YET: Readonly<Record<BaseKind, string>> = {
  'm-young': '……아직은 아니오. 조금만 더 시간을 주시오.',
  'm-gruff': '손은 거둬라. 아직 마음이 덜 풀렸다.',
  'm-sage': '그 손을 잡기엔 아직 셈이 덜 끝났소.',
  'm-elder': '늙은이 마음은 천천히 움직이는 법이라네.',
  'm-charm': '그 손은 다음에 잡아 드리리다.',
  'w-bright': '……아직은요. 조금만 더 생각할게요.',
  'w-cool': '아직 그 손을 잡을 때가 아니오.',
  'w-sly': '어머, 성급하시네요. 다음에요.',
  'w-shaman': '아직 신의 허락이 내리지 않았다.',
}

/** 열림 — 단서 한 줄 (원한이 있으면 그것부터) */
export function wooOpenLine(r: Realm, x: Hero, by: string | null): string {
  const k = kindOf(x)
  if ((x.grudge ?? 0) > 0) return OPEN_GRUDGE[k]
  const c = clueOf(r, x.id, by)
  if (c === 'kin') {
    const f = factsOf(r, x, by)
    if (f.kin !== null) return OPEN_KIN[k](f.kin.name, f.kin.rel.replace('그대 ', '내 '))
    return OPEN[k].pride
  }
  return OPEN[k][c]
}
/** 우리 장수가 군주에게 */
export const wooLordLine = (by: Hero): string => TO_LORD[kindOf(by)]
/** 우리 장수가 그 거리로 할 말 */
export function wooPitchLine(r: Realm, by: Hero, x: Hero, a: WooApproach): string {
  const k = kindOf(by)
  const polite = POLITE.has(k)
  if (a === 'cause') return causeLine(factsOf(r, x, by.id), polite)
  if (a === 'bond') return bondLine(factsOf(r, x, by.id), polite)
  return PITCH[k][a]
}
/** 갇힌 이의 반응 */
export const wooReactLine = (x: Hero, react: WooReact): string => REACT[kindOf(x)][react]
/** 손을 내밀었는데 아직은 */
export const wooNotYetLine = (x: Hero): string => NOT_YET[kindOf(x)]
/** 넘어왔다 — 이름 붙은 한 줄 */
export const wooWonLine = (by: Hero, x: Hero): string => `${josa(by.name, '의', '의')} 이 한마디에 ${josa(x.name, '이', '가')} 무릎을 꿇었다`

