// gemini-kit.js — 제미나이 탭에서 스프라이트 시트를 굽는 브라우저 쪽 도구 (게임과 무관 · 다른 게임에도 그대로)
//
// 설치 (탭마다가 아니라 gemini.google.com 출처에 한 번 · 이 페이지는 바깥 fetch 가 CSP 로 막힌다 → 코드를 직접 넣는다):
//   localStorage.skit = `<이 파일 전체>`; localStorage.skitSpec = '<heroes/*.json 내용>'  (명세를 고치면 skitSpec 만 다시)
// 쓸 때 (페이지를 새로 열었으면 매번 첫 줄):
//   eval(localStorage.skit)        // skit.spec 은 localStorage.skitSpec 에서
//   await skit.setup('u0')        새 대화에서: 이미지 만들기 · 16:9 · 파일 input 에 aria-label u0file0.. (find 로 찾아 file_upload)
//   await skit.send('walk', key)  걷기 시트 문안을 넣고 보냄 (첨부 2장 · 16:9 확인 못 하면 안 보냄)
//   await skit.send('act', key)   같은 대화에 동작 시트 (옛 4×2)
//   await skit.send('walk9', key)  새 대화 · 비율 1:1 · 걷기 3×3 (첨부: ref-walk-3x3.png · 초상) · 9번 자홍 네모
//   await skit.send('act5', key)  같은 대화에 동작 시트 3×2 · 5컷 + 우하단 자홍 네모 (11-12 · 먼저 ref-act-3x2.png 첨부)
//   await skit.send('act5solo', key)  새 대화에서 동작만 (첨부: ref-act-3x2.png · 초상 · [옷 참고])
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
  const ACT3 = {
    bow: ['standing upright at full height, relaxed but ready, the bow held low in the left hand', 'raising the bow, an arrow nocked, starting to draw', 'full draw aiming to the right, bow arm straight forward, string hand at the cheek'],
    spear: ['standing upright at full height, battle-ready, the spear held in both hands at waist height, tip pointing forward-right', 'pulling the spear back to wind up, weight on the back foot', 'lunging forward with the spear thrust fully to the right, arms straight, the tip far in front'],
    sword: ['standing upright at full height, battle-ready, the sword held in front', 'raising the sword high overhead to strike', 'slashing down and forward to the right, the sword extended low in front, arms straight'],
    dagger: ['standing upright at full height, ready, the dagger in the front hand', 'drawing the dagger hand back beside the hip', 'lunging forward and stabbing to the right, arm fully extended, the blade in front of the fist'],
    heavy: ['standing upright at full height, holding it in both hands', 'raising it high overhead', 'smashing it down hard forward to the right, arms extended'],
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
      if (kind === 'walk9') {
        // 11-12 형: 「걷기 참고할 프레임 전달용 이미지는 웹에도 있다」 — CC0 8컷 걷기 견본(itch.io mostlydecent 「8 frame walk」)을 색 마네킹 3×3 으로 · 9번 자홍 네모
        //   첨부: IMAGE 1 ref-walk-3x3.png · IMAGE 2 초상 · 비율 1:1
        const hold = h.hold || (h.weapon === 'bow' ? 'ONE bow in the left hand' : 'ONE ' + w)
        return `IMAGE 1 is a POSE and LAYOUT reference only: a square 1:1 sheet of 3 columns x 3 rows = 9 cells on pure flat green #00FF00. Cells 1 to 8 (left to right, top to bottom) show an 8-frame WALKING cycle of a colour-coded mannequin walking to the right: the purple leg and the blue leg are its two legs, the red arm is the near arm and the orange arm the far arm, so every cell has a different leg position. Cell 9 (bottom-right) is a solid magenta #FF00FF square with NOTHING drawn in it. IMAGE 2 is the portrait of the character I need, an adult in their twenties or older. Make a NEW square 1:1 sprite sheet with EXACTLY this 3x3 layout, cell size, character scale and foot line: in each of cells 1 to 8 the character walks to the right copying EXACTLY the leg and arm positions of the mannequin in the same cell, and cell 9 stays the same empty solid magenta #FF00FF square. Do NOT copy the mannequin's look, colours or blocky pixel style: paint the real character in the hand-painted style of IMAGE 2. The character is ${h.desc || 'the person of IMAGE 2'}. ${h.extra || 'This battle outfit is sexier than the portrait.'} ${h.armor || 'NO armor, NO helmet.'} The character holds ${hold}, held exactly the same way in all 8 cells, close to the body and fully inside the cell (a long weapon rests on the shoulder pointing up and back). Strict side view facing right in every cell, never turning the back to the viewer; full body with both feet on the same foot line in every cell; no kneeling, no jumping; nothing touches any cell edge. Pure flat #00FF00 background everywhere except the magenta square, no grid lines, no shadow, no ground line, no text, no motion streaks.`
      }
      if (kind === 'act5' || kind === 'act5solo') {
        // 11-12 형: 「프레임 몇 개·각각 어떤 모습 · 우하단은 워터마크용 자홍 네모」 — 3×2 가로 칸 · 5컷 + 자홍 네모
        //   1 서기(대기 겸 · 걷기와 같은 키) 2 당김 3 최대로 뻗은 공격 4 맞음 5 누움 6 자홍 네모(워터마크 자리 · 그리지 않음)
        //   게임 20컷: 서기 0~3 = 1 · 공격 12~17 = 1,2,3,3,3,1 · 맞음 18 = 4 · 쓰러짐 19 = 5 (compose20 NACT=5)
        const three = ACT3[h.weapon] || ACT3.heavy
        const hold = h.hold || (h.weapon === 'bow' ? 'ONE bow in the left hand' : 'ONE ' + w)
        const who = kind === 'act5'
          ? 'EXACTLY the same person and outfit as the walking sheet you just made (the person of IMAGE 2 of my first message), NOT the man of this layout reference'
          : (h.desc || 'the person of IMAGE 2') + ' (the person of IMAGE 2, NOT the man of IMAGE 1). ' + (h.extra || '') + ' ' + (h.armor || 'NO armor, NO helmet.') + ' If a third image is attached, it shows this character in battle: copy that outfit, its colors and the weapon exactly'
        const lead = kind === 'act5' ? 'The image attached to THIS message is a LAYOUT reference only' : 'IMAGE 1 is a LAYOUT reference only'
        return `${lead}: a wide 16:9 game sprite sheet, 3 columns x 2 rows = 6 cells, hand-painted style, on pure flat green #00FF00. Cells 1 to 4 show the figure standing in the LEFT 40% of the cell with the RIGHT 60% left empty for the weapon; cell 5 shows the figure lying down; cell 6 (bottom-right) is a solid magenta #FF00FF square with NOTHING drawn in it. Make a NEW wide 16:9 sprite sheet with EXACTLY this 3x2 layout, the same cell size, character scale and foot line, and the same solid magenta #FF00FF square in the bottom-right cell with nothing in it. The character is ${who}, holding ${hold}. Strict side view facing RIGHT in cells 1 to 4. The ${w} is drawn at its FULL length in every cell, never shortened, never cut off, never crossing into another cell; nothing touches any cell edge. Exactly ONE ${w} per cell. Cells in order: 1 ${three[0]}, 2 ${three[1]}, 3 ${three[2]}, 4 hit recoil, torso jerked backward, head thrown back, pained face, still facing right, 5 lying on the back on the ground with the ${w} beside, 6 the empty magenta square. The weapon never points backward. Pure flat #00FF00 background everywhere except the magenta square, no grid lines, no shadow, no ground line, no text, no motion streaks.`
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
      return kit.say(kit.prompt(kind, key), kind === 'walk' || kind === 'walk9' || kind === 'act5solo' ? 2 : kind === 'act5' ? 1 : 0)
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
