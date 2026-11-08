// gpt-kit.js — 챗지피티 탭에서 그림 한 장씩 굽는 도구 (게임과 무관)
// 설치: gemini-kit 과 같다 (임시 file input 으로 이 파일과 명세 JSON 을 올려 localStorage.gkit / gkitSpec)
// 불러오기: eval(localStorage.gkit) 가 막히면 trustedTypes 정책을 거친다 (README 의 LOAD)
//   await gkit.send(key)      입력칸을 비우고 명세의 문안을 넣어 보냄 (길이가 맞을 때만 · 남은 초안이 붙어 두 문안이 같이 가는 사고 막기)
//   await gkit.wait()         그림이 다 될 때까지 (한도 문구면 { limit })
//   await gkit.grab(name)     마지막 큰 그림을 ~/Downloads/gpt_<name>.png 로
// 첨부 사진은 find 「사진 첨부」 file input → file_upload (명세의 ref 사진)
;(() => {
  const W = (ms) => new Promise((r) => setTimeout(r, ms))
  const ed = () => document.querySelector('[contenteditable=true]')
  const sendBtn = () => document.querySelector('[data-testid=send-button], #composer-submit-button, button[aria-label="보내기"]')
  const last = () => [...document.querySelectorAll('[data-message-author-role=assistant]')].at(-1)?.innerText || ''
  const big = () => [...document.querySelectorAll('main img')].filter((i) => i.naturalWidth > 1000)
  const kit = {
    spec: JSON.parse(localStorage.gkitSpec || '[]'),
    get(key) {
      const h = kit.spec.find((x) => x.key === key)
      if (!h) throw new Error('no spec ' + key)
      return h
    },
    clear() {
      const e = ed()
      e.focus()
      document.execCommand('selectAll')
      document.execCommand('delete')
      return e.innerText.trim().length
    },
    async say(text) {
      kit.clear()
      document.execCommand('insertText', false, text)
      await W(1000)
      const len = ed().innerText.length
      if (Math.abs(len - text.length) > 5) return { sent: false, why: 'length', len, want: text.length }
      for (let t = 0; t < 15 && !(sendBtn() && !sendBtn().disabled); t++) await W(1000)
      const s = sendBtn()
      if (!s || s.disabled) return { sent: false, why: 'no send button' }
      const before = big().length
      s.click()
      kit._before = before
      await W(2500)
      return { sent: true, url: location.href }
    },
    // 첨부 사진이 입력칸에 없으면 보내지 않는다 (11-08 밤: find 의 ref 가 페이지 다시 그리기에 사라져 사진 없이 문안만 나감)
    async send(key, needImg = 1) {
      for (let t = 0; t < 10 && kit.attached() < needImg; t++) await W(1000)
      if (kit.attached() < needImg) return { sent: false, why: 'no attachment', attached: kit.attached() }
      return kit.say(kit.get(key).prompt)
    },
    attached() {
      const f = ed()?.closest('form')
      return f ? f.querySelectorAll('img').length : 0
    },
    async wait(maxS = 240) {
      for (let t = 0; t < maxS / 3; t++) {
        // 무료 계정이 붐비면 「평소보다 오래 · 나중에 생성」 → 무료 예약을 누르고 대화 주소를 돌려준다 (몇 분 뒤 그 대화를 열어 grab)
        const later = [...document.querySelectorAll('button')].find((b) => /^나중에 생성$/.test(b.innerText.trim()))
        if (later) {
          later.click()
          return { queued: true, url: location.href }
        }
        const busy = !!document.querySelector('[data-testid=stop-button]')
        if (/한도|limit|제한에 도달|이미지 생성.*(기다|후에)/i.test(last()) && !busy) return { limit: last().slice(0, 300) }
        if (!busy && big().length > (kit._before ?? 0)) {
          await W(2500)
          return { done: true, images: big().length }
        }
        await W(3000)
      }
      return { timeout: true, text: last().slice(0, 200) }
    },
    async grab(name) {
      const im = big().at(-1)
      if (!im) return { ok: false }
      const b = await (await fetch(im.src)).blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(b)
      a.download = 'gpt_' + name + '.png'
      document.body.appendChild(a)
      a.click()
      return { ok: true, size: b.size, w: im.naturalWidth, h: im.naturalHeight }
    },
  }
  window.gkit = kit
})()
