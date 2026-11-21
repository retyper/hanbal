import type { Kit } from './haebi.ts'

export const awakeUltPath = (kit: Kit) => `raid/fx/awaken/${kit}.png`
const pending = new WeakMap<Map<string, HTMLImageElement>, Map<Kit, Promise<boolean>>>()
/** Optional selected-kit art only. Failure never blocks the normal effect/start path. */
export function prewarmAwakeUlt(images: Map<string, HTMLImageElement>, kit: Kit, load: (path: string) => Promise<HTMLImageElement>): Promise<boolean> {
  const path = awakeUltPath(kit), ready = images.get(path)
  if (ready?.complete && ready.naturalWidth > 0) return Promise.resolve(true)
  let requests = pending.get(images)
  if (!requests) { requests = new Map(); pending.set(images, requests) }
  const old = requests.get(kit); if (old) return old
  const request = Promise.resolve().then(() => load(path)).then(async image => {
    await image.decode()
    if (!image.complete || image.naturalWidth <= 0) return false
    images.set(path, image); return true
  }).catch(() => false)
  requests.set(kit, request); return request
}
