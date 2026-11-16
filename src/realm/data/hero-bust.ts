// 장수 id → 초상(명치판) 표 — 의존성 없는 모듈 (art.ts 가 다시 내보낸다 · trial-rules 같은 시뮬 쪽이 art.ts 를 끌어와 모듈이 돌지 않게 · 11-15)
/** 장수 id → 명치판 (bust/<이름>.jpg). g- 남자 장수 · w- 여인 · l- 전설 */
export const HERO_BUST: Readonly<Record<string, string>> = {
  chief: 'g-94-golpo-maenun', // 살해 매눈 — 골포국의 활 쏘는 장군 · 주몽(g-64)과 판박이던 g-02 를 걷음 (형 11-03)
  'guya-1': 'g-11-gaya-iron-general', // 진지렴 거타 — 가락국의 철
  'guya-2': 'g-04-jinhan-giant', // 험측 마루
  'anya-1': 'w-04-gaya-swordswoman', // 신지 아라 — 아라국의 여 신지
  'anya-2': 'w-13-young-archer', // 번예 솔미
  'miri-1': 'g-07-drunk-warrior', // 읍차 갈미 — PLAY §4 의 술꾼
  'goja-1': 'g-03-sea-trader', // 살해 바다쇠
  'dokro-1': 'w-10-pirate-captain', // 읍차 너울 — 왜와 경계를 맞댄 포구
  // 군주 — 장군과 따로 (형: "군주는 따로 있어야 하고 장군이랑 별개여야")
  'us-ruler': 'w-63-us-haesol', // 읍차 해솔 — 매혹
  'guya-ruler': 'g-69-guya-soebo', // 진지렴 쇠보 — 쇠의 나라의 대장장이 군주
  'anya-ruler': 'g-40-anya-adan', // 신지 아단 — 신중
  'miri-ruler': 'w-64-miri-dallae', // 신지 달래 — 곡창의 여가장
  'goja-ruler': 'g-41-goja-bau', // 험측 바우 — 물길·장사
  'dokro-ruler': 'g-42-dokro-garam', // 읍차 가람
  // 둘째 장군들
  'us-1': 'g-09-farmer-conscript',
  'miri-2': 'w-02-goguryeo-lady',
  'goja-2': 'w-17-mahan-pearl-diver',
  'dokro-2': 'g-08-veteran',
  // 떠돌이 인재 스물 (data/heroes-pool.ts) — 여인 열다섯
  'wander-01': 'w-18-jinhan-salt-widow', 'wander-02': 'w-03-goguryeo-archer', 'wander-03': 'w-12-court-dancer',
  'wander-04': 'w-11-assassin', 'wander-05': 'w-83-gyeonji-beodeul', 'wander-06': 'w-06-buyeo-huntress',
  'wander-07': 'w-19-buyeo-fur-princess', 'wander-08': 'w-22-dongye-tiger-huntress', 'wander-09': 'w-05-baekje-queen',
  'wander-10': 'w-21-baekje-court-dancer', 'wander-11': 'g-61-heomcheuk-bawi', 'wander-12': 'g-88-wander-soeul',
  'wander-13': 'w-14-feast-spy', 'wander-14': 'g-60-eupcha-hangyeol', 'wander-15': 'w-98-byeonhan-danbi',
  'wander-16': 'w-20-gaya-smith-daughter', 'wander-17': 'g-12-silla-youth', 'wander-18': 'w-01-silla-princess',
  'wander-19': 'g-15-shaman-man', 'wander-20': 'w-08-mahan-warrior',
  'wander-21': 'w-84-salhae-dallae', 'wander-22': 'w-85-sinji-neoul', 'wander-23': 'g-62-beonye-hanul', 'wander-24': 'g-63-heomcheuk-beogeum', 'wander-25': 'g-84-wander-seoneul', 'wander-26': 'g-85-wander-ure',
  // 영남 판 (data/regions/yeongnam.ts) — 변한 판과 같은 나라는 같은 얼굴. 새 군주 열다섯은 있는 명치판을 나눠 쓴다 (여인이 많다)
  // 영남 판을 위해 새로 받은 여덟 (2026-10-18): 사로 이사금 · 대가야 왕 · 사벌 노장 · 사물 바다 군장 · 우시산 고래잡이 여군장 · 압독 여왕 · 비화가야 무녀 군주 · 이서 여장수
  'saro-ruler': 'g-17-saro-isageum', 'daegaya-ruler': 'g-18-daegaya-king', 'dabeol-ruler': 'g-35-dabeol-dalgu',
  'sabeol-ruler': 'g-19-sabeol-veteran', 'usisan-ruler': 'w-23-usisan-whale-queen', 'bihwa-ruler': 'w-25-bihwa-priestess',
  'jomun-ruler': 'w-59-jomun-irang', 'golbeol-ruler': 'w-60-golbeol-beom', 'apdok-ruler': 'w-24-apdok-queen',
  'iseo-ruler': 'w-61-iseo-sinae', 'byeokjin-ruler': 'w-62-byeokjin-byeol', 'gammun-ruler': 'g-36-gammun-gamdol',
  'samul-ruler': 'g-20-samul-sea-lord', 'eumjeup-ruler': 'g-37-eumjeup-jeup', 'chopal-ruler': 'g-38-chopal-palmae',
  'saro-1': 'g-55-saro-bakdal', 'saro-2': 'w-66-saro-noeul', 'daegaya-1': 'w-75-daegaya-soemoe', 'sabeol-1': 'w-77-sabeol-malgalgi',
  'dabeol-1': 'g-45-dabeol-deulgae', 'usisan-1': 'g-01-master-smith', 'jomun-1': 'g-93-jomun-solgae', 'iseo-1': 'w-26-iseo-tomboy-general',
  'samul-1': 'w-73-samul-sagong', 'bihwa-1': 'g-57-bihwa-neup', 'eumjeup-1': 'w-72-eumjeup-beol',
  // 삼한 남부 판의 새 군주·장군 (data/regions/south.ts) — 있는 명치판을 나눠 쓴다. 새 얼굴은 그림 줄(인물 — 챗지피티)
  // 배우는 판 — 온조 형제와 신하 (tutorial.ts)
  // 캠페인 2장 — 주몽과 세 벗 · 송양 · 대소 (jumong.ts)
  // 주몽 — 챗지피티로 받은 고구려 군주 얼굴을 다시 쓴다 (형 10-23: "전에 것이 챗지피티로 만들어 더 멋있었는데 · 지금 것은 제미나이라 별로 — 나중에 만들어"). 새 얼굴은 ART-QUEUE
  'jm-jumong': 'g-64-jumong', 'jm-oi': 'g-16-goguryeo-gaema-commander', 'jm-mari': 'g-92-goguryeo-mari', 'jm-hyeopbo': 'g-06-strategist',
  'jm-songyang': 'g-91-biryu-songyang', 'jm-songbi': 'w-52-biryuna-songbi', 'jm-daeso': 'g-67-buyeo-daeso', 'jm-haedal': 'w-67-buyeo-haedal',
  'jm-haengin-ruler': 'g-90-haengin-gomok', 'jm-haengin-1': 'w-96-haengin-neoul', 'jm-okjeo-ruler': 'g-34-bukokjeo-duman', 'jm-okjeo-1': 'w-70-bukokjeo-mulbeom',
  // 캠페인 1장 — 온조와 신하들 · 마한의 진왕과 장수 (mahan.ts). 있는 명치판을 나눠 쓴다
  'mh-onjo': 'g-71-baekje-onjo', 'mh-eureum': 'g-73-baekje-eureum', 'mh-ogan': 'g-13-baekje-general', 'mh-soseono': 'l-L2-soseono',
  'mh-jinwang': 'g-76-mokji-jinha', 'mh-mahan-1': 'g-83-mokji-keundol', 'mh-mahan-2': 'w-94-mokji-dallae', 'mh-mahan-3': 'g-86-mokji-geumbawi',
  // 캠페인 3장 — 혁거세·알영·호공 · 여섯 촌장 · 왜인 (seorabeol.ts). 알영은 전설 명치판
  'sr-hyeokgeose': 'g-74-saro-hyeokgeose', 'sr-aryeong': 'l-L7-aryeong', 'sr-hogong': 'g-75-saro-hogong', 'sr-danbi': 'w-90-saro-danbi',
  'sr-alpyeong': 'g-78-saro-alpyeong', 'sr-sobeol': 'g-77-saro-sobeol', 'sr-jibaekho': 'g-79-saro-jibaekho', 'sr-guryema': 'g-80-saro-guryema',
  'sr-jita': 'g-81-saro-jita', 'sr-hojin': 'g-82-saro-hojin', 'sr-yangsan-1': 'w-91-saro-mulsae', 'sr-goya-1': 'w-92-saro-dallae',
  'sr-jinji-1': 'w-93-saro-beomi', 'sr-wae-ruler': 'g-87-wae-chief',
  // 캠페인 4장 — 수로 · 허황옥(전설 명치판) · 가락의 장수 · 아홉 간 · 탈해 (gujibong.ts). 있는 명치판을 나눠 쓴다 · 새 얼굴은 ART-QUEUE 「4·5장 초상」
  'gj-suro': 'g-96-garak-suro', 'gj-heo': 'l-L3-heo-hwangok', 'gj-musoe': 'g-107-garak-musoe', 'gj-dana': 'w-102-garak-dana',
  'gj-adogan': 'g-101-garak-adogan', 'gj-yeodogan': 'g-102-garak-yeodogan', 'gj-pidogan': 'g-103-garak-pidogan', 'gj-odogan': 'g-104-garak-odogan',
  'gj-yusugan': 'g-105-garak-yusugan', 'gj-yucheongan': 'w-99-garak-yucheongan', 'gj-sincheongan': 'w-100-garak-sincheongan', 'gj-ocheongan': 'g-106-garak-ocheongan',
  'gj-singwigan': 'w-101-garak-singwigan', 'gj-tahae': 'g-97-tahae', 'gj-tahae-1': 'w-103-tahae-neoul',
  // 캠페인 5장 — 대무신왕 · 괴유 · 마로 · 미르 / 대소(2장과 같은 얼굴) · 부여 장수 (daemusin.ts). 있는 명치판을 나눠 쓴다
  'dm-daemusin': 'g-95-goguryeo-daemusin', 'dm-gwaeyu': 'g-98-goguryeo-gwaeyu', 'dm-maro': 'g-99-goguryeo-maro', 'dm-mir': 'w-97-goguryeo-mir',
  'dm-daeso': 'g-100-buyeo-old-daeso', 'dm-buyeo-1': 'g-10-buyeo-horse-lord', 'dm-buyeo-2': 'w-104-buyeo-darae',
  'tut-onjo': 'g-71-baekje-onjo', 'tut-biryu': 'g-28-goguryeo-damul', 'tut-ogan': 'g-13-baekje-general', 'tut-malgalgi': 'w-77-sabeol-malgalgi', 'tut-maryeo': 'g-89-baekje-maryeo', 'tut-haebi': 'w-95-michuhol-haebi',
  'baekje-ruler': 'g-68-baekje-onnuri', 'mokji-ruler': 'w-27-mokji-jinha', 'michuhol-ruler': 'w-28-michuhol-bira',
  'ungcheon-ruler': 'g-22-ungcheon-gomnae', 'sangdang-ruler': 'g-23-sangdang-soedal', 'geonma-ruler': 'w-46-geonma-maru',
  'wansan-ruler': 'g-24-wansan-onsan', 'gosaburi-ruler': 'w-47-gosaburi-baram', 'balla-ruler': 'g-25-balla-keunmoe',
  'mujin-ruler': 'w-48-mujin-mudeung', 'gampyeong-ruler': 'g-26-gampyeong-gaetbeol', 'goryong-ruler': 'w-49-goryong-gureum',
  'maek-ruler': 'g-27-maek-maekdol', 'siljik-ruler': 'w-50-siljik-mulga', 'haseulla-ruler': 'w-51-haseulla-dangung',
  'baekje-1': 'g-53-baekje-haeru', 'mokji-1': 'g-54-mokji-mahan', 'wansan-1': 'w-78-wansan-wan', 'balla-1': 'w-74-balla-dokmudeom',
  'maek-1': 'w-68-maek-beombal', 'haseulla-1': 'g-56-haseulla-gwahama', 'gampyeong-1': 'w-76-gampyeong-baetsagong',
  // 삼한과 북녘 판의 새 군주·장군 (data/regions/world.ts) — 있는 명치판을 나눠 쓴다. 새 얼굴은 그림 줄(ART-QUEUE 5c)
  'goguryeo-ruler': 'g-65-goguryeo-damul', 'goguryeo-1': 'g-49-goguryeo-sona', 'goguryeo-2': 'w-65-goguryeo-hwalmi',
  'biryuna-ruler': 'w-52-biryuna-songbi', 'biryuna-1': 'g-51-biryuna-mulgyeol', 'yeonna-ruler': 'g-29-yeonna-myeongsol', 'yeonna-1': 'w-71-yeonna-neoul',
  'hwanna-ruler': 'w-53-hwanna-gabi', 'hwanna-1': 'g-43-hwanna-amnok', 'gwanna-ruler': 'g-30-gwanna-soemoe', 'gwanna-1': 'g-48-gwanna-musoe',
  'buyeo-ruler': 'g-66-buyeo-geumha', 'buyeo-1': 'w-67-buyeo-haedal', 'maga-ruler': 'w-54-maga-dalli', 'maga-1': 'g-44-maga-malgup',
  'uga-ruler': 'g-32-uga-sodu', 'uga-1': 'g-46-uga-nureongso', 'jeoga-ruler': 'g-33-jeoga-metdol', 'jeoga-1': 'w-69-jeoga-eomni',
  'guga-ruler': 'w-55-guga-nuri', 'guga-1': 'g-47-guga-sanyanggae', 'dongokjeo-ruler': 'w-56-dongokjeo-sogeum', 'dongokjeo-1': 'g-05-mahan-chieftain',
  'bukokjeo-ruler': 'g-34-bukokjeo-duman', 'bukokjeo-1': 'w-70-bukokjeo-mulbeom', 'bullae-ruler': 'w-57-bullae-bakdal', 'bullae-1': 'g-50-bullae-gwaha',
  'tamna-ruler': 'w-58-tamna-halla', 'tamna-1': 'g-52-tamna-oreum',
  // 넓어진 땅 (2026-10-20) — 우산국 우해왕 (울릉도 전설) · 양맥 군장 맥손 · 장수 솔매 · 우산 장수 강치 (그림 줄 5f, 제미나이)
  'usan-ruler': 'g-58-usan-uhae', 'yangmaek-ruler': 'g-59-yangmaek-maekson', 'yangmaek-1': 'w-79-yangmaek-solmae', 'usan-1': 'w-80-usan-gangchi',
  // 여인 장수 더 (형 2026-10-19: "장수도 여캐 많았으면 좋겠으니 챗지피티로") — 판마다 장수 절반쯤이 여인. 아라·고자 둘은 변한 판의 얼굴 그대로
  // 제 얼굴(w-29 ~ w-45, 그림 줄 5d)을 받기 전까지는 있는 명치판을 빌린다 — 받으면 여기만 바꾼다
  'us-2': 'w-29-golpo-janmul', 'guya-3': 'w-30-guya-soebi',
  'dabeol-2': 'w-31-dabeol-dalbit', 'golbeol-2': 'w-32-golbeol-budeul', 'gammun-2': 'w-33-gammun-gamsil', 'chopal-2': 'w-34-chopal-deulme', 'jomun-2': 'w-35-jomun-odi',
  'baekje-2': 'w-36-baekje-maena', 'michuhol-2': 'w-37-michuhol-gaennae', 'sangdang-2': 'w-38-sangdang-bulmae', 'gosaburi-2': 'w-39-gosaburi-galmae', 'mujin-2': 'w-40-mujin-munui',
  'hwanna-2': 'w-41-hwanna-beodeul', 'gwanna-2': 'w-42-gwanna-soenun', 'uga-2': 'w-43-uga-nuri', 'dongokjeo-2': 'w-44-okjeo-sogeumbi', 'tamna-2': 'w-45-tamna-oreumbi',
  // 얼굴이 없던 첫째 장수 열셋 (2026-10-21 밤 챗지피티 격자 둘 — 칸마다 생김새를 적었다)
  'golbeol-1': 'g-60-golbeol-golgae', 'apdok-1': 'g-61-apdok-ap', 'gammun-1': 'g-62-gammun-gamnamu', 'chopal-1': 'g-63-chopal-yeoul',
  'michuhol-1': 'g-64-michuhol-sogeumkkun', 'sangdang-1': 'g-65-sangdang-soemangchi', 'geonma-1': 'g-66-geonma-malbalgup', 'gosaburi-1': 'g-67-gosaburi-buri',
  'mujin-1': 'g-68-mujin-bitgoeul', 'goryong-1': 'g-69-goryong-yong', 'siljik-1': 'g-70-siljik-pado', 'byeokjin-1': 'w-81-byeokjin-byeolbit', 'ungcheon-1': 'w-82-ungcheon-gom',
}
