/**
 * 앱으로 설치 — **버튼이 없었던 게 원인이다** (2026-09-11)
 *
 * 형: **"그리고 왜 아직도 앱으로는 다운 안받아지는거야?"**
 *
 * 서버 쪽은 처음부터 멀쩡했다. 배포 주소에서 manifest(application/manifest+json)·
 * sw.js·아이콘 192/512 가 전부 200 이고, 조건도 다 맞는다. 그런데 **화면에 누를 것이 없었다.**
 * 2026-09-10 에 PWA 를 붙이면서 "설치 안내는 하지 않는다 (GDD 9장)"이라고 적어 뒀는데,
 * 그 조항이 막으려던 건 **광고·출석보상 같은 조르기**지 "설치하는 법"이 아니었다.
 * 브라우저 메뉴(⋮ → 앱 설치)를 아는 사람만 설치할 수 있는 건 기능이 없는 것과 같다.
 *
 * ── 그래서 규칙을 이렇게 좁힌다 ────────────────────────────────────────
 * 1. **브라우저가 된다고 할 때만** 뜬다 (`beforeinstallprompt`). 안 되는 자리에서는
 *    아예 없다 — 눌러도 안 되는 버튼이 조르기다.
 * 2. **한 자리에만** 뜬다. 판을 여는 화면(출정·성장)의 아래 줄이다. 게임 중에는 안 뜬다 (C1).
 * 3. **설치했으면 사라진다.** 이미 앱으로 열었으면(standalone) 처음부터 없다.
 * 4. 아이폰은 `beforeinstallprompt` 가 없다 — 사파리는 **공유 → 홈 화면에 추가**뿐이다.
 *    그 경우에는 버튼이 그 방법을 한 줄로 알려준다. 거짓 버튼을 만들지 않는다.
 */

/** 브라우저가 준 설치 이벤트. 한 번 쓰면 없어진다. */
interface InstallEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: string }>
}

let waiting: InstallEvent | null = null
let installed = false
const listeners: Array<() => void> = []

function notify(): void {
  for (const fn of listeners) fn()
}

/** 이미 앱으로 열려 있는가 (홈 화면에서 띄운 창). */
function standalone(): boolean {
  const mm = window.matchMedia
  if (typeof mm === 'function') {
    for (const q of ['(display-mode: standalone)', '(display-mode: fullscreen)', '(display-mode: minimal-ui)']) {
      if (mm.call(window, q).matches) return true
    }
  }
  // iOS 사파리는 display-mode 대신 이 옛 깃발을 쓴다.
  return (navigator as unknown as { standalone?: boolean }).standalone === true
}

/** 아이폰·아이패드의 사파리인가 — 설치가 '공유 → 홈 화면에 추가' 뿐인 자리. */
function iosSafari(): boolean {
  const ua = navigator.userAgent
  const isIOS = /iPad|iPhone|iPod/.test(ua)
    // 아이패드는 최근 판에서 데스크탑처럼 보고한다 — 터치 포인트 수로 가른다.
    || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  if (!isIOS) return false
  // 크롬·파이어폭스 iOS 판도 결국 사파리 엔진이라 같은 길이다.
  return true
}

/**
 * 브라우저의 설치 신호를 **일찍** 잡는다. main.ts 가 시작하자마자 한 번 부른다 —
 * `beforeinstallprompt` 는 로드 직후에 한 번 오고, 그때 안 잡으면 영영 못 잡는다.
 */
export function armInstall(): void {
  if (standalone()) {
    installed = true
    return
  }
  window.addEventListener('beforeinstallprompt', (e) => {
    // 기본 배너를 막고 우리 버튼으로 돌린다. 막지 않으면 브라우저가 제멋대로 띄운다.
    e.preventDefault()
    waiting = e as InstallEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    installed = true
    waiting = null
    notify()
  })
}

/** 지금 설치 버튼을 보여야 하는가. 'ios' 는 방법만 알려주는 자리다. */
export function installState(): 'ready' | 'ios' | 'no' {
  if (installed || standalone()) return 'no'
  if (waiting !== null) return 'ready'
  return iosSafari() ? 'ios' : 'no'
}

/**
 * 아래 줄에 붙이는 설치 버튼. 보일 필요가 없으면 **스스로 숨는다.**
 * `toast` 는 아이폰에서 방법을 한 줄로 띄우는 데 쓴다.
 */
export function mountInstall(into: HTMLElement, toast: (text: string, ms?: number) => void): void {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'hb-btn hb-install'
  btn.innerHTML = '<span>앱으로 설치</span>'

  const sync = (): void => {
    const st = installState()
    btn.style.display = st === 'no' ? 'none' : ''
    btn.title = st === 'ios'
      ? '사파리 공유 단추 → 홈 화면에 추가'
      : '홈 화면에 앱으로 설치한다 — 주소창 없이 뜬다'
  }

  btn.addEventListener('click', () => {
    const st = installState()
    if (st === 'ios') {
      // 아이폰에는 설치를 대신 눌러 줄 방법이 없다. 그러면 **방법을 정확히** 말해 준다.
      toast('사파리 아래 공유 단추 → "홈 화면에 추가"', 6000)
      return
    }
    const ev = waiting
    if (ev === null) return
    waiting = null
    sync()
    void ev.prompt().then(() => ev.userChoice).then((r) => {
      if (r.outcome !== 'accepted') {
        // 거절했으면 이번 판에서는 다시 안 조른다. 브라우저가 다음에 또 신호를 준다.
        return
      }
      installed = true
      notify()
    }).catch(() => { /* 브라우저가 거절했다 — 조용히 지나간다 */ })
  })

  listeners.push(sync)
  sync()
  into.appendChild(btn)
}
