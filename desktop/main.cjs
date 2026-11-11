// 삼한열전 데스크톱 껍데기 (Electron). 게임 본체는 건드리지 않고 빌드된 웹판을 app://game/ 으로 서빙한다.
// file:// 대신 표준·보안 프로토콜을 쓰는 이유: 상대/절대 경로, fetch, mp4 Range, localStorage 가 웹과 똑같이 동작하고 판이 재실행 뒤에도 남는다.
const { app, BrowserWindow, protocol, net, Menu, shell } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const { pathToFileURL } = require('node:url')

const SCHEME = 'app'
const HOST = 'game'
const START = `${SCHEME}://${HOST}/realm.html`

// 포장본은 resources/game, 개발 중에는 desktop/game
function gameRoot() {
  const packed = path.join(process.resourcesPath || '', 'game')
  return app.isPackaged ? packed : path.join(__dirname, 'game')
}

// 시험용으로 저장 위치를 바꿀 수 있다 (verify 가 진짜 판을 건드리지 않게)
if (process.env.SAMHAN_USER_DATA) app.setPath('userData', process.env.SAMHAN_USER_DATA)

protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
])

function registerProtocol() {
  const root = path.resolve(gameRoot())
  protocol.handle(SCHEME, (request) => {
    const url = new URL(request.url)
    if (url.host !== HOST) return new Response('not found', { status: 404 })
    let rel = decodeURIComponent(url.pathname)
    if (rel === '/' || rel === '') rel = '/realm.html'
    const file = path.resolve(root, '.' + rel)
    if (file !== root && !file.startsWith(root + path.sep)) return new Response('forbidden', { status: 403 })
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return new Response('not found', { status: 404 })
    // Range 헤더(영상 탐색)를 그대로 넘긴다
    return net.fetch(pathToFileURL(file).toString(), { headers: request.headers, bypassCustomProtocolHandlers: true })
  })
}

function toggleFullscreen(win) { win.setFullScreen(!win.isFullScreen()) }

function createWindow(opts = {}) {
  const win = new BrowserWindow({
    width: 1280, height: 800, minWidth: 960, minHeight: 600,
    show: opts.show !== false,
    backgroundColor: '#14181e',
    title: '삼한열전',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true, nodeIntegration: false, sandbox: true,
      autoplayPolicy: 'no-user-gesture-required',
      backgroundThrottling: opts.throttle === true, // 시험 때는 숨겨도 그리게
    },
  })
  win.setMenuBarVisibility(false)
  // F11 / Alt+Enter 전체화면. ESC 는 게임에 맡긴다 (여기서 가로채지 않음)
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return
    if (input.key === 'F11' || (input.alt && input.key === 'Enter')) { e.preventDefault(); toggleFullscreen(win) }
  })
  // 바깥 링크는 기본 브라우저로
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  win.loadURL(START)
  return win
}

module.exports = { createWindow, registerProtocol, START }

if (require.main === module && process.env.SAMHAN_VERIFY_PHASE) {
  // 포장본 시험: 같은 실행 파일이 시험 진입점으로 들어간다 (verify.mjs --packed)
  process.argv.push(process.env.SAMHAN_VERIFY_PHASE)
  require('./verify-main.cjs')
} else if (require.main === module) {
  if (!app.requestSingleInstanceLock()) { app.quit() }
  else {
    app.on('second-instance', () => {
      const w = BrowserWindow.getAllWindows()[0]
      if (w) { if (w.isMinimized()) w.restore(); w.focus() }
    })
    app.whenReady().then(() => {
      Menu.setApplicationMenu(null)
      registerProtocol()
      createWindow()
    })
    app.on('window-all-closed', () => app.quit())
  }
}
