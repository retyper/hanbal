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
    send(key) {
      return kit.say(kit.get(key).prompt)
    },
    async wait(maxS = 240) {
      for (let t = 0; t < maxS / 3; t++) {
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
