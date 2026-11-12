// gemini-kit.js — 제미나이 탭에서 스프라이트 시트를 굽는 브라우저 쪽 도구 (게임과 무관 · 다른 게임에도 그대로)
//
// 설치 (탭마다가 아니라 gemini.google.com 출처에 한 번 · 이 페이지는 바깥 fetch 가 CSP 로 막힌다 → 코드를 직접 넣는다):
//   localStorage.skit = `<이 파일 전체>`; localStorage.skitSpec = '<heroes/*.json 내용>'  (명세를 고치면 skitSpec 만 다시)
// 쓸 때 (페이지를 새로 열었으면 매번 첫 줄):
//   eval(localStorage.skit)        // skit.spec 은 localStorage.skitSpec 에서
//   await skit.setup('u0')        새 대화에서: 이미지 만들기 · 16:9 · 파일 input 에 aria-label u0file0.. (find 로 찾아 file_upload)
//   await skit.send('walk', key)  걷기 시트 문안을 넣고 보냄 (첨부 2장 · 16:9 확인 못 하면 안 보냄)
//   await skit.send('act', key)   같은 대화에 동작 시트 (옛 4×2)
//   await skit.send('act6', key)  같은 대화에 동작 시트 3×2 (11-12 · 먼저 ref-act-3x2.png 를 첨부)
//   await skit.say(text)          고쳐 달라는 말
//   skit.state()                  응답 그림 수 · 생성 중인지
//   await skit.grab(name)         마지막 응답 그림을 캔버스로 받아 ~/Downloads/Gemini_Generated_Image_<name>.png
//                                 (원본 크기 단추는 자동화에서 내려받기가 안 될 때가 있다 · 캔버스 판은 1024×572)
// 규칙: 공유 단추는 절대 누르지 않는다.
;(() => {
  const W = (ms) => new Promise((r) => setTimeout(r, ms))
  const btnText = (re) => [...document.querySelectorAll('[role=menuitem],[role=option],[role=menuitemradio],button')].find((b) => re.test(b.innerText.trim()))
  const TAIL = 'Pure flat #00FF00 background, no grid lines, no shadow, no ground line, no text, no motion streaks, nothing in the bottom-right corner.'
  const ACT = {
    bow: '1 standing ready with the bow held low in her left hand, 2 raising the bow and nocking an arrow, 3 drawing the bowstring halfway, 4 full draw aiming to the right (bow arm straight forward, string hand at her cheek), 5 just released, bow still forward, ',
    spear: '1 battle-ready stance holding the spear in both hands at waist height, tip pointing forward-right, 2 pulling the spear back to wind up, 3 lunging forward with the long spear fully extended to the right, its tip far in front of her, 4 thrust follow-through, tip still forward, 5 recovering to stance, ',
    sword: '1 battle-ready stance with the sword raised in front, 2 raising the sword high to strike, 3 slashing the sword down and forward to the right, 4 slash follow-through with the sword low in front, 5 recovering to stance, ',
    dagger: '1 low crouched fighting stance with the dagger held forward in her front hand, 2 drawing the dagger hand back beside her hip, 3 lunging forward and stabbing to the right, arm fully extended with the blade in front of her fist, 4 stab follow-through, dagger still in front, 5 recovering to stance, ',
    heavy: '1 battle-ready stance holding it in both hands, 2 raising it high overhead, 3 smashing it down hard forward to the right, 4 follow-through with it low in front, 5 recovering, resting it on her shoulder again, ',
  }
  const WORD = { bow: 'bow', spear: 'spear', sword: 'sword', dagger: 'dagger', heavy: 'weapon' }
  const kit = {
    spec: JSON.parse(localStorage.skitSpec || '[]'),
    async load(url) {
      kit.spec = typeof url === 'string' ? await (await fetch(url, { cache: 'no-store' })).json() : url
      localStorage.skitSpec = JSON.stringify(kit.spec)
      return kit.spec.length
    },
    get(key) {
      const h = kit.spec.find((x) => x.key === key)
      if (!h) throw new Error('no spec ' + key)
      return h
    },
    // 남자(sex: 'man')는 ACT 의 her → his · armor 칸으로 「초상 옷 그대로」 (11-08 밤: 남장수는 갑옷·털옷이 초상의 얼굴이다)
    prompt(kind, key) {
      const t = kit._prompt(kind, key)
      return kit.get(key).sex === 'man' ? t.replace(/\bher\b/g, 'his') : t
    },
    _prompt(kind, key) {
      const h = kit.get(key)
      const w = WORD[h.weapon] || 'weapon'
      if (kind === 'walk')
        return `IMAGE 1 is a game sprite sheet: 4 columns x 2 rows = 8 frames of one ${h.sex || 'woman'} walking to the right (side view), each frame a different phase of the stride, hand-painted style, on pure flat green #00FF00, wide 16:9. IMAGE 2 is the portrait of the character I need, an adult in their twenties or older. Make a NEW wide 16:9 sprite sheet with EXACTLY the layout, cell size, character scale, foot line and painting style of IMAGE 1, but the character is ${h.desc}. ${h.extra || 'This battle outfit is sexier than the portrait.'} ${h.armor || 'NO armor, NO helmet.'} The character holds ${h.hold}. 8-frame WALKING cycle to the right, side view facing right in every frame (never turn the back to the viewer), ${h.stride}. All 8 frames show 8 clearly different leg positions (never repeat a pose): 1 right leg far forward, 2 right foot flat, 3 legs passing each other, 4 left leg swinging forward, 5 left leg far forward, 6 left foot flat, 7 legs passing, 8 right leg swinging forward; both feet stay on the same foot line, no kneeling, no jumping; arms swing opposite to the legs; the ${w} is held the same way in all 8 frames, in BOTH rows (do not copy the weapon or outfit of IMAGE 1, only its layout, scale and stride). Full body with feet in every cell, nothing touching the cell edges. ${TAIL}`
      if (kind === 'act6') {
        // 11-12 형: 「칸은 가로로 넓게 · 한 장에 적게 · 무기가 짧다」 — 3×2 가로 칸 · 사람은 칸 왼쪽 40% · 오른쪽은 무기 자리 (참고 시트 ref-act-3x2.png 를 이 메시지에 첨부)
        const four = (ACT[h.weapon] || ACT.heavy).split(/,s*5 /)[0] + ', '
        return `The image attached to THIS message is a LAYOUT reference only: a wide 16:9 game sprite sheet of 3 columns x 2 rows = 6 cells on pure flat green #00FF00. In every cell the figure stands in the LEFT 40% of the cell and the RIGHT 60% is empty green room for the weapon, so the whole weapon is always inside its cell with green margin on every side. Make a NEW wide 16:9 sprite sheet with EXACTLY this 3x2 layout, cell size, character scale and foot line, but with EXACTLY the same person and outfit as the walking sheet you just made (the person of IMAGE 2 of my first message; NOT the woman of this layout reference, NOT the person of IMAGE 1). Strict side view facing RIGHT in every cell. The ${w} is drawn at its FULL length in every cell, never shortened, never cut off, never crossing into the next cell; nothing touches any cell edge. Exactly ONE ${w} per cell. 6 cells in order, left to right, top row then bottom row: ${four}5 hit recoil, torso jerked backward, head thrown back, pained face, still facing right, 6 lying on the back on the ground with the ${w} beside. The weapon never points backward. ${TAIL}`
      }
      return `Great. Now make a SECOND image with EXACTLY the same wide 16:9 4x2 layout, cell size, character scale, foot line and EXACTLY the same person and outfit as the walking sheet you just made (the person of IMAGE 2, NOT the person of IMAGE 1), strict side view facing RIGHT in every frame, every figure and the whole ${w} fully inside its cell. Exactly ONE ${w} in every frame. 8 frames in order: ${ACT[h.weapon] || ACT.heavy}6 hit recoil, torso jerked backward, head thrown back, pained face, still facing right, 7 falling backward off the feet, 8 lying on the back on the ground with the ${w} beside. The weapon never points backward. ${TAIL}`
    },
    async setup(tag = 'u') {
      await W(2500)
      // 진짜 클릭으로 이미 이미지 모드면(비율 단추가 보이면) 메뉴를 다시 누르지 않는다 — 다시 누르면 꺼진다 (11-08 밤 u/0)
      if (!btnText(/가로세로 비율|^16:9$/)) {
        document.querySelector('button[aria-label="업로드 및 도구"]')?.click()
        await W(800)
        // 보이는 메뉴 칸만 (숨은 말풍선·사이드바 글자를 누르면 안 켜진다)
        ;[...document.querySelectorAll('[role=menuitem],[role=option],button,a,li')].find((e) => e.offsetParent && /^이미지 만들기/.test((e.innerText || '').trim()))?.click()
        await W(1000)
      }
      btnText(/가로세로 비율/)?.click()
      await W(800)
      btnText(/^16:9$/)?.click()
      await W(600)
      for (let t = 0; t < 4 && !document.querySelectorAll('input[type=file]').length; t++) {
        document.querySelector('button[aria-label="업로드 및 도구"]')?.click()
        await W(900)
      }
      document.querySelectorAll('input[type=file]').forEach((e, i) => e.setAttribute('aria-label', tag + 'file' + i))
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      return { inputs: document.querySelectorAll('input[type=file]').length, wide: !!btnText(/^16:9$/) }
    },
    async say(text, need = 0) {
      await W(1500)
      const ed = document.querySelector('.ql-editor')
      ed.focus()
      document.execCommand('insertText', false, text)
      await W(700)
      const att = document.querySelectorAll('uploader-file-preview').length
      if (need && (att !== need || !btnText(/^16:9$/))) return { sent: false, att }
      document.querySelector('button[aria-label="메시지 보내기"], button.send-button').click()
      return { sent: true, att }
    },
    // Veo: 새 대화에서 동영상 만들기 · 세로 9:16 · 파일 칸 이름표 (사진 1장 + 문안 파일은 pickText 로)
    async veoSetup(tag = 'v') {
      await W(2500)
      document.querySelector('button[aria-label="업로드 및 도구"]')?.click()
      await W(800)
      ;[...document.querySelectorAll('[role=menuitem],[role=option],button,a,li')].find((e) => e.offsetParent && /^동영상 만들기/.test((e.innerText || '').trim()))?.click()
      await W(1200)
      btnText(/^(가로|세로)/)?.click()
      await W(800)
      ;[...document.querySelectorAll('[role=menuitem],[role=option],[role=menuitemradio],button')].find((e) => e.offsetParent && /세로 모드/.test(e.innerText))?.click()
      await W(800)
      for (let t = 0; t < 4 && !document.querySelectorAll('input[type=file]').length; t++) {
        document.querySelector('button[aria-label="업로드 및 도구"]')?.click()
        await W(900)
      }
      document.querySelectorAll('input[type=file]').forEach((e, i) => e.setAttribute('aria-label', tag + 'file' + i))
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      // 문안 파일을 받을 내 칸 (Gemini 칸과 따로 · 내용이 채팅 도구 호출로 지나가지 않게)
      if (!document.getElementById('skittxt')) {
        const i = document.createElement('input')
        i.type = 'file'
        i.id = 'skittxt'
        i.setAttribute('aria-label', 'skit-text')
        i.style.cssText = 'position:fixed;top:0;left:0;z-index:99999'
        document.body.appendChild(i)
      }
      return { inputs: document.querySelectorAll('input[type=file]').length, tall: !!btnText(/^세로/) }
    },
    // 내 칸에 올린 문안 파일을 넣고 보냄 · 사진 1장·세로가 아니면 안 보냄
    async sendVeo() {
      const f = document.getElementById('skittxt')?.files?.[0]
      if (!f) return { sent: false, why: 'no text file' }
      const text = await f.text()
      document.getElementById('skittxt').remove()
      await W(1000)
      const att = document.querySelectorAll('uploader-file-preview').length
      if (att !== 1 || !btnText(/^세로/)) return { sent: false, att, tall: !!btnText(/^세로/) }
      const ed = document.querySelector('.ql-editor')
      ed.focus()
      document.execCommand('insertText', false, text)
      await W(700)
      document.querySelector('button[aria-label="메시지 보내기"], button.send-button').click()
      await W(4000)
      return { sent: true, att, chars: text.length, url: location.href, refused: /지금은 동영상을 생성할 수 없습니다/.test(document.body.innerText) }
    },
    // 다 된 Veo 영상을 받는다 (「동영상 다운로드」 단추는 첫 번째 뒤로 자주 안 먹는다 → 영상 주소를 fetch 해 저장)
    async grabVideo(name) {
      for (let t = 0; t < 15 && !document.querySelector('video')?.currentSrc; t++) await W(1000)
      const v = document.querySelector('video')
      if (!v) return { ok: false, text: [...document.querySelectorAll('model-response')].at(-1)?.innerText.slice(0, 200) }
      const res = await fetch(v.currentSrc || v.src, { credentials: 'include' })
      const b = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(b)
      a.download = 'veo_' + name + '.mp4'
      document.body.appendChild(a)
      a.click()
      return { ok: res.ok, size: b.size, dur: v.duration }
    },
    send(kind, key) {
      return kit.say(kit.prompt(kind, key), kind === 'walk' ? 2 : kind === 'act6' ? 1 : 0)
    },
    imgs() {
      return [...document.querySelectorAll('main img')].filter((i) => i.naturalWidth > 800 && i.closest('model-response, message-content, [class*=response]'))
    },
    state() {
      return { images: kit.imgs().length, busy: !!document.querySelector('[aria-label*="중지"], [aria-label*="Stop"]') }
    },
    async grab(name, atLeast = 1) {
      const imgs = kit.imgs()
      if (imgs.length < atLeast) return { ok: false, images: imgs.length }
      const im = imgs.at(-1)
      const c = document.createElement('canvas')
      c.width = im.naturalWidth
      c.height = im.naturalHeight
      c.getContext('2d').drawImage(im, 0, 0)
      const b = await new Promise((r) => c.toBlob(r, 'image/png'))
      const a = document.createElement('a')
      a.href = URL.createObjectURL(b)
      a.download = 'Gemini_Generated_Image_' + name + '.png'
      document.body.appendChild(a)
      a.click()
      return { ok: true, images: imgs.length, size: b.size, w: im.naturalWidth }
    },
  }
  window.skit = kit
})()
