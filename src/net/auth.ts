/**
 * 로그인 — 파이어베이스 인증을 SDK 없이 (docs/realm/SERVER.md §4)
 *
 *  1. 구글로 보낸다 (response_type=id_token · nonce · state) → 2. 돌아오면 주소 조각에서 id_token 을 읽고 바로 지운다
 *  3. accounts:signInWithIdp 로 파이어베이스 토큰과 uid 를 받는다 → 4. refreshToken 만 기기에 둔다, idToken 은 메모리에만
 *
 * 앱(Capacitor) 판은 기기 로그인 플러그인의 id_token 으로 3번부터 같다 (구글 · 애플).
 * 순수한 부분(주소 만들기 · 조각 읽기 · JWT 몸 풀기)은 시험한다.
 */
import { FIREBASE, GOOGLE_CLIENT_ID } from './firebase-config.ts'

const AUTH_KEY = 'hanbal.auth'
const PENDING_KEY = 'hanbal.auth.pending'
const IDT = 'https://identitytoolkit.googleapis.com/v1'

export interface Account { readonly uid: string; readonly email: string; readonly name: string }
interface Stored extends Account { readonly refresh: string }

// ───────── 순수

/** 구글 로그인 주소 */
export function googleAuthUrl(redirect: string, nonce: string, state: string, clientId = GOOGLE_CLIENT_ID): string {
  const q = new URLSearchParams({
    client_id: clientId, redirect_uri: redirect, response_type: 'id_token', scope: 'openid email profile',
    nonce, state, prompt: 'select_account',
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${q.toString()}`
}

/** 돌아온 주소 조각(#id_token=…&state=… 또는 #error=…) */
export function readReturn(hash: string): { idToken: string; state: string } | { error: string } | null {
  if (!hash.startsWith('#')) return null
  const p = new URLSearchParams(hash.slice(1))
  if (p.has('error')) return { error: p.get('error') ?? 'error' }
  const idToken = p.get('id_token'), state = p.get('state')
  return idToken !== null && state !== null ? { idToken, state } : null
}

/** JWT 의 몸 (서명은 파이어베이스가 본다 — 여기서는 nonce 만 맞춰 본다) */
export function jwtBody(t: string): Record<string, unknown> {
  const part = t.split('.')[1] ?? ''
  const b64 = part.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (part.length % 4)) % 4)
  const bin = atob(b64)
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>
}

// ───────── 기기

function load(): Stored | null {
  try {
    const v = JSON.parse(localStorage.getItem(AUTH_KEY) ?? 'null') as Partial<Stored> | null
    return v !== null && typeof v.uid === 'string' && typeof v.refresh === 'string' ? { uid: v.uid, email: v.email ?? '', name: v.name ?? '', refresh: v.refresh } : null
  } catch { return null }
}
function store(s: Stored | null): void {
  try { if (s === null) localStorage.removeItem(AUTH_KEY); else localStorage.setItem(AUTH_KEY, JSON.stringify(s)) } catch { /* 저장 못 하는 곳 */ }
}

const rand = (): string => [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('')

/** 지금 로그인한 사람 — 없으면 null (토큰을 새로 받지 않는다) */
export function account(): Account | null {
  const s = load()
  return s === null ? null : { uid: s.uid, email: s.email, name: s.name }
}

/** 구글로 보낸다 — 이 페이지를 떠난다 */
export function signIn(): void {
  const nonce = rand(), state = rand()
  try { sessionStorage.setItem(PENDING_KEY, JSON.stringify({ nonce, state })) } catch { /* 저장 못 하는 곳 — 돌아와도 못 맞춘다 */ }
  location.assign(googleAuthUrl(location.origin + location.pathname, nonce, state))
}

/** 보낼 때 적어 둔 nonce·state — 한 번 읽으면 지운다 */
function readPending(): { nonce: string; state: string } | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? 'null') as { nonce?: unknown; state?: unknown } | null
    sessionStorage.removeItem(PENDING_KEY)
    return v !== null && typeof v.nonce === 'string' && typeof v.state === 'string' ? { nonce: v.nonce, state: v.state } : null
  } catch { return null }
}

let mem: { token: string; exp: number } | null = null

async function post(url: string, body: Record<string, unknown> | URLSearchParams): Promise<Record<string, unknown>> {
  const form = body instanceof URLSearchParams
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json' }, body: form ? body.toString() : JSON.stringify(body) })
  const d = (await res.json()) as Record<string, unknown>
  if (!res.ok) throw new Error(String((d['error'] as { message?: string } | undefined)?.message ?? res.status))
  return d
}

/**
 * 구글에서 돌아왔으면 로그인을 마친다 — 페이지를 열 때 한 번. 돌아온 게 아니면 null.
 * 주소 조각은 성공·실패와 상관없이 바로 지운다 (토큰이 주소창·기록에 남지 않게).
 */
export async function finishSignIn(): Promise<Account | { error: string } | null> {
  const back = readReturn(location.hash)
  if (back === null) return null
  history.replaceState(null, '', location.pathname + location.search)
  if ('error' in back) return back
  const pending = readPending()
  if (pending === null || pending.state !== back.state || jwtBody(back.idToken)['nonce'] !== pending.nonce) return { error: 'state' }
  const d = await post(`${IDT}/accounts:signInWithIdp?key=${FIREBASE.apiKey}`, {
    postBody: `id_token=${back.idToken}&providerId=google.com`, requestUri: location.origin, returnSecureToken: true, returnIdpCredential: false,
  })
  const s: Stored = { uid: String(d['localId']), email: String(d['email'] ?? ''), name: String(d['displayName'] ?? ''), refresh: String(d['refreshToken']) }
  store(s)
  mem = { token: String(d['idToken']), exp: Date.now() + Number(d['expiresIn'] ?? 3600) * 1000 }
  return { uid: s.uid, email: s.email, name: s.name }
}

/** 파이어베이스 idToken — 끝나 가면 새로 받는다. 로그인 안 했으면 null */
export async function idToken(): Promise<string | null> {
  const s = load()
  if (s === null) return null
  if (mem !== null && mem.exp - 60_000 > Date.now()) return mem.token
  let d: Record<string, unknown>
  try {
    d = await post(`https://securetoken.googleapis.com/v1/token?key=${FIREBASE.apiKey}`, new URLSearchParams({ grant_type: 'refresh_token', refresh_token: s.refresh }))
  } catch (e) {
    // 토큰이 죽었다(다른 기기에서 계정을 지움 · 막힘) — 로그아웃하고 손님으로. 판은 기기에 남는다
    if (/INVALID_REFRESH_TOKEN|USER_NOT_FOUND|USER_DISABLED|TOKEN_EXPIRED/.test(String((e as Error).message))) { signOut(); return null }
    throw e
  }
  mem = { token: String(d['id_token']), exp: Date.now() + Number(d['expires_in'] ?? 3600) * 1000 }
  if (typeof d['refresh_token'] === 'string' && d['refresh_token'] !== s.refresh) store({ ...s, refresh: d['refresh_token'] })
  return mem.token
}

/** 로그아웃 — 기기에서 토큰만 지운다. 판은 남는다 */
export function signOut(): void {
  mem = null
  store(null)
}

/** 파이어베이스 계정을 지운다 (자료는 sync 가 먼저 지운다). 로그인이 오래됐으면 'relogin' */
export async function deleteAccount(): Promise<'ok' | 'relogin'> {
  const t = await idToken()
  if (t === null) return 'ok'
  try {
    await post(`${IDT}/accounts:delete?key=${FIREBASE.apiKey}`, { idToken: t })
  } catch (e) {
    if (String((e as Error).message).includes('CREDENTIAL_TOO_OLD')) return 'relogin'
    throw e
  }
  signOut()
  return 'ok'
}
