/**
 * 열전 출전 배너 · 지도 위 열전 표적 (형 11-22 「열전 시작 버튼도 너무 텍스트 · 한 달에 한 캐릭터만 한 번」 → 「제안한 대로 해 봐」).
 *  - 글은 고을 이름과 스테이지 이름 둘뿐 · 나머지는 그림: 스테이지 바탕 · 문장 · 그 스테이지 거대 보스의 그림자 · 보상(곡식 · 쇠 · 상자)
 *  - 고를 장수는 얼굴 고리(hero-ring.ts)가 그린다 — 큰 초상 · 능력치 · 전투 그림이 움직인다 · 완료 단추는 아래 붙박이(.hrg-go)
 *  - 폰 그래픽 한도: 부드러운 linear-gradient · 움직이는 filter 를 쓰지 않는다 (단색 막 · 작은 transform 만)
 * 이름은 rb- 접두 (다른 화면과 겹치지 않게) · 지도 표시는 .rbty(표적) · .rpac(평정 깃발)
 */
import { HAEBI_STAGES } from '../../tune/params.ts'
import type { RaidStage } from '../../realm/raid-bounty.ts'

const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

export interface RaidBannerData {
  readonly stage: RaidStage
  /** 표적 고을 이름 · 표적 없이 장수 판에서 열면 '' */
  readonly place: string
  readonly grain: number
  readonly iron: number
  readonly grainIcon: string
  readonly ironIcon: string
}

/** 배너 — art 는 realm/ 까지의 주소. small: 장수 판 안의 작은 판 */
export function raidBannerHtml(art: string, b: RaidBannerData, small = false): string {
  const st = HAEBI_STAGES[b.stage]
  const reward = b.place !== ''
    ? `<span class="rb-rw"><i><img src="${art}icon/${b.grainIcon}.png" alt="">${b.grain}</i><i><img src="${art}icon/${b.ironIcon}.png" alt="">${b.iron}</i><i><img src="${art}raid/chest.png" alt=""></i></span>` : `<span class="rb-rw"><i><img src="${art}raid/coins.png" alt=""></i><i><img src="${art}raid/chest.png" alt=""></i></span>`
  return `<div class="rb-ban${small ? ' sm' : ''}" style="--rb-bg:url('${art}raid/${st.bg}')">`
    + `<img class="rb-boss" src="${art}raid/boss-face-${b.stage}.webp" alt="">`
    + `<img class="rb-em" src="${art}raid/emblem-${b.stage}.png" alt="">`
    + `<span class="rb-t">${b.place !== '' ? `<b>${esc(b.place)}</b>` : ''}<span>${esc(st.name)}</span></span>${reward}</div>`
}

export const RAID_BANNER_CSS = `
/* 지도 위 열전 표적 — 고을 위에 스테이지 문장이 숨 쉰다 */
.map .nd .rbty { position: absolute; display: block; box-sizing: border-box; left: 50%; top: -34%; z-index: 7; width: clamp(40px, 140%, 64px); height: auto; aspect-ratio: 1; min-height: 0; padding: 0; overflow: hidden; transform: translate(-50%, -100%); border: 2px solid #ffd27a; border-radius: 50%; background: #1b120a; box-shadow: 0 0 0 3px #00000099, 0 0 16px #ffb84a; cursor: pointer; animation: rbbreath 1.5s ease-in-out infinite alternate; }
.map .nd .rbty img { position: absolute; inset: 8%; width: 84%; height: 84%; max-width: none; object-fit: contain; pointer-events: none; }
.map .nd .rbty.shut { animation: none; border-color: #6a5a48; box-shadow: 0 0 0 3px #00000088; opacity: .7; }
.map .nd .rbty.shut img { opacity: .45; }
.map .nd .rbty i { position: absolute; right: 2%; bottom: 0; font-style: normal; font-size: 16px; }
@keyframes rbbreath { from { transform: translate(-50%, -100%) scale(1); } to { transform: translate(-50%, -106%) scale(1.12); } }
@media (prefers-reduced-motion: reduce) { .map .nd .rbty { animation: none; } }
/* 평정한 고을 — 작은 문장 깃발 · 막 평정했으면 한 번 튀어 오른다 */
.map .nd .rpac { position: absolute; display: block; box-sizing: border-box; right: -14px; top: -6px; z-index: 3; width: clamp(22px, 50%, 34px); height: auto; aspect-ratio: 1; overflow: hidden; border-radius: 50%; background: #1b120ae0; border: 1.5px solid #9fe08a; box-shadow: 0 0 0 2px #0008; }
.map .nd .rpac img { position: absolute; inset: 0; width: 100%; height: 100%; max-width: none; object-fit: contain; }
.map .nd .rpac.fresh { animation: rbpop .7s cubic-bezier(.2, 1.6, .4, 1) both; }
@keyframes rbpop { from { transform: scale(0); } to { transform: scale(1); } }

/* 출전 배너 — 스테이지 바탕 위 문장 · 이름 · 보스 그림자 · 보상 */
.ap .rb-ban { position: relative; display: flex; align-items: center; gap: 10px; min-height: 92px; padding: 10px 12px; box-sizing: border-box; border: 1px solid #b99a57; border-radius: 12px; overflow: hidden; background: #1b130c var(--rb-bg) center / cover no-repeat; color: #f3e8d2; text-shadow: 0 1px 3px #000, 0 0 8px #000; }
.ap .rb-ban::before { content: ''; position: absolute; inset: 0; background: #0d0905a8; }
.ap .rb-ban > * { position: relative; }
.ap .rb-boss { position: absolute; right: -4px; bottom: 0; height: 118%; max-width: 46%; object-fit: contain; object-position: right bottom; filter: brightness(.22) saturate(.4); opacity: .95; pointer-events: none; }
.ap .rb-em { flex: none; width: 62px; height: 62px; object-fit: contain; filter: drop-shadow(0 2px 6px #000); }
.ap .rb-t { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.ap .rb-t b { font-size: 19px; color: #ffe2a0; line-height: 1.15; }
.ap .rb-t span { font-size: 14px; color: #e9dcc0; }
.ap .rb-rw { position: absolute; left: 12px; bottom: 6px; display: flex; gap: 6px; }
.ap .rb-ban:has(.rb-rw) { padding-bottom: 34px; }
.ap .rb-rw i { display: inline-flex; align-items: center; gap: 2px; padding: 1px 7px 1px 2px; border-radius: 999px; background: #000a; border: 1px solid #7a6340; font-style: normal; font-weight: 800; font-size: 13px; color: #ffe2a0; }
.ap .rb-rw img { width: 22px; height: 22px; object-fit: contain; }
.ap .rb-ban.sm { min-height: 76px; } .ap .rb-ban.sm .rb-em { width: 48px; height: 48px; } .ap .rb-ban.sm .rb-t b { font-size: 16px; }
/* 장수 판 안의 작은 열전 판 — 배너 + 큰 출전 단추 (잠기면 자물쇠와 다음 달) */
.ap .rb-card { margin: 12px 0; display: flex; flex-direction: column; gap: 8px; }
.ap .rb-card .btn.rb-go { min-height: 48px; font-size: 18px; font-weight: 800; }
.ap .rb-card .rb-lock { display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; border-radius: 10px; background: #1a140e; border: 1px dashed #6a5a48; color: #cbbf9f; font-size: 14px; }
/* 표적 창 — 얼굴 고리 위에 배너 (고리의 .hrg-top 자리) · 아래 붙박이 출전 단추 */
.ap .rbov { position: absolute; inset: 0; z-index: 92; background: #0b0907; }
.ap .rbov .rb-x { position: absolute; z-index: 9; right: max(4px, env(safe-area-inset-right)); top: calc(env(safe-area-inset-top) + 2px); width: 44px; height: 44px; border: 0; background: none; color: #e9dcc0; font-size: 20px; text-shadow: 0 1px 4px #000; cursor: pointer; }
.ap .rbov .hrg-top .rb-ban { margin-right: 40px; max-width: 520px; }
.ap .rbov .hrg-go .rb-go { font-size: 19px; font-weight: 800; }
/* 폰 가로: 배너가 왼쪽 큰 초상의 얼굴을 가렸다(11-23 형 「가로 화면 이거 머리 가리는데」) → 오른쪽 얼굴 고리 위 빈자리로 · 고리는 그만큼 내림 */
@media (orientation: landscape) {
  .ap .rbov .hrg-top { left: calc(50cqw + 12px); right: 56px; width: auto; }
  .ap .rbov .hrg-top .rb-ban { margin-right: 0; min-height: 76px; max-width: none; }
  .ap .rbov .hrg-wheel { padding-top: calc(env(safe-area-inset-top) + 104px); }
}
`
