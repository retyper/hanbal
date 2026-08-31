/**
 * 성장 화면
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
 */
import {
  canGrow,
  effectAfterLevel,
  effectOf,
  spendTraining,
  statLabel,
  STAT_KEYS,
  trainingCost,
  type StatKey,
} from '../game/progression.ts'
import { BOW_KINDS, masteryLevel, MASTERY_HITS, type BowKindId } from '../game/bows.ts'
import { bowIconSvg } from './arrowicons.ts'
import { onSaveChanged, wipeSave, writeSave, type SaveData } from '../game/save.ts'
import { unlockedBows, unlockOfBow } from '../game/unlocks.ts'
import { P } from '../tune/params.ts'
import type { Overlay } from './overlay.ts'

const PANEL_ID = 'growth'
/** 올린 직후 그 줄이 잠깐 밝아진다. 무엇이 바뀌었는지 눈이 따라가게 (ms). */
const FLASH_MS = 900

const CSS = `
.g-h { display: flex; align-items: baseline; gap: 14px; }
.g-h h2 { flex: 1; }
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
.g-up { grid-column: 2; grid-row: 1 / span 3; min-width: 108px; justify-content: center; }
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
`

interface Row {
  key: StatKey
  el: HTMLElement
  lv: HTMLElement
  now: HTMLElement
  next: HTMLElement
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

  const rows: Row[] = []
  for (let i = 0; i < STAT_KEYS.length; i++) {
    const key = STAT_KEYS[i]
    if (key === undefined) continue
    const el = document.createElement('div')
    el.className = 'g-row'
    el.innerHTML = `
      <div><i class="hb-ic g-ic"></i><span class="g-name"></span><span class="g-lv"></span></div>
      <div class="g-now"></div>
      <div class="g-next"></div>
      <button class="hb-btn g-up" type="button">올리기 <span class="g-cost"></span></button>`
    const btn = el.querySelector('.g-up') as HTMLButtonElement
    const row: Row = {
      key,
      el,
      lv: el.querySelector('.g-lv') as HTMLElement,
      now: el.querySelector('.g-now') as HTMLElement,
      next: el.querySelector('.g-next') as HTMLElement,
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
    panel.appendChild(el)
    rows.push(row)
  }

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
    trainOut.textContent = String(d.training)
    // 상한 도달을 알리지 않는다 (GDD 5장). 여기 있는 건 "어디서 오는가"뿐이다.
    const perMin = P.offline.trainingPerSec * 60
    hint.textContent = d.offlineEnabled
      ? `훈련치는 공부하는 동안 쌓인다 (${(1 / perMin).toFixed(0)}분에 1)`
      : `쌓지 않는 대신 판 보상 ×${P.offline.optOutBonus.toFixed(2)}`
    chk.checked = d.offlineEnabled
    syncSound()

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
    }

    refreshBows()
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
