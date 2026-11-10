/**
 * 각성 초상이 구워진 장수 초상 id (public/realm/awaken · awaken-hd · tools/bake-awaken.ps1 이 굽는다).
 * 각성한 장수에 그림이 있으면 얼굴이 이것으로 바뀐다. 새로 구우면 이 줄도 늘린다.
 */
export const AWAKEN_ART: ReadonlySet<string> = new Set([
  'g-01-master-smith',
  'g-02-goguryeo-archer-prince',
  'g-03-sea-trader',
  'g-04-jinhan-giant',
  'g-05-mahan-chieftain',
  'g-06-strategist',
  'g-07-drunk-warrior',
  'g-08-veteran',
  'g-09-farmer-conscript',
  'g-10-buyeo-horse-lord',
  'g-11-gaya-iron-general',
  'g-12-silla-youth',
  'g-13-baekje-general',
  'g-15-shaman-man',
  'g-16-goguryeo-gaema-commander',
  'g-17-saro-isageum',
  'g-18-daegaya-king',
  'g-19-sabeol-veteran',
  'g-20-samul-sea-lord',
  'g-21-baekje-onnuri',
  'g-22-ungcheon-gomnae',
  'g-23-sangdang-soedal',
  'g-24-wansan-onsan',
  'g-25-balla-keunmoe',
  'g-26-gampyeong-gaetbeol',
  'g-27-maek-maekdol',
  'g-28-goguryeo-damul',
  'g-29-yeonna-myeongsol',
  'g-30-gwanna-soemoe',
  'g-31-buyeo-geumha',
  'g-32-uga-sodu',
  'g-71-baekje-onjo', // 11-04 저녁 챗지피티 · 튜토리얼·1장 임금
  'g-73-baekje-eureum', // 11-04 저녁 · 1장 책사
  'g-89-baekje-maryeo', // 11-04 저녁 · 1장 농사꾼 장수
  'g-76-mokji-jinha',
  'l-L1-yuhwa', // 11-04 저녁 · 전설
  'l-L10-pyeonggang', // 11-04 저녁 · 전설
  'l-L4-bari-gongju', // 11-04 저녁 · 전설
  'l-L5-seonyeo', // 11-04 저녁 · 전설
  'l-L6-jeonggyeon-moju', // 11-04 저녁 · 전설
  'l-L8-nangnang-princess', // 11-04 저녁 · 전설
  'l-L9-ungnyeo', // 11-04 저녁 · 전설
  'l-L2-soseono',
  'l-L7-aryeong',
  'w-01-silla-princess',
  'w-02-goguryeo-lady',
  'w-03-goguryeo-archer',
  'w-04-gaya-swordswoman',
  'w-05-baekje-queen',
  'w-06-buyeo-huntress',
  'w-08-mahan-warrior',
  'w-09-byeonhan-smith',
  'w-10-pirate-captain',
  'w-11-assassin',
  'w-12-court-dancer',
  'w-13-young-archer',
  'w-14-feast-spy',
  'w-17-mahan-pearl-diver',
  'w-18-jinhan-salt-widow',
  'w-19-buyeo-fur-princess',
  'w-20-gaya-smith-daughter',
  'w-21-baekje-court-dancer',
  'w-22-dongye-tiger-huntress',
  'w-23-usisan-whale-queen',
  'w-24-apdok-queen',
  'w-25-bihwa-priestess',
  'w-26-iseo-tomboy-general',
  'w-27-mokji-jinha',
  'w-28-michuhol-bira',
  'w-29-golpo-janmul',
  'w-30-guya-soebi',
  'w-31-dabeol-dalbit',
  'w-32-golbeol-budeul',
  'w-33-gammun-gamsil',
  'w-34-chopal-deulme',
  'w-35-jomun-odi',
  'w-36-baekje-maena',
  'w-37-michuhol-gaennae',
  'w-38-sangdang-bulmae',
  'w-39-gosaburi-galmae',
  'w-40-mujin-munui',
  'w-41-hwanna-beodeul',
  'w-42-gwanna-soenun',
  'w-43-uga-nuri',
  'w-44-okjeo-sogeumbi',
  'w-45-tamna-oreumbi',
  'w-46-geonma-maru',
  'w-47-gosaburi-baram',
  'w-48-mujin-mudeung',
  'w-49-goryong-gureum',
  'w-50-siljik-mulga',
  'w-51-haseulla-dangung',
  'w-52-biryuna-songbi',
  'w-53-hwanna-gabi',
  'w-54-maga-dalli',
  'w-55-guga-nuri',
  'w-56-dongokjeo-sogeum',
  'w-57-bullae-bakdal',
  'w-58-tamna-halla',
  'w-59-jomun-irang',
  'w-60-golbeol-beom',
  'w-61-iseo-sinae',
  'w-62-byeokjin-byeol',
  'w-63-us-haesol',
  'w-64-miri-dallae',
  'w-65-goguryeo-hwalmi',
  'w-66-saro-noeul',
  // 11-02 형이 받은 쉰하나 (남 g33~g58 · 여 w67~w96 · 챗지피티 · 검토 반려 0)
  'g-33-jeoga-metdol',
  'g-34-bukokjeo-duman',
  'g-35-dabeol-dalgu',
  'g-36-gammun-gamdol',
  'g-37-eumjeup-jeup',
  'g-38-chopal-palmae',
  'g-40-anya-adan',
  'g-41-goja-bau',
  'g-42-dokro-garam',
  'g-43-hwanna-amnok',
  'g-44-maga-malgup',
  'g-45-dabeol-deulgae',
  'g-46-uga-nureongso',
  'g-47-guga-sanyanggae',
  'g-48-gwanna-musoe',
  'g-49-goguryeo-sona',
  'g-50-bullae-gwaha',
  'g-51-biryuna-mulgyeol',
  'g-52-tamna-oreum',
  'g-53-baekje-haeru',
  'g-54-mokji-mahan',
  'g-55-saro-bakdal',
  'g-56-haseulla-gwahama',
  'g-57-bihwa-neup',
  'g-58-usan-uhae',
  'w-67-buyeo-haedal',
  'w-68-maek-beombal',
  'w-69-jeoga-eomni',
  'w-70-bukokjeo-mulbeom',
  'w-71-yeonna-neoul',
  'w-72-eumjeup-beol',
  'w-73-samul-sagong',
  'w-74-balla-dokmudeom',
  'w-75-daegaya-soemoe',
  'w-76-gampyeong-baetsagong',
  'w-77-sabeol-malgalgi',
  'w-78-wansan-wan',
  'w-79-yangmaek-solmae',
  'w-80-usan-gangchi',
  'w-81-byeokjin-byeolbit',
  'w-82-ungcheon-gom',
  'w-83-gyeonji-beodeul',
  'w-84-salhae-dallae',
  'w-85-sinji-neoul',
  'w-90-saro-danbi',
  'w-91-saro-mulsae',
  'w-92-saro-dallae',
  'w-93-saro-beomi',
  'w-94-mokji-dallae',
  'w-95-michuhol-haebi',
  'w-96-haengin-neoul',
  'w-97-goguryeo-mir',
  'l-L3-heo-hwangok',
  'w-99-garak-yucheongan',
  'w-100-garak-sincheongan',
  'w-101-garak-singwigan',
  'w-98-byeonhan-danbi',
  // 11-04 밤 · 형이 챗지피티로 구움 (docs/realm/awaken-next-men.html)
  'g-64-jumong',
  'g-74-saro-hyeokgeose',
  'g-96-garak-suro',
  'g-95-goguryeo-daemusin',
  'g-94-golpo-maenun',
  'g-92-goguryeo-mari',
  'g-91-biryu-songyang',
  'g-97-tahae',
  'g-98-goguryeo-gwaeyu',
  'g-99-goguryeo-maro',
  'g-100-buyeo-old-daeso',
  'g-67-buyeo-daeso',
  'g-65-goguryeo-damul',
  'g-66-buyeo-geumha',
  'g-68-baekje-onnuri',
  'g-101-garak-adogan',
  'g-102-garak-yeodogan',
  'g-103-garak-pidogan',
  'g-104-garak-odogan',
  'g-105-garak-yusugan',
  'g-106-garak-ocheongan',
  'g-59-yangmaek-maekson',
  'g-60-eupcha-hangyeol',
  'g-61-heomcheuk-bawi',
  'g-62-beonye-hanul',
  'g-63-heomcheuk-beogeum',
  'g-69-guya-soebo',
  'g-75-saro-hogong',
  'g-77-saro-sobeol',
  'g-78-saro-alpyeong',
  'g-79-saro-jibaekho',
  'g-80-saro-guryema',
  'g-81-saro-jita',
  'g-82-saro-hojin',
  'g-83-mokji-keundol',
  'g-84-wander-seoneul',
  'g-85-wander-ure',
  'g-86-mokji-geumbawi',
  'g-87-wae-chief',
  'g-88-wander-soeul',
  'g-90-haengin-gomok',
  'g-93-jomun-solgae',
  'w-102-garak-dana', // 11-08 가락 다나 · 붉은 끈 말총머리·비치는 소매·꿩깃 화살통 · 불티 (챗지피티 retyper)
  'g-107-garak-musoe', // 11-08 가락 무쇠 · 큰 망치·쇠 미늘·그을린 머리띠 · 불티 (챗지피티 retyper)
  'w-103-tahae-neoul', // 11-08 탈해 무리 뱃사람 너울 · 밧줄 타래·조개 상어 이빨 목걸이·비치는 겉감 (챗지피티 retyper)
  'w-104-buyeo-darae', // 11-08 부여 다래 · 흰 여우털 모자·맥궁·비치는 소매 (챗지피티 retyper)
  'g-60-golbeol-golgae', // 11-08 골벌 골개 · 붉은 띠 쇠 미늘·불티 (챗지피티 retyper)
  'g-61-apdok-ap', // 11-08 압독 압 · 털 망토 겹 미늘·붉은 띠·큰 도끼 불티
  'g-62-gammun-gamnamu', // 11-08 감문 감나무 · 주황 머리띠 미늘 갑옷·불티 바람
  'g-63-chopal-yeoul', // 11-08 초팔 여울 · 짚 털 망토 남빛 미늘·창·물결 불티
  'g-64-michuhol-sogeumkkun', // 11-08 미추홀 소금꾼 · 흰 소금 두건 미늘·작살 소금 바람
  'g-65-sangdang-soemangchi', // 11-08 상당 쇠망치 · 겹 미늘·붉은 띠·큰 쇠망치 불티
  'g-66-geonma-malbalgup', // 11-08 건마 말발굽 · 붉은 깃 투구·털 망토 미늘·칼 불티
  'g-67-gosaburi-buri', // 11-08 고사부리 부리 · 깃털 상투 남빛 미늘·맥궁 불티
  'g-68-mujin-bitgoeul', // 11-08 무진 빛고을 · 금 머리띠 구슬 남빛 금장 예복·칼 빛 물결
  'g-69-goryong-yong', // 11-08 고령 용 · 흰 수염 목 문신 겹 미늘·긴 창 번개
  'g-70-siljik-pado', // 11-08 실직 파도 · 털 망토 밧줄 남빛 미늘·작살 물보라
])

/**
 * 각성 초상의 숨 쉬는 고리 영상 (public/realm/awaken-loop/<그림 id>.mp4 · 720×1280 세로 · 10초) — 형 11-05: "live2d 처럼 영웅 이미지도 idle 모션".
 * 제미나이(Veo) 그림→영상으로 굽는다: 카메라 고정 · 숨쉬기 · 머리칼·소매 살랑 · 눈 한 번 깜빡 · 처음과 끝이 맞게. 큰 칸(영웅전 각성 보기)에서만 돈다
 */
/**
 * 숨 쉬는 영상을 정사각 판으로 만든 초상 — 그림을 9:16 가운데에 통째로 두고 위아래를 흐리게 채워 넣었다(tools/veo/pad.sh).
 * 파일은 `<id>.sq.mp4` · 화면은 가운데 정사각만 오려 원본 전체가 움직인다 (형 11-05: "넣은 이미지 전체가 안 나오고 세로로 길게 나와 아쉽다")
 */
export const AWAKEN_LOOP_SQ: ReadonlySet<string> = new Set<string>() // 11-08 형: 정사각으로 억지로 만든 영상은 안 쓴다 (지움)
/** 숨 쉬는 영상 파일 — public/realm 아래 */
/**
 * 숨 쉬는 영상 파일 — 이름 규칙 (형 11-08: "이름 규칙들은 니가 관리 편한대로"):
 *   1차 각성  awaken-loop/<그림 id>.mp4   · 정사각 판 <id>.sq.mp4 · 둘째 판 <id>.2.mp4 · 셋째 <id>.3.mp4 …
 *   2차 각성  awaken2-loop/<그림 id>.mp4  · 같은 규칙 (옛 .t2 꼬리는 걷었다)
 * 판이 여럿이면 번갈아 돈다 — 한 판이 끝나면 다음 판으로 (형 11-08: "견지쇠비 2차랑 소서노 1차 루프들은 두 종류 다 나쁘지 않으니 두 개가 번갈아")
 * 영상은 귀하다 — 다시 구워도 옛 판은 결격이 확실하지 않으면 버리지 않고 판을 하나 더 단다 (형 11-08)
 */
export const loopFile = (id: string): string => `awaken-loop/${id}${AWAKEN_LOOP_SQ.has(id) ? '.sq' : ''}.mp4`
/** 1차 각성 영상의 판 수 (없으면 1) — 번갈아 돈다 */
export const AWAKEN_TAKES: Readonly<Record<string, number>> = { 'l-L2-soseono': 2, 'l-L4-bari-gongju': 2, 'w-95-michuhol-haebi': 2, 'l-L3-heo-hwangok': 2 } // 바리·해비 .2 = 11-09 Veo (형: 둘 다 괜찮으니 둘 다 쓰자) · 허황옥 .2 = 11-10 Flow Omni (형: 만든 김에 둘 다)
/** 1차 각성 영상의 모든 판 — 첫 판이 기본 */
export const loopTakes = (id: string): string[] => [loopFile(id), ...Array.from({ length: Math.max(0, (AWAKEN_TAKES[id] ?? 1) - 1) }, (_, i) => `awaken-loop/${id}.${i + 2}.mp4`)]

export const AWAKEN_LOOP: ReadonlySet<string> = new Set([
  // 11-09 Veo 세로 10초 · 형: ok (벌은 "매우 자연스러움")
  'w-24-apdok-queen', // 압독 누리
  'w-04-gaya-swordswoman', // 아라
  'w-47-gosaburi-baram', // 바람
  'l-L7-aryeong', // 알영
  'w-20-gaya-smith-daughter', // 아름
  'w-80-usan-gangchi', // 강치
  'w-72-eumjeup-beol', // 벌
  'w-05-baekje-queen', // 별하 (11-09 오후 -b 판 · 형: 적용 안 된 듯 → 넣음)
  // 11-09 오후·저녁 Veo · 형: 「영상들은 전부 ok」
  'w-10-pirate-captain', // 너울(바다도적)
  'w-28-michuhol-bira', // 비라
  'w-31-dabeol-dalbit', // 달빛
  'w-68-maek-beombal', // 범발
  'w-81-byeokjin-byeolbit', // 별빛
  'w-84-salhae-dallae', // 살해 달래
  'w-92-saro-dallae', // 명활 달래
  'w-93-saro-beomi', // 범이
  // 11-10 형이 손으로 구움 (Veo · 굽기 꾸러미) · 형: "영상들 다 반영 · 변한 단비 너무 최고"
  'w-18-jinhan-salt-widow', // 다솜
  'w-94-mokji-dallae', // 원산 달래 (다시 구운 판)
  'w-98-byeonhan-danbi', // 변한 단비
  'w-26-iseo-tomboy-general', // 11-10 고개 (Argon) · 형: 합격
  'w-82-ungcheon-gom', // 11-10 곰 v3 (형 손굽기 · 얼굴·그림체 고정 문안) · 형: 지금 것 쓴다
  'w-59-jomun-irang', // 11-10 이랑 1차 (Flow Jay · Omni 1.2 Flash) · 형: 일단 오케이 · 5초쯤 잠깐 멈춤
  'w-08-mahan-warrior', // 11-10 이슬 1차 (Flow Jay · Omni) · 형: 나쁘지 않음
  'w-27-mokji-jinha', // 11-10 신지 진하 1차 (Flow Jay · Omni · 무당 춤) · 형: 나이스
  'w-46-geonma-maru', // 11-10 마루 1차 (Flow Jay) · 형: 나쁘지 않음
  'w-36-baekje-maena', // 11-10 매나 1차 (Flow Jay) · 형: 가슴 움직임 부족하지만 나쁘지 않음
  'w-70-bukokjeo-mulbeom', // 11-10 물범 1차 (Flow Jay) · 형: 나쁘지 않음
  'w-22-dongye-tiger-huntress', // 11-10 물결 1차 (Flow Jay) · 형: 나쁘지 않음
  'w-91-saro-mulsae', // 11-10 물새 1차 (Flow Jay) · 형: 나쁘지 않음
  'l-L8-nangnang-princess', // 11-10 낙랑공주 1차 (Flow Jay · 우는 결) · 형: 일단 오케이
  'w-12-court-dancer', // 11-10 나리 1차 (Flow Jay) · 형: 아주 좋음
  'w-96-haengin-neoul', // 11-10 산지기 너울 1차 (Flow Jay) · 형: 나쁘지 않음
  'w-71-yeonna-neoul', // 11-10 연나 너울 1차 (Flow Jay) · 형: 나쁘지 않음 (가슴 움직임 약함)
  'w-45-tamna-oreumbi', // 11-10 오름비 1차 (Flow Jay · 말 타기) · 형: 너무 좋음 · 자연스러움
  'l-L10-pyeonggang', // 11-10 평강공주 1차 (Flow Jay) · 형: 최고 중 하나 (화살로 가슴골을 쓸어내리며 제자리 뛰기)
  'w-73-samul-sagong', // 11-10 사공 1차 (Flow Jay) · 형: 무난함
  'w-06-buyeo-huntress', // 11-10 새벽 1차 (Flow Jay) · 형: 무난함
  'w-78-wansan-wan', // 11-08 저녁 완 v3 · 10초 구성 · 만작한 채 윙크 (형: 그래도 봐줄 만하다 · 적용)
  'w-69-jeoga-eomni', // 11-07 엄니 · fc094928 사용자 채택, 원본 프레임 경계 한계 기록
  'w-67-buyeo-haedal', // 11-07 해달 · 머리/허리 손 접촉을 유지하는 세로 idle
  'w-42-gwanna-soenun', // 11-07 쇠눈 · 출전 전 투구를 바로잡는 연속 동작
  'w-60-golbeol-beom', // 11-07 범 · 사용자 승인, 전방 손의 화면 경계 잘림 허용
  'w-85-sinji-neoul', // 11-07 신지 너울 · 잠수 뒤 숨 고르기, 손 위치 유지
  'w-01-silla-princess', // 11-07 고은 · 부채 든 손 교정본 · 기존 세로 영상 회수
  'w-19-buyeo-fur-princess', // 11-07 가온 · 수정꽃을 바라보며 호흡
  'w-66-saro-noeul', // 11-08 낮 노을 v2 · 시위를 늦췄다 다시 만작 · 쏘고 다시 거는 동작 (형: 넣어 · 화살은 쏘니 없어지는 게 맞다) · 완 v2 는 눈이 번갈아 감겨 뺐다 (형)
  'l-L3-heo-hwangok', // 11-08 형이 모아 둔 판 (옛 -aw) · 허황옥
  'l-L4-bari-gongju', // 11-08 형이 모아 둔 판 · 바리공주
  'w-03-goguryeo-archer', // 11-08 형이 모아 둔 판 · 고구려 궁수
  'w-57-bullae-bakdal', // 11-08 형이 모아 둔 판 · 박달
  'w-65-goguryeo-hwalmi', // 11-08 형이 모아 둔 판 · 혜미
  'w-37-michuhol-gaennae', // 11-08 낮 갯내 v2 · 무릎을 굽혀 몸을 흔드는 견제 후 단검을 던져 받는다 (형: 첫 판은 부자연스럽고 더 움직였으면)
  'w-62-byeokjin-byeol', // 11-08 별 · 새 집게 자세로 다시 (형: 좋음) · 옛 자세 MP4 는 assets_src/realm/retired/awaken-loop
  'w-32-golbeol-budeul', // 11-08 부들 · 갈대 속 경쟁자를 보고 몸을 기울인다 (형: 괜찮다)
  'w-54-maga-dalli', // 11-08 달리 · 등의 활을 고쳐 메며 웃는다 (형: 좋음)
  'w-74-balla-dokmudeom', // 11-08 독무덤 · 독무덤 항아리에 손을 얹고 고개 숙임 (형: 어울림)
  'w-63-us-haesol', // 11-07 해솔 · 소나무 가지에 축복
  'g-13-baekje-general', // 11-05 오간 — 옛 튜토리얼 각성 장수 (11-05 저녁부터 튜토리얼 각성은 말갈기 · 그 영상은 다음 Veo 첫 차례)
  'l-L2-soseono', // 11-05 1장 소서노 · v2: 숨 따라 가슴·옷이 오르내린다 (형: "개쩐다")
  'w-95-michuhol-haebi', // 11-08 해비 · 세로 판 (형이 모아 둔 판 · 옛 정사각 판은 지움 — 형: 정사각으로 억지로 만든 영상은 안 쓴다)
  'w-30-guya-soebi', // 11-05 쇠비 — 형의 최애 · 숨을 더 세게(가슴이 또렷이 출렁)
  'w-33-gammun-gamsil', // 11-05 감실 — 형의 최애 · 출렁임을 걸면 제미나이가 거절해(그림이 드러나서) 잔잔한 숨으로
  'w-35-jomun-odi', // 11-08 낮 오디 v2 · 세로 근접 · 웃으며 발돋움하고 누에고치를 띄운다 (형: 넣어) · 옛 정사각 판은 assets_src/realm/retired/awaken-loop
  'w-77-sabeol-malgalgi', // 11-05 밤 말갈기 — 튜토리얼 각성 장수 · 판 없이 세로로 가까이 (쇠비처럼 · 형: "세로로 더 가까이가 훨씬 낫다")
])

/**
 * 진각성(2차) 초상의 숨 쉬는 영상 — 정사각 판 `awaken-loop/<그림 id>.t2.sq.mp4` (tools/veo/pad.sh TIER=2).
 * 그 판에서 진각성한 장수는 장수 판의 초상이 이 영상으로 바뀌고, 아직이면 장수 판의 「진각성」 칸에서 미리 본다 (형 11-05: "테스트하면서 진각성 영상을 보고 싶어")
 */
export const AWAKEN2_LOOP: ReadonlySet<string> = new Set([
  'w-97-goguryeo-mir', // 11-09 미르 2차 · Veo 세로 10초 (형: ok)
  'w-04-gaya-swordswoman', // 11-08 형이 모아 둔 판 (옛 -aw2) · 아라
  'w-47-gosaburi-baram', // 11-08 형이 모아 둔 판 · 바람
  'w-55-guga-nuri', // 11-08 형이 모아 둔 판 · 누리
  'w-58-tamna-halla', // 11-08 형이 모아 둔 판 · 한라
  'w-73-samul-sagong', // 11-08 형이 모아 둔 판 · 사공
  'w-82-ungcheon-gom', // 11-08 형이 모아 둔 판 · 곰
  'w-95-michuhol-haebi', // 11-08 형이 모아 둔 판 · 해비
  'w-67-buyeo-haedal', // 11-06 새벽 해달 다시 — 쏘고 웃고 한 바퀴 돌아 다시 당긴다 (형: 옛 판은 거의 정지 화면)
  'w-52-biryuna-songbi', // 11-05 밤 송비 — 판 없이 세로 · 손 위 단풍이 돈다
  'w-30-guya-soebi', // 11-06 새벽 쇠비 다시 — 망치를 휘두르고 젖혀 웃는다 · 출렁임 낱말은 오류라 숨·무게로
  'w-28-michuhol-bira', // 11-08 저녁 비라 v2 (10초 구성 · 옛 판은 끝에서 얼어 .2 로 보관만) · 11-06 새벽 비라 — 수정 덩이를 던져 받고 웃으며 한 바퀴 춤
  'w-20-gaya-smith-daughter', // 11-06 새벽 아름 — 망치를 내리쳐 불꽃 · 웃으며 다시 어깨에
  'w-51-haseulla-dangung', // 11-06 아침 단궁 — 웃지 않고 매섭게 쏘고 다시 당긴다 (성격대로)
  'w-59-jomun-irang', // 11-08 저녁 이랑 v2 (10초 구성 · 옛 판은 끝에서 얼어 .2 로 보관만) · 11-06 아침 이랑 — 무표정으로 단검을 돌려 쥐고 몸을 틀어 베고 다시 막는다
  'w-69-jeoga-eomni', // 11-06 아침 엄니 — 입 다문 채 창을 땅에 꽂고 입김 · 다시 겨눔 (중간에 화면이 전신으로 물러났다 돌아온다)
  'w-68-maek-beombal', // 11-08 저녁 범발 v2 (10초 구성 · 옛 판은 끝에서 얼어 .2 로 보관만) · 11-06 아침 범발 — 비스듬히 웃으며 단검을 돌려 쥐고 다시 웅크림
  'l-L7-aryeong', // 11-08 저녁 알영 2차 v2 · 세로 · 벼 이삭을 들어 올리고 용을 쓰다듬는다 (옛 정사각 판은 지움)
])
/** 정사각 판으로 구운 진각성 영상 (11-05 낮의 둘) — 나머지는 판 없이 세로 `<id>.t2.mp4` */
export const AWAKEN2_LOOP_SQ: ReadonlySet<string> = new Set<string>() // 11-08 형: 정사각 영상은 안 쓴다 (알영 2차는 11-08 저녁 세로 v2 · 미르 2차는 다시 굽기 차례)
export const loopFile2 = (id: string): string => `awaken2-loop/${id}${AWAKEN2_LOOP_SQ.has(id) ? '.sq' : ''}.mp4`
/** 2차 각성 영상의 판 수 (없으면 1) — 번갈아 돈다 */
export const AWAKEN2_TAKES: Readonly<Record<string, number>> = { 'w-30-guya-soebi': 2 }
/** 2차 각성 영상의 모든 판 — 첫 판이 기본 */
export const loopTakes2 = (id: string): string[] => [loopFile2(id), ...Array.from({ length: Math.max(0, (AWAKEN2_TAKES[id] ?? 1) - 1) }, (_, i) => `awaken2-loop/${id}.${i + 2}.mp4`)]
