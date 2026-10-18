/**
 * 영남 판 — 낙동강 유역과 동해·남해 바닷가의 스물한 나라 (형: "사료대로 키우고 땅도 넓힘" · "가장 중요한 건 한국사 기록이야" — 2026-10-18)
 *
 * **이름은 우리 역사책이 먼저다** (WORLD §5 규칙 6). 나라마다의 근거는 data/nations-yeongnam.ts 의 source 줄:
 *   진한 쪽 — 『삼국사기』 신라본기·열전·지리지가 신라가 아우른 나라로 적은 이름 (사로 · 음즙벌 · 압독 · 다벌 · 이서 · 골벌 · 우시산 · 거칠산 · 조문 · 감문 · 사벌 · 초팔)
 *   가야 쪽 — 『삼국유사』 가락국기·오가야, 『삼국사기』 지리지·물계자전 (가락 · 아라 · 고자 · 대가야 · 벽진(성산가야) · 비화가야 · 골포 · 사물 · 추화[설])
 * 자리는 지금 고을에 맞춘 학설이다. 마을·산성·빈땅의 이름은 지어냈고, 지금 지명은 prose.NODE_NOW 에 둔다.
 *
 * **지도와 자리가 맞는다**: 지도 그림(public/realm/map-yeongnam)은 실제 경위도로 그린 밑그림(tools/yeongnam-sketch.js)을 옛 지도로 칠한 것이고,
 * 고을 자리(GEO)도 같은 투영(YEONGNAM_PROJ)으로 놓는다 — data/art.ts 가 NODE_POS 로 바꾼다.
 *
 * 세력 id: 변한 축소판과 같은 나라는 같은 id (guya 가락 · anya 아라 · miri 추화 · goja 고자 · dokro 거칠산 · us 골포) — 깃발·군주 얼굴이 이어진다.
 * 집·품·군사 수는 byeonhan-mini 와 같이 옛 눈금으로 적고 PEOPLE_SCALE 배로 연다.
 */
import { PEOPLE_SCALE } from '../../migrate.ts'
import type { Army, Faction, Hero, Mind, NodeIntel, REdge, Realm, RNode, Stock, Watch } from '../../types.ts'

/** 지도 그림의 투영 — 경도 lon0..lon1 이 가로 0..1, 위도 lat1..lat0 이 세로 0..1 (tools/yeongnam-sketch.js 와 같다) */
export const YEONGNAM_PROJ = { lon0: 127.4, lon1: 130.3, lat0: 34.55, lat1: 36.55 } as const

/** 경위도 → 지도 위 비율 */
export function yeongnamPos(lon: number, lat: number): readonly [number, number] {
  const P = YEONGNAM_PROJ
  return [(lon - P.lon0) / (P.lon1 - P.lon0), (P.lat1 - lat) / (P.lat1 - P.lat0)]
}

/** 고을의 실제 자리 [경도, 위도] — 지도 그림에서 바다·강 건너편에 떨어지면 조금 옮겼다 (그 줄에 적었다) */
export const GEO: Readonly<Record<string, readonly [number, number]>> = {}
const geo = GEO as Record<string, readonly [number, number]>

const node = (id: string, name: string, kind: RNode['kind'], tags: RNode['tags'], owner: string | null, hh: number, ll: readonly [number, number]): RNode => {
  geo[id] = ll
  return { id, name, kind, tags, owner, hh: hh * PEOPLE_SCALE, sown: hh * PEOPLE_SCALE }
}
const wild = (id: string, name: string, tags: RNode['tags'], room: number, ll: readonly [number, number]): RNode => {
  geo[id] = ll
  return { id, name, kind: 'wild', tags, owner: null, hh: 0, sown: 0, room: room * PEOPLE_SCALE }
}

const NODES: RNode[] = [
  // ── 동해 쪽 진한
  node('y-saro-cap', '사로 도읍', 'capital', ['palisade'], 'saro', 650, [129.21, 35.84]), // 경주 — 『삼국사기』 신라본기
  node('y-saro-fort', '토함 산성', 'fort', ['high'], 'saro', 100, [129.33, 35.77]),
  node('y-saro-port', '감포 항구', 'port', [], 'saro', 200, [129.42, 35.8]), // 바닷가에 붙도록 안으로
  node('y-eumjeup-cap', '음즙벌 도읍', 'capital', [], 'eumjeup', 300, [129.23, 35.99]), // 안강
  node('y-eumjeup-port', '영일 포구', 'port', [], 'eumjeup', 150, [129.33, 36.05]), // 포항 영일만
  node('y-usisan-cap', '우시산 도읍', 'capital', ['palisade'], 'usisan', 350, [129.3, 35.56]), // 울산 — 『삼국사기』 거도전
  node('y-usisan-iron', '달천 철광', 'ironMine', ['iron'], 'usisan', 120, [129.38, 35.64]), // 울산 달천
  node('y-dokro-cap', '거칠산 도읍', 'port', ['palisade'], 'dokro', 450, [129.08, 35.21]), // 동래
  node('y-dokro-v', '기장 포구', 'port', [], 'dokro', 150, [129.2, 35.27]),
  // ── 남해 바닷가 가야
  node('y-guya-cap', '가락 도읍', 'port', ['palisade', 'high'], 'guya', 550, [128.88, 35.23]), // 김해 — 『삼국유사』 가락국기
  node('y-guya-iron', '물금 철광', 'ironMine', ['iron'], 'guya', 150, [128.98, 35.33]), // 양산 물금
  node('y-guya-v', '봉황 마을', 'village', [], 'guya', 250, [128.76, 35.28]), // 김해 진영
  node('y-us-cap', '골포 도읍', 'capital', ['palisade'], 'us', 300, [128.57, 35.22]), // 마산 [설] — 포상팔국
  node('y-us-v', '다호리 마을', 'village', ['reeds'], 'us', 150, [128.62, 35.34]), // 창원 동읍 다호리 (봉황 마을과 겹치지 않게 조금 서북으로)
  node('y-anya-cap', '아라 도읍', 'capital', ['palisade', 'high'], 'anya', 450, [128.41, 35.27]), // 함안 — 지리지 "본래 아시량국"
  node('y-anya-fort', '남강 산성', 'fort', ['high'], 'anya', 100, [128.26, 35.34]), // 의령
  node('y-goja-cap', '고자 도읍', 'port', ['palisade'], 'goja', 400, [128.32, 35.0]), // 고성 — 지리지 "본래 고자군"
  node('y-goja-v', '갯벌 마을', 'village', [], 'goja', 200, [128.42, 34.95]), // 통영 쪽 — 그림의 바닷가에 맞춰 올렸다
  node('y-samul-cap', '사물 도읍', 'port', [], 'samul', 300, [128.07, 35.07]), // 사천 — 지리지 "본래 사물현"
  // ── 낙동강 가운데
  node('y-miri-cap', '추화 도읍', 'capital', ['palisade', 'moat'], 'miri', 600, [128.75, 35.49]), // 밀양 [설]
  node('y-miri-v', '삼랑 나루 마을', 'village', ['reeds', 'shallows'], 'miri', 300, [128.82, 35.41]), // 삼랑진
  node('y-bihwa-cap', '비화 도읍', 'capital', [], 'bihwa', 400, [128.5, 35.54]), // 창녕 — 『삼국유사』 오가야
  node('y-chopal-cap', '초팔 도읍', 'capital', [], 'chopal', 250, [128.27, 35.57]), // 합천 초계 — 신라본기 파사이사금
  node('y-iseo-cap', '이서 도읍', 'capital', [], 'iseo', 350, [128.73, 35.65]), // 청도 — 신라본기 유례이사금
  node('y-apdok-cap', '압독 도읍', 'capital', [], 'apdok', 350, [128.74, 35.83]), // 경산 — 신라본기 파사이사금
  node('y-dabeol-cap', '다벌 도읍', 'capital', ['palisade'], 'dabeol', 450, [128.6, 35.86]), // 대구 — 신라본기 파사이사금
  node('y-dabeol-v', '팔공 산마을', 'village', ['high'], 'dabeol', 150, [128.68, 36.0]),
  node('y-golbeol-cap', '골벌 도읍', 'capital', [], 'golbeol', 350, [128.94, 35.96]), // 영천 — 신라본기 조분이사금
  node('y-daegaya-cap', '대가야 도읍', 'capital', ['palisade', 'high'], 'daegaya', 500, [128.26, 35.73]), // 고령 — 지리지 "본래 대가야국"
  node('y-daegaya-iron', '야로 철광', 'ironMine', ['iron'], 'daegaya', 120, [128.16, 35.63]), // 합천 야로
  node('y-byeokjin-cap', '벽진 도읍', 'capital', [], 'byeokjin', 350, [128.28, 35.92]), // 성주 — 『삼국유사』 오가야 성산가야
  // ── 북쪽
  node('y-gammun-cap', '감문 도읍', 'capital', [], 'gammun', 300, [128.11, 36.12]), // 김천 — 신라본기 조분이사금
  node('y-sabeol-cap', '사벌 도읍', 'capital', ['palisade'], 'sabeol', 450, [128.16, 36.41]), // 상주 — 신라본기 첨해이사금·석우로전
  node('y-sabeol-v', '낙동 나루 마을', 'village', ['shallows'], 'sabeol', 200, [128.3, 36.36]),
  node('y-jomun-cap', '조문 도읍', 'capital', [], 'jomun', 400, [128.7, 36.35]), // 의성 — 신라본기 벌휴이사금
  // 소도 둘 — 누구의 땅도 아니다 (SYSTEMS §8-4)
  node('y-sodo-east', '가지산 소도', 'sodo', ['sodo'], null, 0, [129.0, 35.66]),
  node('y-sodo-west', '가야산 소도', 'sodo', ['sodo'], null, 0, [128.12, 35.82]),
  // 빈땅 — 일구면 마을이 된다 (FLOW §2)
  wild('y-w-geochang', '거창 들', ['pines'], 200, [127.92, 35.68]),
  wild('y-w-jinju', '진주 들', [], 300, [128.08, 35.19]),
  wild('y-w-sancheong', '산청 골', ['pines'], 150, [127.88, 35.4]),
  wild('y-w-neoreun', '너른벌', ['pasture'], 250, [128.95, 35.14]), // 낙동강 하구의 너른 들 — 일구면 말을 친다
  wild('y-w-gomgol', '곰골', ['high'], 150, [129.05, 35.45]),
  wild('y-w-gunwi', '군위 들', [], 200, [128.6, 36.17]),
  wild('y-w-uiseong', '의성 너른들', ['pasture'], 250, [128.5, 36.28]),
  wild('y-w-cheongsong', '청송 산골', ['pines'], 150, [129.05, 36.35]),
  wild('y-w-yeongdeok', '영덕 갯가', [], 200, [129.34, 36.4]),
  wild('y-w-geoje', '거제 큰섬', ['fog'], 200, [128.6, 34.88]),
  wild('y-w-namhae', '남해 섬', [], 180, [127.93, 34.82]),
]

const e = (id: string, a: string, b: string, kind: REdge['kind'], tags: REdge['tags'] = []): REdge => ({ id, a, b, kind, tags })

/**
 * 길 — 낙동강은 나루(ford)로만 건넌다 · 소백·태백 줄기는 고갯길(pass) · 바닷가 고을끼리는 뱃길(sea) · 강 하구는 갯벌·갈대.
 * 지운 id 는 다시 쓰지 않는다.
 */
const EDGES: REdge[] = [
  // 남해 바닷가
  e('y01', 'y-samul-cap', 'y-goja-cap', 'field'),
  e('y02', 'y-samul-cap', 'y-w-jinju', 'field'),
  e('y03', 'y-w-jinju', 'y-anya-fort', 'field'), // 남강 따라
  e('y04', 'y-w-jinju', 'y-w-sancheong', 'pass'),
  e('y05', 'y-goja-cap', 'y-goja-v', 'field'),
  e('y06', 'y-goja-cap', 'y-anya-cap', 'pass'),
  e('y07', 'y-goja-v', 'y-us-cap', 'sea'),
  e('y08', 'y-goja-v', 'y-w-geoje', 'sea'),
  e('y09', 'y-us-cap', 'y-anya-cap', 'field'),
  e('y10', 'y-us-cap', 'y-us-v', 'field'),
  e('y11', 'y-us-cap', 'y-w-geoje', 'sea'),
  e('y12', 'y-us-v', 'y-guya-v', 'reeds'),
  e('y13', 'y-us-v', 'y-miri-v', 'ford', ['reeds']), // 낙동강 갈대 나루
  e('y14', 'y-anya-cap', 'y-anya-fort', 'pass'),
  e('y15', 'y-anya-cap', 'y-bihwa-cap', 'ford', ['reeds']), // 남강·낙동강이 만나는 나루
  e('y16', 'y-anya-fort', 'y-chopal-cap', 'forest'),
  e('y17', 'y-guya-cap', 'y-guya-v', 'field'),
  e('y18', 'y-guya-cap', 'y-w-neoreun', 'mudflat'),
  e('y19', 'y-w-neoreun', 'y-dokro-cap', 'ford'), // 낙동강 하구
  e('y20', 'y-guya-cap', 'y-dokro-cap', 'sea'),
  e('y21', 'y-guya-v', 'y-guya-iron', 'ford'),
  e('y22', 'y-guya-iron', 'y-miri-cap', 'forest'),
  e('y23', 'y-guya-iron', 'y-dokro-cap', 'pass'),
  e('y24', 'y-guya-iron', 'y-w-gomgol', 'pass'),
  e('y78', 'y-guya-v', 'y-miri-v', 'ford'),
  // 동해 바닷가
  e('y25', 'y-dokro-cap', 'y-dokro-v', 'field'),
  e('y26', 'y-dokro-v', 'y-usisan-cap', 'field'),
  e('y27', 'y-usisan-cap', 'y-usisan-iron', 'field'),
  e('y28', 'y-usisan-iron', 'y-saro-port', 'field'),
  e('y29', 'y-usisan-cap', 'y-w-gomgol', 'pass'),
  e('y30', 'y-usisan-cap', 'y-saro-cap', 'field'),
  e('y31', 'y-w-gomgol', 'y-miri-cap', 'pass'),
  e('y69', 'y-saro-cap', 'y-saro-fort', 'pass'),
  e('y70', 'y-saro-fort', 'y-saro-port', 'forest'),
  e('y67', 'y-eumjeup-cap', 'y-saro-cap', 'field'),
  e('y66', 'y-eumjeup-cap', 'y-eumjeup-port', 'field'),
  e('y75', 'y-eumjeup-port', 'y-saro-port', 'sea'),
  e('y65', 'y-w-yeongdeok', 'y-eumjeup-port', 'field'),
  e('y79', 'y-dokro-v', 'y-saro-port', 'sea'),
  // 낙동강 가운데
  e('y32', 'y-miri-cap', 'y-miri-v', 'field'),
  e('y33', 'y-miri-cap', 'y-iseo-cap', 'field'),
  e('y34', 'y-miri-v', 'y-bihwa-cap', 'reeds'),
  e('y35', 'y-bihwa-cap', 'y-chopal-cap', 'ford'), // 낙동강·황강
  e('y36', 'y-bihwa-cap', 'y-iseo-cap', 'pass'), // 비슬산
  e('y37', 'y-bihwa-cap', 'y-dabeol-cap', 'field'),
  e('y38', 'y-chopal-cap', 'y-daegaya-cap', 'field'),
  e('y39', 'y-chopal-cap', 'y-w-geochang', 'pass'),
  e('y40', 'y-daegaya-cap', 'y-daegaya-iron', 'forest'),
  e('y41', 'y-daegaya-iron', 'y-w-geochang', 'forest'),
  e('y42', 'y-daegaya-cap', 'y-dabeol-cap', 'ford'), // 낙동강
  e('y43', 'y-daegaya-cap', 'y-byeokjin-cap', 'field'),
  e('y44', 'y-daegaya-cap', 'y-sodo-west', 'forest'),
  e('y45', 'y-sodo-west', 'y-byeokjin-cap', 'forest'),
  e('y47', 'y-byeokjin-cap', 'y-dabeol-cap', 'ford'),
  e('y57', 'y-dabeol-cap', 'y-apdok-cap', 'field'),
  e('y56', 'y-dabeol-cap', 'y-dabeol-v', 'pass'),
  e('y58', 'y-apdok-cap', 'y-golbeol-cap', 'field'),
  e('y59', 'y-apdok-cap', 'y-iseo-cap', 'pass'),
  e('y60', 'y-golbeol-cap', 'y-saro-cap', 'pass'),
  e('y61', 'y-golbeol-cap', 'y-dabeol-v', 'forest'),
  e('y68', 'y-eumjeup-cap', 'y-golbeol-cap', 'pass'),
  e('y72', 'y-iseo-cap', 'y-sodo-east', 'forest'),
  e('y73', 'y-saro-cap', 'y-sodo-east', 'forest'),
  e('y74', 'y-w-gomgol', 'y-sodo-east', 'forest'),
  // 북쪽
  e('y46', 'y-byeokjin-cap', 'y-gammun-cap', 'field'),
  e('y48', 'y-gammun-cap', 'y-sabeol-cap', 'field'),
  e('y83', 'y-gammun-cap', 'y-w-geochang', 'pass'), // 김천–거창 고개
  e('y50', 'y-sabeol-cap', 'y-sabeol-v', 'field'),
  e('y51', 'y-sabeol-v', 'y-jomun-cap', 'field'),
  e('y52', 'y-sabeol-v', 'y-w-gunwi', 'field'),
  e('y53', 'y-jomun-cap', 'y-w-uiseong', 'field'),
  e('y54', 'y-w-uiseong', 'y-w-gunwi', 'field'),
  e('y55', 'y-w-gunwi', 'y-dabeol-v', 'pass'),
  e('y62', 'y-golbeol-cap', 'y-w-cheongsong', 'pass'),
  e('y63', 'y-jomun-cap', 'y-w-cheongsong', 'pass'),
  e('y64', 'y-w-cheongsong', 'y-w-yeongdeok', 'pass'),
  // 서쪽 산골
  e('y81', 'y-w-sancheong', 'y-w-geochang', 'pass'),
  e('y82', 'y-w-sancheong', 'y-anya-fort', 'forest'),
  // 섬
  e('y76', 'y-w-namhae', 'y-samul-cap', 'sea'),
  e('y77', 'y-w-namhae', 'y-goja-cap', 'sea'),
]

/** 나라마다: AI 일 때의 성향 · 새 군사의 장비 · 바깥 교역 · 시작 창고 */
interface NationStart {
  readonly faction: Omit<Faction, 'mind'>
  readonly mind: Exclude<Mind, 'player'>
  readonly stock: Stock
}

const st = (grain: number, iron: number, more: Partial<Stock> = {}): Stock => ({ grain, iron, ...more })

const NATION_STARTS: readonly NationStart[] = [
  { faction: { id: 'saro', name: '사로국', capital: 'y-saro-cap', equip: 'bronze' }, mind: 'greedy', stock: st(320, 10, { salt: 15, wood: 30 }) },
  { faction: { id: 'guya', name: '가락국', capital: 'y-guya-cap', equip: 'iron' }, mind: 'greedy', stock: st(280, 40, { salt: 15, wood: 30 }) },
  { faction: { id: 'daegaya', name: '대가야', capital: 'y-daegaya-cap', equip: 'ironTip' }, mind: 'cautious', stock: st(260, 25, { wood: 40 }) },
  { faction: { id: 'anya', name: '아라국', capital: 'y-anya-cap', equip: 'ironTip' }, mind: 'cautious', stock: st(220, 10, { wood: 40 }) },
  { faction: { id: 'miri', name: '추화국', capital: 'y-miri-cap', equip: 'bronze' }, mind: 'cautious', stock: st(360, 0, { wood: 30 }) },
  { faction: { id: 'dabeol', name: '다벌국', capital: 'y-dabeol-cap', equip: 'bronze' }, mind: 'greedy', stock: st(260, 5, { wood: 30 }) },
  { faction: { id: 'sabeol', name: '사벌국', capital: 'y-sabeol-cap', equip: 'bronze' }, mind: 'cautious', stock: st(280, 0, { wood: 30, horse: 6 }) },
  { faction: { id: 'dokro', name: '거칠산국', capital: 'y-dokro-cap', equip: 'bronze', income: { grain: 15, iron: 4 } }, mind: 'greedy', stock: st(220, 20, { salt: 15, wood: 20 }) },
  { faction: { id: 'goja', name: '고자국', capital: 'y-goja-cap', equip: 'bronze', income: { grain: 8, iron: 3 } }, mind: 'greedy', stock: st(200, 15, { salt: 20, wood: 30 }) },
  { faction: { id: 'usisan', name: '우시산국', capital: 'y-usisan-cap', equip: 'ironTip' }, mind: 'greedy', stock: st(200, 25, { salt: 15, wood: 25 }) },
  { faction: { id: 'bihwa', name: '비화가야', capital: 'y-bihwa-cap', equip: 'bronze' }, mind: 'cautious', stock: st(240, 5, { wood: 30 }) },
  { faction: { id: 'jomun', name: '조문국', capital: 'y-jomun-cap', equip: 'bronze' }, mind: 'cautious', stock: st(240, 0, { wood: 30, horse: 4 }) },
  { faction: { id: 'golbeol', name: '골벌국', capital: 'y-golbeol-cap', equip: 'bronze' }, mind: 'greedy', stock: st(200, 5, { wood: 30 }) },
  { faction: { id: 'apdok', name: '압독국', capital: 'y-apdok-cap', equip: 'bronze' }, mind: 'cautious', stock: st(200, 5, { wood: 25 }) },
  { faction: { id: 'iseo', name: '이서국', capital: 'y-iseo-cap', equip: 'bronze' }, mind: 'cautious', stock: st(200, 0, { wood: 35 }) },
  { faction: { id: 'byeokjin', name: '벽진국', capital: 'y-byeokjin-cap', equip: 'bronze' }, mind: 'cautious', stock: st(200, 5, { wood: 30 }) },
  { faction: { id: 'gammun', name: '감문국', capital: 'y-gammun-cap', equip: 'bronze' }, mind: 'greedy', stock: st(180, 0, { wood: 30 }) },
  { faction: { id: 'samul', name: '사물국', capital: 'y-samul-cap', equip: 'bronze' }, mind: 'greedy', stock: st(180, 5, { salt: 20, wood: 30 }) },
  { faction: { id: 'eumjeup', name: '음즙벌국', capital: 'y-eumjeup-cap', equip: 'bronze' }, mind: 'cautious', stock: st(180, 0, { salt: 15, wood: 25 }) },
  { faction: { id: 'chopal', name: '초팔국', capital: 'y-chopal-cap', equip: 'bronze' }, mind: 'cautious', stock: st(160, 0, { wood: 35 }) },
  { faction: { id: 'us', name: '골포국', capital: 'y-us-cap', equip: 'ironTip' }, mind: 'cautious', stock: st(150, 0, { salt: 20, wood: 30 }) },
]

/** 장수 — 능력치 여섯 (무예·통솔·지략·내정·매력·의리) · 특성 · 남 g / 여 w. `at` 은 혼자 머무는 고을 */
const h = (
  id: string, name: string, faction: string, look: 'g' | 'w',
  [mu, tong, ryak, chi, deok, uiri]: readonly [number, number, number, number, number, number],
  traits: readonly string[], at: string | null = null,
): Hero => ({ id, name, faction, mu, tong, ryak, chi, deok, uiri, traits, look, status: 'free', captor: null, at, post: null })

/** 군주는 도읍에 머문다 — 이름은 지어냈고 칭호만 사료에서 (신지 · 험측 · 번예 · 살해 · 읍차 · 견지) */
const HEROES: Hero[] = [
  // 군주 스물하나 — 여인이 많다 (형의 그림 방향)
  h('saro-ruler', '신지 아로', 'saro', 'g', [3, 6, 7, 7, 8, 9], ['charm'], 'y-saro-cap'),
  h('guya-ruler', '진지렴 쇠보', 'guya', 'g', [6, 7, 4, 5, 4, 8], ['smith'], 'y-guya-cap'),
  h('daegaya-ruler', '신지 가실', 'daegaya', 'g', [4, 6, 6, 6, 7, 8], ['shaman'], 'y-daegaya-cap'),
  h('anya-ruler', '신지 아단', 'anya', 'g', [4, 6, 8, 5, 5, 9], ['careful'], 'y-anya-cap'),
  h('miri-ruler', '신지 달래', 'miri', 'w', [2, 4, 4, 9, 7, 8], ['farmer'], 'y-miri-cap'),
  h('dabeol-ruler', '험측 달구', 'dabeol', 'g', [6, 6, 5, 5, 4, 7], ['mountain'], 'y-dabeol-cap'),
  h('sabeol-ruler', '험측 벌말', 'sabeol', 'g', [6, 6, 4, 5, 4, 7], ['river'], 'y-sabeol-cap'),
  h('dokro-ruler', '읍차 가람', 'dokro', 'g', [6, 6, 5, 4, 4, 7], ['trader'], 'y-dokro-cap'),
  h('goja-ruler', '험측 바우', 'goja', 'g', [5, 5, 5, 5, 5, 7], ['river', 'trader'], 'y-goja-cap'),
  h('usisan-ruler', '번예 소금', 'usisan', 'w', [4, 5, 6, 6, 6, 7], ['trader'], 'y-usisan-cap'),
  h('bihwa-ruler', '번예 빛나', 'bihwa', 'w', [3, 4, 6, 6, 8, 7], ['charm'], 'y-bihwa-cap'),
  h('jomun-ruler', '살해 이랑', 'jomun', 'w', [6, 5, 5, 5, 5, 8], ['mountain'], 'y-jomun-cap'),
  h('golbeol-ruler', '살해 범', 'golbeol', 'w', [7, 5, 4, 3, 5, 6], ['nighteye'], 'y-golbeol-cap'),
  h('apdok-ruler', '읍차 누리', 'apdok', 'w', [3, 4, 5, 7, 6, 8], ['farmer'], 'y-apdok-cap'),
  h('iseo-ruler', '읍차 시내', 'iseo', 'w', [3, 4, 6, 6, 7, 7], ['careful'], 'y-iseo-cap'),
  h('byeokjin-ruler', '읍차 별', 'byeokjin', 'w', [4, 4, 5, 6, 6, 8], ['smith'], 'y-byeokjin-cap'),
  h('gammun-ruler', '읍차 감돌', 'gammun', 'g', [5, 5, 6, 4, 4, 6], ['shaman'], 'y-gammun-cap'),
  h('samul-ruler', '읍차 물결', 'samul', 'g', [6, 5, 4, 4, 5, 7], ['river'], 'y-samul-cap'),
  h('eumjeup-ruler', '읍차 즙', 'eumjeup', 'g', [4, 4, 5, 5, 5, 7], ['farmer'], 'y-eumjeup-cap'),
  h('chopal-ruler', '읍차 팔매', 'chopal', 'g', [6, 5, 4, 4, 4, 6], ['careful'], 'y-chopal-cap'),
  h('us-ruler', '읍차 해솔', 'us', 'w', [3, 5, 6, 6, 8, 9], ['charm'], 'y-us-cap'),
  // 장군 — 나라마다 군대를 이끄는 이 (큰 나라는 둘)
  h('chief', '신궁', 'us', 'g', [7, 5, 6, 4, 5, 8], ['archer', 'nighteye']),
  h('saro-1', '견지 박달', 'saro', 'g', [7, 7, 5, 4, 4, 7], ['careful']),
  h('saro-2', '번예 노을', 'saro', 'w', [6, 5, 6, 4, 5, 6], ['archer']),
  h('guya-1', '견지 거타', 'guya', 'g', [7, 7, 5, 6, 4, 6], ['ironhand']),
  h('daegaya-1', '견지 쇠뫼', 'daegaya', 'w', [6, 6, 5, 5, 5, 7], ['smith']),
  h('anya-1', '견지 아라', 'anya', 'w', [5, 6, 7, 5, 6, 8], ['mountain']),
  h('miri-1', '읍차 갈미', 'miri', 'g', [4, 4, 4, 5, 5, 4], ['drinker']),
  h('dabeol-1', '살해 들개', 'dabeol', 'g', [6, 5, 4, 3, 3, 5], ['glutton']),
  h('sabeol-1', '살해 말갈기', 'sabeol', 'w', [6, 6, 5, 4, 5, 6], ['river']),
  h('dokro-1', '살해 너울', 'dokro', 'w', [7, 6, 6, 3, 4, 4], ['river', 'nighteye']),
  h('goja-1', '살해 바다쇠', 'goja', 'g', [5, 5, 5, 3, 3, 5], ['river']),
  h('usisan-1', '살해 쇠물', 'usisan', 'g', [6, 5, 4, 4, 3, 6], ['ironhand']),
  h('bihwa-1', '살해 늪', 'bihwa', 'g', [5, 5, 5, 4, 4, 6], []),
  h('jomun-1', '살해 솔개', 'jomun', 'g', [5, 5, 6, 3, 4, 6], ['nighteye']),
  h('golbeol-1', '살해 골개', 'golbeol', 'g', [6, 4, 3, 3, 3, 5], ['coward']),
  h('apdok-1', '살해 압', 'apdok', 'g', [5, 5, 4, 4, 4, 6], []),
  h('iseo-1', '살해 고개', 'iseo', 'w', [5, 5, 5, 4, 4, 6], ['mountain']),
  h('byeokjin-1', '살해 별빛', 'byeokjin', 'w', [5, 5, 5, 4, 5, 6], []),
  h('gammun-1', '살해 감나무', 'gammun', 'g', [6, 5, 4, 3, 3, 5], []),
  h('samul-1', '살해 사공', 'samul', 'w', [5, 5, 4, 3, 4, 6], ['river']),
  h('eumjeup-1', '살해 벌', 'eumjeup', 'w', [5, 4, 4, 4, 4, 6], []),
  h('chopal-1', '살해 여울', 'chopal', 'g', [5, 4, 5, 3, 4, 6], []),
]

const a = (id: string, faction: string, hero: string | null, at: string, mix0: Army['mix'], equip: Army['equip'] = 'bronze'): Army => {
  const mix = Object.fromEntries(Object.entries(mix0).map(([k, n]) => [k, (n ?? 0) * PEOPLE_SCALE])) as Army['mix']
  return { id, faction, hero, mix, equip, kit: Object.fromEntries(Object.entries(mix).map(([k, n]) => [k, { [equip]: n }])), morale: 1, at, march: null }
}

const ARMIES: Army[] = [
  a('a-saro-1', 'saro', 'saro-1', 'y-saro-cap', { spear: 110, bow: 50, shield: 20 }),
  a('a-saro-2', 'saro', 'saro-2', 'y-saro-fort', { spear: 40, bow: 30 }),
  a('a-guya-1', 'guya', 'guya-1', 'y-guya-cap', { spear: 100, bow: 50, shield: 30 }, 'iron'),
  a('a-daegaya', 'daegaya', 'daegaya-1', 'y-daegaya-cap', { spear: 90, bow: 50, shield: 20 }, 'ironTip'),
  a('a-anya', 'anya', 'anya-1', 'y-anya-cap', { spear: 90, bow: 60, shield: 20 }, 'ironTip'),
  a('a-miri', 'miri', 'miri-1', 'y-miri-v', { spear: 90, bow: 40, shield: 10 }),
  a('a-dabeol', 'dabeol', 'dabeol-1', 'y-dabeol-cap', { spear: 90, bow: 40, shield: 10 }),
  a('a-sabeol', 'sabeol', 'sabeol-1', 'y-sabeol-cap', { spear: 80, bow: 40, horse: 10 }),
  a('a-dokro', 'dokro', 'dokro-1', 'y-dokro-cap', { spear: 70, bow: 40, boat: 20 }),
  a('a-goja', 'goja', 'goja-1', 'y-goja-cap', { spear: 70, bow: 30, boat: 20 }),
  a('a-usisan', 'usisan', 'usisan-1', 'y-usisan-cap', { spear: 70, bow: 30, shield: 10 }, 'ironTip'),
  a('a-bihwa', 'bihwa', 'bihwa-1', 'y-bihwa-cap', { spear: 70, bow: 40 }),
  a('a-jomun', 'jomun', 'jomun-1', 'y-jomun-cap', { spear: 70, bow: 40, horse: 5 }),
  a('a-golbeol', 'golbeol', 'golbeol-1', 'y-golbeol-cap', { spear: 70, bow: 30 }),
  a('a-apdok', 'apdok', 'apdok-1', 'y-apdok-cap', { spear: 60, bow: 30, shield: 10 }),
  a('a-iseo', 'iseo', 'iseo-1', 'y-iseo-cap', { spear: 60, bow: 40 }),
  a('a-byeokjin', 'byeokjin', 'byeokjin-1', 'y-byeokjin-cap', { spear: 60, bow: 30, shield: 10 }),
  a('a-gammun', 'gammun', 'gammun-1', 'y-gammun-cap', { spear: 60, bow: 30 }),
  a('a-samul', 'samul', 'samul-1', 'y-samul-cap', { spear: 60, bow: 30, boat: 10 }),
  a('a-eumjeup', 'eumjeup', 'eumjeup-1', 'y-eumjeup-cap', { spear: 60, bow: 30 }),
  a('a-chopal', 'chopal', 'chopal-1', 'y-chopal-cap', { spear: 50, bow: 30 }),
  a('a-us', 'us', 'chief', 'y-us-cap', { spear: 80, bow: 30, shield: 10 }, 'ironTip'),
]

const byId = <T extends { id: string }>(xs: readonly T[]): Record<string, T> =>
  Object.fromEntries(xs.map((x) => [x.id, structuredClone(x)]))

/** 고를 수 있는 나라 id — 나라 고르기 화면의 순서 (data/nations-yeongnam.ts 와 같다) */
export const YEONGNAM_NATION_IDS: readonly string[] = NATION_STARTS.map((n) => n.faction.id)

/** 영남 판을 연다 — `player` 가 고른 나라가 플레이어, 나머지는 AI. 같은 시드·같은 나라면 같은 판 */
export function startYeongnam(seed: number, player: string): Realm {
  const me = YEONGNAM_NATION_IDS.includes(player) ? player : 'us'
  const factions: Faction[] = NATION_STARTS.map((n) => ({ ...n.faction, mind: n.faction.id === me ? 'player' : n.mind, ruler: `${n.faction.id}-ruler` }))
  const nodes = byId(NODES)
  const edges = byId(EDGES)
  const intel: Realm['intel'] = {}
  for (const f of factions) {
    const known: Record<string, NodeIntel> = {}
    for (const n of NODES) if (n.owner === f.id) known[n.id] = { land: true, force: null, alert: null }
    for (const ed of EDGES) {
      for (const [x, y] of [[ed.a, ed.b], [ed.b, ed.a]] as const) {
        if (nodes[x]?.owner === f.id && known[y] === undefined) known[y] = { land: true, force: null, alert: null }
      }
    }
    intel[f.id] = known
  }
  const watch: Record<string, Watch> = {}
  for (const n of NODES) watch[n.id] = { alert: 0, lull: 0 }
  const stock: Record<string, Stock> = {}
  for (const n of NATION_STARTS) stock[n.faction.id] = { ...n.stock }
  return {
    seed: seed >>> 0,
    season: 0,
    nodes,
    edges,
    factions: byId(factions),
    heroes: byId(HEROES),
    armies: byId(ARMIES),
    intel,
    watch,
    provoked: [],
    player: me,
    stock,
    relations: {},
    outcome: null,
    scale: PEOPLE_SCALE,
    region: 'yeongnam',
  }
}

/** 삼한 남부 판(regions/south.ts)이 영남의 나라·고을·길·장수·군대를 그대로 가져다 쓴다 */
export const YEONGNAM_DATA = { NODES, EDGES, NATION_STARTS, HEROES, ARMIES } as const
