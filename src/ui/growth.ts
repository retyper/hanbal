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
import { onSaveChanged, writeSave, type SaveData } from '../game/save.ts'
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
/* 올린 직후 한 번 번쩍. 왼쪽 잉크 바 — 버튼 hover와 같은 문법이다. */
.g-row.g-flash { background: #ffb3471a; box-shadow: inset 3px 0 0 var(--accent); }
.g-name { color: var(--ink); font-weight: 700; font-size: 17px; letter-spacing: -.01em; }
.g-lv { color: var(--mute); font-size: 13px; margin-left: 10px; }
.g-now { grid-column: 1; color: var(--body); }
.g-next { grid-column: 1; color: var(--teal); font-size: 13px; }
.g-next.g-flat { color: var(--mute); }
.g-up { grid-column: 2; grid-row: 1 / span 3; min-width: 108px; justify-content: center; }
.g-cost { color: var(--accent); }
.g-up[disabled] .g-cost { color: inherit; }

.g-foot {
  border-top: 1px solid var(--line); margin-top: 20px; padding-top: 16px;
  display: flex; align-items: center; gap: 14px;
}
.g-foot label { display: flex; align-items: center; gap: 9px; cursor: pointer; color: var(--body); }
.g-foot input { accent-color: var(--teal); width: 16px; height: 16px; }
.g-hint { color: var(--mute); font-size: 13px; flex: 1; text-align: right; }
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
      <div><span class="g-name"></span><span class="g-lv"></span></div>
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
    btn.addEventListener('click', () => {
      if (!spendTraining(d, key, 1)) return
      // 무엇이 바뀌었는지 그 자리에서. 화면을 닫았다 열게 하지 않는다.
      row.el.classList.add('g-flash')
      window.setTimeout(() => row.el.classList.remove('g-flash'), FLASH_MS)
      refresh()
      onChange()
    })
    panel.appendChild(el)
    rows.push(row)
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

  // ── HUD 버튼 ──
  const open = document.createElement('button')
  open.type = 'button'
  open.className = 'hb-btn'
  open.innerHTML = '성장 <span class="hb-key">Tab</span><span class="hb-dot"></span>'
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
