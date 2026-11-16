import { isBreakthrough, type Breakthrough } from '../realm/vanguard.ts'
import { HAEBI_VANGUARD as V } from '../tune/params.ts'

/** One receipt, tied to this iframe and this pending battle round. */
export function mountVanguard(owner: HTMLElement, seed: number, review = false): Promise<Breakthrough | undefined> {
  return new Promise(resolve => {
    const token = crypto.randomUUID(), cover = document.createElement('div')
    cover.setAttribute('role', 'dialog'); cover.setAttribute('aria-label', '선봉에 서기 · 해비 난전 돌파')
    cover.style.cssText = 'position:fixed;inset:0;z-index:20000;background:#101b20;display:flex;flex-direction:column'
    const close = document.createElement('button')
    close.textContent = '출전 취소 · 합전 명령으로 돌아가기'
    close.style.cssText = 'min-height:36px;background:#263735;color:#ffe9ba;border:0;cursor:pointer'
    const frame = document.createElement('iframe')
    frame.title = '각성 해비의 선봉 돌파전'; frame.allow = 'fullscreen'; frame.style.cssText = 'border:0;flex:1;width:100%;min-height:0'
    frame.src = `${import.meta.env.BASE_URL}raid.html?vanguard=${token}&seed=${seed}${import.meta.env.DEV && review ? '&review' : ''}`
    const wasInert = owner.inert
    owner.inert = true
    cover.append(close, frame); document.body.append(cover)
    let settled = false, started = false
    const finish = (n?: Breakthrough) => {
      if (settled) return
      settled = true; window.removeEventListener('message', receive); observer.disconnect(); owner.inert = wasInert; cover.remove(); resolve(n)
    }
    const receive = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== frame.contentWindow || e.data?.token !== token) return
      if (e.data.type === 'hanbal.haebi.vanguard-start') { started = true; close.hidden = true }
      if (e.data.type !== 'hanbal.haebi.vanguard-result' || !started || !isBreakthrough(e.data.breaches)) return
      const time = e.data.elapsed
      if (typeof time !== 'number' || !Number.isFinite(time) || time < 0 || time > V.duration + 1) return
      if (e.data.breaches > 0 && time < V.captainAt[e.data.breaches - 1]!) return
      finish(e.data.breaches)
    }
    const observer = new MutationObserver(() => { if (!owner.isConnected) finish() })
    observer.observe(document.body, { childList: true, subtree: true })
    close.onclick = () => { if (!started) finish() }
    window.addEventListener('message', receive)
  })
}
