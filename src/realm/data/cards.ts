/**
 * 사건 카드 — 스토리텔러의 카드 한 장, 선택 둘 (docs/realm/SYSTEMS.md §9 · CONTENT §2 · 슬롯 ⑧).
 *
 * 화면과 글(prose)이 읽는다. 효과는 엔진(events.ts)이 kind 로 건다. 선택지 0 이 기본값 (고르지 않으면 이것).
 * 그림은 이미 받아 둔 사건 삽화 (public/realm/event/). 글은 쉬운 말로 (메모리 realm-plain-words).
 */

export type CardKind = 'drought' | 'bounty' | 'locust' | 'plague' | 'halo' | 'quarrel' | 'waship' | 'pirates' | 'exile' | 'fugitive' | 'whale' | 'fishbridge' | 'gogak' | 'romance'

export interface CardOpt { readonly name: string; readonly does: string }

export interface CardInfo {
  readonly name: string
  /** 카드 머리글 — {a} {b} 는 장수 이름, {n} 은 고을 이름 (화면이 바꿔 넣는다) */
  readonly line: string
  readonly art: string
  /**
   * 자막 — 한 장에 두 줄을 넘지 않게(서른 자 안팎), 탭하면 다음 장 (형 10-27 지인: "스토리 이벤트는 화면에 두 줄 넘어가면 안 돼 · 조금씩 쉽게 펴내 가야 · 성세천하처럼").
   * {a} {b} {n} 은 line 과 같다
   */
  readonly beats: readonly string[]
  /** 고를 때의 물음 — 한 줄 */
  readonly ask: string
  /** 선택지 둘(장수 다툼만 셋 — 침묵) — 이름은 세 마디 안(많아야 대여섯) · does 는 길게 눌러 보는 자세한 뜻 (아는 만큼) */
  readonly opts: readonly [CardOpt, CardOpt, ...CardOpt[]]
  /** 갈래 — 하늘 · 사람 · 바깥 · 소도 */
  readonly kind: 'sky' | 'people' | 'outside' | 'sodo'
  /** 나쁜 일인가 — 난세 단계가 높을수록 잦다 */
  readonly bad: boolean
  /** 보고 줄의 작은 그림 (public/realm/icon) */
  readonly icon: string
}

export const CARDS: Readonly<Record<CardKind, CardInfo>> = {
  // ── 2장 졸본만의 사건 (events.chapterCard) — 『삼국사기』 고구려본기 동명성왕
  fishbridge: {
    name: '엄리대수의 다리', kind: 'sky', bad: false, icon: 'status-good-omen', art: 'event-monsoon-ford',
    // 10살도 알아듣게 · 그림(불어난 강을 서로 붙잡고 건너며 떠내려가던 이를 건져 냄)에 맞춰 (형 10-29: "뭔지 모르겠다 · 그림엔 자라도 없는데")
    // 『삼국사기』의 물고기·자라 다리는 사람들이 수군대는 말로 남긴다
    line: '동부여 군대에 쫓기던 날, 우리는 큰 강 엄리대수에 막혔다. 비에 강물이 불어 배도 다리도 없었다. 주몽이 "나는 하늘의 아들, 강의 신 하백의 손자다!" 하고 외치자 물살이 잦아들었고, 모두 서로 붙잡고 강을 건넜다. 떠내려가던 사람도 건져 냈다. 사람들은 물고기와 자라가 발밑을 받쳐 주었다고 수군댄다.',
    beats: ['동부여 군대에 쫓기던 날, 큰 강 엄리대수에 막혔다.', '주몽이 외쳤다. "나는 하늘의 아들, 강의 신 하백의 손자다!"', '물살이 잦아들자 서로 붙잡고 건넜다. 떠내려가던 사람도 건져 냈다.', '사람들은 물고기와 자라가 발밑을 받쳐 주었다고 수군댄다.'],
    ask: '뒤쫓는 동부여 군대가 강가에 닿았다. 어떻게 할까?',
    opts: [
      { name: '나루를 끊는다', does: '배를 모두 거두어 동부여 군대가 못 건넌다 — 그 군대의 사기가 크게 꺾인다' },
      { name: '하늘이 도왔다고 알린다', does: '모두가 기운이 나서 우리 군대 사기와 장수들의 정이 오른다' },
    ],
  },
  gogak: {
    name: '비류국의 북과 뿔나팔', kind: 'outside', bad: false, icon: 'status-good-omen', art: 'event-yeonggo',
    line: '송양은 나라의 위세를 북과 뿔나팔(고각)로 세운다. 부분노가 "몰래 가져올 수 있다"고 한다. 우리 나라엔 아직 그런 의장이 없다.',
    beats: ['송양은 북과 뿔나팔로 위세를 세운다.', '우리 나라엔 아직 그런 의장이 없다.', '부분노가 나선다. "몰래 가져올 수 있습니다."'],
    ask: '부분노를 보낼까?',
    opts: [
      { name: '몰래 훔쳐 온다', does: '되면 비류국 군대의 기가 꺾인다 · 들키면 송양이 크게 노한다' },
      { name: '예를 갖춘다', does: '비류국의 마음이 조금 오른다' },
    ],
  },
  drought: {
    name: '가뭄', kind: 'sky', bad: true, icon: 'status-drought', art: 'event-sky-drought',
    line: '봄비가 오지 않는다. 논바닥이 갈라진다. 이대로면 가을 수확량이 크게 줄어든다.',
    beats: ['봄비가 오지 않는다.', '논바닥이 쩍쩍 갈라진다.', '이대로면 가을걷이가 크게 준다.'],
    ask: '가뭄을 어찌 넘길까?',
    opts: [
      { name: '소도에 빈다', does: '곡식을 조금 바친다 · 가을 수확량이 조금 줄어든다' },
      { name: '보를 쌓는다', does: '곡식이 많이 든다 · 가을 수확량이 거의 그대로다' },
    ],
  },
  bounty: {
    name: '풍년 조짐', kind: 'sky', bad: false, icon: 'status-feast', art: 'event-festival',
    line: '벼 이삭이 고개를 숙인다. 올해는 풍년이 들겠다.',
    beats: ['벼 이삭이 고개를 숙인다.', '올해는 풍년이 들겠다.'],
    ask: '풍년을 어찌 쓸까?',
    opts: [
      { name: '창고에 쌓는다', does: '가을 수확량이 크게 늘어난다' },
      { name: '크게 잔치한다', does: '곡식을 조금 쓴다 · 군대 사기와 장수의 정이 오른다' },
    ],
  },
  locust: {
    name: '메뚜기 떼', kind: 'sky', bad: true, icon: 'status-famine', art: 'event-sky-drought',
    line: '하늘이 누렇게 메뚜기 떼가 몰려온다.',
    beats: ['하늘이 누렇게 물든다.', '메뚜기 떼가 몰려온다!'],
    ask: '메뚜기를 어찌 막을까?',
    opts: [
      { name: '불을 지른다', does: '밭을 조금 태운다 · 가을 수확량이 조금 줄어든다 (틀림없이)' },
      { name: '산천에 빈다', does: '곡식을 조금 바친다 · 흔히 메뚜기가 사라져 그대로, 안 되면 가을걷이가 반으로 (파사왕의 옛일)' },
    ],
  },
  plague: {
    name: '돌림병', kind: 'people', bad: true, icon: 'status-plague', art: 'event-plague',
    line: '{n}에 돌림병이 돈다. 앓는 집이 늘어 간다.',
    beats: ['{n}에 돌림병이 돈다.', '앓는 집이 날마다 는다.'],
    ask: '고을 문을 닫을까?',
    opts: [
      { name: '문을 닫는다', does: '{n}의 집이 조금 줄어든다 · 곡식이 조금 든다 · 번지지 않는다' },
      { name: '내버려 둔다', does: '그냥 지나가기도 하고, 큰 고을 둘의 집이 크게 줄기도 한다' },
    ],
  },
  halo: {
    name: '해무리', kind: 'sky', bad: false, icon: 'status-good-omen', art: 'event-divination',
    line: '해 둘레에 둥근 무리가 섰다. 사람들이 수군댄다.',
    beats: ['해 둘레에 둥근 무리가 섰다.', '사람들이 하늘을 보며 수군댄다.'],
    ask: '징조를 어찌 풀까?',
    opts: [
      { name: '길조라 외친다', does: '우리 군대의 사기가 오른다' },
      { name: '근신한다', does: '고을마다 경계를 높인다' },
    ],
  },
  // 글·그림은 까닭마다 따로 (QUARREL_WHY · cardInfo) — 여기는 옛 저장과 보고 줄이 읽는 기본(덩이쇠 몫)
  quarrel: {
    name: '장수끼리 다툼', kind: 'people', bad: true, icon: 'status-morale-down', art: 'event-quarrel-spoils',
    line: '싸움에서 거둔 덩이쇠 몫을 두고 {a} · {b} 두 장수가 다툰다.',
    beats: ['싸움에서 거둔 덩이쇠 몫을 두고 {a} · {b} 두 장수가 다툰다.'],
    ask: '누구 편을 들까?',
    opts: [
      { name: '{a} 편', does: '{a} 쪽 정이 오르고 {b} 쪽 정이 떨어진다' },
      { name: '{b} 편', does: '{b} 쪽 정이 오르고 {a} 쪽 정이 떨어진다' },
      { name: '침묵한다', does: '둘이 스스로 풀기를 기다린다 — 풀리면 아무 일 없고, 앙금이 남으면 둘 다 군장이 외면했다고 서운해한다' },
    ],
  },
  waship: {
    name: '왜의 배', kind: 'outside', bad: false, icon: 'treasure-iron-ingots', art: 'event-iron-trade',
    line: '{n} 포구에 바다 건너 왜의 배가 들어왔다. 쇠를 찾는다.',
    beats: ['{n} 포구에 왜의 배가 들어왔다.', '바다 건너 사람들이 쇠를 찾는다.'],
    ask: '쇠를 어찌할까?',
    opts: [
      { name: '쇠를 판다', does: '쇠를 내주고 곡식을 넉넉히 받는다' },
      { name: '쇠를 산다', does: '곡식을 내주고 쇠를 받는다' },
    ],
  },
  pirates: {
    name: '바다 도적', kind: 'outside', bad: true, icon: 'status-bad-omen', art: 'event-night-raid',
    line: '바다 도적 떼가 {n} 포구를 노린다.',
    beats: ['바다 도적 떼가 나타났다.', '{n} 포구를 노린다!'],
    ask: '도적을 어찌할까?',
    opts: [
      { name: '몸값을 준다', does: '곡식이 든다 · 아무도 다치지 않는다' },
      { name: '맞선다', does: '이기면 도적의 쇠를 빼앗고, 지면 집과 곡식을 잃는다' },
    ],
  },
  // 누가 오는지는 카드를 뽑을 때 정한다(Card.guest) — 받기 전에 얼굴·재주를 보고 고른다 · 자막은 화면(card-lines.exileBeats)이 그 사람에 맞춰
  exile: {
    name: '쫓겨 온 사람', kind: 'outside', bad: false, icon: 'unit-general', art: 'event-wanderer-arrives',
    line: '이웃 나라에서 쫓겨난 이가 우리를 찾아왔다.',
    beats: ['이웃 나라에서 쫓겨난 이가 왔다.', '우리 앞에 머리를 숙인다.'],
    ask: '받아 줄까?',
    opts: [
      { name: '받아들인다', does: '곡식을 조금 쓴다 · 새 장수가 된다' },
      { name: '돌려보낸다', does: '아무 일도 없다' },
    ],
  },
  // 어느 나라가 내놓으라 하나는 뽑을 때 정한다(Card.from) — 효과가 그 나라에 걸린다 · 없으면(옛 저장·아는 나라 없음) 옛 글
  fugitive: {
    name: '소도의 도망자', kind: 'sodo', bad: false, icon: 'status-good-omen', art: 'event-sodo-fugitive',
    line: '죄를 지은 이가 소도로 달아났다. 소도에 들어간 사람은 잡지 않는 것이 법이다.',
    beats: ['죄지은 이가 소도로 달아났다.', '소도에 든 이는 잡지 않는 법이다.'],
    ask: '소도의 법을 지킬까?',
    opts: [
      { name: '내버려 둔다', does: '이웃 나라들이 우리를 조금 좋게 본다 · 장수들 마음이 놓인다' },
      { name: '끌어낸다', does: '몸값 곡식이 들어온다 · 이웃 나라들이 우리를 나쁘게 본다' },
    ],
  },
  // 혼인 안 한 우리 남녀 장수 둘 (핏줄·부부 아님 · heroes.canWed) — 자막은 화면(card-lines.romanceBeats)이 둘의 결에 맞춰
  romance: {
    name: '연정 소문', kind: 'people', bad: false, icon: 'mood-warm', art: 'event-romance',
    line: '{a} · {b} 두 장수 사이에 연정이 싹텄다는 소문이 돈다.',
    beats: ['{a} · {b} 두 장수 사이에 연정이 싹텄다는 소문이 돈다.'],
    ask: '{a} · {b} 두 장수 사이에 연정이 싹텄다는 소문이 돈다. 두 사람을 어찌할까?',
    opts: [
      { name: '짝지어 준다', does: '혼례 곡식이 든다 · 둘이 혼인한다 (몇 해 뒤 자식 장수)' },
      { name: '모른 척한다', does: '둘에게 맡긴다 — 마음이 깊어지면 둘 다 정이 조금 오른다' },
      { name: '떼어 놓는다', does: '군기는 선다 · 둘 다 정이 떨어진다' },
    ],
  },
  whale: {
    name: '떠밀려 온 고래', kind: 'outside', bad: false, icon: 'emblem-sailboat', art: 'event-whale-hunt',
    line: '{n} 바닷가에 큰 고래가 떠밀려 왔다.',
    beats: ['{n} 바닷가에 큰 고래가 떠밀려 왔다.', '온 고을 사람이 몰려든다.'],
    ask: '고래를 어찌할까?',
    opts: [
      { name: '내다 판다', does: '곡식이 들어온다' },
      { name: '나눠 먹는다', does: '군대 사기와 장수의 정이 오른다' },
    ],
  },
}

export const CARD_KINDS = Object.keys(CARDS) as CardKind[]

/**
 * 장수 다툼의 까닭 — 아무 까닭 없이 「누구 편?」만 물으니 이상했다 (형 10-29: "아무맥락없이 편드는건 이상하잖아").
 * 셋 다 고르기는 {a} 편 · {b} 편 · 침묵 (효과는 events.cardPreview). 이름 뒤에는 조사를 붙이지 않는다 (josa 규칙).
 */
export type QuarrelWhy = 'spoils' | 'town' | 'feast'
export const QUARREL_WHYS: readonly QuarrelWhy[] = ['spoils', 'town', 'feast']

const QUARREL_WHY: Readonly<Record<QuarrelWhy, Pick<CardInfo, 'line' | 'art' | 'beats' | 'ask' | 'opts'>>> = {
  // 덩이쇠 몫 — 누가 먼저 목책을 넘었나
  spoils: {
    art: 'event-quarrel-spoils',
    line: '싸움에서 거둔 덩이쇠 몫을 두고 {a} · {b} 두 장수가 다툰다.',
    beats: ['싸움에서 거둔 덩이쇠가 마당에 쌓였다.', '"목책을 먼저 넘은 건 나다!" — 장수 {a}', '"길을 열어 준 건 내 군사다!" — 장수 {b}', '둘 다 칼자루에 손이 간다. 모두가 군장만 본다.'],
    ask: '{a} · {b} 두 장수가 덩이쇠 몫을 두고 다툰다. 누구에게 더 줄까?',
    opts: [
      { name: '{a} 몫으로', does: '{a} 쪽 정이 오르고 {b} 쪽 정이 떨어진다' },
      { name: '{b} 몫으로', does: '{b} 쪽 정이 오르고 {a} 쪽 정이 떨어진다' },
      { name: '침묵한다', does: '둘이 스스로 나누기를 기다린다 — 풀리면 아무 일 없고, 앙금이 남으면 둘 다 군장이 외면했다고 서운해한다' },
    ],
  },
  // 고을 맡기 — 새로 얻은 고을의 우두머리 자리
  town: {
    art: 'event-quarrel-town',
    line: '{n}, 그 고을을 누가 맡을지를 두고 {a} · {b} 두 장수가 다툰다.',
    beats: ['{n}, 그 고을을 맡을 사람을 아직 정하지 않았다.', '"그 고을 길은 내가 훤히 안다." — 장수 {a}', '"고을 사람들이 따르는 건 나다." — 장수 {b}', '둘 다 물러설 생각이 없다.'],
    ask: '{a} · {b} 두 장수가 서로 맡겠다고 다투는 곳 — {n}. 누구 손에 맡길까?',
    opts: [
      { name: '{a} 손에', does: '{a} 쪽 정이 오르고 {b} 쪽 정이 떨어진다' },
      { name: '{b} 손에', does: '{b} 쪽 정이 오르고 {a} 쪽 정이 떨어진다' },
      { name: '침묵한다', does: '둘이 스스로 정하기를 기다린다 — 풀리면 아무 일 없고, 앙금이 남으면 둘 다 군장이 외면했다고 서운해한다' },
    ],
  },
  // 술자리 시비 — 말 한마디가 화근
  feast: {
    art: 'event-quarrel-feast',
    line: '잔치 술자리에서 {a} · {b} 두 장수가 말다툼 끝에 맞붙으려 한다.',
    beats: ['잔치 술자리가 무르익은 밤.', '"그 활은 말로만 쏘는가?" — 장수 {b}', '술잔이 엎어졌다. 장수 {a}, 벌떡 일어선다.', '모두가 숨을 죽이고 군장만 본다.'],
    ask: '잔치 자리에서 {a} · {b} 두 장수가 맞붙으려 한다. 누구 편을 들까?',
    opts: [
      { name: '{a} 편', does: '{a} 쪽 정이 오르고 {b} 쪽 정이 떨어진다' },
      { name: '{b} 편', does: '{b} 쪽 정이 오르고 {a} 쪽 정이 떨어진다' },
      { name: '침묵한다', does: '술이 깨면 스스로 풀기를 기다린다 — 풀리면 아무 일 없고, 앙금이 남으면 둘 다 군장이 외면했다고 서운해한다' },
    ],
  },
}

/** 소도의 도망자 — 내놓으라는 나라가 있을 때 ({f} 는 그 나라 이름) */
const FUGITIVE_FROM: Pick<CardInfo, 'line' | 'ask' | 'opts'> = {
  line: '{f} 땅에서 죄를 짓고 달아난 자가 소도로 숨어들었다. {f} 사신이 그자를 내놓으라 한다.',
  ask: '소도의 법을 지킬까?',
  opts: [
    { name: '법을 지킨다', does: '{f} 호감이 떨어진다 · 우리 장수들 마음이 놓인다' },
    { name: '넘겨준다', does: '{f} 호감이 오르고 사례 곡식이 들어온다 · 다른 이웃 나라들은 우리가 법을 깼다고 나쁘게 본다' },
  ],
}

/** 이 카드의 글·그림 — 장수 다툼은 까닭(why)에 따라 (없으면 덩이쇠 몫) · 소도의 도망자는 내놓으라는 나라가 있으면 */
export function cardInfo(c: { readonly kind: CardKind; readonly why?: QuarrelWhy; readonly from?: string }): CardInfo {
  if (c.kind === 'quarrel') return { ...CARDS.quarrel, ...QUARREL_WHY[c.why ?? 'spoils'] }
  if (c.kind === 'fugitive' && c.from !== undefined) return { ...CARDS.fugitive, ...FUGITIVE_FROM }
  return CARDS[c.kind]
}

/** 고르지 않으면 걸리는 답 — 장수 다툼은 침묵 · 망명자는 돌려보낸다 · 연정 소문은 모른 척 · 나머지는 첫째 */
export const cardFallback = (kind: CardKind): 0 | 1 | 2 => (kind === 'quarrel' ? 2 : kind === 'exile' || kind === 'romance' ? 1 : 0)
