/**
 * 「저장 · 불러오기」 창 (형 10-26: "림월드랑 문명에도 있듯이 수동 저장이랑 불러오기도") — 그리기만. 칸·파일 다루기는 saves.ts, 손짓은 app.ts
 *
 *  - 판 안(나라 판 차림): 이름 넣기 · 칸마다 저장/덮어쓰기 · 불러오기 · 비우기 · 파일로 내려받기 · 파일에서 불러오기
 *  - 첫 화면: 불러오기 · 파일에서 불러오기만
 * 덮어쓰기·비우기·불러오기는 그 칸 밑에 한 줄로 한 번 더 묻는다 (브라우저 확인 창은 쓰지 않는다)
 */
import { seasonLabel } from '../../realm/data/prose.ts'
import { boardLabel } from './front.ts'
import type { SaveMeta } from './saves.ts'
import type { RegionId } from '../../realm/types.ts'
import { lang, t as tr } from '../../i18n/index.ts'

export interface SaveBoxKit {
  readonly esc: (s: string) => string
  readonly emblem: (nation: string, cls?: string) => string
}

export type SaveAsk = { readonly n: number; readonly act: 'over' | 'drop' | 'load' }

export interface SaveBoxView {
  readonly mode: 'game' | 'title'
  readonly slots: ReadonlyArray<SaveMeta | null>
  /** 넣고 있는 이름 */
  readonly name: string
  /** 비워 두면 붙는 이름 (「3년 겨울 · 비화가야」) */
  readonly placeholder: string
  readonly nameMax: number
  /** 불러오면 하던 판이 「다른 판」으로 간다 (하던 판이 있다) */
  readonly hasGame: boolean
  readonly ask: SaveAsk | null
  readonly msg: { readonly text: string; readonly bad: boolean } | null
  /** 첫 화면에서 열었을 때 — 끝나지 않은 판들 (front.slotsHtml) · 저장한 칸 위에 */
  readonly shelf?: string | undefined
}

function when(iso: string): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  return new Date(t).toLocaleString(lang() === 'en' ? 'en-US' : 'ko-KR', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function askHtml(k: SaveBoxKit, v: SaveBoxView, m: SaveMeta | null): string {
  if (v.ask === null) return ''
  const lb = tr('svb.lb', { label: k.esc(m?.label ?? '') })
  const [text, yes] = v.ask.act === 'over' ? [tr('svb.over', { lb }), tr('svb.yesOver')]
    : v.ask.act === 'drop' ? [tr('svb.drop', { lb }), tr('svb.yesDrop')]
    : [tr('svb.open', { lb, keep: v.hasGame ? ` ${tr('svb.keepNote')}` : '' }), tr('svb.yesOpen')]
  return `<div class="svask"><span>${text}</span><button class="btn pri" data-act="sv-yes">${yes}</button><button class="btn ghost" data-act="sv-no">${tr('svb.no')}</button></div>`
}

export function saveBoxHtml(k: SaveBoxKit, v: SaveBoxView): string {
  const game = v.mode === 'game'
  let h = `<div class="svbox" role="dialog" aria-label="${game ? tr('svb.saveLoad') : tr('svb.load')}"><button class="bx" data-act="sv-x" aria-label="${tr('more.closeAria')}">✕</button>`
  h += `<h3>${game ? tr('svb.saveLoad') : tr('svb.load')}</h3>`
  if (game) h += `<label class="svn"><span>${tr('svb.nameLabel')}</span><input class="svname" type="text" maxlength="${v.nameMax}" placeholder="${k.esc(v.placeholder)}" value="${k.esc(v.name)}"></label>`
  if (!game && v.shelf !== undefined && v.shelf !== '') h += v.shelf + (v.slots.some((m) => m !== null) ? `<small class="svh">${tr('svb.saved')}</small>` : '')
  h += `<div class="svlist">`
  v.slots.forEach((m, n) => {
    if (m === null && !game) return
    h += `<div class="svrow${m === null ? ' empty' : ''}${v.ask?.n === n ? ' asking' : ''}"><span class="svno">${n + 1}</span>`
    h += m === null
      ? `<span class="svt"><b>${tr('svb.empty')}</b></span>`
      : `${k.emblem(m.nation, 'svem')}<span class="svt"><b>${k.esc(m.label)}</b><small>${k.esc(m.name)} · ${k.esc(boardLabel(m.region as RegionId))} · ${k.esc(seasonLabel(m))}</small><small>${k.esc(when(m.savedAt))}</small></span>`
    h += `<span class="svb">`
    if (game) h += `<button class="btn" data-act="sv-save" data-n="${n}">${m === null ? tr('svb.here') : tr('svb.overBtn')}</button>`
    if (m !== null) h += `<button class="btn pri" data-act="sv-load" data-n="${n}">${tr('svb.load')}</button><button class="btn ghost svx" data-act="sv-drop" data-n="${n}" aria-label="${tr('rl.clear')}">✕</button>`
    h += `</span></div>`
    if (v.ask?.n === n) h += askHtml(k, v, m)
  })
  if (!game && v.slots.every((m) => m === null) && (v.shelf ?? '') === '') h += `<p class="mute svnone">${tr('svb.none')}</p>`
  h += `</div>`
  if (v.msg !== null) h += `<p class="svmsg${v.msg.bad ? ' bad' : ''}" role="status">${k.esc(v.msg.text)}</p>`
  h += `<div class="svfile">${game ? `<button class="btn" data-act="sv-down">${tr('svb.down')}</button>` : ''}<button class="btn" data-act="sv-file">${tr('svb.file')}</button>`
    + `<input class="svpick" type="file" accept=".json,application/json" hidden></div>`
  h += `<p class="mute svhint">${tr('svb.hint')}</p>`
  return h + `</div>`
}

export const SAVE_CSS = `
.ap .saveov { position: absolute; inset: 0; z-index: 92; display: flex; align-items: center; justify-content: center; padding: 16px; background: #000b; }
.ap .saveov .svbox { position: relative; width: min(560px, 100%); max-height: 90%; overflow-y: auto; padding: 16px 16px 14px; border-radius: 16px; border: 1px solid #c9a45a; background: #1f1710f8; box-shadow: 0 10px 40px #000c; color: #f0e2c0; }
.ap .saveov h3 { margin: 0 0 10px; font-size: 19px; }
.ap .saveov .bx { position: absolute; right: 10px; top: 8px; border: 0; background: none; color: #cbbf9f; font-size: 18px; cursor: pointer; }
.ap .saveov .svn { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; } .ap .saveov .svn span { flex: none; font-size: 13px; color: #cbbf9f; }
.ap .saveov .svname { flex: 1; min-width: 0; padding: 7px 10px; border-radius: 8px; border: 1px solid #6a5236; background: #120d08; color: #f0e2c0; font: inherit; }
.ap .saveov .svlist { display: flex; flex-direction: column; gap: 6px; }
.ap .saveov .svrow { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 10px; border: 1px solid #5a4630; background: #2a2016; }
.ap .saveov .svrow.empty { background: transparent; border-style: dashed; } .ap .saveov .svrow.empty .svt b { color: #8f8778; font-weight: 400; }
.ap .saveov .svrow.asking { border-color: #e0bd78; }
.ap .saveov .svno { flex: none; width: 18px; text-align: center; color: #8f8778; font-size: 12px; }
.ap .saveov .svem { width: 30px; height: 30px; flex: none; }
.ap .saveov .svt { flex: 1; min-width: 0; display: flex; flex-direction: column; } .ap .saveov .svt b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ap .saveov .svt small { color: #cbbf9f; font-size: 11.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ap .saveov .svb { flex: none; display: flex; gap: 4px; flex-wrap: wrap; justify-content: flex-end; } .ap .saveov .svb .btn { padding: 5px 9px; font-size: 13px; }
.ap .saveov .svask { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: -2px 0 4px; padding: 8px 10px; border-radius: 10px; background: #3a2c1e; border: 1px solid #e0bd78; }
.ap .saveov .svask span { flex: 1 1 200px; font-size: 13.5px; }
.ap .saveov .svmsg { margin: 10px 0 0; padding: 8px 10px; border-radius: 8px; background: #2a3a1e; border: 1px solid #6a8a46; font-size: 13.5px; }
.ap .saveov .svmsg.bad { background: #4a1a12; border-color: #c05040; color: #ffd8c8; }
.ap .saveov .svfile { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; } .ap .saveov .svfile .btn { flex: 1 1 160px; justify-content: center; }
.ap .saveov .svhint, .ap .saveov .svnone { margin: 8px 0 0; font-size: 12px; }
`
