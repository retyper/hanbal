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
])

/**
 * 각성 초상의 숨 쉬는 고리 영상 (public/realm/awaken-loop/<그림 id>.mp4 · 720×1280 세로 · 10초) — 형 11-05: "live2d 처럼 영웅 이미지도 idle 모션".
 * 제미나이(Veo) 그림→영상으로 굽는다: 카메라 고정 · 숨쉬기 · 머리칼·소매 살랑 · 눈 한 번 깜빡 · 처음과 끝이 맞게. 큰 칸(영웅전 각성 보기)에서만 돈다
 */
/**
 * 숨 쉬는 영상을 정사각 판으로 만든 초상 — 그림을 9:16 가운데에 통째로 두고 위아래를 흐리게 채워 넣었다(tools/veo/pad.sh).
 * 파일은 `<id>.sq.mp4` · 화면은 가운데 정사각만 오려 원본 전체가 움직인다 (형 11-05: "넣은 이미지 전체가 안 나오고 세로로 길게 나와 아쉽다")
 */
export const AWAKEN_LOOP_SQ: ReadonlySet<string> = new Set<string>(['w-35-jomun-odi', 'w-95-michuhol-haebi'])
/** 숨 쉬는 영상 파일 — public/realm 아래 */
export const loopFile = (id: string): string => `awaken-loop/${id}${AWAKEN_LOOP_SQ.has(id) ? '.sq' : ''}.mp4`

export const AWAKEN_LOOP: ReadonlySet<string> = new Set([
  'g-13-baekje-general', // 11-05 오간 — 옛 튜토리얼 각성 장수 (11-05 저녁부터 튜토리얼 각성은 말갈기 · 그 영상은 다음 Veo 첫 차례)
  'l-L2-soseono', // 11-05 1장 소서노 · v2: 숨 따라 가슴·옷이 오르내린다 (형: "개쩐다")
  'w-95-michuhol-haebi', // 11-05 해비 — 튜토리얼 · 정사각 판으로 다시 · 굿판 뒤 숨 고르기로 한 단계 더 세게 (형: "해비 더 세게")
  'w-30-guya-soebi', // 11-05 쇠비 — 형의 최애 · 숨을 더 세게(가슴이 또렷이 출렁)
  'w-33-gammun-gamsil', // 11-05 감실 — 형의 최애 · 출렁임을 걸면 제미나이가 거절해(그림이 드러나서) 잔잔한 숨으로
  'w-35-jomun-odi', // 11-05 오디 — 형의 최애 · 정사각 판(그림 전체가 움직인다) · 웃으며 숨 · 누에고치가 손 위에서 돈다
  'w-77-sabeol-malgalgi', // 11-05 밤 말갈기 — 튜토리얼 각성 장수 · 판 없이 세로로 가까이 (쇠비처럼 · 형: "세로로 더 가까이가 훨씬 낫다")
])

/**
 * 진각성(2차) 초상의 숨 쉬는 영상 — 정사각 판 `awaken-loop/<그림 id>.t2.sq.mp4` (tools/veo/pad.sh TIER=2).
 * 그 판에서 진각성한 장수는 장수 판의 초상이 이 영상으로 바뀌고, 아직이면 장수 판의 「진각성」 칸에서 미리 본다 (형 11-05: "테스트하면서 진각성 영상을 보고 싶어")
 */
export const AWAKEN2_LOOP: ReadonlySet<string> = new Set([
  'w-97-goguryeo-mir', // 11-05 미르 — 번개 속에 활을 당긴 채 숨
  'l-L7-aryeong', // 11-05 알영 — 볏단과 푸른 용
  'w-67-buyeo-haedal', // 11-06 새벽 해달 다시 — 쏘고 웃고 한 바퀴 돌아 다시 당긴다 (형: 옛 판은 거의 정지 화면)
  'w-52-biryuna-songbi', // 11-05 밤 송비 — 판 없이 세로 · 손 위 단풍이 돈다
  'w-30-guya-soebi', // 11-06 새벽 쇠비 다시 — 망치를 휘두르고 젖혀 웃는다 · 출렁임 낱말은 오류라 숨·무게로
  'w-28-michuhol-bira', // 11-06 새벽 비라 — 수정 덩이를 던져 받고 웃으며 한 바퀴 춤
  'w-20-gaya-smith-daughter', // 11-06 새벽 아름 — 망치를 내리쳐 불꽃 · 웃으며 다시 어깨에
  'w-51-haseulla-dangung', // 11-06 아침 단궁 — 웃지 않고 매섭게 쏘고 다시 당긴다 (성격대로)
])
/** 정사각 판으로 구운 진각성 영상 (11-05 낮의 둘) — 나머지는 판 없이 세로 `<id>.t2.mp4` */
export const AWAKEN2_LOOP_SQ: ReadonlySet<string> = new Set(['w-97-goguryeo-mir', 'l-L7-aryeong'])
export const loopFile2 = (id: string): string => `awaken-loop/${id}.t2${AWAKEN2_LOOP_SQ.has(id) ? '.sq' : ''}.mp4`
