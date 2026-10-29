/**
 * 풍습 — 나라의 결 (docs/realm/CUSTOMS.md §7 · 2026-10-23 회의 결정) · 나라 고리 · 땅이 준 한 수 (§8-1 · 2026-10-26 의회).
 *
 * 나라 사이의 차이를 핏줄이 아니라 **땅·생업·제도·교류**로 낸다. 층이 셋이다 (§8-1):
 *   결 풍습   — 결(문화권)마다 사서에 적힌 풍습 둘. 그 결의 모든 나라 (tier 'kyeol')
 *   나라 고리 — 사서·고고학에 그 나라 이야기가 남은 나라만, 실제 사건·유물 한 줄이 규칙 하나 (tier 'nation')
 *   땅 한 수  — 이야기가 없는 소국. 지어내지 않고 그 나라 땅의 꼬리표(쇠·포구·목장·갈대·높은 터·소도 곁)에서 (tier 'land')
 * 좋은 것에는 늘 값이 붙는다. 규칙마다 화면에 뜨는 두 문장(`verb`) — 「못 하는 것. 대신(그래서) 이렇게 싸운다」 (§8-1 지킬 것 1 · 형 10-29: 설계 틀 문장 그대로는 알아먹지 못한다).
 * 뿌리는 우리 책이 먼저(『삼국사기』·『삼국유사』), 『삼국지』 위서 동이전은 곁들임. 늦은 것(개마·판갑)은 넣지 않는다.
 *
 * 나라의 풍습은 `Faction.customs` — 없으면 제 것(nativeCustoms: 결 풍습 + 나라 고리, 고리가 없으면 땅 한 수). 셈은 `hasCustom` 하나로만 묻는다.
 * `live` 가 false 인 풍습은 아직 규칙이 걸리지 않았다 — 화면에도 안 보인다 (짓는 차례 wave).
 * 판(realm)은 산 판인지 모른다 — `pack` 은 화면의 잠금에만 쓴다 (MONEY.md §3).
 */
import { P } from '../../tune/params.ts'
import type { Realm, ReportLine } from '../types.ts'

/** 결 — 사서가 한 묶음으로 적은 사람들 */
export type Kyeol = 'goguryeo' | 'buyeo' | 'okjeo' | 'ye' | 'mahan' | 'byeonhan' | 'jinhan' | 'baekje' | 'juho' | 'other'

export type CustomId =
  | 'chaekhwa' | 'byeoljeom' // 동예
  | 'jwasik' | 'bugyeong' // 고구려
  | 'guseul' | 'maljangrye' // 마한
  | 'sogeum' | 'hanmudeom' // 옥저
  | 'yeonggo' | 'baljeom' // 부여
  | 'deongisoe' | 'girbikyeo' // 변한
  | 'yeoseotmaeul' | 'itgeum' // 사로 (진한 결에서 떼어 사로 전용 — §8-0 지뢰)
  | 'tteodori' | 'byeonon' // 백제
  | 'baejangsa' | 'seomjikigi' // 주호
  // 나라 고리 (§8-2 ★)
  | 'judge' // 음즙벌 — 수로왕의 판결
  | 'dalcheon' // 우시산 — 달천 철광
  | 'sonoe' // 골벌 — 쇠뇌 (영천 용전리)
  | 'ireoseom' // 압독·실직 — 다시 일어남
  | 'dalbeol' // 다벌 — 달벌 흙성
  | 'geumseong' // 이서 — 도읍 에우기 (금성)
  | 'julta' // 사벌 — 두 큰 나라 사이
  | 'soebae' // 가락 — 쇠 실은 배
  | 'posang' // 골포·사물·고자 — 바닷가 여덟 나라
  // 땅 한 수 (§8-1 셋째 층)
  | 'landIron' | 'landPort' | 'landReeds' | 'landHigh' | 'landPasture' | 'landSodo'

/** 층 — 어느 길로 잘 건너오나 (도읍 쥐기=제도 · 혼인=집안·신앙 · 손잡기=물질) */
export type CustomLayer = 'rule' | 'family' | 'matter'

/** 셋 가운데 어느 층의 차이인가 (§8-1) */
export type CustomTier = 'kyeol' | 'nation' | 'land'

/** 확신 표기 (§8-1 지킬 것 5) — 문헌 · 고고학 · 전승 · 땅에서 나온 것 */
export type Sure = '문헌' | '고고학' | '전승' | '땅'

export interface CustomDef {
  readonly id: CustomId
  readonly kyeol: Kyeol
  readonly tier: CustomTier
  /** 나라 고리 — 이 나라들만 제 것으로 가진다 (결 풍습이 아닌 것) */
  readonly nations?: readonly string[]
  /** 카드 큰 제목 — 쉬운 말 (교과서 낱말인 영고·책화·덩이쇠만 그대로) */
  readonly name: string
  /** 무엇이 되나 — 한 줄 */
  readonly does: string
  /** 무엇을 내주나 — 한 줄 */
  readonly cost: string
  /** 화면에 뜨는 두 문장 — 「못 하는 것. 대신(그래서) 이렇게 싸운다」 (§8-1 지킬 것 1) */
  readonly verb: string
  /** 사서 한 줄 (땅 한 수는 땅의 말) */
  readonly source: string
  readonly sure: Sure
  readonly layer: CustomLayer
  /** 연대기가 나라 이름을 지을 때 쓰는 씨앗 낱말 — "소금과 별의 나라" */
  readonly seed: string
  readonly pack: 'base'
  readonly wave: 1 | 2 | 3
  /** 규칙이 판에 걸렸나 */
  readonly live: boolean
}

type Def = Omit<CustomDef, 'tier' | 'sure' | 'verb'> & Partial<Pick<CustomDef, 'tier' | 'sure' | 'verb'>>
const def = (d: Def): CustomDef => ({ tier: 'kyeol', sure: '문헌', verb: '', ...d })

export const CUSTOMS: readonly CustomDef[] = [
  def({
    id: 'chaekhwa', kyeol: 'ye', name: '책화', layer: 'rule', seed: '경계', pack: 'base', wave: 1, live: true,
    does: '남의 땅을 밟으면 물어내야 한다. 이웃이 우리 땅을 덜 넘보고, 쳐들어온 적군은 첫 합에서 사기가 깎인다',
    cost: '우리 군대가 남의 땅에 나가 있으면 군량이 곱으로 든다',
    verb: '남의 땅에 오래 나가 있기는 어렵다. 대신 우리 땅에 들어온 적은 값을 톡톡히 치른다',
    source: '『삼국지』 위서 예전: 읍락이 서로 침범하면 사람·소·말로 물어내게 하니, 이를 책화라 한다',
  }),
  def({
    id: 'byeoljeom', kyeol: 'ye', name: '별점', layer: 'family', seed: '별', pack: 'base', wave: 1, live: false,
    does: '봄에 그해 가을걷이(풍년·흉년)를 미리 안다',
    cost: '흉년이 보이면 백성이 먼저 흔들려 그해 징병이 준다',
    source: '『삼국지』 위서 예전: 새벽에 별자리를 살펴 그해 풍흉을 미리 안다 · 시월에 하늘에 제사하니 무천이라 한다',
  }),
  def({
    id: 'jwasik', kyeol: 'goguryeo', name: '거둬먹기', layer: 'rule', seed: '산', pack: 'base', wave: 1, live: false,
    does: '조공하는 나라가 가을마다 곡식을 바치고, 새로 앗은 고을의 곳간을 거둔다',
    cost: '우리 고을 가을걷이가 준다. 좋은 밭이 없다',
    source: '『삼국지』 위서 고구려전: 대가들은 농사짓지 않고, 좌식자 만여 명에게 하호가 쌀·물고기·소금을 멀리서 져 온다',
  }),
  def({
    id: 'bugyeong', kyeol: 'goguryeo', name: '흩어진 창고', layer: 'matter', seed: '곳간', pack: 'base', wave: 1, live: false,
    does: '도읍이 털리거나 불화살을 맞아도 곡식을 덜 잃는다',
    cost: '곡식이 고을마다 흩어져 있다. 변두리 고을을 빼앗기면 그 몫도 넘어간다',
    source: '『삼국지』 위서 고구려전: 큰 창고가 없고 집집마다 작은 창고를 두니 부경이라 한다',
  }),
  def({
    id: 'guseul', kyeol: 'mahan', name: '구슬', layer: 'matter', seed: '구슬', pack: 'base', wave: 1, live: true,
    does: '선물로 오르는 호감이 크다',
    cost: '쇠를 귀히 여기지 않아 쇠를 싸게 친다',
    verb: '쇠로는 이웃의 마음을 사기 어렵다. 대신 구슬 선물이 잘 통한다',
    source: '『삼국지』 위서 한전: 구슬을 재보로 여기고, 금·은·비단은 보배로 여기지 않는다',
  }),
  def({
    id: 'maljangrye', kyeol: 'mahan', name: '말 장례', layer: 'family', seed: '무덤', pack: 'base', wave: 1, live: true,
    does: '가을마다 소·말을 장례에 바쳐 크게 묻는다. 장수들의 정이 오른다 (믿는 장수는 군대의 사기를 올린다)',
    cost: '말을 타지 않아 기병을 뽑지 못한다 · 장례에 곡식과 말이 든다',
    verb: '기병 없이 싸운다. 대신 장례로 맺은 장수들의 정이 군대를 붙든다',
    source: '『삼국지』 위서 한전: 소와 말을 탈 줄 모르고, 소와 말은 장례에 다 쓴다',
  }),
  def({
    id: 'sogeum', kyeol: 'okjeo', name: '소금', layer: 'matter', seed: '소금', pack: 'base', wave: 1, live: false,
    does: '소금이 넉넉하고 소금을 비싸게 판다',
    cost: '큰 나라가 소금을 노린다. 조공을 하면 거둬 가는 몫이 크다',
    source: '『삼국지』 위서 동옥저전: 대가를 보내 맥포·물고기·소금·바다 먹거리를 천 리나 져 나르게 하고 종처럼 부렸다',
  }),
  def({
    id: 'hanmudeom', kyeol: 'okjeo', name: '한무덤', layer: 'family', seed: '뼈', pack: 'base', wave: 2, live: false,
    does: '장수가 죽은 고을을 되찾아 뼈를 거두면 집안 장수의 정이 크게 오른다',
    cost: '장례 한 계절 동안 그 집안 장수는 군대를 이끌지 못한다',
    source: '『삼국지』 위서 동옥저전: 큰 나무 곽을 만들어 온 집안이 한 곽을 쓴다',
  }),
  def({
    id: 'yeonggo', kyeol: 'buyeo', name: '영고', layer: 'family', seed: '북', pack: 'base', wave: 2, live: false,
    does: '겨울 제사 동안 옥사를 멈추고 죄수를 푼다. 회유가 빨라지고 민심이 오른다',
    cost: '그 겨울엔 군대가 잔치에 돌아와 출정하지 못한다',
    source: '『삼국지』 위서 부여전: 정월에 하늘에 제사하고 크게 모이니 영고라 한다. 이때 형옥을 멈추고 죄수를 푼다',
  }),
  def({
    id: 'baljeom', kyeol: 'buyeo', name: '발굽점', layer: 'rule', seed: '발굽', pack: 'base', wave: 2, live: false,
    does: '큰 싸움 전에 이길 낌새가 한 단계 또렷해진다',
    cost: '점칠 때마다 곡식이 들고, 흉이 나오면 사기가 깎인 채 싸운다',
    source: '『삼국지』 위서 부여전: 싸울 일이 있으면 소를 잡아 발굽으로 점친다. 벌어지면 흉, 붙으면 길',
  }),
  def({
    id: 'deongisoe', kyeol: 'byeonhan', name: '덩이쇠', layer: 'matter', seed: '쇠', pack: 'base', wave: 2, live: true,
    does: '쇠가 곧 돈이다: 징병값의 절반을 쇠로 내 곡식을 아끼고, 곡식이 모자라면 쇠로 다 낸다',
    cost: '쇠를 돈으로 쓴 만큼 무장할 쇠가 준다 · 쇠가 쌓이면 이웃이 탐낸다',
    verb: '곡식이 떨어져도 쇠로 군사를 뽑는다. 다만 그만큼 무장할 쇠가 줄어든다',
    source: '『삼국지』 위서 변진전: 나라에서 쇠가 나 한·예·왜가 다 가져가고, 저자에서는 쇠를 돈처럼 쓴다',
  }),
  def({
    id: 'girbikyeo', kyeol: 'byeonhan', name: '길 비켜 주기', layer: 'rule', seed: '길', pack: 'base', wave: 2, live: true,
    does: '사신과 장사꾼이 막히지 않는다. 화친·동맹·교역 청이 잘 받아들여진다',
    cost: '남의 척후와 첩자도 잘 들어온다. 들키지 않고 우리 땅을 본다',
    verb: '남의 척후에게도 길이 열려 있다. 대신 사신과 장사꾼이 오가며 이웃과 가까워진다',
    source: '『삼국지』 위서 변진전: 길 가는 이가 서로 만나면 다 멈춰 서서 길을 비켜 준다',
  }),
  def({
    id: 'yeoseotmaeul', kyeol: 'jinhan', tier: 'nation', nations: ['saro'], name: '여섯 마을의 뜻', layer: 'rule', seed: '마을', pack: 'base', wave: 3, live: true,
    does: '물어서 시작한 싸움: 치러 가는 우리 군대의 사기가 높다',
    cost: '사이가 무던한 나라를 불시에 치지 못한다. 먼저 여섯 마을에 묻고 한 계절 뒤에 친다',
    verb: '이웃을 불시에 칠 수는 없다. 대신 여섯 마을이 뜻을 모은 군대는 사기가 높다',
    source: '『삼국유사』 기이 신라시조 혁거세왕, 여섯 마을 촌장이 알천 언덕에 모여 임금을 세웠다',
  }),
  def({
    id: 'itgeum', kyeol: 'jinhan', tier: 'nation', nations: ['saro'], name: '잇금', layer: 'family', seed: '잇자국', pack: 'base', wave: 3, live: false,
    does: '군주가 죽어도 덕 높은 장수가 이어받는다',
    cost: '누가 이을지는 덕이 정한다. 집안이 바뀌면 옛 집안의 정이 흔들린다',
    source: '『삼국사기』 신라본기 유리이사금, 떡을 깨물어 잇자국이 많은 이를 임금으로 세웠다',
  }),
  def({
    id: 'tteodori', kyeol: 'baekje', name: '떠돌이 받기', layer: 'family', seed: '나그네', pack: 'base', wave: 3, live: false,
    does: '떠돌이 장수가 자주 오고 고용값이 싸다',
    cost: '새로 온 장수는 정이 낮게 시작한다',
    source: '『삼국사기』 백제본기 온조왕, 열 신하가 도와 십제라 했고, 뒤에 백성이 즐겨 따라 백제라 고쳤다',
  }),
  def({
    id: 'byeonon', kyeol: 'baekje', name: '벼논', layer: 'matter', seed: '벼', pack: 'base', wave: 3, live: false,
    does: '남쪽 고을에 벼논을 열면 이듬해부터 가을걷이가 크게 는다',
    cost: '여는 해에는 물 대는 일에 장정이 묶인다',
    source: '『삼국사기』 백제본기 다루왕 6년, 나라 남쪽 고을에 처음으로 벼논을 만들게 했다',
  }),
  def({
    id: 'baejangsa', kyeol: 'juho', name: '배 장사', layer: 'matter', seed: '배', pack: 'base', wave: 3, live: false,
    does: '뱃길 교역 값이 크다',
    cost: '겨울에는 뱃길 교역이 끊긴다',
    source: '『삼국지』 위서 한전: 주호는 마한 서쪽 바다 큰 섬에 있어, 배를 타고 오가며 한과 사고판다',
  }),
  def({
    id: 'seomjikigi', kyeol: 'juho', name: '섬 지키기', layer: 'rule', seed: '섬', pack: 'base', wave: 3, live: false,
    does: '겨울 바다는 아무도 건너오지 못하고, 섬 고을을 지킬 때 덤을 받는다',
    cost: '뭍으로 낸 군대는 겨울에 돌아오지 못한다',
    source: '『삼국지』 위서 한전 주호조, 큰 섬에 살며 배를 탄다',
  }),

  // ───────── 나라 고리 (§8-2 ★ — 사서·고고학에 그 나라 이야기가 남은 나라만)
  def({
    id: 'judge', kyeol: 'other', tier: 'nation', nations: ['eumjeup'], name: '수로왕의 판결', layer: 'rule', seed: '판결', pack: 'base', wave: 3, live: true,
    does: '싸우는 나라에 화친을 청하면 큰 나라의 판결이 붙어 잘 먹힌다',
    cost: '판결해 준 큰 나라에 곡식을 바친다',
    verb: '군대만으로 땅을 지키기엔 힘이 모자라다. 대신 큰 나라의 판결로 싸움을 멈춘다',
    source: '『삼국사기』 신라본기 파사이사금 23년, 음즙벌국과 실직곡국이 땅을 다투자 금관국 수로왕을 불러 물으니, 수로가 그 땅을 음즙벌에 붙였다',
  }),
  def({
    id: 'dalcheon', kyeol: 'other', tier: 'nation', nations: ['usisan'], name: '달천 철광', layer: 'matter', seed: '쇠돌', pack: 'base', wave: 3, live: true, sure: '고고학',
    does: '우리 철광에서 쇠가 곱으로 난다. 땅 위에 드러난 쇠돌을 캔다',
    cost: '쇠돌 캐기에 일손이 묶여 철광 고을에서는 군사를 못 뽑고, 나라가 뽑는 군사도 준다',
    verb: '군사를 많이 뽑지 못한다. 대신 쇠가 넉넉해 적은 군사를 단단히 무장시킨다',
    source: '울산 달천 유적: 기원 전후부터 쇠돌을 캐던 노천 철광 · 『삼국사기』 거도전의 우시산국',
  }),
  def({
    id: 'sonoe', kyeol: 'other', tier: 'nation', nations: ['golbeol'], name: '쇠뇌', layer: 'matter', seed: '쇠뇌', pack: 'base', wave: 3, live: true, sure: '고고학',
    does: '처음부터 쇠뇌 몇 틀이 있어 쇠뇌병을 뽑는다. 방패를 뚫는다',
    cost: '틀 수만큼만 뽑고 한 명마다 쇠가 든다 · 장수의 활 솜씨를 타지 않는다',
    verb: '활 무리를 크게 꾸리지는 못한다. 대신 쇠뇌 몇 틀로 방패벽을 뚫는다',
    source: '영천 용전리 널무덤: 쇠뇌의 방아쇠 틀(청동 노기)이 나왔다, 기원전 1세기 · 『삼국사기』 조분이사금 7년의 골벌국',
  }),
  def({
    id: 'ireoseom', kyeol: 'other', tier: 'nation', nations: ['apdok', 'siljik'], name: '다시 일어남', layer: 'family', seed: '불씨', pack: 'base', wave: 3, live: true,
    does: '도읍을 빼앗겨도 끝나지 않는다. 빼앗은 나라가 도읍을 비워 두면 사람들이 들고일어나 되찾는다 (판에 한 번)',
    cost: '들고일어난 뒤 도읍의 집이 크게 준다',
    verb: '큰 이웃을 막아 내기는 버겁다. 대신 도읍을 빼앗겨도 다시 일어선다',
    source: '『삼국사기』 신라본기 일성이사금 13년, 압독이 들고일어나 군사를 내어 평정하고 남은 무리를 남쪽으로 옮겼다 · 파사이사금 25년 실직도 그렇게 들고일어났다',
  }),
  def({
    id: 'dalbeol', kyeol: 'other', tier: 'nation', nations: ['dabeol'], name: '달벌 흙성', layer: 'rule', seed: '흙성', pack: 'base', wave: 3, live: true,
    does: '도읍에 흙성을 쌓는다. 목책보다 훨씬 굳다',
    cost: '흙성은 곡식과 나무가 크게 들고, 쌓는 계절엔 도읍에서 군사를 못 뽑는다',
    verb: '기댈 산이 없는 탁 트인 들판이다. 그래서 들 한가운데 흙성을 쌓아 버틴다',
    source: '『삼국사기』 신라본기 첨해이사금 15년, 다벌 땅에 달벌성을 쌓고 성주를 두었다 · 대구 달성 토성',
  }),
  def({
    id: 'geumseong', kyeol: 'other', tier: 'nation', nations: ['iseo'], name: '도읍 포위', layer: 'rule', seed: '에움', pack: 'base', wave: 3, live: true,
    does: '남의 도읍을 곧바로 둘러싸고 친다. 도읍을 칠 때 성벽이 덜 막아 준다',
    cost: '남의 도읍을 치면 그 나라와 동맹인 나라들이 모두 우리와 전쟁에 든다',
    verb: '군사가 적어 작은 고을부터 하나씩 먹어 들어갈 수 없다. 그래서 큰 나라의 도읍을 곧바로 둘러싸고 친다',
    source: '『삼국사기』 신라본기 유례이사금 14년, 이서국이 와서 금성을 에웠다. 대나무 잎을 꽂은 군사가 나타나 물리쳤다',
  }),
  def({
    id: 'julta', kyeol: 'other', tier: 'nation', nations: ['sabeol'], name: '줄타기', layer: 'rule', seed: '줄', pack: 'base', wave: 3, live: true,
    does: '가장 센 두 나라에 화친·동맹 청이 잘 먹힌다',
    cost: '한쪽과 손을 잡으면 다른 쪽이 언짢아한다',
    verb: '두 큰 나라를 다 막아 낼 힘은 없다. 그래서 둘 사이에서 줄을 탄다',
    source: '『삼국사기』 열전 석우로: 사량벌국이 신라에 붙어 있다가 갑자기 백제로 돌아서자 우로가 쳐서 멸했다 · 지리지 상주',
  }),
  def({
    id: 'soebae', kyeol: 'other', tier: 'nation', nations: ['guya'], name: '쇠 실은 배', layer: 'matter', seed: '돛', pack: 'base', wave: 3, live: true, sure: '고고학',
    does: '가을마다 남는 쇠를 배에 실어 내고 곡식을 사 온다',
    cost: '쇠를 많이 쌓아 두지 못한다. 남는 쇠는 배가 실어 간다 · 포구를 잃으면 배가 못 뜬다',
    verb: '쇠를 쌓아 두지 못한다. 대신 배로 내다 팔아 곡식을 들여온다',
    source: '김해 양동리 무덤의 쇠도끼·덩이쇠 · 『삼국유사』 가락국기: 바다로 배가 닿는 나라 · 위서 변진전 「國出鐵…倭皆從取之」',
  }),
  def({
    id: 'posang', kyeol: 'other', tier: 'nation', nations: ['us', 'samul', 'goja'], name: '바닷가 여덟 나라', layer: 'rule', seed: '갯마을', pack: 'base', wave: 3, live: true,
    does: '바닷가 나라끼리 화친으로 시작한다. 서로의 화친·동맹·함께 치기 청이 잘 먹힌다',
    cost: '가락이 처음부터 우리를 미워한다 · 손잡은 바닷가 나라 땅으로는 넓히지 못한다',
    verb: '혼자서는 가락을 당해 내지 못한다. 그래서 바닷가 나라들과 손잡고 싸운다',
    source: '『삼국사기』 신라본기 나해이사금 14년, 포상팔국이 가라를 치려 하자 가라 왕자가 구원을 청했다 · 열전 물계자 (골포·사물·고사포)',
  }),

  // ───────── 땅 한 수 (이야기가 없는 나라 — 땅의 꼬리표에서 저절로 · 지어내지 않는다)
  def({
    id: 'landIron', kyeol: 'other', tier: 'land', name: '쇠 다루기', layer: 'matter', seed: '쇠', pack: 'base', wave: 3, live: true, sure: '땅',
    does: '무장을 올리는 데 쇠가 적게 든다',
    cost: '쇠 나는 우리 고을을 이웃이 노린다',
    verb: '철광을 비우고 멀리 나가기는 어렵다. 대신 쇠를 두른 군사로 단단히 지킨다',
    source: '나라 안에 철광이 있다',
  }),
  def({
    id: 'landPort', kyeol: 'other', tier: 'land', name: '뱃길', layer: 'matter', seed: '물길', pack: 'base', wave: 3, live: true, sure: '땅',
    does: '바닷길로 가는 군대가 잘 숨고, 포구에서 수군을 나무 반만 들여 뽑는다',
    cost: '사내들이 바다에 나가 있어 우리 포구를 지키는 장정이 적다',
    verb: '사내들이 바다에 나가 있어 포구를 지킬 장정이 적다. 대신 배를 띄워 바닷길로 먼저 친다',
    source: '도읍이 포구다',
  }),
  def({
    id: 'landReeds', kyeol: 'other', tier: 'land', name: '갈대밭', layer: 'rule', seed: '갈대', pack: 'base', wave: 3, live: true, sure: '땅',
    does: '갈대·나루 길로 가는 기습이 잘 숨는다',
    cost: '여름 큰물에 강가 고을의 집이 조금씩 준다',
    verb: '여름 큰물이 들면 강가 집이 떠내려간다. 대신 갈대밭에 숨어 기습한다',
    source: '갈대 늪과 나루를 낀 땅이다',
  }),
  def({
    id: 'landHigh', kyeol: 'other', tier: 'land', name: '고갯목', layer: 'rule', seed: '고개', pack: 'base', wave: 3, live: true, sure: '땅',
    does: '목책·해자를 반값에 두르고, 고갯길·높은 터로 쳐들어온 적은 첫 합에 사기가 깎인다. 바위를 굴린다',
    cost: '우리 군대도 고갯길로 나가면 한 계절 더 걸린다',
    verb: '고개가 험해 우리도 밖으로 나가는 데 오래 걸린다. 대신 고갯목만 막으면 쳐들어온 적을 쉽게 물리친다',
    source: '높은 터와 고갯길에 둘러싸인 땅이다',
  }),
  def({
    id: 'landPasture', kyeol: 'other', tier: 'land', name: '말 치는 들', layer: 'matter', seed: '말', pack: 'base', wave: 3, live: true, sure: '땅',
    does: '곁의 너른 들에서 말을 친다. 계절마다 말이 들어와 기병을 뽑는다',
    cost: '말 먹이로 계절마다 곡식이 든다',
    verb: '말이 곡식을 먹어 곳간이 넉넉하지 않다. 대신 기병으로 들판에서 싸운다',
    source: '말을 칠 너른 들이 곁에 있다',
  }),
  def({
    id: 'landSodo', kyeol: 'other', tier: 'land', name: '소도 곁', layer: 'family', seed: '솟대', pack: 'base', wave: 3, live: true, sure: '땅',
    does: '소도 제사가 반값이다',
    cost: '봄 제사를 거르면 그해 가을걷이가 준다',
    verb: '봄 제사를 거르면 가을걷이가 준다. 대신 제사를 지내면 하늘의 덤을 받는다',
    source: '소도와 길로 맞닿은 땅이다',
  }),
]

const BY_ID: Readonly<Record<string, CustomDef>> = Object.fromEntries(CUSTOMS.map((c) => [c.id, c]))
export const customDef = (id: CustomId): CustomDef => BY_ID[id]!

/** 나라 → 결. 없는 나라(지어낸 나라·바깥)는 other */
export const KYEOL_OF: Readonly<Record<string, Kyeol>> = {
  goguryeo: 'goguryeo', biryuna: 'goguryeo', yeonna: 'goguryeo', hwanna: 'goguryeo', gwanna: 'goguryeo',
  buyeo: 'buyeo', maga: 'buyeo', uga: 'buyeo', jeoga: 'buyeo', guga: 'buyeo',
  dongokjeo: 'okjeo', bukokjeo: 'okjeo',
  bullae: 'ye', maek: 'ye', siljik: 'ye', haseulla: 'ye',
  mokji: 'mahan', ungcheon: 'mahan', sangdang: 'mahan', geonma: 'mahan', wansan: 'mahan', gosaburi: 'mahan', balla: 'mahan', mujin: 'mahan', gampyeong: 'mahan', goryong: 'mahan',
  guya: 'byeonhan', daegaya: 'byeonhan', anya: 'byeonhan', goja: 'byeonhan', dokro: 'byeonhan', us: 'byeonhan', samul: 'byeonhan', chopal: 'byeonhan', byeokjin: 'byeonhan', miri: 'byeonhan',
  saro: 'jinhan', dabeol: 'jinhan', sabeol: 'jinhan', jomun: 'jinhan', golbeol: 'jinhan', apdok: 'jinhan', iseo: 'jinhan', usisan: 'jinhan', eumjeup: 'jinhan', bihwa: 'jinhan', gammun: 'jinhan',
  baekje: 'baekje', michuhol: 'baekje',
  tamna: 'juho',
}

/**
 * 땅 한 수 — 사서에 이야기가 없는 나라는 그 나라 땅의 꼬리표에서 한 수를 받는다 (§8-1 셋째 층 · 지어내지 않는다).
 * 데이터 한 줄씩. 그 땅이 정말 그 나라에 있는지는 tests/realm/customs-hooks.test.ts 가 판마다 잰다.
 */
export const LAND_OF: Readonly<Record<string, CustomId>> = {
  daegaya: 'landIron', // 야로 철광
  dokro: 'landPort', // 동래 — 도읍이 포구 · 기장 포구
  miri: 'landReeds', // 삼랑 나루 갈대
  bihwa: 'landReeds', // 낙동강 동쪽 늪가 — 갈대 나루 셋
  anya: 'landHigh', // 언덕 위 도읍 · 남강 산성
  chopal: 'landHigh', // 둘레가 산인 초계 분지
  gammun: 'landHigh', // 서북쪽 고갯마루
  jomun: 'landPasture', // 의성 너른들
  byeokjin: 'landSodo', // 가야산 소도
}

/** 결의 이름과 사서 한 문장(동사로) — 나라 고르기·나라 판 카드 (회의 결정 짓는 차례 1) */
export const KYEOL_INFO: Readonly<Record<Kyeol, { name: string; line: string }>> = {
  goguryeo: { name: '고구려의 결', line: '대가들은 농사짓지 않는다. 하호가 곡식과 소금을 져 온다' },
  buyeo: { name: '부여의 결', line: '겨울이면 옥사를 멈추고 죄수를 푼다 · 싸우기 전에 소 발굽으로 점친다' },
  okjeo: { name: '옥저의 결', line: '소금과 물고기를 천 리나 져 나른다 · 온 집안이 한 곽에 묻힌다' },
  ye: { name: '동예의 결', line: '남의 땅을 밟으면 소와 말로 물어낸다 · 새벽 별로 풍흉을 안다' },
  mahan: { name: '마한의 결', line: '소와 말은 타지 않고 장례에 바친다 · 금보다 구슬을 귀히 여긴다' },
  byeonhan: { name: '변한의 결', line: '쇠가 곧 돈이다 · 길에서 만나면 멈춰 서서 길을 비켜 준다' },
  jinhan: { name: '진한의 결', line: '소와 말을 수레에 메워 부린다 · 열두 나라가 저마다 성책을 둘렀다' },
  baekje: { name: '백제의 결', line: '열 신하와 함께 남으로 내려왔다 · 남쪽 고을에 처음 벼논을 열었다' },
  juho: { name: '주호의 결', line: '큰 섬에 살며 배를 타고 한과 사고판다' },
  other: { name: '', line: '' },
}

export const kyeolOf = (nation: string): Kyeol => KYEOL_OF[nation] ?? 'other'

/** 그 나라의 나라 고리 — 사서에 이야기가 남은 나라만 (규칙이 걸린 것) */
export function nationHooks(nation: string): CustomId[] {
  return CUSTOMS.filter((c) => c.tier === 'nation' && c.live && (c.nations ?? []).includes(nation)).map((c) => c.id)
}

/** 그 나라의 땅 한 수 — 나라 고리가 없을 때만 (고리가 있으면 땅은 고리에 양보한다) */
export function landHook(nation: string): CustomId | null {
  const id = LAND_OF[nation]
  return id !== undefined && nationHooks(nation).length === 0 && customDef(id).live ? id : null
}

/** 제 것 — 결 풍습(규칙이 걸린 것) + 나라 고리, 고리가 없으면 땅 한 수. 데이터만으로 정해지니 나라마다 한 번만 셈한다 (지도가 고을마다 묻는다) */
const NATIVE = new Map<string, readonly CustomId[]>()
export function nativeCustoms(nation: string): CustomId[] {
  return [...nativeOf(nation)]
}
function nativeOf(nation: string): readonly CustomId[] {
  let got = NATIVE.get(nation)
  if (got === undefined) {
    const k = kyeolOf(nation)
    const land = landHook(nation)
    got = [
      ...CUSTOMS.filter((c) => c.tier === 'kyeol' && c.kyeol === k && c.live).map((c) => c.id),
      ...nationHooks(nation),
      ...(land !== null ? [land] : []),
    ]
    NATIVE.set(nation, got)
  }
  return got
}

/** 그 나라의 풍습 — 판에 적힌 것이 없으면 제 것 (옛 판도 그대로) */
export function customsOf(r: Realm, faction: string): readonly CustomId[] {
  return r.factions[faction]?.customs ?? nativeOf(faction)
}

/** 셈은 이것 하나로만 묻는다 — 풍습을 통째로 끄면(customsOn 0) 늘 거짓 (짝 씨앗 측정) */
export function hasCustom(r: Realm, faction: string | null | undefined, id: CustomId): boolean {
  if (faction == null || P.realm.customsOn < 0.5 || !BY_ID[id]?.live) return false
  return customsOf(r, faction).includes(id)
}

/**
 * 풍습이 걸렸다는 보고 한 줄 — 그 나라에 처음 걸린 것이면 first (화면이 크게 · Realm.customSeen 에 적는다).
 * 계획판(season.planned)에서 불려도 사본에만 적힌다
 */
export function noteCustom(r: Realm, lines: ReportLine[], faction: string, id: CustomId, more: { node?: string; other?: string; with?: string; n?: number; m?: number } = {}): void {
  const seen = (r.customSeen ??= {})
  const had = seen[faction] ?? []
  const first = !had.includes(id)
  if (first) seen[faction] = [...had, id].sort()
  lines.push({ kind: 'custom', faction, id, ...more, ...(first ? { first: true } : {}) })
}

/** 늘 걸려 있는 풍습(쇠가 곱으로 · 무장이 싸다 …)은 처음 한 번만 적는다 — 처음 터지는 순간을 크게 보이려고 */
export function noteOnce(r: Realm, lines: ReportLine[], faction: string, id: CustomId, more: { node?: string; other?: string; with?: string; n?: number; m?: number } = {}): void {
  if ((r.customSeen?.[faction] ?? []).includes(id)) return
  noteCustom(r, lines, faction, id, more)
}

/** 이 풍습을 가진 나라들 — 판에 있는 나라 가운데, id 순서 */
export function holders(r: Realm, id: CustomId): string[] {
  return Object.keys(r.factions).sort().filter((f) => hasCustom(r, f, id))
}
