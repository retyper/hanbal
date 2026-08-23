/**
 * 라이브 튜닝 콘솔 — 이 프로젝트의 디자인툴
 *
 * 게임이 돌아가는 중에 ` (백틱) 키로 열어 손맛을 슬라이더로 깎는다.
 * 값은 즉시 P에 반영되고 localStorage에 남으므로 새로고침해도 유지된다.
 * 마음에 드는 세팅을 찾으면 [복사] → params.ts 의 해당 k(...) 첫 인자에 붙여넣고 커밋.
 *
 * 왜 dat.gui 같은 라이브러리를 안 쓰나: ARCHITECTURE A6 (런타임 의존성 0).
 * 그리고 이건 개발 빌드에서만 로드되므로 프로덕션 번들에 들어가지 않는다.
 */
import { flatKnobs, getParam, setParam, type Knob } from './params.ts'

const STORE_KEY = 'hanbal.tune.v1'
const GROUP_LABEL: Record<string, string> = {
  bow: '활 · 시위',
  tremor: '떨림',
  stamina: '스태미나 · 붕괴',
  steady: '호흡정지',
  arrow: '화살 비행',
  wind: '바람',
  hit: '명중 반응',
  chain: '연쇄 폭발',
  growth: '성장 스탯',
  offline: '오프라인 축적',
  sim: '시뮬 코어',
}

function loadOverrides(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, number>) : {}
  } catch {
    return {}
  }
}

function saveOverrides(o: Record<string, number>): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(o))
  } catch {
    /* 프라이빗 모드 등. 저장 실패해도 게임은 계속 돈다 (ARCHITECTURE A4) */
  }
}

/** 저장된 튜닝값을 P에 적용. main.ts 가 sim 시작 전에 한 번 호출한다. */
export function applyStoredTuning(): void {
  const o = loadOverrides()
  for (const [path, v] of Object.entries(o)) setParam(path, v)
}

const fmt = (v: number, step: number): string => {
  const decimals = step >= 1 ? 0 : Math.min(5, String(step).split('.')[1]?.length ?? 2)
  return v.toFixed(decimals)
}

export function mountTuneConsole(): () => void {
  const overrides = loadOverrides()
  const rows: Array<{ path: string; knob: Knob; input: HTMLInputElement; out: HTMLElement; row: HTMLElement }> = []

  const root = document.createElement('div')
  root.id = 'tune-console'
  root.setAttribute('aria-label', '튜닝 콘솔')
  root.innerHTML = `
    <style>
      #tune-console {
        position: fixed; top: 0; right: 0; bottom: 0; width: 340px; z-index: 9999;
        background: #0d1117f2; color: #d7dde6; font: 12px/1.5 ui-monospace, "Cascadia Mono", monospace;
        border-left: 1px solid #2a3441; display: none; flex-direction: column;
        backdrop-filter: blur(6px);
      }
      #tune-console.open { display: flex; }
      #tune-console header { padding: 10px 12px; border-bottom: 1px solid #2a3441; display: flex; gap: 6px; align-items: center; }
      #tune-console h2 { font-size: 12px; margin: 0; flex: 1; font-weight: 600; letter-spacing: .04em; color: #eaf0f7; }
      #tune-console button {
        background: #1b2530; color: #b9c4d0; border: 1px solid #33404f; border-radius: 4px;
        padding: 4px 8px; cursor: pointer; font: inherit;
      }
      #tune-console button:hover { background: #253140; color: #fff; }
      #tune-console .search { width: 100%; box-sizing: border-box; background: #131a22; color: #d7dde6;
        border: 1px solid #2a3441; border-radius: 4px; padding: 6px 8px; font: inherit; margin: 8px 12px; width: calc(100% - 24px); }
      #tune-console .body { overflow-y: auto; flex: 1; padding: 0 12px 24px; scrollbar-width: thin; }
      #tune-console .grp { margin: 14px 0 6px; color: #7fd1c0; font-weight: 600; letter-spacing: .06em; }
      #tune-console .row { padding: 5px 0; border-bottom: 1px solid #1a222c; }
      #tune-console .row.hidden { display: none; }
      #tune-console .lbl { display: flex; gap: 6px; align-items: baseline; }
      #tune-console .lbl .t { flex: 1; color: #9fb0c2; }
      #tune-console .lbl .v { color: #ffd479; font-variant-numeric: tabular-nums; }
      #tune-console .lbl .u { color: #56657a; font-size: 10px; }
      #tune-console .row.dirty .t { color: #ffd479; }
      #tune-console input[type=range] { width: 100%; accent-color: #7fd1c0; margin: 2px 0 0; }
      #tune-console .hint { padding: 8px 12px; color: #56657a; border-top: 1px solid #2a3441; font-size: 11px; }
      #tune-console .ok { color: #7fd1c0; }
    </style>
    <header>
      <h2>튜닝 콘솔</h2>
      <button data-act="copy" title="변경된 값을 params.ts 형식으로 복사">복사</button>
      <button data-act="reset" title="전부 기본값으로">초기화</button>
      <button data-act="close">✕</button>
    </header>
    <input class="search" placeholder="검색 (예: 떨림, tremor, 스태미나)" />
    <div class="body"></div>
    <div class="hint">\` 키로 열고 닫기 · 값은 자동 저장됨</div>
  `

  const body = root.querySelector('.body') as HTMLElement
  const hint = root.querySelector('.hint') as HTMLElement
  const search = root.querySelector('.search') as HTMLInputElement

  let lastGroup = ''
  for (const { path, group, knob } of flatKnobs()) {
    if (group !== lastGroup) {
      const g = document.createElement('div')
      g.className = 'grp'
      g.textContent = GROUP_LABEL[group] ?? group
      body.appendChild(g)
      lastGroup = group
    }

    const current = overrides[path] ?? knob.v
    const row = document.createElement('div')
    row.className = 'row'
    row.innerHTML = `
      <div class="lbl">
        <span class="t"></span>
        <span class="v"></span>
        <span class="u"></span>
      </div>`
    const t = row.querySelector('.t') as HTMLElement
    const out = row.querySelector('.v') as HTMLElement
    const u = row.querySelector('.u') as HTMLElement
    t.textContent = knob.label
    t.title = path
    out.textContent = fmt(current, knob.step)
    u.textContent = knob.unit ?? ''

    const input = document.createElement('input')
    input.type = 'range'
    input.min = String(knob.min)
    input.max = String(knob.max)
    input.step = String(knob.step)
    input.value = String(current)
    input.setAttribute('aria-label', knob.label)
    row.appendChild(input)

    input.addEventListener('input', () => {
      const v = Number(input.value)
      setParam(path, v)
      out.textContent = fmt(v, knob.step)
      if (v === knob.v) delete overrides[path]
      else overrides[path] = v
      row.classList.toggle('dirty', v !== knob.v)
      saveOverrides(overrides)
    })

    row.classList.toggle('dirty', current !== knob.v)
    body.appendChild(row)
    rows.push({ path, knob, input, out, row })
  }

  search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase()
    for (const r of rows) {
      const hit = q === '' || r.knob.label.toLowerCase().includes(q) || r.path.toLowerCase().includes(q)
      r.row.classList.toggle('hidden', !hit)
    }
  })

  const flash = (msg: string): void => {
    const prev = hint.textContent
    hint.innerHTML = `<span class="ok">${msg}</span>`
    setTimeout(() => { hint.textContent = prev }, 1800)
  }

  root.addEventListener('click', (e) => {
    const act = (e.target as HTMLElement).dataset['act']
    if (act === 'close') toggle(false)
    if (act === 'reset') {
      for (const r of rows) {
        setParam(r.path, r.knob.v)
        r.input.value = String(r.knob.v)
        r.out.textContent = fmt(r.knob.v, r.knob.step)
        r.row.classList.remove('dirty')
        delete overrides[r.path]
      }
      saveOverrides(overrides)
      flash('기본값으로 되돌렸습니다')
    }
    if (act === 'copy') {
      const changed = rows.filter((r) => (getParam(r.path) ?? r.knob.v) !== r.knob.v)
      if (changed.length === 0) { flash('변경된 값이 없습니다'); return }
      const text = changed
        .map((r) => `  // ${r.path}: ${r.knob.v} -> ${fmt(getParam(r.path) ?? r.knob.v, r.knob.step)}`)
        .join('\n')
      const json = JSON.stringify(
        Object.fromEntries(changed.map((r) => [r.path, getParam(r.path)])), null, 2)
      void navigator.clipboard.writeText(`${text}\n\n${json}\n`)
        .then(() => flash(`${changed.length}개 값 복사됨 → params.ts 에 반영`))
        .catch(() => flash('클립보드 실패 — 콘솔 로그 확인'))
      console.log('[튜닝] 변경분\n' + text + '\n' + json)
    }
  })

  const toggle = (open?: boolean): void => {
    root.classList.toggle('open', open ?? !root.classList.contains('open'))
  }

  const onKey = (e: KeyboardEvent): void => {
    if (e.key === '`' && !e.metaKey && !e.ctrlKey) {
      e.preventDefault()
      toggle()
    }
  }

  document.body.appendChild(root)
  window.addEventListener('keydown', onKey)

  return () => {
    window.removeEventListener('keydown', onKey)
    root.remove()
  }
}
