/**
 * 사람마다 회유 대사 — Argon(AI 스튜디오)에 붙일 묶음 글을 낸다 · 받은 JSON 을 거르고 넣는다 (docs/realm/MEMORY.md §2-4 · 진행은 같은 문서 「진행」).
 *
 *   npx tsx tools/woo-lines-gen.ts brief <id> <id> ...      다섯 사람의 묶음 글 (설정 + 칸 + 규칙 + JSON 꼴)
 *   npx tsx tools/woo-lines-gen.ts next [n]                  아직 묶음이 없는 다음 n 사람 id (차례: 군주 모두 → 자주 나오는 장수)
 *   npx tsx tools/woo-lines-gen.ts check <file.json>         받은 JSON 을 거른다 (칸 · 해요체 · 되묻기 · 긴 줄표 · 자리표 · 겹침)
 *   npx tsx tools/woo-lines-gen.ts write <file.json>         거른 뒤 src/realm/data/woo-talk/<무리>.ts 에 넣는다 (무리 = 그 사람이 처음 나오는 가장 작은 판)
 *   npx tsx tools/woo-lines-gen.ts groups                    무리마다 묶음 수
 */
import fs from 'node:fs'
import path from 'node:path'
import { REGION_IDS, regionNations, startRegion } from '../src/realm/data/regions/index.ts'
import { WORLD_NATIONS } from '../src/realm/data/nations-world.ts'
import { NATIONS } from '../src/realm/data/nations.ts'
import { HIRE_LINE } from '../src/realm/data/hire-lines.ts'
import { TRAIT } from '../src/realm/data/traits.ts'
import { WOO_TALK, type WooBundle } from '../src/realm/data/woo-talk/index.ts'
import type { Hero, Realm, RegionId } from '../src/realm/types.ts'
import { isRuler } from '../src/realm/heroes.ts'
import { fitOf } from '../src/realm/woo.ts'
import { baseKind, voiceKind } from '../src/ui/realm/voice.ts'
import { HEAR_REG, SPEAK_REG, type Reg } from '../src/ui/realm/woo-lines.ts'

const ROOT = path.resolve(import.meta.dirname, '..')
const APPS = ['soothe', 'cause', 'gain', 'fear', 'bond'] as const
const APP_NAME = { soothe: '달래기', cause: '명분', gain: '이익(곡식)', fear: '겁주기', bond: '인연' } as const
const REG_NAME: Readonly<Record<Reg, string>> = { hao: '하오체(~소 · ~오 · ~구려 · ~시오)', hage: '하게체(~네 · ~게 · ~나 · ~구먼)', hae: '해라체(~다 · ~냐 · ~라 · ~구나)' }

// ───────────────────────── 판 · 설정 읽기 ─────────────────────────

/** 판마다 한 번 연다 (작은 판부터) */
const BOARDS: ReadonlyArray<{ reg: RegionId; r: Realm }> = REGION_IDS.map((reg) => ({ reg, r: startRegion(reg, 1, regionNations(reg)[0]!) }))
/** 사람이 처음 나오는 가장 작은 판 = 묶음 파일 무리 */
export function groupOf(id: string): RegionId | null {
  return BOARDS.find((b) => b.r.heroes[id] !== undefined)?.reg ?? null
}
const boardOf = (id: string): Realm => BOARDS.find((b) => b.r.heroes[id] !== undefined)!.r

/** cast 문서 — id → 그 칸의 줄들 */
function castEntries(): Map<string, string[]> {
  const out = new Map<string, string[]>()
  const dir = path.join(ROOT, 'docs/realm/cast')
  for (const f of ['part-1.md', 'part-2.md', 'part-3.md', 'part-4.md']) {
    const lines = fs.readFileSync(path.join(dir, f), 'utf8').replaceAll('\r\n', '\n').split('\n')
    let cur: string[] | null = null
    for (const l of lines) {
      const m = /^### .*?`([\w-]+)`/.exec(l)
      if (m !== null) { cur = []; out.set(m[1]!, cur); continue }
      if (l.startsWith('#')) { cur = null; continue }
      if (cur !== null && l.startsWith('- ') && !/^- (확인|목소리 결|등용 대사)/.test(l)) cur.push(l.slice(2))
    }
  }
  return out
}
const CAST = castEntries()

/** 차례 — 군주 모두(작은 판부터) → 자주 나오는 장수 (변한 판 · 주몽 · 서라벌 · 마한 · 길잡이 판) */
export function order(): string[] {
  const rulers: string[] = []
  const seen = new Set<string>()
  for (const { r } of BOARDS) for (const f of Object.values(r.factions)) {
    const id = f.ruler
    if (id !== undefined && r.heroes[id] !== undefined && !seen.has(id)) { seen.add(id); rulers.push(id) }
  }
  const often: string[] = []
  for (const reg of ['byeonhan-mini', 'jumong', 'seorabeol', 'mahan', 'tutorial', 'yeongnam', 'south', 'world'] as const) {
    const r = BOARDS.find((b) => b.reg === reg)!.r
    for (const h of Object.values(r.heroes)) if (!seen.has(h.id)) { seen.add(h.id); often.push(h.id) }
  }
  // 변한 판 군주를 맨 앞에 (형이 진지렴 쇠보를 사로잡았던 판)
  const mini = BOARDS.find((b) => b.reg === 'byeonhan-mini')!.r
  const first = rulers.filter((id) => mini.heroes[id] !== undefined)
  return [...first, ...rulers.filter((id) => !first.includes(id)), ...often]
}

// ───────────────────────── 묶음 글 ─────────────────────────

const statLine = (h: Hero): string => `무예 ${h.mu} · 통솔 ${h.tong} · 지략 ${h.ryak} · 내정 ${h.chi} · 매력 ${h.deok} · 의리 ${h.uiri}`
function nationOf(r: Realm, fid: string): string {
  const name = r.factions[fid]?.name ?? fid
  const info = [...WORLD_NATIONS, ...NATIONS].find((n) => n.id === fid)
  return info !== undefined ? `${name} (${info.place}) · ${info.blurb}` : name
}
/** 갇혔을 때 잘 먹히는 거리 · 노여움을 사는 거리 (나라가 아직 버틸 때 기준) */
function fits(r: Realm, h: Hero): string {
  const rr = structuredClone(r)
  const x = rr.heroes[h.id]!
  const other = Object.values(rr.factions).find((f) => f.id !== x.faction)!
  x.status = 'captive'; x.captor = other.id
  const f = APPS.filter((a) => a !== 'bond').map((a) => ({ a, n: fitOf(rr, h.id, null, a).fit }))
  const good = f.filter((y) => y.n >= 1).map((y) => APP_NAME[y.a])
  const bad = f.filter((y) => y.n <= -2).map((y) => APP_NAME[y.a])
  return `잘 먹힘: ${good.length > 0 ? good.join(' · ') : '딱히 없음(자존심이 세다)'} · 노여움을 살 수 있음: ${bad.length > 0 ? bad.join(' · ') : '없음'}`
}
function heroBrief(id: string): string {
  const r = boardOf(id)
  const h = r.heroes[id]!
  const ruler = isRuler(r, id)
  const k = baseKind(voiceKind(h, ruler))
  const rel: string[] = []
  if (h.spouse !== undefined && r.heroes[h.spouse] !== undefined) rel.push(`짝: ${r.heroes[h.spouse]!.name}`)
  for (const p of h.parents ?? []) if (r.heroes[p] !== undefined) rel.push(`어버이: ${r.heroes[p]!.name}`)
  for (const y of Object.values(r.heroes)) if (y.parents?.includes(id) === true) rel.push(`자식: ${y.name}`)
  const lines = [
    `### ${id} · ${h.name}${ruler ? ' · ★군주 (이 나라의 우두머리)' : ''}`,
    `- 나라: ${nationOf(r, h.faction)}`,
    `- ${h.look === 'w' ? '여' : '남'} · 특성: ${h.traits.map((t) => TRAIT[t]?.name ?? t).join(' · ') || '없음'} · ${statLine(h)}`,
    ...(rel.length > 0 ? [`- 피붙이: ${rel.join(' · ')}`] : []),
    ...(CAST.get(id) ?? [`- (설정 문서에 칸이 없다. 이름 · 나라 · 특성으로 지어라)`]).map((l) => `- ${l}`),
    ...(HIRE_LINE[id] !== undefined ? [`- 넘어온 뒤 첫마디(이미 있음, 겹치지 말 것): "${HIRE_LINE[id]}"`] : []),
    `- 갇혔을 때 말씨: ${REG_NAME[HEAR_REG[k]]} · 남을 회유할 때 말씨: ${REG_NAME[SPEAK_REG[k]]}`,
    `- 회유 규칙: ${fits(r, h)}`,
  ]
  return lines.join('\n').replaceAll(' — ', ', ').replaceAll('—', ', ')
}

const SCHEMA = `{
  "<장수 id>": {
    "held": {
      "open": { "pride": "", "long": "", "hurt": "", "greed": "", "fear": "" },
      "kin": "",
      "grudge": "",
      "hit":  { "soothe": "", "cause": "", "gain": "", "fear": "", "bond": "" },
      "miss": { "soothe": "", "cause": "", "gain": "", "fear": "", "bond": "" },
      "againHit": ["", ""],
      "againMiss": ["", ""],
      "rage": { "insult": "", "slight": "" },
      "yield": { "agreed": "", "refused": "" },
      "notYet": ""
    },
    "speak": {
      "lord": "",
      "soothe": ["", "", ""],
      "cause": { "fallen": "", "alone": "", "alive": "", "again": "", "third": "" },
      "gain": ["", "", ""],
      "fear": ["", "", ""],
      "bond": { "kin": "", "blood": "", "home": "" }
    }
  }
}`

export function brief(ids: readonly string[]): string {
  return `너는 한국 사극 드라마 작가다. 원삼국 시대(삼한 · 부여 · 고구려 초기, 기원 전후) 78국을 무대로 한 전략 게임 「삼한열전」의 「옥중 담판」 대사를 쓴다.
싸움에서 사로잡힌 장수(또는 임금)를 우리 장수가 옥에 찾아가 말로 설득해 우리 편으로 데려오는 장면이다. 한 판은 세 마디: 갇힌 이의 첫마디 → (우리 장수의 설득 → 갇힌 이의 반응) × 3 → 넘어오거나, 아직 버틴다.
설득하는 길은 다섯: 달래기(따뜻한 말) · 명분(나라 처지를 짚음) · 이익(곡식을 줌) · 겁주기(칼로 위협) · 인연(피붙이 · 한 핏줄 · 같은 고향).

아래 ${ids.length}사람 각각에 대해 **두 묶음**을 써라. 사람마다 출신 · 사연 · 겉모습의 물건 · 성격 · 말버릇이 대사에 배어 나와야 한다. 다른 사람 대사와 바꿔 끼워도 말이 되면 실패다.
1. held: 이 사람이 **사로잡혀 옥에 갇혔을 때** 하는 말
2. speak: 이 사람이 **우리 장수가 되어 다른 포로를 회유하러 갈 때** 하는 말

## 사람들
${ids.map(heroBrief).join('\n\n')}

## 칸 (모두 한 줄 = 한두 문장 · 25~85자)
held (갇힌 이):
- open.pride/long/hurt/greed/fear: 첫마디 다섯. 판의 사정에 따라 하나만 뜬다. 각각 그 사람의 약한 곳을 은근히 드러내는 단서다: pride 자존심(어느 길도 안 먹힐 듯) · long 그리움·지침(달래기가 먹힐 단서) · hurt 버림받은 서운함·나라 걱정(명분이 먹힐 단서) · greed 굶주림·살림 걱정(이익이 먹힐 단서) · fear 두려움(겁주기가 먹힐 단서). 다섯 줄이 서로 다른 그림이어야 한다.
- kin: 피붙이({rel} {kin})가 우리 손에 있다는 걸 알고 하는 첫마디. 「{rel} {kin}」을 넣는다.
- grudge: 지난 담판에서 모욕당해 원한을 품고 다시 마주했을 때 첫마디.
- hit.<길>: 그 길의 설득이 먹혔을 때 반응 (마음이 기우는 까닭이 그 사람의 사연에서 나온다). miss.<길>: 안 먹혔을 때 (그 사람의 자존심 · 의리 · 사연으로 튕긴다).
- againHit[0][1]: 같은 길을 두 번째 · 세 번째 또 듣고 또 마음이 기울 때. againMiss[0][1]: 또 듣고 또 튕길 때. 어느 길이었든 맞게 쓴다(길 이름을 말하지 말 것).
- rage.insult: 곡식이나 칼로 업신여김을 당해 크게 노했다 (담판이 깨진다). rage.slight: 따뜻한 말 · 나라 이야기 · 정으로 깔보였다고 느껴 노했다.
- yield.agreed: 앞 설득이 먹혀 마음이 기운 끝에 우리 편이 되기로 하는 한마디 (옥문은 다음 계절에 열린다). yield.refused: **바로 앞에서 고개를 저어 놓고** 끝내 넘어오는 한마디. 그 거절을 스스로 짚어야 한다 (예: 「……듣기 싫다 했으나, 그대 말이 귀에서 떠나지 않구려」 같은 결, 이 문장을 베끼지는 말 것).
- notYet: 마음의 벽은 무너졌지만 아직 손을 잡지 않는다.
speak (회유하러 간 우리 장수):
- lord: 군주에게 옥에 다녀오겠다고 아뢴다 (사극 하옵니다체 · 부르는 말 「주군 · 전하 · 대왕」 없이). **★군주인 사람은** 신하들에게 내가 직접 옥으로 가겠다고 말한다 (해라체).
- soothe[0][1][2]: 달래기 첫 번째 · 두 번째 · 세 번째 (같은 길을 거듭 쓸 때 점점 깊어진다).
- cause.fallen: 상대 나라 {nation}이 이미 무너졌다 · cause.alone: 갇힌 지 {jail}이 지나도록 아무도 구하러 오지 않았다 · cause.alive: {nation}은 아직 버티지만 그대를 구하러 오지 않는다 · cause.again/third: 명분을 거듭 밀 때.
- gain[0][1][2]: 곡식 {grain}을 주겠다 (셋 다 {grain}을 넣는다 · 거듭할수록 얹는다).
- fear[0][1][2]: 겁주기. 괄호 지문 하나로 몸짓을 보인다 (그 사람의 무기 · 물건으로. 예: (도끼날을 탁자에 내려놓는다)).
- bond.kin: 상대의 {rel} {kin}이 우리 쪽에 있다 · bond.blood: 너와 나는 한 핏줄 · bond.home: 우리 둘 다 {home}에서 났다.

## 자리표 (코드가 판의 사실로 채운다)
{nation} 갇힌 이의 나라 · {ours} 사로잡은 우리 나라 · {jail} 갇힌 동안(「세 계절」) · {grain} 곡식(「스무 섬」) · {kin} 피붙이 이름 · {rel} 그 사이(짝·딸·아들·어머니·아버지) · {home} 같은 고향 나라 · {tie} 인연의 낱말
- 자리표 뒤 조사는 은 · 는 · 이 · 가 · 을 · 를 · 과 · 와 · 으로 · 로 · 의 · 에 · 에서 · 도 · 만 가운데 하나를 붙여 쓰거나 띄어 쓴다. 받침은 코드가 맞춘다.
- 자리표 바로 뒤에 「이오 · 이다 · 이라 · 이면 · 이니」 같은 말은 붙이지 않는다 (예: 「{grain}이오」 ✗ → 「{grain}을 보내겠소」 ○).
- 자리표는 그 칸 설명에 적힌 것만 쓴다. 나라 이름 · 사람 이름을 지어내지 말고 자리표로.

## 규칙 (어기면 다시 쓴다)
- 사극 말투. 각 사람의 「갇혔을 때 말씨」 · 「회유할 때 말씨」를 지킨다.
- **문장 끝에 「요」가 오면 안 된다**: ~요 · ~에요 · ~예요 · ~해요 · ~게요 · ~네요 · ~죠 전부 금지. 하오체 「~요」(그대요 · 하나요)도 쓰지 말고 「~이오」로.
- **되묻기 금지**: 상대가 한 말을 되읊거나 「~ 물었소?」「~ 했소?」「~라 했느냐?」로 받지 말 것. 반응은 바로 제 마음을 말하고, 설득은 바로 제 말을 한다.
- 현대어 · 외래어 · 한자 성어 남발 금지. 긴 줄표(—, –) 금지 (말을 멈출 때는 「……」).
- 「주군」은 쓰지 않는다 (섬기는 이는 「주인 · 군장」). 주판처럼 그 시대에 없던 물건도 쓰지 않는다.
- **하옵니다체(~사옵니다 · ~옵소서)는 lord 줄에만.** 갇혔을 때 · 회유할 때는 위 「말씨」만 쓴다 (설정 문서의 「말투: 하옵니다체」는 임금 앞에서의 말이다).
- 묻는 말은 끝에 「?」를 붙인다 (예: 「다친 곳은 없으시오?」).
- **줄은 조립된다.** 반응 줄은 상대 사람이 누구인지 · 무엇을 했는지 모른다. 손을 잡았다 · 술상을 차렸다 · 고개를 조아렸다 · 칼(활)을 들이댔다처럼 상대의 몸짓이나 무기를 지어내지 말고, 그 길의 뜻(따뜻한 말 · 나라 이야기 · 곡식 · 위협 · 인연)에만 반응한다. 설득 줄도 상대가 장수인지 임금인지 · 무슨 재주인지 단정하지 말 것 (lord 줄도 「저 장수」 대신 「저 사람」).
- hit 줄은 마음이 기우는 말이어야 한다 (튕기는 말 금지). miss 줄은 튕기는 말이어야 한다.
- yield.refused 는 방금 고개를 저었다는 것만 짚는다. 앞에서 한 특정한 말(「가락이 맞지 않는다며」)을 옮기지 말 것 (그 말을 했는지 모른다).
- 인연(bond) 반응은 피붙이 · 한 핏줄 · 고향 가운데 어느 것인지 모른다. 「인연 · 끈 · 정」으로 쓰고 셋을 늘어놓지 말 것.
- 「영혼 · 오산 · 성의」 같은 요즘 말 대신 「넋 · 그릇된 셈 · 정성」.
- 한 사람의 말씨를 한 줄 안에서 섞지 말 것 (「~게냐! ~줄 아시오!」 ✗).
- 「~이지 ~가 아니다」 같은 해명투 줄이지 말 것.
- 말버릇은 묶음 전체에서 한두 번만 (모든 줄에 넣지 말 것).
- 원삼국 시대 물건만: 쇠 · 청동 · 소금 · 베 · 곡식 · 배 · 활 · 고리자루 칼. 일본풍(닌자 · 사무라이 · 카타나) · 조선 후기 말(양반 · 대감 · 마님 · 엽전) 금지.
- **${ids.length}사람 사이에 같은 문장 · 같은 비유 · 같은 첫머리를 쓰지 말 것.** 한 사람 안에서도 줄마다 다른 그림.
- 지문 괄호는 fear 줄과 몸짓이 꼭 필요한 줄에만, 한 줄에 하나.

## 이어지는 모습 (보기 · 다른 사람이다 · 베끼지 말 것)
갇힌 이: 「옥 창살 너머로 강물 소리가 들리는구려. 뗏목을 묶어 둔 줄이 썩었을 것이오.」
우리 장수: 「밥부터 드시오. 그대 손에 굳은살을 보니 노를 잡던 사람이구려.」
갇힌 이: 「……노 젓던 손을 알아보는 이가 적에게 있을 줄은 몰랐소.」
우리 장수: (같은 길 두 번째) 「강가 사람끼리는 물 앞에서 거짓을 말하지 않소. 그대 뗏목은 내가 새로 묶어 주리다.」

## 내보내기
JSON 하나만, 코드 블록 없이. 꼴:
${SCHEMA}
`
}

// ───────────────────────── 거르기 · 넣기 ─────────────────────────

const CHILD = /(요|에요|예요|해요|게요|네요|죠)[.!?…]?$/
const ECHO = /^[^.!?…]*(물었소|했소|하였소|물었나|했나|했느냐|물었느냐|느냐 물었|라 했소)\?/
const PLACE = new Set(['nation', 'ours', 'captor', 'jail', 'grain', 'kin', 'rel', 'home', 'tie', 'blade'])
const AFTER = /^(?:$|[\s.,!?…」)·]|(?:으로|은|는|이|가|을|를|과|와|로)(?:$|[\s.,!?…」)])|의|에서|에게|에|도|만|까지|부터|처럼|보다|뿐|께)/

/** 묶음의 줄을 모두 (칸 이름과 함께) */
export function linesOf(b: WooBundle): Array<[string, string]> {
  const out: Array<[string, string]> = []
  const walk = (o: unknown, at: string): void => {
    if (typeof o === 'string') out.push([at, o])
    else if (Array.isArray(o)) o.forEach((y, i) => walk(y, `${at}.${i}`))
    else if (o !== null && typeof o === 'object') for (const [k, v] of Object.entries(o)) walk(v, at === '' ? k : `${at}.${k}`)
  }
  walk(b, '')
  return out
}
const SLOTS = linesOf(JSON.parse(SCHEMA.replace('"<장수 id>": ', '"x": '))['x'] as WooBundle).map(([k]) => k)

function sentenceEnds(line: string): string[] {
  return line.split(/(?<=[.!?…])\s+/).map((s) => s.replace(/\([^)]*\)/g, '').replace(/[」"'\s]+$/, '').trim()).filter((s) => s !== '')
}
/** 문제 목록 (없으면 빈 배열) */
export function problems(data: Record<string, WooBundle>, others: Readonly<Record<string, WooBundle>> = WOO_TALK): string[] {
  const out: string[] = []
  const seen = new Map<string, string>()
  for (const [id, b] of Object.entries(others)) if (data[id] === undefined) for (const [k, l] of linesOf(b)) seen.set(l, `${id} ${k}`)
  for (const [id, b] of Object.entries(data)) {
    if (groupOf(id) === null) out.push(`${id}: 판에 없는 사람`)
    const got = new Map(linesOf(b))
    for (const k of SLOTS) if (typeof got.get(k) !== 'string' || got.get(k)!.trim() === '') out.push(`${id} ${k}: 빈 칸`)
    for (const k of got.keys()) if (!SLOTS.includes(k)) out.push(`${id} ${k}: 모르는 칸`)
    for (const [k, l] of got) {
      const at = `${id} ${k}`
      if (l.length < 6 || l.length > 140) out.push(`${at}: 길이 ${l.length}: ${l}`)
      if (/[—–]/.test(l)) out.push(`${at}: 긴 줄표: ${l}`)
      if (ECHO.test(l)) out.push(`${at}: 되묻기: ${l}`)
      for (const s of sentenceEnds(l)) if (CHILD.test(s)) out.push(`${at}: 해요체: ${s}`)
      for (const m of l.matchAll(/\{(\w+)\}/g)) {
        if (!PLACE.has(m[1]!)) out.push(`${at}: 모르는 자리표 {${m[1]}}: ${l}`)
        if (!AFTER.test(l.slice(m.index! + m[0].length))) out.push(`${at}: 자리표 뒤 받침말: ${l}`)
      }
      if (/[a-zA-Z]/.test(l.replace(/\{\w+\}/g, ''))) out.push(`${at}: 로마자: ${l}`)
      if (!k.endsWith(".lord") && /옵니다|옵소서/.test(l)) out.push(`${at}: 하옵니다체는 lord 줄만: ${l}`)
      const banned = /주군|(?<![가-힣])전하|마님|대감|양반|엽전|주판|판옥선|거북선|조총|손절|스트레스|오케이|타이밍|파이팅|사무라이|닌자|카타나/.exec(l)
      if (banned !== null) out.push(`${at}: 안 쓰는 말 「${banned[0]}」: ${l}`)
      if (/사이가 아니오\.$/.test(l)) out.push(`${at}: 「아니오.」 되묻는 뜻이면 「?」: ${l}`)
      const prev = seen.get(l)
      if (prev !== undefined) out.push(`${at}: 같은 줄이 ${prev} 에도: ${l}`)
      seen.set(l, at)
    }
    if (typeof b.speak?.gain?.[0] === 'string') for (const [i, l] of b.speak.gain.entries()) if (!l.includes('{grain}')) out.push(`${id} speak.gain.${i}: {grain} 없음`)
    if (typeof b.held?.kin === 'string' && !b.held.kin.includes('{kin}')) out.push(`${id} held.kin: {kin} 없음`)
    if (typeof b.speak?.bond?.kin === 'string' && !b.speak.bond.kin.includes('{kin}')) out.push(`${id} speak.bond.kin: {kin} 없음`)
  }
  return out
}

/** 받은 글 — 코드 블록 · 앞뒤 말을 걷고 JSON 만 */
export function parseReply(text: string): Record<string, WooBundle> {
  const s = text.replace(/^﻿/, '')
  const a = s.indexOf('{')
  const b = s.lastIndexOf('}')
  return JSON.parse(s.slice(a, b + 1)) as Record<string, WooBundle>
}

const GROUP_CONST = (g: string): string => `WOO_${g.toUpperCase().replace(/-/g, '_')}`
const groupFile = (g: string): string => path.join(ROOT, 'src/realm/data/woo-talk', `${g}.ts`)
/** 무리 파일을 읽는다 (없으면 빈 것) */
function readGroup(g: string): Record<string, WooBundle> {
  const f = groupFile(g)
  if (!fs.existsSync(f)) return {}
  const s = fs.readFileSync(f, 'utf8').replaceAll('\r\n', '\n')
  const a = s.indexOf('= {') + 2
  return JSON.parse(s.slice(a, s.lastIndexOf('}') + 1)) as Record<string, WooBundle>
}
function writeGroup(g: string, data: Record<string, WooBundle>): void {
  const ids = order()
  const sorted = Object.fromEntries(Object.entries(data).sort((x, y) => ids.indexOf(x[0]) - ids.indexOf(y[0])))
  const body = `/**\n * 사람마다 회유 대사 · ${g} 판에서 처음 나오는 사람들 (tools/woo-lines-gen.ts 가 쓴다 · 손으로 고쳐도 된다 · docs/realm/MEMORY.md 「진행」).\n * Argon 으로 쓰고 챗지피티로 교차 검증. 자리표는 src/realm/data/woo-talk/types.ts.\n */\nimport type { WooBundle } from './types.ts'\n\nexport const ${GROUP_CONST(g)}: Readonly<Record<string, WooBundle>> = ${JSON.stringify(sorted, null, 2)}\n`
  fs.writeFileSync(groupFile(g), body)
  // index 에 무리를 잇는다
  const idx = path.join(ROOT, 'src/realm/data/woo-talk/index.ts')
  let s = fs.readFileSync(idx, 'utf8').replaceAll('\r\n', '\n')
  const imp = `import { ${GROUP_CONST(g)} } from './${g}.ts'\n`
  if (!s.includes(imp)) {
    s = s.replace("import type { WooBundle } from './types.ts'\n", `import type { WooBundle } from './types.ts'\n${imp}`)
    const m = /export const WOO_TALK: Readonly<Record<string, WooBundle>> = \{(.*)\}\n/.exec(s)
    if (m === null) throw new Error('index.ts 의 WOO_TALK 줄을 못 찾았다')
    const have = m[1]!.split(',').map((y) => y.trim()).filter((y) => y !== '')
    s = s.replace(m[0], `export const WOO_TALK: Readonly<Record<string, WooBundle>> = { ${[...have, `...${GROUP_CONST(g)}`].join(', ')} }\n`)
    fs.writeFileSync(idx, s)
  }
}

if (process.argv[1]?.endsWith('woo-lines-gen.ts')) {
  const [cmd, ...rest] = process.argv.slice(2)
  if (cmd === 'brief') console.log(brief(rest))
  else if (cmd === 'next') {
    const n = Number(rest[0] ?? 5)
    console.log(order().filter((id) => WOO_TALK[id] === undefined).slice(0, n).join(' '))
  } else if (cmd === 'groups') {
    const ids = order()
    const done = ids.filter((id) => WOO_TALK[id] !== undefined)
    console.log(`묶음 ${done.length} / ${ids.length}`)
  } else if (cmd === 'check' || cmd === 'write') {
    const data = parseReply(fs.readFileSync(rest[0]!, 'utf8'))
    const bad = problems(data)
    for (const p of bad) console.log(p)
    console.log(`${Object.keys(data).length}사람 · 문제 ${bad.length}곳`)
    if (cmd === 'write') {
      if (bad.length > 0) { console.log('문제가 있어 넣지 않았다'); process.exit(1) }
      const by = new Map<string, Record<string, WooBundle>>()
      for (const [id, b] of Object.entries(data)) {
        const g = groupOf(id)!
        if (!by.has(g)) by.set(g, readGroup(g))
        by.get(g)![id] = b
      }
      for (const [g, d] of by) { writeGroup(g, d); console.log(`${g}.ts · ${Object.keys(d).length}사람`) }
    }
  } else console.log('brief <id...> | next [n] | check <json> | write <json> | groups')
}
