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
import { bowIconSvg } from './arrowicons.ts'
import { onSaveChanged, wipeSave, writeSave, type SaveData } from '../game/save.ts'
import { unlockedBows, unlockOfBow } from '../game/unlocks.ts'
import { P } from '../tune/params.ts'
import type { Overlay } from './overlay.ts'

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
.g-h h3 { flex: 1; margin: 0; color: var(--ink); font-size: 19px; }
/* 훈련치는 이 화면에서 유일하게 '쓸 수 있는 것'이다. 숫자를 크게 세운다. */
.g-train { color: var(--dim); font-size: 13px; letter-spacing: .12em; }
.g-train b { color: var(--accent); font-weight: 700; font-size: 26px; margin-left: 8px; }

.g-row {
  display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 3px 20px;
  padding: 16px 0 15px; border-top: 1px solid var(--line);
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

/* ── 활 걸이 ── 스탯과 발자취가 다른 물건임이 한눈에 읽히게 칸으로 나눈다. */
.g-bows { border-top: 1px solid var(--line); margin-top: 20px; padding-top: 14px; }
.g-bows h3 { color: var(--dim); font-size: 13px; letter-spacing: .12em; margin: 0 0 4px; }
.g-bow {
  display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 2px 20px;
  padding: 12px 0 11px; border-top: 1px solid var(--line);
}
.g-bow:first-of-type { border-top: none; }
.g-bow .g-bic { color: var(--accent); line-height: 0; margin-right: 10px; vertical-align: -6px; }
.g-bow.g-lockd .g-bic { color: var(--mute); }
.g-bow .g-bname { color: var(--ink); font-weight: 700; font-size: 16px; }
.g-bow .g-borigin { color: var(--mute); font-size: 12px; margin-left: 10px; letter-spacing: .04em; }
.g-bow .g-bperk { grid-column: 1; color: var(--body); font-size: 13px; }
.g-bow .g-bcost { grid-column: 1; color: var(--mute); font-size: 13px; }
.g-bow .g-bsyn { grid-column: 1; color: var(--teal); font-size: 13px; }
.g-bow .g-bpick { grid-column: 2; grid-row: 1 / span 4; min-width: 96px; justify-content: center; }
/* 장착 중 — 버튼이 아니라 상태다. */
.g-bow.g-worn .g-bpick { border-color: var(--teal); color: var(--teal); pointer-events: none; }
/* 잠긴 활 — 수집 화면과 같은 문법: 흐리게, 조건은 보이게 (VS의 잠긴 칸). */
.g-bow.g-lockd .g-bname { color: var(--mute); letter-spacing: .1em; font-weight: 600; }
.g-bow.g-lockd .g-bperk, .g-bow.g-lockd .g-bcost, .g-bow.g-lockd .g-bsyn { color: var(--mute); }

.g-foot {
  border-top: 1px solid var(--line); margin-top: 20px; padding-top: 16px;
  display: flex; align-items: center; gap: 14px;
}
.g-foot label { display: flex; align-items: center; gap: 9px; cursor: pointer; color: var(--body); }
.g-foot input { accent-color: var(--teal); width: 16px; height: 16px; }
.g-hint { color: var(--mute); font-size: 13px; flex: 1; text-align: right; }

/* ── 처음부터 ── 파괴적인 버튼은 구석에 작게, 대신 문구는 정직하게. */
.g-danger { border-top: 1px solid var(--line); margin-top: 18px; padding-top: 12px;
  display: flex; align-items: center; gap: 12px; }
.g-danger .hb-btn { font-size: 13px; color: var(--mute); }
/* 1단계를 누르면 버튼이 위험색으로 바뀐다 — "정말인가"를 색이 먼저 묻는다. */
.g-danger .hb-btn.g-armed { color: #ff8a6a; border-color: #ff6a4577; }
.g-danger span { color: var(--mute); font-size: 12px; flex: 1; }

/* ── 대장간 ── 활 개조. 스탯 줄과 같은 뼈대(이름 · 지금 → 다음 · 버튼)라 한 화면으로 읽힌다. */
.f-h { display: flex; align-items: baseline; gap: 12px; border-top: 1px solid var(--line); margin-top: 20px; padding-top: 14px; }
.f-h h3 { flex: 1; margin: 0; color: var(--dim); font-size: 13px; letter-spacing: .12em; }
.f-h .f-bow { color: var(--ink); font-weight: 700; font-size: 15px; }
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

/* ── 재정비 머리 ── 여정이 남긴 것. "죽었다"가 아니라 "가져간다 · 다음은 여기부터"가 이 머리의 말이다. */
/* 머리 그림 — 고구려 무용총 「수렵도」 (public/art/출처.txt). 말 위에서 몸을 돌려 쏘는 사람들 —
   쓰러진 자리에서 다시 활을 드는 화면에 어울리는 그림이다. 패널이 열릴 때만 받는다. */
.r-head {
  position: relative; text-align: center; padding: 22px 12px 16px; margin: -4px -8px 4px; overflow: hidden;
  border-bottom: 1px solid var(--line);
  background:
    linear-gradient(to bottom, rgba(38, 37, 33, .5), rgba(47, 46, 41, .9) 70%, var(--paper) 100%),
    url(${BASE}art/suryeopdo.jpg) center 40% / cover no-repeat;
}
.r-cap { position: absolute; right: 12px; top: 8px; color: rgba(255, 244, 220, .6); font-size: 11px; letter-spacing: .06em; }
.r-lead { font-size: 14px; color: var(--dim); letter-spacing: .1em; }
.r-stage { font-size: 48px; font-weight: 700; color: var(--ink); font-family: var(--num); line-height: 1.15; }
@media (max-width: 640px) { .r-stage { font-size: 40px; } }
.r-new { color: var(--accent); font-weight: 700; margin-top: 6px; }
.r-old { color: var(--dim); margin-top: 6px; }
.r-keep { color: var(--body); margin-top: 10px; font-size: 14px; }
.r-keep b { color: var(--accent); font-weight: 700; }
.r-dot { color: var(--dim); margin: 0 8px; }
.r-next { color: var(--teal); margin-top: 8px; font-size: 13px; }
.r-none { color: var(--mute); font-size: 13px; padding: 10px 0 0; border-top: 1px solid var(--line); }
.r-foot { border-top: 1px solid var(--line); margin-top: 18px; padding-top: 16px; display: flex; justify-content: center; }
.r-go { font-size: 17px; padding: 13px 34px; }
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
  head.innerHTML = '<h3>대장간</h3><span class="f-bow"></span>'
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
      audio.levelup()
      row.el.classList.add('g-flash')
      window.setTimeout(() => row.el.classList.remove('g-flash'), FLASH_MS)
      refresh()
      onChange()
    })
    box.appendChild(el)
    rows.push(row)
  }

  const refresh = (): void => {
    bowOut.textContent = bowKind(d.bow).name
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
      r.btn.title = why === '' ? `${def?.name ?? ''} ${lv + 1}단 — 훈련치 ${forgeCost(lv)}` : why
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

  const head = document.createElement('div')
  head.className = 'g-h'
  head.innerHTML = '<h2>성장</h2><div class="g-train">훈련치 <b></b></div>'
  const trainOut = head.querySelector('b') as HTMLElement

  const sub = document.createElement('p')
  sub.className = 'hb-lead'
  sub.textContent = '올리면 몸이 어떻게 달라지는지 아래 줄에 미리 적혀 있다.'

  panel.append(head, sub)

  const rows = buildStatRows(d, trainOut, audio, onChange)
  panel.appendChild(rows.el)

  // ── 활 걸이 (docs/BOWS.md) ──
  // 장착은 다음 판부터다 — 판 도중에 활이 바뀌면 같은 시드가 다른 판이 된다 (A1).
  const rack = document.createElement('div')
  rack.className = 'g-bows'
  rack.innerHTML = '<h3>활 걸이</h3>'
  const rackSub = document.createElement('p')
  rackSub.className = 'hb-lead'
  rackSub.textContent = '바꾼 활은 다음 판부터 든다. 숙련은 그 활로 맞힌 수만큼 쌓여 '
    + '아래 "대가" 줄의 단점을 그만큼 깎는다 — 몇 % 줄었는지 그 자리에 뜬다.'
  rack.appendChild(rackSub)

  interface BowRow {
    id: BowKindId
    el: HTMLElement
    icon: HTMLElement
    name: HTMLElement
    perk: HTMLElement
    cost: HTMLElement
    syn: HTMLElement
    btn: HTMLButtonElement
  }
  const bowRows: BowRow[] = []
  for (const b of BOW_KINDS) {
    const el = document.createElement('div')
    el.className = 'g-bow'
    el.innerHTML = `
      <div><span class="g-bic"></span><span class="g-bname"></span><span class="g-borigin"></span></div>
      <div class="g-bperk"></div>
      <div class="g-bcost"></div>
      <div class="g-bsyn"></div>
      <button class="hb-btn g-bpick" type="button">들기</button>`
    const btn = el.querySelector('.g-bpick') as HTMLButtonElement
    btn.addEventListener('click', () => {
      d.bow = b.id
      writeSave(d)
      refresh()
      onChange()
    })
    bowRows.push({
      id: b.id,
      el,
      icon: el.querySelector('.g-bic') as HTMLElement,
      name: el.querySelector('.g-bname') as HTMLElement,
      perk: el.querySelector('.g-bperk') as HTMLElement,
      cost: el.querySelector('.g-bcost') as HTMLElement,
      syn: el.querySelector('.g-bsyn') as HTMLElement,
      btn,
    })
    ;(el.querySelector('.g-borigin') as HTMLElement).textContent = b.origin
    rack.appendChild(el)
  }
  panel.appendChild(rack)

  // ── 대장간 — 든 활의 개조 (game/forge.ts). 활 걸이 바로 아래: "이 활을 든다 → 이 활을 갈아 만든다".
  const forge = buildForgeRows(d, audio, onChange)
  panel.appendChild(forge.el)

  /** 활 걸이 갱신. 목록·조건·숙련 전부 여기서만 다시 그린다. */
  const refreshBows = (): void => {
    const owned = unlockedBows(d.unlocked)
    for (const row of bowRows) {
      const kind = BOW_KINDS.find((b) => b.id === row.id)
      if (kind === undefined) continue
      const has = row.id === 'practice' || owned.includes(row.id)
      const worn = d.bow === row.id
      row.el.classList.toggle('g-worn', worn)
      row.el.classList.toggle('g-lockd', !has)
      if (!has) {
        // 수집 화면과 같은 문법 — 이름은 가리고 조건은 보인다. 그게 궁금증의 절반이다.
        // 그림도 같이 가린다 — 이름만 ？？？고 활 실루엣은 그대로면 가려진 게 아니다
        // (형: "이미지도 글도 다 나와놓고 이름만 물음표하면 그게 가려진거냐?").
        row.icon.innerHTML = bowIconSvg('', 26)
        row.name.textContent = '？？？'
        const u = unlockOfBow(row.id)
        row.perk.textContent = u !== undefined ? u.hint : ''
        row.cost.textContent = ''
        row.syn.textContent = ''
        row.btn.style.display = 'none'
        continue
      }
      row.icon.innerHTML = bowIconSvg(row.id, 26)
      const hitsWith = Math.floor(d.bowHits[row.id] ?? 0)
      const lv = masteryLevel(hitsWith)
      const next = MASTERY_HITS[lv]
      const lvText = lv > 0 ? ` · 숙련 ${lv}` : ''
      const nextText = next !== undefined ? ` (${hitsWith}/${next})` : ''
      row.name.textContent = kind.name + lvText + nextText
      row.perk.textContent = kind.perk
      // 숙련이 대가를 얼마나 깎았는지 그 자리에서 % 로 보여준다 (형: "숙련도는 대체
      // 뭐에좋은건지 유저는 알 방법이 없어"). 성장 화면의 원칙과 같다 — 레벨 숫자만
      // 던지지 않고 **무엇이 달라지는지**를 말한다 (game/bows.ts eased()와 같은 식).
      const eased = Math.round(Math.min(1, lv * P.bowkind.masteryEase) * 100)
      const easeText = kind.cost !== '없음' && lv > 0 ? ` (숙련으로 ${eased}% 완화)` : ''
      row.cost.textContent = kind.cost === '없음' ? '' : `대가: ${kind.cost}${easeText}`
      row.syn.textContent = kind.synergy !== undefined ? `궁합: ${kind.synergy.label}` : ''
      row.btn.style.display = ''
      row.btn.textContent = worn ? '들고 있음' : '들기'
    }
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
  panel.appendChild(foot)

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
  panel.appendChild(danger)

  let armTimer = 0
  const disarm = (): void => {
    wipe.classList.remove('g-armed')
    wipe.textContent = '기록 전부 삭제'
  }
  wipe.addEventListener('click', () => {
    if (!wipe.classList.contains('g-armed')) {
      wipe.classList.add('g-armed')
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
    hint.textContent = d.offlineEnabled
      ? `훈련치는 공부하는 동안 쌓인다 (${(1 / perMin).toFixed(0)}분에 1)`
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

  const style = document.createElement('style')
  style.textContent = CSS
  panel.appendChild(style)

  // ── 머리: 여정이 남긴 것 ──
  // 이번 여정이 **영구히** 남긴 것만 센다. 판별 점수처럼 여정과 함께 사라지는 건 안 쓴다 —
  // "가져간다"고 써놓고 안 가져가면 그 줄은 다음부터 아무도 안 읽는다.
  // 0인 항목은 아예 안 쓴다 — '훈련치 0'은 위로가 아니라 조롱이다.
  const keeps: string[] = []
  if (info.training > 0) keeps.push(`훈련치 <b>${info.training}</b>`)
  if (info.stars > 0) keeps.push(`별 <b>${info.stars}</b>`)
  if (info.molgi) keeps.push('<b>몰기</b>')
  else if (info.jung >= 3) keeps.push(`최고 <b>${info.jung}중</b>`)
  const lead = info.reason === 'death'
    ? '쓰러졌다 — 이번 여정은'
    : info.reason === 'abandon'
      ? '여정을 접었다 — 이번은'
      : '화살이 다했다 — 이번 여정은'
  const head = document.createElement('div')
  head.className = 'r-head'
  head.innerHTML =
    '<div class="r-cap">무용총 「수렵도」</div>' +
    `<div class="r-lead">${lead}</div>` +
    `<div class="r-stage">${info.reached}판</div>` +
    (info.first
      ? '<div class="r-old">첫 기록 — 여기서부터 시작이다</div>'
      : info.isNew
        ? '<div class="r-new">최고 기록 경신</div>'
        : `<div class="r-old">최고 기록 ${info.best}판 · 점수 ${info.score}</div>`) +
    (keeps.length > 0 ? `<div class="r-keep">가져간다 &nbsp;${keeps.join('<span class="r-dot">·</span>')}</div>` : '') +
    // 어디서 다시 서는가 — "또 1판부터냐"가 접는 이유가 되지 않게 화면이 먼저 말한다.
    (info.nextStage > 1 ? `<div class="r-next">다음 여정은 ${info.nextStage}판부터 — 잡은 귀신은 다시 안 나온다</div>` : '')
  panel.appendChild(head)

  // ── 가운데: 성장 줄 ──
  const gh = document.createElement('div')
  gh.className = 'g-h'
  gh.innerHTML = '<h3>강화</h3><div class="g-train">훈련치 <b></b></div>'
  const trainOut = gh.querySelector('b') as HTMLElement
  const sub = document.createElement('p')
  sub.className = 'hb-lead'
  sub.textContent = '이번 여정에서 번 훈련치로 몸을 키운다. 올리면 어떻게 달라지는지 각 줄에 적혀 있다.'
  panel.append(gh, sub)

  const rows = buildStatRows(d, trainOut, audio, () => {})
  panel.appendChild(rows.el)

  // 대장간도 여기 선다 — 죽은 직후는 "활을 갈아 만들까"를 물을 가장 좋은 때다 (game/forge.ts).
  // 스탯 줄과 같은 지갑이라 "근력을 올릴까, 활채를 갈까"가 진짜 저울질이 된다.
  const forge = buildForgeRows(d, audio, () => {})
  panel.appendChild(forge.el)

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
    none.textContent = `훈련치가 ${Math.max(0, min - d.training)} 모자라다 — 판을 깰 때마다 쌓인다. 다음 여정에서 더 벌어 온다`
  }
  panel.appendChild(none)
  // 줄 안의 '올리기'가 세이브를 바꾸면 여기도 따라간다.
  const unsub = onSaveChanged(syncNone)

  // ── 아래: 다음 ──
  const foot = document.createElement('div')
  foot.className = 'r-foot'
  const go = document.createElement('button')
  go.type = 'button'
  go.className = 'hb-btn hb-pri r-go'
  go.textContent = '다음 →'
  go.setAttribute('aria-label', '출정 준비로')
  foot.appendChild(go)
  panel.appendChild(foot)

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
  const t = plus('훈련치', gain.training)
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
