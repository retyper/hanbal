/**
 * 맞은 장수 초상 (11-17 형: 「장수 초상에 맞았을 때 모습」 · 1단계 = 그림 없이 코드로, 모든 장수 · 모든 전투에).
 *
 * 맞으면 초상이 짧게 흔들리고, 붉은 빛이 번쩍이고, 잠깐 빛이 빠졌다(잿빛 막) 돌아오고, 금 간 유리 같은 줄이 스쳤다 사라진다.
 * 큰 피해일수록 조금 세게 · 짧고 가볍게. 수치는 전부 P.render.hitPortrait* (tune/params.ts).
 *
 * 두 길:
 *  - DOM 초상 (열전 왼쪽 판 · 본편 합전 장수 초상): hitPortrait(판, 세기) 가 겉막 하나를 새로 끼우고 작은 흔들림을 한 번 튼다.
 *    선언형 화면(본편 합전)은 hitPortraitHtml(세기, { delay }) 조각을 그림 옆에 넣으면 CSS 가 그때 튼다.
 *  - 캔버스 초상 (겨루기 적장 액자 · 체력 막대 얼굴): HitClock 으로 맞은 때를 기억하고 프레임마다 drawHitPortrait.
 *
 * 폰 그래픽 (메모리 mobile-gpu-layer-limit · ui/gfxsafe.ts): 넓은 판에 filter 애니 금지 · 부드러운 그러데이션 금지.
 * 그래서 채도 빠짐은 잿빛 단색 막의 opacity 로 흉내 내고, 붉은 빛도 단색 + 안쪽 그림자 · 움직이는 것은 opacity 와 작은 transform 한 번뿐.
 *
 * 나중에 장수별 피격 초상 그림(public/realm/hit/<form>/<초상 id>.webp)이 생기면 HIT_ART 에 한 줄 적는다 → 그 그림을 잠깐 바꿔 보여 준다.
 * 없는 그림은 부르지 않는다 (맞을 때마다 404 를 내지 않게).
 *
 * 그리기 쪽만 쓴다 — 판 상태는 읽기만 (절대 규칙 2). 맨 위에서 document 를 만지지 않는다 (node 시험이 이 파일을 읽는다).
 */
import { P } from '../tune/params.ts'

/** 초상 결 — bust(기본 원화) · awaken(각성 원화) */
export type HitForm = 'bust' | 'awaken'
/** 피격 그림이 있는 초상 — `${결}/${초상 id}` (public/realm/hit/<결>/<id>.webp). 지금은 그림 없음 */
export const HIT_ART: ReadonlySet<string> = new Set<string>(['awaken/g-01-master-smith', 'awaken/g-03-sea-trader', 'awaken/g-04-jinhan-giant', 'awaken/g-05-mahan-chieftain', 'awaken/g-06-strategist', 'awaken/g-07-drunk-warrior', 'awaken/g-08-veteran', 'awaken/g-09-farmer-conscript', 'awaken/g-10-buyeo-horse-lord', 'awaken/g-11-gaya-iron-general', 'awaken/g-12-silla-youth', 'awaken/g-13-baekje-general', 'awaken/g-15-shaman-man', 'awaken/g-16-goguryeo-gaema-commander', 'awaken/g-17-saro-isageum', 'awaken/g-18-daegaya-king', 'awaken/g-19-sabeol-veteran', 'awaken/g-20-samul-sea-lord', 'awaken/g-22-ungcheon-gomnae', 'awaken/g-23-sangdang-soedal', 'awaken/g-24-wansan-onsan', 'awaken/g-25-balla-keunmoe', 'awaken/g-26-gampyeong-gaetbeol', 'awaken/g-27-maek-maekdol', 'awaken/g-28-goguryeo-damul', 'awaken/g-29-yeonna-myeongsol', 'awaken/g-30-gwanna-soemoe', 'awaken/g-32-uga-sodu', 'awaken/g-33-jeoga-metdol', 'awaken/g-34-bukokjeo-duman', 'awaken/g-35-dabeol-dalgu', 'awaken/g-36-gammun-gamdol', 'awaken/g-37-eumjeup-jeup', 'awaken/g-38-chopal-palmae', 'awaken/g-40-anya-adan', 'awaken/g-41-goja-bau', 'awaken/g-42-dokro-garam', 'awaken/g-43-hwanna-amnok', 'awaken/g-44-maga-malgup', 'awaken/g-45-dabeol-deulgae', 'awaken/g-46-uga-nureongso', 'awaken/g-47-guga-sanyanggae', 'awaken/g-48-gwanna-musoe', 'awaken/g-49-goguryeo-sona', 'awaken/g-50-bullae-gwaha', 'awaken/g-51-biryuna-mulgyeol', 'awaken/g-52-tamna-oreum', 'awaken/g-53-baekje-haeru', 'awaken/g-55-saro-bakdal', 'awaken/g-56-haseulla-gwahama', 'awaken/g-57-bihwa-neup', 'awaken/g-59-yangmaek-maekson', 'awaken/g-60-eupcha-hangyeol', 'awaken/g-60-golbeol-golgae', 'awaken/g-61-heomcheuk-bawi', 'awaken/g-62-beonye-hanul', 'awaken/g-62-gammun-gamnamu', 'awaken/g-63-heomcheuk-beogeum', 'awaken/g-64-jumong', 'awaken/g-64-michuhol-sogeumkkun', 'awaken/g-65-goguryeo-damul', 'awaken/g-66-buyeo-geumha', 'awaken/g-66-geonma-malbalgup', 'awaken/g-67-buyeo-daeso', 'awaken/g-68-baekje-onnuri', 'awaken/g-68-mujin-bitgoeul', 'awaken/g-69-goryong-yong', 'awaken/g-70-siljik-pado', 'awaken/g-71-baekje-onjo', 'awaken/g-73-baekje-eureum', 'awaken/g-74-saro-hyeokgeose', 'awaken/g-75-saro-hogong', 'awaken/g-76-mokji-jinha', 'awaken/g-78-saro-alpyeong', 'awaken/g-79-saro-jibaekho', 'awaken/g-80-saro-guryema', 'awaken/g-82-saro-hojin', 'awaken/g-83-mokji-keundol', 'awaken/g-84-wander-seoneul', 'awaken/g-85-wander-ure', 'awaken/g-86-mokji-geumbawi', 'awaken/g-87-wae-chief', 'awaken/g-88-wander-soeul', 'awaken/g-89-baekje-maryeo', 'awaken/g-90-haengin-gomok', 'awaken/g-93-jomun-solgae', 'awaken/g-97-tahae', 'awaken/l-L2-soseono', 'awaken/l-L3-heo-hwangok', 'awaken/l-L7-aryeong', 'awaken/w-01-silla-princess', 'awaken/w-02-goguryeo-lady', 'awaken/w-03-goguryeo-archer', 'awaken/w-04-gaya-swordswoman', 'awaken/w-05-baekje-queen', 'awaken/w-06-buyeo-huntress', 'awaken/w-08-mahan-warrior', 'awaken/w-10-pirate-captain', 'awaken/w-100-garak-sincheongan', 'awaken/w-101-garak-singwigan', 'awaken/w-102-garak-dana', 'awaken/w-104-buyeo-darae', 'awaken/w-11-assassin', 'awaken/w-12-court-dancer', 'awaken/w-13-young-archer', 'awaken/w-14-feast-spy', 'awaken/w-17-mahan-pearl-diver', 'awaken/w-18-jinhan-salt-widow', 'awaken/w-19-buyeo-fur-princess', 'awaken/w-20-gaya-smith-daughter', 'awaken/w-21-baekje-court-dancer', 'awaken/w-22-dongye-tiger-huntress', 'awaken/w-23-usisan-whale-queen', 'awaken/w-24-apdok-queen', 'awaken/w-25-bihwa-priestess', 'awaken/w-26-iseo-tomboy-general', 'awaken/w-27-mokji-jinha', 'awaken/w-28-michuhol-bira', 'awaken/w-29-golpo-janmul', 'awaken/w-30-guya-soebi', 'awaken/w-31-dabeol-dalbit', 'awaken/w-32-golbeol-budeul', 'awaken/w-33-gammun-gamsil', 'awaken/w-34-chopal-deulme', 'awaken/w-35-jomun-odi', 'awaken/w-36-baekje-maena', 'awaken/w-37-michuhol-gaennae', 'awaken/w-38-sangdang-bulmae', 'awaken/w-39-gosaburi-galmae', 'awaken/w-40-mujin-munui', 'awaken/w-41-hwanna-beodeul', 'awaken/w-42-gwanna-soenun', 'awaken/w-43-uga-nuri', 'awaken/w-44-okjeo-sogeumbi', 'awaken/w-45-tamna-oreumbi', 'awaken/w-46-geonma-maru', 'awaken/w-47-gosaburi-baram', 'awaken/w-48-mujin-mudeung', 'awaken/w-49-goryong-gureum', 'awaken/w-50-siljik-mulga', 'awaken/w-52-biryuna-songbi', 'awaken/w-53-hwanna-gabi', 'awaken/w-54-maga-dalli', 'awaken/w-55-guga-nuri', 'awaken/w-56-dongokjeo-sogeum', 'awaken/w-57-bullae-bakdal', 'awaken/w-58-tamna-halla', 'awaken/w-59-jomun-irang', 'awaken/w-60-golbeol-beom', 'awaken/w-61-iseo-sinae', 'awaken/w-62-byeokjin-byeol', 'awaken/w-63-us-haesol', 'awaken/w-64-miri-dallae', 'awaken/w-65-goguryeo-hwalmi', 'awaken/w-66-saro-noeul', 'awaken/w-67-buyeo-haedal', 'awaken/w-68-maek-beombal', 'awaken/w-69-jeoga-eomni', 'awaken/w-70-bukokjeo-mulbeom', 'awaken/w-71-yeonna-neoul', 'awaken/w-72-eumjeup-beol', 'awaken/w-73-samul-sagong', 'awaken/w-74-balla-dokmudeom', 'awaken/w-75-daegaya-soemoe', 'awaken/w-76-gampyeong-baetsagong', 'awaken/w-77-sabeol-malgalgi', 'awaken/w-78-wansan-wan', 'awaken/w-79-yangmaek-solmae', 'awaken/w-80-usan-gangchi', 'awaken/w-81-byeokjin-byeolbit', 'awaken/w-82-ungcheon-gom', 'awaken/w-83-gyeonji-beodeul', 'awaken/w-84-salhae-dallae', 'awaken/w-90-saro-danbi', 'awaken/w-91-saro-mulsae', 'awaken/w-92-saro-dallae', 'awaken/w-93-saro-beomi', 'awaken/w-94-mokji-dallae', 'awaken/w-95-michuhol-haebi', 'awaken/w-96-haengin-neoul', 'awaken/w-97-goguryeo-mir', 'awaken/w-98-byeonhan-danbi', 'awaken/w-99-garak-yucheongan', 'bust/g-01-master-smith', 'bust/g-03-sea-trader', 'bust/g-04-jinhan-giant', 'bust/g-05-mahan-chieftain', 'bust/g-06-strategist', 'bust/g-07-drunk-warrior', 'bust/g-08-veteran', 'bust/g-09-farmer-conscript', 'bust/g-10-buyeo-horse-lord', 'bust/g-11-gaya-iron-general', 'bust/g-12-silla-youth', 'bust/g-13-baekje-general', 'bust/g-15-shaman-man', 'bust/g-16-goguryeo-gaema-commander', 'bust/g-17-saro-isageum', 'bust/g-18-daegaya-king', 'bust/g-19-sabeol-veteran', 'bust/g-20-samul-sea-lord', 'bust/g-22-ungcheon-gomnae', 'bust/g-23-sangdang-soedal', 'bust/g-24-wansan-onsan', 'bust/g-25-balla-keunmoe', 'bust/g-26-gampyeong-gaetbeol', 'bust/g-27-maek-maekdol', 'bust/g-28-goguryeo-damul', 'bust/g-29-yeonna-myeongsol', 'bust/g-30-gwanna-soemoe', 'bust/g-32-uga-sodu', 'bust/g-33-jeoga-metdol', 'bust/g-34-bukokjeo-duman', 'bust/g-35-dabeol-dalgu', 'bust/g-36-gammun-gamdol', 'bust/g-37-eumjeup-jeup', 'bust/g-38-chopal-palmae', 'bust/g-40-anya-adan', 'bust/g-41-goja-bau', 'bust/g-42-dokro-garam', 'bust/g-43-hwanna-amnok', 'bust/g-44-maga-malgup', 'bust/g-45-dabeol-deulgae', 'bust/g-46-uga-nureongso', 'bust/g-47-guga-sanyanggae', 'bust/g-48-gwanna-musoe', 'bust/g-49-goguryeo-sona', 'bust/g-50-bullae-gwaha', 'bust/g-51-biryuna-mulgyeol', 'bust/g-52-tamna-oreum', 'bust/g-53-baekje-haeru', 'bust/g-55-saro-bakdal', 'bust/g-56-haseulla-gwahama', 'bust/g-57-bihwa-neup', 'bust/g-59-yangmaek-maekson', 'bust/g-60-eupcha-hangyeol', 'bust/g-60-golbeol-golgae', 'bust/g-61-heomcheuk-bawi', 'bust/g-62-beonye-hanul', 'bust/g-62-gammun-gamnamu', 'bust/g-63-heomcheuk-beogeum', 'bust/g-64-jumong', 'bust/g-64-michuhol-sogeumkkun', 'bust/g-65-goguryeo-damul', 'bust/g-66-buyeo-geumha', 'bust/g-66-geonma-malbalgup', 'bust/g-67-buyeo-daeso', 'bust/g-68-baekje-onnuri', 'bust/g-68-mujin-bitgoeul', 'bust/g-69-goryong-yong', 'bust/g-70-siljik-pado', 'bust/g-71-baekje-onjo', 'bust/g-73-baekje-eureum', 'bust/g-74-saro-hyeokgeose', 'bust/g-75-saro-hogong', 'bust/g-76-mokji-jinha', 'bust/g-78-saro-alpyeong', 'bust/g-79-saro-jibaekho', 'bust/g-80-saro-guryema', 'bust/g-82-saro-hojin', 'bust/g-83-mokji-keundol', 'bust/g-84-wander-seoneul', 'bust/g-85-wander-ure', 'bust/g-86-mokji-geumbawi', 'bust/g-87-wae-chief', 'bust/g-88-wander-soeul', 'bust/g-89-baekje-maryeo', 'bust/g-90-haengin-gomok', 'bust/g-93-jomun-solgae', 'bust/g-97-tahae', 'bust/l-L2-soseono', 'bust/l-L3-heo-hwangok', 'bust/l-L7-aryeong', 'bust/w-01-silla-princess', 'bust/w-02-goguryeo-lady', 'bust/w-03-goguryeo-archer', 'bust/w-04-gaya-swordswoman', 'bust/w-05-baekje-queen', 'bust/w-06-buyeo-huntress', 'bust/w-08-mahan-warrior', 'bust/w-10-pirate-captain', 'bust/w-100-garak-sincheongan', 'bust/w-101-garak-singwigan', 'bust/w-102-garak-dana', 'bust/w-103-tahae-neoul', 'bust/w-104-buyeo-darae', 'bust/w-11-assassin', 'bust/w-12-court-dancer', 'bust/w-13-young-archer', 'bust/w-14-feast-spy', 'bust/w-17-mahan-pearl-diver', 'bust/w-18-jinhan-salt-widow', 'bust/w-19-buyeo-fur-princess', 'bust/w-20-gaya-smith-daughter', 'bust/w-21-baekje-court-dancer', 'bust/w-22-dongye-tiger-huntress', 'bust/w-23-usisan-whale-queen', 'bust/w-24-apdok-queen', 'bust/w-25-bihwa-priestess', 'bust/w-26-iseo-tomboy-general', 'bust/w-27-mokji-jinha', 'bust/w-28-michuhol-bira', 'bust/w-29-golpo-janmul', 'bust/w-30-guya-soebi', 'bust/w-31-dabeol-dalbit', 'bust/w-32-golbeol-budeul', 'bust/w-33-gammun-gamsil', 'bust/w-34-chopal-deulme', 'bust/w-35-jomun-odi', 'bust/w-36-baekje-maena', 'bust/w-37-michuhol-gaennae', 'bust/w-38-sangdang-bulmae', 'bust/w-39-gosaburi-galmae', 'bust/w-40-mujin-munui', 'bust/w-41-hwanna-beodeul', 'bust/w-42-gwanna-soenun', 'bust/w-43-uga-nuri', 'bust/w-44-okjeo-sogeumbi', 'bust/w-46-geonma-maru', 'bust/w-47-gosaburi-baram', 'bust/w-48-mujin-mudeung', 'bust/w-49-goryong-gureum', 'bust/w-50-siljik-mulga', 'bust/w-51-haseulla-dangung', 'bust/w-52-biryuna-songbi', 'bust/w-53-hwanna-gabi', 'bust/w-54-maga-dalli', 'bust/w-55-guga-nuri', 'bust/w-56-dongokjeo-sogeum', 'bust/w-57-bullae-bakdal', 'bust/w-58-tamna-halla', 'bust/w-59-jomun-irang', 'bust/w-60-golbeol-beom', 'bust/w-61-iseo-sinae', 'bust/w-62-byeokjin-byeol', 'bust/w-63-us-haesol', 'bust/w-64-miri-dallae', 'bust/w-65-goguryeo-hwalmi', 'bust/w-66-saro-noeul', 'bust/w-67-buyeo-haedal', 'bust/w-68-maek-beombal', 'bust/w-69-jeoga-eomni', 'bust/w-70-bukokjeo-mulbeom', 'bust/w-71-yeonna-neoul', 'bust/w-72-eumjeup-beol', 'bust/w-73-samul-sagong', 'bust/w-74-balla-dokmudeom', 'bust/w-75-daegaya-soemoe', 'bust/w-76-gampyeong-baetsagong', 'bust/w-77-sabeol-malgalgi', 'bust/w-78-wansan-wan', 'bust/w-79-yangmaek-solmae', 'bust/w-80-usan-gangchi', 'bust/w-81-byeokjin-byeolbit', 'bust/w-82-ungcheon-gom', 'bust/w-83-gyeonji-beodeul', 'bust/w-84-salhae-dallae', 'bust/w-90-saro-danbi', 'bust/w-91-saro-mulsae', 'bust/w-92-saro-dallae', 'bust/w-93-saro-beomi', 'bust/w-94-mokji-dallae', 'bust/w-95-michuhol-haebi', 'bust/w-96-haengin-neoul', 'bust/w-97-goguryeo-mir', 'bust/w-98-byeonhan-danbi', 'bust/w-99-garak-yucheongan'])
/** 피격 그림 길 (realm/ 아래) — 없으면 null */
export const hitArtPath = (form: HitForm, bust: string | null | undefined): string | null =>
  bust !== null && bust !== undefined && HIT_ART.has(`${form}/${bust}`) ? `hit/${form}/${bust}.webp` : null

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x)
const mix = (a: number, b: number, s: number): number => a + (b - a) * s

/** 세기 0~1 — 잃은 체력 ÷ 최대 체력 ÷ hitPortraitBigLoss */
export const hitStrength = (loss: number, max: number): number => (max > 0 && loss > 0 ? clamp01(loss / max / P.render.hitPortraitBigLoss) : 0)

export interface HitLook { readonly ms: number; readonly shake: number; readonly red: number; readonly gray: number; readonly crack: number }
/** 세기 → 길이 · 흔들림 폭(px) · 붉은 빛 · 잿빛 막 · 금 짙기 */
export function hitLook(s: number): HitLook {
  const R = P.render, k = clamp01(s)
  return {
    ms: mix(R.hitPortraitMs, R.hitPortraitMsHard, k), shake: mix(R.hitPortraitShakeMin, R.hitPortraitShakeMax, k),
    red: mix(R.hitPortraitRedMin, R.hitPortraitRedMax, k), gray: mix(R.hitPortraitGrayMin, R.hitPortraitGrayMax, k), crack: mix(R.hitPortraitCrackMin, R.hitPortraitCrackMax, k),
  }
}

// ── 시간표 (u = 0~1) · CSS 키프레임과 같은 꼴
/** 흔들림 — [때, x, y] (폭 1 기준 · 잦아든다) */
const SHAKE: readonly (readonly [number, number, number])[] = [[0, 0, 0], [0.1, -1, 0.4], [0.25, 0.85, -0.3], [0.42, -0.55, 0.25], [0.6, 0.3, -0.1], [0.8, -0.12, 0], [1, 0, 0]]
/** 꺾은선 값 — [때, 값] 들 사이를 곧게 */
const ramp = (pts: readonly (readonly [number, number])[], u: number): number => {
  for (let i = 1; i < pts.length; i++) {
    const [u1, v1] = pts[i]!, [u0, v0] = pts[i - 1]!
    if (u <= u1) return u1 === u0 ? v1 : v0 + (v1 - v0) * ((u - u0) / (u1 - u0))
  }
  return pts[pts.length - 1]![1]
}
const RED: readonly (readonly [number, number])[] = [[0, 0], [0.08, 1], [0.6, 0], [1, 0]]
const GRAY: readonly (readonly [number, number])[] = [[0, 0], [0.12, 1], [0.4, 1], [1, 0]]
const CRACK: readonly (readonly [number, number])[] = [[0, 0], [0.04, 0], [0.08, 1], [0.45, 1], [0.9, 0], [1, 0]]
const ART: readonly (readonly [number, number])[] = [[0, 0], [0.06, 1], [0.7, 1], [1, 0]]
const pct = (u: number): string => `${Math.round(u * 100)}%`
const keyframes = (name: string, pts: readonly (readonly [number, number])[], peak: string): string =>
  `@keyframes ${name}{${pts.map(([u, v]) => `${pct(u)}{opacity:${v === 1 ? peak : v}}`).join('')}}`

// ── 금 (유리처럼 갈라진 줄) — 맞은 자리(가슴께)에서 뻗는 들쭉날쭉한 줄 + 둘레를 잇는 고리 조각 + 잔가지.
// 0~100 정사각 좌표 · 판 비율과 상관없이 가운데를 맞춰 덮는다(slice) · 판 셋을 돌려 쓴다.
// 굵기 세 층: 맞은 자리 가까이는 굵고 밝게, 끝으로 갈수록 가늘고 흐리게 (그러데이션 없이 · 폰 그래픽)
type Tier = 0 | 1 | 2
interface Poly { readonly t: Tier; readonly p: readonly number[] }
function makeCrack(seed: number): readonly Poly[] {
  let r = seed >>> 0
  const rnd = (): number => ((r = (Math.imul(r, 1664525) + 1013904223) >>> 0) / 4294967296)
  const cx = 36 + rnd() * 28, cy = 48 + rnd() * 18, rays = 7, steps = 5
  const out: Poly[] = [], spokes: [number, number][][] = []
  const seg = (t: Tier, ...pts: [number, number][]): void => { out.push({ t, p: pts.flat() }) }
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2 + rnd() * 0.6, len = 30 + rnd() * 34
    const pts: [number, number][] = [[cx, cy]]
    for (let k = 1; k <= steps; k++) { const d = (len * k) / steps, aa = a + (rnd() - 0.5) * 0.6; pts.push([cx + Math.cos(aa) * d, cy + Math.sin(aa) * d]) }
    spokes.push(pts)
    seg(0, pts[0]!, pts[1]!, pts[2]!); seg(1, pts[2]!, pts[3]!); seg(2, pts[3]!, pts[4]!, pts[5]!)
    // 잔가지 하나 (반쯤)
    if (rnd() < 0.5) { const b = pts[3]!, ba = a + (rnd() < 0.5 ? -1 : 1) * (0.5 + rnd() * 0.5), bl = 5 + rnd() * 7; seg(2, b, [b[0] + Math.cos(ba) * bl, b[1] + Math.sin(ba) * bl]) }
  }
  for (const [ring, t] of [[1, 0], [3, 1]] as const) for (let i = 0; i < rays; i++) {
    if (rnd() < 0.45) continue
    const a = spokes[i]![ring]!, b = spokes[(i + 1) % rays]![ring]!
    seg(t, a, [(a[0] + b[0]) / 2 + (rnd() - 0.5) * 5, (a[1] + b[1]) / 2 + (rnd() - 0.5) * 5], b)
  }
  return out
}
const CRACKS: readonly (readonly Poly[])[] = [makeCrack(17), makeCrack(7919), makeCrack(104729)]
const crackOf = (seed: number): readonly Poly[] => CRACKS[((seed % CRACKS.length) + CRACKS.length) % CRACKS.length]!
/** 층마다 [어두운 테 굵기, 밝은 줄 굵기, 짙기] (px · 캔버스는 짧은 변 300px 기준으로 늘고 준다) */
const TIER: readonly (readonly [number, number, number])[] = [[3.2, 1.4, 1], [2.4, 1, 0.75], [1.8, 0.7, 0.5]]
const crackD = (seed: number, t: Tier): string => crackOf(seed).filter((q) => q.t === t).map((q) => {
  let d = ''
  for (let i = 0; i < q.p.length; i += 2) d += `${i === 0 ? 'M' : 'L'}${q.p[i]!.toFixed(1)} ${q.p[i + 1]!.toFixed(1)}`
  return d
}).join('')
const crackSvg = (seed: number): string => `<svg class="hitp-crack" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">${([0, 1, 2] as const).map((t) => {
  const d = crackD(seed, t), [dw, lw, op] = TIER[t]!
  return `<g opacity="${op}"><path class="d" style="stroke-width:${dw}px" d="${d}"/><path class="l" style="stroke-width:${lw}px" d="${d}"/></g>`
}).join('')}</svg>`

// ── DOM
const CSS = `
.hitp{position:absolute;inset:var(--hitp-inset,0);pointer-events:none;overflow:hidden;border-radius:inherit}
.hitp>*{position:absolute;left:0;top:0;width:100%;height:100%;opacity:0;animation-duration:var(--hitp-ms,280ms);animation-timing-function:linear;animation-delay:var(--hitp-delay,0s);animation-fill-mode:both;animation-iteration-count:1}
.hitp>.hitp-gray{background:#454851;animation-name:hitp-gray}
.hitp>.hitp-red{background:#ff2a18;box-shadow:inset 0 0 28px 10px #9a0500;animation-name:hitp-red}
.hitp>.hitp-crack{display:block;animation-name:hitp-crack}
.hitp>.hitp-art{object-fit:cover;object-position:var(--hitp-pos,50% 15%);animation-name:hitp-art;animation-duration:var(--hitp-art-ms,420ms)}
.hitp-crack path{fill:none;vector-effect:non-scaling-stroke;stroke-linejoin:miter;stroke-linecap:square}
.hitp-crack .d{stroke:#1a0503;stroke-opacity:.7}
.hitp-crack .l{stroke:#fff6ee}
${keyframes('hitp-red', RED, 'var(--hitp-red)')}
${keyframes('hitp-gray', GRAY, 'var(--hitp-gray)')}
${keyframes('hitp-crack', CRACK, 'var(--hitp-crack)')}
${keyframes('hitp-art', ART, '1')}
`
let cssDone = false
/** 겉막 CSS 를 한 번 넣는다 (DOM 이 없으면 아무것도 안 함) */
export function ensureHitPortraitCss(): void {
  if (cssDone || typeof document === 'undefined') return
  cssDone = true
  const st = document.createElement('style'); st.id = 'hit-portrait-css'; st.textContent = CSS; document.head.append(st)
}

export interface HitHtmlOpts {
  /** 시작을 늦출 때 (CSS 시간 · 본편 합전은 var(--hd)) */
  readonly delay?: string
  /** 피격 그림 주소 (hitArtPath 앞에 그림 뿌리를 붙인 것) · 없으면 코드 효과만 */
  readonly art?: string | null
  /** 그림 자리 (object-position) */
  readonly pos?: string
  /** 판 안쪽으로 들일 몫 (액자 안 그림만 덮을 때 · CSS 길이) */
  readonly inset?: string
  /** 금 꼴 고르기 */
  readonly seed?: number
}
/** 겉막 조각 — 판(position 있는 칸) 안에 넣으면 들어가는 순간(또는 delay 뒤) 한 번 돈다 */
export function hitPortraitHtml(s: number, o: HitHtmlOpts = {}): string {
  const L = hitLook(s)
  const vars = [`--hitp-ms:${Math.round(L.ms)}ms`, `--hitp-red:${L.red.toFixed(2)}`, `--hitp-gray:${L.gray.toFixed(2)}`, `--hitp-crack:${L.crack.toFixed(2)}`, `--hitp-art-ms:${Math.round(P.render.hitPortraitArtMs)}ms`]
  if (o.delay !== undefined) vars.push(`--hitp-delay:${o.delay}`)
  if (o.pos !== undefined) vars.push(`--hitp-pos:${o.pos}`)
  if (o.inset !== undefined) vars.push(`--hitp-inset:${o.inset}`)
  const art = o.art !== null && o.art !== undefined ? `<img class="hitp-art" src="${o.art.replace(/"/g, '&quot;')}" alt="">` : ''
  return `<span class="hitp" aria-hidden="true" style="${vars.join(';')}">${art}<i class="hitp-gray"></i><i class="hitp-red"></i>${crackSvg(o.seed ?? 0)}</span>`
}

const live = new WeakMap<HTMLElement, { t0: number; seed: number }>()
let seedNext = 0
const calm = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
/**
 * 지금 맞았다 — 판(host · position 있는 칸)에 겉막을 새로 끼우고(애니가 처음부터) 작은 흔들림을 한 번.
 * hitPortraitGapMs 안에 또 오면 무시한다 (연타에 깜빡이지 않게). 흔들림은 shake 칸(기본 host)에 transform 한 번 · 움직임 줄이기면 안 흔든다.
 */
export function hitPortrait(host: HTMLElement, s: number, o: { readonly art?: string | null; readonly pos?: string; readonly shake?: HTMLElement | null } = {}): void {
  ensureHitPortraitCss()
  const now = performance.now(), was = live.get(host)
  if (was !== undefined && now - was.t0 < P.render.hitPortraitGapMs) return
  const seed = seedNext++
  live.set(host, { t0: now, seed })
  host.querySelector(':scope > .hitp')?.remove()
  host.insertAdjacentHTML('beforeend', hitPortraitHtml(s, { seed, ...(o.art !== undefined ? { art: o.art } : {}), ...(o.pos !== undefined ? { pos: o.pos } : {}) }))
  const el = o.shake === undefined ? host : o.shake
  if (el === null || calm() || typeof el.animate !== 'function') return
  const L = hitLook(s), a = L.shake, size = Math.max(1, Math.min(el.clientWidth || 1, el.clientHeight || 1))
  const k = 1 + (2.2 * a) / size   // 가장자리 바탕이 드러나지 않게 아주 조금 키운 채 흔든다
  el.animate(SHAKE.map(([u, x, y]) => ({ offset: u, transform: u === 0 || u === 1 ? 'none' : `translate(${(x * a).toFixed(1)}px,${(y * a).toFixed(1)}px) scale(${k.toFixed(3)})` })), { duration: L.ms, easing: 'linear' })
}

// ── 캔버스
export interface HitFrame {
  /** 흔들림 (px) */
  readonly dx: number; readonly dy: number
  readonly red: number; readonly gray: number; readonly crack: number
  /** 피격 그림 짙기 (0~1) */
  readonly art: number
  readonly seed: number
}
/** 맞은 때 기억 — 그리는 쪽이 쥔다 (판 상태가 아니다) */
export class HitClock {
  private t0 = -1e9
  private s = 0
  private seed = 0
  /** 지금 맞았다 (now = ms) */
  hit(now: number, s: number): void {
    if (now - this.t0 < P.render.hitPortraitGapMs) { this.s = Math.max(this.s, s); return }
    if (now - this.t0 >= hitLook(this.s).ms) this.seed++   // 이어 맞으면 금 꼴은 그대로 (바뀌면 깜빡인다)
    this.t0 = now; this.s = s
  }
  reset(): void { this.t0 = -1e9; this.s = 0 }
  /** 지금 그릴 값 · 끝났으면 null */
  at(now: number, calmMotion = false): HitFrame | null {
    const age = now - this.t0, L = hitLook(this.s), artMs = P.render.hitPortraitArtMs
    if (age < 0 || age >= Math.max(L.ms, artMs)) return null
    const u = age / L.ms
    let dx = 0, dy = 0
    if (u < 1 && !calmMotion) for (let i = 1; i < SHAKE.length; i++) {
      const [u1, x1, y1] = SHAKE[i]!, [u0, x0, y0] = SHAKE[i - 1]!
      if (u <= u1) { const f = (u - u0) / (u1 - u0); dx = (x0 + (x1 - x0) * f) * L.shake; dy = (y0 + (y1 - y0) * f) * L.shake; break }
    }
    const in1 = u < 1
    return { dx, dy, red: in1 ? ramp(RED, u) * L.red : 0, gray: in1 ? ramp(GRAY, u) * L.gray : 0, crack: in1 ? ramp(CRACK, u) * L.crack : 0, art: ramp(ART, Math.min(1, age / artMs)), seed: this.seed }
  }
}

/**
 * 캔버스 초상 위에 겉막 — 잿빛 막 · 붉은 빛 · 금. 흔들림(f.dx·dy)은 그리는 쪽이 초상 자리에 먼저 더한다.
 * shape: 'rect'(모서리 r) 또는 'circle'(x,y,w,h 에 꼭 맞는 원)
 */
export function drawHitPortrait(ctx: CanvasRenderingContext2D, f: HitFrame, x: number, y: number, w: number, h: number, shape: 'rect' | 'circle' = 'rect', r = 0): void {
  if (f.red <= 0.001 && f.gray <= 0.001 && f.crack <= 0.001) return
  const base = ctx.globalAlpha   // 바깥에서 건 투명도(들어오는 암전 등)에 곱한다
  ctx.save()
  ctx.beginPath()
  if (shape === 'circle') ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) / 2, 0, Math.PI * 2)
  else if (r > 0 && typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, r)
  else ctx.rect(x, y, w, h)
  ctx.clip()
  if (f.gray > 0.001) { ctx.globalAlpha = base * f.gray; ctx.fillStyle = '#454851'; ctx.fillRect(x, y, w, h) }
  if (f.red > 0.001) { ctx.globalAlpha = base * f.red; ctx.fillStyle = '#ff2a18'; ctx.fillRect(x, y, w, h) }
  if (f.crack > 0.001) {
    // SVG 의 slice 와 같게: 0~100 정사각을 긴 변에 맞추고 가운데로
    const k = Math.max(w, h) / 100, ox = x + (w - 100 * k) / 2, oy = y + (h - 100 * k) / 2, px = Math.max(0.6, Math.min(w, h) / 300)
    ctx.lineJoin = 'miter'; ctx.lineCap = 'square'
    const polys = crackOf(f.seed)
    for (const t of [0, 1, 2] as const) {
      const [dw, lw, op] = TIER[t]!
      ctx.beginPath()
      for (const q of polys) {
        if (q.t !== t) continue
        ctx.moveTo(ox + q.p[0]! * k, oy + q.p[1]! * k)
        for (let i = 2; i < q.p.length; i += 2) ctx.lineTo(ox + q.p[i]! * k, oy + q.p[i + 1]! * k)
      }
      ctx.globalAlpha = base * f.crack * op * 0.7; ctx.strokeStyle = '#1a0503'; ctx.lineWidth = dw * px; ctx.stroke()
      ctx.globalAlpha = base * f.crack * op; ctx.strokeStyle = '#fff6ee'; ctx.lineWidth = lw * px; ctx.stroke()
    }
  }
  ctx.restore()
}
