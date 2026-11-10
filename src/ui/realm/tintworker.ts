/**
 * 계절 바탕 굽는 일꾼 — 그림 한 장에 계절 빛을 입혀 JPEG 로 되돌려 준다. 메인 스레드는 비트맵 하나 넘기고 받기만 한다
 * (4배 느린 폰에서 getImageData·빛 셈·putImageData·인코딩이 0.5초 긴 작업이었다 · 카드 C2).
 * 화면 전용 — 판 상태를 안 건드린다.
 */
import { tintPixels } from './seasontint.ts'

interface Job { id: number; bmp: ImageBitmap; season: 'spring' | 'summer' | 'autumn' | 'winter'; q: number }

self.onmessage = async (e: MessageEvent<Job>): Promise<void> => {
  const { id, bmp, season, q } = e.data
  try {
    const c = new OffscreenCanvas(bmp.width, bmp.height)
    const g = c.getContext('2d')!
    g.drawImage(bmp, 0, 0)
    bmp.close()
    if (season !== 'spring') {
      const img = g.getImageData(0, 0, c.width, c.height)
      tintPixels(img.data, season)
      g.putImageData(img, 0, 0)
    }
    const blob = await c.convertToBlob({ type: 'image/jpeg', quality: q })
    self.postMessage({ id, blob })
  } catch {
    self.postMessage({ id, blob: null })
  }
}
