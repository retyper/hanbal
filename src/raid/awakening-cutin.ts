import { HAEBI_AWAKEN_ULT as A } from '../tune/params.ts'
import { aw1SkillBody } from '../realm/data/skill-body-aw1.ts'
import { hasSkillBody } from '../realm/data/skill-body.ts'
import { prepareCutinPlate } from './cutin-plate.ts'
import type { HaebiRun } from './haebi.ts'

export function awakeningCutinArt(bust: string, awakeLook: boolean): { src: string; fullBody: boolean } {
 const full = awakeLook ? aw1SkillBody('../awaken-hd/' + bust) : hasSkillBody(bust) ? `skill-body/${bust}.jpg` : null
 return { src: full ?? `${awakeLook ? 'awaken-hd' : 'bust-hd'}/${bust}.jpg`, fullBody: full !== null }
}
/** No wall clock: pause, hidden tabs, and hit-stop retain the exact same image pose. */
export function awakeningCutinPose(progress: number) {
 const p = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0
 const enter = Math.min(1, p / A.enterFraction), ease = 1 - (1 - enter) ** 3
 return { x: ease === 1 ? 0 : -A.slideX * (1 - ease), y: A.slideY * (1 - ease), scale: A.startScale + (1 - A.startScale) * ease, opacity: ease }
}
export class RaidAwakeningCutin {
 private current: { run: HaebiRun; cast: NonNullable<HaebiRun['cast']>; end: number; body: HTMLElement; art: HTMLImageElement | HTMLCanvasElement; title: HTMLElement } | null = null
 private last = ''
 private host: HTMLElement
 private base: string
 private bust: string
 private skill: string
 private name: string
 constructor(host: HTMLElement, base: string, bust: string, skill: string, name: string) { this.host = host; this.base = base; this.bust = bust; this.skill = skill; this.name = name }
 get active() { return this.current !== null }
 prewarm(awakeLook: boolean) { const art = awakeningCutinArt(this.bust, awakeLook); if (art.fullBody) return prepareCutinPlate(this.base + art.src).then(() => true, () => false); const img = new Image(); img.src = this.base + art.src; return img.decode().then(() => true, () => false) }
 show(run: HaebiRun, awakeLook: boolean) {
  this.clear()
  const cast = run.cast; if (!cast || cast.kind !== 'ult' || !cast.awakened) return
  const body = document.createElement('div'); body.className = 'awakening-cutin'
  const img = new Image(), art = awakeningCutinArt(this.bust, awakeLook); img.className = 'awakening-cutin-art'; img.alt = ''; img.draggable = false
  const title = document.createElement('div'); title.className = 'awakening-cutin-title'
  const strong = document.createElement('b'), name = document.createElement('span'); strong.textContent = this.skill; name.textContent = this.name; title.append(strong, name)
  body.append(img, title); this.host.replaceChildren(body); this.host.hidden = false
  const entry: NonNullable<RaidAwakeningCutin['current']> = { run, cast, end: run.t + cast.t, body, art: img, title }; this.current = entry; this.last = ''
  let fellBack = false
  const fallback = () => {
   if (this.current !== entry || fellBack) return
   fellBack = true
   img.onerror = () => { if (this.current === entry) img.hidden = true }
   img.src = this.base + `${awakeLook ? 'awaken-hd' : 'bust-hd'}/${this.bust}.jpg`
   body.classList.add('portrait-fallback')
  }
  img.onerror = fallback
  body.classList.toggle('portrait-fallback', !art.fullBody); img.src = this.base + art.src; this.update(run)
  if (art.fullBody) void prepareCutinPlate(this.base + art.src).then(canvas => {
   if (this.current !== entry || fellBack) return
   canvas.className = 'awakening-cutin-art'; canvas.dataset['source'] = this.base + art.src
   img.onerror = null; body.replaceChild(canvas, img); entry.art = canvas; this.last = ''; this.update(run)
  }).catch(fallback)
 }
 update(run: HaebiRun) {
  const c = this.current; if (!c) return
  if (c.run !== run) { this.clear(); return }
  const casting = run.cast === c.cast
  const exit = casting ? 0 : Math.max(0, (run.t - c.end) / A.exitSeconds)
  if (exit >= 1) { this.clear(); return }
  const pose = awakeningCutinPose(casting ? 1 - c.cast.t / c.cast.total : 1)
  const x = pose.x + A.slideX * exit, y = pose.y - A.slideY * exit, opacity = pose.opacity * (1 - exit)
  const key = `${x}:${y}:${pose.scale}:${opacity}`; if (key === this.last) return; this.last = key
  c.art.style.transform = `translate(${x * 100}%,${y * 100}%) scale(${pose.scale})`; c.art.style.opacity = String(opacity)
  c.title.style.opacity = String(opacity)
 }
 clear() { if (!this.current) return; this.current.art.onerror = null; this.current = null; this.last = ''; this.host.replaceChildren(); this.host.hidden = true }
}
