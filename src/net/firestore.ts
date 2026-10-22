/**
 * Firestore REST — SDK 없이 fetch 로 (docs/realm/SERVER.md S4 · ARCHITECTURE A6 의존 0)
 *
 * 쓰는 것만 있다: 문서 읽기(필드 마스크) · commit(쓰기 여럿을 한 번에 — 조건(updateTime)과 서버 시각을 같이 건다) · 칸 훑기.
 * 값 꼴 바꾸기(JSON ↔ Firestore Value)는 순수 함수라 시험한다 (tests/net/firestore.test.ts).
 */
import { FIREBASE } from './firebase-config.ts'

export type FsValue =
  | { nullValue: null } | { booleanValue: boolean } | { integerValue: string } | { doubleValue: number }
  | { stringValue: string } | { bytesValue: string } | { timestampValue: string }
  | { arrayValue: { values?: FsValue[] } } | { mapValue: { fields?: Record<string, FsValue> } }

export type FsFields = Record<string, FsValue>

const ROOT = `projects/${FIREBASE.projectId}/databases/(default)/documents`
const API = `https://firestore.googleapis.com/v1/${ROOT}`

/** 문서의 온전한 이름 — commit 이 쓴다 */
export const docName = (path: string): string => `${ROOT}/${path}`

// ───────── 값 꼴 바꾸기

/** 바이트 ↔ base64 (브라우저·노드 둘 다 있는 btoa/atob) */
export function toBase64(b: Uint8Array): string {
  let s = ''
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000))
  return btoa(s)
}
export function fromBase64(s: string): Uint8Array {
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export function toValue(v: unknown): FsValue {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
  if (typeof v === 'string') return { stringValue: v }
  if (v instanceof Uint8Array) return { bytesValue: toBase64(v) }
  if (v instanceof Date) return { timestampValue: v.toISOString() }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } }
  if (typeof v === 'object') return { mapValue: { fields: toFields(v as Record<string, unknown>) } }
  throw new Error(`Firestore 에 못 넣는 값: ${typeof v}`)
}

export function toFields(o: Record<string, unknown>): FsFields {
  const f: FsFields = {}
  for (const [k, v] of Object.entries(o)) if (v !== undefined) f[k] = toValue(v)
  return f
}

/** Firestore 값 → JS. 정수는 number 로(2^53 넘는 값은 이 게임에 없다), bytes 는 Uint8Array, 시각은 ISO 문자열 */
export function fromValue(v: FsValue): unknown {
  if ('nullValue' in v) return null
  if ('booleanValue' in v) return v.booleanValue
  if ('integerValue' in v) return Number(v.integerValue)
  if ('doubleValue' in v) return v.doubleValue
  if ('stringValue' in v) return v.stringValue
  if ('bytesValue' in v) return fromBase64(v.bytesValue)
  if ('timestampValue' in v) return v.timestampValue
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(fromValue)
  return fromFields(v.mapValue.fields ?? {})
}

export function fromFields(f: FsFields): Record<string, unknown> {
  const o: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(f)) o[k] = fromValue(v)
  return o
}

// ───────── 부르기

export class FsError extends Error {
  readonly status: number
  readonly code: string
  constructor(status: number, code: string, msg: string) { super(msg); this.status = status; this.code = code }
  /** 조건(updateTime)이 어긋났다 — 그사이 다른 기기가 썼다 */
  get conflict(): boolean { return this.code === 'FAILED_PRECONDITION' || this.code === 'ABORTED' || this.status === 409 }
}

async function call(url: string, token: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } })
  if (!res.ok && res.status !== 404) {
    let code = '', msg = res.statusText
    try { const e = (await res.json()) as { error?: { status?: string; message?: string } }; code = e.error?.status ?? ''; msg = e.error?.message ?? msg } catch { /* 몸이 JSON 이 아니다 */ }
    throw new FsError(res.status, code, msg)
  }
  return res
}

export interface FsDoc { readonly fields: Record<string, unknown>; readonly updateTime: string }

/** 문서 하나 — 없으면 null. mask 를 주면 그 필드만 받는다 (판의 data 를 안 받고 meta 만 볼 때) */
export async function getDoc(path: string, token: string, mask?: readonly string[]): Promise<FsDoc | null> {
  const q = mask !== undefined ? '?' + mask.map((m) => `mask.fieldPaths=${encodeURIComponent(m)}`).join('&') : ''
  const res = await call(`${API}/${path}${q}`, token)
  if (res.status === 404) return null
  const d = (await res.json()) as { fields?: FsFields; updateTime: string }
  return { fields: fromFields(d.fields ?? {}), updateTime: d.updateTime }
}

/** 칸 안의 문서 이름들 (계정 지우기 — 판 기록을 다 지울 때) */
export async function listIds(collection: string, token: string): Promise<string[]> {
  const ids: string[] = []
  let page = ''
  do {
    const res = await call(`${API}/${collection}?pageSize=300&mask.fieldPaths=v${page !== '' ? `&pageToken=${encodeURIComponent(page)}` : ''}`, token)
    if (res.status === 404) break
    const d = (await res.json()) as { documents?: Array<{ name: string }>; nextPageToken?: string }
    for (const x of d.documents ?? []) ids.push(x.name.slice(x.name.lastIndexOf('/') + 1))
    page = d.nextPageToken ?? ''
  } while (page !== '')
  return ids
}

export type Write =
  | { readonly kind: 'set'; readonly path: string; readonly data: Record<string, unknown>; readonly ifUpdateTime?: string | null; readonly stamp?: string }
  | { readonly kind: 'delete'; readonly path: string }

/**
 * 쓰기 여럿을 한 번에(다 되거나 다 안 되거나). set 은 문서를 통째로 바꾼다.
 * ifUpdateTime: 문자열이면 서버 문서가 그 updateTime 일 때만 · null 이면 문서가 없을 때만 · 없으면 조건 없음.
 * stamp: 그 필드에 서버 시각을 넣는다. 돌려주는 것은 쓰기마다 새 updateTime.
 */
export async function commit(writes: readonly Write[], token: string, keepalive = false): Promise<string[]> {
  const body = {
    writes: writes.map((w) => {
      if (w.kind === 'delete') return { delete: docName(w.path) }
      return {
        update: { name: docName(w.path), fields: toFields(w.data) },
        ...(w.stamp !== undefined ? { updateTransforms: [{ fieldPath: w.stamp, setToServerValue: 'REQUEST_TIME' }] } : {}),
        ...(w.ifUpdateTime === null ? { currentDocument: { exists: false } } : w.ifUpdateTime !== undefined ? { currentDocument: { updateTime: w.ifUpdateTime } } : {}),
      }
    }),
  }
  const res = await call(`https://firestore.googleapis.com/v1/${ROOT}:commit`, token, { method: 'POST', body: JSON.stringify(body), keepalive })
  const d = (await res.json()) as { writeResults?: Array<{ updateTime?: string }>; commitTime?: string }
  return (d.writeResults ?? []).map((r) => r.updateTime ?? d.commitTime ?? '')
}
