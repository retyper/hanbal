// 시험 전용 진입점: node verify.mjs 가 `electron verify-main.cjs <phase>` 로 부른다. 결과는 한 줄 JSON 으로 stdout 에.
const { app } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const { createWindow, registerProtocol } = require('./main.cjs')
const phase = process.argv.find((a) => /^phase[12]$/.test(a))
const KEY = 'samhan.desktop.verify.test'
const OUT = process.env.SAMHAN_OUT || 'D:/tmp-node'
const res = { phase, checks: {} }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const finish = (code) => { console.log('VERIFY_RESULT ' + JSON.stringify(res)); app.exit(code) }

app.whenReady().then(async () => {
  registerProtocol()
  const win = createWindow({ show: false })
  const wc = win.webContents
  const ev = (code) => wc.executeJavaScript(code, true)
  try {
    await new Promise((r) => wc.once('did-finish-load', r))
    res.visibility = await ev('document.visibilityState')
    res.url = wc.getURL()
    // 타이틀 화면: 스플래시가 걷히고 캔버스가 그려질 때까지
    let splash = null
    for (let i = 0; i < 60; i++) {
      splash = await ev(`(()=>{const s=document.getElementById('splash');return s?getComputedStyle(s).visibility+'/'+s.className:'gone'})()`)
      if (splash === 'gone' || /hidden/.test(splash)) break
      await sleep(500)
    }
    await sleep(2500)
    res.splash = splash
    const img = await wc.capturePage()
    const png = img.toPNG()
    if (phase === 'phase1') fs.writeFileSync(path.join(OUT, 'desktop-title.png'), png)
    const size = img.getSize()
    res.checks.title = { bytes: png.length, size, canvases: await ev('document.querySelectorAll("canvas").length') }

    if (phase === 'phase1') {
      // 2) mp4 (H.264)
      res.checks.video = await ev(`new Promise((resolve) => {
        const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.loop = true
        v.src = 'realm/awaken-loop/w-31-dabeol-dalbit.mp4'
        document.body.appendChild(v)
        const t0 = Date.now()
        v.addEventListener('error', () => resolve({ ok: false, error: v.error && v.error.message, code: v.error && v.error.code }))
        v.play().catch((e) => resolve({ ok: false, error: String(e) }))
        const tick = setInterval(() => {
          if (v.readyState >= 3 && v.currentTime > 0.3) { clearInterval(tick); resolve({ ok: true, readyState: v.readyState, currentTime: v.currentTime, w: v.videoWidth, h: v.videoHeight, ms: Date.now() - t0 }) }
          else if (Date.now() - t0 > 15000) { clearInterval(tick); resolve({ ok: false, timeout: true, readyState: v.readyState, currentTime: v.currentTime }) }
        }, 100)
      })`)
      // 3) AudioContext
      res.checks.audio = await ev(`(async () => { const C = window.AudioContext || window.webkitAudioContext; const c = new C(); try { await c.resume() } catch(e){}; const r = { ok: !!c, state: c.state, sampleRate: c.sampleRate }; await c.close(); return r })()`)
      // 4) localStorage 쓰기
      res.checks.lsWrite = await ev(`(()=>{ localStorage.setItem(${JSON.stringify(KEY)}, 'persist-' + 42); return localStorage.getItem(${JSON.stringify(KEY)}) })()`)
    } else {
      res.checks.lsRead = await ev(`localStorage.getItem(${JSON.stringify(KEY)})`)
      await ev(`localStorage.removeItem(${JSON.stringify(KEY)})`)
      res.checks.lsAfterRemove = await ev(`localStorage.getItem(${JSON.stringify(KEY)})`)
    }
    finish(0)
  } catch (e) { res.error = String(e && e.stack || e); finish(1) }
})
