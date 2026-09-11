/**
 * 성장 화면 — 그리고 **재정비**(여정 종료) 화면
 *
 * 사용자의 말: **"성장을 알 수도 없잖아"**. 그래서 이 화면의 규칙은 하나다.
 * **레벨 숫자를 보여주는 게 아니라, 올리면 몸이 어떻게 달라지는지를 문장으로 나란히 보여준다.**
 *   지금: 만작을 4.2초 버틴다
 *   →     만작을 4.4초 버틴다
 * 문장은 전부 progression.effectOf()가 sim/bow.ts의 실제 물리 계수에서 뽑는다.
 * 화면이 활보다 후하게 말하는 일은 없다.
 *
 * 여는 데 클릭 1회(HUD 버튼 또는 Tab), 닫는 데 1회 (C1).
 * 판이 끝나 훈련치가 들어오면 버튼에 점 하나가 켜질 뿐, 모달로 막지 않는다.
 *
 * ── 재정비 (2026-09-02) ──
 * 형: "여자친구가 해봤는데 11까지 가고 어려워서 안하겠대. 아마 강화하는걸 안해봤나봐.
 *      죽고나서 강화하는거 바로화면에 띄워줘야 하지 않을까? 하단에 '다음'버튼도 만들어서
 *      활 고르기로 가서 고른다음 시작하게 하고."
 * 맞았다 — 실측으로 성장 없는 11판은 숙련 봇도 못 깬다 (params.ts convertHpEase).
 * 그래서 여정이 끝나면 **결과 머리 + 이 성장 줄 + '다음'** 이 한 화면이다. 죽음이 곧 상점이다
 * (아처로·뱀서의 문법 — docs/GAP.md 6절). 스탯 줄은 두 화면이 **같은 코드**를 쓴다 —
 * 문장·비용·추천이 두 벌이면 언젠가 어긋난다.
 */
import {
  canGrow,
  effectAfterLevel,
  effectOf,
  recommendReason,
  recommendStat,
  spendTraining,
  statLabel,
  STAT_KEYS,
  trainingCost,
  type StatKey,
} from '../game/progression.ts'
import { BOW_KINDS, bowKind, masteryLevel, MASTERY_HITS, type BowKindId } from '../game/bows.ts'
import { FORGE_PARTS, buyForge, forgeBlocked, forgeCost, forgeEffect, forgeLevel, forgeMax } from '../game/forge.ts'
import { armorForgeBlocked, armorForgeEffect, armorForgeMax, armorKind, armorKindOf, armorLevel, buyArmorForge } from '../game/armor.ts'
import { bowIconSvg } from './arrowicons.ts'
import { onSaveChanged, wipeSave, writeSave, type SaveData } from '../game/save.ts'
import { unlockedBows, unlockOfBow } from '../game/unlocks.ts'
import { P } from '../tune/params.ts'
import type { Overlay } from './overlay.ts'
import { COIN_ICON, coinHtml, coinText } from '../game/money.ts'
import { attachDetail } from './detail.ts'
import { makeTabs } from './tabs.ts'
import { mountInstall } from './install.ts'
import { makeWheel } from './wheel.ts'

const PANEL_ID = 'growth'
/** public/ 자산의 경로 머리 (ui/overlay.ts 와 같다). */
// 헤드리스 프로브(node)에는 env 가 없다 — 그때는 '/'. 브라우저에서는 빌드가 준 값만 쓴다.
const BASE: string = import.meta.env?.BASE_URL ?? '/'
const REINFORCE_ID = 'reinforce'
/** 올린 직후 그 줄이 잠깐 밝아진다. 무엇이 바뀌었는지 눈이 따라가게 (ms). */
const FLASH_MS = 900

const CSS = `
.g-h { display: flex; align-items: baseline; gap: 14px; }
.g-h h2 { flex: 1; }
/* 안내는 제목과 지갑 사이에 낀다 — margin-left:auto 를 쓰면 지갑을 밀어낸다. */
.g-h .hb-tip { margin-left: 0; }
.g-h h3 { flex: 1; margin: 0; color: var(--ink); font-size: 19px; }
/* 훈련치는 이 화면에서 유일하게 '쓸 수 있는 것'이다. 숫자를 크게 세운다. */
.g-train { display: flex; align-items: center; color: var(--dim); font-size: 13px; letter-spacing: .12em; }
/* 엽전은 **숫자에 맞춰** 키운다. 13px 짜리 글자 기준으로 두니 점처럼 보였다 (2026-09-11). */
.g-train .hb-coin { width: 22px; height: 22px; margin-right: 7px; vertical-align: 0; }
.g-train b { color: var(--accent); font-weight: 700; font-size: 24px; letter-spacing: 0; }

.g-row {
  display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 2px 18px;
  /* 2026-09-11 — 줄 하나가 네 줄짜리라 여백까지 크면 네 스탯이 화면을 다 먹는다. */
  padding: 11px 0 10px; border-top: 1px solid var(--line);
  transition: background .3s;
}
.g-row:first-of-type { border-top: none; }
/* 올린 직후 한 번 번쩍. 배경만 — 한쪽만 두꺼운 테두리는 쓰지 않는다. */
.g-row.g-flash { background: #ffb34722; }
.g-name { color: var(--ink); font-weight: 700; font-size: 17px; letter-spacing: -.01em; }
/* 스탯 아이콘 — game-icons.net (public/icons/출처.txt). 글자보다 먼저 읽히라고 크게 둔다. */
.g-ic { width: 26px; height: 26px; margin-right: 11px; color: var(--gold); vertical-align: -6px; }
.g-row.g-flash .g-ic { color: var(--accent); }
.g-lv { color: var(--mute); font-size: 13px; margin-left: 10px; }
.g-now { grid-column: 1; color: var(--body); }
.g-next { grid-column: 1; color: var(--teal); font-size: 13px; }
.g-next.g-flat { color: var(--mute); }
.g-why { grid-column: 1; color: var(--accent); font-size: 12px; display: none; }
.g-up { grid-column: 2; grid-row: 1 / span 4; min-width: 108px; justify-content: center; }
/* ── 추천 줄 ── 처음 보는 사람이 어디를 눌러야 하는지 한 줄이 먼저 말한다 (progression.recommendStat).
   배경 한 겹과 작은 꼬리표 — 화면을 가리는 화살표·튜토리얼 손가락은 쓰지 않는다 (GDD 9장). */
.g-row.g-rec { background: #ffb3470f; }
.g-row.g-rec .g-why { display: block; }
.g-row.g-rec .g-up:not([disabled]) { border-color: var(--accent); color: var(--accent); }
.g-tag {
  display: none; margin-left: 10px; padding: 1px 7px; border: 1px solid var(--accent); border-radius: 2px;
  color: var(--accent); font-size: 11px; letter-spacing: .1em; vertical-align: 2px; font-weight: 600;
}
.g-row.g-rec .g-tag { display: inline-block; }
/* 폰 세로 — 오른쪽 버튼 칸까지 두면 문장이 한 글자씩 접힌다. 버튼을 아래 줄로 내린다. */
@media (max-width: 480px) {
  .g-row, .g-bow { grid-template-columns: 1fr; }
  .g-up, .g-bow .g-bpick { grid-column: 1; grid-row: auto; justify-self: start; margin-top: 8px; }
  .g-h { flex-wrap: wrap; gap: 6px 14px; }
}
.g-cost { color: var(--accent); }
.g-up[disabled] .g-cost { color: inherit; }

/* ── 활 걸이 ── 돌아가는 걸이 하나 + 그 아래 '드는' 줄 (2026-09-11, ui/wheel.ts).
   줄 다섯을 세우던 CSS 는 통째로 없앴다 — 목록이 아니라 걸이가 됐다. */
.g-bows h3 {
  display: flex; align-items: baseline; gap: 10px;
  color: var(--dim); font-size: 13px; letter-spacing: .12em; margin: 0 0 6px;
}
/* 앞에 나온 활이 무엇이고 지금 무엇을 드는가 — 한 줄. 자리를 늘 잡아 둔다(출렁임 금지). */
.g-brack { color: var(--teal); font-size: 13px; min-height: 34px; margin-top: 6px; line-height: 1.45; }
.g-brack b { color: var(--ink); font-weight: 700; font-family: inherit; }
.g-brack i { color: var(--mute); font-style: normal; }
.g-btake { min-width: 132px; justify-content: center; }
.g-btake:not([disabled]) { border-color: var(--accent); color: var(--accent); }

/* 아래 줄 — 탭 화면의 foot 안에 든다. 여기서는 테두리·여백을 안 준다 (foot 이 이미 준다). */
.g-foot { display: flex; align-items: center; gap: 14px; flex: 1; }
.g-foot label { display: flex; align-items: center; gap: 9px; cursor: pointer; color: var(--body); }
.g-foot input { accent-color: var(--teal); width: 16px; height: 16px; }
.g-hint { color: var(--mute); font-size: 13px; flex: 1; text-align: right; }

/* ── 처음부터 ── 파괴적인 버튼은 구석에 작게, 대신 문구는 정직하게. */
.g-danger { display: flex; align-items: center; gap: 10px; flex: none; }
.g-danger .hb-btn { font-size: 13px; color: var(--mute); }
/* 경고문은 평소엔 감춘다 — 아래 줄은 좁다. 대신 **무장하면 그 자리에 뜬다.** */
.g-danger span { display: none; color: #ff8a6a; font-size: 12px; }
.g-danger.g-warn span { display: block; }
/* 1단계를 누르면 버튼이 위험색으로 바뀐다 — "정말인가"를 색이 먼저 묻는다. */
.g-danger .hb-btn.g-armed { color: #ff8a6a; border-color: #ff6a4577; }

/* ── 강화 머리 ── 수렵총 벽화 (고구려, public/art/출처.txt).
   형: **"대장간은 이미지 잇으니 강화도 이미지 있어야지."**
   맞다. 한 화면에서 한쪽에만 그림이 있으면, 그림 없는 쪽은 덜 만든 칸으로 읽힌다.
   호랑이를 쫓는 기마 궁수 — **몸을 키우는** 칸의 그림으로 이만한 게 없다.
   (끝난 화면에서 내려온 그림이다. 좋은 그림을 버리지는 않는다.)
   대장간 머리(.f-h)와 **같은 뼈대**로 쓴다 — 둘이 다르게 생기면 그 차이가 먼저 보인다. */
.s-h {
  position: relative; display: flex; align-items: flex-end; gap: 12px; margin: 0 -8px 8px; padding: 70px 14px 10px;
  overflow: hidden; border-radius: 2px;
  background:
    linear-gradient(to bottom, rgba(38, 37, 33, .35), rgba(47, 46, 41, .9) 75%, var(--paper) 100%),
    url(${BASE}art/suryeopchong.jpg) center 9% / cover no-repeat;
  min-height: 132px;
}
.s-h h3 { flex: 1; margin: 0; color: var(--ink); font-size: 17px; letter-spacing: .08em; }
.s-h .f-cap { position: absolute; right: 10px; top: 8px; color: rgba(255, 244, 220, .6); font-size: 11px; letter-spacing: .06em; }
/* 낮은 화면에서는 둘 다 납작해진다 — 그림보다 줄이 먼저다. */
@media (max-height: 560px) {
  .s-h, .f-h { min-height: 0; padding: 16px 12px 8px; }
  .s-h .f-cap, .f-h .f-cap { display: none; }
}

/* ── 대장간 ── 활 개조. 스탯 줄과 같은 뼈대(이름 · 지금 → 다음 · 버튼)라 한 화면으로 읽힌다. */
/* 대장간 머리 — 김홍도 「대장간」 (public/art/출처.txt). 형: "대장간도 대장간스러운 이미지". */
.f-h {
  position: relative; display: flex; align-items: flex-end; gap: 12px; margin: 20px -8px 0; padding: 70px 14px 10px;
  overflow: hidden; border-radius: 2px;
  background:
    linear-gradient(to bottom, rgba(38, 37, 33, .35), rgba(47, 46, 41, .9) 75%, var(--paper) 100%),
    url(${BASE}art/daejanggan.jpg) center 62% / cover no-repeat;
  min-height: 132px;
}
.f-h h3 { flex: 1; margin: 0; color: var(--ink); font-size: 17px; letter-spacing: .08em; }
.f-h .f-bow { color: var(--accent); font-weight: 700; font-size: 15px; }
.f-h .f-cap { position: absolute; right: 10px; top: 8px; color: rgba(255, 244, 220, .6); font-size: 11px; letter-spacing: .06em; }
.f-row { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 2px 20px; padding: 11px 0 10px; border-top: 1px solid var(--line); }
.f-row:first-of-type { border-top: none; }
.f-row.g-flash { background: #ffb34722; }
.f-name { color: var(--ink); font-weight: 700; font-size: 15px; }
.f-name .f-origin { color: var(--mute); font-size: 12px; margin-left: 8px; letter-spacing: .04em; font-weight: 500; }
.f-lv { color: var(--mute); font-size: 12px; margin-left: 8px; }
.f-now { grid-column: 1; color: var(--body); font-size: 13px; }
.f-next { grid-column: 1; color: var(--teal); font-size: 12px; }
.f-next.g-flat { color: var(--mute); }
.f-up { grid-column: 2; grid-row: 1 / span 3; min-width: 96px; justify-content: center; }
.f-up .g-cost { color: var(--accent); }
.f-up[disabled] .g-cost { color: inherit; }
@media (max-width: 480px) {
  .f-row { grid-template-columns: 1fr; }
  .f-up { grid-column: 1; grid-row: auto; justify-self: start; margin-top: 6px; }
}

/* ── 끝난 화면 머리 ── (2026-09-11 다시 짬)
   형: **"실패화면에는 수렵총 말고 다른걸 써야겠는데. 아예 이미지 안 쓰고 Game Over를 크게
        쓰던가. 143판보다 게임오버가 더 중요하잖아. 왤케 텍스트가 쓸데없이 많아."**

   맞다. 벽화가 머리의 절반을 먹고 그 위에 줄이 여섯 얹혀 있었다. 죽은 직후에 읽히는 글은
   한두 줄이다 — 나머지는 있어도 안 읽고, 있어서 첫 줄까지 안 읽힌다.
   이제 **제일 큰 것은 GAME OVER 하나**고, 판 수는 그 아래 한 줄로 내려갔다.
   (벽화는 버리지 않았다 — 아래 '강화' 머리(.s-h)로 옮겼다.) */
.r-head { text-align: center; padding: 14px 10px 16px; margin: -4px -8px 4px; border-bottom: 1px solid var(--line); }
.r-over {
  font-weight: 700; letter-spacing: .14em; line-height: 1.05; font-size: 52px;
  color: #e2543f; text-shadow: 0 2px 20px rgba(226, 84, 63, .3);
}
/* 접은 것은 실패가 아니다 — 같은 자리에 같은 크기로, 색만 죽인다. */
.r-over.r-quit { color: var(--dim); text-shadow: none; letter-spacing: .1em; }
.r-why { color: var(--body); font-size: 13px; margin-top: 8px; line-height: 1.5; }
/* 판 수는 **둘째**다. 48px 짜리 주인공이던 줄을 기록과 한 줄로 합쳤다. */
.r-stage { color: var(--dim); font-size: 14px; margin-top: 12px; }
.r-stage b { font-family: var(--num); font-size: 26px; color: var(--ink); font-weight: 700; margin-right: 2px; }
.r-stage i { font-style: normal; margin-left: 10px; }
.r-stage i.r-new { color: var(--accent); font-weight: 700; }
.r-keep { color: var(--body); margin-top: 10px; font-size: 14px; }
.r-keep b { color: var(--accent); font-weight: 700; }
.r-dot { color: var(--dim); margin: 0 8px; }
/* 아래 줄 — 지갑과 '돌아간다' 하나. 탭의 foot 안에 들어가 **늘 보인다**.
   (예전엔 줄 맨 아래에 있어서, 강화 줄을 다 굴려 내려야 '다음'이 나왔다.) */
.r-foot { display: flex; align-items: center; gap: 14px; flex: 1; justify-content: space-between; }
.r-go { font-size: 16px; padding: 12px 26px; }
/* 가로로 눕힌 폰 — 머리가 화면의 3분의 1을 먹으면 강화 줄이 한 줄도 안 보인다.
   브라우저로 재 보니 머리만 178px 였다. 줄 간격과 글자를 조여 142px 로 내렸다.
   (형: "가로로 눕혀서 봤을 때 ... 스크롤 가능칸이 엄청 좁아. 좀 제발좀.") */
@media (max-width: 640px), (max-height: 560px) {
  .r-over { font-size: 34px; letter-spacing: .1em; }
  .r-head { padding: 6px 8px 8px; }
  .r-why { margin-top: 4px; font-size: 12px; }
  .r-stage { margin-top: 5px; }
  .r-stage b { font-size: 22px; }
  .r-keep { margin-top: 5px; font-size: 13px; }
}
.r-none { color: var(--mute); font-size: 13px; padding: 10px 0 0; border-top: 1px solid var(--line); }
/* 칸의 머리 그림은 칸의 **맨 위**에 딱 붙는다 — 두 칸을 갈아탈 때 머리 높이가 다르면
   그 차이가 먼저 보인다 (.s-h 는 0, .f-h 는 원래 20px 이었다). */
.hb-pane .f-h { margin-top: 0; }
`

interface Row {
  key: StatKey
  el: HTMLElement
  lv: HTMLElement
  now: HTMLElement
  next: HTMLElement
  why: HTMLElement
  btn: HTMLButtonElement
  cost: HTMLElement
}

/**
 * 소리를 끄고 켜는 최소한의 창구. ui/ 가 audio/ 를 직접 import하지 않으려고
 * main.ts가 루프에서 꺼내 주입한다 (LoopUi와 대칭 · A1 레이어 방향).
 */
export interface AudioSwitch {
  muted(): boolean
  toggle(): void
  /** 스탯을 올렸다 — 소리 하나 (형: "능력치 올릴때 소리도 필요해"). */
  levelup(): void
  /** 활을 갈았다 — 망치질 (형: "강화 시 망치질 소리"). */
  forge(): void
}

interface StatRows {
  /** 줄들을 담은 상자. 부르는 쪽이 원하는 자리에 붙인다. */
  el: HTMLElement
  /** 훈련치·문장·비용·추천을 세이브에서 다시 읽어 그린다. */
  refresh(): void
}

/**
 * 스탯 줄 넷 — 성장 화면과 재정비 화면이 **같은 줄**을 쓴다.
 * `trainOut`은 머리의 훈련치 숫자다 (두 화면의 머리가 달라서 밖에서 받는다).
 */
function buildStatRows(
  d: SaveData,
  trainOut: HTMLElement,
  audio: AudioSwitch,
  onChange: () => void,
): StatRows {
  const box = document.createElement('div')
  const rows: Row[] = []
  for (let i = 0; i < STAT_KEYS.length; i++) {
    const key = STAT_KEYS[i]
    if (key === undefined) continue
    const el = document.createElement('div')
    el.className = 'g-row'
    el.innerHTML = `
      <div><i class="hb-ic g-ic"></i><span class="g-name"></span><span class="g-lv"></span><span class="g-tag">추천</span></div>
      <div class="g-now"></div>
      <div class="g-next"></div>
      <div class="g-why"></div>
      <button class="hb-btn g-up" type="button">올리기 <span class="g-cost"></span></button>`
    const btn = el.querySelector('.g-up') as HTMLButtonElement
    const row: Row = {
      key,
      el,
      lv: el.querySelector('.g-lv') as HTMLElement,
      now: el.querySelector('.g-now') as HTMLElement,
      next: el.querySelector('.g-next') as HTMLElement,
      why: el.querySelector('.g-why') as HTMLElement,
      btn,
      cost: el.querySelector('.g-cost') as HTMLElement,
    }
    ;(el.querySelector('.g-name') as HTMLElement).textContent = statLabel(key)
    // ③ 길게 누르면 — 지금 값·다음 값·앞으로의 값 곡선 (2026-09-11).
    //    겉면은 "지금 → 다음" 한 쌍이면 충분하다. 얼마를 더 쓰면 어디까지 가는지는
    //    궁금해진 사람만 보면 되는 것이라 이쪽으로 뺀다.
    attachDetail(el, () => {
      const lv = d.stats[key]
      const cost = trainingCost(lv)
      const after = effectAfterLevel(d.stats, key)
      const now2 = effectOf(d.stats, key)
      return {
        title: statLabel(key),
        sub: `Lv ${lv}`,
        lines: [`지금 — ${now2}`, after === now2 ? '한 레벨로는 크게 달라지지 않는다' : `한 레벨 뒤 — ${after}`],
        stats: [
          ['한 레벨 값', coinText(cost)],
          ['세 레벨 값', coinText(trainingCost(lv) + trainingCost(lv + 1) + trainingCost(lv + 2))],
          ['가진 돈', coinText(d.training)],
        ],
        foot: d.training < cost ? `${coinText(cost - d.training)} 모자라다` : recommendStat(d.stats) === key ? recommendReason(key) : '',
      }
    })
    // 아이콘은 스탯 키로 고른다 (ui/overlay.ts .hb-ic.i-*). 스탯을 더 만들면 아이콘도 같이.
    ;(el.querySelector('.g-ic') as HTMLElement).classList.add(`i-${key}`)
    btn.addEventListener('click', () => {
      if (!spendTraining(d, key, 1)) return
      audio.levelup()
      // 무엇이 바뀌었는지 그 자리에서. 화면을 닫았다 열게 하지 않는다.
      row.el.classList.add('g-flash')
      window.setTimeout(() => row.el.classList.remove('g-flash'), FLASH_MS)
      refresh()
      onChange()
    })
    box.appendChild(el)
    rows.push(row)
  }

  const refresh = (): void => {
    trainOut.textContent = String(d.training)
    const rec = recommendStat(d.stats)
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      if (r === undefined) continue
      const lv = d.stats[r.key]
      const cost = trainingCost(lv)
      const now = effectOf(d.stats, r.key)
      const after = effectAfterLevel(d.stats, r.key)
      r.lv.textContent = `Lv ${lv}`
      r.now.textContent = now
      // 후반에는 한 레벨로 문장이 안 바뀐다. 안 바뀌면 안 바뀐다고 말한다 —
      // 없는 변화를 있는 척하면 다음부터 이 화면을 안 믿는다.
      const flat = after === now
      r.next.textContent = flat ? '→ 여기서는 한 레벨로 크게 달라지지 않는다' : `→ ${after}`
      r.next.classList.toggle('g-flat', flat)
      r.cost.textContent = String(cost)
      r.btn.disabled = d.training < cost
      // 추천은 하나다. 둘이면 추천이 아니다.
      const isRec = r.key === rec
      r.el.classList.toggle('g-rec', isRec)
      r.why.textContent = isRec ? recommendReason(rec) : ''
    }
  }

  return { el: box, refresh }
}

/**
 * 대장간 줄 셋 — **지금 든 활**의 시위·활채·줌통 (game/forge.ts). 성장 화면과 재정비 화면이 같이 쓴다.
 * 활이 바뀌면 줄의 내용이 바뀌므로 refresh 가 활 이름까지 다시 적는다.
 */
function buildForgeRows(d: SaveData, audio: AudioSwitch, onChange: () => void): StatRows {
  const box = document.createElement('div')
  const head = document.createElement('div')
  head.className = 'f-h'
  head.innerHTML = '<div class="f-cap">김홍도 「대장간」</div><h3><i class="hb-ic i-forge"></i> 대장간</h3><span class="f-bow"></span>'
  const bowOut = head.querySelector('.f-bow') as HTMLElement
  const lead = document.createElement('p')
  lead.className = 'hb-lead'
  lead.textContent = '든 활을 갈아 만든다 — 개조는 그 활의 것이라 활을 바꾸면 따라오지 않는다. 부위마다 세 단.'
  box.append(head, lead)

  interface FRow { part: typeof FORGE_PARTS[number]['id']; el: HTMLElement; lv: HTMLElement; now: HTMLElement; next: HTMLElement; btn: HTMLButtonElement; cost: HTMLElement }
  const rows: FRow[] = []
  for (const p of FORGE_PARTS) {
    const el = document.createElement('div')
    el.className = 'f-row'
    el.innerHTML = `
      <div><span class="f-name"></span><span class="f-lv"></span></div>
      <div class="f-now"></div>
      <div class="f-next"></div>
      <button class="hb-btn f-up" type="button"><i class="hb-ic i-forge"></i>개조 <span class="g-cost"></span></button>`
    const name = el.querySelector('.f-name') as HTMLElement
    name.textContent = p.name
    const origin = document.createElement('span')
    origin.className = 'f-origin'
    origin.textContent = p.origin
    name.appendChild(origin)
    const btn = el.querySelector('.f-up') as HTMLButtonElement
    const row: FRow = {
      part: p.id, el,
      lv: el.querySelector('.f-lv') as HTMLElement,
      now: el.querySelector('.f-now') as HTMLElement,
      next: el.querySelector('.f-next') as HTMLElement,
      btn, cost: el.querySelector('.g-cost') as HTMLElement,
    }
    btn.addEventListener('click', () => {
      if (!buyForge(d, d.bow, p.id)) return
      audio.forge()
      row.el.classList.add('g-flash')
      window.setTimeout(() => row.el.classList.remove('g-flash'), FLASH_MS)
      refresh()
      onChange()
    })
    box.appendChild(el)
    rows.push(row)
  }

  // ── 갑옷 담금질 — 입은 벌을 담근다 (game/armor.ts, 2026-09-10 형: "더 강화시킬 수도 없잖아") ──
  // 활 부위 줄과 같은 뼈대. 값도 같은 곡선(forgeCost)이라 "활채를 갈까, 갑옷을 담글까"가 한 지갑에서 갈린다.
  const ael = document.createElement('div')
  ael.className = 'f-row'
  ael.innerHTML = `
      <div><span class="f-name"></span><span class="f-lv"></span></div>
      <div class="f-now"></div>
      <div class="f-next"></div>
      <button class="hb-btn f-up" type="button"><i class="hb-ic i-armor"></i>담금질 <span class="g-cost"></span></button>`
  const aName = ael.querySelector('.f-name') as HTMLElement
  const aOrigin = document.createElement('span')
  aOrigin.className = 'f-origin'
  aName.appendChild(aOrigin)
  const aLv = ael.querySelector('.f-lv') as HTMLElement
  const aNow = ael.querySelector('.f-now') as HTMLElement
  const aNext = ael.querySelector('.f-next') as HTMLElement
  const aBtn = ael.querySelector('.f-up') as HTMLButtonElement
  const aCost = ael.querySelector('.g-cost') as HTMLElement
  aBtn.addEventListener('click', () => {
    if (!buyArmorForge(d)) return
    audio.forge()
    ael.classList.add('g-flash')
    window.setTimeout(() => ael.classList.remove('g-flash'), FLASH_MS)
    refresh()
    onChange()
  })
  box.appendChild(ael)

  const refresh = (): void => {
    bowOut.textContent = bowKind(d.bow).name
    {
      const id = armorKindOf(d)
      const lv = armorLevel(d, id)
      const max = armorForgeMax()
      aName.firstChild!.textContent = armorKind(id).name
      aOrigin.textContent = armorKind(id).origin
      aLv.textContent = `${lv} / ${max}단`
      aNow.textContent = `입은 갑옷을 담근다 — 한 벌의 방어량과 상한이 오른다 · 지금 ${armorForgeEffect(id, lv)}`
      const why = armorForgeBlocked(d, id)
      const top = lv >= max
      aNext.textContent = top ? '끝까지 담갔다' : `→ ${armorForgeEffect(id, lv + 1)}`
      aNext.classList.toggle('g-flat', top)
      aCost.textContent = top ? '' : String(forgeCost(lv))
      aBtn.disabled = why !== ''
      aBtn.title = why === '' ? `${armorKind(id).name} ${lv + 1}단 — ${coinText(forgeCost(lv))}` : why
    }
    for (const r of rows) {
      const lv = forgeLevel(d, d.bow, r.part)
      const max = forgeMax()
      const def = FORGE_PARTS.find((p) => p.id === r.part)
      r.lv.textContent = `${lv} / ${max}단`
      r.now.textContent = `${def?.hint ?? ''} · 지금 ${forgeEffect(r.part, lv)}`
      const why = forgeBlocked(d, d.bow, r.part)
      const top = lv >= max
      r.next.textContent = top ? '끝까지 갈았다' : `→ ${forgeEffect(r.part, lv + 1)}`
      r.next.classList.toggle('g-flat', top)
      r.cost.textContent = top ? '' : String(forgeCost(lv))
      r.btn.disabled = why !== ''
      r.btn.title = why === '' ? `${def?.name ?? ''} ${lv + 1}단 — ${coinText(forgeCost(lv))}` : why
    }
  }
  return { el: box, refresh }
}

/**
 * 성장 화면을 오버레이에 붙인다. `onChange`는 스탯·설정이 바뀔 때마다 불린다 —
 * 게임 루프는 여기서 world.stats를 다시 읽으면 된다.
 */
export function mountGrowth(o: Overlay, d: SaveData, onChange: () => void, audio: AudioSwitch): void {
  const panel = o.panel(PANEL_ID)

  const style = document.createElement('style')
  style.textContent = CSS
  panel.appendChild(style)
  // 굴리지 않는다 — 능력치·대장간·활 걸이를 세로로 잇지 않고 칸으로 나눈다 (ui/tabs.ts).
  // 2026-09-11, 형: "능력치강화랑 대장간 이런거 이렇게 한 화면에 세로로 몰아넣는게 맞아?"
  o.panelBox(PANEL_ID).classList.add('hb-tall')

  const head = document.createElement('div')
  head.className = 'g-h'
  head.innerHTML = '<h2>성장</h2>'
    + '<span class="hb-tip hb-tip-mouse">줄에 올려두면 자세히</span>'
    + '<span class="hb-tip hb-tip-touch">줄을 길게 눌러 자세히</span>'
    + `<div class="g-train">${COIN_ICON}<b></b></div>`
  const trainOut = head.querySelector('b') as HTMLElement

  const sub = document.createElement('p')
  sub.className = 'hb-lead'
  sub.textContent = '올리면 몸이 어떻게 달라지는지 아래 줄에 미리 적혀 있다.'

  panel.appendChild(head)

  // ── 칸 셋 (2026-09-11) ─────────────────────────────────────────────────
  //   형: **"능력치강화랑 대장간 이런거 이렇게 한 화면에 세로로 몰아넣는게 맞아?
  //         게임들이 이래서 게임 하겠냐?"**
  //
  //   아니었다. 능력치 넷 아래 활 걸이 다섯, 그 아래 대장간 넷, 그 아래 설정 — 열 몇 줄이
  //   한 줄로 쌓인 문서였다. 두 단으로 갈라 봤지만(추가 30) 그건 문서를 두 줄로 만든 것뿐이다.
  //   이제 셋은 **서로 다른 화면**이다. 하나씩 보고, 위에서 갈아탄다.
  const paneStat = document.createElement('div')
  const paneForge = document.createElement('div')
  const paneRack = document.createElement('div')
  paneRack.className = 'hb-mid'
  const tabs = makeTabs([
    { id: 'stat', label: '능력치', pane: paneStat },
    { id: 'forge', label: '대장간', pane: paneForge },
    { id: 'rack', label: '활 걸이', pane: paneRack },
  ], (id) => {
    if (id === 'rack') wheel.to(wheel.index(), true)
  })
  panel.appendChild(tabs.el)
  const colA = paneStat

  // 대장간처럼 **강화에도 머리 그림**이 선다 (형: "대장간은 이미지 잇으니 강화도 이미지 있어야지").
  const statHead = document.createElement('div')
  statHead.className = 's-h'
  statHead.innerHTML = '<h3>몸을 키운다</h3><div class="f-cap">수렵총 벽화 (고구려)</div>'
  paneStat.append(statHead, sub)
  const rows = buildStatRows(d, trainOut, audio, onChange)
  colA.appendChild(rows.el)

  // ── 활 걸이 — **돌려서 고른다** (docs/BOWS.md · ui/wheel.ts) ────────────────
  //   형: "활선택하는게 버튼이 아니라 롤이었으면 좋겠어. 리볼빙형식이라고 해야하나?"
  //   출정 화면과 **같은 부품**이다. 같은 것을 고르는 두 화면이 서로 다르게 생기면
  //   그건 두 가지 물건이 된다.
  //   장착은 다음 판부터다 — 판 도중에 활이 바뀌면 같은 시드가 다른 판이 된다 (A1).
  const rack = document.createElement('div')
  rack.className = 'g-bows'
  rack.innerHTML = '<h3><span>활 걸이</span>'
    + '<span class="hb-tip hb-tip-mouse">올려두면 자세히</span>'
    + '<span class="hb-tip hb-tip-touch">길게 눌러 자세히</span></h3>'

  const bowIds: BowKindId[] = BOW_KINDS.map((b) => b.id)
  const hasBow = (id: BowKindId): boolean =>
    id === 'practice' || unlockedBows(d.unlocked).includes(id)

/**
 * 활 한 자루의 **그림** (2026-09-11, 형: "활도 각각 이미지로 등록되어야해. 개떡같은 svg 말고.
 * 선택할때만큼은 화려해야지").
 *
 * public/sprites/bow-<id>.png — 다섯을 한 장에 받아 잘라낸 것이라 화풍이 한 벌이다
 * (tools/slice-bows.mjs · 출처는 public/sprites/출처.txt).
 * 잠긴 활은 그림을 안 준다 — 실루엣까지 보이면 가려진 게 아니다.
 *
 * `loading="lazy"` 로 두는 이유: 걸이는 판을 열 때만 보인다. 첫 페인트를 막지 않는다 (C6).
 */
function bowArt(id: string, owned: boolean, px: number): string {
  if (!owned) return `<span class="wh-ic">${bowIconSvg('', px)}</span>`
  return `<img class="wh-art" src="${BASE}sprites/bow-${id}.png" width="${px}" height="${px}"`
    + ` alt="" loading="lazy" decoding="async">`
}

  /** 걸이 카드 한 장의 겉면. 이름 + 숙련 + 장점 한 줄 — 나머지는 말풍선이다. */
  const bowFace = (id: BowKindId): string => {
    const k = BOW_KINDS.find((b) => b.id === id)
    if (k === undefined) return ''
    if (!hasBow(id)) {
      // 이름도 그림도 가린다 — 실루엣까지 보이면 가려진 게 아니다
      // (형: "이미지도 글도 다 나와놓고 이름만 물음표하면 그게 가려진거냐?").
      return bowArt(id, false, 92)
        + `<span class="wh-n">？？？</span><span class="wh-d">${unlockOfBow(id)?.hint ?? ''}</span>`
    }
    const hits = Math.floor(d.bowHits[id] ?? 0)
    const lv = masteryLevel(hits)
    const nx = MASTERY_HITS[lv]
    const mast = lv > 0 ? ` · 숙련 ${lv}` : ''
    const prog = nx !== undefined ? `<span class="wh-d">숙련 ${hits}/${nx}</span>` : ''
    return bowArt(id, true, 92)
      + `<span class="wh-n">${k.name}${mast}</span><span class="wh-d">${k.perk}</span>${prog}`
  }

  const wheel = makeWheel({
    label: '활 걸이',
    items: bowIds.map((id) => ({ id, html: bowFace(id), locked: !hasBow(id) })),
    onPick: () => refreshBows(),
  })
  rack.appendChild(wheel.el)

  // 앞에 나온 활을 든다. 못 드는 활이면 왜 못 드는지가 그 자리에 적힌다.
  const rackLine = document.createElement('div')
  rackLine.className = 'g-brack'
  const take = document.createElement('button')
  take.type = 'button'
  take.className = 'hb-btn g-btake'
  take.addEventListener('click', () => {
    const id = bowIds[wheel.index()]
    if (id === undefined || !hasBow(id) || d.bow === id) return
    d.bow = id
    writeSave(d)
    refresh()
    onChange()
  })
  rack.append(rackLine, take)

  for (let i = 0; i < bowIds.length; i++) {
    const id = bowIds[i]
    const card = wheel.cards()[i]
    if (id === undefined || card === undefined) continue
    const k = BOW_KINDS.find((b) => b.id === id)
    if (k === undefined) continue
    // ③ 길게 누르면 — 겉면에서 뺀 것 전부 (대가·궁합·숙련 진행).
    //    숙련이 대가를 몇 % 깎았는지는 **여기 한 곳에서만** 센다 (game/bows.ts eased()와 같은 식).
    attachDetail(card, () => {
      if (!hasBow(id)) {
        return { title: '아직 잠겨 있다', lines: [unlockOfBow(id)?.hint ?? ''], foot: '조건을 채우면 열린다' }
      }
      const hits = Math.floor(d.bowHits[id] ?? 0)
      const lv = masteryLevel(hits)
      const nx = MASTERY_HITS[lv]
      const eased = Math.round(Math.min(1, lv * P.bowkind.masteryEase) * 100)
      return {
        title: k.name,
        sub: k.origin,
        lines: [
          k.perk,
          k.cost === '없음' ? '대가가 없다 — 그래서 기준이 된다.'
            : `대가 — ${k.cost}${lv > 0 ? ` (숙련으로 ${eased}% 완화)` : ''}`,
          k.synergy !== undefined ? `궁합 — ${k.synergy.label}` : '',
        ],
        stats: nx !== undefined ? [['다음 숙련까지', `${hits} / ${nx}`]] : [['숙련', '끝까지 올렸다']],
        foot: '바꾼 활은 다음 판부터 든다',
      }
    })
  }
  paneRack.appendChild(rack)

  // ── 대장간 — 든 활의 개조 (game/forge.ts). 스탯 바로 아래(왼쪽 단)다 —
  //   같은 지갑을 쓰는 것끼리 붙여야 고르는 맛이 산다. 활 걸이는 옆 단에서 같이 보인다.
  const forge = buildForgeRows(d, audio, onChange)
  paneForge.appendChild(forge.el)

  /** 활 걸이 갱신 — 겉면 글자와 '들기' 줄. 자리는 걸이가 스스로 지킨다. */
  const refreshBows = (): void => {
    // 해금이 바뀌면 겉면 글자도 바뀐다 (？？？ → 이름). 카드를 다시 채운다.
    wheel.set(bowIds.map((id) => ({ id, html: bowFace(id), locked: !hasBow(id) })))
    const id = bowIds[wheel.index()]
    if (id === undefined) return
    const k = BOW_KINDS.find((b) => b.id === id)
    const worn = d.bow === id
    if (!hasBow(id)) {
      rackLine.innerHTML = `아직 못 든다 — ${unlockOfBow(id)?.hint ?? ''}`
        + ` <i>· 지금 드는 활은 ${BOW_KINDS.find((b) => b.id === d.bow)?.name ?? ''}</i>`
      take.disabled = true
      take.textContent = '못 드는 활'
      return
    }
    // 대가·궁합은 말풍선으로 갔다. 여기 한 줄은 **지금 무엇을 드는가**만 말한다.
    rackLine.innerHTML = worn
      ? `<b>${k?.name ?? ''}</b> 를 들고 있다`
      : `<b>${k?.name ?? ''}</b> — 바꾼 활은 다음 판부터 든다`
    take.disabled = worn
    take.textContent = worn ? '들고 있음' : '이 활을 든다'
  }

  // ── 오프라인 축적 스위치 (GDD 5장) ──
  // "게임이 시간을 인질로 잡는다"는 느낌을 없애려고 존재한다. 끄면 판 보상이 올라간다.
  const foot = document.createElement('div')
  foot.className = 'g-foot'
  const label = document.createElement('label')
  const chk = document.createElement('input')
  chk.type = 'checkbox'
  const chkText = document.createElement('span')
  chkText.textContent = '공부하는 동안 쌓기'
  label.append(chk, chkText)

  // ── 소리 스위치 (C5: 한 손=마우스로 다 된다) ──
  // 소리는 기본 ON이다 (C3). M 키가 유일한 음소거 경로면 커피잔 들고 있는 사람도,
  // 도서관에서 조용히 켠 사람도 마우스만으로는 못 끈다.
  const sndLabel = document.createElement('label')
  const snd = document.createElement('input')
  snd.type = 'checkbox'
  const sndText = document.createElement('span')
  sndText.textContent = '소리 (M)'
  sndLabel.append(snd, sndText)

  const hint = document.createElement('div')
  hint.className = 'g-hint'
  foot.append(label, sndLabel, hint)
  tabs.foot.appendChild(foot)

  chk.addEventListener('change', () => {
    d.offlineEnabled = chk.checked
    writeSave(d)
    refresh()
    onChange()
  })

  // 체크가 켜짐 = 소리 켜짐. 음소거 여부와 반대라 여기서 뒤집는다.
  const syncSound = (): void => {
    snd.checked = !audio.muted()
  }
  snd.addEventListener('change', () => {
    if (snd.checked === audio.muted()) audio.toggle()
    syncSound()
  })

  // ── 처음부터 (완전 초기화) ──
  // 세이브는 이 브라우저에만 있다 — 지우는 것도 여기서만 할 수 있어야 한다.
  // 파괴적이라 두 번 눌러야 한다: 1번째 누름은 무장(문구·색 변경), 4초 안에 2번째 누름이 실행.
  const danger = document.createElement('div')
  danger.className = 'g-danger'
  const wipe = document.createElement('button')
  wipe.type = 'button'
  wipe.className = 'hb-btn'
  wipe.textContent = '기록 전부 삭제'
  const dangerNote = document.createElement('span')
  dangerNote.textContent = '판·스탯·별·해금 전부 지우고 새로 시작한다. 이 브라우저의 기록만이다.'
  danger.append(wipe, dangerNote)
  // 감춘 경고를 잃지 않는다 — 누르기 전에는 여기, 누른 뒤에는 화면에.
  wipe.title = dangerNote.textContent
  mountInstall(tabs.foot, (t, ms) => o.toast(t, ms))
  tabs.foot.appendChild(danger)

  let armTimer = 0
  const disarm = (): void => {
    danger.classList.remove('g-warn')
    wipe.classList.remove('g-armed')
    wipe.textContent = '기록 전부 삭제'
  }
  wipe.addEventListener('click', () => {
    if (!wipe.classList.contains('g-armed')) {
      wipe.classList.add('g-armed')
      danger.classList.add('g-warn')
      wipe.textContent = '정말 전부 지운다?'
      window.clearTimeout(armTimer)
      armTimer = window.setTimeout(disarm, 4000)
      return
    }
    window.clearTimeout(armTimer)
    wipeSave()
    // 새로고침이 가장 확실한 초기화다 — 루프·화면이 들고 있는 상태까지 전부 새로 선다.
    location.reload()
  })

  // ── HUD 버튼 ──
  const open = document.createElement('button')
  open.type = 'button'
  open.className = 'hb-btn'
  open.innerHTML = '<i class="hb-ic i-growth"></i><span class="hb-lbl">성장</span>'
    + '<span class="hb-key">Tab</span><span class="hb-dot"></span>'
  open.setAttribute('aria-label', '성장 화면 열기')
  open.addEventListener('click', () => {
    if (o.visible()) o.hide()
    else {
      refresh()
      o.show(PANEL_ID)
    }
  })
  o.hud().appendChild(open)

  function refresh(): void {
    // 상한 도달을 알리지 않는다 (GDD 5장). 여기 있는 건 "어디서 오는가"뿐이다.
    const perMin = P.offline.trainingPerSec * 60
    // 엽전 그림이 들어가므로 innerHTML 이다 (글자만이면 숫자가 무엇인지 안 읽힌다).
    hint.innerHTML = d.offlineEnabled
      ? `돈은 공부하는 동안에도 쌓인다 (${(1 / perMin).toFixed(0)}분에 ${coinHtml(1)})`
      : `쌓지 않는 대신 판 보상 ×${P.offline.optOutBonus.toFixed(2)}`
    chk.checked = d.offlineEnabled
    syncSound()
    rows.refresh()
    refreshBows()
    forge.refresh()
    open.classList.toggle('hb-has', canGrow(d))
  }

  // 세이브가 바뀌면(판 종료 보상·오프라인 정산) 점과 숫자를 맞춘다.
  // 매 프레임 폴링하지 않기 위한 유일한 장치다.
  o.onDispose(onSaveChanged(() => refresh()))

  const onKey = (e: KeyboardEvent): void => {
    // M은 audio/sfx.ts가 처리한다. 여기서는 체크박스만 따라 그린다 —
    // 리스너 등록 순서에 기대지 않으려고 이벤트가 다 끝난 뒤에 읽는다.
    if (e.key === 'm' || e.key === 'M') {
      window.setTimeout(syncSound, 0)
      return
    }
    if (e.key !== 'Tab' || e.altKey || e.ctrlKey || e.metaKey) return
    const t = e.target
    // 입력칸 안에서의 Tab은 그 사람 것이다.
    if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return
    e.preventDefault()
    if (o.visible()) o.hide()
    else {
      refresh()
      o.show(PANEL_ID)
    }
  }
  window.addEventListener('keydown', onKey)
  o.onDispose(() => window.removeEventListener('keydown', onKey))

  refresh()
}

// ─────────────────────────── 재정비 (여정 종료) ───────────────────────────

/** 여정이 끝나며 남긴 것 — game/loop.ts endRun 이 채운다. */
export interface ReinforceInfo {
  reached: number
  score: number
  best: number
  isNew: boolean
  first: boolean
  reason: 'defeat' | 'abandon' | 'death'
  training: number
  stars: number
  jung: number
  molgi: boolean
  /** 다음 여정이 시작되는 판 (1부터). 체크포인트가 있으면 1이 아니다. */
  nextStage: number
}

/** 재정비 화면에 달린 탭 복귀 리스너. 화면이 하나뿐이니 이것도 하나뿐이어야 한다. */
let reinVis: (() => void) | null = null

/**
 * 재정비 — 여정 종료 화면. 위는 결과, 가운데는 성장 줄, 아래는 '다음' 하나.
 *
 * 왜 결과 화면과 성장 화면을 한 장으로 붙였나: 죽은 직후가 **훈련치가 가장 많고, 왜 죽었는지
 * 가장 생생한** 순간이다. 그 순간에 "근력을 올리면 적을 눕히는 발수가 준다"가 눈앞에 있어야
 * 다음 여정이 달라진다. 화면을 나눠 놓으면(결과 → 닫기 → 성장 버튼 찾기) 그 사이에 접는다 —
 * 실제로 접었다.
 *
 * onNext는 정확히 한 번. 이 화면도 **다시 열릴 수 있다** (game/loop.ts reopen) — 닫혀도
 * 게임이 굳지 않게. 그때마다 리스너가 쌓이지 않게 앞의 것을 뗀다.
 */
export function showReinforce(
  o: Overlay,
  d: SaveData,
  info: ReinforceInfo,
  audio: AudioSwitch,
  onNext: () => void,
): void {
  const panel = o.panel(REINFORCE_ID)
  panel.replaceChildren()
  panel.setAttribute('aria-label', '재정비')
  // 굴리지 않는다 (ui/tabs.ts). 성장 화면과 **같은 뼈대**다 — 죽은 뒤에 여는 화면이
  // 평소에 여는 화면과 다르게 생길 이유가 없다.
  o.panelBox(REINFORCE_ID).classList.add('hb-tall')

  const style = document.createElement('style')
  style.textContent = CSS
  panel.appendChild(style)

  // ── 머리: 끝났다 ──
  // 이번 여정이 **영구히** 남긴 것만 센다. 판별 점수처럼 여정과 함께 사라지는 건 안 쓴다 —
  // "가져간다"고 써놓고 안 가져가면 그 줄은 다음부터 아무도 안 읽는다.
  // 0인 항목은 아예 안 쓴다 — '훈련치 0'은 위로가 아니라 조롱이다.
  const keeps: string[] = []
  if (info.training > 0) keeps.push(coinHtml(info.training, true))
  if (info.stars > 0) keeps.push(`별 <b>${info.stars}</b>`)
  // '몰기'라는 말은 화면에 안 쓴다 (2026-09-11, 형: "몰기는 이 몰기가 뭐야 대체").
  // 국궁의 말이지만 **아는 사람만 아는 말**이고, 여기서 가르칠 자리도 아니다.
  // 뜻은 '연달아 다섯을 맞혔다'니까 그냥 그렇게 쓴다 — 낱말 하나를 배우게 하느니 뜻을 준다.
  if (info.jung >= 3) keeps.push(`연달아 <b>${info.jung}발</b>`)

  // 접은 것과 실패한 것은 다르다 — 같은 자리, 같은 크기, 색만 다르게.
  const quit = info.reason === 'abandon'
  // 왜 끝났는지 **한 줄**.
  const why = quit
    ? '여기서 접었다'
    : info.reason === 'death'
      ? '기력이 0이 됐다 — 적의 화살은 방패로 막고 갑옷으로 받는다'
      : '화살이 떨어졌다 — 남은 수는 화면 왼쪽 위에 있다'

  const head = document.createElement('div')
  head.className = 'r-head'
  head.innerHTML =
    `<div class="r-over${quit ? ' r-quit' : ''}">${quit ? '여정 종료' : 'GAME OVER'}</div>`
    + `<div class="r-why">${why}</div>`
    // 판 수와 기록은 **한 줄**이다. 둘 다 같은 걸 재는 숫자라 나란히 있어야 읽힌다.
    + `<div class="r-stage"><b>${info.reached}</b>판`
    + (info.first
      ? ' <i class="r-new">첫 기록</i>'
      : info.isNew
        ? ' <i class="r-new">최고 기록</i>'
        : ` <i>최고 ${info.best}판</i>`)
    + '</div>'
    + (keeps.length > 0 ? `<div class="r-keep">가져간다 &nbsp;${keeps.join('<span class="r-dot">·</span>')}</div>` : '')
  panel.appendChild(head)

  // ── 칸 둘 (2026-09-11 추가 39) ─────────────────────────────────────────
  //   형: **"강화가 왼쪽, 대장간이 오른쪽 이런식으로 되어야 하지않나? 게임오버시에는
  //         게임오버가 중점적으로 나오고 신체강화, 무기강화 버튼, 체크포인트로 돌아가기
  //         이런거로 해야하는거 아닐까?"**
  //
  //   맞다. 죽은 화면이 **줄 여덟 개짜리 표 두 벌**이었다. 죽자마자 읽을 것이 아니라,
  //   죽고 나서 **고를 것**이 있어야 한다. 이제 화면은 셋뿐이다:
  //   위에 GAME OVER · 가운데 갈아타는 칸 둘(신체 · 무기) · 아래 돌아가는 버튼 하나.
  //   성장 화면과 같은 부품(ui/tabs.ts)이라 두 화면이 한 게임으로 읽힌다.
  const paneStat = document.createElement('div')
  const paneForge = document.createElement('div')
  const tabs = makeTabs([
    { id: 'stat', label: '신체 강화', pane: paneStat },
    { id: 'forge', label: '무기 강화', pane: paneForge },
  ])
  panel.appendChild(tabs.el)

  // ── 신체 강화 ──
  const statHead = document.createElement('div')
  statHead.className = 's-h'
  statHead.innerHTML = '<h3>몸을 키운다</h3><div class="f-cap">수렵총 벽화 (고구려)</div>'
  paneStat.appendChild(statHead)

  // 지갑은 **아래 줄**에 둔다 — 칸을 갈아타도 안 사라져야 하는 숫자다 (둘 다 같은 지갑을 쓴다).
  const purse = document.createElement('div')
  purse.className = 'g-train'
  purse.innerHTML = `${COIN_ICON}<b></b>`
  const trainOut = purse.querySelector('b') as HTMLElement

  const rows = buildStatRows(d, trainOut, audio, () => {})
  paneStat.appendChild(rows.el)

  // 올릴 것이 하나도 없으면 왜 없는지 한 줄. 버튼만 잠겨 있으면 고장으로 읽힌다.
  const none = document.createElement('div')
  none.className = 'r-none'
  const syncNone = (): void => {
    if (canGrow(d)) {
      none.textContent = ''
      none.style.display = 'none'
      return
    }
    let min = Number.POSITIVE_INFINITY
    for (const k of STAT_KEYS) min = Math.min(min, trainingCost(d.stats[k]))
    none.style.display = ''
    none.textContent = `${coinText(Math.max(0, min - d.training))} 모자라다 — 판을 깰 때마다 쌓인다. 다음 여정에서 더 벌어 온다`
  }
  paneStat.appendChild(none)
  const unsub = onSaveChanged(syncNone)

  // ── 무기 강화 ── 죽은 직후는 "활을 갈아 만들까"를 물을 가장 좋은 때다 (game/forge.ts).
  // 신체와 **같은 지갑**이라 "근력을 올릴까, 활채를 갈까"가 진짜 저울질이 된다.
  const forge = buildForgeRows(d, audio, () => {})
  paneForge.appendChild(forge.el)

  // ── 아래 줄: 지갑 + 돌아간다 ──
  const foot = document.createElement('div')
  foot.className = 'r-foot'
  const go = document.createElement('button')
  go.type = 'button'
  go.className = 'hb-btn hb-pri r-go'
  // 어디로 돌아가는지 **버튼이 말한다** (형: "체크포인트로 돌아가기"). 예전엔 '다음 →' 이라
  // 써 두고 그 위 어딘가에 "다음 여정은 121판부터"라고 따로 적었다 — 같은 말을 두 번 한 셈이다.
  go.textContent = info.nextStage > 1 ? `${info.nextStage}판으로 돌아간다 →` : '다시 나선다 →'
  go.setAttribute('aria-label', '출정 준비로')
  foot.append(purse, go)
  tabs.foot.appendChild(foot)

  let done = false
  const onVisibility = (): void => {
    if (!document.hidden && !done) o.show(REINFORCE_ID)
  }
  if (reinVis !== null) document.removeEventListener('visibilitychange', reinVis, true)
  reinVis = onVisibility
  document.addEventListener('visibilitychange', onVisibility, true)
  go.addEventListener('click', () => {
    if (done) return
    done = true
    document.removeEventListener('visibilitychange', onVisibility, true)
    reinVis = null
    unsub()
    unsubRows()
    o.hide(true)
    onNext()
  })

  rows.refresh()
  forge.refresh()
  // 줄 안의 버튼이 훈련치를 바꾸면 다른 줄의 값(살 수 있는가)도 바뀐다 — 둘을 같이 다시 그린다.
  const unsubRows = onSaveChanged(() => { rows.refresh(); forge.refresh() })
  syncNone()
  o.show(REINFORCE_ID, { sticky: true })
}

// ─────────────────────────── 복귀 알림 ───────────────────────────

const plus = (label: string, n: number): string => (n > 0 ? `${label} +${n}` : '')

/**
 * 자리를 비웠다 돌아왔을 때 구석에 잠깐 뜨는 줄. **확인 버튼은 없다. 자동 수령이다** (C1·C4).
 * 아무것도 누르지 않고 바로 쏠 수 있어야 하므로 토스트 외의 어떤 것도 만들지 않는다.
 * 상한이 찼다는 말도 하지 않는다 (GDD 5장) — 조용히 가득 차 있을 뿐이다.
 */
export function showOfflineGain(
  o: Overlay,
  gain: { arrows: number; training: number; requests: number },
): void {
  const parts: string[] = []
  const a = plus('화살', gain.arrows)
  // 돈은 '냥 +12' 가 아니라 '+12냥' 이다 — 단위는 숫자 뒤에 붙는다.
  const t = gain.training > 0 ? `+${coinText(gain.training)}` : ''
  const r = plus('의뢰', gain.requests)
  if (a !== '') parts.push(a)
  if (t !== '') parts.push(t)
  if (r !== '') parts.push(r)
  // 받은 게 없으면 말하지 않는다. 빈 알림은 소음이다.
  if (parts.length === 0) return
  o.toast(parts.join(' · '))
}

/**
 * 판이 끝났다. 훈련치와 저절로 오른 스탯을 한 줄로. 결과 화면에 가두지 않는다 (C1).
 * 성장 화면을 열라고 재촉하지 않는다 — 열 만해지면 HUD 버튼의 점이 알아서 켜진다.
 */
export function showRunGain(o: Overlay, line: string, leveled: readonly StatKey[]): void {
  // `line`은 game/rewards.ts의 rewardLine()이 만든 문장이다 (별·훈련치·위업).
  // 여기서 다시 조립하지 않는다 — 문장이 두 곳에서 만들어지면 반드시 어긋난다.
  const parts: string[] = []
  if (line !== '') parts.push(line)
  for (let i = 0; i < leveled.length; i++) {
    const k = leveled[i]
    if (k !== undefined) parts.push(`${statLabel(k)}이 늘었다`)
  }
  if (parts.length === 0) return
  o.toast(parts.join(' · '))
}
