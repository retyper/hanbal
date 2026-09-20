/**
 * 서비스 워커 — 홈화면에서 주소창 없이, 지하철에서도 열리게 (2026-09-10)
 *
 * 형: **"폰에서 가로로 하니까 상단 브라우저 기본UI가 계속 거슬리는데 PWA로 만들면 안되나?"**
 *
 * 이 파일이 있어야 크롬이 "홈 화면에 추가"를 설치로 대접한다 (manifest.webmanifest 와 짝).
 * 설치되면 display:fullscreen · orientation:landscape 로 떠서 주소창이 사라진다.
 *
 * ── 이 워커가 어기면 안 되는 것 ────────────────────────────────────────
 * 1. **백그라운드에서 아무것도 안 한다** (GDD 1장 C3). push·sync·주기 작업을 등록하지 않는다.
 *    서비스 워커는 요청이 올 때만 깨어나고 곧 잠든다 — 공부 중 CPU를 먹지 않는다.
 * 2. **새 배포를 가로막지 않는다.** 문서(HTML)는 네트워크 우선이라 배포하면 그 자리에서 새 판이
 *    뜬다. 해시가 박힌 에셋(assets/*.js)만 캐시 우선이고, 배포마다 이름이 바뀌므로 낡을 수가 없다.
 * 3. 실패해도 게임이 멈추지 않는다. 캐시가 없으면 그냥 네트워크로 간다.
 */
/**
 * ★ 아이콘·소리·그림처럼 **이름이 안 바뀌는** public/ 파일은 여기 캐시에 **먼저** 걸린다.
 *   그래서 아이콘을 새로 구워 배포해도 이미 설치한 사람에게는 **옛 아이콘이 계속 나온다.**
 *   2026-09-11, 형: "아주작은 신궁 아이콘이 아직도 활과 화살모양이야."
 *   고치는 법은 하나다 — **이 이름을 올린다.** activate 가 다른 이름의 캐시를 전부 지운다.
 *   public/ 의 그림·소리를 갈아 끼울 때마다 여기를 올려라.
 */
const CACHE = 'hanbal-v3'

/**
 * ★ 2026-09-20 — **이름을 올리는 것에 기대지 않는다.** 위의 규칙("갈아 끼울 때마다 이름을 올려라")을 내가 어겼다:
 *   주인공의 몸 그림을 같은 이름(hero-plain.png)으로 덮어쓰고 이름을 안 올려서, 형의 화면에는 **옛 그림에 새 좌표**가 섞여 나왔다
 *   (곧게 선 몸 위에 사법 자세의 어깨 좌표 → 팔이 몸에서 떨어져 보였다). 사람이 기억해야 지켜지는 규칙은 언젠가 또 깨진다.
 *   그래서 **해시가 없는 파일(public/ 의 그림·소리·글꼴)은 네트워크 우선**으로 바꾼다 — 배포하면 그 자리에서 새 그림이 뜬다.
 *   오프라인이면 캐시로 떨어진다 (지하철에서도 열린다는 약속은 그대로다). 해시가 박힌 번들(assets/*)만 캐시 우선이다.
 */
const HASHED = //assets/[^/]+-[A-Za-z0-9_-]{6,}.[a-z0-9]+$/

self.addEventListener('install', () => {
  // 미리 받아두는 목록은 두지 않는다 — 파일 이름에 해시가 박혀 있어 여기 적으면 배포마다 틀린다.
  // 대신 한 번 지나간 것만 담는다 (아래 fetch). 두 번째 방문부터 오프라인으로 열린다.
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k)
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  // 남의 집 것은 건드리지 않는다 (소리 고르기 페이지가 Freesound CDN 을 튼다).
  if (new URL(req.url).origin !== self.location.origin) return

  // ── 문서 — 네트워크 우선 ──
  // 형은 GitHub Pages 로만 확인한다. 문서를 캐시 우선으로 두면 새로 배포해도 옛 판이 뜬다.
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req)
        const c = await caches.open(CACHE)
        c.put(req, fresh.clone())
        return fresh
      } catch {
        return (await caches.match(req)) ?? (await caches.match('./')) ?? Response.error()
      }
    })())
    return
  }

  // ── 그 밖(스크립트·글꼴·그림·소리) — 캐시 우선 ──
  // 이름에 해시가 박혀 있어 낡지 않는다. public/ 의 소리·그림은 이름이 고정이지만
  // 바뀌는 일이 드물고, 바뀌면 CACHE 이름을 올리면 된다.
  if (!HASHED.test(new URL(req.url).pathname)) {
    // 이름이 고정된 파일 — 네트워크 우선, 실패하면 캐시.
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req, { cache: 'no-cache' })
        if (fresh.ok && fresh.type === 'basic') {
          const c = await caches.open(CACHE)
          c.put(req, fresh.clone())
        }
        return fresh
      } catch {
        return (await caches.match(req)) ?? Response.error()
      }
    })())
    return
  }
  e.respondWith((async () => {
    const hit = await caches.match(req)
    if (hit) return hit
    const res = await fetch(req)
    if (res.ok && res.type === 'basic') {
      const c = await caches.open(CACHE)
      c.put(req, res.clone())
    }
    return res
  })())
})
