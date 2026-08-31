/**
 * 방어 버튼줄 — 판 도중에 방패와 두정갑을 산다 (game/defense.ts)
 *
 * 형: **"게임플레이 도중에 방어벽이나 방어구 구매하게 해달라."**
 *
 * 살통(ui/quiver.ts)과 **같은 문법**이다: HUD 줄에 선 작은 버튼, 누르면 그 자리에서
 * 적용, 모달 없음. 상점 화면을 따로 만들지 않은 이유가 여기 있다 — 화면을 열면 판이 멈추고,
 * 판이 멈추면 "지금 위험하니까 산다"는 이 기능의 유일한 이유가 사라진다.
 * 사는 순간은 적 화살이 날아오는 그 순간이어야 한다.
 *
 * 버튼에 값이 늘 적혀 있고(훈련치), 못 살 때는 **왜 못 사는지**가 그 자리에 뜬다.
 * 회색으로 꺼두기만 하면 사용자는 그게 버그인지 규칙인지 알 수 없다.
 */
import {
  DEFENSE_ITEMS, armorPer, defenseBlocked, defenseCost, defenseState, onDefenseChanged,
  shieldHp, type DefenseId,
} from '../game/defense.ts'
import { onSaveChanged, type SaveData } from '../game/save.ts'
import type { Overlay } from './overlay.ts'

const CSS = `
.d-row { display: flex; gap: 8px; align-items: flex-end; }
.d-btn { padding: 7px 12px; font-size: 13px; display: inline-flex; align-items: center; gap: 7px; }
@media (pointer: coarse) { .d-btn { min-height: 44px; padding: 7px 14px; } }
.d-btn b { font-size: 13px; color: var(--gold); }
/* 세워 둔 방패 · 입고 있는 갑옷 — 남은 양이 버튼에 그대로 적힌다. */
.d-btn.d-on { border-color: var(--teal); color: var(--teal); }
.d-btn.d-on b { color: var(--teal); }
.d-btn:disabled { opacity: .45; }
.d-hint { color: var(--mute); font-size: 11px; letter-spacing: .08em; margin-bottom: 4px; }
/* 폰 — 살통과 같은 규칙. 아이콘과 숫자만 남기고 이름을 접는다 (버튼이 궁수를 덮으면 안 된다). */
@media (max-width: 640px), (max-height: 560px) {
  .d-hint { display: none; }
  .d-row { flex-wrap: nowrap; gap: 6px; }
  .d-btn { min-width: 50px; height: 46px; padding: 0 8px; gap: 4px; }
  .d-btn .d-name { display: none; }
  .d-btn b { font-size: 12px; }
}
`

/** 버튼 하나에 적히는 숫자 — 가진 것이 있으면 남은 양, 없으면 값(훈련치)이다. */
function badge(id: DefenseId, held: number): string {
  if (held > 0) return id === 'shield' ? `${held}발` : `${held}`
  return `${defenseCost(id)}`
}

export function mountDefense(o: Overlay, d: SaveData, buy: (id: DefenseId) => boolean): void {
  const wrap = document.createElement('div')
  const style = document.createElement('style')
  style.textContent = CSS
  const hint = document.createElement('div')
  hint.className = 'd-hint'
  const row = document.createElement('div')
  row.className = 'd-row'
  wrap.append(style, hint, row)
  o.hud().appendChild(wrap)

  const refresh = (): void => {
    const st = defenseState()
    row.replaceChildren()
    for (const item of DEFENSE_ITEMS) {
      const held = item.id === 'shield' ? st.shield : st.armor
      const why = defenseBlocked(d, item.id, st)
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'hb-btn d-btn' + (held > 0 ? ' d-on' : '')
      btn.innerHTML = `<i class="hb-ic i-${item.id}"></i>`
        + `<span class="d-name">${item.name}</span><b>${badge(item.id, held)}</b>`
      // 값과 이유를 둘 다 말한다 — 하나만 말하면 "왜 안 눌리지"가 남는다.
      btn.title = why === ''
        ? `${item.name}(${item.origin}) — ${item.hint} · 훈련치 ${defenseCost(item.id)}`
        : `${item.name}(${item.origin}) — ${why}`
      btn.setAttribute('aria-label', btn.title)
      btn.disabled = why !== ''
      btn.addEventListener('click', () => {
        if (!buy(item.id)) return
        refresh()
      })
      row.appendChild(btn)
    }
    // 줄 위 한 줄은 **지금 뭘 걸치고 있는가**를 말한다. 아무것도 없으면 무엇을 파는지 말한다.
    const worn: string[] = []
    if (st.shield > 0) worn.push(`방패 ${st.shield}발`)
    if (st.armor > 0) worn.push(`두정갑 ${st.armor}`)
    hint.textContent = worn.length > 0
      ? worn.join(' · ')
      : `방어 — 방패 ${defenseCost('shield')} (화살 ${shieldHp()}발) · 두정갑 ${defenseCost('armor')} (+${armorPer()})`
  }

  refresh()
  // 두 갈래로 깨어난다: 훈련치가 바뀌면 세이브가, 방패가 깎이면 루프가 알린다.
  onSaveChanged(refresh)
  o.onDispose(onDefenseChanged(refresh))
}
